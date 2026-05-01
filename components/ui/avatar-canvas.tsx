"use client";

import { type VRM, VRMLoaderPlugin } from "@pixiv/three-vrm";
import { Canvas, useFrame } from "@react-three/fiber";
import {
	LoaderCircleIcon,
	ShieldAlertIcon,
	ShieldCheckIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { BodyState, EmotionState, SpeechState } from "@/lib/avatar-state";
import { cn } from "@/lib/utils";

const MODEL_PATH = "/models/viverse_avatar_model_178290.vrm";
const AVATAR_MODEL_SCALE = 0.62;
const BASE_POSITION_Y = -0.58;
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
	"leftUpperLeg",
	"rightUpperLeg",
	"leftLowerLeg",
	"rightLowerLeg",
	"leftFoot",
	"rightFoot",
] as const;

type MouthPreset = (typeof MOUTH_PRESETS)[number];
type FaceExpressionName = (typeof FACE_EXPRESSION_NAMES)[number];
type RotationAxis = (typeof ROTATION_AXES)[number];
type BodyBoneName = (typeof BODY_BONE_NAMES)[number];
type FaceTargets = Record<FaceExpressionName, number>;
type BoneRotationTargets = Partial<Record<RotationAxis, number>>;
type BodyPoseTargets = Partial<Record<BodyBoneName, BoneRotationTargets>>;
type BodyRig = Partial<
	Record<
		BodyBoneName,
		{
			bone: THREE.Object3D;
			restQuaternion: THREE.Quaternion;
			targetQuaternion: THREE.Quaternion;
		}
	>
>;
type LipSyncState = {
	active: boolean;
	current: MouthPreset;
	previous: MouthPreset;
	startedAt: number;
	nextChangeAt: number;
	pauseUntil: number;
	peak: number;
	cadenceOffset: number;
};

export type AvatarCanvasStatus = "loading" | "ready" | "unsupported" | "error";

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

