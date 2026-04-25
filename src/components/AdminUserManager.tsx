import React, { useState, useEffect } from 'react';
import { dbService } from '../services/db';
import { watchAdmins } from '../services/firebase';
import { Plus, Trash2, Shield, User, Loader2, Mail, Download, Upload, Database } from 'lucide-react';
import { showAlert } from '../services/alertService';

interface AdminUserManagerProps {
  onBackup: () => void;
  onRestore: () => void;
}

export const AdminUserManager: React.FC<AdminUserManagerProps> = ({ onBackup, onRestore }) => {
  const [admins, setAdmins] = useState<{ email: string, addedAt: any }[]>([]);
  const [dynamicEmails, setDynamicEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const unsubscribe = watchAdmins((emails) => {
      setDynamicEmails(emails);
      loadAdmins();
    });
    return unsubscribe;
  }, []);

  const loadAdmins = async () => {
    try {
      const data = await dbService.getAllAdmins();
      setAdmins(data);
    } catch (error) {
      console.error('Failed to load admins:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newEmail.includes('@')) {
      showAlert('Email tidak valid');
      return;
    }

    setLoading(true);
    try {
      await dbService.addAdmin(newEmail);
      setNewEmail('');
      showAlert('Admin berhasil ditambahkan', 'success');
    } catch (error) {
      console.error(error);
      showAlert('Gagal menambahkan admin');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAdmin = async (email: string) => {
    if (!window.confirm(`Hapus akses admin untuk ${email}?`)) return;

    setLoading(true);
    try {
      await dbService.removeAdmin(email);
      showAlert('Akses admin dihapus', 'success');
    } catch (error: any) {
      if (error.message === 'CANNOT_REMOVE_SUPER_ADMIN') {
        showAlert('Tidak dapat menghapus Super Admin utama');
      } else {
        showAlert('Gagal menghapus admin');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <Shield className="text-indigo-600" />
          Manajemen Admin
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          Email yang terdaftar di bawah ini akan memiliki akses penuh (Role Admin) untuk mengelola petugas, jadwal, dan pengaturan aplikasi.
        </p>

        <form onSubmit={handleAddAdmin} className="flex gap-2">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="email"
              placeholder="Masukkan email Google..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !newEmail}
            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 active:scale-95 transition disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
            Tambah
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Daftar Admin Aktif</h3>
          <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full">
            {dynamicEmails.length} Total
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          {fetching ? (
            <div className="p-10 text-center text-gray-400">
              <Loader2 className="animate-spin mx-auto mb-2" />
              Memuat data...
            </div>
          ) : dynamicEmails.length === 0 ? (
            <div className="p-10 text-center text-gray-400 italic">
              Belum ada admin terdaftar.
            </div>
          ) : (
            dynamicEmails.map((email) => (
              <div key={email} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                    <User size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 leading-none mb-1">{email}</p>
                    <div className="flex gap-2">
                       {/* Badge untuk Super Admin (hardcoded) */}
                       {['albertse2602@gmail.com', 'chayania.farista@gmail.com'].includes(email) ? (
                         <span className="text-[10px] font-black uppercase tracking-tighter bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Super Admin</span>
                       ) : (
                         <span className="text-[10px] font-black uppercase tracking-tighter bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Admin</span>
                       )}
                    </div>
                  </div>
                </div>
                
                {!['albertse2602@gmail.com', 'chayania.farista@gmail.com'].includes(email) && (
                  <button
                    onClick={() => handleRemoveAdmin(email)}
                    disabled={loading}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                    title="Hapus Akses"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Backup & Restore Section */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2">
          <Database className="text-indigo-600" />
          Data & Keamanan
        </h2>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          Gunakan fitur ini untuk mencadangkan data ke perangkat lokal atau memulihkan data dari file cadangan sebelumnya. 
          <span className="font-bold text-red-600 block mt-1">Peringatan: Proses Restore akan menghapus semua data yang ada saat ini!</span>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={onBackup}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-indigo-50 text-indigo-700 rounded-2xl font-bold hover:bg-indigo-100 transition-all border border-indigo-100 active:scale-[0.98]"
          >
            <Download size={20} />
            <div className="text-left">
              <span className="block leading-none mb-1">Backup Data</span>
              <span className="text-[10px] font-medium opacity-70 uppercase tracking-widest">Simpan ke JSON</span>
            </div>
          </button>

          <button
            onClick={onRestore}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold hover:bg-emerald-100 transition-all border border-emerald-100 active:scale-[0.98]"
          >
            <Upload size={20} />
            <div className="text-left">
              <span className="block leading-none mb-1">Restore Data</span>
              <span className="text-[10px] font-medium opacity-70 uppercase tracking-widest">Unggah dari JSON</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
