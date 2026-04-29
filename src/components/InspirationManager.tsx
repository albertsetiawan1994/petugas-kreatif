import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Sparkles, Loader2, Lightbulb, Send, Copy, Check, Search, Book, Music, Heart } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale/id';

// Safely get API key from either Vite env or Node env (for AI Studio preview)
const getApiKey = () => {
  if (import.meta.env && import.meta.env.VITE_GEMINI_API_KEY) {
    return import.meta.env.VITE_GEMINI_API_KEY;
  }
  if (typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) {
    return process.env.GEMINI_API_KEY;
  }
  return '';
};

const API_KEY = getApiKey();
const ai = new GoogleGenAI({ apiKey: API_KEY || 'MISSING_API_KEY' });

export const InspirationManager: React.FC<{
  canVerse?: boolean;
  canSong?: boolean;
  canLiturgy?: boolean;
  canPrayer?: boolean;
  canAiIdea?: boolean;
}> = ({
  canVerse = true,
  canSong = true,
  canLiturgy = true,
  canPrayer = true,
  canAiIdea = true
}) => {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [verseQuery, setVerseQuery] = useState('');
  const [verseResult, setVerseResult] = useState('');
  const [isVerseLoading, setIsVerseLoading] = useState(false);

  const [songQuery, setSongQuery] = useState('');
  const [songResult, setSongResult] = useState('');
  const [isSongLoading, setIsSongLoading] = useState(false);

  const [liturgyQuery, setLiturgyQuery] = useState('');
  const [liturgyResult, setLiturgyResult] = useState('');
  const [isLiturgyLoading, setIsLiturgyLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const handleSearchVerse = async () => {
    if (!verseQuery.trim()) return;
    if (!API_KEY || API_KEY === 'MISSING_API_KEY') {
      setVerseResult('Gagal: API Key Gemini belum diatur. Silakan tambahkan VITE_GEMINI_API_KEY di file .env Anda.');
      return;
    }
    
    setIsVerseLoading(true);
    setVerseResult('');
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Cari ayat Alkitab tentang: ${verseQuery}. Berikan teks ayat dan referensinya.`,
      });
      setVerseResult(response.text || 'Ayat tidak ditemukan.');
    } catch (err) {
      console.error(err);
      setVerseResult('Gagal mencari ayat.');
    } finally {
      setIsVerseLoading(false);
    }
  };

  const handleSearchSong = async () => {
    if (!songQuery.trim()) return;
    if (!API_KEY || API_KEY === 'MISSING_API_KEY') {
      setSongResult('Gagal: API Key Gemini belum diatur. Silakan tambahkan VITE_GEMINI_API_KEY di file .env Anda.');
      return;
    }

    setIsSongLoading(true);
    setSongResult('');
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Cari lirik lagu Puji Syukur atau Madah Bakti: ${songQuery}. Berikan lirik singkat atau refreinnya.`,
      });
      setSongResult(response.text || 'Lagu tidak ditemukan.');
    } catch (err) {
      console.error(err);
      setSongResult('Gagal mencari lagu.');
    } finally {
      setIsSongLoading(false);
    }
  };

  const handleSearchLiturgy = async () => {
    if (!liturgyQuery.trim()) return;
    if (!API_KEY || API_KEY === 'MISSING_API_KEY') {
      setLiturgyResult('Gagal: API Key Gemini belum diatur. Silakan tambahkan VITE_GEMINI_API_KEY di file .env Anda.');
      return;
    }

    setIsLiturgyLoading(true);
    setLiturgyResult('');
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Cari informasi Ibadat Harian atau renungan untuk: ${liturgyQuery}.`,
      });
      setLiturgyResult(response.text || 'Informasi tidak ditemukan.');
    } catch (err) {
      console.error(err);
      setLiturgyResult('Gagal mencari informasi.');
    } finally {
      setIsLiturgyLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    if (!API_KEY || API_KEY === 'MISSING_API_KEY') {
      setResult('Gagal: API Key Gemini belum diatur. Silakan tambahkan VITE_GEMINI_API_KEY di file .env Anda.');
      return;
    }

    setIsLoading(true);
    setResult('');
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Berikan ide kreatif dan inspiratif untuk: ${prompt}. Fokus pada kegiatan gereja, dekorasi, atau cara membuat acara lebih menarik dan bermakna. Berikan dalam format poin-poin yang jelas dan menarik.`,
      });
      setResult(response.text || 'Tidak ada hasil.');
    } catch (err) {
      console.error(err);
      setResult('Maaf, terjadi kesalahan saat mengambil inspirasi. Silakan coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchPrayer = async () => {
    if (!searchQuery.trim()) return;
    
    if (!API_KEY || API_KEY === 'MISSING_API_KEY') {
      setSearchResult('Gagal: API Key Gemini belum diatur. Silakan tambahkan VITE_GEMINI_API_KEY di file .env Anda.');
      return;
    }

    setIsSearching(true);
    setSearchResult('');
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Cari dan berikan teks doa Katolik untuk: ${searchQuery}. Jika itu doa umum (seperti Bapa Kami, Salam Maria), berikan teks lengkapnya. Jika doa khusus, berikan teks yang sesuai.`,
      });
      setSearchResult(response.text || 'Doa tidak ditemukan.');
    } catch (err) {
      console.error(err);
      setSearchResult('Maaf, terjadi kesalahan saat mencari doa.');
    } finally {
      setIsSearching(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 pb-24 max-w-screen-xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shadow-sm">
          <Lightbulb size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Inspirasi Kreatif</h2>
          <p className="text-slate-500 text-xs font-medium">Ide, Doa, dan Konten Rohani</p>
        </div>
      </div>

      {/* Search Sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Ayat Alkitab */}
        {canVerse && (
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col space-y-3">
          <div className="flex items-center gap-2 text-blue-600">
            <Book size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Ayat Alkitab</span>
          </div>
          <div className="relative">
            <input 
              type="text"
              value={verseQuery}
              onChange={(e) => setVerseQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchVerse()}
              placeholder="Cari ayat..."
              className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button onClick={handleSearchVerse} className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500">
              {isVerseLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </button>
          </div>
          {verseResult && (
            <div className="text-xs text-slate-600 italic bg-blue-50/50 p-3 rounded-xl border border-blue-100 max-h-[300px] overflow-y-auto custom-scrollbar">
              <ReactMarkdown>{verseResult}</ReactMarkdown>
            </div>
          )}
        </div>
        )}

        {/* Puji Syukur */}
        {canSong && (
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col space-y-3">
          <div className="flex items-center gap-2 text-emerald-600">
            <Music size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Puji Syukur / Madah Bakti</span>
          </div>
          <div className="relative">
            <input 
              type="text"
              value={songQuery}
              onChange={(e) => setSongQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchSong()}
              placeholder="Cari lagu..."
              className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
            <button onClick={handleSearchSong} className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500">
              {isSongLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </button>
          </div>
          {songResult && (
            <div className="text-xs text-slate-600 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 max-h-[300px] overflow-y-auto custom-scrollbar">
              <ReactMarkdown>{songResult}</ReactMarkdown>
            </div>
          )}
        </div>
        )}

        {/* Ibadat Harian */}
        {canLiturgy && (
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col space-y-3">
          <div className="flex items-center gap-2 text-rose-600">
            <Heart size={18} />
            <span className="text-[10px] font-black uppercase tracking-widest">Ibadat Harian</span>
          </div>
          <div className="relative">
            <input 
              type="text"
              value={liturgyQuery}
              onChange={(e) => setLiturgyQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchLiturgy()}
              placeholder="Cari renungan..."
              className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500/20"
            />
            <button onClick={handleSearchLiturgy} className="absolute right-2 top-1/2 -translate-y-1/2 text-rose-500">
              {isLiturgyLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            </button>
          </div>
          {liturgyResult && (
            <div className="text-xs text-slate-600 bg-rose-50/50 p-3 rounded-xl border border-rose-100 max-h-[300px] overflow-y-auto custom-scrollbar">
              <ReactMarkdown>{liturgyResult}</ReactMarkdown>
            </div>
          )}
        </div>
        )}
      </div>

      {/* Search Prayer Section */}
      {canPrayer && (
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Cari Doa</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchPrayer()}
              placeholder="Cari doa (misal: Doa Penyerahan, Novena...)"
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium text-slate-800"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          </div>
          <button
            onClick={handleSearchPrayer}
            disabled={isSearching || !searchQuery.trim()}
            className="px-6 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all disabled:bg-slate-200 active:scale-95"
          >
            {isSearching ? <Loader2 className="animate-spin" size={20} /> : "Cari"}
          </button>
        </div>
        
        {searchResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 relative max-h-[400px] overflow-y-auto custom-scrollbar"
          >
            <button
              onClick={() => copyToClipboard(searchResult)}
              className="absolute top-2 right-2 p-2 text-blue-400 hover:text-blue-600 transition-colors"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
            <div className="prose prose-slate max-w-none prose-sm">
              <ReactMarkdown>{searchResult}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </div>
      )}

      {/* AI Inspiration Section */}
      {canAiIdea && (
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Ide Kreatif AI</label>
        <div className="relative">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Tanyakan ide kreatif (misal: Dekorasi Misa, Ide Lagu...)"
            className="w-full px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all font-medium text-slate-800 placeholder:text-slate-400 min-h-[100px] resize-none"
          />
          <button
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
            className="absolute bottom-3 right-3 p-3 bg-amber-500 text-white rounded-xl shadow-lg shadow-amber-200 hover:bg-amber-600 transition-all disabled:bg-slate-200 active:scale-90"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </div>

        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 p-6 bg-white rounded-3xl border border-amber-100 relative max-h-[500px] overflow-y-auto custom-scrollbar"
          >
            <button
              onClick={() => copyToClipboard(result)}
              className="absolute top-4 right-4 p-2 bg-slate-50 text-slate-500 rounded-lg hover:bg-slate-100"
            >
              {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
            </button>
            <div className="flex items-center gap-2 mb-4 text-amber-600">
              <Sparkles size={18} />
              <span className="text-xs font-black uppercase tracking-widest">Saran AI</span>
            </div>
            <div className="prose prose-slate max-w-none prose-sm">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </motion.div>
        )}
      </div>
      )}
    </div>
  );
};
