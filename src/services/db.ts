import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  writeBatch,
  where
} from 'firebase/firestore';
import {
  Volunteer,
  MassEvent,
  ScheduleAssignment,
  CombinedScheduleRow,
  AppPageKey,
  ROLE_PAGE_DEFINITIONS,
  UserRoleDefinition,
  MassName
} from '../types';
import { db, ensureFirebaseAuth, getCurrentUserEmail, logActivity } from './firebase';

interface AppDB extends DBSchema {
  volunteers: {
    key: string;
    value: Volunteer;
  };
  events: {
    key: string;
    value: MassEvent;
    indexes: { 'by-date': string };
  };
  assignments: {
    key: string;
    value: ScheduleAssignment;
  };
  mass_names: {
    key: string;
    value: MassName;
  };
}

const DB_NAME = 'church-scheduler-db';
const DB_VERSION = 3;

const COLLECTIONS = {
  volunteers: 'volunteers',
  events: 'events',
  assignments: 'assignments',
  backups: 'backups',
  admins: 'admins',
  users: 'users',
  roles: 'roles',
  homilies: 'homilies',
  mass_names: 'mass_names'
} as const;

const SUPER_ADMIN_EMAILS = ['albertse2602@gmail.com'];
const isSuperAdminEmail = (email: string) => SUPER_ADMIN_EMAILS.includes(String(email || '').toLowerCase());
const LEGACY_ADMIN_ACTION_KEYS = [
  'view_user_terdaftar',
  'edit_role_user_terdaftar',
  'view_role',
  'edit_role',
  'delete_role',
  'tambah_role',
  'view_data_keamanan',
  'backup_data',
  'restore_data'
];

const buildActions = (value: boolean, pageKey: AppPageKey) => {
  const def = ROLE_PAGE_DEFINITIONS.find(p => p.key === pageKey);
  const actions: Record<string, boolean> = {};
  (def?.functions || []).forEach(f => {
    actions[f.key] = value;
  });
  return actions;
};

const buildPages = (enabledByDefault: boolean) => ({
  home: { enabled: enabledByDefault, actions: buildActions(enabledByDefault, 'home') },
  calendar: { enabled: enabledByDefault, actions: buildActions(enabledByDefault, 'calendar') },
  inspiration: { enabled: enabledByDefault, actions: buildActions(enabledByDefault, 'inspiration') },
  volunteers: { enabled: enabledByDefault, actions: buildActions(enabledByDefault, 'volunteers') },
  foto: { enabled: enabledByDefault, actions: buildActions(enabledByDefault, 'foto') },
  alur: { enabled: enabledByDefault, actions: buildActions(enabledByDefault, 'alur') },
  admin: { enabled: enabledByDefault, actions: buildActions(enabledByDefault, 'admin') }
}) as UserRoleDefinition['pages'];

const normalizeRole = (role: any): UserRoleDefinition => {
  const roleName = String(role?.name || 'User');
  const sourcePages = role?.pages || {};
  const pages = buildPages(false);
  (ROLE_PAGE_DEFINITIONS.map(p => p.key) as AppPageKey[]).forEach(pageKey => {
    const srcPage = sourcePages[pageKey] || {};
    const actionDefaults = buildActions(!!(srcPage.enabled ?? false), pageKey);
    const mergedActions: Record<string, boolean> = { ...actionDefaults, ...(srcPage.actions || {}) };
    pages[pageKey] = {
      enabled: srcPage.enabled ?? false,
      actions: mergedActions
    };
  });
  return {
    name: roleName,
    isSystem: false,
    pages
  };
};

const buildSuperAdminRole = (): UserRoleDefinition => ({
  name: 'Admin',
  isSystem: true,
  pages: buildPages(true)
});

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;
let bootstrapPromise: Promise<void> | null = null;

const isLocalDbConnectionClosingError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  if (error.name === 'InvalidStateError' || error.name === 'AbortError') return true;
  const message = (error.message || '').toLowerCase();
  return message.includes('database connection is closing');
};

