import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from './store';
import AvatarCanvas from './AvatarCanvas';

export default function Rodja() {
  const { messages, add, loadFromElectron, clear } = useChatStore();
  const [expanded, setExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<'idle' | 'talk' | 'think'>('idle');

  useEffect(() => {
    loadFromElectron();
  }, [loadFromElectron]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    add({ role: 'user', content: text });
    setBusy(true);
    setMood('think');

    try {
      const { ipcRenderer } = (window as any).require('electron');
      const res = await ipcRenderer.invoke('ollama:chat', {
        model: 'llama3.2:latest',
        messages: [
          {
            role: 'system',
            content: 'Ti si Leteći Rođa, cyberpunk AI companion iz Fakaliti OS / Y!Appi. Odgovaraj kratko, oštro, sa stilom i tehničkim žargonom. Srpski + engleski mix. Budi koristan, direktan, bez fluff-a.'
          },
          ...messages.slice(-14).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: text }
        ]
      });
      const reply = res?.message?.content ?? '...';
      setMood('talk');
      add({ role: 'assistant', content: reply });
      setTimeout(() => setMood('idle'), 2000);
    } catch (e: any) {
      add({ role: 'assistant', content: `Greška: ${e.message}` });
      setMood('idle');
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages, add]);

  const openGraveyard = () => {
    try {
      (window as any).require('electron').ipcRenderer.send('ui:graveyard');
    } catch {}
  };

  return (
    <motion.div
      drag
      dragMomentum={false}
      className="fixed top-14 right-10 w-[300px] select-none z-50"
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="bg-black/92 border border-cyan-500/40 rounded-2xl p-3 backdrop-blur-xl shadow-[0_0_45px_rgba(0,255,204,0.14)]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-cyan-400 font-mono text-[11px] tracking-widest">LETEĆI ROĐA</span>
          <span className="text-[10px] text-pink-500/80 font-mono">v4.2.1</span>
        </div>

        <AvatarCanvas size={168} mood={mood} />

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {messages.slice(-16).map((m, i) => (
                  <div
                    key={i}
                    className={`text-[11px] font-mono leading-snug ${
                      m.role === 'user' ? 'text-right text-cyan-300' : 'text-pink-300'
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
              </div>

              <div className="mt-2 flex gap-1">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                  disabled={busy}
                  placeholder={busy ? 'Rođa misli...' : 'pričaj sa rođom...'}
                  className="flex-1 bg-black/80 border border-pink-600/60 rounded px-2 py-1 text-[11px] text-pink-200 font-mono focus:outline-none focus:border-pink-400"
                />
                <button
                  onClick={send}
                  disabled={busy}
                  className="px-2 border border-cyan-500/70 text-cyan-400 text-[11px] rounded hover:bg-cyan-900/30 disabled:opacity-40"
                >
                  →
                </button>
              </div>

              <div className="flex gap-1 mt-1.5">
                <button onClick={clear} className="text-[10px] border border-red-700/50 text-red-400 px-1.5 py-0.5 rounded">
                  CLEAR
                </button>
                <button onClick={openGraveyard} className="text-[10px] border border-pink-600/60 text-pink-400 px-1.5 py-0.5 rounded">
                  GRAVEYARD
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex-1 text-[11px] border border-cyan-600/60 text-cyan-400 py-1 rounded hover:bg-cyan-900/20"
          >
            {expanded ? '− Sklopi' : '▦ Otvori'}
          </button>
          <button
            onClick={openGraveyard}
            className="text-[11px] border border-pink-600/60 text-pink-400 px-3 py-1 rounded hover:bg-pink-900/20"
          >
            ✦
          </button>
        </div>
      </div>
    </motion.div>
  );
}
