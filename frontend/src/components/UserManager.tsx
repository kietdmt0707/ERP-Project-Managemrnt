import React, { useState, useEffect } from 'react';
import { userService, UserDto } from '../services/api';
import { Users, Plus, Edit2, Trash2, Shield, Calendar, UserPlus } from 'lucide-react';

interface UserManagerProps {
  currentUserGlobalRole?: string;
}

export const UserManager: React.FC<UserManagerProps> = ({ currentUserGlobalRole }) => {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [expiryDate, setExpiryDate] = useState('');

  const isAdmin = currentUserGlobalRole === 'SYSTEM_ADMIN';

  useEffect(() => {
    loadUsers();
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

  const handleOpenCreate = () => {
    setEditingUser(null);
    setUsername('');
    setPassword('');
    setFullName('');
    setEmail('');
    setPhone('');
    setIsActive(true);
    setExpiryDate('');
    setShowModal(true);
  };

  const handleOpenEdit = (user: UserDto) => {
    setEditingUser(user);
    setUsername(user.username);
    setPassword(''); // keep blank if not changing
    setFullName(user.fullName);
    setEmail(user.email);
    setPhone(user.phone || '');
    setIsActive(user.isActive);
    setExpiryDate(user.expiryDate ? user.expiryDate.split('T')[0] : '');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (editingUser && editingUser.userId) {
        await userService.updateUser(editingUser.userId, {
          username,
          password: password || undefined,
          fullName,
          email,
          phone,
          isActive,
          expiryDate: expiryDate ? new Date(expiryDate).toISOString() : undefined
        });
        alert('Cập nhật người dùng thành công!');
      } else {
        await userService.createUser({
          username,
          password,
          fullName,
          email,
          phone,
          isActive,
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
            Tạo mới tài khoản, phân quyền, cấu hình trạng thái hoạt động và thời hạn khóa tài khoản
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
                <th className="p-4">Email</th>
                <th className="p-4">Số điện thoại</th>
                <th className="p-4">Ngày hết hạn</th>
                <th className="p-4 text-center">Trạng thái</th>
                <th className="p-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-850/40">
              {users.map((u) => (
                <tr key={u.userId} className="hover:bg-dark-900/30 transition-colors">
                  <td className="p-4 font-mono font-semibold text-brand-400">{u.username}</td>
                  <td className="p-4 font-medium text-white">{u.fullName}</td>
                  <td className="p-4 text-dark-300">{u.email}</td>
                  <td className="p-4 text-dark-400">{u.phone || '—'}</td>
                  <td className="p-4 text-dark-400 font-mono">
                    {u.expiryDate ? new Date(u.expiryDate).toLocaleDateString('vi-VN') : 'Vô thời hạn'}
                  </td>
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
                      title="Sửa thông tin"
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
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-dark-800 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Shield className="text-brand-500" /> {editingUser ? 'Cập Nhật Tài Khoản' : 'Thêm Người Dùng Mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-xs text-dark-400 hover:text-white">Đóng</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                <label className="text-xs text-dark-300 font-semibold">
                  Mật khẩu: {editingUser && <span className="text-[10px] text-dark-500">(Để trống nếu không muốn đổi)</span>}
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
                  <label className="text-xs text-dark-300 font-semibold">Trạng thái:</label>
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

              <button 
                type="submit"
                className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all"
              >
                Lưu Người Dùng
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
