import { Engine, Scene, ArcRotateCamera, HemisphericLight, Vector3, MeshBuilder, SceneLoader, Color3, Color4, Mesh, StandardMaterial, GlowLayer, SpotLight, AbstractMesh, TransformNode } from "@babylonjs/core";
import "@babylonjs/loaders"; // Import side effects for GLTF loader
import { GridMaterial } from "@babylonjs/materials";

import { AvatarController } from "./avatarController";
import { startRealtime, setRealtimeDebug, setRealtimeMode } from "./realtimeClient";
import { initMemoryUI, clearMemory } from "./memory";
import { getRuntimeConfig } from "./config";
import type { RuntimeConfig } from "./config";
import { THEME_PRESETS } from "./themes";

// Define a global interface for the Puppet API
declare global {
    interface Window {
        puppet: {
            performAction: (action: string) => void;
            setMaterialColor: (meshName: string, hexColor: string) => void;
            setMaterialStyle?: (meshName: string, params: { hex?: string; metallic?: number; roughness?: number; emissiveHex?: string; alpha?: number; backface?: boolean }) => void;
            setBoneRotation: (boneName: string, rotation: { x: number, y: number, z: number }) => void;
            stopAll: () => void;
            lookAt?: (target: {x:number,y:number,z:number}, boneHint?: string) => void;
            forceTPose?: () => void;
            rotateBoneTo?: (boneName: string, rotation: { x: number, y: number, z: number }, opts?: { durationMs?: number, speedDegPerSec?: number, easing?: "linear" | "easeInOut" }) => void;
            moveRootTo?: (target: { x: number, y: number, z: number }, speedMetersPerSec?: number) => void;
            stopTweens?: () => void;
            setLips?: (shape: { open?: number; wide?: number; round?: number }) => void;
            setLipsVisible?: (visible: boolean) => void;
            setTheme?: (theme: Partial<{
                backgroundHex: string;
                fogHex: string;
                fogDensity: number;
                gridMainHex: string;
                gridLineHex: string;
                gridOpacity: number;
                floorHex: string;
                floorSpecularHex: string;
                glowIntensity: number;
                spotLight1Hex: string;
                spotLight2Hex: string;
                spotLight3Hex: string;
                spotLight4Hex: string;
                spotLight5Hex: string;
                spotLight6Hex: string;
                orb1Hex: string;
                orb2Hex: string;
                orb3Hex: string;
                orb4Hex: string;
                orb5Hex: string;
                triangleHex: string;
                sineWave1Hex: string;
                sineWave2Hex: string;
                sineWave3Hex: string;
                particleRayHex: string;
                dressBaseHex: string;
                dressEmissiveHex: string;
                hairHex: string;
                hairEmissiveHex: string;
                skinHex: string;
                skinEmissiveHex: string;
            }>) => void;
        };
        scene: Scene;
    }
}

class App {
    private canvas: HTMLCanvasElement;
    private engine: Engine;
    private scene: Scene;
    private avatarController: AvatarController;
    private lipsMesh: Mesh | null = null;
    private backdrop: Mesh | null = null;
    private gridMat: GridMaterial | null = null;
    private floorMesh: Mesh | null = null;
    private floorMat: StandardMaterial | null = null;
    private glow: GlowLayer | null = null;
    private orbs: Mesh[] = [];
    private movingLights: SpotLight[] = [];
    private avatarContainer: AbstractMesh | null = null;
    private lastAIInteraction: number = Date.now();
    private animationCycleTimer: number = 0;
    private config: RuntimeConfig | null = null;
    private theme = {
        backgroundHex: "#000000",
        fogHex: "#1f00b8",
        fogDensity: 0.36,
        gridMainHex: "#080050",
        gridLineHex: "#a020f0",
        gridOpacity: 0.35,
        floorHex: "#020000",
        floorSpecularHex: "#6a0dad",
        glowIntensity: 0.45,
        // Spotlight colors
        spotLight1Hex: "#a020f0",
        spotLight2Hex: "#7d3cff", 
        spotLight3Hex: "#b067ff",
        spotLight4Hex: "#9932cc",
        spotLight5Hex: "#8a2be2",
        spotLight6Hex: "#6a0dad",
        // Orb colors
        orb1Hex: "#a020f0",
        orb2Hex: "#7d3cff",
        orb3Hex: "#b067ff", 
        orb4Hex: "#6a0dad",
        orb5Hex: "#9932cc",
        // Triangle colors
        triangleHex: "#4a1a6a",
        // Sine wave colors
        sineWave1Hex: "#9d4edd",
        sineWave2Hex: "#b967ff",
        sineWave3Hex: "#7b2cbf",
        // Particle ray colors
        particleRayHex: "#a020f0",
        // Dress glow colors
        dressBaseHex: "#851a8a",
        dressEmissiveHex: "#2d0d44",
        // Hair colors
        hairHex: "#f4a6cd",
        hairEmissiveHex: "#1a0a15",
        // Skin colors
        skinHex: "#fdbcb4",
        skinEmissiveHex: "#120808",
    };

