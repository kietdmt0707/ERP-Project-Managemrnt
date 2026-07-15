import React, { useState, useEffect } from 'react';
import { projectService, userService, ProjectDto, UserDto, hasPermission } from '../services/api';
import { Briefcase, Plus, Folder, MapPin, Building, Phone, UserPlus, Trash2, Edit3, Calendar, Clock } from 'lucide-react';

interface ProjectManagerProps {
  currentUser?: any;
  onProjectCreated?: () => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ currentUser, onProjectCreated }) => {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Project form states
  const [showModal, setShowModal] = useState(false);
  const [projectCode, setProjectCode] = useState('');
  const [projectName, setProjectName] = useState('');
  const [address, setAddress] = useState('');
  const [sitesCount, setSitesCount] = useState(1);
  const [contactInfo, setContactInfo] = useState('');
  const [logoPath, setLogoPath] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // New ERP fields for Project Creation
  const [projectScope, setProjectScope] = useState('');
  const [implementationWeeks, setImplementationWeeks] = useState(24);
  const [kickOffDate, setKickOffDate] = useState('');
  const [targetGoLiveDate, setTargetGoLiveDate] = useState('');
  const [currentPhase, setCurrentPhase] = useState('Analyze');
  const [selectedModules, setSelectedModules] = useState<string[]>(['GL', 'AP', 'AR', 'PO', 'INV']);

  // Edit Project States
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editTab, setEditTab] = useState('basic'); // basic, timeline, sites
  const [editProjectName, setEditProjectName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editSitesCount, setEditSitesCount] = useState(1);
  const [editContactInfo, setEditContactInfo] = useState('');
  const [editLogoPath, setEditLogoPath] = useState('');
  const [editSharepointLink, setEditSharepointLink] = useState('');
  const [editProjectScope, setEditProjectScope] = useState('');
  const [editImplementationWeeks, setEditImplementationWeeks] = useState(24);
  const [editKickOffDate, setEditKickOffDate] = useState('');
  const [editTargetGoLiveDate, setEditTargetGoLiveDate] = useState('');
  const [editCurrentPhase, setEditCurrentPhase] = useState('Analyze');
  const [editSelectedModules, setEditSelectedModules] = useState<string[]>([]);
  const [editProjectSites, setEditProjectSites] = useState<any[]>([]);

  // Assign PM states
  const [showAssignPmModal, setShowAssignPmModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [pmUsername, setPmUsername] = useState('');
  const [pmFullName, setPmFullName] = useState('');
  const [pmEmail, setPmEmail] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [allUsers, setAllUsers] = useState<UserDto[]>([]);

  const loadUsers = async () => {
    try {
      const data = await userService.getUsers();
      setAllUsers(data || []);
    } catch (err) {
      console.error("Không thể tải danh sách người dùng", err);
    }
  };

  const handleOpenAssignPm = (projectId: number) => {
    setSelectedProjectId(projectId);
    loadUsers();
    setShowAssignPmModal(true);
  };

  const isAdmin = currentUser?.globalRole === 'SYSTEM_ADMIN';
  const availableModules = ['GL', 'AP', 'AR', 'FA', 'PO', 'INV', 'OM'];

  // Check if current user is PM or PC or Admin for editing
  const checkUserAccess = (projectId: number) => {
    if (!currentUser) return false;
    if (currentUser.globalRole === 'SYSTEM_ADMIN') return true;
    if (!hasPermission(currentUser, 'Projects', 'Edit')) return false;
    const projectRole = currentUser.projectRoles?.find((r: any) => r.projectId === projectId);
    return projectRole?.roleCode === 'PM' || projectRole?.roleCode === 'PC';
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (isEdit) {
        setEditLogoPath(reader.result as string);
      } else {
        setLogoPath(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleModuleToggle = (module: string, isEdit: boolean) => {
    if (isEdit) {
      if (editSelectedModules.includes(module)) {
        setEditSelectedModules(editSelectedModules.filter(m => m !== module));
      } else {
        setEditSelectedModules([...editSelectedModules, module]);
      }
    } else {
      if (selectedModules.includes(module)) {
        setSelectedModules(selectedModules.filter(m => m !== module));
      } else {
        setSelectedModules([...selectedModules, module]);
      }
    }
  };

  const handleSiteChange = (index: number, field: string, value: any) => {
    const updatedSites = [...editProjectSites];
    updatedSites[index] = { ...updatedSites[index], [field]: value };
    setEditProjectSites(updatedSites);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await projectService.getProjects();
      setProjects(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách dự án.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await projectService.createProject({
        projectCode,
        projectName,
        address,
        sitesCount,
        contactInfo,
        logoPath: logoPath || 'https://raw.githubusercontent.com/vitejs/vite/main/packages/vite/src/node/logo.png',
        projectScope,
        implementationWeeks,
        kickOffDate: kickOffDate ? new Date(kickOffDate).toISOString() : undefined,
        targetGoLiveDate: targetGoLiveDate ? new Date(targetGoLiveDate).toISOString() : undefined,
        currentPhase,
        modulesScope: selectedModules.join(',')
      });
      setShowModal(false);
      // Reset form
      setProjectCode('');
      setProjectName('');
      setAddress('');
      setSitesCount(1);
      setContactInfo('');
      setLogoPath('');
      setProjectScope('');
      setImplementationWeeks(24);
      setKickOffDate('');
      setTargetGoLiveDate('');
      setCurrentPhase('Analyze');
      setSelectedModules(['GL', 'AP', 'AR', 'PO', 'INV']);
      loadProjects();
      if (onProjectCreated) {
        onProjectCreated();
      }
    } catch (err: any) {
      setError(err.message || 'Tạo dự án thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditModal = (project: ProjectDto) => {
    setEditingProjectId(project.projectId!);
    setEditTab('basic');
    setEditProjectName(project.projectName);
    setEditAddress(project.address || '');
    setEditSitesCount(project.sitesCount);
    setEditContactInfo(project.contactInfo || '');
    setEditLogoPath(project.logoPath || '');
    setEditSharepointLink(project.sharepointFolderLink || '');
    setEditProjectScope(project.projectScope || '');
    setEditImplementationWeeks(project.implementationWeeks || 24);
    setEditKickOffDate(project.kickOffDate ? project.kickOffDate.split('T')[0] : '');
    setEditTargetGoLiveDate(project.targetGoLiveDate ? project.targetGoLiveDate.split('T')[0] : '');
    setEditCurrentPhase(project.currentPhase || 'Analyze');
    setEditSelectedModules(project.modulesScope ? project.modulesScope.split(',') : []);
    setEditProjectSites(project.projectSites || []);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProjectId) return;
    setSubmitting(true);
    setError(null);
    try {
      await projectService.updateProject(editingProjectId, {
        projectCode: projects.find(p => p.projectId === editingProjectId)?.projectCode || '',
        projectName: editProjectName,
        address: editAddress,
        sitesCount: editProjectSites.length || editSitesCount,
        contactInfo: editContactInfo,
        logoPath: editLogoPath,
        sharepointFolderLink: editSharepointLink,
        projectScope: editProjectScope,
        implementationWeeks: editImplementationWeeks,
        kickOffDate: editKickOffDate ? new Date(editKickOffDate).toISOString() : undefined,
        targetGoLiveDate: editTargetGoLiveDate ? new Date(editTargetGoLiveDate).toISOString() : undefined,
        currentPhase: editCurrentPhase,
        modulesScope: editSelectedModules.join(','),
        projectSites: editProjectSites
      });
      setShowEditModal(false);
      loadProjects();
      alert('Cập nhật thông tin dự án thành công!');
    } catch (err: any) {
      setError(err.message || 'Cập nhật dự án thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignPmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) return;
    setAssigning(true);
    try {
      await projectService.assignPm({
        projectId: selectedProjectId,
        username: pmUsername,
        fullName: pmFullName,
        email: pmEmail
      });
      alert('Đã bổ nhiệm và phân công PM cho dự án thành công!');
      setShowAssignPmModal(false);
      setPmUsername('');
      setPmFullName('');
      setPmEmail('');
      loadProjects();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi phân công PM.');
    } finally {
      setAssigning(false);
    }
  };

  const handleDeleteProject = async (projectId: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa dự án này? Thao tác này sẽ xóa vĩnh viễn toàn bộ RICEFW, Gantt và dữ liệu liên quan.')) return;
    try {
      await projectService.deleteProject(projectId);
      alert('Đã xóa dự án thành công!');
      loadProjects();
    } catch (err: any) {
      alert(err.message || 'Xóa dự án thất bại.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-dark-900/40 p-4 rounded-xl border border-dark-800 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Briefcase className="text-brand-500" /> Quản Lý Đa Dự Án (Projects Workspace)
          </h2>
          <p className="text-xs text-dark-400 mt-1">Cấu hình nhiều dự án cùng lúc, thiết lập thông tin liên hệ, logo và số lượng site</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-brand-600/10"
        >
          <Plus size={14} /> Thêm Dự Án Mới
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-xs text-dark-400">Đang tải danh sách dự án...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const canEdit = checkUserAccess(project.projectId!);
            const modules = project.modulesScope ? project.modulesScope.split(',') : [];
            const phases = ['Analyze', 'Design', 'Build', 'Transition', 'Go-Live'];
            const phaseIndex = phases.indexOf(project.currentPhase || 'Analyze');
            
            return (
              <div key={project.projectId} className="glass-panel p-5 rounded-2xl border border-dark-800 space-y-4 hover:border-dark-700 transition-all flex flex-col justify-between">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl bg-dark-950 p-2 flex items-center justify-center border border-dark-800 shrink-0">
                        <img 
                          src={project.logoPath || 'https://raw.githubusercontent.com/vitejs/vite/main/packages/vite/src/node/logo.png'} 
                          alt="Project Logo" 
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold font-mono text-brand-400 px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/10">
                          {project.projectCode}
                        </span>
                        <h3 className="text-sm font-bold text-white truncate mt-1">{project.projectName}</h3>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {canEdit && (
                        <button
                          onClick={() => handleOpenEditModal(project)}
                          className="text-brand-400 hover:text-brand-300 p-2 hover:bg-brand-500/10 rounded-lg transition-colors shrink-0"
                          title="Chỉnh sửa dự án"
                        >
                          <Edit3 size={16} />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteProject(project.projectId!)}
                          className="text-rose-500 hover:text-rose-400 p-2 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
                          title="Xóa dự án"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ERP Oracle Methodology Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] text-dark-400 font-semibold">
                      <span>Tiến độ ERP (OUM):</span>
                      <span className="text-brand-400 font-bold">
                        {project.currentPhase === 'Analyze' ? 'Phân tích' : 
                         project.currentPhase === 'Design' ? 'Thiết kế' : 
                         project.currentPhase === 'Build' ? 'Cấu hình/CRP' : 
                         project.currentPhase === 'Transition' ? 'UAT/Chuyển giao' : 'Vận hành (Go-Live)'}
                      </span>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {phases.map((p, idx) => (
                        <div 
                          key={p} 
                          className={`h-1.5 rounded-full ${
                            idx <= phaseIndex 
                              ? idx === 4 
                                ? 'bg-emerald-500' 
                                : 'bg-brand-500' 
                              : 'bg-dark-800'
                          }`}
                          title={p}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Timeline & Scope details */}
                  <div className="space-y-2 text-xs text-dark-300 bg-dark-950/40 p-3 rounded-xl border border-dark-850">
                    <p className="flex items-center gap-2"><Clock size={13} className="text-brand-400 shrink-0" /> Thời gian: <span className="font-bold text-white">{project.implementationWeeks || 24} tuần</span> ({project.implementationWeeks ? Math.round(project.implementationWeeks / 4.3) : 6} tháng)</p>
                    <p className="flex items-center gap-2"><Calendar size={13} className="text-brand-400 shrink-0" /> Khởi động: {project.kickOffDate ? new Date(project.kickOffDate).toLocaleDateString('vi-VN') : 'N/A'}</p>
                    <p className="flex items-center gap-2"><Calendar size={13} className="text-brand-400 shrink-0" /> Go-Live dự kiến: <span className="text-emerald-400 font-semibold">{project.targetGoLiveDate ? new Date(project.targetGoLiveDate).toLocaleDateString('vi-VN') : 'N/A'}</span></p>
                    {project.projectScope && (
                      <p className="text-[11px] text-dark-400 mt-1 line-clamp-2 italic border-t border-dark-900 pt-1.5">
                        Phạm vi: {project.projectScope}
                      </p>
                    )}
                  </div>

                  {/* ERP Modules Tags */}
                  {modules.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {modules.map(mod => (
                        <span key={mod} className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-dark-850 border border-dark-800 text-dark-300">
                          {mod}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1.5 text-xs text-dark-300 pt-1">
                    <p className="flex items-center gap-2"><MapPin size={13} className="text-dark-500 shrink-0" /> Địa chỉ: {project.address || 'N/A'}</p>
                    <p className="flex items-center gap-2"><Building size={13} className="text-dark-500 shrink-0" /> Số lượng Sites: {project.projectSites?.length || project.sitesCount} Sites</p>
                    <p className="flex items-center gap-2"><Phone size={13} className="text-dark-500 shrink-0" /> Liên hệ: {project.contactInfo || 'N/A'}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-dark-850 space-y-3 mt-4">
                  <div className="flex items-center justify-between text-[10px] text-dark-500 font-mono">
                    <span>Trạng thái: 
                      <span className={`ml-1 font-bold ${project.isActive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {project.isActive ? 'ĐANG HOẠT ĐỘNG' : 'TẠM NGỪNG'}
                      </span>
                    </span>
                    <span>ID: {project.projectId}</span>
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleOpenAssignPm(project.projectId!)}
                      className="w-full bg-dark-800 hover:bg-dark-750 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 border border-dark-700 transition-colors"
                    >
                      <UserPlus size={14} /> Bổ nhiệm & Phân công PM
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-dark-900 border border-dark-800 p-6 rounded-2xl shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Folder className="text-brand-500" /> Thêm Dự Án Oracle ERP Mới
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-xs text-dark-400 hover:text-white"
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Mã Dự Án (Code):</label>
                  <input 
                    type="text" 
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    placeholder="VD: ARON-ORACLE"
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Tên Dự Án (Project Name):</label>
                  <input 
                    type="text" 
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="VD: Triển khai Oracle ERP Cloud"
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Địa chỉ / Trụ sở chính:</label>
                <input 
                  type="text" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Địa chỉ trụ sở khách hàng"
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Số lượng Site triển khai:</label>
                  <input 
                    type="number" 
                    value={sitesCount}
                    onChange={(e) => setSitesCount(parseInt(e.target.value) || 1)}
                    min={1}
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Thông tin liên hệ (PM Khách hàng):</label>
                  <input 
                    type="text" 
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    placeholder="Họ tên, SĐT, Email"
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Phạm vi dự án (Scope):</label>
                <textarea 
                  value={projectScope}
                  onChange={(e) => setProjectScope(e.target.value)}
                  placeholder="Mô tả phạm vi triển khai ERP, các yêu cầu đặc thù, tích hợp hệ thống..."
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500 h-20"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Thời gian (Tuần):</label>
                  <input 
                    type="number" 
                    value={implementationWeeks}
                    onChange={(e) => setImplementationWeeks(parseInt(e.target.value) || 24)}
                    min={1}
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Ngày bắt đầu:</label>
                  <input 
                    type="date" 
                    value={kickOffDate}
                    onChange={(e) => setKickOffDate(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Ngày Go-Live dự kiến:</label>
                  <input 
                    type="date" 
                    value={targetGoLiveDate}
                    onChange={(e) => setTargetGoLiveDate(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Giai đoạn hiện tại (OUM):</label>
                <select
                  value={currentPhase}
                  onChange={(e) => setCurrentPhase(e.target.value)}
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="Analyze">Analyze (Phân tích/Khảo sát)</option>
                  <option value="Design">Design (Thiết kế giải pháp)</option>
                  <option value="Build">Build (Xây dựng/Cấu hình CRP)</option>
                  <option value="Transition">Transition (Chuyển giao/UAT/Đào tạo)</option>
                  <option value="Go-Live">Production (Vận hành Go-Live)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-dark-300 font-semibold block">Các Phân Hệ Oracle EBS trong phạm vi:</label>
                <div className="flex flex-wrap gap-2">
                  {availableModules.map(mod => {
                    const isChecked = selectedModules.includes(mod);
                    return (
                      <button
                        key={mod}
                        type="button"
                        onClick={() => handleModuleToggle(mod, false)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                          isChecked 
                            ? 'bg-brand-600 border-brand-500 text-white' 
                            : 'bg-dark-950 border-dark-800 text-dark-400 hover:text-white'
                        }`}
                      >
                        {mod}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-dark-300 font-semibold block">Logo dự án (Tải từ máy tính):</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => handleLogoUpload(e, false)}
                  className="text-xs text-dark-400 file:bg-dark-800 file:border-0 file:text-white file:font-semibold file:px-3 file:py-1.5 file:rounded-lg file:mr-3 file:cursor-pointer"
                />
                {logoPath && (
                  <div className="mt-2 p-2 bg-dark-950 rounded-lg flex justify-center border border-dark-800 relative group max-w-[120px]">
                    <img src={logoPath} alt="Preview Project Logo" className="max-h-12 object-contain" />
                    <button
                      type="button"
                      onClick={() => setLogoPath('')}
                      className="absolute top-1 right-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      X
                    </button>
                  </div>
                )}
              </div>

              <button 
                type="submit"
                disabled={submitting}
                className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                {submitting ? 'Đang tạo...' : 'Tạo Dự Án & Thiết Lập Mặc Định'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Project Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg bg-dark-900 border border-dark-800 p-6 rounded-2xl shadow-2xl space-y-4 my-8">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Edit3 className="text-brand-500" /> Cập Nhật Thông Tin Dự Án
              </h3>
              <button 
                onClick={() => setShowEditModal(false)}
                className="text-xs text-dark-400 hover:text-white"
              >
                Đóng
              </button>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-dark-850">
              <button
                type="button"
                onClick={() => setEditTab('basic')}
                className={`text-xs py-2 px-4 font-bold border-b-2 transition-colors ${
                  editTab === 'basic' ? 'border-brand-500 text-white' : 'border-transparent text-dark-400 hover:text-white'
                }`}
              >
                Thông tin chung
              </button>
              <button
                type="button"
                onClick={() => setEditTab('timeline')}
                className={`text-xs py-2 px-4 font-bold border-b-2 transition-colors ${
                  editTab === 'timeline' ? 'border-brand-500 text-white' : 'border-transparent text-dark-400 hover:text-white'
                }`}
              >
                Timeline & Scope
              </button>
              <button
                type="button"
                onClick={() => setEditTab('sites')}
                className={`text-xs py-2 px-4 font-bold border-b-2 transition-colors ${
                  editTab === 'sites' ? 'border-brand-500 text-white' : 'border-transparent text-dark-400 hover:text-white'
                }`}
              >
                Địa chỉ các Site ({editProjectSites.length})
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-left">
              {editTab === 'basic' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Tên Dự Án (Project Name):</label>
                    <input 
                      type="text" 
                      value={editProjectName}
                      onChange={(e) => setEditProjectName(e.target.value)}
                      className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Địa chỉ / Trụ sở chính:</label>
                    <input 
                      type="text" 
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-dark-300 font-semibold">Liên hệ (PM Khách hàng):</label>
                      <input 
                        type="text" 
                        value={editContactInfo}
                        onChange={(e) => setEditContactInfo(e.target.value)}
                        className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-dark-300 font-semibold">Link SharePoint / OneDrive:</label>
                      <input 
                        type="text" 
                        value={editSharepointLink}
                        onChange={(e) => setEditSharepointLink(e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-dark-300 font-semibold block">Các Phân Hệ Oracle EBS trong phạm vi:</label>
                    <div className="flex flex-wrap gap-2">
                      {availableModules.map(mod => {
                        const isChecked = editSelectedModules.includes(mod);
                        return (
                          <button
                            key={mod}
                            type="button"
                            onClick={() => handleModuleToggle(mod, true)}
                            className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                              isChecked 
                                ? 'bg-brand-600 border-brand-500 text-white' 
                                : 'bg-dark-950 border-dark-800 text-dark-400 hover:text-white'
                            }`}
                          >
                            {mod}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-dark-300 font-semibold block">Logo dự án (Tải từ máy tính):</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => handleLogoUpload(e, true)}
                      className="text-xs text-dark-400 file:bg-dark-800 file:border-0 file:text-white file:font-semibold file:px-3 file:py-1.5 file:rounded-lg file:mr-3 file:cursor-pointer"
                    />
                    {editLogoPath && (
                      <div className="mt-2 p-2 bg-dark-950 rounded-lg flex justify-center border border-dark-800 relative group max-w-[120px]">
                        <img src={editLogoPath} alt="Preview Logo" className="max-h-12 object-contain" />
                        <button
                          type="button"
                          onClick={() => setEditLogoPath('')}
                          className="absolute top-1 right-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          X
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {editTab === 'timeline' && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Phạm vi dự án (Project Scope):</label>
                    <textarea 
                      value={editProjectScope}
                      onChange={(e) => setEditProjectScope(e.target.value)}
                      placeholder="Mô tả chi tiết phạm vi..."
                      className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500 h-28"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-dark-300 font-semibold">Thời gian (Tuần):</label>
                      <input 
                        type="number" 
                        value={editImplementationWeeks}
                        onChange={(e) => setEditImplementationWeeks(parseInt(e.target.value) || 24)}
                        min={1}
                        className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-dark-300 font-semibold">Ngày bắt đầu:</label>
                      <input 
                        type="date" 
                        value={editKickOffDate}
                        onChange={(e) => setEditKickOffDate(e.target.value)}
                        className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-dark-300 font-semibold">Ngày Go-Live dự kiến:</label>
                      <input 
                        type="date" 
                        value={editTargetGoLiveDate}
                        onChange={(e) => setEditTargetGoLiveDate(e.target.value)}
                        className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Giai đoạn hiện tại (OUM Methodology):</label>
                    <select
                      value={editCurrentPhase}
                      onChange={(e) => setEditCurrentPhase(e.target.value)}
                      className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="Analyze">Analyze (Phân tích/Khảo sát)</option>
                      <option value="Design">Design (Thiết kế giải pháp)</option>
                      <option value="Build">Build (Xây dựng/Cấu hình CRP)</option>
                      <option value="Transition">Transition (Chuyển giao/UAT/Đào tạo)</option>
                      <option value="Go-Live">Production (Vận hành Go-Live)</option>
                    </select>
                  </div>
                </div>
              )}

              {editTab === 'sites' && (
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-dark-400">Thiết lập thông tin địa chỉ cụ thể cho từng Site dự án:</span>
                    <button
                      type="button"
                      onClick={() => setEditProjectSites([...editProjectSites, { siteName: `Site ${editProjectSites.length + 1}`, address: '' }])}
                      className="bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-bold py-1 px-2.5 rounded-lg flex items-center gap-1 transition-all"
                    >
                      <Plus size={10} /> Thêm Site mới
                    </button>
                  </div>

                  {editProjectSites.length === 0 ? (
                    <div className="text-center py-6 text-xs text-dark-500">Chưa có chi nhánh/site nào được cấu hình cho dự án này. Hãy thêm mới!</div>
                  ) : (
                    <div className="space-y-3">
                      {editProjectSites.map((site, index) => (
                        <div key={index} className="p-3 bg-dark-950 rounded-xl border border-dark-850 relative space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-brand-400">SITE #{index + 1}</span>
                            <button
                              type="button"
                              onClick={() => setEditProjectSites(editProjectSites.filter((_, idx) => idx !== index))}
                              className="text-rose-500 hover:text-rose-400 text-[10px]"
                            >
                              Xóa Site
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-1">
                              <label className="text-[10px] text-dark-400">Tên Site:</label>
                              <input 
                                type="text"
                                value={site.siteName}
                                onChange={(e) => handleSiteChange(index, 'siteName', e.target.value)}
                                className="w-full bg-dark-900 border border-dark-800 text-xs p-2 rounded-lg text-white focus:outline-none"
                                required
                              />
                            </div>
                            <div className="col-span-2 space-y-1">
                              <label className="text-[10px] text-dark-400">Địa chỉ cụ thể:</label>
                              <input 
                                type="text"
                                value={site.address || ''}
                                onChange={(e) => handleSiteChange(index, 'address', e.target.value)}
                                placeholder="Nhập địa chỉ của chi nhánh/site này"
                                className="w-full bg-dark-900 border border-dark-800 text-xs p-2 rounded-lg text-white focus:outline-none focus:border-brand-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button 
                type="submit"
                disabled={submitting}
                className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all disabled:opacity-50 mt-4"
              >
                {submitting ? 'Đang lưu...' : 'Lưu Thay Đổi Dự Án'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Assign PM Modal */}
      {showAssignPmModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-dark-900 border border-dark-800 p-6 rounded-2xl shadow-2xl space-y-4 animate-slide-up">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <UserPlus className="text-brand-500" /> Bổ Nhiệm & Phân Công PM
              </h3>
              <button 
                onClick={() => setShowAssignPmModal(false)}
                className="text-xs text-dark-400 hover:text-white"
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleAssignPmSubmit} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold block">Chọn tài khoản người dùng hệ thống:</label>
                <select 
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setPmUsername('');
                      setPmFullName('');
                      setPmEmail('');
                    } else {
                      const selected = allUsers.find(u => u.username === val);
                      if (selected) {
                        setPmUsername(selected.username);
                        setPmFullName(selected.fullName);
                        setPmEmail(selected.email);
                      }
                    }
                  }}
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="">-- Chọn tài khoản người dùng sẵn có hoặc nhập thủ công --</option>
                  {allUsers.map(u => (
                    <option key={u.userId} value={u.username}>{u.fullName} ({u.username})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Tên tài khoản PM (Username):</label>
                <input 
                  type="text" 
                  value={pmUsername}
                  onChange={(e) => setPmUsername(e.target.value)}
                  placeholder="VD: pm_john, pm_mary"
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Họ và Tên PM:</label>
                <input 
                  type="text" 
                  value={pmFullName}
                  onChange={(e) => setPmFullName(e.target.value)}
                  placeholder="VD: John PM, Mary PM"
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Email PM:</label>
                <input 
                  type="email" 
                  value={pmEmail}
                  onChange={(e) => setPmEmail(e.target.value)}
                  placeholder="VD: pm.john@aron.vn"
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <button 
                type="submit"
                disabled={assigning}
                className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                {assigning ? 'Đang phân công...' : 'Xác Nhận Bổ Nhiệm PM'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

