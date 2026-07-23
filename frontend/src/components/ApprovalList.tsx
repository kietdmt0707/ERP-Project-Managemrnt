import React, { useState, useEffect } from 'react';
import { approvalService, timesheetService, taskService, TimesheetItem, TaskNode } from '../services/api';
import { ShieldAlert, Send, Clock, DollarSign, ListChecks, Plus, Calendar, Trash2, CheckCircle2 } from 'lucide-react';

interface ApprovalListProps {
  projectId: number;
  userRole: string;
}

export const ApprovalList: React.FC<ApprovalListProps> = ({ projectId, userRole }) => {
  const [timesheets, setTimesheets] = useState<TimesheetItem[]>([]);
  const [loadingTimesheets, setLoadingTimesheets] = useState(true);
  const [taskNodes, setTaskNodes] = useState<TaskNode[]>([]);

  const [expenses, setExpenses] = useState([
    { id: 201, code: 'TRIP-ABC-AP-01', type: 'TRANSPORT', amount: 1100000, desc: 'Taxi HCM đi Bình Dương khảo sát', status: 'DRAFT' },
    { id: 202, code: 'TRIP-ABC-AP-01', type: 'HOTEL', amount: 800000, desc: 'Khách sạn Becamex BD', status: 'DRAFT' }
  ]);

  const [submitting, setSubmitting] = useState<number | null>(null);

  // Single Timesheet Modal
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<number | undefined>(undefined);
  const [workDate, setWorkDate] = useState<string>(new Date().toISOString().substring(0, 10));
  const [hoursWorked, setHoursWorked] = useState<number>(8);
  const [description, setDescription] = useState<string>('');
  const [savingSingle, setSavingSingle] = useState(false);

  // Weekly Bulk Matrix Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTaskId, setBulkTaskId] = useState<number | undefined>(undefined);
  const [bulkStartDate, setBulkStartDate] = useState<string>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(today.setDate(diff));
    return monday.toISOString().substring(0, 10);
  });
  const [bulkHours, setBulkHours] = useState<number[]>([8, 8, 8, 8, 8, 0, 0]); // Mon -> Sun
  const [bulkNotes, setBulkNotes] = useState<string>('Thực hiện công việc tuần theo kế hoạch');
  const [savingBulk, setSavingBulk] = useState(false);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoadingTimesheets(true);
      const [tsData, tasksData] = await Promise.all([
        timesheetService.getTimesheets(projectId),
        taskService.getTaskTree(projectId).catch(() => [])
      ]);
      setTimesheets(tsData);
      setTaskNodes(tasksData);
    } catch (err) {
      console.error("Lỗi tải dữ liệu Timesheet:", err);
    } finally {
      setLoadingTimesheets(false);
    }
  };

  // Flatten task tree for select dropdown
  const flattenTasks = (nodes: TaskNode[], prefix = ''): Array<{ id: number; title: string; code: string }> => {
    let result: Array<{ id: number; title: string; code: string }> = [];
    nodes.forEach(node => {
      const displayTitle = `${prefix}${node.wbsCode ? `[${node.wbsCode}] ` : ''}${node.taskTitle}`;
      result.push({ id: node.taskId, title: displayTitle, code: node.wbsCode || `Task #${node.taskId}` });
      if (node.subTasks && node.subTasks.length > 0) {
        result = result.concat(flattenTasks(node.subTasks, `${prefix}— `));
      }
    });
    return result;
  };

  const taskOptions = flattenTasks(taskNodes);

  const handleCreateSingleTimesheet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSingle(true);
      await timesheetService.createTimesheet({
        projectId,
        taskId: selectedTaskId,
        workDate,
        hoursWorked,
        description
      });
      setShowSingleModal(false);
      setDescription('');
      loadData();
      alert('Đã lưu khai báo Timesheet thành công!');
    } catch (err: any) {
      alert(err.message || 'Không thể lưu Timesheet.');
    } finally {
      setSavingSingle(false);
    }
  };

  const handleCreateBulkTimesheet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingBulk(true);
      const start = new Date(bulkStartDate);
      const items = bulkHours.map((hours, index) => {
        const currentDate = new Date(start);
        currentDate.setDate(start.getDate() + index);
        return {
          projectId,
          taskId: bulkTaskId,
          workDate: currentDate.toISOString().substring(0, 10),
          hoursWorked: hours,
          description: bulkNotes
        };
      }).filter(item => item.hoursWorked > 0);

      if (items.length === 0) {
        alert('Vui lòng nhập ít nhất một ngày có số giờ lớn hơn 0.');
        return;
      }

      await timesheetService.createBulkTimesheets(items);
      setShowBulkModal(false);
      loadData();
      alert(`Đã khai báo tuần thành công cho ${items.length} ngày!`);
    } catch (err: any) {
      alert(err.message || 'Không thể khai báo Timesheet ma trận tuần.');
    } finally {
      setSavingBulk(false);
    }
  };

  const handleDeleteTimesheet = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khai báo Timesheet này?')) return;
    try {
      await timesheetService.deleteTimesheet(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Không thể xóa Timesheet.');
    }
  };

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

      if (targetType === 'TIMESHEET') {
        setTimesheets(prev => prev.map(t => t.timesheetId === targetId ? { ...t, status: 'SUBMITTED' } : t));
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
      {/* Overview Card & Action Bar */}
      <div className="bg-dark-900-40 p-4 rounded-xl border border-dark-800 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ListChecks className="text-brand-500" /> Khai Báo Timesheet & Đề Xuất Phê Duyệt
          </h2>
          <p className="text-xs text-dark-400 mt-1">Nộp báo cáo ngày công, đề xuất chi phí đi lại và theo dõi luồng phê duyệt 3 cấp tự động</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowBulkModal(true)}
            className="bg-dark-800 hover:bg-dark-750 border border-dark-700 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center gap-1.5 transition-all"
          >
            <Calendar size={14} className="text-emerald-400" /> + Khai Báo Ma Trận Tuần
          </button>
          <button
            onClick={() => setShowSingleModal(true)}
            className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-brand-600-10"
          >
            <Plus size={14} /> + Khai Báo Timesheet Mới
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Timesheet Section */}
        <div className="bg-dark-900-60 p-5 rounded-xl border border-dark-800 space-y-4">
          <div className="flex justify-between items-center border-b border-dark-800 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Clock size={16} className="text-brand-400" /> Báo Cáo Ngày Công (Timesheets)
            </h3>
            <span className="text-[10px] text-dark-400 font-mono">Tổng số: {timesheets.length} bản ghi</span>
          </div>
          
          {loadingTimesheets ? (
            <div className="text-center py-8 text-xs text-dark-400">Đang tải danh sách Timesheet...</div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {timesheets.map(t => (
                <div key={t.timesheetId} className="bg-dark-950 p-3 rounded-lg border border-dark-800 flex justify-between items-center text-xs hover:border-dark-700 transition-colors">
                  <div className="space-y-1 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-brand-400 bg-brand-500-10 border border-brand-500-20 px-1.5 py-0.5 rounded text-[11px]">
                        {t.taskCode}
                      </span>
                      <span className="text-[11px] text-dark-300 font-semibold">{t.taskTitle}</span>
                      <span className="text-[10px] text-dark-500 font-mono ml-auto">🗓 {t.workDate}</span>
                    </div>
                    <p className="text-dark-200 text-[11px]">{t.description || 'Không có ghi chú'}</p>
                    <div className="flex items-center gap-3 text-[10px] text-dark-400">
                      <span>👤 {t.memberName}</span>
                      <span>Số giờ làm việc: <strong className="text-white font-mono">{t.hoursWorked}h</strong></span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {renderStatus(t.status)}
                    {t.status === 'DRAFT' && (
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => handleSubmitForApproval('TIMESHEET', t.timesheetId, t.description || t.taskTitle, 0)}
                          disabled={submitting === t.timesheetId}
                          className="bg-brand-600-10 border border-brand-500-20 text-brand-400 hover:bg-brand-500 hover:text-white text-[10px] px-2 py-1 rounded font-bold flex items-center gap-1 transition-all disabled:opacity-50"
                        >
                          <Send size={10} /> Gửi Duyệt
                        </button>
                        <button
                          onClick={() => handleDeleteTimesheet(t.timesheetId)}
                          className="text-dark-500 hover:text-rose-400 p-1 transition-colors"
                          title="Xóa Timesheet nháp"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {timesheets.length === 0 && (
                <div className="text-center py-8 text-xs text-dark-500 italic">
                  Chưa có báo cáo ngày công nào được khai báo cho dự án này. Bấm nút "+ Khai Báo Timesheet Mới" để bắt đầu.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Expenses Section */}
        <div className="bg-dark-900-60 p-5 rounded-xl border border-dark-800 space-y-4">
          <div className="flex justify-between items-center border-b border-dark-800 pb-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <DollarSign size={16} className="text-emerald-400" /> Công Tác Phí (Trip Expenses)
            </h3>
            <span className="text-[10px] text-dark-400 font-mono">Tổng số: {expenses.length} khoản chi</span>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {expenses.map(e => (
              <div key={e.id} className="bg-dark-950 p-3 rounded-lg border border-dark-800 flex justify-between items-center text-xs hover:border-dark-700 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-400">{e.code}</span>
                    <span className="text-[10px] bg-dark-800 px-1.5 py-0.5 rounded text-dark-400 font-mono">{e.type}</span>
                  </div>
                  <p className="text-dark-200 mt-1">{e.desc}</p>
                  <p className="text-dark-400 mt-0.5">Chi phí thực tế: <span className="font-bold text-rose-400 font-mono">{e.amount.toLocaleString('vi-VN')} VNĐ</span></p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {renderStatus(e.status)}
                  {e.status === 'DRAFT' && (
                    <button 
                      onClick={() => handleSubmitForApproval('EXPENSE', e.id, e.desc, e.amount)}
                      disabled={submitting === e.id}
                      className="bg-brand-600-10 border border-brand-500-20 text-brand-400 hover:bg-brand-500 hover:text-white text-[10px] px-2 py-1 rounded font-bold flex items-center gap-1 transition-all disabled:opacity-50"
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

      {/* Single Timesheet Modal */}
      {showSingleModal && (
        <div className="fixed inset-0 bg-dark-950-80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-dark-800 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Plus className="text-brand-500" /> Khai Báo Timesheet Mới
              </h3>
              <button onClick={() => setShowSingleModal(false)} className="text-xs text-dark-400 hover:text-white">Đóng</button>
            </div>

            <form onSubmit={handleCreateSingleTimesheet} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Chọn Task WBS Công Việc:</label>
                <select
                  value={selectedTaskId || ''}
                  onChange={e => setSelectedTaskId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500 font-semibold"
                >
                  <option value="">-- Công việc chung (General Task) --</option>
                  {taskOptions.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Ngày Làm Việc:</label>
                  <input
                    type="date"
                    required
                    value={workDate}
                    onChange={e => setWorkDate(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Số Giờ Làm (Hours):</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    required
                    value={hoursWorked}
                    onChange={e => setHoursWorked(Number(e.target.value) || 0)}
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-brand-400 font-mono font-bold focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Nội Dung Chi Tiết Công Việc:</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Mô tả công việc chi tiết đã hoàn thành trong ngày..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <button
                type="submit"
                disabled={savingSingle}
                className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 size={14} /> {savingSingle ? 'Đang lưu khai báo...' : 'Lưu Khai Báo Timesheet'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Weekly Bulk Matrix Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-dark-950-80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel p-6 rounded-2xl border border-dark-800 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Calendar className="text-emerald-400" /> Khai Báo Timesheet Ma Trận Tuần
              </h3>
              <button onClick={() => setShowBulkModal(false)} className="text-xs text-dark-400 hover:text-white">Đóng</button>
            </div>

            <form onSubmit={handleCreateBulkTimesheet} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Hạng Mục Công Việc (WBS Task):</label>
                <select
                  value={bulkTaskId || ''}
                  onChange={e => setBulkTaskId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500 font-semibold"
                >
                  <option value="">-- Công việc chung (General Task) --</option>
                  {taskOptions.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Ngày Bắt Đầu Tuần (Thứ 2):</label>
                <input
                  type="date"
                  required
                  value={bulkStartDate}
                  onChange={e => setBulkStartDate(e.target.value)}
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Day Hours Grid */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Nhập Số Giờ Làm Mỗi Ngày (Mon - Sun):</label>
                <div className="grid grid-cols-7 gap-2">
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((dayName, idx) => (
                    <div key={dayName} className="text-center space-y-1">
                      <span className="text-[10px] font-bold text-dark-400 block">{dayName}</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="24"
                        value={bulkHours[idx]}
                        onChange={e => {
                          const val = Number(e.target.value) || 0;
                          setBulkHours(prev => {
                            const next = [...prev];
                            next[idx] = val;
                            return next;
                          });
                        }}
                        className="w-full bg-dark-950 border border-dark-800 text-xs p-2 rounded-lg text-center text-emerald-400 font-mono font-bold focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Ghi Chú Cho Cả Tuần:</label>
                <input
                  type="text"
                  required
                  placeholder="Mô tả công việc thực hiện trong tuần..."
                  value={bulkNotes}
                  onChange={e => setBulkNotes(e.target.value)}
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <button
                type="submit"
                disabled={savingBulk}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 size={14} /> {savingBulk ? 'Đang lưu ma trận...' : 'Lưu Khai Báo Tuần'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Cost Visibility Warning */}
      {userRole !== 'PM' && userRole !== 'DIRECTOR' && userRole !== 'SYSTEM_ADMIN' && (
        <div className="bg-dark-900-30 border border-dark-800 p-4 rounded-xl flex items-center gap-3 text-xs text-dark-400">
          <ShieldAlert className="text-amber-500 shrink-0" size={18} />
          <p>
            Bạn đang đăng nhập với quyền <strong>{userRole}</strong>. Báo cáo tài chính tổng thể và đơn giá ngày công của thành viên (Daily Rate Cost) được mã hóa và chỉ hiển thị cho tài khoản cấp <strong>PM</strong> trở lên.
          </p>
        </div>
      )}
    </div>
  );
};
