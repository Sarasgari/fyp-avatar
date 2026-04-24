"use client";

import { type VRM, VRMLoaderPlugin } from "@pixiv/three-vrm";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { AvatarState, Emotion } from "@/lib/avatar-state";

const MODEL_PATH = "/models/AjoMajo.vrm";
const BASE_POSITION_Y = -0.4;
const MOUTH_PRESETS = ["aa", "ee", "ih", "oh", "ou"] as const;
const FACE_EXPRESSION_NAMES = [
	"happy",
	"sad",
	"angry",
	"surprised",
	"relaxed",
	"lookUp",
	"lookDown",
	"lookLeft",
	"lookRight",
] as const;
const ROTATION_AXES = ["x", "y", "z"] as const;
const BODY_BONE_NAMES = [
	"hips",
	"spine",
	"chest",
	"neck",
	"head",
	"leftShoulder",
	"rightShoulder",
	"leftUpperArm",
	"rightUpperArm",
	"leftLowerArm",
	"rightLowerArm",
	"leftHand",
	"rightHand",
] as const;

type MouthPreset = (typeof MOUTH_PRESETS)[number];
type FaceExpressionName = (typeof FACE_EXPRESSION_NAMES)[number];
type RotationAxis = (typeof ROTATION_AXES)[number];
type BodyBoneName = (typeof BODY_BONE_NAMES)[number];
type FaceTargets = Record<FaceExpressionName, number>;
type BoneRotationTargets = Partial<Record<RotationAxis, number>>;
type BodyPoseTargets = Partial<Record<BodyBoneName, BoneRotationTargets>>;
type SpeechState = {
	active: boolean;
	current: MouthPreset;
	previous: MouthPreset;
	startedAt: number;
	nextChangeAt: number;
	pauseUntil: number;
	peak: number;
	cadenceOffset: number;
};
type FaceState = Exclude<AvatarState, "talking">;

const VOWEL_TRANSITION_WEIGHTS: Record<
	MouthPreset,
	Record<MouthPreset, number>
> = {
	aa: { aa: 0.14, ee: 1.02, ih: 1.12, oh: 0.94, ou: 0.76 },
	ee: { aa: 1.08, ee: 0.18, ih: 1.05, oh: 0.68, ou: 0.58 },
	ih: { aa: 1.02, ee: 0.96, ih: 0.18, oh: 0.76, ou: 0.7 },
	oh: { aa: 0.98, ee: 0.72, ih: 0.74, oh: 0.18, ou: 1.12 },
	ou: { aa: 0.92, ee: 0.6, ih: 0.78, oh: 1.16, ou: 0.2 },
};

// Blend each vowel into neighboring mouth shapes to mimic coarticulation.
const VOWEL_BLEND_MAP: Record<
	MouthPreset,
	Partial<Record<MouthPreset, number>>
> = {
	aa: { aa: 1, oh: 0.16 },
	ee: { ee: 1, ih: 0.24 },
	ih: { ih: 1, ee: 0.14 },
	oh: { oh: 1, ou: 0.24, aa: 0.1 },
	ou: { ou: 1, oh: 0.28 },
};

const randomBetween = (min: number, max: number) =>
	min + Math.random() * (max - min);

const pickNextMouthPreset = (current: MouthPreset): MouthPreset => {
	const weights = VOWEL_TRANSITION_WEIGHTS[current];
	const totalWeight = Object.values(weights).reduce(
		(sum, weight) => sum + weight,
		0,
	);
	let threshold = Math.random() * totalWeight;

	for (const preset of MOUTH_PRESETS) {
		threshold -= weights[preset];
		if (threshold <= 0) {
			return preset;
		}
	}

	return current;
};

const createMouthTargets = (): Record<MouthPreset, number> => ({
	aa: 0,
	ee: 0,
	ih: 0,
	oh: 0,
	ou: 0,
});

const createFaceTargets = (): FaceTargets => ({
	happy: 0,
	sad: 0,
	angry: 0,
	surprised: 0,
	relaxed: 0,
	lookUp: 0,
	lookDown: 0,
	lookLeft: 0,
	lookRight: 0,
});

const setFaceTarget = (
	targets: FaceTargets,
	expressionName: FaceExpressionName,
	value: number,
) => {
	targets[expressionName] = THREE.MathUtils.clamp(value, 0, 1);
};

