using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using AronErpPm.Api.Data;
using AronErpPm.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

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
        ("ALTER TABLE system_settings ALTER COLUMN logo_url TYPE TEXT;", "Alter logo_url in system_settings"),
        ("ALTER TABLE system_settings ALTER COLUMN banner_url TYPE TEXT;", "Alter banner_url in system_settings"),
        ("ALTER TABLE projects ALTER COLUMN logopath TYPE TEXT;", "Alter logopath in projects"),
        ("ALTER TABLE users ALTER COLUMN avatarpath TYPE TEXT;", "Alter avatarpath in users")
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
