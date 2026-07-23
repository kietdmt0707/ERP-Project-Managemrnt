using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AronErpPm.Api.Data;
using AronErpPm.Api.Models;
using AronErpPm.Api.Services;

using Microsoft.Extensions.Configuration;

namespace AronErpPm.Api.Controllers
{
    [ApiController]
    [Route("api/project")]
    [Authorize]
    public class ProjectController : ControllerBase
    {
        private readonly AronDbContext _context;
        private readonly ISharepointService _sharepointService;
        private readonly IConfiguration _configuration;

        public ProjectController(AronDbContext context, ISharepointService sharepointService, IConfiguration configuration)
        {
            _context = context;
            _sharepointService = sharepointService;
            _configuration = configuration;
        }

        // GET: api/project/test-diagnostics
        [HttpGet("test-diagnostics")]
        [AllowAnonymous]
        public async Task<IActionResult> TestDiagnostics()
        {
            try
            {
                var projects = await _context.Projects
                    .Include(p => p.ProjectSites)
                    .OrderByDescending(p => p.CreatedDate)
                    .ToListAsync();

                return Ok(new { status = "Success", count = projects.Count, projects });
            }
            catch (Exception ex)
            {
                return Ok(new { 
                    status = "Error",
                    message = "Lỗi truy vấn Database", 
                    detail = ex.Message, 
                    inner = ex.InnerException?.Message,
                    stackTrace = ex.StackTrace 
                });
            }
        }

        // GET: api/project
        [HttpGet]
        public async Task<IActionResult> GetProjects()
        {
            try
            {
                var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == "GlobalRole")?.Value;
                var isSysAdminOrDirector = globalRoleClaim == "SYSTEM_ADMIN" || globalRoleClaim == "DIRECTOR";
                var username = User.Identity?.Name;

                IQueryable<Project> query = _context.Projects.Include(p => p.ProjectSites);

                if (!isSysAdminOrDirector && username != null)
                {
                    var userObj = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());
                    if (userObj != null)
                    {
                        var isDirectorMember = await _context.ProjectMembers
                            .Include(pm => pm.Role)
                            .AnyAsync(pm => pm.UserId == userObj.UserId && pm.Role!.RoleCode == "DIRECTOR");

                        if (!isDirectorMember)
                        {
                            var assignedProjectIds = await _context.ProjectMembers
                                .Where(pm => pm.UserId == userObj.UserId)
                                .Select(pm => pm.ProjectId)
                                .ToListAsync();

                            query = query.Where(p => assignedProjectIds.Contains(p.ProjectId));
                        }
                    }
                    else
                    {
                        return Ok(new List<Project>());
                    }
                }

                var projects = await query
                    .OrderByDescending(p => p.CreatedDate)
                    .ToListAsync();