const resetExpressions = (targets: FaceTargets) => {
	for (const expressionName of FACE_EXPRESSION_NAMES) {
		targets[expressionName] = 0;
	}
};

const applyNeutralFace = (targets: FaceTargets) => {
	setFaceTarget(targets, "relaxed", 0.06);
};

const applyHappyFace = (targets: FaceTargets) => {
	setFaceTarget(targets, "happy", 0.78);
	setFaceTarget(targets, "relaxed", 0.16);
	setFaceTarget(targets, "lookUp", 0.03);
};

const applySadFace = (targets: FaceTargets) => {
	setFaceTarget(targets, "sad", 0.6);
	setFaceTarget(targets, "relaxed", 0.14);
	setFaceTarget(targets, "lookDown", 0.12);
};

const applyAnxiousFace = (targets: FaceTargets, time: number) => {
	setFaceTarget(targets, "sad", 0.2);
	setFaceTarget(targets, "surprised", 0.14);
	setFaceTarget(targets, "relaxed", 0.08);
	setFaceTarget(targets, "lookDown", 0.04);
	setFaceTarget(
		targets,
		Math.sin(time * 1.5) > 0 ? "lookLeft" : "lookRight",
		0.08,
	);
};

const applyAngryFace = (targets: FaceTargets) => {
	setFaceTarget(targets, "angry", 0.72);
	setFaceTarget(targets, "lookDown", 0.06);
	setFaceTarget(targets, "relaxed", 0.02);
};

const applyConfusedFace = (targets: FaceTargets, time: number) => {
	setFaceTarget(targets, "surprised", 0.22);
	setFaceTarget(targets, "relaxed", 0.12);
	setFaceTarget(
		targets,
		Math.sin(time * 0.75) > 0 ? "lookLeft" : "lookRight",
		0.07,
	);
	setFaceTarget(targets, "lookDown", 0.04);
};

const applyEmpatheticFace = (targets: FaceTargets) => {
	setFaceTarget(targets, "sad", 0.1);
	setFaceTarget(targets, "relaxed", 0.28);
	setFaceTarget(targets, "lookDown", 0.06);
};

const applyThinkingFace = (targets: FaceTargets, time: number) => {
	setFaceTarget(targets, "relaxed", 0.16);
	setFaceTarget(targets, "lookDown", 0.14);
	setFaceTarget(
		targets,
		Math.sin(time * 0.7) > 0 ? "lookLeft" : "lookRight",
		0.05,
	);
	setFaceTarget(targets, "surprised", 0.04);
};

const applyTalkingState = (targets: FaceTargets, speechEnergy: number) => {
	setFaceTarget(
		targets,
		"relaxed",
		Math.max(targets.relaxed, 0.08 + speechEnergy * 0.04),
	);
};

const applyFaceState = (
	targets: FaceTargets,
	faceState: FaceState,
	time: number,
) => {
	resetExpressions(targets);

	switch (faceState) {
		case "thinking":
			applyThinkingFace(targets, time);
			return;
		case "happy":
			applyHappyFace(targets);
			return;
		case "sad":
			applySadFace(targets);
			return;
		case "anxious":
			applyAnxiousFace(targets, time);
			return;
		case "angry":
			applyAngryFace(targets);
			return;
		case "confused":
			applyConfusedFace(targets, time);
			return;
		case "empathetic":
			applyEmpatheticFace(targets);
			return;
		default:
			applyNeutralFace(targets);
	}
};

const scheduleNextSpeechBeat = (speechState: SpeechState, time: number) => {
	speechState.previous = speechState.current;
	speechState.current = pickNextMouthPreset(speechState.current);
	speechState.startedAt = time;
	speechState.nextChangeAt = time + randomBetween(0.09, 0.2);
	speechState.peak = randomBetween(0.58, 0.96);

	// Short closures between syllables keep the mouth from looking robotic.
	speechState.pauseUntil =
		Math.random() < 0.22 ? time + randomBetween(0.035, 0.085) : 0;
};

const addVowelBlend = (
	targets: Record<MouthPreset, number>,
	vowel: MouthPreset,
	strength: number,
) => {
	const blend = VOWEL_BLEND_MAP[vowel];

	for (const preset of MOUTH_PRESETS) {
		const contribution = blend[preset] ?? 0;
		if (!contribution) continue;
		targets[preset] += contribution * strength;
	}
};

