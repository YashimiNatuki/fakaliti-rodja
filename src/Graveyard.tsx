import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, Text, Stars } from '@react-three/drei';
import { useMemo, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

type Status = 'immortal' | 'infected' | 'buried';

interface Repo {
  name: string;
  status: Status;
  lang: string;
  desc?: string;
}

const RAW_REPOS: Repo[] = [
  { name: 'leteci-rodja', status: 'immortal', lang: 'JS', desc: 'antigravitacioni rodja' },
  { name: 'VKT-PozarevacCity', status: 'immortal', lang: 'C#', desc: 'Velika Kradja Tockova Unity' },
  { name: '3D-gta-Pozarevac', status: 'infected', lang: 'TS', desc: '3d gangser huslin' },
  { name: 'KomandniCentar', status: 'immortal', lang: 'TS', desc: 'kc' },
  { name: 'aichatbrat-web', status: 'immortal', lang: 'TS', desc: 'full-stack AIChatBrat' },
  { name: 'AiChatBrat-v.420', status: 'infected', lang: 'TS', desc: 'AiChatBrat Y!Appi' },
  { name: 'pozarevac-ai-orchestrator', status: 'immortal', lang: 'TS', desc: 'AI orchestrator' },
  { name: 'Yappinator', status: 'buried', lang: 'TS', desc: 'web app project' },
  { name: 'm0jCLI', status: 'buried', lang: 'TS', desc: 'CLI-processor' },
  { name: 'chatbrat-demo', status: 'immortal', lang: 'JS', desc: 'chatbrat DEMO' },
  { name: 'Yashimite', status: 'buried', lang: '', desc: '' },
  { name: 'yaction', status: 'buried', lang: '', desc: '' },
  { name: 'cale', status: 'buried', lang: '', desc: '' },
  { name: 'vojislavmarkovic', status: 'buried', lang: 'JS', desc: '' },
  { name: 'Yappinattor', status: 'buried', lang: '', desc: 'web app' },
  { name: 'AiChatBrat-v.420-by-Yashimi-Natuki-', status: 'infected', lang: 'TS', desc: 'ai chat brat' },
  { name: 'fakaliti-rodja', status: 'immortal', lang: 'TS', desc: 'THIS — holographic OS' }
];

const COLORS: Record<Status, THREE.Color> = {
  immortal: new THREE.Color('#00ffcc'),
  infected: new THREE.Color('#ff2244'),
  buried: new THREE.Color('#445566')
};

function Monolith({
  name, status, position, selected, onSelect
}: {
  name: string;
  status: Status;
  position: [number, number, number];
  selected: boolean;
  onSelect: () => void;
}) {
  const mesh = useRef<THREE.Mesh>(null!);
  const [hovered, setHover] = useState(false);

  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.elapsedTime;
    mesh.current.rotation.y = Math.sin(t * 0.38 + position[0]) * 0.12;
    const mat = mesh.current.material as THREE.MeshStandardMaterial;
    const base = selected ? 1.8 : hovered ? 1.4 : 0.5;
    mat.emissiveIntensity = base + Math.sin(t * 2.2 + position[2]) * 0.12;
    mesh.current.scale.setScalar(selected ? 1.12 : hovered ? 1.05 : 1);
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.45}>
      <mesh
        ref={mesh}
        position={position}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[0.92, 1.8, 0.13]} />
        <meshStandardMaterial
          color={COLORS[status]}
          emissive={COLORS[status]}
          emissiveIntensity={0.55}
          transparent
          opacity={0.44}
          roughness={0.2}
          metalness={0.75}
        />
        <Text position={[0, 0.12, 0.09]} fontSize={0.1} color="#fff" anchorX="center" anchorY="middle" maxWidth={0.82} outlineWidth={0.006} outlineColor="#000">
          {name.length > 16 ? name.slice(0, 14) + '…' : name}
        </Text>
        <Text position={[0, -0.52, 0.09]} fontSize={0.06} color={COLORS[status]} anchorX="center">
          {status.toUpperCase()}
        </Text>
      </mesh>
    </Float>
  );
}

function ParticleField() {
  const count = 500;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 32;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 18;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 26;
    }
    return arr;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color="#00ffcc" transparent opacity={0.48} sizeAttenuation />
    </points>
  );
}

