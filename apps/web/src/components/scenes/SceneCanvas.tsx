'use client';
import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { Group } from 'three';
import type { EarthScenePoint, SceneKind } from './SceneStage';
import { eonetColor } from '@/lib/eonet-colors';
import { JEZERO_CENTER } from '@mars-explorer/shared';

const MARS = '#C45C26';
const EARTH = '#3D9EBD';
const SUN = '#F4C542';
const ARC = '#E8DCC8';
const jezeroLatitude = JEZERO_CENTER.lat * Math.PI / 180;
const jezeroLongitude = JEZERO_CENTER.lon * Math.PI / 180;
const jezeroPin: [number, number, number] = [1.27 * Math.cos(jezeroLatitude) * Math.sin(jezeroLongitude), 1.27 * Math.sin(jezeroLatitude), 1.27 * Math.cos(jezeroLatitude) * Math.cos(jezeroLongitude)];

function SolarTransferScene() {
  const orbit = useRef<Group>(null);
  useFrame((_, delta) => {
    if (orbit.current) orbit.current.rotation.y += delta * 0.04;
  });
  const arc = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.7, -0.08, 0),
        new THREE.Vector3(-0.15, 0.22, -0.2),
        new THREE.Vector3(0.4, 0.28, -0.08),
        new THREE.Vector3(0.95, 0.12, 0),
      ]),
    [],
  );
  return (
    <>
      <color attach="background" args={['#0B0E14']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 2, 4]} intensity={1.8} color="#fff7ea" />
      <pointLight position={[-1.6, 0.4, 1.8]} intensity={2.4} color={SUN} />
      <group ref={orbit} position={[1.15, 0, 0]} rotation={[0.22, -0.2, 0.05]} scale={0.9}>
        <mesh position={[-1.35, -0.12, -0.2]}>
          <sphereGeometry args={[0.32, 32, 32]} />
          <meshStandardMaterial color={SUN} emissive={SUN} emissiveIntensity={0.85} roughness={0.35} />
        </mesh>
        <mesh position={[-1.35, -0.12, -0.2]} scale={1.45}>
          <sphereGeometry args={[0.32, 24, 24]} />
          <meshBasicMaterial color={SUN} transparent opacity={0.12} />
        </mesh>
        <mesh position={[-0.7, -0.08, 0]}>
          <sphereGeometry args={[0.16, 32, 32]} />
          <meshStandardMaterial color={EARTH} emissive="#16384a" emissiveIntensity={0.35} roughness={0.55} metalness={0.15} />
        </mesh>
        <mesh position={[0.95, 0.12, 0]}>
          <sphereGeometry args={[0.26, 40, 40]} />
          <meshStandardMaterial color={MARS} emissive="#4a220f" emissiveIntensity={0.4} roughness={0.85} metalness={0.08} />
        </mesh>
        <mesh>
          <tubeGeometry args={[arc, 96, 0.01, 8, false]} />
          <meshStandardMaterial color={ARC} emissive={ARC} emissiveIntensity={0.25} roughness={0.4} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0.12, 0]} position={[0, -0.12, -0.05]}>
          <torusGeometry args={[1.45, 0.004, 4, 96]} />
          <meshBasicMaterial color="#4a5560" transparent opacity={0.85} />
        </mesh>
      </group>
    </>
  );
}

function MarsGlobeScene({ landing = false }: { landing?: boolean }) {
  const planet = useRef<Group>(null);
  const texture = useTexture('/textures/mars-nasa.jpg');
  texture.colorSpace = THREE.SRGBColorSpace;
  useFrame((_, delta) => {
    if (planet.current) planet.current.rotation.y += delta * 0.05;
  });
  return (
    <>
      <color attach="background" args={['#0B0E14']} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[2.4, 2.2, 3.5]} intensity={2.1} color="#fff5eb" />
      <group ref={planet} position={[1.1, 0, 0]} rotation={landing ? [0.12, -1.15, 0.06] : [0.18, -0.4, 0]} scale={landing ? 0.9 : 0.95}>
        <mesh>
          <sphereGeometry args={[1.25, 64, 64]} />
          <meshStandardMaterial map={texture} color="#fff" roughness={0.94} metalness={0.02} />
        </mesh>
        {!landing && <group position={jezeroPin}>
          <mesh>
            <sphereGeometry args={[0.03, 12, 12]} />
            <meshBasicMaterial color="#fff" />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.05, 0.07, 24]} />
            <meshBasicMaterial color="#fff" side={THREE.DoubleSide} />
          </mesh>
        </group>}
      </group>
      <mesh position={[1.1, 0, 0]} rotation={[0.2, 0, 0.3]}>
        <torusGeometry args={[landing ? 1.51 : 1.55, 0.004, 4, 96]} />
        <meshBasicMaterial color="#5a6270" />
      </mesh>
      {landing && <mesh position={[1.1, 0, 0]} rotation={[1.1, -0.25, -0.35]}>
        <torusGeometry args={[1.68, 0.0025, 4, 96]} />
        <meshBasicMaterial color="#8d7569" transparent opacity={0.65} />
      </mesh>}
    </>
  );
}