const dampExpressionValue = (
	vrm: VRM,
	expressionName: string,
	target: number,
	delta: number,
	speed = 14,
) => {
	const expressionManager = vrm.expressionManager;
	if (!expressionManager) return;

	const currentValue = expressionManager.getValue(expressionName) ?? 0;
	expressionManager.setValue(
		expressionName,
		THREE.MathUtils.damp(currentValue, target, speed, delta),
	);
};

const emotionToFaceState = (emotion: Emotion): FaceState =>
	emotion === "neutral" ? "idle" : emotion;

const resolveFaceState = (state: AvatarState, emotion: Emotion): FaceState => {
	if (state === "talking") {
		return emotionToFaceState(emotion);
	}

	return state;
};

const getNextBlinkDelay = (state: AvatarState, faceState: FaceState) => {
	if (state === "talking") {
		return 1.8 + Math.random() * 1.4;
	}

	switch (faceState) {
		case "thinking":
			return 1.4 + Math.random() * 1.4;
		case "anxious":
			return 1.2 + Math.random() * 1.1;
		case "confused":
			return 1.5 + Math.random() * 1.2;
		case "sad":
			return 2.6 + Math.random() * 1.6;
		default:
			return 2.2 + Math.random() * 1.8;
	}
};

const getBlinkAmount = (
	time: number,
	blinkWindow: { start: number; end: number; next: number },
	state: AvatarState,
	faceState: FaceState,
) => {
	if (time >= blinkWindow.next) {
		blinkWindow.start = time;
		blinkWindow.end = time + 0.12;
		blinkWindow.next = time + getNextBlinkDelay(state, faceState);
	}

	if (time < blinkWindow.start || time > blinkWindow.end) {
		return 0;
	}

	const progress =
		(time - blinkWindow.start) / (blinkWindow.end - blinkWindow.start);
	return Math.sin(progress * Math.PI);
};

const getBasePose = (faceState: FaceState, time: number) => {
	switch (faceState) {
		case "thinking":
			return {
				rotationX: -0.05 + Math.sin(time * 1.15) * 0.012,
				rotationY: Math.PI + 0.1 + Math.sin(time * 0.65) * 0.03,
				rotationZ: -0.04,
				positionX: -0.05,
				positionYOffset: 0,
				breathingScale: 0.01,
			};
		case "happy":
			return {
				rotationX: 0.012 + Math.sin(time * 0.9) * 0.01,
				rotationY: Math.PI - 0.02 + Math.sin(time * 0.85) * 0.04,
				rotationZ: -0.02,
				positionX: -0.02,
				positionYOffset: 0.004,
				breathingScale: 0.02,
			};
		case "sad":
			return {
				rotationX: -0.055 + Math.sin(time * 0.8) * 0.008,
				rotationY: Math.PI + 0.02,
				rotationZ: 0.018,
				positionX: 0,
				positionYOffset: -0.01,
				breathingScale: 0.012,
			};
		case "anxious":
			return {
				rotationX: -0.03 + Math.sin(time * 2.4) * 0.01,
				rotationY: Math.PI + Math.sin(time * 1.8) * 0.05,
				rotationZ: Math.sin(time * 1.5) * 0.01,
				positionX: Math.sin(time * 1.6) * 0.01,
				positionYOffset: 0.006,
				breathingScale: 0.02,
			};
		case "angry":
			return {
				rotationX: -0.02,
				rotationY: Math.PI + 0.04,
				rotationZ: 0.012,
				positionX: 0.015,
				positionYOffset: 0.002,
				breathingScale: 0.016,
			};
		case "confused":
			return {
				rotationX: -0.012 + Math.sin(time * 0.75) * 0.008,
				rotationY: Math.PI + 0.1 + Math.sin(time * 0.7) * 0.03,
				rotationZ: -0.03,
				positionX: -0.01,
				positionYOffset: 0.002,
				breathingScale: 0.017,
			};
		case "empathetic":
			return {
				rotationX: -0.04 + Math.sin(time * 0.8) * 0.008,
				rotationY: Math.PI - 0.03 + Math.sin(time * 0.55) * 0.02,
				rotationZ: -0.015,
				positionX: -0.015,
				positionYOffset: -0.004,
				breathingScale: 0.015,
			};
		default:
			return {
				rotationX: Math.sin(time * 1.1) * 0.01,
				rotationY: Math.PI + Math.sin(time * 0.9) * 0.08,
				rotationZ: 0,
				positionX: 0,
				positionYOffset: 0,
				breathingScale: 0.018,
			};
	}
};

