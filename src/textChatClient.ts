// Text-only chat client for MODE=text
// Uses OpenAI GPT-4 chat completions API instead of Realtime API

type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

let conversation: ConversationMessage[] = [];
let isProcessing = false;

// Send a text message to GPT-4 and get response
export async function sendTextMessage(message: string): Promise<string> {
  if (isProcessing) {
    throw new Error('Already processing a message');
  }

  isProcessing = true;

  try {
    // Add user message to conversation
    conversation.push({ role: 'user', content: message });

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        conversation: conversation.slice(0, -1) // Send all messages except the current one
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Chat API error: ${response.status} ${error}`);
    }

    const data = await response.json();

    // Handle tool calls if present
    if (data.choices?.[0]?.message?.tool_calls) {
      const toolCalls = data.choices[0].message.tool_calls;

      // Execute tool calls
      for (const toolCall of toolCalls) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          await executeToolCall(toolCall.function.name, args);
        } catch (err) {
          console.warn('Tool execution failed:', err);
        }
      }
    }

    // Get assistant response
    const assistantMessage = data.choices?.[0]?.message?.content || '';
    if (assistantMessage) {
      conversation.push({ role: 'assistant', content: assistantMessage });
    }

    return assistantMessage;
  } finally {
    isProcessing = false;
  }
}

// Execute tool calls locally (same as realtime client)
async function executeToolCall(name: string, args: any): Promise<any> {
  try {
    switch (name) {
      case 'perform_action': {
        const anim = String(args?.name ?? 'Idle');
        (window as any).puppet?.performAction?.(anim);
        break;
      }
      case 'rotate_bone_to': {
        const bone = String(args?.bone ?? 'Head');
        const x = Number(args?.x ?? 0);
        const y = Number(args?.y ?? 0);
        const z = Number(args?.z ?? 0);
        const durationMs = args?.durationMs != null ? Number(args.durationMs) : undefined;
        const speedDegPerSec = args?.speedDegPerSec != null ? Number(args.speedDegPerSec) : undefined;
        const easing = args?.easing as 'linear' | 'easeInOut' | undefined;
        (window as any).puppet?.rotateBoneTo?.(bone, { x, y, z }, { durationMs, speedDegPerSec, easing });
        break;
      }
      case 'move_root_to': {
        const x = Number(args?.x ?? 0);
        const y = Number(args?.y ?? 0);
        const z = Number(args?.z ?? 0);
        const speedMetersPerSec = args?.speedMetersPerSec != null ? Number(args.speedMetersPerSec) : undefined;
        (window as any).puppet?.moveRootTo?.({ x, y, z }, speedMetersPerSec);
        break;
      }
      case 'set_material_color': {
        const meshName = String(args?.meshName ?? 'Saber_maid_dress');
        const hex = String(args?.hexColor ?? '#ffffff');
        (window as any).puppet?.setMaterialColor?.(meshName, hex);
        break;
      }
      case 'set_theme': {
        const theme = {
          backgroundHex: args?.backgroundHex,
          fogHex: args?.fogHex,
          fogDensity: args?.fogDensity,
          gridMainHex: args?.gridMainHex,
          gridLineHex: args?.gridLineHex,
          gridOpacity: args?.gridOpacity,
          floorHex: args?.floorHex,
          floorSpecularHex: args?.floorSpecularHex,
          glowIntensity: args?.glowIntensity,
        };
        (window as any).puppet?.setTheme?.(theme);
        break;
      }
      case 'stop_tweens': {
        (window as any).puppet?.stopTweens?.();
        break;
      }
      case 'stop_all': {
        (window as any).puppet?.stopAll?.();
        break;
      }
      case 'look_at': {
        const targetX = Number(args?.targetX ?? 0);
        const targetY = Number(args?.targetY ?? 1.5);
        const targetZ = Number(args?.targetZ ?? 0);
        const boneHint = args?.boneHint != null ? String(args.boneHint) : undefined;
        (window as any).puppet?.lookAt?.({ x: targetX, y: targetY, z: targetZ }, boneHint);
        break;
      }
      case 'memory_add': {
        const text = String(args?.text ?? '');
        const weight = args?.weight != null ? Number(args.weight) : 1;
        // Import and use memory functions
        try {
          const { addMemory } = await import('./memory');
          addMemory(text, weight);
        } catch (err) {
          console.warn('Memory add failed:', err);
        }
        break;
      }
      case 'memory_update': {
        const id = Number(args?.id);
        if (!Number.isFinite(id)) return { ok: false, error: 'id required' };
        try {
          const { updateMemory } = await import('./memory');
          updateMemory(id, { text: args?.text, weight: args?.weight });
        } catch (err) {
          console.warn('Memory update failed:', err);
        }
        break;
      }
      case 'memory_delete': {
        const id = Number(args?.id);
        if (!Number.isFinite(id)) return { ok: false, error: 'id required' };
        try {
          const { deleteMemory } = await import('./memory');
          deleteMemory(id);
        } catch (err) {
          console.warn('Memory delete failed:', err);
        }
        break;
      }
      case 'memory_list': {
        try {
          const { listMemory } = await import('./memory');
          return { ok: true, result: listMemory() };
        } catch (err) {
          console.warn('Memory list failed:', err);
          return { ok: false, error: 'Memory system unavailable' };
        }
      }
      case 'get_scene_info': {
        const scene = (window as any).scene;
        const puppet = (window as any).puppet;
        let bones: string[] = [];
        try {
          const skeletons = Array.from(new Set((scene?.meshes || []).map((m: any) => (m as any).skeleton).filter(Boolean)));
          const names = new Set<string>();
          for (const skAny of skeletons as any[]) {
            const bns = (skAny as any)?.bones as any[] | undefined;
            if (Array.isArray(bns)) {
              for (const b of bns) { names.add(String((b as any).name)); }
            }
          }
          bones = Array.from(names.values()).sort();
        } catch {}
        const animations: string[] = (scene?.animationGroups || []).map((ag: any) => String(ag.name));
        const meshes: string[] = (scene?.meshes || []).map((m: any) => String(m.name));
        const tools = ['perform_action','rotate_bone_to','move_root_to','set_material_color','stop_tweens','stop_all','look_at','set_theme','memory_add','memory_update','memory_delete','memory_list'];
        const api = Object.keys(puppet || {});
        const result = { bones, animations, meshes, tools, api };
        return { ok: true, result };
      }
      case 'get_safe_ranges': {
        // Conservative defaults; can be refined per model
        const ranges: Record<string, { x: [number, number], y: [number, number], z: [number, number], primary?: 'x'|'y'|'z' }> = {
          'Head': { x: [-25, 25], y: [-35, 35], z: [-20, 20], primary: 'x' },
          'Neck': { x: [-20, 20], y: [-30, 30], z: [-15, 15], primary: 'x' },
          'Hips': { x: [-10, 10], y: [-15, 15], z: [-10, 10], primary: 'x' },
          'Spine': { x: [-15, 15], y: [-15, 15], z: [-15, 15], primary: 'x' },
          'LeftArm': { x: [-100, 45], y: [-30, 30], z: [-30, 30], primary: 'x' },
          'RightArm': { x: [-100, 45], y: [-30, 30], z: [-30, 30], primary: 'x' },
          'LeftForeArm': { x: [-80, 10], y: [-20, 20], z: [-20, 20], primary: 'x' },
          'RightForeArm': { x: [-80, 10], y: [-20, 20], z: [-20, 20], primary: 'x' },
          'LeftUpLeg': { x: [-20, 60], y: [-25, 25], z: [-25, 25], primary: 'x' },
          'RightUpLeg': { x: [-20, 60], y: [-25, 25], z: [-25, 25], primary: 'x' },
          'LeftLeg': { x: [-90, 10], y: [-20, 20], z: [-20, 20], primary: 'x' },
          'RightLeg': { x: [-90, 10], y: [-20, 20], z: [-20, 20], primary: 'x' },
          'LeftFoot': { x: [-35, 35], y: [-20, 20], z: [-20, 20], primary: 'x' },
          'RightFoot': { x: [-35, 35], y: [-20, 20], z: [-20, 20], primary: 'x' },
        };
        return { ok: true, result: ranges };
      }
      default:
        console.warn('Unknown tool:', name);
        return { ok: false, error: `Unknown tool: ${name}` };
    }
    return { ok: true };
  } catch (err: any) {
    console.warn('Tool execution error:', err);
    return { ok: false, error: String(err?.message || err) };
  }
}

// Clear conversation history
export function clearConversation(): void {
  conversation = [];
  isProcessing = false;
}

// Get current conversation
export function getConversation(): ConversationMessage[] {
  return [...conversation];
}

// Check if currently processing
export function isCurrentlyProcessing(): boolean {
  return isProcessing;
}




