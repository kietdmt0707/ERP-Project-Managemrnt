import React, { useState, useEffect } from 'react';
import { teamService, userService, TeamMemberDto, UserDto } from '../services/api';
import { Users, Plus, UserPlus, Briefcase, Trash2, Edit3, UserCheck, Edit } from 'lucide-react';

interface TeamConfiguratorProps {
  projectId: number;
  userRole: string;
}

export const TeamConfigurator: React.FC<TeamConfiguratorProps> = ({ projectId, userRole }) => {
  const [data, setData] = useState<{
    teams: any[];
    members: TeamMemberDto[];
    roles: any[];
    functionalTeams: any[];
  }>({
    teams: [],
    members: [],
    roles: [],
    functionalTeams: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals / forms
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [isEditingMember, setIsEditingMember] = useState(false);

  // System Users List for dropdown selection
  const [allSystemUsers, setAllSystemUsers] = useState<UserDto[]>([]);
  const [assignMode, setAssignMode] = useState<'SYSTEM' | 'MANUAL'>('SYSTEM');
  const [selectedUserId, setSelectedUserId] = useState<number | undefined>(undefined);

  // Member form
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [title, setTitle] = useState('');
  const [roleId, setRoleId] = useState<number>(0);
  const [functionalTeamId, setFunctionalTeamId] = useState<number | undefined>(undefined);
  const [dailyRate, setDailyRate] = useState<number>(150);
  const [submitting, setSubmitting] = useState(false);

  // Team form
  const [newTeamName, setNewTeamName] = useState('');
  const [isFunctional, setIsFunctional] = useState(false);
  const [parentTeamId, setParentTeamId] = useState<number | undefined>(undefined);

  useEffect(() => {
    loadTeamData();
  }, [projectId]);

  const loadTeamData = async () => {
    try {
      setLoading(true);
      const res = await teamService.getTeams(projectId);
      setData(res);
      if (res.roles.length > 0 && roleId === 0) {
        setRoleId(res.roles[res.roles.length - 1].roleId);
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải cơ cấu đội dự án.');
    } finally {
      setLoading(false);
    }
  };

  const loadSystemUsers = async () => {
    try {
      const users = await userService.getUsers();
      setAllSystemUsers(users.filter(u => u.isActive));
    } catch (err) {
      console.warn('Không thể tải danh sách tài khoản người dùng hệ thống.');
    }
  };

  const handleOpenAddMember = async () => {
    setIsEditingMember(false);
    setAssignMode('SYSTEM');
    setSelectedUserId(undefined);
    setUsername('');
    setFullName('');
    setEmail('');
    setPhone('');
    setTitle('');
    setFunctionalTeamId(undefined);
    setDailyRate(150);
    if (data.roles.length > 0) {
      setRoleId(data.roles[data.roles.length - 1].roleId);
    }
    setShowMemberModal(true);
    await loadSystemUsers();
  };

  const handleSelectSystemUser = (userIdNum: number) => {
    setSelectedUserId(userIdNum);
    const targetUser = allSystemUsers.find(u => u.userId === userIdNum);
    if (targetUser) {
      setUsername(targetUser.username);
      setFullName(targetUser.fullName);
      setEmail(targetUser.email);
      setPhone(targetUser.phone || '');
    }
  };

  const handleOpenEditMember = (m: TeamMemberDto) => {
    setIsEditingMember(true);
    setAssignMode('MANUAL');
    setUsername(m.username);
    setFullName(m.fullName);
    setEmail(m.email);
    setPhone(m.phone || '');
    setTitle(m.title || '');
    setRoleId(m.roleId);
    setFunctionalTeamId(m.functionalTeamId || undefined);
    setDailyRate(m.dailyRate || 150);
    setShowMemberModal(true);
  };

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !fullName.trim()) {
      alert('Vui lòng chọn hoặc nhập Tên tài khoản và Họ tên!');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await teamService.assignMember({
        projectId,
        username: username.trim(),
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        title: title.trim(),
        roleId,
        functionalTeamId,
        dailyRate: (userRole === 'PM' || userRole === 'DIRECTOR' || userRole === 'SYSTEM_ADMIN') ? dailyRate : undefined
      });
      setShowMemberModal(false);
      loadTeamData();
    } catch (err: any) {
      setError(err.message || 'Gán/Cập nhật thành viên thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMember = async (projectMemberId: number, name: string) => {
    if (!window.confirm(`Xác nhận xóa thành viên "${name}" khỏi dự án?`)) return;
    try {
      await teamService.deleteMember(projectMemberId);
      loadTeamData();
    } catch (err: any) {
      alert(err.message || 'Xóa thành viên thất bại.');
    }
  };

  const handleDeleteFunctionalTeam = async (ftId: number, name: string) => {
    if (!window.confirm(`Xác nhận xóa đội chức năng "Team ${name}"?`)) return;
    try {
      await teamService.deleteFunctionalTeam(ftId);
      loadTeamData();
    } catch (err: any) {
      alert(err.message || 'Xóa đội chức năng thất bại.');
    }
  };

  const handleTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName) return;
    try {
      if (isFunctional) {
        if (!parentTeamId) {
          alert('Vui lòng chọn đội dự án trực thuộc (ARON, Khách hàng hoặc Partner).');
          return;
        }
        await teamService.createFunctionalTeam({
          teamId: parentTeamId,
          functionalTeamName: newTeamName
        });
      } else {
        await teamService.createTeam({
          projectId,
          teamName: newTeamName,
          parentTeamId: undefined
        });
      }
      setNewTeamName('');
      setIsFunctional(false);
      setShowTeamModal(false);
      loadTeamData();
    } catch (err: any) {
      alert(err.message || 'Tạo nhóm thất bại.');
    }
  };

  const isCostVisible = userRole === 'PM' || userRole === 'DIRECTOR' || userRole === 'SYSTEM_ADMIN';
  const canManageTeam = userRole === 'PM' || userRole === 'DIRECTOR' || userRole === 'PC' || userRole === 'SYSTEM_ADMIN';
  const canDeleteTeam = userRole === 'PM' || userRole === 'DIRECTOR' || userRole === 'SYSTEM_ADMIN' || userRole === 'PC';

  return (
    <div className="space-y-6">
      <div className="bg-dark-900/40 p-4 rounded-xl border border-dark-800 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="text-brand-500" /> Quản Lý Đội Dự Án & Cơ Cấu Phân Quyền
          </h2>
          <p className="text-xs text-dark-400 mt-1">
            Khai báo đội ARON, Khách hàng, Partner, đội chức năng (FIN, Tech...) và gán vai trò nhân sự (Dành cho PM & PC)
          </p>
        </div>
        {canManageTeam && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowTeamModal(true)}
              className="bg-dark-800 hover:bg-dark-700 border border-dark-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all"
            >
              <Plus size={14} /> Khai Báo Đội/Team
            </button>
            <button
              onClick={handleOpenAddMember}
              className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-brand-600/10"
            >
              <UserPlus size={14} /> Đăng Ký Nhân Sự
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-xs text-dark-400">Đang tải cấu trúc đội...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Org Tree Column */}
          <div className="glass-panel p-5 rounded-2xl border border-dark-800 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-dark-850 pb-2">
              Sơ Đồ Đội Ngũ Triển Khai
            </h3>
            <div className="space-y-4 text-xs">
              {data.teams.map((t) => (
                <div key={t.teamId} className="space-y-2">
                  <div className="flex items-center gap-2 font-bold text-dark-200">
                    <Briefcase size={14} className="text-brand-400" />
                    <span>{t.teamName}</span>
                  </div>
                  <div className="pl-4 space-y-1.5 border-l border-dark-800">
                    {t.functionalTeams.map((ft: any) => (
                      <div key={ft.functionalTeamId} className="flex items-center justify-between text-dark-400 hover:text-white transition-colors py-0.5 group">
                        <span>⚙️ Team {ft.functionalTeamName}</span>
                        {canDeleteTeam && (
                          <button
                            onClick={() => handleDeleteFunctionalTeam(ft.functionalTeamId, ft.functionalTeamName)}
                            className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300 transition-opacity p-0.5"
                            title="Xóa Đội Chức Năng"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                    {t.functionalTeams.length === 0 && (
                      <span className="text-[10px] text-dark-600 italic">Chưa khai báo team chức năng</span>
                    )}
                  </div>
                </div>
              ))}
              {data.teams.length === 0 && (
                <div className="text-center text-dark-600 py-4 italic">Chưa khai báo đội dự án</div>
              )}
            </div>
          </div>

          {/* Members List Table Column */}
          <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border border-dark-800 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider border-b border-dark-850 pb-2">
              Danh Sách Nhân Sự & Vai Trò
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-dark-500 font-bold border-b border-dark-850 pb-2">
                    <th className="pb-3">Thành viên</th>
                    <th className="pb-3">Tài khoản</th>
                    <th className="pb-3">Đội chức năng</th>
                    <th className="pb-3">Vai trò dự án</th>
                    {isCostVisible && <th className="pb-3 text-right">Daily Rate</th>}
                    {canManageTeam && <th className="pb-3 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-900">
                  {data.members.map((m) => (
                    <tr key={m.projectMemberId} className="hover:bg-dark-900/30">
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-2">
                          <img 
                            src={m.avatarPath || "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(m.fullName || m.username)} 
                            alt="Avatar" 
                            className="h-7 w-7 rounded-full border border-dark-800 bg-dark-950 shrink-0" 
                          />
                          <div>
                            <p className="font-semibold text-white">{m.fullName}</p>
                            <p className="text-[10px] text-dark-500">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 text-dark-300 font-mono">{m.username}</td>
                      <td className="py-3 text-dark-400">
                        <span className="bg-dark-900 border border-dark-800 px-2 py-0.5 rounded text-[10px]">
                          {m.functionalTeamName}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.roleCode === 'SYSTEM_ADMIN' ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400' :
                          m.roleCode === 'DIRECTOR' ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' :
                          m.roleCode === 'PM' ? 'bg-brand-500/10 border border-brand-500/20 text-brand-400' :
                          m.roleCode === 'LEADER' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' :
                          'bg-dark-800 border border-dark-700 text-dark-300'
                        }`}>
                          {m.roleName}
                        </span>
                      </td>
                      {isCostVisible && (
                        <td className="py-3 text-right font-mono text-emerald-400 font-semibold">
                          ${m.dailyRate?.toFixed(2)}/day
                        </td>
                      )}
                      {canManageTeam && (
                        <td className="py-3 text-right space-x-2">
                          <button
                            onClick={() => handleOpenEditMember(m)}
                            className="text-brand-400 hover:text-brand-300 font-medium text-[11px]"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit3 size={13} className="inline" /> Sửa
                          </button>
                          {canDeleteTeam && (
                            <button
                              onClick={() => handleDeleteMember(m.projectMemberId, m.fullName || m.username)}
                              className="text-rose-400 hover:text-rose-300 font-medium text-[11px]"
                              title="Xóa khỏi đội dự án"
                            >
                              <Trash2 size={13} className="inline" /> Xóa
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel p-6 rounded-2xl border border-dark-800 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <UserPlus className="text-brand-500" /> {isEditingMember ? 'Cập Nhật Nhân Sự Dự Án' : 'Đăng Ký Thành Viên Dự Án'}
              </h3>
              <button onClick={() => setShowMemberModal(false)} className="text-xs text-dark-400 hover:text-white">Đóng</button>
            </div>

            {/* Option to choose existing account vs manual entry (Only shown when adding new member) */}
            {!isEditingMember && (
              <div className="flex gap-2 p-1 bg-dark-900 border border-dark-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setAssignMode('SYSTEM')}
                  className={`flex-1 text-xs py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    assignMode === 'SYSTEM'
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'text-dark-400 hover:text-white'
                  }`}
                >
                  <UserCheck size={14} /> Chọn Từ Tài Khoản Hệ Thống
                </button>
                <button
                  type="button"
                  onClick={() => { setAssignMode('MANUAL'); setUsername(''); setFullName(''); setEmail(''); setPhone(''); }}
                  className={`flex-1 text-xs py-2 px-3 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    assignMode === 'MANUAL'
                      ? 'bg-brand-600 text-white shadow-md'
                      : 'text-dark-400 hover:text-white'
                  }`}
                >
                  <Edit size={14} /> Nhập Thủ Công Mới
                </button>
              </div>
            )}

            <form onSubmit={handleMemberSubmit} className="space-y-4">
              
              {/* SYSTEM ACCOUNT DROPDOWN MODE */}
              {!isEditingMember && assignMode === 'SYSTEM' && (
                <div className="space-y-1 bg-dark-950 p-3.5 rounded-xl border border-dark-800">
                  <label className="text-xs text-dark-200 font-semibold flex justify-between">
                    <span>Chọn Tài Khoản Người Dùng (Users Hub):</span>
                    <span className="text-[10px] text-brand-400">Tìm thấy: {allSystemUsers.length} tài khoản</span>
                  </label>
                  <select
                    value={selectedUserId || ''}
                    onChange={(e) => handleSelectSystemUser(Number(e.target.value))}
                    className="w-full bg-dark-900 border border-dark-750 text-xs p-2.5 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="">-- Chọn tài khoản người dùng đã khai báo --</option>
                    {allSystemUsers.map(u => (
                      <option key={u.userId} value={u.userId}>
                        {u.fullName} (@{u.username}) - {u.email}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* USERNAME & FULL NAME FIELDS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Tài khoản đăng nhập (Username):</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="VD: kiettm"
                    disabled={isEditingMember || (!isEditingMember && assignMode === 'SYSTEM')}
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-2.5 rounded-xl text-white disabled:opacity-60 font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Họ và tên (*):</label>
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="VD: Dương Minh Tuấn Kiệt"
                    disabled={!isEditingMember && assignMode === 'SYSTEM' && !!selectedUserId}
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-2.5 rounded-xl text-white disabled:opacity-75"
                    required
                  />
                </div>
              </div>

              {/* EMAIL & PHONE FIELDS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Email làm việc (*):</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="VD: kietdmt@aron.com.vn"
                    disabled={!isEditingMember && assignMode === 'SYSTEM' && !!selectedUserId}
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-2.5 rounded-xl text-white disabled:opacity-75"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Số điện thoại / Zalo:</label>
                  <input 
                    type="text" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="VD: 0901234567"
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-2.5 rounded-xl text-white"
                  />
                </div>
              </div>

              {/* FUNCTIONAL TEAM & ROLE FIELDS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Đội chức năng (Functional Team):</label>
                  <select
                    value={functionalTeamId || ''}
                    onChange={(e) => setFunctionalTeamId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-2.5 rounded-xl text-white"
                  >
                    <option value="">-- Chưa xếp team --</option>
                    {data.functionalTeams.map((ft: any) => (
                      <option key={ft.functionalTeamId} value={ft.functionalTeamId}>
                        Team {ft.functionalTeamName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Vai trò phân quyền (*):</label>
                  <select
                    value={roleId}
                    onChange={(e) => setRoleId(Number(e.target.value))}
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-2.5 rounded-xl text-white"
                  >
                    {data.roles.map((r: any) => (
                      <option key={r.roleId} value={r.roleId}>
                        {r.roleName} ({r.roleCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isCostVisible && (
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Chi phí Daily Rate ($/ngày):</label>
                  <input 
                    type="number" 
                    step="10"
                    value={dailyRate}
                    onChange={(e) => setDailyRate(Number(e.target.value))}
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-2.5 rounded-xl text-white font-mono"
                  />
                </div>
              )}

              <div className="flex gap-2 justify-end pt-4 border-t border-dark-850">
                <button
                  type="button"
                  onClick={() => setShowMemberModal(false)}
                  className="bg-dark-800 hover:bg-dark-700 text-white text-xs py-2 px-4 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold py-2 px-4 rounded-xl disabled:opacity-50"
                >
                  {submitting ? 'Đang lưu...' : (isEditingMember ? 'Cập Nhật Thành Viên' : 'Đăng Ký Thành Viên')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-dark-800 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Briefcase className="text-brand-500" /> Khai Báo Đội / Team Dự Án
              </h3>
              <button onClick={() => setShowTeamModal(false)} className="text-xs text-dark-400 hover:text-white">Đóng</button>
            </div>

            <form onSubmit={handleTeamSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-dark-200 font-semibold cursor-pointer">
                  <input 
                    type="checkbox"
                    checked={isFunctional}
                    onChange={(e) => setIsFunctional(e.target.checked)}
                    className="accent-brand-500 h-4 w-4 rounded"
                  />
                  <span>Đây là Đội Chức Năng (ví dụ: Team FIN, Team Tech, Team DBA...)</span>
                </label>
              </div>

              {isFunctional ? (
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Trực thuộc Khối / Đội dự án (*):</label>
                  <select
                    value={parentTeamId || ''}
                    onChange={(e) => setParentTeamId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-2.5 rounded-xl text-white"
                    required
                  >
                    <option value="">-- Chọn Khối Dự Án --</option>
                    {data.teams.map((t: any) => (
                      <option key={t.teamId} value={t.teamId}>
                        {t.teamName}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Tên Đội / Team mới (*):</label>
                <input 
                  type="text" 
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder={isFunctional ? "VD: Team PO-INV, Team FIN..." : "VD: Đơn Vị Khách Hàng, ARON Partner..."}
                  className="w-full bg-dark-900 border border-dark-800 text-xs p-2.5 rounded-xl text-white"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-dark-850">
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  className="bg-dark-800 hover:bg-dark-700 text-white text-xs py-2 px-4 rounded-xl"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold py-2 px-4 rounded-xl"
                >
                  Lưu Khai Báo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
