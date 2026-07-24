import React, { useState, useEffect } from 'react';
import { taskService, projectService, teamService, TaskNode, ProjectCalendarSettings, TeamMemberDto } from '../services/api';
import { Calendar, ChevronRight, ChevronDown, CheckCircle2, AlertTriangle, Play, HelpCircle, Plus, EyeOff, Settings, Users, Clock, FileText, Maximize2, Minimize2, Edit3, Check, UserCheck, Briefcase } from 'lucide-react';

interface GanttChartProps {
  projectId: number;
  userRole: string;
}

export const GanttChart: React.FC<GanttChartProps> = ({ projectId, userRole }) => {
  const [tasks, setTasks] = useState<TaskNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<number, boolean>>({});
  const [allExpanded, setAllExpanded] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Layout Fullview State
  const [isWideView, setIsWideView] = useState<boolean>(false);

  // Project Members & Functional Teams for Resource Assignment
  const [projectMembers, setProjectMembers] = useState<TeamMemberDto[]>([]);
  const [functionalTeams, setFunctionalTeams] = useState<any[]>([]);

  // Project Calendar Settings & Engine
  const [calendarSettings, setCalendarSettings] = useState<ProjectCalendarSettings>({
    projectId,
    workDaysOfWeek: 'MON,TUE,WED,THU,FRI',
    standardHoursPerDay: 8,
    holidaysJson: '["2026-01-01","2026-04-30","2026-05-01","2026-09-02"]'
  });
  const [showCalendarModal, setShowCalendarModal] = useState<boolean>(false);

  // Task Creation & Full Editing Modal State (3-Tab Primavera P6 Style)
  const [isCreatingTask, setIsCreatingTask] = useState<boolean>(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
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
  const [createStatus, setCreateStatus] = useState<string>('NOT_STARTED');
  const [createProgressPercent, setCreateProgressPercent] = useState<number>(0);
  const [createPredecessorId, setCreatePredecessorId] = useState<number | undefined>(undefined);
  const [createSubmitting, setCreateSubmitting] = useState<boolean>(false);

  // Multi-Assignment States (1 or multiple Teams, 1 or multiple Individuals, 1 or multiple Key Users)
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedMemberNames, setSelectedMemberNames] = useState<string[]>([]);
  const [selectedPrimaryMemberId, setSelectedPrimaryMemberId] = useState<number | undefined>(undefined);
  const [selectedKeyUsers, setSelectedKeyUsers] = useState<string[]>([]);

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
      setAllExpanded(true);
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
      if (data) {
        if (data.members) setProjectMembers(data.members.filter(m => m.isActive));
        if (data.functionalTeams) setFunctionalTeams(data.functionalTeams);
      }
    } catch (err) {
      console.warn('Failed to load project members for resource dropdown.');
    }
  };

  // Helper to flatten tasks for Predecessor Selector & Collapse All
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

  const toggleExpandAll = () => {
    const nextState = !allExpanded;
    setAllExpanded(nextState);
    const newExpanded: Record<number, boolean> = {};
    allFlatTasks.forEach(t => {
      newExpanded[t.taskId] = nextState;
    });
    setExpandedNodes(newExpanded);
  };

  // -------------------------------------------------------------
  // WORKDAY & CALENDAR CALCULATION ENGINE
  // -------------------------------------------------------------
  const parseWorkDays = (workDaysStr: string): number[] => {
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

  // Helper to split comma-separated strings cleanly
  const splitStringList = (str?: string): string[] => {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean);
  };

  // Toggle selection for Team Badges
  const toggleTeamSelection = (teamName: string) => {
    setSelectedTeams(prev => 
      prev.includes(teamName) ? prev.filter(t => t !== teamName) : [...prev, teamName]
    );
  };

  // Toggle selection for Member Badges
  const toggleMemberSelection = (memberName: string, memberId?: number) => {
    setSelectedMemberNames(prev => {
      if (prev.includes(memberName)) {
        return prev.filter(m => m !== memberName);
      } else {
        if (!selectedPrimaryMemberId && memberId) setSelectedPrimaryMemberId(memberId);
        return [...prev, memberName];
      }
    });
  };

  // Toggle selection for Key User Badges
  const toggleKeyUserSelection = (keyUserName: string) => {
    setSelectedKeyUsers(prev => 
      prev.includes(keyUserName) ? prev.filter(k => k !== keyUserName) : [...prev, keyUserName]
    );
  };

  // Open Modal for NEW Task Creation
  const handleOpenCreateTaskModal = (level: number, parentTask?: TaskNode) => {
    setEditingTaskId(null);
    setCreateLevel(level);
    setCreateParentTaskId(parentTask ? parentTask.taskId : null);
    setCreateTaskCode(parentTask ? `${parentTask.taskCode}.${(parentTask.subTasks?.length || 0) + 1}` : `${tasks.length + 1}`);
    setCreateTaskName('');
    setCreateDescription('');
    setCreateAimCode('BR150');
    setCreateModule('PO');
    
    const today = new Date().toISOString().split('T')[0];
    const initialDuration = 5;
    setCreateStartDate(today);
    setCreateDuration(initialDuration);
    setCreateEndDate(addWorkingDays(today, initialDuration));
    
    setCreateStatus('NOT_STARTED');
    setCreateProgressPercent(0);
    setCreatePredecessorId(undefined);

    setSelectedTeams([]);
    setSelectedMemberNames([]);
    setSelectedPrimaryMemberId(undefined);
    setSelectedKeyUsers([]);

    setActiveTabModal('info');
    setIsCreatingTask(true);
  };

  // Open Modal for FULL Task Editing (PM, PC, Leader, Admin)
  const handleOpenEditTaskModal = (task: TaskNode) => {
    setEditingTaskId(task.taskId);
    setCreateLevel(task.taskLevel);
    setCreateParentTaskId(task.parentTaskId || null);
    setCreateTaskCode(task.taskCode);
    setCreateTaskName(task.taskName);
    setCreateDescription(task.description || '');
    setCreateAimCode(task.aimCode || 'BR150');
    setCreateModule(task.module || 'PO');

    const sDate = task.startDatePlanned ? task.startDatePlanned.split('T')[0] : new Date().toISOString().split('T')[0];
    const eDate = task.endDatePlanned ? task.endDatePlanned.split('T')[0] : new Date().toISOString().split('T')[0];
    const dur = (sDate && eDate) ? calculateWorkingDays(sDate, eDate) : (task.durationPlanned || 5);

    setCreateStartDate(sDate);
    setCreateEndDate(eDate);
    setCreateDuration(dur);
    setCreateStatus(task.status || 'NOT_STARTED');
    setCreateProgressPercent(task.progressPercent || 0);
    setCreatePredecessorId(task.predecessorTaskIds && task.predecessorTaskIds.length > 0 ? task.predecessorTaskIds[0] : undefined);

    // Multi-assignment list parsing
    const parsedTeams = splitStringList(task.party || task.assigneeTeam);
    const parsedMembers = splitStringList(task.assigneeName);
    const parsedKeyUsers = splitStringList(task.keyUser);

    setSelectedTeams(parsedTeams);
    setSelectedMemberNames(parsedMembers);
    setSelectedPrimaryMemberId(task.assigneeMemberId || undefined);
    setSelectedKeyUsers(parsedKeyUsers);

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
      const combinedAssigneeNames = selectedMemberNames.join(', ');
      const combinedPartyNames = selectedTeams.join(', ');
      const combinedKeyUsers = selectedKeyUsers.join(', ');

      await taskService.saveTask({
        taskId: editingTaskId || 0,
        projectId,
        taskCode: createTaskCode.trim(),
        taskName: createTaskName.trim(),
        description: createDescription,
        taskLevel: createLevel,
        parentTaskId: createParentTaskId,
        startDatePlanned: createStartDate ? new Date(createStartDate).toISOString() : new Date().toISOString(),
        endDatePlanned: createEndDate ? new Date(createEndDate).toISOString() : new Date().toISOString(),
        durationPlanned: createDuration,
        progressPercent: createProgressPercent,
        status: createStatus,
        isVisibleToAll: true,
        visibilityScope: 'PUBLIC',
        aimCode: createAimCode,
        module: createModule,
        assigneeMemberId: selectedPrimaryMemberId,
        assigneeName: combinedAssigneeNames,
        keyUser: combinedKeyUsers,
        party: combinedPartyNames,
        predecessorTaskIds: createPredecessorId ? [createPredecessorId] : []
      });

      setIsCreatingTask(false);
      setEditingTaskId(null);
      loadTasks();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi lưu thông tin công việc.');
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleDeleteTask = async (task: TaskNode) => {
    if (!window.confirm(`Xác nhận xóa công việc "${task.taskCode} - ${task.taskName}"?\n(Các công việc con và Sub-Task liên quan cũng sẽ bị xóa)`)) {
      return;
    }

    try {
      await taskService.deleteTask(task.taskId);
      loadTasks();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi xóa công việc.');
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

  // Render multi-assignment badges on grid cells
  const renderBadgesList = (rawText?: string, defaultColor: 'brand' | 'blue' | 'emerald' | 'amber' = 'brand') => {
    const list = splitStringList(rawText);
    if (list.length === 0) return <span className="text-dark-500 text-xs">-</span>;

    const colorClasses = {
      brand: 'bg-brand-500/10 text-brand-400 border-brand-500/20',
      blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    }[defaultColor];

    return (
      <div className="flex flex-wrap gap-1 items-center">
        {list.map((item, idx) => (
          <span key={idx} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${colorClasses}`}>
            {item}
          </span>
        ))}
      </div>
    );
  };

  // Render a task node in the Tree Grid recursively
  const renderTaskRow = (task: TaskNode, depth: number = 0): React.ReactNode => {
    const isExpanded = !!expandedNodes[task.taskId];
    const hasSubtasks = task.subTasks && task.subTasks.length > 0;

    // Dynamically calculate working days based on actual start/end dates
    const displayWorkingDays = (task.startDatePlanned && task.endDatePlanned)
      ? calculateWorkingDays(task.startDatePlanned, task.endDatePlanned)
      : (task.durationPlanned || 1);

    return (
      <React.Fragment key={task.taskId}>
        {/* Row detail */}
        <tr 
          onDoubleClick={() => (userRole === 'PM' || userRole === 'LEADER' || userRole === 'PC' || userRole === 'SYSTEM_ADMIN' || task.assigneeName) && handleOpenEditTaskModal(task)}
          className={`border-b border-dark-800 hover:bg-dark-800/40 transition-colors cursor-pointer ${
            task.taskLevel === 1 ? 'bg-dark-900/50 font-bold text-white' : task.taskLevel === 2 ? 'bg-dark-900/25 font-semibold text-dark-100' : 'text-dark-200'
          }`}
        >
          {/* ID / Code */}
          <td className="py-3 px-3 text-center border-r border-dark-800 text-xs font-mono font-bold text-dark-300">
            {task.taskCode}
          </td>

          {/* Tên Công Việc / WBS */}
          <td className="py-3 px-4 border-r border-dark-800" style={{ paddingLeft: `${depth * 20 + 16}px` }}>
            <div className="flex items-center gap-2">
              {hasSubtasks ? (
                <button onClick={(e) => { e.stopPropagation(); toggleExpand(task.taskId); }} className="text-dark-400 hover:text-white p-0.5 rounded hover:bg-dark-750 transition-colors">
                  {isExpanded ? <ChevronDown size={16} className="text-brand-400" /> : <ChevronRight size={16} className="text-dark-400" />}
                </button>
              ) : (
                <span className="w-4"></span>
              )}
              <span className="truncate max-w-sm">{task.taskName}</span>
              {task.aimCode && (
                <span className="text-[10px] bg-dark-800 text-brand-400 px-1.5 py-0.5 rounded font-mono border border-dark-700">
                  {task.aimCode}
                </span>
              )}
              {!task.isVisibleToAll && <span title="Chỉ mình tôi thấy"><EyeOff size={14} className="text-rose-400" /></span>}
            </div>
          </td>

          {/* Cấp độ */}
          <td className="py-3 px-3 text-center border-r border-dark-800 text-xs text-dark-300 font-medium">
            {task.taskLevel === 1 ? 'Phase' : task.taskLevel === 2 ? 'Stream' : task.taskLevel === 3 ? 'Deliverable' : 'Action Task'}
          </td>

          {/* Số ngày (Duration) */}
          <td className="py-3 px-3 text-center border-r border-dark-800 text-xs font-mono font-bold text-brand-400">
            {displayWorkingDays}
          </td>

          {/* Từ ngày */}
          <td className="py-3 px-3 text-center border-r border-dark-800 text-xs font-mono text-dark-300">
            {formatDate(task.startDatePlanned)}
          </td>

          {/* Đến ngày */}
          <td className="py-3 px-3 text-center border-r border-dark-800 text-xs font-mono text-dark-300">
            {formatDate(task.endDatePlanned)}
          </td>

          {/* Người phụ trách (PIC - Multi Members / Badges) */}
          <td className="py-3 px-4 border-r border-dark-800 text-xs">
            {renderBadgesList(task.assigneeName, 'brand')}
          </td>

          {/* Đại diện Khách hàng (Multi Key Users) */}
          <td className="py-3 px-3 border-r border-dark-800 text-xs">
            {renderBadgesList(task.keyUser, 'amber')}
          </td>

          {/* Đơn vị / Nhóm (Multi Teams / Parties) */}
          <td className="py-3 px-3 border-r border-dark-800 text-xs">
            {renderBadgesList(task.party || task.assigneeTeam, 'blue')}
          </td>

          {/* Ghi chú / Mô tả */}
          <td className="py-3 px-3 border-r border-dark-800 text-xs text-dark-400 max-w-xs truncate" title={task.description || ''}>
            {task.description || '-'}
          </td>

          {/* Tiến độ */}
          <td className="py-3 px-3 border-r border-dark-800">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <div className="w-16 bg-dark-800 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className={`h-full ${task.status === 'DELAYED' ? 'bg-rose-500' : 'bg-brand-500'}`} 
                    style={{ width: `${task.progressPercent}%` }}
                  ></div>
                </div>
                <span className="text-xs font-mono font-semibold">{task.progressPercent}%</span>
              </div>
              {task.isManualProgress ? (
                <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded border border-amber-500/20 block w-fit">
                  [PM Override]
                </span>
              ) : task.subTaskCount ? (
                <span className="text-[9px] font-bold text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded border border-blue-500/20 block w-fit">
                  [Auto: {task.subTaskCount}]
                </span>
              ) : null}
            </div>
          </td>

          {/* Trạng thái */}
          <td className="py-3 px-3 border-r border-dark-800">{renderStatus(task.status)}</td>

          {/* Thao tác */}
          <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
            {(userRole === 'PM' || userRole === 'LEADER' || userRole === 'PC' || userRole === 'SYSTEM_ADMIN') && task.taskLevel < 4 && (
              <button 
                onClick={() => handleOpenCreateTaskModal(task.taskLevel + 1, task)}
                className="text-xs text-emerald-400 hover:text-emerald-300 font-medium hover:underline"
              >
                + Task Con
              </button>
            )}
            {(userRole === 'PM' || userRole === 'LEADER' || userRole === 'PC' || userRole === 'SYSTEM_ADMIN' || task.assigneeName) && (
              <button 
                onClick={() => handleOpenEditTaskModal(task)}
                className="text-xs text-brand-400 hover:text-brand-300 font-medium hover:underline flex-inline items-center gap-0.5"
              >
                <Edit3 size={11} className="inline mr-0.5" /> Chỉnh Sửa
              </button>
            )}
            {(userRole === 'PM' || userRole === 'PC' || userRole === 'SYSTEM_ADMIN') && (
              <button 
                onClick={() => handleDeleteTask(task)}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium hover:underline"
              >
                Xóa
              </button>
            )}
          </td>
        </tr>

        {/* Render child nodes if expanded */}
        {hasSubtasks && isExpanded && task.subTasks.map(child => renderTaskRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  // Available Teams List for Multi-select
  const availableTeams = [
    'Ban Dự Án',
    ...functionalTeams.map(ft => `Team ${ft.functionalTeamName}`),
    'Đơn Vị Khách Hàng (Client S.I.S)',
    'Đối Tác Triển Khai (Partner ARON)',
    'Đối Tác Thứ 3 (Third Party Hạ Tầng / Data)'
  ];
  const uniqueAvailableTeams = Array.from(new Set(availableTeams));

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex justify-between items-center bg-dark-900/40 p-4 rounded-xl border border-dark-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="text-brand-500" /> Kế hoạch dự án - Master Plan
          </h2>
          <p className="text-xs text-dark-400 mt-1">
            Phân cấp WBS 4 cấp liên kết Workday Calendar Engine. Chế độ Phân công Đa nhóm & Đa nhân sự linh hoạt
          </p>
        </div>
        
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => setIsWideView(!isWideView)}
            className={`text-xs px-3 py-2 rounded-lg font-semibold flex items-center gap-1.5 border transition-all ${
              isWideView 
                ? 'bg-brand-600/20 text-brand-300 border-brand-500/40' 
                : 'bg-dark-800 hover:bg-dark-700 text-dark-200 border-dark-700'
            }`}
            title="Bật/Tắt Chế độ Màn hình rộng Full-Width"
          >
            {isWideView ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isWideView ? 'Màn Hình Chuẩn' : 'Mở Rộng Wide View'}
          </button>

          <button 
            onClick={toggleExpandAll}
            className="bg-dark-800 hover:bg-dark-700 text-dark-200 text-xs px-3 py-2 rounded-lg font-semibold flex items-center gap-1.5 border border-dark-700 transition-all"
          >
            {allExpanded ? <ChevronDown size={14} className="text-amber-400" /> : <ChevronRight size={14} className="text-emerald-400" />}
            {allExpanded ? 'Thu Gọn Cây WBS' : 'Mở Rộng Cây WBS'}
          </button>

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
              <Plus size={14} /> Khởi Tạo Task
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
        /* EXPANDED MASTER PLAN TREE GRID TABLE WITH HORIZONTAL & VERTICAL SCROLLBARS */
        <div className={`overflow-x-auto overflow-y-auto ${isWideView ? 'max-h-[85vh]' : 'max-h-[75vh]'} bg-dark-900/20 rounded-xl border border-dark-800 custom-scrollbar`}>
          <table className="min-w-[1600px] w-full text-left border-collapse">
            <thead>
              <tr className="bg-dark-900 border-b border-dark-800 text-dark-300 text-xs font-bold uppercase sticky top-0 z-10 shadow-sm">
                <th rowSpan={2} className="py-3 px-3 text-center border-r border-dark-800 w-14">ID</th>
                <th rowSpan={2} className="py-3 px-4 border-r border-dark-800 min-w-[280px]">Tên Công Việc / Phân Cấp (WBS)</th>
                <th rowSpan={2} className="py-3 px-3 text-center border-r border-dark-800 w-24">Cấp Độ</th>
                <th rowSpan={2} className="py-3 px-3 text-center border-r border-dark-800 w-24">Số Ngày</th>
                <th colSpan={2} className="py-2 px-3 text-center border-r border-dark-800 border-b border-dark-800">Thời Gian Kế Hoạch</th>
                <th rowSpan={2} className="py-3 px-4 border-r border-dark-800 min-w-[180px]">Người Phụ Trách (PIC)</th>
                <th rowSpan={2} className="py-3 px-3 border-r border-dark-800 min-w-[150px]">Đại Diện Khách Hàng</th>
                <th rowSpan={2} className="py-3 px-3 border-r border-dark-800 min-w-[150px]">Đơn Vị / Nhóm</th>
                <th rowSpan={2} className="py-3 px-3 border-r border-dark-800 min-w-[160px]">Ghi Chú / Mô Tả</th>
                <th rowSpan={2} className="py-3 px-3 border-r border-dark-800 w-28">Tiến Độ</th>
                <th rowSpan={2} className="py-3 px-3 border-r border-dark-800 w-28">Trạng Thái</th>
                <th rowSpan={2} className="py-3 px-4 text-right min-w-[130px]">Thao Tác</th>
              </tr>
              <tr className="bg-dark-900/90 border-b border-dark-800 text-dark-400 text-[11px] font-bold uppercase sticky top-[37px] z-10">
                <th className="py-2 px-3 text-center border-r border-dark-800 w-24">Từ Ngày</th>
                <th className="py-2 px-3 text-center border-r border-dark-800 w-24">Đến Ngày</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length > 0 ? (
                tasks.map(task => renderTaskRow(task))
              ) : (
                <tr>
                  <td colSpan={13} className="text-center py-8 text-dark-500 text-xs">
                    Chưa khai báo danh mục công việc cho dự án này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 3-TAB PRIMAVERA P6 STYLE TASK CREATION & FULL EDIT MODAL WITH FLEXIBLE MULTI-ASSIGNMENT */}
      {isCreatingTask && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <form onSubmit={handleCreateTask} className="bg-dark-900 border border-dark-800 max-w-2xl w-full p-6 rounded-2xl shadow-2xl space-y-5 animate-slide-up max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-dark-800 pb-3">
              <div>
                <h3 className="text-md font-bold text-white flex items-center gap-2">
                  {editingTaskId ? <Edit3 className="text-brand-500" size={18} /> : <Plus className="text-brand-500" size={18} />}
                  {editingTaskId ? `Chỉnh Sửa Task: ${createTaskCode} - ${createTaskName}` : 'Khởi Tạo Task Mới'}
                </h3>
                <p className="text-[11px] text-dark-400 mt-0.5">
                  {createLevel === 1 ? 'Task Cấp 1 (Phase)' : createLevel === 2 ? 'Sub-Stream (Cấp 2)' : createLevel === 3 ? 'Deliverable (Cấp 3)' : 'Action Task (Cấp 4)'} - Chuẩn quản trị Master Plan ERP
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => { setIsCreatingTask(false); setEditingTaskId(null); }}
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
                  <label className="text-xs text-dark-300 font-semibold">Mô Tả Chi Tiết / Ghi Chú Công Việc:</label>
                  <textarea 
                    rows={3}
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    placeholder="Nhập phạm vi thực hiện, ghi chú công việc..."
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
                    <label className="text-xs text-dark-300 font-semibold">Từ Ngày (Bắt Đầu):</label>
                    <input 
                      type="date" 
                      value={createStartDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Số Ngày (Duration):</label>
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
                    <label className="text-xs text-dark-300 font-semibold">Đến Ngày (Tự Tính):</label>
                    <input 
                      type="date" 
                      value={createEndDate}
                      onChange={(e) => handleEndDateChange(e.target.value)}
                      className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>
                </div>

                {editingTaskId && (
                  <div className="space-y-2 bg-dark-950 p-3 rounded-xl border border-dark-800">
                    <label className="text-xs text-dark-300 flex justify-between font-semibold">
                      <span>Tiến Độ Hoàn Thành (%):</span>
                      <span className="font-mono text-brand-400">{createProgressPercent}%</span>
                    </label>
                    <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={createProgressPercent}
                      onChange={(e) => setCreateProgressPercent(Number(e.target.value))}
                      className="w-full h-1.5 bg-dark-800 rounded-lg appearance-none cursor-pointer accent-brand-500"
                    />
                  </div>
                )}

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
                  <label className="text-xs text-dark-300 font-semibold">Trạng Thái Công Việc:</label>
                  <select
                    value={createStatus}
                    onChange={(e) => setCreateStatus(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="NOT_STARTED">Chưa chạy (Not Started)</option>
                    <option value="IN_PROGRESS">Đang triển khai (In Progress)</option>
                    <option value="PENDING_APPROVAL">Chờ duyệt (Pending Approval)</option>
                    <option value="COMPLETED">Hoàn thành (Completed)</option>
                    <option value="DELAYED">Trễ tiến độ (Delayed)</option>
                  </select>
                </div>
              </div>
            )}

            {/* TAB 3: NHÂN SỰ & ĐỘI NGŨ DỰ ÁN (FLEXIBLE MULTI-ASSIGNMENT FOR TEAMS & INDIVIDUALS) */}
            {activeTabModal === 'resource' && (
              <div className="space-y-5 animate-fade-in">
                
                {/* 1. SECTION: CHỌN 1 HOẶC NHIỀU ĐỘI / NHÓM (TEAMS & PARTIES) */}
                <div className="space-y-2 bg-dark-950 p-4 rounded-xl border border-dark-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Briefcase size={14} className="text-brand-400" />
                      1. Đội / Nhóm Thực Thi (Chọn 1 hoặc nhiều nhóm):
                    </label>
                    <span className="text-[10px] text-brand-400 font-mono">Đã chọn: {selectedTeams.length} nhóm</span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {uniqueAvailableTeams.map((teamName, idx) => {
                      const isSelected = selectedTeams.includes(teamName);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => toggleTeamSelection(teamName)}
                          className={`text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-md shadow-blue-500/10'
                              : 'bg-dark-900 hover:bg-dark-800 text-dark-300 border-dark-750'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${
                            isSelected ? 'bg-blue-500 border-blue-400 text-white' : 'border-dark-600'
                          }`}>
                            {isSelected && <Check size={10} />}
                          </span>
                          {teamName}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. SECTION: CHỌN 1 HOẶC NHIỀU CÁ NHÂN PHỤ TRÁCH (INDIVIDUAL PICS) */}
                <div className="space-y-2 bg-dark-950 p-4 rounded-xl border border-dark-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <UserCheck size={14} className="text-brand-400" />
                      2. Cá Nhân Phụ Trách - PIC (Chọn 1 hoặc nhiều người):
                    </label>
                    <span className="text-[10px] text-brand-400 font-mono">Đã chọn: {selectedMemberNames.length} người</span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {projectMembers.map((m) => {
                      const mName = m.fullName || m.username;
                      const isSelected = selectedMemberNames.includes(mName);
                      return (
                        <button
                          key={m.projectMemberId}
                          type="button"
                          onClick={() => toggleMemberSelection(mName, m.projectMemberId)}
                          className={`text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-brand-600/20 text-brand-300 border-brand-500/50 shadow-md shadow-brand-500/10'
                              : 'bg-dark-900 hover:bg-dark-800 text-dark-300 border-dark-750'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${
                            isSelected ? 'bg-brand-500 border-brand-400 text-white' : 'border-dark-600'
                          }`}>
                            {isSelected && <Check size={10} />}
                          </span>
                          <span>{mName}</span>
                          <span className="text-[10px] opacity-75 font-normal">({m.functionalTeamName || 'ARON'})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. SECTION: CHỌN 1 HOẶC NHIỀU KEY USER KHÁCH HÀNG */}
                <div className="space-y-2 bg-dark-950 p-4 rounded-xl border border-dark-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Users size={14} className="text-amber-400" />
                      3. Đại Diện Khách Hàng - Client Key User (Chọn 1 hoặc nhiều):
                    </label>
                    <span className="text-[10px] text-amber-400 font-mono">Đã chọn: {selectedKeyUsers.length} người</span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    {projectMembers.map((m) => {
                      const mName = m.fullName || m.username;
                      const isSelected = selectedKeyUsers.includes(mName);
                      return (
                        <button
                          key={`ku-${m.projectMemberId}`}
                          type="button"
                          onClick={() => toggleKeyUserSelection(mName)}
                          className={`text-xs px-3 py-1.5 rounded-xl font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10'
                              : 'bg-dark-900 hover:bg-dark-800 text-dark-300 border-dark-750'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[10px] ${
                            isSelected ? 'bg-amber-500 border-amber-400 text-white' : 'border-dark-600'
                          }`}>
                            {isSelected && <Check size={10} />}
                          </span>
                          <span>{mName}</span>
                        </button>
                      );
                    })}
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
                  onClick={() => { setIsCreatingTask(false); setEditingTaskId(null); }}
                  className="bg-dark-800 hover:bg-dark-700 text-xs px-4 py-2 rounded-lg font-semibold text-white"
                >
                  Hủy Bỏ
                </button>
                <button 
                  type="submit" 
                  disabled={createSubmitting}
                  className="bg-brand-600 hover:bg-brand-500 text-white text-xs px-4 py-2 rounded-lg font-semibold disabled:opacity-50 shadow-lg shadow-brand-600/20"
                >
                  {createSubmitting ? 'Đang lưu...' : (editingTaskId ? 'Lưu Thay Đổi Task' : 'Lưu & Khởi Tạo Task')}
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
