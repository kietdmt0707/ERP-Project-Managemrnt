using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AronErpPm.Api.Models
{
    // 1. LeaveRequest Entity
    [Table("leave_requests")]
    public class LeaveRequest
    {
        [Key]
        [Column("leave_id")]
        public int LeaveId { get; set; }

        [Column("user_id")]
        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User? User { get; set; }

        [Required]
        [Column("start_date")]
        public DateTime StartDate { get; set; }

        [Required]
        [Column("end_date")]
        public DateTime EndDate { get; set; }

        [Column("total_days", TypeName = "decimal(5,2)")]
        public decimal TotalDays { get; set; }

        [Required]
        [MaxLength(500)]
        [Column("reason")]
        public string Reason { get; set; } = string.Empty;

        [Required]
        [MaxLength(30)]
        [Column("status")]
        public string Status { get; set; } = "PENDING"; // PENDING, APPROVED, REJECTED

        [Column("created_date")]
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        // Navigation property for parallel approvals per project
        public ICollection<LeaveProjectApproval> ProjectApprovals { get; set; } = new List<LeaveProjectApproval>();
    }

    // 2. Parallel Leave Project Approval Entity
    [Table("leave_project_approvals")]
    public class LeaveProjectApproval
    {
        [Key]
        [Column("approval_id")]
        public int ApprovalId { get; set; }

        [Column("leave_id")]
        public int LeaveId { get; set; }
        [ForeignKey("LeaveId")]
        public LeaveRequest? LeaveRequest { get; set; }

        [Column("project_id")]
        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        [Column("approver_member_id")]
        public int ApproverMemberId { get; set; }
        [ForeignKey("ApproverMemberId")]
        public ProjectMember? ApproverMember { get; set; }

        [Required]
        [MaxLength(30)]
        [Column("status")]
        public string Status { get; set; } = "PENDING"; // PENDING, APPROVED, REJECTED

        [Column("action_date")]
        public DateTime? ActionDate { get; set; }

        [MaxLength(500)]
        [Column("comments")]
        public string? Comments { get; set; }
    }
}
