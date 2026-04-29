import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek } from 'date-fns';
import { id } from 'date-fns/locale/id';
import { MassEvent, Volunteer, ScheduleAssignment, Role, CombinedScheduleRow } from '../types';
import { dbService } from '../services/db';
import { generateId, toRoman, isCatholicHoliday } from '../services/utils';
import { fetchHolidays } from '../services/holidayService';
import { Plus, X, Edit2, Clock, Trash2, Loader2, Tv, Mic, Video, Camera, Sparkles, Info } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

import { showAlert } from '../services/alertService';

export const CalendarManager: React.FC<{ 
  isFetchingData?: boolean,
  readOnly?: boolean,
  canViewAddSchedule?: boolean,
  canEditSchedule?: boolean,
  canDeleteSchedule?: boolean,
  canSaveSchedule?: boolean,
  volunteers: Volunteer[], 
  scheduleRows: CombinedScheduleRow[],
  reloadData: () => void,
  currentMonth: Date,
  setCurrentMonth: (date: Date) => void
}> = ({
  isFetchingData = false,
  readOnly = false,
  canViewAddSchedule = true,
  canEditSchedule = true,
  canDeleteSchedule = true,
  canSaveSchedule = true,
  volunteers,
  scheduleRows,
  reloadData,
  currentMonth: currentDate,
  setCurrentMonth: setCurrentDate
}) => {
  const [events, setEvents] = useState<MassEvent[]>(scheduleRows.map(r => r.event));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null); // For loading spinner
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null); // For modal confirmation

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null); // Track ID if editing
  const [allowDuplicate, setAllowDuplicate] = useState(false); // Checkbox exception for duplicates
  const [overrideMisaName, setOverrideMisaName] = useState(false); // Checkbox to allow manual mass name entry
  const [misaName, setMisaName] = useState('Misa ');
  const [misaNumber, setMisaNumber] = useState(3);
  const [misaTime, setMisaTime] = useState('10:00');
  
  // Role Config State - Changed default to false
  const [needsOBS, setNeedsOBS] = useState(false);
  const [needsSound, setNeedsSound] = useState(false);
  const [needsCam1, setNeedsCam1] = useState(false);
  const [needsPhoto, setNeedsPhoto] = useState(false);
  const [isBigMass, setIsBigMass] = useState(false);
  const [assignmentPreview, setAssignmentPreview] = useState<ScheduleAssignment | null>(null);

  useEffect(() => {
    setCurrentDate(currentDate);
  }, [currentDate]);

  useEffect(() => {
    setEvents(scheduleRows.map(r => r.event));
  }, [scheduleRows]);

  const resetForm = (date: Date, currentEvents?: MassEvent[]) => {
    setEditingId(null);
    setAllowDuplicate(false); // Reset exception checkbox
    
    // Inheritance logic: Use name from the first mass of the day if exists
    const list = currentEvents || events;
    const dayEvents = list
      .filter(e => isSameDay(new Date(e.date), date))
      .sort((a, b) => a.time.localeCompare(b.time) || a.number - b.number);

    if (dayEvents.length > 0) {
      setMisaName(dayEvents[0].name);
      setOverrideMisaName(false); // Subsequent masses: do not check by default
    } else {
      setMisaName('Misa ');
      setOverrideMisaName(true); // First mass of the day: check by default
    }
    
    setMisaNumber(3); // Default to Misa 3
    setMisaTime('10:00'); // Default to 10:00 for Misa 3
    
    // Default Values - Changed to false
    setNeedsOBS(false);
    setNeedsSound(false);
    setNeedsCam1(false);
    setNeedsPhoto(false);
    setIsBigMass(false); 
    setAssignmentPreview(null);
  };

  const handleDateClick = (date: Date) => {
    if (readOnly || !canViewAddSchedule) return;
    setSelectedDate(date);
    resetForm(date);
    setIsModalOpen(true);
  };

  const handleEditEvent = async (ev: MassEvent) => {
    if (!canEditSchedule) return;
    if (deletingId) return; // Prevent edit if deleting

    setEditingId(ev.id);
    setAllowDuplicate(!!ev.allowDuplicate); // Persist exception status from event data
    setOverrideMisaName(false); // DO NOT check automatically when editing
    setMisaName(ev.name);
    setMisaNumber(ev.number);
    setMisaTime(ev.time);
    
    // Check undefined for backward compatibility (treat as true if missing)
    setNeedsOBS(ev.needsOBS !== false);
    setNeedsSound(ev.needsSound !== false);
    setNeedsCam1(ev.needsCam1 !== false);
    
    setNeedsPhoto(ev.needsPhoto);
    setIsBigMass(ev.isBigMass);

    // Load existing assignment for preview
    try {
      const assignments = await dbService.getAssignments([ev.id]);
      if (assignments.length > 0) {
        setAssignmentPreview(assignments[0]);
      } else {
        setAssignmentPreview(null);
      }
    } catch (err) {
      console.error("Failed to load assignments for edit", err);
    }
    
    // Scroll to top of modal form smoothly
    const modalContent = document.getElementById('modal-content');
    if (modalContent) modalContent.scrollTop = 0;
  };

  const autoFillRole = async (field: keyof ScheduleAssignment, roleName: string, checked: boolean) => {
    if (!checked) {
      if (assignmentPreview) {
        setAssignmentPreview({ ...assignmentPreview, [field]: undefined });
      }
      return;
    }

    // USE PROPS DATA instead of re-fetching
    try {
      const allVolunteers = volunteers;
      const existingAssignments = scheduleRows.map(r => r.assignment);

      const usageMap = new Map<string, number>();
      allVolunteers.forEach(v => usageMap.set(v.name, 0));
      existingAssignments.forEach(a => {
        Object.entries(a).forEach(([k, v]) => {
          if (k !== 'eventId' && v && typeof v === 'string' && usageMap.has(v)) {
            usageMap.set(v, (usageMap.get(v) || 0) + 1);
          }
        });
      });

      const currentAssigned = new Set<string>();
      if (assignmentPreview) {
        Object.entries(assignmentPreview).forEach(([k, v]) => {
          if (k !== 'eventId' && v && typeof v === 'string') currentAssigned.add(v);
        });
      }

      const candidates = allVolunteers.filter(v => 
        !v.isUnavailable && 
        !v.excludeFromAutoFill &&
        v.roles.some(r => r.toUpperCase().replace(/\s/g, '') === roleName.toUpperCase().replace(/\s/g, '')) &&
        !currentAssigned.has(v.name)
      );

      if (candidates.length > 0) {
        candidates.sort((a, b) => {
          const uA = usageMap.get(a.name) || 0;
          const uB = usageMap.get(b.name) || 0;
          if (uA !== uB) return uA - uB;
          return Math.random() - 0.5;
        });

        const selected = candidates[0];
        setAssignmentPreview(prev => ({
          ...(prev || { eventId: editingId || 'temp' }),
          [field]: selected.name
        }));
      }
    } catch (err) {
      console.error("Auto fill failed", err);
    }
  };

  // --- AUTO GENERATE LOGIC ---
  const generateAutoAssignment = async (event: MassEvent) => {
    try {
      // USE PROPS DATA
      const allVolunteers = volunteers;
      const existingAssignments = scheduleRows.map(r => r.assignment);

      // 2. Calculate Usage Map (Fairness)
      const usageMap = new Map<string, number>();
      allVolunteers.forEach(v => usageMap.set(v.name, 0));
      
      existingAssignments.forEach(assignment => {
         Object.entries(assignment).forEach(([key, val]) => {
            if (key !== 'eventId' && val && typeof val === 'string' && usageMap.has(val)) {
               usageMap.set(val, (usageMap.get(val) || 0) + 1);
            }
         });
      });

      // 3. Define Roles needed for this specific event
      const rolesToFill: {key: keyof ScheduleAssignment, role: Role}[] = [];
      
      // Only add role to queue if the event flags say so
      if (event.needsOBS !== false) rolesToFill.push({ key: 'obs', role: 'OBS' });
      if (event.needsSound !== false) rolesToFill.push({ key: 'sound', role: 'SOUND' });
      if (event.needsCam1 !== false) rolesToFill.push({ key: 'cam1', role: 'CAM 1' });
      
      if (event.isBigMass) rolesToFill.push({ key: 'cam2', role: 'CAM 2' });
      if (event.needsPhoto) rolesToFill.push({ key: 'foto', role: 'FOTO' });

      // 4. Fill Slots
      const newAssignment: ScheduleAssignment = { eventId: event.id };
      const assignedInThisMass = new Set<string>();

      for (const item of rolesToFill) {
          // Filter candidates: Has Role + Available + Not already in this mass
          const candidates = allVolunteers.filter(v => 
              !v.isUnavailable && 
              !v.excludeFromAutoFill &&
              v.roles.some(r => r.toUpperCase().replace(/\s/g, '') === item.role.toUpperCase().replace(/\s/g, '')) && 
              !assignedInThisMass.has(v.name)
          );
          
          if (candidates.length > 0) {
              // Sort: Least Used (Ascending) -> Random
              candidates.sort((a, b) => {
                  const uA = usageMap.get(a.name) || 0;
                  const uB = usageMap.get(b.name) || 0;
                  if (uA !== uB) return uA - uB;
                  return Math.random() - 0.5;
              });
              
              const selected = candidates[0];
              (newAssignment as any)[item.key] = selected.name;
              assignedInThisMass.add(selected.name);
              usageMap.set(selected.name, (usageMap.get(selected.name) || 0) + 1);
          }
      }

      // 5. Save Assignment
      await dbService.saveAssignment(newAssignment);
    } catch (err) {
      console.error("Auto generate failed", err);
    }
  };

  const handleSaveEvent = async () => {
    if (!canSaveSchedule) {
      showAlert('Role Anda tidak memiliki akses Simpan Jadwal.');
      return;
    }
    if (!selectedDate) return;

    // VALIDASI: Minimal satu role dipilih agar bisa generate jadwal
    if (!needsOBS && !needsSound && !needsCam1 && !needsPhoto && !isBigMass) {
        showAlert("Gagal: Mohon pilih minimal satu kebutuhan petugas (OBS, Sound, Cam, atau Foto).");
        return;
    }
    
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');

    // VALIDASI: Cek duplikasi waktu ATAU nomor misa pada tanggal yang sama (Unless exception is checked)
    if (!allowDuplicate) {
      const duplicateTime = events.find(ev => 
        ev.date === formattedDate && 
        ev.time === misaTime && 
        ev.id !== editingId 
      );

      const duplicateNumber = events.find(ev => 
        ev.date === formattedDate && 
        ev.number === misaNumber && 
        ev.id !== editingId 
      );

      if (duplicateTime) {
        showAlert(`Gagal: Sudah ada jadwal misa pukul ${misaTime} di tanggal ini.`);
        return;
      }

      if (duplicateNumber) {
          showAlert(`Gagal: Misa Ke-${toRoman(misaNumber)} sudah ada di tanggal ini. Mohon ganti nomor misa atau gunakan Pengecualian.`);
          return;
      }
    }
    
    const eventToSave: MassEvent = {
      id: editingId || generateId(),
      date: formattedDate,
      name: misaName,
      number: misaNumber,
      time: misaTime,
      isBigMass,
      needsPhoto,
      needsOBS,
      needsSound,
      needsCam1,
      allowDuplicate // Save the exception state to DB
    };

    try {
      await dbService.saveEvent(eventToSave);

      // Update local state immediately for better responsiveness
      const updatedEvents = events.find(e => e.id === eventToSave.id)
        ? events.map(e => e.id === eventToSave.id ? eventToSave : e)
        : [...events, eventToSave];
      
      setEvents(updatedEvents);

      // Save assignment preview if it exists
      if (assignmentPreview) {
        await dbService.saveAssignment({ ...assignmentPreview, eventId: eventToSave.id });
      } else if (!editingId) {
        // TRIGGER AUTO GENERATE if it is a NEW event and no preview
        await generateAutoAssignment(eventToSave);
      }

      reloadData();
      
      // resetForm clears the editing state and fields, keeping the modal open for a new entry
      // Pass the updatedEvents to ensure inheritance logic works without modal reload
      resetForm(selectedDate, updatedEvents);
    } catch (err) {
      console.error("Failed to save event", err);
      showAlert("Gagal menyimpan jadwal. " + (err instanceof Error ? err.message : ""));
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    // Stop propagation to prevent editing
    e.stopPropagation();
    e.preventDefault();
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!canDeleteSchedule) {
      showAlert('Role Anda tidak memiliki akses Delete Jadwal.');
      return;
    }
    if (!deleteTargetId) return;
    
    const idToDelete = deleteTargetId;
    setDeleteTargetId(null); // Close confirmation modal
    setDeletingId(idToDelete); // Show spinner

    try {
      await dbService.deleteEvent(idToDelete);
      
      setEvents(prevEvents => prevEvents.filter(ev => ev.id !== idToDelete));

      if (editingId === idToDelete && selectedDate) {
          resetForm(selectedDate);
      }
      
      reloadData();
    } catch (err) {
      console.error("Failed to delete event", err);
      showAlert("Gagal menghapus jadwal. " + (err instanceof Error ? err.message : ""));
    } finally {
      setDeletingId(null);
    }
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({
    start: startDate,
    end: endDate
  });

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + delta);
    setCurrentDate(newDate);
  };

  const getDayEvents = (date: Date) => events
    .filter(e => isSameDay(new Date(e.date), date))
    .sort((a, b) => {
      // Primary: Time
      if (a.time !== b.time) return a.time.localeCompare(b.time);
      // Secondary: Number (Misa Ke)
      return a.number - b.number;
    });

  // Sort events by time
  const sortedDayEvents = selectedDate 
    ? getDayEvents(selectedDate).sort((a, b) => a.time.localeCompare(b.time))
    : [];

  return (
    <div className="p-4 pb-24">
      <ConfirmModal 
        isOpen={!!deleteTargetId}
        title="Hapus Jadwal"
        message="Apakah Anda yakin ingin menghapus jadwal misa ini? Data yang dihapus tidak dapat dikembalikan."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />

      {/* Month Navigation */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => changeMonth(-1)} className="p-2 bg-white rounded shadow text-gray-600 hover:bg-gray-50">{'<'}</button>
        <div className="flex flex-col items-center">
          <h2 className="text-xl font-bold text-slate-800 capitalize">
            {format(currentDate, 'MMMM yyyy', { locale: id })}
          </h2>
          {isFetchingData && (
            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold animate-in fade-in mt-0.5">
              <Loader2 size={10} className="animate-spin" /> Mengambil data...
            </div>
          )}
        </div>
        <button onClick={() => changeMonth(1)} className="p-2 bg-white rounded shadow text-gray-600 hover:bg-gray-50">{'>'}</button>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Min', 'Sen', 'Sel', 'Rab', 'Kam', ' Jum', 'Sab'].map((d, i) => (
          <div key={d} className={`text-center text-xs font-semibold py-1 ${i === 0 ? 'text-red-500' : 'text-gray-500'}`}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(day => {
          const dayEvents = getDayEvents(day);
          const isToday = isSameDay(day, new Date());
          const isHoliday = day.getDay() === 0 || isCatholicHoliday(day);
          return (
            <div 
              key={day.toISOString()}
              onClick={() => handleDateClick(day)}
              className={`min-h-[80px] bg-white border rounded p-1 flex flex-col items-start transition relative ${
                !isSameMonth(day, currentDate) ? 'opacity-40 border-gray-100' : 'border-gray-200'
              } ${isToday ? 'ring-1 ring-blue-500 ring-offset-1' : ''} ${
                (readOnly || !canViewAddSchedule) ? 'cursor-default' : 'hover:border-blue-400 cursor-pointer'
              }`}
            >
              <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                isToday ? 'bg-blue-600 text-white' : isHoliday ? 'text-red-600 font-bold' : 'text-gray-700'
              }`}>
                {format(day, 'd')}
              </span>
              
              <div className="flex flex-col gap-1 mt-1 w-full overflow-hidden">
                {dayEvents.map(ev => (
                  <div key={ev.id} className="text-[10px] bg-blue-50 text-blue-700 px-1 rounded truncate border border-blue-100">
                    {ev.time}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 pb-24"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="font-bold text-lg text-slate-800">
                {selectedDate && format(selectedDate, 'dd MMM yyyy')}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full hover:bg-gray-200 text-gray-500 transition"
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Modal Scrollable Content */}
            <div id="modal-content" className="p-5 overflow-y-auto custom-scrollbar">
              
              {/* Form Title */}
              <div className="flex items-center justify-between mb-4">
                 {!readOnly && canViewAddSchedule && (
                   <div className="flex items-center gap-2">
                     <h4 className={`text-sm font-bold uppercase tracking-wider ${editingId ? 'text-amber-600' : 'text-blue-600'}`}>
                       {editingId ? 'Edit Jadwal' : 'Tambah Jadwal Baru'}
                     </h4>
                     {/* Exception Checkbox for Duplicates */}
                     <label className="flex items-center gap-1.5 cursor-pointer group">
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            className="peer sr-only" 
                            checked={allowDuplicate}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setAllowDuplicate(checked);
                              // User request: If "Beda Misa" is checked, reset name and allow input
                              if (checked) {
                                setMisaName('Misa ');
                                setOverrideMisaName(true);
                              }
                            }}
                          />
                          <div className="w-4 h-4 border border-gray-300 rounded peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all flex items-center justify-center">
                            {allowDuplicate && <Plus size={12} className="text-white rotate-45" />}
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter group-hover:text-blue-500 transition-colors">Beda Misa</span>
                     </label>
                   </div>
                 )}
                 {readOnly && (
                   <h4 className="text-sm font-bold uppercase tracking-wider text-slate-600">
                     Detail Jadwal
                   </h4>
                 )}
                  {editingId && !readOnly && canEditSchedule && (
                   <button 
                     onClick={() => selectedDate && resetForm(selectedDate)}
                     className="text-xs text-gray-500 hover:text-gray-800 underline"
                   >
                     Batal Edit
                   </button>
                 )}
              </div>

              {/* Input Fields */}
              <div className="space-y-4">
                
                {/* Nama Misa */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Nama Misa</label>
                     {!readOnly && canEditSchedule && (
                      <label className="flex items-center gap-1.5 cursor-pointer group">
                        <div className="relative">
                          <input 
                            type="checkbox" 
                            className="peer sr-only" 
                            checked={overrideMisaName}
                            onChange={(e) => setOverrideMisaName(e.target.checked)}
                          />
                          <div className="w-3.5 h-3.5 border border-gray-300 rounded peer-checked:bg-blue-600 peer-checked:border-blue-600 transition-all flex items-center justify-center">
                             {overrideMisaName && <Plus size={10} className="text-white rotate-45" />}
                           </div>
                         </div>
                         <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter group-hover:text-blue-500 transition-colors">Input Nama Misa</span>
                       </label>
                    )}
                  </div>
                  <input 
                    type="text" 
                    readOnly={readOnly || !overrideMisaName}
                    className={`w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition ${
                      readOnly || !overrideMisaName ? 'bg-gray-50 text-gray-500 italic' : 'bg-white text-slate-900'
                    }`}
                    value={misaName}
                    onChange={e => setMisaName(e.target.value)}
                    placeholder={!overrideMisaName ? "Nama mengikuti misa sebelumnya..." : "Contoh: Misa Minggu Biasa"}
                  />
                </div>

                <div className="flex gap-4">
                  {/* Misa Ke */}
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">MISA KE</label>
                    <div className="flex items-center h-[42px]">
                {!readOnly && canSaveSchedule && (
                        <button 
                           className="h-full w-10 flex items-center justify-center bg-gray-100 border border-gray-300 rounded-l-lg hover:bg-gray-200 active:bg-gray-300 transition"
                           onClick={() => {
                             const newVal = Math.max(1, misaNumber - 1);
                             setMisaNumber(newVal);
                             if (newVal === 3) setMisaTime('10:00');
                             if (newVal === 4) setMisaTime('15:00');
                             if (newVal === 5) setMisaTime('17:00');
                           }}
                        >-</button>
                      )}
                      <div className={`flex-1 h-full flex items-center justify-center border-gray-300 bg-white font-mono font-bold text-slate-700 ${readOnly ? 'border rounded-lg' : 'border-y'}`}>
                        {toRoman(misaNumber)}
                      </div>
                      {!readOnly && (
                        <button 
                           className="h-full w-10 flex items-center justify-center bg-gray-100 border border-gray-300 rounded-r-lg hover:bg-gray-200 active:bg-gray-300 transition"
                           onClick={() => {
                             const newVal = misaNumber + 1;
                             setMisaNumber(newVal);
                             if (newVal === 3) setMisaTime('10:00');
                             if (newVal === 4) setMisaTime('15:00');
                             if (newVal === 5) setMisaTime('17:00');
                           }}
                        >+</button>
                      )}
                    </div>
                  </div>

                  {/* Jam (Rounded & Forced Picker) */}
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">JAM</label>
                    <div className="relative">
                        <input 
                          type="time" 
                          readOnly={readOnly}
                          className={`w-full h-[42px] border border-gray-300 rounded-full px-4 text-center outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white font-bold text-slate-800 shadow-sm ${readOnly ? 'cursor-default bg-gray-50' : 'cursor-pointer'}`}
                          value={misaTime}
                          onChange={e => setMisaTime(e.target.value)}
                          // FORCE NATIVE PICKER
                          onClick={(e) => {
                             if (!readOnly && 'showPicker' in HTMLInputElement.prototype) {
                               try { (e.currentTarget).showPicker(); } catch (err) {}
                             }
                          }}
                          onFocus={(e) => {
                             if (!readOnly && 'showPicker' in HTMLInputElement.prototype) {
                               try { (e.currentTarget).showPicker(); } catch (err) {}
                             }
                          }}
                        />

                    </div>
                  </div>
                </div>

                 {/* Checkboxes Group */}
                 <div className="grid grid-cols-1 gap-2 mt-4">
                   <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Konfigurasi Petugas</p>
                   
                   {/* OBS */}
                   <label className={`flex items-center gap-3 p-3 border rounded-xl transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${needsOBS ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                      {!readOnly && (
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${needsOBS ? 'bg-blue-600 border-blue-600' : 'border-gray-300 bg-white'}`}>
                          {needsOBS && <Plus className="text-white rotate-45" size={14} />}
                        </div>
                      )}
                      <input 
                        type="checkbox" 
                        disabled={readOnly}
                        className="hidden"
                        checked={needsOBS}
                        onChange={e => {
                          setNeedsOBS(e.target.checked);
                          autoFillRole('obs', 'OBS', e.target.checked);
                        }}
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Tv size={16} className="text-blue-600" />
                          <span className="text-sm font-medium text-slate-700">OBS</span>
                        </div>
                        {assignmentPreview?.obs && (
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                            {assignmentPreview.obs}
                          </span>
                        )}
                      </div>
                   </label>

                   {/* Sound */}
                   <label className={`flex items-center gap-3 p-3 border rounded-xl transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${needsSound ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                      {!readOnly && (
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${needsSound ? 'bg-emerald-600 border-emerald-600' : 'border-gray-300 bg-white'}`}>
                          {needsSound && <Plus className="text-white rotate-45" size={14} />}
                        </div>
                      )}
                      <input 
                        type="checkbox" 
                        disabled={readOnly}
                        className="hidden"
                        checked={needsSound}
                        onChange={e => {
                          setNeedsSound(e.target.checked);
                          autoFillRole('sound', 'SOUND', e.target.checked);
                        }}
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <Mic size={16} className="text-emerald-600" />
                           <span className="text-sm font-medium text-slate-700">SOUND</span>
                        </div>
                        {assignmentPreview?.sound && (
                          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                            {assignmentPreview.sound}
                          </span>
                        )}
                      </div>
                   </label>

                   {/* Cam1 */}
                   <label className={`flex items-center gap-3 p-3 border rounded-xl transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${needsCam1 ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                      {!readOnly && (
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${needsCam1 ? 'bg-orange-600 border-orange-600' : 'border-gray-300 bg-white'}`}>
                          {needsCam1 && <Plus className="text-white rotate-45" size={14} />}
                        </div>
                      )}
                      <input 
                        type="checkbox" 
                        disabled={readOnly}
                        className="hidden"
                        checked={needsCam1}
                        onChange={e => {
                          setNeedsCam1(e.target.checked);
                          autoFillRole('cam1', 'CAM 1', e.target.checked);
                        }}
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Video size={16} className="text-orange-600" />
                          <span className="text-sm font-medium text-slate-700">CAM 1</span>
                        </div>
                        {assignmentPreview?.cam1 && (
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                            {assignmentPreview.cam1}
                          </span>
                        )}
                      </div>
                   </label>

                   {/* Foto - Updated Styling with Icon */}
                   <label className={`flex items-center gap-3 p-3 border rounded-xl transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${needsPhoto ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                      {!readOnly && (
                        <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${needsPhoto ? 'bg-purple-600 border-purple-600' : 'border-gray-300 bg-white'}`}>
                          {needsPhoto && <Plus className="text-white rotate-45" size={14} />}
                        </div>
                      )}
                      <input 
                        type="checkbox" 
                        disabled={readOnly}
                        className="hidden"
                        checked={needsPhoto}
                        onChange={e => {
                          setNeedsPhoto(e.target.checked);
                          autoFillRole('foto', 'FOTO', e.target.checked);
                        }}
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Camera size={16} className="text-purple-600" />
                          <span className="text-sm font-medium text-slate-700">FOTO</span>
                        </div>
                        {assignmentPreview?.foto && (
                          <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                            {assignmentPreview.foto}
                          </span>
                        )}
                      </div>
                   </label>

                   {/* Big Mass - Updated Styling with Icon */}
                   <label className={`flex items-center gap-3 p-3 border rounded-xl transition-all ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${isBigMass ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                       {!readOnly && (
                         <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${isBigMass ? 'bg-amber-600 border-amber-600' : 'border-gray-300 bg-white'}`}>
                          {isBigMass && <Plus className="text-white rotate-45" size={14} />}
                        </div>
                       )}
                      <input 
                        type="checkbox" 
                        disabled={readOnly}
                        className="hidden"
                        checked={isBigMass}
                        onChange={e => {
                          setIsBigMass(e.target.checked);
                          autoFillRole('cam2', 'CAM 2', e.target.checked);
                        }}
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <Sparkles size={16} className="text-amber-600" />
                           <div className="flex flex-col">
                              <span className="text-sm font-medium text-slate-700">CAM 2</span>
                           </div>
                        </div>
                        {assignmentPreview?.cam2 && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                            {assignmentPreview.cam2}
                          </span>
                        )}
                      </div>
                   </label>
                 </div>
              </div>

               {/* Action Button */}
               {!readOnly && (
                 <div className="mt-6 pb-4">
                  <button 
                    onClick={handleSaveEvent}
                    disabled={!!deletingId}
                    className={`w-full py-3.5 rounded-xl font-bold shadow-md text-white transition-all transform active:scale-95 flex items-center justify-center gap-2 ${
                      editingId 
                        ? 'bg-amber-500 hover:bg-amber-600' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    } ${deletingId ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {editingId ? <Edit2 size={18} /> : <Plus size={18} />}
                    {editingId ? 'Update Jadwal' : 'Simpan Jadwal'}
                  </button>
                </div>
               )}

               {/* Existing Events List */}
               <div className="mt-8 border-t border-gray-100 pt-4">
                 <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 text-center tracking-widest">
                   Daftar Jadwal Tanggal Ini
                 </h4>
                 
                 <div className="space-y-2.5 pb-2">
                   {sortedDayEvents.map((ev, index) => {
                     const isEditingThis = ev.id === editingId;
                     const isDeletingThis = ev.id === deletingId;

                     return (
                       <div 
                        key={ev.id} 
                        // Click triggers edit if not deleting
                        onClick={() => {
                             if (!isEditingThis && !isDeletingThis) handleEditEvent(ev);
                        }}
                        className={`group flex justify-between items-center p-3 rounded-xl border text-sm transition-all cursor-pointer ${
                          isEditingThis 
                            ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-300' 
                            : 'bg-white border-gray-200 hover:border-blue-200 hover:shadow-sm'
                        } ${isDeletingThis ? 'bg-red-50 border-red-200' : ''}`}
                       >
                         <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <span className={`font-bold text-lg leading-none ${isDeletingThis ? 'text-red-300' : 'text-slate-800'}`}>
                                      {ev.time}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${isDeletingThis ? 'bg-red-100 text-red-300' : 'bg-gray-100 text-gray-600'}`}>
                                        {toRoman(ev.number)}
                                    </span>
                                </div>
                                <span className={`text-xs mt-1 truncate max-w-[180px] ${isDeletingThis ? 'text-red-300' : 'text-slate-600'}`}>
                                  {ev.name}
                                </span>
                            </div>
                         </div>
                         
                         <div className="flex items-center gap-2">
                           {/* Edit Indicator */}
                           {!isDeletingThis && (
                              <button 
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (!isEditingThis && !isDeletingThis) handleEditEvent(ev);
                                }}
                                className={`p-2 rounded-lg transition-colors ${
                                  isEditingThis
                                    ? 'text-amber-600'
                                    : 'text-gray-300 hover:text-blue-500'
                                }`}
                              >
                                {readOnly ? <Info size={16} /> : <Edit2 size={16} />}
                              </button>
                           )}

                           {/* Delete Button OR Loading Spinner */}
                           {isDeletingThis ? (
                             <div className="p-2 text-red-400 bg-red-50 rounded-lg">
                               <Loader2 size={18} className="animate-spin" />
                             </div>
                            ) : !readOnly && canDeleteSchedule && (
                             <button 
                               type="button"
                               onClick={(e) => handleDeleteClick(e, ev.id)} 
                               className="p-2 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all border border-red-100 z-10"
                               title="Hapus Jadwal"
                             >
                               <Trash2 size={18} />
                             </button>
                           )}
                         </div>
                       </div>
                     );
                   })}
                   
                   {sortedDayEvents.length === 0 && (
                     <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                        <p className="text-sm text-gray-400 italic">Belum ada jadwal untuk tanggal ini</p>
                     </div>
                   )}
                 </div>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
