import { Scene, AbstractMesh, AnimationGroup, PBRMaterial, Color3, Skeleton, Vector3, Space, Quaternion, Texture, Mesh } from "@babylonjs/core";
import { BoneLookController } from "@babylonjs/core/Bones/boneLookController";

export class AvatarController {
    private scene: Scene;
    private avatarContainer: AbstractMesh | null = null;
    private animations: AnimationGroup[] = [];
    private skeletons: Skeleton[] = [];
    // Physics disabled for now
    
    // Tweening infrastructure
    private activeTweens: Array<{ kind: "boneRot" | "rootMove"; update: (dt: number) => boolean }>=[];

    private ease(t: number, easing: "linear" | "easeInOut" = "easeInOut"): number {
        if (easing === "linear") return t;
        // Smooth ease-in-out (S-curve)
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    constructor(scene: Scene) {
        this.scene = scene;
        // Tick tweens each frame
        this.scene.onBeforeRenderObservable.add(() => {
            const dt = this.scene.getEngine().getDeltaTime() / 1000; // seconds
            if (this.activeTweens.length === 0) return;
            this.activeTweens = this.activeTweens.filter(tween => !tween.update(dt));
        });
    }

    public setAvatar(container: AbstractMesh, animations: AnimationGroup[], ...skeletons: Skeleton[]): void {
        this.avatarContainer = container;
        this.animations = animations;
        this.skeletons = skeletons.filter(Boolean);
        
        console.log("AvatarController: Avatar set.");
        console.log("Animations:", this.animations.map(a => a.name));
        console.log("Skeleton count:", this.skeletons.length);
        
        console.log("Model Structure (Materials):");
        this.avatarContainer.getChildMeshes(false).forEach(mesh => {
            if (mesh.material && (mesh.material as any).getClassName && (mesh.material as any).getClassName() === "PBRMaterial") {
                const mat = mesh.material as PBRMaterial;
                mat.albedoColor = Color3.White();
                mat.metallic = 0;
                mat.roughness = 0.6;
                mat.environmentIntensity = 0.5;
            }
            console.log(`- Mesh: ${mesh.name}, Material Class: ${mesh.material ? (mesh.material as any).getClassName?.() : 'None'}`);
        });

        const dressMesh = this.scene.getMeshByName("Saber_maid_dress");
        if (dressMesh && dressMesh.material && (dressMesh.material as any).getClassName?.() === "PBRMaterial") {
            const dressMat = dressMesh.material as PBRMaterial;
            dressMat.albedoTexture = new Texture("/models/merged-saber-maid/saber-dress-texture.png", this.scene);
            dressMat.albedoColor = Color3.White();
            dressMat.metallic = 0;
            dressMat.roughness = 0.7;
            console.log("Applied explicit dress texture override");
        }

        console.log("Skeleton Bones (first):");
        if (this.skeletons[0]) {
            this.skeletons[0].bones.forEach(bone => console.log(`- Bone: ${bone.name}`));
        }

        this.animations.forEach(anim => anim.stop());
    }

    public performAction(action: string): void {
        const animationName = this.findAnimationForAction(action);
        if (animationName) {
            this.playAnimation(animationName, true);
        } else {
            console.warn(`No animation found for action: "${action}"`);
        }
    }

    public setMaterialColor(meshName: string, hexColor: string): void {
        if (!this.avatarContainer) return;
        const mesh = this.scene.getMeshByName(meshName);
        if (!mesh) { console.warn(`Mesh "${meshName}" not found.`); return; }
        const material = mesh.material as PBRMaterial;
        if (material) {
            material.albedoColor = Color3.FromHexString(hexColor);
            material.metallic = 0;
            material.roughness = 0.6;
        }
    }

    public setMaterialStyle(meshName: string, params: { hex?: string; metallic?: number; roughness?: number; emissiveHex?: string; alpha?: number; backface?: boolean } = {}): void {
        if (!this.avatarContainer) return;
        // Find exact or partial match
        let mesh = this.scene.getMeshByName(meshName);
        if (!mesh) {
            const lower = meshName.toLowerCase();
            mesh = this.scene.meshes.find(m => m.name.toLowerCase().includes(lower)) as Mesh | undefined as any;
        }
        if (!mesh) { console.warn(`Mesh "${meshName}" not found for style.`); return; }
        let mat = mesh.material as PBRMaterial | null;
        if (!mat || (mat as any).getClassName?.() !== "PBRMaterial") {
            mat = new PBRMaterial(`${mesh.name}_pbr`, this.scene);
            mesh.material = mat;
        }
        if (!mat) return;
        if (params.hex) mat.albedoColor = Color3.FromHexString(params.hex);
        if (params.emissiveHex) mat.emissiveColor = Color3.FromHexString(params.emissiveHex);
        if (typeof params.metallic === 'number') mat.metallic = params.metallic;
        if (typeof params.roughness === 'number') mat.roughness = params.roughness;
        if (typeof params.alpha === 'number') mat.alpha = params.alpha;
        (mat as any).backFaceCulling = params.backface === true ? false : true;
    }

    public setBoneRotation(boneName: string, rotation: { x: number, y: number, z: number }): void {
        if (!this.skeletons.length) { console.error("No skeletons available."); return; }
        
        this.stopAll();
        
        const q = Quaternion.FromEulerAngles(
            (rotation.x * Math.PI) / 180,
            (rotation.y * Math.PI) / 180,
            (rotation.z * Math.PI) / 180
        );
        
        let applied = 0;
        for (const skel of this.skeletons) {
            const bone = skel.bones.find(b => b.name === boneName || b.name.toLowerCase().includes(boneName.toLowerCase()));
            if (bone) {
                // CRITICAL: Check for Transform Node blocking
                const transformNode = bone.getTransformNode();
                if (transformNode) {
                    console.log(`Transform Node detected for ${boneName}, unlinking...`);
                    bone.linkTransformNode(null);
                }
                
                // More aggressive bone manipulation
                bone.setRotationQuaternion(q, Space.LOCAL);
                
                // Force matrix update
                bone.markAsDirty();
                bone.computeAbsoluteTransforms();
                
                applied++;
            }
        }
        
        // Force all skeletons and meshes to recompute
        this.skeletons.forEach(s => {
            s.computeAbsoluteTransforms(true);
            s.prepare();
            
            // Force mesh updates for this skeleton
            const linkedMeshes = this.scene.meshes.filter(m => m.skeleton === s);
            linkedMeshes.forEach(mesh => {
                mesh.computeWorldMatrix(true);
                // Force vertex buffer update
                if ((mesh as Mesh).markVerticesDataAsUpdatable) {
                    (mesh as Mesh).markVerticesDataAsUpdatable("position", true);
                }
            });
        });
        
        if (!applied) console.warn(`Bone "${boneName}" not found in any skeleton.`);
        else console.log(`Applied rotation to ${applied} skeleton(s) for bone ${boneName}`);
    }

    public forceTPose(): void {
        this.stopAll();
        
        console.log("=== DEBUGGING BONE SYSTEM ===");
        
        // First, let's see what we're working with
        this.skeletons.forEach((skel, idx) => {
            console.log(`Skeleton ${idx}:`, skel.name);
            console.log(`- Bone count: ${skel.bones.length}`);
            console.log(`- First 10 bones:`, skel.bones.slice(0, 10).map(b => b.name));
            
            // Check if skeleton is properly linked to meshes
            const linkedMeshes = this.scene.meshes.filter(m => m.skeleton === skel);
            console.log(`- Linked meshes: ${linkedMeshes.length}`, linkedMeshes.map(m => m.name));
        });
        
        // Try to set a basic T-pose manually with more debug info
        const basicTPose = [
            { bone: "Armature_mixamorig:LeftArm", rot: { x: 0, y: 0, z: -90 } },
            { bone: "Armature_mixamorig:RightArm", rot: { x: 0, y: 0, z: 90 } },
            { bone: "Armature_mixamorig:Head", rot: { x: 0, y: 45, z: 0 } },
        ];
        
        basicTPose.forEach(({ bone, rot }) => {
            console.log(`Attempting to rotate bone: ${bone}`);
            
            this.skeletons.forEach((skel, skelIdx) => {
                const foundBone = skel.bones.find(b => b.name === bone || b.name.toLowerCase().includes(bone.toLowerCase()));
                if (foundBone) {
                    console.log(`Found bone "${foundBone.name}" in skeleton ${skelIdx}`);
                    console.log(`- Current rotation:`, foundBone.getRotation());
                    console.log(`- Current position:`, foundBone.getPosition());
                    console.log(`- Parent:`, foundBone.getParent()?.name || "none");
                    
                    // Try different rotation methods
                    const q = Quaternion.FromEulerAngles(
                        (rot.x * Math.PI) / 180,
                        (rot.y * Math.PI) / 180,
                        (rot.z * Math.PI) / 180
                    );
                    
                    // Method 1: Check for Transform Node (this is the key!)
                    const transformNode = foundBone.getTransformNode();
                    if (transformNode) {
                        console.log(`- Found Transform Node: ${transformNode.name}, unlinking...`);
                        foundBone.linkTransformNode(null);
                        console.log(`- Transform Node unlinked, now trying direct bone rotation`);
                    }
                    
                    // Method 2: setRotationQuaternion
                    foundBone.setRotationQuaternion(q, Space.LOCAL);
                    console.log(`- After setRotationQuaternion:`, foundBone.getRotation());
                    
                    // Method 2: Force mesh updates
                    const linkedMeshes = this.scene.meshes.filter(m => m.skeleton === skel);
                    linkedMeshes.forEach(mesh => {
                        if (mesh.skeleton) {
                            mesh.skeleton.computeAbsoluteTransforms(true);
                            mesh.computeWorldMatrix(true);
                            // Force vertex buffer update
                            if ((mesh as Mesh).markVerticesDataAsUpdatable) {
                                (mesh as Mesh).markVerticesDataAsUpdatable("position", true);
                            }
                        }
                    });
                    
                    console.log(`- After mesh refresh, rotation:`, foundBone.getRotation());
                    
                    // Force updates
                    foundBone.markAsDirty();
                    foundBone.computeAbsoluteTransforms();
                    skel.computeAbsoluteTransforms(true);
                    skel.prepare();
                }
            });
        });
        
        console.log("=== END DEBUG ===");
    }

    public lookAt(target: { x: number, y: number, z: number }, boneHint: string = "Head"): void {
        if (!this.skeletons.length || !this.avatarContainer) return;
        for (const skel of this.skeletons) {
            const bone = skel.bones.find(b => b.name.toLowerCase().includes(boneHint.toLowerCase()));
            if (!bone) continue;
            const ctrl = new BoneLookController(this.avatarContainer, bone, new Vector3(target.x, target.y, target.z));
            ctrl.update();
            skel.computeAbsoluteTransforms(true);
        }
    }

    private findAnimationForAction(action: string): string | null {
        const lowerCaseAction = action.toLowerCase();
        for (const anim of this.animations) {
            if (anim.name.toLowerCase().includes(lowerCaseAction)) return anim.name;
        }
        return null;
    }

    public playAnimation(name: string, loop: boolean = true): void {
        if (!this.avatarContainer) return;
        this.animations.forEach(anim => { if (anim.name !== name) anim.stop(); });
        const animation = this.animations.find(anim => anim.name === name);
        if (animation) animation.start(loop);
    }

    public stopAnimation(name: string): void {
        if (!this.avatarContainer) return;
        const animation = this.animations.find(anim => anim.name === name);
        if (animation) animation.stop();
    }

    public stopAll(): void {
        // Aggressive animation stopping
        this.animations.forEach(a => {
            a.stop();
            a.reset();
        });
        // Also stop any scene-level animation groups
        this.scene.animationGroups.forEach(ag => {
            ag.stop();
            ag.reset();
        });
        console.log("Stopped all animations aggressively");
    }

    // ========== SMOOTH TWEENED MOTION ==========
    
    public rotateBoneTo(boneName: string, targetDeg: { x: number, y: number, z: number }, options: { durationMs?: number, speedDegPerSec?: number, easing?: "linear" | "easeInOut" } = {}): void {
        if (!this.skeletons.length) return;
        const targetQ = Quaternion.FromEulerAngles(
            (targetDeg.x * Math.PI) / 180,
            (targetDeg.y * Math.PI) / 180,
            (targetDeg.z * Math.PI) / 180
        );
        // For each skeleton that has the bone, tween
        for (const skel of this.skeletons) {
            const bone = skel.bones.find(b => b.name === boneName || b.name.toLowerCase().includes(boneName.toLowerCase()));
            if (!bone) continue;

            // Unlink transform node if needed
            const tn = bone.getTransformNode();
            if (tn) bone.linkTransformNode(null);

            const startQ = bone.getRotationQuaternion(Space.LOCAL) ?? Quaternion.FromEulerVector(bone.getRotation(Space.LOCAL));
            const dot = Math.max(-1, Math.min(1, Quaternion.Dot(startQ, targetQ)));
            const angleRad = 2 * Math.acos(Math.abs(dot)); // shortest arc
            const duration = options.durationMs ?? ((options.speedDegPerSec ? (angleRad * 180 / Math.PI) / options.speedDegPerSec : 0.4) * 1000);

            const easing = options.easing ?? "easeInOut";
            let elapsed = 0;
            this.activeTweens.push({
                kind: "boneRot",
                update: (dt: number) => {
                    elapsed += dt;
                    const t = Math.min(1, elapsed / (duration / 1000));
                    const te = this.ease(t, easing);
                    const q = Quaternion.Slerp(startQ, targetQ, te);
                    bone.setRotationQuaternion(q, Space.LOCAL);
                    bone.markAsDirty();
                    skel.computeAbsoluteTransforms(true);
                    return t >= 1;
                }
            });
        }
    }

    public moveRootTo(target: { x: number, y: number, z: number }, speedMetersPerSec: number = 1, easing: "linear" | "easeInOut" = "easeInOut"): void {
        if (!this.avatarContainer) return;
        const start = this.avatarContainer.position.clone();
        const targetV = new Vector3(target.x, target.y, target.z);
        const distance = Vector3.Distance(start, targetV);
        if (distance === 0 || speedMetersPerSec <= 0) return;
        const duration = distance / speedMetersPerSec; // seconds
        let elapsed = 0;
        this.activeTweens.push({
            kind: "rootMove",
            update: (dt: number) => {
                elapsed += dt;
                const t = Math.min(1, elapsed / duration);
                const te = this.ease(t, easing);
                this.avatarContainer!.position = Vector3.Lerp(start, targetV, te);
                return t >= 1;
            }
        });
    }

    public stopTweens(): void {
        this.activeTweens = [];
    }

    // ========== PHYSICS METHODS ==========

    // Removed old mesh cloning helpers tied to physics

    // Physics simulation helpers removed

    public resetPhysics(): void {
        this.stopTweens();
    }

    public getCurrentAnimation(): string | null {
        for (const anim of this.animations) {
            if (anim.isPlaying) return anim.name;
        }
        return null;
    }
}
