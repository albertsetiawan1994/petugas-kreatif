import { initializeApp } from 'firebase/app';
import { addDoc, collection, getFirestore, serverTimestamp, onSnapshot, query } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Check if config is valid (at least apiKey and projectId should be there)
const isFirebaseEnabled = !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY');

const app = isFirebaseEnabled ? initializeApp(firebaseConfig) : null;
export const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;
const googleProvider = new GoogleAuthProvider();

export const ADMIN_EMAILS = ['albertse2602@gmail.com', 'chayania.farista@gmail.com'];

export const watchAdmins = (callback: (emails: string[]) => void) => {
  if (!db) {
    callback(ADMIN_EMAILS);
    return () => {};
  }
  const q = query(collection(db, 'admins'));
  return onSnapshot(q, (snapshot) => {
    const dynamicAdmins = snapshot.docs.map(d => d.data().email.toLowerCase());
    callback([...new Set([...ADMIN_EMAILS, ...dynamicAdmins])]);
  });
};

export const ensureFirebaseAuth = async (): Promise<void> => {
  if (!auth) return;
  if (!auth.currentUser) {
    throw new Error('AUTH_REQUIRED');
  }
};

export const watchAuthState = (callback: (user: User | null) => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
};

export const loginWithGoogle = async () => {
  if (!auth) throw new Error('FIREBASE_NOT_CONFIGURED');
  return signInWithPopup(auth, googleProvider);
};

export const logoutFirebase = async () => {
  if (!auth) return;
  await signOut(auth);
};

export const getCurrentUserEmail = (): string => {
  return auth?.currentUser?.email || '';
};

export type ActivityType = 
  | 'VOLUNTEER_ADD' | 'VOLUNTEER_EDIT' | 'VOLUNTEER_DELETE'
  | 'EVENT_ADD' | 'EVENT_EDIT' | 'EVENT_DELETE'
  | 'ASSIGNMENT_SAVE' | 'ASSIGNMENT_CLEAR'
  | 'CHAT_MESSAGE' | 'EXPORT_DATA' | 'IMPORT_DATA'
  | 'APP_LOAD' | 'ADMIN_ADD' | 'ADMIN_REMOVE';

export interface Activity {
  type: ActivityType;
  details: any;
  timestamp: any;
  userAgent?: string;
}

export const logActivity = async (type: ActivityType, details: any = {}) => {
  if (!db) {
    console.warn(`Firestore not initialized. Skipping log: ${type}`);
    return;
  }
  try {
    await ensureFirebaseAuth();
    const activitiesRef = collection(db, 'activities');
    await addDoc(activitiesRef, {
      type,
      details,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent
    });
  } catch (error) {
    console.error('Failed to log activity to Firestore:', error);
  }
};
