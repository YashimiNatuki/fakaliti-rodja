# Fakaliti Rodja Graveyard v4.3 — GAME CHANGER

Electron + React + Three.js holographic desktop companion.

## What's new in v4.3
- **Terminal tool** inside Rođa (xterm.js + real shell via Electron spawn)
- Multi-tab UX: CHAT · TERM · TOOLS · SYS
- System info live (CPU, mem, load, uptime)
- Quick tools: uptime, ls, node/npm, git status, ollama check
- Command history (↑↓) in terminal
- Dangerous command blocklist
- Graveyard: search + status filters + detail panel + selection glow
- More data on repos, better algorithms for layout & emissive

## Quick start
```bash
git clone https://github.com/YashimiNatuki/fakaliti-rodja.git
cd fakaliti-rodja
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Requirements
- Node 20+
- Ollama (optional): `ollama serve && ollama pull llama3.2:latest`

## Architecture
- `electron/main.js` — IPC: chat, ollama, shell:exec, system:info
- `src/Rodja.tsx` — floating multi-tab companion
- `src/Terminal.tsx` — xterm + history + color
- `src/Graveyard.tsx` — 3D monoliths + filters + detail
- Dual persistence (IndexedDB + encrypted electron-store)
