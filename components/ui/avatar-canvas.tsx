"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin } from "@pixiv/three-vrm";

function VRMAvatar() {
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
    vrm?.update(delta);
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

export default function AvatarCanvas() {
  return (
    <div className="w-full h-[400px] md:h-[450px] overflow-hidden rounded-2xl  bg-muted/40">
      <Canvas camera={{ position: [-0.9, 1.2, 2.8], fov: 22 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[1, 1, 1]} intensity={1.5} />
        <VRMAvatar />
      </Canvas>
    </div>
  );
}