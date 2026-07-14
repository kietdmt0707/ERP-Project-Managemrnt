import React, { useState, useEffect } from 'react';
import { settingService, SystemSetting } from '../services/api';
import { Sliders, Save, Server, Image, Info } from 'lucide-react';

interface SettingsPanelProps {
  onSettingsUpdate?: (settings: SystemSetting) => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ onSettingsUpdate }) => {
  const [settings, setSettings] = useState<SystemSetting>({
    appName: 'ARON Project Management',
    logoUrl: 'https://raw.githubusercontent.com/vitejs/vite/main/packages/vite/src/node/logo.png',
    bannerUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=1600',
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpUsername: '',
    smtpPassword: '',
    smtpEnableSsl: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await settingService.getSettings();
      setSettings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, targetKey: 'logoUrl' | 'bannerUrl') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setSettings(prev => ({
        ...prev,
        [targetKey]: base64String
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const updated = await settingService.updateSettings(settings);
      setSettings(updated);
      setMessage({ type: 'success', text: 'Đã lưu thiết lập hệ thống thành công!' });
      if (onSettingsUpdate) {
        onSettingsUpdate(updated);
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Lưu thiết lập thất bại.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10 text-xs text-dark-400">Đang tải thiết lập...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="bg-dark-900/40 p-4 rounded-xl border border-dark-800 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sliders className="text-brand-500" /> Thiết Lập Hệ Thống (System Settings)
          </h2>
          <p className="text-xs text-dark-400 mt-1">Cấu hình hiển thị Logo, Banner thương hiệu và Mailer phê duyệt tự động</p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl text-xs border ${
          message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Theme & Branding */}
        <div className="glass-panel p-6 rounded-2xl border border-dark-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-dark-800 pb-2">
            <Image size={16} className="text-brand-400" /> Giao Diện & Thương Hiệu
          </h3>

          <div className="space-y-1">
            <label className="text-xs text-dark-300 font-semibold">Tên Ứng Dụng (App Name):</label>
            <input 
              type="text"
              value={settings.appName}
              onChange={e => setSettings({ ...settings, appName: e.target.value })}
              className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white placeholder-dark-600 focus:outline-none focus:border-brand-500"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-dark-300 font-semibold block">Logo ứng dụng (Tải từ máy tính):</label>
            <input 
              type="file"
              accept="image/*"
              onChange={e => handleImageUpload(e, 'logoUrl')}
              className="text-xs text-dark-400 file:bg-dark-800 file:border-0 file:text-white file:font-semibold file:px-3 file:py-1.5 file:rounded-lg file:mr-3 file:cursor-pointer"
            />
            {settings.logoUrl && (
              <div className="mt-2 p-2 bg-dark-950 rounded-lg flex justify-center border border-dark-800 relative group">
                <img src={settings.logoUrl} alt="Preview Logo" className="max-h-12 object-contain" />
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, logoUrl: '' })}
                  className="absolute top-1 right-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Xóa
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs text-dark-300 font-semibold block">Banner nền (Tải từ máy tính):</label>
            <input 
              type="file"
              accept="image/*"
              onChange={e => handleImageUpload(e, 'bannerUrl')}
              className="text-xs text-dark-400 file:bg-dark-800 file:border-0 file:text-white file:font-semibold file:px-3 file:py-1.5 file:rounded-lg file:mr-3 file:cursor-pointer"
            />
            {settings.bannerUrl && (
              <div className="mt-2 rounded-lg overflow-hidden border border-dark-800 relative group">
                <img src={settings.bannerUrl} alt="Preview Banner" className="h-20 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setSettings({ ...settings, bannerUrl: '' })}
                  className="absolute top-1 right-1 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  Xóa
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mailer (SMTP Settings) */}
        <div className="glass-panel p-6 rounded-2xl border border-dark-800 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-dark-800 pb-2">
            <Server size={16} className="text-brand-400" /> Cấu Hình Mailer (SMTP Server)
          </h3>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1">
              <label className="text-xs text-dark-300 font-semibold">SMTP Host:</label>
              <input 
                type="text"
                value={settings.smtpHost || ''}
                onChange={e => setSettings({ ...settings, smtpHost: e.target.value })}
                placeholder="smtp.gmail.com"
                className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white placeholder-dark-600 focus:outline-none focus:border-brand-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-dark-300 font-semibold">Port:</label>
              <input 
                type="number"
                value={settings.smtpPort}
                onChange={e => setSettings({ ...settings, smtpPort: parseInt(e.target.value) || 587 })}
                className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-dark-300 font-semibold">Tài khoản SMTP (Email):</label>
            <input 
              type="email"
              value={settings.smtpUsername || ''}
              onChange={e => setSettings({ ...settings, smtpUsername: e.target.value })}
              placeholder="example@gmail.com"
              className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white placeholder-dark-600 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-dark-300 font-semibold">Mật khẩu ứng dụng (App Password):</label>
            <input 
              type="password"
              value={settings.smtpPassword || ''}
              onChange={e => setSettings({ ...settings, smtpPassword: e.target.value })}
              placeholder="••••••••••••••••"
              className="w-full bg-dark-900 border border-dark-800 text-xs p-3 rounded-xl text-white placeholder-dark-600 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input 
              type="checkbox"
              id="smtpEnableSsl"
              checked={settings.smtpEnableSsl}
              onChange={e => setSettings({ ...settings, smtpEnableSsl: e.target.checked })}
              className="rounded bg-dark-900 border-dark-800 text-brand-500 focus:ring-brand-500"
            />
            <label htmlFor="smtpEnableSsl" className="text-xs text-dark-300 font-medium">Bật mã hóa bảo mật SSL/TLS</label>
          </div>

          <div className="bg-dark-950 p-3 rounded-xl border border-dark-850 flex gap-2 items-start text-[10px] text-dark-400">
            <Info size={14} className="shrink-0 text-brand-400 mt-0.5" />
            <p>Mailer dùng để gửi email kèm link bảo mật phê duyệt nhanh trực tiếp cho Leader, PM và Director khi thành viên khai báo công việc hoặc công tác phí.</p>
          </div>
        </div>

        {/* Submit */}
        <div className="lg:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs py-3 px-6 rounded-xl flex items-center gap-2 shadow-lg shadow-brand-600/10 transition-all disabled:opacity-50"
          >
            <Save size={14} /> {saving ? 'Đang lưu...' : 'Lưu Cấu Hình Hệ Thống'}
          </button>
        </div>
      </form>
    </div>
  );
};
