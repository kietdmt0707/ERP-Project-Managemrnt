using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AronErpPm.Api.Data;
using AronErpPm.Api.Models;
using AronErpPm.Api.Services;

namespace AronErpPm.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class LeaveController : ControllerBase
    {
        private readonly AronDbContext _context;
        private readonly IEmailService _emailService;

        public LeaveController(AronDbContext context, IEmailService emailService)
        {
            _context = context;
            _emailService = emailService;
        }

        // 1. Get Leave Dashboard Info (Carry-over algorithm included)
        [HttpGet("dashboard")]
        public async Task<IActionResult> GetLeaveDashboard()
        {
            var userIdStr = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out var userId)) return Unauthorized("Không xác định được phiên đăng nhập.");
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("Không tìm thấy thông tin tài khoản.");

            int annualLeaveDays = user.AnnualLeaveDays;
            int carryOverDays = user.CarryOverDays;
            int seniorityYears = user.SeniorityYears;
            int seniorityLeaveDays = (int)Math.Floor(seniorityYears / 3.0);

            var currentYear = DateTime.Today.Year;
            var cutOffDate = new DateTime(currentYear, 4, 1, 0, 0, 0, DateTimeKind.Utc);

            var leaveRequests = await _context.LeaveRequests
                .Where(r => r.UserId == user.UserId)
                .OrderByDescending(r => r.CreatedDate)
                .Include(r => r.ProjectApprovals)
                    .ThenInclude(pa => pa.Project)
                .ToListAsync();

            decimal usedBeforeApril1 = leaveRequests
                .Where(r => r.Status == "APPROVED" && r.CancelStatus != "APPROVED" && r.StartDate.ToUniversalTime() < cutOffDate)
                .Sum(r => r.TotalDays);

            decimal usedAfterApril1 = leaveRequests
                .Where(r => r.Status == "APPROVED" && r.CancelStatus != "APPROVED" && r.StartDate.ToUniversalTime() >= cutOffDate)
                .Sum(r => r.TotalDays);

            decimal usedLeaveDays = usedBeforeApril1 + usedAfterApril1;
            decimal totalAvailable = 0;

            if (DateTime.UtcNow < cutOffDate)
            {
                // Still in Q1, carryover is active
                totalAvailable = annualLeaveDays + carryOverDays + seniorityLeaveDays - usedBeforeApril1;
            }
            else
            {
                // Q2 or later, carryover expired
                // Leaves taken in Q1 deduct from CarryOver FIRST
                decimal carryOverUsed = Math.Min(usedBeforeApril1, carryOverDays);
                decimal annualSeniorityUsedInQ1 = usedBeforeApril1 - carryOverUsed;
                
                // CarryOver remaining is expired
                carryOverDays = 0;
                
                totalAvailable = annualLeaveDays + seniorityLeaveDays - annualSeniorityUsedInQ1 - usedAfterApril1;
            }

            // Get user's active projects to populate check boxes on frontend
            var projectMemberships = await _context.ProjectMembers
                .Include(pm => pm.Project)
                .Include(pm => pm.Role)
                .Where(pm => pm.UserId == user.UserId && pm.IsActive)
                .ToListAsync();

            var activeProjects = new List<object>();
            foreach (var pm in projectMemberships)
            {
                var approver = await _context.ProjectMembers
                    .Include(pm2 => pm2.User)
                    .Include(pm2 => pm2.Role)
                    .Where(pm2 => pm2.ProjectId == pm.ProjectId && pm2.Role != null && pm2.Role.RoleCode == "PM" && pm2.IsActive)
                    .FirstOrDefaultAsync();

                activeProjects.Add(new
                {
                    ProjectId = pm.ProjectId,
                    ProjectName = pm.Project != null ? pm.Project.ProjectName : "Dự án ẩn",
                    RoleCode = pm.Role != null ? pm.Role.RoleCode : "MEMBER",
                    ApproverName = (approver != null && approver.User != null) ? approver.User.FullName : "Admin System (Mặc định)"
                });
            }

            // Fetch history mapping

            var history = leaveRequests.Select(r => new
            {
                r.LeaveId,
                r.StartDate,
                r.EndDate,
                r.TotalDays,
                r.Reason,
                r.Status,
                r.CancelStatus,
                r.CreatedDate,
                ProjectApprovals = r.ProjectApprovals.Select(a => new
                {
                    a.ApprovalId,
                    a.ProjectId,
                    Project = new { ProjectName = a.Project != null ? a.Project.ProjectName : "Dự án ẩn" },
                    a.Status,
                    a.Comments
                }).ToList()
            }).ToList();

            return Ok(new
            {
                annualLeaveDays,
                carryOverDays,
                seniorityYears,
                seniorityLeaveDays,
                usedLeaveDays,
                totalAvailable,
                activeProjects,
                history
            });
        }

        // 2. Submit Leave Request with Parallel PM approvals
        [HttpPost("request")]
        public async Task<IActionResult> SubmitLeaveRequest([FromBody] LeaveRequestSubmissionDto dto)
        {
            var userIdStr = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out var userId)) return Unauthorized("Không xác định được phiên đăng nhập.");
            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("Không tìm thấy thông tin tài khoản.");

            if (dto.ProjectIds == null || !dto.ProjectIds.Any())
            {
                return BadRequest("Vui lòng chọn ít nhất một dự án chịu ảnh hưởng.");
            }

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                var leaveRequest = new LeaveRequest
                {
                    UserId = user.UserId,
                    StartDate = dto.StartDate,
                    EndDate = dto.EndDate,
                    TotalDays = dto.TotalDays,
                    Reason = dto.Reason,
                    Status = "PENDING",
                    CreatedDate = DateTime.UtcNow
                };

                _context.LeaveRequests.Add(leaveRequest);
                await _context.SaveChangesAsync();

                // Create Parallel Approvals for each selected project
                foreach (var pId in dto.ProjectIds)
                {
                    // 1. Find requester's role in this project
                    var requesterMember = await _context.ProjectMembers
                        .Include(pm => pm.Role)
                        .Include(pm => pm.Project)
                        .FirstOrDefaultAsync(pm => pm.ProjectId == pId && pm.UserId == user.UserId && pm.IsActive);

                    var requesterRole = requesterMember?.Role?.RoleCode ?? "MEMBER";
                    var projectName = requesterMember?.Project?.ProjectName ?? $"Project #{pId}";
                    var requesterName = user.FullName ?? user.Username;

                    ProjectMember? approverMember = null;

                    // 2. Role-based Routing
                    if (requesterRole == "PM")
                    {
                        // PM requests leave -> send to DIRECTOR
                        approverMember = await _context.ProjectMembers
                            .Include(pm => pm.Role)
                            .Include(pm => pm.User)
                            .FirstOrDefaultAsync(pm => pm.ProjectId == pId && pm.Role!.RoleCode == "DIRECTOR" && pm.IsActive);
                    }
                    else
                    {
                        // MEMBER, LEADER, PC requests leave -> send to PM
                        approverMember = await _context.ProjectMembers
                            .Include(pm => pm.Role)
                            .Include(pm => pm.User)
                            .FirstOrDefaultAsync(pm => pm.ProjectId == pId && pm.Role!.RoleCode == "PM" && pm.IsActive);
                    }

                    // 3. Fallbacks
                    if (approverMember == null)
                    {
                        // Fallback to PM if DIRECTOR not found for PM
                        approverMember = await _context.ProjectMembers
                            .Include(pm => pm.Role)
                            .Include(pm => pm.User)
                            .FirstOrDefaultAsync(pm => pm.ProjectId == pId && pm.Role!.RoleCode == "PM" && pm.IsActive);
                    }
                    
                    if (approverMember == null)
                    {
                        // Fallback to any active member (e.g. SysAdmin)
                        approverMember = await _context.ProjectMembers
                            .Include(pm => pm.User)
                            .FirstOrDefaultAsync(pm => pm.ProjectId == pId && pm.IsActive);
                    }

                    var approverId = approverMember?.ProjectMemberId ?? 1;
                    var approverName = approverMember?.User?.FullName ?? "Người quản lý";
                    var approverEmail = approverMember?.User?.Email ?? "";
                    
                    var secureToken = EmailService.GenerateSecureToken();

                    var approval = new LeaveProjectApproval
                    {
                        LeaveId = leaveRequest.LeaveId,
                        ProjectId = pId,
                        ApproverMemberId = approverId,
                        Status = "PENDING",
                        SecureToken = secureToken,
                        TokenExpiry = DateTime.UtcNow.AddDays(1) // 24 hours expiry
                    };

                    _context.LeaveProjectApprovals.Add(approval);

                    // Send Email Notification
                    if (!string.IsNullOrEmpty(approverEmail))
                    {
                        await _emailService.SendApprovalEmailAsync(
                            approverEmail,
                            approverName,
                            requesterName,
                            projectName,
                            "Nghỉ phép",
                            $"Xin nghỉ phép từ {dto.StartDate:dd/MM/yyyy} đến {dto.EndDate:dd/MM/yyyy} ({dto.TotalDays} ngày). Lý do: {dto.Reason}",
                            0,
                            approval.LeaveId, // Using leaveId as stepId context for now, QuickAction logic will handle it
                            secureToken
                        );
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = "Đã gửi đơn xin nghỉ phép! Lịch trình phê duyệt song song đa dự án đã được kích hoạt.", leaveId = leaveRequest.LeaveId });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "Lỗi khi gửi đơn xin nghỉ phép.", details = ex.Message });
            }
        }

        // 3. Approve a specific project leave approval step
        [HttpPost("approve/{approvalId}")]
        public async Task<IActionResult> ApproveLeaveStep(int approvalId, [FromBody] ApprovalCommentDto dto)
        {
            var approval = await _context.LeaveProjectApprovals
                .Include(a => a.LeaveRequest)
                .FirstOrDefaultAsync(a => a.ApprovalId == approvalId);

            if (approval == null) return NotFound("Không tìm thấy bản ghi phê duyệt.");
            if (approval.Status != "PENDING") return BadRequest("Yêu cầu phê duyệt này đã được xử lý trước đó.");

            approval.Status = "APPROVED";
            approval.ActionDate = DateTime.UtcNow;
            approval.Comments = dto.Comments ?? "Phê duyệt nghỉ phép";
            _context.LeaveProjectApprovals.Update(approval);
            await _context.SaveChangesAsync();

            // Check if ALL parallel PM approvals are APPROVED
            var allApprovals = await _context.LeaveProjectApprovals
                .Where(a => a.LeaveId == approval.LeaveId)
                .ToListAsync();

            var leave = approval.LeaveRequest;
            if (leave != null)
            {
                if (allApprovals.All(a => a.Status == "APPROVED"))
                {
                    leave.Status = "APPROVED";
                    _context.LeaveRequests.Update(leave);

                    // Send Final Approval Email
                    var requester = await _context.Users.FindAsync(leave.UserId);
                    var project = await _context.Projects.FindAsync(approval.ProjectId);
                    if (requester != null && !string.IsNullOrEmpty(requester.Email))
                    {
                        var requesterName = requester.FullName ?? requester.Username;
                        var projectName = project?.ProjectName ?? $"Project #{approval.ProjectId}";
                        await _emailService.SendFinalResultEmailAsync(
                            requester.Email,
                            requesterName,
                            projectName,
                            "Nghỉ phép",
                            $"Xin nghỉ phép từ {leave.StartDate:dd/MM/yyyy} đến {leave.EndDate:dd/MM/yyyy}",
                            0,
                            true,
                            approval.Comments
                        );
                    }
                }
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Phê duyệt thành công!", overallStatus = leave?.Status });
        }

        // 4. Reject a specific project leave approval step
        [HttpPost("reject/{approvalId}")]
        public async Task<IActionResult> RejectLeaveStep(int approvalId, [FromBody] ApprovalCommentDto dto)
        {
            var approval = await _context.LeaveProjectApprovals
                .Include(a => a.LeaveRequest)
                .FirstOrDefaultAsync(a => a.ApprovalId == approvalId);

            if (approval == null) return NotFound("Không tìm thấy bản ghi phê duyệt.");
            if (approval.Status != "PENDING") return BadRequest("Yêu cầu phê duyệt này đã được xử lý trước đó.");

            approval.Status = "REJECTED";
            approval.ActionDate = DateTime.UtcNow;
            approval.Comments = dto.Comments ?? "Từ chối nghỉ phép";
            _context.LeaveProjectApprovals.Update(approval);

            // Any single PM rejection rejects the overall request immediately
            var leave = approval.LeaveRequest;
            if (leave != null)
            {
                leave.Status = "REJECTED";
                _context.LeaveRequests.Update(leave);

                // Send Final Rejection Email
                var requester = await _context.Users.FindAsync(leave.UserId);
                var project = await _context.Projects.FindAsync(approval.ProjectId);
                if (requester != null && !string.IsNullOrEmpty(requester.Email))
                {
                    var requesterName = requester.FullName ?? requester.Username;
                    var projectName = project?.ProjectName ?? $"Project #{approval.ProjectId}";
                    await _emailService.SendFinalResultEmailAsync(
                        requester.Email,
                        requesterName,
                        projectName,
                        "Nghỉ phép",
                        $"Xin nghỉ phép từ {leave.StartDate:dd/MM/yyyy} đến {leave.EndDate:dd/MM/yyyy}",
                        0,
                        false,
                        approval.Comments
                    );
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Từ chối phê duyệt thành công!", overallStatus = leave?.Status });
        }

        // 5. Cancel an approved leave request
        [HttpPost("{leaveId}/cancel-request")]
        public async Task<IActionResult> CancelLeaveRequest(int leaveId, [FromBody] ApprovalCommentDto dto)
        {
            var userIdStr = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdStr, out var userId)) return Unauthorized("Không xác định được phiên đăng nhập.");

            var user = await _context.Users.FindAsync(userId);
            if (user == null) return NotFound("Không tìm thấy thông tin tài khoản.");

            var leave = await _context.LeaveRequests
                .Include(r => r.ProjectApprovals)
                .FirstOrDefaultAsync(r => r.LeaveId == leaveId && r.UserId == userId);

            if (leave == null) return NotFound("Không tìm thấy đơn nghỉ phép.");
            if (leave.Status != "APPROVED") return BadRequest("Chỉ có thể xin huỷ các đơn đã được duyệt.");
            if (leave.CancelStatus == "REQUESTED") return BadRequest("Bạn đã gửi yêu cầu huỷ rồi, đang chờ duyệt.");
            if (leave.CancelStatus == "APPROVED") return BadRequest("Đơn này đã được huỷ.");

            leave.CancelStatus = "REQUESTED";
            _context.LeaveRequests.Update(leave);

            // Re-trigger approval flow for cancellation
            foreach (var approval in leave.ProjectApprovals)
            {
                approval.Status = "PENDING"; // Reset status to PENDING for the cancellation review
                approval.SecureToken = EmailService.GenerateSecureToken();
                approval.TokenExpiry = DateTime.UtcNow.AddDays(1);
                _context.LeaveProjectApprovals.Update(approval);

                // Find approver info
                var approverMember = await _context.ProjectMembers
                    .Include(pm => pm.User)
                    .FirstOrDefaultAsync(pm => pm.ProjectMemberId == approval.ApproverMemberId);

                if (approverMember != null && approverMember.User != null && !string.IsNullOrEmpty(approverMember.User.Email))
                {
                    var approverName = approverMember.User.FullName ?? approverMember.User.Username;
                    var requesterName = user.FullName ?? user.Username;
                    var project = await _context.Projects.FindAsync(approval.ProjectId);
                    var projectName = project?.ProjectName ?? $"Project #{approval.ProjectId}";

                    await _emailService.SendApprovalEmailAsync(
                        approverMember.User.Email,
                        approverName,
                        requesterName,
                        projectName,
                        "YÊU CẦU HUỶ NGHỈ PHÉP",
                        $"Xin HUỶ đơn nghỉ phép từ {leave.StartDate:dd/MM/yyyy} đến {leave.EndDate:dd/MM/yyyy}. Lý do huỷ: {dto.Comments}",
                        0,
                        approval.LeaveId, // context
                        approval.SecureToken
                    );
                }
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Đã gửi yêu cầu huỷ phép đến các Quản lý dự án." });
        }
    }

    public class LeaveRequestSubmissionDto
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal TotalDays { get; set; }
        public string Reason { get; set; } = string.Empty;
        public List<int> ProjectIds { get; set; } = new List<int>();
    }

    public class ApprovalCommentDto
    {
        public string? Comments { get; set; }
    }
}
