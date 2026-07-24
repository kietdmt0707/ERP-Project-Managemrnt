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
    [Route("api/timesheet")]
    [Authorize]
    public class TimesheetController : ControllerBase
    {
        private readonly AronDbContext _context;

        public TimesheetController(AronDbContext context)
        {
            _context = context;
        }

        // GET: api/timesheet?projectId=1
        [HttpGet]
        public async Task<IActionResult> GetTimesheets([FromQuery] int projectId)
        {
            var username = User.Identity?.Name;
            var globalRole = User.FindFirst("GlobalRole")?.Value ?? User.FindFirst(ClaimTypes.Role)?.Value;
            var isSysAdmin = globalRole == "SYSTEM_ADMIN" || globalRole == "SYSADMIN" || (username != null && (username.ToLower() == "sysadmin" || username.ToLower() == "admin"));

            var timesheets = await _context.Timesheets
                .Where(t => t.ProjectId == projectId)
                .Include(t => t.Member!.User)
                .Include(t => t.Task)
                .Include(t => t.ApprovedByMember!.User)
                .OrderByDescending(t => t.WorkDate)
                .ThenByDescending(t => t.TimesheetId)
                .ToListAsync();

            var result = timesheets.Select(t => new
            {
                t.TimesheetId,
                t.ProjectId,
                t.MemberId,
                MemberName = t.Member?.User?.FullName ?? "Unknown",
                t.TaskId,
                TaskCode = t.Task?.TaskCode ?? (t.TaskId.HasValue ? $"Task #{t.TaskId}" : "N/A"),
                TaskTitle = t.Task?.TaskName ?? "Công việc chung",
                WorkDate = t.WorkDate.ToString("yyyy-MM-dd"),
                t.HoursWorked,
                t.Description,
                t.Status,
                ApprovedByName = t.ApprovedByMember?.User?.FullName ?? "",
                t.ApprovalDate,
                t.CreatedDate
            }).ToList();

            return Ok(result);
        }

        // POST: api/timesheet
        [HttpPost]
        public async Task<IActionResult> CreateTimesheet([FromBody] CreateTimesheetDto request)
        {
            if (request.ProjectId <= 0) return BadRequest("ProjectId không hợp lệ.");
            if (request.HoursWorked <= 0 || request.HoursWorked > 24) return BadRequest("Số giờ làm việc phải từ 0.5 đến 24 giờ.");

            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());
            if (user == null) return Unauthorized();

            var member = await _context.ProjectMembers
                .FirstOrDefaultAsync(pm => pm.ProjectId == request.ProjectId && pm.UserId == user.UserId);

            if (member == null)
            {
                var role = await _context.Roles.FirstOrDefaultAsync(r => r.RoleCode == "MEMBER") ?? await _context.Roles.FirstOrDefaultAsync();
                member = new ProjectMember
                {
                    ProjectId = request.ProjectId,
                    UserId = user.UserId,
                    RoleId = role?.RoleId ?? 1,
                    IsActive = true
                };
                _context.ProjectMembers.Add(member);
                await _context.SaveChangesAsync();
            }

            var timesheet = new Timesheet
            {
                ProjectId = request.ProjectId,
                MemberId = member.ProjectMemberId,
                TaskId = request.TaskId > 0 ? request.TaskId : null,
                WorkDate = DateTime.SpecifyKind(request.WorkDate, DateTimeKind.Utc),
                HoursWorked = request.HoursWorked,
                Description = request.Description,
                Status = "DRAFT",
                CreatedDate = DateTime.UtcNow
            };

            _context.Timesheets.Add(timesheet);
            await _context.SaveChangesAsync();

            return Ok(timesheet);
        }

        // POST: api/timesheet/bulk
        [HttpPost("bulk")]
        public async Task<IActionResult> CreateBulkTimesheets([FromBody] List<CreateTimesheetDto> requests)
        {
            if (requests == null || !requests.Any()) return BadRequest("Danh sách timesheet rỗng.");

            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());
            if (user == null) return Unauthorized();

            var projectId = requests.First().ProjectId;
            var member = await _context.ProjectMembers
                .FirstOrDefaultAsync(pm => pm.ProjectId == projectId && pm.UserId == user.UserId);

            if (member == null)
            {
                var role = await _context.Roles.FirstOrDefaultAsync(r => r.RoleCode == "MEMBER") ?? await _context.Roles.FirstOrDefaultAsync();
                member = new ProjectMember
                {
                    ProjectId = projectId,
                    UserId = user.UserId,
                    RoleId = role?.RoleId ?? 1,
                    IsActive = true
                };
                _context.ProjectMembers.Add(member);
                await _context.SaveChangesAsync();
            }

            var newEntries = new List<Timesheet>();
            foreach (var req in requests)
            {
                if (req.HoursWorked > 0)
                {
                    newEntries.Add(new Timesheet
                    {
                        ProjectId = projectId,
                        MemberId = member.ProjectMemberId,
                        TaskId = req.TaskId > 0 ? req.TaskId : null,
                        WorkDate = DateTime.SpecifyKind(req.WorkDate, DateTimeKind.Utc),
                        HoursWorked = req.HoursWorked,
                        Description = req.Description,
                        Status = "DRAFT",
                        CreatedDate = DateTime.UtcNow
                    });
                }
            }

            if (newEntries.Any())
            {
                _context.Timesheets.AddRange(newEntries);
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = $"Đã lưu {newEntries.Count} báo cáo ngày công.", count = newEntries.Count });
        }

        // PUT: api/timesheet/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTimesheet(int id, [FromBody] UpdateTimesheetDto request)
        {
            var timesheet = await _context.Timesheets.FindAsync(id);
            if (timesheet == null) return NotFound("Không tìm thấy khai báo ngày công.");
            if (timesheet.Status == "APPROVED") return BadRequest("Không thể sửa Timesheet đã được phê duyệt.");

            if (request.TaskId.HasValue && request.TaskId.Value > 0) timesheet.TaskId = request.TaskId.Value;
            if (request.WorkDate.HasValue) timesheet.WorkDate = DateTime.SpecifyKind(request.WorkDate.Value, DateTimeKind.Utc);
            if (request.HoursWorked > 0) timesheet.HoursWorked = request.HoursWorked;
            if (request.Description != null) timesheet.Description = request.Description;

            await _context.SaveChangesAsync();
            return Ok(timesheet);
        }

        // DELETE: api/timesheet/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTimesheet(int id)
        {
            var timesheet = await _context.Timesheets.FindAsync(id);
            if (timesheet == null) return NotFound("Không tìm thấy khai báo ngày công.");
            if (timesheet.Status == "APPROVED") return BadRequest("Không thể xóa Timesheet đã được phê duyệt.");

            _context.Timesheets.Remove(timesheet);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Đã xóa khai báo ngày công thành công." });
        }
    }

    public class CreateTimesheetDto
    {
        public int ProjectId { get; set; }
        public int? TaskId { get; set; }
        public DateTime WorkDate { get; set; }
        public decimal HoursWorked { get; set; } = 8.0m;
        public string? Description { get; set; }
    }

    public class UpdateTimesheetDto
    {
        public int? TaskId { get; set; }
        public DateTime? WorkDate { get; set; }
        public decimal HoursWorked { get; set; }
        public string? Description { get; set; }
    }
}
