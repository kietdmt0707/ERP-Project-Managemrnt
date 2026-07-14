using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AronErpPm.Api.Models
{
    // 1. RICEFW Registry & Progress Tracking
    public class RicefwRegistry
    {
        [Key]
        public int RicefwId { get; set; }

        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        [Required]
        [MaxLength(50)]
        public string RicefwCode { get; set; } = string.Empty; // e.g. I-AP-EINV-01

        [Required]
        [MaxLength(250)]
        public string RicefwName { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string ModuleCode { get; set; } = string.Empty; // AP, AR, GL, PO, INV...

        [Required]
        [MaxLength(20)]
        public string ObjectType { get; set; } = string.Empty; // REPORT, INTERFACE, CONVERSION, EXTENSION, FORM, WORKFLOW

        [Required]
        [MaxLength(15)]
        public string Complexity { get; set; } = "LOW"; // LOW, MEDIUM, HIGH

        // Oracle Standard Specs Deliverable Statuses
        [Required]
        [MaxLength(30)]
        public string FunctionalSpecStatus { get; set; } = "PENDING"; // MD050: PENDING, IN_PROGRESS, APPROVED

        [Required]
        [MaxLength(30)]
        public string TechnicalSpecStatus { get; set; } = "PENDING"; // MD070: PENDING, IN_PROGRESS, APPROVED

        // Development & Testing Progress
        [Required]
        [MaxLength(30)]
        public string CodingStatus { get; set; } = "NOT_STARTED"; // NOT_STARTED, IN_PROGRESS, COMPLETED

        [Required]
        [MaxLength(30)]
        public string UnitTestingStatus { get; set; } = "NOT_STARTED";

        [Required]
        [MaxLength(30)]
        public string SitStatus { get; set; } = "NOT_STARTED";

        [Required]
        [MaxLength(30)]
        public string UatStatus { get; set; } = "NOT_STARTED";

        public int? ResponsibleMemberId { get; set; }
        [ForeignKey("ResponsibleMemberId")]
        public ProjectMember? ResponsibleMember { get; set; }

        [MaxLength(500)]
        public string? SharepointFolderLink { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedDate { get; set; }
    }

    // 2. Oracle Environments (Instances)
    public class OracleInstance
    {
        [Key]
        public int InstanceId { get; set; }

        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        [Required]
        [MaxLength(50)]
        public string InstanceName { get; set; } = string.Empty; // DEV1, TEST1, UAT, PROD

        [Required]
        [MaxLength(50)]
        public string OracleVersion { get; set; } = string.Empty; // e.g. Fusion 24C

        [Required]
        [MaxLength(30)]
        public string InstanceStatus { get; set; } = "ACTIVE"; // ACTIVE, REFRESHING, DOWN

        public DateTime? LastRefreshDate { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        public DateTime UpdatedDate { get; set; } = DateTime.UtcNow;
    }

    // 3. SharePoint site integration map
    public class SharepointMapping
    {
        [Key]
        public int MappingId { get; set; }

        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        [Required]
        [MaxLength(500)]
        public string SharepointSiteUrl { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string RootFolderId { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string RootFolderPath { get; set; } = string.Empty;

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
