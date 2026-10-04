'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const CARD_W = 3.2, CARD_H = CARD_W * (630 / 1200);

/** Rasterize the route's own 1200×630 SVG mission card into a texture. */
function useSvgTexture(svg: string) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    const img = new Image();
    let tex: THREE.CanvasTexture | null = null;
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 1200; c.height = 630;
      c.getContext('2d')!.drawImage(img, 0, 0);
      tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      setTexture(tex);
    };
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    return () => { tex?.dispose(); };
  }, [svg]);
  return texture;
}

function backTexture(km: number, count: number) {
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 630;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0b0e14'; g.fillRect(0, 0, 1200, 630);
  g.strokeStyle = '#2a303c'; g.lineWidth = 2; g.strokeRect(30, 30, 1140, 570);
  g.fillStyle = '#8b909a'; g.font = '28px "DM Mono", monospace'; g.fillText('MARS EXPLORER · SHARED MARSWALK', 70, 110);
  g.fillStyle = '#f2f0ea'; g.font = '600 120px "Space Grotesk", sans-serif'; g.fillText(`${km.toFixed(2)} KM`, 70, 300);
  g.fillStyle = '#C45C26'; g.font = '36px "DM Mono", monospace'; g.fillText(`${count} WAYPOINTS · JEZERO CRATER`, 70, 380);
  g.fillStyle = '#8b909a'; g.font = '24px "DM Mono", monospace'; g.fillText('RESEARCH SKETCH · NON-CERTIFYING · NOT NAVIGATION GUIDANCE', 70, 540);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Card({ front, km, count }: { front: THREE.Texture; km: number; count: number }) {
  const group = useRef<THREE.Group>(null);
  const [back] = useState(() => backTexture(km, count));
  useEffect(() => () => back.dispose(), [back]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime, g = group.current;
    if (!g) return;
    // Hold each face, then flip with an ease; gentle float throughout.
    const phase = (t % 10) / 10, flip = phase < 0.4 ? 0 : phase < 0.5 ? (phase - 0.4) / 0.1 : phase < 0.9 ? 1 : 1 - (phase - 0.9) / 0.1;
    g.rotation.y = (0.5 - 0.5 * Math.cos(flip * Math.PI)) * Math.PI + Math.sin(t * 0.6) * 0.12;
    g.rotation.x = Math.sin(t * 0.45) * 0.06;
    g.position.y = Math.sin(t * 0.9) * 0.05;
  });
  return (
    <group ref={group}>
      <mesh><boxGeometry args={[CARD_W, CARD_H, 0.03]} /><meshStandardMaterial color="#1a1f28" metalness={0.4} roughness={0.4} /></mesh>
      <mesh position={[0, 0, 0.016]}><planeGeometry args={[CARD_W, CARD_H]} /><meshBasicMaterial map={front} toneMapped={false} /></mesh>
      <mesh position={[0, 0, -0.016]} rotation={[0, Math.PI, 0]}><planeGeometry args={[CARD_W, CARD_H]} /><meshBasicMaterial map={back} toneMapped={false} /></mesh>
    </group>
  );
}

/** The share page's actual mission card, presented as a floating, flipping 3D object. */
export default function CardFlip3D({ svg, km, count }: { svg: string; km: number; count: number }) {
  const front = useSvgTexture(svg);
  return (
    <div className="terrain-3d is-showcase">
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0.3, 4.4], fov: 38 }}>
        <color attach="background" args={['#07090d']} />
        <ambientLight intensity={0.6} />
        <spotLight position={[2, 4, 4]} angle={0.5} intensity={30} penumbra={0.8} />
        {front && <Card front={front} km={km} count={count} />}
        <mesh position={[0, -1.25, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[1.8, 48]} /><meshBasicMaterial color="#000" transparent opacity={0.45} /></mesh>
        <OrbitControls makeDefault enableDamping enablePan={false} minDistance={3} maxDistance={8} />
      </Canvas>
      <div className="terrain-hud terrain-hud-top">
        <span>MISSION CARD · 1200 × 630</span>
        <span>{km.toFixed(2)} KM · {count} WAYPOINTS</span>
      </div>
      <div className="terrain-credit">THE SAME SVG CARD THIS PAGE DOWNLOADS · ROUTE GEOMETRY FROM THE SHARED LINK · NON-CERTIFYING</div>
    </div>
  );
}
