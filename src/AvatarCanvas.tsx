import { useEffect, useRef } from 'react';

interface Props {
  size?: number; // internal drawing resolution
  display?: number; // CSS pixels; defaults to size
  mood?: 'idle' | 'talk' | 'think';
  alert?: boolean; // eyes + halo go red on telemetry anomaly
}

export default function AvatarCanvas({ size = 170, display, mood = 'idle', alert = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    let t = 0;
    const eye = alert ? '#ff4d5e' : '#00ffcc';
    const halo = alert ? 'rgba(255,77,94,0.22)' : 'rgba(0,255,204,0.18)';
    const rim = alert ? 'rgba(255,77,94,0.55)' : 'rgba(0,255,204,0.4)';

    const particles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
    for (let i = 0; i < 22; i++) {
      particles.push({
        x: size * 0.72,
        y: size * 0.28,
        vx: (Math.random() - 0.3) * 0.65,
        vy: -Math.random() * 1.5 - 0.35,
        life: Math.random()
      });
    }

    const draw = () => {
      t += 0.028;
      ctx.clearRect(0, 0, size, size);

      const grd = ctx.createRadialGradient(size / 2, size / 2, 8, size / 2, size / 2, size * 0.58);
      grd.addColorStop(0, halo);
      grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, size, size);

      ctx.fillStyle = '#0d0d1a';
      ctx.beginPath();
      ctx.ellipse(size / 2, size / 2 - 8, 58, 68, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = rim;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      const eyePulse = mood === 'talk' ? 1.9 : mood === 'think' ? 0.7 : 1.25;
      ctx.fillStyle = eye;
      ctx.shadowColor = eye;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(size / 2 - 20, size / 2 - 18, 7 + Math.sin(t * 2.2) * eyePulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(size / 2 + 20, size / 2 - 18, 7 + Math.sin(t * 2.2 + 0.9) * eyePulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#001a14';
      ctx.beginPath();
      ctx.arc(size / 2 - 20, size / 2 - 18, 3.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(size / 2 + 20, size / 2 - 18, 3.1, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ff00aa';
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2 + 18, 16, 0.22, Math.PI - 0.22);
      ctx.stroke();
      if (mood === 'talk') {
        const open = 0.5 + Math.sin(t * 9) * 0.28;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2 + 23, 11 * open, 0, Math.PI);
        ctx.stroke();
      }

      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.0075;
        if (p.life <= 0) {
          p.x = size * 0.72 + (Math.random() - 0.5) * 10;
          p.y = size * 0.28;
          p.vx = (Math.random() - 0.3) * 0.7;
          p.vy = -Math.random() * 1.6 - 0.3;
          p.life = 1;
        }
        ctx.fillStyle = `rgba(0,255,200,${p.life * 0.48})`;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, 9 * p.life, 15 * p.life, 0, 0, Math.PI * 2);
        ctx.fill();
      });

      raf.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(raf.current);
  }, [size, mood, alert]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="block rounded-full"
      style={{ width: display ?? size, height: display ?? size }}
      aria-hidden
    />
  );
}
