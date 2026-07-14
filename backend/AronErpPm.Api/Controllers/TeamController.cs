using System;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AronErpPm.Api.Data;
using AronErpPm.Api.Models;

namespace AronErpPm.Api.Controllers
{
    [ApiController]
    [Route("api/team")]
    [Authorize]
    public class TeamController : ControllerBase
    {
        private readonly AronDbContext _context;

        public TeamController(AronDbContext context)
        {
            _context = context;
        }

        // GET: api/team?projectId=1
        [HttpGet]
        public async Task<IActionResult> GetTeams([FromQuery] int projectId)
        {
            var teams = await _context.Teams
                .Where(t => t.ProjectId == projectId)
                .Include(t => t.SubTeams)
                .Include(t => t.FunctionalTeams)
                .ToListAsync();

            var members = await _context.ProjectMembers
                .Where(pm => pm.ProjectId == projectId)
                .Include(pm => pm.User)
                .Include(pm => pm.Role)
                .Include(pm => pm.FunctionalTeam)
                .Select(pm => new
                {
                    pm.ProjectMemberId,
                    pm.UserId,
                    pm.FunctionalTeamId,
                    FunctionalTeamName = pm.FunctionalTeam != null ? pm.FunctionalTeam.FunctionalTeamName : "Chưa xếp team",
                    pm.RoleId,
                    RoleCode = pm.Role != null ? pm.Role.RoleCode : "MEMBER",
                    RoleName = pm.Role != null ? pm.Role.RoleName : "Thành viên",
                    Username = pm.User != null ? pm.User.Username : "N/A",
                    FullName = pm.User != null ? pm.User.FullName : "Unknown",
                    Email = pm.User != null ? pm.User.Email : "",
                    Phone = pm.User != null ? pm.User.Phone : "",
                    Title = pm.User != null ? pm.User.Title : "",
                    AvatarPath = pm.User != null ? pm.User.AvatarPath : "",
                    DailyRate = pm.DailyRate, // Returned for PM / Admin display checking
                    pm.IsActive
                }).ToListAsync();

            var roles = await _context.Roles.OrderBy(r => r.HierarchyLevel).ToListAsync();
            var functionalTeams = await _context.FunctionalTeams
                .Where(ft => ft.Team!.ProjectId == projectId)
                .ToListAsync();

            return Ok(new
            {
                Teams = teams.Select(t => new
                {
                    t.TeamId,
                    t.TeamName,
                    t.ParentTeamId,
                    FunctionalTeams = t.FunctionalTeams.Select(ft => new { ft.FunctionalTeamId, ft.FunctionalTeamName }).ToList()
                }).ToList(),
                Members = members,
                Roles = roles,
                FunctionalTeams = functionalTeams.Select(ft => new { ft.FunctionalTeamId, ft.FunctionalTeamName }).ToList()
            });
        }

        // POST: api/team
        [HttpPost]
        public async Task<IActionResult> CreateTeam([FromBody] Team request)
        {
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.Role || c.Type == "role")?.Value;
            var projectRoleClaim = User.Claims.FirstOrDefault(c => c.Type == $"ProjectRole_{request.ProjectId}")?.Value;

            var hasAccess = globalRoleClaim == "SYSTEM_ADMIN" || 
                            projectRoleClaim == "PM" || 
                            projectRoleClaim == "PC" || 
                            projectRoleClaim == "LEADER";

            if (!hasAccess)
            {
                return Forbid("Chỉ PM, Project Coordinator, Leader hoặc Admin mới được phép tạo nhóm dự án.");
            }

            var team = new Team
            {
                ProjectId = request.ProjectId,
                TeamName = request.TeamName,
                ParentTeamId = request.ParentTeamId
            };
            _context.Teams.Add(team);
            await _context.SaveChangesAsync();
            return Ok(team);
        }

