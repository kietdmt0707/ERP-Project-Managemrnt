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
    [Route("api/travelpolicy")]
    [Authorize]
    public class TravelPolicyController : ControllerBase
    {
        private readonly AronDbContext _context;

        public TravelPolicyController(AronDbContext context)
        {
            _context = context;
        }

        // GET: api/travelpolicy?projectId=1
        [HttpGet]
        public async Task<IActionResult> GetPolicies([FromQuery] int? projectId)
        {
            var query = _context.TravelExpensePolicies.AsQueryable();

            if (projectId.HasValue && projectId.Value > 0)
            {
                query = query.Where(p => p.ProjectId == projectId.Value || p.ProjectId == null);
            }
            else
            {
                query = query.Where(p => p.ProjectId == null);
            }

            var policies = await query
                .OrderBy(p => p.ProjectId.HasValue ? 1 : 0)
                .ThenBy(p => p.RegionCode)
                .ThenBy(p => p.RoleCode)
                .ToListAsync();

            return Ok(policies);
        }

        // GET: api/travelpolicy/regions
        [HttpGet("regions")]
        public async Task<IActionResult> GetRegions()
        {
            var regions = await _context.TravelRegions
                .OrderBy(r => r.RegionCode)
                .ToListAsync();
            return Ok(regions);
        }

        // POST: api/travelpolicy/region
        [HttpPost("region")]
        public async Task<IActionResult> SaveRegion([FromBody] TravelRegion request)
        {
            var existing = await _context.TravelRegions
                .FirstOrDefaultAsync(r => r.RegionCode.ToUpper() == request.RegionCode.ToUpper());

            if (existing != null)
            {
                existing.RegionName = request.RegionName;
                existing.ProvincesIncluded = request.ProvincesIncluded;
                _context.TravelRegions.Update(existing);
                await _context.SaveChangesAsync();
                return Ok(existing);
            }

            var newRegion = new TravelRegion
            {
                RegionCode = request.RegionCode.ToUpper(),
                RegionName = request.RegionName,
                ProvincesIncluded = request.ProvincesIncluded
            };

            _context.TravelRegions.Add(newRegion);
            await _context.SaveChangesAsync();
            return Ok(newRegion);
        }

        // POST: api/travelpolicy
        [HttpPost]
        public async Task<IActionResult> CreatePolicy([FromBody] TravelExpensePolicy request)
        {
            var policy = new TravelExpensePolicy
            {
                ProjectId = request.ProjectId > 0 ? request.ProjectId : null,
                RegionCode = request.RegionCode,
                RoleCode = request.RoleCode,
                PerDiemAllowance = request.PerDiemAllowance,
                MaxHotelRate = request.MaxHotelRate,
                TransportAllowance = request.TransportAllowance,
                PocketAllowance = request.PocketAllowance,
                Currency = string.IsNullOrEmpty(request.Currency) ? "VND" : request.Currency.ToUpper(),
                FlightTicketClass = request.FlightTicketClass,
                IsActive = true,
                UpdatedAt = DateTime.UtcNow
            };

            _context.TravelExpensePolicies.Add(policy);
            await _context.SaveChangesAsync();
            return Ok(policy);
        }

        // PUT: api/travelpolicy/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePolicy(int id, [FromBody] TravelExpensePolicy request)
        {
            var policy = await _context.TravelExpensePolicies.FindAsync(id);
            if (policy == null) return NotFound("Không tìm thấy quy định chi phí.");

            policy.PerDiemAllowance = request.PerDiemAllowance;
            policy.MaxHotelRate = request.MaxHotelRate;
            policy.TransportAllowance = request.TransportAllowance;
            policy.PocketAllowance = request.PocketAllowance;
            policy.Currency = string.IsNullOrEmpty(request.Currency) ? policy.Currency : request.Currency.ToUpper();
            policy.FlightTicketClass = request.FlightTicketClass;
            policy.IsActive = request.IsActive;
            policy.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(policy);
        }

        // DELETE: api/travelpolicy/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeletePolicy(int id)
        {
            var policy = await _context.TravelExpensePolicies.FindAsync(id);
            if (policy == null) return NotFound("Không tìm thấy quy định chi phí.");

            _context.TravelExpensePolicies.Remove(policy);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Đã xóa quy định thành công." });
        }

        // POST: api/travelpolicy/clone
        [HttpPost("clone")]
        public async Task<IActionResult> ClonePolicies([FromBody] ClonePolicyRequest request)
        {
            var activePolicies = await _context.TravelExpensePolicies.Where(p => p.IsActive && p.ProjectId == null).ToListAsync();
            if (!activePolicies.Any()) return BadRequest("Không có chính sách mặc định nào để nhân bản.");

            var multiplier = 1 + (request.InflationPercentage / 100m);

            foreach (var old in activePolicies)
            {
                var newPolicy = new TravelExpensePolicy
                {
                    ProjectId = old.ProjectId,
                    RegionCode = old.RegionCode,
                    RoleCode = old.RoleCode,
                    PerDiemAllowance = Math.Round(old.PerDiemAllowance * multiplier, 0),
                    MaxHotelRate = Math.Round(old.MaxHotelRate * multiplier, 0),
                    TransportAllowance = Math.Round(old.TransportAllowance * multiplier, 0),
                    PocketAllowance = Math.Round(old.PocketAllowance * multiplier, 0),
                    Currency = old.Currency,
                    IsActive = true,
                    UpdatedAt = DateTime.UtcNow
                };

                _context.TravelExpensePolicies.Add(newPolicy);
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = $"Đã nhân bản và điều chỉnh {activePolicies.Count} dòng quy định công tác phí thành công với tỷ lệ lạm phát {request.InflationPercentage}%." });
        }
    }

    public class ClonePolicyRequest
    {
        public decimal InflationPercentage { get; set; }
    }
}
