import { useEffect, useMemo, useState } from 'react';
import { renderMd } from './lib/md';
import { useVault } from './vault';

const inp = 'w-full bg-black/80 border border-pink-600/55 rounded px-2 py-1 text-[11px] text-pink-200 font-mono focus:outline-none focus:border-pink-400';
const btn = 'text-[10px] font-mono border border-cyan-600/60 text-cyan-300 px-2 py-1 rounded hover:bg-cyan-900/30 disabled:opacity-40';

export default function Yotes() {
  const { status, notes, error, init, create, unlock, lock, save, remove, exportRows } = useVault();
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [preview, setPreview] = useState(false);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [localErr, setLocalErr] = useState('');

  useEffect(() => { if (status === 'loading') init(); }, [status, init]);

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
  };

  const submitAuth = async () => {
    setLocalErr('');
    if (status === 'new' && pass !== pass2) return setLocalErr('Passphrase se ne poklapa.');
    setBusy(true);
    try { await (status === 'new' ? create(pass) : unlock(pass)); } finally { setBusy(false); setPass(''); setPass2(''); }
  };

  const doSave = async () => {
    if (!title.trim() && !content.trim()) return;
    const id = await save(sel, {
      title: title.trim() || 'bez naslova',
      content,
      tags: tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean),
      source: 'User'
    });
    setSel(id);
  };

  const doExport = async () => {
    const blob = new Blob([await exportRows()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `yotes-${new Date().toISOString().slice(0, 10)}.yenc.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  if (status === 'loading') return <div className="text-[10px] text-cyan-700 font-mono mt-1">...</div>;

  if (status !== 'unlocked') {
    return (
      <div className="mt-1 space-y-1.5">
        <div className="text-[10px] font-mono text-cyan-400">
          {status === 'new' ? 'YOTES: napravi sef (AES-256-GCM, PBKDF2 600k)' : 'YOTES zaključan'}
        </div>
        <input type="password" value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submitAuth()}
          placeholder="passphrase" className={inp} autoFocus />
        {status === 'new' && (
          <>
            <input type="password" value={pass2} onChange={e => setPass2(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submitAuth()}
              placeholder="ponovi passphrase" className={inp} />
            <div className="text-[9px] font-mono text-red-400/80">
              Nema recovery-ja. Zaboravljena passphrase = izgubljene beleške.
            </div>
          </>
        )}
        <button onClick={submitAuth} disabled={busy || !pass} className={btn}>
          {busy ? 'derivacija ključa...' : status === 'new' ? 'NAPRAVI SEF' : 'OTKLJUČAJ'}
        </button>
        {(error || localErr) && <div className="text-[10px] font-mono text-red-400">{localErr || error}</div>}
      </div>
    );
  }

  return (
    <div className="mt-1 space-y-1.5">
      <div className="flex gap-1">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="traži..." className={inp} />
        <button onClick={() => load(null)} className={btn}>+</button>
        <button onClick={lock} className={btn + ' !border-red-700/60 !text-red-400'}>LOCK</button>
      </div>

      <div className="max-h-20 overflow-y-auto space-y-0.5">
        {shown.length === 0 && <div className="text-[10px] font-mono text-cyan-800">nema beleški</div>}
        {shown.map(n => (
          <button key={n.id} onClick={() => load(n.id)}
            className={`block w-full text-left text-[10px] font-mono truncate px-1 rounded ${
              sel === n.id ? 'bg-cyan-900/40 text-cyan-200' : 'text-cyan-500 hover:bg-cyan-900/20'}`}>
            {n.title}{n.tags.length ? <span className="text-pink-500/70"> #{n.tags.join(' #')}</span> : null}
          </button>
        ))}
      </div>

      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="naslov" className={inp} />
      <input value={tags} onChange={e => setTags(e.target.value)} placeholder="tagovi, zarezom" className={inp} />
      {preview ? (
        <div className="max-h-32 overflow-auto text-[11px] text-cyan-100 font-mono border border-cyan-900/50 rounded p-2 bg-black/70
                        [&_a]:text-pink-400 [&_h1]:text-sm [&_h2]:text-xs [&_code]:text-pink-300 [&_pre]:whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: renderMd(content) }} />
      ) : (
        <textarea value={content} onChange={e => setContent(e.target.value)} rows={6}
          placeholder="markdown..." className={inp + ' resize-none'} />
      )}
      <div className="flex gap-1 flex-wrap">
        <button onClick={doSave} className={btn}>SAČUVAJ</button>
        <button onClick={() => setPreview(p => !p)} className={btn}>{preview ? 'EDIT' : 'PREVIEW'}</button>
        {sel && <button onClick={async () => { await remove(sel); load(null); }} className={btn + ' !border-red-700/60 !text-red-400'}>DEL</button>}
        <button onClick={doExport} className={btn}>EXPORT</button>
      </div>
    </div>
  );
}
