import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import 'xterm/css/xterm.css';

interface Props {
  height?: number;
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
        background: '#05050c',
        foreground: '#00ffcc',
        cursor: '#ff00aa',
        selectionBackground: '#ff00aa44',
        black: '#000',
        brightCyan: '#00ffcc',
        brightMagenta: '#ff00aa'
      },
      fontSize: 12,
      fontFamily: 'JetBrains Mono, Fira Code, monospace',
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

    term.writeln('\x1b[36mFAKALITI SHELL v4.3\x1b[0m — type commands, ↑↓ history');
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
        const { ipcRenderer } = (window as any).require('electron');
        const res = await ipcRenderer.invoke('shell:exec', cmd);
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

    const onResize = () => fit.fit();
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      term.dispose();
      termRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%' }}
      className="rounded border border-cyan-800/50 overflow-hidden"
    />
  );
}
