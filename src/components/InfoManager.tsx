import React from 'react';
import { Smartphone, Code, Package, CheckCircle2, AlertCircle } from 'lucide-react';

export const InfoManager: React.FC = () => {
  return (
    <div className="p-4 pb-24 max-w-screen-xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
          <Smartphone size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Info & Build APK</h2>
          <p className="text-slate-500 text-xs font-medium">Panduan kompilasi ke Android</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Code size={20} className="text-blue-500" />
          Langkah Build APK
        </h3>
        
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-500">1</div>
            <div>
              <p className="font-bold text-slate-800">Build Web Assets</p>
              <p className="text-sm text-slate-500">Jalankan perintah <code className="bg-slate-100 px-1 rounded text-pink-600">npm run build</code> untuk menghasilkan folder <code className="bg-slate-100 px-1 rounded text-pink-600">dist</code>.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-500">2</div>
            <div>
              <p className="font-bold text-slate-800">Sync ke Android</p>
              <p className="text-sm text-slate-500">Jalankan <code className="bg-slate-100 px-1 rounded text-pink-600">npx cap sync</code> untuk menyinkronkan aset web ke folder android.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-500">3</div>
            <div>
              <p className="font-bold text-slate-800">Buka Android Studio</p>
              <p className="text-sm text-slate-500">Jalankan <code className="bg-slate-100 px-1 rounded text-pink-600">npx cap open android</code> untuk membuka project di Android Studio.</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 font-bold text-slate-500">4</div>
            <div>
              <p className="font-bold text-slate-800">Generate APK</p>
              <p className="text-sm text-slate-500">Di Android Studio, pilih menu <span className="font-bold">Build &gt; Build Bundle(s) / APK(s) &gt; Build APK(s)</span>.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
        <h3 className="font-bold text-emerald-800 mb-2 flex items-center gap-2">
          <CheckCircle2 size={20} />
          Fitur Native Aktif
        </h3>
        <ul className="text-sm text-emerald-700 space-y-2 list-disc list-inside">
          <li>Penyimpanan Offline (IndexedDB)</li>
          <li>Berbagi File Backup (Native Share)</li>
          <li>Animasi Halus (Framer Motion)</li>
          <li>Responsif untuk semua ukuran layar</li>
        </ul>
      </div>

      <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100">
        <h3 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
          <AlertCircle size={20} />
          Catatan Penting
        </h3>
        <p className="text-sm text-amber-700">
          Pastikan Anda telah menginstal <span className="font-bold">Android SDK</span> dan <span className="font-bold">Android Studio</span> di komputer Anda sebelum melakukan proses build.
        </p>
      </div>

      <div className="text-center pt-4">
        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">Tugas Kreatif v1.0.0</p>
      </div>
    </div>
  );
};
