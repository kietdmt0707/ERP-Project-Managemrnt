using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AronErpPm.Api.Models
{
    [Table("system_settings")]
    public class SystemSetting
    {
        [Key]
        public int SettingId { get; set; }

        [Required]
        [MaxLength(250)]
        public string AppName { get; set; } = "ARON Project Management";

        public string? LogoUrl { get; set; }

        public string? BannerUrl { get; set; }

        [MaxLength(250)]
        public string? SmtpHost { get; set; }

        public int SmtpPort { get; set; } = 587;

        [MaxLength(250)]
        public string? SmtpUsername { get; set; }

        [MaxLength(250)]
        public string? SmtpPassword { get; set; }

        public bool SmtpEnableSsl { get; set; } = true;

        public DateTime UpdatedDate { get; set; } = DateTime.UtcNow;
    }
}