const isPermissionDeniedError = (error: any) => {
  const code = String(error?.code || '');
  return code.includes('permission-denied');
};

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<AppDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('volunteers')) {
          db.createObjectStore('volunteers', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('events')) {
          const eventStore = db.createObjectStore('events', { keyPath: 'id' });
          eventStore.createIndex('by-date', 'date');
        }
        
        if (!db.objectStoreNames.contains('assignments')) {
          db.createObjectStore('assignments', { keyPath: 'eventId' });
        }

        if (!db.objectStoreNames.contains('mass_names')) {
          db.createObjectStore('mass_names', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

const isCloudEnabled = !!db;

const assertWriteAccess = async () => {
  if (!db) return;
  await ensureFirebaseAuth();
};

const chunkArray = <T>(items: T[], size = 400): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const serializeForCloud = <T extends object>(data: T): T & { updatedAt: ReturnType<typeof serverTimestamp> } => {
  return {
    ...data,
    updatedAt: serverTimestamp()
  };
};

const stripFirestoreMeta = <T extends object>(data: any): T => {
  const { updatedAt, ...plain } = data || {};
  return plain as T;
};

const mirrorToLocal = {
  async saveVolunteer(volunteer: Volunteer) {
    await (await getDB()).put('volunteers', volunteer);
  },
  async deleteVolunteer(id: string) {
    await (await getDB()).delete('volunteers', id);
  },
  async saveEvent(event: MassEvent) {
    await (await getDB()).put('events', event);
  },
  async deleteEvent(id: string) {
    const dbLocal = await getDB();
    const tx = dbLocal.transaction(['events', 'assignments'], 'readwrite');
    await tx.objectStore('events').delete(id);
    await tx.objectStore('assignments').delete(id);
    await tx.done;
  },
  async saveAssignment(assignment: ScheduleAssignment) {
    await (await getDB()).put('assignments', assignment);
  },
  async clearAssignments(eventIds: string[]) {
    const dbLocal = await getDB();
    const tx = dbLocal.transaction('assignments', 'readwrite');
    await Promise.all(eventIds.map(id => tx.store.delete(id)));
    await tx.done;
  },
  async readAll() {
    const dbLocal = await getDB();
    const volunteers = await dbLocal.getAll('volunteers');
    const events = await dbLocal.getAll('events');
    const assignments = await dbLocal.getAll('assignments');
    return { volunteers, events, assignments };
  },
  async replaceAll(volunteers: Volunteer[], events: MassEvent[], assignments: ScheduleAssignment[]) {
    const dbLocal = await getDB();
    const tx = dbLocal.transaction(['volunteers', 'events', 'assignments'], 'readwrite');
    await Promise.all([
      tx.objectStore('volunteers').clear(),
      tx.objectStore('events').clear(),
      tx.objectStore('assignments').clear()
    ]);
    await Promise.all([
      ...volunteers.map(v => tx.objectStore('volunteers').put(v)),
      ...events.map(e => tx.objectStore('events').put(e)),
      ...assignments.map(a => tx.objectStore('assignments').put(a))
    ]);
    await tx.done;
  }
};

const hasCloudData = async (): Promise<boolean> => {
  if (!db) return false;
  const checks = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.volunteers), limit(1))),
    getDocs(query(collection(db, COLLECTIONS.events), limit(1))),
    getDocs(query(collection(db, COLLECTIONS.assignments), limit(1)))
  ]);
  return checks.some(snapshot => !snapshot.empty);
};

const ensureCloudBootstrap = async () => {
  if (!db || bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    await ensureFirebaseAuth();
    const cloudAlreadyHasData = await hasCloudData();
    if (cloudAlreadyHasData) return;

    const localData = await mirrorToLocal.readAll();
    if (
      localData.volunteers.length === 0 &&
      localData.events.length === 0 &&
      localData.assignments.length === 0
    ) {
      return;
    }

    const writes = [
      ...localData.volunteers.map(v => ({ col: COLLECTIONS.volunteers, id: v.id, payload: v })),
      ...localData.events.map(e => ({ col: COLLECTIONS.events, id: e.id, payload: e })),
      ...localData.assignments.map(a => ({ col: COLLECTIONS.assignments, id: a.eventId, payload: a }))
    ];

    for (const group of chunkArray(writes)) {
      const batch = writeBatch(db);
      group.forEach(item => {
        batch.set(doc(db, item.col, item.id), serializeForCloud(item.payload));
      });
      try {
        await batch.commit();
      } catch (error) {
        // Non-admin users may have read access but not write access to cloud.
        // In that case, keep app usable with local data and skip bootstrap.
        if (isPermissionDeniedError(error)) return;
        throw error;
      }
    }
  })().finally(() => {
    bootstrapPromise = null;
  });

  return bootstrapPromise;
};

