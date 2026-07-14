import { useState, useEffect } from 'react';
import { authService, AuthResponse, UserRole, settingService, SystemSetting } from './services/api';
import { GanttChart } from './components/GanttChart';
import { RicefwTracker } from './components/RicefwTracker';
import { ApprovalList } from './components/ApprovalList';
import { SettingsPanel } from './components/SettingsPanel';
import { ProjectManager } from './components/ProjectManager';
import { TeamConfigurator } from './components/TeamConfigurator';
import { BusinessTripTracker } from './components/BusinessTripTracker';
import { UserManager } from './components/UserManager';
import { Calendar, FileText, CheckSquare, DollarSign, LogOut, ArrowRight, Server, ShieldAlert, Users, Sliders, Briefcase, Plane } from 'lucide-react';

function App() {
  const [currentUser, setCurrentUser] = useState<AuthResponse | null>(null);
  const [activeProject, setActiveProject] = useState<UserRole | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSetting>({
    appName: 'ARON Project Management',
    logoUrl: 'https://raw.githubusercontent.com/vitejs/vite/main/packages/vite/src/node/logo.png',
    bannerUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1600',
    smtpHost: '',
    smtpPort: 587,
    smtpEnableSsl: true
  });
  
  // Login form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Tab selections
  const [activeTab, setActiveTab] = useState<'dashboard' | 'gantt' | 'ricefw' | 'approvals' | 'costs' | 'environments' | 'team' | 'trips' | 'projects' | 'settings' | 'users'>('dashboard');

  useEffect(() => {
    loadSystemSettings();
    const user = authService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      setActiveProject(null); // Vào thẳng trang chủ Dashboard chung
    }
  }, []);

  const loadSystemSettings = async () => {
    try {
      const data = await settingService.getSettings();
      setSystemSettings(data);
    } catch (err) {
      console.error('Failed to load system settings', err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoginError(null);
      setLoginLoading(true);
      const res = await authService.login(username, password);
      setCurrentUser(res);
      setActiveProject(null); // Vào thẳng trang chủ Dashboard chung
      setActiveTab('dashboard');
    } catch (err: any) {
      setLoginError(err.message || 'Sai tên đăng nhập hoặc mật khẩu.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setActiveProject(null);
    setUsername('');
    setPassword('');
  };

  const selectProject = (projId: number) => {
    if (!currentUser) return;
    const found = currentUser.projectRoles.find(r => r.projectId === projId);
    if (found) {
      setActiveProject(found);
    }
  };

  // Login view with rich dark theme aesthetics
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950 px-4 relative overflow-hidden">
        {/* Background gradient lights */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md space-y-8 glass-panel p-8 rounded-3xl border border-dark-800 shadow-2xl relative z-10 animate-slide-up">
          <div className="text-center">
            {systemSettings.logoUrl ? (
              <img src={systemSettings.logoUrl} alt="Logo" className="mx-auto h-12 object-contain" />
            ) : (
              <span className="text-4xl">📊</span>
            )}
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">{systemSettings.appName}</h1>
            <p className="mt-2 text-xs text-dark-400">Oracle Unified Implementation Tracker</p>
          </div>

          {loginError && (
            <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-dark-300">Tên tài khoản (User account):</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tài khoản" 
                className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-dark-100 placeholder-dark-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all"
                required
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-dark-300">Mật khẩu:</label>
                <button type="button" onClick={() => alert('Vui lòng liên hệ Admin hệ thống để reset mật khẩu.')} className="text-[10px] text-brand-400 hover:underline">Quên mật khẩu?</button>
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu" 
                className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-dark-100 placeholder-dark-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all"
                required
              />
            </div>

            <button 
              type="submit" 
              disabled={loginLoading}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1 shadow-lg shadow-brand-600/20 disabled:opacity-50"
            >
              {loginLoading ? 'Đang xác thực...' : 'Đăng Nhập'} <ArrowRight size={14} />
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      {/* Top Navigation */}
      <header className="border-b border-dark-850 bg-dark-900/60 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex justify-between items-center">
        <div 
          onClick={() => { setActiveProject(null); setActiveTab('dashboard'); }}
          className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"
        >
          {systemSettings.logoUrl ? (
            <img src={systemSettings.logoUrl} alt="Logo" className="h-8 object-contain" />
          ) : (
            <span className="text-2xl">📊</span>
          )}
          <div>
            <h1 className="text-md font-bold text-white tracking-wide">{systemSettings.appName}</h1>
            <p className="text-[10px] text-dark-400">Oracle Unified Implementation Tracker</p>
          </div>
        </div>

        {/* Project Selector & Profile info */}
        <div className="flex items-center gap-4">
          {activeProject && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-dark-400 font-medium">Dự án hoạt động:</span>
              <select 
                value={activeProject.projectId}
                onChange={(e) => {
                  if (e.target.value === "") {
                    setActiveProject(null);
                    setActiveTab('dashboard');
                  } else {
                    selectProject(Number(e.target.value));
                  }
                }}
                className="bg-dark-800 border border-dark-700 text-xs px-3 py-1.5 rounded-lg text-white font-semibold focus:outline-none focus:border-brand-500"
              >
                <option value="">-- Quay lại Dashboard --</option>
                {currentUser.projectRoles.map(r => (
                  <option key={r.projectId} value={r.projectId}>{r.projectCode} - {r.projectName}</option>
                ))}
              </select>
            </div>
          )}

          {/* Profile Card */}
          <div className="flex items-center gap-3 pl-4 border-l border-dark-800">
            <div className="text-right">
              <p className="text-xs font-semibold text-white">{currentUser.fullName}</p>
              <p className="text-[10px] text-brand-400 font-medium capitalize">Role: {activeProject?.roleName || 'System Admin'}</p>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-dark-800 rounded-lg text-dark-400 hover:text-white transition-colors"
              title="Đăng xuất"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex px-6 py-6 gap-6 max-w-7xl w-full mx-auto">
        {/* Left Sidebar Menu */}
        <aside className="w-60 shrink-0 space-y-2">
          {/* Home Dashboard Link (Always available) */}
          <button 
            onClick={() => { setActiveProject(null); setActiveTab('dashboard'); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'dashboard' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
            }`}
          >
            <Sliders size={16} /> Dashboard & Dự Án
          </button>

          {activeProject ? (
            <>
              <button 
                onClick={() => setActiveTab('gantt')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'gantt' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                }`}
              >
                <Calendar size={16} /> Kế hoạch & Sơ đồ Gán
              </button>
              
              <button 
                onClick={() => setActiveTab('ricefw')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'ricefw' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                }`}
              >
                <FileText size={16} /> Quản lý RICEFW (Oracle)
              </button>

              <button 
                onClick={() => setActiveTab('team')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'team' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                }`}
              >
                <Users size={16} /> Đội Ngũ Dự Án
              </button>

              <button 
                onClick={() => setActiveTab('trips')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'trips' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                }`}
              >
                <Plane size={16} /> Công Tác & Tạm Ứng
              </button>

              <button 
                onClick={() => setActiveTab('approvals')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'approvals' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                }`}
              >
                <CheckSquare size={16} /> Timesheets & Phê Duyệt
              </button>

              <button 
                onClick={() => setActiveTab('environments')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'environments' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                }`}
              >
                <Server size={16} /> Môi trường Oracle Instance
              </button>

              <div className="pt-2 border-t border-dark-850">
                <button 
                  onClick={() => setActiveTab('costs')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'costs' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                  }`}
                >
                  <DollarSign size={16} /> Dashboard Chi Phí & Giá Cost
                </button>
              </div>
            </>
          ) : (
            <div className="text-[10px] text-dark-500 px-4 py-3 bg-dark-900/20 border border-dark-850 rounded-xl leading-relaxed">
              Hãy chọn dự án bên khung phải hoặc thanh Header để xem chức năng chi tiết.
            </div>
          )}

          <div className="pt-4 border-t border-dark-850 space-y-2">
            <button 
              onClick={() => setActiveTab('projects')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'projects' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
              }`}
            >
              <Briefcase size={16} /> Khởi Tạo & Quản Lý Dự Án
            </button>

            {(currentUser.globalRole === 'SYSTEM_ADMIN' || currentUser.projectRoles?.some(r => r.roleCode === 'PM')) && (
              <button 
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'users' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                }`}
              >
                <Users size={16} /> Quản Lý Người Dùng
              </button>
            )}

            {currentUser.globalRole === 'SYSTEM_ADMIN' && (
              <button 
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'settings' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                }`}
              >
                <Sliders size={16} /> Thiết Lập Hệ Thống
              </button>
            )}
          </div>
        </aside>

        {/* Content Pane */}
        <main className="flex-1 min-w-0">
          <div className="animate-fade-in">
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Banner */}
                <div 
                  className="h-44 rounded-3xl bg-cover bg-center border border-dark-800 p-6 flex flex-col justify-end relative overflow-hidden"
                  style={{ backgroundImage: `url(${systemSettings.bannerUrl})` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-dark-950 via-dark-950/40 to-transparent"></div>
                  <div className="relative z-10 space-y-1">
                    <h2 className="text-xl font-extrabold text-white tracking-wide">
                      {systemSettings.appName}
                    </h2>
                    <p className="text-xs text-dark-300">
                      Hệ thống quản lý tích hợp RICEFW, Tiến độ Gantt & Công tác phí dự án Oracle ERP
                    </p>
                  </div>
                </div>

                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-dark-900/60 p-4 rounded-2xl border border-dark-800 text-xs">
                    <p className="text-dark-400 font-semibold">Dự án được phân quyền</p>
                    <p className="text-2xl font-bold text-white mt-1 font-mono">{currentUser.projectRoles.length} Dự án</p>
                  </div>
                  <div className="bg-dark-900/60 p-4 rounded-2xl border border-dark-800 text-xs">
                    <p className="text-dark-400 font-semibold">Tiến độ tổng thể (Gantt Rollup)</p>
                    <div className="mt-2.5 w-full bg-dark-950 rounded-full h-2 overflow-hidden border border-dark-800">
                      <div className="bg-brand-500 h-full rounded-full" style={{ width: '65%' }}></div>
                    </div>
                    <p className="text-[10px] text-brand-400 mt-1 font-bold">65% Hoàn thành</p>
                  </div>
                  <div className="bg-dark-900/60 p-4 rounded-2xl border border-dark-800 text-xs">
                    <p className="text-dark-400 font-semibold">Tỷ lệ RICEFW SIT/UAT Passed</p>
                    <div className="mt-2.5 w-full bg-dark-950 rounded-full h-2 overflow-hidden border border-dark-800">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: '42%' }}></div>
                    </div>
                    <p className="text-[10px] text-emerald-400 mt-1 font-bold">42% Hoàn thành</p>
                  </div>
                  <div className="bg-dark-900/60 p-4 rounded-2xl border border-dark-800 text-xs">
                    <p className="text-dark-400 font-semibold">Tỷ lệ sử dụng Ngân sách</p>
                    <div className="mt-2.5 w-full bg-dark-950 rounded-full h-2 overflow-hidden border border-dark-800">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: '18%' }}></div>
                    </div>
                    <p className="text-[10px] text-amber-400 mt-1 font-bold">18% Đã chi tiêu</p>
                  </div>
                </div>

                {/* Dashboard Chart Mock and Projects List Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Projects list assigned to this user */}
                  <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-xs font-bold text-dark-400 uppercase tracking-wider">
                      Danh sách dự án của bạn
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {currentUser.projectRoles.map((pr) => (
                        <div key={pr.projectId} className="glass-panel p-5 rounded-2xl border border-dark-800 flex flex-col justify-between space-y-4 hover:border-dark-750 transition-all">
                          <div className="space-y-2">
                            <span className="text-[9px] font-bold font-mono text-brand-400 px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/10">
                              {pr.projectCode}
                            </span>
                            <h4 className="text-sm font-bold text-white mt-1 leading-snug">{pr.projectName}</h4>
                            <p className="text-xs text-dark-400">Vai trò: <strong className="text-brand-400 capitalize">{pr.roleName}</strong></p>
                            {pr.functionalTeamName && (
                              <p className="text-[10px] text-dark-500">Team: {pr.functionalTeamName}</p>
                            )}
                          </div>

                          <button
                            onClick={() => {
                              selectProject(pr.projectId);
                              setActiveTab('gantt');
                            }}
                            className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all"
                          >
                            Truy Cập Dự Án <ArrowRight size={12} />
                          </button>
                        </div>
                      ))}

                      {currentUser.projectRoles.length === 0 && (
                        <div className="col-span-2 text-center py-12 bg-dark-900/10 border border-dashed border-dark-850 rounded-2xl text-dark-500 text-xs">
                          Bạn chưa được gán vào dự án nào. Vui lòng chuyển qua tab "Khởi Tạo & Quản Lý Dự Án" để tạo mới (nếu là Admin) hoặc liên hệ Admin để được phân quyền.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: High-tech mockup chart representing Project KPI progress */}
                  <div className="bg-dark-900/40 p-5 rounded-2xl border border-dark-800 space-y-4">
                    <h3 className="text-xs font-bold text-dark-400 uppercase tracking-wider">
                      Đồ Thị KPI & Tiến Độ Dự Án
                    </h3>
                    <div className="space-y-4">
                      {/* Bar graph representing multiple project burn rates */}
                      <div className="space-y-3 pt-2">
                        {currentUser.projectRoles.map((pr, index) => (
                          <div key={pr.projectId} className="space-y-1">
                            <div className="flex justify-between text-[10px] text-dark-300 font-mono">
                              <span>{pr.projectCode}</span>
                              <span>{index === 0 ? '78%' : '45%'}</span>
                            </div>
                            <div className="w-full bg-dark-950 h-3 rounded-full overflow-hidden border border-dark-850">
                              <div 
                                className={`h-full rounded-full ${index === 0 ? 'bg-brand-500' : 'bg-emerald-500'}`} 
                                style={{ width: index === 0 ? '78%' : '45%' }}
                              ></div>
                            </div>
                          </div>
                        ))}
                        {currentUser.projectRoles.length === 0 && (
                          <div className="text-center text-dark-600 italic text-[11px] py-10">
                            Chưa có dữ liệu đồ thị dự án
                          </div>
                        )}
                      </div>
                      
                      {/* Sub notes */}
                      <div className="bg-dark-950/60 p-3 rounded-xl border border-dark-850 text-[10px] text-dark-500 leading-relaxed">
                        ⚡ Đồ thị phân tích tiến độ thực tế (Gantt Task Slippage) và tỷ lệ hoàn thành RICEFW theo thời gian thực.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'projects' && (
              <ProjectManager 
                currentUserGlobalRole={currentUser?.globalRole} 
                onProjectCreated={() => {
                  loadSystemSettings();
                  window.location.reload();
                }} 
              />
            )}
            
            {activeTab === 'settings' && <SettingsPanel onSettingsUpdate={(s) => setSystemSettings(s)} />}

            {activeTab === 'users' && <UserManager currentUserGlobalRole={currentUser?.globalRole} />}

            {activeTab !== 'dashboard' && activeTab !== 'projects' && activeTab !== 'settings' && activeTab !== 'users' && (
              activeProject ? (
                <>
                  {activeTab === 'gantt' && <GanttChart projectId={activeProject.projectId} userRole={activeProject.roleCode} />}
                  
                  {activeTab === 'ricefw' && <RicefwTracker projectId={activeProject.projectId} userRole={activeProject.roleCode} />}
                  
                  {activeTab === 'team' && <TeamConfigurator projectId={activeProject.projectId} userRole={activeProject.roleCode} />}

                  {activeTab === 'trips' && <BusinessTripTracker projectId={activeProject.projectId} userRole={activeProject.roleCode} />}

                  {activeTab === 'approvals' && <ApprovalList projectId={activeProject.projectId} userRole={activeProject.roleCode} />}
                  
                  {activeTab === 'environments' && (
                    <div className="space-y-6">
                      <div className="bg-dark-900/40 p-4 rounded-xl border border-dark-800">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                          <Server className="text-brand-500" /> Quản Lý Phiên Bản & Môi Trường (Oracle Instances)
                        </h2>
                        <p className="text-xs text-dark-400 mt-1">Theo dõi các môi trường phát triển, kiểm thử tích hợp (CRP/SIT) và UAT</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-dark-900/60 p-5 rounded-xl border border-dark-800 space-y-2">
                          <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">HOẠT ĐỘNG (ACTIVE)</span>
                          <h3 className="text-md font-bold text-white">Môi trường DEV1</h3>
                          <p className="text-xs text-dark-400">Phiên bản: Fusion Cloud 24C</p>
                          <p className="text-xs text-dark-400">Mô tả: Môi trường cấu hình & test nội bộ của ARON Tech Team</p>
                          <p className="text-[10px] text-dark-500 pt-2 border-t border-dark-800">Cập nhật lúc: 14/07/2026</p>
                        </div>

                        <div className="bg-dark-900/60 p-5 rounded-xl border border-dark-800 space-y-2">
                          <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">HOẠT ĐỘNG (ACTIVE)</span>
                          <h3 className="text-md font-bold text-white">Môi trường TEST1</h3>
                          <p className="text-xs text-dark-400">Phiên bản: Fusion Cloud 24C</p>
                          <p className="text-xs text-dark-400">Mô tả: Môi trường phục vụ các đợt kiểm thử tích hợp CRP & SIT</p>
                          <p className="text-[10px] text-dark-500 pt-2 border-t border-dark-800">Cập nhật lúc: 14/07/2026</p>
                        </div>

                        <div className="bg-dark-900/60 p-5 rounded-xl border border-dark-800/80 border-dashed space-y-2 opacity-60">
                          <span className="text-[10px] bg-dark-800 border border-dark-700 text-dark-400 px-2 py-0.5 rounded font-bold">CHƯA KHỞI TẠO</span>
                          <h3 className="text-md font-bold text-dark-300">Môi trường UAT</h3>
                          <p className="text-xs text-dark-400">Phiên bản: Fusion Cloud 24C</p>
                          <p className="text-xs text-dark-400">Mô tả: Dành cho khách hàng kiểm thử chấp nhận (UAT) sau khi hoàn thành SIT</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'costs' && (
                    <div className="space-y-6">
                      <div className="bg-dark-900/40 p-4 rounded-xl border border-dark-800">
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                          <DollarSign className="text-emerald-500" /> Dashboard Quản Lý Giá Cost & Tài Chính Dự Án
                        </h2>
                        <p className="text-xs text-dark-400 mt-1">Chỉ tài khoản PM và Director có quyền xem bảng kê chi phí và đơn giá ngày công</p>
                      </div>

                      {/* Role costing block */}
                      {activeProject.roleCode === 'PM' || activeProject.roleCode === 'DIRECTOR' || currentUser.globalRole === 'SYSTEM_ADMIN' ? (
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-dark-900/60 p-5 rounded-xl border border-dark-800 text-xs">
                              <p className="text-dark-400">Tổng Chi Phí Nhân Sự Ghi Nhận (Actual Cost)</p>
                              <p className="text-xl font-bold text-white mt-1">45,800,000 VNĐ</p>
                            </div>
                            <div className="bg-dark-900/60 p-5 rounded-xl border border-dark-800 text-xs">
                              <p className="text-dark-400">Chi Phí Tạm Ứng Công Tác (Advance Claims)</p>
                              <p className="text-xl font-bold text-emerald-400 mt-1">2,000,000 VNĐ</p>
                            </div>
                            <div className="bg-dark-900/60 p-5 rounded-xl border border-dark-800 text-xs">
                              <p className="text-dark-400">Ngân Sách Dự Kiến Dự Án (Planned Budget)</p>
                              <p className="text-xl font-bold text-brand-400 mt-1">1,200,000,000 VNĐ</p>
                            </div>
                          </div>

                          <div className="bg-dark-900/20 p-5 rounded-xl border border-dark-800 space-y-4 text-xs">
                            <h3 className="text-sm font-bold text-white border-b border-dark-800 pb-2">
                              Bảng kê Đơn giá Ngày công Thành viên (Consultant Daily Rates)
                            </h3>
                            <table className="w-full text-left">
                              <thead>
                                <tr className="text-dark-400 font-bold border-b border-dark-800 pb-2">
                                  <th className="pb-2">Họ và Tên</th>
                                  <th className="pb-2">Vị trí dự án</th>
                                  <th className="pb-2">Phân hệ / Đội nhóm</th>
                                  <th className="pb-2 text-right">Đơn giá ngày công (Daily Rate)</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr className="border-b border-dark-800/40">
                                  <td className="py-3 font-semibold text-white">John PM</td>
                                  <td>Project Manager (PM)</td>
                                  <td>Ban PMO</td>
                                  <td className="text-right font-mono text-emerald-400">350 USD / ngày</td>
                                </tr>
                                <tr className="border-b border-dark-800/40">
                                  <td className="py-3 font-semibold text-white">Lê Lead Finance</td>
                                  <td>Module Lead</td>
                                  <td>Team FIN (Tài chính)</td>
                                  <td className="text-right font-mono text-emerald-400">250 USD / ngày</td>
                                </tr>
                                <tr className="border-b border-dark-800/40">
                                  <td className="py-3 font-semibold text-white">Nguyễn Member AP</td>
                                  <td>Consultant AP</td>
                                  <td>Team FIN (Tài chính)</td>
                                  <td className="text-right font-mono text-emerald-400">150 USD / ngày</td>
                                </tr>
                                <tr>
                                  <td className="py-3 font-semibold text-white">Phạm Tech Developer</td>
                                  <td>Technical Consultant</td>
                                  <td>Team Tech (Kỹ thuật)</td>
                                  <td className="text-right font-mono text-emerald-400">180 USD / ngày</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-4 rounded-xl flex items-center gap-3">
                          <ShieldAlert size={18} />
                          <p>Quyền truy cập bị từ chối: Chỉ PM và Director mới có quyền xem thông tin ngân sách và chi phí dự án.</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-20 text-dark-400 text-xs">
                  Bạn chưa được gán vào dự án nào trong hệ thống. Vui lòng chuyển qua tab "Khởi Tạo & Quản Lý Dự Án" để tạo mới hoặc liên hệ Admin gán vào dự án.
                </div>
              )
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
