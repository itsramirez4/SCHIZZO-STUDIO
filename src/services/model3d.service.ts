import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { hexToRgba } from '@/utils/colorUtils';

export type CameraPreset = 'front' | 'side' | 'threeQuarter';

interface BindPoseEntry {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

const CAMERA_PRESETS: Record<CameraPreset, [number, number, number]> = {
  front: [0, 1, 4],
  side: [4, 1, 0],
  threeQuarter: [3, 2, 5],
};

export class Model3DViewerEngine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  private currentModel: THREE.Object3D | null = null;
  private frameId: number | null = null;
  private ambientLight: THREE.AmbientLight;
  private directionalLight: THREE.DirectionalLight;
  private bindPose = new Map<THREE.Bone, BindPoseEntry>();

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(3, 2, 5);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.directionalLight.position.set(5, 8, 5);
    this.scene.add(this.ambientLight, this.directionalLight);

    const grid = new THREE.GridHelper(10, 10, 0x555555, 0x333333);
    this.scene.add(grid);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.target.set(0, 0.5, 0);

    this.animate = this.animate.bind(this);
    this.animate();
  }

  private animate() {
    this.frameId = requestAnimationFrame(this.animate);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  setSize(width: number, height: number) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  /** OBJ import uses Three's own OBJLoader (geometry only — no .mtl companion-file support,
   * which would need a second file picked alongside the .obj; left out to keep this a single-
   * file import like the rest of the app's importers). FBX is deliberately NOT offered: Three
   * ships an FBXLoader, but without a real FBX fixture to run it against I can't verify it
   * actually works end-to-end — same reasoning as skipping ABR/ASE/CLIP earlier this session. */
  async loadModel(url: string, format?: 'glb' | 'gltf' | 'obj'): Promise<void> {
    let model: THREE.Object3D;

    if (format === 'obj') {
      const base64 = url.replace(/^data:[^;]+;base64,/, '');
      const text = decodeURIComponent(escape(atob(base64)));
      model = new OBJLoader().parse(text);
    } else {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(url);
      model = gltf.scene;
    }

    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      disposeObject(this.currentModel);
    }

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 0.001);
    const scale = 2.5 / maxDim;
    model.scale.setScalar(scale);
    model.position.sub(center.multiplyScalar(scale));

    this.scene.add(model);
    this.currentModel = model;
    this.resetCamera();
    this.captureBindPose();
  }

  resetCamera() {
    this.camera.position.set(3, 2, 5);
    this.controls.target.set(0, 0.5, 0);
    this.controls.update();
  }

  setCameraPreset(preset: CameraPreset) {
    const [x, y, z] = CAMERA_PRESETS[preset];
    this.camera.position.set(x, y, z);
    this.controls.target.set(0, 0.5, 0);
    this.controls.update();
  }

  hasModel(): boolean {
    return this.currentModel !== null;
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** Azimuth/elevation in degrees, on a fixed-radius sphere around the model — an intuitive
   * "sun direction" control for lighting a pose reference, rather than raw xyz coordinates. */
  setLighting(azimuthDeg: number, elevationDeg: number, intensity: number, ambientIntensity: number) {
    const az = (azimuthDeg * Math.PI) / 180;
    const el = (elevationDeg * Math.PI) / 180;
    const radius = 10;
    this.directionalLight.position.set(radius * Math.cos(el) * Math.sin(az), radius * Math.sin(el), radius * Math.cos(el) * Math.cos(az));
    this.directionalLight.intensity = intensity;
    this.ambientLight.intensity = ambientIntensity;
  }

  setWireframe(enabled: boolean) {
    if (!this.currentModel) return;
    this.currentModel.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((m) => {
        if (m && 'wireframe' in m) (m as THREE.MeshStandardMaterial).wireframe = enabled;
      });
    });
  }

  /** Flattened bone list (with depth, for indentation) from the first SkinnedMesh found —
   * operates on Three's own THREE.Bone objects directly rather than a parallel bone type,
   * so mutating `.rotation` here is exactly what a real skinned render already respects. */
  getBoneList(): { bone: THREE.Bone; depth: number }[] {
    const mesh = this.getSkinnedMeshes()[0];
    if (!mesh) return [];
    const bones = mesh.skeleton.bones;
    const boneSet = new Set(bones);
    return bones.map((bone) => {
      let depth = 0;
      let p: THREE.Object3D | null = bone.parent;
      while (p && boneSet.has(p as THREE.Bone)) {
        depth++;
        p = p.parent;
      }
      return { bone, depth };
    });
  }

  getSkinnedMeshes(): THREE.SkinnedMesh[] {
    const meshes: THREE.SkinnedMesh[] = [];
    this.currentModel?.traverse((child) => {
      if ((child as THREE.SkinnedMesh).isSkinnedMesh) meshes.push(child as THREE.SkinnedMesh);
    });
    return meshes;
  }

  hasSkeleton(): boolean {
    return this.getSkinnedMeshes().length > 0;
  }

  private captureBindPose() {
    this.bindPose.clear();
    for (const { bone } of this.getBoneList()) {
      this.bindPose.set(bone, { position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone() });
    }
  }

  resetPose() {
    this.bindPose.forEach((t, bone) => {
      bone.position.copy(t.position);
      bone.quaternion.copy(t.quaternion);
      bone.scale.copy(t.scale);
    });
  }

  /** Renders the current view's alpha channel as a flat silhouette (feathered via a canvas
   * blur filter on the alpha-masked result) — reuses the same renderer canvas the viewer
   * already draws to (preserveDrawingBuffer: true), no separate offscreen render pass needed. */
  renderSilhouette(color: string, featherPx: number): HTMLCanvasElement {
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;

    const out = document.createElement('canvas');
    out.width = src.width;
    out.height = src.height;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(src, 0, 0);

    const imageData = ctx.getImageData(0, 0, out.width, out.height);
    const data = imageData.data;
    const rgb = hexToRgba(color);
    for (let i = 0; i < data.length; i += 4) {
      const isForeground = data[i + 3] > 20;
      data[i] = rgb.r;
      data[i + 1] = rgb.g;
      data[i + 2] = rgb.b;
      data[i + 3] = isForeground ? 255 : 0;
    }
    ctx.putImageData(imageData, 0, 0);

    if (featherPx <= 0) return out;

    const blurred = document.createElement('canvas');
    blurred.width = out.width;
    blurred.height = out.height;
    const bctx = blurred.getContext('2d')!;
    bctx.filter = `blur(${featherPx}px)`;
    bctx.drawImage(out, 0, 0);
    return blurred;
  }

  dispose() {
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    if (this.currentModel) disposeObject(this.currentModel);
    this.controls.dispose();
    this.renderer.dispose();
  }
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry?.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((m) => m?.dispose());
    }
  });
}
