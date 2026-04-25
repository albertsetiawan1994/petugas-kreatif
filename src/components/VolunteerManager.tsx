import React, { useState, useEffect } from 'react';
import { Volunteer, ALL_ROLES, Role } from '../types';
import { dbService } from '../services/db';
import { generateId } from '../services/utils';
import { Trash2, Edit2, Loader2, AlertCircle, Sparkles, Search, X } from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

import { showAlert } from '../services/alertService';

export const VolunteerManager: React.FC<{ 
  volunteers: Volunteer[], 
  reloadData: () => void,
  adminPanel?: React.ReactNode
}> = ({ volunteers: globalVolunteers, reloadData, adminPanel }) => {
  const [volunteers, setVolunteers] = useState<Volunteer[]>(globalVolunteers);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);

  useEffect(() => {
    setVolunteers(globalVolunteers);
  }, [globalVolunteers]);

  const handleRoleToggle = (role: Role) => {
    if (selectedRoles.includes(role)) {
      setSelectedRoles(selectedRoles.filter(r => r !== role));
    } else {
      setSelectedRoles([...selectedRoles, role]);
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showAlert("Nama petugas tidak boleh kosong!");
      return;
    }
    if (selectedRoles.length === 0) {
      showAlert("Pilih minimal satu role untuk petugas ini!");
      return;
    }

    // VALIDASI: Cek duplikasi nama (Case Insensitive)
    const isDuplicate = volunteers.some(v => 
      v.name.toLowerCase() === trimmedName.toLowerCase() && 
      v.id !== currentId // Abaikan jika sedang edit user yang sama
    );

    if (isDuplicate) {
      showAlert(`Nama "${trimmedName}" sudah terdaftar! Mohon gunakan nama lain atau nama lengkap.`);
      return;
    }

    const existing = volunteers.find(v => v.id === currentId);

    const newVolunteer: Volunteer = {
      id: currentId || generateId(),
      name: trimmedName,
      roles: selectedRoles,
      isUnavailable: existing?.isUnavailable || false,
      excludeFromAutoFill: existing?.excludeFromAutoFill || false
    };

    await dbService.saveVolunteer(newVolunteer);
    resetForm();
    reloadData();
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeleteTargetId(id);
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    
    const idToDelete = deleteTargetId;
    setDeleteTargetId(null);
    setDeletingId(idToDelete);

    try {
      await new Promise(resolve => setTimeout(resolve, 800));
      await dbService.deleteVolunteer(idToDelete);
      
      setVolunteers(prev => prev.filter(v => v.id !== idToDelete));
    } catch (err) {
      console.error("Delete failed", err);
      showAlert("Gagal menghapus petugas.");
      reloadData();
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = (v: Volunteer) => {
    setIsEditing(true);
    setCurrentId(v.id);
    setName(v.name);
    setSelectedRoles(v.roles);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setIsEditing(false);
    setCurrentId(null);
    setName('');
    setSelectedRoles([]);
  };

  const handleToggleAutoFill = async (v: Volunteer) => {
    const updated = { ...v, excludeFromAutoFill: !v.excludeFromAutoFill };
    await dbService.saveVolunteer(updated);
    reloadData();
  };

  const filteredVolunteers = volunteers.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-4 pb-24">
      <ConfirmModal 
        isOpen={!!deleteTargetId}
        title="Hapus Petugas"
        message="Yakin ingin menghapus petugas ini? Data akan hilang permanen."
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTargetId(null)}
      />

      <h2 className="text-xl font-bold mb-4 text-slate-800">Manajemen Petugas</h2>

      {/* Form */}
      <div className="bg-white p-4 rounded-lg shadow-sm mb-6 border border-gray-100">
        <h3 className="font-medium mb-3 text-slate-700">{isEditing ? 'Edit Petugas' : 'Tambah Petugas Baru'}</h3>
        
        <div className="relative mb-4">
          <input
            type="text"
            placeholder="Nama Petugas"
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {name && volunteers.some(v => v.name.toLowerCase() === name.trim().toLowerCase() && v.id !== currentId) && (
             <div className="absolute right-3 top-2.5 text-red-500 flex items-center gap-1 text-xs font-bold animate-pulse">
                <AlertCircle size={14} /> Ada Duplikasi
             </div>
          )}
        </div>

        <div className="mb-4">
          <label className="block text-sm text-gray-600 mb-2">Role yang bisa diambil:</label>
          <div className="flex gap-2 overflow-x-auto whitespace-nowrap pb-2">
            {ALL_ROLES.map(role => (
              <button
                key={role}
                onClick={() => handleRoleToggle(role)}
                className={`px-3 py-1 rounded-full text-sm font-medium border ${
                  selectedRoles.includes(role)
                    ? 'bg-blue-100 text-blue-700 border-blue-300'
                    : 'bg-gray-50 text-gray-600 border-gray-200'
                }`}
              >
                {role} {selectedRoles.includes(role) && '✓'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 bg-blue-600 text-white py-2 rounded font-medium hover:bg-blue-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isEditing ? 'Update' : 'Simpan'}
          </button>
          {isEditing && (
            <button
              onClick={resetForm}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded font-medium hover:bg-gray-300"
            >
              Batal
            </button>
          )}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search size={16} className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Cari nama petugas..."
          className="w-full pl-10 pr-10 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all shadow-sm"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filteredVolunteers.map(v => {
          const isDeleting = v.id === deletingId;
          return (
            <div key={v.id} className={`bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center transition-all ${isDeleting ? 'opacity-50 bg-red-50' : ''}`}>
              <div>
                <p className={`font-semibold ${isDeleting ? 'text-red-400' : 'text-slate-800'}`}>{v.name}</p>
                <p className={`text-xs mt-1 ${isDeleting ? 'text-red-300' : 'text-slate-500'}`}>
                  {v.roles.join(', ')}
                </p>
              </div>
              <div className="flex gap-2 items-center">
                {!isDeleting && (
                    <>
                      <button 
                        onClick={() => handleToggleAutoFill(v)} 
                        className={`p-2 rounded-full transition ${v.excludeFromAutoFill ? 'text-gray-400 bg-gray-100' : 'text-amber-500 bg-amber-50 hover:bg-amber-100'}`}
                        title={v.excludeFromAutoFill ? "Petugas tidak akan digenerate otomatis" : "Petugas akan digenerate otomatis"}
                      >
                        <Sparkles size={16} className={v.excludeFromAutoFill ? 'opacity-50' : ''} />
                      </button>
                      <button onClick={() => handleEdit(v)} className="p-2 text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition">
                        <Edit2 size={16} />
                      </button>
                    </>
                )}
                
                {isDeleting ? (
                    <div className="p-2 text-red-400 bg-red-50 rounded-full">
                        <Loader2 size={16} className="animate-spin" />
                    </div>
                ) : (
                    <button 
                        type="button"
                        onClick={(e) => handleDeleteClick(e, v.id)} 
                        className="p-2 text-red-600 bg-red-50 rounded-full hover:bg-red-100 hover:text-red-700 transition"
                    >
                    <Trash2 size={16} />
                    </button>
                )}
              </div>
            </div>
          );
        })}
        {filteredVolunteers.length === 0 && (
          <p className="text-center text-gray-400 mt-8">
            {searchQuery ? `Tidak ada petugas dengan nama "${searchQuery}"` : 'Belum ada data petugas.'}
          </p>
        )}
      </div>

      {adminPanel && (
        <div className="mt-8">
          {adminPanel}
        </div>
      )}
    </div>
  );
};
