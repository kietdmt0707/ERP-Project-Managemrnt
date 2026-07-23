using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AronErpPm.Api.Data;
using AronErpPm.Api.Models;

namespace AronErpPm.Api.Controllers
{
    [ApiController]
    [Route("api/subtask")]
    [Authorize]
    public class SubTaskController : ControllerBase
    {
        private readonly AronDbContext _context;

        public SubTaskController(AronDbContext context)
        {
            _context = context;
        }

        // GET: api/subtask?projectId=1&activityId=5
        [HttpGet]
        public async Task<IActionResult> GetSubTasks([FromQuery] int projectId, [FromQuery] int? activityId)
        {
            if (projectId <= 0) return BadRequest("ProjectId không hợp lệ.");

            var query = _context.SubTasks
                .Where(st => st.ProjectId == projectId)
                .Include(st => st.Activity)
                .Include(st => st.CreatedByUser)
                .Include(st => st.AssigneeMember!).ThenInclude(m => m.User)
                .Include(st => st.ReviewerMember!).ThenInclude(m => m.User)
                .AsQueryable();

            if (activityId.HasValue && activityId.Value > 0)
            {
                query = query.Where(st => st.ActivityId == activityId.Value);
            }

            var subtasks = await query
                .OrderByDescending(st => st.CreatedDate)
                .ToListAsync();

            var result = subtasks.Select(st => new
            {
                st.SubTaskId,
                st.ProjectId,
                st.ActivityId,
                ActivityCode = st.Activity?.TaskCode ?? $"Activity #{st.ActivityId}",
                ActivityName = st.Activity?.TaskName ?? "Activity",
                st.CreatedByUserId,
                CreatedByName = st.CreatedByUser?.FullName ?? "Unknown",
                st.Category,
                st.Module,
                st.DocCode,
                st.TaskName,
                st.Description,
                st.AssigneeMemberId,
                AssigneeName = st.AssigneeMember?.User?.FullName ?? "",
                st.ReviewerMemberId,
                ReviewerName = st.ReviewerMember?.User?.FullName ?? "",
                st.KeyUser,
                st.Party,
                StartDate = st.StartDate?.ToString("yyyy-MM-dd"),
                EndDate = st.EndDate?.ToString("yyyy-MM-dd"),
                Deadline = st.Deadline?.ToString("yyyy-MM-dd"),
                st.Status,
                st.ProgressPercent,
                st.Weight,
                st.AttachmentUrl,
                st.CreatedDate,
                st.UpdatedDate
            }).ToList();

            return Ok(result);
        }

        // POST: api/subtask
        [HttpPost]
        public async Task<IActionResult> CreateSubTask([FromBody] CreateSubTaskDto request)
        {
            if (request.ProjectId <= 0) return BadRequest("ProjectId không hợp lệ.");
            if (request.ActivityId <= 0) return BadRequest("Vui lòng chọn Activity cha.");
            if (string.IsNullOrEmpty(request.TaskName)) return BadRequest("Tên công việc không được bỏ trống.");

            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());
            if (user == null) return Unauthorized();

            var subtask = new SubTask
            {
                ProjectId = request.ProjectId,
                ActivityId = request.ActivityId,
                CreatedByUserId = user.UserId,
                Category = request.Category,
                Module = request.Module,
                DocCode = request.DocCode,
                TaskName = request.TaskName,
                Description = request.Description,
                AssigneeMemberId = request.AssigneeMemberId > 0 ? request.AssigneeMemberId : null,
                ReviewerMemberId = request.ReviewerMemberId > 0 ? request.ReviewerMemberId : null,
                KeyUser = request.KeyUser,
                Party = request.Party,
                StartDate = request.StartDate.HasValue ? DateTime.SpecifyKind(request.StartDate.Value, DateTimeKind.Utc) : null,
                EndDate = request.EndDate.HasValue ? DateTime.SpecifyKind(request.EndDate.Value, DateTimeKind.Utc) : null,
                Deadline = request.Deadline.HasValue ? DateTime.SpecifyKind(request.Deadline.Value, DateTimeKind.Utc) : null,
                Status = string.IsNullOrEmpty(request.Status) ? "1. Mới tạo" : request.Status,
                ProgressPercent = request.Status == "4. Hoàn thành" ? 100.00m : request.ProgressPercent,
                Weight = request.Weight > 0 ? request.Weight : 1,
                AttachmentUrl = request.AttachmentUrl,
                CreatedDate = DateTime.UtcNow
            };

