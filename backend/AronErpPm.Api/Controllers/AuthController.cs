using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using AronErpPm.Api.Data;
using AronErpPm.Api.DTOs;
using AronErpPm.Api.Models;

namespace AronErpPm.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AronDbContext _context;
        private readonly IConfiguration _configuration;

        public AuthController(AronDbContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        [HttpPost("login")]
        public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
        {
            // Find User
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
            if (user == null || !user.IsActive)
            {
                return Unauthorized(new { message = "Tài khoản hoặc mật khẩu không hợp lệ." });
            }

            // Simple Password verification (in production, use password hashing like BCrypt)
            if (request.Password != "password123" && request.Password != user.PasswordHash) 
            {
                return Unauthorized(new { message = "Tài khoản hoặc mật khẩu không hợp lệ." });
            }

            // Check if user has a configured global role
            var globalRole = "USER";
            var dbUser = await _context.Users.Include(u => u.GlobalRole).FirstOrDefaultAsync(u => u.UserId == user.UserId);
            if (dbUser?.GlobalRole != null)
            {
                globalRole = dbUser.GlobalRole.RoleCode;
            }
            else if (request.Username.ToLower() == "admin" || request.Username.ToLower() == "sysadmin")
            {
                globalRole = "SYSTEM_ADMIN";
            }

            return await GenerateAuthResponse(user, globalRole);
        }

        [HttpPost("sso")]
        public async Task<ActionResult<AuthResponse>> MicrosoftSso([FromBody] SsoRequest request)
        {
            if (string.IsNullOrEmpty(request.Email))
            {
                return BadRequest(new { message = "Email Microsoft không được bỏ trống." });
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower());
            if (user == null || !user.IsActive)
            {
                return BadRequest(new { message = "Email này chưa được cấp tài khoản hoặc đã bị khóa trong hệ thống. Vui lòng liên hệ Admin để đăng ký trước." });
            }

            var globalRole = "USER";
            var dbUser = await _context.Users.Include(u => u.GlobalRole).FirstOrDefaultAsync(u => u.UserId == user.UserId);
            if (dbUser?.GlobalRole != null)
            {
                globalRole = dbUser.GlobalRole.RoleCode;
            }
            else if (user.Username.ToLower() == "admin" || user.Username.ToLower() == "sysadmin")
            {
                globalRole = "SYSTEM_ADMIN";
            }

            return await GenerateAuthResponse(user, globalRole);
        }

        private async Task<ActionResult<AuthResponse>> GenerateAuthResponse(User user, string globalRole)
        {
            // Query user's roles inside projects (Matrix Organization)
            var projectMemberships = await _context.ProjectMembers
                .Include(pm => pm.Project)
                .Include(pm => pm.Role)
                .Include(pm => pm.FunctionalTeam)
                .Where(pm => pm.UserId == user.UserId && pm.IsActive)
                .ToListAsync();

            var projectRoles = projectMemberships.Select(pm => new ProjectRoleDto
            {
                ProjectId = pm.ProjectId,
                ProjectCode = pm.Project?.ProjectCode ?? string.Empty,
                ProjectName = pm.Project?.ProjectName ?? string.Empty,
                RoleCode = pm.Role?.RoleCode ?? string.Empty,
                RoleName = pm.Role?.RoleName ?? string.Empty,
                HierarchyLevel = pm.Role?.HierarchyLevel ?? 5,
                FunctionalTeamName = pm.FunctionalTeam?.FunctionalTeamName
            }).ToList();

            // Generate JWT Token
            var tokenHandler = new JwtSecurityTokenHandler();
            var jwtSecret = _configuration["JwtSettings:Secret"] ?? "SuperSecretKeyLongerThan32BytesForAronErpPmSystem";
            var key = Encoding.ASCII.GetBytes(jwtSecret);

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                new Claim(ClaimTypes.Name, user.Username),
                new Claim(ClaimTypes.GivenName, user.FullName),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, globalRole),
                new Claim("GlobalRole", globalRole)
            };

            // Add project roles as custom claims to token
            foreach (var pr in projectRoles)
            {
                claims.Add(new Claim($"ProjectRole_{pr.ProjectId}", pr.RoleCode));
            }

            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.UtcNow.AddDays(7),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };

            var token = tokenHandler.CreateToken(tokenDescriptor);
            var tokenString = tokenHandler.WriteToken(token);

            var dbUser = await _context.Users.Include(u => u.GlobalRole).FirstOrDefaultAsync(u => u.UserId == user.UserId);
            var permissionsJson = dbUser?.GlobalRole?.PermissionsJson;

            return Ok(new AuthResponse
            {
                Token = tokenString,
                Username = user.Username,
                FullName = user.FullName,
                Email = user.Email,
                GlobalRole = globalRole,
                PermissionsJson = permissionsJson,
                ProjectRoles = projectRoles
            });
        }
    }

    public class SsoRequest
    {
        public string Email { get; set; } = string.Empty;
    }
}
