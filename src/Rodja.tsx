import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from './store';
import AvatarCanvas from './AvatarCanvas';
import TermPanel from './Terminal';

type Tab = 'chat' | 'term' | 'tools' | 'sys';

export default function Rodja() {
  const { messages, add, loadFromElectron, clear } = useChatStore();
  const [expanded, setExpanded] = useState(true);
  const [tab, setTab] = useState<Tab>('chat');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<'idle' | 'talk' | 'think'>('idle');
  const [sys, setSys] = useState<any>(null);
  const [toolOut, setToolOut] = useState('');

  useEffect(() => {
    loadFromElectron();
  }, [loadFromElectron]);

  useEffect(() => {
    if (tab === 'sys') {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        ipcRenderer.invoke('system:info').then(setSys);
        const id = setInterval(() => ipcRenderer.invoke('system:info').then(setSys), 4000);
        return () => clearInterval(id);
      } catch {}
    }
  }, [tab]);

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
            content: 'Ti si Leteći Rođa, cyberpunk AI companion iz Fakaliti OS / Y!Appi. Odgovaraj kratko, oštro, sa stilom i tehničkim žargonom. Srpski + engleski mix. Budi koristan, direktan, bez fluff-a. Ako korisnik traži shell/terminal, reci da koristi TERM tab.'
          },
          ...messages.slice(-16).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: text }
        ]
      });
      const reply = res?.message?.content ?? '...';
      setMood('talk');
      add({ role: 'assistant', content: reply });
      setTimeout(() => setMood('idle'), 1800);
    } catch (e: any) {
      add({ role: 'assistant', content: `Greška: ${e.message}` });
      setMood('idle');
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages, add]);

  const runTool = async (action: string) => {
    setToolOut('...');
    try {
      const { ipcRenderer } = (window as any).require('electron');
      if (action === 'uptime') {
        const info = await ipcRenderer.invoke('system:info');
        setToolOut(`Uptime: ${Math.floor(info.uptime / 3600)}h ${Math.floor((info.uptime % 3600) / 60)}m\nHost: ${info.hostname}\nMem: ${info.memUsedPct}% used`);
      } else if (action === 'ls') {
        const res = await ipcRenderer.invoke('shell:exec', 'ls -la');
        setToolOut(res.out || 'empty');
      } else if (action === 'node') {
        const res = await ipcRenderer.invoke('shell:exec', 'node -v && npm -v');
        setToolOut(res.out || 'no node');
      } else if (action === 'git') {
        const res = await ipcRenderer.invoke('shell:exec', 'git status -sb 2>/dev/null || echo "not a git repo"');
        setToolOut(res.out || '...');
      } else if (action === 'ollama') {
        const res = await ipcRenderer.invoke('shell:exec', 'curl -s http://127.0.0.1:11434/api/tags 2>/dev/null | head -c 400 || echo "ollama offline"');
        setToolOut(res.out || 'offline');
      }
    } catch (e: any) {
      setToolOut(e.message);
    }
  };

  const openGraveyard = () => {
    try {
      (window as any).require('electron').ipcRenderer.send('ui:graveyard');
    } catch {}
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'chat', label: 'CHAT' },
    { id: 'term', label: 'TERM' },
    { id: 'tools', label: 'TOOLS' },
    { id: 'sys', label: 'SYS' }
  ];

  return (
    <motion.div
      drag
      dragMomentum={false}
      className="fixed top-10 right-8 w-[340px] select-none z-50"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="bg-black/93 border border-cyan-500/45 rounded-2xl p-3 backdrop-blur-xl shadow-[0_0_50px_rgba(0,255,204,0.12)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-cyan-400 font-mono text-[11px] tracking-widest">LETEĆI ROĐA</span>
          <span className="text-[10px] text-pink-500/80 font-mono">v4.3</span>
        </div>

        <AvatarCanvas size={150} mood={mood} />

        {/* Tabs */}
        <div className="flex gap-1 mt-2 mb-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setExpanded(true); }}
              className={`flex-1 text-[10px] font-mono py-1 rounded border ${
                tab === t.id
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-900/30'
                  : 'border-cyan-800/50 text-cyan-700 hover:border-cyan-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {expanded && (
            <motion.div
              key={tab}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              {/* CHAT */}
              {tab === 'chat' && (
                <div className="mt-1">
                  <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                    {messages.slice(-14).map((m, i) => (
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
                      placeholder={busy ? 'Rođa misli...' : 'pričaj...'}
                      className="flex-1 bg-black/80 border border-pink-600/55 rounded px-2 py-1 text-[11px] text-pink-200 font-mono focus:outline-none focus:border-pink-400"
                    />
                    <button
                      onClick={send}
                      disabled={busy}
                      className="px-2 border border-cyan-500/70 text-cyan-400 text-[11px] rounded hover:bg-cyan-900/30 disabled:opacity-40"
                    >
                      →
                    </button>
                  </div>
                  <button onClick={clear} className="mt-1 text-[10px] border border-red-800/40 text-red-400 px-1.5 py-0.5 rounded">
                    CLEAR
                  </button>
                </div>
              )}

              {/* TERMINAL */}
              {tab === 'term' && (
                <div className="mt-1">
                  <TermPanel height={210} />
                </div>
              )}

              {/* TOOLS */}
              {tab === 'tools' && (
                <div className="mt-1 space-y-1.5">
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { id: 'uptime', label: 'UPTIME' },
                      { id: 'ls', label: 'LS -LA' },
                      { id: 'node', label: 'NODE/NPM' },
                      { id: 'git', label: 'GIT STATUS' },
                      { id: 'ollama', label: 'OLLAMA' }
                    ].map(b => (
                      <button
                        key={b.id}
                        onClick={() => runTool(b.id)}
                        className="text-[10px] font-mono border border-cyan-700/60 text-cyan-400 py-1.5 rounded hover:bg-cyan-900/25"
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                  {toolOut && (
                    <pre className="text-[10px] font-mono text-cyan-200/90 bg-black/70 border border-cyan-900/50 rounded p-2 max-h-32 overflow-auto whitespace-pre-wrap">
                      {toolOut}
                    </pre>
                  )}
                </div>
              )}

              {/* SYSTEM */}
              {tab === 'sys' && sys && (
                <div className="mt-1 text-[10px] font-mono text-cyan-300 space-y-0.5">
                  <div>HOST   {sys.hostname}</div>
                  <div>OS     {sys.platform}/{sys.arch}</div>
                  <div>CPU    {sys.cpus}× {sys.model?.slice(0, 28)}</div>
                  <div>LOAD   {sys.load1} / {sys.load5}</div>
                  <div>MEM    {sys.memUsedPct}%  ({sys.memFree}MB free / {sys.memTotal}MB)</div>
                  <div>UP     {Math.floor(sys.uptime / 3600)}h {Math.floor((sys.uptime % 3600) / 60)}m</div>
                  <div className="pt-1 text-pink-400/80 truncate">HOME {sys.homedir}</div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer actions */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex-1 text-[11px] border border-cyan-600/55 text-cyan-400 py-1 rounded hover:bg-cyan-900/20"
          >
            {expanded ? '−' : '▦'}
          </button>
          <button
            onClick={openGraveyard}
            className="text-[11px] border border-pink-600/55 text-pink-400 px-3 py-1 rounded hover:bg-pink-900/20"
          >
            ✦ GRAVEYARD
          </button>
        </div>
      </div>
    </motion.div>
  );
}
