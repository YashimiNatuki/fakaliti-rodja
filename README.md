# Fakaliti Rodja v5.0

Electron + React + Three.js holographic desktop companion (Leteći Rođa) + 3D Graveyard + **Yotes** šifrovani sef + **YappinaTor** dork/onion pretraga + Z-score telemetrija. Sve lokalno, Ollama kao AI.

## Šta ima
| Tab | Šta radi |
|---|---|
| CHAT | Ollama chat. Kad je Yotes otključan, relevantne beleške idu kao kontekst (lokalni BM25, nema mreže). |
| YOTES | Sef beleški. AES-256-GCM, ključ iz PBKDF2-SHA256 (600k iteracija), non-extractable ključ samo u RAM-u, auto-lock 5 min. Markdown preview kroz DOMPurify, bez slika/iframe-ova (tracking pixel). Šifrovani export. |
| DORK | YappinaTor. Builder operatora (site/filetype/ext/intitle/inurl/...), šabloni, audit mode za sopstveni domen. Google/DDG/Bing/Brave u browseru; Ahmia (.onion i clearnet) i DDG-HTML **kroz Tor SOCKS5**. Rezultati u Yotes jednim klikom. |
| TERM | xterm + pravi shell (blocklist opasnih komandi). |
| TOOLS | Brze provere: uptime, ls, node, git, ollama. |
| SYS | Telemetrija: `Z = (X − μ) / σ` nad kliznim prozorom od 60 uzoraka za CPU% i MEM%. `|Z| > 2` posle warmup-a = `ANOMALY_DETECTED` (crveni puls). |

## Prečice
| Taster | Akcija |
|---|---|
| Ctrl+1 do Ctrl+6 | Chat, Yotes, Dork, Term, Alati, Sys |
| Ctrl+L | Zaključaj sef |
| Esc | Zatvori Graveyard |

Statusna linija u headeru uvek pokazuje Ollama, Tor i stanje sefa. Kad telemetrija javi anomaliju, okvir i oči avatara postaju crveni, a Sys tab dobija crvenu tačku. Pin dugme drži prozor na vrhu, a minus ga sakriva u tray (klik na tray ikonu ga vraća).

## Tor
Treba tvoj lokalni Tor: tor daemon (`127.0.0.1:9050`) ili Tor Browser (`:9150`). Aplikacija ga sama pronađe. Zahtevi idu kroz poseban Electron session sa jednim `socks5://` pravilom: nema fallback-a na direktnu vezu, a hostname se rešava kroz proxy (remote DNS), pa se `.onion` rešava i DNS ne curi. Ahmia `.onion` host je polje u UI-ju (indeksi se menjaju).

## Bezbednost
- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. Renderer vidi samo `window.fk` sa allowlist-om kanala (`electron/preload.cjs`).
- Ključ `electron-store`-a je nasumičan po instalaciji (OS keychain preko `safeStorage` kad postoji). Stari ključ iz v4.3 je bio hardkodovan u javnom repou; stari podaci se jednom migriraju.
- `shell:open` prima samo `http(s)`. Navigacija prozora je blokirana, linkovi idu u OS browser.
- Yotes passphrase nema recovery.

## Pokretanje
```bash
npm install
npm run dev        # Vite + Electron
npm test           # vitest: crypto, z-score, rag, dork, links, markdown
npm run typecheck
npm run build      # tsc + vite + Windows portable .exe
```
Node 20+. Ollama opciono: `ollama serve && ollama pull llama3.2:latest`.

## Arhitektura
- `electron/main.js`: IPC (chat, ollama, shell, system:info, tor:*), hardening
- `electron/preload.cjs`: allowlisted bridge
- `src/vault.ts`: Yotes store (IndexedDB samo šifrat) · `src/lib/crypto.ts`: WebCrypto
- `src/lib/rag.ts` · `src/lib/zscore.ts` · `src/lib/dork.ts` · `src/lib/links.ts` · `src/lib/md.ts`
- `src/Rodja.tsx`, `Yotes.tsx`, `YappinaTor.tsx`, `Graveyard.tsx`, `Terminal.tsx`

## Poznato / nije urađeno
- Keystroke-DNA lock, Docker sandbox, RAM scrubber i P2P mesh iz Blueprint v8.0 nisu implementirani.
- Nema CSP-a (drei `Text` vuče font sa CDN-a); Electron zato u dev-u prijavljuje upozorenje.
- Chat istorija (`electron-store`) nije vault-grade: odgovori koji citiraju Yotes ostaju u njoj.
