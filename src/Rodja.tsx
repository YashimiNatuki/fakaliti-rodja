import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatStore } from './store';
import AvatarCanvas from './AvatarCanvas';
import TermPanel from './Terminal';
import Yotes from './Yotes';
import YappinaTor from './YappinaTor';
import { invoke, send } from './api';
import { useVault } from './vault';
import { useTelemetry } from './telemetry';
import { buildContext, search } from './lib/rag';

type Tab = 'chat' | 'yotes' | 'dork' | 'term' | 'tools' | 'sys';

const SYSTEM_PROMPT =
  'Ti si Leteći Rođa, cyberpunk AI companion iz Fakaliti OS / Y!Appi. Odgovaraj kratko, oštro, sa stilom i tehničkim žargonom. Srpski + engleski mix. Budi koristan, direktan, bez fluff-a. Ako korisnik traži shell/terminal, reci da koristi TERM tab.';

export default function Rodja() {
  const { messages, add, loadFromElectron, clear } = useChatStore();
  const [expanded, setExpanded] = useState(true);
  const [tab, setTab] = useState<Tab>('chat');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<'idle' | 'talk' | 'think'>('idle');
  const [toolOut, setToolOut] = useState('');
  const [ragHits, setRagHits] = useState(0);
  const tele = useTelemetry(true);

  useEffect(() => {
    loadFromElectron();
  }, [loadFromElectron]);

  const send_ = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    add({ role: 'user', content: text });
    setBusy(true);
    setMood('think');

    // RAG: only while the vault is unlocked. Decrypted notes never leave this machine (local Ollama).
    const v = useVault.getState();
    const ctx = v.status === 'unlocked' ? buildContext(v.notes, text) : '';
    setRagHits(ctx ? search(v.notes, text, 3).length : 0);

    try {
      const res = await invoke('ollama:chat', {
        model: 'llama3.2:latest',
        messages: [
          { role: 'system', content: ctx ? `${SYSTEM_PROMPT}\n\n${ctx}` : SYSTEM_PROMPT },
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
      if (action === 'uptime') {
        const info = await invoke('system:info');
        setToolOut(`Uptime: ${Math.floor(info.uptime / 3600)}h ${Math.floor((info.uptime % 3600) / 60)}m\nHost: ${info.hostname}\nMem: ${info.memUsedPct}% used`);
      } else if (action === 'ls') {
        const res = await invoke('shell:exec', 'ls -la');
        setToolOut(res.out || 'empty');
      } else if (action === 'node') {
        const res = await invoke('shell:exec', 'node -v && npm -v');
        setToolOut(res.out || 'no node');
      } else if (action === 'git') {
        const res = await invoke('shell:exec', 'git status -sb 2>/dev/null || echo "not a git repo"');
        setToolOut(res.out || '...');
      } else if (action === 'ollama') {
        const res = await invoke('shell:exec', 'curl -s http://127.0.0.1:11434/api/tags 2>/dev/null | head -c 400 || echo "ollama offline"');
        setToolOut(res.out || 'offline');
      }
    } catch (e: any) {
      setToolOut(e.message);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'chat', label: 'CHAT' },
    { id: 'yotes', label: 'YOTES' },
    { id: 'dork', label: 'DORK' },
    { id: 'term', label: 'TERM' },
    { id: 'tools', label: 'TOOLS' },
    { id: 'sys', label: 'SYS' }
  ];

  const { info, cpu, mem, anomaly } = tele;
  const zFmt = (z?: number) => (z === undefined ? '-' : (z >= 0 ? '+' : '') + z.toFixed(2));

  return (
    <motion.div
      drag
      dragMomentum={false}
      className="fixed top-10 right-8 w-[340px] select-none z-50"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className={`bg-black/[.93] border rounded-2xl p-3 backdrop-blur-xl shadow-[0_0_50px_rgba(0,255,204,0.12)] ${
        anomaly ? 'border-red-500 animate-pulse' : 'border-cyan-500/45'}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-cyan-400 font-mono text-[11px] tracking-widest">LETEĆI ROĐA</span>
          <span className="text-[10px] font-mono">
            {anomaly && <span className="text-red-400 mr-2">⚠ ANOMALY</span>}
            <span className="text-pink-500/80">v5.0</span>
          </span>
        </div>

        <AvatarCanvas size={150} mood={mood} />

        {/* Tabs */}
        <div className="flex gap-1 mt-2 mb-1">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setExpanded(true); }}
              className={`flex-1 text-[9px] font-mono py-1 rounded border ${
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
                  {ragHits > 0 && (
                    <div className="text-[9px] font-mono text-cyan-700 mt-1">RAG: {ragHits} yote(s) u kontekstu</div>
                  )}
                  <div className="mt-2 flex gap-1">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send_()}
                      disabled={busy}
                      placeholder={busy ? 'Rođa misli...' : 'pričaj...'}
                      className="flex-1 bg-black/80 border border-pink-600/55 rounded px-2 py-1 text-[11px] text-pink-200 font-mono focus:outline-none focus:border-pink-400"
                    />
                    <button
                      onClick={send_}
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

              {tab === 'yotes' && <Yotes />}
              {tab === 'dork' && <YappinaTor />}

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

              {/* SYSTEM + Z-score telemetry */}
              {tab === 'sys' && info && (
                <div className="mt-1 text-[10px] font-mono text-cyan-300 space-y-0.5">
                  <div>HOST   {info.hostname}</div>
                  <div>OS     {info.platform}/{info.arch}</div>
                  <div>CPU    {info.cpus}× {info.model?.slice(0, 28)}</div>
                  <div>UP     {Math.floor(info.uptime / 3600)}h {Math.floor((info.uptime % 3600) / 60)}m</div>
                  <div className="pt-1 text-cyan-400">TELEMETRY  Z = (X − μ) / σ   prag |Z| &gt; 2</div>
                  <div className={cpu?.anomaly ? 'text-red-400' : ''}>
                    CPU  {info.cpuPct}%   μ {cpu?.mean.toFixed(1)}  σ {cpu?.sd.toFixed(1)}  Z {zFmt(cpu?.z)}
                  </div>
                  <div className={mem?.anomaly ? 'text-red-400' : ''}>
                    MEM  {info.memUsedPct}%   μ {mem?.mean.toFixed(1)}  σ {mem?.sd.toFixed(1)}  Z {zFmt(mem?.z)}
                  </div>
                  <div className="text-cyan-700">
                    baseline {cpu?.n ?? 0}/60 {(cpu?.n ?? 0) < 10 ? '(warmup)' : ''}
                  </div>
                  <div className={anomaly ? 'text-red-400' : 'text-green-400'}>
                    STATE {anomaly ? 'ANOMALY_DETECTED' : 'NOMINAL'}
                  </div>
                  <div className="pt-1 text-pink-400/80 truncate">HOME {info.homedir}</div>
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
            onClick={() => send('ui:graveyard')}
            className="text-[11px] border border-pink-600/55 text-pink-400 px-3 py-1 rounded hover:bg-pink-900/20"
          >
            ✦ GRAVEYARD
          </button>
        </div>
      </div>
    </motion.div>
  );
}