function terrainHeight(x: number, z: number) {
  return 0.11 * Math.sin(x * 3.7) * Math.cos(z * 2.8)
    + 0.055 * Math.sin(x * 8.6 + z * 3.2)
    + 0.035 * Math.cos(z * 12.3 - x * 2.4)
    + 0.16 * Math.exp(-((x + 0.75) ** 2 + (z - 0.2) ** 2) * 2.5);
}

function useTerrainGeometry() {
  return useMemo(() => {
    const geometry = new THREE.PlaneGeometry(4.5, 3.2, 54, 38);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.getAttribute('position');
    const colors: number[] = [];
    for (let index = 0; index < positions.count; index++) {
      const height = terrainHeight(positions.getX(index), positions.getZ(index));
      positions.setY(index, height);
      const shade = THREE.MathUtils.clamp((height + 0.2) / 0.5, 0, 1);
      const color = new THREE.Color('#754b34').lerp(new THREE.Color('#b47b4d'), shade);
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);
}

const routePoints: [number, number, number][] = [[-1.25, 0.3, 0.75], [-0.55, 0.28, 0.25], [0.3, 0.28, -0.2], [1.15, 0.3, -0.75]];
const rocks: Array<[number, number, number, number]> = [
  [-1.8, -0.9, 0.14, 0.2], [-1.45, 0.5, 0.1, 0.5], [-0.8, -0.65, 0.17, 0.15],
  [-0.1, 0.9, 0.12, 0.4], [0.7, 0.55, 0.18, 0.7], [1.4, -0.35, 0.15, 0.3],
  [1.85, 0.8, 0.11, 0.55], [0.25, -1.15, 0.13, 0.3],
];

function TerrainStudyScene() {
  const terrain = useTerrainGeometry();
  const path = useMemo(() => new THREE.CatmullRomCurve3(routePoints.map(([x, y, z]) => new THREE.Vector3(x, y, z))), []);
  return <>
    <color attach="background" args={['#0B0E14']} />
    <fog attach="fog" args={['#0B0E14', 5.2, 10]} />
    <ambientLight intensity={0.8} />
    <directionalLight position={[-2, 5, 3]} intensity={2.5} color="#f0c49b" />
    <group position={[0.95, -0.26, -0.55]} rotation={[0, -0.22, 0]}>
      <mesh geometry={terrain}><meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} /></mesh>
      {rocks.map(([x, z, size, angle], index) => <mesh key={index} position={[x, terrainHeight(x, z) + size * 0.35, z]} rotation={[0.2, angle, 0.12]} scale={[size * 1.3, size * 0.7, size]}>
        <dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={index % 2 ? '#795340' : '#a57550'} roughness={1} />
      </mesh>)}
      <mesh><tubeGeometry args={[path, 48, 0.012, 6, false]} /><meshBasicMaterial color="#e8d6c2" /></mesh>
      {routePoints.map(([x, y, z], index) => <group key={index} position={[x, y, z]}>
        <mesh><cylinderGeometry args={[0.018, 0.018, 0.18, 8]} /><meshBasicMaterial color="#f3e9dc" /></mesh>
        <mesh position={[0, 0.1, 0]}><sphereGeometry args={[0.04, 10, 10]} /><meshBasicMaterial color="#e0a36e" /></mesh>
      </group>)}
    </group>
  </>;
}

function DataLayersScene() {
  const stack = useRef<Group>(null);
  const terrain = useTerrainGeometry();
  useFrame((_, delta) => { if (stack.current) stack.current.rotation.y += delta * 0.025; });
  return <>
    <color attach="background" args={['#0B0E14']} />
    <ambientLight intensity={0.9} />
    <directionalLight position={[2, 4, 4]} intensity={2.3} color="#f2d7bb" />
    <group ref={stack} position={[0.65, -0.18, 0]} rotation={[0.1, -0.45, 0]}>
      <mesh position={[0, -0.65, 0]}><boxGeometry args={[2.7, 0.08, 1.8]} /><meshStandardMaterial color="#2c3641" metalness={0.2} roughness={0.7} /></mesh>
      <mesh position={[0, -0.1, 0]}><boxGeometry args={[2.7, 0.07, 1.8]} /><meshStandardMaterial color="#54616a" transparent opacity={0.72} roughness={0.8} /></mesh>
      <gridHelper args={[2.55, 12, '#b6a695', '#59636d']} position={[0, -0.04, 0]} />
      <mesh geometry={terrain} position={[0, 0.55, 0]} scale={[0.58, 0.7, 0.52]}><meshStandardMaterial vertexColors roughness={1} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, 0.25, 0]}><boxGeometry args={[2.7, 0.015, 1.8]} /><meshBasicMaterial color="#d3b49a" transparent opacity={0.12} /></mesh>
      {[-1.2, 1.2].map((x) => [-0.75, 0.75].map((z) => <mesh key={`${x}-${z}`} position={[x, -0.05, z]}><cylinderGeometry args={[0.008, 0.008, 1.2, 5]} /><meshBasicMaterial color="#a3a4a4" transparent opacity={0.55} /></mesh>))}
    </group>
  </>;
}

