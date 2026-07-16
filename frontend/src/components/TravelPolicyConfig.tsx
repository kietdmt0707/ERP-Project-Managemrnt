import React, { useState, useEffect } from 'react';
import { travelPolicyService, TravelExpensePolicy } from '../services/api';
import { Clipboard, ShieldAlert, Edit, Save, Copy, Percent, Sparkles, HelpCircle } from 'lucide-react';

export const TravelPolicyConfig: React.FC = () => {
  const [policies, setPolicies] = useState<TravelExpensePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Edit fields state
  const [editPerDiem, setEditPerDiem] = useState(0);
  const [editHotelLimit, setEditHotelLimit] = useState(0);
  const [saving, setSaving] = useState(false);

  // Clone Policy state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [inflationRate, setInflationRate] = useState(5.0);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    loadPolicies();
  }, []);

  const loadPolicies = async () => {
    try {
      setLoading(true);
      const data = await travelPolicyService.getPolicies();
      setPolicies(data);
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
  };

  const handleSaveEdit = async (policyId: number) => {
    try {
      setSaving(true);
      await travelPolicyService.updatePolicy(policyId, {
        perDiemAllowance: editPerDiem,
        maxHotelRate: editHotelLimit
      });
      setEditingId(null);
      loadPolicies();
    } catch (err) {
      alert("Cập nhật quy định thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handleCloneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCloning(true);
      const res = await travelPolicyService.clonePolicies(inflationRate);
      alert(res.message || "Nhân bản quy định định mức thành công!");
      setShowCloneModal(false);
      loadPolicies();
    } catch (err: any) {
      alert(err.message || "Không thể nhân bản quy định.");
    } finally {
      setCloning(false);
    }
  };

  const getRegionLabel = (code: string) => {
    if (code === 'TIERS_1') return 'Vùng 1 (Hà Nội, HCM)';
    if (code === 'TIERS_2') return 'Vùng 2 (Đà Nẵng, Cần Thơ, Hải Phòng)';
    return 'Vùng 3 (Tỉnh thành còn lại)';
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-dark-900/40 p-4 rounded-xl border border-dark-800 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clipboard className="text-brand-500" /> Cấu Hình Định Mức Công Tác Phí & Khách Sạn
          </h2>
          <p className="text-xs text-dark-400 mt-1">
            Thiết lập hạn mức thanh toán công tác phí (khoán ngày) và khách sạn (trần tối đa) theo Phân vùng địa lý và Chức danh
          </p>
        </div>
        <button
          onClick={() => setShowCloneModal(true)}
          className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-brand-600/10"
        >
          <Copy size={13} /> Nhân Bản Chính Sách
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Policy Grid Matrix (Left Columns) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel p-5 rounded-2xl border border-dark-800 space-y-4">
            <h3 className="text-xs font-bold text-dark-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-dark-850 pb-3">
              <Sparkles size={14} className="text-brand-500" /> Ma Trận Định Mức Hiện Tại (Policy Matrix)
            </h3>

            {loading ? (
              <div className="text-center py-10 text-xs text-dark-400">Đang tải ma trận định mức...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-dark-800 text-dark-400 font-semibold">
                      <th className="pb-3 pr-2">Vùng Địa Lý</th>
                      <th className="pb-3 px-2">Chức Danh</th>
                      <th className="pb-3 px-2 text-right">Per-diem / Ngày (Khoán)</th>
                      <th className="pb-3 px-2 text-right">Khách Sạn / Đêm (Ceiling)</th>
                      <th className="pb-3 pl-2 text-center w-24">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-850">
                    {policies.map(p => (
                      <tr key={p.policyId} className="hover:bg-dark-900/30 transition-colors">
                        <td className="py-3.5 pr-2 font-medium text-white">{getRegionLabel(p.regionCode)}</td>
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
                            <span className="text-emerald-400">{p.perDiemAllowance.toLocaleString()} VND</span>
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
                            <span className="text-brand-400">{p.maxHotelRate.toLocaleString()} VND</span>
                          )}
                        </td>
                        <td className="py-3.5 pl-2 text-center">
                          {editingId === p.policyId ? (
                            <button
                              onClick={() => handleSaveEdit(p.policyId)}
                              disabled={saving}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-1 rounded text-[10px] flex items-center gap-0.5 mx-auto transition-colors disabled:opacity-50"
                            >
                              <Save size={10} /> {saving ? 'Lưu...' : 'Lưu'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(p)}
                              className="text-brand-500 hover:text-brand-400 font-semibold flex items-center gap-0.5 mx-auto transition-colors"
                            >
                              <Edit size={12} /> Sửa
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
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
              <ShieldAlert size={14} className="text-amber-500" /> Cơ Chế Cảnh Báo Hạn Mức (Tolerances)
            </h3>

            <div className="space-y-4 text-xs text-dark-300 leading-relaxed">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
                <p className="font-bold text-amber-400 flex items-center gap-1">⚠️ Cảnh báo Mềm (Soft Warning)</p>
                <p className="text-dark-400">Kích hoạt khi chi phí thực tế vượt định mức tối đa tối đa 50%:</p>
                <ul className="list-disc list-inside pl-2 text-dark-500 space-y-0.5">
                  <li>Hiện cảnh báo màu cam Redwood.</li>
                  <li>Bắt buộc nhập <strong>Lý do vượt trần</strong>.</li>
                  <li>Cho phép lưu sau khi giải trình.</li>
                </ul>
              </div>

              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl space-y-1">
                <p className="font-bold text-rose-400 flex items-center gap-1">🚫 Chặn Cứng (Hard Ceiling)</p>
                <p className="text-dark-400">Kích hoạt khi chi phí thực tế vượt định mức quá 50%:</p>
                <ul className="list-disc list-inside pl-2 text-dark-500 space-y-0.5">
                  <li>Hệ thống chặn đứng nút lưu.</li>
                  <li>Hiển thị cảnh báo lỗi màu đỏ.</li>
                  <li>Bắt buộc sửa lại số tiền mới cho lưu.</li>
                </ul>
              </div>

              <div className="p-3.5 bg-dark-950 border border-dark-850 rounded-xl flex gap-2">
                <HelpCircle size={16} className="text-brand-500 shrink-0 mt-0.5" />
                <p className="text-dark-400">
                  Địa lý của dự án sẽ tự động ánh xạ thông qua địa chỉ/tỉnh thành của dự án onsite (Destination) để áp dụng ma trận định mức vùng tương ứng.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Clone Policy Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
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
