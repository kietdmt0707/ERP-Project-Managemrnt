using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AronErpPm.Api.Data;
using AronErpPm.Api.Models;

namespace AronErpPm.Api.Controllers
{
    [ApiController]
    [Route("api/masterdata")]
    [Authorize]
    public class MasterDataController : ControllerBase
    {
        private readonly AronDbContext _context;

        public MasterDataController(AronDbContext context)
        {
            _context = context;
        }

        // ==================== 1. PROJECT SCOPES MASTER DATA ====================

        // GET: api/masterdata/scopes
        [HttpGet("scopes")]
        [AllowAnonymous] // Cho phép tất cả người dùng xem cấu hình phạm vi
        public async Task<IActionResult> GetScopes()
        {
            var scopes = await _context.ProjectScopeOptions
                .OrderBy(s => s.Value)
                .ToListAsync();
            return Ok(scopes);
        }

        // POST: api/masterdata/scopes
        [HttpPost("scopes")]
        public async Task<IActionResult> CreateScope([FromBody] ProjectScopeOption request)
        {
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == "GlobalRole")?.Value;
            if (globalRoleClaim != "SYSTEM_ADMIN" && globalRoleClaim != "PM")
            {
                return Forbid("Chỉ Admin hệ thống hoặc PM mới có quyền tạo danh mục phạm vi.");
            }

            if (string.IsNullOrEmpty(request.Value) || string.IsNullOrEmpty(request.Description))
            {
                return BadRequest("Mã giá trị (Value) và mô tả (Description) không được bỏ trống.");
            }

            var exists = await _context.ProjectScopeOptions.AnyAsync(s => s.Value.ToUpper() == request.Value.ToUpper());
            if (exists) return BadRequest("Mã giá trị phạm vi này đã tồn tại.");

            var newScope = new ProjectScopeOption
            {
                Value = request.Value.ToUpper(),
                Description = request.Description,
                IsActive = request.IsActive,
                CreatedDate = DateTime.UtcNow
            };

            _context.ProjectScopeOptions.Add(newScope);
            await _context.SaveChangesAsync();
            return Ok(newScope);
        }

        // PUT: api/masterdata/scopes/{id}
        [HttpPut("scopes/{id}")]
        public async Task<IActionResult> UpdateScope(int id, [FromBody] ProjectScopeOption request)
        {
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == "GlobalRole")?.Value;
            if (globalRoleClaim != "SYSTEM_ADMIN" && globalRoleClaim != "PM")
            {
                return Forbid("Chỉ Admin hệ thống hoặc PM mới có quyền chỉnh sửa danh mục phạm vi.");
            }

            var scope = await _context.ProjectScopeOptions.FindAsync(id);
            if (scope == null) return NotFound("Không tìm thấy danh mục phạm vi.");

            scope.Description = request.Description;
            scope.IsActive = request.IsActive;

            await _context.SaveChangesAsync();
            return Ok(scope);
        }

        // ==================== 2. SYSTEM ROLES & PERMISSIONS MATRIX ====================

        // GET: api/masterdata/roles
        [HttpGet("roles")]
        public async Task<IActionResult> GetRoles()
        {
            var roles = await _context.Roles
                .OrderBy(r => r.HierarchyLevel)
                .ToListAsync();
            return Ok(roles);
        }

        // PUT: api/masterdata/roles/{id}
        [HttpPut("roles/{id}")]
        public async Task<IActionResult> UpdateRole(int id, [FromBody] Role request)
        {
            var globalRoleClaim = User.Claims.FirstOrDefault(c => c.Type == "GlobalRole")?.Value;
            if (globalRoleClaim != "SYSTEM_ADMIN")
            {
                return Forbid("Chỉ Admin hệ thống mới có quyền chỉnh sửa phân quyền vai trò.");
            }

            var role = await _context.Roles.FindAsync(id);
            if (role == null) return NotFound("Không tìm thấy vai trò hệ thống.");

            role.RoleName = request.RoleName;
            role.Description = request.Description;
            role.IsActive = request.IsActive;
            role.PermissionsJson = request.PermissionsJson;

            await _context.SaveChangesAsync();
            return Ok(role);
        }
    }
}
