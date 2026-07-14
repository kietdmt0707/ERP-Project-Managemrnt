using System.Security.Cryptography;
using System.Text;

namespace AronErpPm.Api.Services
{
    public interface IEmailService
    {
        Task SendApprovalEmailAsync(string toEmail, string approverName, string requesterName, string projectName, string targetType, string description, decimal amount, int stepId, string secureToken);
    }

    public class EmailService : IEmailService
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IConfiguration configuration, ILogger<EmailService> logger)
        {
            _configuration = configuration;
            _logger = logger;
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
            var apiBaseUrl = _configuration["ApiSettings:BaseUrl"] ?? "https://api.aron.vn";
            var webPortalUrl = _configuration["ApiSettings:WebPortalUrl"] ?? "https://pm.aron.vn";

            // Build Quick One-click Approval Links
            var approveUrl = $"{apiBaseUrl}/api/approvals/quick-action?token={secureToken}&action=APPROVE";
            var rejectUrl = $"{apiBaseUrl}/api/approvals/quick-action?token={secureToken}&action=REJECT";
            
            // Build Deep Link to the full Web Portal (Requires login/SSO)
            var detailUrl = $"{webPortalUrl}/approvals/detail/{stepId}";

            // Draft the HTML body
            var htmlBody = $@"
                <div style='font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;'>
                    <h2 style='color: #0d6efd; border-bottom: 2px solid #0d6efd; padding-bottom: 10px;'>YÊU CẦU PHÊ DUYỆT DỰ ÁN</h2>
                    <p>Chào <strong>{approverName}</strong>,</p>
                    <p>Có một yêu cầu phê duyệt mới cần xử lý trong dự án <strong>{projectName}</strong>:</p>
                    
                    <table style='width: 100%; border-collapse: collapse; margin: 20px 0;'>
                        <tr>
                            <td style='padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;'>Người yêu cầu:</td>
                            <td style='padding: 8px; border-bottom: 1px solid #eee;'>{requesterName}</td>
                        </tr>
                        <tr>
                            <td style='padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;'>Hạng mục:</td>
                            <td style='padding: 8px; border-bottom: 1px solid #eee;'>{targetType}</td>
                        </tr>
                        <tr>
                            <td style='padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;'>Chi tiết:</td>
                            <td style='padding: 8px; border-bottom: 1px solid #eee;'>{description}</td>
                        </tr>
                        {(amount > 0 ? $@"
                        <tr>
                            <td style='padding: 8px; border-bottom: 1px solid #eee; font-weight: bold;'>Số tiền đề xuất:</td>
                            <td style='padding: 8px; border-bottom: 1px solid #eee; color: #dc3545; font-weight: bold;'>{amount:N0} VNĐ</td>
                        </tr>" : "")}
                    </table>

                    <div style='text-align: center; margin: 30px 0;'>
                        <p style='color: #666; font-size: 13px; margin-bottom: 15px;'><strong>TÙY CHỌN 1: DUYỆT NHANH (Không cần đăng nhập)</strong></p>
                        <a href='{approveUrl}' style='background-color: #198754; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; margin-right: 15px; display: inline-block;'>PHÊ DUYỆT NHANH</a>
                        <a href='{rejectUrl}' style='background-color: #dc3545; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;'>TỪ CHỐI NHANH</a>
                    </div>

                    <div style='text-align: center; background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px;'>
                        <p style='color: #666; font-size: 13px; margin: 0 0 10px 0;'><strong>TÙY CHỌN 2: XEM CHI TIẾT & BÀN GIAO TÀI LIỆU SHAREPOINT (Yêu cầu đăng nhập)</strong></p>
                        <a href='{detailUrl}' style='color: #0d6efd; font-weight: bold; text-decoration: underline;'>Mở Cổng Portal Quản lý Dự án ARON</a>
                    </div>

                    <hr style='border: 0; border-top: 1px solid #eee; margin-top: 30px;' />
                    <p style='font-size: 11px; color: #999; text-align: center;'>Email này được tự động gửi từ hệ thống ARON ERP-PM. Link phê duyệt nhanh có hiệu lực trong vòng 24 giờ kể từ khi gửi.</p>
                </div>";

            // In real life, use SmtpClient or SendGrid to send
            // Here, we simulate the email output to logs (mock sending)
            _logger.LogInformation($"[MOCK EMAIL SENT] To: {toEmail}\nSubject: [ARON ERP-PM] Approval Request for {targetType} - Step Id: {stepId}\nBody:\n{htmlBody}\n");

            await Task.CompletedTask;
        }

        // Helper to generate cryptographically secure token
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
