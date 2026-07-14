using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AronErpPm.Api.Models
{
    [Table("system_settings")]
    public class SystemSetting
    {
        [Key]
        [Column("setting_id")]
        public int SettingId { get; set; }

        [Required]
        [MaxLength(250)]
        [Column("app_name")]
        public string AppName { get; set; } = "ARON Project Management";

        [Column("logo_url")]
        public string? LogoUrl { get; set; }

        [Column("banner_url")]
        public string? BannerUrl { get; set; }

        [MaxLength(250)]
        [Column("smtp_host")]
        public string? SmtpHost { get; set; }

        [Column("smtp_port")]
        public int SmtpPort { get; set; } = 587;

        [MaxLength(250)]
        [Column("smtp_username")]
        public string? SmtpUsername { get; set; }

        [MaxLength(250)]
        [Column("smtp_password")]
        public string? SmtpPassword { get; set; }

        [Column("smtp_enable_ssl")]
        public bool SmtpEnableSsl { get; set; } = true;

        [Column("updated_date")]
        public DateTime UpdatedDate { get; set; } = DateTime.UtcNow;
    }
}
