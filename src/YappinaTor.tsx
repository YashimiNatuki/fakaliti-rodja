import { useMemo, useState } from 'react';
import { Copy, ExternalLink, Play, RefreshCw } from 'lucide-react';
import { invoke } from './api';
import { buildDork, makeEngines, normalizeDomain, TEMPLATES, DEFAULT_AHMIA_ONION } from './lib/dork';
import { extractLinks, type Link } from './lib/links';
import { useVault } from './vault';
import type { TorState } from './status';
import { Btn, Empty, Field, Label, Select, StatusDot } from './ui';

interface Props {
  tor: TorState | null;
  refreshTor: () => Promise<void>;
}

export default function YappinaTor({ tor, refreshTor }: Props) {
  const [target, setTarget] = useState('');
  const [tplId, setTplId] = useState(TEMPLATES[0].id);
  const [query, setQuery] = useState('');
  const [engineId, setEngineId] = useState('ahmia-tor');
  const [ahmia, setAhmia] = useState(DEFAULT_AHMIA_ONION);
  const [results, setResults] = useState<Link[] | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState('');
  const vault = useVault();

  const engines = useMemo(() => makeEngines(ahmia.trim() || DEFAULT_AHMIA_ONION), [ahmia]);
  const engine = engines.find(e => e.id === engineId)!;
  const tpl = TEMPLATES.find(t => t.id === tplId)!;

  const applyTemplate = () => {
    if (!tpl.needsTarget) { setMsg(null); return setQuery(buildDork(tpl.build(''))); }
    const d = normalizeDomain(target);
    if (!d) return setMsg({ text: 'Unesi domen bez razmaka, na primer tvoj-domen.com.', bad: true });
    setMsg(null);
    setQuery(buildDork(tpl.build(d)));
  };

  const run = async () => {
    const q = query.trim();
    if (!q) return;
    setBusy(true); setMsg(null); setResults(null);
    try {
      if (engine.route === 'external') {
        await invoke('shell:open', engine.url(q));
        setMsg({ text: `Otvoreno u browseru: ${engine.name}.` });
      } else {
        const r = await invoke('tor:fetch', engine.url(q));
        if (!r.ok) {
          setMsg({ text: r.status === 0 ? r.body : `Server je vratio HTTP ${r.status}.`, bad: true });
        } else {
          const links = extractLinks(r.body);
          setResults(links);
          setMsg({ text: links.length ? `${links.length} rezultata, preuzeto preko Tora.` : 'Nema rezultata za ovaj upit.' });
        }
        refreshTor();
      }
    } catch (e: any) {
      setMsg({ text: e.message, bad: true });
    } finally {
      setBusy(false);
    }
  };

  const saveToYotes = async () => {
    if (vault.status !== 'unlocked') return setMsg({ text: 'Otključaj sef u Yotes tabu pa pokušaj opet.', bad: true });
    const md = `# ${query}\n\n_${engine.name}, ${new Date().toISOString()}_\n\n` +
      (results ?? []).map(r => `- [${r.title.replace(/[\[\]]/g, '')}](${r.href})`).join('\n');
    await vault.save(null, { title: `Dork: ${query.slice(0, 60)}`, content: md, tags: ['osint', 'yappinator'], source: 'YappinaTor' });
    setMsg({ text: 'Sačuvano u Yotes, šifrovano.' });
  };

  const copy = (href: string) => {
    navigator.clipboard?.writeText(href);
    setCopied(href);
    setTimeout(() => setCopied(''), 1500);
  };

  const isOnion = (h: string) => { try { return new URL(h).hostname.endsWith('.onion'); } catch { return false; } };
  const browserEngines = engines.filter(e => e.route === 'external');
  const torEngines = engines.filter(e => e.route === 'tor');
  const torNeeded = engine.route === 'tor' && tor && !tor.up;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="m-0 text-[14px] font-bold">Yappinator</h2>
        <button onClick={refreshTor} title="Proveri Tor ponovo"
          className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-dim hover:border-cy/50 hover:text-text">
          <StatusDot state={tor === null ? 'idle' : tor.up ? 'ok' : 'bad'} />
          {tor === null ? 'Proveravam Tor' : tor.up ? `Tor radi na :${tor.port}` : 'Tor nije pokrenut'}
          <RefreshCw size={11} aria-hidden />
        </button>
      </div>

      <section className="space-y-2" aria-label="Cilj">
        <div>
          <Label htmlFor="dk-target">Domen koji pretražuješ</Label>
          <Field id="dk-target" value={target} onChange={e => setTarget(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyTemplate()}
            placeholder="tvoj-domen.com" />
        </div>
        <div>
          <Label htmlFor="dk-tpl">Šablon upita</Label>
          <div className="flex gap-2">
            <Select id="dk-tpl" value={tplId} onChange={e => setTplId(e.target.value)} className="min-w-0 flex-1">
              {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </Select>
            <Btn onClick={applyTemplate} className="!h-9">Primeni</Btn>
          </div>
        </div>
      </section>

      <section className="space-y-2" aria-label="Upit">
        <div>
          <Label htmlFor="dk-q">Upit</Label>
          <Field id="dk-q" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()}
            placeholder='site:domen.com filetype:pdf "tekst"' />
        </div>
        <div>
          <Label htmlFor="dk-engine">Pretraživač</Label>
          <div className="flex gap-2">
            <Select id="dk-engine" value={engineId} onChange={e => setEngineId(e.target.value)} className="min-w-0 flex-1">
              <optgroup label="Otvara u browseru">
                {browserEngines.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </optgroup>
              <optgroup label="Preko Tora">
                {torEngines.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </optgroup>
            </Select>
            <Btn tone="primary" onClick={run} disabled={busy || !query.trim() || !!torNeeded} className="!h-9">
              <Play size={13} aria-hidden />{busy ? 'Tražim...' : 'Pokreni'}
            </Btn>
          </div>
        </div>
        {engine.id === 'ahmia-tor' && (
          <div>
            <Label htmlFor="dk-onion">Ahmia .onion adresa (menja se, ažuriraj po potrebi)</Label>
            <Field id="dk-onion" value={ahmia} onChange={e => setAhmia(e.target.value)} className="!text-[11px]" />
          </div>
        )}
        {torNeeded && (
          <p className="m-0 text-[12px] leading-relaxed text-amber">
            Ovaj pretraživač traži Tor. Pokreni Tor ili Tor Browser, pa klikni na oznaku Tor gore.
          </p>
        )}
      </section>

      <div role="status" aria-live="polite" className={`min-h-4 text-[12px] ${msg?.bad ? 'text-red' : 'text-cy'}`}>{msg?.text}</div>

      {results && results.length > 0 && (
        <section className="space-y-2" aria-label="Rezultati">
          <ul className="m-0 max-h-64 list-none space-y-1 overflow-y-auto p-0">
            {results.map(r => (
              <li key={r.href} className="rounded-md border border-line bg-surface px-3 py-2">
                <div className="truncate text-[13px] text-text">{r.title}</div>
                <div className="truncate text-[11px] text-dim">{r.href}</div>
                <div className="mt-1.5 flex gap-3 text-[12px]">
                  <button onClick={() => copy(r.href)} className="flex items-center gap-1 text-mg hover:underline">
                    <Copy size={12} aria-hidden />{copied === r.href ? 'Kopirano' : 'Kopiraj'}
                  </button>
                  {!isOnion(r.href) && (
                    <button onClick={() => invoke('shell:open', r.href)} className="flex items-center gap-1 text-mg hover:underline">
                      <ExternalLink size={12} aria-hidden />Otvori
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <Btn onClick={saveToYotes} className="w-full">Sačuvaj rezultate u Yotes</Btn>
          <p className="m-0 text-[11px] leading-relaxed text-dim">Onion linkovi se ne otvaraju iz ove aplikacije. Kopiraj ih u Tor Browser.</p>
        </section>
      )}

      {results === null && !msg && !query && (
        <Empty title="Još nema upita">Izaberi šablon i domen, ili ukucaj sopstveni upit.</Empty>
      )}
    </div>
  );
}
