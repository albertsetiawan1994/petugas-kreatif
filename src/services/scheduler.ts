import { MassEvent, Volunteer, ScheduleAssignment, Role } from '../types';

/**
 * Menghasilkan jadwal secara otomatis dengan prinsip rotasi adil:
 * 1. Prioritas Utama: Petugas yang belum mendapatkan tugas sama sekali di bulan ini (Usage = 0).
 * 2. Prioritas Kedua: Petugas yang tidak bertugas atau paling sedikit bertugas di bulan lalu.
 * 3. Kapasitas: Satu orang tidak boleh mengambil lebih dari satu role dalam satu misa yang sama.
 * 4. Randomisasi: Jika beban tugas sama, dilakukan pengacakan untuk variasi.
 */
export const generateSchedule = (
  events: MassEvent[],
  volunteers: Volunteer[],
  existingAssignments: ScheduleAssignment[], 
  previousAssignments: ScheduleAssignment[] = [] 
): ScheduleAssignment[] => {
  
  // 1. Filter petugas yang aktif dan punya role
  const activeVolunteers = volunteers.filter(v => 
    !v.isUnavailable && 
    !v.excludeFromAutoFill &&
    Array.isArray(v.roles) && v.roles.length > 0
  );
  
  if (activeVolunteers.length === 0) return [];

  // 2. Map untuk melacak beban tugas (Bulan ini dan Riwayat)
  const currentMonthUsage = new Map<string, number>();
  const historyUsage = new Map<string, number>();

  activeVolunteers.forEach(v => {
    currentMonthUsage.set(v.name, 0);
    historyUsage.set(v.name, 0);
  });

  // Hitung riwayat tugas dari bulan sebelumnya
  previousAssignments.forEach(prev => {
    if (!prev) return;
    const assignedNames = [prev.obs, prev.sound, prev.cam1, prev.cam2, prev.foto];
    assignedNames.forEach(name => {
      if (name && historyUsage.has(name)) {
        historyUsage.set(name, (historyUsage.get(name) || 0) + 1);
      }
    });
  });

  const newAssignments: ScheduleAssignment[] = [];

  // Urutkan event secara kronologis agar pengisian beban tugas berurutan
  const sortedEvents = [...events].sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    return a.time.localeCompare(b.time);
  });

  for (const event of sortedEvents) {
    const assignment: ScheduleAssignment = { eventId: event.id };
    const assignedInThisMass = new Set<string>(); // Mencegah 1 orang 2 tugas di 1 misa
    
    // Role yang harus diisi
    const rolesToFill: {key: keyof Omit<ScheduleAssignment, 'eventId'>, role: Role}[] = [
      { key: 'obs', role: 'OBS' },
      { key: 'sound', role: 'SOUND' },
      { key: 'cam1', role: 'CAM 1' }
    ];

    if (event.isBigMass) rolesToFill.push({ key: 'cam2', role: 'CAM 2' });
    if (event.needsPhoto) rolesToFill.push({ key: 'foto', role: 'FOTO' });

    for (const item of rolesToFill) {
      // Cari kandidat yang punya skill dan belum bertugas di jam misa ini
      const candidates = activeVolunteers.filter(v => 
        v.roles.some(r => r.toUpperCase() === item.role.toUpperCase()) && 
        !assignedInThisMass.has(v.name)
      );

      if (candidates.length > 0) {
        /**
         * ALGORITMA SORTING ROTASI KETAT:
         * 1. Prioritaskan yang beban tugas bulan ini paling rendah (Utamakan yang masih 0).
         * 2. Jika beban bulan ini sama, prioritaskan yang beban riwayat bulan lalu paling rendah.
         * 3. Jika masih sama, acak (Random) agar posisi tidak monoton.
         */
        candidates.sort((a, b) => {
          const loadA = currentMonthUsage.get(a.name) || 0;
          const loadB = currentMonthUsage.get(b.name) || 0;
          if (loadA !== loadB) return loadA - loadB;

          const histA = historyUsage.get(a.name) || 0;
          const histB = historyUsage.get(b.name) || 0;
          if (histA !== histB) return histA - histB;

          return Math.random() - 0.5;
        });

        const selected = candidates[0];
        (assignment as any)[item.key] = selected.name;
        
        // Update beban tugas setelah terpilih
        assignedInThisMass.add(selected.name);
        currentMonthUsage.set(selected.name, (currentMonthUsage.get(selected.name) || 0) + 1);
      }
    }
    
    newAssignments.push(assignment);
  }

  return newAssignments;
};