        // POST: api/team/functional
        [HttpPost("functional")]
        public async Task<IActionResult> CreateFunctionalTeam([FromBody] FunctionalTeam request)
        {
            var parentTeam = await _context.Teams.FindAsync(request.TeamId);
            if (parentTeam == null) return NotFound("Không tìm thấy nhóm dự án cha.");

            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.Role || c.Type == "role")?.Value;
            var projectRoleClaim = User.Claims.FirstOrDefault(c => c.Type == $"ProjectRole_{parentTeam.ProjectId}")?.Value;

            var hasAccess = globalRoleClaim == "SYSTEM_ADMIN" || 
                            projectRoleClaim == "PM" || 
                            projectRoleClaim == "PC" || 
                            projectRoleClaim == "LEADER";

            if (!hasAccess)
            {
                return Forbid("Chỉ PM, Project Coordinator, Leader hoặc Admin mới được phép tạo nhóm chức năng.");
            }

            var functionalTeam = new FunctionalTeam
            {
                TeamId = request.TeamId,
                FunctionalTeamName = request.FunctionalTeamName
            };
            _context.FunctionalTeams.Add(functionalTeam);
            await _context.SaveChangesAsync();
            return Ok(functionalTeam);
        }

        // POST: api/team/member
        [HttpPost("member")]
        public async Task<IActionResult> CreateOrAssignMember([FromBody] MemberAssignRequest request)
        {
            // Verify authority (PM, PC, Leader, or System Admin)
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.Role || c.Type == "role")?.Value;
            var projectRoleClaim = User.Claims.FirstOrDefault(c => c.Type == $"ProjectRole_{request.ProjectId}")?.Value;

            var hasAccess = globalRoleClaim == "SYSTEM_ADMIN" || 
                            projectRoleClaim == "PM" || 
                            projectRoleClaim == "PC" || 
                            projectRoleClaim == "LEADER";

            if (!hasAccess)
            {
                return Forbid("Chỉ PM, Project Coordinator, Leader hoặc Admin mới được phép gán thành viên dự án.");
            }

            // Find or create User
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == request.Username.ToLower());
            if (user == null)
            {
                // Create new user automatically with default password
                user = new User
                {
                    Username = request.Username,
                    PasswordHash = HashPassword("password123"), // Default password: password123
                    FullName = request.FullName,
                    Email = request.Email,
                    Phone = request.Phone,
                    Title = request.Title,
                    AvatarPath = request.AvatarPath ?? "https://api.dicebear.com/7.x/initials/svg?seed=" + Uri.EscapeDataString(request.FullName),
                    IsActive = true,
                    CreatedDate = DateTime.UtcNow
                };
                _context.Users.Add(user);
                await _context.SaveChangesAsync();
            }

            // Verify if project member entry already exists
            var existingMember = await _context.ProjectMembers
                .FirstOrDefaultAsync(pm => pm.ProjectId == request.ProjectId && pm.UserId == user.UserId);

            if (existingMember != null)
            {
                // Update existing membership (assign team, role, dailyRate)
                existingMember.FunctionalTeamId = request.FunctionalTeamId;
                existingMember.RoleId = request.RoleId;
                if (request.DailyRate.HasValue)
                {
                    existingMember.DailyRate = request.DailyRate.Value;
                }
                existingMember.IsActive = true;
                await _context.SaveChangesAsync();
                return Ok(existingMember);
            }

            var member = new ProjectMember
            {
                ProjectId = request.ProjectId,
                UserId = user.UserId,
                FunctionalTeamId = request.FunctionalTeamId,
                RoleId = request.RoleId,
                DailyRate = request.DailyRate ?? 150.00m,
                IsActive = true,
                CreatedDate = DateTime.UtcNow
            };

            _context.ProjectMembers.Add(member);
            await _context.SaveChangesAsync();

            return Ok(member);
        }

        private string HashPassword(string password)
        {
            using (var sha256 = SHA256.Create())
            {
                var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
                return BitConverter.ToString(hashedBytes).Replace("-", "").ToLower();
            }
        }
    }

    public class MemberAssignRequest
    {
        public int ProjectId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Title { get; set; }
        public string? AvatarPath { get; set; }
        public int RoleId { get; set; }
        public int? FunctionalTeamId { get; set; }
        public decimal? DailyRate { get; set; }
    }
}
