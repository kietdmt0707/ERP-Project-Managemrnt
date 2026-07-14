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
    }
}
