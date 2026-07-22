using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AronErpPm.Api.Data;
using AronErpPm.Api.Models;

namespace AronErpPm.Api.Controllers
{
    [ApiController]
    [Route("api/oracleinstance")]
    [Authorize]
    public class OracleInstanceController : ControllerBase
    {
        private readonly AronDbContext _context;

        public OracleInstanceController(AronDbContext context)
        {
            _context = context;
        }

        // GET: api/oracleinstance?projectId=1
        [HttpGet]
        public async Task<IActionResult> GetInstances([FromQuery] int projectId)
        {
            var instances = await _context.OracleInstances
                .Where(i => i.ProjectId == projectId)
                .OrderBy(i => i.InstanceId)
                .ToListAsync();

            // Auto-seed default environment instances for new projects if none exist
            if (!instances.Any())
            {
                var defaults = new[]
                {
                    new OracleInstance
                    {
                        ProjectId = projectId,
                        InstanceName = "Môi trường DEV1",
                        OracleVersion = "Fusion Cloud 24C",
                        InstanceStatus = "ACTIVE",
                        Description = "Môi trường cấu hình & test nội bộ của ARON Tech Team",
                        UpdatedDate = DateTime.UtcNow
                    },
                    new OracleInstance
                    {
                        ProjectId = projectId,
                        InstanceName = "Môi trường TEST1",
                        OracleVersion = "Fusion Cloud 24C",
                        InstanceStatus = "ACTIVE",
                        Description = "Môi trường phục vụ các đợt kiểm thử tích hợp CRP & SIT",
                        UpdatedDate = DateTime.UtcNow
                    },
                    new OracleInstance
                    {
                        ProjectId = projectId,
                        InstanceName = "Môi trường UAT",
                        OracleVersion = "Fusion Cloud 24C",
                        InstanceStatus = "NOT_INITIALIZED",
                        Description = "Dành cho khách hàng kiểm thử chấp nhận (UAT) sau khi hoàn thành SIT",
                        UpdatedDate = DateTime.UtcNow
                    }
                };

                _context.OracleInstances.AddRange(defaults);
                await _context.SaveChangesAsync();
                instances = defaults.ToList();
            }

            return Ok(instances);
        }

        // POST: api/oracleinstance
        [HttpPost]
        public async Task<IActionResult> CreateInstance([FromBody] OracleInstance request)
        {
            if (request.ProjectId <= 0) return BadRequest("ProjectId không hợp lệ.");

            var instance = new OracleInstance
            {
                ProjectId = request.ProjectId,
                InstanceName = request.InstanceName,
                OracleVersion = request.OracleVersion,
                InstanceStatus = request.InstanceStatus ?? "ACTIVE",
                Description = request.Description,
                UpdatedDate = DateTime.UtcNow
            };

            _context.OracleInstances.Add(instance);
            await _context.SaveChangesAsync();

            return Ok(instance);
        }

        // PUT: api/oracleinstance/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateInstance(int id, [FromBody] OracleInstance request)
        {
            var instance = await _context.OracleInstances.FindAsync(id);
            if (instance == null) return NotFound("Không tìm thấy môi trường Oracle.");

            instance.InstanceName = request.InstanceName;
            instance.OracleVersion = request.OracleVersion;
            instance.InstanceStatus = request.InstanceStatus;
            instance.Description = request.Description;
            instance.UpdatedDate = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(instance);
        }

        // DELETE: api/oracleinstance/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteInstance(int id)
        {
            var instance = await _context.OracleInstances.FindAsync(id);
            if (instance == null) return NotFound("Không tìm thấy môi trường Oracle.");

            _context.OracleInstances.Remove(instance);
            await _context.SaveChangesAsync();

            return Ok(new { message = "Đã xóa môi trường thành công." });
        }
    }
}