const setBoneTarget = (
	targets: BodyPoseTargets,
	boneName: BodyBoneName,
	rotation: BoneRotationTargets,
) => {
	targets[boneName] = rotation;
};

const createBaseBodyPose = (time: number): BodyPoseTargets => {
	const torsoSway = Math.sin(time * 0.8) * 0.03;
	const torsoBreath = Math.sin(time * 1.4) * 0.02;

	const targets: BodyPoseTargets = {};

	setBoneTarget(targets, "hips", { x: 0, y: torsoSway * 0.35, z: 0 });
	setBoneTarget(targets, "spine", {
		x: 0.03 + torsoBreath * 0.3,
		y: torsoSway * 0.35,
		z: 0,
	});
	setBoneTarget(targets, "chest", {
		x: 0.04 + torsoBreath * 0.45,
		y: torsoSway * 0.55,
		z: 0,
	});
	setBoneTarget(targets, "neck", { x: -0.02, y: torsoSway * 0.5, z: 0 });
	setBoneTarget(targets, "head", { x: 0.02, y: torsoSway * 0.7, z: 0 });
	setBoneTarget(targets, "leftShoulder", { z: 0.18 });
	setBoneTarget(targets, "rightShoulder", { z: -0.18 });
	setBoneTarget(targets, "leftUpperArm", { x: 0.03, z: 1.02 });
	setBoneTarget(targets, "rightUpperArm", { x: -0.03, z: -1.02 });
	setBoneTarget(targets, "leftLowerArm", { z: 0.18 });
	setBoneTarget(targets, "rightLowerArm", { z: -0.18 });
	setBoneTarget(targets, "leftHand", { x: 0.08, z: 0.06 });
	setBoneTarget(targets, "rightHand", { x: -0.08, z: -0.06 });

	return targets;
};

const getBoneRotationTarget = (
	targets: BodyPoseTargets,
	boneName: BodyBoneName,
	axis: RotationAxis,
) => targets[boneName]?.[axis] ?? 0;

const offsetBoneTarget = (
	targets: BodyPoseTargets,
	boneName: BodyBoneName,
	rotation: BoneRotationTargets,
) => {
	for (const axis of ROTATION_AXES) {
		const value = rotation[axis];
		if (value === undefined) continue;

		setBoneTarget(targets, boneName, {
			...targets[boneName],
			[axis]: getBoneRotationTarget(targets, boneName, axis) + value,
		});
	}
};

