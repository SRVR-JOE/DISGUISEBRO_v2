import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useRef, useState, useMemo, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServerModelProps {
  temperatures?: Record<string, number>;
  fanSpeeds?: Record<string, number>;
  vfcCards?: Array<{ slot: number; type: string; status: string }>;
}

type ViewPreset = 'front' | 'rear' | 'top' | 'thermal';

// ---------------------------------------------------------------------------
// Defaults (empty – component shows "no data" state when no real data provided)
// ---------------------------------------------------------------------------

const EMPTY_TEMPERATURES: Record<string, number> = {};
const EMPTY_FAN_SPEEDS: Record<string, number> = {};
const EMPTY_VFC_CARDS: Array<{ slot: number; type: string; status: string }> = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getTempColor(temp: number): string {
  if (temp < 50) return '#00F0FF'; // cyan
  if (temp < 65) return '#00FF88'; // green
  if (temp < 75) return '#FFB800'; // amber
  return '#FF3B3B'; // red
}

function getTempColorThree(temp: number): THREE.Color {
  return new THREE.Color(getTempColor(temp));
}

/** Map RPM to a rotation speed (radians / frame). 0 RPM → 0. */
function rpmToSpeed(rpm: number): number {
  if (rpm <= 0) return 0;
  return (rpm / 3000) * 0.35;
}

// ---------------------------------------------------------------------------
// Camera preset positions
// ---------------------------------------------------------------------------

const CAMERA_PRESETS: Record<ViewPreset, [number, number, number]> = {
  front: [0, 1.5, 8],
  rear: [0, 1.5, -8],
  top: [0, 9, 0.01],
  thermal: [5, 6, 5],
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Main 4U chassis body – semi-transparent with cyan wireframe edges. */
function ChassisBox() {
  const geo = useMemo(() => new THREE.BoxGeometry(4.8, 1.76, 6.6), []);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);

  return (
    <group>
      {/* Solid body */}
      <mesh geometry={geo}>
        <meshStandardMaterial
          color="#2a2a3a"
          metalness={0.7}
          roughness={0.3}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Wireframe edges */}
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#00F0FF" linewidth={1.5} transparent opacity={0.6} />
      </lineSegments>
    </group>
  );
}

/** CPU heatsink block */
function CPUComponent({
  position,
  temp,
  label,
}: {
  position: [number, number, number];
  temp: number;
  label: string;
}) {
  const color = getTempColor(temp);

  return (
    <group position={position}>
      {/* Heatsink fins – a series of thin boxes */}
      <mesh>
        <boxGeometry args={[1.0, 0.6, 1.0]} />
        <meshStandardMaterial
          color={color}
          metalness={0.5}
          roughness={0.4}
          emissive={color}
          emissiveIntensity={0.25}
        />
      </mesh>

      {/* Fin ridges */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[0, 0.32, -0.4 + i * 0.2]}>
          <boxGeometry args={[0.95, 0.06, 0.04]} />
          <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
        </mesh>
      ))}

      <SensorHotspot
        position={[0, 0.55, 0]}
        temp={temp}
        label={label}
      />
    </group>
  );
}

/** GPU card – large block positioned centre-rear. */
function GPUComponent({ temp }: { temp: number }) {
  const color = getTempColor(temp);

  return (
    <group position={[0, -0.15, -1.5]}>
      <mesh>
        <boxGeometry args={[2.6, 0.35, 2.0]} />
        <meshStandardMaterial
          color={color}
          metalness={0.6}
          roughness={0.35}
          emissive={color}
          emissiveIntensity={0.2}
        />
      </mesh>

      {/* Fan shroud detail */}
      <mesh position={[0.6, 0.19, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.04, 24]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[-0.6, 0.19, 0]}>
        <cylinderGeometry args={[0.45, 0.45, 0.04, 24]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.8} roughness={0.2} />
      </mesh>

      <SensorHotspot position={[0, 0.4, 0]} temp={temp} label="GPU" />
    </group>
  );
}

/** NVMe drive – thin slab in the front bay area. */
function NVMeComponent({ temp }: { temp: number }) {
  const color = getTempColor(temp);

  return (
    <group position={[1.6, -0.5, 2.4]}>
      <mesh>
        <boxGeometry args={[0.6, 0.1, 1.0]} />
        <meshStandardMaterial
          color={color}
          metalness={0.55}
          roughness={0.35}
          emissive={color}
          emissiveIntensity={0.15}
        />
      </mesh>
      <SensorHotspot position={[0, 0.3, 0]} temp={temp} label="NVMe" />
    </group>
  );
}

