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

const dampFactor = (speed: number, delta: number) =>
	1 - Math.exp(-speed * delta);

type ParticleFieldProps = {
	avatarState: AvatarState;
	pointerRef: PointerRef;
};

const ParticleField = ({ avatarState, pointerRef }: ParticleFieldProps) => {
	const pointsRef = useRef<THREE.Points>(null);
	const materialRef = useRef<THREE.PointsMaterial>(null);
	const targetColor = useMemo(
		() => new THREE.Color(AVATAR_STATE_ACCENT_HEX[avatarState]),
		[avatarState],
	);
	const energy = getAvatarStateEnergy(avatarState);

	const positions = useMemo(() => {
		const count = 360;
		const data = new Float32Array(count * 3);

		for (let index = 0; index < count; index += 1) {
			const stride = index * 3;
			const radius = 2.2 + Math.random() * 5.6;
			const angle = Math.random() * Math.PI * 2;
			const height = (Math.random() - 0.5) * 5.2;

			data[stride] = Math.cos(angle) * radius;
			data[stride + 1] = height;
			data[stride + 2] = -1.5 - Math.random() * 8;
		}

		return data;
	}, []);

	useFrame(({ clock }, delta) => {
		const points = pointsRef.current;
		const material = materialRef.current;
		if (!points || !material) return;

		const time = clock.getElapsedTime();
		const { x, y } = pointerRef.current;

		points.rotation.y += delta * (0.018 + energy * 0.018);
		points.rotation.x = THREE.MathUtils.damp(
			points.rotation.x,
			y * 0.08,
			3.5,
			delta,
		);
		points.position.x = THREE.MathUtils.damp(
			points.position.x,
			x * 0.55,
			2.8,
			delta,
		);
		points.position.y = THREE.MathUtils.damp(
			points.position.y,
			y * 0.25 + Math.sin(time * 0.35) * 0.12,
			2.2,
			delta,
		);

		material.size = THREE.MathUtils.damp(
			material.size,
			0.034 + energy * 0.026,
			6,
			delta,
		);
		material.opacity = THREE.MathUtils.damp(
			material.opacity,
			0.24 + energy * 0.22,
			4,
			delta,
		);
		material.color.lerp(targetColor, dampFactor(3.5, delta));
	});

	return (
		<points ref={pointsRef} position={[0, 0, -1.5]}>
			<bufferGeometry>
				<bufferAttribute attach="attributes-position" args={[positions, 3]} />
			</bufferGeometry>
			<pointsMaterial
				ref={materialRef}
				color={AVATAR_STATE_ACCENT_HEX[avatarState]}
				size={0.05}
				sizeAttenuation
				transparent
				opacity={0.3}
				depthWrite={false}
				blending={THREE.AdditiveBlending}
			/>
		</points>
	);
};

type GlowOrbProps = {
	avatarState: AvatarState;
	colorMultiplier?: number;
	position: [number, number, number];
	radius: number;
	speed: number;
};

const GlowOrb = ({
	avatarState,
	colorMultiplier = 1,
	position,
	radius,
	speed,
}: GlowOrbProps) => {
	const meshRef = useRef<THREE.Mesh>(null);
	const materialRef = useRef<THREE.MeshBasicMaterial>(null);
	const targetColor = useMemo(
		() => new THREE.Color(AVATAR_STATE_ACCENT_HEX[avatarState]),
		[avatarState],
	);
	const energy = getAvatarStateEnergy(avatarState);

	useFrame(({ clock }, delta) => {
		const mesh = meshRef.current;
		const material = materialRef.current;
		if (!mesh || !material) return;

		const time = clock.getElapsedTime();

		mesh.position.x = position[0] + Math.sin(time * speed) * 0.18;
		mesh.position.y = position[1] + Math.cos(time * speed * 0.82) * 0.14;
		mesh.scale.setScalar(
			radius *
				(1 + Math.sin(time * (speed * 0.75) + radius) * 0.06 + energy * 0.08),
		);

		material.opacity = THREE.MathUtils.damp(
			material.opacity,
			0.06 + energy * 0.08,
			4,
			delta,
		);
		material.color.copy(targetColor).multiplyScalar(colorMultiplier);
	});

	return (
		<mesh ref={meshRef} position={position}>
			<sphereGeometry args={[1, 32, 32]} />
			<meshBasicMaterial
				ref={materialRef}
				transparent
				opacity={0.12}
				depthWrite={false}
				blending={THREE.AdditiveBlending}
			/>
		</mesh>
	);
};