const scheduleNextSpeechBeat = (lipSyncState: LipSyncState, time: number) => {
	lipSyncState.previous = lipSyncState.current;
	lipSyncState.current = pickNextMouthPreset(lipSyncState.current);
	lipSyncState.startedAt = time;
	lipSyncState.nextChangeAt = time + randomBetween(0.09, 0.2);
	lipSyncState.peak = randomBetween(0.58, 0.96);
	lipSyncState.pauseUntil =
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

const setFaceTarget = (
	targets: FaceTargets,
	expressionName: FaceExpressionName,
	value: number,
) => {
	targets[expressionName] = THREE.MathUtils.clamp(value, 0, 1);
};

const applySideLook = (targets: FaceTargets, amount: number) => {
	setFaceTarget(targets, "lookLeft", Math.max(0, amount));
	setFaceTarget(targets, "lookRight", Math.max(0, -amount));
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
	setFaceTarget(targets, "sad", 0.18);
	setFaceTarget(targets, "surprised", 0.12);
	setFaceTarget(targets, "relaxed", 0.08);
	setFaceTarget(targets, "lookDown", 0.05);
	applySideLook(
		targets,
		Math.sin(time * 1.1) * 0.04 + Math.sin(time * 0.4 + 0.6) * 0.02,
	);
};

const applyAngryFace = (targets: FaceTargets) => {
	setFaceTarget(targets, "angry", 0.72);
	setFaceTarget(targets, "lookDown", 0.06);
	setFaceTarget(targets, "relaxed", 0.02);
};

const applyConfusedFace = (targets: FaceTargets, time: number) => {
	setFaceTarget(targets, "surprised", 0.18);
	setFaceTarget(targets, "relaxed", 0.12);
	applySideLook(targets, Math.sin(time * 0.55 + 0.4) * 0.05);
	setFaceTarget(targets, "lookDown", 0.04);
};

const applyEmpatheticFace = (targets: FaceTargets) => {
	setFaceTarget(targets, "sad", 0.1);
	setFaceTarget(targets, "relaxed", 0.28);
	setFaceTarget(targets, "lookDown", 0.06);
};

const applyThinkingOverlay = (targets: FaceTargets, time: number) => {
	setFaceTarget(targets, "relaxed", Math.max(targets.relaxed, 0.16));
	setFaceTarget(targets, "lookDown", Math.max(targets.lookDown, 0.12));
	applySideLook(targets, Math.sin(time * 0.42 + 0.2) * 0.035);
	setFaceTarget(targets, "surprised", Math.max(targets.surprised, 0.03));
};

const applyEmotionFace = (
	targets: FaceTargets,
	emotionState: EmotionState,
	bodyState: BodyState,
	time: number,
) => {
	resetExpressions(targets);

	switch (emotionState) {
		case "happy":
			applyHappyFace(targets);
			break;
		case "sad":
			applySadFace(targets);
			break;
		case "anxious":
			applyAnxiousFace(targets, time);
			break;
		case "angry":
			applyAngryFace(targets);
			break;
		case "confused":
			applyConfusedFace(targets, time);
			break;
		case "empathetic":
			applyEmpatheticFace(targets);
			break;
		default:
			applyNeutralFace(targets);
			break;
	}

	if (bodyState === "thinking") {
		applyThinkingOverlay(targets, time);
	}
};

const applyTalkingState = (targets: FaceTargets, speechEnergy: number) => {
	setFaceTarget(
		targets,
		"relaxed",
		Math.max(targets.relaxed, 0.08 + speechEnergy * 0.04),
	);
};

const getNextBlinkDelay = (
	emotionState: EmotionState,
	bodyState: BodyState,
	speechState: SpeechState,
) => {
	if (speechState === "talking") {
		return 1.8 + Math.random() * 1.4;
	}

	if (bodyState === "thinking") {
		return 1.4 + Math.random() * 1.4;
	}

	if (emotionState === "anxious") {
		return 1.2 + Math.random() * 1.1;
	}

	if (emotionState === "sad") {
		return 2.6 + Math.random() * 1.6;
	}

	if (emotionState === "confused") {
		return 1.5 + Math.random() * 1.2;
	}

	return 2.2 + Math.random() * 1.8;
};

const getBlinkAmount = (
	time: number,
	blinkWindow: { start: number; end: number; next: number },
	emotionState: EmotionState,
	bodyState: BodyState,
	speechState: SpeechState,
) => {
	if (time >= blinkWindow.next) {
		blinkWindow.start = time;
		blinkWindow.end = time + 0.12;
		blinkWindow.next =
			time + getNextBlinkDelay(emotionState, bodyState, speechState);
	}

	if (time < blinkWindow.start || time > blinkWindow.end) {
		return 0;
	}

	const progress =
		(time - blinkWindow.start) / (blinkWindow.end - blinkWindow.start);
	return Math.sin(progress * Math.PI);
};

const setBoneTarget = (
	targets: BodyPoseTargets,
	boneName: BodyBoneName,
	rotation: BoneRotationTargets,
) => {
	targets[boneName] = rotation;
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

const createBaseBodyPose = (time: number): BodyPoseTargets => {
	const torsoSway = Math.sin(time * 0.7) * 0.02;
	const torsoBreath = Math.sin(time * 1.2) * 0.014;

	const targets: BodyPoseTargets = {};

	setBoneTarget(targets, "hips", { y: torsoSway * 0.2 });
	setBoneTarget(targets, "spine", {
		x: 0.025 + torsoBreath * 0.28,
		y: torsoSway * 0.2,
	});
	setBoneTarget(targets, "chest", {
		x: 0.03 + torsoBreath * 0.38,
		y: torsoSway * 0.32,
	});
	setBoneTarget(targets, "neck", { x: -0.015, y: torsoSway * 0.28 });
	setBoneTarget(targets, "head", { x: 0.015, y: torsoSway * 0.34 });
	setBoneTarget(targets, "leftShoulder", { z: 0.09 });
	setBoneTarget(targets, "rightShoulder", { z: -0.09 });
	setBoneTarget(targets, "leftUpperArm", { x: 0.02, z: 0.72 });
	setBoneTarget(targets, "rightUpperArm", { x: -0.02, z: -0.72 });
	setBoneTarget(targets, "leftLowerArm", { z: 0.05 });
	setBoneTarget(targets, "rightLowerArm", { z: -0.05 });
	setBoneTarget(targets, "leftHand", { x: 0.03, z: 0.02 });
	setBoneTarget(targets, "rightHand", { x: -0.03, z: -0.02 });

	return targets;
};

const applyDancePoseOffsets = (
	targets: BodyPoseTargets,
	time: number,
	intensity: number,
) => {
	const rhythm = time * THREE.MathUtils.lerp(1.18, 1.42, intensity);
	const sway = Math.sin(rhythm);
	const counter = Math.sin(rhythm + Math.PI);
	const figureEight = Math.sin(rhythm * 2 + 0.35);
	const shoulderFlow = Math.sin(rhythm + Math.PI / 2);
	const armWave = Math.sin(rhythm + Math.PI / 4);
	const stepLeft = THREE.MathUtils.smoothstep(Math.sin(rhythm), 0, 0.92);
	const stepRight = THREE.MathUtils.smoothstep(
		Math.sin(rhythm + Math.PI),
		0,
		0.92,
	);

	offsetBoneTarget(targets, "hips", {
		y: sway * 0.16 * intensity,
		z: figureEight * 0.06 * intensity,
	});
	offsetBoneTarget(targets, "spine", {
		y: counter * 0.07 * intensity,
		z: -figureEight * 0.03 * intensity,
	});
	offsetBoneTarget(targets, "chest", {
		x: 0.02 * intensity,
		y: counter * 0.1 * intensity,
		z: shoulderFlow * 0.025 * intensity,
	});
	offsetBoneTarget(targets, "neck", { y: counter * 0.04 * intensity });
	offsetBoneTarget(targets, "head", {
		y: counter * 0.05 * intensity,
		z: shoulderFlow * 0.018 * intensity,
	});
	offsetBoneTarget(targets, "leftShoulder", {
		x: -0.025 * intensity,
		z: (-0.06 + shoulderFlow * 0.04) * intensity,
	});
	offsetBoneTarget(targets, "rightShoulder", {
		x: 0.025 * intensity,
		z: (0.06 - shoulderFlow * 0.04) * intensity,
	});
	offsetBoneTarget(targets, "leftUpperArm", {
		x: -0.16 * intensity,
		y: -0.1 * intensity,
		z: (-0.12 + armWave * 0.08) * intensity,
	});
	offsetBoneTarget(targets, "rightUpperArm", {
		x: 0.16 * intensity,
		y: 0.1 * intensity,
		z: (0.12 - armWave * 0.08) * intensity,
	});
	offsetBoneTarget(targets, "leftLowerArm", {
		x: -0.1 * intensity,
		z: (0.06 + armWave * 0.06) * intensity,
	});
	offsetBoneTarget(targets, "rightLowerArm", {
		x: 0.1 * intensity,
		z: (-0.06 - armWave * 0.06) * intensity,
	});
	offsetBoneTarget(targets, "leftHand", {
		x: (0.03 + armWave * 0.025) * intensity,
		y: -0.03 * intensity,
	});
	offsetBoneTarget(targets, "rightHand", {
		x: (-0.03 - armWave * 0.025) * intensity,
		y: 0.03 * intensity,
	});
	offsetBoneTarget(targets, "leftUpperLeg", {
		x: (stepLeft * 0.1 - stepRight * 0.035) * intensity,
		y: sway * 0.04 * intensity,
	});
	offsetBoneTarget(targets, "rightUpperLeg", {
		x: (stepRight * 0.1 - stepLeft * 0.035) * intensity,
		y: -sway * 0.04 * intensity,
	});
	offsetBoneTarget(targets, "leftLowerLeg", { x: stepLeft * 0.08 * intensity });
	offsetBoneTarget(targets, "rightLowerLeg", {
		x: stepRight * 0.08 * intensity,
	});
	offsetBoneTarget(targets, "leftFoot", {
		x: -stepLeft * 0.04 * intensity,
		z: stepLeft * 0.025 * intensity,
	});
	offsetBoneTarget(targets, "rightFoot", {
		x: -stepRight * 0.04 * intensity,
		z: -stepRight * 0.025 * intensity,
	});
};

const getBeatLift = (phase: number) =>
	THREE.MathUtils.smoothstep(
		(Math.sin(phase - Math.PI / 2) + 1) * 0.5,
		0.08,
		1,
	);

const applyHipHopDancePoseOffsets = (
	targets: BodyPoseTargets,
	time: number,
	intensity: number,
) => {
	const groove = time * THREE.MathUtils.lerp(1.75, 2.25, intensity);
	const bounce = getBeatLift(groove);
	const rebound = Math.sin(groove * 2 + 0.28);
	const lean = Math.sin(groove * 0.5 + 0.35);
	const twist = Math.sin(groove + Math.PI / 5);
	const headNod = Math.sin(groove * 2 + 0.15);
	const leftHit = getBeatLift(groove);
	const rightHit = getBeatLift(groove + Math.PI);
	const leftStep = THREE.MathUtils.smoothstep(Math.sin(groove), -0.08, 0.96);
	const rightStep = THREE.MathUtils.smoothstep(
		Math.sin(groove + Math.PI),
		-0.08,
		0.96,
	);
	const chestPop = rebound * 0.03 + bounce * 0.055;

	offsetBoneTarget(targets, "hips", {
		x: (-0.03 - bounce * 0.08) * intensity,
		y: lean * 0.18 * intensity,
		z: twist * 0.045 * intensity,
	});
	offsetBoneTarget(targets, "spine", {
		x: chestPop * 0.7 * intensity,
		y: -lean * 0.08 * intensity,
		z: -twist * 0.025 * intensity,
	});
	offsetBoneTarget(targets, "chest", {
		x: chestPop * intensity,
		y: -lean * 0.12 * intensity,
		z: rebound * 0.03 * intensity,
	});
	offsetBoneTarget(targets, "neck", {
		x: headNod * 0.012 * intensity,
		y: -lean * 0.05 * intensity,
	});
	offsetBoneTarget(targets, "head", {
		x: (-0.015 + headNod * 0.03) * intensity,
		y: -lean * 0.06 * intensity,
		z: twist * 0.015 * intensity,
	});
	offsetBoneTarget(targets, "leftShoulder", {
		x: (-0.03 - leftHit * 0.04) * intensity,
		y: (-0.03 * leftHit + 0.02 * rightHit) * intensity,
		z: (-0.04 + twist * 0.05) * intensity,
	});
	offsetBoneTarget(targets, "rightShoulder", {
		x: (0.03 + rightHit * 0.04) * intensity,
		y: (0.03 * rightHit - 0.02 * leftHit) * intensity,
		z: (0.04 - twist * 0.05) * intensity,
	});
	offsetBoneTarget(targets, "leftUpperArm", {
		x: (-0.18 - bounce * 0.08) * intensity,
		y: (-0.12 * leftHit + 0.04 * rightHit) * intensity,
		z: (-0.12 - twist * 0.1) * intensity,
	});
	offsetBoneTarget(targets, "rightUpperArm", {
		x: (0.18 + bounce * 0.08) * intensity,
		y: (0.12 * rightHit - 0.04 * leftHit) * intensity,
		z: (0.12 + twist * 0.1) * intensity,
	});
	offsetBoneTarget(targets, "leftLowerArm", {
		x: -0.14 * intensity,
		z: (0.08 + leftHit * 0.12 - rightHit * 0.05) * intensity,
	});
	offsetBoneTarget(targets, "rightLowerArm", {
		x: 0.14 * intensity,
		z: (-0.08 - rightHit * 0.12 + leftHit * 0.05) * intensity,
	});
	offsetBoneTarget(targets, "leftHand", {
		x: (0.04 + leftHit * 0.045) * intensity,
		y: -0.02 * intensity,
	});
	offsetBoneTarget(targets, "rightHand", {
		x: (-0.04 - rightHit * 0.045) * intensity,
		y: 0.02 * intensity,
	});
	offsetBoneTarget(targets, "leftUpperLeg", {
		x: (0.08 + leftStep * 0.1 - rightStep * 0.04) * intensity,
		y: lean * 0.04 * intensity,
	});
	offsetBoneTarget(targets, "rightUpperLeg", {
		x: (0.08 + rightStep * 0.1 - leftStep * 0.04) * intensity,
		y: -lean * 0.04 * intensity,
	});
	offsetBoneTarget(targets, "leftLowerLeg", {
		x: (0.08 + leftStep * 0.08 + bounce * 0.04) * intensity,
	});
	offsetBoneTarget(targets, "rightLowerLeg", {
		x: (0.08 + rightStep * 0.08 + bounce * 0.04) * intensity,
	});
	offsetBoneTarget(targets, "leftFoot", {
		x: (-0.04 + leftStep * 0.05) * intensity,
		z: leftStep * 0.03 * intensity,
	});
	offsetBoneTarget(targets, "rightFoot", {
		x: (-0.04 + rightStep * 0.05) * intensity,
		z: -rightStep * 0.03 * intensity,
	});
};

const getManualSceneMotion = (
	bodyState: BodyState,
	time: number,
	speechState: SpeechState,
	speechEnergy: number,
) => {
	const talkingBoost = speechState === "talking" ? 1 + speechEnergy * 0.5 : 1;

	switch (bodyState) {
		case "idleDance":
			return {
				rotationX:
					-0.004 +
					Math.sin(time * 3.5 - Math.PI / 2) * 0.004 +
					Math.sin(time * 1.75) * 0.002,
				rotationY: Math.PI + Math.sin(time * 0.95) * 0.065 * talkingBoost,
				rotationZ: Math.sin(time * 1.75 + 0.45) * 0.013,
				positionX: Math.sin(time * 0.95) * 0.034 + Math.sin(time * 1.9) * 0.006,
				positionYOffset:
					-0.006 +
					getBeatLift(time * 1.75) * 0.016 +
					Math.sin(time * 3.5 + 0.2) * 0.002,
				breathingScale: 0.015,
			};
		case "thinking":
			return {
				rotationX: -0.04 + Math.sin(time * 1.1) * 0.012,
				rotationY: Math.PI + 0.08 + Math.sin(time * 0.55) * 0.025,
				rotationZ: -0.035,
				positionX: -0.035,
				positionYOffset: 0,
				breathingScale: 0.01,
			};
		case "sadPose":
			return {
				rotationX: -0.05 + Math.sin(time * 0.75) * 0.006,
				rotationY: Math.PI + 0.02,
				rotationZ: 0.018,
				positionX: 0,
				positionYOffset: -0.012,
				breathingScale: 0.011,
			};
		case "listening":
			return {
				rotationX: Math.sin(time * 1.0) * 0.006,
				rotationY: Math.PI + Math.sin(time * 0.65) * 0.03,
				rotationZ: Math.sin(time * 0.8) * 0.006,
				positionX: 0,
				positionYOffset: 0,
				breathingScale: 0.014,
			};
		case "wave":
			return {
				rotationX: 0.006,
				rotationY: Math.PI - 0.06 + Math.sin(time * 1.6) * 0.025,
				rotationZ: -0.02,
				positionX: -0.015,
				positionYOffset: 0.006,
				breathingScale: 0.018,
			};
		case "celebration":
			return {
				rotationX: 0.02 + Math.sin(time * 3.2) * 0.01,
				rotationY: Math.PI + Math.sin(time * 2.1) * 0.05,
				rotationZ: Math.sin(time * 3.2) * 0.02,
				positionX: Math.sin(time * 1.6) * 0.012,
				positionYOffset: 0.018,
				breathingScale: 0.02,
			};
		case "dance":
			return {
				rotationX:
					-0.008 +
					Math.sin(time * 4.5 - Math.PI / 2) * 0.007 +
					Math.sin(time * 2.25) * 0.003,
				rotationY: Math.PI + Math.sin(time * 1.12) * 0.1,
				rotationZ: Math.sin(time * 2.25 + 0.45) * 0.02,
				positionX:
					Math.sin(time * 1.12) * 0.052 + Math.sin(time * 2.25) * 0.008,
				positionYOffset:
					-0.012 +
					getBeatLift(time * 2.25) * 0.026 +
					Math.sin(time * 4.5 + 0.2) * 0.004,
				breathingScale: 0.014,
			};
		default:
			return {
				rotationX: Math.sin(time * 1.0) * 0.006,
				rotationY: Math.PI + Math.sin(time * 0.95) * 0.028 * talkingBoost,
				rotationZ: Math.sin(time * 1.9) * 0.006,
				positionX: Math.sin(time * 0.95) * 0.014,
				positionYOffset: Math.sin(time * 1.9 + 0.4) * 0.004,
				breathingScale: 0.014,
			};
	}
};

const getManualBodyPoseTargets = (
	bodyState: BodyState,
	time: number,
	speechState: SpeechState,
	speechEnergy: number,
) => {
	const targets = createBaseBodyPose(time);
	const talking = speechState === "talking";
	const talkDrift = talking
		? Math.sin(time * 2.1) * (0.006 + speechEnergy * 0.015)
		: 0;
	const talkGesture = talking
		? Math.sin(time * 2.8) * (0.008 + speechEnergy * 0.014)
		: 0;

	switch (bodyState) {
		case "idleDance":
			applyDancePoseOffsets(targets, time, 0.14);
			applyHipHopDancePoseOffsets(targets, time, 0.58);
			break;
		case "thinking":
			offsetBoneTarget(targets, "chest", { x: -0.015, y: 0.03 });
			offsetBoneTarget(targets, "neck", { x: -0.05, y: 0.05 });
			offsetBoneTarget(targets, "head", { x: -0.06, y: 0.08, z: -0.05 });
			offsetBoneTarget(targets, "leftShoulder", { z: 0.03 });
			offsetBoneTarget(targets, "rightShoulder", { z: -0.015 });
			offsetBoneTarget(targets, "leftUpperArm", { z: -0.08 });
			offsetBoneTarget(targets, "rightUpperArm", { z: 0.05 });
			break;
		case "sadPose":
			offsetBoneTarget(targets, "spine", { x: -0.03 });
			offsetBoneTarget(targets, "chest", { x: -0.05 });
			offsetBoneTarget(targets, "neck", { x: -0.04 });
			offsetBoneTarget(targets, "head", { x: -0.05, z: 0.02 });
			offsetBoneTarget(targets, "leftShoulder", { z: 0.04 });
			offsetBoneTarget(targets, "rightShoulder", { z: -0.04 });
			offsetBoneTarget(targets, "leftUpperArm", { z: 0.05 });
			offsetBoneTarget(targets, "rightUpperArm", { z: -0.05 });
			break;
		case "listening":
			offsetBoneTarget(targets, "chest", { x: 0.01 });
			offsetBoneTarget(targets, "head", { y: Math.sin(time * 0.8) * 0.04 });
			break;
		case "wave": {
			const wave = Math.sin(time * 5.8);
			offsetBoneTarget(targets, "chest", { y: -0.04 });
			offsetBoneTarget(targets, "head", { y: -0.05, z: -0.03 });
			offsetBoneTarget(targets, "rightShoulder", {
				x: 0.2,
				y: 0.1,
				z: -0.12,
			});
			offsetBoneTarget(targets, "rightUpperArm", {
				x: 0.8,
				y: 0.14,
				z: 0.15,
			});
			offsetBoneTarget(targets, "rightLowerArm", {
				x: 0.1,
				z: wave * 0.45,
			});
			offsetBoneTarget(targets, "rightHand", {
				x: wave * 0.18,
				y: 0.08,
			});
			offsetBoneTarget(targets, "leftUpperArm", { z: -0.04 });
			break;
		}
		case "celebration": {
			const cheer = Math.sin(time * 4.2);
			offsetBoneTarget(targets, "chest", { x: 0.04, y: cheer * 0.03 });
			offsetBoneTarget(targets, "head", { y: cheer * 0.05 });
			offsetBoneTarget(targets, "leftUpperArm", {
				x: -1.0,
				y: -0.14,
				z: -0.2,
			});
			offsetBoneTarget(targets, "rightUpperArm", {
				x: 1.0,
				y: 0.14,
				z: 0.2,
			});
			offsetBoneTarget(targets, "leftLowerArm", { x: -0.28 });
			offsetBoneTarget(targets, "rightLowerArm", { x: 0.28 });
			break;
		}
		case "dance": {
			applyHipHopDancePoseOffsets(targets, time, 1);
			break;
		}
		default:
			break;
	}

	if (talking) {
		offsetBoneTarget(targets, "chest", { y: talkDrift * 0.8 });
		offsetBoneTarget(targets, "neck", { y: talkDrift * 1.1 });
		offsetBoneTarget(targets, "head", {
			x: talkDrift * 0.25,
			y: talkDrift * 0.9,
			z: talkDrift * 0.22,
		});
		offsetBoneTarget(targets, "leftLowerArm", { z: talkGesture });
		offsetBoneTarget(targets, "rightLowerArm", { z: -talkGesture });
		offsetBoneTarget(targets, "leftHand", { x: talkGesture * 0.35 });
		offsetBoneTarget(targets, "rightHand", { x: -talkGesture * 0.35 });
	}

	return targets;
};

const getHumanoidBone = (vrm: VRM, boneName: BodyBoneName) =>
	vrm.humanoid?.getNormalizedBoneNode?.(boneName) ??
	vrm.humanoid?.getRawBoneNode?.(boneName) ??
	null;

const bodyPoseEuler = new THREE.Euler(0, 0, 0, "XYZ");
const bodyPoseQuaternion = new THREE.Quaternion();
const getBlendAlpha = (delta: number, speed: number) =>
	1 - Math.exp(-speed * delta);
const getBodyPoseBlendSpeed = (
	bodyState: BodyState,
	boneName: BodyBoneName,
) => {
	const headOrNeck = boneName === "head" || boneName === "neck";

	switch (bodyState) {
		case "idleDance":
			return headOrNeck ? 5.8 : 4.1;
		case "dance":
			return headOrNeck ? 6.1 : 4.5;
		case "wave":
		case "celebration":
			return headOrNeck ? 7.2 : 5.8;
		default:
			return headOrNeck ? 6.4 : 4.8;
	}
};
const getSceneDamping = (bodyState: BodyState | null) => {
	switch (bodyState) {
		case "idleDance":
			return { rotation: 3.9, position: 3.4 };
		case "dance":
			return { rotation: 4.1, position: 3.6 };
		default:
			return { rotation: 4.8, position: 4.2 };
	}
};

const applyManualBodyPose = (
	bodyRig: BodyRig,
	bodyState: BodyState,
	speechState: SpeechState,
	time: number,
	speechEnergy: number,
	delta: number,
) => {
	const poseTargets = getManualBodyPoseTargets(
		bodyState,
		time,
		speechState,
		speechEnergy,
	);

	for (const boneName of BODY_BONE_NAMES) {
		const rig = bodyRig[boneName];
		if (!rig) continue;

		const targets = poseTargets[boneName];
		bodyPoseEuler.set(targets?.x ?? 0, targets?.y ?? 0, targets?.z ?? 0, "XYZ");
		rig.targetQuaternion
			.copy(rig.restQuaternion)
			.multiply(bodyPoseQuaternion.setFromEuler(bodyPoseEuler));
		rig.bone.quaternion.slerp(
			rig.targetQuaternion,
			getBlendAlpha(delta, getBodyPoseBlendSpeed(bodyState, boneName)),
		);
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

const RoomBlock = ({
	color,
	position,
	scale,
}: {
	color: string;
	position: [number, number, number];
	scale: [number, number, number];
}) => (
	<mesh castShadow receiveShadow position={position}>
		<boxGeometry args={scale} />
		<meshStandardMaterial color={color} flatShading roughness={0.74} />
	</mesh>
);

const RoomCrystal = ({
	color,
	position,
	scale = 1,
}: {
	color: string;
	position: [number, number, number];
	scale?: number;
}) => (
	<group position={position} scale={scale}>
		<mesh castShadow receiveShadow rotation={[0.2, 0.45, -0.08]}>
			<octahedronGeometry args={[0.22, 0]} />
			<meshStandardMaterial
				color={color}
				emissive={color}
				emissiveIntensity={0.12}
				flatShading
				roughness={0.42}
			/>
		</mesh>
	</group>
);

const StageRoom = () => (
	<group position={[0, -0.9, -0.08]}>
		<mesh receiveShadow position={[0, -0.07, -0.12]}>
			<cylinderGeometry args={[1.45, 1.6, 0.18, 56]} />
			<meshStandardMaterial color="#dbeafe" roughness={0.82} />
		</mesh>
		<mesh
			receiveShadow
			position={[0, 0.04, -0.1]}
			rotation={[-Math.PI / 2, 0, 0]}
		>
			<circleGeometry args={[1.18, 48]} />
			<meshStandardMaterial color="#f8fbff" roughness={0.76} />
		</mesh>

		<mesh receiveShadow position={[0, 0.7, -1.1]}>
			<boxGeometry args={[3.7, 2.05, 0.12]} />
			<meshStandardMaterial color="#a8dcff" roughness={0.78} />
		</mesh>
		<mesh receiveShadow position={[-1.88, 0.52, -0.3]} rotation={[0, 0.4, 0]}>
			<boxGeometry args={[0.1, 1.72, 1.82]} />
			<meshStandardMaterial color="#79c9ff" roughness={0.78} />
		</mesh>
		<mesh receiveShadow position={[1.88, 0.52, -0.3]} rotation={[0, -0.4, 0]}>
			<boxGeometry args={[0.1, 1.72, 1.82]} />
			<meshStandardMaterial color="#60a5fa" roughness={0.78} />
		</mesh>

		<mesh position={[0, 0.86, -1.18]}>
			<boxGeometry args={[1.18, 0.66, 0.04]} />
			<meshStandardMaterial
				color="#eaf7ff"
				emissive="#60a5fa"
				emissiveIntensity={0.14}
				roughness={0.46}
			/>
		</mesh>
		<mesh position={[0, 0.86, -1.14]}>
			<boxGeometry args={[1.32, 0.08, 0.08]} />
			<meshStandardMaterial color="#2563eb" roughness={0.52} />
		</mesh>
		<mesh position={[0, 0.48, -1.14]}>
			<boxGeometry args={[1.32, 0.08, 0.08]} />
			<meshStandardMaterial color="#2563eb" roughness={0.52} />
		</mesh>
		<mesh position={[-0.66, 0.67, -1.14]}>
			<boxGeometry args={[0.08, 0.46, 0.08]} />
			<meshStandardMaterial color="#2563eb" roughness={0.52} />
		</mesh>
		<mesh position={[0.66, 0.67, -1.14]}>
			<boxGeometry args={[0.08, 0.46, 0.08]} />
			<meshStandardMaterial color="#2563eb" roughness={0.52} />
		</mesh>

		<RoomBlock
			color="#2563eb"
			position={[-1.18, 0.05, -0.82]}
			scale={[0.38, 0.28, 0.38]}
		/>
		<RoomBlock
			color="#bfdbfe"
			position={[-1.48, 0.19, -0.68]}
			scale={[0.32, 0.32, 0.32]}
		/>
		<RoomBlock
			color="#60a5fa"
			position={[1.2, 0.05, -0.74]}
			scale={[0.42, 0.26, 0.36]}
		/>
		<RoomBlock
			color="#1d4ed8"
			position={[1.52, 0.27, -0.62]}
			scale={[0.28, 0.42, 0.28]}
		/>

		<RoomCrystal color="#f8fbff" position={[-1.28, 0.39, -0.48]} scale={1.08} />
		<RoomCrystal color="#7dd3fc" position={[1.28, 0.44, -0.42]} scale={0.92} />
		<RoomCrystal color="#3b82f6" position={[1.62, 0.64, -0.82]} scale={0.76} />

		<mesh castShadow position={[-1.22, 1.22, -0.92]}>
			<boxGeometry args={[0.7, 0.06, 0.18]} />
			<meshStandardMaterial color="#dbeafe" roughness={0.7} />
		</mesh>
		<mesh castShadow position={[-1.44, 1.34, -0.92]}>
			<boxGeometry args={[0.18, 0.18, 0.18]} />
			<meshStandardMaterial color="#2563eb" flatShading roughness={0.64} />
		</mesh>
		<mesh castShadow position={[-1.08, 1.34, -0.92]} rotation={[0.1, 0.35, 0]}>
			<tetrahedronGeometry args={[0.16, 0]} />
			<meshStandardMaterial color="#f8fbff" flatShading roughness={0.58} />
		</mesh>
	</group>
);

function VRMAvatar({
	emotionState,
	bodyState,
	reducedMotion,
	speechState,
	onStatusChange,
}: {
	emotionState: EmotionState;
	bodyState: BodyState;
	reducedMotion: boolean;
	speechState: SpeechState;
	onStatusChange: (status: AvatarCanvasStatus) => void;
}) {
	const [vrm, setVrm] = useState<VRM | null>(null);
	const bodyRigRef = useRef<BodyRig>({});
	const blinkWindowRef = useRef({
		start: 0,
		end: 0,
		next: 1.8,
	});
	const lipSyncStateRef = useRef<LipSyncState>({
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
		let disposed = false;
		onStatusChange("loading");
		const loader = new GLTFLoader();
		loader.register((parser) => new VRMLoaderPlugin(parser));

		loader.load(
			MODEL_PATH,
			(gltf) => {
				if (disposed) return;

				const loadedVrm = gltf.userData.vrm as VRM;
				if (!loadedVrm) return;

				loadedVrm.scene.traverse((child) => {
					if (child instanceof THREE.Mesh) {
						child.castShadow = true;
						child.receiveShadow = true;
					}
				});
				loadedVrm.scene.rotation.set(0, Math.PI, 0);
				loadedVrm.scene.position.set(0, BASE_POSITION_Y, 0);
				const bodyRig: BodyRig = {};

				for (const boneName of BODY_BONE_NAMES) {
					const bone = getHumanoidBone(loadedVrm, boneName);
					if (!bone) continue;

					bodyRig[boneName] = {
						bone,
						restQuaternion: bone.quaternion.clone(),
						targetQuaternion: bone.quaternion.clone(),
					};
				}

				bodyRigRef.current = bodyRig;
				onStatusChange("ready");
				setVrm(loadedVrm);
			},
			undefined,
			(error) => {
				console.error("Failed to load VRM:", error);
				if (!disposed) {
					onStatusChange("error");
				}
			},
		);

		return () => {
			disposed = true;
			bodyRigRef.current = {};
		};
	}, [onStatusChange]);

	useFrame(({ clock }, delta) => {
		if (!vrm) return;

		const time = clock.getElapsedTime();
		const expressiveTime = reducedMotion ? 0 : time;
		const effectiveSpeechState = reducedMotion ? "silent" : speechState;
		const lipSyncState = lipSyncStateRef.current;
		const mouthTargets = createMouthTargets();
		const faceTargets = createFaceTargets();
		const blink = getBlinkAmount(
			expressiveTime,
			blinkWindowRef.current,
			emotionState,
			bodyState,
			effectiveSpeechState,
		);
		let speechEnergy = 0;

		if (effectiveSpeechState === "talking") {
			if (!lipSyncState.active) {
				lipSyncState.active = true;
				lipSyncState.cadenceOffset = Math.random() * Math.PI * 2;
				lipSyncState.current = "aa";
				lipSyncState.previous = "aa";
				scheduleNextSpeechBeat(lipSyncState, time);
			}

			while (time >= lipSyncState.nextChangeAt) {
				scheduleNextSpeechBeat(lipSyncState, lipSyncState.nextChangeAt);
			}

			const syllableDuration = Math.max(
				lipSyncState.nextChangeAt - lipSyncState.startedAt,
				0.001,
			);
			const syllableProgress = THREE.MathUtils.clamp(
				(time - lipSyncState.startedAt) / syllableDuration,
				0,
				1,
			);
			const attack = THREE.MathUtils.smoothstep(syllableProgress, 0, 0.18);
			const release = 1 - THREE.MathUtils.smoothstep(syllableProgress, 0.68, 1);
			const carry =
				1 - THREE.MathUtils.smoothstep(syllableProgress, 0.08, 0.58);
			const phraseEnvelope = THREE.MathUtils.clamp(
				0.82 +
					Math.sin(time * 2.4 + lipSyncState.cadenceOffset) * 0.14 +
					Math.sin(time * 0.95 + lipSyncState.cadenceOffset * 0.35) * 0.08,
				0.55,
				1.1,
			);
			const syllableEnvelope =
				time < lipSyncState.pauseUntil ? 0 : attack * release;
			const speakingStrength =
				lipSyncState.peak * phraseEnvelope * syllableEnvelope;

			addVowelBlend(mouthTargets, lipSyncState.current, speakingStrength);
			addVowelBlend(
				mouthTargets,
				lipSyncState.previous,
				speakingStrength * 0.34 * carry,
			);

			const jawBed =
				0.035 +
				Math.sin(time * 9.5 + lipSyncState.cadenceOffset) * 0.012 +
				Math.sin(time * 15.5 + lipSyncState.cadenceOffset * 0.6) * 0.008;
			mouthTargets.aa += Math.max(0, jawBed) * speakingStrength * 0.45;

			speechEnergy = THREE.MathUtils.clamp(
				Math.max(...MOUTH_PRESETS.map((preset) => mouthTargets[preset])),
				0,
				1,
			);
		} else {
			lipSyncState.active = false;
			lipSyncState.pauseUntil = 0;
		}

		applyEmotionFace(faceTargets, emotionState, bodyState, expressiveTime);
		if (effectiveSpeechState === "talking") {
			applyTalkingState(faceTargets, speechEnergy);
		}

		const sceneMotion = getManualSceneMotion(
			bodyState,
			expressiveTime,
			effectiveSpeechState,
			reducedMotion ? 0 : speechEnergy,
		);
		const sceneDamping = getSceneDamping(bodyState);
		const breathing = Math.sin(expressiveTime * 1.6);
		const targetPositionY =
			BASE_POSITION_Y +
			sceneMotion.positionYOffset +
			breathing * sceneMotion.breathingScale;

		vrm.scene.rotation.x = THREE.MathUtils.damp(
			vrm.scene.rotation.x,
			sceneMotion.rotationX,
			sceneDamping.rotation,
			delta,
		);
		vrm.scene.rotation.y = THREE.MathUtils.damp(
			vrm.scene.rotation.y,
			sceneMotion.rotationY,
			sceneDamping.rotation,
			delta,
		);
		vrm.scene.rotation.z = THREE.MathUtils.damp(
			vrm.scene.rotation.z,
			sceneMotion.rotationZ,
			sceneDamping.rotation,
			delta,
		);
		vrm.scene.position.x = THREE.MathUtils.damp(
			vrm.scene.position.x,
			sceneMotion.positionX,
			sceneDamping.position,
			delta,
		);
		vrm.scene.position.y = THREE.MathUtils.damp(
			vrm.scene.position.y,
			targetPositionY,
			sceneDamping.position,
			delta,
		);
		applyManualBodyPose(
			bodyRigRef.current,
			bodyState,
			effectiveSpeechState,
			expressiveTime,
			reducedMotion ? 0 : speechEnergy,
			delta,
		);

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

	return <primitive object={vrm.scene} scale={AVATAR_MODEL_SCALE} />;
}

type AvatarCanvasProps = {
	emotionState: EmotionState;
	bodyState: BodyState;
	speechState: SpeechState;
	onStatusChange?: (status: AvatarCanvasStatus) => void;
	reducedMotion?: boolean;
};

const supportsWebGl = () => {
	try {
		const canvas = document.createElement("canvas");
		return Boolean(
			canvas.getContext("webgl") || canvas.getContext("experimental-webgl"),
		);
	} catch {
		return false;
	}
};

const AvatarFallback = ({
	status,
}: {
	status: Extract<AvatarCanvasStatus, "error" | "unsupported">;
}) => {
	const copy =
		status === "unsupported"
			? {
					title: "Live avatar unavailable",
					description:
						"Your browser cannot render the WebGL avatar here, but chat and saved history still work normally.",
				}
			: {
					title: "Avatar is in fallback mode",
					description:
						"The live model could not finish loading, so the conversation stays text-first until the next refresh.",
				};

	return (
		<div className="flex h-full min-h-[18rem] flex-col items-center justify-center rounded-[24px] border border-blue-200/80 bg-[linear-gradient(160deg,rgba(230,247,255,0.94),rgba(255,255,255,0.84))] px-6 py-8 text-center shadow-sm">
			<div className="flex size-12 items-center justify-center rounded-full bg-blue-100 text-blue-800 shadow-sm">
				<ShieldAlertIcon className="size-6" />
			</div>
			<h3 className="mt-4 font-medium text-base text-blue-950">{copy.title}</h3>
			<p className="mt-2 max-w-sm text-blue-900/80 text-sm leading-6">
				{copy.description}
			</p>
		</div>
	);
};

export default function AvatarCanvas({
	emotionState,
	bodyState,
	speechState,
	onStatusChange,
	reducedMotion = false,
}: AvatarCanvasProps) {
	const [status, setStatus] = useState<AvatarCanvasStatus>("loading");
	const [isWebGlSupported, setIsWebGlSupported] = useState<boolean | null>(
		null,
	);

	useEffect(() => {
		const supported = supportsWebGl();
		setIsWebGlSupported(supported);
		setStatus(supported ? "loading" : "unsupported");
	}, []);

	useEffect(() => {
		onStatusChange?.(status);
	}, [onStatusChange, status]);

	const canRenderAvatar = isWebGlSupported === true && status !== "error";
	const isLoading = canRenderAvatar && status === "loading";
	const showFallback = status === "error" || status === "unsupported";

	return (
		<div className="relative h-full min-h-[16rem] w-full overflow-hidden rounded-[24px] border border-white/60 bg-[linear-gradient(150deg,rgba(230,247,255,0.98)_0%,rgba(120,198,244,0.62)_48%,rgba(191,219,254,0.88)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]">
			<div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex justify-between gap-3">
				<div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/72 px-3 py-1.5 text-xs shadow-sm backdrop-blur-xl">
					{status === "ready" ? (
						<ShieldCheckIcon className="size-3.5 text-blue-700" />
					) : status === "loading" ? (
						<LoaderCircleIcon
							className={cn(
								"size-3.5 text-blue-700",
								!reducedMotion && "animate-spin",
							)}
						/>
					) : (
						<ShieldAlertIcon className="size-3.5 text-red-600" />
					)}
					<span className="font-medium">
						{status === "ready"
							? "Avatar live"
							: status === "loading"
								? "Loading avatar"
								: "Fallback mode"}
					</span>
				</div>
				<div className="hidden rounded-full border border-white/60 bg-white/62 px-3 py-1.5 text-muted-foreground text-xs shadow-sm backdrop-blur-xl sm:block">
					{speechState === "talking"
						? "Voice active"
						: bodyState === "thinking"
							? "Preparing a reply"
							: "Standing by"}
				</div>
			</div>

			{canRenderAvatar ? (
				<Canvas
					shadows
					camera={{ position: [-0.85, 1.05, 3.6], fov: 27 }}
					gl={{ preserveDrawingBuffer: true }}
				>
					<ambientLight intensity={0.82} />
					<hemisphereLight args={["#f8fbff", "#4d7fd8", 1.4]} />
					<directionalLight
						castShadow
						position={[2.2, 3.2, 2.4]}
						intensity={2.1}
						shadow-mapSize={[1024, 1024]}
					/>
					<pointLight
						position={[0, 1.15, -0.72]}
						color="#93c5fd"
						intensity={2.2}
					/>
					<StageRoom />
					<VRMAvatar
						emotionState={emotionState}
						bodyState={bodyState}
						reducedMotion={reducedMotion}
						speechState={speechState}
						onStatusChange={setStatus}
					/>
				</Canvas>
			) : null}

			{isLoading ? (
				<div className="pointer-events-none absolute inset-x-6 bottom-6 rounded-2xl border border-white/60 bg-white/72 px-4 py-3 shadow-sm backdrop-blur-xl">
					<div className="flex items-center gap-2 text-foreground text-sm">
						<LoaderCircleIcon
							className={cn(
								"size-4 text-blue-700",
								!reducedMotion && "animate-spin",
							)}
						/>
						<span className="font-medium">Warming up the avatar stage</span>
					</div>
					<p className="mt-1 text-muted-foreground text-xs leading-5">
						Chat is ready immediately. The live model will fade in as soon as
						the character rig finishes loading.
					</p>
				</div>
			) : null}

			{showFallback ? <AvatarFallback status={status} /> : null}
		</div>
	);
}
