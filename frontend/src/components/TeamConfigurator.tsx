import React, { useState, useEffect } from 'react';
import { teamService, TeamMemberDto } from '../services/api';
import { Users, Plus, UserPlus, Briefcase } from 'lucide-react';

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
      if (res.roles.length > 0) {
        setRoleId(res.roles[res.roles.length - 1].roleId); // Default to lowest role (Member)
      }
    } catch (err: any) {
      setError(err.message || 'Lỗi tải cơ cấu đội dự án.');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await teamService.assignMember({
        projectId,
        username,
        fullName,
        email,
        phone,
        title,
        roleId,
        functionalTeamId,
        dailyRate: (userRole === 'PM' || userRole === 'DIRECTOR') ? dailyRate : undefined
      });
      setShowMemberModal(false);
      // Reset
      setUsername('');
      setFullName('');
      setEmail('');
      setPhone('');
      setTitle('');
      setFunctionalTeamId(undefined);
      setDailyRate(150);
      loadTeamData();
    } catch (err: any) {
      setError(err.message || 'Gán thành viên thất bại.');
    } finally {
      setSubmitting(false);
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

  const isCostVisible = userRole === 'PM' || userRole === 'DIRECTOR';
  const canManageTeam = userRole === 'PM' || userRole === 'DIRECTOR' || userRole === 'PC';

  return (
    <div className="space-y-6">
      <div className="bg-dark-900/40 p-4 rounded-xl border border-dark-800 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="text-brand-500" /> Quản Lý Đội Dự Án & Cơ Cấu Phân Quyền
          </h2>
          <p className="text-xs text-dark-400 mt-1">
            Khai báo đội ARON, Khách hàng, Partner, đội chức năng (FIN, Tech...) và gán vai trò nhân sự
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
              onClick={() => setShowMemberModal(true)}
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
                      <div key={ft.functionalTeamId} className="text-dark-400 hover:text-white transition-colors py-0.5">
                        ⚙️ Team {ft.functionalTeamName}
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-900">
                  {data.members.map((m) => (
                    <tr key={m.projectMemberId} className="hover:bg-dark-900/30">
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-2">
                          <img 
                            src={m.avatarPath} 
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showMemberModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-panel p-6 rounded-2xl border border-dark-800 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <UserPlus className="text-brand-500" /> Đăng Ký Thành Viên Dự Án
              </h3>
              <button onClick={() => setShowMemberModal(false)} className="text-xs text-dark-400 hover:text-white">Đóng</button>
            </div>

            <form onSubmit={handleMemberSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Tài khoản đăng nhập (Username):</label>
                  <input 
                    type="text" 
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="VD: john_consultant"
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Email liên hệ (*):</label>
                  <input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="VD: john@aron.vn"
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Điện thoại:</label>
                  <input 
                    type="text" 
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="SĐT liên hệ"
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Vai Trò Phân Quyền (Roles):</label>
                  <select 
                    value={roleId}
                    onChange={(e) => setRoleId(Number(e.target.value))}
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    {data.roles.map(r => (
                      <option key={r.roleId} value={r.roleId}>{r.roleName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Nhóm Chức Năng (Team):</label>
                  <select 
                    value={functionalTeamId || ''}
                    onChange={(e) => setFunctionalTeamId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="">-- Chưa xếp team --</option>
                    {data.functionalTeams.map(ft => (
                      <option key={ft.functionalTeamId} value={ft.functionalTeamId}>{ft.functionalTeamName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {isCostVisible && (
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Giá Cost Ngày Công (Daily Rate - USD):</label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-dark-500 font-bold">$</span>
                    <input 
                      type="number" 
                      value={dailyRate}
                      onChange={(e) => setDailyRate(parseFloat(e.target.value) || 0)}
                      className="w-full bg-dark-900 border border-dark-800 text-xs p-3 pl-7 rounded-xl text-white focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>
                </div>
              )}

              <button 
                type="submit"
                disabled={submitting}
                className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all"
              >
                {submitting ? 'Đang lưu...' : 'Gán/Thêm Thành Viên Vào Dự Án'}
              </button>
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
                <Briefcase className="text-brand-500" /> Khai Báo Đội/Nhóm Mới
              </h3>
              <button onClick={() => setShowTeamModal(false)} className="text-xs text-dark-400 hover:text-white">Đóng</button>
            </div>

            <form onSubmit={handleTeamSubmit} className="space-y-4">
              <div className="flex items-center gap-2 pb-2">
                <input 
                  type="checkbox"
                  id="isFunctional"
                  checked={isFunctional}
                  onChange={e => setIsFunctional(e.target.checked)}
                  className="rounded bg-dark-900 border-dark-800 text-brand-500 focus:ring-brand-500"
                />
                <label htmlFor="isFunctional" className="text-xs text-dark-300 font-semibold">Đây là Team chức năng (Ví dụ: Team Tech, Team FIN...)</label>
              </div>

              {isFunctional && (
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Thuộc Đội dự án nào:</label>
                  <select 
                    value={parentTeamId || ''}
                    onChange={(e) => setParentTeamId(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    required
                  >
                    <option value="">-- Chọn đội dự án --</option>
                    {data.teams.map(t => (
                      <option key={t.teamId} value={t.teamId}>{t.teamName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Tên Đội / Nhóm:</label>
                <input 
                  type="text" 
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder={isFunctional ? "VD: Tech, DBA, AP..." : "VD: Đội ARON, Đội Khách Hàng..."}
                  className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all"
              >
                Tạo Đội/Nhóm
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
