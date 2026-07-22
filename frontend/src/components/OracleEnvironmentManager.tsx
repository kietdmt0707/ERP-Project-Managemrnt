import React, { useState, useEffect } from 'react';
import { oracleInstanceService, OracleInstanceDto } from '../services/api';
import { Server, Plus, Edit, Trash2, CheckCircle2, Clock, AlertTriangle, RefreshCw } from 'lucide-react';

interface OracleEnvironmentManagerProps {
  projectId: number;
  userRole: string;
}

export const OracleEnvironmentManager: React.FC<OracleEnvironmentManagerProps> = ({ projectId, userRole }) => {
  const [instances, setInstances] = useState<OracleInstanceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingInstance, setEditingInstance] = useState<OracleInstanceDto | null>(null);

  // Form states
  const [instanceName, setInstanceName] = useState('');
  const [oracleVersion, setOracleVersion] = useState('Fusion Cloud 24C');
  const [instanceStatus, setInstanceStatus] = useState('ACTIVE');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canManage = userRole === 'PM' || userRole === 'DIRECTOR' || userRole === 'PC';

  useEffect(() => {
    loadInstances();
  }, [projectId]);

  const loadInstances = async () => {
    try {
      setLoading(true);
      const data = await oracleInstanceService.getInstances(projectId);
      setInstances(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingInstance(null);
    setInstanceName('');
    setOracleVersion('Fusion Cloud 24C');
    setInstanceStatus('ACTIVE');
    setDescription('');
    setShowModal(true);
  };

  const handleOpenEditModal = (inst: OracleInstanceDto) => {
    setEditingInstance(inst);
    setInstanceName(inst.instanceName);
    setOracleVersion(inst.oracleVersion);
    setInstanceStatus(inst.instanceStatus);
    setDescription(inst.description || '');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (editingInstance && editingInstance.instanceId) {
        await oracleInstanceService.updateInstance(editingInstance.instanceId, {
          instanceName,
          oracleVersion,
          instanceStatus,
          description
        });
      } else {
        await oracleInstanceService.createInstance({
          projectId,
          instanceName,
          oracleVersion,
          instanceStatus,
          description
        });
      }
      setShowModal(false);
      loadInstances();
    } catch (err: any) {
      alert(err.message || 'Lỗi thao tác môi trường.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khai báo môi trường này không?')) return;
    try {
      await oracleInstanceService.deleteInstance(id);
      loadInstances();
    } catch (err: any) {
      alert(err.message || 'Xóa môi trường thất bại.');
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === 'ACTIVE') {
      return (
        <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold flex items-center gap-1 w-fit">
          <CheckCircle2 size={10} /> HOẠT ĐỘNG (ACTIVE)
        </span>
      );
    }
    if (status === 'REFRESHING') {
      return (
        <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-bold flex items-center gap-1 w-fit">
          <RefreshCw size={10} className="animate-spin" /> ĐANG REFRESH / BẢO TRÌ
        </span>
      );
    }
    return (
      <span className="text-[10px] bg-dark-800 border border-dark-700 text-dark-400 px-2 py-0.5 rounded font-bold flex items-center gap-1 w-fit">
        <Clock size={10} /> CHƯA KHỞI TẠO
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-dark-900/40 p-4 rounded-xl border border-dark-800 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Server className="text-brand-500" /> Quản Lý Phiên Bản & Môi Trường (Oracle Instances)
          </h2>
          <p className="text-xs text-dark-400 mt-1">Theo dõi các môi trường phát triển, kiểm thử tích hợp (CRP/SIT) và UAT</p>
        </div>
        {canManage && (
          <button
            onClick={handleOpenCreateModal}
            className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-lg shadow-brand-600/10"
          >
            <Plus size={14} /> Khai Báo Môi Trường Mới
          </button>
        )}
      </div>

      {/* Instances Grid */}
      {loading ? (
        <div className="text-center py-10 text-xs text-dark-400">Đang tải danh sách môi trường Oracle...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {instances.map(inst => (
            <div
              key={inst.instanceId}
              className={`p-5 rounded-xl border space-y-3 transition-all ${
                inst.instanceStatus === 'ACTIVE'
                  ? 'bg-dark-900/60 border-dark-800 hover:border-dark-750'
                  : 'bg-dark-900/40 border-dark-800/80 border-dashed opacity-75'
              }`}
            >
              <div className="flex justify-between items-start">
                {getStatusBadge(inst.instanceStatus)}

                {canManage && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(inst)}
                      className="p-1 rounded text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
                      title="Chỉnh sửa"
                    >
                      <Edit size={13} />
                    </button>
                    {inst.instanceId && (
                      <button
                        onClick={() => handleDelete(inst.instanceId!)}
                        className="p-1 rounded text-dark-400 hover:text-rose-400 hover:bg-dark-800 transition-colors"
                        title="Xóa"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-md font-bold text-white">{inst.instanceName}</h3>
                <p className="text-xs text-dark-400 mt-0.5">Phiên bản: <span className="text-dark-300 font-mono">{inst.oracleVersion}</span></p>
              </div>

              <p className="text-xs text-dark-400 leading-relaxed min-h-[36px]">
                {inst.description || 'Chưa có mô tả chi tiết cho môi trường này.'}
              </p>

              <div className="pt-2 border-t border-dark-850 flex justify-between items-center text-[10px] text-dark-500">
                <span>Cập nhật: {inst.updatedDate ? new Date(inst.updatedDate).toLocaleDateString('vi-VN') : 'Mới tạo'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-dark-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md glass-panel p-6 rounded-2xl border border-dark-800 shadow-2xl space-y-4 animate-slide-up">
            <div className="flex justify-between items-center border-b border-dark-850 pb-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Server className="text-brand-500" />
                {editingInstance ? 'Hiệu Chỉnh Môi Trường Oracle' : 'Khai Báo Môi Trường Oracle Mới'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-xs text-dark-400 hover:text-white">Đóng</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Tên Môi Trường (Instance Name):</label>
                <input
                  type="text"
                  required
                  value={instanceName}
                  onChange={e => setInstanceName(e.target.value)}
                  placeholder="VD: Môi trường DEV2, UAT2..."
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Phiên Bản Oracle:</label>
                  <input
                    type="text"
                    required
                    value={oracleVersion}
                    onChange={e => setOracleVersion(e.target.value)}
                    placeholder="VD: Fusion Cloud 24C, EBS 12.2"
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-dark-300 font-semibold">Trạng Thái Môi Trường:</label>
                  <select
                    value={instanceStatus}
                    onChange={e => setInstanceStatus(e.target.value)}
                    className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="ACTIVE">HOẠT ĐỘNG (Active)</option>
                    <option value="NOT_INITIALIZED">CHƯA KHỞI TẠO</option>
                    <option value="REFRESHING">ĐANG REFRESH / BẢO TRÌ</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Mô Tả Chức Năng Môi Trường:</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Mô tả mục đích sử dụng môi trường (VD: Phục vụ đợt UAT đợt 2 của khối Tài chính)..."
                  className="w-full bg-dark-950 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-brand-600 hover:bg-brand-500 text-white p-3 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                {submitting ? 'Đang lưu...' : (editingInstance ? 'Lưu Cập Nhật' : 'Xác Nhận Khai Báo Môi Trường')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
