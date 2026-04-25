import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { MessageSquare, X, Send, Sparkles, Loader2, Bot } from 'lucide-react';
import { logActivity } from '../services/firebase';

export const AIChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'bot', text: string }[]>([
    { role: 'bot', text: 'Halo! Saya asisten AI Tim Kreatif Katedral Medan. Ada yang bisa saya bantu terkait jadwal, rotasi petugas, atau teknis live streaming?' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsTyping(true);

    await logActivity('CHAT_MESSAGE', { text: userText });

    try {
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY || 'MISSING_API_KEY' });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: [{ parts: [{ text: userText }] }],
        config: {
          systemInstruction: `Anda adalah asisten AI cerdas untuk pengelola tim kreatif gereja (Paroki Katedral Medan). 
          Tugas Anda membantu admin dalam:
          1. Menjelaskan aturan rotasi adil (memprioritaskan petugas yang jarang tugas).
          2. Memberikan saran motivasi bagi petugas yang berhalangan hadir.
          3. Memberikan solusi teknis seputar OBS, audio mixing (Sound), dan pengambilan gambar (Cam).
          
          Gunakan bahasa Indonesia yang ramah, profesional, dan sedikit santai (hangat). 
          Fokus pada kemaslahatan pelayanan tim kreatif gereja.`,
          thinkingConfig: { thinkingBudget: 32768 }
        }
      });

      const botResponse = response.text || "Maaf, saya sedang mengalami kendala saat memproses permintaan Anda.";
      setMessages(prev => [...prev, { role: 'bot', text: botResponse }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'bot', text: "Maaf, terjadi gangguan koneksi dengan asisten AI." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-6 w-14 h-14 bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center z-[100] active:scale-90 transition-transform hover:rotate-12 border-2 border-white/20"
        title="Bantuan AI"
      >
        <Sparkles size={24} />
      </button>

      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-96 sm:h-[600px] bg-white z-[110] flex flex-col shadow-2xl sm:rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4">
          <div className="bg-indigo-600 p-4 text-white flex justify-between items-center shadow-lg">
            <div className="flex items-center gap-2">
              <div className="bg-white/20 p-2 rounded-lg">
                <Bot size={20} />
              </div>
              <span className="font-bold tracking-tight">AI Kreatif Assistant</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 no-scrollbar">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-white text-slate-800 rounded-tl-none border border-gray-100'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl border border-gray-100 flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-indigo-600" />
                  <span className="text-xs font-medium text-slate-400">Sedang berpikir...</span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-white border-t border-gray-100 flex gap-2">
            <input 
              type="text" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              placeholder="Tanya asisten AI..."
              className="flex-1 bg-gray-100 border-none rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isTyping}
              className="bg-indigo-600 text-white p-2 rounded-xl active:scale-95 disabled:opacity-50 transition-all shadow-md"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};