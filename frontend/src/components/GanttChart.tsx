import React, { useState, useEffect } from 'react';
import { taskService, projectService, teamService, TaskNode, ProjectCalendarSettings, TeamMemberDto } from '../services/api';
import { Calendar, ChevronRight, ChevronDown, CheckCircle2, AlertTriangle, Play, HelpCircle, Plus, EyeOff, Settings, Users, Clock, FileText } from 'lucide-react';

interface GanttChartProps {
  projectId: number;
  userRole: string;
}

export const GanttChart: React.FC<GanttChartProps> = ({ projectId, userRole }) => {
  const [tasks, setTasks] = useState<TaskNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskNode | null>(null);

  // Edit Mode state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editProgress, setEditProgress] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<string>('NOT_STARTED');
  const [editIsManualProgress, setEditIsManualProgress] = useState<boolean>(false);

  // Project Members for Resource Assignment dropdown
  const [projectMembers, setProjectMembers] = useState<TeamMemberDto[]>([]);

  // Project Calendar Settings & Engine
  const [calendarSettings, setCalendarSettings] = useState<ProjectCalendarSettings>({
    projectId,
    workDaysOfWeek: 'MON,TUE,WED,THU,FRI',
    standardHoursPerDay: 8,
    holidaysJson: '["2026-01-01","2026-04-30","2026-05-01","2026-09-02"]'
  });
  const [showCalendarModal, setShowCalendarModal] = useState<boolean>(false);

  // Task Creation & Form Modal State (3-Tab Primavera P6 Style)
  const [isCreatingTask, setIsCreatingTask] = useState<boolean>(false);
  const [activeTabModal, setActiveTabModal] = useState<'info' | 'schedule' | 'resource'>('info');

  // Form Fields
  const [createLevel, setCreateLevel] = useState<number>(1);
  const [createParentTaskId, setCreateParentTaskId] = useState<number | null>(null);
  const [createTaskCode, setCreateTaskCode] = useState<string>('');
  const [createTaskName, setCreateTaskName] = useState<string>('');
  const [createDescription, setCreateDescription] = useState<string>('');
  const [createAimCode, setCreateAimCode] = useState<string>('BR150');
  const [createModule, setCreateModule] = useState<string>('PO');
  const [createStartDate, setCreateStartDate] = useState<string>('');
  const [createDuration, setCreateDuration] = useState<number>(10);
  const [createEndDate, setCreateEndDate] = useState<string>('');
  const [createAssigneeMemberId, setCreateAssigneeMemberId] = useState<number | undefined>(undefined);
  const [createKeyUser, setCreateKeyUser] = useState<string>('');
  const [createParty, setCreateParty] = useState<string>('');
  const [createStatus, setCreateStatus] = useState<string>('NOT_STARTED');
  const [createPredecessorId, setCreatePredecessorId] = useState<number | undefined>(undefined);
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);

  useEffect(() => {
    loadTasks();
    loadCalendar();
    loadTeamMembers();
  }, [projectId]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await taskService.getTaskTree(projectId);
      setTasks(data);
      
      const initialExpanded: Record<number, boolean> = {};
      data.forEach(t => {
        initialExpanded[t.taskId] = true;
      });
      setExpandedNodes(initialExpanded);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh sách công việc.');
    } finally {
      setLoading(false);
    }
  };

  const loadCalendar = async () => {
    try {
      const cal = await projectService.getCalendarSettings(projectId);
      if (cal) setCalendarSettings(cal);
    } catch (err) {
      console.warn('Calendar settings not found, using default Mon-Fri.');
    }
  };

  const loadTeamMembers = async () => {
    try {
      const data = await teamService.getTeams(projectId);
      if (data && data.members) {
        setProjectMembers(data.members.filter(m => m.isActive));
      }
    } catch (err) {
      console.warn('Failed to load project members for resource dropdown.');
    }
  };

  // -------------------------------------------------------------
  // WORKDAY & CALENDAR CALCULATION ENGINE
  // -------------------------------------------------------------
  const parseWorkDays = (workDaysStr: string): number[] => {
    // Returns array of JS Day indices (0 = Sun, 1 = Mon, ..., 6 = Sat)
    const list: number[] = [];
    if (workDaysStr.includes('SUN')) list.push(0);
    if (workDaysStr.includes('MON')) list.push(1);
    if (workDaysStr.includes('TUE')) list.push(2);
    if (workDaysStr.includes('WED')) list.push(3);
    if (workDaysStr.includes('THU')) list.push(4);
    if (workDaysStr.includes('FRI')) list.push(5);
    if (workDaysStr.includes('SAT')) list.push(6);
    return list.length > 0 ? list : [1, 2, 3, 4, 5];
  };

  const parseHolidays = (holidaysJsonStr: string): string[] => {
    try {
      return JSON.parse(holidaysJsonStr || '[]');
    } catch {
      return [];
    }
  };

  const isWorkingDay = (date: Date): boolean => {
    const validDays = parseWorkDays(calendarSettings.workDaysOfWeek);
    const dayOfWeek = date.getDay();
    if (!validDays.includes(dayOfWeek)) return false;

    const dateIso = date.toISOString().split('T')[0];
    const holidays = parseHolidays(calendarSettings.holidaysJson);
    if (holidays.includes(dateIso)) return false;

    return true;
  };

  // Add working days to StartDate -> calculates EndDate
  const addWorkingDays = (startDateStr: string, workingDays: number): string => {
    if (!startDateStr || workingDays <= 0) return startDateStr;
    let curr = new Date(startDateStr);
    let added = 0;
    while (added < workingDays - 1) {
      curr.setDate(curr.getDate() + 1);
      if (isWorkingDay(curr)) {
        added++;
      }
    }
    return curr.toISOString().split('T')[0];
  };

  // Calculate working days count between StartDate and EndDate
  const calculateWorkingDays = (startDateStr: string, endDateStr: string): number => {
    if (!startDateStr || !endDateStr) return 1;
    let curr = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (curr > end) return 1;

    let count = 0;
    while (curr <= end) {
      if (isWorkingDay(curr)) {
        count++;
      }
      curr.setDate(curr.getDate() + 1);
    }
    return Math.max(count, 1);
  };

  // -------------------------------------------------------------
  // FORM HANDLERS & TWO-WAY SYNC
  // -------------------------------------------------------------
  const handleStartDateChange = (val: string) => {
    setCreateStartDate(val);
    if (val && createDuration > 0) {
      const computedEnd = addWorkingDays(val, createDuration);
      setCreateEndDate(computedEnd);
    }
  };

  const handleDurationChange = (days: number) => {
    setCreateDuration(days);
    if (createStartDate && days > 0) {
      const computedEnd = addWorkingDays(createStartDate, days);
      setCreateEndDate(computedEnd);
    }
  };

  const handleEndDateChange = (val: string) => {
    setCreateEndDate(val);
    if (createStartDate && val) {
      const computedDays = calculateWorkingDays(createStartDate, val);
      setCreateDuration(computedDays);
    }
  };

  const toggleExpand = (taskId: number) => {
    setExpandedNodes(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const handleOpenCreateTaskModal = (level: number, parentTask?: TaskNode) => {
    setCreateLevel(level);
    setCreateParentTaskId(parentTask ? parentTask.taskId : null);
    setCreateTaskCode(parentTask ? `${parentTask.taskCode}.${(parentTask.subTasks?.length || 0) + 1}` : `${tasks.length + 1}`);
    setCreateTaskName('');
    setCreateDescription('');
    setCreateAimCode('BR150');
    setCreateModule('PO');
    
    const today = new Date().toISOString().split('T')[0];
    const initialDuration = 10;
    setCreateStartDate(today);
    setCreateDuration(initialDuration);
    setCreateEndDate(addWorkingDays(today, initialDuration));
    
    setCreateAssigneeMemberId(undefined);
    setCreateKeyUser('');
    setCreateParty('');
    setCreateStatus('NOT_STARTED');
    setCreatePredecessorId(undefined);
    setActiveTabModal('info');
    setIsCreatingTask(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTaskCode.trim() || !createTaskName.trim()) {
      alert('Vui lòng nhập Mã và Tên công việc!');
      return;
    }

    setCreateSubmitting(true);
    try {
      await taskService.saveTask({
        taskId: 0,
        projectId,
        taskCode: createTaskCode.trim(),
        taskName: createTaskName.trim(),
        description: createDescription,
        taskLevel: createLevel,
        parentTaskId: createParentTaskId,
        startDatePlanned: createStartDate ? new Date(createStartDate).toISOString() : new Date().toISOString(),
        endDatePlanned: createEndDate ? new Date(createEndDate).toISOString() : new Date().toISOString(),
        durationPlanned: createDuration,
        progressPercent: 0,
        status: createStatus,
        isVisibleToAll: true,
        visibilityScope: 'PUBLIC',
        aimCode: createAimCode,
        module: createModule,
        assigneeMemberId: createAssigneeMemberId,
        keyUser: createKeyUser,
        party: createParty,
        predecessorTaskIds: createPredecessorId ? [createPredecessorId] : []
      });

      setIsCreatingTask(false);
      loadTasks();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tạo công việc mới.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const selectTaskForUpdate = (task: TaskNode) => {
    setSelectedTask(task);
    setEditProgress(task.progressPercent);
    setEditStatus(task.status);
    setEditIsManualProgress(!!task.isManualProgress);
    setIsEditing(true);
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    try {
      if (editIsManualProgress !== selectedTask.isManualProgress || editIsManualProgress) {
        await taskService.toggleProgressMode(selectedTask.taskId, editIsManualProgress, Number(editProgress));
      }

      await taskService.saveTask({
        ...selectedTask,
        projectId,
        progressPercent: Number(editProgress),
        status: editStatus,
        isManualProgress: editIsManualProgress
      });

      setIsEditing(false);
      setSelectedTask(null);
      loadTasks();
    } catch (err: any) {
      alert(err.message || 'Lỗi cập nhật tiến độ.');
    }
  };

  const handleSaveCalendarSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await projectService.saveCalendarSettings(calendarSettings);
      setShowCalendarModal(false);
      alert('Đã cập nhật Lịch làm việc Dự án!');
    } catch (err: any) {
      alert(err.message || 'Lỗi cập nhật lịch dự án.');
    }
  };

  // Helper to format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('vi-VN');
  };

  // Render status badge
  const renderStatus = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><CheckCircle2 size={12} /> Hoàn thành</span>;
      case 'IN_PROGRESS':
        return <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><Play size={12} /> Đang chạy</span>;
      case 'DELAYED':
        return <span className="bg-rose-500/10 text-rose-400 border border-rose-500/20 text-xs px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><AlertTriangle size={12} /> Trễ hạn</span>;
      case 'PENDING_APPROVAL':
        return <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><HelpCircle size={12} /> Chờ duyệt</span>;
      default:
        return <span className="bg-dark-700 text-dark-300 border border-dark-600 text-xs px-2 py-0.5 rounded-full w-fit">Chưa chạy</span>;
    }
  };

  // Helper to flatten tasks for Predecessor Selector
  const flattenTasks = (nodes: TaskNode[]): TaskNode[] => {
    let result: TaskNode[] = [];
    nodes.forEach(n => {
      result.push(n);
      if (n.subTasks && n.subTasks.length > 0) {
        result = result.concat(flattenTasks(n.subTasks));
      }
    });
    return result;
  };

  const allFlatTasks = flattenTasks(tasks);

  // Render a task node in the Tree Grid recursively
  const renderTaskRow = (task: TaskNode, depth: number = 0): React.ReactNode => {
    const isExpanded = !!expandedNodes[task.taskId];
    const hasSubtasks = task.subTasks && task.subTasks.length > 0;

    return (
      <React.Fragment key={task.taskId}>
        {/* Row detail */}
        <tr className={`border-b border-dark-800 hover:bg-dark-800/40 transition-colors ${task.taskLevel === 1 ? 'bg-dark-900/30 font-semibold' : ''}`}>
          <td className="py-3 px-4" style={{ paddingLeft: `${depth * 20 + 16}px` }}>
            <div className="flex items-center gap-2">
              {hasSubtasks ? (
                <button onClick={() => toggleExpand(task.taskId)} className="text-dark-400 hover:text-white">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              ) : (
                <span className="w-4"></span>
              )}
              <span className="text-xs text-dark-500 font-mono w-12">{task.taskCode}</span>
              <span className="truncate max-w-xs">{task.taskName}</span>
              {!task.isVisibleToAll && <span title="Chỉ mình tôi thấy"><EyeOff size={14} className="text-rose-400" /></span>}
            </div>
          </td>
          <td className="py-3 px-4 text-xs text-dark-300 font-medium">
            {task.taskLevel === 1 ? 'Phase' : task.taskLevel === 2 ? 'Stream' : task.taskLevel === 3 ? 'Deliverable' : 'Action Task'}
          </td>
          <td className="py-3 px-4 text-xs text-dark-400">
            {task.assigneeName ? (
              <div>
                <p className="text-dark-200 font-medium">{task.assigneeName}</p>
                <p className="text-[10px] text-brand-400">{task.assigneeTeam || 'ARON'}</p>
              </div>
            ) : '-'}
          </td>
          <td className="py-3 px-4 text-xs font-mono text-dark-300">
            {formatDate(task.startDatePlanned)} - {formatDate(task.endDatePlanned)}
            <span className="block text-[10px] text-dark-500">{task.durationPlanned || 1} ngày làm việc</span>
          </td>
          <td className="py-3 px-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-20 bg-dark-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-full ${task.status === 'DELAYED' ? 'bg-rose-500' : 'bg-brand-500'}`} 
                    style={{ width: `${task.progressPercent}%` }}
                  ></div>
                </div>
                <span className="text-xs font-mono font-semibold">{task.progressPercent}%</span>
              </div>
              {task.isManualProgress ? (
                <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 block w-fit">
                  [Thủ công bởi PM]
                </span>
              ) : task.subTaskCount ? (
                <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 block w-fit">
                  [Auto: {task.subTaskCount} Sub-Tasks]
                </span>
              ) : null}
            </div>
          </td>
          <td className="py-3 px-4">{renderStatus(task.status)}</td>
          <td className="py-3 px-4 text-right space-x-2">
            {(userRole === 'PM' || userRole === 'LEADER' || userRole === 'PC' || userRole === 'SYSTEM_ADMIN') && task.taskLevel < 4 && (
              <button 
                onClick={() => handleOpenCreateTaskModal(task.taskLevel + 1, task)}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium hover:underline"
              >
                + Task Con
              </button>
            )}
            {(userRole === 'PM' || userRole === 'LEADER' || userRole === 'PC' || task.assigneeName) && (
              <button 
                onClick={() => selectTaskForUpdate(task)}
                className="text-xs text-brand-400 hover:text-brand-300 font-medium hover:underline"
              >
                Cập nhật
              </button>
            )}
          </td>
        </tr>

        {/* Render child nodes if expanded */}
        {hasSubtasks && isExpanded && task.subTasks.map(child => renderTaskRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex justify-between items-center bg-dark-900/40 p-4 rounded-xl border border-dark-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="text-brand-500" /> Kế hoạch dự án - Master Plan
          </h2>
          <p className="text-xs text-dark-400 mt-1">
            Phân cấp công việc WBS 4 cấp (Phase, Stream, AIM Deliverable, Action Task) liên kết động với Workday Calendar Engine
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {(userRole === 'PM' || userRole === 'SYSTEM_ADMIN' || userRole === 'PC') && (
            <button 
              onClick={() => setShowCalendarModal(true)}
              className="bg-dark-800 hover:bg-dark-700 text-dark-200 text-xs px-3 py-2 rounded-lg font-semibold flex items-center gap-1.5 border border-dark-700 transition-all"
            >
              <Settings size={14} className="text-brand-400" /> Lịch Dự Án
            </button>
          )}

          {(userRole === 'PM' || userRole === 'SYSTEM_ADMIN' || userRole === 'PC') && (
            <button 
              onClick={() => handleOpenCreateTaskModal(1)}
              className="bg-brand-600 hover:bg-brand-500 text-white text-xs px-3 py-2 rounded-lg font-semibold flex items-center gap-1 transition-all shadow-lg shadow-brand-600/10"
            >
              <Plus size={14} /> Thêm Task Giai Đoạn (Cấp 1)
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          <p className="text-xs text-dark-400 mt-2">Đang tải cấu trúc công việc...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-4 rounded-lg">
          Lỗi: {error}
        </div>
      ) : (
        <div className="overflow-x-auto bg-dark-900/20 rounded-xl border border-dark-800">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-dark-900/60 border-b border-dark-800 text-dark-400 text-xs uppercase font-bold">
                <th className="py-3 px-4 w-1/3">Tên Công Việc / Phân Cấp (WBS)</th>
                <th className="py-3 px-4">Cấp độ</th>
                <th className="py-3 px-4">Người phụ trách</th>
                <th className="py-3 px-4">Thời gian Kế hoạch</th>
                <th className="py-3 px-4">Tiến độ</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length > 0 ? (
                tasks.map(task => renderTaskRow(task))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-dark-500 text-xs">
                    Chưa khai báo danh mục công việc cho dự án này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Task Update Progress Modal */}
      {isEditing && selectedTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <form onSubmit={handleUpdateTask} className="bg-dark-900 border border-dark-800 max-w-md w-full p-6 rounded-2xl shadow-2xl space-y-4 animate-slide-up">
            <h3 className="text-md font-bold text-white border-b border-dark-800 pb-2">
              Cập Nhật Tiến Độ Công Việc
            </h3>
            
            <div>
              <p className="text-xs text-dark-400 font-mono">{selectedTask.taskCode}</p>
              <p className="text-sm font-semibold text-brand-300 mt-0.5">{selectedTask.taskName}</p>
            </div>

            {/* PM Progress Engine Toggle */}
            {(userRole === 'PM' || userRole === 'SYSTEM_ADMIN') && (
              <div className="bg-dark-950 p-3 rounded-xl border border-dark-800 space-y-2">
                <label className="flex items-center justify-between text-xs text-dark-200 font-semibold cursor-pointer">
                  <span>Chế độ Tiến độ (PM Manual Override):</span>
                  <input 
                    type="checkbox"
                    checked={editIsManualProgress}
                    onChange={(e) => setEditIsManualProgress(e.target.checked)}
                    className="accent-brand-500 h-4 w-4 rounded cursor-pointer"
                  />
                </label>
                <p className="text-[10px] text-dark-400">
                  {editIsManualProgress 
                    ? 'Bật chế độ Nhập đè Thủ công (Hiển thị nhãn [Thủ công bởi PM]).' 
                    : 'Bật chế độ Tự động (Tự động tổng hợp % từ các Sub-Task thuộc Activity).'}
                </p>
              </div>
            )}

            {/* Slider for Progress */}
            <div className="space-y-2">
              <label className="text-xs text-dark-300 flex justify-between font-semibold">
                <span>Tiến độ hoàn thành:</span>
                <span className="font-mono text-brand-400">{editProgress}%</span>
              </label>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={editProgress}
                onChange={(e) => setEditProgress(Number(e.target.value))}
                className="w-full h-1.5 bg-dark-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
              />
            </div>

            {/* Status dropdown */}
            <div className="space-y-1">
              <label className="text-xs text-dark-300 font-semibold">Trạng thái công việc:</label>
              <select 
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full bg-dark-800 border border-dark-700 text-xs p-2 rounded-lg text-dark-100 focus:outline-none focus:border-brand-500"
              >
                <option value="NOT_STARTED">Chưa chạy (Not Started)</option>
                <option value="IN_PROGRESS">Đang triển khai (In Progress)</option>
                <option value="PENDING_APPROVAL">Chờ duyệt (Pending Approval)</option>
                <option value="COMPLETED">Hoàn thành (Completed)</option>
                <option value="DELAYED">Trễ tiến độ (Delayed)</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t border-dark-800">
              <button 
                type="button" 
                onClick={() => setIsEditing(false)}
                className="bg-dark-800 hover:bg-dark-700 text-xs px-4 py-2 rounded-lg font-semibold text-white"
              >
                Đóng
              </button>
              <button 
                type="submit" 
                className="bg-brand-600 hover:bg-brand-500 text-white text-xs px-4 py-2 rounded-lg font-semibold"
              >
                Lưu Thay Đổi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 3-TAB PRIMAVERA P6 STYLE TASK CREATION MODAL */}
      {isCreatingTask && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <form onSubmit={handleCreateTask} className="bg-dark-900 border border-dark-800 max-w-2xl w-full p-6 rounded-2xl shadow-2xl space-y-5 animate-slide-up">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-dark-800 pb-3">
              <div>
                <h3 className="text-md font-bold text-white flex items-center gap-2">
                  <Plus className="text-brand-500" size={18} />
                  {createLevel === 1 ? 'Khởi Tạo Task Giai Đoạn (Cấp 1 - Phase)' : createLevel === 2 ? 'Khởi Tạo Sub-Stream (Cấp 2)' : createLevel === 3 ? 'Khởi Tạo Deliverable (Cấp 3)' : 'Khởi Tạo Action Task (Cấp 4)'}
                </h3>
                <p className="text-[11px] text-dark-400 mt-0.5">
                  Chuẩn quản trị Master Plan ERP tích hợp Lịch làm việc & Phân bổ Nguồn lực
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsCreatingTask(false)}
                className="text-xs text-dark-400 hover:text-white"
              >
                Đóng
              </button>
            </div>

            {/* 3 TAB NAVIGATION BUTTONS */}
            <div className="flex border-b border-dark-800 gap-2">
              <button
                type="button"
                onClick={() => setActiveTabModal('info')}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition-all ${
                  activeTabModal === 'info'
                    ? 'border-brand-500 text-brand-400 bg-brand-500/10'
                    : 'border-transparent text-dark-400 hover:text-dark-200'
                }`}
              >
                <FileText size={14} /> 1. Thông Tin & Phân Loại Oracle
              </button>
              <button
                type="button"
                onClick={() => setActiveTabModal('schedule')}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition-all ${
                  activeTabModal === 'schedule'
                    ? 'border-brand-500 text-brand-400 bg-brand-500/10'
                    : 'border-transparent text-dark-400 hover:text-dark-200'
                }`}
              >
                <Clock size={14} /> 2. Thời Gian & Tiến Độ
              </button>
              <button
                type="button"
                onClick={() => setActiveTabModal('resource')}
                className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-xs font-semibold border-b-2 transition-all ${
                  activeTabModal === 'resource'
                    ? 'border-brand-500 text-brand-400 bg-brand-500/10'
                    : 'border-transparent text-dark-400 hover:text-dark-200'
                }`}
              >
                <Users size={14} /> 3. Nhân Sự & Đội Ngũ
              </button>
            </div>

            {/* TAB 1: THÔNG TIN CƠ BẢN & PHÂN LOẠI ORACLE */}
            {activeTabModal === 'info' && (
              <div className="space-y-4 animate-fade-in">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Mã WBS / Task Code (*):</label>
                    <input 
                      type="text" 
                      value={createTaskCode}
                      onChange={(e) => setCreateTaskCode(e.target.value)}
                      placeholder="VD: 1, 1.1, 1.1.2..."
                      className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Tên Công Việc / Activity (*):</label>
                    <input 
                      type="text" 
                      value={createTaskName}
                      onChange={(e) => setCreateTaskName(e.target.value)}
                      placeholder="VD: Khảo Sát Quy Trình Quản Lý Kho & Mua Hàng..."
                      className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Mã Tài Liệu Oracle (AIM/OUM):</label>
                    <select
                      value={createAimCode}
                      onChange={(e) => setCreateAimCode(e.target.value)}
                      className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="BR150">BR150 - Business Requirement</option>
                      <option value="BP080">BP080 - Business Process Design</option>
                      <option value="MD050">MD050 - Functional Design Spec</option>
                      <option value="MD070">MD070 - Technical Extension Spec</option>
                      <option value="DO070">DO070 - Installation Manual</option>
                      <option value="TE040">TE040 - System Test Script</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Phân Hệ Oracle (Module):</label>
                    <select
                      value={createModule}
                      onChange={(e) => setCreateModule(e.target.value)}
                      className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="PO">PO - Purchasing Management</option>
                      <option value="AP">AP - Accounts Payable</option>
                      <option value="GL">GL - General Ledger</option>
                      <option value="AR">AR - Accounts Receivable</option>
                      <option value="INV">INV - Inventory Management</option>
                      <option value="OM">OM - Order Management</option>
                      <option value="RICEFW">RICEFW - Custom Dev</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Mô Tả Chi Tiết / Phạm Vi Công Việc:</label>
                  <textarea 
                    rows={3}
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder="Nhập phạm vi thực hiện, kết quả bàn giao dự kiến..."
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            )}

            {/* TAB 2: THỜI GIAN & TIẾN ĐỘ (CALENDAR ENGINE) */}
            {activeTabModal === 'schedule' && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-dark-950 p-3 rounded-xl border border-dark-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-brand-300 flex items-center gap-1.5">
                      <Clock size={14} /> Workday Engine Activated
                    </p>
                    <p className="text-[11px] text-dark-400 mt-0.5">
                      Lịch làm việc: {calendarSettings.workDaysOfWeek} ({calendarSettings.standardHoursPerDay}h/ngày). Tự động loại trừ T7, CN & Ngày lễ.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Ngày Bắt Đầu:</label>
                    <input 
                      type="date" 
                      value={createStartDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Thời Lượng (Duration):</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        min="1"
                        max="365"
                        value={createDuration}
                        onChange={(e) => handleDurationChange(Number(e.target.value))}
                        className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 pr-14 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
                        required
                      />
                      <span className="absolute right-2.5 top-2.5 text-[11px] text-dark-400 font-semibold">ngày làm việc</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Ngày Kết Thúc (Tự Tính):</label>
                    <input 
                      type="date" 
                      value={createEndDate}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Công Việc Phụ Thuộc (Predecessor):</label>
                  <select
                    value={createPredecessorId || ''}
                    onChange={(e) => setCreatePredecessorId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="">-- Không có Task phụ thuộc trước --</option>
                    {allFlatTasks.map(t => (
                      <option key={t.taskId} value={t.taskId}>
                        {t.taskCode} - {t.taskName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Trạng Thái Công Việc Initial:</label>
                  <select
                    value={createStatus}
                    onChange={(e) => setCreateStatus(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="NOT_STARTED">Chưa chạy (Not Started)</option>
                    <option value="IN_PROGRESS">Đang triển khai (In Progress)</option>
                    <option value="PENDING_APPROVAL">Chờ duyệt (Pending Approval)</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB 3: NHÂN SỰ & ĐỘI NGŨ DỰ ÁN (PROJECT TEAM MAPPING) */}
            {activeTabModal === 'resource' && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold flex items-center justify-between">
                    <span>PIC / Người Phụ Trách Trực Tiếp (Responsible):</span>
                    <span className="text-[10px] text-brand-400">Được lấy từ menu [Đội Ngũ Dự Án]</span>
                  </label>
                  <select
                    value={createAssigneeMemberId || ''}
                    onChange={(e) => setCreateAssigneeMemberId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="">-- Chọn Nhân Sự Triển Khai --</option>
                    {projectMembers.map(m => (
                      <option key={m.projectMemberId} value={m.projectMemberId}>
                        {m.fullName || m.username} ({m.roleName || 'Member'}) - {m.functionalTeamName || 'ARON'}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Đại Diện Khách Hàng (Client Key User):</label>
                    <input 
                      type="text"
                      value={createKeyUser}
                      onChange={(e) => setCreateKeyUser(e.target.value)}
                      placeholder="VD: Anh Minh - Kế Toán Trưởng S.I.S..."
                      className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Đơn Vị Thứ 3 (Third Party / Partner):</label>
                    <input 
                      type="text"
                      value={createParty}
                      onChange={(e) => setCreateParty(e.target.value)}
                      placeholder="VD: Đối tác hạ tầng / Chuyển đổi dữ liệu..."
                      className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer Controls */}
            <div className="flex gap-2 justify-between pt-4 border-t border-dark-800">
              <div className="flex gap-2">
                {activeTabModal !== 'info' && (
                  <button
                    type="button"
                    onClick={() => setActiveTabModal(activeTabModal === 'resource' ? 'schedule' : 'info')}
                    className="bg-dark-800 hover:bg-dark-750 text-dark-200 text-xs px-3 py-2 rounded-lg font-semibold"
                  >
                    Quay Lại
                  </button>
                )}
                {activeTabModal !== 'resource' && (
                  <button
                    type="button"
                    onClick={() => setActiveTabModal(activeTabModal === 'info' ? 'schedule' : 'resource')}
                    className="bg-dark-800 hover:bg-dark-750 text-brand-400 text-xs px-3 py-2 rounded-lg font-semibold"
                  >
                    Tiếp Theo
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setIsCreatingTask(false)}
                  className="bg-dark-800 hover:bg-dark-700 text-xs px-4 py-2 rounded-lg font-semibold text-white"
                >
                  Hủy Bỏ
                </button>
                <button 
                  type="submit" 
                  disabled={createSubmitting}
                  className="bg-brand-600 hover:bg-brand-500 text-white text-xs px-4 py-2 rounded-lg font-semibold disabled:opacity-50 shadow-lg shadow-brand-600/20"
                >
                  {createSubmitting ? 'Đang khởi tạo...' : 'Lưu & Khởi Tạo Task'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* PROJECT CALENDAR SETTINGS MODAL */}
      {showCalendarModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <form onSubmit={handleSaveCalendarSettings} className="bg-dark-900 border border-dark-800 max-w-md w-full p-6 rounded-2xl shadow-2xl space-y-4 animate-slide-up">
            <h3 className="text-md font-bold text-white border-b border-dark-800 pb-2 flex items-center gap-2">
              <Settings className="text-brand-500" size={18} /> Cấu Hình Lịch Làm Việc Dự Án
            </h3>

            <div className="space-y-2">
              <label className="text-xs text-dark-300 font-semibold">Các Ngày Làm Việc Trong Tuần:</label>
              <select
                value={calendarSettings.workDaysOfWeek}
                onChange={(e) => setCalendarSettings({ ...calendarSettings, workDaysOfWeek: e.target.value })}
                className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
              >
                <option value="MON,TUE,WED,THU,FRI">Thứ 2 đến Thứ 6 (Nghỉ T7 & CN)</option>
                <option value="MON,TUE,WED,THU,FRI,SAT">Thứ 2 đến Thứ 7 (Nghỉ CN)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-dark-300 font-semibold">Số Giờ Làm Việc Chuẩn / Ngày:</label>
              <input 
                type="number"
                value={calendarSettings.standardHoursPerDay}
                onChange={(e) => setCalendarSettings({ ...calendarSettings, standardHoursPerDay: Number(e.target.value) })}
                className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs text-dark-300 font-semibold">Danh Sách Ngày Lễ / Nghỉ Bù (JSON Format):</label>
              <textarea 
                rows={3}
                value={calendarSettings.holidaysJson}
                onChange={(e) => setCalendarSettings({ ...calendarSettings, holidaysJson: e.target.value })}
                placeholder='["2026-01-01","2026-04-30","2026-05-01","2026-09-02"]'
                className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-dark-800">
              <button 
                type="button" 
                onClick={() => setShowCalendarModal(false)}
                className="bg-dark-800 hover:bg-dark-700 text-xs px-4 py-2 rounded-lg font-semibold text-white"
              >
                Đóng
              </button>
              <button 
                type="submit" 
                className="bg-brand-600 hover:bg-brand-500 text-white text-xs px-4 py-2 rounded-lg font-semibold"
              >
                Lưu Cấu Hình
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