type EnergyCoreProps = {
	avatarState: AvatarState;
};

const EnergyCore = ({ avatarState }: EnergyCoreProps) => {
	const outerMeshRef = useRef<THREE.Mesh>(null);
	const innerMeshRef = useRef<THREE.Mesh>(null);
	const fillMeshRef = useRef<THREE.Mesh>(null);
	const outerMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
	const innerMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
	const fillMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
	const targetColor = useMemo(
		() => new THREE.Color(AVATAR_STATE_ACCENT_HEX[avatarState]),
		[avatarState],
	);
	const energy = getAvatarStateEnergy(avatarState);

	useFrame(({ clock }, delta) => {
		const time = clock.getElapsedTime();

		if (outerMeshRef.current) {
			outerMeshRef.current.rotation.x += delta * 0.08;
			outerMeshRef.current.rotation.y += delta * (0.14 + energy * 0.1);
			outerMeshRef.current.scale.setScalar(
				1.9 + Math.sin(time * 0.7) * 0.06 + energy * 0.08,
			);
		}

		if (innerMeshRef.current) {
			innerMeshRef.current.rotation.x -= delta * 0.16;
			innerMeshRef.current.rotation.z += delta * 0.12;
			innerMeshRef.current.scale.setScalar(
				1.22 + Math.cos(time * 1.05) * 0.04 + energy * 0.05,
			);
		}

		if (fillMeshRef.current) {
			fillMeshRef.current.scale.setScalar(
				1.1 + Math.sin(time * 1.3) * 0.04 + energy * 0.05,
			);
		}

		outerMaterialRef.current?.color.lerp(targetColor, dampFactor(4, delta));
		innerMaterialRef.current?.color.lerp(targetColor, dampFactor(4, delta));
		fillMaterialRef.current?.color.lerp(targetColor, dampFactor(4, delta));

		if (outerMaterialRef.current) {
			outerMaterialRef.current.opacity = THREE.MathUtils.damp(
				outerMaterialRef.current.opacity,
				0.2 + energy * 0.25,
				5,
				delta,
			);
		}

		if (innerMaterialRef.current) {
			innerMaterialRef.current.opacity = THREE.MathUtils.damp(
				innerMaterialRef.current.opacity,
				0.15 + energy * 0.18,
				5,
				delta,
			);
		}

		if (fillMaterialRef.current) {
			fillMaterialRef.current.opacity = THREE.MathUtils.damp(
				fillMaterialRef.current.opacity,
				0.05 + energy * 0.08,
				4,
				delta,
			);
		}
	});

	return (
		<group position={[0, 0.75, -4.75]}>
			<mesh ref={fillMeshRef}>
				<icosahedronGeometry args={[0.92, 3]} />
				<meshBasicMaterial
					ref={fillMaterialRef}
					color={AVATAR_STATE_ACCENT_HEX[avatarState]}
					transparent
					opacity={0.08}
					depthWrite={false}
					blending={THREE.AdditiveBlending}
				/>
			</mesh>
			<mesh ref={outerMeshRef}>
				<icosahedronGeometry args={[1, 1]} />
				<meshBasicMaterial
					ref={outerMaterialRef}
					color={AVATAR_STATE_ACCENT_HEX[avatarState]}
					transparent
					opacity={0.24}
					wireframe
					depthWrite={false}
				/>
			</mesh>
			<mesh ref={innerMeshRef}>
				<octahedronGeometry args={[0.68, 0]} />
				<meshBasicMaterial
					ref={innerMaterialRef}
					color={AVATAR_STATE_ACCENT_HEX[avatarState]}
					transparent
					opacity={0.18}
					wireframe
					depthWrite={false}
				/>
			</mesh>
		</group>
	);
};

type SignalBandProps = {
	avatarState: AvatarState;
	radius: number;
	speed: number;
	tilt: number;
	yOffset: number;
};

