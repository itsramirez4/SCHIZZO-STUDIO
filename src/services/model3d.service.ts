import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { hexToRgba } from '@/utils/colorUtils';
import { MannequinRig, RigState, PropKind, buildProp, kelvinToColor } from './mannequin.service';

export type CameraPreset = 'front' | 'side' | 'threeQuarter' | 'back' | 'top' | 'lowAngle';

interface BindPoseEntry {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
}

const CAMERA_PRESETS: Record<CameraPreset, [number, number, number]> = {
  front: [0, 1, 4],
  side: [4, 1, 0],
  threeQuarter: [3, 2, 5],
  back: [0, 1, -4],
  top: [0.001, 6, 0.001],
  lowAngle: [3, -0.2, 4],
};

export interface PropInstance {
  id: number;
  kind: PropKind;
  group: THREE.Group;
  dispose: () => void;
}

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
  private rimLight: THREE.DirectionalLight;
  /** Second light with its own kind: a lamp (point), a spotlight or a soft fill. */
  private lampLight: THREE.PointLight;
  private spotLight: THREE.SpotLight;
  private fillLight: THREE.DirectionalLight;
  private shadowCatcher: THREE.Mesh;
  private grid: THREE.GridHelper;
  private rig: MannequinRig | null = null;
  private props: PropInstance[] = [];
  private nextPropId = 1;
  /** Camera framing: `scale` grows the preset positions, `targetY` is the orbit pivot height. */
  private frame = { scale: 1, targetY: 0.5 };
  private clayMaterial: THREE.MeshStandardMaterial | null = null;
  private clay = false;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(3, 2, 5);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.directionalLight.position.set(5, 8, 5);
    this.directionalLight.castShadow = true;
    this.directionalLight.shadow.mapSize.set(1024, 1024);
    const sc = this.directionalLight.shadow.camera;
    sc.left = sc.bottom = -6;
    sc.right = sc.top = 6;
    sc.near = 0.5;
    sc.far = 30;
    this.directionalLight.shadow.bias = -0.0005;
    // Rim light: a weak backlight opposite the key light, off by default (intensity 0).
    this.rimLight = new THREE.DirectionalLight(0xffffff, 0);
    this.rimLight.position.set(-5, 5, -6);
    this.lampLight = new THREE.PointLight(0xffffff, 0, 0, 2);
    this.spotLight = new THREE.SpotLight(0xffffff, 0, 0, 0.45, 0.5, 2);
    this.spotLight.castShadow = true;
    this.spotLight.shadow.mapSize.set(1024, 1024);
    this.spotLight.target.position.set(0, 1, 0);
    this.fillLight = new THREE.DirectionalLight(0xffffff, 0);
    this.scene.add(this.ambientLight, this.directionalLight, this.rimLight, this.lampLight, this.spotLight, this.spotLight.target, this.fillLight);

    this.grid = new THREE.GridHelper(10, 10, 0x555555, 0x333333);
    this.scene.add(this.grid);

    // Transparent floor that only shows cast shadows, so a light/shadow study reads on the ground.
    this.shadowCatcher = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.4 }));
    this.shadowCatcher.rotation.x = -Math.PI / 2;
    this.shadowCatcher.position.y = 0.001;
    this.shadowCatcher.receiveShadow = true;
    this.scene.add(this.shadowCatcher);

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
   * file import like the rest of the app's importers). FBX (binary or ASCII, with skeleton and
   * embedded textures) goes through Three's FBXLoader; verified against a real skinned Mixamo
   * export. Animations inside the file are ignored — only the static/bind pose is shown. */
  async loadModel(url: string, format?: 'glb' | 'gltf' | 'obj' | 'fbx'): Promise<void> {
    let model: THREE.Object3D;

    if (format === 'obj') {
      const base64 = url.replace(/^data:[^;]+;base64,/, '');
      const text = decodeURIComponent(escape(atob(base64)));
      model = new OBJLoader().parse(text);
    } else if (format === 'fbx') {
      const bin = atob(url.replace(/^data:[^;]+;base64,/, ''));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      model = new FBXLoader().parse(bytes.buffer, '');
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

    model.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    this.setRigState(null); // an imported model replaces the built-in mannequin
    this.scene.add(model);
    this.currentModel = model;
    if (this.clay) this.applyClay();
    this.frame = { scale: 1, targetY: 0.5 };
    this.resetCamera();
    this.captureBindPose();
  }

  resetCamera() {
    this.setCameraPreset('threeQuarter');
  }

  setCameraPreset(preset: CameraPreset) {
    const [x, y, z] = CAMERA_PRESETS[preset];
    const { scale, targetY } = this.frame;
    this.camera.position.set(x * scale, y * scale + (targetY - 0.5 * scale), z * scale);
    this.controls.target.set(0, targetY, 0);
    this.controls.update();
  }

  /** Vertical field of view in degrees: a low FOV flattens perspective (telephoto), a high one exaggerates it. */
  setFov(deg: number) {
    this.camera.fov = deg;
    this.camera.updateProjectionMatrix();
  }

  hasModel(): boolean {
    return this.currentModel !== null || this.rig !== null || this.props.length > 0;
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

  /** Key-light colour from a Kelvin colour temperature (candle/tungsten ~2000-3200 K, daylight ~5600 K, shade 7000+ K). */
  setLightTemperature(kelvin: number) {
    this.directionalLight.color.copy(kelvinToColor(kelvin));
  }

  /** Backlight strength (0 disables it); its colour is shifted cool to contrast a warm key. */
  setRimLight(intensity: number, kelvin = 8000) {
    this.rimLight.intensity = intensity;
    this.rimLight.color.copy(kelvinToColor(kelvin));
  }

  /**
   * Second light source next to the sun: `kind` 'point' is a lamp (light falls off with distance),
   * 'spot' a focused spotlight aimed at the subject, 'fill' a soft shadowless light from the side.
   * Position is azimuth/elevation/distance around the subject; `intensity` 0 or 'off' switches it off.
   */
  setExtraLight(kind: 'off' | 'point' | 'spot' | 'fill', azimuthDeg: number, elevationDeg: number, distance: number, intensity: number, kelvin: number) {
    const az = (azimuthDeg * Math.PI) / 180;
    const el = (elevationDeg * Math.PI) / 180;
    const pos = new THREE.Vector3(distance * Math.cos(el) * Math.sin(az), distance * Math.sin(el) + 1, distance * Math.cos(el) * Math.cos(az));
    const color = kelvinToColor(kelvin);
    // Point and spot lights are physical (candela, inverse-square): scale the slider so 1 reads like the sun's 1.
    const candela = intensity * distance * distance * 1.6;
    this.lampLight.position.copy(pos);
    this.lampLight.color.copy(color);
    this.lampLight.intensity = kind === 'point' ? candela : 0;
    this.spotLight.position.copy(pos);
    this.spotLight.color.copy(color);
    this.spotLight.intensity = kind === 'spot' ? candela : 0;
    this.fillLight.position.copy(pos);
    this.fillLight.color.copy(color);
    this.fillLight.intensity = kind === 'fill' ? intensity : 0;
  }

  setShadowsVisible(visible: boolean) {
    this.directionalLight.castShadow = visible;
    this.spotLight.castShadow = visible;
    this.shadowCatcher.visible = visible;
  }

  /** "Live model": the camera slowly orbits the subject while you draw. */
  setAutoRotate(enabled: boolean, speed = 2) {
    this.controls.autoRotate = enabled;
    this.controls.autoRotateSpeed = speed;
  }

  setGridVisible(visible: boolean) {
    this.grid.visible = visible;
  }

  /** "Clay" view: every subject surface becomes one neutral grey, so only light and shadow
   * (values) remain. Done per mesh rather than with `scene.overrideMaterial`, which would also
   * replace the transparent shadow-catcher floor with an opaque grey plane. */
  setClayMode(enabled: boolean) {
    this.clay = enabled;
    this.applyClay();
  }

  private applyClay() {
    this.clayMaterial ??= new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.9 });
    const roots: THREE.Object3D[] = [];
    if (this.rig) roots.push(this.rig.root);
    if (this.currentModel) roots.push(this.currentModel);
    this.props.forEach((p) => roots.push(p.group));
    for (const root of roots) {
      root.traverse((child) => {
        const m = child as THREE.Mesh;
        if (!m.isMesh || m.material instanceof THREE.MeshBasicMaterial) return; // joint highlight markers stay as they are
        if (this.clay) {
          if (!m.userData.origMaterial) m.userData.origMaterial = m.material;
          m.material = this.clayMaterial!;
        } else if (m.userData.origMaterial) {
          m.material = m.userData.origMaterial;
          delete m.userData.origMaterial;
        }
      });
    }
  }

  // ---- mannequin & props

  getRig(): MannequinRig | null {
    return this.rig;
  }

  /** Shows (or rebuilds) the articulated mannequin. Passing null removes it. */
  setRigState(state: RigState | null) {
    if (!state) {
      if (this.rig) {
        this.scene.remove(this.rig.root);
        this.rig.dispose();
        this.rig = null;
      }
      return;
    }
    const isNew = !this.rig;
    const kindChanged = this.rig !== null && this.rig.state.kind !== state.kind;
    if (this.rig) {
      this.rig.rebuild(state);
    } else {
      this.rig = new MannequinRig(state);
      this.scene.add(this.rig.root);
    }
    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      disposeObject(this.currentModel);
      this.currentModel = null;
      this.bindPose.clear();
    }
    if (isNew || kindChanged) this.frameHeight(this.rig.height);
    if (this.clay) this.applyClay();
  }

  /** Re-aims the orbit camera at a subject of the given height (metres). */
  frameHeight(height: number) {
    this.frame = { scale: Math.max(0.15, height / 2.5), targetY: height * 0.5 };
    this.setCameraPreset('threeQuarter');
  }

  addProp(kind: PropKind): PropInstance {
    const built = buildProp(kind);
    const prop: PropInstance = { id: this.nextPropId++, kind, group: built.group, dispose: built.dispose };
    // Fan new props out along X so consecutive additions don't spawn inside each other.
    const n = this.props.length;
    prop.group.position.x = (n % 2 === 0 ? 1 : -1) * (Math.floor(n / 2) + 1) * 1.6;
    this.props.push(prop);
    this.scene.add(prop.group);
    if (this.clay) this.applyClay();
    return prop;
  }

  updateProp(id: number, patch: { x?: number; z?: number; rotY?: number; scale?: number }) {
    const p = this.props.find((q) => q.id === id);
    if (!p) return;
    if (patch.x !== undefined) p.group.position.x = patch.x;
    if (patch.z !== undefined) p.group.position.z = patch.z;
    if (patch.rotY !== undefined) p.group.rotation.y = (patch.rotY * Math.PI) / 180;
    if (patch.scale !== undefined) p.group.scale.setScalar(patch.scale);
  }

  removeProp(id: number) {
    const i = this.props.findIndex((q) => q.id === id);
    if (i < 0) return;
    const [p] = this.props.splice(i, 1);
    this.scene.remove(p.group);
    p.dispose();
  }

  getProps(): PropInstance[] {
    return this.props;
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
    // The floor shadow and the grid would count as foreground in the alpha channel — hide them
    // for this render so only the subject remains.
    const catcherWas = this.shadowCatcher.visible;
    const gridWas = this.grid.visible;
    this.shadowCatcher.visible = false;
    this.grid.visible = false;
    this.renderer.render(this.scene, this.camera);
    this.shadowCatcher.visible = catcherWas;
    this.grid.visible = gridWas;
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
    this.setRigState(null);
    [...this.props].forEach((p) => this.removeProp(p.id));
    this.clayMaterial?.dispose();
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
