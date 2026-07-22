using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AronErpPm.Api.Models
{
    // 1. Business Trip
    public class BusinessTrip
    {
        [Key]
        public int TripId { get; set; }

        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        [MaxLength(50)]
        public string TripCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(250)]
        public string Title { get; set; } = string.Empty;

        [Required]
        [MaxLength(250)]
        public string Destination { get; set; } = string.Empty;

        [Required]
        public DateTime StartDate { get; set; }

        [Required]
        public DateTime EndDate { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal AdvanceAmount { get; set; } = 0.00m;

        [MaxLength(20)]
        public string Status { get; set; } = "DRAFT"; // DRAFT, SUBMITTED, APPROVED, REJECTED

        public int? ApprovedByMemberId { get; set; }
        [ForeignKey("ApprovedByMemberId")]
        public ProjectMember? ApprovedByMember { get; set; }

        public int CreatedByMemberId { get; set; }
        [ForeignKey("CreatedByMemberId")]
        public ProjectMember? CreatedByMember { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }

    // 2. Business Trip Members
    public class BusinessTripMember
    {
        [Key]
        public int TripMemberId { get; set; }

        public int TripId { get; set; }
        [ForeignKey("TripId")]
        public BusinessTrip? BusinessTrip { get; set; }

        public int ProjectMemberId { get; set; }
        [ForeignKey("ProjectMemberId")]
        public ProjectMember? ProjectMember { get; set; }

        public bool IsGroupLeader { get; set; } = false;
    }

    // 3. Expense Claims
    public class Expense
    {
        [Key]
        public int ExpenseId { get; set; }

        public int TripId { get; set; }
        [ForeignKey("TripId")]
        public BusinessTrip? BusinessTrip { get; set; }

        public int? TaskId { get; set; }
        [ForeignKey("TaskId")]
        public Task? Task { get; set; }

        public int? SiteId { get; set; }
        [ForeignKey("SiteId")]
        public ProjectSite? ProjectSite { get; set; }

        public int ClaimantMemberId { get; set; }
        [ForeignKey("ClaimantMemberId")]
        public ProjectMember? ClaimantMember { get; set; }

        [Required]
        [MaxLength(50)]
        public string ExpenseType { get; set; } = string.Empty; // HOTEL, TRANSPORT, MEALS, OTHER

        [Column(TypeName = "decimal(18,2)")]
        public decimal AmountPlanned { get; set; } = 0.00m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal AmountActual { get; set; } = 0.00m;

        [MaxLength(500)]
        public string? ReceiptPath { get; set; } // Path/URL to invoice upload

        [MaxLength(20)]
        public string Status { get; set; } = "DRAFT"; // DRAFT, SUBMITTED, APPROVED, REJECTED

        public int? ApprovedByMemberId { get; set; }
        [ForeignKey("ApprovedByMemberId")]
        public ProjectMember? ApprovedByMember { get; set; }

        [MaxLength(500)]
        public string? Notes { get; set; }

        public bool IsOverLimit { get; set; } = false;

        [MaxLength(500)]
        public string? Justification { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal OverLimitAmount { get; set; } = 0.00m;

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }

    public class CreateBusinessTripDto
    {
        public int ProjectId { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Destination { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal AdvanceAmount { get; set; }
    }
}
