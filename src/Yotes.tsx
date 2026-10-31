import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Lock, Plus } from 'lucide-react';
import { renderMd } from './lib/md';
import { useVault } from './vault';
import { Btn, Empty, Field, Label } from './ui';

function strength(p: string): { pct: number; label: string; cls: string } {
  if (p.length === 0) return { pct: 0, label: '', cls: 'bg-line' };
  if (p.length < 10) return { pct: 25, label: 'prekratko', cls: 'bg-red' };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter(r => r.test(p)).length;
  if (p.length >= 16 || (p.length >= 12 && kinds >= 3)) return { pct: 100, label: 'jaka', cls: 'bg-cy' };
  return { pct: 60, label: 'prolazna', cls: 'bg-amber' };
}

export default function Yotes() {
  const { status, notes, error, init, create, unlock, lock, save, remove, exportRows } = useVault();
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [show, setShow] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(false);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');
  const [flash, setFlash] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const flashT = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { if (status === 'loading') init(); }, [status, init]);

  const say = (m: string) => {
    setFlash(m);
    clearTimeout(flashT.current);
    flashT.current = setTimeout(() => setFlash(''), 2500);
  };

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? notes.filter(n => (n.title + ' ' + n.tags.join(' ') + ' ' + n.content).toLowerCase().includes(f)) : notes;
  }, [notes, filter]);

  const load = (id: string | null) => {
    const n = notes.find(x => x.id === id);
    setSel(id);
    setTitle(n?.title ?? '');
    setTags(n?.tags.join(', ') ?? '');
    setContent(n?.content ?? '');
    setPreview(false);
    setConfirmDel(false);
  };

  const submitAuth = async () => {
    setLocalErr('');
    if (status === 'new' && pass !== pass2) return setLocalErr('Passphrase se ne poklapa.');
    setBusy(true);
    try { await (status === 'new' ? create(pass) : unlock(pass)); }
    finally { setBusy(false); setPass(''); setPass2(''); }
  };

  const doSave = async () => {
    if (!title.trim() && !content.trim()) return;
    const id = await save(sel, {
      title: title.trim() || 'Bez naslova',
      content,
      tags: tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean),
      source: 'User'
    });
    setSel(id);
    say('Sačuvano i šifrovano');
  };

  const doDelete = async () => {
    if (!sel) return;
    if (!confirmDel) { setConfirmDel(true); setTimeout(() => setConfirmDel(false), 3000); return; }
    await remove(sel);
    load(null);
    say('Obrisano');
  };

  const doExport = async () => {
    const blob = new Blob([await exportRows()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `yotes-${new Date().toISOString().slice(0, 10)}.yenc.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    say('Šifrovani backup preuzet');
  };

  if (status === 'loading') return <div className="text-[12px] text-dim" role="status">Učitavam sef...</div>;

  if (status !== 'unlocked') {
    const isNew = status === 'new';
    const st = strength(pass);
    return (
      <form className="space-y-3" onSubmit={e => { e.preventDefault(); submitAuth(); }}>
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-surface text-cy"><Lock size={18} /></div>
          <div>
            <h2 className="m-0 text-[14px] font-bold">{isNew ? 'Napravi sef' : 'Sef je zaključan'}</h2>
            <p className="m-0 mt-0.5 text-[12px] leading-relaxed text-dim">
              {isNew
                ? 'Beleške se šifruju na ovom računaru (AES-256-GCM). Bez passphrase nema oporavka.'
                : 'Unesi passphrase da otključaš beleške. Sef se sam zaključava posle 5 minuta.'}
            </p>
          </div>
        </div>

        <div>
          <Label htmlFor="yp1">{isNew ? 'Passphrase, najmanje 10 karaktera' : 'Passphrase'}</Label>
          <div className="relative">
            <Field id="yp1" type={show ? 'text' : 'password'} value={pass} onChange={e => setPass(e.target.value)}
              autoComplete="off" autoFocus className="pr-9" />
            <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Sakrij passphrase' : 'Prikaži passphrase'}
              className="absolute right-1.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center text-dim hover:text-cy">
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {isNew && pass && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-line"><div className={`h-full ${st.cls}`} style={{ width: `${st.pct}%` }} /></div>
              <span className="w-16 text-right text-[11px] text-dim">{st.label}</span>
            </div>
          )}
        </div>

        {isNew && (
          <div>
            <Label htmlFor="yp2">Ponovi passphrase</Label>
            <Field id="yp2" type={show ? 'text' : 'password'} value={pass2} onChange={e => setPass2(e.target.value)} autoComplete="off" />
          </div>
        )}

        {(error || localErr) && <div role="alert" className="text-[12px] text-red">{localErr || error}</div>}

        <Btn type="submit" tone="primary" disabled={busy || !pass || (isNew && !pass2)} className="!h-10 w-full">
          {busy ? 'Računam ključ...' : isNew ? 'Napravi sef' : 'Otključaj'}
        </Btn>
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Field value={filter} onChange={e => setFilter(e.target.value)} placeholder="Traži po naslovu, tagu ili tekstu" aria-label="Pretraga beleški" />
        <Btn onClick={() => load(null)} aria-label="Nova beleška" title="Nova beleška" className="!h-9 !w-9 !px-0"><Plus size={16} /></Btn>
        <Btn onClick={lock} tone="danger" aria-label="Zaključaj sef (Ctrl+L)" title="Zaključaj sef (Ctrl+L)" className="!h-9 !w-9 !px-0"><Lock size={15} /></Btn>
      </div>

      {notes.length === 0 ? (
        <Empty title="Sef je prazan">Napiši prvu belešku ispod ili sačuvaj rezultat iz Dork taba.</Empty>
      ) : (
        <ul className="m-0 max-h-32 list-none space-y-0.5 overflow-y-auto p-0">
          {shown.length === 0 && <li className="px-2 py-1 text-[12px] text-dim">Nema rezultata za „{filter}“.</li>}
          {shown.map(n => (
            <li key={n.id}>
              <button onClick={() => load(n.id)} aria-current={sel === n.id}
                className={`flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] ${
                  sel === n.id ? 'bg-raised text-cy' : 'text-text hover:bg-raised/60'}`}>
                <span className="truncate">{n.title}</span>
                {n.tags.length > 0 && <span className="shrink-0 text-[11px] text-mg/80">#{n.tags[0]}{n.tags.length > 1 ? ` +${n.tags.length - 1}` : ''}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <Field value={title} onChange={e => setTitle(e.target.value)} placeholder="Naslov" aria-label="Naslov beleške" />
        <Field value={tags} onChange={e => setTags(e.target.value)} placeholder="Tagovi, odvojeni zarezom" aria-label="Tagovi" />
        {preview ? (
          <div className="fk-md h-44 overflow-auto rounded-md border border-line bg-surface p-3 text-[13px]"
            dangerouslySetInnerHTML={{ __html: renderMd(content) }} />
        ) : (
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Markdown. Slike su isključene iz bezbednosnih razloga."
            aria-label="Tekst beleške"
            className="h-44 w-full resize-none rounded-md border border-line bg-surface p-3 text-[13px] leading-relaxed text-text placeholder:text-dim/70 focus:border-cy/70 focus:ring-1 focus:ring-cy/40" />
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Btn tone="primary" onClick={doSave}>Sačuvaj</Btn>
          <Btn onClick={() => setPreview(p => !p)}>{preview ? 'Uredi' : 'Pregled'}</Btn>
          {sel && <Btn tone="danger" onClick={doDelete}>{confirmDel ? 'Klikni opet' : 'Obriši'}</Btn>}
          <Btn onClick={doExport} className="ml-auto">Izvezi</Btn>
        </div>
        <div role="status" aria-live="polite" className="h-4 text-[12px] text-cy">{flash}</div>
      </div>
    </div>
  );
}
