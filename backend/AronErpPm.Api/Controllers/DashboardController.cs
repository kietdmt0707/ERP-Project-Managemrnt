using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using AronErpPm.Api.Data;
using AronErpPm.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AronErpPm.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DashboardController : ControllerBase
    {
        private readonly AronDbContext _context;

        public DashboardController(AronDbContext context)
        {
            _context = context;
        }

        [HttpGet("overview")]
        public async Task<IActionResult> GetOverview()
        {
            var username = User.Identity?.Name;
            if (string.IsNullOrEmpty(username)) return Unauthorized();

            var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == username);
            if (user == null) return Unauthorized();

            // 1. Get user's active projects
            var userProjectIds = await _context.ProjectMembers
                .Where(pm => pm.UserId == user.UserId && pm.IsActive)
                .Select(pm => pm.ProjectId)
                .ToListAsync();

            var activeProjects = await _context.Projects
                .Where(p => userProjectIds.Contains(p.ProjectId) && p.IsActive)
                .ToListAsync();

            int activeProjectsCount = activeProjects.Count;

            // 2. Budget Burn & Project Health
            decimal totalBudget = 0;
            decimal totalActualCost = 0;
            int onTrackProjects = 0;

            foreach (var p in activeProjects)
            {
                totalBudget += p.BaselineBudget;
                totalActualCost += p.ActualCost;

                if (p.BaselineBudget == 0 || p.ActualCost <= p.BaselineBudget)
                {
                    onTrackProjects++;
                }
            }

            int projectHealth = activeProjectsCount > 0 ? (int)((decimal)onTrackProjects / activeProjectsCount * 100) : 100;
            int budgetBurn = totalBudget > 0 ? (int)((decimal)totalActualCost / totalBudget * 100) : 0;

            // 3. My Tasks & Task At-Risk
            var userTasks = await _context.Tasks
                .Include(t => t.Project)
                .Include(t => t.AssigneeMember)
                .Where(t => t.AssigneeMember != null && t.AssigneeMember.UserId == user.UserId && userProjectIds.Contains(t.ProjectId))
                .ToListAsync();

            var tasksAtRisk = userTasks.Count(t => t.Status == "DELAYED" || (t.Status != "COMPLETED" && t.EndDatePlanned < DateTime.UtcNow));

            var myTaskList = userTasks
                .Where(t => t.Status != "COMPLETED" || t.EndDatePlanned >= DateTime.UtcNow.AddDays(-7))
                .OrderBy(t => t.EndDatePlanned)
                .Take(5)
                .Select(t => new {
                    id = t.TaskId,
                    name = t.TaskName,
                    project = t.Project?.ProjectName ?? "",
                    date = t.EndDatePlanned.ToString("MMM dd"),
                    completed = t.Status == "COMPLETED",
                    isAtRisk = t.Status == "DELAYED" || (t.Status != "COMPLETED" && t.EndDatePlanned < DateTime.UtcNow)
                })
                .ToList();

            // 4. Project Progress breakdown
            var projectProgress = new List<object>();
            foreach (var p in activeProjects)
            {
                var pTasks = await _context.Tasks.Where(t => t.ProjectId == p.ProjectId).ToListAsync();
                
                if (pTasks.Count == 0) continue;

                int totalTasks = pTasks.Count;
                int completed = pTasks.Count(t => t.Status == "COMPLETED");
                int atRisk = pTasks.Count(t => t.Status == "DELAYED" || (t.Status != "COMPLETED" && t.EndDatePlanned < DateTime.UtcNow));
                int inProgress = totalTasks - completed - atRisk;
                if (inProgress < 0) inProgress = 0;

                projectProgress.Add(new {
                    projectId = p.ProjectId,
                    projectName = p.ProjectName,
                    projectCode = p.ProjectCode,
                    totalTasks = totalTasks,
                    inProgress = inProgress > 0 ? (int)((decimal)inProgress / totalTasks * 100) : 0,
                    completed = completed > 0 ? (int)((decimal)completed / totalTasks * 100) : 0,
                    atRisk = atRisk > 0 ? (int)((decimal)atRisk / totalTasks * 100) : 0
                });
            }

            // 5. Resource Utilization
            var allMembers = await _context.ProjectMembers
                .Include(m => m.Role)
                .Where(m => userProjectIds.Contains(m.ProjectId) && m.IsActive && m.Role != null)
                .ToListAsync();

            var totalMembers = allMembers.Count;
            var byRole = new List<object>();

            if (totalMembers > 0)
            {
                var roleGroups = allMembers.GroupBy(m => m.Role!.RoleName);
                foreach(var grp in roleGroups.Take(3))
                {
                    byRole.Add(new {
                        role = grp.Key,
                        percentage = (int)((decimal)grp.Count() / totalMembers * 100)
                    });
                }
            }

            var result = new {
                projectHealth = projectHealth,
                activeProjects = activeProjectsCount,
                tasksAtRisk = tasksAtRisk,
                budgetBurn = budgetBurn,
                myTaskList = myTaskList,
                projectProgress = projectProgress,
                resourceUtilization = new {
                    allocatedPercentage = totalMembers > 0 ? 80 : 0, // Mock calculation for now
                    byRole = byRole
                }
            };

            return Ok(result);
        }
    }
}