const getBodyPoseTargets = (
	faceState: FaceState,
	state: AvatarState,
	time: number,
	speechEnergy: number,
) => {
	const targets = createBaseBodyPose(time);
	const talking = state === "talking";
	const talkDrift = talking
		? Math.sin(time * 3.4) * (0.018 + speechEnergy * 0.04)
		: 0;
	const talkGesture = talking
		? Math.sin(time * 4.8) * (0.02 + speechEnergy * 0.045)
		: 0;

	switch (faceState) {
		case "thinking":
			offsetBoneTarget(targets, "chest", { x: -0.02, y: 0.05 });
			offsetBoneTarget(targets, "neck", { x: -0.08, y: 0.08 });
			offsetBoneTarget(targets, "head", { x: -0.1, y: 0.12, z: -0.08 });
			offsetBoneTarget(targets, "leftShoulder", { z: 0.05 });
			offsetBoneTarget(targets, "rightShoulder", { z: -0.02 });
			offsetBoneTarget(targets, "leftUpperArm", { z: -0.12 });
			offsetBoneTarget(targets, "rightUpperArm", { z: 0.08 });
			break;
		case "happy":
			offsetBoneTarget(targets, "chest", { x: 0.05 });
			offsetBoneTarget(targets, "neck", { x: 0.02 });
			offsetBoneTarget(targets, "head", { x: 0.03, z: -0.04 });
			offsetBoneTarget(targets, "leftShoulder", { z: -0.05 });
			offsetBoneTarget(targets, "rightShoulder", { z: 0.05 });
			offsetBoneTarget(targets, "leftUpperArm", { z: -0.16 });
			offsetBoneTarget(targets, "rightUpperArm", { z: 0.16 });
			break;
		case "sad":
			offsetBoneTarget(targets, "spine", { x: -0.04 });
			offsetBoneTarget(targets, "chest", { x: -0.08 });
			offsetBoneTarget(targets, "neck", { x: -0.05 });
			offsetBoneTarget(targets, "head", { x: -0.08, z: 0.03 });
			offsetBoneTarget(targets, "leftShoulder", { z: 0.07 });
			offsetBoneTarget(targets, "rightShoulder", { z: -0.07 });
			offsetBoneTarget(targets, "leftUpperArm", { z: 0.08 });
			offsetBoneTarget(targets, "rightUpperArm", { z: -0.08 });
			break;
		case "anxious":
			offsetBoneTarget(targets, "chest", {
				x: -0.03,
				y: Math.sin(time * 1.7) * 0.04,
			});
			offsetBoneTarget(targets, "neck", {
				x: -0.05,
				y: Math.sin(time * 2.2) * 0.06,
			});
			offsetBoneTarget(targets, "head", {
				x: -0.03,
				y: Math.sin(time * 2.4) * 0.08,
				z: Math.sin(time * 2.8) * 0.025,
			});
			offsetBoneTarget(targets, "leftShoulder", { z: 0.09 });
			offsetBoneTarget(targets, "rightShoulder", { z: -0.09 });
			offsetBoneTarget(targets, "leftUpperArm", { z: 0.12 });
			offsetBoneTarget(targets, "rightUpperArm", { z: -0.12 });
			offsetBoneTarget(targets, "leftLowerArm", { z: 0.08 });
			offsetBoneTarget(targets, "rightLowerArm", { z: -0.08 });
			break;
		case "angry":
			offsetBoneTarget(targets, "spine", { x: 0.02 });
			offsetBoneTarget(targets, "chest", { x: 0.08 });
			offsetBoneTarget(targets, "neck", { x: 0.04 });
			offsetBoneTarget(targets, "head", { x: 0.02, y: 0.04 });
			offsetBoneTarget(targets, "leftShoulder", { z: -0.03 });
			offsetBoneTarget(targets, "rightShoulder", { z: 0.03 });
			offsetBoneTarget(targets, "leftUpperArm", { z: -0.1 });
			offsetBoneTarget(targets, "rightUpperArm", { z: 0.1 });
			offsetBoneTarget(targets, "leftLowerArm", { z: 0.14 });
			offsetBoneTarget(targets, "rightLowerArm", { z: -0.14 });
			break;
		case "confused":
			offsetBoneTarget(targets, "chest", { y: 0.04 });
			offsetBoneTarget(targets, "neck", { y: 0.08 });
			offsetBoneTarget(targets, "head", { x: -0.02, y: 0.1, z: -0.12 });
			offsetBoneTarget(targets, "leftShoulder", { z: 0.03 });
			offsetBoneTarget(targets, "rightShoulder", { z: -0.08 });
			offsetBoneTarget(targets, "leftUpperArm", { z: -0.04 });
			offsetBoneTarget(targets, "rightUpperArm", { z: 0.1 });
			break;
		case "empathetic":
			offsetBoneTarget(targets, "spine", { x: -0.015 });
			offsetBoneTarget(targets, "chest", { x: -0.03 });
			offsetBoneTarget(targets, "neck", { x: -0.02, y: -0.05 });
			offsetBoneTarget(targets, "head", { x: -0.04, y: -0.06, z: 0.05 });
			offsetBoneTarget(targets, "leftUpperArm", { z: 0.06 });
			offsetBoneTarget(targets, "rightUpperArm", { z: -0.06 });
			offsetBoneTarget(targets, "leftLowerArm", { z: 0.06 });
			offsetBoneTarget(targets, "rightLowerArm", { z: -0.06 });
			break;
		default:
			break;
	}

	if (talking) {
		offsetBoneTarget(targets, "chest", { y: talkDrift * 0.8 });
		offsetBoneTarget(targets, "neck", { y: talkDrift * 1.1 });
		offsetBoneTarget(targets, "head", {
			x: talkDrift * 0.4,
			y: talkDrift * 1.4,
			z: talkDrift * 0.35,
		});
		offsetBoneTarget(targets, "leftLowerArm", { z: talkGesture });
		offsetBoneTarget(targets, "rightLowerArm", { z: -talkGesture });
		offsetBoneTarget(targets, "leftHand", { x: talkGesture * 0.7 });
		offsetBoneTarget(targets, "rightHand", { x: -talkGesture * 0.7 });
	}

	return targets;
};

