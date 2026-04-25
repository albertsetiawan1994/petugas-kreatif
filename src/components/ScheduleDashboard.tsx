import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MassEvent, Volunteer, ScheduleAssignment, CombinedScheduleRow, Role } from '../types';
import { dbService } from '../services/db';
import { toRoman, formatDateID, getMonthYearID, sendNotification } from '../services/utils';
import { ChevronLeft, ChevronRight, Tv, Mic, Video, Camera as PhotoIcon, CheckCircle2, Sparkles, Wand2, CloudCheck, Loader2, Camera, Image as ImageIcon, AlertTriangle } from 'lucide-react';
import { LoadingOverlay } from './LoadingOverlay';
import { format } from 'date-fns';
import { id } from 'date-fns/locale/id';
import { toBlob, toPng } from 'html-to-image';

interface CellSelectorProps {
  row: CombinedScheduleRow;
  role: string;
  val: string | undefined;
  field: keyof ScheduleAssignment;
  volunteers: Volunteer[];
  onChange: (eventId: string, field: keyof ScheduleAssignment, value: string) => void;
  onMagic: (eventId: string, field: keyof ScheduleAssignment, role: Role) => void;
  isImage: boolean;
  readOnly?: boolean;
  showMagicButton?: boolean;
}

const CellSelector: React.FC<CellSelectorProps> = ({ row, role, val, field, volunteers, onChange, onMagic, isImage, readOnly = false, showMagicButton = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [localQuery, setLocalQuery] = useState('');
  const cellRef = useRef<HTMLDivElement | null>(null);
  const isSoundRole = role.toUpperCase().replace(/\s/g, '') === 'SOUND';

  const getDisplayValue = (value?: string) => {
    if (!value) return '-';
    if (isSoundRole && !/\(A\)\s*$/i.test(value)) {
      return `${value} (A)`;
    }
    return value;
  };

  useEffect(() => {
    if (!isOpen) return;

    const onDocumentMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!cellRef.current?.contains(target)) setIsOpen(false);
    };

    const onDocumentKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', onDocumentMouseDown);
    document.addEventListener('keydown', onDocumentKeyDown);

    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown);
      document.removeEventListener('keydown', onDocumentKeyDown);
    };
  }, [isOpen]);

  const filteredVolunteers = useMemo(() => {
    const q = localQuery.trim().toLowerCase();
    if (!q) return volunteers;
    return volunteers.filter(v => v.name.toLowerCase().includes(q));
  }, [volunteers, localQuery]);

  useEffect(() => {
    // When switching to read-only or screenshot mode, ensure dropdown is closed.
    if (isImage || readOnly) {
      setIsOpen(false);
      setLocalQuery('');
    }
  }, [isImage, readOnly]);

  if (isImage || readOnly) {
    return <span className="font-bold text-slate-800">{getDisplayValue(val)}</span>;
  }

  return (
    <div ref={cellRef} className="relative w-full h-full group/cell">
      <button
        type="button"
        className="w-full h-full bg-transparent text-center font-medium text-slate-800 cursor-pointer hover:bg-gray-50 focus:bg-blue-50 transition-colors outline-none"
        onClick={() => {
          setIsOpen(prev => {
            const next = !prev;
            if (next) setLocalQuery('');
            return next;
          });
        }}
        style={{ lineHeight: 1.2 }}
        aria-label="Pilih petugas"
        title="Klik untuk pilih petugas"
      >
        {getDisplayValue(val)}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-[120] w-full md:w-max md:min-w-[220px] md:max-w-[320px] mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              autoFocus
              placeholder="Cari nama petugas..."
              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/30"
              aria-label="Cari nama petugas"
            />
          </div>
          <div className="max-h-64 overflow-auto">
            <button
              type="button"
              className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-indigo-50 transition-colors"
              onClick={() => {
                onChange(row.event.id, field, '');
                setIsOpen(false);
              }}
            >
              -
            </button>

            {filteredVolunteers.map(v => (
              <button
                type="button"
                key={v.id}
                className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-800 hover:bg-indigo-50 transition-colors"
                onClick={() => {
                  onChange(row.event.id, field, v.name);
                  setIsOpen(false);
                }}
              >
                {v.name}
              </button>
            ))}

            {filteredVolunteers.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400 font-bold">Tidak ada hasil</div>
            )}
          </div>
        </div>
      )}
      {showMagicButton && !val && (
        <button 
          onClick={() => onMagic(row.event.id, field, role as Role)}
          className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100 p-1 text-indigo-400 hover:text-indigo-600 transition-all hover:scale-110"
          title="Auto Fill"
        >
          <Sparkles size={14} />
        </button>
      )}
    </div>
  );
};

import { showAlert } from '../services/alertService';
import { logActivity } from '../services/firebase';
import { Capacitor } from '@capacitor/core';
import { fileUtils } from '../services/fileUtils';
import { notifyDownloadedFile } from '../services/nativeDownloadNotifications';

const DESKTOP_DATE_COL_MIN = 320;
const DESKTOP_DATE_COL_MAX = 320;
const DESKTOP_DATE_COL_WIDTH = `${DESKTOP_DATE_COL_MIN}px`;
const DESKTOP_TIME_COL_WIDTH = 96;
const CAPTURE_TIME_COL_WIDTH = 150;
const DESKTOP_MEDIA_COL_MIN = 150;
const DESKTOP_MEDIA_COL_MAX = 150;
const DESKTOP_MEDIA_COL_WIDTH = `${DESKTOP_MEDIA_COL_MIN}px`;
const DESKTOP_FOTO_COL_MIN = 220;
const DESKTOP_FOTO_COL_MAX = 220;
const DESKTOP_FOTO_COL_WIDTH = `${DESKTOP_FOTO_COL_MIN}px`;
const CAPTURE_WIDTH = 1560;
const CAPTURE_SIDE_PADDING = 80;

