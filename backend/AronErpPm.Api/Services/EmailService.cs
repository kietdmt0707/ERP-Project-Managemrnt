using System;
using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using AronErpPm.Api.Data;

namespace AronErpPm.Api.Services
{
    public interface IEmailService
    {
        Task SendApprovalEmailAsync(string toEmail, string approverName, string requesterName, string projectName, string targetType, string description, decimal amount, int stepId, string secureToken);
        Task SendPasswordResetEmailAsync(string toEmail, string fullName, string resetLink);
    }

    public class EmailService : IEmailService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<EmailService> _logger;
        private readonly AronDbContext _context;

        public EmailService(IConfiguration configuration, ILogger<EmailService> logger, AronDbContext context)
        {
            _configuration = configuration;
            _logger = logger;
            _context = context;
        }

        public async Task SendApprovalEmailAsync(
            string toEmail, 
            string approverName, 
            string requesterName, 
            string projectName, 
            string targetType, 
            string description, 
            decimal amount, 
            int stepId, 
            string secureToken)
        {
            // Retrieve system settings
            var settings = await _context.SystemSettings.FirstOrDefaultAsync();
            var appName = settings?.AppName ?? "ARON Project Management";
            var logoUrl = settings?.LogoUrl ?? "https://raw.githubusercontent.com/vitejs/vite/main/packages/vite/src/node/logo.png";

            var apiBaseUrl = _configuration["ApiSettings:BaseUrl"] ?? "https://erp-project-management.onrender.com";
            var webPortalUrl = _configuration["ApiSettings:WebPortalUrl"] ?? "https://erp-project-managemrnt-sage.vercel.app";

            // Build Quick One-click Approval Links
            var approveUrl = $"{apiBaseUrl}/api/approval/quick-action?token={secureToken}&action=APPROVE";
            var rejectUrl = $"{apiBaseUrl}/api/approval/quick-action?token={secureToken}&action=REJECT";
            
            // Build Deep Link to the full Web Portal (Requires login/SSO)
            var detailUrl = $"{webPortalUrl}/approvals";

            // Draft the HTML body
            var htmlBody = $@"
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff; color: #333333;'>
                    <div style='text-align: center; padding-bottom: 20px; border-bottom: 2px solid #00d2ff;'>
                        <img src='{logoUrl}' alt='Logo' style='max-height: 50px; margin-bottom: 10px;' />
                        <h2 style='color: #0d6efd; margin: 0;'>{appName.ToUpper()}</h2>
                    </div>
                    
                    <p style='font-size: 15px;'>Chào <strong>{approverName}</strong>,</p>
                    <p>Có một yêu cầu phê duyệt mới cần xử lý trong dự án <strong>{projectName}</strong>:</p>
                    
                    <table style='width: 100%; border-collapse: collapse; margin: 20px 0;'>
                        <tr>
                            <td style='padding: 10px; border-bottom: 1px solid #eeeeee; font-weight: bold; width: 35%;'>Người yêu cầu:</td>
                            <td style='padding: 10px; border-bottom: 1px solid #eeeeee;'>{requesterName}</td>
                        </tr>
                        <tr>
                            <td style='padding: 10px; border-bottom: 1px solid #eeeeee; font-weight: bold;'>Hạng mục:</td>
                            <td style='padding: 10px; border-bottom: 1px solid #eeeeee;'>{targetType}</td>
                        </tr>
                        <tr>
                            <td style='padding: 10px; border-bottom: 1px solid #eeeeee; font-weight: bold;'>Chi tiết:</td>
                            <td style='padding: 10px; border-bottom: 1px solid #eeeeee;'>{description}</td>
                        </tr>
                        {(amount > 0 ? $@"
                        <tr>
                            <td style='padding: 10px; border-bottom: 1px solid #eeeeee; font-weight: bold;'>Số tiền đề xuất:</td>
                            <td style='padding: 10px; border-bottom: 1px solid #eeeeee; color: #dc3545; font-weight: bold; font-size: 16px;'>{amount:N0} VNĐ</td>
                        </tr>" : "")}
                    </table>

                    <div style='text-align: center; margin: 30px 0; background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;'>
                        <p style='color: #666666; font-size: 13px; margin: 0 0 15px 0;'><strong>TÙY CHỌN 1: DUYỆT NHANH (Không cần đăng nhập)</strong></p>
                        <a href='{approveUrl}' style='background-color: #198754; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 15px; display: inline-block; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);'>PHÊ DUYỆT NHANH</a>
                        <a href='{rejectUrl}' style='background-color: #dc3545; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);'>TỪ CHỐI NHANH</a>
                    </div>

                    <div style='text-align: center; background-color: #ebf5ff; padding: 15px; border-radius: 8px;'>
                        <p style='color: #333333; font-size: 13px; margin: 0 0 10px 0;'><strong>TÙY CHỌN 2: XEM TÀI LIỆU CHI TIẾT TRÊN PORTAL</strong></p>
                        <a href='{detailUrl}' style='color: #0d6efd; font-weight: bold; text-decoration: underline; font-size: 14px;'>Mở Cổng Portal {appName}</a>
                    </div>

                    <hr style='border: 0; border-top: 1px solid #eeeeee; margin-top: 30px;' />
                    <p style='font-size: 11px; color: #999999; text-align: center;'>Email này được tự động gửi từ hệ thống {appName}. Link phê duyệt nhanh có hiệu lực trong vòng 24 giờ kể từ khi gửi.</p>
                </div>";

            // Try sending a real email if SMTP is configured
            var hasSmtp = settings != null && !string.IsNullOrEmpty(settings.SmtpHost) && !string.IsNullOrEmpty(settings.SmtpUsername);

            if (hasSmtp)
            {
                try
                {
                    using (var mail = new MailMessage())
                    {
                        mail.From = new MailAddress(settings!.SmtpUsername!, appName);
                        mail.To.Add(toEmail);
                        mail.Subject = $"[{appName}] Yêu cầu phê duyệt {targetType} - {projectName}";
                        mail.Body = htmlBody;
                        mail.IsBodyHtml = true;

                        using (var smtp = new SmtpClient(settings.SmtpHost, settings.SmtpPort))
                        {
                            smtp.Credentials = new NetworkCredential(settings.SmtpUsername, settings.SmtpPassword);
                            smtp.EnableSsl = settings.SmtpEnableSsl;
                            smtp.Timeout = 10000; // 10 seconds timeout
                            await smtp.SendMailAsync(mail);
                        }
                    }
                    _logger.LogInformation($"[REAL EMAIL SENT] To: {toEmail} via SMTP {settings.SmtpHost}");
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Failed to send real email via SMTP {settings.SmtpHost}. Falling back to mock logging.");
                }
            }

            // Mock log output fallback
            _logger.LogInformation($"[MOCK EMAIL SENT] To: {toEmail}\nSubject: [{appName}] Approval Request for {targetType}\nBody:\n{htmlBody}\n");
            await Task.CompletedTask;
        }

        public async Task SendPasswordResetEmailAsync(string toEmail, string fullName, string resetLink)
        {
            var settings = await _context.SystemSettings.FirstOrDefaultAsync();
            var appName = settings?.AppName ?? "ARON Project Management";
            var logoUrl = settings?.LogoUrl ?? "https://raw.githubusercontent.com/vitejs/vite/main/packages/vite/src/node/logo.png";

            var htmlBody = $@"
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff; color: #333333;'>
                    <div style='text-align: center; padding-bottom: 20px; border-bottom: 2px solid #00d2ff;'>
                        <img src='{logoUrl}' alt='Logo' style='max-height: 50px; margin-bottom: 10px;' />
                        <h2 style='color: #0d6efd; margin: 0;'>{appName.ToUpper()}</h2>
                    </div>
                    
                    <p style='font-size: 15px;'>Chào <strong>{fullName}</strong>,</p>
                    <p>Hệ thống nhận được yêu cầu khôi phục mật khẩu cho tài khoản liên kết với email này. Vui lòng bấm vào liên kết dưới đây để đặt lại mật khẩu mới:</p>
                    
                    <div style='text-align: center; margin: 30px 0;'>
                        <a href='{resetLink}' style='background-color: #0d6efd; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; font-size: 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);'>ĐẶT LẠI MẬT KHẨU</a>
                    </div>

                    <p style='font-size: 13px; color: #666666;'>Hoặc sao chép và dán đường link sau vào trình duyệt:</p>
                    <p style='font-size: 12px; color: #0d6efd; word-break: break-all;'><a href='{resetLink}'>{resetLink}</a></p>

                    <p style='font-size: 13px; color: #dc3545;'><strong>* Lưu ý:</strong> Link khôi phục mật khẩu này có hiệu lực trong vòng 60 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
                    
                    <hr style='border: 0; border-top: 1px solid #eeeeee; margin-top: 30px;' />
                    <p style='font-size: 11px; color: #999999; text-align: center;'>Email này được tự động gửi từ hệ thống {appName}.</p>
                </div>";

            var hasSmtp = settings != null && !string.IsNullOrEmpty(settings.SmtpHost) && !string.IsNullOrEmpty(settings.SmtpUsername);

            if (hasSmtp)
            {
                try
                {
                    using (var mail = new MailMessage())
                    {
                        mail.From = new MailAddress(settings!.SmtpUsername!, appName);
                        mail.To.Add(toEmail);
                        mail.Subject = $"[{appName}] Khôi phục mật khẩu tài khoản";
                        mail.Body = htmlBody;
                        mail.IsBodyHtml = true;

                        using (var smtp = new SmtpClient(settings.SmtpHost, settings.SmtpPort))
                        {
                            smtp.Credentials = new NetworkCredential(settings.SmtpUsername, settings.SmtpPassword);
                            smtp.EnableSsl = settings.SmtpEnableSsl;
                            smtp.Timeout = 10000; // 10 seconds timeout
                            await smtp.SendMailAsync(mail);
                        }
                    }
                    _logger.LogInformation($"[PASSWORD RESET EMAIL SENT] To: {toEmail} via SMTP {settings.SmtpHost}");
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, $"Failed to send password reset email via SMTP {settings.SmtpHost}. Falling back to mock logging.");
                }
            }

            _logger.LogInformation($"[MOCK PASSWORD RESET EMAIL SENT] To: {toEmail}\nSubject: [{appName}] Password Reset\nBody:\n{htmlBody}\n");
            await Task.CompletedTask;
        }

        public static string GenerateSecureToken()
        {
            var bytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create())
            {
                rng.GetBytes(bytes);
            }
            return Convert.ToBase64String(bytes)
                .Replace("+", "")
                .Replace("/", "")
                .Replace("=", "");
        }
    }
}
