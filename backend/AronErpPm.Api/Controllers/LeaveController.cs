using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AronErpPm.Api.Data;
using AronErpPm.Api.Models;

namespace AronErpPm.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class LeaveController : ControllerBase
    {
        private readonly AronDbContext _context;

        public LeaveController(AronDbContext context)
        {
            _context = context;
        }

        // 1. Get Leave Dashboard Info (Carry-over algorithm included)
        [HttpGet("dashboard")]
        public async Task<IActionResult> GetLeaveDashboard()
        {
            var username = User.Identity?.Name;
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == username!.ToLower());
            if (user == null) return NotFound("Không tìm thấy thông tin tài khoản.");

            // Carry-over logic: Expiry date is April 1st (Month >= 4)
            int carryOverDays = 5;
            if (DateTime.Today.Month >= 4)
            {
                carryOverDays = 0;
            }

            int annualLeaveDays = 13; // Standard annual leave balance

            // Sum up used leaves (APPROVED status)
            var usedLeaveDays = await _context.LeaveRequests
                .Where(r => r.UserId == user.UserId && r.Status == "APPROVED")
                .SumAsync(r => r.TotalDays);

            decimal totalAvailable = (annualLeaveDays + carryOverDays) - usedLeaveDays;

            // Get user's active projects to populate check boxes on frontend
            var activeProjects = await _context.ProjectMembers
                .Where(pm => pm.UserId == user.UserId && pm.IsActive)
                .Select(pm => new
                {
                    pm.ProjectId,
                    ProjectName = pm.Project != null ? pm.Project.ProjectName : "Dự án ẩn",
                    RoleCode = pm.Role != null ? pm.Role.RoleCode : "MEMBER"
                })
                .ToListAsync();

            // Fetch history
            var history = await _context.LeaveRequests
                .Where(r => r.UserId == user.UserId)
                .Include(r => r.ProjectApprovals).ThenInclude(pa => pa.Project)
                .OrderByDescending(r => r.CreatedDate)
                .ToListAsync();

            return Ok(new
            {
                annualLeaveDays,
                carryOverDays,
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
            var username = User.Identity?.Name;
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == username!.ToLower());
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

                // Create Parallel Approvals for each selected project PM
                foreach (var pId in dto.ProjectIds)
                {
                    // Find PM of this project
                    var pmMember = await _context.ProjectMembers
                        .Include(pm => pm.Role)
                        .FirstOrDefaultAsync(pm => pm.ProjectId == pId && pm.Role!.RoleCode == "PM" && pm.IsActive);

                    // If no PM assigned, fallback to system administrator/PM member
                    var approverId = pmMember?.ProjectMemberId;
                    if (!approverId.HasValue)
                    {
                        var fallbackPm = await _context.ProjectMembers.FirstOrDefaultAsync(pm => pm.ProjectId == pId && pm.IsActive);
                        approverId = fallbackPm?.ProjectMemberId ?? 1; // Fallback
                    }

                    var approval = new LeaveProjectApproval
                    {
                        LeaveId = leaveRequest.LeaveId,
                        ProjectId = pId,
                        ApproverMemberId = approverId.Value,
                        Status = "PENDING"
                    };

                    _context.LeaveProjectApprovals.Add(approval);
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
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Từ chối phê duyệt thành công!", overallStatus = leave?.Status });
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
