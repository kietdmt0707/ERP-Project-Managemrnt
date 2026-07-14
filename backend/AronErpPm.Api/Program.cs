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
            var username = userInfo[0];
            var password = userInfo.Length > 1 ? userInfo[1] : "";
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
    // db.Database.EnsureCreated(); // Auto scaffold locally if running on a real Postgres instance
}

app.Run();
