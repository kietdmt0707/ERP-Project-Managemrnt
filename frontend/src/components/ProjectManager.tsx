import React, { useState, useEffect } from 'react';
import { projectService, ProjectDto } from '../services/api';
import { Briefcase, Plus, Folder, MapPin, Building, Phone, UserPlus, Trash2 } from 'lucide-react';

interface ProjectManagerProps {
  currentUserGlobalRole?: string;
  onProjectCreated?: () => void;
}

export const ProjectManager: React.FC<ProjectManagerProps> = ({ currentUserGlobalRole, onProjectCreated }) => {
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

  // Assign PM states
  const [showAssignPmModal, setShowAssignPmModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [pmUsername, setPmUsername] = useState('');
  const [pmFullName, setPmFullName] = useState('');
  const [pmEmail, setPmEmail] = useState('');
  const [assigning, setAssigning] = useState(false);

  const isAdmin = currentUserGlobalRole === 'SYSTEM_ADMIN';

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
        logoPath: logoPath || 'https://raw.githubusercontent.com/vitejs/vite/main/packages/vite/src/node/logo.png'
      });
      setShowModal(false);
      // Reset form
      setProjectCode('');
      setProjectName('');
      setAddress('');
      setSitesCount(1);
      setContactInfo('');
      setLogoPath('');
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
          {projects.map((project) => (
            <div key={project.projectId} className="glass-panel p-5 rounded-2xl border border-dark-800 space-y-4 hover:border-dark-700 transition-all flex flex-col justify-between">
              <div className="space-y-3">
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

                <div className="space-y-2 text-xs text-dark-300 pt-2">
                  <p className="flex items-center gap-2"><MapPin size={13} className="text-dark-500 shrink-0" /> Địa chỉ: {project.address || 'N/A'}</p>
                  <p className="flex items-center gap-2"><Building size={13} className="text-dark-500 shrink-0" /> Số lượng Sites: {project.sitesCount} Sites</p>
                  <p className="flex items-center gap-2"><Phone size={13} className="text-dark-500 shrink-0" /> Liên hệ: {project.contactInfo || 'N/A'}</p>
                </div>
              </div>

              <div className="pt-4 border-t border-dark-850 space-y-3">
                <div className="flex items-center justify-between text-[10px] text-dark-500">
                  <span>Trạng thái: 
                    <span className={`ml-1 font-bold ${project.isActive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {project.isActive ? 'ĐANG HOẠT ĐỘNG' : 'TẠM NGỪNG'}
                    </span>
                  </span>
                  <span className="font-mono">ID: {project.projectId}</span>
                </div>

                 {isAdmin && (
                  <button
                    onClick={() => { setSelectedProjectId(project.projectId!); setShowAssignPmModal(true); }}
                    className="w-full bg-dark-800 hover:bg-dark-750 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 border border-dark-700 transition-colors"
                  >
                    <UserPlus size={14} /> Bổ nhiệm & Phân công PM
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel p-6 rounded-2xl border border-dark-800 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Folder className="text-brand-500" /> Thêm Dự Án Mới
              </h3>
              <button 
                onClick={() => setShowModal(false)}
                className="text-xs text-dark-400 hover:text-white"
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Mã Dự Án (Code):</label>
                  <input 
                    type="text" 
                    value={projectCode}
                    onChange={(e) => setProjectCode(e.target.value)}
                    placeholder="VD: ARON-ORACLE"
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
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
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
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
                  className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
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
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Thông tin liên hệ (Người phụ trách):</label>
                  <input 
                    type="text" 
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    placeholder="Họ tên, SĐT, Email"
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Đường dẫn Logo dự án (Logo URL):</label>
                <input 
                  type="text" 
                  value={logoPath}
                  onChange={(e) => setLogoPath(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
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

      {/* Assign PM Modal */}
      {showAssignPmModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-dark-800 shadow-2xl space-y-4 animate-slide-up">
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

            <form onSubmit={handleAssignPmSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Tên tài khoản PM (Username):</label>
                <input 
                  type="text" 
                  value={pmUsername}
                  onChange={(e) => setPmUsername(e.target.value)}
                  placeholder="VD: pm_john, pm_mary"
                  className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
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
                  className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
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
                  className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
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
