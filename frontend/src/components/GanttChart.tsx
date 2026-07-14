import React, { useState, useEffect } from 'react';
import { taskService, TaskNode } from '../services/api';
import { Calendar, ChevronRight, ChevronDown, CheckCircle2, AlertTriangle, Play, HelpCircle, Plus, EyeOff } from 'lucide-react';

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

  useEffect(() => {
    loadTasks();
  }, [projectId]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await taskService.getTaskTree(projectId);
      setTasks(data);
      
      // Auto-expand Level 1 nodes initially
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

  const toggleExpand = (taskId: number) => {
    setExpandedNodes(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const selectTaskForUpdate = (task: TaskNode) => {
    setSelectedTask(task);
    setEditProgress(task.progressPercent);
    setEditStatus(task.status);
    setIsEditing(true);
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    try {
      await taskService.saveTask({
        ...selectedTask,
        projectId,
        progressPercent: Number(editProgress),
        status: editStatus
      });
      setIsEditing(false);
      setSelectedTask(null);
      loadTasks();
    } catch (err: any) {
      alert(err.message || 'Lỗi cập nhật tiến độ.');
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
            {task.taskLevel === 1 ? 'Phase' : task.taskLevel === 2 ? 'Module' : 'Task'}
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
          </td>
          <td className="py-3 px-4">
            <div className="flex items-center gap-2">
              <div className="w-20 bg-dark-800 rounded-full h-1.5 overflow-hidden">
                <div 
                  className={`h-full ${task.status === 'DELAYED' ? 'bg-rose-500' : 'bg-brand-500'}`} 
                  style={{ width: `${task.progressPercent}%` }}
                ></div>
              </div>
              <span className="text-xs font-mono font-semibold">{task.progressPercent}%</span>
            </div>
          </td>
          <td className="py-3 px-4">{renderStatus(task.status)}</td>
          <td className="py-3 px-4 text-right">
            {/* Permission Control: Member can update their tasks, Leader/PM/PC can update any */}
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
            <Calendar className="text-brand-500" /> Kế Hoạch Dự Án & Sơ Đồ Gán
          </h2>
          <p className="text-xs text-dark-400 mt-1">Phân cấp công việc 3 cấp WBS liên kết động với tiến độ phân hệ</p>
        </div>
        
        {(userRole === 'PM' || userRole === 'SYSTEM_ADMIN' || userRole === 'PC') && (
          <button className="bg-brand-600 hover:bg-brand-500 text-white text-xs px-3 py-2 rounded-lg font-semibold flex items-center gap-1 transition-all">
            <Plus size={14} /> Thêm Task Giai Đoạn (Cấp 1)
          </button>
        )}
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

      {/* Task Update Modal */}
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
                className="bg-dark-800 hover:bg-dark-700 text-xs px-4 py-2 rounded-lg font-semibold"
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
    </div>
  );
};
