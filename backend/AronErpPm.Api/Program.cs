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

// Register Custom Db Connection Interceptor for Row-Level Security (Singleton to allow safe DI resolution in DbContext options)
builder.Services.AddSingleton<SessionContextInterceptor>();

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
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline - Enable CORS first before any routing or auth middleware
app.UseCors("AllowAll");
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers().RequireCors("AllowAll");

// Auto-migration & Database Initialization (Safe Startup)
try
{
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<AronDbContext>();
        try
        {
            db.Database.EnsureCreated();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Database EnsureCreated note: {ex.Message}");
        }
    
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
        ("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS siteid INT;", "Add siteid to expenses"),
        (@"
            CREATE TABLE IF NOT EXISTS business_trip_members (
                business_trip_member_id SERIAL PRIMARY KEY,
                business_trip_id INT NOT NULL,
                member_id INT NOT NULL,
                is_group_leader BOOLEAN DEFAULT FALSE
            );
        ", "Create business_trip_members table if not exists"),
        ("ALTER TABLE business_trip_members ADD COLUMN IF NOT EXISTS isgroupleader BOOLEAN DEFAULT FALSE;", "Add isgroupleader to business_trip_members"),
        ("ALTER TABLE users ADD COLUMN IF NOT EXISTS annualleavedays INT DEFAULT 12;", "Add annualleavedays to users"),
        ("ALTER TABLE users ADD COLUMN IF NOT EXISTS carryoverdays INT DEFAULT 0;", "Add carryoverdays to users"),
        ("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS isoverlimit BOOLEAN DEFAULT FALSE;", "Add isoverlimit to expenses"),
        ("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS justification TEXT;", "Add justification to expenses"),
        ("ALTER TABLE expenses ADD COLUMN IF NOT EXISTS overlimitamount DECIMAL(18,2) DEFAULT 0.00;", "Add overlimitamount to expenses"),
        ("ALTER TABLE travel_expense_policies ADD COLUMN IF NOT EXISTS project_id INT;", "Add project_id to travel_expense_policies"),
        ("ALTER TABLE travel_expense_policies ADD COLUMN IF NOT EXISTS transport_allowance DECIMAL(12,2) DEFAULT 0.00;", "Add transport_allowance to travel_expense_policies"),
        ("ALTER TABLE travel_expense_policies ADD COLUMN IF NOT EXISTS pocket_allowance DECIMAL(12,2) DEFAULT 0.00;", "Add pocket_allowance to travel_expense_policies"),
        ("ALTER TABLE travel_expense_policies ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'VND';", "Add currency to travel_expense_policies"),
        ("ALTER TABLE travel_expense_policies ADD COLUMN IF NOT EXISTS flight_ticket_class VARCHAR(50);", "Add flight_ticket_class to travel_expense_policies"),
        ("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_manual_progress BOOLEAN DEFAULT FALSE;", "Add is_manual_progress to tasks"),
        ("ALTER TABLE projects ADD COLUMN IF NOT EXISTS workdaysofweek VARCHAR(100) DEFAULT 'MON,TUE,WED,THU,FRI';", "Add workdaysofweek to projects"),
        ("ALTER TABLE projects ADD COLUMN IF NOT EXISTS standardhoursperday INT DEFAULT 8;", "Add standardhoursperday to projects"),
        ("ALTER TABLE projects ADD COLUMN IF NOT EXISTS holidaysjson TEXT DEFAULT '[]';", "Add holidaysjson to projects"),
        ("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS module VARCHAR(50);", "Add module to tasks"),
        ("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS keyuser VARCHAR(100);", "Add keyuser to tasks"),
        ("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS party VARCHAR(50);", "Add party to tasks"),
        (@"
            CREATE TABLE IF NOT EXISTS sub_tasks (
                sub_task_id SERIAL PRIMARY KEY,
                project_id INT NOT NULL,
                activity_id INT NOT NULL,
                created_by_user_id INT NOT NULL,
                category VARCHAR(50),
                module VARCHAR(50),
                doc_code VARCHAR(50),
                task_name VARCHAR(250) NOT NULL,
                description TEXT,
                assignee_member_id INT,
                reviewer_member_id INT,
                key_user VARCHAR(100),
                party VARCHAR(50),
                start_date TIMESTAMP,
                end_date TIMESTAMP,
                deadline TIMESTAMP,
                status VARCHAR(50) DEFAULT '1. Mới tạo',
                progress_percent DECIMAL(5,2) DEFAULT 0.00,
                weight INT DEFAULT 1,
                attachment_url VARCHAR(500),
                created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_date TIMESTAMP
            );
        ", "Create sub_tasks table"),
        (@"
            CREATE TABLE IF NOT EXISTS travel_regions (
                region_id SERIAL PRIMARY KEY,
                region_code VARCHAR(20) UNIQUE NOT NULL,
                region_name VARCHAR(100) NOT NULL,
                provinces_included TEXT NOT NULL
            );
        ", "Create travel_regions table"),
        (@"
            CREATE TABLE IF NOT EXISTS travel_expense_policies (
                policy_id SERIAL PRIMARY KEY,
                project_id INT,
                region_code VARCHAR(20) NOT NULL,
                role_code VARCHAR(20) NOT NULL,
                per_diem_allowance DECIMAL(12,2) NOT NULL,
                max_hotel_rate DECIMAL(12,2) NOT NULL,
                transport_allowance DECIMAL(12,2) DEFAULT 0.00,
                pocket_allowance DECIMAL(12,2) DEFAULT 0.00,
                currency VARCHAR(10) DEFAULT 'VND',
                flight_ticket_class VARCHAR(50),
                is_active BOOLEAN DEFAULT TRUE,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ", "Create travel_expense_policies table"),
        (@"
            CREATE TABLE IF NOT EXISTS oracle_instances (
                instance_id SERIAL PRIMARY KEY,
                project_id INT NOT NULL,
                instance_name VARCHAR(50) NOT NULL,
                oracle_version VARCHAR(50) NOT NULL,
                instance_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
                last_refresh_date TIMESTAMP,
                description VARCHAR(500),
                updated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ", "Create oracle_instances table")
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

        // 3. Seed Travel Regions
        if (!db.TravelRegions.Any())
        {
            db.TravelRegions.AddRange(new List<AronErpPm.Api.Models.TravelRegion>
            {
                new AronErpPm.Api.Models.TravelRegion { RegionCode = "TIERS_1", RegionName = "Vùng 1 (Hà Nội, HCM)", ProvincesIncluded = "Hà Nội, Hồ Chí Minh" },
                new AronErpPm.Api.Models.TravelRegion { RegionCode = "TIERS_2", RegionName = "Vùng 2 (Cần Thơ, Đà Nẵng, Hải Phòng)", ProvincesIncluded = "Cần Thơ, Đà Nẵng, Hải Phòng" },
                new AronErpPm.Api.Models.TravelRegion { RegionCode = "TIERS_3", RegionName = "Vùng 3 (Các tỉnh thành còn lại)", ProvincesIncluded = "Bình Dương, Đồng Nai, Long An, Bà Rịa - Vũng Tàu, Tây Ninh, Hải Dương, Hưng Yên, Bắc Ninh, Vĩnh Phúc" },
                new AronErpPm.Api.Models.TravelRegion { RegionCode = "TIERS_INT_1", RegionName = "Vùng 4 Quốc Tế (Đông Nam Á - Singapore, Thái Lan, Malaysia...)", ProvincesIncluded = "Singapore, Thailand, Malaysia, Indonesia, Philippines, Cambodia, Laos" },
                new AronErpPm.Api.Models.TravelRegion { RegionCode = "TIERS_INT_2", RegionName = "Vùng 5 Quốc Tế (Âu, Mỹ, Nhật, Hàn, Úc...)", ProvincesIncluded = "USA, Japan, Korea, Germany, UK, France, Australia" }
            });
            db.SaveChanges();
        }

        // 4. Seed Travel Expense Policies
        if (!db.TravelExpensePolicies.Any())
        {
            db.TravelExpensePolicies.AddRange(new List<AronErpPm.Api.Models.TravelExpensePolicy>
            {
                // Vùng 1
                new AronErpPm.Api.Models.TravelExpensePolicy { RegionCode = "TIERS_1", RoleCode = "MEMBER", PerDiemAllowance = 250000m, MaxHotelRate = 400000m, Currency = "VND" },
                new AronErpPm.Api.Models.TravelExpensePolicy { RegionCode = "TIERS_1", RoleCode = "LEADER", PerDiemAllowance = 250000m, MaxHotelRate = 500000m, Currency = "VND" },
                new AronErpPm.Api.Models.TravelExpensePolicy { RegionCode = "TIERS_1", RoleCode = "PM", PerDiemAllowance = 300000m, MaxHotelRate = 700000m, Currency = "VND" },
                // Vùng 2
                new AronErpPm.Api.Models.TravelExpensePolicy { RegionCode = "TIERS_2", RoleCode = "MEMBER", PerDiemAllowance = 180000m, MaxHotelRate = 350000m, Currency = "VND" },
                new AronErpPm.Api.Models.TravelExpensePolicy { RegionCode = "TIERS_2", RoleCode = "LEADER", PerDiemAllowance = 180000m, MaxHotelRate = 450000m, Currency = "VND" },
                new AronErpPm.Api.Models.TravelExpensePolicy { RegionCode = "TIERS_2", RoleCode = "PM", PerDiemAllowance = 220000m, MaxHotelRate = 600000m, Currency = "VND" },
                // Vùng 3
                new AronErpPm.Api.Models.TravelExpensePolicy { RegionCode = "TIERS_3", RoleCode = "MEMBER", PerDiemAllowance = 120000m, MaxHotelRate = 250000m, Currency = "VND" },
                new AronErpPm.Api.Models.TravelExpensePolicy { RegionCode = "TIERS_3", RoleCode = "LEADER", PerDiemAllowance = 120000m, MaxHotelRate = 350000m, Currency = "VND" },
                new AronErpPm.Api.Models.TravelExpensePolicy { RegionCode = "TIERS_3", RoleCode = "PM", PerDiemAllowance = 150000m, MaxHotelRate = 500000m, Currency = "VND" },
                // Vùng 4 Quốc Tế (Đông Nam Á - USD)
                new AronErpPm.Api.Models.TravelExpensePolicy { RegionCode = "TIERS_INT_1", RoleCode = "MEMBER", PerDiemAllowance = 45m, MaxHotelRate = 90m, Currency = "USD" },
                new AronErpPm.Api.Models.TravelExpensePolicy { RegionCode = "TIERS_INT_1", RoleCode = "LEADER", PerDiemAllowance = 55m, MaxHotelRate = 120m, Currency = "USD" },
                new AronErpPm.Api.Models.TravelExpensePolicy { RegionCode = "TIERS_INT_1", RoleCode = "PM", PerDiemAllowance = 70m, MaxHotelRate = 160m, Currency = "USD" },
                // Vùng 5 Quốc Tế (Âu / Mỹ / Nhật - USD)
                new AronErpPm.Api.Models.TravelExpensePolicy { RegionCode = "TIERS_INT_2", RoleCode = "MEMBER", PerDiemAllowance = 75m, MaxHotelRate = 150m, Currency = "USD" },
                new AronErpPm.Api.Models.TravelExpensePolicy { RegionCode = "TIERS_INT_2", RoleCode = "LEADER", PerDiemAllowance = 90m, MaxHotelRate = 200m, Currency = "USD" },
                new AronErpPm.Api.Models.TravelExpensePolicy { RegionCode = "TIERS_INT_2", RoleCode = "PM", PerDiemAllowance = 120m, MaxHotelRate = 280m, Currency = "USD" }
            });
            db.SaveChanges();
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error seeding roles/sysadmin: {ex.Message}");
    }
}
}
catch (Exception ex)
{
    Console.WriteLine($"Global startup migration error: {ex.Message}");
}

app.Run();
