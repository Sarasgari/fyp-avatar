"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { AvatarState } from "@/lib/avatar-state";
import {
	AVATAR_STATE_ACCENT_HEX,
	getAvatarStateEnergy,
} from "@/lib/avatar-visuals";

type PointerState = {
	x: number;
	y: number;
};

type PointerRef = {
	current: PointerState;
};

const stateSurfaceColors: Record<AvatarState, string> = {
	idle: "#7dd3fc",
	thinking: "#facc15",
	talking: "#2dd4bf",
	happy: "#86efac",
	sad: "#93c5fd",
	anxious: "#fdba74",
	angry: "#fca5a5",
	confused: "#bef264",
	empathetic: "#f9a8d4",
};

const dampFactor = (speed: number, delta: number) =>
	1 - Math.exp(-speed * delta);

const LowPolyTree = ({
	position,
	scale = 1,
}: {
	position: [number, number, number];
	scale?: number;
}) => (
	<group position={position} scale={scale}>
		<mesh position={[0, 0.24, 0]}>
			<cylinderGeometry args={[0.055, 0.08, 0.48, 5]} />
			<meshStandardMaterial color="#a76b43" flatShading roughness={0.7} />
		</mesh>
		<mesh position={[0, 0.62, 0]}>
			<icosahedronGeometry args={[0.28, 0]} />
			<meshStandardMaterial color="#5fbf73" flatShading roughness={0.82} />
		</mesh>
		<mesh position={[0.1, 0.75, -0.04]}>
			<icosahedronGeometry args={[0.19, 0]} />
			<meshStandardMaterial color="#89d97e" flatShading roughness={0.82} />
		</mesh>
	</group>
);

const Building = ({
	color,
	height,
	position,
}: {
	color: string;
	height: number;
	position: [number, number, number];
}) => (
	<group position={position}>
		<mesh position={[0, height / 2, 0]} castShadow receiveShadow>
			<boxGeometry args={[0.92, height, 0.92]} />
			<meshStandardMaterial color={color} flatShading roughness={0.68} />
		</mesh>
		<mesh position={[0, height + 0.035, 0]}>
			<boxGeometry args={[1, 0.07, 1]} />
			<meshStandardMaterial color="#f8fafc" flatShading roughness={0.55} />
		</mesh>
		<mesh position={[0.03, height + 0.08, 0.04]}>
			<boxGeometry args={[0.72, 0.045, 0.72]} />
			<meshStandardMaterial color="#94a3b8" flatShading roughness={0.7} />
		</mesh>
	</group>
);

const RoadTile = ({ position }: { position: [number, number, number] }) => (
	<group position={position}>
		<mesh receiveShadow>
			<boxGeometry args={[1.1, 0.035, 3.35]} />
			<meshStandardMaterial color="#64748b" roughness={0.78} />
		</mesh>
		<mesh position={[0, 0.022, 0]}>
			<boxGeometry args={[0.045, 0.012, 2.72]} />
			<meshStandardMaterial color="#f8fafc" roughness={0.4} />
		</mesh>
	</group>
);

const CityBase = () => (
	<group rotation={[0, -Math.PI / 4, 0]} position={[0, -1.7, -1.6]}>
		<mesh receiveShadow>
			<boxGeometry args={[7.6, 0.18, 7.6]} />
			<meshStandardMaterial color="#b7e27c" flatShading roughness={0.82} />
		</mesh>
		<mesh position={[0, 0.11, 0]}>
			<boxGeometry args={[7.24, 0.04, 7.24]} />
			<meshStandardMaterial color="#95d95d" flatShading roughness={0.75} />
		</mesh>

		<RoadTile position={[-1.9, 0.16, 0]} />
		<RoadTile position={[1.9, 0.16, 0]} />
		<group rotation={[0, Math.PI / 2, 0]}>
			<RoadTile position={[0, 0.17, 0]} />
		</group>

		<Building color="#f0c987" height={1.12} position={[-2.7, 0.19, -2.55]} />
		<Building color="#8ecae6" height={0.86} position={[-2.75, 0.19, 2.45]} />
		<Building color="#f6a49b" height={1.38} position={[2.55, 0.19, -2.15]} />
		<Building color="#a7c7a1" height={0.78} position={[2.62, 0.19, 2.52]} />

		<LowPolyTree position={[-3.2, 0.18, 0.85]} scale={1.15} />
		<LowPolyTree position={[-0.9, 0.18, 2.85]} scale={0.92} />
		<LowPolyTree position={[0.9, 0.18, -3.05]} scale={0.88} />
		<LowPolyTree position={[3.2, 0.18, 0.82]} scale={1.05} />
	</group>
);

