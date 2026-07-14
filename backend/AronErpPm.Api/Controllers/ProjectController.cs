using System;
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
    [Route("api/project")]
    [Authorize]
    public class ProjectController : ControllerBase
    {
        private readonly AronDbContext _context;

        public ProjectController(AronDbContext context)
        {
            _context = context;
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
                var projects = await _context.Projects
                    .Include(p => p.ProjectSites)
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
            if (globalRoleClaim != "SYSTEM_ADMIN" && globalRoleClaim != "PM")
            {
                return Forbid("Chỉ có Admin hệ thống hoặc PM mới có quyền tạo dự án mới.");
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

        // PUT: api/project/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateProject(int id, [FromBody] Project request)
        {
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == "GlobalRole")?.Value;
            var projectRoleClaim = User.Claims.FirstOrDefault(c => c.Type == $"ProjectRole_{id}")?.Value;

            var hasAccess = globalRoleClaim == "SYSTEM_ADMIN" || projectRoleClaim == "PM" || projectRoleClaim == "PC";
            if (!hasAccess)
            {
                return Forbid("Chỉ có Admin hệ thống, PM hoặc Project Coordinator của dự án mới có quyền cập nhật.");
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
}
