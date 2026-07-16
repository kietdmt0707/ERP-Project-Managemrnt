using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using AronErpPm.Api.Data;
using AronErpPm.Api.Services;

// Config polling file watcher globally to avoid Linux container inotify limit issues on Render
Environment.SetEnvironmentVariable("DOTNET_USE_POLLING_FILE_WATCHER", "true");
Environment.SetEnvironmentVariable("DOTNET_USE_POLLING_FILE_WATCHER", "1");

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
});

// Register HttpContextAccessor to read user claims in RLS interceptor
builder.Services.AddHttpContextAccessor();

// Register Custom Db Connection Interceptor for Row-Level Security
builder.Services.AddScoped<SessionContextInterceptor>();

// Configure Entity Framework Core with PostgreSQL and RLS Interceptor
builder.Services.AddDbContext<AronDbContext>((serviceProvider, options) =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    
    // Tự động phân tích cú pháp nếu nhận được chuỗi kết nối dạng postgres:// hoặc postgresql:// từ Neon
    if (!string.IsNullOrEmpty(connectionString) && (connectionString.StartsWith("postgres://") || connectionString.StartsWith("postgresql://")))
    {
        try
        {
            var uri = new Uri(connectionString);
            var userInfo = uri.UserInfo.Split(':');
            var username = Uri.UnescapeDataString(userInfo[0]);
            var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
            var host = uri.Host;
            var port = uri.Port > 0 ? uri.Port : 5432;
            var database = uri.AbsolutePath.TrimStart('/');
            
            connectionString = $"Host={host};Port={port};Database={database};Username={username};Password={password};SSL Mode=Require;Trust Server Certificate=True;";
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Lỗi phân tích Connection String URI: {ex.Message}");
        }
    }

    var interceptor = serviceProvider.GetRequiredService<SessionContextInterceptor>();
    
    options.UseNpgsql(connectionString)
           .AddInterceptors(interceptor);
});

// Configure JWT Authentication
var jwtSecret = builder.Configuration["JwtSettings:Secret"] ?? "SuperSecretKeyLongerThan32BytesForAronErpPmSystemSecurityEncryption";
var key = Encoding.ASCII.GetBytes(jwtSecret);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };
});

// Register Custom Services for DI
builder.Services.AddScoped<IEmailService, EmailService>();
builder.Services.AddScoped<ISharepointService, SharepointService>();

