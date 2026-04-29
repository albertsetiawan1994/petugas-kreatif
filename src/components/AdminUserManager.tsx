import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/db';
import { User, Loader2, Download, Upload, Database } from 'lucide-react';
import { showAlert } from '../services/alertService';
import { AppPageKey, ROLE_PAGE_DEFINITIONS, UserRoleDefinition } from '../types';

interface AdminUserManagerProps {
  onBackup: () => void;
  onRestore: () => void;
  permissions?: {
    viewRegisteredUsers?: boolean;
    editRegisteredUserRole?: boolean;
    viewRole?: boolean;
    editRole?: boolean;
    deleteRole?: boolean;
    addRole?: boolean;
    viewDataSecurity?: boolean;
    backupData?: boolean;
    restoreData?: boolean;
  };
}

type RegisteredUser = { email: string; role: string; source?: string; updatedAt?: any };

export const AdminUserManager: React.FC<AdminUserManagerProps> = ({ onBackup, onRestore, permissions }) => {
  const [registeredUsersRaw, setRegisteredUsersRaw] = useState<RegisteredUser[]>([]);
  const [roles, setRoles] = useState<UserRoleDefinition[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [savingRoleName, setSavingRoleName] = useState<string | null>(null);
  const can = {
    viewRegisteredUsers: permissions?.viewRegisteredUsers ?? true,
    editRegisteredUserRole: permissions?.editRegisteredUserRole ?? true,
    viewRole: permissions?.viewRole ?? true,
    editRole: permissions?.editRole ?? true,
    deleteRole: permissions?.deleteRole ?? true,
    addRole: permissions?.addRole ?? true,
    viewDataSecurity: permissions?.viewDataSecurity ?? true,
    backupData: permissions?.backupData ?? true,
    restoreData: permissions?.restoreData ?? true
  };

  const roleNames = useMemo(() => roles.map(r => r.name), [roles]);

  const registeredUsers = useMemo(() => {
    const map = new Map<string, RegisteredUser>();
    registeredUsersRaw.forEach((u) => {
      const email = (u.email || '').toLowerCase().trim();
      if (!email) return;
      map.set(email, { ...u, email, role: u.role || 'User' });
    });
    return Array.from(map.values()).sort((a, b) => a.email.localeCompare(b.email));
  }, [registeredUsersRaw]);

  useEffect(() => {
    void loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [users, roleDefs] = await Promise.all([
        dbService.getAllRegisteredUsers(),
        dbService.getAllRoles()
      ]);
      setRegisteredUsersRaw(users);
      setRoles(roleDefs);
    } catch (error) {
      console.error('Failed to load admin panel data:', error);
    } finally {
      setFetching(false);
    }
  };

  const handleAssignUserRole = async (email: string, roleName: string) => {
    setLoading(true);
    try {
      await dbService.updateRegisteredUserRole(email, roleName);
      showAlert(`Role ${email} diubah menjadi ${roleName}`, 'success');
      await loadAll();
    } catch (error) {
      console.error(error);
      showAlert('Gagal mengubah role user');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async () => {
    const roleName = newRoleName.trim();
    if (!roleName) {
      showAlert('Nama role tidak boleh kosong');
      return;
    }
    if (roleNames.some((name) => name.toLowerCase() === roleName.toLowerCase())) {
      showAlert('Role sudah ada');
      return;
    }

    const role: UserRoleDefinition = {
      name: roleName,
      pages: {
        home: { enabled: false, actions: {} },
        calendar: { enabled: false, actions: {} },
        inspiration: { enabled: false, actions: {} },
        volunteers: { enabled: false, actions: {} },
        foto: { enabled: false, actions: {} }
      }
    };
    ROLE_PAGE_DEFINITIONS.forEach((p) => {
      role.pages[p.key].actions = Object.fromEntries(p.functions.map((f) => [f.key, false]));
    });

    setLoading(true);
    try {
      await dbService.saveRoleDefinition(role);
      setNewRoleName('');
      showAlert('Role baru berhasil dibuat', 'success');
      await loadAll();
    } catch (e) {
      console.error(e);
      showAlert('Gagal menambah role');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRole = async (roleName: string) => {
    if (!window.confirm(`Hapus role ${roleName}?`)) return;
    setLoading(true);
    try {
      await dbService.deleteRoleDefinition(roleName);
      showAlert('Role berhasil dihapus', 'success');
      await loadAll();
    } catch (error: any) {
      showAlert('Gagal menghapus role');
    } finally {
      setLoading(false);
    }
  };

  const updateRoleDefinition = async (role: UserRoleDefinition) => {
    setSavingRoleName(role.name);
    try {
      await dbService.saveRoleDefinition(role);
      setRoles(prev => prev.map(r => (r.name === role.name ? role : r)));
    } catch (e) {
      console.error(e);
      showAlert('Gagal menyimpan perubahan role');
    } finally {
      setSavingRoleName(null);
    }
  };

  const togglePageEnabled = async (role: UserRoleDefinition, pageKey: AppPageKey, checked: boolean) => {
    const updated: UserRoleDefinition = {
      ...role,
      pages: {
        ...role.pages,
        [pageKey]: {
          ...role.pages[pageKey],
          enabled: checked
        }
      }
    };
    await updateRoleDefinition(updated);
  };

  const togglePageAction = async (role: UserRoleDefinition, pageKey: AppPageKey, actionKey: string, checked: boolean) => {
    const updated: UserRoleDefinition = {
      ...role,
      pages: {
        ...role.pages,
        [pageKey]: {
          ...role.pages[pageKey],
          actions: {
            ...role.pages[pageKey].actions,
            [actionKey]: checked
          }
        }
      }
    };
    await updateRoleDefinition(updated);
  };

  return (
    <div className="space-y-6 pb-10">
      {can.viewRegisteredUsers && (
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-bold text-slate-800">Management Admin</h3>
          <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-1 rounded-full">
            {registeredUsers.length} Total
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          {fetching ? (
            <div className="p-10 text-center text-gray-400">
              <Loader2 className="animate-spin mx-auto mb-2" />
              Memuat data...
            </div>
          ) : registeredUsers.length === 0 ? (
            <div className="p-10 text-center text-gray-400 italic">
              Belum ada user terdaftar.
            </div>
          ) : (
            registeredUsers.map((user) => (
              <div key={user.email} className="p-4 flex flex-col gap-3 hover:bg-gray-50 transition sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                    <User size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 break-all leading-tight">{user.email}</p>
                  </div>
                </div>

                <select
                  value={user.role}
                  onChange={(e) => handleAssignUserRole(user.email, e.target.value)}
                  className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white shadow-sm focus:ring-2 focus:ring-slate-100 outline-none transition-all"
                  disabled={loading || !can.editRegisteredUserRole}
                >
                  {roleNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            ))
          )}
        </div>
      </div>
      )}

      {can.viewRole && (
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="font-bold text-slate-800">Role Tersedia</h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Nama role baru..."
              className="w-full sm:w-auto px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-200 outline-none"
              disabled={loading}
            />
            {can.addRole && <button
              onClick={handleAddRole}
              disabled={loading || !newRoleName.trim()}
              className="w-full sm:w-auto px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-all shadow-sm"
            >
              Tambah Role
            </button>}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {roles.map((role) => (
            <div key={role.name} className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                <div className="font-black text-slate-800">{role.name}</div>
                <div className="flex items-center gap-2">
                  {savingRoleName === role.name && <Loader2 size={16} className="animate-spin text-slate-500" />}
                  {can.deleteRole && (
                    <button
                      onClick={() => handleDeleteRole(role.name)}
                      className="px-2 py-1 text-xs font-bold text-red-600 bg-red-50 rounded"
                    >
                      Delete Role
                    </button>
                  )}
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {ROLE_PAGE_DEFINITIONS.map((page) => (
                  <div key={`${role.name}-${page.key}`} className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-800">
                        <input
                          type="checkbox"
                          checked={!!role.pages[page.key]?.enabled}
                          onChange={(e) => togglePageEnabled(role, page.key, e.target.checked)}
                          disabled={!can.editRole}
                        />
                        {page.label}
                      </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {page.functions.map((func) => (
                        <label key={func.key} className="flex items-center gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            checked={!!role.pages[page.key]?.actions?.[func.key]}
                            onChange={(e) => togglePageAction(role, page.key, func.key, e.target.checked)}
                            disabled={!can.editRole}
                          />
                          {func.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      )}

      {can.viewDataSecurity && (
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
            disabled={!can.backupData}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-indigo-50 text-indigo-700 rounded-2xl font-bold hover:bg-indigo-100 transition-all border border-indigo-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={20} />
            <div className="text-left">
              <span className="block leading-none mb-1">Backup Data</span>
              <span className="text-[10px] font-medium opacity-70 uppercase tracking-widest">Simpan ke JSON</span>
            </div>
          </button>

          <button
            onClick={onRestore}
            disabled={!can.restoreData}
            className="flex items-center justify-center gap-3 px-6 py-4 bg-emerald-50 text-emerald-700 rounded-2xl font-bold hover:bg-emerald-100 transition-all border border-emerald-100 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload size={20} />
            <div className="text-left">
              <span className="block leading-none mb-1">Restore Data</span>
              <span className="text-[10px] font-medium opacity-70 uppercase tracking-widest">Unggah dari JSON</span>
            </div>
          </button>
        </div>
      </div>
      )}
    </div>
  );
};