/** Spinning fan with RPM-proportional animation. */
function FanComponent({
  position,
  rpm,
  label,
}: {
  position: [number, number, number];
  rpm: number;
  label: string;
}) {
  const bladeRef = useRef<THREE.Group>(null!);
  const speed = rpmToSpeed(rpm);
  const stopped = rpm <= 0;

  useFrame(() => {
    if (bladeRef.current) {
      bladeRef.current.rotation.y += speed;
    }
  });

  return (
    <group position={position}>
      {/* Housing ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.38, 0.04, 8, 24]} />
        <meshStandardMaterial
          color={stopped ? '#FF3B3B' : '#00F0FF'}
          emissive={stopped ? '#FF3B3B' : '#00F0FF'}
          emissiveIntensity={stopped ? 0.8 : 0.3}
          metalness={0.6}
          roughness={0.3}
        />
      </mesh>

      {/* Hub */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.08, 12]} />
        <meshStandardMaterial color="#444" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Blades */}
      <group ref={bladeRef}>
        {Array.from({ length: 5 }).map((_, i) => {
          const angle = (i / 5) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 0.2, 0, Math.sin(angle) * 0.2]}
              rotation={[0, -angle, Math.PI / 6]}
            >
              <boxGeometry args={[0.22, 0.02, 0.08]} />
              <meshStandardMaterial
                color={stopped ? '#FF3B3B' : '#66FFFF'}
                transparent
                opacity={0.7}
                metalness={0.3}
                roughness={0.5}
              />
            </mesh>
          );
        })}
      </group>

      {/* Label */}
      {stopped && (
        <Html center position={[0, 0.6, 0]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(255,59,59,0.85)',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 700,
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
            }}
          >
            STOPPED
          </div>
        </Html>
      )}

      {/* RPM readout */}
      {!stopped && (
        <Html center position={[0, -0.55, 0]} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              color: '#00F0FF',
              fontSize: 10,
              fontFamily: 'monospace',
              whiteSpace: 'nowrap',
              textShadow: '0 0 6px #00F0FF',
            }}
          >
            {label} {rpm} RPM
          </div>
        </Html>
      )}
    </group>
  );
}

/** VFC card slot. */
function VFCSlotComponent({
  position,
  card,
  slotIndex,
}: {
  position: [number, number, number];
  card?: { slot: number; type: string; status: string };
  slotIndex: number;
}) {
  const filled = !!card;
  const color = filled ? '#00FF88' : '#333344';
  const emissive = filled ? '#00FF88' : '#000000';

  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.3, 0.9, 0.12]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          emissiveIntensity={filled ? 0.3 : 0}
          metalness={0.5}
          roughness={0.4}
          transparent
          opacity={filled ? 0.85 : 0.4}
        />
      </mesh>

      <Html center position={[0, 0.6, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            color: filled ? '#00FF88' : '#555',
            fontSize: 9,
            fontFamily: 'monospace',
            whiteSpace: 'nowrap',
            textShadow: filled ? '0 0 4px #00FF88' : 'none',
          }}
        >
          VFC {slotIndex}
          {filled ? ` ${card!.type}` : ''}
        </div>
      </Html>
    </group>
  );
}

/** Power supply unit block. */
function PSUComponent({ position, index }: { position: [number, number, number]; index: number }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[1.0, 0.7, 1.4]} />
        <meshStandardMaterial
          color="#1e1e2e"
          metalness={0.75}
          roughness={0.25}
          emissive="#00F0FF"
          emissiveIntensity={0.05}
        />
      </mesh>
      {/* Power indicator LED */}
      <mesh position={[0, 0.36, 0.65]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial
          color="#00FF88"
          emissive="#00FF88"
          emissiveIntensity={1.2}
        />
      </mesh>
      <pointLight position={[0, 0.36, 0.7]} color="#00FF88" intensity={0.3} distance={1.2} />

      <Html center position={[0, -0.5, 0.7]} style={{ pointerEvents: 'none' }}>
        <div style={{ color: '#8888aa', fontSize: 9, fontFamily: 'monospace' }}>
          PSU {index}
        </div>
      </Html>
    </group>
  );
}

