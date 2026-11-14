"use client";

import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { ORGANS, ORGAN_BY_ID } from "@/lib/data/mock";
import type { CrewMember, OrganId, Status } from "@/lib/data/types";

/* ------------------------------------------------------------------ */
/* Palette (mirrors globals.css tokens; WebGL can't read CSS vars)     */
/* ------------------------------------------------------------------ */
const C = {
  shell: new THREE.Color("#8aa8ff"),
  bone: new THREE.Color("#b9c3d6"),
  organ: new THREE.Color("#7d8aa3"),
  selected: new THREE.Color("#8aa8ff"),
  status: {
    nominal: new THREE.Color("#4fbf8b"),
    caution: new THREE.Color("#e8b04b"),
    critical: new THREE.Color("#f0616d"),
  } as Record<Status, THREE.Color>,
};

/* ------------------------------------------------------------------ */
/* Holographic fresnel material for the body shell                     */
/* ------------------------------------------------------------------ */
const holoVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const holoFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uScan;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vWorld;
  void main() {
    float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.4);
    float contour = smoothstep(0.965, 1.0, sin(vWorld.y * 220.0) * 0.5 + 0.5) * 0.12;
    float scan = exp(-pow((vWorld.y - uScan) * 30.0, 2.0));
    vec3 col = uColor * (0.35 + fres * 1.25) + uColor * scan * 0.9;
    float a = uOpacity * (0.05 + fres * 0.85 + contour) + scan * 0.22;
    gl_FragColor = vec4(col, a);
  }