    constructor() {
        this.canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
        this.engine = new Engine(this.canvas, true);
        this.scene = new Scene(this.engine);
        this.avatarController = new AvatarController(this.scene);
        
        // Start the async initialization
        this.initialize();
    }

    private async initialize(): Promise<void> {
        // Load runtime config first
        try {
            this.config = await getRuntimeConfig();
        } catch (e) { this.config = { mode: 'sound', devMode: false }; }
        // Apply theme preset and then overrides before building scene
        if (this.config?.themeName && THEME_PRESETS[this.config.themeName]) {
            this.theme = { ...this.theme, ...(THEME_PRESETS[this.config.themeName] as any) };
        }
        if (this.config?.theme && Object.keys(this.config.theme).length) {
            this.theme = { ...this.theme, ...(this.config.theme as any) };
        }

        // Physics not used; no Havok init required
        this.setupScene();
        await this.loadAvatar();
        this.exposeApi();
        // Always clear puppet memory on reload, then initialize or hide memory UI
        try {
            // Clear memory storage silently to avoid UI flicker
            clearMemory(true);
            if (this.config?.memoryEnabled === false) {
                const mb = document.getElementById('memory-box');
                if (mb) (mb as any).style.display = 'none';
            } else {
                initMemoryUI();
            }
        } catch (err) { console.warn('Memory UI init failed:', err); }
        // Touch refs for TS so strict unused checks don't explode in prod
        try { console.debug('App refs ready', { backdrop: !!this.backdrop, avatarRoot: !!this.avatarContainer }); } catch {}
        // Auto-start realtime voice session (no UI button needed)
        try {
            const dev = !!(this.config?.devMode);
            setRealtimeDebug(dev);
            // Set realtime mode (audio vs text)
            setRealtimeMode(this.config?.mode || 'sound');

            // Start session immediately
            await startRealtime({ debug: dev, vadLevelThreshold: 0.06, enableLipSync: !!this.config?.lipsync });
        } catch (err) {
            console.warn("Realtime startup failed:", err);
        }
        
        // Start rendering only after everything is ready
        this.run();
    }

    private setupScene(): void {
        const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 6, new Vector3(0, 1, 0), this.scene);
        camera.attachControl(this.canvas, true);

        // Scene background and fog (plus volumetric-looking particle fog blobs)
        this.scene.clearColor = Color4.FromHexString(this.theme.backgroundHex + "FF");
        this.scene.fogMode = Scene.FOGMODE_EXP;
        this.scene.fogColor = Color3.FromHexString(this.theme.fogHex);
        this.scene.fogDensity = this.theme.fogDensity;

        const light = new HemisphericLight("light", new Vector3(0, 1, 0), this.scene);
        light.intensity = 0.6; // Dimmer for mood

        // Moving spotlight system for dynamic lighting
        const createMovingSpotLight = (name: string, startPos: Vector3, color: Color3, intensity: number = 0.8) => {
            const spot = new SpotLight(name, startPos, new Vector3(0, -1, 0), Math.PI / 3, 2, this.scene);
            spot.diffuse = color;
            spot.specular = color.scale(0.5);
            spot.intensity = intensity;
            this.movingLights.push(spot);
            return spot;
        };

