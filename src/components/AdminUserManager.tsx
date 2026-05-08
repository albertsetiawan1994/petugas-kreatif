import React, { useState, useEffect, useMemo } from 'react';
import { dbService } from '../services/db';
import { User, Loader2, Download, Upload, Database, Layers, Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { showAlert } from '../services/alertService';
import { AppPageKey, ROLE_PAGE_DEFINITIONS, UserRoleDefinition, MassName } from '../types';

const MASA_LIST = [
  'Adven',
  'Arwah',
  'Biasa',
  'Hari Raya',
  'Natal',
  'Para Kudus',
  'Paskah',
  'Pekan Suci',
  'Prapaskah',
];

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
    viewNamaMisa?: boolean;
    backupData?: boolean;
    restoreData?: boolean;
  };
}

type RegisteredUser = { email: string; role: string; source?: string; updatedAt?: any };
const SUPER_ADMIN_EMAILS = ['albertse2602@gmail.com'];

export const AdminUserManager: React.FC<AdminUserManagerProps> = ({ onBackup, onRestore, permissions }) => {
  const [registeredUsersRaw, setRegisteredUsersRaw] = useState<RegisteredUser[]>([]);
  const [roles, setRoles] = useState<UserRoleDefinition[]>([]);
  const [newRoleName, setNewRoleName] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [savingRoleName, setSavingRoleName] = useState<string | null>(null);

  // Nama Misa states
  const [massNames, setMassNames] = useState<MassName[]>([]);
  const [selectedMasa, setSelectedMasa] = useState(MASA_LIST[0]);
  const [editingMassId, setEditingMassId] = useState<string | null>(null);
  const [editingMassName, setEditingMassName] = useState('');
  const [newMassName, setNewMassName] = useState('');

  const can = {
    viewRegisteredUsers: permissions?.viewRegisteredUsers ?? true,
    editRegisteredUserRole: permissions?.editRegisteredUserRole ?? true,
    viewRole: permissions?.viewRole ?? true,
    editRole: permissions?.editRole ?? true,
    deleteRole: permissions?.deleteRole ?? true,
    addRole: permissions?.addRole ?? true,
    viewDataSecurity: permissions?.viewDataSecurity ?? true,
    viewNamaMisa: permissions?.viewNamaMisa ?? true,
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

  const filteredMassNames = useMemo(() => {
    return massNames
      .filter(m => m.masa.trim().toLowerCase() === selectedMasa.trim().toLowerCase())
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [massNames, selectedMasa]);

  useEffect(() => {
    void loadAll();
  }, []);

  const loadAll = async () => {
    try {
      await dbService.initializeMassNames({
        'Adven': [
          'Misa Minggu Adven',
          'Misa Minggu Adven II',
          'Minggu Adven III (Gaudette)',
          'Misa Minggu Adven IV',
          'Hari Biasa Adven I',
          'Hari Biasa Adven II',
          'Hari Biasa Adven III',
        ],
        'Natal': [
          'Misa Vigili Natal',
          'Misa Fajar Natal',
          'Misa Siang Natal',
          'Hari Raya Natal (Oktaf)',
          'St.Stefanus (Martir)',
          'St.Yohanes Rasul',
          'Kanak-Kanak Suci',
          'Hari Biasa Masa Natal',
          'Keluarga Kudus',
          'Maria Bunda Allah',
          'Epifani',
          'Pembaptisan Tuhan',
        ],
        'Biasa': [
          'Misa Minggu Biasa',
          'Misa Minggu Biasa II',
          'Misa Minggu Biasa III',
          'Misa Minggu Biasa IV',
          'Misa Minggu Biasa V',
          'Misa Minggu Biasa VI',
          'Misa Minggu Biasa VII',
          'Misa Minggu Biasa VIII',
          'Misa Minggu Biasa IX',
          'Misa Minggu Biasa X',
          'Misa Minggu Biasa XI',
          'Misa Minggu Biasa XII',
          'Misa Minggu Biasa XIII',
          'Misa Minggu Biasa XIV',
          'Misa Minggu Biasa XV',
          'Misa Minggu Biasa XVI',
          'Misa Minggu Biasa XVII',
          'Misa Minggu Biasa XVIII',
          'Misa Minggu Biasa XIX',
          'Misa Minggu Biasa XX',
          'Misa Minggu Biasa XXI',
          'Misa Minggu Biasa XXII',
          'Misa Minggu Biasa XXIII',
          'Misa Minggu Biasa XXIV',
          'Misa Minggu Biasa XXV',
          'Misa Minggu Biasa XXVI',
          'Misa Minggu Biasa XXVII',
          'Misa Minggu Biasa XXVIII',
          'Misa Minggu Biasa XXIX',
          'Misa Minggu Biasa XXX',
          'Misa Minggu Biasa XXXI',
          'Misa Minggu Biasa XXXII',
          'Misa Minggu Biasa XXXIII',
          'Misa Minggu Biasa XXXIV',
          'Hari Biasa',
          'Hari Biasa II',
          'Hari Biasa III',
          'Hari Biasa IV',
          'Hari Biasa V',
          'Hari Biasa VI',
          'Hari Biasa VII',
          'Hari Biasa VIII',
          'Hari Biasa IX',
          'Hari Biasa X',
          'Hari Biasa XI',
          'Hari Biasa XII',
          'Hari Biasa XIII',
          'Hari Biasa XIV',
          'Hari Biasa XV',
          'Hari Biasa XVI',
          'Hari Biasa XVII',
          'Hari Biasa XVIII',
          'Hari Biasa XIX',
          'Hari Biasa XX',
          'Hari Biasa XXI',
          'Hari Biasa XXII',
          'Hari Biasa XXIII',
          'Hari Biasa XXIV',
          'Hari Biasa XXV',
          'Hari Biasa XXVI',
          'Hari Biasa XXVII',
          'Hari Biasa XXVIII',
          'Hari Biasa XXIX',
          'Hari Biasa XXX',
          'Hari Biasa XXXI',
          'Hari Biasa XXXII',
          'Hari Biasa XXXIII',
          'Hari Biasa XXXIV',
        ],
        'Prapaskah': [
          'Misa Rabu Abu',
          'Misa Minggu Prapaskah',
          'Misa Minggu Prapaskah II',
          'Misa Minggu Prapaskah III',
          'Minggu Prapaskah IV (Laetare)',
          'Misa Minggu Prapaskah V',
          'Hari Biasa Prapaskah I',
          'Hari Biasa Prapaskah II',
          'Hari Biasa Prapaskah III',
          'Hari Biasa Prapaskah IV',
          'Hari Biasa Prapaskah V',
        ],
        'Pekan Suci': [
          'Misa Minggu Palma',
          'Hari Biasa Pekan Suci',
          'Misa Kamis Putih',
          'Misa Jumat Agung',
          'Misa Sabtu Suci',
        ],
        'Paskah': [
          'Misa Vigili Paskah',
          'Misa Minggu Paskah',
          'Misa Minggu Paskah II',
          'Misa Minggu Paskah III',
          'Misa Minggu Paskah IV',
          'Misa Minggu Paskah V',
          'Misa Minggu Paskah VI',
          'Misa Minggu Paskah VII',
          'Hari Biasa Pekan Paskah',
          'Hari Biasa Pekan Paskah II',
          'Hari Biasa Pekan Paskah III',
          'Hari Biasa Pekan Paskah IV',
          'Hari Biasa Pekan Paskah V',
          'Hari Biasa Pekan Paskah VI',
          'Hari Biasa Pekan Paskah VII',
          'Misa Oktaf Paskah',
          'Misa Kenaikan Tuhan',
          'Misa Vigili Pentakosta',
          'Hari Raya Pentakosta',
        ],
        'Hari Raya': [
          'Misa Tritunggal Mahakudus',
          'Misa Tubuh & Darah Kristus',
          'Misa Hati Yesus Mahakudus',
          'Misa Kristus Raja',
        ],
        'Para Kudus': [
          'Misa Rasul/Martir',
          'Misa Kudus non martir',
          'Misa Santa Perawan',
        ],
        'Arwah': [
          'Hari Arwah',
          'Misa Arwah',
        ],
      });

      const [users, roleDefs, names] = await Promise.all([
        dbService.getAllRegisteredUsers(),
        dbService.getAllRoles(),
        dbService.getAllMassNames()
      ]);
      setRegisteredUsersRaw(users);
      setRoles(roleDefs);
      setMassNames(names);
    } catch (error) {
      console.error('Failed to load admin panel data:', error);
    } finally {
      setFetching(false);
    }
  };

  // Mass Name Handlers
  const handleAddMassName = async () => {
    const name = newMassName.trim();
    if (!name) return;
    
    // Remove slashes and other special characters from ID to avoid Firebase path issues
    const id = `${selectedMasa}-${name}`.replace(/[\s\/]+/g, '-').toLowerCase();
    if (massNames.some(m => m.id === id)) {
      showAlert('Nama misa sudah ada di masa ini');
      return;
    }

    setLoading(true);
    try {
      const massName: MassName = { id, masa: selectedMasa, name };
      await dbService.saveMassName(massName);
      setMassNames(prev => [...prev, massName]);
      setNewMassName('');
      showAlert('Nama misa berhasil ditambahkan', 'success');
    } catch (e) {
      showAlert('Gagal menambah nama misa');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMassName = async (mass: MassName) => {
    const newName = editingMassName.trim();
    if (!newName || newName === mass.name) {
      setEditingMassId(null);
      return;
    }

    setLoading(true);
    try {
      const updated = { ...mass, name: newName };
      await dbService.saveMassName(updated);
      setMassNames(prev => prev.map(m => m.id === mass.id ? updated : m));
      setEditingMassId(null);
      showAlert('Nama misa diperbarui', 'success');
    } catch (e) {
      showAlert('Gagal memperbarui nama misa');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMassName = async (id: string) => {
    if (!window.confirm('Hapus nama misa ini?')) return;
    setLoading(true);
    try {
      await dbService.deleteMassName(id);
      setMassNames(prev => prev.filter(m => m.id !== id));
      showAlert('Nama misa dihapus', 'success');
    } catch (e) {
      showAlert('Gagal menghapus nama misa');
    } finally {
      setLoading(false);
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
      if (error instanceof Error && error.message === 'FORBIDDEN_SUPER_ADMIN_UPDATE') {
        showAlert('Role Admin tidak bisa mengubah role akun Super Admin.');
      } else {
        showAlert('Gagal mengubah role user');
      }
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
        foto: { enabled: false, actions: {} },
        alur: { enabled: false, actions: {} },
        admin: { enabled: false, actions: {} }
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
    const pageDef = ROLE_PAGE_DEFINITIONS.find(p => p.key === pageKey);
    const newActions = { ...(role.pages[pageKey]?.actions || {}) };
    
    // When enabling/disabling a page, also enable/disable all its actions
    if (pageDef) {
      pageDef.functions.forEach(f => {
        newActions[f.key] = checked;
      });
    }

    const updated: UserRoleDefinition = {
      ...role,
      pages: {
        ...role.pages,
        [pageKey]: {
          ...role.pages[pageKey],
          enabled: checked,
          actions: newActions
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
          // If checking an action, automatically enable the page.
          // If unchecking, keep the page enabled status as is.
          enabled: checked ? true : !!role.pages[pageKey]?.enabled,
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
                    {SUPER_ADMIN_EMAILS.includes(user.email) && (
                      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Super Admin</p>
                    )}
                  </div>
                </div>

                <select
                  value={user.role}
                  onChange={(e) => handleAssignUserRole(user.email, e.target.value)}
                  className="w-full sm:w-auto px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-white shadow-sm focus:ring-2 focus:ring-slate-100 outline-none transition-all"
                  disabled={loading || !can.editRegisteredUserRole || SUPER_ADMIN_EMAILS.includes(user.email)}
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

      {can.viewNamaMisa && (
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Layers className="text-indigo-600" size={20} />
            <h3 className="font-bold text-slate-800">Daftar Nama Misa</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Masa:</span>
            <select
              value={selectedMasa}
              onChange={(e) => setSelectedMasa(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-bold bg-white outline-none focus:ring-2 focus:ring-slate-100"
            >
              {MASA_LIST.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Add New Mass Name */}
          <div className="flex items-center gap-2">
            <input
              value={newMassName}
              onChange={(e) => setNewMassName(e.target.value)}
              placeholder="Tambah nama misa baru..."
              className="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-200 outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleAddMassName()}
            />
            <button
              onClick={handleAddMassName}
              disabled={loading || !newMassName.trim()}
              className="p-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50 active:scale-95 transition-all shadow-sm"
            >
              <Plus size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredMassNames.length === 0 ? (
              <div className="col-span-full py-10 text-center text-gray-400 italic bg-gray-50 rounded-xl border border-dashed border-gray-200">
                Belum ada nama misa untuk masa ini.
              </div>
            ) : (
              filteredMassNames.map((mass) => (
                <div key={mass.id} className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between group hover:border-indigo-200 hover:shadow-sm transition-all">
                  {editingMassId === mass.id ? (
                    <div className="flex items-center gap-2 w-full">
                      <input
                        autoFocus
                        value={editingMassName}
                        onChange={(e) => setEditingMassName(e.target.value)}
                        className="flex-1 px-2 py-1 rounded border border-indigo-300 text-sm outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateMassName(mass);
                          if (e.key === 'Escape') setEditingMassId(null);
                        }}
                      />
                      <button onClick={() => handleUpdateMassName(mass)} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded">
                        <Check size={16} />
                      </button>
                      <button onClick={() => setEditingMassId(null)} className="text-red-600 hover:bg-red-50 p-1 rounded">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-semibold text-slate-700 truncate mr-2">{mass.name}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingMassId(mass.id);
                            setEditingMassName(mass.name);
                          }}
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteMassName(mass.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
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
