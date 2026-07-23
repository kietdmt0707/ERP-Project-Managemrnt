using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AronErpPm.Api.Models
{
    // 1. Projects
    public class Project
    {
        [Key]
        public int ProjectId { get; set; }

        [Required]
        [MaxLength(50)]
        public string ProjectCode { get; set; } = string.Empty;

        [Required]
        [MaxLength(250)]
        public string ProjectName { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Address { get; set; }

        public int SitesCount { get; set; } = 1;

        [MaxLength(500)]
        public string? ContactInfo { get; set; }

        public string? LogoPath { get; set; }

        public string? SharepointFolderLink { get; set; }
        public string? SharepointFolderId { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal BaselineBudget { get; set; } = 0.00m;

        [Column(TypeName = "decimal(18,2)")]
        public decimal ActualCost { get; set; } = 0.00m;

        public bool IsActive { get; set; } = true;
        
        public string? ProjectScope { get; set; }
        public int? ImplementationWeeks { get; set; } = 24;
        public DateTime? KickOffDate { get; set; }
        public DateTime? TargetGoLiveDate { get; set; }
        
        [MaxLength(100)]
        public string? CurrentPhase { get; set; } = "Analyze"; // Analyze, Design, Build, Transition, Go-Live
        
        public string? ModulesScope { get; set; } // GL, AP, AR, FA, PO, INV, OM

        [MaxLength(100)]
        public string WorkDaysOfWeek { get; set; } = "MON,TUE,WED,THU,FRI";

        public int StandardHoursPerDay { get; set; } = 8;

        public string HolidaysJson { get; set; } = "[]";

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedDate { get; set; }

        // Navigation properties
        public ICollection<ProjectSite> ProjectSites { get; set; } = new List<ProjectSite>();
        public ICollection<Team> Teams { get; set; } = new List<Team>();
        public ICollection<ProjectMember> ProjectMembers { get; set; } = new List<ProjectMember>();
        public ICollection<Task> Tasks { get; set; } = new List<Task>();
    }

    // 2. Project Sites
    public class ProjectSite
    {
        [Key]
        public int SiteId { get; set; }

        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        [Required]
        [MaxLength(250)]
        public string SiteName { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Address { get; set; }

        [MaxLength(100)]
        public string? ContactName { get; set; }

        [MaxLength(50)]
        public string? Phone { get; set; }

        [MaxLength(150)]
        public string? Email { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }

    // 3. Teams (ARON, Client, Partner)
    public class Team
    {
        [Key]
        public int TeamId { get; set; }

        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        [Required]
        [MaxLength(150)]
        public string TeamName { get; set; } = string.Empty;

        [Required]
        [MaxLength(50)]
        public string TeamType { get; set; } = "ARON"; // ARON, CLIENT, PARTNER

        public int? ParentTeamId { get; set; }
        [ForeignKey("ParentTeamId")]
        public Team? ParentTeam { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        public ICollection<Team> SubTeams { get; set; } = new List<Team>();
        public ICollection<FunctionalTeam> FunctionalTeams { get; set; } = new List<FunctionalTeam>();
    }

    // 4. Functional Teams (PO-INV, AP, FIN, Tech, DBA...)
    public class FunctionalTeam
    {
        [Key]
        public int FunctionalTeamId { get; set; }

        public int TeamId { get; set; }
        [ForeignKey("TeamId")]
        public Team? Team { get; set; }

        [Required]
        [MaxLength(150)]
        public string FunctionalTeamName { get; set; } = string.Empty;

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }

    // 5. System Roles
    public class Role
    {
        [Key]
        public int RoleId { get; set; }

        [Required]
        [MaxLength(50)]
        public string RoleCode { get; set; } = string.Empty; // SYSTEM_ADMIN, DIRECTOR, PM, LEADER, MEMBER

        [Required]
        [MaxLength(100)]
        public string RoleName { get; set; } = string.Empty;

        public string? Description { get; set; }

        public bool IsActive { get; set; } = true;

        public string? PermissionsJson { get; set; } // JSON chứa ma trận quyền trên từng chức năng

        public int HierarchyLevel { get; set; } // 1: System Admin -> 5: Member
    }

    // 6. Users
    public class User
    {
        [Key]
        public int UserId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Username { get; set; } = string.Empty;

        [Required]
        [MaxLength(255)]
        public string PasswordHash { get; set; } = string.Empty;

        [Required]
        [MaxLength(150)]
        public string FullName { get; set; } = string.Empty;

        [MaxLength(100)]
        public string? Title { get; set; }

        [Required]
        [MaxLength(150)]
        public string Email { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? Phone { get; set; }

        public string? AvatarPath { get; set; }

        public int AnnualLeaveDays { get; set; } = 12;
        public int CarryOverDays { get; set; } = 0;

        public bool IsActive { get; set; } = true;

        public DateTime? ExpiryDate { get; set; }

        public int? GlobalRoleId { get; set; }
        [ForeignKey("GlobalRoleId")]
        public Role? GlobalRole { get; set; }

        [MaxLength(255)]
        public string? ResetToken { get; set; }

        public DateTime? ResetTokenExpiry { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedDate { get; set; }
    }

    // 7. Project Members (Mapping of User to Project + Role + Functional Team)
    public class ProjectMember
    {
        [Key]
        public int ProjectMemberId { get; set; }

        public int ProjectId { get; set; }
        [ForeignKey("ProjectId")]
        public Project? Project { get; set; }

        public int UserId { get; set; }
        [ForeignKey("UserId")]
        public User? User { get; set; }

        public int? FunctionalTeamId { get; set; }
        [ForeignKey("FunctionalTeamId")]
        public FunctionalTeam? FunctionalTeam { get; set; }

        public int RoleId { get; set; }
        [ForeignKey("RoleId")]
        public Role? Role { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? DailyRate { get; set; } // Costing (PM and above only)

        public bool IsActive { get; set; } = true;

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }

    // 8. Project Scope Master Data
    [Table("project_scope_options")]
    public class ProjectScopeOption
    {
        [Key]
        public int OptionId { get; set; }

        [Required]
        [MaxLength(100)]
        public string Value { get; set; } = string.Empty;

        [Required]
        [MaxLength(250)]
        public string Description { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;
    }
}
