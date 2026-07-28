using System;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using AronErpPm.Api.Data;

var optionsBuilder = new DbContextOptionsBuilder<AronDbContext>();
// get connection string from appsettings.json or use hardcoded
var connectionString = "Host=localhost;Database=aron_pm;Username=postgres;Password=postgres";
optionsBuilder.UseNpgsql(connectionString);

using var context = new AronDbContext(optionsBuilder.Options);

var user = context.Users.FirstOrDefault(u => u.Username == "anhntt");
if (user == null) {
    Console.WriteLine("User anhntt not found.");
} else {
    Console.WriteLine($"User: {user.Username}, ID: {user.UserId}");
    var members = context.ProjectMembers
        .Include(m => m.Project)
        .Include(m => m.Role)
        .Where(m => m.UserId == user.UserId)
        .ToList();
        
    if (!members.Any()) {
        Console.WriteLine("User is not assigned to any project in ProjectMembers.");
    } else {
        foreach (var m in members) {
            Console.WriteLine($"Project: {m.Project?.ProjectName} (ID: {m.ProjectId}), Role: {m.Role?.RoleCode}, IsActive: {m.IsActive}");
        }
    }
}
