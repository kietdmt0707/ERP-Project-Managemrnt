using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AronErpPm.Api.Models
{
    // 1. Task (Gantt Task 3 levels)
    public class Task
    {
        [Key]
        public int TaskId { get; set; }

        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        [Required]
        [MaxLength(50)]
        public string TaskCode { get; set; } = string.Empty; // e.g. 1.1, 1.1.2 (WBS Code)

        [Required]
        [MaxLength(250)]
        public string TaskName { get; set; } = string.Empty;

        public string? Description { get; set; }

        public int TaskLevel { get; set; } // 1, 2, 3, or 4

        [MaxLength(50)]
        public string? AIMCode { get; set; } // e.g. RD.011, BP.080, BR.100, TE.040

        [Required]
        [MaxLength(30)]
        public string VisibilityScope { get; set; } = "PUBLIC"; // PUBLIC, VENDOR_INTERNAL, PRIVATE_TEAM

        public int? ParentTaskId { get; set; }
        [ForeignKey("ParentTaskId")]
        public Task? ParentTask { get; set; }

        public int? AssigneeMemberId { get; set; }
        [ForeignKey("AssigneeMemberId")]
        public ProjectMember? AssigneeMember { get; set; }

        public int? ApproverMemberId { get; set; }
        [ForeignKey("ApproverMemberId")]
        public ProjectMember? ApproverMember { get; set; }

        [Required]
        public DateTime StartDatePlanned { get; set; }

        [Required]
        public DateTime EndDatePlanned { get; set; }

        public DateTime? StartDateActual { get; set; }

        public DateTime? EndDateActual { get; set; }

        public int DurationPlanned { get; set; } // in days

        [Column(TypeName = "decimal(5,2)")]
        public decimal ProgressPercent { get; set; } = 0.00m;

        [Required]
        [MaxLength(30)]
        public string Status { get; set; } = "NOT_STARTED"; // NOT_STARTED, IN_PROGRESS, PENDING_APPROVAL, COMPLETED, DELAYED

        public bool IsVisibleToAll { get; set; } = true; // Visibility option to hide tasks from others

        [Column("is_manual_progress")]
        public bool IsManualProgress { get; set; } = false;

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedDate { get; set; }

        public ICollection<Task> SubTasks { get; set; } = new List<Task>();
    }

    // 5. Sub-Task Management (SharePoint Task Model linked to Activity Task)
    [Table("sub_tasks")]
    public class SubTask
    {
        [Key]
        [Column("sub_task_id")]
        public int SubTaskId { get; set; }

        [Column("project_id")]
        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        [Column("activity_id")]
        public int ActivityId { get; set; }
        [ForeignKey("ActivityId")]
        public Task? Activity { get; set; }

        [Column("created_by_user_id")]
        public int CreatedByUserId { get; set; }
        [ForeignKey("CreatedByUserId")]
        public User? CreatedByUser { get; set; }

        [Column("category")]
        [MaxLength(50)]
        public string? Category { get; set; }

        [Column("module")]
        [MaxLength(50)]
        public string? Module { get; set; }

        [Column("doc_code")]
        [MaxLength(50)]
        public string? DocCode { get; set; }

        [Column("task_name")]
        [Required]
        [MaxLength(250)]
        public string TaskName { get; set; } = string.Empty;

        [Column("description")]
        public string? Description { get; set; }

        [Column("assignee_member_id")]
        public int? AssigneeMemberId { get; set; }
        [ForeignKey("AssigneeMemberId")]
        public ProjectMember? AssigneeMember { get; set; }

        [Column("reviewer_member_id")]
        public int? ReviewerMemberId { get; set; }
        [ForeignKey("ReviewerMemberId")]
        public ProjectMember? ReviewerMember { get; set; }

        [Column("key_user")]
        [MaxLength(100)]
        public string? KeyUser { get; set; }

        [Column("party")]
        [MaxLength(50)]
        public string? Party { get; set; }

        [Column("start_date")]
        public DateTime? StartDate { get; set; }

        [Column("end_date")]
        public DateTime? EndDate { get; set; }

        [Column("deadline")]
        public DateTime? Deadline { get; set; }

        [Column("status")]
        [MaxLength(50)]
        public string Status { get; set; } = "1. Mới tạo";

        [Column("progress_percent", TypeName = "decimal(5,2)")]
        public decimal ProgressPercent { get; set; } = 0.00m;

        [Column("weight")]
        public int Weight { get; set; } = 1;

        [Column("attachment_url")]
        [MaxLength(500)]
        public string? AttachmentUrl { get; set; }

        [Column("created_date")]
        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        [Column("updated_date")]
        public DateTime? UpdatedDate { get; set; }
    }

    // 2. Task Dependencies (Predecessors & Successors)
    public class TaskDependency
    {
        [Key]
        public int DependencyId { get; set; }

        public int PredecessorTaskId { get; set; }
        [ForeignKey("PredecessorTaskId")]
        public Task? PredecessorTask { get; set; }

        public int SuccessorTaskId { get; set; }
        [ForeignKey("SuccessorTaskId")]
        public Task? SuccessorTask { get; set; }

        [Required]
        [MaxLength(10)]
        public string DependencyType { get; set; } = "FS"; // FS, SS, FF, SF

        public int LagDays { get; set; } = 0;
    }

    // 3. Issue & Risk Tracking
    public class Issue
    {
        [Key]
        public int IssueId { get; set; }

        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        [Required]
        [MaxLength(250)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Description { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Severity { get; set; } = "LOW"; // LOW, MEDIUM, HIGH, CRITICAL

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "OPEN"; // OPEN, IN_PROGRESS, RESOLVED, CLOSED

        public int RaisedByMemberId { get; set; }
        [ForeignKey("RaisedByMemberId")]
        public ProjectMember? RaisedByMember { get; set; }

        public int? AssignedToMemberId { get; set; }
        [ForeignKey("AssignedToMemberId")]
        public ProjectMember? AssignedToMember { get; set; }

        public DateTime? TargetResolveDate { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedDate { get; set; }
    }

    // 4. Timesheet Tracking
    public class Timesheet
    {
        [Key]
        public int TimesheetId { get; set; }

        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        public int MemberId { get; set; }
        [ForeignKey("MemberId")]
        public ProjectMember? Member { get; set; }

        public int? TaskId { get; set; }
        [ForeignKey("TaskId")]
        public Task? Task { get; set; }

        [Required]
        public DateTime WorkDate { get; set; }

        [Column(TypeName = "decimal(4,2)")]
        public decimal HoursWorked { get; set; }

        [MaxLength(500)]
        public string? Description { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "DRAFT"; // DRAFT, SUBMITTED, APPROVED, REJECTED

        public int? ApprovedByMemberId { get; set; }
        [ForeignKey("ApprovedByMemberId")]
        public ProjectMember? ApprovedByMember { get; set; }

        public DateTime? ApprovalDate { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
