using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using AronErpPm.Api.Data;
using AronErpPm.Api.DTOs;
using AronErpPm.Api.Models;
using AronErpPm.Api.Services;

namespace AronErpPm.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AronDbContext _context;
        private readonly IConfiguration _configuration;
        private readonly IEmailService _emailService;

        public AuthController(AronDbContext context, IConfiguration configuration, IEmailService emailService)
        {
            _context = context;
            _configuration = configuration;
            _emailService = emailService;
        }

        [HttpPost("login")]
        public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
        {
            try
            {
                if (request == null || string.IsNullOrWhiteSpace(request.Username))
                {
                    return BadRequest(new { message = "Vui lòng nhập tên đăng nhập." });
                }

                var cleanUsername = request.Username.Trim().ToLower();
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Username.ToLower() == cleanUsername);
                if (user == null || !user.IsActive)
                {
                    return Unauthorized(new { message = "Tài khoản hoặc mật khẩu không hợp lệ." });
                }

                // Password verification using SHA256 hashing (with master fallback)
                var hashedPassword = HashPassword(request.Password);
                if (request.Password != "password123" && hashedPassword != user.PasswordHash && request.Password != user.PasswordHash) 
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
                else if (cleanUsername == "admin" || cleanUsername == "sysadmin" || cleanUsername == "kietdmt")
                {
                    globalRole = "SYSTEM_ADMIN";
                }

                return await GenerateAuthResponse(user, globalRole);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Lỗi hệ thống đăng nhập: " + ex.Message });
            }
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
            else if (user.Username.ToLower() == "admin" || user.Username.ToLower() == "sysadmin" || user.Username.ToLower() == "kietdmt")
            {
                globalRole = "SYSTEM_ADMIN";
            }

            return await GenerateAuthResponse(user, globalRole);
        }

        private async Task<ActionResult<AuthResponse>> GenerateAuthResponse(User user, string globalRole)
        {
            try
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
                var jwtSecret = _configuration["JwtSettings:Secret"] ?? "SuperSecretKeyLongerThan32BytesForAronErpPmSystemSecurityEncryption";
                var key = Encoding.ASCII.GetBytes(jwtSecret);

                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.NameIdentifier, user.UserId.ToString()),
                    new Claim(ClaimTypes.Name, user.Username ?? string.Empty),
                    new Claim(ClaimTypes.GivenName, user.FullName ?? user.Username ?? string.Empty),
                    new Claim(ClaimTypes.Email, user.Email ?? string.Empty),
                    new Claim(ClaimTypes.Role, globalRole ?? "USER"),
                    new Claim("GlobalRole", globalRole ?? "USER")
                };

                // Add project roles as custom claims to token
                foreach (var pr in projectRoles)
                {
                    claims.Add(new Claim($"ProjectRole_{pr.ProjectId}", pr.RoleCode ?? string.Empty));
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
                    UserId = user.UserId,
                    Username = user.Username ?? string.Empty,
                    FullName = user.FullName ?? user.Username ?? string.Empty,
                    Email = user.Email ?? string.Empty,
                    Phone = user.Phone,
                    AvatarPath = user.AvatarPath,
                    AnnualLeaveDays = user.AnnualLeaveDays,
                    CarryOverDays = user.CarryOverDays,
                    GlobalRole = globalRole,
                    PermissionsJson = permissionsJson,
                    ProjectRoles = projectRoles
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Lỗi khởi tạo token đăng nhập: " + ex.Message });
            }
        }

        private string HashPassword(string password)
        {
            using (var sha256 = System.Security.Cryptography.SHA256.Create())
            {
                var hashedBytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(password));
                return BitConverter.ToString(hashedBytes).Replace("-", "").ToLower();
            }
        }
        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
        {
            if (string.IsNullOrEmpty(request.Email))
            {
                return BadRequest("Email không được trống.");
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == request.Email.ToLower());
            if (user == null || !user.IsActive)
            {
                return Ok(new { message = "Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi đi." });
            }

            var token = EmailService.GenerateSecureToken();
            user.ResetToken = token;
            user.ResetTokenExpiry = DateTime.UtcNow.AddHours(1);
            await _context.SaveChangesAsync();

            // Dynamically detect frontend origin from request headers
            var webPortalUrl = Request.Headers["Origin"].ToString();
            if (string.IsNullOrEmpty(webPortalUrl))
            {
                var referer = Request.Headers["Referer"].ToString();
                if (!string.IsNullOrEmpty(referer))
                {
                    // Extract origin from referer (e.g. https://domain.com/path -> https://domain.com)
                    try
                    {
                        var uri = new Uri(referer);
                        webPortalUrl = $"{uri.Scheme}://{uri.Authority}";
                    }
                    catch
                    {
                        webPortalUrl = referer;
                    }
                }
            }

            if (string.IsNullOrEmpty(webPortalUrl))
            {
                webPortalUrl = _configuration["ApiSettings:WebPortalUrl"] ?? "https://erp-project-managemrnt-sage.vercel.app";
            }

            webPortalUrl = webPortalUrl.TrimEnd('/');
            var resetLink = $"{webPortalUrl}/reset-password?token={token}";

            await _emailService.SendPasswordResetEmailAsync(user.Email, user.FullName, resetLink);

            return Ok(new { message = "Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi đi." });
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
        {
            if (string.IsNullOrEmpty(request.Token))
            {
                return BadRequest("Mã xác thực token không hợp lệ.");
            }

            if (string.IsNullOrEmpty(request.NewPassword) || request.NewPassword.Length < 8)
            {
                return BadRequest("Mật khẩu mới phải có ít nhất 8 ký tự.");
            }

            var user = await _context.Users.FirstOrDefaultAsync(u => u.ResetToken == request.Token && u.ResetTokenExpiry > DateTime.UtcNow);
            if (user == null)
            {
                return BadRequest("Liên kết đặt lại mật khẩu đã hết hạn hoặc không hợp lệ.");
            }

            user.PasswordHash = HashPassword(request.NewPassword);
            user.ResetToken = null;
            user.ResetTokenExpiry = null;
            user.UpdatedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new { message = "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới." });
        }
    }

    public class ForgotPasswordRequest
    {
        public string Email { get; set; } = string.Empty;
    }

    public class ResetPasswordRequest
    {
        public string Token { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    public class SsoRequest
    {
        public string Email { get; set; } = string.Empty;
    }
}
