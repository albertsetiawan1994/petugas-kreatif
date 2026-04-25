import React, { useState, useEffect } from 'react';
import { Volunteer } from '../types';
import { dbService } from '../services/db';
import { UserX } from 'lucide-react';

export const UnavailableManager: React.FC<{ 
  volunteers: Volunteer[], 
  reloadData: () => void 
}> = ({ volunteers: globalVolunteers, reloadData }) => {
  const [volunteers, setVolunteers] = useState<Volunteer[]>(globalVolunteers);

  useEffect(() => {
    setVolunteers(globalVolunteers);
  }, [globalVolunteers]);

  const toggleUnavailable = async (volunteer: Volunteer) => {
    const updated = { ...volunteer, isUnavailable: !volunteer.isUnavailable };
    await dbService.saveVolunteer(updated);
    reloadData();
  };

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center gap-2 mb-4">
        <UserX className="text-red-500" />
        <h2 className="text-xl font-bold text-slate-800">Petugas Tidak Bisa Tugas</h2>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Centang nama petugas yang berhalangan tugas untuk bulan ini. Petugas yang dicentang tidak akan dipilih oleh sistem.
      </p>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-100">
        {volunteers.map(v => (
          <div key={v.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
            <span className={`font-medium ${v.isUnavailable ? 'text-gray-400 line-through' : 'text-slate-800'}`}>
              {v.name}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer"
                checked={v.isUnavailable}
                onChange={() => toggleUnavailable(v)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-500"></div>
            </label>
          </div>
        ))}
         {volunteers.length === 0 && (
          <div className="p-8 text-center text-gray-400">Belum ada data petugas.</div>
        )}
      </div>
    </div>
  );
};