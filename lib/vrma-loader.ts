import type { VRM } from "@pixiv/three-vrm";
import type * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type VRMAnimationModule = {
	VRMAnimationLoaderPlugin: new (parser: unknown) => unknown;
	VRMLookAtQuaternionProxy?: new (lookAt: unknown) => THREE.Object3D;
	createVRMAnimationClip: (
		vrmAnimation: unknown,
		vrm: VRM,
	) => THREE.AnimationClip;
};

const LOOK_AT_PROXY_NAME = "vrma-look-at-proxy";
const warningLog = new Set<string>();
const vrmaAnimationCache = new Map<string, Promise<unknown | null>>();
let vrmaModulePromise: Promise<VRMAnimationModule | null> | null = null;

const dynamicImport = new Function(
	"specifier",
	"return import(specifier);",
) as (specifier: string) => Promise<VRMAnimationModule>;

const warnOnce = (message: string, error?: unknown) => {
	if (warningLog.has(message)) {
		return;
	}

	warningLog.add(message);
	console.warn(message, error);
};

const loadVRMAnimationModule = async () => {
	if (!vrmaModulePromise) {
		vrmaModulePromise = dynamicImport("@pixiv/three-vrm-animation").catch(
			(error) => {
				warnOnce(
					"VRMA support is unavailable. Install @pixiv/three-vrm-animation to enable .vrma playback.",
					error,
				);
				return null;
			},
		);
	}

	return vrmaModulePromise;
};

const ensureLookAtProxy = (vrm: VRM, module: VRMAnimationModule) => {
	if (!vrm.lookAt || !module.VRMLookAtQuaternionProxy) {
		return;
	}

	if (vrm.scene.getObjectByName(LOOK_AT_PROXY_NAME)) {
		return;
	}

	const proxy = new module.VRMLookAtQuaternionProxy(vrm.lookAt);
	proxy.name = LOOK_AT_PROXY_NAME;
	vrm.scene.add(proxy);
};

const loadVRMAnimationAsset = async (
	path: string,
	module: VRMAnimationModule,
) => {
	const cached = vrmaAnimationCache.get(path);
	if (cached) {
		return cached;
	}

	const loader = new GLTFLoader();
	loader.register(
		(parser) => new module.VRMAnimationLoaderPlugin(parser) as never,
	);

	const assetPromise = loader
		.loadAsync(path)
		.then((gltf) => gltf.userData?.vrmAnimations?.[0] ?? null)
		.catch((error) => {
			warnOnce(`VRMA file could not be loaded from ${path}.`, error);
			return null;
		});

	vrmaAnimationCache.set(path, assetPromise);
	return assetPromise;
};

export const loadVRMAnimationClip = async (path: string, vrm: VRM) => {
	const module = await loadVRMAnimationModule();
	if (!module) {
		return null;
	}

	ensureLookAtProxy(vrm, module);

	const vrmAnimation = await loadVRMAnimationAsset(path, module);
	if (!vrmAnimation) {
		return null;
	}

	try {
		return module.createVRMAnimationClip(vrmAnimation, vrm);
	} catch (error) {
		warnOnce(`VRMA clip creation failed for ${path}.`, error);
		return null;
	}
};