        // Spotlights distributed around the scene (360 degrees)
        createMovingSpotLight("spot1", new Vector3(-4, 8, -2), Color3.FromHexString(this.theme.spotLight1Hex), 1.2);
        createMovingSpotLight("spot2", new Vector3(4, 7, -3), Color3.FromHexString(this.theme.spotLight2Hex), 1.0);
        createMovingSpotLight("spot3", new Vector3(0, 9, 2), Color3.FromHexString(this.theme.spotLight3Hex), 0.9);
        createMovingSpotLight("spot4", new Vector3(-6, 7, 4), Color3.FromHexString(this.theme.spotLight4Hex), 0.8);
        createMovingSpotLight("spot5", new Vector3(5, 8, 0), Color3.FromHexString(this.theme.spotLight5Hex), 1.1);
        createMovingSpotLight("spot6", new Vector3(2, 6, -4), Color3.FromHexString(this.theme.spotLight6Hex), 0.9);

        // Glow for neon feel
        this.glow = new GlowLayer("glow", this.scene);
        this.glow.intensity = this.theme.glowIntensity;

        // Floor (black, slight purple specular)
        this.floorMesh = MeshBuilder.CreateGround("ground", { width: 20, height: 20 }, this.scene);
        this.floorMat = new StandardMaterial("floorMat", this.scene);
        this.floorMat.diffuseColor = Color3.FromHexString(this.theme.floorHex);
        this.floorMat.specularColor = Color3.FromHexString(this.theme.floorSpecularHex);
        this.floorMat.emissiveColor = new Color3(0, 0, 0);
        this.floorMesh.material = this.floorMat;

        // Multiple backdrop elements distributed around the scene (360 degrees)
        const makeBackdrop = (name: string, pos: Vector3, rot: Vector3) => {
            const plane = MeshBuilder.CreatePlane(name, { width: 40, height: 24 }, this.scene);
            plane.position = pos;
            plane.rotation = rot;
            const gm = new GridMaterial(`${name}_grid`, this.scene);
            gm.mainColor = Color3.FromHexString(this.theme.gridMainHex);
            gm.lineColor = Color3.FromHexString(this.theme.gridLineHex);
            gm.gridRatio = 1.1;
            (gm as any).opacity = this.theme.gridOpacity;
            (gm as any).majorUnitFrequency = 2.2;
            (gm as any).minorUnitVisibility = 0.4;
            plane.material = gm;
            return plane;
        };
        
        // Create triangular mesh backdrop
        const makeTriangleMesh = (name: string, pos: Vector3, rot: Vector3) => {
            const triangle = MeshBuilder.CreateCylinder(name, { height: 20, diameterTop: 0, diameterBottom: 25, tessellation: 3 }, this.scene);
            triangle.position = pos;
            triangle.rotation = rot;
            const mat = new StandardMaterial(`${name}_mat`, this.scene);
            mat.diffuseColor = new Color3(0, 0, 0);
            mat.emissiveColor = Color3.FromHexString(this.theme.triangleHex);
            mat.wireframe = true;
            triangle.material = mat;
            return triangle;
        };
        
        // Create 3D sine wave mesh with tubes
        const makeSineWave = (name: string, pos: Vector3, rotY: number = 0) => {
            // Create multiple sine wave tubes for 3D effect
            const createSineTube = (phase: number, yOffset: number, radius: number) => {
                const path = [];
                for (let i = 0; i <= 40; i++) {
                    const t = i / 40;
                    const x = (t - 0.5) * 20;
                    const y = Math.sin(t * Math.PI * 4 + phase) * 3 + yOffset;
                    const z = Math.cos(t * Math.PI * 2 + phase) * 2;
                    path.push(new Vector3(x, y, z));
                }
                return MeshBuilder.CreateTube(`${name}_tube_${phase}`, {
                    path: path,
                    radius: radius,
                    tessellation: 12,
                    cap: 3
                }, this.scene);
            };
            
            const container = new TransformNode(`${name}_container`, this.scene);
            
            // Create 3 intertwined sine tubes
            const tube1 = createSineTube(0, 8, 0.15);
            const tube2 = createSineTube(Math.PI * 0.6, 9, 0.12);
            const tube3 = createSineTube(Math.PI * 1.2, 7, 0.18);
            
            // Apply materials
            [tube1, tube2, tube3].forEach((tube, i) => {
                const mat = new StandardMaterial(`${name}_mat_${i}`, this.scene);
                mat.diffuseColor = new Color3(0, 0, 0);
                mat.emissiveColor = Color3.FromHexString([this.theme.sineWave1Hex, this.theme.sineWave2Hex, this.theme.sineWave3Hex][i]);
                mat.specularColor = new Color3(0.3, 0.3, 0.3);
                tube.material = mat;
                tube.parent = container;
            });
            
            container.position = pos;
            container.rotation.y = rotY;
            return container;
        };

