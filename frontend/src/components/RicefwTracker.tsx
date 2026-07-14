import React, { useState, useEffect } from 'react';
import { ricefwService, RicefwObject } from '../services/api';
import { FileText, Folder, Plus, ExternalLink } from 'lucide-react';

interface RicefwTrackerProps {
  projectId: number;
  userRole: string;
}

export const RicefwTracker: React.FC<RicefwTrackerProps> = ({ projectId, userRole }) => {
  const [ricefws, setRicefws] = useState<RicefwObject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Create / Edit modal states
  const [showModal, setShowModal] = useState<boolean>(false);
  const [code, setCode] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [module, setModule] = useState<string>('AP');
  const [type, setType] = useState<string>('REPORT');
  const [complexity, setComplexity] = useState<string>('LOW');

  useEffect(() => {
    loadRicefws();
  }, [projectId]);

  const loadRicefws = async () => {
    try {
      setLoading(true);
      const data = await ricefwService.getProjectRicefws(projectId);
      setRicefws(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Lỗi tải danh mục RICEFW.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterRicefw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) return;

    try {
      await ricefwService.saveRicefw({
        projectId,
        ricefwCode: code,
        ricefwName: name,
        moduleCode: module,
        objectType: type,
        complexity,
        functionalSpecStatus: 'PENDING',
        technicalSpecStatus: 'PENDING',
        codingStatus: 'NOT_STARTED',
        unitTestingStatus: 'NOT_STARTED',
        sitStatus: 'NOT_STARTED',
        uatStatus: 'NOT_STARTED'
      });
      setShowModal(false);
      setCode('');
      setName('');
      loadRicefws();
    } catch (err: any) {
      alert(err.message || 'Lỗi đăng ký đối tượng RICEFW.');
    }
  };

  const updateSpecStatus = async (item: RicefwObject, field: string, newStatus: string) => {
    try {
      await ricefwService.saveRicefw({
        ...item,
        [field]: newStatus
      });
      loadRicefws();
    } catch (err: any) {
      alert(err.message || 'Lỗi cập nhật trạng thái.');
    }
  };

  // Render standard deliverable status badges
  const renderDeliverableStatus = (status: string, item: RicefwObject, field: string, editable: boolean) => {
    const baseStyle = "text-xs px-2 py-0.5 rounded font-semibold border transition-all cursor-pointer";
    let style = "";
    
    switch (status) {
      case 'APPROVED':
      case 'COMPLETED':
        style = `${baseStyle} bg-emerald-500/10 text-emerald-400 border-emerald-500/20`;
        break;
      case 'IN_PROGRESS':
        style = `${baseStyle} bg-blue-500/10 text-blue-400 border-blue-500/20`;
        break;
      case 'PENDING':
      case 'NOT_STARTED':
      default:
        style = `${baseStyle} bg-dark-800 text-dark-400 border-dark-700`;
        break;
    }

    if (!editable) {
      return <span className={style.replace('cursor-pointer', '')}>{status}</span>;
    }

    // Toggle logic for simple demo click (PENDING -> IN_PROGRESS -> APPROVED -> PENDING)
    const handleToggle = () => {
      const nextMap: Record<string, string> = {
        'PENDING': 'IN_PROGRESS',
        'NOT_STARTED': 'IN_PROGRESS',
        'IN_PROGRESS': 'APPROVED',
        'APPROVED': 'PENDING'
      };
      const next = nextMap[status] || 'PENDING';
      updateSpecStatus(item, field, next);
    };

    return (
      <button onClick={handleToggle} className={style} title="Click để chuyển nhanh trạng thái">
        {status}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header panel */}
      <div className="flex justify-between items-center bg-dark-900/40 p-4 rounded-xl border border-dark-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="text-brand-500" /> RICEFW Registry & Progress Tracker
          </h2>
          <p className="text-xs text-dark-400 mt-1">Đăng ký và giám sát 5 đợt bàn giao đặc thù thiết kế, code, SIT & UAT của Oracle ERP</p>
        </div>
        
        {(userRole === 'PM' || userRole === 'LEADER' || userRole === 'SYSTEM_ADMIN' || userRole === 'PC') && (
          <button 
            onClick={() => setShowModal(true)}
            className="bg-brand-600 hover:bg-brand-500 text-white text-xs px-3 py-2 rounded-lg font-semibold flex items-center gap-1 transition-all"
          >
            <Plus size={14} /> Đăng Ký RICEFW Mới
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
          <p className="text-xs text-dark-400 mt-2">Đang tải danh mục RICEFW...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-4 rounded-lg">
          Lỗi: {error}
        </div>
      ) : (
        <div className="overflow-x-auto bg-dark-900/20 rounded-xl border border-dark-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-dark-900/60 border-b border-dark-800 text-dark-400 uppercase font-bold">
                <th className="py-3 px-4">Mã RICEFW</th>
                <th className="py-3 px-4">Tên Đối Tượng</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Phân loại</th>
                <th className="py-3 px-4">Độ khó</th>
                <th className="py-3 px-4">Thiết kế (MD050)</th>
                <th className="py-3 px-4">Kỹ thuật (MD070)</th>
                <th className="py-3 px-4">Coding</th>
                <th className="py-3 px-4">SIT</th>
                <th className="py-3 px-4">UAT</th>
                <th className="py-3 px-4">Thư mục</th>
              </tr>
            </thead>
            <tbody>
              {ricefws.length > 0 ? (
                ricefws.map(item => (
                  <tr key={item.ricefwId} className="border-b border-dark-800 hover:bg-dark-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-brand-400">{item.ricefwCode}</td>
                    <td className="py-3 px-4 font-medium text-dark-100">{item.ricefwName}</td>
                    <td className="py-3 px-4 font-semibold text-dark-300">{item.moduleCode}</td>
                    <td className="py-3 px-4 text-dark-400">{item.objectType}</td>
                    <td className="py-3 px-4">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        item.complexity === 'HIGH' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        item.complexity === 'MEDIUM' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {item.complexity}
                      </span>
                    </td>
                    
                    {/* Status updates triggerable by Leader/PM */}
                    <td className="py-3 px-4">{renderDeliverableStatus(item.functionalSpecStatus, item, 'functionalSpecStatus', userRole !== 'MEMBER')}</td>
                    <td className="py-3 px-4">{renderDeliverableStatus(item.technicalSpecStatus, item, 'technicalSpecStatus', userRole !== 'MEMBER')}</td>
                    <td className="py-3 px-4">{renderDeliverableStatus(item.codingStatus, item, 'codingStatus', userRole !== 'MEMBER')}</td>
                    <td className="py-3 px-4">{renderDeliverableStatus(item.sitStatus, item, 'sitStatus', userRole !== 'MEMBER')}</td>
                    <td className="py-3 px-4">{renderDeliverableStatus(item.uatStatus, item, 'uatStatus', userRole !== 'MEMBER')}</td>
                    
                    <td className="py-3 px-4">
                      {item.sharepointFolderLink ? (
                        <a 
                          href={item.sharepointFolderLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-brand-400 hover:text-brand-300 flex items-center gap-0.5 hover:underline font-semibold"
                        >
                          <Folder size={14} /> SharePoint <ExternalLink size={10} />
                        </a>
                      ) : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="text-center py-8 text-dark-500">
                    Chưa đăng ký đối tượng RICEFW nào cho dự án này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Register RICEFW Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <form onSubmit={handleRegisterRicefw} className="bg-dark-900 border border-dark-800 max-w-md w-full p-6 rounded-2xl shadow-2xl space-y-4 animate-slide-up">
            <h3 className="text-md font-bold text-white border-b border-dark-800 pb-2">
              Đăng Ký Đối Tượng RICEFW Mới
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Mã RICEFW:</label>
                <input 
                  type="text" 
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Ví dụ: I-AP-EINV-01" 
                  className="w-full bg-dark-800 border border-dark-700 text-xs p-2 rounded-lg text-dark-100 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Phân hệ (Module):</label>
                <select 
                  value={module}
                  onChange={(e) => setModule(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-700 text-xs p-2 rounded-lg text-dark-100 focus:outline-none focus:border-brand-500"
                >
                  <option value="GL">General Ledger (GL)</option>
                  <option value="AP">Accounts Payable (AP)</option>
                  <option value="AR">Accounts Receivable (AR)</option>
                  <option value="PO">Purchasing (PO)</option>
                  <option value="INV">Inventory (INV)</option>
                  <option value="OM">Order Management (OM)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-dark-300 font-semibold">Tên Đối tượng phát triển:</label>
              <input 
                type="text" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tích hợp Hóa đơn điện tử với Oracle" 
                className="w-full bg-dark-800 border border-dark-700 text-xs p-2 rounded-lg text-dark-100 focus:outline-none focus:border-brand-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Loại RICEFW:</label>
                <select 
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-700 text-xs p-2 rounded-lg text-dark-100 focus:outline-none focus:border-brand-500"
                >
                  <option value="REPORT">Report (Báo cáo)</option>
                  <option value="INTERFACE">Interface (Tích hợp)</option>
                  <option value="CONVERSION">Conversion (Chuyển đổi dữ liệu)</option>
                  <option value="EXTENSION">Extension (Tiện ích mở rộng)</option>
                  <option value="FORM">Form (Biểu mẫu)</option>
                  <option value="WORKFLOW">Workflow (Quy trình duyệt)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs text-dark-300 font-semibold">Độ phức tạp:</label>
                <select 
                  value={complexity}
                  onChange={(e) => setComplexity(e.target.value)}
                  className="w-full bg-dark-800 border border-dark-700 text-xs p-2 rounded-lg text-dark-100 focus:outline-none focus:border-brand-500"
                >
                  <option value="LOW">Thấp (Low)</option>
                  <option value="MEDIUM">Trung bình (Medium)</option>
                  <option value="HIGH">Cao (High)</option>
                </select>
              </div>
            </div>

            <div className="bg-brand-500/5 border border-brand-500/10 p-3 rounded-lg text-[10px] text-brand-400">
              💡 <strong>Lưu ý:</strong> Khi đăng ký thành công, hệ thống sẽ tự động gửi yêu cầu Graph API đến M365 để tạo thư mục lưu trữ tài liệu riêng trên SharePoint của ARON.
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-4 border-t border-dark-800">
              <button 
                type="button" 
                onClick={() => setShowModal(false)}
                className="bg-dark-800 hover:bg-dark-700 text-xs px-4 py-2 rounded-lg font-semibold"
              >
                Đóng
              </button>
              <button 
                type="submit" 
                className="bg-brand-600 hover:bg-brand-500 text-white text-xs px-4 py-2 rounded-lg font-semibold"
              >
                Khai Báo & Đồng Bộ SP
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