// Enable CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
app.UseCors("AllowAll");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Auto-migration (Simulated during local runs)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AronDbContext>();
    db.Database.EnsureCreated(); // Tự động tạo bảng nếu chưa tồn tại trên Postgres
    
    // Tự động nâng cấp cấu trúc bảng nếu đã tồn tại trước đó
    var migrations = new List<(string sql, string description)>
    {
        ("ALTER TABLE users ADD COLUMN IF NOT EXISTS expirydate TIMESTAMP WITH TIME ZONE;", "Add expirydate to users"),
        ("ALTER TABLE projects ADD COLUMN IF NOT EXISTS sharepointfolderlink TEXT;", "Add sharepointfolderlink to projects"),
        ("ALTER TABLE projects ADD COLUMN IF NOT EXISTS projectscope TEXT;", "Add projectscope to projects"),
        ("ALTER TABLE projects ADD COLUMN IF NOT EXISTS implementationweeks INT;", "Add implementationweeks to projects"),
        ("ALTER TABLE projects ADD COLUMN IF NOT EXISTS kickoffdate TIMESTAMP WITH TIME ZONE;", "Add kickoffdate to projects"),
        ("ALTER TABLE projects ADD COLUMN IF NOT EXISTS targetgolivedate TIMESTAMP WITH TIME ZONE;", "Add targetgolivedate to projects"),
        ("ALTER TABLE projects ADD COLUMN IF NOT EXISTS currentphase VARCHAR(100);", "Add currentphase to projects"),
        ("ALTER TABLE projects ADD COLUMN IF NOT EXISTS modulesscope TEXT;", "Add modulesscope to projects"),
        ("ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS smtp_sender_email VARCHAR(250);", "Add smtp_sender_email to system_settings"),
        ("ALTER TABLE system_settings ALTER COLUMN logo_url TYPE TEXT;", "Alter logo_url in system_settings"),
        ("ALTER TABLE system_settings ALTER COLUMN banner_url TYPE TEXT;", "Alter banner_url in system_settings"),
        ("ALTER TABLE projects ALTER COLUMN logopath TYPE TEXT;", "Alter logopath in projects"),
        ("ALTER TABLE users ALTER COLUMN avatarpath TYPE TEXT;", "Alter avatarpath in users"),
        ("UPDATE projects SET implementationweeks = 24 WHERE implementationweeks IS NULL;", "Update NULL implementationweeks to 24"),
        ("ALTER TABLE roles ADD COLUMN IF NOT EXISTS description TEXT;", "Add description to roles"),
        ("ALTER TABLE roles ADD COLUMN IF NOT EXISTS isactive BOOLEAN DEFAULT TRUE;", "Add isactive to roles"),
        ("ALTER TABLE roles ADD COLUMN IF NOT EXISTS permissionsjson TEXT;", "Add permissionsjson to roles"),
        ("ALTER TABLE users ADD COLUMN IF NOT EXISTS globalroleid INT;", "Add globalroleid to users"),
        ("CREATE TABLE IF NOT EXISTS project_scope_options (optionid SERIAL PRIMARY KEY, value VARCHAR(100) NOT NULL, description VARCHAR(250) NOT NULL, isactive BOOLEAN DEFAULT TRUE, createddate TIMESTAMP WITH TIME ZONE DEFAULT NOW());", "Create project_scope_options table"),
        (@"
            INSERT INTO roles (rolecode, rolename, description, isactive, permissionsjson, hierarchylevel)
            SELECT 'SYSTEM_ADMIN', 'Hệ thống Admin', 'Quản trị viên toàn quyền hệ thống', true, '{""Projects"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":true},""RICEFW"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":true},""Gantt"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":true},""Team"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":true},""Approvals"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":true},""Costs"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":true},""Users"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":true},""Settings"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":true},""MasterData"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":true}}', 1
            WHERE NOT EXISTS (SELECT 1 FROM roles WHERE rolecode = 'SYSTEM_ADMIN');
        ", "Seed SYSTEM_ADMIN role"),
        (@"
            INSERT INTO roles (rolecode, rolename, description, isactive, permissionsjson, hierarchylevel)
            SELECT 'PM', 'Project Manager', 'Quản trị dự án cấp cao', true, '{""Projects"":{""View"":true,""Create"":false,""Edit"":true,""Delete"":false},""RICEFW"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":true},""Gantt"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":true},""Team"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":true},""Approvals"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":true},""Costs"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":true},""Users"":{""View"":true,""Create"":false,""Edit"":false,""Delete"":false},""Settings"":{""View"":false,""Create"":false,""Edit"":false,""Delete"":false},""MasterData"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":false}}', 2
            WHERE NOT EXISTS (SELECT 1 FROM roles WHERE rolecode = 'PM');
        ", "Seed PM role"),
        (@"
            INSERT INTO roles (rolecode, rolename, description, isactive, permissionsjson, hierarchylevel)
            SELECT 'PC', 'Project Coordinator', 'Điều phối viên dự án', true, '{""Projects"":{""View"":true,""Create"":false,""Edit"":true,""Delete"":false},""RICEFW"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":false},""Gantt"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":false},""Team"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":false},""Approvals"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":false},""Costs"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":false},""Users"":{""View"":false,""Create"":false,""Edit"":false,""Delete"":false},""Settings"":{""View"":false,""Create"":false,""Edit"":false,""Delete"":false},""MasterData"":{""View"":false,""Create"":false,""Edit"":false,""Delete"":false}}', 3
            WHERE NOT EXISTS (SELECT 1 FROM roles WHERE rolecode = 'PC');
        ", "Seed PC role"),
        (@"
            INSERT INTO roles (rolecode, rolename, description, isactive, permissionsjson, hierarchylevel)
            SELECT 'LEADER', 'Team Lead', 'Trưởng nhóm phân hệ', true, '{""Projects"":{""View"":true,""Create"":false,""Edit"":false,""Delete"":false},""RICEFW"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":false},""Gantt"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":false},""Team"":{""View"":true,""Create"":false,""Edit"":false,""Delete"":false},""Approvals"":{""View"":true,""Create"":true,""Edit"":false,""Delete"":false},""Costs"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":false},""Users"":{""View"":false,""Create"":false,""Edit"":false,""Delete"":false},""Settings"":{""View"":false,""Create"":false,""Edit"":false,""Delete"":false},""MasterData"":{""View"":false,""Create"":false,""Edit"":false,""Delete"":false}}', 4
            WHERE NOT EXISTS (SELECT 1 FROM roles WHERE rolecode = 'LEADER');
        ", "Seed LEADER role"),
        (@"
            INSERT INTO roles (rolecode, rolename, description, isactive, permissionsjson, hierarchylevel)
            SELECT 'MEMBER', 'Team Member', 'Thành viên triển khai', true, '{""Projects"":{""View"":true,""Create"":false,""Edit"":false,""Delete"":false},""RICEFW"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":false},""Gantt"":{""View"":true,""Create"":false,""Edit"":false,""Delete"":false},""Team"":{""View"":true,""Create"":false,""Edit"":false,""Delete"":false},""Approvals"":{""View"":true,""Create"":true,""Edit"":false,""Delete"":false},""Costs"":{""View"":true,""Create"":true,""Edit"":true,""Delete"":false},""Users"":{""View"":false,""Create"":false,""Edit"":false,""Delete"":false},""Settings"":{""View"":false,""Create"":false,""Edit"":false,""Delete"":false},""MasterData"":{""View"":false,""Create"":false,""Edit"":false,""Delete"":false}}', 5
            WHERE NOT EXISTS (SELECT 1 FROM roles WHERE rolecode = 'MEMBER');
        ", "Seed MEMBER role"),
        (@"
            INSERT INTO project_scope_options (value, description, isactive)
            SELECT 'EBS_FIN', 'Oracle EBS Financials (GL, AP, AR, FA, CM)', true
            WHERE NOT EXISTS (SELECT 1 FROM project_scope_options WHERE value = 'EBS_FIN');
        ", "Seed EBS_FIN scope"),
        (@"
            INSERT INTO project_scope_options (value, description, isactive)
            SELECT 'EBS_SCM', 'Oracle EBS Supply Chain (PO, INV, OM)', true
            WHERE NOT EXISTS (SELECT 1 FROM project_scope_options WHERE value = 'EBS_SCM');
        ", "Seed EBS_SCM scope"),
        (@"
            INSERT INTO project_scope_options (value, description, isactive)
            SELECT 'CLOUD_FIN', 'Oracle ERP Cloud Financials', true
            WHERE NOT EXISTS (SELECT 1 FROM project_scope_options WHERE value = 'CLOUD_FIN');
        ", "Seed CLOUD_FIN scope"),
        (@"
            INSERT INTO project_scope_options (value, description, isactive)
            SELECT 'CLOUD_SCM', 'Oracle ERP Cloud Supply Chain', true
            WHERE NOT EXISTS (SELECT 1 FROM project_scope_options WHERE value = 'CLOUD_SCM');
        ", "Seed CLOUD_SCM scope"),
        (@"
            UPDATE users 
            SET globalroleid = (SELECT roleid FROM roles WHERE rolecode = 'SYSTEM_ADMIN' LIMIT 1) 
            WHERE (username = 'admin' OR username = 'sysadmin') AND globalroleid IS NULL;
        ", "Assign default SYSTEM_ADMIN globalrole to admin users"),
        ("ALTER TABLE projects ADD COLUMN IF NOT EXISTS sharepointfolderid TEXT;", "Add sharepointfolderid to projects"),
        ("ALTER TABLE projects ADD COLUMN IF NOT EXISTS baselinebudget DECIMAL(18,2) DEFAULT 0.00;", "Add baselinebudget to projects"),
        ("ALTER TABLE projects ADD COLUMN IF NOT EXISTS actualcost DECIMAL(18,2) DEFAULT 0.00;", "Add actualcost to projects"),
        ("ALTER TABLE teams ADD COLUMN IF NOT EXISTS teamtype VARCHAR(50) DEFAULT 'ARON';", "Add teamtype to teams"),
        ("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS aimcode VARCHAR(50);", "Add aimcode to tasks"),
        ("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS visibilityscope VARCHAR(30) DEFAULT 'PUBLIC';", "Add visibilityscope to tasks"),
        ("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS taskid INT;", "Add taskid to expenses"),
        ("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS siteid INT;", "Add siteid to expenses")
    };

    foreach (var migration in migrations)
    {
        try
        {
            db.Database.ExecuteSqlRaw(migration.sql);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error running migration '{migration.description}': {ex.Message}");
        }
    }
    
    // Tự động seed tài khoản sysadmin và các vai trò mặc định nếu chưa có
    try
    {
        // 1. Seed Roles
        var existingRoles = db.Roles.ToList();
        var defaultRoles = new List<AronErpPm.Api.Models.Role>
        {
            new AronErpPm.Api.Models.Role { RoleCode = "SYSTEM_ADMIN", RoleName = "System Admin", HierarchyLevel = 1 },
            new AronErpPm.Api.Models.Role { RoleCode = "DIRECTOR", RoleName = "Project Director", HierarchyLevel = 2 },
            new AronErpPm.Api.Models.Role { RoleCode = "PM", RoleName = "Project Manager (PM)", HierarchyLevel = 3 },
            new AronErpPm.Api.Models.Role { RoleCode = "PC", RoleName = "Project Coordinator", HierarchyLevel = 4 },
            new AronErpPm.Api.Models.Role { RoleCode = "LEADER", RoleName = "Module Lead", HierarchyLevel = 5 },
            new AronErpPm.Api.Models.Role { RoleCode = "MEMBER", RoleName = "Consultant / Member", HierarchyLevel = 6 }
        };

        foreach (var defRole in defaultRoles)
        {
            if (!existingRoles.Any(r => r.RoleCode.ToUpper() == defRole.RoleCode.ToUpper()))
            {
                db.Roles.Add(defRole);
            }
        }
        db.SaveChanges();

        // 2. Seed sysadmin
        var sysadminExists = db.Users.Any(u => u.Username.ToLower() == "sysadmin");
        if (!sysadminExists)
        {
            string hash;
            using (var sha256 = System.Security.Cryptography.SHA256.Create())
            {
                var hashedBytes = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes("password123"));
                hash = BitConverter.ToString(hashedBytes).Replace("-", "").ToLower();
            }

            var sysadmin = new AronErpPm.Api.Models.User
            {
                Username = "sysadmin",
                PasswordHash = hash,
                FullName = "System Administrator",
                Email = "sysadmin@aron.vn",
                IsActive = true,
                CreatedDate = DateTime.UtcNow
            };
            db.Users.Add(sysadmin);
            db.SaveChanges();
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error seeding roles/sysadmin: {ex.Message}");
    }
}

app.Run();