const getCloudSnapshot = async () => {
  if (!db) {
    return mirrorToLocal.readAll();
  }
  await ensureFirebaseAuth();
  await ensureCloudBootstrap();

  const [volunteerDocs, eventDocs, assignmentDocs] = await Promise.all([
    getDocs(collection(db, COLLECTIONS.volunteers)),
    getDocs(collection(db, COLLECTIONS.events)),
    getDocs(collection(db, COLLECTIONS.assignments))
  ]);

  return {
    volunteers: volunteerDocs.docs.map(d => stripFirestoreMeta<Volunteer>(d.data())),
    events: eventDocs.docs.map(d => stripFirestoreMeta<MassEvent>(d.data())),
    assignments: assignmentDocs.docs.map(d => stripFirestoreMeta<ScheduleAssignment>(d.data()))
  };
};

export const dbService = {
  async migrateLegacyAdminPermissionsToAdminPage() {
    if (!db) return;
    await ensureFirebaseAuth();
    const snapshot = await getDocs(collection(db, COLLECTIONS.roles));

    for (const roleDoc of snapshot.docs) {
      const normalized = normalizeRole(roleDoc.data());
      const volunteerActions = normalized.pages.volunteers?.actions || {};
      const adminActions = normalized.pages.admin?.actions || {};

      const hasLegacyAdminPermission = LEGACY_ADMIN_ACTION_KEYS.some((key) => !!volunteerActions[key]);
      const adminAlreadyConfigured = LEGACY_ADMIN_ACTION_KEYS.some((key) => !!adminActions[key]);
      if (!hasLegacyAdminPermission || adminAlreadyConfigured) continue;

      const nextRole: UserRoleDefinition = {
        ...normalized,
        pages: {
          ...normalized.pages,
          admin: {
            enabled: normalized.pages.admin?.enabled || hasLegacyAdminPermission,
            actions: {
              ...normalized.pages.admin.actions,
              ...Object.fromEntries(
                LEGACY_ADMIN_ACTION_KEYS.map((key) => [key, !!volunteerActions[key]])
              )
            }
          }
        }
      };

      await setDoc(
        doc(db, COLLECTIONS.roles, nextRole.name.toLowerCase()),
        {
          ...nextRole,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }
  },

  async getAllRoles(): Promise<UserRoleDefinition[]> {
    if (!db) return [];
    await ensureFirebaseAuth();
    const snapshot = await getDocs(collection(db, COLLECTIONS.roles));
    return snapshot.docs.map(d => normalizeRole(d.data()));
  },

  async getAllMassNames(): Promise<MassName[]> {
    if (!db) return [];
    await ensureFirebaseAuth();
    const snapshot = await getDocs(collection(db, COLLECTIONS.mass_names));
    return snapshot.docs.map(d => stripFirestoreMeta<MassName>(d.data()));
  },

  async saveMassName(massName: MassName) {
    if (!db) return;
    await assertWriteAccess();
    await setDoc(doc(db, COLLECTIONS.mass_names, massName.id), serializeForCloud(massName));
    await logActivity('MASS_NAME_SAVE', { id: massName.id, name: massName.name, masa: massName.masa });
  },

  async deleteMassName(id: string) {
    if (!db) return;
    await assertWriteAccess();
    const massNameDoc = await getDoc(doc(db, COLLECTIONS.mass_names, id));
    const massName = massNameDoc.data() as MassName;
    await deleteDoc(doc(db, COLLECTIONS.mass_names, id));
    if (massName) {
      await logActivity('MASS_NAME_DELETE', { id, name: massName.name, masa: massName.masa });
    }
  },

  async initializeMassNames(mapping: Record<string, string[]>) {
    if (!db) return;
    await assertWriteAccess();
    
    const current = await this.getAllMassNames();
    
    if (current.length > 50) {
      return;
    }

    const batch = writeBatch(db);
    Object.entries(mapping).forEach(([masa, names]) => {
      names.forEach(name => {
        const cleanName = name.trim();
        // Remove slashes and other special characters from ID to avoid Firebase path issues
        const id = `${masa}-${cleanName}`.replace(/[\s\/]+/g, '-').toLowerCase();
        const massName: MassName = { id, masa, name: cleanName };
        batch.set(doc(db, COLLECTIONS.mass_names, id), serializeForCloud(massName));
      });
    });
    
    await batch.commit();
    await logActivity('MASS_NAME_INIT');
  },

  async saveRoleDefinition(role: UserRoleDefinition) {
    await assertWriteAccess();
    if (!db) return;
    const normalized = normalizeRole(role);
    await setDoc(
      doc(db, COLLECTIONS.roles, normalized.name.toLowerCase()),
      {
        ...normalized,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  },

  async deleteRoleDefinition(roleName: string) {
    await assertWriteAccess();
    if (!db) return;
    const name = roleName.trim();
    await deleteDoc(doc(db, COLLECTIONS.roles, name.toLowerCase()));
  },

  async updateRegisteredUserRole(email: string, role: string) {
    await assertWriteAccess();
    if (!db) return;
    const emailLower = email.toLowerCase();
    const actorEmail = getCurrentUserEmail().toLowerCase();
    if (isSuperAdminEmail(emailLower) && !isSuperAdminEmail(actorEmail)) {
      throw new Error('FORBIDDEN_SUPER_ADMIN_UPDATE');
    }
    await setDoc(
      doc(db, COLLECTIONS.users, emailLower),
      {
        email: emailLower,
        role,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  },

  async getUserNavAccess(email: string): Promise<Record<AppPageKey, boolean>> {
    const fallback: Record<AppPageKey, boolean> = {
      home: false,
      calendar: false,
      inspiration: false,
      volunteers: false,
      foto: false,
      alur: false,
      admin: false
    };
    const emailLower = String(email || '').toLowerCase();
    if (isSuperAdminEmail(emailLower)) {
      return { 
        home: true, calendar: true, inspiration: true, volunteers: true, 
        foto: true, alur: true, admin: true 
      };
    }
    if (!db || !emailLower) return fallback;
    await ensureFirebaseAuth();

    const userDoc = await getDoc(doc(db, COLLECTIONS.users, emailLower));
    const userRoleName = String(userDoc.data()?.role || 'User');
    const roles = await dbService.getAllRoles();
    const role = roles.find(r => r.name.toLowerCase() === userRoleName.toLowerCase()) || normalizeRole({ name: userRoleName });
    return {
      home: !!role.pages.home.enabled,
      calendar: !!role.pages.calendar.enabled,
      inspiration: !!role.pages.inspiration.enabled,
      volunteers: !!role.pages.volunteers.enabled,
      foto: !!role.pages.foto?.enabled,
      alur: !!role.pages.alur?.enabled,
      admin: !!role.pages.admin?.enabled
    };
  },

  async getUserRoleDefinition(email: string): Promise<UserRoleDefinition> {
    const emailLower = String(email || '').toLowerCase();
    if (isSuperAdminEmail(emailLower)) {
      return buildSuperAdminRole();
    }
    if (!db || !emailLower) {
      return normalizeRole({ name: 'User' });
    }
    await ensureFirebaseAuth();
    const userDoc = await getDoc(doc(db, COLLECTIONS.users, emailLower));
    const userRoleName = String(userDoc.data()?.role || 'User');
    const roles = await dbService.getAllRoles();
    const role = roles.find(r => r.name.toLowerCase() === userRoleName.toLowerCase());
    return normalizeRole(role || { name: userRoleName });
  },

  async getAllRegisteredUsers(): Promise<Array<{ email: string; role: string; source?: string; updatedAt?: any }>> {
    if (!db) return [];
    await ensureFirebaseAuth();
    const [usersSnapshot, adminsSnapshot, activitiesSnapshot] = await Promise.all([
      getDocs(collection(db, COLLECTIONS.users)),
      getDocs(collection(db, COLLECTIONS.admins)),
      getDocs(collection(db, 'activities'))
    ]);

    const map = new Map<string, { email: string; role: string; source?: string; updatedAt?: any }>();

    usersSnapshot.docs.forEach((d) => {
      const data = d.data() || {};
      const email = String((data as any).email || d.id).toLowerCase();
      if (!email) return;
      map.set(email, {
        email,
        role: String((data as any).role || 'User'),
        source: (data as any).source,
        updatedAt: (data as any).updatedAt
      });
    });

    adminsSnapshot.docs.forEach((d) => {
      const email = String((d.data() as any).email || d.id).toLowerCase();
      if (!email) return;
      if (!map.has(email)) {
        map.set(email, {
          email,
          role: 'User',
          source: 'email_list',
          updatedAt: (d.data() as any).addedAt
        });
      }
    });

    activitiesSnapshot.docs.forEach((d) => {
      const data: any = d.data() || {};
      const candidates = [
        data?.actorEmail,
        data?.details?.email,
        data?.details?.userEmail
      ];
      candidates.forEach((raw) => {
        const email = String(raw || '').toLowerCase().trim();
        if (!email || !email.includes('@')) return;
        if (!map.has(email)) {
          map.set(email, { email, role: 'User', source: 'activity', updatedAt: data?.timestamp });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => a.email.localeCompare(b.email));
  },

  async upsertRegisteredUser(params: { email: string; role?: string; source?: string }) {
    if (!db) return;
    await ensureFirebaseAuth();
    const emailLower = params.email.toLowerCase();
    const payload: Record<string, any> = {
      email: emailLower,
      source: params.source || 'google_login',
      updatedAt: serverTimestamp()
    };
    if (typeof params.role === 'string' && params.role.trim()) {
      payload.role = params.role.trim();
    } else if (isSuperAdminEmail(emailLower)) {
      payload.role = 'Admin';
    }
    await setDoc(
      doc(db, COLLECTIONS.users, emailLower),
      payload,
      { merge: true }
    );
  },

  subscribeUserRoleAndAccessRealtime(email: string, callback: (navAccess: Record<AppPageKey, boolean>, roleDef: UserRoleDefinition) => void): Unsubscribe {
    if (!db || !email) {
      // Return a no-op unsubscribe function if not authenticated or no email
      return () => {};
    }

    const emailLower = String(email || '').toLowerCase();
    let userRoleName: string | null = null;
    let allRoles: UserRoleDefinition[] = [];

    const evaluateAndCallback = async () => {
      const currentNavAccess = await dbService.getUserNavAccess(emailLower);
      const currentUserRoleDef = await dbService.getUserRoleDefinition(emailLower);
      callback(currentNavAccess, currentUserRoleDef);
    };

    // Listener for user's assigned role
    const userDocRef = doc(db, COLLECTIONS.users, emailLower);
    const unsubscribeUser = onSnapshot(userDocRef, (docSnapshot) => {
      userRoleName = String(docSnapshot.data()?.role || 'User');
      evaluateAndCallback();
    });

    // Listener for role definitions (permissions)
    const rolesColRef = collection(db, COLLECTIONS.roles);
    const unsubscribeRoles = onSnapshot(rolesColRef, (snapshot) => {
      allRoles = snapshot.docs.map(d => normalizeRole(d.data()));
      evaluateAndCallback();
    });

    return () => {
      unsubscribeUser();
      unsubscribeRoles();
    };
  },

  async getAllVolunteers(): Promise<Volunteer[]> {
    if (!db) {
      return (await getDB()).getAll('volunteers');
    }
    try {
      await ensureFirebaseAuth();
      await ensureCloudBootstrap();
      const snapshot = await getDocs(collection(db, COLLECTIONS.volunteers));
      return snapshot.docs.map(d => stripFirestoreMeta<Volunteer>(d.data()));
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        return (await getDB()).getAll('volunteers');
      }
      throw error;
    }
  },

  // Local-first helpers (IndexedDB) to make refresh instant even when cloud is enabled.
  async getAllVolunteersLocal(): Promise<Volunteer[]> {
    return (await getDB()).getAll('volunteers');
  },
  async saveVolunteer(volunteer: Volunteer) {
    await assertWriteAccess();
    if (db) {
      await ensureFirebaseAuth();
      await ensureCloudBootstrap();
      await setDoc(doc(db, COLLECTIONS.volunteers, volunteer.id), serializeForCloud(volunteer), { merge: true });
    }
    const result = await mirrorToLocal.saveVolunteer(volunteer);
    await logActivity('VOLUNTEER_ADD', { id: volunteer.id, name: volunteer.name });
    return result;
  },
  async deleteVolunteer(id: string) {
    await assertWriteAccess();
    if (db) {
      await ensureFirebaseAuth();
      await ensureCloudBootstrap();
      await deleteDoc(doc(db, COLLECTIONS.volunteers, id));
    }
    const result = await mirrorToLocal.deleteVolunteer(id);
    await logActivity('VOLUNTEER_DELETE', { id });
    return result;
  },

  async getEventsByMonth(year: number, month: number): Promise<MassEvent[]> {
    if (!db) {
      const allEvents = await (await getDB()).getAll('events');
      const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
      return allEvents.filter(e => e.date.startsWith(prefix));
    }
    try {
      await ensureFirebaseAuth();
      await ensureCloudBootstrap();
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const nextMonth = month === 11 ? 1 : month + 2;
      const nextYear = month === 11 ? year + 1 : year;
      const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTIONS.events),
          where('date', '>=', start),
          where('date', '<', end)
        )
      );
      return snapshot.docs.map(d => stripFirestoreMeta<MassEvent>(d.data()));
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        const allEvents = await (await getDB()).getAll('events');
        const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
        return allEvents.filter(e => e.date.startsWith(prefix));
      }
      throw error;
    }
  },

  async getEventsByMonthLocal(year: number, month: number): Promise<MassEvent[]> {
    const allEvents = await (await getDB()).getAll('events');
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return allEvents.filter(e => e.date.startsWith(prefix));
  },
  async saveEvent(event: MassEvent) {
    await assertWriteAccess();
    if (db) {
      await ensureFirebaseAuth();
      await ensureCloudBootstrap();
      await setDoc(doc(db, COLLECTIONS.events, event.id), serializeForCloud(event), { merge: true });
    }
    const result = await mirrorToLocal.saveEvent(event);
    await logActivity('EVENT_ADD', { id: event.id, title: event.name, date: event.date });
    return result;
  },
  async deleteEvent(id: string) {
    await assertWriteAccess();
    try {
      if (db) {
        await ensureFirebaseAuth();
        await ensureCloudBootstrap();
        await Promise.all([
          deleteDoc(doc(db, COLLECTIONS.events, id)),
          deleteDoc(doc(db, COLLECTIONS.assignments, id))
        ]);
      }
      await mirrorToLocal.deleteEvent(id);
      await logActivity('EVENT_DELETE', { id });
    } catch (error) {
      console.error('Failed to delete event:', error);
      throw error;
    }
  },

  async getAssignments(eventIds: string[]): Promise<ScheduleAssignment[]> {
    if (!db) {
      const dbLocal = await getDB();
      const results = await Promise.all(eventIds.map(id => dbLocal.get('assignments', id)));
      return results.filter((r): r is ScheduleAssignment => !!r);
    }
    try {
      await ensureFirebaseAuth();
      await ensureCloudBootstrap();
      const results = await Promise.all(
        eventIds.map(id => getDoc(doc(db, COLLECTIONS.assignments, id)))
      );
      return results
        .map(r => (r.exists() ? stripFirestoreMeta<ScheduleAssignment>(r.data()) : null))
        .filter((r): r is ScheduleAssignment => !!r);
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        const dbLocal = await getDB();
        const results = await Promise.all(eventIds.map(id => dbLocal.get('assignments', id)));
        return results.filter((r): r is ScheduleAssignment => !!r);
      }
      throw error;
    }
  },

  async getAssignmentsLocal(eventIds: string[]): Promise<ScheduleAssignment[]> {
    const dbLocal = await getDB();
    const results = await Promise.all(eventIds.map(id => dbLocal.get('assignments', id)));
    return results.filter((r): r is ScheduleAssignment => !!r);
  },

  async cacheSnapshotLocally(params: { volunteers?: Volunteer[]; events?: MassEvent[]; assignments?: ScheduleAssignment[] }) {
    const writeSnapshot = async (attempt = 0): Promise<void> => {
      try {
        const dbLocal = await getDB();
        const tx = dbLocal.transaction(['volunteers', 'events', 'assignments'], 'readwrite');
        const { volunteers = [], events = [], assignments = [] } = params;
        await Promise.all([
          ...volunteers.map(v => tx.objectStore('volunteers').put(v)),
          ...events.map(e => tx.objectStore('events').put(e)),
          ...assignments.map(a => tx.objectStore('assignments').put(a)),
        ]);
        await tx.done;
      } catch (error) {
        if (attempt === 0 && isLocalDbConnectionClosingError(error)) {
          try {
            const existingDb = await dbPromise;
            existingDb.close();
          } catch {
            // no-op: best-effort close before reopening
          }
          dbPromise = null;
          return writeSnapshot(1);
        }
        throw error;
      }
    };

    await writeSnapshot();
  },

  subscribeVolunteersRealtime(callback: (volunteers: Volunteer[]) => void): Unsubscribe {
    if (!db) return () => {};
    const q = query(collection(db, COLLECTIONS.volunteers));
    return onSnapshot(q, async (snapshot) => {
      const volunteers = snapshot.docs.map(d => stripFirestoreMeta<Volunteer>(d.data()));
      const sorted = [...volunteers].sort((a, b) => a.name.localeCompare(b.name));
      try {
        await dbService.cacheSnapshotLocally({ volunteers: sorted });
      } catch (e) {
        console.error('Failed to mirror volunteers snapshot locally', e);
      }
      callback(sorted);
    }, (error) => {
      if (!isPermissionDeniedError(error)) {
        console.error('subscribeVolunteersRealtime error', error);
      }
    });
  },

  subscribeMonthScheduleRealtime(
    year: number,
    month: number,
    callback: (rows: CombinedScheduleRow[]) => void
  ): Unsubscribe {
    if (!db) return () => {};

    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const nextMonth = month === 11 ? 1 : month + 2;
    const nextYear = month === 11 ? year + 1 : year;
    const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const eventsQuery = query(
      collection(db, COLLECTIONS.events),
      where('date', '>=', start),
      where('date', '<', end)
    );

    const assignmentsQuery = query(collection(db, COLLECTIONS.assignments));

    let latestEvents: MassEvent[] | null = null;
    let latestAssignments: ScheduleAssignment[] | null = null;

    const emitIfReady = async () => {
      if (!latestEvents || !latestAssignments) return;
      const eventIdSet = new Set(latestEvents.map(e => e.id));
      const filteredAssignments = latestAssignments.filter(a => eventIdSet.has(a.eventId));
      const rows: CombinedScheduleRow[] = latestEvents
        .map(event => ({
          event,
          assignment: filteredAssignments.find(a => a.eventId === event.id) || { eventId: event.id }
        }))
        .sort((a, b) => {
          if (a.event.date !== b.event.date) return a.event.date.localeCompare(b.event.date);
          if (a.event.time !== b.event.time) return a.event.time.localeCompare(b.event.time);
          return a.event.number - b.event.number;
        });

      try {
        await dbService.cacheSnapshotLocally({ events: latestEvents, assignments: filteredAssignments });
      } catch (e) {
        console.error('Failed to mirror month snapshot locally', e);
      }
      callback(rows);
    };

    const unsubEvents = onSnapshot(eventsQuery, (snapshot) => {
      latestEvents = snapshot.docs.map(d => stripFirestoreMeta<MassEvent>(d.data()));
      void emitIfReady();
    }, (error) => {
      if (!isPermissionDeniedError(error)) {
        console.error('subscribeMonthScheduleRealtime events error', error);
      }
    });

    const unsubAssignments = onSnapshot(assignmentsQuery, (snapshot) => {
      latestAssignments = snapshot.docs.map(d => stripFirestoreMeta<ScheduleAssignment>(d.data()));
      void emitIfReady();
    }, (error) => {
      if (!isPermissionDeniedError(error)) {
        console.error('subscribeMonthScheduleRealtime assignments error', error);
      }
    });

    return () => {
      unsubEvents();
      unsubAssignments();
    };
  },
  async saveAssignment(assignment: ScheduleAssignment) {
    await assertWriteAccess();
    if (db) {
      await ensureFirebaseAuth();
      await ensureCloudBootstrap();
      await setDoc(
        doc(db, COLLECTIONS.assignments, assignment.eventId),
        serializeForCloud(assignment),
        { merge: true }
      );
    }
    const result = await mirrorToLocal.saveAssignment(assignment);
    await logActivity('ASSIGNMENT_SAVE', { eventId: assignment.eventId });
    return result;
  },
  async clearMonthAssignments(eventIds: string[]) {
    await assertWriteAccess();
    if (db) {
      await ensureFirebaseAuth();
      await ensureCloudBootstrap();
      await Promise.all(eventIds.map(id => deleteDoc(doc(db, COLLECTIONS.assignments, id))));
    }
    await mirrorToLocal.clearAssignments(eventIds);
    await logActivity('ASSIGNMENT_CLEAR', { eventCount: eventIds.length });
  },

  // --- Backup & Restore ---
  async exportDatabase() {
    const { volunteers, events, assignments } = await getCloudSnapshot();
    
    await logActivity('EXPORT_DATA', {
        volunteersCount: volunteers.length,
        eventsCount: events.length,
        assignmentsCount: assignments.length
    });
    
    const payload = {
      version: 1,
      timestamp: new Date().toISOString(),
      data: { volunteers, events, assignments }
    };

    if (db) {
      await ensureFirebaseAuth();
      await addDoc(collection(db, COLLECTIONS.backups), {
        ...payload,
        createdAt: serverTimestamp()
      });
    }

    return JSON.stringify(payload, null, 2);
  },

  async importDatabase(jsonString: string) {
    try {
      await assertWriteAccess();
      const parsed = JSON.parse(jsonString);
      
      // Basic validation
      if (!parsed || typeof parsed !== 'object') {
        console.error("Invalid JSON structure");
        return false;
      }

      // Support both wrapped structure (data.volunteers) and direct structure fallback
      const data = parsed.data || parsed;

      // Extract arrays with safety checks
      const volunteers = Array.isArray(data.volunteers) ? data.volunteers : [];
      const events = Array.isArray(data.events) ? data.events : [];
      const assignments = Array.isArray(data.assignments) ? data.assignments : [];

      console.log(`Restoring: ${volunteers.length} volunteers, ${events.length} events, ${assignments.length} assignments`);

      await mirrorToLocal.replaceAll(volunteers, events, assignments);

      if (db) {
        try {
          await ensureFirebaseAuth();
          await ensureCloudBootstrap();
          const [oldVolunteers, oldEvents, oldAssignments] = await Promise.all([
            getDocs(collection(db, COLLECTIONS.volunteers)),
            getDocs(collection(db, COLLECTIONS.events)),
            getDocs(collection(db, COLLECTIONS.assignments))
          ]);
          const operations = [
            ...oldVolunteers.docs.map(d => ({ type: 'delete' as const, ref: d.ref })),
            ...oldEvents.docs.map(d => ({ type: 'delete' as const, ref: d.ref })),
            ...oldAssignments.docs.map(d => ({ type: 'delete' as const, ref: d.ref })),
            ...volunteers.map(v => ({
              type: 'set' as const,
              ref: doc(db, COLLECTIONS.volunteers, v.id),
              payload: serializeForCloud(v)
            })),
            ...events.map(e => ({
              type: 'set' as const,
              ref: doc(db, COLLECTIONS.events, e.id),
              payload: serializeForCloud(e)
            })),
            ...assignments.map(a => ({
              type: 'set' as const,
              ref: doc(db, COLLECTIONS.assignments, a.eventId),
              payload: serializeForCloud(a)
            }))
          ];

          for (const group of chunkArray(operations)) {
            const cloudBatch = writeBatch(db);
            group.forEach(op => {
              if (op.type === 'delete') {
                cloudBatch.delete(op.ref);
              } else {
                cloudBatch.set(op.ref, op.payload);
              }
            });
            await cloudBatch.commit();
          }

          await addDoc(collection(db, COLLECTIONS.backups), {
            version: parsed.version || 1,
            restoredAt: serverTimestamp(),
            data: { volunteers, events, assignments }
          });
        } catch (cloudError) {
          console.error('Cloud restore failed, local restore completed:', cloudError);
        }
      }

      await logActivity('IMPORT_DATA', {
        volunteersCount: volunteers.length,
        eventsCount: events.length,
        assignmentsCount: assignments.length
      });

      return true;
    } catch (e) {
      console.error("Import failed:", e);
      return false;
    }
  },

  // --- Homilies ---
  async getHomilies(): Promise<string[]> {
    if (!db) return [];
    await ensureFirebaseAuth();
    const snapshot = await getDocs(collection(db, COLLECTIONS.homilies));
    return snapshot.docs.map(d => d.id).sort((a, b) => a.localeCompare(b));
  },

  async addHomily(name: string) {
    if (!db) return;
    await assertWriteAccess();
    await setDoc(doc(db, COLLECTIONS.homilies, name), {
      name,
      createdAt: serverTimestamp()
    });
    await logActivity('HOMILY_ADD', { name });
  },

  async updateHomily(oldName: string, newName: string) {
    if (!db) return;
    await assertWriteAccess();
    const batch = writeBatch(db);
    batch.delete(doc(db, COLLECTIONS.homilies, oldName));
    batch.set(doc(db, COLLECTIONS.homilies, newName), {
      name: newName,
      createdAt: serverTimestamp()
    });
    await batch.commit();
    await logActivity('HOMILY_UPDATE', { oldName, newName });
  },

  async deleteHomily(name: string) {
    if (!db) return;
    await assertWriteAccess();
    await deleteDoc(doc(db, COLLECTIONS.homilies, name));
    await logActivity('HOMILY_DELETE', { name });
  }
};
