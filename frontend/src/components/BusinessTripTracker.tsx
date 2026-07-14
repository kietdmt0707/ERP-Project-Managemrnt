import React, { useState, useEffect } from 'react';
import { businessTripService, teamService, approvalService, BusinessTripDto } from '../services/api';
import { MapPin, Plane, Plus, DollarSign, FileText, Send, User } from 'lucide-react';

interface BusinessTripTrackerProps {
  projectId: number;
  userRole: string;
}

export const BusinessTripTracker: React.FC<BusinessTripTrackerProps> = ({ projectId, userRole: _userRole }) => {
  const [trips, setTrips] = useState<BusinessTripDto[]>([]);
  const [projectMembers, setProjectMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Trip modal
  const [showTripModal, setShowTripModal] = useState(false);
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState(0);

  // Expense modal
  const [selectedTrip, setSelectedTrip] = useState<BusinessTripDto | null>(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseType, setExpenseType] = useState('HOTEL'); // HOTEL, TRANSPORT, MEALS, OTHER
  const [amountPlanned, setAmountPlanned] = useState(0);
  const [amountActual, setAmountActual] = useState(0);
  const [notes, setNotes] = useState('');

  // Assign Member state
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [memberToAssign, setMemberToAssign] = useState<number>(0);

  useEffect(() => {
    loadTrips();
    loadMembers();
  }, [projectId]);

  const loadTrips = async () => {
    try {
      setLoading(true);
      const data = await businessTripService.getTrips(projectId);
      setTrips(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách đi công tác.');
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    try {
      const data = await teamService.getTeams(projectId);
      setProjectMembers(data.members);
      if (data.members.length > 0) {
        setMemberToAssign(data.members[0].projectMemberId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await businessTripService.createTrip({
        projectId,
        title,
        destination,
        startDate,
        endDate,
        advanceAmount
      });
      setShowTripModal(false);
      setTitle('');
      setDestination('');
      setStartDate('');
      setEndDate('');
      setAdvanceAmount(0);
      loadTrips();
    } catch (err: any) {
      alert(err.message || 'Lỗi tạo lịch công tác.');
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip || !selectedTrip.tripId) return;
    try {
      await businessTripService.addTripExpense(selectedTrip.tripId, {
        expenseType,
        amountPlanned,
        amountActual,
        notes
      });
      setShowExpenseModal(false);
      setAmountPlanned(0);
      setAmountActual(0);
      setNotes('');
      loadTrips();
    } catch (err: any) {
      alert(err.message || 'Thêm chi phí thất bại.');
    }
  };

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip || !selectedTrip.tripId) return;
    try {
      await businessTripService.addTripMember(selectedTrip.tripId, memberToAssign);
      setShowMemberModal(false);
      loadTrips();
    } catch (err: any) {
      alert(err.message || 'Thêm thành viên thất bại.');
    }
  };

  const handleSendApproval = async (trip: BusinessTripDto) => {
    if (!trip.tripId) return;
    try {
      await approvalService.submitForApproval({
        projectId,
        targetType: 'TRIP',
        targetId: trip.tripId,
        description: `Chuyến công tác ${trip.destination}: ${trip.title}`,
        amount: trip.advanceAmount
      });
      alert('Đã gửi yêu cầu phê duyệt chuyến công tác 3 cấp thành công!');
      loadTrips();
    } catch (err: any) {
      alert(err.message || 'Gửi phê duyệt thất bại.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-dark-900/40 p-4 rounded-xl border border-dark-800 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Plane className="text-brand-500" /> Quản Lý Đội Ngũ Đi Công Tác & Tạm Ứng
          </h2>
          <p className="text-xs text-dark-400 mt-1">
            Khai báo lịch trình công tác, khách sạn, tạm ứng và quy trình gửi phê duyệt công tác phí 3 cấp
          </p>
        </div>
        <button
          onClick={() => setShowTripModal(true)}
          className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-brand-600/10"
        >
          <Plus size={14} /> Khai Báo Lịch Công Tác
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-xs text-dark-400">Đang tải lịch trình công tác...</div>
      ) : (
        <div className="space-y-6">
          {trips.map((trip) => (
            <div key={trip.tripId} className="glass-panel p-5 rounded-2xl border border-dark-800 space-y-4 hover:border-dark-750 transition-all">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-dark-850 pb-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold font-mono text-brand-400 px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/10">
                      {trip.tripCode}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      trip.status === 'APPROVED' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                      trip.status === 'SUBMITTED' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' :
                      'bg-dark-800 border border-dark-700 text-dark-400'
                    }`}>
                      {trip.status === 'APPROVED' ? 'ĐÃ PHÊ DUYỆT' : trip.status === 'SUBMITTED' ? 'ĐANG CHỜ DUYỆT' : 'NHÁP'}
                    </span>
                  </div>
                  <h3 className="text-md font-bold text-white">{trip.title}</h3>
                  <p className="text-xs text-dark-400 flex items-center gap-1.5">
                    <MapPin size={12} className="text-dark-500" /> Điểm đến: {trip.destination}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3 items-center">
                  <div className="bg-dark-900 border border-dark-800 py-2 px-3 rounded-xl text-xs font-mono text-emerald-400 flex items-center gap-1 shrink-0">
                    <DollarSign size={14} /> Tạm ứng: {trip.advanceAmount?.toLocaleString()} VNĐ
                  </div>
                  {trip.status === 'DRAFT' && (
                    <button
                      onClick={() => handleSendApproval(trip)}
                      className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1 transition-all"
                    >
                      <Send size={12} /> Gửi Phê Duyệt 3 Cấp
                    </button>
                  )}
                  <button
                    onClick={() => { setSelectedTrip(trip); setShowMemberModal(true); }}
                    className="bg-dark-800 hover:bg-dark-700 border border-dark-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl flex items-center gap-1 transition-all"
                  >
                    + Thành Viên
                  </button>
                  <button
                    onClick={() => { setSelectedTrip(trip); setShowExpenseModal(true); }}
                    className="bg-dark-800 hover:bg-dark-700 border border-dark-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl flex items-center gap-1 transition-all"
                  >
                    + Khách Sạn / Chi Phí
                  </button>
                </div>
              </div>

              {/* Members & Expenses Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Members list */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-dark-400 uppercase tracking-wider flex items-center gap-1.5">
                    <User size={13} /> Thành viên đi công tác:
                  </h4>
                  <div className="space-y-1.5 pl-2 border-l border-dark-800">
                    {trip.members?.map(m => (
                      <div key={m.tripMemberId} className="text-xs text-white font-medium flex items-center gap-2">
                        <span>👤 {m.fullName}</span>
                        <span className="text-[10px] text-dark-500">({m.phone || m.email})</span>
                      </div>
                    ))}
                    {(!trip.members || trip.members.length === 0) && (
                      <p className="text-xs text-dark-600 italic">Chưa gán thành viên nào</p>
                    )}
                  </div>
                </div>

                {/* Expenses list */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-dark-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={13} /> Khách sạn & Chi phí liên quan:
                  </h4>
                  <div className="space-y-2 pl-2 border-l border-dark-800">
                    {trip.expenses?.map(e => (
                      <div key={e.expenseId} className="text-xs bg-dark-900/40 p-2.5 rounded-xl border border-dark-850 flex justify-between items-center gap-2">
                        <div>
                          <p className="font-semibold text-white">[{e.expenseType}] {e.notes || 'Chi phí công tác'}</p>
                          <p className="text-[10px] text-dark-500">Khai báo bởi: {e.claimantName}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-mono text-brand-400 font-semibold">{e.amountPlanned.toLocaleString()} VNĐ</p>
                          <p className="text-[10px] text-dark-500 font-mono">Thực tế: {e.amountActual.toLocaleString()} VNĐ</p>
                        </div>
                      </div>
                    ))}
                    {(!trip.expenses || trip.expenses.length === 0) && (
                      <p className="text-xs text-dark-600 italic">Chưa khai báo khách sạn/chi phí nào</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {trips.length === 0 && (
            <div className="text-center py-20 bg-dark-900/10 border border-dark-900 border-dashed rounded-2xl text-dark-500 text-xs">
              Chưa có chuyến công tác nào được khai báo trong dự án này.
            </div>
          )}
        </div>
      )}

      {/* Add Trip Modal */}
      {showTripModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-dark-800 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Plane className="text-brand-500" /> Khai Báo Lịch Công Tác
              </h3>
              <button onClick={() => setShowTripModal(false)} className="text-xs text-dark-400 hover:text-white">Đóng</button>
            </div>

            <form onSubmit={handleTripSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Tên / Mục đích chuyến công tác:</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Khảo sát triển khai đợt 1"
                  className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Địa điểm công tác (Destination):</label>
                <input 
                  type="text" 
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="VD: Chi nhánh miền Nam, Khách sạn ABC"
                  className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Ngày bắt đầu:</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Ngày kết thúc:</label>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Số tiền tạm ứng đề xuất (VNĐ):</label>
                <input 
                  type="number" 
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(parseInt(e.target.value) || 0)}
                  className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all"
              >
                Lưu Lịch Trình (Nháp)
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-dark-800 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <DollarSign className="text-brand-500" /> Thêm Khách Sạn / Chi Phí
              </h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-xs text-dark-400 hover:text-white">Đóng</button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Loại chi phí:</label>
                <select 
                  value={expenseType}
                  onChange={(e) => setExpenseType(e.target.value)}
                  className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="HOTEL">Khách Sạn (Hotel)</option>
                  <option value="TRANSPORT">Di Chuyển / Máy Bay (Transport)</option>
                  <option value="MEALS">Ăn uống (Meals)</option>
                  <option value="OTHER">Chi phí khác (Other)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Dự kiến (Planned):</label>
                  <input 
                    type="number" 
                    value={amountPlanned}
                    onChange={(e) => setAmountPlanned(parseInt(e.target.value) || 0)}
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Thực tế (Actual):</label>
                  <input 
                    type="number" 
                    value={amountActual}
                    onChange={(e) => setAmountActual(parseInt(e.target.value) || 0)}
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Ghi chú chi tiết:</label>
                <input 
                  type="text" 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="VD: Phòng khách sạn Mường Thanh, vé máy bay khứ hồi..."
                  className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all"
              >
                Thêm Chi Phí
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Assign Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-dark-800 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <User className="text-brand-500" /> Thêm Thành Viên Đi Công Tác
              </h3>
              <button onClick={() => setShowMemberModal(false)} className="text-xs text-dark-400 hover:text-white">Đóng</button>
            </div>

            <form onSubmit={handleMemberSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Chọn thành viên dự án:</label>
                <select 
                  value={memberToAssign}
                  onChange={(e) => setMemberToAssign(Number(e.target.value))}
                  className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  required
                >
                  {projectMembers.map(pm => (
                    <option key={pm.projectMemberId} value={pm.projectMemberId}>{pm.fullName} ({pm.roleName})</option>
                  ))}
                </select>
              </div>

              <button 
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all"
              >
                Gán Vào Đoàn Công Tác
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
