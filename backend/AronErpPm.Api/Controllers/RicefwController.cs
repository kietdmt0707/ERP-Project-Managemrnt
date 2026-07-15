using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AronErpPm.Api.Data;
using AronErpPm.Api.DTOs;
using AronErpPm.Api.Models;
using AronErpPm.Api.Services;

namespace AronErpPm.Api.Controllers
{
    [Authorize]
    [ApiController]
    [Route("api/[controller]")]
    public class RicefwController : ControllerBase
    {
        private readonly AronDbContext _context;
        private readonly ISharepointService _sharepointService;

        public RicefwController(AronDbContext context, ISharepointService sharepointService)
        {
            _context = context;
            _sharepointService = sharepointService;
        }

        [HttpGet("project/{projectId}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetProjectRicefws(int projectId)
        {
            try
            {
                var list = await _context.RicefwRegistries
                    .Include(r => r.ResponsibleMember).ThenInclude(m => m!.User)
                    .Where(r => r.ProjectId == projectId)
                    .Select(r => new RicefwRegistryDto
                    {
                        RicefwId = r.RicefwId,
                        ProjectId = r.ProjectId,
                        RicefwCode = r.RicefwCode,
                        RicefwName = r.RicefwName,
                        ModuleCode = r.ModuleCode,
                        ObjectType = r.ObjectType,
                        Complexity = r.Complexity,
                        FunctionalSpecStatus = r.FunctionalSpecStatus,
                        TechnicalSpecStatus = r.TechnicalSpecStatus,
                        CodingStatus = r.CodingStatus,
                        UnitTestingStatus = r.UnitTestingStatus,
                        SitStatus = r.SitStatus,
                        UatStatus = r.UatStatus,
                        ResponsibleMemberId = r.ResponsibleMemberId,
                        ResponsibleMemberName = r.ResponsibleMember != null && r.ResponsibleMember.User != null ? r.ResponsibleMember.User.FullName : null,
                        SharepointFolderLink = r.SharepointFolderLink
                    })
                    .ToListAsync();

                return Ok(list);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { 
                    status = "Error",
                    message = "Lỗi truy vấn RICEFW Database",
                    detail = ex.Message, 
                    inner = ex.InnerException?.Message,
                    stackTrace = ex.StackTrace 
                });
            }
        }

        // Create or Update RICEFW Object
        [HttpPost("save")]
        public async Task<IActionResult> SaveRicefw([FromBody] RicefwRegistryDto dto)
        {
            // Verify roles: Only PM, Tech Lead or Admin can manage RICEFWs
            var username = User.Identity?.Name;
            var userMember = await _context.ProjectMembers
                .Include(pm => pm.Role)
                .FirstOrDefaultAsync(pm => pm.ProjectId == dto.ProjectId && pm.User!.Username == username);

            if (userMember == null || (userMember.Role?.RoleCode != "PM" && userMember.Role?.RoleCode != "LEADER" && username != "admin"))
            {
                return Forbid("Bạn không có quyền quản trị hoặc trưởng nhóm để thay đổi danh mục RICEFW.");
            }

            RicefwRegistry? ricefw;

            if (dto.RicefwId == 0) // New RICEFW
            {
                // Check if code exists
                var codeExists = await _context.RicefwRegistries.AnyAsync(r => r.ProjectId == dto.ProjectId && r.RicefwCode == dto.RicefwCode);
                if (codeExists)
                {
                    return BadRequest($"Mã RICEFW '{dto.RicefwCode}' đã tồn tại trong dự án.");
                }

                ricefw = new RicefwRegistry
                {
                    ProjectId = dto.ProjectId,
                    RicefwCode = dto.RicefwCode,
                    RicefwName = dto.RicefwName,
                    ModuleCode = dto.ModuleCode,
                    ObjectType = dto.ObjectType,
                    Complexity = dto.Complexity,
                    FunctionalSpecStatus = dto.FunctionalSpecStatus,
                    TechnicalSpecStatus = dto.TechnicalSpecStatus,
                    CodingStatus = dto.CodingStatus,
                    UnitTestingStatus = dto.UnitTestingStatus,
                    SitStatus = dto.SitStatus,
                    UatStatus = dto.UatStatus,
                    ResponsibleMemberId = dto.ResponsibleMemberId
                };

                // Automate SharePoint Folder provisioning for this RICEFW
                var sharepointConfig = await _context.SharepointMappings.FirstOrDefaultAsync(m => m.ProjectId == dto.ProjectId);
                if (sharepointConfig != null)
                {
                    // Call MS Graph Service to create folder on SharePoint Site
                    var folderLink = await _sharepointService.CreateRicefwFolderAsync(
                        sharepointConfig.RootFolderId, 
                        dto.RicefwCode, 
                        sharepointConfig.SharepointSiteUrl
                    );
                    ricefw.SharepointFolderLink = folderLink;
                }
                else
                {
                    // Mock Sync if mapping doesn't exist
                    ricefw.SharepointFolderLink = $"https://aron.sharepoint.com/teams/MockProject/SharedDocuments/03.Tech/{dto.RicefwCode}";
                }

                _context.RicefwRegistries.Add(ricefw);
            }
            else // Edit Existing RICEFW
            {
                ricefw = await _context.RicefwRegistries.FindAsync(dto.RicefwId);
                if (ricefw == null) return NotFound("Không tìm thấy RICEFW.");

                ricefw.RicefwName = dto.RicefwName;
                ricefw.ModuleCode = dto.ModuleCode;
                ricefw.ObjectType = dto.ObjectType;
                ricefw.Complexity = dto.Complexity;
                ricefw.FunctionalSpecStatus = dto.FunctionalSpecStatus;
                ricefw.TechnicalSpecStatus = dto.TechnicalSpecStatus;
                ricefw.CodingStatus = dto.CodingStatus;
                ricefw.UnitTestingStatus = dto.UnitTestingStatus;
                ricefw.SitStatus = dto.SitStatus;
                ricefw.UatStatus = dto.UatStatus;
                ricefw.ResponsibleMemberId = dto.ResponsibleMemberId;
                
                ricefw.UpdatedDate = DateTime.UtcNow;
                _context.RicefwRegistries.Update(ricefw);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Lưu đối tượng RICEFW thành công!", ricefwId = ricefw.RicefwId, link = ricefw.SharepointFolderLink });
        }
    }
}
