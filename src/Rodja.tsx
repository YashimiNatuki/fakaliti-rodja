import { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, Globe, Lock, MessageSquare, Minus, Pin, PinOff, Send, Terminal, Trash2, Unlock, Wrench } from 'lucide-react';
import { useChatStore } from './store';
import AvatarCanvas from './AvatarCanvas';
import TermPanel from './Terminal';
import Yotes from './Yotes';
import YappinaTor from './YappinaTor';
import Spark from './Spark';
import { Btn, Empty, StatusDot, type Dot } from './ui';
import { invoke, send } from './api';
import { useVault } from './vault';
import { useTelemetry } from './telemetry';
import { useStatus } from './status';
import { buildContext, search } from './lib/rag';

type Tab = 'chat' | 'yotes' | 'dork' | 'term' | 'tools' | 'sys';

const SYSTEM_PROMPT =
  'Ti si Leteći Rođa, cyberpunk AI companion iz Fakaliti OS / Y!Appi. Odgovaraj kratko, oštro, sa stilom i tehničkim žargonom. Srpski + engleski mix. Budi koristan, direktan, bez fluff-a. Ako korisnik traži shell/terminal, reci da koristi Term tab.';

const SUGGESTIONS = ['Objasni Z-score telemetriju', 'Cheat-sheet za ss i netstat', 'Kako da ojačam SSH?'];

const TOOLS: { id: string; label: string }[] = [
  { id: 'uptime', label: 'Uptime' },
  { id: 'ls', label: 'ls -la' },
  { id: 'node', label: 'Node i npm' },
  { id: 'git', label: 'Git status' },
  { id: 'ollama', label: 'Ollama modeli' }
];

