"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin } from "@pixiv/three-vrm";

function VRMAvatar({ state }: { state: "idle" | "thinking" | "talking" }) {
  const [vrm, setVrm] = useState<VRM | null>(null);

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    loader.load(
      "/models/AjoMajo.vrm",
      (gltf) => {
        const loadedVrm = gltf.userData.vrm as VRM;
        if (!loadedVrm) return;

        // Optional cleanup / orientation fix
        loadedVrm.scene.rotation.y = Math.PI;
        setVrm(loadedVrm);
      },
      undefined,
      (error) => {
        console.error("Failed to load VRM:", error);
      }
    );
  }, []);

  useFrame((_, delta) => {
  if (!vrm) return;

  vrm.update(delta);

  if (state === "idle") {
    vrm.scene.rotation.y = Math.PI + Math.sin(Date.now() * 0.002) * 0.08;
  }

  if (state === "thinking") {
    vrm.scene.rotation.y = Math.PI + Math.sin(Date.now() * 0.002) * 0.08;
  }

  if (state === "talking") {
    vrm.scene.rotation.y = Math.PI;
    const mouthValue = (Math.sin(Date.now() * 0.02) + 1) / 2;
    vrm.expressionManager?.setValue("aa", mouthValue * 0.8);
  } else {
    vrm.expressionManager?.setValue("aa", 0);
  }
});

  if (!vrm) return null;

   return (
    <primitive
      object={vrm.scene}
      position={[0, -0.4, 0]}
      scale={1.1}
    />
  );
}

type AvatarCanvasProps = {
  state: "idle" | "thinking" | "talking";
};

export default function AvatarCanvas({ state }: AvatarCanvasProps) {
  return (
    <div className="w-full h-[400px] md:h-[450px] overflow-hidden rounded-2xl  bg-muted/40">
      <Canvas camera={{ position: [-0.9, 1.2, 2.8], fov: 22 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[1, 1, 1]} intensity={1.5} />
        <VRMAvatar state={state}/>
      </Canvas>
    </div>
  );
}