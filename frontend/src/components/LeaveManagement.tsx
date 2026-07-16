import React, { useState, useEffect } from 'react';
import { Calendar, User, Check, X, Clipboard, Clock, Briefcase, Plus, RefreshCw } from 'lucide-react';

interface LeaveHistoryItem {
  leaveId: number;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: string;
  createdDate: string;
  projectApprovals: Array<{
    approvalId: number;
    projectId: number;
    project?: { projectName: string };
    status: string;
    comments?: string;
  }>;
}

interface ActiveProject {
  projectId: number;
  projectName: string;
  roleCode: string;
}

export const LeaveManagement: React.FC = () => {
  const [annualDays, setAnnualDays] = useState(13);
  const [carryOver, setCarryOver] = useState(5);
  const [usedDays, setUsedDays] = useState(0);
  const [availableDays, setAvailableDays] = useState(18);
  const [activeProjects, setActiveProjects] = useState<ActiveProject[]>([]);
  const [history, setHistory] = useState<LeaveHistoryItem[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [selectedProjects, setSelectedProjects] = useState<number[]>([]);

  useEffect(() => {
    loadLeaveData();
  }, []);

  const loadLeaveData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('aron_pm_token');
      const response = await fetch('/api/leave/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAnnualDays(data.annualLeaveDays);
        setCarryOver(data.carryOverDays);
        setUsedDays(data.usedLeaveDays);
        setAvailableDays(data.totalAvailable);
        setActiveProjects(data.activeProjects || []);
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error("Lỗi tải dữ liệu nghỉ phép:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckboxChange = (projectId: number) => {
    setSelectedProjects(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const calculateDays = () => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProjects.length === 0) {
      alert("Vui lòng chọn các dự án bị ảnh hưởng để kích hoạt phê duyệt song song.");
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem('aron_pm_token');
      const payload = {
        startDate,
        endDate,
        totalDays: calculateDays(),
        reason,
        projectIds: selectedProjects
      };

      const response = await fetch('/api/leave/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert("Đã gửi đơn xin nghỉ phép thành công! Luồng phê duyệt song song của các PM đã được kích hoạt.");
        setStartDate('');
        setEndDate('');
        setReason('');
        setSelectedProjects([]);
        loadLeaveData();
      } else {
        const err = await response.json();
        alert(err.message || "Lỗi khi gửi yêu cầu.");
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối máy chủ.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveReject = async (approvalId: number, approve: boolean) => {
    try {
      const token = localStorage.getItem('aron_pm_token');
      const comments = prompt(approve ? "Nhập ghi chú phê duyệt (Tùy chọn):" : "Nhập lý do từ chối (Bắt buộc):");
      if (!approve && !comments) {
        alert("Bạn phải nhập lý do từ chối.");
        return;
      }

      const response = await fetch(`/api/leave/${approve ? 'approve' : 'reject'}/${approvalId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ comments })
      });

      if (response.ok) {
        alert("Xử lý phê duyệt thành công!");
        loadLeaveData();
      } else {
        alert("Lỗi khi xử lý phê duyệt.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Redwood Header */}
      <div className="flex justify-between items-center bg-[#F0EDE5] p-5 rounded-2xl border border-[#E6E1D6] shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-[#231F20] flex items-center gap-2">
            <Calendar className="text-[#A45A52]" />
            Quản Lý Nghỉ Phép Song Song (Parallel Leave Dashboard)
          </h2>
          <p className="text-xs text-[#595250] mt-1">Cơ chế Carry-over dồn phép tự động và Phê duyệt song song bởi PM các dự án liên quan</p>
        </div>
        <button onClick={loadLeaveData} className="p-2 text-[#595250] hover:text-[#A45A52] transition-colors">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Infolet Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E6E1D6] shadow-sm text-center">
          <p className="text-xs text-[#595250] font-semibold uppercase tracking-wider">Phép năm cố định</p>
          <p className="text-3xl font-extrabold text-[#231F20] mt-2">{annualDays} <span className="text-sm font-normal text-[#595250]">ngày</span></p>
        </div>

        <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E6E1D6] shadow-sm text-center relative">
          <p className="text-xs text-[#595250] font-semibold uppercase tracking-wider">Phép năm ngoái chuyển qua</p>
          <p className="text-3xl font-extrabold text-[#A45A52] mt-2">+{carryOver} <span className="text-sm font-normal text-[#595250]">ngày</span></p>
          {carryOver > 0 && (
            <span className="absolute top-2 right-2 bg-amber-500/10 text-amber-600 text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-amber-500/20">Hạn 01/04</span>
          )}
        </div>

        <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E6E1D6] shadow-sm text-center">
          <p className="text-xs text-[#595250] font-semibold uppercase tracking-wider">Số ngày đã nghỉ</p>
          <p className="text-3xl font-extrabold text-[#595250] mt-2">{usedDays} <span className="text-sm font-normal text-[#595250]">ngày</span></p>
        </div>

        <div className="bg-[#FFFFFF] p-5 rounded-2xl border border-[#E6E1D6] shadow-sm text-center bg-gradient-to-br from-[#F9F6F0] to-[#FFFFFF]">
          <p className="text-xs text-[#A45A52] font-bold uppercase tracking-wider">Tổng ngày phép khả dụng</p>
          <p className="text-3xl font-extrabold text-[#A45A52] mt-2">{availableDays} <span className="text-sm font-normal text-[#231F20]">ngày</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Smart Request Form */}
        <div className="lg:col-span-1 bg-[#FFFFFF] p-5 rounded-2xl border border-[#E6E1D6] shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-[#231F20] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#E6E1D6] pb-3">
            <Plus size={16} className="text-[#A45A52]" /> Đăng ký Nghỉ phép Mới
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-[#595250] font-bold block mb-1">Ngày bắt đầu nghỉ</label>
              <input 
                type="date" 
                required 
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full bg-[#F9F6F0] border border-[#E6E1D6] text-[#231F20] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#A45A52]"
              />
            </div>

            <div>
              <label className="text-xs text-[#595250] font-bold block mb-1">Ngày kết thúc nghỉ</label>
              <input 
                type="date" 
                required 
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full bg-[#F9F6F0] border border-[#E6E1D6] text-[#231F20] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#A45A52]"
              />
            </div>

            {startDate && endDate && (
              <div className="bg-[#F9F6F0] p-3 rounded-xl border border-[#E6E1D6] flex justify-between items-center">
                <span className="text-xs text-[#595250] font-semibold">Tổng số ngày dự kiến:</span>
                <span className="text-sm font-bold text-[#231F20]">{calculateDays()} ngày</span>
              </div>
            )}

            <div>
              <label className="text-xs text-[#595250] font-bold block mb-1">Lý do xin nghỉ</label>
              <textarea 
                required 
                rows={3}
                placeholder="Lý do bàn giao công việc..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="w-full bg-[#F9F6F0] border border-[#E6E1D6] text-[#231F20] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#A45A52]"
              />
            </div>

            {/* Smart Project Checklist */}
            <div className="space-y-2">
              <label className="text-xs text-[#595250] font-bold block">Dự án chịu ảnh hưởng trực tiếp:</label>
              {activeProjects.length === 0 ? (
                <p className="text-xs text-[#595250] italic">Bạn chưa được phân bổ vào dự án nào.</p>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto border border-[#E6E1D6] p-3 rounded-xl bg-[#F9F6F0]">
                  {activeProjects.map(proj => (
                    <label key={proj.projectId} className="flex items-center gap-2 text-xs text-[#231F20] font-semibold cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={selectedProjects.includes(proj.projectId)}
                        onChange={() => handleCheckboxChange(proj.projectId)}
                        className="rounded text-[#A45A52] focus:ring-[#A45A52]"
                      />
                      <span>{proj.projectName} <span className="text-[10px] text-[#A45A52] font-mono">({proj.roleCode})</span></span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={submitting}
              className="w-full bg-[#A45A52] hover:bg-[#A45A52]/90 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-sm"
            >
              {submitting ? 'Đang gửi...' : 'Gửi Đơn Xin Nghỉ'}
            </button>
          </form>
        </div>

        {/* Right Column: History Grid */}
        <div className="lg:col-span-2 bg-[#FFFFFF] p-5 rounded-2xl border border-[#E6E1D6] shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-[#231F20] uppercase tracking-wider flex items-center gap-1.5 border-b border-[#E6E1D6] pb-3">
            <Clock size={16} className="text-[#A45A52]" /> Lịch Sử Đơn & Phê Duyệt Song Song
          </h3>

          <div className="space-y-3 overflow-y-auto max-h-[450px] pr-1">
            {history.length === 0 ? (
              <div className="text-center py-10 text-xs text-[#595250] italic">Không tìm thấy yêu cầu nghỉ phép nào.</div>
            ) : (
              history.map(item => (
                <div key={item.leaveId} className="bg-[#F9F6F0] p-4 rounded-xl border border-[#E6E1D6] space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-xs text-[#231F20] font-bold">Nghỉ từ {new Date(item.startDate).toLocaleDateString('vi-VN')} đến {new Date(item.endDate).toLocaleDateString('vi-VN')}</p>
                      <p className="text-[10px] text-[#595250] font-semibold mt-0.5">Số ngày: {item.totalDays} | Lý do: {item.reason}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      item.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                      item.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                      'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    }`}>
                      {item.status === 'APPROVED' ? 'Đã duyệt' : item.status === 'REJECTED' ? 'Từ chối' : 'Chờ duyệt'}
                    </span>
                  </div>

                  {/* Parallel Approver status */}
                  <div className="border-t border-[#E6E1D6] pt-2.5 space-y-2">
                    <p className="text-[10px] text-[#595250] font-bold uppercase tracking-wider">Trạng thái duyệt của các PM dự án:</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {item.projectApprovals.map(app => (
                        <div key={app.approvalId} className="bg-[#FFFFFF] p-2 rounded-lg border border-[#E6E1D6] flex justify-between items-center text-[11px]">
                          <div>
                            <p className="font-bold text-[#231F20]">{app.project?.projectName || 'Dự án'}</p>
                            {app.comments && <p className="text-[9px] text-[#595250] italic">Ghi chú: {app.comments}</p>}
                          </div>
                          <span className={`font-mono text-[9px] font-bold ${
                            app.status === 'APPROVED' ? 'text-emerald-600' :
                            app.status === 'REJECTED' ? 'text-rose-600' :
                            'text-amber-600'
                          }`}>
                            {app.status === 'APPROVED' ? '✓ Đã duyệt' : app.status === 'REJECTED' ? '✗ Từ chối' : '● Chờ PM'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
