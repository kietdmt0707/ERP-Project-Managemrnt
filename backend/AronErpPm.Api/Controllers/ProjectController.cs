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

        // GET: api/project
        [HttpGet]
        public async Task<IActionResult> GetProjects()
        {
            var projects = await _context.Projects
                .Include(p => p.ProjectSites)
                .OrderByDescending(p => p.CreatedDate)
                .ToListAsync();

            return Ok(projects);
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
                IsActive = true,
                CreatedDate = DateTime.UtcNow
            };

            _context.Projects.Add(project);
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
    }
}