export default function Rodja() {
  const { messages, add, loadFromElectron, clear } = useChatStore();
  const vaultStatus = useVault(s => s.status);
  const [tab, setTab] = useState<Tab>('chat');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState<'idle' | 'talk' | 'think'>('idle');
  const [toolOut, setToolOut] = useState('');
  const [ragHits, setRagHits] = useState(0);
  const [pinned, setPinned] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const tele = useTelemetry(true);
  const status = useStatus();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadFromElectron(); }, [loadFromElectron]);
  useEffect(() => { if (vaultStatus === 'loading') useVault.getState().init(); }, [vaultStatus]);
  useEffect(() => { invoke('win:pin', false).then(setPinned).catch(() => {}); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages.length, busy, tab]);

  const tabs: { id: Tab; label: string; icon: JSX.Element; hint: string }[] = [
    { id: 'chat', label: 'Chat', icon: <MessageSquare size={16} />, hint: 'Ctrl+1' },
    { id: 'yotes', label: 'Yotes', icon: vaultStatus === 'unlocked' ? <Unlock size={16} /> : <Lock size={16} />, hint: 'Ctrl+2' },
    { id: 'dork', label: 'Dork', icon: <Globe size={16} />, hint: 'Ctrl+3' },
    { id: 'term', label: 'Term', icon: <Terminal size={16} />, hint: 'Ctrl+4' },
    { id: 'tools', label: 'Alati', icon: <Wrench size={16} />, hint: 'Ctrl+5' },
    { id: 'sys', label: 'Sys', icon: <Activity size={16} />, hint: 'Ctrl+6' }
  ];

  // Ctrl+1..6 switch tabs, Ctrl+L locks the vault
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 6) { e.preventDefault(); setTab(tabs[n - 1].id); }
      else if (e.key.toLowerCase() === 'l') { e.preventDefault(); useVault.getState().lock(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || busy) return;
    setInput('');
    add({ role: 'user', content: text });
    setBusy(true);
    setMood('think');

    // RAG only while the vault is unlocked. Notes stay on this machine (local Ollama).
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
      setMood('talk');
      add({ role: 'assistant', content: res?.message?.content ?? '...' });
      setTimeout(() => setMood('idle'), 1800);
    } catch (e: any) {
      add({ role: 'assistant', content: `Greška: ${e.message}` });
      setMood('idle');
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages, add]);

  const runTool = async (action: string) => {
    setToolOut('Izvršavam...');
    try {
      const sh = async (cmd: string) => (await invoke('shell:exec', cmd)).out;
      if (action === 'uptime') {
        const i = await invoke('system:info');
        setToolOut(`Uptime ${Math.floor(i.uptime / 3600)}h ${Math.floor((i.uptime % 3600) / 60)}m\nHost ${i.hostname}\nMem ${i.memUsedPct}% zauzeto`);
      } else if (action === 'ls') setToolOut((await sh('ls -la')) || 'prazno');
      else if (action === 'node') setToolOut((await sh('node -v && npm -v')) || 'node nije nađen');
      else if (action === 'git') setToolOut((await sh('git status -sb 2>/dev/null || echo "nije git repo"')) || '...');
      else if (action === 'ollama') {
        const r = await invoke('shell:exec', 'curl -s http://127.0.0.1:11434/api/tags | head -c 600');
        setToolOut(r.out || 'Ollama nije pokrenut. Pokreni: ollama serve');
      }
    } catch (e: any) {
      setToolOut(e.message);
    }
  };

  const { info, cpu, mem, cpuH, memH, anomaly } = tele;
  const oDot: Dot = status.ollama === null ? 'idle' : status.ollama ? 'ok' : 'bad';
  const tDot: Dot = status.tor === null ? 'idle' : status.tor.up ? 'ok' : 'bad';
  const chip = 'flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-[11px] text-dim transition-colors hover:border-cy/50 hover:text-text [-webkit-app-region:no-drag]';

  return (
    <div className="h-screen p-1.5">
      <div
        className={`relative flex h-full flex-col overflow-hidden rounded-2xl border bg-void/95 backdrop-blur-xl ${
          anomaly ? 'animate-fk-alert border-red' : 'border-line'
        }`}
      >
        {/* Header: drag handle, identity, live status */}
        <header className="flex items-center gap-3 px-3 pb-2 pt-3 [-webkit-app-region:drag]">
          <AvatarCanvas size={150} display={52} mood={mood} alert={anomaly} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <h1 className="m-0 text-[15px] font-bold text-cy">Leteći Rođa</h1>
              <span className="text-[11px] text-dim">v5.0</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <button className={chip} onClick={status.refresh} title="Ollama na 127.0.0.1:11434. Klik osvežava.">
                <StatusDot state={oDot} />Ollama
              </button>
              <button className={chip} onClick={() => setTab('dork')} title={status.tor?.up ? `Tor SOCKS5 na :${status.tor.port}` : 'Tor nije pokrenut'}>
                <StatusDot state={tDot} />Tor
              </button>
              <button className={chip} onClick={() => setTab('yotes')} title="Ctrl+L zaključava sef">
                <StatusDot state={vaultStatus === 'unlocked' ? 'ok' : 'idle'} />
                {vaultStatus === 'unlocked' ? 'Sef otvoren' : 'Sef zaključan'}
              </button>
            </div>
          </div>
          <div className="flex gap-1 self-start [-webkit-app-region:no-drag]">
            <button
              aria-label={pinned ? 'Otkači prozor sa vrha' : 'Zakači prozor na vrh'}
              title={pinned ? 'Uvek na vrhu: uključeno' : 'Uvek na vrhu: isključeno'}
              onClick={() => invoke('win:pin', true).then(setPinned)}
              className="grid h-7 w-7 place-items-center rounded-md text-dim hover:bg-raised hover:text-cy"
            >
              {pinned ? <Pin size={14} /> : <PinOff size={14} />}
            </button>
            <button
              aria-label="Sakrij u tray"
              title="Sakrij u tray"
              onClick={() => send('win:hide')}
              className="grid h-7 w-7 place-items-center rounded-md text-dim hover:bg-raised hover:text-red"
            >
              <Minus size={14} />
            </button>
          </div>
        </header>

        {/* Tabs */}
        <nav role="tablist" aria-label="Sekcije" className="grid grid-cols-6 border-y border-line bg-surface/60">
          {tabs.map(t => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                title={t.hint}
                onClick={() => setTab(t.id)}
                className={`relative flex flex-col items-center gap-1 py-2 text-[11px] transition-colors ${
                  on ? 'bg-raised text-cy' : 'text-dim hover:text-text'
                }`}
              >
                {t.icon}
                {t.label}
                {on && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-cy" />}
                {t.id === 'sys' && anomaly && <span className="absolute right-3 top-1.5 h-1.5 w-1.5 rounded-full bg-red" aria-label="anomalija" />}
              </button>
            );
          })}
        </nav>

        {/* Body */}
        <main key={tab} role="tabpanel" className="animate-fk-in flex min-h-0 flex-1 flex-col p-3">
          {tab === 'chat' && (
            <>
              <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1" aria-live="polite">
                {messages.length === 0 && !busy && (
                  <div className="space-y-2">
                    <Empty title="Pitaj Rođu bilo šta.">
                      Otključaj sef u Yotes tabu pa će znati i tvoje beleške.
                    </Empty>
                    <div className="flex flex-wrap gap-1.5">
                      {SUGGESTIONS.map(s => (
                        <button key={s} onClick={() => submit(s)}
                          className="rounded-full border border-line px-2.5 py-1 text-[12px] text-dim hover:border-cy/50 hover:text-cy">
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.slice(-30).map((m, i) => (
                  <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex'}>
                    <div
                      className={`max-w-[88%] whitespace-pre-wrap break-words text-[13px] leading-relaxed ${
                        m.role === 'user'
                          ? 'rounded-lg rounded-br-sm border border-line bg-raised px-3 py-1.5 text-text'
                          : 'border-l-2 border-mg/70 pl-3 text-text'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {busy && (
                  <div className="border-l-2 border-mg/70 pl-3 text-[13px] text-dim" role="status">
                    Rođa misli<span className="fk-dot">.</span><span className="fk-dot">.</span><span className="fk-dot">.</span>
                  </div>
                )}
                <div ref={endRef} />
              </div>

              {ragHits > 0 && <div className="mt-2 text-[11px] text-cy/80">U kontekstu: {ragHits} {ragHits === 1 ? 'beleška' : 'beleške'} iz Yotes</div>}

              <form className="mt-2 flex gap-2" onSubmit={e => { e.preventDefault(); submit(); }}>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={busy}
                  aria-label="Poruka za Rođu"
                  placeholder={busy ? 'Čekam odgovor...' : 'Napiši poruku i Enter'}
                  className="h-10 min-w-0 flex-1 rounded-md border border-line bg-surface px-3 text-[13px] text-text placeholder:text-dim/70 focus:border-cy/70 focus:ring-1 focus:ring-cy/40 disabled:opacity-60"
                />
                <Btn type="submit" tone="primary" disabled={busy || !input.trim()} aria-label="Pošalji" className="!h-10 !w-10 !px-0">
                  <Send size={16} />
                </Btn>
              </form>
              {messages.length > 0 && (
                <button
                  onClick={() => { if (confirmClear) { clear(); setConfirmClear(false); } else { setConfirmClear(true); setTimeout(() => setConfirmClear(false), 3000); } }}
                  className={`mt-1.5 flex items-center gap-1.5 self-start text-[11px] ${confirmClear ? 'text-red' : 'text-dim hover:text-text'}`}
                >
                  <Trash2 size={12} />{confirmClear ? 'Klikni opet da obrišeš istoriju' : 'Obriši istoriju'}
                </button>
              )}
            </>
          )}

          {tab === 'yotes' && <div className="min-h-0 flex-1 overflow-y-auto pr-1"><Yotes /></div>}
          {tab === 'dork' && <div className="min-h-0 flex-1 overflow-y-auto pr-1"><YappinaTor tor={status.tor} refreshTor={status.refresh} /></div>}
          {tab === 'term' && <div className="min-h-0 flex-1"><TermPanel height="100%" /></div>}

          {tab === 'tools' && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-2">
                {TOOLS.map(b => <Btn key={b.id} onClick={() => runTool(b.id)} className="!h-10">{b.label}</Btn>)}
              </div>
              {toolOut
                ? <pre className="m-0 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface p-3 text-[12px] leading-relaxed text-text">{toolOut}</pre>
                : <Empty title="Izaberi alat">Izlaz se pojavljuje ovde.</Empty>}
            </div>
          )}

          {tab === 'sys' && (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <div className={`flex items-center justify-between rounded-md border px-3 py-2 text-[13px] ${
                anomaly ? 'border-red/60 bg-red/10 text-red' : 'border-line bg-surface text-cy'}`}>
                <span>{anomaly ? 'Anomalija otkrivena' : 'Sistem u normali'}</span>
                <span className="text-[11px] text-dim">prag |z| &gt; 2</span>
              </div>
              <Spark data={cpuH} label="CPU" />
              <Spark data={memH} label="Memorija" />
              {info && (
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[12px]">
                  <dt className="text-dim">Host</dt><dd className="m-0 truncate">{info.hostname}</dd>
                  <dt className="text-dim">OS</dt><dd className="m-0">{info.platform}/{info.arch}</dd>
                  <dt className="text-dim">CPU</dt><dd className="m-0 truncate">{info.cpus}× {info.model}</dd>
                  <dt className="text-dim">RAM</dt><dd className="m-0">{info.memFree} MB slobodno od {info.memTotal} MB</dd>
                  <dt className="text-dim">Uptime</dt><dd className="m-0">{Math.floor(info.uptime / 3600)}h {Math.floor((info.uptime % 3600) / 60)}m</dd>
                </dl>
              )}
            </div>
          )}
        </main>

        {/* Status line: always-visible telemetry + graveyard */}
        <footer className="flex items-center justify-between gap-2 border-t border-line bg-surface/60 px-3 py-2 text-[11px]">
          <span className={anomaly ? 'text-red' : 'text-dim'}>
            {cpu && mem
              ? `cpu ${cpu.x.toFixed(0)}% mem ${mem.x.toFixed(0)}% ${cpu.n >= 10 ? `z ${cpu.z >= 0 ? '+' : ''}${cpu.z.toFixed(1)}` : 'zagrevanje'}`
              : 'telemetrija se pokreće'}
          </span>
          <button onClick={() => send('ui:graveyard')} className="text-mg hover:underline">Otvori Graveyard</button>
        </footer>
      </div>
    </div>
  );
}