function SampleStudyScene() {
  const specimen = useRef<Group>(null);
  const rock = useMemo(() => {
    const geometry = new THREE.IcosahedronGeometry(0.92, 3);
    const positions = geometry.getAttribute('position');
    const colors: number[] = [];
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);
      const roughness = 1 + 0.09 * Math.sin(x * 11 + z * 5) * Math.cos(y * 14 - x * 4);
      positions.setXYZ(index, x * roughness * 1.1, y * roughness * 0.78, z * roughness * 0.9);
      const color = new THREE.Color('#6e4b37').lerp(new THREE.Color('#ba8a61'), THREE.MathUtils.clamp((y + 0.9) / 1.8, 0, 1));
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    return geometry;
  }, []);
  useFrame((_, delta) => { if (specimen.current) specimen.current.rotation.y += delta * 0.09; });
  return <>
    <color attach="background" args={['#0B0E14']} />
    <ambientLight intensity={0.65} />
    <directionalLight position={[-2, 3, 4]} intensity={2.8} color="#f5d1ac" />
    <directionalLight position={[2, -1, -2]} intensity={1.1} color="#8893a2" />
    <group ref={specimen} position={[0, 0.08, 0]} rotation={[0.12, -0.5, 0]}>
      <mesh geometry={rock}><meshStandardMaterial vertexColors roughness={0.95} metalness={0.03} /></mesh>
    </group>
    <mesh position={[0, -1.05, 0]}><cylinderGeometry args={[1.22, 1.32, 0.08, 64]} /><meshStandardMaterial color="#30363d" metalness={0.35} roughness={0.65} /></mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -1.02, 0]}><torusGeometry args={[1.27, 0.009, 6, 80]} /><meshBasicMaterial color="#919ba2" /></mesh>
  </>;
}

function EarthEventScene({ points }: { points: EarthScenePoint[] }) {
  const globe = useRef<Group>(null);
  const texture = useTexture('/textures/earth-nasa-blue-marble.jpg');
  texture.colorSpace = THREE.SRGBColorSpace;
  useFrame((_, delta) => { if (globe.current) globe.current.rotation.y += delta * 0.035; });
  const pins = useMemo(() => points.slice(0, 30).map((point) => {
    const lat = point.lat * Math.PI / 180;
    const lon = point.lon * Math.PI / 180;
    const radius = 1.13;
    return { position: [radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.cos(lon)] as [number, number, number], color: eonetColor(point.categoryId) };
  }), [points]);
  return <><color attach="background" args={['#0B0E14']} /><ambientLight intensity={0.5} /><directionalLight position={[2, 3, 4]} intensity={2.2} color="#d7f1ff" />
    <group ref={globe} position={[0.45, 0, 0]} rotation={[0.18, -0.5, 0]}>
      <mesh><sphereGeometry args={[1.1, 64, 64]} /><meshStandardMaterial map={texture} color="#d6e0e2" roughness={0.92} metalness={0.02} /></mesh>
      <mesh rotation={[0.2, 0, 0.25]}><torusGeometry args={[1.28, 0.004, 4, 96]} /><meshBasicMaterial color="#658591" transparent opacity={0.8} /></mesh>
      {pins.map((pin, index) => <mesh key={index} position={pin.position}><sphereGeometry args={[0.025, 8, 8]} /><meshBasicMaterial color={pin.color} /></mesh>)}
    </group>
  </>;
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

export default function SceneCanvas({ kind, earthPoints = [] }: { kind: SceneKind; earthPoints?: EarthScenePoint[] }) {
  return (
    <Canvas
      className="scene-canvas"
      dpr={[1, 1.5]}
      camera={{ position: kind === 'terrain' || kind === 'layers' ? [0, 2.6, 5.5] : [0, 0.15, kind === 'mars' || kind === 'mars-hero' ? 4.8 : 4.2], fov: 40, near: 0.1, far: 40 }}
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
        ) : kind === 'mars' || kind === 'mars-hero' ? (
          <MarsGlobeScene landing={kind === 'mars-hero'} />
        ) : kind === 'terrain' ? (
          <TerrainStudyScene />
        ) : kind === 'layers' ? (
          <DataLayersScene />
        ) : kind === 'sample' ? (
          <SampleStudyScene />
        ) : kind === 'earth' ? (
          <EarthEventScene points={earthPoints} />
        ) : kind === 'ops' ? (
          <OpsHudScene />
        ) : (
          <ArchitectureOrbit />
        )}
      </Suspense>
    </Canvas>
  );
}
