import React, { useState, useEffect } from 'react';
import { subTaskService, taskService, projectService, SubTaskDto, TaskNode, ProjectMemberDto } from '../services/api';
import { CheckSquare, Plus, Filter, Search, Calendar, User, Edit3, Trash2, Link, AlertCircle, CheckCircle2, Clock, Play, AlertTriangle } from 'lucide-react';

interface SubTaskManagerProps {
  projectId: number;
  userRole: string;
  currentUser?: any;
}

export const SubTaskManager: React.FC<SubTaskManagerProps> = ({ projectId, userRole, currentUser }) => {
  const [subtasks, setSubtasks] = useState<SubTaskDto[]>([]);
  const [activities, setActivities] = useState<TaskNode[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActivityId, setFilterActivityId] = useState<number | 'ALL'>('ALL');
  const [filterModule, setFilterModule] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingSubTask, setEditingSubTask] = useState<SubTaskDto | null>(null);

  // Form Fields
  const [formActivityId, setFormActivityId] = useState<number>(0);
  const [formCategory, setFormCategory] = useState<string>('Tài liệu/Doc');
  const [formModule, setFormModule] = useState<string>('GL');
  const [formDocCode, setFormDocCode] = useState<string>('BP080');
  const [formTaskName, setFormTaskName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formAssigneeId, setFormAssigneeId] = useState<number>(0);
  const [formReviewerId, setFormReviewerId] = useState<number>(0);
  const [formKeyUser, setFormKeyUser] = useState<string>('');
  const [formParty, setFormParty] = useState<string>('Partner');
  const [formStartDate, setFormStartDate] = useState<string>('');
  const [formEndDate, setFormEndDate] = useState<string>('');
  const [formDeadline, setFormDeadline] = useState<string>('');
  const [formStatus, setFormStatus] = useState<string>('1. Mới tạo');
  const [formProgress, setFormProgress] = useState<number>(0);
  const [formWeight, setFormWeight] = useState<number>(1);
  const [formAttachmentUrl, setFormAttachmentUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [subtaskData, taskTreeData, memberData] = await Promise.all([
        subTaskService.getSubTasks(projectId),
        taskService.getTaskTree(projectId),
        projectService.getProjectMembers(projectId).catch(() => [])
      ]);

      setSubtasks(subtaskData || []);
      setMembers(memberData || []);

      // Flatten Task Tree to get list of Activity nodes
      const flatList: TaskNode[] = [];
      const extractTasks = (nodes: TaskNode[]) => {
        nodes.forEach(n => {
          flatList.push(n);
          if (n.subTasks && n.subTasks.length > 0) {
            extractTasks(n.subTasks);
          }
        });
      };
      extractTasks(taskTreeData || []);
      setActivities(flatList);

    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải dữ liệu Sub-Tasks.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingSubTask(null);
    setFormActivityId(activities.length > 0 ? activities[0].taskId : 0);
    setFormCategory('Tài liệu/Doc');
    setFormModule('GL');
    setFormDocCode('BP080');
    setFormTaskName('');
    setFormDescription('');
    setFormAssigneeId(0);
    setFormReviewerId(0);
    setFormKeyUser('');
    setFormParty('Partner');
    setFormStartDate('');
    setFormEndDate('');
    setFormDeadline('');
    setFormStatus('1. Mới tạo');
    setFormProgress(0);
    setFormWeight(1);
    setFormAttachmentUrl('');
    setShowModal(true);
  };

  const handleOpenEditModal = (st: SubTaskDto) => {
    setEditingSubTask(st);
    setFormActivityId(st.activityId);
    setFormCategory(st.category || 'Tài liệu/Doc');
    setFormModule(st.module || 'GL');
    setFormDocCode(st.docCode || 'BP080');
    setFormTaskName(st.taskName);
    setFormDescription(st.description || '');
    setFormAssigneeId(st.assigneeMemberId || 0);
    setFormReviewerId(st.reviewerMemberId || 0);
    setFormKeyUser(st.keyUser || '');
    setFormParty(st.party || 'Partner');
    setFormStartDate(st.startDate ? st.startDate.split('T')[0] : '');
    setFormEndDate(st.endDate ? st.endDate.split('T')[0] : '');
    setFormDeadline(st.deadline ? st.deadline.split('T')[0] : '');
    setFormStatus(st.status || '1. Mới tạo');
    setFormProgress(st.progressPercent || 0);
    setFormWeight(st.weight || 1);
    setFormAttachmentUrl(st.attachmentUrl || '');
    setShowModal(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTaskName.trim()) {
      alert('Vui lòng nhập tên công việc!');
      return;
    }
    if (!formActivityId) {
      alert('Vui lòng chọn Activity cha trong Master Plan!');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Partial<SubTaskDto> = {
        projectId,
        activityId: formActivityId,
        category: formCategory,
        module: formModule,
        docCode: formDocCode,
        taskName: formTaskName,
        description: formDescription,
        assigneeMemberId: formAssigneeId > 0 ? formAssigneeId : undefined,
        reviewerMemberId: formReviewerId > 0 ? formReviewerId : undefined,
        keyUser: formKeyUser,
        party: formParty,
        startDate: formStartDate ? formStartDate : undefined,
        endDate: formEndDate ? formEndDate : undefined,
        deadline: formDeadline ? formDeadline : undefined,
        status: formStatus,
        progressPercent: formStatus === '4. Hoàn thành' ? 100 : Number(formProgress),
        weight: Number(formWeight),
        attachmentUrl: formAttachmentUrl
      };

      if (editingSubTask && editingSubTask.subTaskId) {
        await subTaskService.updateSubTask(editingSubTask.subTaskId, payload);
      } else {
        await subTaskService.createSubTask(payload);
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu Sub-Task.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSubTask = async (subTaskId: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa nhiệm vụ này? Tiến độ Activity cha sẽ tự động được tính toán lại.')) return;

    try {
      await subTaskService.deleteSubTask(subTaskId);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa Sub-Task.');
    }
  };

  // RBAC Helpers
  const canEditSubTask = (st: SubTaskDto) => {
    if (!currentUser) return true;
    const globalRole = (currentUser.globalRole || '').toUpperCase();
    if (globalRole === 'SYSTEM_ADMIN' || globalRole === 'SYSADMIN' || userRole === 'PM') return true;
    return st.createdByUserId === currentUser.userId;
  };

  const canDeleteSubTask = () => {
    if (!currentUser) return true;
    const globalRole = (currentUser.globalRole || '').toUpperCase();
    return globalRole === 'SYSTEM_ADMIN' || globalRole === 'SYSADMIN' || userRole === 'PM';
  };

  // Filter Logic
  const filteredSubtasks = subtasks.filter(st => {
    const matchSearch = searchTerm === '' || 
      st.taskName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (st.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (st.docCode || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchActivity = filterActivityId === 'ALL' || st.activityId === filterActivityId;
    const matchModule = filterModule === 'ALL' || st.module === filterModule;
    const matchStatus = filterStatus === 'ALL' || st.status === filterStatus;

    return matchSearch && matchActivity && matchModule && matchStatus;
  });

  const categories = ['Thảo luận/Meeting', 'Tài liệu/Doc', 'Cấu hình/Setup', 'Dev/Custom', 'Testing', 'Đào tạo/Training'];
  const modules = ['GL', 'AP', 'AR', 'PO', 'INV', 'OM', 'HCM', 'FA', 'Custom'];
  const docCodes = ['BR150', 'BP080', 'MD050', 'MD070', 'TE040', 'RD011', 'Khác'];
  const statuses = ['1. Mới tạo', '2. Đang xử lý', '3. Nghiệm thu/Review', '4. Hoàn thành', '5. Hủy'];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case '4. Hoàn thành':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold"><CheckCircle2 size={12} /> Hoàn thành</span>;
      case '2. Đang xử lý':
        return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold"><Play size={12} /> Đang xử lý</span>;
      case '3. Nghiệm thu/Review':
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold"><Clock size={12} /> Nghiệm thu</span>;
      case '5. Hủy':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 font-semibold"><AlertTriangle size={12} /> Đã hủy</span>;
      default:
        return <span className="bg-dark-800 text-dark-300 border border-dark-700 text-xs px-2.5 py-1 rounded-full font-semibold">Mới tạo</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-dark-900/40 p-4 rounded-xl border border-dark-800 gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <CheckSquare className="text-brand-500" /> Quản Lý Nhiệm Vụ Chi Tiết (Sub-Task List)
          </h2>
          <p className="text-xs text-dark-400 mt-1">Phân công công việc hàng ngày, liên kết động với Activity thuộc Master Plan để tự động tổng hợp tiến độ</p>
        </div>
        
        <button
          onClick={handleOpenCreateModal}
          className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-brand-600/10 shrink-0"
        >
          <Plus size={16} /> + Tạo Nhiệm Vụ Mới
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-dark-900/40 p-4 rounded-xl border border-dark-800">
          <p className="text-xs text-dark-400 font-medium">Tổng số nhiệm vụ</p>
          <p className="text-xl font-bold text-white mt-1">{subtasks.length}</p>
        </div>
        <div className="bg-dark-900/40 p-4 rounded-xl border border-dark-800">
          <p className="text-xs text-blue-400 font-medium">Đang xử lý</p>
          <p className="text-xl font-bold text-blue-400 mt-1">
            {subtasks.filter(st => st.status === '2. Đang xử lý').length}
          </p>
        </div>
        <div className="bg-dark-900/40 p-4 rounded-xl border border-dark-800">
          <p className="text-xs text-emerald-400 font-medium">Đã hoàn thành</p>
          <p className="text-xl font-bold text-emerald-400 mt-1">
            {subtasks.filter(st => st.status === '4. Hoàn thành').length}
          </p>
        </div>
        <div className="bg-dark-900/40 p-4 rounded-xl border border-dark-800">
          <p className="text-xs text-brand-400 font-medium">Tiến độ trung bình</p>
          <p className="text-xl font-bold text-brand-400 mt-1">
            {subtasks.length > 0 
              ? Math.round(subtasks.reduce((sum, st) => sum + (st.progressPercent || 0), 0) / subtasks.length) 
              : 0}%
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-dark-900/30 p-4 rounded-xl border border-dark-800 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400" />
            <input 
              type="text" 
              placeholder="Tìm kiếm nhiệm vụ, mã doc..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-dark-950 border border-dark-750 text-xs pl-9 pr-3 py-2 rounded-lg text-white placeholder:text-dark-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={14} className="text-dark-400" />
            <select 
              value={filterActivityId}
              onChange={(e) => setFilterActivityId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="bg-dark-950 border border-dark-750 text-xs p-2 rounded-lg text-dark-200 focus:outline-none focus:border-brand-500 max-w-[180px]"
            >
              <option value="ALL">-- Tất cả Activity --</option>
              {activities.map(act => (
                <option key={act.taskId} value={act.taskId}>[{act.taskCode}] {act.taskName}</option>
              ))}
            </select>
          </div>

          <select 
            value={filterModule}
            onChange={(e) => setFilterModule(e.target.value)}
            className="bg-dark-950 border border-dark-750 text-xs p-2 rounded-lg text-dark-200 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">-- Tất cả Module --</option>
            {modules.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-dark-950 border border-dark-750 text-xs p-2 rounded-lg text-dark-200 focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">-- Tất cả Trạng thái --</option>
            {statuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          <p className="text-xs text-dark-400 mt-2">Đang tải danh sách nhiệm vụ...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-4 rounded-xl">
          Lỗi: {error}
        </div>
      ) : (
        <div className="overflow-x-auto bg-dark-900/20 rounded-2xl border border-dark-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-dark-900/60 border-b border-dark-800 text-dark-400 text-[11px] uppercase font-bold">
                <th className="py-3 px-4">Activity (Master Plan)</th>
                <th className="py-3 px-4">Tên Công Việc (Sub-Task)</th>
                <th className="py-3 px-4">Phân loại & Module</th>
                <th className="py-3 px-4">RACI (PIC / Reviewer)</th>
                <th className="py-3 px-4">Hạn (Deadline)</th>
                <th className="py-3 px-4">Tiến độ (%)</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-850">
              {filteredSubtasks.length > 0 ? (
                filteredSubtasks.map((st) => {
                  const canEdit = canEditSubTask(st);
                  const canDelete = canDeleteSubTask();

                  return (
                    <tr key={st.subTaskId} className="hover:bg-dark-800/40 transition-colors text-xs">
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] bg-dark-850 text-brand-400 px-2 py-0.5 rounded border border-dark-800 block w-fit mb-1">
                          {st.activityCode}
                        </span>
                        <p className="text-white font-medium truncate max-w-[160px]" title={st.activityName}>{st.activityName}</p>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <p className="text-white font-semibold">{st.taskName}</p>
                        {st.description && <p className="text-[11px] text-dark-400 truncate mt-0.5" title={st.description}>{st.description}</p>}
                        {st.attachmentUrl && (
                          <a href={st.attachmentUrl} target="_blank" rel="noreferrer" className="text-[10px] text-brand-400 hover:underline flex items-center gap-1 mt-1">
                            <Link size={10} /> Link tài liệu
                          </a>
                        )}
                      </td>
                      <td className="py-3 px-4 space-y-1">
                        <div className="flex gap-1.5 flex-wrap">
                          <span className="bg-dark-850 text-dark-300 text-[10px] font-bold px-2 py-0.5 rounded border border-dark-800">
                            {st.module || 'GL'}
                          </span>
                          <span className="bg-dark-850 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded border border-dark-800">
                            {st.docCode || 'Doc'}
                          </span>
                        </div>
                        <p className="text-[10px] text-dark-400">{st.category}</p>
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="text-dark-200 font-medium flex items-center gap-1">
                            <User size={12} className="text-brand-400" /> PIC: {st.assigneeName || 'Chưa giao'}
                          </p>
                          {st.reviewerName && <p className="text-[10px] text-dark-400 mt-0.5">Reviewer: {st.reviewerName}</p>}
                          {st.party && <p className="text-[10px] text-dark-500 italic mt-0.5">Bên: {st.party}</p>}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-dark-300">
                        {st.deadline ? new Date(st.deadline).toLocaleDateString('vi-VN') : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-dark-800 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`h-full ${st.status === '4. Hoàn thành' ? 'bg-emerald-500' : 'bg-brand-500'}`} 
                              style={{ width: `${st.progressPercent || 0}%` }}
                            />
                          </div>
                          <span className="font-mono text-xs font-bold text-white">{st.progressPercent || 0}%</span>
                        </div>
                        {st.weight && st.weight > 1 && (
                          <span className="text-[9px] text-rose-400 font-semibold block mt-1">Trọng số: x{st.weight}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">{getStatusBadge(st.status || '1. Mới tạo')}</td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {canEdit && (
                          <button 
                            onClick={() => handleOpenEditModal(st)}
                            className="text-brand-400 hover:text-brand-300 p-1.5 hover:bg-dark-800 rounded-lg transition-colors"
                            title="Sửa công việc"
                          >
                            <Edit3 size={14} />
                          </button>
                        )}
                        {canDelete && (
                          <button 
                            onClick={() => handleDeleteSubTask(st.subTaskId!)}
                            className="text-rose-400 hover:text-rose-300 p-1.5 hover:bg-dark-800 rounded-lg transition-colors"
                            title="Xóa công việc (PM)"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-dark-500 text-xs">
                    Chưa có nhiệm vụ Sub-Task nào phù hợp với bộ lọc.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Form Create/Edit */}
      {showModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-dark-900 border border-dark-800 p-6 rounded-2xl shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <CheckSquare className="text-brand-500" /> {editingSubTask ? 'Chỉnh Sửa Nhiệm Vụ Sub-Task' : 'Tạo Nhiệm Vụ Sub-Task Mới'}
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-xs text-dark-400 hover:text-white"
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="space-y-4 text-left">
              {/* Linked Activity & Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Activity thuộc Master Plan (*):</label>
                  <select
                    value={formActivityId}
                    onChange={(e) => setFormActivityId(Number(e.target.value))}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    required
                  >
                    <option value={0}>-- Chọn Activity --</option>
                    {activities.map(act => (
                      <option key={act.taskId} value={act.taskId}>[{act.taskCode}] {act.taskName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Phân loại (Category):</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Module & Doc Code */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Phân hệ (Module):</label>
                  <select
                    value={formModule}
                    onChange={(e) => setFormModule(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    {modules.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Mã tài liệu (Doc Code):</label>
                  <select
                    value={formDocCode}
                    onChange={(e) => setFormDocCode(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    {docCodes.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Task Name */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Tên công việc (Task Name) (*):</label>
                <input 
                  type="text" 
                  value={formTaskName}
                  onChange={(e) => setFormTaskName(e.target.value)}
                  placeholder="Nhập tên chi tiết nhiệm vụ cần làm..."
                  className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Mô tả công việc:</label>
                <textarea 
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ghi chú chi tiết yêu cầu..."
                  className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Personnel RACI */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Giao cho (PIC):</label>
                  <select
                    value={formAssigneeId}
                    onChange={(e) => setFormAssigneeId(Number(e.target.value))}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value={0}>-- Chưa phân công --</option>
                    {members.map((m: any) => (
                      <option key={m.projectMemberId} value={m.projectMemberId}>{m.fullName} ({m.roleName})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Reviewer:</label>
                  <select
                    value={formReviewerId}
                    onChange={(e) => setFormReviewerId(Number(e.target.value))}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value={0}>-- Chưa phân công --</option>
                    {members.map((m: any) => (
                      <option key={m.projectMemberId} value={m.projectMemberId}>{m.fullName} ({m.roleName})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Bên liên quan (Party):</label>
                  <select
                    value={formParty}
                    onChange={(e) => setFormParty(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="Partner">Partner (Đơn vị TK)</option>
                    <option value="Client">Client (Khách hàng)</option>
                    <option value="Third Party">Third Party</option>
                  </select>
                </div>
              </div>

              {/* Dates & Deadline */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Ngày bắt đầu:</label>
                  <input 
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Ngày kết thúc:</label>
                  <input 
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Hạn dứt điểm (Deadline):</label>
                  <input 
                    type="date"
                    value={formDeadline}
                    onChange={(e) => setFormDeadline(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Status & Progress & Weight */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Trạng thái:</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    {statuses.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold flex justify-between">
                    <span>% Hoàn thành:</span>
                    <span className="font-mono text-brand-400">{formStatus === '4. Hoàn thành' ? '100%' : `${formProgress}%`}</span>
                  </label>
                  <input 
                    type="number"
                    min="0"
                    max="100"
                    disabled={formStatus === '4. Hoàn thành'}
                    value={formStatus === '4. Hoàn thành' ? 100 : formProgress}
                    onChange={(e) => setFormProgress(Number(e.target.value))}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2 rounded-xl text-white focus:outline-none focus:border-brand-500 disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Mức ưu tiên / Trọng số:</label>
                  <select
                    value={formWeight}
                    onChange={(e) => setFormWeight(Number(e.target.value))}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value={1}>1. Bình thường (Trọng số 1)</option>
                    <option value={2}>2. Quan trọng (Trọng số 2)</option>
                    <option value={3}>3. Gấp / Ưu tiên cao (Trọng số 3)</option>
                  </select>
                </div>
              </div>

              {/* Attachment Link */}
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Link đính kèm tài liệu (SharePoint / Drive):</label>
                <input 
                  type="url" 
                  value={formAttachmentUrl}
                  onChange={(e) => setFormAttachmentUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 justify-end pt-4 border-t border-dark-850">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-dark-800 hover:bg-dark-750 text-white font-bold text-xs py-2 px-4 rounded-xl border border-dark-700"
                >
                  Đóng
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-lg shadow-brand-600/10 disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : (editingSubTask ? 'Cập Nhật Nhiệm Vụ' : 'Tạo Nhiệm Vụ')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