const getHumanoidBone = (vrm: VRM, boneName: BodyBoneName) =>
	vrm.humanoid?.getNormalizedBoneNode?.(boneName) ??
	vrm.humanoid?.getRawBoneNode?.(boneName) ??
	null;

const dampBoneRotation = (
	bone: THREE.Object3D,
	axis: RotationAxis,
	target: number,
	delta: number,
	speed = 7,
) => {
	bone.rotation[axis] = THREE.MathUtils.damp(
		bone.rotation[axis],
		target,
		speed,
		delta,
	);
};

const applyBodyPose = (
	vrm: VRM,
	faceState: FaceState,
	state: AvatarState,
	time: number,
	speechEnergy: number,
	delta: number,
) => {
	const poseTargets = getBodyPoseTargets(faceState, state, time, speechEnergy);

	for (const boneName of BODY_BONE_NAMES) {
		const bone = getHumanoidBone(vrm, boneName);
		if (!bone) continue;

		const targets = poseTargets[boneName];

		for (const axis of ROTATION_AXES) {
			dampBoneRotation(
				bone,
				axis,
				targets?.[axis] ?? 0,
				delta,
				boneName === "head" || boneName === "neck" ? 8 : 6,
			);
		}
	}
};

function VRMAvatar({
	state,
	emotion,
}: {
	state: AvatarState;
	emotion: Emotion;
}) {
	const [vrm, setVrm] = useState<VRM | null>(null);
	const blinkWindowRef = useRef({
		start: 0,
		end: 0,
		next: 1.8,
	});
	const speechStateRef = useRef<SpeechState>({
		active: false,
		current: "aa",
		previous: "aa",
		startedAt: 0,
		nextChangeAt: 0,
		pauseUntil: 0,
		peak: 0.8,
		cadenceOffset: Math.random() * Math.PI * 2,
	});

	useEffect(() => {
		const loader = new GLTFLoader();
		loader.register((parser) => new VRMLoaderPlugin(parser));

		loader.load(
			MODEL_PATH,
			(gltf) => {
				const loadedVrm = gltf.userData.vrm as VRM;
				if (!loadedVrm) return;

				loadedVrm.scene.rotation.set(0, Math.PI, 0);
				loadedVrm.scene.position.set(0, BASE_POSITION_Y, 0);
				setVrm(loadedVrm);
			},
			undefined,
			(error) => {
				console.error("Failed to load VRM:", error);
			},
		);
	}, []);

	useFrame(({ clock }, delta) => {
		if (!vrm) return;

		const time = clock.getElapsedTime();
		const breathing = Math.sin(time * 1.6);
		const faceState = resolveFaceState(state, emotion);
		const blink = getBlinkAmount(
			time,
			blinkWindowRef.current,
			state,
			faceState,
		);
		const speechState = speechStateRef.current;
		const mouthTargets = createMouthTargets();
		const faceTargets = createFaceTargets();
		let speechEnergy = 0;

		if (state === "talking") {
			if (!speechState.active) {
				speechState.active = true;
				speechState.cadenceOffset = Math.random() * Math.PI * 2;
				speechState.current = "aa";
				speechState.previous = "aa";
				scheduleNextSpeechBeat(speechState, time);
			}

			while (time >= speechState.nextChangeAt) {
				scheduleNextSpeechBeat(speechState, speechState.nextChangeAt);
			}

			const syllableDuration = Math.max(
				speechState.nextChangeAt - speechState.startedAt,
				0.001,
			);
			const syllableProgress = THREE.MathUtils.clamp(
				(time - speechState.startedAt) / syllableDuration,
				0,
				1,
			);
			const attack = THREE.MathUtils.smoothstep(syllableProgress, 0, 0.18);
			const release = 1 - THREE.MathUtils.smoothstep(syllableProgress, 0.68, 1);
			const carry =
				1 - THREE.MathUtils.smoothstep(syllableProgress, 0.08, 0.58);
			const phraseEnvelope = THREE.MathUtils.clamp(
				0.82 +
					Math.sin(time * 2.4 + speechState.cadenceOffset) * 0.14 +
					Math.sin(time * 0.95 + speechState.cadenceOffset * 0.35) * 0.08,
				0.55,
				1.1,
			);
			const syllableEnvelope =
				time < speechState.pauseUntil ? 0 : attack * release;
			const speakingStrength =
				speechState.peak * phraseEnvelope * syllableEnvelope;

			addVowelBlend(mouthTargets, speechState.current, speakingStrength);
			addVowelBlend(
				mouthTargets,
				speechState.previous,
				speakingStrength * 0.34 * carry,
			);

			const jawBed =
				0.035 +
				Math.sin(time * 9.5 + speechState.cadenceOffset) * 0.012 +
				Math.sin(time * 15.5 + speechState.cadenceOffset * 0.6) * 0.008;
			mouthTargets.aa += Math.max(0, jawBed) * speakingStrength * 0.45;

			speechEnergy = THREE.MathUtils.clamp(
				Math.max(...MOUTH_PRESETS.map((preset) => mouthTargets[preset])),
				0,
				1,
			);
		} else {
			speechState.active = false;
			speechState.pauseUntil = 0;
		}

		applyFaceState(faceTargets, faceState, time);

		if (state === "talking") {
			applyTalkingState(faceTargets, speechEnergy);
		}

		const basePose = getBasePose(faceState, time);

		const targetRotationX =
			basePose.rotationX +
			(state === "talking"
				? 0.015 +
					Math.sin(time * 3.6 + speechState.cadenceOffset) *
						0.008 *
						speechEnergy
				: 0);
		const targetRotationY =
			basePose.rotationY +
			(state === "talking"
				? Math.sin(time * 1.35) * 0.02 +
					Math.sin(time * 4.8 + speechState.cadenceOffset) * 0.01 * speechEnergy
				: 0);
		const targetRotationZ =
			basePose.rotationZ +
			(state === "talking"
				? Math.sin(time * 2.8 + speechState.cadenceOffset) *
					0.006 *
					speechEnergy
				: 0);
		const targetPositionX =
			basePose.positionX +
			(state === "talking"
				? Math.sin(time * 2.2 + speechState.cadenceOffset) * 0.01 * speechEnergy
				: 0);
		const targetPositionY =
			BASE_POSITION_Y +
			basePose.positionYOffset +
			breathing * basePose.breathingScale +
			speechEnergy * 0.01;

		vrm.scene.rotation.x = THREE.MathUtils.damp(
			vrm.scene.rotation.x,
			targetRotationX,
			5,
			delta,
		);
		vrm.scene.rotation.y = THREE.MathUtils.damp(
			vrm.scene.rotation.y,
			targetRotationY,
			5,
			delta,
		);
		vrm.scene.rotation.z = THREE.MathUtils.damp(
			vrm.scene.rotation.z,
			targetRotationZ,
			5,
			delta,
		);
		vrm.scene.position.x = THREE.MathUtils.damp(
			vrm.scene.position.x,
			targetPositionX,
			4,
			delta,
		);
		vrm.scene.position.y = THREE.MathUtils.damp(
			vrm.scene.position.y,
			targetPositionY,
			4,
			delta,
		);
		applyBodyPose(vrm, faceState, state, time, speechEnergy, delta);

		for (const preset of MOUTH_PRESETS) {
			dampExpressionValue(
				vrm,
				preset,
				THREE.MathUtils.clamp(mouthTargets[preset], 0, 1),
				delta,
				18,
			);
		}

		dampExpressionValue(vrm, "blink", blink, delta, 22);

		for (const expressionName of FACE_EXPRESSION_NAMES) {
			dampExpressionValue(
				vrm,
				expressionName,
				faceTargets[expressionName],
				delta,
				expressionName === "surprised" ? 12 : 10,
			);
		}

		vrm.update(delta);
	});

	if (!vrm) return null;

	return <primitive object={vrm.scene} scale={1.1} />;
}

type AvatarCanvasProps = {
	state: AvatarState;
	emotion: Emotion;
};

export default function AvatarCanvas({ state, emotion }: AvatarCanvasProps) {
	return (
		<div className="w-full h-[400px] md:h-[450px] overflow-hidden rounded-2xl  bg-muted/40">
			<Canvas camera={{ position: [-0.9, 1.2, 2.8], fov: 22 }}>
				<ambientLight intensity={1.2} />
				<directionalLight position={[1, 1, 1]} intensity={1.5} />
				<VRMAvatar state={state} emotion={emotion} />
			</Canvas>
		</div>
	);
}
