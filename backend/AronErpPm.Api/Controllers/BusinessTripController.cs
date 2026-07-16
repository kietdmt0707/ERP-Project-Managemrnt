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
            var member = await _context.ProjectMembers
                .Include(pm => pm.User)
                .FirstOrDefaultAsync(pm => pm.ProjectId == projectId && pm.User!.Username == username);

            if (member == null) return Forbid("Bạn không phải thành viên dự án này.");

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
            var member = await _context.ProjectMembers
                .Include(pm => pm.User)
                .FirstOrDefaultAsync(pm => pm.ProjectId == request.ProjectId && pm.User!.Username == username);

            if (member == null) return Forbid("Bạn không phải thành viên dự án này.");

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
                CreatedByMemberId = member.ProjectMemberId,
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
            var member = await _context.ProjectMembers
                .Include(pm => pm.User)
                .FirstOrDefaultAsync(pm => pm.ProjectId == trip.ProjectId && pm.User!.Username == username);

            if (member == null) return Forbid("Bạn không phải thành viên dự án này.");

            var expense = new Expense
            {
                TripId = id,
                ClaimantMemberId = member.ProjectMemberId,
                ExpenseType = request.ExpenseType, // HOTEL, TRANSPORT, MEALS, OTHER
                AmountPlanned = request.AmountPlanned,
                AmountActual = request.AmountActual,
                Notes = request.Notes,
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