            _context.SubTasks.Add(subtask);
            await _context.SaveChangesAsync();

            // Auto Recalculate Activity Progress
            await RecalculateActivityProgressAsync(subtask.ActivityId);

            return Ok(subtask);
        }

        // PUT: api/subtask/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateSubTask(int id, [FromBody] UpdateSubTaskDto request)
        {
            var subtask = await _context.SubTasks.FindAsync(id);
            if (subtask == null) return NotFound("Không tìm thấy nhiệm vụ.");

            var username = User.Identity?.Name;
            var globalRole = User.FindFirst("GlobalRole")?.Value ?? User.FindFirst(ClaimTypes.Role)?.Value;
            var isSysAdmin = globalRole == "SYSTEM_ADMIN" || globalRole == "SYSADMIN" || (username != null && username.ToLower() == "admin");

            var currentUser = await _context.Users.FirstOrDefaultAsync(u => username != null && u.Username.ToLower() == username.ToLower());
            var currentUserId = currentUser?.UserId ?? 0;

            var isPm = false;
            if (currentUser != null)
            {
                isPm = await _context.ProjectMembers
                    .Include(pm => pm.Role)
                    .AnyAsync(pm => pm.ProjectId == subtask.ProjectId && pm.UserId == currentUser.UserId && pm.Role!.RoleCode == "PM");
            }

            // RBAC Check: Only Creator or PM/Admin can edit!
            var canEdit = isSysAdmin || isPm || subtask.CreatedByUserId == currentUserId;
            if (!canEdit)
            {
                return StatusCode(403, new { message = "Chỉ người tạo nhiệm vụ này hoặc PM của dự án mới có quyền chỉnh sửa." });
            }

            if (request.ActivityId.HasValue && request.ActivityId.Value > 0) subtask.ActivityId = request.ActivityId.Value;
            if (!string.IsNullOrEmpty(request.Category)) subtask.Category = request.Category;
            if (!string.IsNullOrEmpty(request.Module)) subtask.Module = request.Module;
            if (!string.IsNullOrEmpty(request.DocCode)) subtask.DocCode = request.DocCode;
            if (!string.IsNullOrEmpty(request.TaskName)) subtask.TaskName = request.TaskName;
            if (request.Description != null) subtask.Description = request.Description;

            if (request.AssigneeMemberId.HasValue) subtask.AssigneeMemberId = request.AssigneeMemberId.Value > 0 ? request.AssigneeMemberId.Value : null;
            if (request.ReviewerMemberId.HasValue) subtask.ReviewerMemberId = request.ReviewerMemberId.Value > 0 ? request.ReviewerMemberId.Value : null;
            if (request.KeyUser != null) subtask.KeyUser = request.KeyUser;
            if (request.Party != null) subtask.Party = request.Party;

            if (request.StartDate.HasValue) subtask.StartDate = DateTime.SpecifyKind(request.StartDate.Value, DateTimeKind.Utc);
            if (request.EndDate.HasValue) subtask.EndDate = DateTime.SpecifyKind(request.EndDate.Value, DateTimeKind.Utc);
            if (request.Deadline.HasValue) subtask.Deadline = DateTime.SpecifyKind(request.Deadline.Value, DateTimeKind.Utc);

            if (!string.IsNullOrEmpty(request.Status))
            {
                subtask.Status = request.Status;
                if (request.Status == "4. Hoàn thành")
                {
                    subtask.ProgressPercent = 100.00m;
                }
            }

            if (request.ProgressPercent.HasValue && subtask.Status != "4. Hoàn thành")
            {
                subtask.ProgressPercent = request.ProgressPercent.Value;
            }

            if (request.Weight.HasValue && request.Weight.Value > 0) subtask.Weight = request.Weight.Value;
            if (request.AttachmentUrl != null) subtask.AttachmentUrl = request.AttachmentUrl;

            subtask.UpdatedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            // Recalculate Activity Progress
            await RecalculateActivityProgressAsync(subtask.ActivityId);

            return Ok(subtask);
        }

