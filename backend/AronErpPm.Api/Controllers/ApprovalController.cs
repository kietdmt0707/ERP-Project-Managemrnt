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
            try
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
                
                // Fallback: If no strict team leader is found, just grab any active LEADER in the project
                if (leaderMember == null)
                {
                    leaderMember = await _context.ProjectMembers
                        .Include(pm => pm.User)
                        .FirstOrDefaultAsync(pm => pm.ProjectId == request.ProjectId 
                                        && pm.Role!.RoleCode == "LEADER" && pm.IsActive);
                }
                
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

                // Self-approval bypass check: If the initiator is the PM of the project
                var isInitiatorPm = member.Role?.RoleCode == "PM";

                // Step 1 Record
                var step1 = new ApprovalStep
                {
                    WorkflowId = workflow.WorkflowId,
                    StepNumber = 1,
                    ApproverMemberId = step1ApproverId,
                    StepStatus = isInitiatorPm ? "APPROVED" : "PENDING",
                    ActionDate = isInitiatorPm ? DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc) : (DateTime?)null,
                    Comments = isInitiatorPm ? "Tự động duyệt (Khởi tạo bởi PM)" : null,
                    SecureToken = EmailService.GenerateSecureToken(),
                    TokenExpiry = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(24), DateTimeKind.Utc)
                };

                // Step 2 Record
                var step2 = new ApprovalStep
                {
                    WorkflowId = workflow.WorkflowId,
                    StepNumber = 2,
                    ApproverMemberId = step2ApproverId,
                    StepStatus = isInitiatorPm ? "APPROVED" : "PENDING",
                    ActionDate = isInitiatorPm ? DateTime.SpecifyKind(DateTime.UtcNow, DateTimeKind.Utc) : (DateTime?)null,
                    Comments = isInitiatorPm ? "Tự động duyệt (Khởi tạo bởi PM)" : null,
                    SecureToken = EmailService.GenerateSecureToken(),
                    TokenExpiry = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(48), DateTimeKind.Utc)
                };

                // Step 3 Record (Project Director)
                var step3 = new ApprovalStep
                {
                    WorkflowId = workflow.WorkflowId,
                    StepNumber = 3,
                    ApproverMemberId = step3ApproverId,
                    StepStatus = "PENDING",
                    SecureToken = EmailService.GenerateSecureToken(),
                    TokenExpiry = DateTime.SpecifyKind(DateTime.UtcNow.AddHours(72), DateTimeKind.Utc)
                };

                if (request.TargetType.ToUpper() == "TIMESHEET")
                {
                    if (isInitiatorPm)
                    {
                        // PM submitting timesheet -> Requires Director approval (Step 3)
                        _context.ApprovalSteps.AddRange(step1, step2, step3);
                        workflow.CurrentStepNumber = 3;
                        workflow.WorkflowStatus = "PENDING";
                        _context.ApprovalWorkflows.Update(workflow);
                    }
                    else
                    {
                        _context.ApprovalSteps.AddRange(step1, step2);
                    }
                }
                else
                {
                    // Financial Travel & Expenses -> 3 Steps
                    _context.ApprovalSteps.AddRange(step1, step2, step3);

                    if (isInitiatorPm)
                    {
                        workflow.CurrentStepNumber = 3;
                        _context.ApprovalWorkflows.Update(workflow);
                    }
                }
                await _context.SaveChangesAsync();

                // Trigger Email to the correct starting step approver
                ProjectMember? currentApprover = null;
                int stepIdToSend = step1.StepId;
                string tokenToSend = step1.SecureToken!;

                if (isInitiatorPm)
                {
                    currentApprover = dirMember;
                    var savedStep3 = await _context.ApprovalSteps.FirstOrDefaultAsync(s => s.WorkflowId == workflow.WorkflowId && s.StepNumber == 3);
                    if (savedStep3 != null)
                    {
                        stepIdToSend = savedStep3.StepId;
                        tokenToSend = savedStep3.SecureToken!;
                        // Make sure we grab the actual assigned user for Step 3
                        currentApprover = await _context.ProjectMembers.Include(pm => pm.User)
                            .FirstOrDefaultAsync(pm => pm.ProjectMemberId == savedStep3.ApproverMemberId);
                    }
                }
                else
                {
                    // Grab the exact user assigned to Step 1
                    currentApprover = await _context.ProjectMembers.Include(pm => pm.User)
                        .FirstOrDefaultAsync(pm => pm.ProjectMemberId == step1ApproverId);
                }

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
                        stepIdToSend,
                        tokenToSend
                    );
                }

                // Update Target item status to "SUBMITTED"
                await UpdateTargetItemStatusAsync(workflow.TargetType, workflow.TargetId, "SUBMITTED");

                return Ok(new { message = isInitiatorPm ? "Timesheet đã được chuyển tới Giám Đốc (Director) phê duyệt!" : "Gửi yêu cầu phê duyệt thành công! Luồng phê duyệt đã được kích hoạt.", workflowId = workflow.WorkflowId });
            }
            catch (Exception ex)
            {
                var details = ex.Message;
                if (ex.InnerException != null) details += " | Inner: " + ex.InnerException.Message;
                Console.WriteLine($"SubmitRequest DB Error: {details}");
                return BadRequest(new { message = "Lỗi xử lý yêu cầu duyệt: " + details });
            }
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

            if (step != null)
            {
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
                        .FirstOrDefaultAsync(s => s.WorkflowId == workflow.WorkflowId && s.StepNumber == workflow.CurrentStepNumber + 1);

                    if (nextStep != null)
                    {
                        workflow.CurrentStepNumber++;
                        _context.ApprovalWorkflows.Update(workflow);

                        // Trigger Email to Next Approver
                        if (nextStep.ApproverMember?.User != null)
                        {
                            await _emailService.SendApprovalEmailAsync(
                                nextStep.ApproverMember.User.Email,
                                nextStep.ApproverMember.User.FullName,
                                workflow.SubmitterMember?.User?.FullName ?? "Unknown",
                                workflow.Project?.ProjectName ?? "ARON ERP",
                                workflow.TargetType,
                                "Tiếp tục phê duyệt workflow",
                                0,
                                nextStep.StepId,
                                nextStep.SecureToken!
                            );
                        }
                    }
                    else
                    {
                        workflow.WorkflowStatus = "APPROVED";
                        workflow.UpdatedDate = DateTime.UtcNow;
                        _context.ApprovalWorkflows.Update(workflow);
                        await UpdateTargetItemStatusAsync(workflow.TargetType, workflow.TargetId, "APPROVED");

                        // Final email
                        if (workflow.SubmitterMember?.User != null)
                        {
                            await _emailService.SendFinalResultEmailAsync(
                                workflow.SubmitterMember.User.Email,
                                workflow.SubmitterMember.User.FullName,
                                workflow.Project?.ProjectName ?? "ARON ERP",
                                workflow.TargetType,
                                "Hoàn tất phê duyệt",
                                0,
                                true,
                                step.Comments
                            );
                        }
                    }

                    await _context.SaveChangesAsync();
                    return RenderHtmlResponse(true, $"Phê duyệt {workflow.TargetType} thành công! Hồ sơ đã được lưu.");
                }
                else if (action.ToUpper() == "REJECT")
                {
                    step.StepStatus = "REJECTED";
                    step.ActionDate = DateTime.UtcNow;
                    step.Comments = "Từ chối nhanh qua Email";
                    _context.ApprovalSteps.Update(step);

                    workflow.WorkflowStatus = "REJECTED";
                    workflow.UpdatedDate = DateTime.UtcNow;
                    _context.ApprovalWorkflows.Update(workflow);
                    await UpdateTargetItemStatusAsync(workflow.TargetType, workflow.TargetId, "REJECTED");

                    if (workflow.SubmitterMember?.User != null)
                    {
                        await _emailService.SendFinalResultEmailAsync(
                            workflow.SubmitterMember.User.Email,
                            workflow.SubmitterMember.User.FullName,
                            workflow.Project?.ProjectName ?? "ARON ERP",
                            workflow.TargetType,
                            "Bị từ chối phê duyệt",
                            0,
                            false,
                            step.Comments
                        );
                    }

                    await _context.SaveChangesAsync();
                    return RenderHtmlResponse(true, $"Đã TỪ CHỐI {workflow.TargetType} thành công.");
                }
            }

            // If not found in ApprovalSteps, check LeaveProjectApprovals
            var leaveStep = await _context.LeaveProjectApprovals
                .Include(a => a.LeaveRequest).ThenInclude(l => l!.User)
                .Include(a => a.Project)
                .FirstOrDefaultAsync(a => a.SecureToken == token);

            if (leaveStep != null)
            {
                if (leaveStep.TokenExpiry < DateTime.UtcNow)
                {
                    return RenderHtmlResponse(false, "Yêu cầu phê duyệt này đã hết hạn (quá 24 giờ).");
                }

                if (leaveStep.Status != "PENDING")
                {
                    return RenderHtmlResponse(false, $"Bước phê duyệt này đã được xử lý từ trước với trạng thái: <strong>{leaveStep.Status}</strong>.");
                }

                var leave = leaveStep.LeaveRequest;
                if (leave == null) return BadRequest("Không tìm thấy thông tin đơn nghỉ phép.");

                if (action.ToUpper() == "APPROVE")
                {
                    leaveStep.Status = "APPROVED";
                    leaveStep.ActionDate = DateTime.UtcNow;
                    leaveStep.Comments = "Phê duyệt nhanh qua Email";
                    _context.LeaveProjectApprovals.Update(leaveStep);
                    await _context.SaveChangesAsync();

                    var allApprovals = await _context.LeaveProjectApprovals
                        .Where(a => a.LeaveId == leaveStep.LeaveId)
                        .ToListAsync();

                    if (allApprovals.All(a => a.Status == "APPROVED"))
                    {
                        leave.Status = "APPROVED";
                        _context.LeaveRequests.Update(leave);

                        var requester = leave.User;
                        if (requester != null && !string.IsNullOrEmpty(requester.Email))
                        {
                            var requesterName = requester.FullName ?? requester.Username;
                            var projectName = leaveStep.Project?.ProjectName ?? $"Project #{leaveStep.ProjectId}";
                            await _emailService.SendFinalResultEmailAsync(
                                requester.Email,
                                requesterName,
                                projectName,
                                "Nghỉ phép",
                                $"Xin nghỉ phép từ {leave.StartDate:dd/MM/yyyy} đến {leave.EndDate:dd/MM/yyyy}",
                                0,
                                true,
                                leaveStep.Comments
                            );
                        }
                    }
                    await _context.SaveChangesAsync();
                    return RenderHtmlResponse(true, $"Phê duyệt Nghỉ Phép thành công!");
                }
                else if (action.ToUpper() == "REJECT")
                {
                    leaveStep.Status = "REJECTED";
                    leaveStep.ActionDate = DateTime.UtcNow;
                    leaveStep.Comments = "Từ chối nhanh qua Email";
                    _context.LeaveProjectApprovals.Update(leaveStep);

                    leave.Status = "REJECTED";
                    _context.LeaveRequests.Update(leave);

                    var requester = leave.User;
                    if (requester != null && !string.IsNullOrEmpty(requester.Email))
                    {
                        var requesterName = requester.FullName ?? requester.Username;
                        var projectName = leaveStep.Project?.ProjectName ?? $"Project #{leaveStep.ProjectId}";
                        await _emailService.SendFinalResultEmailAsync(
                            requester.Email,
                            requesterName,
                            projectName,
                            "Nghỉ phép",
                            $"Xin nghỉ phép từ {leave.StartDate:dd/MM/yyyy} đến {leave.EndDate:dd/MM/yyyy}",
                            0,
                            false,
                            leaveStep.Comments
                        );
                    }

                    await _context.SaveChangesAsync();
                    return RenderHtmlResponse(true, $"Đã TỪ CHỐI đơn Nghỉ Phép thành công.");
                }
            }

            return RenderHtmlResponse(false, "Token phê duyệt không hợp lệ.");


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

            if (step != null)
            {
                if (step.StepStatus != "PENDING")
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

                    // Send Final Notification
                    if (workflow.SubmitterMember?.User != null)
                    {
                        var details = await GetTargetItemDetailsAsync(workflow.TargetType, workflow.TargetId);
                        await _emailService.SendFinalResultEmailAsync(
                            workflow.SubmitterMember.User.Email,
                            workflow.SubmitterMember.User.FullName,
                            workflow.Project?.ProjectName ?? "Dự án",
                            workflow.TargetType,
                            details.description,
                            details.amount,
                            false,
                            reason
                        );
                    }
                }

                await _context.SaveChangesAsync();
                return RenderHtmlResponse(true, "Đã từ chối phê duyệt yêu cầu thành công.");
            }

            // Check LeaveProjectApprovals
            var leaveStep = await _context.LeaveProjectApprovals
                .Include(a => a.LeaveRequest).ThenInclude(l => l!.User)
                .Include(a => a.Project)
                .FirstOrDefaultAsync(a => a.SecureToken == token);
            
            if (leaveStep != null)
            {
                if (leaveStep.Status != "PENDING")
                {
                    return RenderHtmlResponse(false, "Token không hợp lệ hoặc đã được phê duyệt trước đó.");
                }

                leaveStep.Status = "REJECTED";
                leaveStep.ActionDate = DateTime.UtcNow;
                leaveStep.Comments = reason;
                _context.LeaveProjectApprovals.Update(leaveStep);

                var leave = leaveStep.LeaveRequest;
                if (leave != null)
                {
                    leave.Status = "REJECTED";
                    _context.LeaveRequests.Update(leave);

                    var requester = leave.User;
                    if (requester != null && !string.IsNullOrEmpty(requester.Email))
                    {
                        var requesterName = requester.FullName ?? requester.Username;
                        var projectName = leaveStep.Project?.ProjectName ?? $"Project #{leaveStep.ProjectId}";
                        await _emailService.SendFinalResultEmailAsync(
                            requester.Email,
                            requesterName,
                            projectName,
                            "Nghỉ phép",
                            $"Xin nghỉ phép từ {leave.StartDate:dd/MM/yyyy} đến {leave.EndDate:dd/MM/yyyy}",
                            0,
                            false,
                            reason
                        );
                    }
                }

                await _context.SaveChangesAsync();
                return RenderHtmlResponse(true, "Đã TỪ CHỐI đơn Nghỉ Phép thành công.");
            }

            return RenderHtmlResponse(false, "Token không hợp lệ.");
        }

        private async Task<(string description, decimal amount)> GetTargetItemDetailsAsync(string targetType, int targetId)
        {
            if (targetType == "TIMESHEET")
            {
                var ts = await _context.Timesheets.FindAsync(targetId);
                return (ts?.Description ?? "Timesheet", 0);
            }
            else if (targetType == "TRIP")
            {
                var trip = await _context.BusinessTrips.FindAsync(targetId);
                return ($"Công tác: {trip?.Title} - {trip?.Destination}", 0);
            }
            else if (targetType == "EXPENSE")
            {
                var exp = await _context.Expenses.FindAsync(targetId);
                var desc = exp != null ? $"Chi phí: {exp.ExpenseType}" + (string.IsNullOrEmpty(exp.Notes) ? "" : $" - {exp.Notes}") : "Chi phí đề xuất";
                return (desc, exp?.AmountActual ?? 0);
            }
            return ("Yêu cầu phê duyệt", 0);
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
        [Authorize]
        [HttpGet("pending")]
        public async Task<IActionResult> GetPendingApprovals()
        {
            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Unauthorized();

            var pendingSteps = await _context.ApprovalSteps
                .Include(s => s.Workflow).ThenInclude(w => w!.Project)
                .Include(s => s.Workflow).ThenInclude(w => w!.SubmitterMember).ThenInclude(m => m!.User)
                .Where(s => s.ApproverMember!.User!.Username == username && s.StepStatus == "PENDING")
                .OrderByDescending(s => s.Workflow!.CreatedDate)
                .ToListAsync();

            var result = new List<object>();
            foreach(var step in pendingSteps)
            {
                var details = await GetTargetItemDetailsAsync(step.Workflow!.TargetType, step.Workflow.TargetId);
                
                // Get all steps for this workflow to show multi-level status
                var allSteps = await _context.ApprovalSteps
                    .Include(x => x.ApproverMember).ThenInclude(x => x!.Role)
                    .Include(x => x.ApproverMember).ThenInclude(x => x!.User)
                    .Where(x => x.WorkflowId == step.WorkflowId)
                    .OrderBy(x => x.StepNumber)
                    .Select(x => new {
                        x.StepNumber,
                        Role = x.ApproverMember!.Role!.RoleCode,
                        ApproverName = x.ApproverMember!.User!.FullName,
                        x.StepStatus,
                        x.ActionDate,
                        x.Comments
                    })
                    .ToListAsync();

                result.Add(new {
                    step.StepId,
                    step.WorkflowId,
                    ProjectName = step.Workflow.Project?.ProjectName,
                    SubmitterName = step.Workflow.SubmitterMember?.User?.FullName,
                    TargetType = step.Workflow.TargetType,
                    TargetId = step.Workflow.TargetId,
                    Description = details.description,
                    Amount = details.amount,
                    CreatedDate = step.Workflow.CreatedDate,
                    AllSteps = allSteps
                });
            }

            return Ok(result);
        }

        [Authorize]
        [HttpGet("history")]
        public async Task<IActionResult> GetApprovalHistory([FromQuery] DateTime? fromDate, [FromQuery] DateTime? toDate, [FromQuery] int? projectId, [FromQuery] string? search)
        {
            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Unauthorized();

            var query = _context.ApprovalSteps
                .Include(s => s.Workflow).ThenInclude(w => w!.Project)
                .Include(s => s.Workflow).ThenInclude(w => w!.SubmitterMember).ThenInclude(m => m!.User)
                .Include(s => s.ApproverMember).ThenInclude(m => m!.User)
                .Where(s => s.ApproverMember!.User!.Username == username && s.StepStatus != "PENDING");

            if (fromDate.HasValue)
                query = query.Where(s => s.ActionDate >= fromDate.Value.ToUniversalTime());
            if (toDate.HasValue)
                query = query.Where(s => s.ActionDate <= toDate.Value.ToUniversalTime().AddDays(1).AddTicks(-1));
            if (projectId.HasValue)
                query = query.Where(s => s.Workflow!.ProjectId == projectId.Value);
            if (!string.IsNullOrEmpty(search))
            {
                search = search.ToLower();
                query = query.Where(s => 
                    s.Workflow!.SubmitterMember!.User!.FullName.ToLower().Contains(search) || 
                    s.Workflow!.SubmitterMember!.User!.Email.ToLower().Contains(search));
            }

            var historySteps = await query.OrderByDescending(s => s.ActionDate).Take(50).ToListAsync();

            var result = new List<object>();
            foreach(var step in historySteps)
            {
                var details = await GetTargetItemDetailsAsync(step.Workflow!.TargetType, step.Workflow.TargetId);
                result.Add(new {
                    step.StepId,
                    step.WorkflowId,
                    ProjectName = step.Workflow.Project?.ProjectName,
                    SubmitterName = step.Workflow.SubmitterMember?.User?.FullName,
                    TargetType = step.Workflow.TargetType,
                    TargetId = step.Workflow.TargetId,
                    Description = details.description,
                    Amount = details.amount,
                    step.StepStatus,
                    step.ActionDate,
                    step.Comments
                });
            }

            return Ok(result);
        }

        [Authorize]
        [HttpPost("action/{stepId}")]
        public async Task<IActionResult> SubmitApprovalAction(int stepId, [FromBody] ApprovalActionDto actionDto)
        {
            var username = User.Identity?.Name;
            
            var step = await _context.ApprovalSteps
                .Include(s => s.Workflow).ThenInclude(w => w!.Project)
                .Include(s => s.Workflow).ThenInclude(w => w!.SubmitterMember).ThenInclude(m => m!.User)
                .Include(s => s.ApproverMember).ThenInclude(m => m!.User)
                .FirstOrDefaultAsync(s => s.StepId == stepId);

            if (step == null) return NotFound(new { message = "Không tìm thấy bước phê duyệt này." });
            if (step.ApproverMember?.User?.Username != username) return StatusCode(403, new { message = "Bạn không có quyền xử lý bước này." });
            if (step.StepStatus != "PENDING") return BadRequest(new { message = $"Yêu cầu này đã được xử lý (Trạng thái: {step.StepStatus})" });

            var workflow = step.Workflow;
            if (workflow == null) return BadRequest(new { message = "Không tìm thấy Workflow liên quan." });

            if (actionDto.Action.ToUpper() == "APPROVE")
            {
                step.StepStatus = "APPROVED";
                step.ActionDate = DateTime.UtcNow;
                step.Comments = actionDto.Reason ?? "Phê duyệt từ Cổng Portal";
                _context.ApprovalSteps.Update(step);

                var nextStep = await _context.ApprovalSteps
                    .Include(s => s.ApproverMember).ThenInclude(m => m!.User)
                    .FirstOrDefaultAsync(s => s.WorkflowId == workflow.WorkflowId && s.StepNumber == step.StepNumber + 1);

                if (nextStep != null)
                {
                    workflow.CurrentStepNumber = step.StepNumber + 1;
                    _context.ApprovalWorkflows.Update(workflow);

                    if (nextStep.ApproverMember?.User != null)
                    {
                        var details = await GetTargetItemDetailsAsync(workflow.TargetType, workflow.TargetId);
                        await _emailService.SendApprovalEmailAsync(
                            nextStep.ApproverMember.User.Email,
                            nextStep.ApproverMember.User.FullName,
                            workflow.SubmitterMember!.User!.FullName,
                            workflow.Project?.ProjectName ?? "ARON ERP Project",
                            workflow.TargetType,
                            details.description,
                            details.amount,
                            nextStep.StepId,
                            nextStep.SecureToken!
                        );
                    }
                }
                else
                {
                    workflow.WorkflowStatus = "APPROVED";
                    workflow.UpdatedDate = DateTime.UtcNow;
                    _context.ApprovalWorkflows.Update(workflow);
                    await UpdateTargetItemStatusAsync(workflow.TargetType, workflow.TargetId, "APPROVED");

                    // Send Final Notification
                    if (workflow.SubmitterMember?.User != null)
                    {
                        var details = await GetTargetItemDetailsAsync(workflow.TargetType, workflow.TargetId);
                        await _emailService.SendFinalResultEmailAsync(
                            workflow.SubmitterMember.User.Email,
                            workflow.SubmitterMember.User.FullName,
                            workflow.Project?.ProjectName ?? "Dự án",
                            workflow.TargetType,
                            details.description,
                            details.amount,
                            true,
                            step.Comments
                        );
                    }
                }
            }
            else if (actionDto.Action.ToUpper() == "REJECT")
            {
                if (string.IsNullOrEmpty(actionDto.Reason)) return BadRequest(new { message = "Vui lòng nhập lý do từ chối." });

                step.StepStatus = "REJECTED";
                step.ActionDate = DateTime.UtcNow;
                step.Comments = actionDto.Reason;
                _context.ApprovalSteps.Update(step);

                workflow.WorkflowStatus = "REJECTED";
                workflow.UpdatedDate = DateTime.UtcNow;
                _context.ApprovalWorkflows.Update(workflow);
                await UpdateTargetItemStatusAsync(workflow.TargetType, workflow.TargetId, "REJECTED");

                // Send Final Notification
                if (workflow.SubmitterMember?.User != null)
                {
                    var details = await GetTargetItemDetailsAsync(workflow.TargetType, workflow.TargetId);
                    await _emailService.SendFinalResultEmailAsync(
                        workflow.SubmitterMember.User.Email,
                        workflow.SubmitterMember.User.FullName,
                        workflow.Project?.ProjectName ?? "Dự án",
                        workflow.TargetType,
                        details.description,
                        details.amount,
                        false,
                        actionDto.Reason
                    );
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Đã xử lý yêu cầu thành công." });
        }
    }

    public class ApprovalActionDto
    {
        public string Action { get; set; } = string.Empty; // APPROVE or REJECT
        public string? Reason { get; set; }
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
