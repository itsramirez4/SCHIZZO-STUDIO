import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class Model3DViewerEngine {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  private currentModel: THREE.Object3D | null = null;
  private frameId: number | null = null;

  constructor(canvas: HTMLCanvasElement, width: number, height: number) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));

    this.scene = new THREE.Scene();
    this.scene.background = null;

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.camera.position.set(3, 2, 5);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const directional = new THREE.DirectionalLight(0xffffff, 1.2);
    directional.position.set(5, 8, 5);
    this.scene.add(ambient, directional);

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

  async loadModel(url: string): Promise<void> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(url);

    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      disposeObject(this.currentModel);
    }

    const model = gltf.scene;
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
  }

  resetCamera() {
    this.camera.position.set(3, 2, 5);
    this.controls.target.set(0, 0.5, 0);
    this.controls.update();
  }

  hasModel(): boolean {
    return this.currentModel !== null;
  }

  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
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
