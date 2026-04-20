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
type SpeakingEmotion = "happy" | "surprised" | "excited" | null;

type SpeechState = {
  active: boolean;
  current: MouthPreset;
  previous: MouthPreset;
  startedAt: number;
  nextChangeAt: number;
  pauseUntil: number;
  peak: number;
  cadenceOffset: number;
  emotion: SpeakingEmotion;
  emotionStartsAt: number;
  emotionEndsAt: number;
  emotionCooldownUntil: number;
  emotionIntensity: number;
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

const pickRandomEmotion = (): Exclude<SpeakingEmotion, null> => {
  const roll = Math.random();

  if (roll < 0.38) return "happy";
  if (roll < 0.68) return "surprised";
  return "excited";
};

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

const updateSpeakingEmotion = (speechState: SpeechState, time: number) => {
  if (speechState.emotion && time >= speechState.emotionEndsAt) {
    speechState.emotion = null;
    speechState.emotionIntensity = 0;
    speechState.emotionCooldownUntil = time + randomBetween(0.35, 0.95);
  }

  if (!speechState.emotion && time >= speechState.emotionCooldownUntil && Math.random() < 0.04) {
    speechState.emotion = pickRandomEmotion();
    speechState.emotionStartsAt = time;
    speechState.emotionEndsAt = time + randomBetween(0.45, 1.15);
    speechState.emotionIntensity = randomBetween(0.45, 0.92);
  }
};

const getEmotionEnvelope = (speechState: SpeechState, time: number) => {
  if (!speechState.emotion) return 0;

  const duration = Math.max(speechState.emotionEndsAt - speechState.emotionStartsAt, 0.001);
  const progress = THREE.MathUtils.clamp(
    (time - speechState.emotionStartsAt) / duration,
    0,
    1,
  );
  const attack = THREE.MathUtils.smoothstep(progress, 0, 0.22);
  const release = 1 - THREE.MathUtils.smoothstep(progress, 0.7, 1);

  return speechState.emotionIntensity * attack * release;
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
    case "talking":
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
    emotion: null,
    emotionStartsAt: 0,
    emotionEndsAt: 0,
    emotionCooldownUntil: 0,
    emotionIntensity: 0,
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
    let emotionEnergy = 0;

    if (state === "talking") {
      if (!speechState.active) {
        speechState.active = true;
        speechState.cadenceOffset = Math.random() * Math.PI * 2;
        speechState.current = "aa";
        speechState.previous = "aa";
        speechState.emotion = null;
        speechState.emotionEndsAt = 0;
        speechState.emotionCooldownUntil = time + randomBetween(0.2, 0.6);
        scheduleNextSpeechBeat(speechState, time);
      }

      while (time >= speechState.nextChangeAt) {
        scheduleNextSpeechBeat(speechState, speechState.nextChangeAt);
      }

      updateSpeakingEmotion(speechState, time);
      emotionEnergy = getEmotionEnvelope(speechState, time);

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

      if (speechState.emotion === "surprised") {
        mouthTargets.oh += emotionEnergy * 0.34;
        mouthTargets.aa += emotionEnergy * 0.16;
      }

      if (speechState.emotion === "excited") {
        mouthTargets.aa += emotionEnergy * 0.12;
        mouthTargets.oh += emotionEnergy * 0.18;
        mouthTargets.ee += emotionEnergy * 0.1;
      }

      speechEnergy = THREE.MathUtils.clamp(
        Math.max(...MOUTH_PRESETS.map((preset) => mouthTargets[preset])),
        0,
        1,
      );
    } else {
      speechState.active = false;
      speechState.pauseUntil = 0;
      speechState.emotion = null;
      speechState.emotionIntensity = 0;
    }

    const targetRotationY =
      state === "thinking"
        ? Math.PI + 0.16 + Math.sin(time * 0.65) * 0.04
        : state === "talking"
          ? Math.PI +
            Math.sin(time * 1.35) * 0.02 +
            Math.sin(time * 4.8 + speechState.cadenceOffset) * 0.01 * speechEnergy +
            (speechState.emotion === "excited" ? Math.sin(time * 6.8) * 0.018 * emotionEnergy : 0)
          : Math.PI + Math.sin(time * 0.9) * 0.08;

    const targetRotationX =
      state === "thinking"
        ? -0.08 + Math.sin(time * 1.15) * 0.015
        : state === "talking"
          ? 0.015 +
            Math.sin(time * 3.6 + speechState.cadenceOffset) * 0.008 * speechEnergy +
            (speechState.emotion === "surprised" ? -0.04 * emotionEnergy : 0) +
            (speechState.emotion === "excited" ? Math.sin(time * 7.5) * 0.012 * emotionEnergy : 0)
          : Math.sin(time * 1.1) * 0.01;

    const targetRotationZ =
      state === "thinking"
        ? -0.08
        : state === "talking"
          ? Math.sin(time * 2.8 + speechState.cadenceOffset) * 0.006 * speechEnergy +
            (speechState.emotion === "happy" ? -0.025 * emotionEnergy : 0) +
            (speechState.emotion === "excited" ? Math.sin(time * 5.4) * 0.014 * emotionEnergy : 0)
          : 0;

    const targetPositionX =
      state === "thinking"
        ? -0.05
        : state === "talking"
          ? Math.sin(time * 2.2 + speechState.cadenceOffset) * 0.01 * speechEnergy +
            (speechState.emotion === "happy" ? -0.018 * emotionEnergy : 0)
          : 0;
    const targetPositionY =
      BASE_POSITION_Y +
      breathing * (state === "thinking" ? 0.01 : 0.018) +
      speechEnergy * 0.01 +
      (speechState.emotion === "excited" ? Math.sin(time * 8.2) * 0.012 * emotionEnergy : 0) +
      (speechState.emotion === "surprised" ? 0.012 * emotionEnergy : 0);

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
      state === "thinking" ? 0.18 : state === "talking" ? 0.1 : 0.06,
      delta,
      10,
    );
    dampExpressionValue(
      vrm,
      "happy",
      state === "talking"
        ? speechState.emotion === "happy"
          ? emotionEnergy * 0.85
          : speechState.emotion === "excited"
            ? emotionEnergy * 0.6
            : 0
        : 0,
      delta,
      11,
    );
    dampExpressionValue(
      vrm,
      "surprised",
      state === "talking"
        ? speechState.emotion === "surprised"
          ? emotionEnergy * 0.95
          : speechState.emotion === "excited"
            ? emotionEnergy * 0.45
            : 0
        : 0,
      delta,
      12,
    );
    dampExpressionValue(
      vrm,
      "lookUp",
      state === "talking"
        ? speechState.emotion === "surprised"
          ? emotionEnergy * 0.3
          : speechState.emotion === "excited"
            ? emotionEnergy * 0.18
            : 0
        : 0,
      delta,
      9,
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
