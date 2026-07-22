import { useState, useEffect } from 'react';
import { authService, AuthResponse, UserRole, settingService, SystemSetting, userService, hasPermission } from './services/api';
import { GanttChart } from './components/GanttChart';
import { RicefwTracker } from './components/RicefwTracker';
import { ApprovalList } from './components/ApprovalList';
import { SettingsPanel } from './components/SettingsPanel';
import { ProjectManager } from './components/ProjectManager';
import { TeamConfigurator } from './components/TeamConfigurator';
import { BusinessTripTracker } from './components/BusinessTripTracker';
import { UserManager } from './components/UserManager';
import { MasterDataManager } from './components/MasterDataManager';
import { ProjectDocuments } from './components/ProjectDocuments';
import { LeaveManagement } from './components/LeaveManagement';
import { TravelPolicyConfig } from './components/TravelPolicyConfig';
import { Calendar, FileText, CheckSquare, DollarSign, LogOut, ArrowRight, Server, ShieldAlert, Users, Sliders, Briefcase, Plane, Folder, Eye, EyeOff, Clipboard } from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Forgot / Reset password states
  const [authMode, setAuthMode] = useState<'login' | 'forgot' | 'reset'>('login');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMessage, setForgotMessage] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetPasswordStr, setResetPasswordStr] = useState('');
  const [resetConfirmPasswordStr, setResetConfirmPasswordStr] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  // Theme & Mode States
  const [activeTheme, setActiveTheme] = useState<string>(() => {
    return localStorage.getItem('aron-app-theme') || 'default';
  });
  const [activeMode, setActiveMode] = useState<string>(() => {
    return localStorage.getItem('aron-app-mode') || 'dark';
  });

  useEffect(() => {
    const html = document.documentElement;
    const themeKey = `${activeTheme}-${activeMode}`;
    html.setAttribute('data-theme', themeKey);
    localStorage.setItem('aron-app-theme', activeTheme);
    localStorage.setItem('aron-app-mode', activeMode);
  }, [activeTheme, activeMode]);

  // Profile Modal states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileFullName, setProfileFullName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileAvatarPath, setProfileAvatarPath] = useState('');
  const [profileAnnualLeaveDays, setProfileAnnualLeaveDays] = useState(12);
  const [profileCarryOverDays, setProfileCarryOverDays] = useState(0);
  const [profilePassword, setProfilePassword] = useState('');
  const [profileConfirmPassword, setProfileConfirmPassword] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const handleOpenProfile = () => {
    if (currentUser) {
      setProfileFullName(currentUser.fullName);
      setProfileEmail(currentUser.email);
      setProfilePhone(currentUser.phone || '');
      setProfileAvatarPath(currentUser.avatarPath || '');
      setProfileAnnualLeaveDays(currentUser.annualLeaveDays || 12);
      setProfileCarryOverDays(currentUser.carryOverDays || 0);
      setProfilePassword('');
      setProfileConfirmPassword('');
      setProfileError(null);
      setShowProfileModal(true);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentUser.userId) return;

    if (profilePassword && profilePassword.length < 8) {
      setProfileError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }

    if (profilePassword !== profileConfirmPassword) {
      setProfileError('Mật khẩu xác nhận không khớp.');
      return;
    }

    try {
      setProfileSaving(true);
      setProfileError(null);

      const updateData: any = {
        fullName: profileFullName,
        email: profileEmail,
        phone: profilePhone,
        avatarPath: profileAvatarPath,
        annualLeaveDays: Number(profileAnnualLeaveDays),
        carryOverDays: Number(profileCarryOverDays)
      };

      if (profilePassword) {
        updateData.password = profilePassword;
      }

      const updatedUser = await userService.updateUser(currentUser.userId, updateData);
      
      // Update local storage and current user state
      const updatedCurrentUser = {
        ...currentUser,
        fullName: updatedUser.fullName,
        email: updatedUser.email,
        phone: updatedUser.phone,
        avatarPath: updatedUser.avatarPath,
        annualLeaveDays: updatedUser.annualLeaveDays,
        carryOverDays: updatedUser.carryOverDays
      };

      localStorage.setItem('aron_pm_user', JSON.stringify(updatedCurrentUser));
      setCurrentUser(updatedCurrentUser);
      
      alert('Cập nhật thông tin cá nhân thành công!');
      setShowProfileModal(false);
    } catch (err: any) {
      setProfileError(err.message || 'Cập nhật thất bại.');
    } finally {
      setProfileSaving(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setResetToken(token);
      setAuthMode('reset');
    }
  }, []);

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setForgotError(null);
      setForgotMessage(null);
      setForgotLoading(true);
      const res = await authService.forgotPassword(forgotEmail);
      setForgotMessage(res.message || 'Yêu cầu thành công. Vui lòng kiểm tra email của bạn.');
    } catch (err: any) {
      setForgotError(err.message || 'Có lỗi xảy ra khi yêu cầu khôi phục mật khẩu.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetPasswordStr.length < 8) {
      setResetError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (resetPasswordStr !== resetConfirmPasswordStr) {
      setResetError('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (!resetToken) {
      setResetError('Mã xác thực token bị thiếu.');
      return;
    }

    try {
      setResetError(null);
      setResetMessage(null);
      setResetLoading(true);
      const res = await authService.resetPassword(resetToken, resetPasswordStr);
      setResetMessage(res.message || 'Đặt lại mật khẩu thành công.');
      setTimeout(() => {
        window.history.replaceState({}, document.title, window.location.pathname);
        setResetToken(null);
        setAuthMode('login');
        setResetMessage(null);
        setResetPasswordStr('');
        setResetConfirmPasswordStr('');
      }, 3000);
    } catch (err: any) {
      setResetError(err.message || 'Có lỗi xảy ra khi đặt lại mật khẩu.');
    } finally {
      setResetLoading(false);
    }
  };

  // Tab selections
  const [activeTab, setActiveTab] = useState<'dashboard' | 'gantt' | 'ricefw' | 'approvals' | 'costs' | 'environments' | 'team' | 'trips' | 'projects' | 'settings' | 'users' | 'documents' | 'masterdata' | 'leaves' | 'travelpolicy'>('dashboard');

  useEffect(() => {
    loadSystemSettings();
    
    // Auto-fill saved credentials if they exist
    const savedUser = localStorage.getItem('aron_pm_saved_username');
    const savedPass = localStorage.getItem('aron_pm_saved_password');
    if (savedUser && savedPass) {
      setUsername(savedUser);
      setPassword(savedPass);
      setRememberMe(true);
    }

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

      // Save credentials if Remember Me is checked
      if (rememberMe) {
        localStorage.setItem('aron_pm_saved_username', username);
        localStorage.setItem('aron_pm_saved_password', password);
      } else {
        localStorage.removeItem('aron_pm_saved_username');
        localStorage.removeItem('aron_pm_saved_password');
      }

      setCurrentUser(res);
      setActiveProject(null); // Vào thẳng trang chủ Dashboard chung
      setActiveTab('dashboard');
    } catch (err: any) {
      setLoginError(err.message || 'Sai tên đăng nhập hoặc mật khẩu.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleMicrosoftSSO = async () => {
    const email = prompt("Đăng nhập Microsoft Office 365. Hãy nhập email Outlook của bạn:");
    if (!email) return;

    if (!email.includes("@")) {
      alert("Vui lòng nhập đúng định dạng Email.");
      return;
    }

    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await authService.loginMicrosoftSSO(email);
      setCurrentUser(res);
      setActiveProject(null);
      setActiveTab('dashboard');
    } catch (err: any) {
      setLoginError(err.message || 'SSO Microsoft thất bại. Vui lòng thử lại.');
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

  // Login, Forgot, Reset password view with rich dark theme aesthetics
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

          {authMode === 'login' && (
            <>
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
                    <button 
                      type="button" 
                      onClick={() => { setAuthMode('forgot'); setLoginError(null); }} 
                      className="text-[10px] text-brand-400 hover:underline"
                    >
                      Quên mật khẩu?
                    </button>
                  </div>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"} 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Nhập mật khẩu" 
                      className="w-full bg-dark-900 border border-dark-800 text-xs p-3 pr-10 rounded-xl text-dark-100 placeholder-dark-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded bg-dark-900 border-dark-800 text-brand-500 focus:ring-brand-500/30 w-3.5 h-3.5"
                    />
                    <span className="text-[10px] text-dark-400 font-medium">Ghi nhớ đăng nhập</span>
                  </label>
                </div>

                <button 
                  type="submit" 
                  disabled={loginLoading}
                  className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1 shadow-lg shadow-brand-600/20 disabled:opacity-50"
                >
                  {loginLoading ? 'Đang xác thực...' : 'Đăng Nhập'} <ArrowRight size={14} />
                </button>

                <div className="flex items-center my-3">
                  <div className="flex-1 border-t border-dark-850"></div>
                  <span className="px-3 text-[9px] text-dark-500 uppercase tracking-wider font-semibold">Hoặc đăng nhập bằng</span>
                  <div className="flex-1 border-t border-dark-850"></div>
                </div>

                <button
                  type="button"
                  onClick={handleMicrosoftSSO}
                  className="w-full bg-dark-900 hover:bg-dark-850 border border-dark-800 text-dark-100 p-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0H10.8286V10.8286H0V0Z" fill="#F25022"/>
                    <path d="M12.1714 0H23V10.8286H12.1714V0Z" fill="#7FBA00"/>
                    <path d="M0 12.1714H10.8286V23H0V12.1714Z" fill="#00A4EF"/>
                    <path d="M12.1714 12.1714H23V23H12.1714V12.1714Z" fill="#FFB900"/>
                  </svg>
                  Tài Khoản Microsoft Office 365
                </button>
              </form>
            </>
          )}

          {authMode === 'forgot' && (
            <>
              {forgotMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-xl">
                  {forgotMessage}
                </div>
              )}
              {forgotError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl">
                  {forgotError}
                </div>
              )}

              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-dark-300">Nhập Email tài khoản:</label>
                  <input 
                    type="email" 
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="example@aron.com" 
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-dark-100 placeholder-dark-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all"
                    required
                  />
                  <p className="text-[10px] text-dark-500 mt-1">Hệ thống sẽ gửi link khôi phục mật khẩu nếu email tồn tại.</p>
                </div>

                <button 
                  type="submit" 
                  disabled={forgotLoading}
                  className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1 shadow-lg shadow-brand-600/20 disabled:opacity-50"
                >
                  {forgotLoading ? 'Đang xử lý...' : 'Gửi Yêu Cầu Khôi Phục'} <ArrowRight size={14} />
                </button>

                <button 
                  type="button" 
                  onClick={() => { setAuthMode('login'); setForgotError(null); setForgotMessage(null); }}
                  className="w-full text-center text-xs text-dark-400 hover:text-white pt-2 hover:underline block"
                >
                  Quay lại Đăng nhập
                </button>
              </form>
            </>
          )}

          {authMode === 'reset' && (
            <>
              {resetMessage && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-xl">
                  {resetMessage}
                </div>
              )}
              {resetError && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl">
                  {resetError}
                </div>
              )}

              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-dark-300">Mật khẩu mới (ít nhất 8 ký tự):</label>
                  <input 
                    type="password" 
                    value={resetPasswordStr}
                    onChange={(e) => setResetPasswordStr(e.target.value)}
                    placeholder="Mật khẩu mới" 
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-dark-100 placeholder-dark-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all"
                    required
                    minLength={8}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-dark-300">Xác nhận mật khẩu mới:</label>
                  <input 
                    type="password" 
                    value={resetConfirmPasswordStr}
                    onChange={(e) => setResetConfirmPasswordStr(e.target.value)}
                    placeholder="Xác nhận mật khẩu" 
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-dark-100 placeholder-dark-600 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-all"
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={resetLoading}
                  className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1 shadow-lg shadow-brand-600/20 disabled:opacity-50"
                >
                  {resetLoading ? 'Đang cập nhật...' : 'Xác Nhận Đổi Mật Khẩu'} <ArrowRight size={14} />
                </button>

                <button 
                  type="button" 
                  onClick={() => { setAuthMode('login'); setResetError(null); setResetMessage(null); }}
                  className="w-full text-center text-xs text-dark-400 hover:text-white pt-2 hover:underline block"
                >
                  Quay lại Đăng nhập
                </button>
              </form>
            </>
          )}
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
            <h1 className="text-sm font-bold text-white tracking-wide">{systemSettings.appName} - Built for Oracle Ecosystem</h1>
            <p className="text-[10px] text-dark-400">Oracle Unified Implementation Tracker</p>
          </div>
        </div>

        {/* Global Search Bar (Oracle ERP Redwood Style) */}
        <div className="flex-1 max-w-sm mx-6 hidden md:block">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Global Search..." 
              className="w-full bg-dark-950 border border-dark-850 text-xs pl-9 pr-3 py-2 rounded-xl text-white placeholder-dark-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20"
            />
            <span className="absolute left-3 top-2.5 text-[10px] text-dark-400">🔍</span>
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
            {currentUser.avatarPath && (
              <img 
                src={currentUser.avatarPath} 
                alt="Avatar" 
                className="w-8 h-8 rounded-full border border-dark-750 object-cover cursor-pointer hover:scale-105 transition-transform" 
                onClick={handleOpenProfile}
              />
            )}
            <button 
              onClick={handleOpenProfile}
              className="text-right hover:opacity-80 transition-opacity flex flex-col items-end"
              title="Thông tin cá nhân & Thiết lập giao diện"
            >
              <p className="text-xs font-semibold text-white">{currentUser.fullName}</p>
              <p className="text-[10px] text-brand-400 font-medium capitalize">
                Role: {activeProject ? activeProject.roleName : (currentUser.globalRole === 'SYSTEM_ADMIN' ? 'Hệ thống Admin' : (currentUser.globalRole === 'PM' ? 'Project Manager' : 'Thành Viên'))}
              </p>
            </button>
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
              {hasPermission(currentUser, 'Gantt') && (
                <button 
                  onClick={() => setActiveTab('gantt')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'gantt' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                  }`}
                >
                  <Calendar size={16} /> Kế hoạch & Sơ đồ Gán
                </button>
              )}
              
              {hasPermission(currentUser, 'RICEFW') && (
                <button 
                  onClick={() => setActiveTab('ricefw')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'ricefw' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                  }`}
                >
                  <FileText size={16} /> Quản lý RICEFW (Oracle)
                </button>
              )}

              {hasPermission(currentUser, 'Team') && (
                <button 
                  onClick={() => setActiveTab('team')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'team' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                  }`}
                >
                  <Users size={16} /> Đội Ngũ Dự Án
                </button>
              )}

              {(hasPermission(currentUser, 'Approvals') || hasPermission(currentUser, 'Costs')) && (
                <button 
                  onClick={() => setActiveTab('trips')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'trips' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                  }`}
                >
                  <Plane size={16} /> Công Tác & Tạm Ứng
                </button>
              )}

              <button 
                onClick={() => setActiveTab('leaves')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'leaves' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                }`}
              >
                <Calendar size={16} /> Quản Lý Nghỉ Phép
              </button>

              {hasPermission(currentUser, 'Approvals') && (
                <button 
                  onClick={() => setActiveTab('approvals')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'approvals' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                  }`}
                >
                  <CheckSquare size={16} /> Timesheets & Phê Duyệt
                </button>
              )}

              {hasPermission(currentUser, 'Settings') && (
                <button 
                  onClick={() => setActiveTab('environments')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'environments' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                  }`}
                >
                  <Server size={16} /> Môi trường Oracle Instance
                </button>
              )}

              {hasPermission(currentUser, 'Projects') && (
                <button 
                  onClick={() => setActiveTab('documents')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === 'documents' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                  }`}
                >
                  <Folder size={16} /> Tài Liệu OneDrive/SharePoint
                </button>
              )}

              {hasPermission(currentUser, 'Costs') && (
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
              )}
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

            {hasPermission(currentUser, 'Users') && (
              <button 
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'users' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                }`}
              >
                <Users size={16} /> Quản Lý Người Dùng
              </button>
            )}

            {hasPermission(currentUser, 'MasterData') && (
              <button 
                onClick={() => setActiveTab('masterdata')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'masterdata' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                }`}
              >
                <Server size={16} /> Master Data & RBAC
              </button>
            )}

            {hasPermission(currentUser, 'Settings') && (
              <button 
                onClick={() => setActiveTab('settings')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'settings' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                }`}
              >
                <Sliders size={16} /> Thiết Lập Hệ Thống
              </button>
            )}

            {hasPermission(currentUser, 'Settings') && (
              <button 
                onClick={() => setActiveTab('travelpolicy')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'travelpolicy' ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/10' : 'text-dark-400 hover:bg-dark-900/60 hover:text-white'
                }`}
              >
                <Clipboard size={16} /> Định Mức Công Tác Phí
              </button>
            )}
          </div>
        </aside>

        {/* Content Pane */}
        <main className="flex-1 min-w-0">
          <div className="animate-fade-in">
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* PROJECT PORTFOLIO OVERVIEW HEADER */}
                <div className="flex justify-between items-center pb-1">
                  <div>
                    <h2 className="text-lg font-extrabold text-white uppercase tracking-wider">Project Portfolio Overview</h2>
                    <p className="text-xs text-dark-400">Hệ thống quản lý tích hợp RICEFW, Tiến độ Gantt & Tài chính dự án Oracle ERP</p>
                  </div>
                  <div className="bg-dark-900 border border-dark-800 px-4 py-2 rounded-xl text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-semibold text-white">Oracle Ecosystem Connected</span>
                  </div>
                </div>

                {/* 4 ORACLE REDWOOD INFOLETS */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* Infolet 1: Project Health */}
                  <div className="bg-dark-900 p-5 rounded-2xl border border-dark-850 shadow-md space-y-3">
                    <p className="text-dark-400 font-semibold text-[11px] uppercase tracking-wider">Project Health</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-white">85%</span>
                      <span className="text-emerald-500 font-bold text-sm flex items-center">↑</span>
                    </div>
                    <div className="w-full bg-dark-950 h-1.5 rounded-full overflow-hidden border border-dark-800">
                      <div className="bg-emerald-600 h-full rounded-full" style={{ width: '85%' }}></div>
                    </div>
                    <p className="text-[10px] text-dark-500">of projects on track</p>
                  </div>

                  {/* Infolet 2: Active Projects */}
                  <div className="bg-dark-900 p-5 rounded-2xl border border-dark-850 shadow-md space-y-3">
                    <p className="text-dark-400 font-semibold text-[11px] uppercase tracking-wider">Active Projects</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-white">12</span>
                    </div>
                    <div className="w-full bg-dark-950 h-1.5 rounded-full overflow-hidden border border-dark-800">
                      <div className="bg-brand-500 h-full rounded-full" style={{ width: '100%' }}></div>
                    </div>
                    <p className="text-[10px] text-dark-500">total active projects</p>
                  </div>

                  {/* Infolet 3: Tasks At-Risk */}
                  <div className="bg-dark-900 p-5 rounded-2xl border border-dark-850 shadow-md space-y-3">
                    <p className="text-dark-400 font-semibold text-[11px] uppercase tracking-wider">Task At-Risk</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-brand-500">15</span>
                    </div>
                    <div className="w-full bg-dark-950 h-1.5 rounded-full overflow-hidden border border-dark-800">
                      <div className="bg-brand-500 h-full rounded-full" style={{ width: '45%' }}></div>
                    </div>
                    <p className="text-[10px] text-dark-500">tasks overdue or high risk</p>
                  </div>

                  {/* Infolet 4: Budget Burn */}
                  <div className="bg-dark-900 p-5 rounded-2xl border border-dark-850 shadow-md space-y-3">
                    <p className="text-dark-400 font-semibold text-[11px] uppercase tracking-wider">Budget Burn</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-extrabold text-amber-500">72%</span>
                    </div>
                    <div className="w-full bg-dark-950 h-1.5 rounded-full overflow-hidden border border-dark-800">
                      <div className="bg-amber-500 h-full rounded-full" style={{ width: '72%' }}></div>
                    </div>
                    <p className="text-[10px] text-dark-500">average project budget utilized</p>
                  </div>
                </div>

                {/* DASHBOARD GRID: 3 COLUMNS */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Column 1: My Task List */}
                  <div className="bg-dark-900 p-5 rounded-2xl border border-dark-850 shadow-md flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-brand-500" />
                        My Task List
                      </h3>
                      
                      <div className="divide-y divide-dark-850">
                        {[
                          { name: 'Design User Login Module', project: 'Oracle HCM Implementation', date: 'Nov 12', completed: true },
                          { name: 'Setup General Ledger Structure', project: 'Oracle ERP Upgrade', date: 'Nov 15', completed: false },
                          { name: 'Configure Accounts Payable Flow', project: 'Oracle ERP Upgrade', date: 'Nov 18', completed: false },
                          { name: 'Data Migration & Verification', project: 'Cloud Migration Project', date: 'Nov 20', completed: false }
                        ].map((task, idx) => (
                          <div key={idx} className="py-3 flex items-start gap-2.5">
                            <input 
                              type="checkbox" 
                              checked={task.completed} 
                              readOnly 
                              className="mt-0.5 w-4 h-4 rounded border-dark-800 text-brand-500 bg-dark-950 focus:ring-brand-500/20"
                            />
                            <div className="flex-1 space-y-1">
                              <p className={`text-xs font-semibold leading-tight ${task.completed ? 'text-dark-500 line-through' : 'text-white'}`}>{task.name}</p>
                              <span className="inline-block text-[9px] font-bold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/5">
                                {task.project}
                              </span>
                            </div>
                            <div className="text-[10px] text-dark-400 font-mono text-right flex flex-col items-end gap-1">
                              <span>{task.date}</span>
                              <div className="flex gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-emerald-500' : 'bg-brand-500'}`} />
                                <span className="w-1.5 h-1.5 rounded-full bg-dark-700" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Project Progress (Stacked Bars & Details) */}
                  <div className="bg-dark-900 p-5 rounded-2xl border border-dark-850 shadow-md flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-amber-500" />
                          Project Progress
                        </h3>
                        {/* Legend */}
                        <div className="flex gap-2 text-[9px] text-dark-400 font-semibold">
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-dark-600" /> In Progress</span>
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Completed</span>
                          <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-brand-500" /> At Risk</span>
                        </div>
                      </div>

                      {/* Visual Stacked Bars */}
                      <div className="h-32 flex items-end justify-around gap-4 pb-2 border-b border-dark-850 relative">
                        {/* Y-axis labels */}
                        <div className="absolute left-0 bottom-2 text-[8px] text-dark-500 font-mono space-y-4 text-right pr-2">
                          <div>1000</div>
                          <div>755</div>
                          <div>500</div>
                          <div>255</div>
                          <div>0</div>
                        </div>

                        {[
                          { name: 'In Progress', h1: '30%', h2: '50%', h3: '20%' },
                          { name: 'Completed', h1: '20%', h2: '60%', h3: '20%' },
                          { name: 'At Risk', h1: '15%', h2: '35%', h3: '50%' },
                          { name: 'At Risk', h1: '40%', h2: '10%', h3: '50%' }
                        ].map((col, idx) => (
                          <div key={idx} className="flex flex-col items-center gap-1.5 w-10 z-10">
                            <div className="w-full bg-dark-950 rounded overflow-hidden flex flex-col h-24">
                              <div className="bg-brand-500 w-full" style={{ height: col.h3 }} />
                              <div className="bg-amber-500 w-full" style={{ height: col.h2 }} />
                              <div className="bg-dark-600 w-full flex-1" style={{ height: col.h1 }} />
                            </div>
                            <span className="text-[8px] text-dark-400 font-semibold">{col.name}</span>
                          </div>
                        ))}
                      </div>

                      {/* Project status table */}
                      <div className="space-y-2 pt-1">
                        <div className="flex justify-between items-center text-xs">
                          <div>
                            <p className="font-semibold text-white">Oracle ERP Upgrade</p>
                            <p className="text-[9px] text-dark-500">Project: ERP Upgrade</p>
                          </div>
                          <span className="font-mono font-bold text-white">90</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <div>
                            <p className="font-semibold text-white">Cloud Migration Project</p>
                            <p className="text-[9px] text-dark-500">Project: ERP Upgrade</p>
                          </div>
                          <span className="font-mono font-bold text-white">99</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Resource Utilization (Donut & Availability) */}
                  <div className="bg-dark-900 p-5 rounded-2xl border border-dark-850 shadow-md flex flex-col justify-between space-y-4">
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-emerald-500" />
                        Resource Utilization
                      </h3>

                      {/* Donut Chart SVG */}
                      <div className="flex flex-col items-center py-2 relative">
                        <svg className="w-24 h-24 transform -rotate-90">
                          <circle cx="48" cy="48" r="38" strokeWidth="8" stroke="var(--color-dark-950)" fill="transparent" />
                          <circle cx="48" cy="48" r="38" strokeWidth="8" stroke="var(--color-brand-500)" fill="transparent" strokeDasharray="238" strokeDashoffset="52" strokeLinecap="round" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
                          <span className="text-lg font-extrabold text-white">78%</span>
                          <span className="text-[8px] text-dark-400 font-semibold uppercase tracking-wide">Allocated</span>
                        </div>
                        <p className="text-[10px] text-dark-300 font-semibold mt-2">Resource Allocation</p>
                      </div>

                      {/* Availability by Role */}
                      <div className="space-y-2 pt-1">
                        <p className="text-[10px] text-dark-400 font-bold uppercase tracking-wider">Availability by Role</p>
                        
                        <div className="space-y-1.5">
                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[9px] font-semibold text-dark-300">
                              <span>Developers</span>
                              <span>65%</span>
                            </div>
                            <div className="w-full bg-dark-950 h-1.5 rounded-full overflow-hidden border border-dark-850">
                              <div className="bg-brand-500 h-full rounded-full" style={{ width: '65%' }} />
                            </div>
                          </div>

                          <div className="space-y-0.5">
                            <div className="flex justify-between text-[9px] font-semibold text-dark-300">
                              <span>Analysts</span>
                              <span>85%</span>
                            </div>
                            <div className="w-full bg-dark-950 h-1.5 rounded-full overflow-hidden border border-dark-850">
                              <div className="bg-amber-500 h-full rounded-full" style={{ width: '85%' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* MY PROJECT ROLES & QUICK ACCESS LIST */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-xs font-bold text-dark-400 uppercase tracking-wider">
                    Danh sách dự án của bạn (Truy cập nhanh)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {currentUser.projectRoles.map((pr) => (
                      <div key={pr.projectId} className="bg-dark-900 p-5 rounded-2xl border border-dark-850 flex flex-col justify-between space-y-4 hover:border-brand-500/20 transition-all shadow-sm">
                        <div className="space-y-2">
                          <span className="text-[9px] font-bold font-mono text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/10">
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
                          className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
                        >
                          Truy Cập Dự Án <ArrowRight size={12} />
                        </button>
                      </div>
                    ))}

                    {currentUser.projectRoles.length === 0 && (
                      <div className="col-span-3 text-center py-12 bg-dark-900/10 border border-dashed border-dark-850 rounded-2xl text-dark-500 text-xs">
                        Bạn chưa được gán vào dự án nào. Vui lòng chuyển qua tab "Khởi Tạo & Quản Lý Dự Án" để tạo mới (nếu là Admin) hoặc liên hệ Admin để được phân quyền.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'projects' && (
              <ProjectManager 
                currentUser={currentUser} 
                onProjectCreated={() => {
                  loadSystemSettings();
                  window.location.reload();
                }} 
              />
            )}
            
            {activeTab === 'settings' && <SettingsPanel onSettingsUpdate={(s) => setSystemSettings(s)} />}

            {activeTab === 'users' && <UserManager currentUserGlobalRole={currentUser?.globalRole} />}

            {activeTab === 'masterdata' && <MasterDataManager currentUserGlobalRole={currentUser?.globalRole} />}

            {activeTab === 'leaves' && <LeaveManagement />}

            {activeTab === 'travelpolicy' && <TravelPolicyConfig />}

            {activeTab !== 'dashboard' && activeTab !== 'projects' && activeTab !== 'settings' && activeTab !== 'users' && activeTab !== 'masterdata' && activeTab !== 'leaves' && activeTab !== 'travelpolicy' && (
              activeProject ? (
                <>
                  {activeTab === 'gantt' && <GanttChart projectId={activeProject.projectId} userRole={activeProject.roleCode} />}
                  
                  {activeTab === 'ricefw' && <RicefwTracker projectId={activeProject.projectId} userRole={activeProject.roleCode} />}
                  
                  {activeTab === 'team' && <TeamConfigurator projectId={activeProject.projectId} userRole={activeProject.roleCode} />}

                  {activeTab === 'trips' && <BusinessTripTracker projectId={activeProject.projectId} userRole={activeProject.roleCode} />}

                  {activeTab === 'documents' && <ProjectDocuments projectId={activeProject.projectId} userRole={activeProject.roleCode} />}

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
      {showProfileModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-dark-900 border border-dark-800 p-6 rounded-2xl shadow-2xl space-y-6 animate-slide-up text-left">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Sliders className="text-brand-500" /> Cấu Hình Tài Khoản & Giao Diện
              </h3>
              <button 
                onClick={() => setShowProfileModal(false)}
                className="text-xs text-dark-400 hover:text-white"
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Account Details & Security */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wider">Thông Tin Cá Nhân & Bảo Mật</h4>
                
                {profileError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl">
                    {profileError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Tên đăng nhập (Username):</label>
                  <input 
                    type="text" 
                    value={currentUser?.username || ''} 
                    disabled 
                    className="w-full bg-dark-950/50 border border-dark-850 text-xs p-3 rounded-xl text-dark-400 cursor-not-allowed focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Họ và Tên:</label>
                  <input 
                    type="text" 
                    value={profileFullName} 
                    disabled 
                    className="w-full bg-dark-950/50 border border-dark-850 text-xs p-3 rounded-xl text-dark-400 cursor-not-allowed focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Email:</label>
                  <input 
                    type="email" 
                    value={profileEmail} 
                    disabled 
                    className="w-full bg-dark-950/50 border border-dark-850 text-xs p-3 rounded-xl text-dark-400 cursor-not-allowed focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Số điện thoại:</label>
                  <input 
                    type="text" 
                    value={profilePhone} 
                    onChange={e => setProfilePhone(e.target.value)} 
                    placeholder="Nhập số điện thoại..."
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold flex items-center justify-between">
                    <span>Ảnh Đại Diện (URL ảnh):</span>
                    {profileAvatarPath && (
                      <img src={profileAvatarPath} alt="Avatar Preview" className="w-7 h-7 rounded-full border border-dark-850 object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    )}
                  </label>
                  <input 
                    type="text" 
                    value={profileAvatarPath} 
                    onChange={e => setProfileAvatarPath(e.target.value)} 
                    placeholder="Nhập link ảnh (URL)..."
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Tồn ngày phép năm:</label>
                    <input 
                      type="number" 
                      min="0"
                      max="30"
                      value={profileAnnualLeaveDays} 
                      onChange={e => setProfileAnnualLeaveDays(Number(e.target.value) || 0)} 
                      className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Phép năm ngoái (Carry-over):</label>
                    <input 
                      type="number" 
                      min="0"
                      max="5"
                      value={profileCarryOverDays} 
                      onChange={e => setProfileCarryOverDays(Number(e.target.value) || 0)} 
                      className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="border-t border-dark-850 pt-4 space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Mật khẩu mới (Để trống nếu không đổi):</label>
                    <input 
                      type="password" 
                      value={profilePassword} 
                      onChange={e => setProfilePassword(e.target.value)} 
                      placeholder="Tối thiểu 8 ký tự..."
                      className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-dark-300 font-semibold">Xác nhận mật khẩu mới:</label>
                    <input 
                      type="password" 
                      value={profileConfirmPassword} 
                      onChange={e => setProfileConfirmPassword(e.target.value)} 
                      placeholder="Xác nhận mật khẩu..."
                      className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Themes & Customizations */}
              <div className="space-y-5 flex flex-col justify-between">
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wider">Cấu Hình Giao Diện Hệ Thống</h4>
                  
                  {/* Themes Select */}
                  <div className="space-y-2">
                    <label className="text-xs text-dark-300 font-semibold block">Lựa chọn Theme:</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'default', name: 'Default Blue', colors: ['#0d7fe7', '#0d0f12'] },
                        { id: 'aron', name: 'ARON Classic', colors: ['#f97316', '#0a0d14'] },
                        { id: 'fusion', name: 'Fusion Crimson', colors: ['#dc2626', '#140d0c'] },
                        { id: 'emerald', name: 'Emerald Oracle', colors: ['#10b981', '#05100b'] }
                      ].map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setActiveTheme(t.id)}
                          className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                            activeTheme === t.id 
                              ? 'bg-brand-500/10 border-brand-500' 
                              : 'bg-dark-950 border-dark-850 hover:border-dark-700'
                          }`}
                        >
                          <div className="flex gap-1 shrink-0">
                            <span className="w-3.5 h-3.5 rounded-full border border-dark-800" style={{ backgroundColor: t.colors[0] }} />
                            <span className="w-3.5 h-3.5 rounded-full border border-dark-800" style={{ backgroundColor: t.colors[1] }} />
                          </div>
                          <span className="text-xs font-semibold text-white">{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mode Select */}
                  <div className="space-y-2">
                    <label className="text-xs text-dark-300 font-semibold block">Chế độ hiển thị (Mode):</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'dark', name: 'Chế độ Tối (Dark)' },
                        { id: 'light', name: 'Chế độ Sáng (Light)' }
                      ].map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setActiveMode(m.id)}
                          className={`p-3 rounded-xl border text-center font-semibold text-xs transition-all ${
                            activeMode === m.id 
                              ? 'bg-brand-500/10 border-brand-500' 
                              : 'bg-dark-950 border-dark-850 hover:border-dark-700'
                          }`}
                        >
                          <span className="text-white">{m.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={profileSaving}
                  className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all disabled:opacity-50 mt-6"
                >
                  {profileSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default App;
