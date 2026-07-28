import React, { useState, useEffect } from 'react';
import { X, Check, XCircle, Search, Clock, FileText, User, LayoutList, ChevronRight, DollarSign } from 'lucide-react';
import { approvalService, projectService } from '../services/api';

interface ApprovalInboxProps {
  isOpen: boolean;
  onClose: () => void;
  onApprovalProcessed: () => void;
}

export function ApprovalInbox({ isOpen, onClose, onApprovalProcessed }: ApprovalInboxProps) {
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // History Filters
  const [projects, setProjects] = useState<any[]>([]);
  const [filterProjectId, setFilterProjectId] = useState<number | ''>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');

  // Selected item detail
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
      if (activeTab === 'pending') {
        loadPending();
      } else {
        loadHistory();
      }
    }
  }, [isOpen, activeTab]);

  const loadProjects = async () => {
    try {
      const projs = await projectService.getProjects();
      setProjects(projs.filter((p: any) => p.isActive !== false));
    } catch (e) {}
  };

  const loadPending = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await approvalService.getPending();
      setPendingItems(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách chờ duyệt');
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (filterProjectId) params.projectId = filterProjectId;
      if (filterSearch) params.search = filterSearch;
      if (filterFromDate) params.fromDate = filterFromDate;
      if (filterToDate) params.toDate = filterToDate;
      
      const data = await approvalService.getHistory(params);
      setHistoryItems(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải lịch sử');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: 'APPROVE' | 'REJECT') => {
    if (!selectedItem) return;
    if (action === 'REJECT' && !actionReason.trim()) {
      alert('Vui lòng nhập lý do từ chối!');
      return;
    }

    try {
      setActionLoading(true);
      await approvalService.submitAction(selectedItem.stepId, action, actionReason);
      alert('Xử lý phê duyệt thành công!');
      setSelectedItem(null);
      setActionReason('');
      onApprovalProcessed();
      loadPending();
    } catch (err: any) {
      alert(err.message || 'Xử lý thất bại');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  const formatDate = (ds: string) => {
    if (!ds) return 'N/A';
    return new Date(ds).toLocaleString('vi-VN');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-dark-900 border border-dark-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-800 bg-dark-950">
          <div className="flex items-center gap-3 text-white">
            <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center border border-brand-500/50 shadow-[0_0_15px_rgba(var(--color-brand-500),0.3)]">
              <Check className="text-brand-400" size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold">Hộp Thư Phê Duyệt</h2>
              <p className="text-[10px] text-dark-400">Xử lý các yêu cầu đang chờ bạn phê duyệt</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-800 bg-dark-950 px-4 pt-2">
          <button
            onClick={() => { setActiveTab('pending'); setSelectedItem(null); }}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'pending'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-dark-400 hover:text-white'
            }`}
          >
            Chờ Phê Duyệt {pendingItems.length > 0 && <span className="ml-2 bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingItems.length}</span>}
          </button>
          <button
            onClick={() => { setActiveTab('history'); setSelectedItem(null); }}
            className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'history'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-dark-400 hover:text-white'
            }`}
          >
            Lịch Sử Phê Duyệt
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Panel: List */}
          <div className={`w-1/2 md:w-2/5 border-r border-dark-800 flex flex-col bg-dark-950/50 ${selectedItem ? 'hidden md:flex' : 'flex w-full'}`}>
            
            {/* History Filters */}
            {activeTab === 'history' && (
              <div className="p-3 border-b border-dark-800 space-y-2 bg-dark-900/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" size={14} />
                  <input
                    type="text"
                    placeholder="Tìm theo tên hoặc email người gửi..."
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white focus:border-brand-500 outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={filterProjectId}
                    onChange={e => setFilterProjectId(e.target.value ? Number(e.target.value) : '')}
                    className="flex-1 bg-dark-950 border border-dark-800 rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                  >
                    <option value="">Tất cả dự án</option>
                    {projects.map(p => (
                      <option key={p.projectId} value={p.projectId}>{p.projectName}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={filterFromDate}
                    onChange={e => setFilterFromDate(e.target.value)}
                    className="flex-1 bg-dark-950 border border-dark-800 rounded-lg px-2 py-1.5 text-xs text-dark-300 outline-none"
                  />
                  <input
                    type="date"
                    value={filterToDate}
                    onChange={e => setFilterToDate(e.target.value)}
                    className="flex-1 bg-dark-950 border border-dark-800 rounded-lg px-2 py-1.5 text-xs text-dark-300 outline-none"
                  />
                  <button onClick={loadHistory} className="bg-brand-600 hover:bg-brand-500 text-white px-3 rounded-lg text-xs font-semibold">
                    Lọc
                  </button>
                </div>
              </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {loading && <div className="text-center p-4 text-xs text-dark-400">Đang tải dữ liệu...</div>}
              {error && <div className="text-center p-4 text-xs text-rose-400">{error}</div>}
              
              {!loading && activeTab === 'pending' && pendingItems.length === 0 && (
                <div className="text-center p-8 text-dark-400 flex flex-col items-center">
                  <Check size={40} className="mb-2 opacity-50" />
                  <p className="text-sm font-medium">Bạn đã hoàn tất mọi công việc!</p>
                  <p className="text-[10px]">Không có yêu cầu nào đang chờ duyệt.</p>
                </div>
              )}

              {!loading && activeTab === 'history' && historyItems.length === 0 && (
                <div className="text-center p-8 text-dark-400 text-xs">
                  Không tìm thấy lịch sử phù hợp.
                </div>
              )}

              {/* Render Items */}
              {(activeTab === 'pending' ? pendingItems : historyItems).map((item, idx) => (
                <div
                  key={item.stepId}
                  onClick={() => setSelectedItem(item)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedItem?.stepId === item.stepId
                      ? 'bg-brand-500/10 border-brand-500/50 shadow-[0_0_10px_rgba(var(--color-brand-500),0.1)]'
                      : 'bg-dark-900 border-dark-800 hover:bg-dark-800 hover:border-dark-700'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-white flex items-center gap-1">
                      <FileText size={12} className="text-brand-400" /> {item.TargetType || item.targetType}
                    </span>
                    <span className="text-[10px] text-dark-400">{formatDate(activeTab === 'pending' ? item.createdDate : item.actionDate)}</span>
                  </div>
                  <div className="text-xs text-dark-300 font-medium mb-1 line-clamp-1">{item.ProjectName || item.projectName}</div>
                  <div className="text-xs text-white mb-2 line-clamp-2">{item.Description || item.description}</div>
                  
                  <div className="flex justify-between items-end mt-2">
                    <div className="flex items-center gap-1.5 text-[10px] text-dark-400">
                      <div className="w-5 h-5 rounded-full bg-dark-800 flex items-center justify-center">
                        <User size={10} />
                      </div>
                      {item.SubmitterName || item.submitterName}
                    </div>
                    {(item.Amount || item.amount) > 0 && (
                      <span className="text-xs font-bold text-rose-400">{(item.Amount || item.amount).toLocaleString('vi-VN')} đ</span>
                    )}
                    {activeTab === 'history' && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        item.stepStatus === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {item.stepStatus === 'APPROVED' ? 'ĐÃ DUYỆT' : 'TỪ CHỐI'}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel: Details */}
          <div className={`flex-1 flex flex-col bg-dark-900 overflow-hidden ${!selectedItem ? 'hidden md:flex' : 'flex'}`}>
            {selectedItem ? (
              <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                {/* Mobile Back Button */}
                <div className="md:hidden p-3 border-b border-dark-800 bg-dark-950">
                  <button onClick={() => setSelectedItem(null)} className="text-xs text-brand-400 flex items-center gap-1">
                    <ChevronRight className="rotate-180" size={14} /> Quay lại danh sách
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Header Info */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-bold text-white mb-1">Yêu cầu duyệt {selectedItem.TargetType || selectedItem.targetType}</h3>
                      <p className="text-xs text-dark-400 font-medium">{selectedItem.ProjectName || selectedItem.projectName}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-dark-500 mb-1">Người gửi</div>
                      <div className="text-sm font-semibold text-white">{selectedItem.SubmitterName || selectedItem.submitterName}</div>
                    </div>
                  </div>

                  {/* Details Card */}
                  <div className="bg-dark-950 border border-dark-800 rounded-xl p-4 space-y-3">
                    <div>
                      <div className="text-[10px] text-dark-500 font-semibold mb-1 uppercase tracking-wider">Nội dung chi tiết</div>
                      <div className="text-sm text-dark-200 whitespace-pre-wrap">{selectedItem.Description || selectedItem.description}</div>
                    </div>
                    {(selectedItem.Amount || selectedItem.amount) > 0 && (
                      <div className="pt-3 border-t border-dark-850">
                        <div className="text-[10px] text-dark-500 font-semibold mb-1 uppercase tracking-wider">Số tiền đề xuất</div>
                        <div className="text-lg font-bold text-rose-400 flex items-center gap-1">
                          {(selectedItem.Amount || selectedItem.amount).toLocaleString('vi-VN')} VNĐ
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Multi-level Approval Tracking (Only show if data exists, mainly for pending item where we fetch AllSteps) */}
                  {(selectedItem.AllSteps || selectedItem.allSteps) && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <LayoutList size={14} className="text-brand-400" /> Tiến Trình Phê Duyệt
                      </h4>
                      <div className="bg-dark-950 border border-dark-800 rounded-xl p-4">
                        <div className="space-y-4">
                          {(selectedItem.AllSteps || selectedItem.allSteps).map((step: any, i: number) => (
                            <div key={i} className="flex gap-4 relative">
                              {/* Connector line */}
                              {i < (selectedItem.AllSteps || selectedItem.allSteps).length - 1 && (
                                <div className="absolute left-[11px] top-6 bottom-[-16px] w-[2px] bg-dark-800 z-0"></div>
                              )}
                              
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 border-2 ${
                                step.stepStatus === 'APPROVED' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-500' :
                                step.stepStatus === 'REJECTED' ? 'bg-rose-500/20 border-rose-500 text-rose-500' :
                                'bg-dark-800 border-dark-700 text-dark-400'
                              }`}>
                                {step.stepStatus === 'APPROVED' ? <Check size={12} /> : 
                                 step.stepStatus === 'REJECTED' ? <X size={12} /> : 
                                 <Clock size={12} />}
                              </div>
                              
                              <div className="flex-1 pb-1">
                                <div className="flex justify-between items-start mb-0.5">
                                  <span className="text-xs font-bold text-white">Cấp {step.stepNumber}: {step.Role || step.role}</span>
                                  <span className="text-[10px] text-dark-500">{formatDate(step.actionDate)}</span>
                                </div>
                                <div className="text-[11px] text-dark-300 font-medium mb-1">{step.ApproverName || step.approverName}</div>
                                {(step.Comments || step.comments) && (
                                  <div className="text-[11px] text-dark-400 bg-dark-900 px-2 py-1.5 rounded-lg border border-dark-800 italic">
                                    "{(step.Comments || step.comments)}"
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* History Viewer (If in History Tab) */}
                  {activeTab === 'history' && (
                    <div className={`p-4 rounded-xl border ${selectedItem.stepStatus === 'APPROVED' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-rose-500/10 border-rose-500/30'}`}>
                      <h4 className={`text-xs font-bold mb-2 ${selectedItem.stepStatus === 'APPROVED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {selectedItem.stepStatus === 'APPROVED' ? 'BẠN ĐÃ PHÊ DUYỆT' : 'BẠN ĐÃ TỪ CHỐI'}
                      </h4>
                      <p className="text-xs text-dark-300 mb-1">Vào lúc: {formatDate(selectedItem.actionDate)}</p>
                      {(selectedItem.Comments || selectedItem.comments) && (
                        <p className="text-xs text-dark-200 mt-2 bg-dark-950 p-2 rounded border border-dark-800">
                          Ghi chú: {(selectedItem.Comments || selectedItem.comments)}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Action Footer (Only in Pending Tab) */}
                {activeTab === 'pending' && (
                  <div className="p-4 border-t border-dark-800 bg-dark-950 mt-auto shrink-0">
                    <textarea
                      placeholder="Nhập ghi chú hoặc lý do từ chối (bắt buộc nếu từ chối)..."
                      value={actionReason}
                      onChange={e => setActionReason(e.target.value)}
                      className="w-full bg-dark-900 border border-dark-800 rounded-xl p-3 text-xs text-white placeholder-dark-500 mb-3 outline-none focus:border-brand-500 resize-none h-20 custom-scrollbar"
                    />
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleAction('REJECT')}
                        disabled={actionLoading}
                        className="flex-1 bg-dark-800 hover:bg-rose-500/20 text-rose-400 border border-dark-700 hover:border-rose-500/50 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <XCircle size={16} /> Từ Chối
                      </button>
                      <button 
                        onClick={() => handleAction('APPROVE')}
                        disabled={actionLoading}
                        className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-brand-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <Check size={16} /> Phê Duyệt
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-dark-500 p-8">
                <FileText size={48} className="mb-4 opacity-20" />
                <p className="text-sm">Chọn một yêu cầu bên trái để xem chi tiết</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
