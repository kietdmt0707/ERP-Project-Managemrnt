import React, { useState } from 'react';
import { approvalService } from '../services/api';
import { ShieldAlert, Send, Clock, CheckCircle, DollarSign, ListChecks } from 'lucide-react';

interface ApprovalListProps {
  projectId: number;
  userRole: string;
}

export const ApprovalList: React.FC<ApprovalListProps> = ({ projectId, userRole }) => {
  const [timesheets, setTimesheets] = useState([
    { id: 101, taskCode: '1.1.1', date: '2026-08-03', hours: 8, desc: 'Khảo sát AP Invoice với Key User', status: 'APPROVED' },
    { id: 102, taskCode: '1.1.2', date: '2026-08-04', hours: 8, desc: 'Chuẩn bị template MD050 AP', status: 'DRAFT' }
  ]);

  const [expenses, setExpenses] = useState([
    { id: 201, code: 'TRIP-ABC-AP-01', type: 'TRANSPORT', amount: 1100000, desc: 'Taxi HCM đi Bình Dương khảo sát', status: 'DRAFT' },
    { id: 202, code: 'TRIP-ABC-AP-01', type: 'HOTEL', amount: 800000, desc: 'Khách sạn Becamex BD', status: 'DRAFT' }
  ]);

  const [submitting, setSubmitting] = useState<number | null>(null);

  const handleSubmitForApproval = async (targetType: 'TIMESHEET' | 'EXPENSE', targetId: number, desc: string, amount: number) => {
    try {
      setSubmitting(targetId);
      const res = await approvalService.submitForApproval({
        projectId,
        targetType,
        targetId,
        description: desc,
        amount
      });
      
      alert(res.message);

      // Update state to PENDING
      if (targetType === 'TIMESHEET') {
        setTimesheets(prev => prev.map(t => t.id === targetId ? { ...t, status: 'SUBMITTED' } : t));
      } else {
        setExpenses(prev => prev.map(e => e.id === targetId ? { ...e, status: 'SUBMITTED' } : e));
      }
    } catch (err: any) {
      alert(err.message || 'Lỗi gửi yêu cầu phê duyệt.');
    } finally {
      setSubmitting(null);
    }
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">ĐÃ DUYỆT</span>;
      case 'SUBMITTED':
      case 'PENDING':
        return <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold">CHỜ DUYỆT (3 CẤP)</span>;
      case 'REJECTED':
        return <span className="text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-bold">TỪ CHỐI</span>;
      default:
        return <span className="text-dark-400 bg-dark-800 border border-dark-700 px-2 py-0.5 rounded text-[10px] font-bold">DRAFT</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-dark-900/40 p-4 rounded-xl border border-dark-800 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ListChecks className="text-brand-500" /> Khai Báo Timesheet & Đề Xuất Phê Duyệt
          </h2>
          <p className="text-xs text-dark-400 mt-1">Nộp báo cáo ngày công, đề xuất chi phí đi lại và theo dõi luồng phê duyệt 3 cấp tự động</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Timesheet Section */}
        <div className="bg-dark-900/20 p-5 rounded-xl border border-dark-800 space-y-4">
          <h3 className="text-sm font-bold text-white border-b border-dark-800 pb-2 flex items-center gap-1.5">
            <Clock size={16} className="text-brand-400" /> Báo Cáo Ngày Công (Timesheets)
          </h3>
          
          <div className="space-y-2">
            {timesheets.map(t => (
              <div key={t.id} className="bg-dark-900/60 p-3 rounded-lg border border-dark-800/80 flex justify-between items-center text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-brand-400">Task {t.taskCode}</span>
                    <span className="text-[10px] text-dark-500 font-mono">{t.date}</span>
                  </div>
                  <p className="text-dark-200 mt-1">{t.desc}</p>
                  <p className="text-dark-400 mt-0.5">Số giờ làm việc: <span className="font-semibold text-white">{t.hours}h</span></p>
                </div>
                
                <div className="flex flex-col items-end gap-2">
                  {renderStatus(t.status)}
                  {t.status === 'DRAFT' && (
                    <button 
                      onClick={() => handleSubmitForApproval('TIMESHEET', t.id, t.desc, 0)}
                      disabled={submitting === t.id}
                      className="bg-brand-600/20 border border-brand-500/30 text-brand-400 hover:bg-brand-500 hover:text-white text-[10px] px-2.5 py-1 rounded font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                    >
                      <Send size={10} /> Gửi Duyệt
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expenses Section */}
        <div className="bg-dark-900/20 p-5 rounded-xl border border-dark-800 space-y-4">
          <h3 className="text-sm font-bold text-white border-b border-dark-800 pb-2 flex items-center gap-1.5">
            <DollarSign size={16} className="text-emerald-400" /> Công Tác Phí (Trip Expenses)
          </h3>

          <div className="space-y-2">
            {expenses.map(e => (
              <div key={e.id} className="bg-dark-900/60 p-3 rounded-lg border border-dark-800/80 flex justify-between items-center text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-400">{e.code}</span>
                    <span className="text-[10px] bg-dark-800 px-1 py-0.5 rounded text-dark-400">{e.type}</span>
                  </div>
                  <p className="text-dark-200 mt-1">{e.desc}</p>
                  <p className="text-dark-400 mt-0.5">Chi phí thực tế: <span className="font-bold text-rose-400 font-mono">{e.amount.toLocaleString('vi-VN')} VNĐ</span></p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  {renderStatus(e.status)}
                  {e.status === 'DRAFT' && (
                    <button 
                      onClick={() => handleSubmitForApproval('EXPENSE', e.id, e.desc, e.amount)}
                      disabled={submitting === e.id}
                      className="bg-brand-600/20 border border-brand-500/30 text-brand-400 hover:bg-brand-500 hover:text-white text-[10px] px-2.5 py-1 rounded font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                    >
                      <Send size={10} /> Gửi Duyệt
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cost Visibility Warning (Visual design detail matching role check) */}
      {userRole !== 'PM' && userRole !== 'DIRECTOR' && userRole !== 'SYSTEM_ADMIN' && (
        <div className="bg-dark-900/30 border border-dark-800 p-4 rounded-xl flex items-center gap-3 text-xs text-dark-400">
          <ShieldAlert className="text-amber-500 shrink-0" size={18} />
          <p>
            Bạn đang đăng nhập với quyền <strong>{userRole}</strong>. Báo cáo tài chính tổng thể và đơn giá ngày công của thành viên (Daily Rate Cost) được mã hóa và chỉ hiển thị cho tài khoản cấp <strong>PM</strong> trở lên.
          </p>
        </div>
      )}
    </div>
  );
};
