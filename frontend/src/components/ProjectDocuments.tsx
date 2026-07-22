import React, { useState, useEffect } from 'react';
import { projectService, ProjectDto } from '../services/api';
import { Folder, Settings, Upload, Eye, File, ShieldCheck, ExternalLink, Info } from 'lucide-react';

interface ProjectDocumentsProps {
  projectId: number;
  userRole: string;
}

export const ProjectDocuments: React.FC<ProjectDocumentsProps> = ({ projectId, userRole }) => {
  const [project, setProject] = useState<ProjectDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkInput, setLinkInput] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [viewMode, setViewMode] = useState<'iframe' | 'explorer'>('iframe');

  // Mock document explorer states
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [mockFiles, setMockFiles] = useState([
    { name: 'MD050_Functional_Design_FIN.docx', size: '2.4 MB', updated: '15/07/2026', folder: 'Functional Specs' },
    { name: 'MD070_Technical_Design_Custom_RICEFW.docx', size: '4.1 MB', updated: '16/07/2026', folder: 'Technical Specs' },
    { name: 'UAT_Signoff_Phase1_Signed.pdf', size: '1.8 MB', updated: '18/07/2026', folder: 'UAT Sign-off' },
    { name: 'Oracle_AIM_Template_MD050.dotx', size: '850 KB', updated: '10/07/2026', folder: 'Templates & Guidelines' }
  ]);

  const canConfigure = userRole === 'PM' || userRole === 'DIRECTOR' || userRole === 'PC';

  useEffect(() => {
    loadProject();
  }, [projectId]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const data = await projectService.getProjectById(projectId);
      setProject(data);
      setLinkInput(data.sharepointFolderLink || '');
    } catch (err) {
      console.error('Lỗi khi tải thông tin dự án:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await projectService.updateSharepointLink(projectId, linkInput);
      if (project) {
        setProject({ ...project, sharepointFolderLink: linkInput });
      }
      setShowConfig(false);
      alert('Cập nhật liên kết thư mục dự án thành công!');
    } catch (err: any) {
      alert(err.message || 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  const navigateToFolder = (folderName: string) => {
    setCurrentPath([...currentPath, folderName]);
  };

  const navigateUp = () => {
    setCurrentPath(currentPath.slice(0, -1));
  };

  if (loading) {
    return <div className="text-center py-10 text-xs text-dark-400">Đang tải cấu hình tài liệu dự án...</div>;
  }



  return (
    <div className="space-y-6">
      <div className="bg-dark-900-40 p-4 rounded-xl border border-dark-800 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Folder className="text-brand-500" /> Hồ Sơ & Tài Liệu Dự Án (SharePoint / OneDrive Hub)
          </h2>
          <p className="text-xs text-dark-400 mt-1">
            Liên kết trực tiếp đến thư mục bảo mật của dự án trên Office 365, quản lý MD050, MD070 & Biên bản nghiệm thu
          </p>
        </div>
        {canConfigure && (
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="bg-dark-800 hover:bg-dark-700 border border-dark-700 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center gap-1.5 transition-all"
          >
            <Settings size={14} /> Cấu hình Thư mục
          </button>
        )}
      </div>

      {/* Config URL view */}
      {showConfig && (
        <form onSubmit={handleSaveLink} className="glass-panel p-5 rounded-2xl border border-dark-800 space-y-4 animate-slide-up">
          <div className="space-y-1">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Cấu hình liên kết thư mục</h3>
            <p className="text-[10px] text-dark-400">
              Hãy dán mã nhúng Iframe hoặc đường dẫn Chia sẻ thư mục OneDrive/SharePoint dành riêng cho dự án này.
            </p>
          </div>

          <div className="flex gap-2">
            <input 
              type="text"
              value={linkInput}
              onChange={e => setLinkInput(e.target.value)}
              placeholder="VD: https://onedrive.live.com/embed?cid=... hoặc link sharepoint thư mục dự án"
              className="flex-1 bg-dark-950 border border-dark-850 text-xs p-3 rounded-xl text-white placeholder-dark-600 focus:outline-none focus:border-brand-500"
              required
            />
            <button
              type="submit"
              disabled={saving}
              className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs px-4 rounded-xl transition-all disabled:opacity-50"
            >
              {saving ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      )}

      {project?.sharepointFolderLink ? (
        /* Real OneDrive / SharePoint Live Embed View */
        <div className="space-y-4">
          <div className="bg-dark-900-60 p-4 rounded-2xl border border-dark-800 flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-brand-500-10 border border-brand-500-20 rounded-xl text-brand-400">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Thư Mục SharePoint / OneDrive Dự Án Đã Liên Kết</p>
                <p className="text-[10px] text-dark-400">Quản lý toàn bộ tài liệu UAT, Blueprint, Thiết kế kỹ thuật MD070 trên Cloud Office 365</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode(viewMode === 'iframe' ? 'explorer' : 'iframe')}
                className="bg-dark-800 hover:bg-dark-750 border border-dark-700 text-white font-bold text-xs py-2.5 px-3.5 rounded-xl flex items-center gap-1.5 transition-all"
              >
                {viewMode === 'iframe' ? <File size={14} /> : <Eye size={14} />}
                {viewMode === 'iframe' ? 'Chuyển Xem Quản Lý File' : 'Xem Khung Nhúng Web'}
              </button>

              <a 
                href={project.sharepointFolderLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-brand-600-10"
              >
                Mở Trực Tiếp Trên SharePoint Web <ExternalLink size={13} />
              </a>
            </div>
          </div>

          {/* Microsoft Security Info Banner */}
          <div className="bg-blue-500/10 border border-blue-500/20 p-3.5 rounded-xl flex items-center justify-between text-xs text-blue-300">
            <div className="flex items-center gap-2">
              <Info size={16} className="shrink-0 text-blue-400" />
              <span>
                <strong>Bảo mật Microsoft 365 (CSP Directive):</strong> Microsoft ngăn cấm việc nhúng iframe trực tiếp từ các domain bên ngoài. Nếu khung hình bên dưới hiển thị <em>"từ chối kết nối"</em>, vui lòng bấm nút <strong>"Mở Trực Tiếp Trên SharePoint Web ↗"</strong> ở trên để truy cập tài liệu trong Tab mới.
              </span>
            </div>
          </div>

          {viewMode === 'iframe' ? (
            <div className="w-full h-[550px] rounded-2xl overflow-hidden border border-dark-800 bg-dark-950 shadow-2xl relative">
              <iframe 
                src={project.sharepointFolderLink} 
                className="w-full h-full border-0" 
                title="OneDrive SharePoint Files"
                allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
              />
            </div>
          ) : (
            <div className="glass-panel rounded-2xl border border-dark-800 overflow-hidden flex flex-col h-[480px]">
              <div className="bg-dark-900-60 p-4 border-b border-dark-800 flex justify-between items-center text-xs">
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-dark-500">Root</span>
                  {currentPath.map((p, idx) => (
                    <React.Fragment key={idx}>
                      <span className="text-dark-600">/</span>
                      <span className="text-brand-400 font-semibold">{p}</span>
                    </React.Fragment>
                  ))}
                </div>
                {currentPath.length > 0 && (
                  <button 
                    onClick={navigateUp}
                    className="bg-dark-800 hover:bg-dark-750 px-3 py-1 rounded text-[10px] font-semibold text-white transition-colors"
                  >
                    Quay lại thư mục cha
                  </button>
                )}
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-4">
                {currentPath.length === 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {['Functional Specs', 'Technical Specs', 'UAT Sign-off', 'Templates & Guidelines'].map((folder) => (
                      <div 
                        key={folder}
                        onClick={() => navigateToFolder(folder)}
                        className="p-4 bg-dark-900-40 hover:bg-dark-900/80 border border-dark-850 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:scale-102 hover:border-brand-500/30"
                      >
                        <Folder size={32} className="text-brand-500" />
                        <span className="text-xs font-semibold text-white text-center">{folder}</span>
                        <span className="text-[10px] text-dark-500">Thư mục</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {mockFiles
                      .filter(f => f.folder === currentPath[currentPath.length - 1])
                      .map((file) => (
                        <div 
                          key={file.name}
                          className="p-3 bg-dark-900-30 border border-dark-850 hover:border-dark-800 rounded-xl flex justify-between items-center text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <File size={16} className="text-brand-400" />
                            <div>
                              <p className="font-semibold text-white">{file.name}</p>
                              <p className="text-[10px] text-dark-500">Dung lượng: {file.size} | Cập nhật ngày: {file.updated}</p>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button 
                              onClick={() => alert(`Mở xem tài liệu: ${file.name}`)}
                              className="bg-dark-800 hover:bg-dark-750 p-1.5 rounded text-dark-300 hover:text-white transition-colors"
                              title="Xem trước"
                            >
                              <Eye size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Simulated Interactive Document Explorer to show how it functions */
        <div className="space-y-4">
          <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex justify-between items-center text-xs text-amber-400">
            <div className="space-y-1">
              <p className="font-semibold">⚠️ Chưa cấu hình thư mục OneDrive / SharePoint cho dự án này</p>
              <p className="text-[10px] text-dark-400">
                {canConfigure 
                  ? 'Click "Cấu hình Thư mục" ở góc phải để dán link share của dự án. Đang hiển thị thư mục mô phỏng.' 
                  : 'Vui lòng liên hệ PM hoặc Coordinator để liên kết thư mục tài liệu dự án.'}
              </p>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-dark-800 overflow-hidden flex flex-col h-[480px]">
            {/* File manager header */}
            <div className="bg-dark-900-60 p-4 border-b border-dark-800 flex justify-between items-center text-xs">
              <div className="flex items-center gap-2 font-mono">
                <span className="text-dark-500">Root</span>
                {currentPath.map((p, idx) => (
                  <React.Fragment key={idx}>
                    <span className="text-dark-600">/</span>
                    <span className="text-brand-400 font-semibold">{p}</span>
                  </React.Fragment>
                ))}
              </div>
              {currentPath.length > 0 && (
                <button 
                  onClick={navigateUp}
                  className="bg-dark-800 hover:bg-dark-750 px-3 py-1 rounded text-[10px] font-semibold text-white transition-colors"
                >
                  Quay lại thư mục cha
                </button>
              )}
            </div>

            {/* Folder Explorer Area */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4">
              {currentPath.length === 0 ? (
                /* Root Folders view */
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['Functional Specs', 'Technical Specs', 'UAT Sign-off', 'Templates & Guidelines'].map((folder) => (
                    <div 
                      key={folder}
                      onClick={() => navigateToFolder(folder)}
                      className="p-4 bg-dark-900-40 hover:bg-dark-900/80 border border-dark-850 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:scale-102 hover:border-brand-500/30"
                    >
                      <Folder size={32} className="text-brand-500" />
                      <span className="text-xs font-semibold text-white text-center">{folder}</span>
                      <span className="text-[10px] text-dark-500">Thư mục</span>
                    </div>
                  ))}
                </div>
              ) : (
                /* Files under current folder */
                <div className="space-y-2">
                  {mockFiles
                    .filter(f => f.folder === currentPath[currentPath.length - 1])
                    .map((file) => (
                      <div 
                        key={file.name}
                        className="p-3 bg-dark-900-30 border border-dark-850 hover:border-dark-800 rounded-xl flex justify-between items-center text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <File size={16} className="text-brand-400" />
                          <div>
                            <p className="font-semibold text-white">{file.name}</p>
                            <p className="text-[10px] text-dark-500">Dung lượng: {file.size} | Cập nhật ngày: {file.updated}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => alert(`Mở xem tài liệu mô phỏng: ${file.name}`)}
                            className="bg-dark-800 hover:bg-dark-750 p-1.5 rounded text-dark-300 hover:text-white transition-colors"
                            title="Xem trước"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      </div>
                    ))}

                  {mockFiles.filter(f => f.folder === currentPath[currentPath.length - 1]).length === 0 && (
                    <div className="text-center py-12 text-dark-500 text-xs italic">
                      Thư mục trống. Nhấn nút để tải tệp lên.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Folder Footer upload simulation */}
            {canConfigure && (
              <div className="bg-dark-900-40 p-4 border-t border-dark-850 flex justify-between items-center text-xs">
                <p className="text-dark-500 font-mono text-[10px]">📁 Dung lượng sử dụng: 10.2 MB / 100 GB</p>
                <button
                  onClick={() => {
                    if (currentPath.length === 0) {
                      alert('Vui lòng vào một thư mục con trước khi tải tệp lên!');
                      return;
                    }
                    const name = prompt('Nhập tên file tài liệu muốn upload:');
                    if (name) {
                      setMockFiles([
                        ...mockFiles,
                        {
                          name,
                          size: '1.5 MB',
                          updated: new Date().toLocaleDateString('vi-VN'),
                          type: name.split('.').pop() || 'pdf',
                          folder: currentPath[currentPath.length - 1]
                        }
                      ]);
                      alert('Upload tệp lên OneDrive giả lập thành công!');
                    }
                  }}
                  className="bg-brand-600 hover:bg-brand-500 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                >
                  <Upload size={12} /> Tải Tệp Lên
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