        // Distribute elements around the scene (4 cardinal directions + corners)
        const bd1 = makeBackdrop("backdrop1", new Vector3(-2.5, 4.2, 20), new Vector3(0.02, 0, -0.06));
        const bd2 = makeBackdrop("backdrop2", new Vector3(3.8, 3.6, 25), new Vector3(-0.03, 0.02, 0.05));
        makeBackdrop("backdrop3", new Vector3(20, 4.0, -2), new Vector3(0.04, Math.PI/2, 0.03));
        makeBackdrop("backdrop4", new Vector3(-25, 3.8, 1), new Vector3(-0.02, -Math.PI/2, -0.04));
        
        makeTriangleMesh("triangle1", new Vector3(15, 0, 15), new Vector3(0, Math.PI/4, 0));
        makeTriangleMesh("triangle2", new Vector3(-18, 0, -12), new Vector3(0, -Math.PI/3, 0));
        
        const sine1 = makeSineWave("sine1", new Vector3(-15, -15, -30),Math.PI/3);
        const sine2 = makeSineWave("sine2", new Vector3(12, -10, 28), Math.PI/3);
        const sine3 = makeSineWave("sine3", new Vector3(-40, -10, -30), Math.PI/2);
        const sine4 = makeSineWave("sine4", new Vector3(8, 0, -30), Math.PI);
        
        // Add more triangles at -50 positions
        makeTriangleMesh("triangle3", new Vector3(-50, 0, 20), new Vector3(0, Math.PI/6, 0));
        makeTriangleMesh("triangle4", new Vector3(25, 0, -50), new Vector3(0, -Math.PI/4, 0));
        
        this.backdrop = bd1;
        this.gridMat = this.backdrop.material as GridMaterial;

        // Idle animation to make backdrops feel alive
        let t = 0;
        this.scene.onBeforeRenderObservable.add(() => {
            t += this.scene.getEngine().getDeltaTime() * 0.001;
            
            // Grid backdrops animation
            bd1.rotation.z = Math.sin(t * 0.15) * 0.08;
            bd1.position.x = -2.5 + Math.sin(t * 0.2) * 0.4;
            bd2.rotation.x = Math.cos(t * 0.12) * 0.06;
            bd2.position.y = 3.6 + Math.cos(t * 0.18) * 0.35;
            
            // Sine wave rotation animations
            sine1.rotation.y += 0.01;
            sine1.rotation.z = Math.sin(t * 0.3) * 0.2;
            sine2.rotation.y -= 0.008;
            sine2.rotation.x = Math.cos(t * 0.25) * 0.15;
            sine3.rotation.y += 0.012;
            sine3.rotation.z = Math.sin(t * 0.4) * 0.25;
            sine4.rotation.y -= 0.007;
            sine4.rotation.x = Math.cos(t * 0.35) * 0.18;
            
            // Orbs slow drift/rotation
            for (let i = 0; i < this.orbs.length; i++) {
                const orb = this.orbs[i];
                orb.position.x += Math.sin(t * 0.08 + i * 2.1) * 0.003;
                orb.position.y += Math.cos(t * 0.09 + i * 1.7) * 0.002;
                orb.rotation.y += 0.004 + i * 0.0008;
                orb.rotation.z += 0.002;
            }
            
            // Moving spotlights animation
            for (let i = 0; i < this.movingLights.length; i++) {
                const light = this.movingLights[i];
                const phase = t * (0.3 + i * 0.1);
                light.position.x = Math.sin(phase) * 6;
                light.position.z = Math.cos(phase * 0.7) * 3;
                light.position.y = 6 + Math.sin(phase * 1.3) * 2;
                // Point towards avatar
                light.setDirectionToTarget(new Vector3(0, 1.5, 0));
                // Subtle intensity pulsing
                light.intensity = (0.8 + i * 0.2) * (1 + Math.sin(phase * 2) * 0.3);
            }
            
            // Slowly rotate camera around the puppet
            camera.alpha += 0.003; // Slow orbital rotation
            
            // Auto-animation cycling when no AI interaction (8 seconds each)
            this.animationCycleTimer += this.scene.getEngine().getDeltaTime();
            const timeSinceLastAI = Date.now() - this.lastAIInteraction;
            if (timeSinceLastAI > 8000 && this.animationCycleTimer > 8000) { // 8 seconds
                this.animationCycleTimer = 0;
                // Smoother transition between Walk and Idle
                const currentAnim = this.avatarController.getCurrentAnimation();
                if (currentAnim === 'Walking') {
                    // Transition to idle with fade
                    this.avatarController.performAction('Idle');
                } else {
                    // Transition to walking with fade
                    this.avatarController.performAction('Walking');
                }
            }
        });