export default function Graveyard() {
  const [filter, setFilter] = useState<'all' | Status>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Repo | null>(null);

  const filtered = useMemo(() => {
    return RAW_REPOS.filter(r => {
      if (filter !== 'all' && r.status !== filter) return false;
      if (query && !r.name.toLowerCase().includes(query.toLowerCase()) && !(r.desc || '').toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [filter, query]);

  const positions = useMemo(() => {
    return filtered.map((_, i) => {
      const a = i * 0.78;
      const r = 4.6 + (i % 4) * 0.55;
      return [
        Math.sin(a) * r,
        Math.cos(a * 1.2) * 2.2,
        Math.cos(a) * r * 0.8
      ] as [number, number, number];
    });
  }, [filtered]);

  const openRepo = useCallback((name: string) => {
    try {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.invoke('shell:open', `https://github.com/YashimiNatuki/${name}`);
    } catch {
      window.open(`https://github.com/YashimiNatuki/${name}`, '_blank');
    }
  }, []);

  const counts = useMemo(() => ({
    immortal: RAW_REPOS.filter(r => r.status === 'immortal').length,
    infected: RAW_REPOS.filter(r => r.status === 'infected').length,
    buried: RAW_REPOS.filter(r => r.status === 'buried').length
  }), []);

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden">
      {/* Top HUD */}
      <div className="absolute top-4 left-4 right-4 z-50 flex flex-wrap items-center gap-3 pointer-events-auto">
        <div className="font-mono text-cyan-400/90 text-sm tracking-wider">
          Y!APP GRAVEYARD // v4.3 // {filtered.length}/{RAW_REPOS.length}
        </div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="search repos..."
          className="bg-black/70 border border-cyan-700/50 text-cyan-300 text-xs font-mono px-2 py-1 rounded w-40 focus:outline-none focus:border-cyan-400"
        />
        <div className="flex gap-1">
          {(['all', 'immortal', 'infected', 'buried'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[10px] font-mono px-2 py-1 rounded border ${
                filter === f
                  ? 'border-cyan-400 text-cyan-300 bg-cyan-900/40'
                  : 'border-cyan-800/50 text-cyan-600'
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom stats */}
      <div className="absolute bottom-4 left-4 z-50 font-mono text-xs text-cyan-600/80 pointer-events-none">
        IMMORTAL {counts.immortal} · INFECTED {counts.infected} · BURIED {counts.buried}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="absolute top-16 right-4 z-50 w-64 bg-black/90 border border-cyan-500/40 rounded-xl p-3 font-mono text-xs text-cyan-200 pointer-events-auto">
          <div className="text-cyan-400 text-sm mb-1">{selected.name}</div>
          <div className="text-pink-400/80 mb-1">{selected.status.toUpperCase()} · {selected.lang || '—'}</div>
          <div className="text-cyan-600/90 mb-3">{selected.desc || 'no description'}</div>
          <div className="flex gap-2">
            <button
              onClick={() => openRepo(selected.name)}
              className="flex-1 border border-cyan-500/60 text-cyan-300 py-1 rounded hover:bg-cyan-900/30"
            >
              OPEN GITHUB
            </button>
            <button
              onClick={() => setSelected(null)}
              className="border border-pink-700/50 text-pink-400 px-2 py-1 rounded"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [0, 1.8, 14], fov: 46 }} dpr={[1, 1.8]} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#000008']} />
        <fog attach="fog" args={['#000010', 10, 36]} />
        <ambientLight intensity={0.16} />
        <pointLight position={[10, 8, 9]} color="#00ffcc" intensity={2.4} distance={45} />
        <pointLight position={[-9, -5, 6]} color="#ff00aa" intensity={1.7} distance={38} />
        <pointLight position={[0, 12, -7]} color="#4488ff" intensity={1} />
        <Stars radius={100} depth={50} count={3200} factor={3.4} saturation={0} fade speed={0.3} />
        <ParticleField />
        <OrbitControls enablePan={false} minDistance={6} maxDistance={26} maxPolarAngle={Math.PI * 0.87} enableDamping dampingFactor={0.07} />
        {filtered.map((r, i) => (
          <Monolith
            key={r.name}
            name={r.name}
            status={r.status}
            position={positions[i]}
            selected={selected?.name === r.name}
            onSelect={() => setSelected(r)}
          />
        ))}
      </Canvas>
    </div>
  );
}
