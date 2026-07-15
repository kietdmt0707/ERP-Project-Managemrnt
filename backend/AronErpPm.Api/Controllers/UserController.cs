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
    [Route("api/user")]
    [Authorize]
    public class UserController : ControllerBase
    {
        private readonly AronDbContext _context;

        public UserController(AronDbContext context)
        {
            _context = context;
        }

        // GET: api/user
        [HttpGet]
        public async Task<IActionResult> GetUsers()
        {
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == "GlobalRole")?.Value;
            var isSysAdmin = globalRoleClaim == "SYSTEM_ADMIN";
            var username = User.Identity?.Name;

            var isPm = false;
            if (username != null)
            {
                var userObj = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());
                if (userObj != null)
                {
                    isPm = await _context.ProjectMembers
                        .Include(pm => pm.Role)
                        .AnyAsync(pm => pm.UserId == userObj.UserId && pm.Role != null && pm.Role.RoleCode == "PM");
                }
            }

            if (!isSysAdmin && !isPm)
            {
                return Forbid("Chỉ Admin hệ thống hoặc PM mới có quyền xem danh sách người dùng.");
            }

            var users = await _context.Users
                .Include(u => u.GlobalRole)
                .OrderBy(u => u.Username)
                .ToListAsync();

            var memberships = await _context.ProjectMembers
                .Include(pm => pm.Project)
                .ToListAsync();

            var userDtos = users.Select(u => new UserDto
            {
                UserId = u.UserId,
                Username = u.Username,
                FullName = u.FullName,
                Email = u.Email,
                Phone = u.Phone,
                IsActive = u.IsActive,
                ExpiryDate = u.ExpiryDate,
                GlobalRoleId = u.GlobalRoleId,
                GlobalRole = u.GlobalRole,
                ProjectNames = memberships
                    .Where(pm => pm.UserId == u.UserId && pm.Project != null)
                    .Select(pm => pm.Project!.ProjectName)
                    .Distinct()
                    .ToList()
            }).ToList();

            return Ok(userDtos);
        }

        // POST: api/user
        [HttpPost]
        public async Task<IActionResult> CreateUser([FromBody] CreateUserRequest request)
        {
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == "GlobalRole")?.Value;
            var isSysAdmin = globalRoleClaim == "SYSTEM_ADMIN";
            var username = User.Identity?.Name;

            var isPm = false;
            if (username != null)
            {
                var userObj = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());
                if (userObj != null)
                {
                    isPm = await _context.ProjectMembers
                        .Include(pm => pm.Role)
                        .AnyAsync(pm => pm.UserId == userObj.UserId && pm.Role != null && pm.Role.RoleCode == "PM");
                }
            }

            if (!isSysAdmin && !isPm)
            {
                return Forbid("Chỉ Admin hệ thống hoặc PM mới có quyền tạo người dùng.");
            }

            if (string.IsNullOrEmpty(request.Username) || string.IsNullOrEmpty(request.Password) || request.Password.Length < 8)
            {
                return BadRequest("Tên đăng nhập và mật khẩu không được trống, mật khẩu phải có ít nhất 8 ký tự.");
            }

            var exists = await _context.Users.AnyAsync(u => u.Username.ToLower() == request.Username.ToLower());
            if (exists) return BadRequest("Tên đăng nhập đã tồn tại.");

            var newUser = new User
            {
                Username = request.Username,
                PasswordHash = HashPassword(request.Password),
                FullName = request.FullName,
                Email = request.Email,
                Phone = request.Phone,
                IsActive = request.IsActive,
                ExpiryDate = request.ExpiryDate,
                GlobalRoleId = request.GlobalRoleId,
                CreatedDate = DateTime.UtcNow
            };

            _context.Users.Add(newUser);
            await _context.SaveChangesAsync();

            return Ok(newUser);
        }

        // PUT: api/user/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateUser(int id, [FromBody] UpdateUserRequest request)
        {
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == "GlobalRole")?.Value;
            var isSysAdmin = globalRoleClaim == "SYSTEM_ADMIN";
            var username = User.Identity?.Name;

            var isPm = false;
            if (username != null)
            {
                var userObj = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == username.ToLower());
                if (userObj != null)
                {
                    isPm = await _context.ProjectMembers
                        .Include(pm => pm.Role)
                        .AnyAsync(pm => pm.UserId == userObj.UserId && pm.Role != null && pm.Role.RoleCode == "PM");
                }
            }

            if (!isSysAdmin && !isPm)
            {
                return Forbid("Chỉ Admin hệ thống hoặc PM mới có quyền cập nhật thông tin người dùng.");
            }

            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound("Không tìm thấy người dùng.");

            if (!string.IsNullOrEmpty(request.Username) && user.Username.ToLower() != request.Username.ToLower())
            {
                var exists = await _context.Users.AnyAsync(u => u.Username.ToLower() == request.Username.ToLower());
                if (exists) return BadRequest("Tên đăng nhập mới đã tồn tại.");
                user.Username = request.Username;
            }

            user.FullName = request.FullName;
            user.Email = request.Email;
            user.Phone = request.Phone;
            user.IsActive = request.IsActive;
            user.ExpiryDate = request.ExpiryDate;
            user.GlobalRoleId = request.GlobalRoleId;
            user.UpdatedDate = DateTime.UtcNow;

            if (!string.IsNullOrEmpty(request.Password))
            {
                if (request.Password.Length < 8)
                {
                    return BadRequest("Mật khẩu mới phải có ít nhất 8 ký tự.");
                }
                user.PasswordHash = HashPassword(request.Password);
            }

            await _context.SaveChangesAsync();
            return Ok(user);
        }

        // DELETE: api/user/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteUser(int id)
        {
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == "GlobalRole")?.Value;
            if (globalRoleClaim != "SYSTEM_ADMIN")
            {
                return Forbid("Chỉ Admin hệ thống mới có quyền xóa người dùng (PM không được phép xóa).");
            }

            var user = await _context.Users.FindAsync(id);
            if (user == null) return NotFound("Không tìm thấy người dùng.");

            _context.Users.Remove(user);
            await _context.SaveChangesAsync();

            return Ok(new { Message = "Đã xóa người dùng thành công!" });
        }

        // GET: api/user/{id}/projects
        [HttpGet("{id}/projects")]
        public async Task<IActionResult> GetUserProjects(int id)
        {
            var memberships = await _context.ProjectMembers
                .Where(pm => pm.UserId == id)
                .Select(pm => new {
                    pm.ProjectMemberId,
                    pm.ProjectId,
                    pm.RoleId,
                    pm.FunctionalTeamId,
                    pm.DailyRate,
                    pm.IsActive
                })
                .ToListAsync();

            return Ok(memberships);
        }

        // POST: api/user/{id}/projects
        [HttpPost("{id}/projects")]
        public async Task<IActionResult> UpdateUserProjects(int id, [FromBody] System.Collections.Generic.List<ProjectMember> memberships)
        {
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == "GlobalRole")?.Value;
            if (globalRoleClaim != "SYSTEM_ADMIN")
            {
                return Forbid("Chỉ Admin hệ thống mới có quyền phân công người dùng vào dự án.");
            }

            var existing = _context.ProjectMembers.Where(pm => pm.UserId == id);
            _context.ProjectMembers.RemoveRange(existing);
            await _context.SaveChangesAsync(); // Commit delete first to avoid EF Core unique constraint command reordering crash

            foreach (var mem in memberships)
            {
                mem.UserId = id;
                mem.ProjectMemberId = 0; // DB auto-increment
                mem.Project = null;
                mem.User = null;
                mem.FunctionalTeam = null;
                mem.Role = null;
                mem.CreatedDate = DateTime.UtcNow; // Force DateTime.UtcNow to avoid C# MinValue PostgreSQL crash
                _context.ProjectMembers.Add(mem);
            }

            await _context.SaveChangesAsync();
            return Ok(new { Message = "Cập nhật phân quyền dự án thành công!" });
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

    public class CreateUserRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public bool IsActive { get; set; } = true;
        public int? GlobalRoleId { get; set; }
        public DateTime? ExpiryDate { get; set; }
    }

    public class UpdateUserRequest
    {
        public string Username { get; set; } = string.Empty;
        public string? Password { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public bool IsActive { get; set; } = true;
        public int? GlobalRoleId { get; set; }
        public DateTime? ExpiryDate { get; set; }
    }

    public class UserDto
    {
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public bool IsActive { get; set; }
        public DateTime? ExpiryDate { get; set; }
        public int? GlobalRoleId { get; set; }
        public Role? GlobalRole { get; set; }
        public List<string> ProjectNames { get; set; } = new();
    }
}
