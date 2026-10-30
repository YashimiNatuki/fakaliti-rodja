import { useEffect, useMemo, useState } from 'react';
import { invoke } from './api';
import { buildDork, makeEngines, normalizeDomain, TEMPLATES, DEFAULT_AHMIA_ONION } from './lib/dork';
import { extractLinks, type Link } from './lib/links';
import { useVault } from './vault';

const inp = 'w-full bg-black/80 border border-pink-600/55 rounded px-2 py-1 text-[11px] text-pink-200 font-mono focus:outline-none focus:border-pink-400';
const btn = 'text-[10px] font-mono border border-cyan-600/60 text-cyan-300 px-2 py-1 rounded hover:bg-cyan-900/30 disabled:opacity-40';

export default function YappinaTor() {
  const [target, setTarget] = useState('');
  const [tplId, setTplId] = useState(TEMPLATES[0].id);
  const [query, setQuery] = useState('');
  const [engineId, setEngineId] = useState('ahmia-tor');
  const [ahmia, setAhmia] = useState(DEFAULT_AHMIA_ONION);
  const [tor, setTor] = useState<{ up: boolean; port: number | null } | null>(null);
  const [results, setResults] = useState<Link[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const vault = useVault();

  const engines = useMemo(() => makeEngines(ahmia.trim() || DEFAULT_AHMIA_ONION), [ahmia]);
  const engine = engines.find(e => e.id === engineId)!;
  const tpl = TEMPLATES.find(t => t.id === tplId)!;

  const checkTor = () => invoke('tor:status').then(setTor).catch(() => setTor({ up: false, port: null }));
  useEffect(() => { checkTor(); }, []);

  const applyTemplate = () => {
    if (!tpl.needsTarget) return setQuery(buildDork(tpl.build('')));
    const d = normalizeDomain(target);
    if (!d) return setMsg('Nevalidan domen.');
    setMsg('');
    setQuery(buildDork(tpl.build(d)));
  };

  const run = async () => {
    const q = query.trim();
    if (!q) return;
    setBusy(true); setMsg(''); setResults([]);
    try {
      if (engine.route === 'external') {
        await invoke('shell:open', engine.url(q));
        setMsg(`Otvoreno u browseru (${engine.name}).`);
      } else {
        const r = await invoke('tor:fetch', engine.url(q));
        if (!r.ok) {
          setMsg(r.body && r.status === 0 ? r.body : `HTTP ${r.status}`);
        } else {
          const links = extractLinks(r.body);
          setResults(links);
          setMsg(`${links.length} rezultata preko Tor-a.`);
        }
        checkTor();
      }
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  };

  const saveToYotes = async () => {
    if (vault.status !== 'unlocked') return setMsg('Otključaj YOTES prvo.');
    const md = `# ${query}\n\n_${engine.name}, ${new Date().toISOString()}_\n\n` +
      results.map(r => `- [${r.title.replace(/[\[\]]/g, '')}](${r.href})`).join('\n');
    await vault.save(null, { title: `Dork: ${query.slice(0, 60)}`, content: md, tags: ['osint', 'yappinator'], source: 'YappinaTor' });
    setMsg('Sačuvano u Yotes (šifrovano).');
  };

  const isOnion = (h: string) => { try { return new URL(h).hostname.endsWith('.onion'); } catch { return false; } };

  return (
    <div className="mt-1 space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-cyan-400">YAPPINATOR</span>
        <button onClick={checkTor} className={tor?.up ? 'text-green-400' : 'text-red-400'}>
          TOR {tor === null ? '...' : tor.up ? `● :${tor.port}` : '○ offline'}
        </button>
      </div>

      <div className="flex gap-1">
        <input value={target} onChange={e => setTarget(e.target.value)} placeholder="tvoj-domen.com" className={inp} />
      </div>
      <div className="flex gap-1">
        <select value={tplId} onChange={e => setTplId(e.target.value)} className={inp + ' !w-auto flex-1'}>
          {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <button onClick={applyTemplate} className={btn}>→</button>
      </div>

      <input value={query} onChange={e => setQuery(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && run()} placeholder='site:x.com filetype:pdf "tekst"' className={inp} />

      <div className="flex gap-1">
        <select value={engineId} onChange={e => setEngineId(e.target.value)} className={inp + ' !w-auto flex-1'}>
          {engines.map(e => <option key={e.id} value={e.id}>{e.route === 'tor' ? '🧅 ' : ''}{e.name}</option>)}
        </select>
        <button onClick={run} disabled={busy || !query.trim()} className={btn}>{busy ? '...' : 'RUN'}</button>
      </div>

      {engine.id === 'ahmia-tor' && (
        <input value={ahmia} onChange={e => setAhmia(e.target.value)} className={inp + ' !text-[9px]'} title="Ahmia .onion host" />
      )}

      {msg && <div className="text-[10px] font-mono text-pink-300/90">{msg}</div>}

      {results.length > 0 && (
        <>
          <div className="max-h-36 overflow-auto space-y-1 border border-cyan-900/50 rounded p-1.5 bg-black/70">
            {results.map(r => (
              <div key={r.href} className="text-[10px] font-mono">
                <div className="text-cyan-200 truncate">{r.title}</div>
                <div className="flex gap-2 items-center">
                  <span className="text-cyan-700 truncate flex-1">{r.href}</span>
                  <button className="text-pink-400" onClick={() => navigator.clipboard?.writeText(r.href)}>copy</button>
                  {!isOnion(r.href) && <button className="text-pink-400" onClick={() => invoke('shell:open', r.href)}>open</button>}
                </div>
              </div>
            ))}
          </div>
          <button onClick={saveToYotes} className={btn}>→ YOTES</button>
        </>
      )}
      <div className="text-[9px] font-mono text-cyan-800">
        Onion linkovi se ne otvaraju u običnom browseru: kopiraj u Tor Browser.
      </div>
    </div>
  );
}