        // Create distant emissive purple orbs for depth/atmosphere
        const makeOrb = (name: string, pos: Vector3, size: number, color: string) => {
            const m = MeshBuilder.CreateSphere(name, { diameter: size, segments: 16 }, this.scene);
            const mat = new StandardMaterial(`${name}_mat`, this.scene);
            mat.diffuseColor = new Color3(0, 0, 0);
            mat.emissiveColor = Color3.FromHexString(color);
            mat.specularColor = new Color3(0, 0, 0);
            (mat as any).alpha = 0.85;
            m.material = mat;
            m.position = pos;
            return m;
        };
        this.orbs.push(makeOrb("orb1", new Vector3(-12, 8.5, 45), 2.2, this.theme.orb1Hex));
        this.orbs.push(makeOrb("orb2", new Vector3(15, 9.2, 55), 2.8, this.theme.orb2Hex));
        this.orbs.push(makeOrb("orb3", new Vector3(5, 7.8, 40), 1.6, this.theme.orb3Hex));
        this.orbs.push(makeOrb("orb4", new Vector3(-8, 11.1, 60), 3.2, this.theme.orb4Hex));
        this.orbs.push(makeOrb("orb5", new Vector3(20, 6.5, 50), 2.0, this.theme.orb5Hex));

        // Particle rays rising from floor
        const makeParticleRay = (name: string, x: number, z: number) => {
            const ray = MeshBuilder.CreateCylinder(name, { height: 8, diameterTop: 0.02, diameterBottom: 0.08, tessellation: 8 }, this.scene);
            const mat = new StandardMaterial(`${name}_mat`, this.scene);
            mat.diffuseColor = new Color3(0, 0, 0);
            mat.emissiveColor = Color3.FromHexString(this.theme.particleRayHex);
            (mat as any).alpha = 0.4;
            ray.material = mat;
            ray.position = new Vector3(x, 4, z);
            return ray;
        };
        this.orbs.push(makeParticleRay("ray1", -3, -2));
        this.orbs.push(makeParticleRay("ray2", 4, -1.5));
        this.orbs.push(makeParticleRay("ray3", -1, -3));
        this.orbs.push(makeParticleRay("ray4", 2.5, -2.8));

        // Apply theme colors across background elements now that they exist
        this.applyThemeToSceneElements();

        // Pulsing glow effect
        let glowPhase = 0;
        this.scene.onBeforeRenderObservable.add(() => {
            glowPhase += this.scene.getEngine().getDeltaTime() * 0.002;
            if (this.glow) {
                this.glow.intensity = this.theme.glowIntensity + Math.sin(glowPhase) * 0.25;
            }
        });