`;

function useHoloMaterial(color: THREE.Color, opacity: number) {
  return React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: color }, uOpacity: { value: opacity }, uScan: { value: 0 } },
        vertexShader: holoVertex,
        fragmentShader: holoFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    [color, opacity]
  );
}

/* ------------------------------------------------------------------ */
/* Body shell                                                          */
/* ------------------------------------------------------------------ */
const TORSO_PROFILE: [number, number][] = [
  [0.0, 0.86], [0.12, 0.865], [0.162, 0.92], [0.166, 0.99], [0.142, 1.07], [0.134, 1.13],
  [0.148, 1.23], [0.168, 1.32], [0.178, 1.385], [0.162, 1.44], [0.1, 1.468], [0.05, 1.478], [0.0, 1.48],
];

function Shell({ material }: { material: THREE.Material }) {
  const torso = React.useMemo(
    () => new THREE.LatheGeometry(TORSO_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 56),
    []
  );
  return (
    <group>
      <mesh geometry={torso} material={material} scale={[1, 1, 0.62]} />
      <mesh material={material} position={[0, 1.635, 0]} scale={[0.9, 1.12, 1]}>
        <sphereGeometry args={[0.1, 48, 48]} />
      </mesh>
      <mesh material={material} position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.042, 0.05, 0.1, 24, 1, true]} />
      </mesh>
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh material={material} position={[0.19 * s, 1.405, 0]} scale={[1, 0.9, 0.85]}>
            <sphereGeometry args={[0.056, 24, 24]} />
          </mesh>
          {/* arm */}
          <group position={[0.2 * s, 1.4, 0]} rotation={[0, 0, 0.12 * s]}>
            <mesh material={material} position={[0, -0.135, 0]}>
              <capsuleGeometry args={[0.044, 0.22, 8, 24]} />
            </mesh>
            <mesh material={material} position={[0, -0.395, 0]}>
              <capsuleGeometry args={[0.037, 0.2, 8, 24]} />
            </mesh>
            <mesh material={material} position={[0, -0.6, 0.005]} scale={[0.028, 0.062, 0.014]}>
              <sphereGeometry args={[1, 24, 24]} />
            </mesh>
          </group>
          {/* leg */}
          <group position={[0.085 * s, 0.9, 0]} rotation={[0, 0, 0.015 * s]}>
            <mesh material={material} position={[0, -0.21, 0]}>
              <capsuleGeometry args={[0.068, 0.3, 8, 24]} />
            </mesh>
            <mesh material={material} position={[0, -0.65, 0]}>
              <capsuleGeometry args={[0.051, 0.32, 8, 24]} />
            </mesh>
            <mesh material={material} position={[0, -0.865, 0.045]} rotation={[Math.PI / 2, 0, 0]}>
              <capsuleGeometry args={[0.033, 0.12, 8, 16]} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Skeleton (x-ray layer)                                              */
/* ------------------------------------------------------------------ */
function Skeleton({ material }: { material: THREE.Material }) {
  return (
    <group>
      {/* spine */}
      {Array.from({ length: 17 }, (_, i) => (
        <mesh key={i} material={material} position={[0, 0.94 + i * 0.031, -0.045]}>
          <cylinderGeometry args={[0.012, 0.012, 0.022, 10]} />
        </mesh>
      ))}
      {/* ribs */}
      {Array.from({ length: 7 }, (_, i) => {
        const y = 1.39 - i * 0.032;
        const r = 0.1 + Math.sin((i / 6) * Math.PI) * 0.035;
        return (
          <mesh key={i} material={material} position={[0, y, -0.005]} rotation={[Math.PI / 2 + 0.25, 0, 0]} scale={[1, 0.62, 1]}>
            <torusGeometry args={[r, 0.0035, 6, 48, Math.PI * 1.72]} />
          </mesh>
        );
      })}
      {/* clavicles */}
      {[1, -1].map((s) => (
        <mesh key={s} material={material} position={[0.09 * s, 1.445, 0.02]} rotation={[0, 0, (Math.PI / 2) * s + 0.15 * s]}>
          <cylinderGeometry args={[0.006, 0.006, 0.16, 8]} />
        </mesh>
      ))}
      {/* pelvis */}
      <mesh material={material} position={[0, 0.92, -0.005]} rotation={[Math.PI / 2 - 0.3, 0, 0]} scale={[1, 0.7, 1]}>
        <torusGeometry args={[0.1, 0.01, 8, 40]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Organs                                                              */
/* ------------------------------------------------------------------ */
interface OrganProps {
  id: OrganId;
  status: Status;
  selected: boolean;
  onSelect: (id: OrganId) => void;
  onHover: (id: OrganId | null) => void;
  hovered: boolean;
  children: (material: THREE.MeshStandardMaterial) => React.ReactNode;
}

function Organ({ id, status, selected, hovered, onSelect, onHover, children }: OrganProps) {
  const material = React.useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.organ,
        emissive: C.organ,
        emissiveIntensity: 0.35,
        roughness: 0.4,
        metalness: 0.1,
        transparent: true,
        opacity: 0.72,
      }),
    []
  );

  useFrame(({ clock }) => {
    const target = selected ? C.selected : status === "nominal" ? C.organ : C.status[status];
    material.color.lerp(target, 0.12);
    material.emissive.lerp(target, 0.12);
    const pulse = selected ? 0.7 + Math.sin(clock.elapsedTime * 3) * 0.2 : status !== "nominal" ? 0.32 : 0.22;
    material.emissiveIntensity = THREE.MathUtils.lerp(material.emissiveIntensity, hovered ? pulse + 0.35 : pulse, 0.15);
  });

  const handlers = {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onSelect(id);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(id);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      onHover(null);
      document.body.style.cursor = "";
    },
  };

  return <group {...handlers}>{children(material)}</group>;
}

function Heart({ material, bpm }: { material: THREE.Material; bpm: number }) {
  const ref = React.useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const beat = Math.pow(Math.max(0, Math.sin(clock.elapsedTime * (bpm / 60) * Math.PI * 2)), 10);
    const s = 1 + beat * 0.12;
    ref.current.scale.set(0.038 * s, 0.044 * s, 0.034 * s);
  });
  return (
    <mesh ref={ref} material={material} position={[0.025, 1.265, 0.035]} rotation={[0, 0, -0.45]}>
      <sphereGeometry args={[1, 32, 32]} />
    </mesh>
  );
}

function Organs({
  crew,
  selected,
  onSelect,
}: {
  crew: CrewMember;
  selected: OrganId;
  onSelect: (id: OrganId) => void;
}) {
  const [hovered, setHovered] = React.useState<OrganId | null>(null);
  const status = (id: OrganId): Status => crew.assessments[id]?.status ?? "nominal";
  const p = (id: OrganId) => ({
    id,
    status: status(id),
    selected: selected === id,
    hovered: hovered === id,
    onSelect,
    onHover: setHovered,
  });

  return (
    <group>
      <Organ {...p("brain")}>
        {(m) => (
          <mesh material={m} position={[0, 1.655, 0.005]} scale={[0.074, 0.06, 0.08]}>
            <sphereGeometry args={[1, 32, 32]} />
          </mesh>
        )}
      </Organ>
      <Organ {...p("inner-ear")}>
        {(m) =>
          [1, -1].map((s) => (
            <mesh key={s} material={m} position={[0.083 * s, 1.6, 0]}>
              <sphereGeometry args={[0.013, 16, 16]} />
            </mesh>
          ))
        }
      </Organ>
      <Organ {...p("thyroid")}>
        {(m) => (
          <mesh material={m} position={[0, 1.47, 0.03]} scale={[0.026, 0.013, 0.012]}>
            <sphereGeometry args={[1, 16, 16]} />
          </mesh>
        )}
      </Organ>
      <Organ {...p("lungs")}>
        {(m) =>
          [1, -1].map((s) => (
            <mesh key={s} material={m} position={[0.068 * s, 1.31, -0.005]} scale={[0.058, 0.105, 0.052]}>
              <sphereGeometry args={[1, 32, 32]} />
            </mesh>
          ))
        }
      </Organ>
      <Organ {...p("heart")}>{(m) => <Heart material={m} bpm={crew.vitals.heartRate} />}</Organ>
      <Organ {...p("liver")}>
        {(m) => (
          <mesh material={m} position={[-0.04, 1.165, 0.02]} rotation={[0, 0, 0.25]} scale={[0.085, 0.038, 0.05]}>
            <sphereGeometry args={[1, 32, 32]} />
          </mesh>
        )}
      </Organ>
      <Organ {...p("stomach")}>
        {(m) => (
          <mesh material={m} position={[0.055, 1.145, 0.03]} rotation={[0, 0, -0.5]} scale={[0.045, 0.032, 0.032]}>
            <sphereGeometry args={[1, 24, 24]} />
          </mesh>
        )}
      </Organ>
      <Organ {...p("kidneys")}>
        {(m) =>
          [1, -1].map((s) => (
            <mesh key={s} material={m} position={[0.06 * s, 1.07, -0.035]} rotation={[0, 0, 0.2 * s]} scale={[0.022, 0.038, 0.02]}>
              <sphereGeometry args={[1, 20, 20]} />
            </mesh>
          ))
        }
      </Organ>
      <Organ {...p("intestine")}>
        {(m) => (
          <mesh material={m} position={[0, 1.0, 0.02]} scale={[1, 0.75, 0.55]}>
            <torusKnotGeometry args={[0.048, 0.011, 120, 8, 3, 5]} />
          </mesh>
        )}
      </Organ>
      <Organ {...p("wrist")}>
        {(m) => (
          <group position={[0.2, 1.4, 0]} rotation={[0, 0, 0.12]}>
            <mesh material={m} position={[0, -0.505, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.037, 0.009, 10, 32]} />
            </mesh>
          </group>
        )}
      </Organ>
      <Organ {...p("femur")}>
        {(m) =>
          [1, -1].map((s) => (
            <group key={s} position={[0.085 * s, 0.9, 0]} rotation={[0, 0, 0.015 * s]}>
              <mesh material={m} position={[0, -0.215, 0]}>
                <cylinderGeometry args={[0.016, 0.014, 0.4, 12]} />
              </mesh>
              <mesh material={m} position={[0, -0.01, 0]}>
                <sphereGeometry args={[0.024, 16, 16]} />
              </mesh>
            </group>
          ))
        }
      </Organ>
      <Organ {...p("calcaneus")}>
        {(m) =>
          [1, -1].map((s) => (
            <mesh key={s} material={m} position={[0.088 * s, 0.045, -0.015]} scale={[0.022, 0.018, 0.03]}>
              <sphereGeometry args={[1, 16, 16]} />
            </mesh>
          ))
        }
      </Organ>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/* Hotspot markers: DOM overlay positioned by projecting 3D anchors     */
/* every frame (no React re-render, keyboard accessible).               */
/* ------------------------------------------------------------------ */
type MarkerRefs = React.RefObject<Partial<Record<OrganId, HTMLDivElement | null>>>;

function Projector({ markers, heightScale }: { markers: MarkerRefs; heightScale: number }) {
  const v = React.useMemo(() => new THREE.Vector3(), []);
  const axis = React.useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const els = markers.current;
    if (!els) return;
    for (const o of ORGANS) {
      const el = els[o.id];
      if (!el) continue;
      v.set(o.anchor[0], o.anchor[1], o.anchor[2]).multiplyScalar(heightScale);
      axis.set(0, v.y, 0);
      const behind = camera.position.distanceTo(v) > camera.position.distanceTo(axis) + 0.01;
      v.project(camera);
      const x = (v.x * 0.5 + 0.5) * size.width;
      const y = (-v.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      el.style.opacity = behind ? "0.3" : "1";
      el.style.zIndex = behind ? "1" : "2";
    }
  });
  return null;
}

function MarkerOverlay({
  crew,
  selected,
  onSelect,
  markers,
}: {
  crew: CrewMember;
  selected: OrganId;
  onSelect: (id: OrganId) => void;
  markers: MarkerRefs;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {ORGANS.map((o) => {
        const status = crew.assessments[o.id]?.status ?? "nominal";
        const isSel = o.id === selected;
        const flagged = status !== "nominal";
        const ring = isSel ? "var(--primary)" : flagged ? `var(--${status})` : "rgba(231,234,240,0.45)";
        return (
          <div
            key={o.id}
            ref={(el) => {
              if (markers.current) markers.current[o.id] = el;
            }}
            className="absolute top-0 left-0 transition-opacity duration-300 will-change-transform"
            style={{ transform: "translate3d(-100px,-100px,0)" }}
          >
            <button
              type="button"
              onClick={() => onSelect(o.id)}
              aria-label={`${o.name} · ${status}`}
              aria-pressed={isSel}
              className="group pointer-events-auto relative grid size-6 place-items-center rounded-full outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isSel && <span className="absolute inset-1 animate-ping rounded-full" style={{ background: ring, opacity: 0.4 }} />}
              <span
                className="block rounded-full border-[1.5px] transition-transform group-hover:scale-125"
                style={{
                  borderColor: ring,
                  background: isSel || flagged ? ring : "rgba(7,9,13,0.6)",
                  width: isSel || flagged ? 10 : 7,
                  height: isSel || flagged ? 10 : 7,
                }}
              />
              <span
                className={`pointer-events-none absolute top-1/2 left-7 -translate-y-1/2 whitespace-nowrap rounded-md border bg-popover/95 px-2 py-1 text-[11px] font-medium text-foreground shadow-lg transition-opacity ${
                  isSel ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                }`}
              >
                {o.name}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Platform, scan ring and fluid-shift particles                      */
/* ------------------------------------------------------------------ */
function Platform() {
  const ticks = React.useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ticks.current) ticks.current.rotation.z += dt * 0.08;
  });
  const lineMat = (o: number) => <meshBasicMaterial color={C.shell} transparent opacity={o} depthWrite={false} side={THREE.DoubleSide} />;
  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
      <mesh>
        <circleGeometry args={[0.5, 64]} />
        <meshBasicMaterial color={C.shell} transparent opacity={0.035} depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.495, 0.5, 96]} />
        {lineMat(0.45)}
      </mesh>
      <mesh>
        <ringGeometry args={[0.34, 0.343, 96]} />
        {lineMat(0.25)}
      </mesh>
      <group ref={ticks}>
        {Array.from({ length: 36 }, (_, i) => (
          <mesh key={i} rotation={[0, 0, (i / 36) * Math.PI * 2]}>
            <ringGeometry args={[0.52, i % 3 === 0 ? 0.56 : 0.54, 2, 1, 0, 0.012]} />
            {lineMat(i % 3 === 0 ? 0.5 : 0.25)}
          </mesh>
        ))}
      </group>
    </group>
  );
}

function ScanRing({ scanRef }: { scanRef: React.RefObject<number> }) {
  const ref = React.useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.y = scanRef.current ?? 0;
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.3, 0.302, 96]} />
      <meshBasicMaterial color={C.shell} transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

function FluidParticles({ gravity }: { gravity: number }) {
  const COUNT = 220;
  const ref = React.useRef<THREE.Points>(null);
  const data = React.useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const lane = new Uint8Array(COUNT);
    const speed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      lane[i] = i % 3;
      speed[i] = 0.6 + Math.random() * 0.8;
      pos[i * 3 + 1] = Math.random() * 1.55;
    }
    return { pos, lane, speed };
  }, []);

  useFrame((_, dt) => {
    const pts = ref.current;
    if (!pts) return;
    const base = gravity === 0 ? 0.2 : 0.11;
    const { pos, lane, speed } = data;
    for (let i = 0; i < COUNT; i++) {
      let y = pos[i * 3 + 1] + dt * base * speed[i];
      if (y > 1.55) y = 0.06;
      const legs = y < 0.86;
      const cx = legs ? (lane[i] === 0 ? 0.085 : -0.085) : 0;
      const spread = legs ? 0.03 : y > 1.45 ? 0.025 : 0.08;
      const phase = i * 12.9898;
      pos[i * 3] = cx + Math.sin(phase + y * 9) * spread;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.cos(phase * 0.7 + y * 7) * (legs ? 0.025 : 0.045);
    }
    (pts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.pos, 3]} />
      </bufferGeometry>
      <pointsMaterial color={C.shell} size={0.007} transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */
function Rig({
  crew,
  selected,
  onSelect,
  gravity,
  autoRotate,
  markers,
}: {
  crew: CrewMember;
  selected: OrganId;
  onSelect: (id: OrganId) => void;
  gravity: number;
  autoRotate: boolean;
  markers: MarkerRefs;
}) {
  const shellMat = useHoloMaterial(C.shell, 0.55);
  const boneMat = useHoloMaterial(C.bone, 0.3);
  const scan = React.useRef(0);
  const controls = React.useRef<OrbitControlsImpl>(null);
  const focus = React.useMemo(() => new THREE.Vector3(0, 0.84, 0), []);
  const heightScale = crew.heightCm / 175;

  useFrame(({ clock }) => {
    const y = ((clock.elapsedTime * 0.22) % 1) * 1.8 * heightScale;
    scan.current = y;
    shellMat.uniforms.uScan.value = y;
    boneMat.uniforms.uScan.value = y;

    const anchor = ORGAN_BY_ID[selected].anchor;
    focus.set(0, THREE.MathUtils.lerp(0.84, anchor[1] * heightScale, 0.18), 0);
    if (controls.current) {
      controls.current.target.lerp(focus, 0.04);
      controls.current.update();
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 3, 2]} intensity={1.1} />
      <directionalLight position={[-2, 1, -2]} intensity={0.4} color="#8aa8ff" />

      <group scale={heightScale}>
        <Shell material={shellMat} />
        <Skeleton material={boneMat} />
        <Organs crew={crew} selected={selected} onSelect={onSelect} />
        <FluidParticles gravity={gravity} />
      </group>
      <Projector markers={markers} heightScale={heightScale} />
      <ScanRing scanRef={scan} />
      <Platform />

      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={1.4}
        maxDistance={4.6}
        minPolarAngle={Math.PI * 0.28}
        maxPolarAngle={Math.PI * 0.62}
        autoRotate={autoRotate}
        autoRotateSpeed={0.7}
        target={[0, 0.84, 0]}
      />
    </>
  );
}

export interface BodySceneProps {
  crew: CrewMember;
  selected: OrganId;
  onSelect: (id: OrganId) => void;
  gravity: number;
  autoRotate: boolean;
}

export default function BodyScene(props: BodySceneProps) {
  const markers: MarkerRefs = React.useRef({});
  return (
    <div className="relative size-full">
      <Canvas
        camera={{ position: [0, 1.05, 3.55], fov: 34, near: 0.05, far: 50 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onPointerMissed={() => (document.body.style.cursor = "")}
      >
        <Rig {...props} markers={markers} />
      </Canvas>
      <MarkerOverlay crew={props.crew} selected={props.selected} onSelect={props.onSelect} markers={markers} />
    </div>
  );
}
