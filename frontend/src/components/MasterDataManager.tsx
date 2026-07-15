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
    if (!isAdmin) return; // Chỉ admin mới có quyền sửa matrix
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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
            <Database className="w-7 h-7 text-blue-500" />
            Cấu hình Master Data & Phân Quyền (RBAC)
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Quản trị danh mục phạm vi Oracle ERP và thiết lập ma trận quyền hạn cho từng chức danh công tác.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-lg mt-4 md:mt-0">
          <button
            onClick={() => setActiveTab('scopes')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'scopes'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Database className="w-4 h-4" />
            Phạm vi Dự án (Project Scopes)
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              activeTab === 'roles'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            Phân quyền Vai trò (RBAC Matrix)
          </button>
        </div>
      </div>

      {/* ==================== TAB 1: PROJECT SCOPES ==================== */}
      {activeTab === 'scopes' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              Danh mục Phạm vi Dự án (Project Scopes)
            </h3>
            {isPmOrAdmin && (
              <button
                onClick={handleOpenCreateScope}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg text-sm font-medium transition-all shadow-md"
              >
                <Plus className="w-4 h-4" />
                Thêm phạm vi
              </button>
            )}
          </div>

          {scopeLoading ? (
            <div className="text-center py-12 text-slate-400">Đang tải danh mục phạm vi...</div>
          ) : scopeError ? (
            <div className="p-4 bg-red-950 border border-red-800 text-red-400 rounded-lg text-sm">{scopeError}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-sm">
                    <th className="py-3 px-4">Mã Giá Trị (Value)</th>
                    <th className="py-3 px-4">Mô Tả (Description)</th>
                    <th className="py-3 px-4 text-center">Trạng Thái</th>
                    {isPmOrAdmin && <th className="py-3 px-4 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {scopes.map(s => (
                    <tr key={s.optionId} className="border-b border-slate-850 hover:bg-slate-850/50 text-white transition-colors">
                      <td className="py-4 px-4 font-mono text-blue-400 text-sm font-semibold">{s.value}</td>
                      <td className="py-4 px-4 text-slate-350">{s.description}</td>
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          s.isActive ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {s.isActive ? (
                            <>
                              <CheckCircle className="w-3.5 h-3.5" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5" />
                              Inactive
                            </>
                          )}
                        </span>
                      </td>
                      {isPmOrAdmin && (
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => handleOpenEditScope(s)}
                            className="p-2 text-slate-400 hover:text-white hover:bg-slate-850 rounded-lg transition-all"
                            title="Chỉnh sửa"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {scopes.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-8 text-slate-500">Chưa có phạm vi dự án nào được định nghĩa.</td>
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
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2">Danh sách chức danh</h4>
            {roleError && (
              <div className="p-2 bg-red-950/40 border border-red-800/30 text-red-400 text-[10px] rounded-lg">{roleError}</div>
            )}
            {roleLoading ? (
              <div className="text-slate-500 text-center py-6 text-sm">Đang tải...</div>
            ) : (
              <div className="space-y-1">
                {roles.map(r => (
                  <button
                    key={r.roleId}
                    onClick={() => selectRole(r)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-between ${
                      selectedRole?.roleId === r.roleId
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-slate-850'
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
          <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
            {selectedRole ? (
              <form onSubmit={handleRoleSubmit} className="space-y-6">
                <div className="border-b border-slate-800 pb-4">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-blue-500" />
                    Cấu hình vai trò: {selectedRole.roleName} ({selectedRole.roleCode})
                  </h3>
                  <p className="text-slate-400 text-xs mt-1">
                    Cấp bậc phân cấp: Level {selectedRole.hierarchyLevel} (Càng nhỏ quyền càng lớn).
                  </p>
                </div>

                {/* Metadata Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Tên vai trò hiển thị</label>
                    <input
                      type="text"
                      value={roleName}
                      onChange={e => setRoleName(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Trạng thái vai trò</label>
                    <div className="flex items-center mt-2.5">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={roleActive}
                          onChange={e => setRoleActive(e.target.checked)}
                          disabled={!isAdmin}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-350 after:border-slate-300 after:border after:rounded-full after:height-5 after:width-5 after:transition-all peer-checked:bg-blue-600"></div>
                        <span className="ml-3 text-sm text-slate-350 font-medium">{roleActive ? 'Cho phép sử dụng (Active)' : 'Khóa vai trò (Inactive)'}</span>
                      </label>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mô tả chi tiết vai trò</label>
                    <textarea
                      value={roleDesc}
                      onChange={e => setRoleDesc(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 h-20 resize-none"
                    />
                  </div>
                </div>

                {/* RBAC MATRIX GRID */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-indigo-500" />
                      Ma Trận Phân Quyền Tính Năng (Permission Matrix)
                    </h4>
                    {isAdmin ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAll}
                          className="bg-blue-600/20 hover:bg-blue-600/35 text-blue-400 font-bold text-[10px] py-1.5 px-3 rounded-lg border border-blue-500/20 transition-all cursor-pointer"
                        >
                          Chọn Tất Cả
                        </button>
                        <button
                          type="button"
                          onClick={handleClearAll}
                          className="bg-slate-800 hover:bg-slate-750 text-slate-350 font-bold text-[10px] py-1.5 px-3 rounded-lg border border-slate-700 transition-all cursor-pointer"
                        >
                          Bỏ Chọn Tất Cả
                        </button>
                      </div>
                    ) : (
                      <span className="text-amber-400 text-xs bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/20">
                        Chỉ Admin hệ thống mới được phép sửa đổi ma trận này.
                      </span>
                    )}
                  </div>

                  <div className="overflow-x-auto border border-slate-850 rounded-lg bg-slate-950">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 font-medium">
                          <th className="py-3 px-4">Tính năng hệ thống (System Feature)</th>
                          {actions.map(act => (
                            <th key={act.key} className="py-3 px-4 text-center">{act.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {systemFeatures.map(feat => (
                          <tr key={feat.key} className="border-b border-slate-900 hover:bg-slate-900/40 text-white">
                            <td className="py-3 px-4 font-semibold text-slate-300">{feat.name}</td>
                            {actions.map(act => {
                              const isChecked = permissions[feat.key]?.[act.key] || false;
                              return (
                                <td key={act.key} className="py-3 px-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handlePermissionToggle(feat.key, act.key)}
                                    disabled={!isAdmin}
                                    className="w-4.5 h-4.5 bg-slate-900 border-slate-850 text-blue-600 rounded focus:ring-blue-500/20 focus:ring-offset-slate-950 focus:ring-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <div className="flex justify-end pt-4 border-t border-slate-800">
                    <button
                      type="submit"
                      className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-all shadow-md"
                    >
                      Lưu Thay Đổi Vai Trò & Phân Quyền
                    </button>
                  </div>
                )}
              </form>
            ) : (
              <div className="text-center py-20 text-slate-500">Vui lòng chọn một vai trò bên trái để cấu hình.</div>
            )}
          </div>
        </div>
      )}

      {/* ==================== CREATE/EDIT SCOPE MODAL ==================== */}
      {showScopeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-xl p-6 shadow-2xl relative">
            <button
              onClick={() => setShowScopeModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-sm"
            >
              Đóng
            </button>
            <h3 className="text-lg font-bold text-white mb-4">
              {editingScope ? 'Chỉnh Sửa Phạm Vi Dự Án' : 'Thêm Mới Phạm Vi Dự Án'}
            </h3>

            <form onSubmit={handleScopeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mã Giá Trị (Value)</label>
                <input
                  type="text"
                  value={scopeValue}
                  onChange={e => setScopeValue(e.target.value)}
                  disabled={!!editingScope} // Không cho sửa mã giá trị khi đã tạo
                  placeholder="Ví dụ: EBS_FIN"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 uppercase disabled:opacity-50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mô tả phạm vi (Description)</label>
                <input
                  type="text"
                  value={scopeDesc}
                  onChange={e => setScopeDesc(e.target.value)}
                  placeholder="Ví dụ: Oracle EBS Financials Suite"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Trạng thái hoạt động</label>
                <div className="flex items-center mt-2">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scopeActive}
                      onChange={e => setScopeActive(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-800 rounded-full peer peer-focus:ring-2 peer-focus:ring-blue-500/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-350 after:border-slate-300 after:border after:rounded-full after:height-5 after:width-5 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-sm text-slate-350 font-medium">Kích hoạt (Active)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowScopeModal(false)}
                  className="px-4 py-2 border border-slate-800 hover:bg-slate-850 text-slate-350 rounded-lg text-sm font-medium transition-all"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition-all shadow-md"
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
