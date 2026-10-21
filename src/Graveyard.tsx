import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Float, Text, Stars } from '@react-three/drei';
import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

const REPOS = [
  { name: 'leteci-rodja', status: 'immortal', lang: 'JS' },
  { name: 'VKT-PozarevacCity', status: 'immortal', lang: 'C#' },
  { name: '3D-gta-Pozarevac', status: 'infected', lang: 'TS' },
  { name: 'KomandniCentar', status: 'immortal', lang: 'TS' },
  { name: 'aichatbrat-web', status: 'immortal', lang: 'TS' },
  { name: 'AiChatBrat-v.420', status: 'infected', lang: 'TS' },
  { name: 'pozarevac-ai-orchestrator', status: 'immortal', lang: 'TS' },
  { name: 'Yappinator', status: 'buried', lang: 'TS' },
  { name: 'm0jCLI', status: 'buried', lang: 'TS' },
  { name: 'chatbrat-demo', status: 'immortal', lang: 'JS' },
  { name: 'Yashimite', status: 'buried', lang: '' },
  { name: 'yaction', status: 'buried', lang: '' },
  { name: 'cale', status: 'buried', lang: '' },
  { name: 'vojislavmarkovic', status: 'buried', lang: 'JS' },
  { name: 'Yappinattor', status: 'buried', lang: '' },
  { name: 'AiChatBrat-v.420-by-Yashimi-Natuki-', status: 'infected', lang: 'TS' },
  { name: 'fakaliti-rodja', status: 'immortal', lang: 'TS' }
] as const;

const COLORS = {
  immortal: new THREE.Color('#00ffcc'),
  infected: new THREE.Color('#ff2244'),
  buried: new THREE.Color('#445566')
};

function Monolith({ name, status, position, onSelect }: {
  name: string;
  status: keyof typeof COLORS;
  position: [number, number, number];
  onSelect: () => void;
}) {
  const mesh = useRef<THREE.Mesh>(null!);
  const [hovered, setHover] = useState(false);

  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.elapsedTime;
    mesh.current.rotation.y = Math.sin(t * 0.38 + position[0]) * 0.14;
    const mat = mesh.current.material as THREE.MeshStandardMaterial;
    mat.emissiveIntensity = hovered ? 1.55 : 0.52 + Math.sin(t * 2.1 + position[2]) * 0.14;
  });

  return (
    <Float speed={1.55} rotationIntensity={0.22} floatIntensity={0.5}>
      <mesh
        ref={mesh}
        position={position}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <boxGeometry args={[0.95, 1.85, 0.14]} />
        <meshStandardMaterial
          color={COLORS[status]}
          emissive={COLORS[status]}
          emissiveIntensity={0.55}
          transparent
          opacity={0.43}
          roughness={0.22}
          metalness={0.72}
        />
        <Text position={[0, 0.15, 0.09]} fontSize={0.105} color="#ffffff" anchorX="center" anchorY="middle" maxWidth={0.85} outlineWidth={0.007} outlineColor="#000">
          {name}
        </Text>
        <Text position={[0, -0.55, 0.09]} fontSize={0.065} color={COLORS[status]} anchorX="center">
          {status.toUpperCase()}
        </Text>
      </mesh>
    </Float>
  );
}

function ParticleField() {
  const count = 450;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 30;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 17;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 24;
    }
    return arr;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.032} color="#00ffcc" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

export default function Graveyard() {
  const openRepo = (name: string) => {
    try {
      const { ipcRenderer } = (window as any).require('electron');
      ipcRenderer.invoke('shell:open', `https://github.com/YashimiNatuki/${name}`);
    } catch {
      window.open(`https://github.com/YashimiNatuki/${name}`, '_blank');
    }
  };

  const positions = useMemo(() => {
    return REPOS.map((_, i) => {
      const a = i * 0.82;
      const r = 4.9 + (i % 3) * 0.65;
      return [
        Math.sin(a) * r,
        Math.cos(a * 1.25) * 2.35,
        Math.cos(a) * r * 0.82
      ] as [number, number, number];
    });
  }, []);

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden">
      <div className="absolute top-5 left-6 z-50 font-mono text-cyan-400/90 text-sm tracking-wider pointer-events-none">
        Y!APP GRAVEYARD // FAKALITI v4.2.1 // {REPOS.length} REPOS // LIVE GITHUB
      </div>
      <div className="absolute bottom-5 left-6 z-50 font-mono text-xs text-cyan-600/70 pointer-events-none">
        IMMORTAL {REPOS.filter(r => r.status === 'immortal').length} · INFECTED {REPOS.filter(r => r.status === 'infected').length} · BURIED {REPOS.filter(r => r.status === 'buried').length}
      </div>

      <Canvas camera={{ position: [0, 1.6, 13.5], fov: 47 }} dpr={[1, 1.8]} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}>
        <color attach="background" args={['#000008']} />
        <fog attach="fog" args={['#000010', 11, 34]} />
        <ambientLight intensity={0.17} />
        <pointLight position={[9, 7, 8]} color="#00ffcc" intensity={2.3} distance={42} />
        <pointLight position={[-8, -5, 5]} color="#ff00aa" intensity={1.65} distance={36} />
        <pointLight position={[0, 11, -6]} color="#4488ff" intensity={0.95} />
        <Stars radius={90} depth={45} count={2800} factor={3.2} saturation={0} fade speed={0.35} />
        <ParticleField />
        <OrbitControls enablePan={false} minDistance={6.5} maxDistance={24} maxPolarAngle={Math.PI * 0.86} enableDamping dampingFactor={0.075} />
        {REPOS.map((r, i) => (
          <Monolith key={r.name} name={r.name} status={r.status} position={positions[i]} onSelect={() => openRepo(r.name)} />
        ))}
      </Canvas>
    </div>
  );
}
