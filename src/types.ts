export const ALL_ROLES = [
  'OBS',
  'SOUND',
  'CAM 1',
  'CAM 2',
  'FOTO',
];

export interface Volunteer {
  id: string;
  name: string;
  roles: string[];
  phone?: string;
  isUnavailable?: boolean;
  excludeFromAutoFill?: boolean;
}

export type Role = string;

export interface MassEvent {
  id: string;
  name: string;
  number: number;
  date: string;
  time: string;
  needsOBS: boolean;
  needsSound: boolean;
  needsCam1: boolean;
  needsPhoto: boolean;
  isBigMass: boolean;
  allowDuplicate?: boolean; // New field to persist exception
}

export interface ScheduleAssignment {
  id?: string;
  eventId: string;
  obs?: string;
  sound?: string;
  cam1?: string;
  cam2?: string;
  foto?: string;
}

export interface CombinedScheduleRow {
  event: MassEvent;
  assignment: ScheduleAssignment;
}

export interface Unavailable {
    id: string;
    volunteerId: string;
    volunteerName: string;
    date: string; // YYYY-MM-DD
}

export interface Schedule {
    id: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:mm
    title?: string;
    eventName: string;
    assignments: {
        [role: string]: string; // role -> volunteerId
    }
}

export interface MassName {
  id: string;
  masa: string;
  name: string;
}

export type AppPageKey = 'home' | 'calendar' | 'inspiration' | 'volunteers' | 'foto' | 'alur' | 'admin';

export interface RoleFunctionDefinition {
  key: string;
  label: string;
}

export interface RolePageDefinition {
  key: AppPageKey;
  label: string;
  functions: RoleFunctionDefinition[];
}

export interface RolePagePermission {
  enabled: boolean;
  actions: Record<string, boolean>;
}

export interface UserRoleDefinition {
  name: string;
  isSystem?: boolean;
  pages: Record<AppPageKey, RolePagePermission>;
}

export const ROLE_PAGE_DEFINITIONS: RolePageDefinition[] = [
  {
    key: 'home',
    label: 'Jadwal',
    functions: [
      { key: 'screenshot', label: 'Screenshot' },
      { key: 'generate_petugas', label: 'Generate Nama Petugas' },
      { key: 'manual_assign', label: 'Mengubah Nama Petugas Secara Manual' },
    ],
  },
  {
    key: 'calendar',
    label: 'Kalender',
    functions: [
      { key: 'view_tambah_jadwal', label: 'View Tambah Jadwal Baru' },
      { key: 'edit_jadwal', label: 'Edit Jadwal' },
      { key: 'delete_jadwal', label: 'Delete Jadwal' },
      { key: 'simpan_jadwal', label: 'Simpan Jadwal' },
    ],
  },
  {
    key: 'inspiration',
    label: 'Inspirasi',
    functions: [
      { key: 'view_ayat_alkitab', label: 'View dan akses ayat alkitab' },
      { key: 'view_puji_syukur', label: 'View dan akses puji syukur/madah bakti' },
      { key: 'view_ibadat_harian', label: 'View dan akses ibadat harian' },
      { key: 'cari_doa', label: 'Cari doa' },
      { key: 'ide_kreatif_ai', label: 'Ide kreatif ai' },
    ],
  },
  {
    key: 'volunteers',
    label: 'Petugas',
    functions: [
      { key: 'view_petugas', label: 'View petugas' },
      { key: 'tambah_petugas', label: 'Tambah petugas' },
      { key: 'edit_petugas', label: 'Edit petugas' },
      { key: 'delete_petugas', label: 'Delete petugas' },
    ],
  },
  {
    key: 'foto',
    label: 'Foto',
    functions: [
      { key: 'view_foto', label: 'View foto' },
      { key: 'upload_foto', label: 'Upload foto' },
      { key: 'simpan_foto', label: 'Simpan foto' },
      { key: 'delete_foto', label: 'Delete foto' },
      { key: 'edit_setting_foto', label: 'Edit setting foto' },
      { key: 'reset_setting_foto', label: 'Reset setting foto' },
      { key: 'urutkan_foto', label: 'Urutkan foto (drag)' },
    ],
  },
  {
    key: 'alur',
    label: 'Alur',
    functions: [
      { key: 'view_alur', label: 'View alur' },
      { key: 'tambah_homili', label: 'Tambah Homili' },
      { key: 'edit_homili', label: 'Edit Homili' },
      { key: 'delete_homili', label: 'Delete Homili' },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    functions: [
      { key: 'view_user_terdaftar', label: 'View Management Admin' },
      { key: 'edit_role_user_terdaftar', label: 'Edit Role User' },
      { key: 'view_role', label: 'View role' },
      { key: 'edit_role', label: 'Edit role' },
      { key: 'delete_role', label: 'Delete role' },
      { key: 'tambah_role', label: 'Tambah role' },
      { key: 'view_data_keamanan', label: 'View Data & Keamanan' },
      { key: 'view_nama_misa', label: 'View List Nama Misa' },
      { key: 'backup_data', label: 'Backup data' },
      { key: 'restore_data', label: 'Restore data' },
    ],
  },
];
