using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AronErpPm.Api.Models
{
    // 1. Approval Workflow Header
    public class ApprovalWorkflow
    {
        [Key]
        public int WorkflowId { get; set; }

        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        public int SubmitterMemberId { get; set; }
        [ForeignKey("SubmitterMemberId")]
        public ProjectMember? SubmitterMember { get; set; }

        [Required]
        [MaxLength(50)]
        public string TargetType { get; set; } = string.Empty; // TIMESHEET, EXPENSE, TRIP, CHANGE_REQUEST, DELIVERABLE

        public int TargetId { get; set; } // Reference ID

        public int CurrentStepNumber { get; set; } = 1; // 1, 2, or 3

        [Required]
        [MaxLength(20)]
        public string WorkflowStatus { get; set; } = "PENDING"; // PENDING, APPROVED, REJECTED

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedDate { get; set; }

        public ICollection<ApprovalStep> Steps { get; set; } = new List<ApprovalStep>();
    }

    // 2. Approval Steps (3 Levels maximum)
    public class ApprovalStep
    {
        [Key]
        public int StepId { get; set; }

        public int WorkflowId { get; set; }
        [ForeignKey("WorkflowId")]
        public ApprovalWorkflow? Workflow { get; set; }

        public int StepNumber { get; set; } // 1 (Leader), 2 (PM), 3 (Director)

        public int ApproverMemberId { get; set; }
        [ForeignKey("ApproverMemberId")]
        public ProjectMember? ApproverMember { get; set; }

        [Required]
        [MaxLength(20)]
        public string StepStatus { get; set; } = "PENDING"; // PENDING, APPROVED, REJECTED

        [MaxLength(500)]
        public string? Comments { get; set; }

        [MaxLength(255)]
        public string? SecureToken { get; set; } // Signed token for quick one-click actions

        public DateTime? TokenExpiry { get; set; }

        public DateTime? ActionDate { get; set; }
    }
}