        // Create lips mesh (flattened sphere), hidden by default
        this.lipsMesh = MeshBuilder.CreateSphere("lips", { diameter: 0.15, segments: 16 }, this.scene);
        this.lipsMesh.material = new StandardMaterial("lipsMaterial", this.scene);
        (this.lipsMesh.material as StandardMaterial).diffuseColor = new Color3(0.8, 0.1, 0.1); // Back to red
        // This initial position is temporary; it will be parented to the avatar later.
        this.lipsMesh.position.set(0, 3.5, 0);
        // Flatten the sphere to look more like lips
        this.lipsMesh.scaling = new Vector3(1.5, 0.25, 0.5);
        this.lipsMesh.setEnabled(false);
    }

    private async loadAvatar(): Promise<void> {
        // Determine avatar source
        let root = "/models/";
        let file = "avatar.glb";
        const url = this.config?.avatarUrl;
        if (url && typeof url === 'string' && url.length > 0) {
            const idx = url.lastIndexOf('/');
            if (idx >= 0) { root = url.slice(0, idx + 1); file = url.slice(idx + 1); }
            else { root = ""; file = url; }
        }

        const { meshes, animationGroups, skeletons } = await SceneLoader.ImportMeshAsync("", root, file, this.scene);
        const avatarContainer = meshes[0];
        const scale = (this.config?.avatarScale != null && isFinite(this.config.avatarScale!)) ? (this.config!.avatarScale as number) : 1.8;
        avatarContainer.scaling.scaleInPlace(scale);
        avatarContainer.position.y = 0;
        this.avatarContainer = avatarContainer; // Store reference for rotation
        this.avatarController.setAvatar(avatarContainer, animationGroups, ...skeletons);
        this.avatarController.performAction("Idle");
        
        // Parent lips to the avatar's root container (fallback)
        if (this.lipsMesh) {
            this.lipsMesh.parent = avatarContainer;
            // Positioned at mouth height, relative to avatar root
            this.lipsMesh.position = new Vector3(0, 1.62, 0.12);
        }

        // Apply default purple silk/metallic style to dress and hair (fallback)
        setTimeout(() => {
            try {
                // Force clear existing texture and apply solid purple
                const dressMesh = this.scene.getMeshByName('Saber_maid_dress');
                if (dressMesh && dressMesh.material) {
                    const mat = dressMesh.material as any;
                    if (mat.albedoTexture) mat.albedoTexture = null; // Remove texture
                    if (mat.diffuseTexture) mat.diffuseTexture = null; // Remove texture
                }
                // Start with darker purple dress (fallback)
                (this.avatarController as any).setMaterialStyle?.('Saber_maid_dress', {
                    hex: this.theme.dressBaseHex, 
                    metallic: 0.7, 
                    roughness: 0.2, 
                    emissiveHex: this.theme.dressEmissiveHex
                });
                
                // Add dress glow animation (fallback)
                let dressGlowPhase = 0;
                this.scene.onBeforeRenderObservable.add(() => {
                    dressGlowPhase += this.scene.getEngine().getDeltaTime() * 0.003;
                    const dressMesh = this.scene.getMeshByName('Saber_maid_dress');
                    if (dressMesh && dressMesh.material) {
                        const mat = dressMesh.material as any;
                        if (mat.emissiveColor) {
                            const glow = 0.15 + Math.sin(dressGlowPhase) * 0.08;
                            mat.emissiveColor.r = glow * 0.4;
                            mat.emissiveColor.g = glow * 0.1;
                            mat.emissiveColor.b = glow * 0.6;
                        }
                    }
                });
                (this.avatarController as any).setMaterialStyle?.('F010_Saber_Hair', {
                    hex: this.theme.hairHex, 
                    metallic: 0.05, 
                    roughness: 0.7,
                    emissiveHex: this.theme.hairEmissiveHex
                });
                
                // Style shoes/stockings with dark grey (fallback)
                setTimeout(() => {
                    const shoeNames = ['shoe', 'boot', 'foot', 'sock', 'stocking'];
                    this.scene.meshes.forEach(mesh => {
                        const meshName = mesh.name.toLowerCase();
                        if (shoeNames.some(name => meshName.includes(name))) {
                            try {
                                (this.avatarController as any).setMaterialStyle?.(mesh.name, {
                                    hex: '#000000', 
                                    metallic: 0.1, 
                                    roughness: 0.1,
                                    emissiveHex: '#000000'
                                });
                            } catch (e) { console.warn('Shoe styling failed for', mesh.name, e); }
                        }
                    });
                }, 800);
                
                // Style skin/body with warmer, more lively tone (fallback)
                setTimeout(() => {
                    const skinNames = ['body', 'face', 'skin', 'head', 'neck', 'hand', 'arm', 'leg'];
                    this.scene.meshes.forEach(mesh => {
                        const meshName = mesh.name.toLowerCase();
                        if (skinNames.some(name => meshName.includes(name))) {
                            try {
                                (this.avatarController as any).setMaterialStyle?.(mesh.name, {
                                    hex: this.theme.skinHex, 
                                    metallic: 0.02, 
                                    roughness: 0.7,
                                    emissiveHex: this.theme.skinEmissiveHex
                                });
                            } catch (e) { console.warn('Skin styling failed for', mesh.name, e); }
                        }
                    });
                }, 1000);
            } catch (e) { console.warn('Material styling failed:', e); }
        }, 500);
    }

    /**
     * Exposes a simplified API to the global window object
     * for easy debugging and LLM integration simulation.
     */
    private exposeApi(): void {
        window.puppet = {
            performAction: (action: string) => {
                this.lastAIInteraction = Date.now(); // Reset timer on AI interaction
                this.avatarController.performAction(action);
            },
            setMaterialColor: (meshName: string, hexColor: string) => this.avatarController.setMaterialColor(meshName, hexColor),
            // Shiny/silk style material helper
            setMaterialStyle: (meshName: string, params: { hex?: string; metallic?: number; roughness?: number; emissiveHex?: string; alpha?: number; backface?: boolean }) => (this.avatarController as any).setMaterialStyle?.(meshName, params),
            setBoneRotation: (boneName: string, rotation: { x: number, y: number, z: number }) => this.avatarController.setBoneRotation(boneName, rotation),
            stopAll: () => this.avatarController.stopAll(),
            forceTPose: () => this.avatarController.forceTPose(),
            lookAt: (t, hint) => (this.avatarController as any).lookAt?.(t, hint),
            // Tweened motion APIs
            rotateBoneTo: (boneName: string, rotation: { x: number, y: number, z: number }, opts?: { durationMs?: number, speedDegPerSec?: number }) => {
                this.lastAIInteraction = Date.now(); // Reset timer on AI interaction
                this.avatarController.rotateBoneTo(boneName, rotation, opts || {});
            },
            moveRootTo: (target: { x: number, y: number, z: number }, speedMetersPerSec?: number) => this.avatarController.moveRootTo(target, speedMetersPerSec),
            stopTweens: () => this.avatarController.stopTweens(),
            // Lips API: set shape by open/wide/round in 0..1 range
            setLips: (shape: { open?: number; wide?: number; round?: number }) => {
                const lips = this.lipsMesh;
                if (!lips) return;
                if (!lips.isEnabled()) return;
                const clamp = (v: number, lo = 0, hi = 2) => Math.max(lo, Math.min(hi, v));
                const open = clamp(shape.open ?? 0);
                const wide = clamp(shape.wide ?? 0);
                const round = clamp(shape.round ?? 0);
                // Base dimensions
                const baseX = 1.2;   // width
                const baseY = 1.0;   // thickness
                const baseZ = 0.6;   // depth
                // Shape mapping
                const widthScale = clamp(1 + 0.7 * wide - 0.3 * round, 0.6, 2.0);
                const heightScale = clamp(1 + 1.8 * open - 0.5 * wide, 0.2, 2.0);
                const depthScale = clamp(1 + 0.7 * round - 0.2 * wide, 0.4, 2.0);
                lips.scaling.x = baseX * widthScale;
                lips.scaling.y = baseY * heightScale;
                lips.scaling.z = baseZ * depthScale;
            },
            setLipsVisible: (visible: boolean) => {
                if (this.lipsMesh) this.lipsMesh.setEnabled(!!visible);
            },
            setTheme: (theme) => {
                // Update local theme state
                this.theme = { ...this.theme, ...(theme as any) };
                // Apply basic scene colors
                this.scene.clearColor = Color4.FromHexString(this.theme.backgroundHex + "FF");
                this.scene.fogColor = Color3.FromHexString(this.theme.fogHex);
                this.scene.fogDensity = this.theme.fogDensity;
                if (this.gridMat) {
                    this.gridMat.mainColor = Color3.FromHexString(this.theme.gridMainHex);
                    this.gridMat.lineColor = Color3.FromHexString(this.theme.gridLineHex);
                    (this.gridMat as any).opacity = this.theme.gridOpacity;
                }
                if (this.floorMat) {
                    this.floorMat.diffuseColor = Color3.FromHexString(this.theme.floorHex);
                    this.floorMat.specularColor = Color3.FromHexString(this.theme.floorSpecularHex);
                }
                if (this.glow) this.glow.intensity = this.theme.glowIntensity;
                
                // Update spotlight colors
                this.movingLights.forEach((light, i) => {
                    const colorKeys = ['spotLight1Hex', 'spotLight2Hex', 'spotLight3Hex', 'spotLight4Hex', 'spotLight5Hex', 'spotLight6Hex'];
                    if (i < colorKeys.length) {
                        const colorHex = (this.theme as any)[colorKeys[i]];
                        if (colorHex) {
                            light.diffuse = Color3.FromHexString(colorHex);
                            light.specular = Color3.FromHexString(colorHex).scale(0.5);
                        }
                    }
                });
                
                // Propagate theme to all background elements (orbs, rays, triangles, sine waves, grid backdrops)
                this.applyThemeToSceneElements();
                console.log('Theme updated and propagated to scene elements.');
            }
        };
        // expose scene for debugging (skeletons, meshes)
        window.scene = this.scene;
    }


    public run(): void {
        this.engine.runRenderLoop(() => {
            if (this.scene.activeCamera) {
                this.scene.render();
            }
        });

        window.addEventListener("resize", () => {
            this.engine.resize();
        });
    }

    private applyThemeToSceneElements(): void {
        try {
            // Grid backdrops: update all GridMaterial instances found in scene
            for (const mesh of this.scene.meshes) {
                const mat: any = mesh.material;
                if (mat && typeof mat.getClassName === 'function' && mat.getClassName() === 'GridMaterial') {
                    mat.mainColor = Color3.FromHexString(this.theme.gridMainHex);
                    mat.lineColor = Color3.FromHexString(this.theme.gridLineHex);
                    (mat as any).opacity = this.theme.gridOpacity;
                }
            }

            // Spotlights already updated in setTheme; ensure here as well
            const spotKeys = ['spotLight1Hex','spotLight2Hex','spotLight3Hex','spotLight4Hex','spotLight5Hex','spotLight6Hex'];
            this.movingLights.forEach((light, i) => {
                const k = spotKeys[i] as keyof typeof this.theme;
                const hex = (this.theme as any)[k];
                if (hex) {
                    light.diffuse = Color3.FromHexString(hex);
                    light.specular = Color3.FromHexString(hex).scale(0.5);
                }
            });

            // Orbs and Rays
            for (const m of this.orbs) {
                const name = m.name.toLowerCase();
                const mat = m.material as StandardMaterial | null;
                if (!mat) continue;
                if (name.startsWith('orb')) {
                    const match = name.match(/^orb([1-5])/);
                    if (match) {
                        const idx = Number(match[1]);
                        const key = (`orb${idx}Hex`) as keyof typeof this.theme;
                        const hex = (this.theme as any)[key];
                        if (hex) mat.emissiveColor = Color3.FromHexString(hex);
                    }
                } else if (name.startsWith('ray')) {
                    mat.emissiveColor = Color3.FromHexString(this.theme.particleRayHex);
                }
            }

            // Triangles
            for (const tri of ['triangle1','triangle2','triangle3','triangle4']) {
                const mesh = this.scene.getMeshByName(tri);
                if (mesh && mesh.material) {
                    const mat = mesh.material as StandardMaterial;
                    mat.emissiveColor = Color3.FromHexString(this.theme.triangleHex);
                }
            }

            // Sine wave tubes (materials named <sineX>_mat_0..2)
            const sineColors = [this.theme.sineWave1Hex, this.theme.sineWave2Hex, this.theme.sineWave3Hex];
            for (const sine of ['sine1','sine2','sine3','sine4']) {
                for (let i = 0; i < 3; i++) {
                    const mat = this.scene.getMaterialByName(`${sine}_mat_${i}`) as StandardMaterial | null;
                    const hex = sineColors[i];
                    if (mat && hex) mat.emissiveColor = Color3.FromHexString(hex);
                }
            }
        } catch (e) {
            console.warn('applyThemeToSceneElements failed:', e);
        }
    }
}

export default App;
