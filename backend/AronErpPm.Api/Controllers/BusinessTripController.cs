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
    [Route("api/businesstrip")]
    [Authorize]
    public class BusinessTripController : ControllerBase
    {
        private readonly AronDbContext _context;

        public BusinessTripController(AronDbContext context)
        {
            _context = context;
        }

        // GET: api/businesstrip?projectId=1
        [HttpGet]
        public async Task<IActionResult> GetTrips([FromQuery] int projectId)
        {
            var username = User.Identity?.Name;
            var globalRole = User.FindFirst("GlobalRole")?.Value ?? User.FindFirst(ClaimTypes.Role)?.Value;
            var isSysAdmin = globalRole == "SYSTEM_ADMIN" || globalRole == "SYSADMIN" || (username != null && (username.ToLower() == "sysadmin" || username.ToLower() == "admin"));

            var member = await _context.ProjectMembers
                .Include(pm => pm.User)
                .FirstOrDefaultAsync(pm => pm.ProjectId == projectId && username != null && pm.User!.Username.ToLower() == username.ToLower());

            if (!isSysAdmin && member == null) return Forbid("Bạn không phải thành viên dự án này.");

            var trips = await _context.BusinessTrips
                .Where(t => t.ProjectId == projectId)
                .Include(t => t.CreatedByMember!.User)
                .Include(t => t.ApprovedByMember!.User)
                .OrderByDescending(t => t.CreatedDate)
                .ToListAsync();

            var tripIds = trips.Select(t => t.TripId).ToList();

            var tripMembers = await _context.BusinessTripMembers
                .Where(m => tripIds.Contains(m.TripId))
                .Include(m => m.ProjectMember!.User)
                .ToListAsync();

            var expenses = await _context.Expenses
                .Where(e => tripIds.Contains(e.TripId))
                .Include(e => e.ClaimantMember!.User)
                .ToListAsync();

            var result = trips.Select(t => new
            {
                t.TripId,
                t.ProjectId,
                t.TripCode,
                t.Title,
                t.Destination,
                t.StartDate,
                t.EndDate,
                t.AdvanceAmount,
                t.Status,
                t.CreatedDate,
                CreatedByName = t.CreatedByMember?.User?.FullName ?? "Unknown",
                ApprovedByName = t.ApprovedByMember?.User?.FullName ?? "",
                Members = tripMembers.Where(m => m.TripId == t.TripId).Select(m => new
                {
                    m.TripMemberId,
                    m.ProjectMemberId,
                    m.IsGroupLeader,
                    FullName = m.ProjectMember?.User?.FullName ?? "Unknown",
                    Email = m.ProjectMember?.User?.Email ?? "",
                    Phone = m.ProjectMember?.User?.Phone ?? ""
                }).ToList(),
                Expenses = expenses.Where(e => e.TripId == t.TripId).Select(e => new
                {
                    e.ExpenseId,
                    e.ExpenseType,
                    e.AmountPlanned,
                    e.AmountActual,
                    e.ReceiptPath,
                    e.Status,
                    e.Notes,
                    ClaimantName = e.ClaimantMember?.User?.FullName ?? "Unknown"
                }).ToList()
            }).ToList();

            return Ok(result);
        }

        // POST: api/businesstrip
        [HttpPost]
        public async Task<IActionResult> CreateTrip([FromBody] BusinessTrip request)
        {
            var username = User.Identity?.Name;
            var globalRole = User.FindFirst("GlobalRole")?.Value ?? User.FindFirst(ClaimTypes.Role)?.Value;
            var isSysAdmin = globalRole == "SYSTEM_ADMIN" || globalRole == "SYSADMIN" || (username != null && (username.ToLower() == "sysadmin" || username.ToLower() == "admin"));

            var member = await _context.ProjectMembers
                .Include(pm => pm.User)
                .FirstOrDefaultAsync(pm => pm.ProjectId == request.ProjectId && username != null && pm.User!.Username.ToLower() == username.ToLower());

            if (!isSysAdmin && member == null) return Forbid("Bạn không phải thành viên dự án này.");

            int creatorMemberId = member?.ProjectMemberId ?? 0;
            if (creatorMemberId == 0)
            {
                var sysadminUser = await _context.Users.FirstOrDefaultAsync(u => username != null && u.Username.ToLower() == username.ToLower());
                if (sysadminUser != null)
                {
                    var pmRole = await _context.Roles.FirstOrDefaultAsync(r => r.RoleCode == "PM") ?? await _context.Roles.FirstOrDefaultAsync();
                    var newMember = new ProjectMember
                    {
                        ProjectId = request.ProjectId,
                        UserId = sysadminUser.UserId,
                        RoleId = pmRole?.RoleId ?? 1,
                        IsActive = true
                    };
                    _context.ProjectMembers.Add(newMember);
                    await _context.SaveChangesAsync();
                    creatorMemberId = newMember.ProjectMemberId;
                }
            }

            var count = await _context.BusinessTrips.CountAsync(t => t.ProjectId == request.ProjectId);
            var project = await _context.Projects.FindAsync(request.ProjectId);
            var projectCode = project?.ProjectCode ?? "PRJ";

            var trip = new BusinessTrip
            {
                ProjectId = request.ProjectId,
                TripCode = $"{projectCode}-TRIP-{count + 1:D3}",
                Title = request.Title,
                Destination = request.Destination,
                StartDate = request.StartDate.ToUniversalTime(),
                EndDate = request.EndDate.ToUniversalTime(),
                AdvanceAmount = request.AdvanceAmount,
                Status = "DRAFT",
                CreatedByMemberId = creatorMemberId,
                CreatedDate = DateTime.UtcNow
            };

            _context.BusinessTrips.Add(trip);
            await _context.SaveChangesAsync();

            return Ok(trip);
        }

        // POST: api/businesstrip/{id}/member
        [HttpPost("{id}/member")]
        public async Task<IActionResult> AddTripMember(int id, [FromBody] TripMemberRequest request)
        {
            var trip = await _context.BusinessTrips.FindAsync(id);
            if (trip == null) return NotFound("Không tìm thấy chuyến công tác.");

            // Check if member already in trip
            var exists = await _context.BusinessTripMembers
                .FirstOrDefaultAsync(m => m.TripId == id && m.ProjectMemberId == request.ProjectMemberId);

            if (exists != null)
            {
                // Update Group Leader status if already in trip
                exists.IsGroupLeader = request.IsGroupLeader;
                _context.BusinessTripMembers.Update(exists);
                await _context.SaveChangesAsync();
                return Ok(exists);
            }

            var tripMember = new BusinessTripMember
            {
                TripId = id,
                ProjectMemberId = request.ProjectMemberId,
                IsGroupLeader = request.IsGroupLeader
            };

            _context.BusinessTripMembers.Add(tripMember);
            await _context.SaveChangesAsync();

            return Ok(tripMember);
        }

        // POST: api/businesstrip/{id}/expense
        [HttpPost("{id}/expense")]
        public async Task<IActionResult> AddTripExpense(int id, [FromBody] Expense request)
        {
            var trip = await _context.BusinessTrips.FindAsync(id);
            if (trip == null) return NotFound("Không tìm thấy chuyến công tác.");

            var username = User.Identity?.Name;
            var globalRole = User.FindFirst("GlobalRole")?.Value ?? User.FindFirst(ClaimTypes.Role)?.Value;
            var isSysAdmin = globalRole == "SYSTEM_ADMIN" || globalRole == "SYSADMIN" || (username != null && (username.ToLower() == "sysadmin" || username.ToLower() == "admin"));

            var member = await _context.ProjectMembers
                .Include(pm => pm.User)
                .FirstOrDefaultAsync(pm => pm.ProjectId == trip.ProjectId && username != null && pm.User!.Username.ToLower() == username.ToLower());

            if (!isSysAdmin && member == null) return Forbid("Bạn không phải thành viên dự án này.");

            int defaultClaimantId = member?.ProjectMemberId ?? 0;
            var claimantMemberId = request.ClaimantMemberId > 0 ? request.ClaimantMemberId : defaultClaimantId;
            if (claimantMemberId == 0)
            {
                var sysadminUser = await _context.Users.FirstOrDefaultAsync(u => username != null && u.Username.ToLower() == username.ToLower());
                if (sysadminUser != null)
                {
                    var pmRole = await _context.Roles.FirstOrDefaultAsync(r => r.RoleCode == "PM") ?? await _context.Roles.FirstOrDefaultAsync();
                    var newMember = new ProjectMember
                    {
                        ProjectId = trip.ProjectId,
                        UserId = sysadminUser.UserId,
                        RoleId = pmRole?.RoleId ?? 1,
                        IsActive = true
                    };
                    _context.ProjectMembers.Add(newMember);
                    await _context.SaveChangesAsync();
                    claimantMemberId = newMember.ProjectMemberId;
                }
            }
            var claimant = await _context.ProjectMembers
                .Include(pm => pm.Role)
                .Include(pm => pm.User)
                .FirstOrDefaultAsync(pm => pm.ProjectMemberId == claimantMemberId);

            if (claimant == null) return BadRequest("Không tìm thấy thành viên thực hiện thanh toán.");

            // Match travel region
            var regions = await _context.TravelRegions.ToListAsync();
            var matchedRegion = regions.FirstOrDefault(r => 
                !string.IsNullOrEmpty(trip.Destination) && 
                r.ProvincesIncluded.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(p => p.Trim().ToLower())
                    .Any(p => trip.Destination.ToLower().Contains(p))
            );

            var regionCode = matchedRegion?.RegionCode ?? "TIERS_3";
            var roleCode = claimant.Role?.RoleCode ?? "MEMBER";

            // Query policy: first check project-specific override policy, then fall back to global default policy
            var policy = await _context.TravelExpensePolicies
                .FirstOrDefaultAsync(p => p.ProjectId == trip.ProjectId && p.RegionCode == regionCode && p.RoleCode == roleCode && p.IsActive)
                ?? await _context.TravelExpensePolicies
                .FirstOrDefaultAsync(p => p.ProjectId == null && p.RegionCode == regionCode && p.RoleCode == roleCode && p.IsActive);

            decimal limit = 0;
            if (request.ExpenseType == "HOTEL" && policy != null)
            {
                limit = policy.MaxHotelRate;
            }
            else if (request.ExpenseType == "MEALS" && policy != null)
            {
                limit = policy.PerDiemAllowance;
            }

            bool isOverLimit = false;
            decimal overLimitAmount = 0;

            if (limit > 0 && request.AmountActual > limit)
            {
                isOverLimit = true;
                overLimitAmount = request.AmountActual - limit;

                // Hard Tolerance: exceeds limit by more than 50%
                if (request.AmountActual > limit * 1.5m)
                {
                    return BadRequest(new { 
                        message = $"Chặn cứng: Chi phí [{request.ExpenseType}] thực tế ({request.AmountActual:N0} VND) vượt quá 50% hạn mức quy định ({limit:N0} VND) cho chức danh {roleCode} tại {regionCode}. Vui lòng liên hệ Admin hoặc PM để được duyệt ngoại lệ." 
                    });
                }

                // Soft Tolerance: require justification
                if (string.IsNullOrEmpty(request.Justification))
                {
                    return BadRequest(new {
                        isSoftWarning = true,
                        limitAmount = limit,
                        overAmount = overLimitAmount,
                        message = $"Cảnh báo định mức: Chi phí [{request.ExpenseType}] thực tế ({request.AmountActual:N0} VND) vượt hạn mức quy định ({limit:N0} VND) tại Vùng {regionCode[-1..]} cho {roleCode}. Vui lòng nhập lý do giải trình để PM/Director xem xét."
                    });
                }
            }

            var expense = new Expense
            {
                TripId = id,
                ClaimantMemberId = claimantMemberId,
                ExpenseType = request.ExpenseType, // HOTEL, TRANSPORT, MEALS, OTHER
                AmountPlanned = request.AmountPlanned,
                AmountActual = request.AmountActual,
                Notes = request.Notes,
                IsOverLimit = isOverLimit,
                Justification = request.Justification,
                OverLimitAmount = overLimitAmount,
                Status = "DRAFT",
                CreatedDate = DateTime.UtcNow
            };

            _context.Expenses.Add(expense);
            await _context.SaveChangesAsync();

            return Ok(expense);
        }
    }

    public class TripMemberRequest
    {
        public int ProjectMemberId { get; set; }
        public bool IsGroupLeader { get; set; }
    }
}
