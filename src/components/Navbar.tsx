import React from 'react';
import { Calendar, Users, Home, Sparkles, Camera } from 'lucide-react';
import { AppPageKey } from '../types';

interface NavbarProps {
  currentTab: string;
  setTab: (tab: string) => void;
  isViewer?: boolean;
  pageAccess?: Record<AppPageKey, boolean>;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setTab, isViewer = false, pageAccess }) => {
  const allItems = [
    { id: 'home', icon: Home, label: 'Jadwal' },
    { id: 'calendar', icon: Calendar, label: 'Kalender' },
    { id: 'inspiration', icon: Sparkles, label: 'Inspirasi' },
    { id: 'volunteers', icon: Users, label: 'Petugas' },
    { id: 'foto', icon: Camera, label: 'Foto' },
  ];

  const navItems = pageAccess
    ? allItems.filter((item) => pageAccess[item.id as AppPageKey] !== false)
    : isViewer
      ? allItems.filter((item) => item.id !== 'volunteers')
      : allItems;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-2 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-screen-md bg-white border border-gray-200 shadow-lg rounded-t-2xl sm:rounded-2xl sm:mb-2">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${
              currentTab === item.id ? 'text-blue-600' : 'text-gray-500 hover:text-blue-400'
            }`}
          >
            <item.icon size={20} />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
      </div>
    </div>
  );
};
