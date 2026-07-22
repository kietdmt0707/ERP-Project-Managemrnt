using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AronErpPm.Api.Models
{
    [Table("travel_regions")]
    public class TravelRegion
    {
        [Key]
        [Column("region_id")]
        public int RegionId { get; set; }

        [Required]
        [MaxLength(20)]
        [Column("region_code")]
        public string RegionCode { get; set; } = string.Empty; // TIERS_1, TIERS_2, TIERS_3

        [Required]
        [MaxLength(100)]
        [Column("region_name")]
        public string RegionName { get; set; } = string.Empty; // Vùng 1, Vùng 2...

        [Required]
        [Column("provinces_included")]
        public string ProvincesIncluded { get; set; } = string.Empty; // Hà Nội, Hồ Chí Minh
    }

    [Table("travel_expense_policies")]
    public class TravelExpensePolicy
    {
        [Key]
        [Column("policy_id")]
        public int PolicyId { get; set; }

        [Column("project_id")]
        public int? ProjectId { get; set; } // Null = Mặc định toàn hệ thống, có ID = Ghi đè theo Dự án

        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        [Required]
        [MaxLength(20)]
        [Column("region_code")]
        public string RegionCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        [Column("role_code")]
        public string RoleCode { get; set; } = string.Empty; // MEMBER, LEADER, PM

        [Column("per_diem_allowance", TypeName = "decimal(12,2)")]
        public decimal PerDiemAllowance { get; set; }

        [Column("max_hotel_rate", TypeName = "decimal(12,2)")]
        public decimal MaxHotelRate { get; set; }

        [Column("transport_allowance", TypeName = "decimal(12,2)")]
        public decimal TransportAllowance { get; set; } = 0.00m;

        [Column("pocket_allowance", TypeName = "decimal(12,2)")]
        public decimal PocketAllowance { get; set; } = 0.00m;

        [Required]
        [MaxLength(10)]
        [Column("currency")]
        public string Currency { get; set; } = "VND"; // VND, USD, EUR, SGD, JPY...

        [MaxLength(50)]
        [Column("flight_ticket_class")]
        public string? FlightTicketClass { get; set; }

        [Column("is_active")]
        public bool IsActive { get; set; } = true;

        [Column("updated_at")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