const SignalBand = ({
	avatarState,
	radius,
	speed,
	tilt,
	yOffset,
}: SignalBandProps) => {
	const meshRef = useRef<THREE.Mesh>(null);
	const materialRef = useRef<THREE.MeshBasicMaterial>(null);
	const targetColor = useMemo(
		() => new THREE.Color(AVATAR_STATE_ACCENT_HEX[avatarState]),
		[avatarState],
	);
	const energy = getAvatarStateEnergy(avatarState);

	useFrame(({ clock }, delta) => {
		const mesh = meshRef.current;
		const material = materialRef.current;
		if (!mesh || !material) return;

		const time = clock.getElapsedTime();
		mesh.rotation.z += delta * speed;
		mesh.rotation.y = tilt + Math.sin(time * speed * 0.7 + radius) * 0.12;
		mesh.position.y = yOffset + Math.sin(time * speed * 0.85 + radius) * 0.08;
		mesh.scale.setScalar(
			1 + Math.sin(time * speed + radius) * 0.02 + energy * 0.04,
		);

		material.opacity = THREE.MathUtils.damp(
			material.opacity,
			0.14 + energy * 0.14,
			4.5,
			delta,
		);
		material.color.lerp(targetColor, dampFactor(4, delta));
	});

	return (
		<mesh
			ref={meshRef}
			position={[0, yOffset, -4.5]}
			rotation={[Math.PI / 2.45, tilt, 0]}
		>
			<torusGeometry args={[radius, 0.028, 18, 90]} />
			<meshBasicMaterial
				ref={materialRef}
				color={AVATAR_STATE_ACCENT_HEX[avatarState]}
				transparent
				opacity={0.2}
				depthWrite={false}
				blending={THREE.AdditiveBlending}
			/>
		</mesh>
	);
};

type FocalClusterProps = {
	avatarState: AvatarState;
	pointerRef: PointerRef;
};

const FocalCluster = ({ avatarState, pointerRef }: FocalClusterProps) => {
	const groupRef = useRef<THREE.Group>(null);

	useFrame(({ clock }, delta) => {
		const group = groupRef.current;
		if (!group) return;

		const time = clock.getElapsedTime();
		const { x, y } = pointerRef.current;

		group.position.x = THREE.MathUtils.damp(
			group.position.x,
			x * 0.75,
			2.4,
			delta,
		);
		group.position.y = THREE.MathUtils.damp(
			group.position.y,
			1.1 + y * 0.35 + Math.sin(time * 0.45) * 0.08,
			2.2,
			delta,
		);
		group.rotation.x = THREE.MathUtils.damp(
			group.rotation.x,
			y * 0.08,
			3,
			delta,
		);
		group.rotation.y = THREE.MathUtils.damp(
			group.rotation.y,
			x * 0.16 + Math.sin(time * 0.28) * 0.05,
			3,
			delta,
		);
	});

	return (
		<group ref={groupRef} position={[0, 1.1, 0]}>
			<GlowOrb
				avatarState={avatarState}
				position={[-2.8, 1, -7.4]}
				radius={1.65}
				speed={0.3}
				colorMultiplier={0.85}
			/>
			<GlowOrb
				avatarState={avatarState}
				position={[2.65, -0.3, -7]}
				radius={1.2}
				speed={0.42}
				colorMultiplier={0.7}
			/>
			<GlowOrb
				avatarState={avatarState}
				position={[0.25, 2.15, -6.8]}
				radius={0.95}
				speed={0.52}
				colorMultiplier={1.05}
			/>
			<EnergyCore avatarState={avatarState} />
			<SignalBand
				avatarState={avatarState}
				radius={1.25}
				speed={0.18}
				tilt={0.15}
				yOffset={0.55}
			/>
			<SignalBand
				avatarState={avatarState}
				radius={1.7}
				speed={-0.12}
				tilt={-0.4}
				yOffset={0.9}
			/>
			<SignalBand
				avatarState={avatarState}
				radius={2.2}
				speed={0.08}
				tilt={0.55}
				yOffset={0.15}
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
				dpr={[1, 1.5]}
				camera={{ position: [0, 0, 8], fov: 42 }}
				gl={{
					antialias: true,
					alpha: true,
					powerPreference: "high-performance",
				}}
			>
				<fog attach="fog" args={["#020617", 8, 22]} />
				<ParticleField avatarState={avatarState} pointerRef={pointerRef} />
				<FocalCluster avatarState={avatarState} pointerRef={pointerRef} />
			</Canvas>
		</div>
	);
}
