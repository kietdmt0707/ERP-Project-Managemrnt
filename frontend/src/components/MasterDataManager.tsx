import React, { useState, useEffect } from 'react';
import { masterDataService, ProjectScopeOptionDto, SystemRoleDto } from '../services/api';
import { Database, Shield, ShieldAlert, Plus, Edit2, CheckCircle, XCircle } from 'lucide-react';

interface MasterDataManagerProps {
  currentUserGlobalRole?: string;
}

export const MasterDataManager: React.FC<MasterDataManagerProps> = ({ currentUserGlobalRole }) => {
  const [activeTab, setActiveTab] = useState<'scopes' | 'roles'>('scopes');
  
  // Scope states
  const [scopes, setScopes] = useState<ProjectScopeOptionDto[]>([]);
  const [scopeLoading, setScopeLoading] = useState(true);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [showScopeModal, setShowScopeModal] = useState(false);
  const [editingScope, setEditingScope] = useState<ProjectScopeOptionDto | null>(null);
  const [scopeValue, setScopeValue] = useState('');
  const [scopeDesc, setScopeDesc] = useState('');
  const [scopeActive, setScopeActive] = useState(true);

  // Role states
  const [roles, setRoles] = useState<SystemRoleDto[]>([]);
  const [selectedRole, setSelectedRole] = useState<SystemRoleDto | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [roleActive, setRoleActive] = useState(true);
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({});

  const isAdmin = currentUserGlobalRole === 'SYSTEM_ADMIN';
  const isPmOrAdmin = currentUserGlobalRole === 'SYSTEM_ADMIN' || currentUserGlobalRole === 'PM';

  const systemFeatures = [
    { key: 'Projects', name: 'Dự án (Projects)' },
    { key: 'RICEFW', name: 'Yêu cầu RICEFW' },
    { key: 'Gantt', name: 'Lịch trình Gantt' },
    { key: 'Team', name: 'Cấu hình Đội ngũ' },
    { key: 'Approvals', name: 'Phê duyệt Yêu cầu' },
    { key: 'Costs', name: 'Quản lý Chi phí' },
    { key: 'Users', name: 'Quản lý Người dùng' },
    { key: 'Settings', name: 'Cấu hình Hệ thống' },
    { key: 'MasterData', name: 'Master Data & RBAC' }
  ];

  const actions = [
    { key: 'View', name: 'Xem (View)' },
    { key: 'Create', name: 'Thêm (Create)' },
    { key: 'Edit', name: 'Sửa (Edit)' },
    { key: 'Delete', name: 'Xóa (Delete)' }
  ];

  useEffect(() => {
    if (activeTab === 'scopes') {
      loadScopes();
    } else {
      loadRoles();
    }
  }, [activeTab]);

  // ==================== SCOPES WORKFLOW ====================
  const loadScopes = async () => {
    try {
      setScopeLoading(true);
      const data = await masterDataService.getScopes();
      setScopes(data);
    } catch (err: any) {
      setScopeError(err.message || 'Lỗi khi tải danh sách phạm vi dự án.');
    } finally {
      setScopeLoading(false);
    }
  };

  const handleOpenCreateScope = () => {
    setEditingScope(null);
    setScopeValue('');
    setScopeDesc('');
    setScopeActive(true);
    setShowScopeModal(true);
  };

  const handleOpenEditScope = (scope: ProjectScopeOptionDto) => {
    setEditingScope(scope);
    setScopeValue(scope.value);
    setScopeDesc(scope.description);
    setScopeActive(scope.isActive);
    setShowScopeModal(true);
  };

  const handleScopeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scopeValue.trim() || !scopeDesc.trim()) return;

    try {
      if (editingScope && editingScope.optionId) {
        await masterDataService.updateScope(editingScope.optionId, {
          value: scopeValue,
          description: scopeDesc,
          isActive: scopeActive
        });
        alert('Cập nhật phạm vi thành công!');
      } else {
        await masterDataService.createScope({
          value: scopeValue,
          description: scopeDesc,
          isActive: scopeActive
        });
        alert('Tạo phạm vi mới thành công!');
      }
      setShowScopeModal(false);
      loadScopes();
    } catch (err: any) {
      alert(err.message || 'Thao tác lưu phạm vi thất bại.');
    }
  };

  // ==================== ROLES & RBAC WORKFLOW ====================
  const loadRoles = async () => {
    try {
      setRoleLoading(true);
      const data = await masterDataService.getRoles();
      setRoles(data);
      if (data.length > 0) {
        selectRole(data[0]);
      }
    } catch (err: any) {
      setRoleError(err.message || 'Lỗi khi tải danh sách vai trò.');
    } finally {
      setRoleLoading(false);
    }
  };

  const selectRole = (role: SystemRoleDto) => {
    setSelectedRole(role);
    setRoleName(role.roleName);
    setRoleDesc(role.description || '');
    setRoleActive(role.isActive);
    
    // Parse permissions JSON
    let parsedPerms: Record<string, Record<string, boolean>> = {};
    try {
      if (role.permissionsJson) {
        parsedPerms = JSON.parse(role.permissionsJson);
      }
    } catch (e) {
      console.error('Lỗi parse permissionsJson', e);
    }

    // Fill missing defaults
    const finalPerms: Record<string, Record<string, boolean>> = {};
    systemFeatures.forEach(feat => {
      finalPerms[feat.key] = {};
      actions.forEach(act => {
        finalPerms[feat.key][act.key] = parsedPerms[feat.key]?.[act.key] || false;
      });
    });

    setPermissions(finalPerms);
  };

  const handlePermissionToggle = (featureKey: string, actionKey: string) => {
    if (!isAdmin) return;
    setPermissions(prev => ({
      ...prev,
      [featureKey]: {
        ...prev[featureKey],
        [actionKey]: !prev[featureKey][actionKey]
      }
    }));
  };

  const handleSelectAll = () => {
    if (!isAdmin) return;
    const allChecked: Record<string, Record<string, boolean>> = {};
    systemFeatures.forEach(feat => {
      allChecked[feat.key] = {};
      actions.forEach(act => {
        allChecked[feat.key][act.key] = true;
      });
    });
    setPermissions(allChecked);
  };

  const handleClearAll = () => {
    if (!isAdmin) return;
    const allCleared: Record<string, Record<string, boolean>> = {};
    systemFeatures.forEach(feat => {
      allCleared[feat.key] = {};
      actions.forEach(act => {
        allCleared[feat.key][act.key] = false;
      });
    });
    setPermissions(allCleared);
  };

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole || !selectedRole.roleId) return;

    try {
      await masterDataService.updateRole(selectedRole.roleId, {
        ...selectedRole,
        roleName,
        description: roleDesc,
        isActive: roleActive,
        permissionsJson: JSON.stringify(permissions)
      });
      alert('Cập nhật cấu hình vai trò và ma trận quyền thành công!');
      loadRoles();
    } catch (err: any) {
      alert(err.message || 'Lưu cấu hình vai trò thất bại.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-dark-900-40 p-4 rounded-xl border border-dark-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Database className="text-brand-500" /> Cấu hình Master Data & Phân Quyền (RBAC)
          </h2>
          <p className="text-xs text-dark-400 mt-1">
            Quản trị danh mục phạm vi Oracle ERP và thiết lập ma trận quyền hạn cho từng chức danh công tác.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-dark-950 p-1.5 rounded-xl border border-dark-800">
          <button
            onClick={() => setActiveTab('scopes')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'scopes'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600-10'
                : 'text-dark-400 hover:text-white hover:bg-dark-900'
            }`}
          >
            <Database size={14} /> Phạm vi Dự án (Project Scopes)
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'roles'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600-10'
                : 'text-dark-400 hover:text-white hover:bg-dark-900'
            }`}
          >
            <Shield size={14} /> Phân quyền Vai trò (RBAC Matrix)
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: PROJECT SCOPES ==================== */}
      {activeTab === 'scopes' && (
        <div className="glass-panel rounded-2xl border border-dark-800 p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-dark-850 pb-4">
            <h3 className="text-md font-bold text-white flex items-center gap-2">
              Danh mục Phạm vi Dự án (Project Scopes)
            </h3>
            {isPmOrAdmin && (
              <button
                onClick={handleOpenCreateScope}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-brand-600-10"
              >
                <Plus size={14} /> Thêm phạm vi
              </button>
            )}
          </div>

          {scopeLoading ? (
            <div className="text-center py-12 text-xs text-dark-400">Đang tải danh mục phạm vi...</div>
          ) : scopeError ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs">{scopeError}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-dark-800 text-dark-400 font-semibold">
                    <th className="py-3 px-4">Mã Giá Trị (Value)</th>
                    <th className="py-3 px-4">Mô Tả (Description)</th>
                    <th className="py-3 px-4 text-center">Trạng Thái</th>
                    {isPmOrAdmin && <th className="py-3 px-4 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-850">
                  {scopes.map(s => (
                    <tr key={s.optionId} className="hover:bg-dark-900-30 text-white transition-colors">
                      <td className="py-3.5 px-4 font-mono text-brand-400 font-semibold">{s.value}</td>
                      <td className="py-3.5 px-4 text-dark-300">{s.description}</td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          s.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {s.isActive ? (
                            <>
                              <CheckCircle size={11} /> Active
                            </>
                          ) : (
                            <>
                              <XCircle size={11} /> Inactive
                            </>
                          )}
                        </span>
                      </td>
                      {isPmOrAdmin && (
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleOpenEditScope(s)}
                            className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-all"
                            title="Chỉnh sửa"
                          >
                            <Edit2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {scopes.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-dark-500 italic">Chưa có phạm vi dự án nào được định nghĩa.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: SYSTEM ROLES & RBAC MATRIX ==================== */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Roles Selector Sidebar */}
          <div className="lg:col-span-1 glass-panel rounded-2xl border border-dark-800 p-4 space-y-3">
            <h4 className="text-[10px] font-bold text-dark-400 uppercase tracking-wider px-2">Danh sách chức danh</h4>
            {roleError && (
              <div className="p-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] rounded-lg">{roleError}</div>
            )}
            {roleLoading ? (
              <div className="text-dark-400 text-center py-6 text-xs">Đang tải...</div>
            ) : (
              <div className="space-y-1">
                {roles.map(r => (
                  <button
                    key={r.roleId}
                    onClick={() => selectRole(r)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between ${
                      selectedRole?.roleId === r.roleId
                        ? 'bg-brand-600 text-white shadow-lg shadow-brand-600-10'
                        : 'text-dark-300 hover:text-white hover:bg-dark-800'
                    }`}
                  >
                    <span>{r.roleName}</span>
                    <span className="text-[10px] font-mono opacity-60">{r.roleCode}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Matrix & Configurations Detail */}
          <div className="lg:col-span-3 glass-panel rounded-2xl border border-dark-800 p-6 space-y-6">
            {selectedRole ? (
              <form onSubmit={handleRoleSubmit} className="space-y-6">
                <div className="border-b border-dark-850 pb-4">
                  <h3 className="text-md font-bold text-white flex items-center gap-2">
                    <Shield className="text-brand-500" /> Cấu hình vai trò: {selectedRole.roleName} ({selectedRole.roleCode})
                  </h3>
                  <p className="text-dark-400 text-xs mt-1">
                    Cấp bậc phân cấp: Level {selectedRole.hierarchyLevel} (Càng nhỏ quyền hạn càng lớn).
                  </p>
                </div>

                {/* Metadata Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-dark-300">Tên vai trò hiển thị:</label>
                    <input
                      type="text"
                      value={roleName}
                      onChange={e => setRoleName(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-dark-950 border border-dark-800 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-brand-500 disabled:opacity-50"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-dark-300">Trạng thái vai trò:</label>
                    <div className="flex items-center pt-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={roleActive}
                          onChange={e => setRoleActive(e.target.checked)}
                          disabled={!isAdmin}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-dark-850 rounded-full peer peer-focus:ring-2 peer-focus:ring-brand-500/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-dark-700 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                        <span className="ml-3 text-xs text-dark-300 font-medium">{roleActive ? 'Cho phép sử dụng (Active)' : 'Khóa vai trò (Inactive)'}</span>
                      </label>
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-semibold text-dark-300">Mô tả chi tiết vai trò:</label>
                    <textarea
                      value={roleDesc}
                      onChange={e => setRoleDesc(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-dark-950 border border-dark-800 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-brand-500 disabled:opacity-50 h-20 resize-none"
                    />
                  </div>
                </div>

                {/* RBAC MATRIX GRID */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <ShieldAlert size={14} className="text-amber-500" /> Ma Trận Phân Quyền Tính Năng (Permission Matrix)
                    </h4>
                    {isAdmin ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="bg-brand-500-10 hover:bg-brand-500-20 text-brand-400 font-bold text-[10px] py-1.5 px-3 rounded-lg border border-brand-500-20 transition-all cursor-pointer"
                        >
                          Chọn Tất Cả
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAll}
                          className="bg-dark-800 hover:bg-dark-750 text-dark-300 font-bold text-[10px] py-1.5 px-3 rounded-lg border border-dark-700 transition-all cursor-pointer"
                        >
                          Bỏ Chọn Tất Cả
                        </button>
                      </div>
                    ) : (
                      <span className="text-amber-400 text-[10px] bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                        Chỉ Admin hệ thống mới được phép sửa đổi ma trận này.
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto border border-dark-800 rounded-xl bg-dark-950">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-dark-900-60 border-b border-dark-800 text-dark-400 font-semibold">
                          <th className="py-3 px-4">Tính năng hệ thống (System Feature)</th>
                          {actions.map(act => (
                            <th key={act.key} className="py-3 px-4 text-center">{act.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-850">
                        {systemFeatures.map(feat => (
                          <tr key={feat.key} className="hover:bg-dark-900-30 text-white">
                            <td className="py-3 px-4 font-semibold text-dark-200">{feat.name}</td>
                            {actions.map(act => {
                              const isChecked = permissions[feat.key]?.[act.key] || false;
                              return (
                                <td key={act.key} className="py-3 px-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handlePermissionToggle(feat.key, act.key)}
                                    disabled={!isAdmin}
                                    className="w-4 h-4 rounded border-dark-700 bg-dark-900 text-brand-600 focus:ring-brand-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Save Role Button */}
                {isAdmin && (
                  <div className="flex justify-end pt-4 border-t border-dark-850">
                    <button
                      type="submit"
                      className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-brand-600-10"
                    >
                      Lưu Thay Đổi Vai Trò & Phân Quyền
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <div className="text-center py-20 text-dark-500 text-xs italic">Vui lòng chọn một vai trò bên trái để cấu hình.</div>
            )}
          </div>
        </div>
      )}

      {/* ==================== CREATE/EDIT SCOPE MODAL ==================== */}
      {showScopeModal && (
        <div className="fixed inset-0 bg-dark-950-80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-slide-up">
          <div className="glass-panel border border-dark-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white">
                {editingScope ? 'Chỉnh Sửa Phạm Vi Dự Án' : 'Thêm Mới Phạm Vi Dự Án'}
              </h3>
              <button
                onClick={() => setShowScopeModal(false)}
                className="text-xs text-dark-400 hover:text-white"
              >
                Đóng
              </button>
            </div>

            <form onSubmit={handleScopeSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-300">Mã Giá Trị (Value):</label>
                <input
                  type="text"
                  value={scopeValue}
                  onChange={e => setScopeValue(e.target.value)}
                  disabled={!!editingScope}
                  placeholder="Ví dụ: EBS_FIN"
                  className="w-full bg-dark-950 border border-dark-800 rounded-xl px-3.5 py-2.5 text-white text-xs font-mono uppercase focus:outline-none focus:border-brand-500 disabled:opacity-50"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-300">Mô tả phạm vi (Description):</label>
                <input
                  type="text"
                  value={scopeDesc}
                  onChange={e => setScopeDesc(e.target.value)}
                  placeholder="Ví dụ: Oracle EBS Financials Suite"
                  className="w-full bg-dark-950 border border-dark-800 rounded-xl px-3.5 py-2.5 text-white text-xs focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-dark-300">Trạng thái hoạt động:</label>
                <div className="flex items-center pt-1">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scopeActive}
                      onChange={e => setScopeActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-dark-850 rounded-full peer peer-focus:ring-2 peer-focus:ring-brand-500/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-dark-700 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-600"></div>
                    <span className="ml-3 text-xs text-dark-300 font-medium">Kích hoạt (Active)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-dark-850">
                <button
                  type="button"
                  onClick={() => setShowScopeModal(false)}
                  className="px-4 py-2 border border-dark-800 hover:bg-dark-800 text-dark-300 rounded-xl text-xs font-semibold transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-brand-600-10"
                >
                  Lưu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
