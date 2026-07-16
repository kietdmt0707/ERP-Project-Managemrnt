using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AronErpPm.Api.Data;
using AronErpPm.Api.DTOs;
using AronErpPm.Api.Models;
using AronErpPm.Api.Services;

namespace AronErpPm.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ApprovalController : ControllerBase
    {
        private readonly AronDbContext _context;
        private readonly IEmailService _emailService;
        private readonly ISharepointService _sharepointService;

        public ApprovalController(AronDbContext context, IEmailService emailService, ISharepointService sharepointService)
        {
            _context = context;
            _emailService = emailService;
            _sharepointService = sharepointService;
        }

        // 1. Submit Request to trigger 3-Level Workflow
        [Authorize]
        [HttpPost("submit")]
        public async Task<IActionResult> SubmitRequest([FromBody] FileRequestDto request)
        {
            var username = User.Identity?.Name;
            
            // Get Submitter membership
            var member = await _context.ProjectMembers
                .Include(pm => pm.User)
                .Include(pm => pm.FunctionalTeam)
                .FirstOrDefaultAsync(pm => pm.ProjectId == request.ProjectId && pm.User!.Username == username);

            if (member == null) return Forbid("Bạn không phải thành viên dự án này.");

            // Create Approval Workflow header
            var workflow = new ApprovalWorkflow
            {
                ProjectId = request.ProjectId,
                SubmitterMemberId = member.ProjectMemberId,
                TargetType = request.TargetType.ToUpper(),
                TargetId = request.TargetId,
                CurrentStepNumber = 1,
                WorkflowStatus = "PENDING"
            };

            _context.ApprovalWorkflows.Add(workflow);
            await _context.SaveChangesAsync();

            // Setup the 3 Steps dynamically based on organizational roles
            // Step 1: Module Leader (e.g., Leader of the Functional Team)
            var leaderMember = await _context.ProjectMembers
                .Include(pm => pm.User)
                .FirstOrDefaultAsync(pm => pm.ProjectId == request.ProjectId 
                                && pm.FunctionalTeamId == member.FunctionalTeamId 
                                && pm.Role!.RoleCode == "LEADER" && pm.IsActive);
            
            // Step 2: Project PM
            var pmMember = await _context.ProjectMembers
                .Include(pm => pm.User)
                .FirstOrDefaultAsync(pm => pm.ProjectId == request.ProjectId 
                                && pm.Role!.RoleCode == "PM" && pm.IsActive);

            // Step 3: Project Director
            var dirMember = await _context.ProjectMembers
                .Include(pm => pm.User)
                .FirstOrDefaultAsync(pm => pm.ProjectId == request.ProjectId 
                                && pm.Role!.RoleCode == "DIRECTOR" && pm.IsActive);

            // In case a step is missing, fallback to PM or Director
            var step1ApproverId = leaderMember?.ProjectMemberId ?? pmMember?.ProjectMemberId ?? member.ProjectMemberId;
            var step2ApproverId = pmMember?.ProjectMemberId ?? dirMember?.ProjectMemberId ?? step1ApproverId;
            var step3ApproverId = dirMember?.ProjectMemberId ?? step2ApproverId;

            // Step 1 Record
            var step1 = new ApprovalStep
            {
                WorkflowId = workflow.WorkflowId,
                StepNumber = 1,
                ApproverMemberId = step1ApproverId,
                StepStatus = "PENDING",
                SecureToken = EmailService.GenerateSecureToken(),
                TokenExpiry = DateTime.UtcNow.AddHours(24)
            };

            // Step 2 Record
            var step2 = new ApprovalStep
            {
                WorkflowId = workflow.WorkflowId,
                StepNumber = 2,
                ApproverMemberId = step2ApproverId,
                StepStatus = "PENDING",
                SecureToken = EmailService.GenerateSecureToken(),
                TokenExpiry = DateTime.UtcNow.AddHours(48)
            };

            if (request.TargetType.ToUpper() == "TIMESHEET")
            {
                _context.ApprovalSteps.AddRange(step1, step2);
            }
            else
            {
                // Step 3 Record (Only for financial Travel & Expenses)
                var step3 = new ApprovalStep
                {
                    WorkflowId = workflow.WorkflowId,
                    StepNumber = 3,
                    ApproverMemberId = step3ApproverId,
                    StepStatus = "PENDING",
                    SecureToken = EmailService.GenerateSecureToken(),
                    TokenExpiry = DateTime.UtcNow.AddHours(72)
                };
                _context.ApprovalSteps.AddRange(step1, step2, step3);
            }
            await _context.SaveChangesAsync();

            // Trigger Email to Level 1 Approver
            var currentApprover = leaderMember ?? pmMember;
            if (currentApprover?.User != null)
            {
                await _emailService.SendApprovalEmailAsync(
                    currentApprover.User.Email,
                    currentApprover.User.FullName,
                    member.User!.FullName,
                    member.Project?.ProjectName ?? "ARON ERP Project",
                    workflow.TargetType,
                    request.Description,
                    request.Amount,
                    step1.StepId,
                    step1.SecureToken!
                );
            }

            // Update Target item status to "PENDING_APPROVAL" or "SUBMITTED"
            await UpdateTargetItemStatusAsync(workflow.TargetType, workflow.TargetId, "SUBMITTED");

            return Ok(new { message = "Gửi yêu cầu phê duyệt thành công! Luồng phê duyệt 3 cấp đã được kích hoạt.", workflowId = workflow.WorkflowId });
        }

        // 2. One-click Email Quick Approval API (Returns beautiful HTML pages)
        [HttpGet("quick-action")]
        public async Task<IActionResult> QuickAction([FromQuery] string token, [FromQuery] string action)
        {
            var step = await _context.ApprovalSteps
                .Include(s => s.Workflow).ThenInclude(w => w!.Project)
                .Include(s => s.Workflow).ThenInclude(w => w!.SubmitterMember).ThenInclude(m => m!.User)
                .Include(s => s.ApproverMember).ThenInclude(m => m!.User)
                .FirstOrDefaultAsync(s => s.SecureToken == token);

            if (step == null)
            {
                return RenderHtmlResponse(false, "Token phê duyệt không hợp lệ.");
            }

            if (step.TokenExpiry < DateTime.UtcNow)
            {
                return RenderHtmlResponse(false, "Yêu cầu phê duyệt này đã hết hạn (quá 24 giờ).");
            }

            if (step.StepStatus != "PENDING")
            {
                return RenderHtmlResponse(false, $"Bước phê duyệt này đã được xử lý từ trước với trạng thái: <strong>{step.StepStatus}</strong>.");
            }

            var workflow = step.Workflow;
            if (workflow == null) return BadRequest("Không tìm thấy thông tin workflow.");

            if (action.ToUpper() == "APPROVE")
            {
                // Approve current step
                step.StepStatus = "APPROVED";
                step.ActionDate = DateTime.UtcNow;
                step.Comments = "Phê duyệt nhanh qua Email";
                _context.ApprovalSteps.Update(step);

                var nextStep = await _context.ApprovalSteps
                    .Include(s => s.ApproverMember).ThenInclude(m => m!.User)
                    .FirstOrDefaultAsync(s => s.WorkflowId == workflow.WorkflowId && s.StepNumber == step.StepNumber + 1);

                if (nextStep != null)
                {
                    // Move to Next Step
                    workflow.CurrentStepNumber = step.StepNumber + 1;
                    _context.ApprovalWorkflows.Update(workflow);

                    if (nextStep.ApproverMember?.User != null)
                    {
                        await _emailService.SendApprovalEmailAsync(
                            nextStep.ApproverMember.User.Email,
                            nextStep.ApproverMember.User.FullName,
                            workflow.SubmitterMember!.User!.FullName,
                            workflow.Project?.ProjectName ?? "ARON ERP Project",
                            workflow.TargetType,
                            $"Tiếp tục phê duyệt Cấp {nextStep.StepNumber} cho yêu cầu ID #{workflow.TargetId}",
                            0,
                            nextStep.StepId,
                            nextStep.SecureToken!
                        );
                    }
                }
                else
                {
                    // Fully Approved!
                    workflow.WorkflowStatus = "APPROVED";
                    workflow.UpdatedDate = DateTime.UtcNow;
                    _context.ApprovalWorkflows.Update(workflow);

                    // Update Target item status to APPROVED
                    await UpdateTargetItemStatusAsync(workflow.TargetType, workflow.TargetId, "APPROVED");
                }

                await _context.SaveChangesAsync();
                return RenderHtmlResponse(true, "Yêu cầu đã được phê duyệt thành công!");
            }
            else if (action.ToUpper() == "REJECT")
            {
                // Renders a simple HTML rejection form page requiring rejection reasons
                return RenderRejectionForm(token);
            }

            return BadRequest();
        }

        // Handles submission of Rejection from Quick HTML Form
        [HttpPost("quick-reject")]
        public async Task<IActionResult> QuickRejectSubmit([FromForm] string token, [FromForm] string reason)
        {
            if (string.IsNullOrEmpty(reason))
            {
                return RenderHtmlResponse(false, "Vui lòng nhập lý do từ chối trước khi lưu.");
            }

            var step = await _context.ApprovalSteps
                .Include(s => s.Workflow)
                .FirstOrDefaultAsync(s => s.SecureToken == token);

            if (step == null || step.StepStatus != "PENDING")
            {
                return RenderHtmlResponse(false, "Token không hợp lệ hoặc đã được phê duyệt trước đó.");
            }

            step.StepStatus = "REJECTED";
            step.ActionDate = DateTime.UtcNow;
            step.Comments = reason;
            _context.ApprovalSteps.Update(step);

            var workflow = step.Workflow;
            if (workflow != null)
            {
                workflow.WorkflowStatus = "REJECTED";
                workflow.UpdatedDate = DateTime.UtcNow;
                _context.ApprovalWorkflows.Update(workflow);

                // Update Target item status to REJECTED
                await UpdateTargetItemStatusAsync(workflow.TargetType, workflow.TargetId, "REJECTED");
            }

            await _context.SaveChangesAsync();
            return RenderHtmlResponse(true, "Đã từ chối phê duyệt yêu cầu thành công.");
        }

        // Helper to update statuses of timesheets, expenses or trips
        private async System.Threading.Tasks.Task UpdateTargetItemStatusAsync(string targetType, int targetId, string status)
        {
            if (targetType == "TIMESHEET")
            {
                var item = await _context.Timesheets.FindAsync(targetId);
                if (item != null)
                {
                    item.Status = status;
                    if (status == "APPROVED") item.ApprovalDate = DateTime.UtcNow;
                    _context.Timesheets.Update(item);
                    await _context.SaveChangesAsync();
                    if (status == "APPROVED")
                    {
                        await RecalculateProjectActualCostAsync(item.ProjectId);
                    }
                }
            }
            else if (targetType == "TRIP")
            {
                var item = await _context.BusinessTrips
                    .Include(t => t.CreatedByMember).ThenInclude(m => m!.User)
                    .FirstOrDefaultAsync(t => t.TripId == targetId);

                if (item != null)
                {
                    item.Status = status;
                    _context.BusinessTrips.Update(item);
                    await _context.SaveChangesAsync();

                    if (status == "APPROVED" && item.CreatedByMember?.User != null)
                    {
                        await _sharepointService.SyncTripToOutlookCalendarAsync(
                            item.Title,
                            item.Destination,
                            item.StartDate,
                            item.EndDate,
                            item.CreatedByMember.User.Email
                        );
                    }
                }
            }
            else if (targetType == "EXPENSE")
            {
                var item = await _context.Expenses.Include(e => e.BusinessTrip).FirstOrDefaultAsync(e => e.ExpenseId == targetId);
                if (item != null)
                {
                    item.Status = status;
                    _context.Expenses.Update(item);
                    await _context.SaveChangesAsync();
                    if (status == "APPROVED" && item.BusinessTrip != null)
                    {
                        await RecalculateProjectActualCostAsync(item.BusinessTrip.ProjectId);
                    }
                }
            }
        }

        private async System.Threading.Tasks.Task RecalculateProjectActualCostAsync(int projectId)
        {
            var project = await _context.Projects.FindAsync(projectId);
            if (project == null) return;

            // 1. Sum of all approved expenses
            var totalExpenses = await _context.Expenses
                .Where(e => e.BusinessTrip!.ProjectId == projectId && e.Status == "APPROVED")
                .SumAsync(e => e.AmountActual);

            // 2. Sum of all approved timesheet costs
            var totalTimesheets = await _context.Timesheets
                .Include(t => t.Member)
                .Where(t => t.ProjectId == projectId && t.Status == "APPROVED")
                .ToListAsync();

            decimal timesheetSum = 0;
            foreach (var ts in totalTimesheets)
            {
                var rate = ts.Member?.DailyRate ?? 150.00m;
                timesheetSum += (ts.HoursWorked / 8m) * rate;
            }

            project.ActualCost = totalExpenses + timesheetSum;
            _context.Projects.Update(project);
            await _context.SaveChangesAsync();
        }

        // HTML Renders
        private ContentResult RenderHtmlResponse(bool isSuccess, string message)
        {
            var color = isSuccess ? "#198754" : "#dc3545";
            var icon = isSuccess ? "✔️" : "❌";
            var title = isSuccess ? "Phê Duyệt Thành Công" : "Lỗi Phê Duyệt";

            var html = $@"
            <html>
            <head>
                <meta charset='utf-8' />
                <title>{title}</title>
                <meta name='viewport' content='width=device-width, initial-scale=1' />
                <style>
                    body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; text-align: center; padding: 50px 20px; }}
                    .card {{ max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }}
                    .icon {{ font-size: 64px; color: {color}; margin-bottom: 20px; }}
                    h2 {{ color: #333; margin-top: 0; }}
                    p {{ color: #666; line-height: 1.6; font-size: 16px; }}
                    .footer {{ margin-top: 30px; font-size: 12px; color: #999; }}
                </style>
            </head>
            <body>
                <div class='card'>
                    <div class='icon'>{icon}</div>
                    <h2>{title}</h2>
                    <p>{message}</p>
                    <div class='footer'>Hệ thống quản lý dự án ARON ERP-PM</div>
                </div>
            </body>
            </html>";

            return new ContentResult
            {
                ContentType = "text/html",
                Content = html,
                StatusCode = 200
            };
        }

        private ContentResult RenderRejectionForm(string token)
        {
            var html = $@"
            <html>
            <head>
                <meta charset='utf-8' />
                <title>Từ Chối Phê Duyệt</title>
                <meta name='viewport' content='width=device-width, initial-scale=1' />
                <style>
                    body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; padding: 50px 20px; }}
                    .card {{ max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); }}
                    h2 {{ color: #dc3545; margin-top: 0; text-align: center; }}
                    label {{ font-weight: bold; color: #333; display: block; margin-bottom: 8px; }}
                    textarea {{ width: 100%; height: 100px; padding: 10px; border: 1px solid #ccc; border-radius: 5px; box-sizing: border-box; font-family: inherit; font-size: 14px; margin-bottom: 20px; resize: none; }}
                    input[type='submit'] {{ width: 100%; background-color: #dc3545; color: white; border: none; padding: 12px; border-radius: 5px; font-size: 16px; font-weight: bold; cursor: pointer; transition: background 0.2s; }}
                    input[type='submit']:hover {{ background-color: #bd2130; }}
                    .footer {{ text-align: center; margin-top: 30px; font-size: 12px; color: #999; }}
                </style>
            </head>
            <body>
                <div class='card'>
                    <h2>Từ Chối Yêu Cầu</h2>
                    <form action='/api/approvals/quick-reject' method='POST'>
                        <input type='hidden' name='token' value='{token}' />
                        <label for='reason'>Vui lòng nhập lý do từ chối:</label>
                        <textarea id='reason' name='reason' placeholder='Lý do từ chối yêu cầu...' required></textarea>
                        <input type='submit' value='XÁC NHẬN TỪ CHỐI' />
                    </form>
                    <div class='footer'>Hệ thống quản lý dự án ARON ERP-PM</div>
                </div>
            </body>
            </html>";

            return new ContentResult
            {
                ContentType = "text/html",
                Content = html,
                StatusCode = 200
            };
        }
    }

    public class FileRequestDto
    {
        public int ProjectId { get; set; }
        public string TargetType { get; set; } = string.Empty; // TIMESHEET, EXPENSE, TRIP
        public int TargetId { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
    }
}
