'use client';
import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group } from 'three';
import type { SceneKind } from './SceneStage';

const MARS = '#C45C26';
const EARTH = '#3D9EBD';
const SUN = '#F4C542';
const ARC = '#E8DCC8';

function SolarTransferScene() {
  const orbit = useRef<Group>(null);
  useFrame((_, delta) => {
    if (orbit.current) orbit.current.rotation.y += delta * 0.04;
  });
  const arc = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.95, -0.22, 0),
        new THREE.Vector3(-0.28, 0.18, -0.28),
        new THREE.Vector3(0.35, 0.32, -0.12),
        new THREE.Vector3(1.05, 0.18, 0),
      ]),
    [],
  );
  return (
    <>
      <color attach="background" args={['#0B0E14']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 2, 4]} intensity={1.8} color="#fff7ea" />
      <pointLight position={[-1.6, 0.4, 1.8]} intensity={2.4} color={SUN} />
      <group ref={orbit} position={[0.05, 0.05, 0]} rotation={[0.28, -0.35, 0.08]} scale={0.92}>
        <mesh position={[-1.55, -0.28, -0.55]}>
          <sphereGeometry args={[0.38, 32, 32]} />
          <meshStandardMaterial color={SUN} emissive={SUN} emissiveIntensity={0.85} roughness={0.35} />
        </mesh>
        <mesh position={[-1.55, -0.28, -0.55]} scale={1.45}>
          <sphereGeometry args={[0.38, 24, 24]} />
          <meshBasicMaterial color={SUN} transparent opacity={0.12} />
        </mesh>
        <mesh position={[-0.95, -0.22, 0]}>
          <sphereGeometry args={[0.2, 32, 32]} />
          <meshStandardMaterial color={EARTH} emissive="#16384a" emissiveIntensity={0.35} roughness={0.55} metalness={0.15} />
        </mesh>
        <mesh position={[1.05, 0.18, 0]}>
          <sphereGeometry args={[0.3, 40, 40]} />
          <meshStandardMaterial color={MARS} emissive="#4a220f" emissiveIntensity={0.4} roughness={0.85} metalness={0.08} />
        </mesh>
        <mesh>
          <tubeGeometry args={[arc, 96, 0.01, 8, false]} />
          <meshStandardMaterial color={ARC} emissive={ARC} emissiveIntensity={0.25} roughness={0.4} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0.12, 0]} position={[0, -0.18, -0.1]}>
          <torusGeometry args={[1.75, 0.004, 4, 96]} />
          <meshBasicMaterial color="#4a5560" transparent opacity={0.85} />
        </mesh>
      </group>
    </>
  );
}

function MarsGlobeScene() {
  const planet = useRef<Group>(null);
  useFrame((_, delta) => {
    if (planet.current) planet.current.rotation.y += delta * 0.05;
  });
  return (
    <>
      <color attach="background" args={['#0B0E14']} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[2.4, 2.2, 3.5]} intensity={2.1} color="#fff5eb" />
      <group ref={planet} rotation={[0.18, -0.4, 0]} scale={0.95}>
        <mesh>
          <sphereGeometry args={[1.25, 64, 64]} />
          <meshStandardMaterial color={MARS} roughness={0.9} metalness={0.05} emissive="#3a180c" emissiveIntensity={0.2} />
        </mesh>
        <group position={[0.95, 0.5, 0.62]}>
          <mesh>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshBasicMaterial color="#fff" />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.05, 0.07, 24]} />
            <meshBasicMaterial color="#fff" side={THREE.DoubleSide} />
          </mesh>
        </group>
      </group>
      <mesh rotation={[0.2, 0, 0.3]}>
        <torusGeometry args={[1.55, 0.004, 4, 96]} />
        <meshBasicMaterial color="#5a6270" />
      </mesh>
    </>
  );
}