export const ScheduleDashboard: React.FC<{ 
  isFetchingData?: boolean,
  readOnly?: boolean, 
  volunteers: Volunteer[], 
  scheduleRows: CombinedScheduleRow[],
  reloadData: () => void,
  currentMonth: Date,
  setCurrentMonth: (date: Date) => void
}> = ({ isFetchingData = false, readOnly = false, volunteers, scheduleRows, reloadData, currentMonth: currentDate, setCurrentMonth: setCurrentDate }) => {
  const [rows, setRows] = useState<CombinedScheduleRow[]>(scheduleRows);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [highlightGen, setHighlightGen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Auto-save status state
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // State to force table view during image generation
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [captureRenderWidth, setCaptureRenderWidth] = useState(CAPTURE_WIDTH);
  
  // Download selection state
  const [downloadOption, setDownloadOption] = useState<string>('full');
  const [customScreenshotMode, setCustomScreenshotMode] = useState(false);
  const [customWeekInput, setCustomWeekInput] = useState('');
  const [captureWeekLabel, setCaptureWeekLabel] = useState<string | null>(null);
  
  const [viewFilter, setViewFilter] = useState<{ start: string | null, end: string | null, weeks: number[] | null }>({ start: null, end: null, weeks: null });

  useEffect(() => {
    setCurrentDate(currentDate);
  }, [currentDate]);

  useEffect(() => {
    setRows(scheduleRows);
  }, [scheduleRows]);


  /**
   * Generates a single cell assignment based on fair rotation logic
   */
  const handleSingleCellGenerate = async (eventId: string, field: keyof ScheduleAssignment, role: Role) => {
    if (readOnly) return;
    const row = rows.find(r => r.event.id === eventId);
    if (!row) return;

    const activeVols = volunteers.filter(v => 
        !v.isUnavailable && 
        !v.excludeFromAutoFill &&
        v.roles.some(r => r.toUpperCase().replace(/\s/g, '') === role.toUpperCase().replace(/\s/g, ''))
    );
    
    // Get assignments in this same mass to prevent double booking
    const currentAssigned = new Set<string>();
    Object.entries(row.assignment).forEach(([key, val]) => {
        if (key !== 'eventId' && val) currentAssigned.add(val as string);
    });

    // Candidates who are not already serving in this mass
    const candidates = activeVols.filter(v => !currentAssigned.has(v.name));

    if (candidates.length === 0) {
        showAlert("Tidak ada petugas yang tersedia untuk role ini di jam ini.");
        return;
    }

    // Logic: Rotation by current month usage then history
    const usageMap = new Map<string, number>();
    volunteers.forEach(v => usageMap.set(v.name, 0));
    rows.forEach(r => {
        Object.values(r.assignment).forEach(name => {
            if (typeof name === 'string' && usageMap.has(name)) {
                usageMap.set(name, (usageMap.get(name) || 0) + 1);
            }
        });
    });

    candidates.sort((a, b) => {
        const uA = usageMap.get(a.name) || 0;
        const uB = usageMap.get(b.name) || 0;
        if (uA !== uB) return uA - uB;
        return Math.random() - 0.5;
    });

    const selected = candidates[0];
    await handleUpdateCell(eventId, field, selected.name);
  };

  /**
   * Generates assignments for all roles in a single row (mass)
   */
  const handleRowGenerate = async (eventId: string) => {
    if (readOnly) return;
    const row = rows.find(r => r.event.id === eventId);
    if (!row) return;

    setIsSaving(true);

    try {
        const rolesToFill: {key: keyof ScheduleAssignment, role: Role}[] = [];
        
        // Only fill if needed (defaults to true if undefined)
        if (row.event.needsOBS !== false) rolesToFill.push({ key: 'obs', role: 'OBS' });
        if (row.event.needsSound !== false) rolesToFill.push({ key: 'sound', role: 'SOUND' });
        if (row.event.needsCam1 !== false) rolesToFill.push({ key: 'cam1', role: 'CAM 1' });
        
        if (row.event.isBigMass) rolesToFill.push({ key: 'cam2', role: 'CAM 2' });
        if (row.event.needsPhoto) rolesToFill.push({ key: 'foto', role: 'FOTO' });

        let updatedAssignment = { ...row.assignment };
        const assignedInRow = new Set<string>();

        // Clear current row assignments first
        rolesToFill.forEach(r => (updatedAssignment as any)[r.key] = undefined);

        for (const item of rolesToFill) {
            const candidates = volunteers.filter(v => 
                !v.isUnavailable && 
                !v.excludeFromAutoFill &&
                v.roles.some(r => r.toUpperCase().replace(/\s/g, '') === item.role.toUpperCase().replace(/\s/g, '')) && 
                !assignedInRow.has(v.name)
            );

            if (candidates.length > 0) {
                const usageMap = new Map<string, number>();
                volunteers.forEach(v => usageMap.set(v.name, 0));
                rows.forEach(r => {
                    Object.entries(r.assignment).forEach(([key, name]) => {
                        if (key !== 'eventId' && typeof name === 'string' && usageMap.has(name)) {
                            usageMap.set(name, (usageMap.get(name) || 0) + 1);
                        }
                    });
                });

                candidates.sort((a, b) => {
                    const uA = usageMap.get(a.name) || 0;
                    const uB = usageMap.get(b.name) || 0;
                    if (uA !== uB) return uA - uB;
                    return Math.random() - 0.5;
                });

                const selected = candidates[0];
                (updatedAssignment as any)[item.key] = selected.name;
                assignedInRow.add(selected.name);
            }
        }

        await dbService.saveAssignment(updatedAssignment);
        reloadData();
        setIsSaving(false);
        setLastSaved(new Date());
    } catch (e) {
        setIsSaving(false);
        showAlert("Gagal mengisi baris.");
    }
  };

  const handleUpdateCell = async (eventId: string, field: keyof ScheduleAssignment, value: string) => {
    if (readOnly) return;
    setIsSaving(true);
    // Optimistic Update
    const updatedRows = rows.map(r => {
        if (r.event.id === eventId) {
            return { ...r, assignment: { ...r.assignment, [field]: value } };
        }
        return r;
    });
    setRows(updatedRows);
    
    // Save to DB
    const rowToSave = updatedRows.find(r => r.event.id === eventId);
    if (rowToSave) {
        await dbService.saveAssignment(rowToSave.assignment);
    }
    
    // Simulate tiny delay for visual feedback if instant
    setTimeout(() => {
        setIsSaving(false);
        setLastSaved(new Date());
    }, 50); // Reduced from 300ms for faster feel
  };

  // --- VALIDATION AND DOWNLOAD LOGIC ---

  const checkValidation = (rowsToCheck: CombinedScheduleRow[]) => {
    for (const row of rowsToCheck) {
        const { event, assignment } = row;
        const missing: string[] = [];

        // Check if values are missing (undefined, empty string, or "-")
        // Only check if the role is needed (defaults to true if undefined)
        if ((event.needsOBS !== false) && (!assignment.obs || assignment.obs === '-')) missing.push('OBS');
        if ((event.needsSound !== false) && (!assignment.sound || assignment.sound === '-')) missing.push('Sound');
        if ((event.needsCam1 !== false) && (!assignment.cam1 || assignment.cam1 === '-')) missing.push('Cam1');
        
        if (event.isBigMass && (!assignment.cam2 || assignment.cam2 === '-')) missing.push('Cam2');
        if (event.needsPhoto && (!assignment.foto || assignment.foto === '-')) missing.push('Foto');

        if (missing.length > 0) {
            return {
                isValid: false,
                date: formatDateID(event.date),
                time: event.time,
                missing
            };
        }
    }
    return { isValid: true };
  };

  const handleScreenshotClick = async () => {
    if (customScreenshotMode) {
      const customWeeks = parseCustomWeekInput(customWeekInput);

      if (customWeeks.length === 0) {
        showAlert("Format custom screenshot tidak valid. Gunakan contoh seperti 1-3 atau 1,3,4.");
        return;
      }

      const customLabel = customWeekInput.replace(/\s+/g, '');
      const rowsToValidate = rows.filter(row => customWeeks.includes(getWeekOfMonth(row.event.date)));

      if (rowsToValidate.length === 0) {
        showAlert("Tidak ada jadwal pada minggu custom yang dipilih.");
        return;
      }

      const validation = checkValidation(rowsToValidate);
      if (!validation.isValid) {
        showAlert(`Gagal Screenshot! Data Belum Lengkap.\n\nMasih ada petugas kosong pada:\nHari: ${validation.date}\nJam: ${validation.time}\nPosisi: ${validation.missing?.join(', ')}\n\nMohon lengkapi (Generate/Isi Manual) semua kolom sebelum download.`);
        return;
      }

      await handleDownloadImage({ weeks: customWeeks, label: customLabel });
      resetCustomScreenshotMode();
      return;
    }

    const week = downloadOption === 'full' ? null : parseInt(downloadOption);
    
    // Pre-calculate visible rows for validation logic
    let rowsToValidate = [...rows];
    
    if (week !== null) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const startDate = new Date(year, month, (week - 1) * 7 + 1);
        const endDate = new Date(year, month, week * 7);
        if (week === 5) {
            endDate.setMonth(month + 1);
            endDate.setDate(0); 
        }
        const startStr = format(startDate, 'yyyy-MM-dd');
        const endStr = format(endDate, 'yyyy-MM-dd');
        
        rowsToValidate = rowsToValidate.filter(r => r.event.date >= startStr && r.event.date <= endStr);
    }

    if (rowsToValidate.length === 0) {
        showAlert("Tidak ada jadwal pada periode ini untuk di-download.");
        return;
    }

    const validation = checkValidation(rowsToValidate);
    if (!validation.isValid) {
        showAlert(`Gagal Screenshot! Data Belum Lengkap.\n\nMasih ada petugas kosong pada:\nHari: ${validation.date}\nJam: ${validation.time}\nPosisi: ${validation.missing?.join(', ')}\n\nMohon lengkapi (Generate/Isi Manual) semua kolom sebelum download.`);
        return;
    }

    await handleDownloadImage({ weeks: week !== null ? [week] : null, label: week !== null ? String(week) : 'full' });
  };

  const resetCustomScreenshotMode = () => {
    setCustomScreenshotMode(false);
    setCustomWeekInput('');
  };

  const parseCustomWeekInput = (value: string): number[] => {
    const normalized = value.replace(/\s+/g, '');
    if (!normalized) return [];

    const result = new Set<number>();
    const segments = normalized.split(',').filter(Boolean);

    for (const segment of segments) {
      if (segment.includes('-')) {
        const [startRaw, endRaw] = segment.split('-');
        const start = Number(startRaw);
        const end = Number(endRaw);

        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > 5 || start > end) {
          return [];
        }

        for (let week = start; week <= end; week += 1) {
          result.add(week);
        }
        continue;
      }

      const week = Number(segment);
      if (!Number.isInteger(week) || week < 1 || week > 5) {
        return [];
      }
      result.add(week);
    }

    return Array.from(result).sort((a, b) => a - b);
  };

  const getWeekOfMonth = (dateStr: string) => {
    const day = new Date(dateStr).getDate();
    return Math.min(5, Math.floor((day - 1) / 7) + 1);
  };

  const handleDownloadImage = async ({ weeks, label }: { weeks: number[] | null, label: string }) => {
    const isNativeMobileDownload = Capacitor.isNativePlatform() && Capacitor.getPlatform() !== 'web';
    setLoadingMessage(isNativeMobileDownload ? 'Menyiapkan tabel...' : 'Menyiapkan screenshot...');
    setLoading(true);
    setIsGeneratingImage(true); // Force switch to Table View
    setCaptureWeekLabel(weeks && weeks.length > 0 ? label : null);

    // 1. Calculate dates for filter
    let startStr = null;
    let endStr = null;
    const firstWeek = weeks && weeks.length > 0 ? weeks[0] : null;
    const lastWeek = weeks && weeks.length > 0 ? weeks[weeks.length - 1] : null;

    if (firstWeek !== null && lastWeek !== null) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const startDate = new Date(year, month, (firstWeek - 1) * 7 + 1);
        const endDate = new Date(year, month, lastWeek * 7);
        
        if (lastWeek === 5) {
            endDate.setMonth(month + 1);
            endDate.setDate(0); 
        }

        startStr = format(startDate, 'yyyy-MM-dd');
        endStr = format(endDate, 'yyyy-MM-dd');
    }

    // 2. Apply temporary filter to view
    setViewFilter({ start: startStr, end: endStr, weeks });

    setCaptureRenderWidth(CAPTURE_WIDTH);

    // 3. Wait for DOM update
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 4. Capture
    const element = document.getElementById('schedule-print-area');
    if (element) {
        try {
            if (isNativeMobileDownload) {
              setLoadingMessage('Membuat gambar screenshot...');
            }

            const captureWidth = CAPTURE_WIDTH;
            const captureHeight = Math.max(element.scrollHeight, element.offsetHeight);
            const captureOptions = {
                backgroundColor: '#ffffff',
                pixelRatio: 2,
                width: captureWidth,
                height: captureHeight,
                canvasWidth: captureWidth * 2,
                canvasHeight: captureHeight * 2,
                style: {
                    width: `${captureWidth}px`,
                    minWidth: `${captureWidth}px`,
                    maxWidth: `${captureWidth}px`,
                    overflow: 'visible',
                },
            };

            await logActivity('EXPORT_DATA', { type: 'IMAGE', month: getMonthYearID(currentDate), weeks: weeks || 'full' });
            const timestamp = format(new Date(), 'HH-mm');
            const monthName = format(currentDate, 'MMMM', { locale: id });
            const year = format(currentDate, 'yyyy');
            
            // FILENAME LOGIC
            let filename = '';
            let folderHint = '';

            if (weeks && weeks.length > 0) {
                filename = `Minggu${label}-${monthName}-${year}.png`;
                folderHint = 'Mingguan';
            } else {
                filename = `Full-${monthName}-${year}.png`;
                folderHint = 'Full';
            }

            if (isNativeMobileDownload) {
                const dataUrl = await toPng(element, captureOptions);
                setLoadingMessage('Menyimpan file ke perangkat...');
                const savedFile = await fileUtils.saveImageFile(filename, dataUrl);
                setLoadingMessage('Menyiapkan notifikasi file...');
                const notificationSent = savedFile.path
                  ? await notifyDownloadedFile({
                      title: 'Screenshot Berhasil',
                      body: `${filename} selesai diunduh. Ketuk untuk membuka file.`,
                      filePath: savedFile.path,
                      contentType: 'image/png',
                    })
                  : false;

                if (!notificationSent) {
                  sendNotification("Screenshot Berhasil", `File ${filename} selesai diunduh.`);
                }
            } else {
                const dataUrl = await toPng(element, captureOptions);
                downloadDataUrl(dataUrl, filename);
            }

        } catch (e) {
            console.error(e);
            showAlert(`Gagal membuat gambar: ${e instanceof Error ? e.message : String(e)}`);
        }
    } else {
        showAlert("Area jadwal tidak ditemukan.");
    }

    // 5. Restore View
    setIsGeneratingImage(false);
    setCaptureRenderWidth(CAPTURE_WIDTH);
    setCaptureWeekLabel(null);
    setLoading(false);
    setViewFilter({ start: null, end: null, weeks: null });
  };

  const downloadDataUrl = (dataUrl: string, filename: string) => {
      const link = document.createElement('a');
      link.download = filename;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      sendNotification("Screenshot Berhasil", `File ${filename} disimpan.`);
  };

  // Helper to convert Arabic numbers in string to Roman
  const formatEventName = (name: string) => {
    const normalizedName = name.replace(/\b\d+\b/g, (match) => toRoman(parseInt(match)));
    const noteMatch = normalizedName.match(/\s*(\([^()]+\))\s*$/);

    if (!noteMatch) {
      return {
        title: normalizedName.trim(),
        note: '',
      };
    }

    return {
      title: normalizedName.slice(0, normalizedName.length - noteMatch[0].length).trim(),
      note: noteMatch[1].trim(),
    };
  };

  const renderEventName = (name: string, noteClassName?: string) => {
    const { title, note } = formatEventName(name);

    return (
      <>
        <span>{title}</span>
        {note && (
          <>
            <br />
            <span className={noteClassName}>{note}</span>
          </>
        )}
      </>
    );
  };

  const getVolunteersForRole = (role: string) => volunteers.filter(v => 
    !v.isUnavailable && 
    !v.excludeFromAutoFill &&
    v.roles.some(r => r.toUpperCase().replace(/\s/g, '') === role.toUpperCase().replace(/\s/g, ''))
  );
  
  const visibleRows = useMemo(() => rows
    .filter(row => {
      if (viewFilter.weeks && viewFilter.weeks.length > 0) {
        return viewFilter.weeks.includes(getWeekOfMonth(row.event.date));
      }
      if (!viewFilter.start || !viewFilter.end) return true;
      return row.event.date >= viewFilter.start && row.event.date <= viewFilter.end;
    })
    .sort((a, b) => {
      // 1. Sort by Date
      if (a.event.date !== b.event.date) return a.event.date.localeCompare(b.event.date);
      // 2. Sort by Time
      if (a.event.time !== b.event.time) return a.event.time.localeCompare(b.event.time);
      // 3. Sort by Mass Number (Misa Ke)
      return a.event.number - b.event.number;
    }), [rows, viewFilter]);

  // Calculate RowSpan for Dates & Names (Grouped by consecutive identical Date+Name)
  const groupRowSpanMap = useMemo(() => {
    const spans: number[] = new Array(visibleRows.length).fill(0);
    let i = 0;
    while (i < visibleRows.length) {
      let count = 1;
      const currentKey = `${visibleRows[i].event.date}_${visibleRows[i].event.name}`;
      while (i + count < visibleRows.length && 
             `${visibleRows[i+count].event.date}_${visibleRows[i+count].event.name}` === currentKey) {
        count++;
      }
      spans[i] = count;
      i += count;
    }
    return spans;
  }, [visibleRows]);

  const roleConfig: Array<{
    key: 'obs' | 'sound' | 'cam1' | 'cam2' | 'foto';
    label: string;
    role: Role;
    icon: any;
    color: string;
    condition?: (e: MassEvent) => boolean;
  }> = [
    { key: 'obs', label: 'OBS', role: 'OBS', icon: Tv, color: 'text-blue-600', condition: (e) => e.needsOBS !== false },
    { key: 'sound', label: 'Sound', role: 'Sound', icon: Mic, color: 'text-emerald-600', condition: (e) => e.needsSound !== false },
    { key: 'cam1', label: 'Cam 1', role: 'Cam1', icon: Video, color: 'text-orange-600', condition: (e) => e.needsCam1 !== false },
    { key: 'cam2', label: 'Cam 2', role: 'Cam2', icon: Video, color: 'text-amber-600', condition: (e: MassEvent) => e.isBigMass },
    { key: 'foto', label: 'Foto', role: 'Foto', icon: PhotoIcon, color: 'text-purple-600', condition: (e: MassEvent) => e.needsPhoto },
  ];

  const renderCaptureHeader = () => (
    <div className="mb-8 text-center text-slate-900 font-sans title-area">
      <h2 className="text-xl font-bold leading-tight mb-1 tracking-tight text-slate-900 uppercase">
        Jadwal Petugas Live Streaming dan Operator Camrecorder {captureWeekLabel !== null ? 'Mingguan' : ''}
      </h2>
      <h3 className="text-lg font-bold text-slate-800 mb-1">
        Paroki St. Perawan Maria yang Dikandung Tanpa Noda
      </h3>
      <h3 className="text-lg font-bold text-slate-800 mb-2">
        Katedral Keuskupan Agung Medan
      </h3>
      <div className="mb-4">
        <h4 className="text-lg font-bold text-slate-900">
          Periode {format(currentDate, 'MMMM yyyy', { locale: id })}
        </h4>
      </div>
    </div>
  );

  const renderScheduleTable = (captureMode: boolean) => (
    <div className={`schedule-capture-table-wrap ${captureMode ? 'bg-white' : 'bg-white rounded-2xl shadow-xl border border-gray-200 overflow-x-auto'}`}>
      <table className="schedule-jadwal-table w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col
            className="schedule-col-date"
            style={{ width: DESKTOP_DATE_COL_WIDTH, minWidth: DESKTOP_DATE_COL_MIN, maxWidth: DESKTOP_DATE_COL_MAX }}
          />
          <col className="schedule-col-time" style={{ width: captureMode ? CAPTURE_TIME_COL_WIDTH : DESKTOP_TIME_COL_WIDTH }} />
          <col
            className="schedule-col-media"
            style={{ width: DESKTOP_MEDIA_COL_WIDTH, minWidth: DESKTOP_MEDIA_COL_MIN, maxWidth: DESKTOP_MEDIA_COL_MAX }}
          />
          <col
            className="schedule-col-media"
            style={{ width: DESKTOP_MEDIA_COL_WIDTH, minWidth: DESKTOP_MEDIA_COL_MIN, maxWidth: DESKTOP_MEDIA_COL_MAX }}
          />
          <col
            className="schedule-col-media"
            style={{ width: DESKTOP_MEDIA_COL_WIDTH, minWidth: DESKTOP_MEDIA_COL_MIN, maxWidth: DESKTOP_MEDIA_COL_MAX }}
          />
          <col
            className="schedule-col-media"
            style={{ width: DESKTOP_MEDIA_COL_WIDTH, minWidth: DESKTOP_MEDIA_COL_MIN, maxWidth: DESKTOP_MEDIA_COL_MAX }}
          />
          <col
            className="schedule-col-foto"
            style={{ width: DESKTOP_FOTO_COL_WIDTH, minWidth: DESKTOP_FOTO_COL_MIN, maxWidth: DESKTOP_FOTO_COL_MAX }}
          />
          {!captureMode && <col style={{ width: 48 }} />}
        </colgroup>
        <thead>
          <tr className="bg-[#99f6e4] border border-slate-800 text-slate-900">
            <th
              rowSpan={2}
              className="schedule-col-date-header p-3 border border-slate-800 font-bold text-center"
              style={{ width: DESKTOP_DATE_COL_WIDTH, minWidth: DESKTOP_DATE_COL_MIN, maxWidth: DESKTOP_DATE_COL_MAX }}
            >
              Hari / Tanggal
            </th>
            <th
              rowSpan={2}
              className="schedule-col-time-header p-3 border border-slate-800 font-bold text-center whitespace-nowrap"
              style={{ width: captureMode ? CAPTURE_TIME_COL_WIDTH : DESKTOP_TIME_COL_WIDTH }}
            >
              Misa / Waktu
            </th>
            <th colSpan={4} className="p-2 border border-slate-800 font-bold text-center">Multimedia</th>
            <th
              rowSpan={2}
              className="schedule-col-foto-header p-2 border border-slate-800 font-bold text-center"
              style={{ width: DESKTOP_FOTO_COL_WIDTH, minWidth: DESKTOP_FOTO_COL_MIN, maxWidth: DESKTOP_FOTO_COL_MAX }}
            >
              Foto
            </th>
            {!captureMode && <th rowSpan={2} className="p-2 border border-slate-800 w-[48px]"></th>}
          </tr>
          <tr className="bg-[#99f6e4] border border-slate-800 text-slate-900">
            <th className="p-2 border border-slate-800 font-bold text-center">OBS</th>
            <th className="p-2 border border-slate-800 font-bold text-center">Sound</th>
            <th className="p-2 border border-slate-800 font-bold text-center">Camcorder 1</th>
            <th className="p-2 border border-slate-800 font-bold text-center">Camcorder 2</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, idx) => {
            const isFirstOfGroup = groupRowSpanMap[idx] > 0;
            const isNewGroupSeparator = isFirstOfGroup && idx !== 0;
            const dateCellClass = "font-bold text-slate-900";
            const borderClass = "border border-slate-800";

            const obsVal = row.assignment.obs;
            const soundVal = row.assignment.sound;
            const cam1Val = row.assignment.cam1;
            const cam2Val = row.assignment.cam2;
            const fotoVal = row.assignment.foto;

            const reqOBS = row.event.needsOBS !== false;
            const reqSound = row.event.needsSound !== false;
            const reqCam1 = row.event.needsCam1 !== false;

            return (
              <React.Fragment key={row.event.id}>
                {isNewGroupSeparator && (
                  <tr className="bg-[#99f6e4]">
                    <td
                      colSpan={captureMode ? 7 : 8}
                      className={`border border-black separator-cell`}
                      style={{ backgroundColor: '#99f6e4' }}
                    ></td>
                  </tr>
                )}
                <tr className="hover:bg-slate-50/50 transition-colors">
                  {isFirstOfGroup && (
                    <td
                      rowSpan={groupRowSpanMap[idx]}
                      className={`schedule-col-date-cell p-3 text-center align-middle bg-white ${borderClass} ${dateCellClass}`}
                      style={{ width: DESKTOP_DATE_COL_WIDTH, minWidth: DESKTOP_DATE_COL_MIN, maxWidth: DESKTOP_DATE_COL_MAX }}
                    >
                      <div className="flex flex-col items-center w-full">
                        <span className={`${captureMode ? 'font-bold text-[18px] mb-0.5' : 'uppercase text-xs mb-1'}`}>
                          {format(new Date(row.event.date), 'EEEE', { locale: id })}
                        </span>
                        <span className={`${captureMode ? 'font-bold text-base mb-1' : ''}`}>
                          {format(new Date(row.event.date), 'dd MMMM yyyy', { locale: id })}
                        </span>

                        {row.event.name && (
                          <span className={`${captureMode ? 'text-[14px] font-normal text-slate-800 max-w-full' : 'text-[10px] text-indigo-600 bg-indigo-50 px-2 py-1 rounded mt-2 font-black uppercase max-w-full'} text-center leading-snug whitespace-normal break-words`}>
                            {renderEventName(row.event.name, captureMode ? 'font-normal' : 'font-black')}
                          </span>
                        )}
                      </div>
                    </td>
                  )}

                  <td className={`p-3 text-center align-middle bg-white ${borderClass} group/row`}>
                    <div className={`${captureMode ? 'text-base font-normal text-slate-700' : 'text-xs font-black text-slate-600 uppercase mb-0.5'}`}>
                      {toRoman(row.event.number)}
                    </div>
                    <div className={`${captureMode ? 'text-[18px]' : 'text-base'} font-bold text-slate-900`}>
                      {row.event.time}
                    </div>
                  </td>

                  <td className={`p-2 align-middle text-center ${borderClass} ${!reqOBS ? 'bg-gray-100' : 'bg-white'}`}>
                    {reqOBS ? (
                      <CellSelector
                        row={row}
                        role="OBS"
                        val={obsVal}
                        field="obs"
                        volunteers={getVolunteersForRole('OBS')}
                        onChange={handleUpdateCell}
                        onMagic={handleSingleCellGenerate}
                        isImage={captureMode}
                        readOnly={readOnly}
                      />
                    ) : <span className="text-gray-400">-</span>}
                  </td>

                  <td className={`p-2 align-middle text-center ${borderClass} ${!reqSound ? 'bg-gray-100' : 'bg-white'}`}>
                    {reqSound ? (
                      <CellSelector
                        row={row}
                        role="Sound"
                        val={soundVal}
                        field="sound"
                        volunteers={getVolunteersForRole('SOUND')}
                        onChange={handleUpdateCell}
                        onMagic={handleSingleCellGenerate}
                        isImage={captureMode}
                        readOnly={readOnly}
                      />
                    ) : <span className="text-gray-400">-</span>}
                  </td>

                  <td className={`p-2 align-middle text-center ${borderClass} ${!reqCam1 ? 'bg-gray-100' : 'bg-white'}`}>
                    {reqCam1 ? (
                      <CellSelector
                        row={row}
                        role="Cam1"
                        val={cam1Val}
                        field="cam1"
                        volunteers={getVolunteersForRole('CAM 1')}
                        onChange={handleUpdateCell}
                        onMagic={handleSingleCellGenerate}
                        isImage={captureMode}
                        readOnly={readOnly}
                      />
                    ) : <span className="text-gray-400">-</span>}
                  </td>

                  <td className={`p-2 align-middle text-center ${borderClass} ${!row.event.isBigMass ? 'bg-gray-100' : 'bg-white'}`}>
                    {row.event.isBigMass ? (
                      <CellSelector
                        row={row}
                        role="Cam2"
                        val={cam2Val}
                        field="cam2"
                        volunteers={getVolunteersForRole('CAM 2')}
                        onChange={handleUpdateCell}
                        onMagic={handleSingleCellGenerate}
                        isImage={captureMode}
                        readOnly={readOnly}
                      />
                    ) : <span className="text-gray-400">-</span>}
                  </td>

                  <td
                    className={`schedule-col-foto-cell p-1 align-middle text-center ${borderClass} ${!row.event.needsPhoto ? 'bg-gray-100' : 'bg-white'}`}
                    style={{ width: DESKTOP_FOTO_COL_WIDTH, minWidth: DESKTOP_FOTO_COL_MIN, maxWidth: DESKTOP_FOTO_COL_MAX }}
                  >
                    {row.event.needsPhoto ? (
                      <CellSelector
                        row={row}
                        role="Foto"
                        val={fotoVal}
                        field="foto"
                        volunteers={getVolunteersForRole('FOTO')}
                        onChange={handleUpdateCell}
                        onMagic={handleSingleCellGenerate}
                        isImage={captureMode}
                        readOnly={readOnly}
                      />
                    ) : <span className="text-gray-400">-</span>}
                  </td>

                  {!captureMode && !readOnly && (
                    <td className="p-2 text-center align-middle border-b border-r border-slate-200 bg-white">
                      <button
                        onClick={() => handleRowGenerate(row.event.id)}
                        className="p-2 text-slate-300 hover:text-indigo-600 transition-all active:scale-90"
                        title="Generate Misa Ini"
                      >
                        <Wand2 size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="pb-32 bg-gray-50 min-h-screen">
      {loading && <LoadingOverlay message={loadingMessage} variant={isMobile ? 'screenshot' : 'subtle'} />}
      
      {showSuccess && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-emerald-600 text-white px-8 py-4 rounded-2xl shadow-2xl animate-success-pop border-2 border-white/20">
           <CheckCircle2 size={24} />
           <div className="flex flex-col">
              <span className="font-black text-sm uppercase">Berhasil Diisi!</span>
              <span className="text-xs opacity-90">Jadwal bulan ini telah terisi secara adil.</span>
           </div>
        </div>
      )}

      <div className="bg-white shadow-md border-b sticky top-0 z-40 p-4 space-y-4">
        {/* Navigation */}
        <div className="flex justify-between items-center">
           <button 
             onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} 
             className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-90"
           >
             <ChevronLeft size={24}/>
           </button>
           <div className="flex flex-col items-center">
             <h1 className="font-black text-slate-800 uppercase tracking-tighter text-lg">{getMonthYearID(currentDate)}</h1>
             {isFetchingData && !isSaving && (
                <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold animate-in fade-in">
                    <Loader2 size={10} className="animate-spin" /> Mengambil data...
                </div>
             )}
             {isSaving ? (
                <div className="flex items-center gap-1 text-[10px] text-blue-500 font-bold">
                    <Loader2 size={10} className="animate-spin" /> Menyimpan...
                </div>
             ) : lastSaved ? (
                <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium animate-in fade-in">
                    <CloudCheck size={12} /> Tersimpan
                </div>
             ) : null}
           </div>
           <button 
             onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} 
             className="p-2 hover:bg-gray-100 rounded-full transition-colors active:scale-90"
           >
             <ChevronRight size={24}/>
           </button>
        </div>

        {/* Combo Download Toolbar */}
        <div className={`flex justify-center gap-2 ${customScreenshotMode ? 'flex-col sm:flex-row sm:items-center' : 'items-center'}`}>
            {customScreenshotMode ? (
              <>
                <input
                  type="text"
                  value={customWeekInput}
                  onChange={(e) => setCustomWeekInput(e.target.value)}
                  placeholder="Contoh: 1-3 atau 1,3,4"
                  className="w-full sm:w-[220px] pl-3 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                />
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={resetCustomScreenshotMode}
                    className="flex-1 sm:flex-none px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
                  >
                    Batal
                  </button>
                  <button 
                      onClick={handleScreenshotClick}
                      disabled={!customWeekInput.trim()}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-200 disabled:bg-indigo-300 disabled:shadow-none"
                  >
                      <Camera size={14} /> Screenshot
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="relative">
                    <select 
                        value={downloadOption}
                        onChange={(e) => setDownloadOption(e.target.value)}
                        className="pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-sm"
                    >
                        <option value="full">Full Bulan</option>
                        <option value="1">Minggu 1</option>
                        <option value="2">Minggu 2</option>
                        <option value="3">Minggu 3</option>
                        <option value="4">Minggu 4</option>
                        <option value="5">Minggu 5</option>
                    </select>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        <ChevronRight size={14} className="rotate-90" />
                    </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomScreenshotMode(true)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all shadow-sm"
                >
                  Custom
                </button>
                <button 
                    onClick={handleScreenshotClick}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-200"
                >
                    <Camera size={14} /> Screenshot
                </button>
              </>
            )}
        </div>
      </div>

      <div className="p-4">
        {isMobile ? (
          <div className="space-y-6">
             {visibleRows.map((row, idx) => {
               const isNewGroup = groupRowSpanMap[idx] > 0;
               return (
                 <div key={row.event.id} className={highlightGen ? 'animate-highlight rounded-2xl' : ''}>
                   {isNewGroup && (
                     <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 mt-6 flex items-center gap-2">
                       <div className="w-1.5 h-4 bg-indigo-600 rounded-full"></div> {formatDateID(row.event.date)}
                     </h2>
                   )}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-4 border-l-4 border-l-indigo-500 break-inside-avoid">
                      <div className="bg-slate-50 px-5 py-3 border-b flex justify-between items-center">
                         <div className="flex flex-col">
                           <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">MISA {toRoman(row.event.number)}</span>
                           <span className="text-xl font-black text-slate-900 tracking-tighter">{row.event.time}</span>
                           {row.event.name && (
                             <span className="text-xs font-bold text-slate-600 mt-1 whitespace-normal break-words leading-snug">
                               {renderEventName(row.event.name, 'font-semibold')}
                             </span>
                           )}
                         </div>
                         {!readOnly && (
                           <button 
                              onClick={() => handleRowGenerate(row.event.id)}
                              className="bg-white p-2 rounded-xl border border-gray-200 text-indigo-600 shadow-sm active:scale-90 transition-transform flex items-center gap-2 px-3"
                           >
                              <Wand2 size={14} />
                              <span className="text-[10px] font-black uppercase">Generate Petugas</span>
                           </button>
                         )}
                      </div>
                      <div className="p-5 space-y-4">
                         {roleConfig.map(cfg => {
                           if (cfg.condition && !cfg.condition(row.event)) return null;
                           const currentVal = (row.assignment as any)[cfg.key];
                           return (
                             <div key={cfg.key} className="flex items-center gap-4">
                               <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gray-50 ${cfg.color}`}>
                                  <cfg.icon size={20} />
                               </div>
                               <div className="flex-1 relative">
                                  <label className="text-[9px] uppercase font-black text-gray-400 block tracking-widest mb-0.5">{cfg.label}</label>
                                  <div className="flex items-center gap-2">
                                    {readOnly ? (
                                      <div className="flex-1 text-sm font-bold bg-gray-50/50 border border-slate-100 rounded-lg text-slate-800 px-2 py-2 text-center">
                                        {currentVal || '-'}
                                      </div>
                                    ) : (
                                      <div className="flex-1 h-9">
                                        <CellSelector
                                          row={row}
                                          role={cfg.role}
                                          val={currentVal}
                                          field={cfg.key as any}
                                          volunteers={getVolunteersForRole(cfg.role)}
                                          onChange={handleUpdateCell}
                                          onMagic={handleSingleCellGenerate}
                                          isImage={isGeneratingImage}
                                          readOnly={readOnly}
                                          showMagicButton={false}
                                        />
                                      </div>
                                    )}
                                    {!readOnly && (
                                      <button 
                                          onClick={() => handleSingleCellGenerate(row.event.id, cfg.key as any, cfg.role)}
                                          className={`p-1.5 rounded-lg transition-all ${currentVal ? 'text-indigo-400 bg-indigo-50' : 'text-gray-300 bg-gray-50'}`}
                                          title="Magic Fill"
                                      >
                                          <Sparkles size={14} />
                                      </button>
                                    )}
                                  </div>
                                </div>
                             </div>
                           );
                         })}
                      </div>
                   </div>
                 </div>
               );
             })}
             {visibleRows.length === 0 && (
               <div className="text-center py-20 bg-white rounded-2xl border-2 border-dashed border-gray-100">
                  <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">Belum ada jadwal bulan ini</p>
               </div>
             )}
          </div>
        ) : (
          renderScheduleTable(false)
        )}
      </div>
      {isGeneratingImage && (
        <div
          aria-hidden="true"
          className="absolute left-0 top-0 w-0 h-0 overflow-hidden pointer-events-none"
        >
          <div
            id="schedule-print-area"
            className="is-capturing"
            style={{
              width: `${captureRenderWidth}px`,
              minWidth: `${captureRenderWidth}px`,
              maxWidth: `${captureRenderWidth}px`,
            }}
          >
            <style>{`
            .is-capturing {
              box-sizing: border-box !important;
              max-width: none !important;
              overflow: visible !important;
              padding: 60px ${CAPTURE_SIDE_PADDING}px !important;
              font-family: 'Arial', sans-serif !important;
              background-color: #ffffff !important;
            }
            .is-capturing > * {
              overflow: visible !important;
            }
            .is-capturing button {
              display: none !important;
            }
            .is-capturing select {
              appearance: none !important;
              border: none !important;
              background: transparent !important;
              padding: 4px 0 !important;
              font-size: 17px !important;
              font-weight: 400 !important;
              text-align: center !important;
              color: #000000 !important;
              background-image: none !important;
            }
            .is-capturing table {
              width: 100% !important;
              border-collapse: collapse !important;
              border: 1px solid #000000 !important;
            }
            .is-capturing .schedule-capture-table-wrap {
              width: 100% !important;
              overflow: visible !important;
              border: none !important;
              box-shadow: none !important;
            }
            .is-capturing th {
              border: 1px solid #000000 !important;
              font-size: 18px !important;
              font-weight: bold !important;
              padding: 12px 5px !important;
              background-color: #99f6e4 !important;
              color: #000000 !important;
              vertical-align: middle !important;
            }
            .is-capturing td {
              border: 1px solid #000000 !important;
              font-size: 18px !important;
              color: #000000 !important;
              padding: 10px 8px !important;
              background-color: #ffffff !important;
              vertical-align: middle !important;
            }
            .is-capturing table.schedule-jadwal-table {
              table-layout: fixed !important;
            }
            .is-capturing col.schedule-col-date {
              width: ${DESKTOP_DATE_COL_WIDTH} !important;
              min-width: ${DESKTOP_DATE_COL_MIN}px !important;
              max-width: ${DESKTOP_DATE_COL_MAX}px !important;
            }
            .is-capturing col.schedule-col-time {
              width: ${CAPTURE_TIME_COL_WIDTH}px !important;
              min-width: ${CAPTURE_TIME_COL_WIDTH}px !important;
              max-width: ${CAPTURE_TIME_COL_WIDTH}px !important;
            }
            .is-capturing col.schedule-col-media {
              width: ${DESKTOP_MEDIA_COL_WIDTH} !important;
              min-width: ${DESKTOP_MEDIA_COL_MIN}px !important;
              max-width: ${DESKTOP_MEDIA_COL_MAX}px !important;
            }
            .is-capturing col.schedule-col-foto {
              width: ${DESKTOP_FOTO_COL_WIDTH} !important;
              min-width: ${DESKTOP_FOTO_COL_MIN}px !important;
              max-width: ${DESKTOP_FOTO_COL_MAX}px !important;
            }
            .is-capturing .schedule-col-date-header,
            .is-capturing .schedule-col-date-cell {
              width: ${DESKTOP_DATE_COL_WIDTH} !important;
              min-width: ${DESKTOP_DATE_COL_MIN}px !important;
              max-width: ${DESKTOP_DATE_COL_MAX}px !important;
            }
            .is-capturing .schedule-col-time-header {
              width: ${CAPTURE_TIME_COL_WIDTH}px !important;
              min-width: ${CAPTURE_TIME_COL_WIDTH}px !important;
              max-width: ${CAPTURE_TIME_COL_WIDTH}px !important;
              white-space: nowrap !important;
            }
            .is-capturing .schedule-col-foto-header,
            .is-capturing .schedule-col-foto-cell {
              width: ${DESKTOP_FOTO_COL_WIDTH} !important;
              min-width: ${DESKTOP_FOTO_COL_MIN}px !important;
              max-width: ${DESKTOP_FOTO_COL_MAX}px !important;
            }
            .is-capturing .separator-cell {
              background-color: #99f6e4 !important;
              height: 6px !important;
              padding: 0 !important;
            }
            .is-capturing .bg-gray-100 {
              background-color: #ffffff !important;
            }
            .is-capturing .title-area h2 { font-size: 26px !important; font-weight: bold !important; }
            .is-capturing .title-area h3 { font-size: 24px !important; font-weight: bold !important; }
            .is-capturing .title-area h4 { font-size: 24px !important; font-weight: bold !important; }
            `}</style>
            {renderCaptureHeader()}
            {renderScheduleTable(true)}
          </div>
        </div>
      )}
    </div>
  );
};