                return Ok(projects);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    message = "Lỗi truy vấn Database", 
                    detail = ex.Message, 
                    inner = ex.InnerException?.Message,
                    stackTrace = ex.StackTrace 
                });
            }
        }

        // POST: api/project
        [HttpPost]
        public async Task<IActionResult> CreateProject([FromBody] Project request)
        {
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == "GlobalRole")?.Value;
            var username = User.Identity?.Name;
            var isPm = false;
            if (username != null)
            {
                var userObj = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());
                if (userObj != null)
                {
                    isPm = await _context.ProjectMembers
                        .Include(pm => pm.Role)
                        .AnyAsync(pm => pm.UserId == userObj.UserId && pm.Role!.RoleCode == "PM");
                }
            }

            if (globalRoleClaim != "SYSTEM_ADMIN" && globalRoleClaim != "PM" && !isPm)
            {
                return StatusCode(403, new { message = "Chỉ có Admin hệ thống hoặc PM mới có quyền khởi tạo dự án mới." });
            }

            if (string.IsNullOrEmpty(request.ProjectCode) || string.IsNullOrEmpty(request.ProjectName))
            {
                return BadRequest("Mã hiệu và tên dự án không được bỏ trống.");
            }

            var exists = await _context.Projects.AnyAsync(p => p.ProjectCode.ToUpper() == request.ProjectCode.ToUpper());
            if (exists) return BadRequest("Mã hiệu dự án đã tồn tại.");

            var project = new Project
            {
                ProjectCode = request.ProjectCode.ToUpper(),
                ProjectName = request.ProjectName,
                Address = request.Address,
                SitesCount = request.SitesCount,
                ContactInfo = request.ContactInfo,
                LogoPath = request.LogoPath ?? "https://raw.githubusercontent.com/vitejs/vite/main/packages/vite/src/node/logo.png",
                SharepointFolderLink = request.SharepointFolderLink,
                ProjectScope = request.ProjectScope,
                ImplementationWeeks = request.ImplementationWeeks,
                KickOffDate = request.KickOffDate,
                TargetGoLiveDate = request.TargetGoLiveDate,
                CurrentPhase = request.CurrentPhase ?? "Analyze",
                ModulesScope = request.ModulesScope,
                IsActive = true,
                CreatedDate = DateTime.UtcNow
            };
            try
            {
                // Auto-provision SharePoint Folder via Graph API
                var siteId = _configuration["AzureAd:SharepointSiteId"] ?? "mock-site-id";
                var sharepointLink = await _sharepointService.CreateProjectFoldersAsync(project.ProjectCode, project.ProjectName, siteId);
                if (!string.IsNullOrEmpty(sharepointLink))
                {
                    project.SharepointFolderLink = sharepointLink;
                }

                _context.Projects.Add(project);
                await _context.SaveChangesAsync();

                // Tạo các chi nhánh/site dự án tự động
                if (request.ProjectSites != null && request.ProjectSites.Count > 0)
                {
                    foreach (var site in request.ProjectSites)
                    {
                        site.ProjectId = project.ProjectId;
                        site.SiteId = 0;
                        site.Project = null;
                        _context.ProjectSites.Add(site);
                    }
                }
                else
                {
                    for (int i = 1; i <= project.SitesCount; i++)
                    {
                        var site = new ProjectSite
                        {
                            ProjectId = project.ProjectId,
                            SiteName = i == 1 ? "Trụ sở chính" : $"Site chi nhánh {i}",
                            Address = i == 1 ? project.Address : string.Empty,
                            CreatedDate = DateTime.UtcNow
                        };
                        _context.ProjectSites.Add(site);
                    }
                }
                await _context.SaveChangesAsync();

                // Auto-create a default Team under the project named "Ban Dự Án"
                var defaultTeam = new Team
                {
                    ProjectId = project.ProjectId,
                    TeamName = "Ban Dự Án"
                };
                _context.Teams.Add(defaultTeam);
                await _context.SaveChangesAsync();

                return Ok(project);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    message = "Lỗi khi lưu dự án vào Database", 
                    detail = ex.Message, 
                    inner = ex.InnerException?.Message,
                    stackTrace = ex.StackTrace 
                });
            }
        }

        // GET: api/project/{id}
        [HttpGet("{id}")]
        public async Task<IActionResult> GetProjectById(int id)
        {
            var project = await _context.Projects
                .Include(p => p.ProjectSites)
                .FirstOrDefaultAsync(p => p.ProjectId == id);

            if (project == null) return NotFound("Không tìm thấy thông tin dự án.");
            return Ok(project);
        }

        // PUT: api/project/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateProject(int id, [FromBody] Project request)
        {
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == "GlobalRole")?.Value;
            var projectRoleClaim = User.Claims.FirstOrDefault(c => c.Type == $"ProjectRole_{id}")?.Value;
            var username = User.Identity?.Name;
            var isPmForProject = projectRoleClaim == "PM";
            if (!isPmForProject && username != null)
            {
                var userObj = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());
                if (userObj != null)
                {
                    isPmForProject = await _context.ProjectMembers
                        .Include(pm => pm.Role)
                        .AnyAsync(pm => pm.ProjectId == id && pm.UserId == userObj.UserId && pm.Role!.RoleCode == "PM");
                }
            }

            var hasAccess = globalRoleClaim == "SYSTEM_ADMIN" || globalRoleClaim == "PM" || isPmForProject;
            if (!hasAccess)
            {
                return StatusCode(403, new { message = "Chỉ có Admin hệ thống hoặc PM của dự án mới có quyền chỉnh sửa thông tin dự án." });
            }

            var project = await _context.Projects.FindAsync(id);
            if (project == null) return NotFound("Không tìm thấy dự án.");

            project.ProjectName = request.ProjectName;
            project.Address = request.Address;
            project.SitesCount = request.SitesCount;
            project.ContactInfo = request.ContactInfo;
            if (!string.IsNullOrEmpty(request.LogoPath))
            {
                project.LogoPath = request.LogoPath;
            }
            project.SharepointFolderLink = request.SharepointFolderLink;
            project.ProjectScope = request.ProjectScope;
            project.ImplementationWeeks = request.ImplementationWeeks;
            project.KickOffDate = request.KickOffDate;
            project.TargetGoLiveDate = request.TargetGoLiveDate;
            project.CurrentPhase = request.CurrentPhase ?? project.CurrentPhase;
            project.ModulesScope = request.ModulesScope;
            project.UpdatedDate = DateTime.UtcNow;

            // Cập nhật danh sách Site
            if (request.ProjectSites != null)
            {
                var existingSites = _context.ProjectSites.Where(s => s.ProjectId == id);
                _context.ProjectSites.RemoveRange(existingSites);
                
                foreach (var site in request.ProjectSites)
                {
                    site.ProjectId = id;
                    site.SiteId = 0; // Tự tăng khóa chính mới
                    site.Project = null; // Tránh lỗi tuần hoàn EF Core
                    _context.ProjectSites.Add(site);
                }
            }

            await _context.SaveChangesAsync();
            return Ok(project);
        }

        // POST: api/project/assign-pm
        [HttpPost("assign-pm")]
        public async Task<IActionResult> AssignPm([FromBody] AssignPmRequest request)
        {
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == "GlobalRole")?.Value;
            if (globalRoleClaim != "SYSTEM_ADMIN")
            {
                return Forbid("Chỉ có Admin hệ thống mới có quyền phân công PM dự án.");
            }

            var project = await _context.Projects.FindAsync(request.ProjectId);
            if (project == null) return NotFound("Không tìm thấy dự án.");

            // Tìm hoặc tạo User
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == request.Username.ToLower());
            if (user == null)
            {
                user = new User
                {
                    Username = request.Username,
                    PasswordHash = HashPassword("password123"), // Mật khẩu mặc định
                    FullName = request.FullName,
                    Email = request.Email,
                    IsActive = true,
                    CreatedDate = DateTime.UtcNow
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }

            // Tìm Role PM
            var pmRole = await _context.Roles.FirstOrDefaultAsync(r => r.RoleCode == "PM");
            if (pmRole == null) return BadRequest("Không tìm thấy vai trò PM trong hệ thống.");

            // Kiểm tra phân công đã tồn tại chưa
            var existingAssignment = await _context.ProjectMembers
                .FirstOrDefaultAsync(pm => pm.ProjectId == request.ProjectId && pm.UserId == user.UserId);

            if (existingAssignment != null)
            {
                existingAssignment.RoleId = pmRole.RoleId;
                existingAssignment.IsActive = true;
            }
            else
            {
                var projectMember = new ProjectMember
                {
                    ProjectId = request.ProjectId,
                    UserId = user.UserId,
                    RoleId = pmRole.RoleId,
                    IsActive = true,
                    CreatedDate = DateTime.UtcNow
                };
                _context.ProjectMembers.Add(projectMember);
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Đã phân công PM thành công!" });
        }

        // DELETE: api/project/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteProject(int id)
        {
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == "GlobalRole")?.Value;
            if (globalRoleClaim != "SYSTEM_ADMIN")
            {
                return Forbid("Chỉ có Admin hệ thống mới có quyền xóa dự án.");
            }

            var project = await _context.Projects.FindAsync(id);
            if (project == null) return NotFound("Không tìm thấy dự án.");

            _context.Projects.Remove(project);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Đã xóa dự án thành công!" });
        }

        // POST: api/project/{targetProjectId}/clone-plan
        [HttpPost("{targetProjectId}/clone-plan")]
        public async Task<IActionResult> ClonePlan(int targetProjectId, [FromBody] ClonePlanRequest request)
        {
            var targetProject = await _context.Projects.FindAsync(targetProjectId);
            if (targetProject == null) return NotFound("Không tìm thấy dự án đích.");

            var sourceProject = await _context.Projects
                .Include(p => p.Tasks)
                .FirstOrDefaultAsync(p => p.ProjectId == request.SourceProjectId);
            if (sourceProject == null) return NotFound("Không tìm thấy dự án nguồn.");

            var sourceTasks = sourceProject.Tasks.ToList();
            if (!sourceTasks.Any()) return BadRequest("Dự án nguồn không có tác vụ nào để nhân bản.");

            var earliestSourceStart = sourceTasks.Min(t => t.StartDatePlanned);
            var timeOffset = request.TargetStartDate - earliestSourceStart;

            var oldToNewTaskMap = new Dictionary<int, Models.Task>();

            using var transaction = await _context.Database.BeginTransactionAsync();
            try
            {
                // First pass: clone tasks (resetting ID)
                foreach (var sTask in sourceTasks)
                {
                    var nTask = new Models.Task
                    {
                        ProjectId = targetProjectId,
                        TaskCode = sTask.TaskCode,
                        TaskName = sTask.TaskName,
                        Description = sTask.Description,
                        TaskLevel = sTask.TaskLevel,
                        StartDatePlanned = sTask.StartDatePlanned.Add(timeOffset),
                        EndDatePlanned = sTask.EndDatePlanned.Add(timeOffset),
                        DurationPlanned = sTask.DurationPlanned,
                        ProgressPercent = 0.00m,
                        Status = "NOT_STARTED",
                        VisibilityScope = sTask.VisibilityScope,
                        AIMCode = sTask.AIMCode,
                        IsVisibleToAll = sTask.IsVisibleToAll,
                        CreatedDate = DateTime.UtcNow
                    };

                    _context.Tasks.Add(nTask);
                    oldToNewTaskMap[sTask.TaskId] = nTask;
                }

                await _context.SaveChangesAsync();

                // Second pass: map parent tasks
                foreach (var sTask in sourceTasks)
                {
                    if (sTask.ParentTaskId.HasValue && oldToNewTaskMap.TryGetValue(sTask.ParentTaskId.Value, out var newParent))
                    {
                        oldToNewTaskMap[sTask.TaskId].ParentTaskId = newParent.TaskId;
                    }
                }

                await _context.SaveChangesAsync();

                // Third pass: clone task dependencies
                var sourceDependencies = await _context.TaskDependencies
                    .Where(td => sourceTasks.Select(t => t.TaskId).Contains(td.PredecessorTaskId))
                    .ToListAsync();

                foreach (var dep in sourceDependencies)
                {
                    if (oldToNewTaskMap.TryGetValue(dep.PredecessorTaskId, out var newPred) &&
                        oldToNewTaskMap.TryGetValue(dep.SuccessorTaskId, out var newSucc))
                    {
                        var newDep = new TaskDependency
                        {
                            PredecessorTaskId = newPred.TaskId,
                            SuccessorTaskId = newSucc.TaskId,
                            DependencyType = dep.DependencyType,
                            LagDays = dep.LagDays
                        };
                        _context.TaskDependencies.Add(newDep);
                    }
                }

                await _context.SaveChangesAsync();
                await transaction.CommitAsync();

                return Ok(new { message = $"Đã nhân bản thành công {sourceTasks.Count} tác vụ chuẩn AIM sang dự án mới." });
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                return StatusCode(500, new { message = "Lỗi khi nhân bản kế hoạch dự án", details = ex.Message });
            }
        }

        private string HashPassword(string password)
        {
            using (var sha256 = System.Security.Cryptography.SHA256.Create())
            {
                var hashedBytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
                return BitConverter.ToString(hashedBytes).Replace("-", "").ToLower();
            }
        }
    }

    public class AssignPmRequest
    {
        public int ProjectId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
    }

    public class ClonePlanRequest
    {
        public int SourceProjectId { get; set; }
        public DateTime TargetStartDate { get; set; }
    }
}