function OpsHudScene() {
  const craft = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!craft.current) return;
    craft.current.rotation.y = clock.elapsedTime * 0.12;
    craft.current.position.y = Math.sin(clock.elapsedTime * 0.45) * 0.05;
  });
  const dots = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => [Math.sin(i * 18.21) * 2.6, Math.cos(i * 13.37) * 1.5, -1.2 - (i % 4) * 0.12] as [
        number,
        number,
        number,
      ]),
    [],
  );
  return (
    <>
      <color attach="background" args={['#0B0E14']} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[3, 4, 4]} intensity={2} />
      <group ref={craft} rotation={[0.3, 0, -0.1]} scale={0.95}>
        <mesh>
          <cylinderGeometry args={[0.16, 0.2, 1.15, 8]} />
          <meshStandardMaterial color="#d3d3d0" metalness={0.45} roughness={0.42} />
        </mesh>
        <mesh position={[0, 0.7, 0]}>
          <coneGeometry args={[0.16, 0.26, 8]} />
          <meshStandardMaterial color="#aaa" />
        </mesh>
        <mesh position={[-0.72, 0, 0]}>
          <boxGeometry args={[1.05, 0.04, 0.58]} />
          <meshStandardMaterial color="#758087" metalness={0.5} />
        </mesh>
        <mesh position={[0.72, 0, 0]}>
          <boxGeometry args={[1.05, 0.04, 0.58]} />
          <meshStandardMaterial color="#758087" metalness={0.5} />
        </mesh>
      </group>
      {dots.map((point, i) => (
        <mesh key={i} position={point}>
          <sphereGeometry args={[0.012, 6, 6]} />
          <meshBasicMaterial color="#ddd" />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.45, 0.004, 4, 96]} />
        <meshBasicMaterial color="#6a7280" />
      </mesh>
    </>
  );
}

const nodes: [number, number, number][] = [
  [-1.0, 0.5, 0.15],
  [0.85, 0.62, -0.08],
  [0, -0.38, 0.55],
  [0.55, -0.75, -0.45],
];

function ArchitectureOrbit() {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.04;
  });
  return (
    <>
      <color attach="background" args={['#0B0E14']} />
      <ambientLight intensity={0.8} />
      <directionalLight position={[2, 3, 4]} intensity={2} />
      <group ref={group} scale={0.95}>
        {nodes.map((point, i) => (
          <group key={i} position={point}>
            <mesh>
              <icosahedronGeometry args={[i === 2 ? 0.26 : 0.2, 1]} />
              <meshStandardMaterial
                color={i === 2 ? MARS : '#b8bcc4'}
                metalness={0.35}
                roughness={0.45}
                emissive={i === 2 ? '#3a1a0d' : '#111'}
                emissiveIntensity={0.3}
              />
            </mesh>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[0.32, 0.004, 4, 40]} />
              <meshBasicMaterial color="#7a8290" />
            </mesh>
          </group>
        ))}
        {[
          [0, 1],
          [0, 2],
          [1, 2],
          [2, 3],
        ].map(([a, b], i) => {
          const start = new THREE.Vector3(...nodes[a]);
          const end = new THREE.Vector3(...nodes[b]);
          return (
            <mesh
              key={i}
              position={start.clone().add(end).multiplyScalar(0.5)}
              quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize())}
            >
              <cylinderGeometry args={[0.005, 0.005, start.distanceTo(end), 5]} />
              <meshBasicMaterial color="#7a8290" />
            </mesh>
          );
        })}
      </group>
    </>
  );
}

export default function SceneCanvas({ kind }: { kind: SceneKind }) {
  return (
    <Canvas
      className="scene-canvas"
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.15, kind === 'mars' ? 4.2 : 4.0], fov: 40, near: 0.1, far: 40 }}
      gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
      style={{ width: '100%', height: '100%', display: 'block' }}
      onCreated={({ gl }) => {
        gl.setClearColor('#0B0E14', 1);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.2;
      }}
    >
      <Suspense fallback={null}>
        {kind === 'solar' ? (
          <SolarTransferScene />
        ) : kind === 'mars' ? (
          <MarsGlobeScene />
        ) : kind === 'ops' ? (
          <OpsHudScene />
        ) : (
          <ArchitectureOrbit />
        )}
      </Suspense>
    </Canvas>
  );
}
