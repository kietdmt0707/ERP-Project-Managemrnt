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

        // GET: api/travelpolicy
        [HttpGet]
        public async Task<IActionResult> GetPolicies()
        {
            var policies = await _context.TravelExpensePolicies
                .OrderBy(p => p.RegionCode)
                .ThenBy(p => p.RoleCode)
                .ToListAsync();

            return Ok(policies);
        }

        // PUT: api/travelpolicy/{id}
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdatePolicy(int id, [FromBody] TravelExpensePolicy request)
        {
            var policy = await _context.TravelExpensePolicies.FindAsync(id);
            if (policy == null) return NotFound("Không tìm thấy quy định chi phí.");

            policy.PerDiemAllowance = request.PerDiemAllowance;
            policy.MaxHotelRate = request.MaxHotelRate;
            policy.IsActive = request.IsActive;
            policy.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();
            return Ok(policy);
        }

        // POST: api/travelpolicy/clone
        [HttpPost("clone")]
        public async Task<IActionResult> ClonePolicies([FromBody] ClonePolicyRequest request)
        {
            var activePolicies = await _context.TravelExpensePolicies.Where(p => p.IsActive).ToListAsync();
            if (!activePolicies.Any()) return BadRequest("Không có chính sách nào đang hoạt động để nhân bản.");

            var multiplier = 1 + (request.InflationPercentage / 100m);

            // Deactivate old policies first if requested, or just insert new ones with adjusted prices
            foreach (var old in activePolicies)
            {
                var newPolicy = new TravelExpensePolicy
                {
                    RegionCode = old.RegionCode,
                    RoleCode = old.RoleCode,
                    PerDiemAllowance = Math.Round(old.PerDiemAllowance * multiplier, 0),
                    MaxHotelRate = Math.Round(old.MaxHotelRate * multiplier, 0),
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
        public decimal InflationPercentage { get; set; } // Ví dụ: 5.0 đại diện cho 5% tăng thêm
    }
}
