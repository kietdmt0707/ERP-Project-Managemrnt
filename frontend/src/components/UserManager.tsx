import React, { useState, useEffect } from 'react';
import { userService, masterDataService, projectService, teamService, UserDto, SystemRoleDto } from '../services/api';
import { Users, Edit2, Trash2, Shield, UserPlus } from 'lucide-react';

interface UserManagerProps {
  currentUserGlobalRole?: string;
}

export const UserManager: React.FC<UserManagerProps> = ({ currentUserGlobalRole }) => {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // System Master lists
  const [globalRoles, setGlobalRoles] = useState<SystemRoleDto[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);
  const [editTab, setEditTab] = useState<'basic' | 'projects'>('basic');

  // Basic info form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [expiryDate, setExpiryDate] = useState('');
  const [globalRoleId, setGlobalRoleId] = useState<number | undefined>(undefined);

  // Project memberships form states for the selected user
  const [memberships, setMemberships] = useState<any[]>([]); // Array of { projectId, roleId, functionalTeamId, dailyRate, isActive }
  const [projFtMap, setProjFtMap] = useState<Record<number, any[]>>({}); // Maps projectId -> functionalTeams

  const isAdmin = currentUserGlobalRole === 'SYSTEM_ADMIN';

  useEffect(() => {
    loadUsers();
    loadMasters();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getUsers();
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải danh sách người dùng.');
    } finally {
      setLoading(false);
    }
  };

  const loadMasters = async () => {
    try {
      const rolesData = await masterDataService.getRoles();
      setGlobalRoles(rolesData.filter(r => r.isActive));

      const projRes = await projectService.getProjects();
      setAllProjects(projRes.projects || []);
    } catch (err: any) {
      console.error('Lỗi khi tải danh mục Master roles/projects', err);
    }
  };

  const loadProjectFunctionalTeams = async (projectId: number) => {
    if (projFtMap[projectId]) return; // already loaded
    try {
      const res = await teamService.getTeams(projectId);
      setProjFtMap(prev => ({
        ...prev,
        [projectId]: res.functionalTeams || []
      }));
    } catch (err) {
      console.error(`Không thể tải functional teams cho project ${projectId}`, err);
    }
  };

  const handleOpenCreate = () => {
    setEditingUser(null);
    setEditTab('basic');
    setUsername('');
    setPassword('');
    setFullName('');
    setEmail('');
    setPhone('');
    setIsActive(true);
    setExpiryDate('');
    setGlobalRoleId(globalRoles.find(r => r.roleCode === 'MEMBER')?.roleId || undefined);
    setMemberships([]);
    setShowModal(true);
  };

  const handleOpenEdit = async (user: UserDto) => {
    setEditingUser(user);
    setEditTab('basic');
    setUsername(user.username);
    setPassword(''); // keep blank if not changing
    setFullName(user.fullName);
    setEmail(user.email);
    setPhone(user.phone || '');
    setIsActive(user.isActive);
    setExpiryDate(user.expiryDate ? user.expiryDate.split('T')[0] : '');
    setGlobalRoleId(user.globalRoleId || undefined);

    // Fetch user project memberships
    try {
      const userProjs = await userService.getUserProjects(user.userId!);
      setMemberships(userProjs);

      // Pre-fetch functional teams for assigned projects
      for (const mem of userProjs) {
        await loadProjectFunctionalTeams(mem.projectId);
      }
    } catch (err) {
      console.error('Lỗi khi tải thông tin dự án của người dùng', err);
      setMemberships([]);
    }

    setShowModal(true);
  };

  const handleToggleProjectParticipation = async (projectId: number) => {
    const isParticipating = memberships.some(m => m.projectId === projectId);
    if (isParticipating) {
      // Remove from memberships list
      setMemberships(prev => prev.filter(m => m.projectId !== projectId));
    } else {
      // Fetch functional teams first
      await loadProjectFunctionalTeams(projectId);
      
      // Add a new default membership entry
      const defaultRole = globalRoles.find(r => r.roleCode === 'MEMBER')?.roleId || 0;
      setMemberships(prev => [
        ...prev,
        {
          projectId,
          roleId: defaultRole,
          functionalTeamId: null,
          dailyRate: 150,
          isActive: true
        }
      ]);
    }
  };

  const handleMembershipChange = (projectId: number, field: string, value: any) => {
    setMemberships(prev =>
      prev.map(m => (m.projectId === projectId ? { ...m, [field]: value } : m))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      let savedUser: UserDto;
      if (editingUser && editingUser.userId) {
        savedUser = await userService.updateUser(editingUser.userId, {
          username,
          password: password || undefined,
          fullName,
          email,
          phone,
          isActive,
          globalRoleId,
          expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined
        });

        // Save project memberships
        await userService.updateUserProjects(editingUser.userId, memberships);
        alert('Cập nhật người dùng và phân quyền dự án thành công!');
      } else {
        savedUser = await userService.createUser({
          username,
          password,
          fullName,
          email,
          phone,
          isActive,
          globalRoleId,
          expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined
        });
        alert('Tạo người dùng mới thành công!');
      }
      setShowModal(false);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Lưu người dùng thất bại.');
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('Bạn có chắc chắn muốn xóa người dùng này khỏi hệ thống?')) return;
    try {
      await userService.deleteUser(userId);
      alert('Đã xóa người dùng thành công!');
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Xóa người dùng thất bại.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-dark-900/40 p-4 rounded-xl border border-dark-800 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="text-brand-500" /> Quản Lý Tài Khoản Người Dùng (Users Hub)
          </h2>
          <p className="text-xs text-dark-400 mt-1">
            Thiết lập vai trò hệ thống và phân công tham gia nhiều dự án song song với các vai trò, chức danh và đơn giá công tác khác nhau.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-brand-600/10"
        >
          <UserPlus size={14} /> Thêm Người Dùng
        </button>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-xs text-dark-400">Đang tải danh sách người dùng...</div>
      ) : (
        <div className="bg-dark-900/20 rounded-2xl border border-dark-800 overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-dark-900/60 text-dark-400 font-bold border-b border-dark-800">
                <th className="p-4">Tên tài khoản</th>
                <th className="p-4">Họ và Tên</th>
                <th className="p-4">Vai Trò Hệ Thống</th>
                <th className="p-4">Email</th>
                <th className="p-4">Số điện thoại</th>
                <th className="p-4 text-center">Trạng thái</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-850/40">
              {users.map((u) => (
                <tr key={u.userId} className="hover:bg-dark-900/30 transition-colors">
                  <td className="p-4 font-mono font-semibold text-brand-400">{u.username}</td>
                  <td className="p-4 font-medium text-white">{u.fullName}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      <Shield className="w-3 h-3 text-blue-500" />
                      {u.globalRole?.roleName || 'USER'}
                    </span>
                  </td>
                  <td className="p-4 text-dark-300">{u.email}</td>
                  <td className="p-4 text-dark-400">{u.phone || '—'}</td>
                  <td className="p-4 text-center">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      u.isActive ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                    }`}>
                      {u.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="text-brand-400 hover:text-brand-300 hover:bg-brand-500/10 p-1.5 rounded transition-colors inline-block"
                      title="Sửa thông tin & Phân quyền dự án"
                    >
                      <Edit2 size={13} />
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(u.userId!)}
                        className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 p-1.5 rounded transition-colors inline-block"
                        title="Xóa người dùng"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit User Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass-panel p-6 rounded-2xl border border-dark-800 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Shield className="text-brand-500" /> {editingUser ? 'Cập Nhật Tài Khoản & Dự Án' : 'Thêm Người Dùng Mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-xs text-dark-400 hover:text-white">Đóng</button>
            </div>

            {/* Modal Tabs */}
            {editingUser && (
              <div className="flex border-b border-dark-850">
                <button
                  type="button"
                  onClick={() => setEditTab('basic')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                    editTab === 'basic' ? 'border-brand-500 text-brand-400' : 'border-transparent text-dark-400 hover:text-white'
                  }`}
                >
                  Thông Tin Cơ Bản
                </button>
                <button
                  type="button"
                  onClick={() => setEditTab('projects')}
                  className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
                    editTab === 'projects' ? 'border-brand-500 text-brand-400' : 'border-transparent text-dark-400 hover:text-white'
                  }`}
                >
                  Phân Vai Trò & Dự Án ({memberships.length})
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* TAB 1: BASIC INFORMATION */}
              {editTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-dark-300 font-semibold">Tên đăng nhập (Username):</label>
                      <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={!!editingUser}
                        className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500 disabled:opacity-50"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-dark-300 font-semibold">Vai trò hệ thống (Global Role):</label>
                      <select 
                        value={globalRoleId || ''}
                        onChange={(e) => setGlobalRoleId(Number(e.target.value) || undefined)}
                        className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                        required
                      >
                        <option value="">-- Chọn vai trò --</option>
                        {globalRoles.map(r => (
                          <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-dark-300 font-semibold">Họ và Tên:</label>
                      <input 
                        type="text" 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="VD: Nguyễn Văn A"
                        className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-dark-300 font-semibold">
                        Mật khẩu: {editingUser && <span className="text-[10px] text-dark-500">(Để trống nếu không đổi)</span>}
                      </label>
                      <input 
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={editingUser ? '••••••••' : 'Nhập mật khẩu'}
                        className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                        required={!editingUser}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-dark-300 font-semibold">Email:</label>
                      <input 
                        type="email" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="VD: user@aron.vn"
                        className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-dark-300 font-semibold">SĐT:</label>
                      <input 
                        type="text" 
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="VD: 093..."
                        className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs text-dark-300 font-semibold">Thời hạn sử dụng (Ngày hết hạn):</label>
                      <input 
                        type="date" 
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(e.target.value)}
                        className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-dark-300 font-semibold">Trạng thái tài khoản:</label>
                      <select 
                        value={isActive ? 'true' : 'false'}
                        onChange={(e) => setIsActive(e.target.value === 'true')}
                        className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                      >
                        <option value="true">Hoạt động (Active)</option>
                        <option value="false">Tạm dừng (Inactive)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: PROJECTS & ROLES ASSIGNMENT */}
              {editTab === 'projects' && (
                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                  <p className="text-[11px] text-dark-400">
                    Chọn các dự án mà người dùng này tham gia, gán chức danh (Role) và đơn giá (Cost) cho từng dự án.
                  </p>

                  <div className="space-y-3">
                    {allProjects.map(proj => {
                      const userProjMem = memberships.find(m => m.projectId === proj.projectId);
                      const isAssigned = !!userProjMem;

                      return (
                        <div 
                          key={proj.projectId} 
                          className={`p-3 rounded-xl border transition-all ${
                            isAssigned 
                              ? 'bg-dark-900/60 border-brand-500/40 shadow-sm' 
                              : 'bg-dark-950/40 border-dark-850 hover:border-dark-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox"
                                checked={isAssigned}
                                onChange={() => handleToggleProjectParticipation(proj.projectId)}
                                className="w-4 h-4 bg-dark-950 border-dark-800 text-brand-500 rounded focus:ring-brand-500/20 cursor-pointer"
                              />
                              <div>
                                <span className="text-xs font-bold text-white block">{proj.projectName}</span>
                                <span className="text-[10px] font-mono text-dark-400 uppercase">{proj.projectCode}</span>
                              </div>
                            </label>
                          </div>

                          {isAssigned && (
                            <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-dark-850/60">
                              <div>
                                <label className="block text-[10px] text-dark-400 font-semibold mb-1">Vai trò dự án</label>
                                <select
                                  value={userProjMem.roleId}
                                  onChange={(e) => handleMembershipChange(proj.projectId, 'roleId', Number(e.target.value))}
                                  className="w-full bg-dark-950 border border-dark-850 text-[11px] p-2 rounded-lg text-white focus:outline-none"
                                >
                                  {globalRoles.map(r => (
                                    <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] text-dark-400 font-semibold mb-1">Phân hệ (Functional Team)</label>
                                <select
                                  value={userProjMem.functionalTeamId || ''}
                                  onChange={(e) => handleMembershipChange(proj.projectId, 'functionalTeamId', Number(e.target.value) || null)}
                                  className="w-full bg-dark-950 border border-dark-850 text-[11px] p-2 rounded-lg text-white focus:outline-none"
                                >
                                  <option value="">-- Trống --</option>
                                  {(projFtMap[proj.projectId] || []).map(ft => (
                                    <option key={ft.functionalTeamId} value={ft.functionalTeamId}>{ft.functionalTeamName}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] text-dark-400 font-semibold mb-1">Đơn giá ngày ($)</label>
                                <input
                                  type="number"
                                  value={userProjMem.dailyRate || 0}
                                  onChange={(e) => handleMembershipChange(proj.projectId, 'dailyRate', Number(e.target.value))}
                                  className="w-full bg-dark-950 border border-dark-850 text-[11px] p-2 rounded-lg text-white focus:outline-none font-mono"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <button 
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all shadow-lg"
              >
                Lưu Người Dùng {editingUser && editTab === 'basic' && '& Chuyển Sang Phân Quyền Dự Án'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
