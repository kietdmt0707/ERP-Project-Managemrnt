using Microsoft.EntityFrameworkCore;
using AronErpPm.Api.Models;
using Task = AronErpPm.Api.Models.Task;

namespace AronErpPm.Api.Data
{
    public class AronDbContext : DbContext
    {
        public AronDbContext(DbContextOptions<AronDbContext> options) : base(options)
        {
        }

        public DbSet<Project> Projects { get; set; } = null!;
        public DbSet<ProjectSite> ProjectSites { get; set; } = null!;
        public DbSet<Team> Teams { get; set; } = null!;
        public DbSet<FunctionalTeam> FunctionalTeams { get; set; } = null!;
        public DbSet<Role> Roles { get; set; } = null!;
        public DbSet<User> Users { get; set; } = null!;
        public DbSet<ProjectMember> ProjectMembers { get; set; } = null!;
        public DbSet<Task> Tasks { get; set; } = null!;
        public DbSet<TaskDependency> TaskDependencies { get; set; } = null!;
        public DbSet<Issue> Issues { get; set; } = null!;
        public DbSet<Timesheet> Timesheets { get; set; } = null!;
        public DbSet<BusinessTrip> BusinessTrips { get; set; } = null!;
        public DbSet<BusinessTripMember> BusinessTripMembers { get; set; } = null!;
        public DbSet<Expense> Expenses { get; set; } = null!;
        public DbSet<ApprovalWorkflow> ApprovalWorkflows { get; set; } = null!;
        public DbSet<ApprovalStep> ApprovalSteps { get; set; } = null!;
        public DbSet<RicefwRegistry> RicefwRegistries { get; set; } = null!;
        public DbSet<OracleInstance> OracleInstances { get; set; } = null!;
        public DbSet<SharepointMapping> SharepointMappings { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure Unique constraint on Project Code
            modelBuilder.Entity<Project>()
                .HasIndex(p => p.ProjectCode)
                .IsUnique();

            // Configure Unique constraint on User Username and Email
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Username)
                .IsUnique();
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email)
                .IsUnique();

            // Configure Unique constraint on Project Member Project + User mapping
            modelBuilder.Entity<ProjectMember>()
                .HasIndex(pm => new { pm.ProjectId, pm.UserId })
                .IsUnique();

            // Configure Unique constraint on Task Code per Project
            modelBuilder.Entity<Task>()
                .HasIndex(t => new { t.ProjectId, t.TaskCode })
                .IsUnique();

            // Configure Unique constraint on Ricefw Code per Project
            modelBuilder.Entity<RicefwRegistry>()
                .HasIndex(r => new { r.ProjectId, r.RicefwCode })
                .IsUnique();

            // Configure Self-referencing Task hierarchy
            modelBuilder.Entity<Task>()
                .HasOne(t => t.ParentTask)
                .WithMany(p => p.SubTasks)
                .HasForeignKey(t => t.ParentTaskId)
                .OnDelete(DeleteBehavior.Restrict);

            // Configure Self-referencing Team hierarchy
            modelBuilder.Entity<Team>()
                .HasOne(t => t.ParentTeam)
                .WithMany(p => p.SubTeams)
                .HasForeignKey(t => t.ParentTeamId)
                .OnDelete(DeleteBehavior.Restrict);

            // Configure Task Dependency relations (FS, SS, etc.)
            modelBuilder.Entity<TaskDependency>()
                .HasOne(td => td.PredecessorTask)
                .WithMany()
                .HasForeignKey(td => td.PredecessorTaskId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<TaskDependency>()
                .HasOne(td => td.SuccessorTask)
                .WithMany()
                .HasForeignKey(td => td.SuccessorTaskId)
                .OnDelete(DeleteBehavior.Restrict);

            // Ensure cascades don't cause multiple path loops in SQL Server
            modelBuilder.Entity<ProjectSite>()
                .HasOne(s => s.Project)
                .WithMany(p => p.ProjectSites)
                .HasForeignKey(s => s.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Team>()
                .HasOne(t => t.Project)
                .WithMany(p => p.Teams)
                .HasForeignKey(t => t.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ProjectMember>()
                .HasOne(pm => pm.Project)
                .WithMany(p => p.ProjectMembers)
                .HasForeignKey(pm => pm.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Task>()
                .HasOne(t => t.Project)
                .WithMany(p => p.Tasks)
                .HasForeignKey(t => t.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Timesheet>()
                .HasOne(ts => ts.Project)
                .WithMany()
                .HasForeignKey(ts => ts.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<BusinessTrip>()
                .HasOne(bt => bt.Project)
                .WithMany()
                .HasForeignKey(bt => bt.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ApprovalWorkflow>()
                .HasOne(aw => aw.Project)
                .WithMany()
                .HasForeignKey(aw => aw.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<RicefwRegistry>()
                .HasOne(r => r.Project)
                .WithMany()
                .HasForeignKey(r => r.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<OracleInstance>()
                .HasOne(oi => oi.Project)
                .WithMany()
                .HasForeignKey(oi => oi.ProjectId)
                .OnDelete(DeleteBehavior.Cascade);

            // Tự động chuyển toàn bộ Tên bảng, Cột, Khóa, Chỉ mục sang chữ thường để tương thích PostgreSQL
            foreach (var entity in modelBuilder.Model.GetEntityTypes())
            {
                var tableName = entity.GetTableName();
                if (!string.IsNullOrEmpty(tableName))
                {
                    entity.SetTableName(tableName.ToLowerInvariant());
                }

                foreach (var property in entity.GetProperties())
                {
                    property.SetColumnName(property.GetColumnName().ToLowerInvariant());
                }

                foreach (var key in entity.GetKeys())
                {
                    var keyName = key.GetName();
                    if (!string.IsNullOrEmpty(keyName))
                    {
                        key.SetName(keyName.ToLowerInvariant());
                    }
                }

                foreach (var fk in entity.GetForeignKeys())
                {
                    var fkName = fk.GetConstraintName();
                    if (!string.IsNullOrEmpty(fkName))
                    {
                        fk.SetConstraintName(fkName.ToLowerInvariant());
                    }
                }

                foreach (var index in entity.GetIndexes())
                {
                    var indexName = index.GetDatabaseName();
                    if (!string.IsNullOrEmpty(indexName))
                    {
                        index.SetDatabaseName(indexName.ToLowerInvariant());
                    }
                }
            }
        }
    }
}
