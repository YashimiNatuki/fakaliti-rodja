import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import 'xterm/css/xterm.css';
import { invoke } from './api';

interface Props {
  height?: number | string;
}

export default function TermPanel({ height = 220 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const history = useRef<string[]>([]);
  const histIdx = useRef(-1);
  const currentLine = useRef('');

  useEffect(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#0d121d',
        foreground: '#d8e3f2',
        cursor: '#ff3da6',
        selectionBackground: '#ff3da644',
        black: '#070a12',
        red: '#ff4d5e',
        green: '#19f0d0',
        yellow: '#ffb020',
        cyan: '#19f0d0',
        magenta: '#ff3da6',
        brightCyan: '#19f0d0',
        brightMagenta: '#ff3da6'
      },
      fontSize: 13,
      fontFamily: '"JetBrains Mono Variable", "JetBrains Mono", Consolas, monospace',
      cursorBlink: true,
      convertEol: true,
      rows: 12,
      cols: 48
    });

    const fit = new FitAddon();
    const links = new WebLinksAddon();
    term.loadAddon(fit);
    term.loadAddon(links);
    term.open(containerRef.current);
    fit.fit();
    fitRef.current = fit;
    termRef.current = term;

    term.writeln('\x1b[36mFAKALITI SHELL v5.0\x1b[0m: komande, ↑↓ istorija');
    term.write('\x1b[35mroot@fakaliti\x1b[0m:\x1b[36m~\x1b[0m$ ');

    const run = async (cmd: string) => {
      if (!cmd.trim()) {
        term.write('\r\n\x1b[35mroot@fakaliti\x1b[0m:\x1b[36m~\x1b[0m$ ');
        return;
      }
      history.current.push(cmd);
      if (history.current.length > 80) history.current.shift();
      histIdx.current = -1;

      try {
        const res = await invoke('shell:exec', cmd);
        term.write('\r\n');
        if (res.out) {
          // colorize simple
          const lines = res.out.split('\n');
          lines.forEach((l: string) => {
            if (l.includes('error') || l.includes('Error') || !res.ok) {
              term.writeln('\x1b[31m' + l + '\x1b[0m');
            } else {
              term.writeln(l);
            }
          });
        }
        term.write('\x1b[35mroot@fakaliti\x1b[0m:\x1b[36m~\x1b[0m$ ');
      } catch (e: any) {
        term.writeln('\r\n\x1b[31m' + e.message + '\x1b[0m');
        term.write('\x1b[35mroot@fakaliti\x1b[0m:\x1b[36m~\x1b[0m$ ');
      }
    };

    term.onData((data) => {
      if (data === '\r') {
        const cmd = currentLine.current;
        currentLine.current = '';
        run(cmd);
      } else if (data === '\u007f') {
        // backspace
        if (currentLine.current.length > 0) {
          currentLine.current = currentLine.current.slice(0, -1);
          term.write('\b \b');
        }
      } else if (data === '\u001b[A') {
        // up
        if (history.current.length === 0) return;
        if (histIdx.current === -1) histIdx.current = history.current.length - 1;
        else if (histIdx.current > 0) histIdx.current--;
        const h = history.current[histIdx.current] || '';
        term.write('\x1b[2K\r\x1b[35mroot@fakaliti\x1b[0m:\x1b[36m~\x1b[0m$ ' + h);
        currentLine.current = h;
      } else if (data === '\u001b[B') {
        // down
        if (histIdx.current === -1) return;
        histIdx.current++;
        if (histIdx.current >= history.current.length) {
          histIdx.current = -1;
          term.write('\x1b[2K\r\x1b[35mroot@fakaliti\x1b[0m:\x1b[36m~\x1b[0m$ ');
          currentLine.current = '';
        } else {
          const h = history.current[histIdx.current];
          term.write('\x1b[2K\r\x1b[35mroot@fakaliti\x1b[0m:\x1b[36m~\x1b[0m$ ' + h);
          currentLine.current = h;
        }
      } else if (data >= ' ' && data <= '~') {
        currentLine.current += data;
        term.write(data);
      }
    });

    const ro = new ResizeObserver(() => { try { fit.fit(); } catch { /* hidden */ } });
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      term.dispose();
      termRef.current = null;
    };
  }, []);

  return (
    <div style={{ height, width: '100%' }} className="overflow-hidden rounded-md border border-line bg-surface p-2">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
