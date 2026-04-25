import React, { useState, useRef, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ScheduleDashboard } from './components/ScheduleDashboard';
import { CalendarManager } from './components/CalendarManager';
import { VolunteerManager } from './components/VolunteerManager';
import { UnavailableManager } from './components/UnavailableManager';
import { InspirationManager } from './components/InspirationManager';
import { LoadingOverlay } from './components/LoadingOverlay';
import { AdminUserManager } from './components/AdminUserManager';
import { dbService } from './services/db';
import { format } from 'date-fns';
import { Download, Upload, AlertTriangle, Aperture, Smartphone, CheckCircle, Info, LogOut, LogIn, Loader2 } from 'lucide-react';
import { sendNotification } from './services/utils';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { motion, AnimatePresence } from 'motion/react';
import { AlertType, showAlert } from './services/alertService';
import { ADMIN_EMAILS, logActivity, loginWithGoogle, logoutFirebase, watchAuthState, watchAdmins } from './services/firebase';
import { initializeNativeDownloadNotifications } from './services/nativeDownloadNotifications';

import { CombinedScheduleRow, Volunteer } from './types';

function App() {
  // Initialize tab from localStorage or default to 'home'
  const [currentTab, setCurrentTab] = useState(() => localStorage.getItem('activeTab') || 'home');
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [dataVersion, setDataVersion] = useState(0); 
  
  const [showConfirmRestore, setShowConfirmRestore] = useState(false);
  const [fileToRestore, setFileToRestore] = useState<File | null>(null);
  const [alertData, setAlertData] = useState<{message: string, type: AlertType} | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('isLoggedIn') === 'true');
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('isAdmin') === 'true');
  const [userEmail, setUserEmail] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  
  // PWA Install Prompt State
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Global Data State
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [scheduleRows, setScheduleRows] = useState<CombinedScheduleRow[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthCacheRef = useRef<Map<string, CombinedScheduleRow[]>>(new Map());
  const monthFetchInFlightRef = useRef<Map<string, Promise<CombinedScheduleRow[]>>>(new Map());
  const [showFetchingMonth, setShowFetchingMonth] = useState(false);
  const fetchingIndicatorTimerRef = useRef<number | null>(null);
  const [isPrefetchingRange, setIsPrefetchingRange] = useState(false);
  const [prefetchProgress, setPrefetchProgress] = useState<{ done: number; total: number } | null>(null);
  const prefetchStartedRef = useRef(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let adminUnsubscribe: (() => void) | null = null;
    
    const authUnsubscribe = watchAuthState((user) => {
      const isAuth = !!user;
      setIsAuthenticated(isAuth);
      localStorage.setItem('isLoggedIn', isAuth ? 'true' : 'false');

      const email = (user?.email || '').toLowerCase();
      setUserEmail(email);
      
      // Cleanup previous admin listener if any
      if (adminUnsubscribe) adminUnsubscribe();
      
      if (isAuth) {
        adminUnsubscribe = watchAdmins((adminEmails) => {
          const isUserAdmin = adminEmails.includes(email);
          setIsAdmin(isUserAdmin);
          localStorage.setItem('isAdmin', isUserAdmin ? 'true' : 'false');
        });
        logActivity('APP_LOAD');
      } else {
        setIsAdmin(false);
        localStorage.removeItem('isAdmin');
      }
      
      setAuthReady(true);
    });

    return () => {
      authUnsubscribe();
      if (adminUnsubscribe) adminUnsubscribe();
    };
  }, []);

  useEffect(() => {
    initializeNativeDownloadNotifications();
  }, []);

  const getMonthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const fetchMonthData = async (
    monthDate: Date,
    opts?: { forceRefresh?: boolean; preferLocal?: boolean; writeToLocal?: boolean }
  ) => {
    const key = getMonthKey(monthDate);
    const forceRefresh = !!opts?.forceRefresh;
    const preferLocal = opts?.preferLocal !== false;
    const writeToLocal = opts?.writeToLocal !== false;

    if (!forceRefresh) {
      const cached = monthCacheRef.current.get(key);
      if (cached) return Promise.resolve(cached);
    }

    // 0) Try local IndexedDB first (instant on refresh)
    if (!forceRefresh && preferLocal) {
      const localEvents = await dbService.getEventsByMonthLocal(monthDate.getFullYear(), monthDate.getMonth());
      if (localEvents.length > 0) {
        if (volunteers.length === 0) {
          const localVols = await dbService.getAllVolunteersLocal();
          if (localVols.length > 0) {
            const sorted = [...localVols].sort((a, b) => a.name.localeCompare(b.name));
            setVolunteers(sorted);
          }
        }
        const localAssignments = await dbService.getAssignmentsLocal(localEvents.map(e => e.id));
        const combinedLocal: CombinedScheduleRow[] = localEvents.map(event => {
          const assignment = localAssignments.find(a => a.eventId === event.id) || { eventId: event.id };
          return { event, assignment };
        });
        monthCacheRef.current.set(key, combinedLocal);
        return combinedLocal;
      }
    }

    const existingInFlight = monthFetchInFlightRef.current.get(key);
    if (existingInFlight) return existingInFlight;

    const p = (async () => {
      const [events, allVolunteers] = await Promise.all([
        dbService.getEventsByMonth(monthDate.getFullYear(), monthDate.getMonth()),
        volunteers.length === 0 ? dbService.getAllVolunteers() : Promise.resolve(volunteers)
      ]);

      const assignments = await dbService.getAssignments(events.map(e => e.id));

      if (volunteers.length === 0) {
        const sortedVolunteers = [...allVolunteers].sort((a, b) => a.name.localeCompare(b.name));
        setVolunteers(sortedVolunteers);
      }

      // Persist to local IndexedDB so refresh is instant next time
      if (writeToLocal) {
        try {
          await dbService.cacheSnapshotLocally({
            volunteers: volunteers.length === 0 ? allVolunteers : [],
            events,
            assignments
          });
        } catch (e) {
          console.error('Failed to cache month snapshot locally', e);
        }
      }

      const combined: CombinedScheduleRow[] = events.map(event => {
        const assignment = assignments.find(a => a.eventId === event.id) || { eventId: event.id };
        return { event, assignment };
      });

      monthCacheRef.current.set(key, combined);
      return combined;
    })()
      .finally(() => {
        monthFetchInFlightRef.current.delete(key);
      });

    monthFetchInFlightRef.current.set(key, p);
    return p;
  };

  const prefetchMonthRange = async (center: Date, monthsBack: number, monthsForward: number, blockUI = true) => {
    const offsets: number[] = [];
    for (let i = -monthsBack; i <= monthsForward; i++) offsets.push(i);

    // Build unique month keys to avoid double work
    const uniqueMonths = offsets.map(off => new Date(center.getFullYear(), center.getMonth() + off, 1));
    const total = uniqueMonths.length;
    setPrefetchProgress({ done: 0, total });
    setIsPrefetchingRange(true);
    if (blockUI) {
      setLoadingMessage('Menyiapkan data...');
      setLoading(true);
    }

    try {
      // Limit concurrency to keep Firebase/IndexedDB stable on mobile
      const concurrency = 3;
      let done = 0;
      let idx = 0;

      const worker = async () => {
        while (idx < uniqueMonths.length) {
          const currentIdx = idx++;
          const d = uniqueMonths[currentIdx];
          // Force cloud fetch and persist locally so refresh won't need downloading again
          await fetchMonthData(d, { forceRefresh: true, preferLocal: false, writeToLocal: true });
          done++;
          setPrefetchProgress({ done, total });
          if (blockUI) setLoadingMessage(`Mengunduh data ${done}/${total} bulan...`);
        }
      };

      await Promise.all(Array.from({ length: concurrency }, () => worker()));
    } finally {
      setIsPrefetchingRange(false);
      setPrefetchProgress(null);
      if (blockUI) {
        setLoading(false);
        setLoadingMessage('');
      }
    }
  };

  const loadGlobalData = async (silent = false, showIndicator = true) => {
    let startedIndicator = false;
    try {
      const key = getMonthKey(currentMonth);

      // 1) Instant render from cache (if available)
      const cached = monthCacheRef.current.get(key);
      if (cached && cached.length > 0) {
        setScheduleRows(cached);
      }

      const shouldShowIndicator = showIndicator || !cached;

      // 2) Local-first fetch for instant UX on refresh/open
      if (shouldShowIndicator) {
        if (fetchingIndicatorTimerRef.current) window.clearTimeout(fetchingIndicatorTimerRef.current);
        setShowFetchingMonth(false);
        fetchingIndicatorTimerRef.current = window.setTimeout(() => setShowFetchingMonth(true), 200);
        startedIndicator = true;
      }
      const localFirst = await fetchMonthData(currentMonth, { forceRefresh: false, preferLocal: true, writeToLocal: true });
      setScheduleRows(localFirst);

      // 3) Always refresh from cloud to avoid stale data across devices
      const cloudFresh = await fetchMonthData(currentMonth, { forceRefresh: true, preferLocal: false, writeToLocal: true });
      setScheduleRows(cloudFresh);

      // 4) Prefetch adjacent months (6 steps) in background
      for (let off = -6; off <= 6; off++) {
        if (off === 0) continue;
        const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + off, 1);
        void fetchMonthData(d, { forceRefresh: false, preferLocal: true, writeToLocal: true });
      }
    } catch (e) {
      console.error("Failed to load global data", e);
    } finally {
      // If we started the indicator in this run, always stop it.
      if (startedIndicator) {
        if (fetchingIndicatorTimerRef.current) window.clearTimeout(fetchingIndicatorTimerRef.current);
        fetchingIndicatorTimerRef.current = null;
        setShowFetchingMonth(false);
      }
    }
  };

  const reloadData = async () => {
    // Force refresh current month after writes (assignments/events changes).
    const key = getMonthKey(currentMonth);
    monthCacheRef.current.delete(key);
    // Also refresh local snapshot for this month
    await fetchMonthData(currentMonth, { forceRefresh: true, preferLocal: false, writeToLocal: true });
    await loadGlobalData(true, false);
  };

  useEffect(() => {
    if (isAuthenticated) {
      // On first open after auth, prefetch +/-6 months so switching months is instant.
      if (!prefetchStartedRef.current && authReady) {
        prefetchStartedRef.current = true;
        void (async () => {
          try {
            // If we already have local data for the current month, don't block UI on refresh/open.
            const localEvents = await dbService.getEventsByMonthLocal(currentMonth.getFullYear(), currentMonth.getMonth());
            const hasLocal = localEvents.length > 0;

            if (!hasLocal) {
              await prefetchMonthRange(currentMonth, 6, 6, true);
            } else {
              // Show current month instantly from local, and prefetch range in background.
              await loadGlobalData(true, false);
              void prefetchMonthRange(currentMonth, 6, 6, false);
              return;
            }
          } catch (e) {
            console.error('Prefetch range failed', e);
          } finally {
            // After prefetch completes (or fails), ensure current month data is shown (no indicator).
            await loadGlobalData(true, false);
          }
        })();
      } else {
        // Normal refresh when month changes: show cached immediately, refresh silently.
        loadGlobalData(true, false);
      }
    }
  }, [isAuthenticated, currentMonth, dataVersion, authReady]);

  useEffect(() => {
    if (!isAuthenticated || !authReady) return;

    const unsubVolunteers = dbService.subscribeVolunteersRealtime((vols) => {
      setVolunteers(vols);
    });

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const monthKey = getMonthKey(currentMonth);

    const unsubMonth = dbService.subscribeMonthScheduleRealtime(year, month, (rows) => {
      monthCacheRef.current.set(monthKey, rows);
      setScheduleRows(rows);
      // Ensure fetching indicator does not get stuck if realtime update arrives first.
      if (fetchingIndicatorTimerRef.current) {
        window.clearTimeout(fetchingIndicatorTimerRef.current);
        fetchingIndicatorTimerRef.current = null;
      }
      setShowFetchingMonth(false);
    });

    return () => {
      unsubVolunteers();
      unsubMonth();
    };
  }, [isAuthenticated, authReady, currentMonth]);

  useEffect(() => {
    if (currentTab === 'settings') {
      setCurrentTab(isAdmin ? 'volunteers' : 'home');
      return;
    }
    if (!isAdmin && currentTab !== 'home' && currentTab !== 'inspiration' && currentTab !== 'calendar') {
      setCurrentTab('home');
    }
  }, [isAdmin, currentTab]);

  // Save tab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('activeTab', currentTab);
  }, [currentTab]);

  // Listen for PWA install event
  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    const alertHandler = (e: any) => {
      setAlertData(e.detail);
    };
    window.addEventListener('app-alert', alertHandler);
    return () => window.removeEventListener('app-alert', alertHandler);
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    
    // Show the install prompt
    installPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleLogin = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      await loginWithGoogle();
    } catch (error: any) {
      const code = error?.code || '';
      if (code.includes('popup-closed-by-user')) {
        setAuthError('Login dibatalkan.');
      } else if (code.includes('popup-blocked')) {
        setAuthError('Popup login diblokir browser. Izinkan popup lalu coba lagi.');
      } else {
        setAuthError('Gagal login Google. Periksa konfigurasi Firebase Auth.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutFirebase();
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('isAdmin');
    setCurrentTab('home');
  };

  const handleBackup = async () => {
    try {
      setLoadingMessage('Menyiapkan backup...');
      setLoading(true);
      const data = await dbService.exportDatabase();
      
      const dateStr = format(new Date(), 'ddMMyyyy');
      const filename = `Backup-${dateStr}-TugasKreatif.json`;

      if (Capacitor.isNativePlatform()) {
        // Native Backup using Filesystem and Share
        const result = await Filesystem.writeFile({
          path: filename,
          data: data,
          directory: Directory.Cache,
          encoding: Encoding.UTF8,
        });

        await Share.share({
          title: 'Backup Tugas Kreatif',
          text: 'File backup data Tugas Kreatif',
          url: result.uri,
          dialogTitle: 'Simpan atau Bagikan Backup',
        });
      } else {
        // Browser Backup
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      setLoading(false);
      sendNotification("Backup Berhasil", `Data telah diproses.`);
      
    } catch (e) {
      setLoading(false);
      console.error(e);
      showAlert("Gagal backup.");
    }
  };

  const handleRestoreClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileToRestore(file);
      setShowConfirmRestore(true);
    }
  };

  const handleCancelRestore = () => {
    setShowConfirmRestore(false);
    setFileToRestore(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processRestore = () => {
    if (!fileToRestore) return;
    setShowConfirmRestore(false);
    setLoadingMessage('Memulihkan data...');
    setLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const success = await dbService.importDatabase(e.target?.result as string);
        if (success) {
          setDataVersion(v => v + 1);
          setLoading(false);
        } else {
          throw new Error();
        }
      } catch (err) {
        setLoading(false);
        showAlert("Gagal restore file.");
      }
    };
    reader.readAsText(fileToRestore);
    setFileToRestore(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const renderContent = () => {
    const key = `${currentTab}-${dataVersion}`;
    return (
      <div className="px-3 sm:px-4 md:px-6">
        {/* Keep Jadwal & Kalender mounted for instant tab switches */}
        <div className={currentTab === 'home' ? 'block' : 'hidden'}>
          <ScheduleDashboard isFetchingData={showFetchingMonth} readOnly={!isAdmin} volunteers={volunteers} scheduleRows={scheduleRows} reloadData={reloadData} currentMonth={currentMonth} setCurrentMonth={setCurrentMonth} />
        </div>

        <div className={currentTab === 'calendar' ? 'block' : 'hidden'}>
          <CalendarManager isFetchingData={showFetchingMonth} readOnly={!isAdmin} volunteers={volunteers} scheduleRows={scheduleRows} reloadData={reloadData} currentMonth={currentMonth} setCurrentMonth={setCurrentMonth} />
        </div>

        {/* Persistent Inspiration View */}
        <div className={currentTab === 'inspiration' ? 'block' : 'hidden'}>
          <InspirationManager />
        </div>

        <AnimatePresence mode="wait">
          {currentTab !== 'home' && currentTab !== 'calendar' && currentTab !== 'inspiration' && (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              {(() => {
                switch (currentTab) {
                  case 'volunteers':
                    return (
                      <VolunteerManager
                        key={key}
                        volunteers={volunteers}
                        reloadData={reloadData}
                        adminPanel={
                          isAdmin ? (
                            <AdminUserManager onBackup={handleBackup} onRestore={handleRestoreClick} />
                          ) : null
                        }
                      />
                    );
                  case 'unavailable': return <UnavailableManager key={key} volunteers={volunteers} reloadData={reloadData} />;
                  default: return null;
                }
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4 relative overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-100 rounded-full blur-3xl opacity-60 animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-3xl opacity-60 animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[400px] relative z-10"
        >
          <div className="bg-white rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-100 p-8 sm:p-10 text-center">
            {/* Logo Section */}
            <div className="mb-8 flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-900 rounded-[2rem] flex items-center justify-center shadow-xl shadow-slate-200 mb-6 rotate-3 hover:rotate-0 transition-transform duration-500">
                <Aperture className="text-white w-10 h-10" strokeWidth={1.5} />
              </div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2" style={{ fontFamily: 'cursive', fontStyle: 'italic' }}>Tim Kreatif</h1>
              <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 rounded-full border border-slate-100">
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">Paroki Katedral Medan</span>
              </div>
            </div>

            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-slate-800">Selamat Datang</h2>
                <p className="text-sm text-slate-500 mt-1">Silakan masuk untuk mengelola jadwal pelayanan kreatif Anda.</p>
              </div>

              {authError && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 bg-red-50 border border-red-100 rounded-2xl text-left flex gap-3"
                >
                  <AlertTriangle className="text-red-500 shrink-0" size={18} />
                  <p className="text-xs text-red-600 font-medium leading-relaxed">{authError}</p>
                </motion.div>
              )}

              <button 
                type="button" 
                onClick={handleLogin} 
                disabled={authLoading} 
                className="group relative w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg shadow-xl shadow-slate-200 hover:bg-slate-800 active:scale-[0.98] transition-all disabled:opacity-70 flex items-center justify-center gap-3"
              >
                {authLoading ? (
                  <Loader2 className="animate-spin" size={22} />
                ) : (
                  <>
                    <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
                    <span>Login dengan Google</span>
                  </>
                )}
              </button>

              <div className="pt-4">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[0.2em]">Kreatifitas untuk Kemuliaan Tuhan</p>
              </div>
            </div>
          </div>
          
          {/* Footer Info */}
          <div className="mt-8 text-center">
            <p className="text-xs text-slate-400 font-medium">© 2024 Tim Kreatif Katedral Medan</p>
          </div>
        </motion.div>
      </div>
    );
  }



  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 font-sans">
      {loading && <LoadingOverlay message={loadingMessage} />}

      {showConfirmRestore && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
             <div className="text-center">
                <AlertTriangle className="text-yellow-600 w-12 h-12 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Konfirmasi Restore</h3>
                <p className="text-slate-600 text-sm mb-6">Data yang ada akan dihapus dan diganti dengan isi file backup. Lanjutkan?</p>
                <div className="flex gap-3">
                                    <button onClick={handleCancelRestore} className="flex-1 bg-gray-100 py-3 rounded-xl font-bold">Batal</button>
                  <button onClick={processRestore} className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold">Restore</button>
                </div>
             </div>
          </div>
        </div>
      )}

      {alertData && (
        <div className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            {alertData.type === 'error' && <AlertTriangle className="text-red-500 w-12 h-12 mx-auto mb-4" />}
            {alertData.type === 'success' && <CheckCircle className="text-emerald-500 w-12 h-12 mx-auto mb-4" />}
            {alertData.type === 'info' && <Info className="text-blue-500 w-12 h-12 mx-auto mb-4" />}
            <h3 className="text-xl font-bold mb-2">
              {alertData.type === 'error' ? 'Peringatan' : alertData.type === 'success' ? 'Berhasil' : 'Informasi'}
            </h3>
            <p className="text-slate-600 text-sm mb-6 whitespace-pre-wrap">{alertData.message}</p>
            <button onClick={() => setAlertData(null)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Tutup</button>
          </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />

      <div className="bg-white border-b sticky top-0 z-40 px-3 sm:px-4 md:px-6 py-3 shadow-sm">
        <div className="w-full md:w-[80%] mx-auto flex justify-between items-center gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
           {/* Logo Image Placeholder / Icon Fallback */}
           <div className="relative flex items-center justify-center w-12 h-12 bg-white border-2 border-slate-900 rounded-full shadow-sm overflow-hidden">
              <Aperture className="text-slate-900 w-8 h-8" strokeWidth={1.5} />
           </div>
           <div className="flex flex-col justify-center min-w-0">
              <h1 className="font-black text-slate-900 text-lg sm:text-xl leading-none tracking-tight truncate" style={{ fontFamily: 'cursive', fontStyle: 'italic' }}>Tim Kreatif</h1>
              <span className="text-[10px] text-slate-800 font-bold tracking-wide mt-0.5">Paroki Katedral Medan</span>
           </div>
        </div>
        <div className="flex gap-1.5 sm:gap-2 shrink-0">
           {installPrompt && (
              <button 
                onClick={handleInstallClick}
                className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-sm animate-pulse flex items-center gap-2" 
                title="Install Aplikasi"
              >
                <Smartphone size={18} />
                <span className="text-xs font-bold hidden sm:inline">Install App</span>
              </button>
           )}
           
           <button onClick={handleLogout} className="p-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition shadow-sm border border-slate-200" title="Logout">
             <LogOut size={18} />
           </button>
        </div>
        </div>
      </div>

      <div className="w-full md:w-[80%] mx-auto pb-24 sm:pb-28">
        {renderContent()}
      </div>
      <Navbar currentTab={currentTab} setTab={setCurrentTab} isViewer={!isAdmin} />
    </div>
  );
}

export default App;