const FloatingAvatar = ({ avatarState }: { avatarState: AvatarState }) => {
	const groupRef = useRef<THREE.Group>(null);
	const headMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
	const bodyMaterialRef = useRef<THREE.MeshStandardMaterial>(null);
	const accentColor = useMemo(
		() => new THREE.Color(AVATAR_STATE_ACCENT_HEX[avatarState]),
		[avatarState],
	);
	const surfaceColor = useMemo(
		() => new THREE.Color(stateSurfaceColors[avatarState]),
		[avatarState],
	);
	const energy = getAvatarStateEnergy(avatarState);

	useFrame(({ clock }, delta) => {
		const group = groupRef.current;
		if (!group) return;

		const time = clock.getElapsedTime();
		group.position.y = 0.42 + Math.sin(time * (0.82 + energy * 0.16)) * 0.08;
		group.rotation.y += delta * (0.18 + energy * 0.12);
		group.rotation.z = Math.sin(time * 0.7) * 0.035;
		headMaterialRef.current?.color.lerp(surfaceColor, dampFactor(3.6, delta));
		bodyMaterialRef.current?.color.lerp(accentColor, dampFactor(3.6, delta));
	});

	return (
		<group ref={groupRef} position={[0, 0.42, 0.12]}>
			<mesh position={[0, 0.76, 0]} castShadow>
				<octahedronGeometry args={[0.46, 0]} />
				<meshStandardMaterial
					ref={headMaterialRef}
					color={stateSurfaceColors[avatarState]}
					flatShading
					roughness={0.54}
				/>
			</mesh>
			<mesh position={[0, 0.24, 0]} castShadow>
				<icosahedronGeometry args={[0.48, 0]} />
				<meshStandardMaterial
					ref={bodyMaterialRef}
					color={AVATAR_STATE_ACCENT_HEX[avatarState]}
					flatShading
					roughness={0.58}
				/>
			</mesh>
			<mesh position={[-0.45, 0.22, 0]} rotation={[0, 0, -0.55]} castShadow>
				<tetrahedronGeometry args={[0.28, 0]} />
				<meshStandardMaterial color="#e0f2fe" flatShading roughness={0.6} />
			</mesh>
			<mesh position={[0.45, 0.22, 0]} rotation={[0, 0, 0.55]} castShadow>
				<tetrahedronGeometry args={[0.28, 0]} />
				<meshStandardMaterial color="#e0f2fe" flatShading roughness={0.6} />
			</mesh>
		</group>
	);
};

const FloatingShard = ({
	avatarState,
	index,
	position,
}: {
	avatarState: AvatarState;
	index: number;
	position: [number, number, number];
}) => {
	const meshRef = useRef<THREE.Mesh>(null);
	const materialRef = useRef<THREE.MeshStandardMaterial>(null);
	const targetColor = useMemo(
		() => new THREE.Color(AVATAR_STATE_ACCENT_HEX[avatarState]),
		[avatarState],
	);

	useFrame(({ clock }, delta) => {
		const mesh = meshRef.current;
		if (!mesh) return;

		const time = clock.getElapsedTime() + index * 0.7;
		mesh.position.y = position[1] + Math.sin(time * 0.54) * 0.12;
		mesh.rotation.x += delta * (0.12 + index * 0.015);
		mesh.rotation.y += delta * (0.18 + index * 0.02);
		materialRef.current?.color.lerp(targetColor, dampFactor(3, delta));
	});

	return (
		<mesh ref={meshRef} position={position} castShadow>
			<tetrahedronGeometry args={[0.18 + index * 0.025, 0]} />
			<meshStandardMaterial
				ref={materialRef}
				color={AVATAR_STATE_ACCENT_HEX[avatarState]}
				flatShading
				roughness={0.5}
				metalness={0.05}
			/>
		</mesh>
	);
};

const SceneRig = ({
	avatarState,
	pointerRef,
}: {
	avatarState: AvatarState;
	pointerRef: PointerRef;
}) => {
	const groupRef = useRef<THREE.Group>(null);

	useFrame((_, delta) => {
		const group = groupRef.current;
		if (!group) return;

		group.rotation.x = THREE.MathUtils.damp(
			group.rotation.x,
			pointerRef.current.y * 0.035,
			2.4,
			delta,
		);
		group.rotation.y = THREE.MathUtils.damp(
			group.rotation.y,
			pointerRef.current.x * 0.055,
			2.4,
			delta,
		);
	});

	return (
		<group ref={groupRef}>
			<CityBase />
			<FloatingAvatar avatarState={avatarState} />
			<FloatingShard
				avatarState={avatarState}
				index={0}
				position={[-1.65, 0.2, -0.5]}
			/>
			<FloatingShard
				avatarState={avatarState}
				index={1}
				position={[1.45, 0.95, -0.8]}
			/>
			<FloatingShard
				avatarState={avatarState}
				index={2}
				position={[1.9, -0.2, 0.75]}
			/>
			<FloatingShard
				avatarState={avatarState}
				index={3}
				position={[-1.25, 1.2, 0.85]}
			/>
		</group>
	);
};

type AppSceneProps = {
	avatarState: AvatarState;
};

export default function AppScene({ avatarState }: AppSceneProps) {
	const pointerRef = useRef<PointerState>({ x: 0, y: 0 });

	useEffect(() => {
		const handlePointerMove = (event: PointerEvent) => {
			pointerRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
			pointerRef.current.y = -((event.clientY / window.innerHeight) * 2 - 1);
		};

		window.addEventListener("pointermove", handlePointerMove, {
			passive: true,
		});

		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
		};
	}, []);

	return (
		<div
			className="pointer-events-none absolute inset-0 overflow-hidden"
			aria-hidden
		>
			<Canvas
				orthographic
				shadows
				dpr={[1, 1.5]}
				camera={{ position: [5.4, 5.2, 6.8], zoom: 74, near: 0.1, far: 100 }}
				gl={{
					antialias: true,
					alpha: true,
					powerPreference: "high-performance",
					preserveDrawingBuffer: true,
				}}
			>
				<color attach="background" args={["#c7ecff"]} />
				<fog attach="fog" args={["#c7ecff", 9, 21]} />
				<ambientLight intensity={1.7} />
				<directionalLight
					castShadow
					position={[4, 8, 5]}
					intensity={2.1}
					shadow-mapSize={[1024, 1024]}
				/>
				<hemisphereLight args={["#e0f7ff", "#8dc56f", 1.1]} />
				<SceneRig avatarState={avatarState} pointerRef={pointerRef} />
			</Canvas>
		</div>
	);
}
