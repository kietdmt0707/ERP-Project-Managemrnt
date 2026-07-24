import React, { useState, useEffect } from 'react';
import { travelPolicyService, TravelExpensePolicy, TravelRegion, projectService, ProjectDto } from '../services/api';
import { Clipboard, ShieldAlert, Edit, Save, Copy, Percent, Sparkles, Plus, Trash2, Globe, Layers } from 'lucide-react';

export const TravelPolicyConfig: React.FC = () => {
  const [policies, setPolicies] = useState<TravelExpensePolicy[]>([]);
  const [regions, setRegions] = useState<TravelRegion[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Filter state
  const [filterProjectId, setFilterProjectId] = useState<number | 'ALL' | 'GLOBAL'>('GLOBAL');

  // Inline edit state
  const [editPerDiem, setEditPerDiem] = useState(0);
  const [editHotelLimit, setEditHotelLimit] = useState(0);
  const [editCurrency, setEditCurrency] = useState('VND');
  const [editFlightTicketClass, setEditFlightTicketClass] = useState('ECONOMY');
  const [saving, setSaving] = useState(false);

  // New Policy Modal state
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [newProjectId, setNewProjectId] = useState<number | null>(null);
  const [newRegionCode, setNewRegionCode] = useState('TIERS_1');
  const [newRoleCode, setNewRoleCode] = useState('MEMBER');
  const [newPerDiem, setNewPerDiem] = useState(250000);
  const [newHotelLimit, setNewHotelLimit] = useState(400000);
  const [newTransportLimit, setNewTransportLimit] = useState(100000);
  const [newCurrency, setNewCurrency] = useState('VND');
  const [newFlightTicketClass, setNewFlightTicketClass] = useState('ECONOMY');
  const [submittingPolicy, setSubmittingPolicy] = useState(false);

  // New Region Modal state
  const [showRegionModal, setShowRegionModal] = useState(false);
  const [regionCodeInput, setRegionCodeInput] = useState('');
  const [regionNameInput, setRegionNameInput] = useState('');
  const [provincesInput, setProvincesInput] = useState('');
  const [submittingRegion, setSubmittingRegion] = useState(false);

  // Clone Policy state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [inflationRate, setInflationRate] = useState(5.0);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [policiesData, regionsData, projectsData] = await Promise.all([
        travelPolicyService.getPolicies(),
        travelPolicyService.getRegions(),
        projectService.getProjects()
      ]);
      setPolicies(policiesData);
      setRegions(regionsData);
      setProjects(projectsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStartEdit = (p: TravelExpensePolicy) => {
    setEditingId(p.policyId);
    setEditPerDiem(p.perDiemAllowance);
    setEditHotelLimit(p.maxHotelRate);
    setEditCurrency(p.currency || 'VND');
    setEditFlightTicketClass(p.flightTicketClass || 'ECONOMY');
  };

  const handleSaveEdit = async (p: TravelExpensePolicy) => {
    try {
      setSaving(true);
      await travelPolicyService.updatePolicy(p.policyId, {
        ...p,
        perDiemAllowance: editPerDiem,
        maxHotelRate: editHotelLimit,
        currency: editCurrency,
        flightTicketClass: editFlightTicketClass
      });
      setEditingId(null);
      loadData();
    } catch (err: any) {
      alert(err.message || "Cập nhật quy định thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePolicy = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa quy định định mức này không?')) return;
    try {
      await travelPolicyService.deletePolicy(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Xóa quy định thất bại.');
    }
  };

  const handleCreatePolicySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingPolicy(true);
      await travelPolicyService.createPolicy({
        projectId: newProjectId ? newProjectId : undefined,
        regionCode: newRegionCode,
        roleCode: newRoleCode,
        perDiemAllowance: newPerDiem,
        maxHotelRate: newHotelLimit,
        transportAllowance: newTransportLimit,
        currency: newCurrency,
        flightTicketClass: newFlightTicketClass
      });
      setShowPolicyModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Tạo quy định thất bại.');
    } finally {
      setSubmittingPolicy(false);
    }
  };

  const handleCreateRegionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmittingRegion(true);
      await travelPolicyService.createRegion({
        regionCode: regionCodeInput.toUpperCase(),
        regionName: regionNameInput,
        provincesIncluded: provincesInput
      });
      setShowRegionModal(false);
      setRegionCodeInput('');
      setRegionNameInput('');
      setProvincesInput('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Lưu vùng địa lý thất bại.');
    } finally {
      setSubmittingRegion(false);
    }
  };

  const handleCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCloning(true);
      const res = await travelPolicyService.clonePolicies(inflationRate);
      alert(res.message || "Nhân bản quy định định mức thành công!");
      setShowCloneModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || "Không thể nhân bản quy định.");
    } finally {
      setCloning(false);
    }
  };

  const getRegionName = (code: string) => {
    const found = regions.find(r => r.regionCode === code);
    if (found) return found.regionName;
    if (code === 'TIERS_1') return 'Vùng 1 (Hà Nội, HCM)';
    if (code === 'TIERS_2') return 'Vùng 2 (Đà Nẵng, Cần Thơ, Hải Phòng)';
    if (code === 'TIERS_3') return 'Vùng 3 (Các tỉnh còn lại)';
    if (code === 'TIERS_INT_1') return 'Vùng 4 (Đông Nam Á / ASEAN)';
    if (code === 'TIERS_INT_2') return 'Vùng 5 (Mỹ, Châu Âu, Nhật, Hàn)';
    return code;
  };

  const filteredPolicies = policies.filter(p => {
    if (filterProjectId === 'GLOBAL') return p.projectId == null;
    if (filterProjectId === 'ALL') return true;
    return p.projectId === filterProjectId;
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-dark-900-40 p-4 rounded-xl border border-dark-800 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clipboard className="text-brand-500" /> Cấu Hình Định Mức Công Tác Phí & Khách Sạn
          </h2>
          <p className="text-xs text-dark-400 mt-1">
            Chủ động thiết lập định mức công tác phí (trong nước & quốc tế) theo Vùng địa lý, Chức danh & Dự án cụ thể
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setShowRegionModal(true)}
            className="bg-dark-800 hover:bg-dark-750 border border-dark-700 text-white font-bold text-xs py-2.5 px-3.5 rounded-xl flex items-center gap-1.5 transition-all"
          >
            <Globe size={14} className="text-brand-400" /> + Khai Báo Vùng Địa Lý
          </button>

          <button
            onClick={() => setShowPolicyModal(true)}
            className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-brand-600-10"
          >
            <Plus size={14} /> + Khai Báo Định Mức Mới
          </button>

          <button
            onClick={() => setShowCloneModal(true)}
            className="bg-dark-800 hover:bg-dark-750 border border-dark-700 text-dark-300 hover:text-white font-bold text-xs py-2.5 px-3.5 rounded-xl flex items-center gap-1.5 transition-all"
          >
            <Copy size={13} /> Nhân Bản
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Policy Grid Matrix (Left Columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-dark-800 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3 border-b border-dark-850 pb-3">
              <h3 className="text-xs font-bold text-dark-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-brand-500" /> Ma Trận Định Mức Chi Phí (Policy Matrix)
              </h3>

              {/* Filter scope selection */}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-dark-400 font-semibold flex items-center gap-1"><Layers size={13} /> Phạm vi áp dụng:</span>
                <select
                  value={filterProjectId}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'GLOBAL' || val === 'ALL') setFilterProjectId(val);
                    else setFilterProjectId(Number(val));
                  }}
                  className="bg-dark-950 border border-dark-800 text-xs px-2.5 py-1.5 rounded-lg text-white font-semibold focus:outline-none focus:border-brand-500"
                >
                  <option value="GLOBAL font-bold">Mặc Định Toàn Hệ Thống (Global Default)</option>
                  <option value="ALL">Tất Cả Quy Định (Toàn Hệ Thống + Dự Án)</option>
                  {projects.map(prj => (
                    <option key={prj.projectId} value={prj.projectId}>Dự án: {prj.projectCode} - {prj.projectName}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-10 text-xs text-dark-400">Đang tải ma trận định mức...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-dark-800 text-dark-400 font-semibold">
                      <th className="pb-3 pr-2">Phạm Vi / Vùng Địa Lý</th>
                      <th className="pb-3 px-2">Chức Danh</th>
                      <th className="pb-3 px-2 text-right">Per-diem / Ngày</th>
                      <th className="pb-3 px-2 text-right">Khách Sạn / Đêm</th>
                      <th className="pb-3 px-2 text-center">Tiền Tệ</th>
                      <th className="pb-3 px-2 text-center">Vé Máy Bay</th>
                      <th className="pb-3 pl-2 text-center w-28">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-850">
                    {filteredPolicies.map(p => (
                      <tr key={p.policyId} className="hover:bg-dark-900-30 transition-colors">
                        <td className="py-3.5 pr-2">
                          <div className="space-y-0.5">
                            <p className="font-medium text-white">{getRegionName(p.regionCode)}</p>
                            {p.projectId ? (
                              <span className="text-[9px] bg-brand-500-10 border border-brand-500-20 text-brand-400 px-1.5 py-0.5 rounded font-mono">
                                Override Dự án #{p.projectId}
                              </span>
                            ) : (
                              <span className="text-[9px] bg-dark-800 text-dark-400 px-1.5 py-0.5 rounded font-mono">
                                Mặc định Hệ thống
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-dark-800 border border-dark-700 text-dark-300">
                            {p.roleCode}
                          </span>
                        </td>
                        <td className="py-3.5 px-2 text-right font-mono font-semibold">
                          {editingId === p.policyId ? (
                            <input
                              type="number"
                              value={editPerDiem}
                              onChange={e => setEditPerDiem(Number(e.target.value) || 0)}
                              className="w-24 bg-dark-950 border border-dark-700 text-xs px-2 py-1 rounded text-right text-emerald-400 focus:outline-none focus:border-brand-500 font-mono"
                            />
                          ) : (
                            <span className="text-emerald-400">{p.perDiemAllowance.toLocaleString()}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-2 text-right font-mono font-semibold">
                          {editingId === p.policyId ? (
                            <input
                              type="number"
                              value={editHotelLimit}
                              onChange={e => setEditHotelLimit(Number(e.target.value) || 0)}
                              className="w-24 bg-dark-950 border border-dark-700 text-xs px-2 py-1 rounded text-right text-brand-400 focus:outline-none focus:border-brand-500 font-mono"
                            />
                          ) : (
                            <span className="text-brand-400">{p.maxHotelRate.toLocaleString()}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-2 text-center font-mono font-bold text-dark-300">
                          {editingId === p.policyId ? (
                            <input
                              type="text"
                              value={editCurrency}
                              onChange={e => setEditCurrency(e.target.value.toUpperCase())}
                              className="w-14 bg-dark-950 border border-dark-700 text-xs px-1 py-1 rounded text-center text-white font-mono uppercase"
                            />
                          ) : (
                            <span className="px-1.5 py-0.5 rounded bg-dark-850 text-dark-300 text-[10px]">{p.currency || 'VND'}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-2 text-center font-mono font-bold text-dark-300">
                          {editingId === p.policyId ? (
                            <select
                              value={editFlightTicketClass}
                              onChange={e => setEditFlightTicketClass(e.target.value)}
                              className="w-24 bg-dark-950 border border-dark-700 text-xs px-1 py-1 rounded text-center text-white focus:outline-none"
                            >
                              <option value="ECONOMY">Phổ thông</option>
                              <option value="BUSINESS">Thương gia</option>
                              <option value="FIRST">Hạng nhất</option>
                            </select>
                          ) : (
                            <span style={{ backgroundColor: 'color-mix(in srgb, var(--color-brand-500) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--color-brand-500) 20%, transparent)' }} className="px-1.5 py-0.5 rounded text-brand-400 border text-[10px]">
                              {p.flightTicketClass || 'ECONOMY'}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 pl-2 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {editingId === p.policyId ? (
                              <button
                                onClick={() => handleSaveEdit(p)}
                                disabled={saving}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-1 rounded text-[10px] flex items-center gap-0.5 transition-colors disabled:opacity-50"
                              >
                                <Save size={10} /> {saving ? 'Lưu...' : 'Lưu'}
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStartEdit(p)}
                                className="text-brand-500 hover:text-brand-400 font-semibold flex items-center gap-0.5 transition-colors"
                              >
                                <Edit size={12} /> Sửa
                              </button>
                            )}
                            <button
                              onClick={() => handleDeletePolicy(p.policyId)}
                              className="text-dark-500 hover:text-rose-400 p-1 transition-colors"
                              title="Xóa quy định"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredPolicies.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-dark-500 text-xs italic">
                          Chưa có quy định nào được khai báo cho phạm vi đã chọn. Bấm nút "+ Khai Báo Định Mức Mới" để thêm.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Verification Rules Description (Right Column) */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-dark-800 space-y-4">
            <h3 className="text-xs font-bold text-dark-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-dark-850 pb-3">
              <ShieldAlert size={14} className="text-amber-500" /> Nguyên Lý Kế Thừa Định Mức
            </h3>

            <div className="space-y-4 text-xs text-dark-300 leading-relaxed">
              <div className="p-3 bg-brand-500-10 border border-brand-500-20 rounded-xl space-y-1">
                <p className="font-bold text-brand-400 flex items-center gap-1">🌐 Mặc Định Toàn Hệ Thống (Global Policy)</p>
                <p className="text-dark-400">
                  Áp dụng làm khung tiêu chuẩn chung cho toàn bộ công ty. Mọi dự án mới tạo tự động kế thừa bộ khung này.
                </p>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1">
                <p className="font-bold text-emerald-400 flex items-center gap-1">📌 Ghi Đè Theo Dự Án (Project Override)</p>
                <p className="text-dark-400">
                  Nếu một Dự án cụ thể có ngân sách khách hàng tài trợ riêng, PM/Admin có thể chủ động tạo quy định ghi đè cho riêng Dự án đó. Hệ thống sẽ ưu tiên áp dụng định mức Dự án trước.
                </p>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                <p className="font-bold text-amber-400 flex items-center gap-1">✈️ Công Tác Nước Ngoài (Overseas Travel)</p>
                <p className="text-dark-400">
                  Hỗ trợ quy đổi định mức bằng Ngoại tệ (<span className="font-mono text-emerald-400 font-bold">USD, EUR, SGD, JPY</span>) cho các vùng công tác Đông Nam Á, Âu/Mỹ/APAC.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* New Policy Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 bg-dark-950-80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-dark-800 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Plus className="text-brand-500" /> Khai Báo Định Mức Chi Phí Mới
              </h3>
              <button onClick={() => setShowPolicyModal(false)} className="text-xs text-dark-400 hover:text-white">Đóng</button>
            </div>

            <form onSubmit={handleCreatePolicySubmit} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Phạm Vi Áp Dụng:</label>
                <select
                  value={newProjectId || ''}
                  onChange={e => setNewProjectId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500 font-semibold"
                >
                  <option value="">🌐 Mặc Định Toàn Hệ Thống (Global Standard)</option>
                  {projects.map(p => (
                    <option key={p.projectId} value={p.projectId}>📌 Ghi đè Dự án: {p.projectCode} - {p.projectName}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Vùng Địa Lý / Quốc Gia:</label>
                  <select
                    value={newRegionCode}
                    onChange={e => setNewRegionCode(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500 font-semibold"
                  >
                    {regions.map(r => (
                      <option key={r.regionCode} value={r.regionCode}>{r.regionName}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Chức Danh Ap Dụng:</label>
                  <select
                    value={newRoleCode}
                    onChange={e => setNewRoleCode(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500 font-semibold"
                  >
                    <option value="MEMBER">MEMBER (Chuyên viên)</option>
                    <option value="LEADER">LEADER (Trưởng nhóm)</option>
                    <option value="PM">PM (Quản trị dự án)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Công Tác Phí / Ngày (Per-diem):</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newPerDiem}
                    onChange={e => setNewPerDiem(Number(e.target.value) || 0)}
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-emerald-400 font-mono font-bold focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Trần Khách Sạn / Đêm (Hotel Limit):</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newHotelLimit}
                    onChange={e => setNewHotelLimit(Number(e.target.value) || 0)}
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-brand-400 font-mono font-bold focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Trần Di Chuyển / Taxi Ngày:</label>
                  <input
                    type="number"
                    min="0"
                    value={newTransportLimit}
                    onChange={e => setNewTransportLimit(Number(e.target.value) || 0)}
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white font-mono focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Loại Tiền Tệ:</label>
                  <select
                    value={newCurrency}
                    onChange={e => setNewCurrency(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-brand-500"
                  >
                    <option value="VND">VND (Việt Nam Đồng)</option>
                    <option value="USD">USD (Đô la Mỹ)</option>
                    <option value="EUR">EUR (Euro)</option>
                    <option value="SGD">SGD (Đô la Singapore)</option>
                    <option value="JPY">JPY (Yên Nhật)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Hạng Vé Máy Bay:</label>
                  <select
                    value={newFlightTicketClass}
                    onChange={e => setNewFlightTicketClass(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-brand-500"
                  >
                    <option value="ECONOMY">Phổ thông (Economy)</option>
                    <option value="BUSINESS">Thương gia (Business)</option>
                    <option value="FIRST">Hạng nhất (First)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingPolicy}
                className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                {submittingPolicy ? 'Đang lưu...' : 'Xác Nhận Khai Báo Định Mức'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Region Modal */}
      {showRegionModal && (
        <div className="fixed inset-0 bg-dark-950-80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-dark-800 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Globe className="text-brand-500" /> Khai Báo Vùng Địa Lý / Quốc Gia Mới
              </h3>
              <button onClick={() => setShowRegionModal(false)} className="text-xs text-dark-400 hover:text-white">Đóng</button>
            </div>

            <form onSubmit={handleCreateRegionSubmit} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Mã Vùng Địa Lý (Mã Code):</label>
                <input
                  type="text"
                  required
                  placeholder="VD: TIERS_4, TIERS_USA..."
                  value={regionCodeInput}
                  onChange={e => setRegionCodeInput(e.target.value.toUpperCase())}
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white font-mono uppercase focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Tên Hiển Thị Vùng:</label>
                <input
                  type="text"
                  required
                  placeholder="VD: Vùng 4 (Đông Nam Á - Singapore, Thái Lan)..."
                  value={regionNameInput}
                  onChange={e => setRegionNameInput(e.target.value)}
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Danh Sách Tỉnh Thành / Quốc Gia (Phân cách bởi dấu phẩy):</label>
                <textarea
                  rows={3}
                  required
                  placeholder="VD: Singapore, Thailand, Malaysia, Indonesia..."
                  value={provincesInput}
                  onChange={e => setProvincesInput(e.target.value)}
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submittingRegion}
                className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                {submittingRegion ? 'Đang lưu...' : 'Xác Nhận Lưu Vùng Địa Lý'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Clone Policy Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-dark-950-80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm glass-panel p-6 rounded-2xl border border-dark-800 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-1.5">
                <Percent className="text-brand-500" /> Nhân Bản & Điều Chỉnh Tỷ Lệ
              </h3>
              <button onClick={() => setShowCloneModal(false)} className="text-xs text-dark-400 hover:text-white">Đóng</button>
            </div>

            <form onSubmit={handleCloneSubmit} className="space-y-4 text-left">
              <p className="text-xs text-dark-400">
                Nhân bản toàn bộ các dòng chính sách hiện tại sang chu kỳ mới và áp dụng hệ số điều chỉnh tăng/giảm theo tỷ lệ phần trăm lạm phát.
              </p>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Tỷ lệ điều chỉnh tăng (%):</label>
                <input
                  type="number"
                  step="0.1"
                  min="-20"
                  max="50"
                  required
                  value={inflationRate}
                  onChange={e => setInflationRate(parseFloat(e.target.value) || 0)}
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500 font-mono"
                />
              </div>

              <button
                type="submit"
                disabled={cloning}
                className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                {cloning ? 'Đang nhân bản...' : 'Bắt Đầu Nhân Bản'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
