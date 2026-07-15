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
    [Route("api/setting")]
    public class SettingController : ControllerBase
    {
        private readonly AronDbContext _context;

        public SettingController(AronDbContext context)
        {
            _context = context;
        }

        // GET: api/setting
        // Public API so login screen can read app name, logo, banner
        [HttpGet]
        public async Task<IActionResult> GetSettings()
        {
            var settings = await _context.SystemSettings.FirstOrDefaultAsync();
            if (settings == null)
            {
                // Return default settings if none exist
                return Ok(new SystemSetting
                {
                    AppName = "ARON Project Management",
                    LogoUrl = "https://raw.githubusercontent.com/vitejs/vite/main/packages/vite/src/node/logo.png",
                    BannerUrl = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1600"
                });
            }
            return Ok(settings);
        }

        // POST: api/setting
        // Protected API - Only accessible by authorized users (Admin checking done at client/server level)
        [HttpPost]
        [Authorize]
        public async Task<IActionResult> UpdateSettings([FromBody] SystemSetting request)
        {
            // Verify if user is System Admin
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == "GlobalRole")?.Value;
            if (globalRoleClaim != "SYSTEM_ADMIN")
            {
                return Forbid("Chỉ có Admin hệ thống mới có quyền thay đổi thiết lập hệ thống.");
            }

            var settings = await _context.SystemSettings.FirstOrDefaultAsync();
            if (settings == null)
            {
                settings = new SystemSetting();
                _context.SystemSettings.Add(settings);
            }

            settings.AppName = request.AppName;
            settings.LogoUrl = request.LogoUrl;
            settings.BannerUrl = request.BannerUrl;
            settings.SmtpHost = request.SmtpHost;
            settings.SmtpPort = request.SmtpPort;
            settings.SmtpUsername = request.SmtpUsername;
            settings.SmtpSenderEmail = request.SmtpSenderEmail;
            
            // Only update password if a new one is provided
            if (!string.IsNullOrEmpty(request.SmtpPassword))
            {
                settings.SmtpPassword = request.SmtpPassword;
            }
            
            settings.SmtpEnableSsl = request.SmtpEnableSsl;
            settings.UpdatedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(settings);
        }

        // POST: api/setting/test-email
        [HttpPost("test-email")]
        [Authorize]
        public async Task<IActionResult> TestEmail([FromBody] TestEmailRequest request)
        {
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == "GlobalRole")?.Value;
            if (globalRoleClaim != "SYSTEM_ADMIN")
            {
                return Forbid("Chỉ có Admin hệ thống mới có quyền gửi thử nghiệm cấu hình SMTP.");
            }

            if (string.IsNullOrEmpty(request.SmtpHost) || string.IsNullOrEmpty(request.SmtpUsername))
            {
                return BadRequest("Cấu hình SMTP Host và SMTP Username không được trống.");
            }

            var settings = await _context.SystemSettings.FirstOrDefaultAsync();
            var appName = settings?.AppName ?? "ARON Project Management";

            var password = request.SmtpPassword;
            if (string.IsNullOrEmpty(password) && settings != null)
            {
                password = settings.SmtpPassword;
            }

            if (string.IsNullOrEmpty(password))
            {
                return BadRequest("Mật khẩu SMTP không được trống.");
            }

            try
            {
                using (var mail = new System.Net.Mail.MailMessage())
                {
                    var senderEmail = !string.IsNullOrEmpty(request.SmtpSenderEmail) ? request.SmtpSenderEmail : request.SmtpUsername;
                    mail.From = new System.Net.Mail.MailAddress(senderEmail, appName);
                    mail.To.Add(request.DestinationEmail);
                    mail.Subject = $"[{appName}] Kiểm tra cấu hình kết nối SMTP Server";
                    mail.Body = $@"
                        <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                            <h2 style='color: #198754; margin-top: 0;'>Kết Nối SMTP Thành Công!</h2>
                            <p>Xin chào,</p>
                            <p>Đây là email tự động gửi từ hệ thống <strong>{appName}</strong> để xác minh cấu hình SMTP Server của bạn hoạt động chính xác.</p>
                            <hr style='border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;' />
                            <table style='width: 100%; border-collapse: collapse;'>
                                <tr>
                                    <td style='padding: 6px 0; font-weight: bold; width: 30%;'>SMTP Host:</td>
                                    <td style='padding: 6px 0;'>{request.SmtpHost}</td>
                                </tr>
                                <tr>
                                    <td style='padding: 6px 0; font-weight: bold;'>Port:</td>
                                    <td style='padding: 6px 0;'>{request.SmtpPort}</td>
                                </tr>
                                <tr>
                                    <td style='padding: 6px 0; font-weight: bold;'>Username Email:</td>
                                    <td style='padding: 6px 0;'>{request.SmtpUsername}</td>
                                </tr>
                                <tr>
                                    <td style='padding: 6px 0; font-weight: bold;'>SSL/TLS:</td>
                                    <td style='padding: 6px 0;'>{(request.SmtpEnableSsl ? "Bật (Enabled)" : "Tắt (Disabled)")}</td>
                                </tr>
                            </table>
                        </div>";
                    mail.IsBodyHtml = true;

                    using (var smtp = new System.Net.Mail.SmtpClient(request.SmtpHost, request.SmtpPort))
                    {
                        smtp.Credentials = new System.Net.NetworkCredential(request.SmtpUsername, password);
                        smtp.EnableSsl = request.SmtpEnableSsl;
                        smtp.Timeout = 10000; // 10 seconds timeout
                        await smtp.SendMailAsync(mail);
                    }
                }

                return Ok(new { success = true, message = "Kết nối thành công! Đã gửi mail thử nghiệm tới " + request.DestinationEmail });
            }
            catch (Exception ex)
            {
                var errorMsg = ex.Message;
                if (ex.InnerException != null)
                {
                    errorMsg += " -> " + ex.InnerException.Message;
                }
                return BadRequest(new { success = false, message = "Lỗi kết nối SMTP: " + errorMsg });
            }
        }
    }

    public class TestEmailRequest
    {
        public string SmtpHost { get; set; } = string.Empty;
        public int SmtpPort { get; set; } = 587;
        public string SmtpUsername { get; set; } = string.Empty;
        public string? SmtpPassword { get; set; }
        public string? SmtpSenderEmail { get; set; }
        public bool SmtpEnableSsl { get; set; } = true;
        public string DestinationEmail { get; set; } = string.Empty;
    }
}
