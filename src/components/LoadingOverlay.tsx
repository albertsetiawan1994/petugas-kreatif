import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  message?: string;
  variant?: 'default' | 'screenshot' | 'subtle';
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = 'Loading...', variant = 'default' }) => {
  const isScreenshot = variant === 'screenshot';
  const isSubtle = variant === 'subtle';

  if (isSubtle) {
    return (
      <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-[100] transition-all duration-300" />
    );
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex transition-all duration-300 ${isScreenshot ? 'items-start justify-center pointer-events-none pt-24 px-4 bg-transparent backdrop-blur-0' : 'items-center justify-center bg-black/60 backdrop-blur-sm'}`}
    >
      <div className={`bg-white rounded-2xl shadow-2xl flex flex-col items-center w-full animate-in zoom-in-95 duration-200 ${isScreenshot ? 'max-w-sm p-6 border border-indigo-100/80 shadow-indigo-100/70' : 'max-w-xs p-6'}`}>
        <div className={`relative mb-4 ${isScreenshot ? 'w-24 h-24' : ''}`}>
            <div className={`absolute inset-0 rounded-full animate-ping opacity-75 ${isScreenshot ? 'bg-indigo-100 scale-110' : 'bg-blue-100'}`}></div>
            {isScreenshot && (
              <>
                <div className="absolute inset-2 rounded-[1.5rem] border-2 border-indigo-200 animate-pulse"></div>
                <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-br from-indigo-50 via-white to-cyan-50"></div>
              </>
            )}
            <Loader2 className={`animate-spin relative z-10 ${isScreenshot ? 'w-16 h-16 text-indigo-600 m-4' : 'w-12 h-12 text-blue-600'}`} />
        </div>
        {isScreenshot && (
          <div className="w-full mb-4">
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-violet-500 animate-[loading-slide_1.2s_ease-in-out_infinite]"></div>
            </div>
          </div>
        )}
        <p className={`text-slate-800 text-center font-bold animate-pulse ${isScreenshot ? 'text-base' : 'text-sm'}`}>
          {message}
        </p>
        {isScreenshot && (
          <p className="text-slate-500 text-xs text-center mt-2 leading-relaxed">
            Sedang menyusun tabel dan menyimpan file screenshot ke perangkat...
          </p>
        )}
        <style>{`
          @keyframes loading-slide {
            0% { transform: translateX(-110%); }
            100% { transform: translateX(230%); }
          }
        `}</style>
      </div>
    </div>
  );
};