/** Sensor hotspot – glowing sphere with label, pulsing when hot. */
function SensorHotspot({
  position,
  temp,
  label,
}: {
  position: [number, number, number];
  temp: number;
  label: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const lightRef = useRef<THREE.PointLight>(null!);
  const [showDetail, setShowDetail] = useState(false);
  const color = getTempColor(temp);
  const isHot = temp > 75;

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    if (isHot) {
      // Pulsing scale animation
      const pulse = 1 + Math.sin(clock.getElapsedTime() * 5) * 0.3;
      meshRef.current.scale.setScalar(pulse);
    }
    if (lightRef.current) {
      const intensityBase = THREE.MathUtils.mapLinear(temp, 30, 90, 0.3, 2.0);
      if (isHot) {
        const flicker = 1 + Math.sin(clock.getElapsedTime() * 5) * 0.4;
        lightRef.current.intensity = intensityBase * flicker;
      } else {
        lightRef.current.intensity = intensityBase;
      }
    }
  });

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          setShowDetail((v) => !v);
        }}
      >
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isHot ? 1.5 : 0.8}
          transparent
          opacity={0.85}
        />
      </mesh>

      <pointLight
        ref={lightRef}
        color={color}
        intensity={1}
        distance={2.5}
        decay={2}
      />

      {/* Always-visible label */}
      <Html center position={[0, 0.35, 0]} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            color,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'monospace',
            textShadow: `0 0 8px ${color}`,
            whiteSpace: 'nowrap',
            userSelect: 'none',
          }}
        >
          {label} {temp}°C
        </div>
      </Html>

      {/* Detail popup on click */}
      {showDetail && (
        <Html center position={[0, 0.8, 0]}>
          <div
            style={{
              background: 'rgba(10,14,23,0.92)',
              border: `1px solid ${color}`,
              borderRadius: 8,
              padding: '8px 14px',
              color: '#E0E0E0',
              fontFamily: 'monospace',
              fontSize: 12,
              minWidth: 140,
              boxShadow: `0 0 16px ${color}40`,
              cursor: 'pointer',
            }}
            onClick={() => setShowDetail(false)}
          >
            <div style={{ color, fontWeight: 700, marginBottom: 4 }}>{label}</div>
            <div>Temperature: {temp}°C</div>
            <div>
              Status:{' '}
              <span style={{ color }}>
                {temp < 50
                  ? 'Cool'
                  : temp < 65
                  ? 'Normal'
                  : temp < 75
                  ? 'Warm'
                  : 'HOT'}
              </span>
            </div>
            <div style={{ color: '#666', fontSize: 10, marginTop: 4 }}>click to close</div>
          </div>
        </Html>
      )}
    </group>
  );
}

/** System temp hotspot – standalone sensor on the motherboard. */
function SystemSensor({ temp }: { temp: number }) {
  return (
    <group position={[-1.5, 0.2, 0.5]}>
      <SensorHotspot position={[0, 0, 0]} temp={temp} label="System" />
    </group>
  );
}