        // DELETE: api/subtask/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSubTask(int id)
        {
            var subtask = await _context.SubTasks.FindAsync(id);
            if (subtask == null) return NotFound("Không tìm thấy nhiệm vụ.");

            var username = User.Identity?.Name;
            var globalRole = User.FindFirst("GlobalRole")?.Value ?? User.FindFirst(ClaimTypes.Role)?.Value;
            var isSysAdmin = globalRole == "SYSTEM_ADMIN" || globalRole == "SYSADMIN" || (username != null && username.ToLower() == "admin");

            var currentUser = await _context.Users.FirstOrDefaultAsync(u => username != null && u.Username.ToLower() == username.ToLower());
            var isPm = false;
            if (currentUser != null)
            {
                isPm = await _context.ProjectMembers
                    .Include(pm => pm.Role)
                    .AnyAsync(pm => pm.ProjectId == subtask.ProjectId && pm.UserId == currentUser.UserId && pm.Role!.RoleCode == "PM");
            }

            // RBAC Check: Only PM or Admin can delete!
            if (!isSysAdmin && !isPm)
            {
                return StatusCode(403, new { message = "Chỉ PM của dự án hoặc Admin mới có quyền xóa nhiệm vụ này." });
            }

            var activityId = subtask.ActivityId;
            _context.SubTasks.Remove(subtask);
            await _context.SaveChangesAsync();

            // Recalculate Activity Progress
            await RecalculateActivityProgressAsync(activityId);

            return Ok(new { message = "Đã xóa nhiệm vụ thành công." });
        }

        // Helper method to recalculate activity progress based on subtasks
        private async System.Threading.Tasks.Task RecalculateActivityProgressAsync(int activityId)
        {
            var activity = await _context.Tasks.FindAsync(activityId);
            if (activity == null || activity.IsManualProgress) return; // Skip if PM has set Manual Progress

            var subtasks = await _context.SubTasks
                .Where(st => st.ActivityId == activityId)
                .ToListAsync();

            if (!subtasks.Any()) return;

            decimal totalWeightedProgress = subtasks.Sum(st => st.ProgressPercent * st.Weight);
            int totalWeight = subtasks.Sum(st => st.Weight);

            if (totalWeight > 0)
            {
                activity.ProgressPercent = Math.Round(totalWeightedProgress / totalWeight, 2);
                if (activity.ProgressPercent >= 100)
                {
                    activity.Status = "COMPLETED";
                }
                else if (activity.ProgressPercent > 0)
                {
                    activity.Status = "IN_PROGRESS";
                }
                activity.UpdatedDate = DateTime.UtcNow;
                _context.Tasks.Update(activity);
                await _context.SaveChangesAsync();
            }
        }
    }

    public class CreateSubTaskDto
    {
        public int ProjectId { get; set; }
        public int ActivityId { get; set; }
        public string? Category { get; set; }
        public string? Module { get; set; }
        public string? DocCode { get; set; }
        public string TaskName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int? AssigneeMemberId { get; set; }
        public int? ReviewerMemberId { get; set; }
        public string? KeyUser { get; set; }
        public string? Party { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public DateTime? Deadline { get; set; }
        public string? Status { get; set; }
        public decimal ProgressPercent { get; set; } = 0.00m;
        public int Weight { get; set; } = 1;
        public string? AttachmentUrl { get; set; }
    }

    public class UpdateSubTaskDto
    {
        public int? ActivityId { get; set; }
        public string? Category { get; set; }
        public string? Module { get; set; }
        public string? DocCode { get; set; }
        public string? TaskName { get; set; }
        public string? Description { get; set; }
        public int? AssigneeMemberId { get; set; }
        public int? ReviewerMemberId { get; set; }
        public string? KeyUser { get; set; }
        public string? Party { get; set; }
        public DateTime? StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public DateTime? Deadline { get; set; }
        public string? Status { get; set; }
        public decimal? ProgressPercent { get; set; }
        public int? Weight { get; set; }
        public string? AttachmentUrl { get; set; }
    }
}
