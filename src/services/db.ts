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
import { Volunteer, MassEvent, ScheduleAssignment, CombinedScheduleRow } from '../types';
import { ADMIN_EMAILS, db, ensureFirebaseAuth, getCurrentUserEmail, logActivity } from './firebase';

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
}

const DB_NAME = 'church-scheduler-db';
const DB_VERSION = 2;

const COLLECTIONS = {
  volunteers: 'volunteers',
  events: 'events',
  assignments: 'assignments',
  backups: 'backups',
  admins: 'admins'
} as const;

let dbPromise: Promise<IDBPDatabase<AppDB>> | null = null;
let bootstrapPromise: Promise<void> | null = null;

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
      },
    });
  }
  return dbPromise;
};

const isCloudEnabled = !!db;

const assertWriteAccess = async () => {
  if (!db) return;
  await ensureFirebaseAuth();
  const currentEmail = getCurrentUserEmail().toLowerCase();
  
  // We'll need to check both static and dynamic admins here.
  // For simplicity during transition, we'll allow current super-admins 
  // and we'll check Firestore for dynamic ones if possible.
  // But wait, dbService.isAdmin is not available here easily without circular dep or async.
  // Let's use a simpler check: if it's in hardcoded list, it's fine. 
  // If not, we'll need to fetch the admin list once or check the specific doc.
  
  if (ADMIN_EMAILS.includes(currentEmail)) return;
  
  const adminDoc = await getDoc(doc(db, COLLECTIONS.admins, currentEmail));
  if (!adminDoc.exists()) {
    throw new Error('READ_ONLY_ACCESS');
  }
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
      await batch.commit();
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
  async getAllAdmins(): Promise<{ email: string, addedAt: any }[]> {
    if (!db) return [];
    await ensureFirebaseAuth();
    const snapshot = await getDocs(collection(db, COLLECTIONS.admins));
    return snapshot.docs.map(d => ({ email: d.data().email, addedAt: d.data().addedAt }));
  },

  async addAdmin(email: string) {
    await assertWriteAccess();
    if (!db) return;
    const emailLower = email.toLowerCase();
    await setDoc(doc(db, COLLECTIONS.admins, emailLower), {
      email: emailLower,
      addedAt: serverTimestamp()
    });
    await logActivity('ADMIN_ADD' as any, { email: emailLower });
  },

  async removeAdmin(email: string) {
    await assertWriteAccess();
    if (!db) return;
    const emailLower = email.toLowerCase();
    if (ADMIN_EMAILS.includes(emailLower)) {
      throw new Error('CANNOT_REMOVE_SUPER_ADMIN');
    }
    await deleteDoc(doc(db, COLLECTIONS.admins, emailLower));
    await logActivity('ADMIN_REMOVE' as any, { email: emailLower });
  },

  async getAllVolunteers(): Promise<Volunteer[]> {
    if (!db) {
      return (await getDB()).getAll('volunteers');
    }
    await ensureFirebaseAuth();
    await ensureCloudBootstrap();
    const snapshot = await getDocs(collection(db, COLLECTIONS.volunteers));
    return snapshot.docs.map(d => stripFirestoreMeta<Volunteer>(d.data()));
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
    await ensureFirebaseAuth();
    await ensureCloudBootstrap();
    const results = await Promise.all(
      eventIds.map(id => getDoc(doc(db, COLLECTIONS.assignments, id)))
    );
    return results
      .map(r => (r.exists() ? stripFirestoreMeta<ScheduleAssignment>(r.data()) : null))
      .filter((r): r is ScheduleAssignment => !!r);
  },

  async getAssignmentsLocal(eventIds: string[]): Promise<ScheduleAssignment[]> {
    const dbLocal = await getDB();
    const results = await Promise.all(eventIds.map(id => dbLocal.get('assignments', id)));
    return results.filter((r): r is ScheduleAssignment => !!r);
  },

  async cacheSnapshotLocally(params: { volunteers?: Volunteer[]; events?: MassEvent[]; assignments?: ScheduleAssignment[] }) {
    const dbLocal = await getDB();
    const tx = dbLocal.transaction(['volunteers', 'events', 'assignments'], 'readwrite');
    const { volunteers = [], events = [], assignments = [] } = params;
    await Promise.all([
      ...volunteers.map(v => tx.objectStore('volunteers').put(v)),
      ...events.map(e => tx.objectStore('events').put(e)),
      ...assignments.map(a => tx.objectStore('assignments').put(a)),
    ]);
    await tx.done;
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
      console.error('subscribeVolunteersRealtime error', error);
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
      console.error('subscribeMonthScheduleRealtime events error', error);
    });

    const unsubAssignments = onSnapshot(assignmentsQuery, (snapshot) => {
      latestAssignments = snapshot.docs.map(d => stripFirestoreMeta<ScheduleAssignment>(d.data()));
      void emitIfReady();
    }, (error) => {
      console.error('subscribeMonthScheduleRealtime assignments error', error);
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
  }
};
