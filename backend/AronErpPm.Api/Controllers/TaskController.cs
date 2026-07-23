using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AronErpPm.Api.Data;
using AronErpPm.Api.DTOs;
using AronErpPm.Api.Models;
using System.Security.Claims;

namespace AronErpPm.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class TaskController : ControllerBase
    {
        private readonly AronDbContext _context;

        public TaskController(AronDbContext context)
        {
            _context = context;
        }

        // Get Task Tree for a specific project
        [HttpGet("project/{projectId}")]
        public async Task<ActionResult<List<TaskTreeNodeDto>>> GetProjectTaskTree(int projectId)
        {
            // Verify membership / RLS filter is active (handled by context, here we ensure project exists)
            var projectExists = await _context.Projects.AnyAsync(p => p.ProjectId == projectId);
            if (!projectExists)
            {
                return NotFound(new { message = "Không tìm thấy dự án." });
            }

            // Retrieve all tasks for the project
            var allTasks = await _context.Tasks
                .Include(t => t.AssigneeMember).ThenInclude(m => m!.User)
                .Include(t => t.AssigneeMember).ThenInclude(m => m!.FunctionalTeam)
                .Include(t => t.ApproverMember).ThenInclude(m => m!.User)
                .Where(t => t.ProjectId == projectId)
                .ToListAsync();

            // Retrieve all dependencies
            var taskIds = allTasks.Select(t => t.TaskId).ToList();
            var dependencies = await _context.TaskDependencies
                .Where(d => taskIds.Contains(d.SuccessorTaskId))
                .ToListAsync();

            // Retrieve subtask counts per activity (safely wrapped)
            var subtaskCounts = new Dictionary<int, int>();
            try
            {
                subtaskCounts = await _context.SubTasks
                    .Where(st => st.ProjectId == projectId)
                    .GroupBy(st => st.ActivityId)
                    .Select(g => new { ActivityId = g.Key, Count = g.Count() })
                    .ToDictionaryAsync(g => g.ActivityId, g => g.Count);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[TaskController] SubTask count query warning: {ex.Message}");
            }

            // Map flat list to tree DTOs
            var flatDtos = allTasks.Select(t => new TaskTreeNodeDto
            {
                TaskId = t.TaskId,
                TaskCode = t.TaskCode,
                TaskName = t.TaskName,
                Description = t.Description,
                TaskLevel = t.TaskLevel,
                ParentTaskId = t.ParentTaskId,
                AssigneeMemberId = t.AssigneeMemberId,
                AssigneeName = t.AssigneeMember?.User?.FullName,
                AssigneeTeam = t.AssigneeMember?.FunctionalTeam?.FunctionalTeamName,
                ApproverMemberId = t.ApproverMemberId,
                ApproverName = t.ApproverMember?.User?.FullName,
                StartDatePlanned = t.StartDatePlanned,
                EndDatePlanned = t.EndDatePlanned,
                StartDateActual = t.StartDateActual,
                EndDateActual = t.EndDateActual,
                DurationPlanned = t.DurationPlanned,
                ProgressPercent = t.ProgressPercent,
                Status = t.Status,
                IsVisibleToAll = t.IsVisibleToAll,
                VisibilityScope = t.VisibilityScope,
                AIMCode = t.AIMCode,
                Module = t.Module,
                KeyUser = t.KeyUser,
                Party = t.Party,
                IsManualProgress = t.IsManualProgress,
                SubTaskCount = subtaskCounts.ContainsKey(t.TaskId) ? subtaskCounts[t.TaskId] : 0,
                PredecessorTaskIds = dependencies
                    .Where(d => d.SuccessorTaskId == t.TaskId)
                    .Select(d => d.PredecessorTaskId)
                    .ToList()
            }).ToList();

            // Check Visibility constraints for the current user (Cross-visibility security)
            var username = User.Identity?.Name;
            var userMember = await _context.ProjectMembers
                .Include(pm => pm.Role)
                .Include(pm => pm.FunctionalTeam).ThenInclude(ft => ft!.Team)
                .FirstOrDefaultAsync(pm => pm.ProjectId == projectId && pm.User!.Username.ToLower() == username.ToLower());

            if (userMember != null)
            {
                var userTeamType = userMember.FunctionalTeam?.Team?.TeamType ?? "ARON";
                
                // If the user belongs to the Client Team (Khách hàng), they can only see PUBLIC tasks or tasks assigned to them
                if (userTeamType == "CLIENT")
                {
                    // Retrieve task visibility scope from DB entities to check
                    var visibleTaskIds = allTasks
                        .Where(t => t.VisibilityScope == "PUBLIC" || t.AssigneeMemberId == userMember.ProjectMemberId)
                        .Select(t => t.TaskId)
                        .ToHashSet();

                    flatDtos = flatDtos.Where(t => visibleTaskIds.Contains(t.TaskId)).ToList();
                }
                // If normal member, filter out private tasks they are not assigned to
                else if (userMember.Role?.RoleCode == "MEMBER")
                {
                    flatDtos = flatDtos.Where(t => t.IsVisibleToAll || t.AssigneeMemberId == userMember.ProjectMemberId).ToList();
                }
            }

            // Build Hierarchical Tree
            var rootNodes = flatDtos.Where(n => n.ParentTaskId == null).OrderBy(n => n.TaskCode).ToList();
            foreach (var root in rootNodes)
            {
                BuildSubTree(root, flatDtos);
            }

            return Ok(rootNodes);
        }

        private void BuildSubTree(TaskTreeNodeDto parentNode, List<TaskTreeNodeDto> allNodes)
        {
            parentNode.SubTasks = allNodes
                .Where(n => n.ParentTaskId == parentNode.TaskId)
                .OrderBy(n => n.TaskCode)
                .ToList();

            foreach (var child in parentNode.SubTasks)
            {
                BuildSubTree(child, allNodes);
            }
        }

        // Create or Update Level 2 or 3 Task (With Project-Level Permission Check)
        [HttpPost("save")]
        public async Task<IActionResult> SaveTask([FromBody] TaskTreeNodeDto dto)
        {
            var username = User.Identity?.Name;
            var globalRole = User.FindFirst("GlobalRole")?.Value ?? User.FindFirst(ClaimTypes.Role)?.Value;
            var isSysAdmin = globalRole == "SYSTEM_ADMIN" || globalRole == "SYSADMIN" || (username != null && username.ToLower() == "admin");

            // Validate Project
            var project = await _context.Projects.FindAsync(dto.ProjectId);
            if (project == null) return NotFound("Dự án không tồn tại.");

            // Check project role of the user
            var userMember = await _context.ProjectMembers
                .Include(pm => pm.Role)
                .FirstOrDefaultAsync(pm => pm.ProjectId == dto.ProjectId && username != null && pm.User!.Username.ToLower() == username.ToLower());

            if (!isSysAdmin && userMember == null)
            {
                return StatusCode(403, new { message = "Bạn không phải thành viên của dự án này." });
            }

            var roleCode = userMember?.Role?.RoleCode;

            if (!isSysAdmin && roleCode == "DIRECTOR")
            {
                return StatusCode(403, new { message = "Tài khoản Giám đốc dự án chỉ có quyền xem báo cáo." });
            }

            if (dto.TaskLevel == 1 && !isSysAdmin && roleCode != "PM" && roleCode != "PC")
            {
                return StatusCode(403, new { message = "Chỉ PM hoặc PC mới có quyền tạo/chỉnh sửa Task Cấp 1 (Giai đoạn)." });
            }

            Models.Task? task;

            if (dto.TaskId == 0) // Create New Task
            {
                if (roleCode == "MEMBER")
                {
                    return Forbid("Thành viên không được phép tạo Task mới. Vui lòng liên hệ Leader hoặc PM.");
                }

                task = new Models.Task
                {
                    ProjectId = dto.ProjectId,
                    TaskCode = dto.TaskCode,
                    TaskName = dto.TaskName,
                    Description = dto.Description,
                    TaskLevel = dto.TaskLevel,
                    ParentTaskId = dto.ParentTaskId,
                    AssigneeMemberId = dto.AssigneeMemberId,
                    ApproverMemberId = dto.ApproverMemberId,
                    StartDatePlanned = dto.StartDatePlanned,
                    EndDatePlanned = dto.EndDatePlanned,
                    DurationPlanned = dto.DurationPlanned,
                    ProgressPercent = dto.ProgressPercent,
                    Status = dto.Status,
                    IsVisibleToAll = dto.IsVisibleToAll,
                    VisibilityScope = dto.VisibilityScope ?? "PUBLIC",
                    AIMCode = dto.AIMCode,
                    Module = dto.Module,
                    KeyUser = dto.KeyUser,
                    Party = dto.Party
                };

                _context.Tasks.Add(task);
            }
            else // Update Existing Task
            {
                task = await _context.Tasks.FindAsync(dto.TaskId);
                if (task == null) return NotFound("Task không tồn tại.");

                // Member can only update progress, not dates or names
                if (roleCode == "MEMBER")
                {
                    if (task.AssigneeMemberId != userMember.ProjectMemberId)
                    {
                        return Forbid("Bạn không thể cập nhật Task không được gán cho bạn.");
                    }
                    // Update only progress & status
                    task.ProgressPercent = dto.ProgressPercent;
                    task.Status = dto.Status;
                    task.StartDateActual = dto.StartDateActual;
                    task.EndDateActual = dto.EndDateActual;
                    if (dto.ProgressPercent >= 100)
                    {
                        task.Status = "COMPLETED";
                        task.EndDateActual = DateTime.UtcNow;
                    }
                }
                else // Leader or PM
                {
                    task.TaskName = dto.TaskName;
                    task.Description = dto.Description;
                    task.AssigneeMemberId = dto.AssigneeMemberId;
                    task.ApproverMemberId = dto.ApproverMemberId;
                    task.StartDatePlanned = dto.StartDatePlanned;
                    task.EndDatePlanned = dto.EndDatePlanned;
                    task.StartDateActual = dto.StartDateActual;
                    task.EndDateActual = dto.EndDateActual;
                    task.DurationPlanned = dto.DurationPlanned;
                    task.ProgressPercent = dto.ProgressPercent;
                    task.Status = dto.Status;
                    task.IsVisibleToAll = dto.IsVisibleToAll;
                    task.VisibilityScope = dto.VisibilityScope ?? "PUBLIC";
                    task.AIMCode = dto.AIMCode;
                    task.Module = dto.Module;
                    task.KeyUser = dto.KeyUser;
                    task.Party = dto.Party;
                }
                
                task.UpdatedDate = DateTime.UtcNow;
                _context.Tasks.Update(task);
            }

            await _context.SaveChangesAsync();

            // Save dependencies
            if (dto.PredecessorTaskIds != null && task.TaskId > 0)
            {
                // Delete old dependencies
                var oldDeps = await _context.TaskDependencies
                    .Where(d => d.SuccessorTaskId == task.TaskId)
                    .ToListAsync();
                _context.TaskDependencies.RemoveRange(oldDeps);

                // Add new dependencies
                foreach (var predId in dto.PredecessorTaskIds)
                {
                    var dep = new TaskDependency
                    {
                        PredecessorTaskId = predId,
                        SuccessorTaskId = task.TaskId,
                        DependencyType = "FS"
                    };
                    _context.TaskDependencies.Add(dep);
                }
                await _context.SaveChangesAsync();
            }

            return Ok(new { message = "Lưu Task thành công!", taskId = task.TaskId });
        }

        // PUT: api/task/{id}/progress-mode
        [HttpPut("{id}/progress-mode")]
        public async Task<IActionResult> ToggleProgressMode(int id, [FromBody] ToggleProgressModeDto dto)
        {
            var task = await _context.Tasks.FindAsync(id);
            if (task == null) return NotFound("Không tìm thấy Task.");

            task.IsManualProgress = dto.IsManualProgress;
            if (dto.IsManualProgress && dto.ManualProgressPercent.HasValue)
            {
                task.ProgressPercent = Math.Clamp(dto.ManualProgressPercent.Value, 0, 100);
            }
            task.UpdatedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(new { message = "Đã cập nhật chế độ tiến độ thành công!", isManualProgress = task.IsManualProgress, progressPercent = task.ProgressPercent });
        }
    }

    public class ToggleProgressModeDto
    {
        public bool IsManualProgress { get; set; }
        public decimal? ManualProgressPercent { get; set; }
    }
}