/** The 3D scene contents (rendered inside the Canvas). */
function Scene({
  temperatures,
  fanSpeeds,
  vfcCards,
  viewPreset,
}: {
  temperatures: Record<string, number>;
  fanSpeeds: Record<string, number>;
  vfcCards: Array<{ slot: number; type: string; status: string }>;
  viewPreset: ViewPreset;
}) {
  const controlsRef = useRef<any>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera>(null!);

  // Animate camera to preset position
  useFrame(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const target = CAMERA_PRESETS[viewPreset];
    const cam = cameraRef.current;

    cam.position.x += (target[0] - cam.position.x) * 0.04;
    cam.position.y += (target[1] - cam.position.y) * 0.04;
    cam.position.z += (target[2] - cam.position.z) * 0.04;

    controlsRef.current.target.lerp(new THREE.Vector3(0, 0, 0), 0.04);
    controlsRef.current.update();
  });

  // Build VFC lookup
  const vfcMap = useMemo(() => {
    const map: Record<number, (typeof vfcCards)[number]> = {};
    vfcCards.forEach((c) => {
      map[c.slot] = c;
    });
    return map;
  }, [vfcCards]);

  return (
    <>
      <PerspectiveCamera
        ref={cameraRef}
        makeDefault
        position={CAMERA_PRESETS[viewPreset]}
        fov={45}
        near={0.1}
        far={100}
      />
      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={3}
        maxDistance={20}
      />

      {/* Lighting */}
      <ambientLight intensity={0.35} color="#8899CC" />
      <directionalLight position={[5, 8, 5]} intensity={0.6} color="#ffffff" />
      <directionalLight position={[-3, 4, -4]} intensity={0.3} color="#4466FF" />

      {/* Ground reflection plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.9, 0]}>
        <planeGeometry args={[14, 14]} />
        <meshStandardMaterial
          color="#0A0E17"
          metalness={0.9}
          roughness={0.15}
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Chassis */}
      <ChassisBox />

      {/* CPUs */}
      <CPUComponent position={[-0.9, 0.25, 1.8]} temp={temperatures.CPU0 ?? 0} label="CPU0" />
      <CPUComponent position={[0.9, 0.25, 1.8]} temp={temperatures.CPU1 ?? 0} label="CPU1" />

      {/* GPU */}
      <GPUComponent temp={temperatures.GPU ?? 0} />

      {/* NVMe */}
      <NVMeComponent temp={temperatures.NVMe ?? 0} />

      {/* System sensor */}
      <SystemSensor temp={temperatures.System ?? 0} />

      {/* Fans – positioned in a row across the mid-section */}
      <FanComponent position={[-1.5, 0.3, 0.5]} rpm={fanSpeeds.FAN1 ?? 0} label="FAN1" />
      <FanComponent position={[-0.5, 0.3, 0.5]} rpm={fanSpeeds.FAN2 ?? 0} label="FAN2" />
      <FanComponent position={[0.5, 0.3, 0.5]} rpm={fanSpeeds.FAN3 ?? 0} label="FAN3" />
      <FanComponent position={[1.5, 0.3, 0.5]} rpm={fanSpeeds.FAN4 ?? 0} label="FAN4" />

      {/* VFC slots – rear-right */}
      {[0, 1, 2, 3].map((i) => (
        <VFCSlotComponent
          key={i}
          position={[1.4 + i * 0.35, 0, -3.0]}
          slotIndex={i}
          card={vfcMap[i]}
        />
      ))}

      {/* PSUs – rear-left */}
      <PSUComponent position={[-1.5, -0.2, -2.5]} index={1} />
      <PSUComponent position={[-1.5, -0.2, -1.0]} index={2} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ServerModel({
  temperatures: tempsProp,
  fanSpeeds: fansProp,
  vfcCards: vfcProp,
}: ServerModelProps) {
  const temperatures = { ...EMPTY_TEMPERATURES, ...tempsProp };
  const fanSpeeds = { ...EMPTY_FAN_SPEEDS, ...fansProp };
  const vfcCards = vfcProp ?? EMPTY_VFC_CARDS;

  const [viewPreset, setViewPreset] = useState<ViewPreset>('top');

  const presetButtons: { key: ViewPreset; label: string }[] = [
    { key: 'front', label: 'Front' },
    { key: 'rear', label: 'Rear' },
    { key: 'top', label: 'Top (X-ray)' },
    { key: 'thermal', label: 'Thermal' },
  ];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#0A0E17' }}>
      {/* View preset buttons */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex',
          gap: 8,
        }}
      >
        {presetButtons.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setViewPreset(key)}
            style={{
              background: viewPreset === key ? 'rgba(0,240,255,0.2)' : 'rgba(20,24,40,0.85)',
              border: `1px solid ${viewPreset === key ? '#00F0FF' : '#333355'}`,
              color: viewPreset === key ? '#00F0FF' : '#8888aa',
              padding: '6px 16px',
              borderRadius: 6,
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: 12,
              fontWeight: viewPreset === key ? 700 : 400,
              transition: 'all 0.2s ease',
              boxShadow: viewPreset === key ? '0 0 12px rgba(0,240,255,0.25)' : 'none',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 3D Canvas */}
      <Canvas
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <color attach="background" args={['#0A0E17']} />
        <fog attach="fog" args={['#0A0E17', 12, 25]} />
        <Scene
          temperatures={temperatures}
          fanSpeeds={fanSpeeds}
          vfcCards={vfcCards}
          viewPreset={viewPreset}
        />
      </Canvas>

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 16,
          zIndex: 10,
          display: 'flex',
          gap: 14,
          fontFamily: 'monospace',
          fontSize: 10,
          color: '#8888aa',
        }}
      >
        {[
          { color: '#00F0FF', label: '< 50°C' },
          { color: '#00FF88', label: '50-65°C' },
          { color: '#FFB800', label: '65-75°C' },
          { color: '#FF3B3B', label: '> 75°C' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 6px ${color}`,
              }}
            />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
