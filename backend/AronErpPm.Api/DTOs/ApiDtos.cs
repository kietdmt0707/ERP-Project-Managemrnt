using System;
using System.Collections.Generic;

namespace AronErpPm.Api.DTOs
{
    // Auth DTOs
    public class LoginRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class AuthResponse
    {
        public string Token { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string GlobalRole { get; set; } = string.Empty;
        public List<ProjectRoleDto> ProjectRoles { get; set; } = new List<ProjectRoleDto>();
    }

    public class ProjectRoleDto
    {
        public int ProjectId { get; set; }
        public string ProjectCode { get; set; } = string.Empty;
        public string ProjectName { get; set; } = string.Empty;
        public string RoleCode { get; set; } = string.Empty;
        public string RoleName { get; set; } = string.Empty;
        public int HierarchyLevel { get; set; }
        public string? FunctionalTeamName { get; set; }
    }

    // Task Tree DTO for Gantt Chart (3 levels)
    public class TaskTreeNodeDto
    {
        public int TaskId { get; set; }
        public int ProjectId { get; set; }
        public string TaskCode { get; set; } = string.Empty; // e.g. 1.1.2
        public string TaskName { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int TaskLevel { get; set; }
        public int? ParentTaskId { get; set; }
        
        public int? AssigneeMemberId { get; set; }
        public string? AssigneeName { get; set; }
        public string? AssigneeTeam { get; set; }
        
        public int? ApproverMemberId { get; set; }
        public string? ApproverName { get; set; }

        public DateTime StartDatePlanned { get; set; }
        public DateTime EndDatePlanned { get; set; }
        public DateTime? StartDateActual { get; set; }
        public DateTime? EndDateActual { get; set; }
        
        public int DurationPlanned { get; set; }
        public decimal ProgressPercent { get; set; }
        public string Status { get; set; } = string.Empty; // NOT_STARTED, IN_PROGRESS, PENDING_APPROVAL, COMPLETED, DELAYED
        public bool IsVisibleToAll { get; set; }

        public List<TaskTreeNodeDto> SubTasks { get; set; } = new List<TaskTreeNodeDto>();
        public List<int> PredecessorTaskIds { get; set; } = new List<int>();
    }

    // Approval Request DTO
    public class ApprovalActionRequest
    {
        public int StepId { get; set; }
        public string Action { get; set; } = string.Empty; // APPROVE or REJECT
        public string? Comments { get; set; }
    }

    // Email Approval Link Response Page (HTML renderer context)
    public class EmailApprovalResult
    {
        public bool Success { get; set; }
        public string Message { get; set; } = string.Empty;
        public string ProjectName { get; set; } = string.Empty;
        public string RequesterName { get; set; } = string.Empty;
        public string TargetType { get; set; } = string.Empty;
        public string TargetDescription { get; set; } = string.Empty;
    }

    // RICEFW DTO
    public class RicefwRegistryDto
    {
        public int RicefwId { get; set; }
        public int ProjectId { get; set; }
        public string RicefwCode { get; set; } = string.Empty;
        public string RicefwName { get; set; } = string.Empty;
        public string ModuleCode { get; set; } = string.Empty;
        public string ObjectType { get; set; } = string.Empty; // REPORT, INTERFACE...
        public string Complexity { get; set; } = string.Empty; // LOW, MEDIUM, HIGH
        public string FunctionalSpecStatus { get; set; } = string.Empty; // MD050
        public string TechnicalSpecStatus { get; set; } = string.Empty; // MD070
        public string CodingStatus { get; set; } = string.Empty;
        public string UnitTestingStatus { get; set; } = string.Empty;
        public string SitStatus { get; set; } = string.Empty;
        public string UatStatus { get; set; } = string.Empty;
        public int? ResponsibleMemberId { get; set; }
        public string? ResponsibleMemberName { get; set; }
        public string? SharepointFolderLink { get; set; }
    }
}
