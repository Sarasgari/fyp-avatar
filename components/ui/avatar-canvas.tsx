"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin } from "@pixiv/three-vrm";
import type { AvatarState } from "@/lib/avatar-state";

const MODEL_PATH = "/models/AjoMajo.vrm";
const BASE_POSITION_Y = -0.4;
const MOUTH_PRESETS = ["aa", "ee", "ih", "oh", "ou"] as const;

type MouthPreset = (typeof MOUTH_PRESETS)[number];

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

const VOWEL_TRANSITION_WEIGHTS: Record<MouthPreset, Record<MouthPreset, number>> = {
  aa: { aa: 0.14, ee: 1.02, ih: 1.12, oh: 0.94, ou: 0.76 },
  ee: { aa: 1.08, ee: 0.18, ih: 1.05, oh: 0.68, ou: 0.58 },
  ih: { aa: 1.02, ee: 0.96, ih: 0.18, oh: 0.76, ou: 0.7 },
  oh: { aa: 0.98, ee: 0.72, ih: 0.74, oh: 0.18, ou: 1.12 },
  ou: { aa: 0.92, ee: 0.6, ih: 0.78, oh: 1.16, ou: 0.2 },
};

// Blend each vowel into neighboring mouth shapes to mimic coarticulation.
const VOWEL_BLEND_MAP: Record<MouthPreset, Partial<Record<MouthPreset, number>>> = {
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

const getNextBlinkDelay = (state: AvatarState) => {
  switch (state) {
    case "thinking":
      return 1.4 + Math.random() * 1.4;
    case "speaking":
      return 1.8 + Math.random() * 1.6;
    default:
      return 2.4 + Math.random() * 2;
  }
};

const getBlinkAmount = (
  time: number,
  blinkWindow: { start: number; end: number; next: number },
  state: AvatarState,
) => {
  if (time >= blinkWindow.next) {
    blinkWindow.start = time;
    blinkWindow.end = time + 0.12;
    blinkWindow.next = time + getNextBlinkDelay(state);
  }

  if (time < blinkWindow.start || time > blinkWindow.end) {
    return 0;
  }

  const progress = (time - blinkWindow.start) / (blinkWindow.end - blinkWindow.start);
  return Math.sin(progress * Math.PI);
};

function VRMAvatar({ state }: { state: AvatarState }) {
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
    const blink = getBlinkAmount(time, blinkWindowRef.current, state);
    const speechState = speechStateRef.current;
    const mouthTargets = createMouthTargets();
    let speechEnergy = 0;

    if (state === "speaking") {
      if (!speechState.active) {
        speechState.active = true;
        speechState.cadenceOffset = Math.random() * Math.PI * 2;
        speechState.current = pickNextMouthPreset("aa");
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
      const release =
        1 - THREE.MathUtils.smoothstep(syllableProgress, 0.68, 1);
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

    const targetRotationY =
      state === "thinking"
        ? Math.PI + 0.16 + Math.sin(time * 0.65) * 0.04
        : state === "speaking"
          ? Math.PI +
            Math.sin(time * 1.35) * 0.02 +
            Math.sin(time * 4.8 + speechState.cadenceOffset) * 0.01 * speechEnergy
          : Math.PI + Math.sin(time * 0.9) * 0.08;

    const targetRotationX =
      state === "thinking"
        ? -0.08 + Math.sin(time * 1.15) * 0.015
        : state === "speaking"
          ? 0.015 +
            Math.sin(time * 3.6 + speechState.cadenceOffset) * 0.008 * speechEnergy
          : Math.sin(time * 1.1) * 0.01;

    const targetRotationZ =
      state === "thinking"
        ? -0.08
        : state === "speaking"
          ? Math.sin(time * 2.8 + speechState.cadenceOffset) * 0.006 * speechEnergy
          : 0;

    const targetPositionX =
      state === "thinking"
        ? -0.05
        : state === "speaking"
          ? Math.sin(time * 2.2 + speechState.cadenceOffset) * 0.01 * speechEnergy
          : 0;
    const targetPositionY =
      BASE_POSITION_Y +
      breathing * (state === "thinking" ? 0.01 : 0.018) +
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
    dampExpressionValue(
      vrm,
      "relaxed",
      state === "thinking" ? 0.18 : state === "speaking" ? 0.1 : 0.06,
      delta,
      10,
    );
    dampExpressionValue(vrm, "lookDown", state === "thinking" ? 0.22 : 0, delta);
    dampExpressionValue(vrm, "lookLeft", state === "thinking" ? 0.08 : 0, delta);

    vrm.update(delta);
  });

  if (!vrm) return null;

  return (
    <primitive
      object={vrm.scene}
      scale={1.1}
    />
  );
}

type AvatarCanvasProps = {
  state: AvatarState;
};

export default function AvatarCanvas({ state }: AvatarCanvasProps) {
  return (
    <div className="w-full h-[400px] md:h-[450px] overflow-hidden rounded-2xl  bg-muted/40">
      <Canvas camera={{ position: [-0.9, 1.2, 2.8], fov: 22 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[1, 1, 1]} intensity={1.5} />
        <VRMAvatar state={state} />
      </Canvas>
    </div>
  );
}
