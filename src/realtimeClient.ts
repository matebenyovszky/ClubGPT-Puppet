/*
  OpenAI Realtime WebRTC client for browser.
  - Auto-connect on startRealtime()
  - Streams mic audio to the model; plays model audio
  - Handles tool calls and maps them to window.puppet
  - Optional debug overlay to log transcripts and tool invocations
*/

type AnyEvent = Record<string, any>;

type StartOptions = {
    debug?: boolean;
    vadLevelThreshold?: number; // 0..1 amplitude gate for debug meter only
    enableLipSync?: boolean; // master switch for all lipsync features
};

const defaultOptions: Required<StartOptions> = {
    debug: false,
    vadLevelThreshold: 0.05,
    enableLipSync: false,
};

let currentMode: 'sound' | 'text' = 'sound';
export function setRealtimeMode(mode: 'sound' | 'text') { currentMode = mode; }

let pc: RTCPeerConnection | null = null;
let dc: RTCDataChannel | null = null;
let remoteAudioEl: HTMLAudioElement | null = null;
let micStream: MediaStream | null = null;
let analyser: AnalyserNode | null = null;
let micLevelLoopHandle: number | null = null;
let debugInputBound = false;

const pendingToolCalls = new Map<string, { name: string; args: string; itemId?: string }>();

// Memory helpers
import { addMemory, updateMemory, deleteMemory, listMemory, captureBasketFromText, cleanupMemory } from './memory';

// === LipSync configuration (viseme mapping & timing) ===
const lipVisemeMap: Record<string, { open: number; wide: number; round: number }> = {
    // approximations for Latin scripts (can extend per language later)
    A: { open: 0.9, wide: 0.2, round: 0.1 },
    E: { open: 0.8, wide: 0.4, round: 0.1 },
    I: { open: 0.7, wide: 0.6, round: 0.05 },
    O: { open: 0.7, wide: 0.2, round: 0.7 },
    U: { open: 0.7, wide: 0.15, round: 0.8 },
    // Hungarian specifics
    Á: { open: 1.0, wide: 0.25, round: 0.1 },
    É: { open: 0.9, wide: 0.5, round: 0.1 },
    Í: { open: 0.7, wide: 0.65, round: 0.05 },
    Ó: { open: 0.75, wide: 0.2, round: 0.8 },
    Ö: { open: 0.65, wide: 0.25, round: 0.9 },
    Ő: { open: 0.65, wide: 0.25, round: 0.95 },
    Ú: { open: 0.7, wide: 0.15, round: 0.85 },
    Ü: { open: 0.65, wide: 0.2, round: 0.95 },
    Ű: { open: 0.65, wide: 0.2, round: 1.0 },
    // consonant groups (approximate)
    M: { open: 0.1, wide: 0.2, round: 0.2 },
    B: { open: 0.2, wide: 0.3, round: 0.1 },
    P: { open: 0.2, wide: 0.3, round: 0.1 },
    F: { open: 0.25, wide: 0.45, round: 0.05 },
    V: { open: 0.25, wide: 0.45, round: 0.05 },
    L: { open: 0.3, wide: 0.6, round: 0.05 },
    R: { open: 0.35, wide: 0.55, round: 0.05 },
    S: { open: 0.25, wide: 0.5, round: 0.05 },
    Z: { open: 0.25, wide: 0.5, round: 0.05 },
    T: { open: 0.25, wide: 0.4, round: 0.05 },
    D: { open: 0.25, wide: 0.4, round: 0.05 },
    K: { open: 0.3, wide: 0.3, round: 0.05 },
    G: { open: 0.3, wide: 0.3, round: 0.05 },
    N: { open: 0.25, wide: 0.35, round: 0.05 },
    H: { open: 0.35, wide: 0.25, round: 0.05 },
    W: { open: 0.3, wide: 0.2, round: 0.7 },
    Q: { open: 0.4, wide: 0.2, round: 0.6 },
    C: { open: 0.25, wide: 0.45, round: 0.05 },
    J: { open: 0.25, wide: 0.45, round: 0.05 },
    Y: { open: 0.45, wide: 0.5, round: 0.05 },
};
const lipConfig = {
    frameMs: 30,          // drive ~33fps from deltas
    minHoldMs: 40,        // minimal viseme hold
    easeMs: 40,           // transition time between visemes
    idle: { open: 0.04, wide: 0.05, round: 0.05 },
};

// Output audio amplitude driver
let outCtx: AudioContext | null = null;
let outAnalyser: AnalyserNode | null = null;
let outLevelLoop: number | null = null;
let outEnv = 0; // smoothed amplitude 0..1
let lipSyncEnabled = false; // runtime flag
let reconnecting = false;
let reconnectAttempts = 0;
let lastStartOptions: StartOptions | undefined;

async function scheduleReconnect(why: string, opt?: StartOptions) {
    if (currentMode === 'text') return; // In text mode we intentionally don't open WebRTC
    if (reconnecting) return;
    reconnecting = true;
    const backoffMs = Math.min(2000, 300 * Math.pow(2, reconnectAttempts));
    reconnectAttempts = Math.min(reconnectAttempts + 1, 5);
    debugLog(`reconnect scheduled in ${backoffMs}ms (${why})`, opt);
    try { await new Promise(r => setTimeout(r, backoffMs)); } catch {}
    try {
        stopRealtime();
        await startRealtime(lastStartOptions);
        debugLog('reconnect attempt done', opt);
    } catch (err: any) {
        debugLog(`reconnect failed: ${String(err?.message || err)}`, opt);
    } finally {
        reconnecting = false;
    }
}

function isDebugEnabled(opt?: StartOptions): boolean {
    if (opt && typeof opt.debug === 'boolean') return opt.debug;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('realtimeDebug') === '1') return true;
    if (typeof location !== 'undefined' && /[?&]debug=1/i.test(location.search)) return true;
    return false;
}

function ensureDebugOverlay(): HTMLElement {
    let root = document.getElementById('realtimeDebug');
    if (!root) {
        root = document.createElement('div');
        root.id = 'realtimeDebug';
        root.style.position = 'fixed';
        root.style.right = '8px';
        root.style.bottom = '8px';
        root.style.left = '8px'; // Prevent overflow on mobile
        root.style.zIndex = '9999';
        root.style.background = 'rgba(0,0,0,0.55)';
        root.style.color = '#fff';
        root.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
        root.style.fontSize = '11px';
        root.style.lineHeight = '1.35';
        root.style.padding = '8px 10px';
        root.style.borderRadius = '8px';
        root.style.maxWidth = 'calc(100vw - 16px)'; // Never wider than viewport
        root.style.maxHeight = '40vh';
        root.style.overflow = 'auto';
        root.style.whiteSpace = 'pre-wrap';
        root.style.wordBreak = 'break-word'; // Break long words on mobile
        root.style.overflowWrap = 'break-word'; // Break long text
        root.style.boxSizing = 'border-box'; // Include padding in width calculation
        root.style.pointerEvents = 'auto';
        const bar = document.createElement('div');
        bar.id = 'realtimeDebugMic';
        bar.style.height = '4px';
        bar.style.background = '#444';
        bar.style.borderRadius = '2px';
        bar.style.marginBottom = '6px';
        const inner = document.createElement('div');
        inner.id = 'realtimeDebugMicLevel';
        inner.style.height = '100%';
        inner.style.width = '0%';
        inner.style.background = '#0f0';
        inner.style.borderRadius = '2px';
        bar.appendChild(inner);
        root.appendChild(bar);

        const inputWrap = document.createElement('div');
        inputWrap.id = 'realtimeDebugInputWrap';
        inputWrap.style.display = 'flex';
        inputWrap.style.gap = '6px';
        inputWrap.style.margin = '6px 0 6px 0';

        const input = document.createElement('input');
        input.id = 'realtimeDebugInput';
        input.type = 'text';
        input.placeholder = 'Type text → Enter to send';
        input.style.flex = '1 1 auto';
        input.style.border = '1px solid #666';
        input.style.borderRadius = '4px';
        input.style.padding = '4px 6px';
        input.style.background = 'rgba(30,30,30,0.8)';
        input.style.color = '#fff';

        const sendBtn = document.createElement('button');
        sendBtn.id = 'realtimeDebugSend';
        sendBtn.textContent = 'Send';
        sendBtn.style.flex = '0 0 auto';
        sendBtn.style.border = '1px solid #666';
        sendBtn.style.borderRadius = '4px';
        sendBtn.style.padding = '4px 8px';
        sendBtn.style.background = 'rgba(50,50,50,0.9)';
        sendBtn.style.color = '#fff';

        inputWrap.appendChild(input);
        inputWrap.appendChild(sendBtn);
        root.appendChild(inputWrap);

        const feed = document.createElement('div');
        feed.id = 'realtimeDebugFeed';
        root.appendChild(feed);
        document.body.appendChild(root);
    }
    return root;
}

function debugLog(message: string, opt?: StartOptions) {
    if (!isDebugEnabled(opt)) return;
    const root = ensureDebugOverlay();
    const feed = root.querySelector('#realtimeDebugFeed')! as HTMLDivElement;
    const ts = new Date().toISOString().split('T')[1]!.replace('Z', '');
    const line = document.createElement('div');
    line.textContent = `[${ts}] ${message}`;
    feed.appendChild(line);
    // Trim lines
    while (feed.childNodes.length > 200) feed.removeChild(feed.firstChild!);
    feed.scrollTop = feed.scrollHeight;
    // Mirror to console for easier debugging
    console.log(`[rt-debug] ${message}`);
}

function updateMicLevel(level: number, opt?: StartOptions) {
    if (!isDebugEnabled(opt)) return;
    const root = ensureDebugOverlay();
    const barInner = root.querySelector('#realtimeDebugMicLevel') as HTMLDivElement | null;
    if (!barInner) return;
    const pct = Math.max(0, Math.min(1, level)) * 100;
    barInner.style.width = `${pct.toFixed(1)}%`;
    barInner.style.background = level >= (opt?.vadLevelThreshold ?? defaultOptions.vadLevelThreshold) ? '#0f0' : '#6a6';
}

async function getEphemeralSession(): Promise<{ token: string; model: string; voice?: string }>
{
    const res = await fetch('/api/realtime/session', { method: 'POST' });
    if (!res.ok) throw new Error(`Failed to mint ephemeral session: ${res.status}`);
    const json = await res.json();
    const token: string | undefined = json?.client_secret?.value;
    if (!token) throw new Error('No client_secret.value in session response');
    const model: string = json?.model || 'gpt-realtime';
    const voice: string | undefined = json?.voice;
    return { token, model, voice };
}

function mapToolToPuppet(name: string, args: any, opt?: StartOptions): any {
    try {
        // Log every tool execution attempt
        try { console.log('[tool:exec]', name, args); } catch {}
        switch (name) {
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
                // Include current memory snapshot
                const memories = listMemory();
                const result = { bones, animations, meshes, tools, api, memories };
                debugLog(`tool get_scene_info → bones=${bones.length}, anims=${animations.length}, meshes=${meshes.length}, memories=${memories.length}`, opt);
                return { ok: true, result };
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
                try { (window as any).puppet?.setTheme?.(theme); } catch {}
                debugLog(`tool set_theme`, opt);
                return { ok: true };
            }
            case 'perform_action': {
                const anim = String(args?.name ?? 'Idle');
                (window as any).puppet?.performAction?.(anim);
                debugLog(`tool perform_action → ${anim}`, opt);
                return { ok: true };
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
                debugLog(`tool rotate_bone_to → ${bone} (${x},${y},${z})`, opt);
                return { ok: true };
            }
            case 'move_root_to': {
                const x = Number(args?.x ?? 0);
                const y = Number(args?.y ?? 0);
                const z = Number(args?.z ?? 0);
                const speedMetersPerSec = args?.speedMetersPerSec != null ? Number(args.speedMetersPerSec) : undefined;
                (window as any).puppet?.moveRootTo?.({ x, y, z }, speedMetersPerSec);
                debugLog(`tool move_root_to → (${x},${y},${z}) @ ${speedMetersPerSec ?? 'default'} m/s`, opt);
                return { ok: true };
            }
            case 'set_material_color': {
                const meshName = String(args?.meshName ?? 'Saber_maid_dress');
                const hex = String(args?.hexColor ?? '#ffffff');
                (window as any).puppet?.setMaterialColor?.(meshName, hex);
                debugLog(`tool set_material_color → ${meshName} ${hex}`, opt);
                return { ok: true };
            }
            case 'set_material_style': {
                const meshName = String(args?.meshName ?? 'Saber_maid_dress');
                const hex = args?.hex;
                const metallic = args?.metallic != null ? Number(args.metallic) : undefined;
                const roughness = args?.roughness != null ? Number(args.roughness) : undefined;
                const emissiveHex = args?.emissiveHex;
                const alpha = args?.alpha != null ? Number(args.alpha) : undefined;
                const style: any = {};
                if (hex != null) style.hex = String(hex);
                if (metallic != null) style.metallic = metallic;
                if (roughness != null) style.roughness = roughness;
                if (emissiveHex != null) style.emissiveHex = String(emissiveHex);
                if (alpha != null) style.alpha = alpha;
                (window as any).puppet?.setMaterialStyle?.(meshName, style);
                debugLog(`tool set_material_style → ${meshName} ${JSON.stringify(style)}`, opt);
                return { ok: true };
            }
            case 'stop_tweens': {
                (window as any).puppet?.stopTweens?.();
                debugLog(`tool stop_tweens`, opt);
                return { ok: true };
            }
            case 'stop_all': {
                (window as any).puppet?.stopAll?.();
                debugLog(`tool stop_all`, opt);
                return { ok: true };
            }
            case 'look_at': {
                const targetX = Number(args?.targetX ?? 0);
                const targetY = Number(args?.targetY ?? 1.5);
                const targetZ = Number(args?.targetZ ?? 0);
                const boneHint = args?.boneHint != null ? String(args.boneHint) : undefined;
                (window as any).puppet?.lookAt?.({ x: targetX, y: targetY, z: targetZ }, boneHint);
                debugLog(`tool look_at → (${targetX},${targetY},${targetZ}) bone=${boneHint ?? 'Head'}`, opt);
                return { ok: true };
            }
            // --- Memory tools ---
            case 'memory_add': {
                const text = String(args?.text ?? '');
                const weight = args?.weight != null ? Number(args.weight) : 1;
                const item = addMemory(text, weight);
                debugLog(`tool memory_add → #${item.id} w=${item.weight} ${text}`, opt);
                return { ok: true, result: item };
            }
            case 'memory_update': {
                const id = Number(args?.id);
                if (!Number.isFinite(id)) return { ok: false, error: 'id required' };
                const next = updateMemory(id, { text: args?.text, weight: args?.weight });
                if (!next) return { ok: false, error: 'not found' };
                debugLog(`tool memory_update → #${id}`, opt);
                return { ok: true, result: next };
            }
            case 'memory_delete': {
                const id = Number(args?.id);
                if (!Number.isFinite(id)) return { ok: false, error: 'id required' };
                const ok = deleteMemory(id);
                debugLog(`tool memory_delete → #${id} ${ok ? 'deleted' : 'not-found'}`, opt);
                return { ok };
            }
            case 'memory_list': {
                const items = listMemory();
                debugLog(`tool memory_list → ${items.length} items`, opt);
                return { ok: true, result: items };
            }
            default:
                debugLog(`tool UNKNOWN: ${name}`, opt);
                try { console.warn('[tool:unknown]', name, args); } catch {}
                return { ok: false, error: `Unknown tool: ${name}` };
        }
    } catch (err: any) {
        debugLog(`tool ${name} ERROR: ${String(err?.message || err)}`, opt);
        try { console.error('[tool:error]', name, args, err); } catch {}
        return { ok: false, error: String(err?.message || err) };
    }
}

function sendEvent(ev: AnyEvent) {
    if (!dc || dc.readyState !== 'open') return;
    try {
        dc.send(JSON.stringify(ev));
    } catch (_) {}
}

function setupDebugInputHandlers(opt?: StartOptions) {
    if (!isDebugEnabled(opt) && currentMode !== 'text') return;
    if (debugInputBound) return;
    const root = ensureDebugOverlay();
    const input = root.querySelector('#realtimeDebugInput') as HTMLInputElement | null;
    const sendBtn = root.querySelector('#realtimeDebugSend') as HTMLButtonElement | null;
    if (!input || !sendBtn) return;

    const handler = async () => {
        const text = (input.value || '').trim();
        if (!text) return;

        // Auto-capture Hungarian cart phrase (always)
        try { captureBasketFromText(text); } catch {}

        // Note: Memory capture disabled from manual input to prevent duplicates
        // AI should use memory_add tool explicitly when needed
        // Periodic cleanup
        try {
            if (Math.random() < 0.1) { // ~10% chance
                cleanupMemory(15); // Keep only top 15 most important items
            }
        } catch {}

        try {
            if (currentMode === 'text') {
                // Use text chat client
                const { sendTextMessage, isCurrentlyProcessing } = await import('./textChatClient');
                if (isCurrentlyProcessing()) {
                    debugLog('Already processing a message...', opt);
                    return;
                }
                debugLog(`USER » ${text}`, opt);
                const response = await sendTextMessage(text);
                if (response) {
                    debugLog(`AI » ${response}`, opt);
                }
            } else {
                // Use realtime API
                sendTextToModel(text, opt);
            }
        } catch (err: any) {
            debugLog(`Message send failed: ${err.message}`, opt);
        }

        input.value = '';
    };

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handler();
    });
    sendBtn.addEventListener('click', handler);
    debugInputBound = true;
}

function sendTextToModel(text: string, opt?: StartOptions) {
    if (!dc || dc.readyState !== 'open') {
        debugLog(`TXT fallback: datachannel not open → using /api/chat`, opt);
        scheduleReconnect('sendTextToModel', opt);
        // Fallback to text chat completions
        (async () => {
            try {
                const { sendTextMessage } = await import('./textChatClient');
                const reply = await sendTextMessage(text);
                if (reply) debugLog(`AI » ${reply}`, opt);
            } catch (err: any) {
                debugLog(`TXT fallback ERROR: ${String(err?.message || err)}`, opt);
            }
        })();
        return;
    }
    debugLog(`USER » ${text}`, opt);
    sendEvent({
        type: 'conversation.item.create',
        item: {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text }]
        }
    });
    sendEvent({
        type: 'response.create',
        response: { modalities: (currentMode === 'sound') ? ['audio', 'text'] : ['text'] }
    });
}

function handleServerEvent(ev: AnyEvent, opt?: StartOptions) {
    const t = ev?.type;
    if (!t) return;

    switch (t) {
        case 'session.created':
            debugLog('session.created', opt);
            break;
        case 'conversation.item.input_audio_transcription.delta': {
            // ASR delta text - not displayed to avoid cluttering the chat
            // const text = ev?.delta ?? '';
            // if (text) debugLog(`ASR Δ ${text}`, opt);
            break;
        }
        case 'conversation.item.input_audio_transcription.done':
        case 'conversation.item.input_audio_transcription.completed': {
            const tx = ev?.transcript ?? ev?.text ?? '';
            if (tx) debugLog(`ASR ✔ ${tx}`, opt);
            // Auto-capture Hungarian cart phrase from ASR (always)
            try { captureBasketFromText(tx); } catch {}
            // Note: Automatic memory capture disabled - AI should use memory_add tool
            // Periodic cleanup
            try {
                if (Math.random() < 0.05) { // ~5% chance for ASR
                    cleanupMemory(15);
                }
            } catch {}
            break;
        }
        case 'response.audio_transcript.delta': {
            const delta = ev?.delta ?? '';
            if (delta) driveLipsFromTextDelta(delta);
            break;
        }
        case 'response.audio_transcript.done': {
            const transcript = ev?.transcript ?? '';
            if (transcript) relaxLipsSoon();
            break;
        }
        case 'response.text.delta': {
            const d = ev?.delta ?? '';
            if (d) debugLog(`TXT Δ ${d}`, opt);
            break;
        }
        case 'response.text.done': {
            const text = ev?.text ?? '';
            if (text) debugLog(`TXT ✔ ${text}`, opt);
            break;
        }
        case 'response.output_item.added': {
            const item = ev?.item;
            if (item?.type === 'function_call') {
                const callId = item?.call_id || item?.id;
                const name = item?.name || 'unknown';
                if (callId) {
                    pendingToolCalls.set(callId, { name, args: '', itemId: item?.id });
                    debugLog(`FCALL ${name} (${callId})`, opt);
                    try { console.log('[tool:call-start]', name, callId); } catch {}
                }
            }
            break;
        }
        case 'response.function_call_arguments.delta': {
            const callId = ev?.call_id;
            const delta = ev?.delta ?? '';
            if (callId && pendingToolCalls.has(callId)) {
                const cur = pendingToolCalls.get(callId)!;
                cur.args += delta;
            }
            break;
        }
        case 'response.function_call_arguments.done': {
            const callId = ev?.call_id;
            const finalArgs = ev?.arguments ?? '';
            const rec = callId ? pendingToolCalls.get(callId) : undefined;
            const name = rec?.name ?? 'unknown';
            let argsObj: any = {};
            try { argsObj = finalArgs ? JSON.parse(finalArgs) : {}; } catch {}
            debugLog(`FCALL ✔ ${name} args=${finalArgs || '{}'} (${callId})`, opt);
            try { console.log('[tool:call-args]', name, callId, argsObj); } catch {}

            // Execute locally
            const result = mapToolToPuppet(name, argsObj, opt);
            try { console.log('[tool:call-result]', name, callId, result); } catch {}

            // Send tool output back so the model can continue
            if (callId) {
                sendEvent({
                    type: 'conversation.item.create',
                    item: {
                        type: 'function_call_output',
                        call_id: callId,
                        output: JSON.stringify(result)
                    }
                });
                // Ask model to continue (fallback to text-only if dc not open)
                if (dc && dc.readyState === 'open') {
                    sendEvent({ type: 'response.create', response: { modalities: (currentMode === 'sound') ? ['audio', 'text'] : ['text'] } });
                } else {
                    debugLog('response.create skipped (dc closed) — actions executed locally', opt);
                }
                pendingToolCalls.delete(callId);
            }
            break;
        }
        case 'error': {
            const msg = ev?.error?.message || JSON.stringify(ev?.error || ev);
            debugLog(`SERVER ERROR: ${msg}`, opt);
            break;
        }
        default:
            // For deep debugging, uncomment:
            // debugLog(`EV ${t}`, opt);
            break;
    }
}

// --- Simple viseme-ish mapper using characters (approximate) ---
let lipsEaseTimer: number | null = null;
let visemeHoldUntil = 0;
const currentLipsShape = { open: 0, wide: 0, round: 0 };
function setLips(shape: { open?: number; wide?: number; round?: number }) {
    if (!lipSyncEnabled) return;
    currentLipsShape.open = shape.open ?? currentLipsShape.open;
    currentLipsShape.wide = shape.wide ?? currentLipsShape.wide;
    currentLipsShape.round = shape.round ?? currentLipsShape.round;
    try { (window as any).puppet?.setLips?.(currentLipsShape); } catch {}
}

function driveLipsFromTextDelta(delta: string) {
    if (!lipSyncEnabled) return;
    // Pick the last strong character from the delta and map to a viseme
    const s = delta.toUpperCase().replace(/[^A-ZÁÉÍÓÖŐÚÜŰ]/g, '');
    if (!s) return;
    const ch = s[s.length - 1];
    const vis = lipVisemeMap[ch] || lipConfig.idle;
    applyViseme(vis, lipConfig.easeMs);
}

function applyViseme(target: { open: number; wide: number; round: number }, easeMs: number) {
    // respect minimal hold to avoid flicker
    const now = performance.now();
    if (now < visemeHoldUntil) return;
    visemeHoldUntil = now + lipConfig.minHoldMs;
    if (lipsEaseTimer) cancelAnimationFrame(lipsEaseTimer);
    const from = { ...(currentLipsShape) };
    const start = now;
    const duration = Math.max(1, easeMs);
    const step = (tNow: number) => {
        const t = Math.min(1, (tNow - start) / duration);
        const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        const mix = (a: number, b: number) => a + (b - a) * e;
        setLips({
            open: mix(from.open, target.open),
            wide: mix(from.wide, target.wide),
            round: mix(from.round, target.round)
        });
        if (t < 1) { lipsEaseTimer = requestAnimationFrame(step); } else { lipsEaseTimer = null; }
    };
    lipsEaseTimer = requestAnimationFrame(step);
}

function relaxLipsSoon() {
    if (!lipSyncEnabled) return;
    applyViseme(lipConfig.idle, 80);
}

function startMicLevelMeter(stream: MediaStream, opt?: StartOptions) {
    if (!isDebugEnabled(opt)) return;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.fftSize);
    const loop = () => {
        if (!analyser) return;
        analyser.getByteTimeDomainData(buf);
        // Compute simple peak-to-peak amplitude normalized 0..1
        let min = 255, max = 0;
        for (let i = 0; i < buf.length; i++) { const v = buf[i]; if (v < min) min = v; if (v > max) max = v; }
        const amp = (max - min) / 255;
        updateMicLevel(amp, opt);
        micLevelLoopHandle = requestAnimationFrame(loop);
    };
    loop();
}

async function createPeerConnection(sessionToken: string, model: string, opt?: StartOptions) {
    pc = new RTCPeerConnection({
        iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
    });

    // Data channel for JSON events
    dc = pc.createDataChannel('oai-events');
    dc.onopen = () => { debugLog('datachannel open', opt); reconnectAttempts = 0; };
    dc.onclose = () => { debugLog('datachannel closed', opt); scheduleReconnect('onclose', opt); };
    dc.onerror = (e) => { debugLog(`datachannel error ${String((e as any)?.message || e)}`, opt); scheduleReconnect('onerror', opt); };
    dc.onmessage = (ev) => {
        try {
            const data = typeof ev.data === 'string' ? ev.data : '';
            if (!data) return;
            // Some implementations send NDJSON; handle both JSON and NDJSON
            const lines = data.split('\n').filter(Boolean);
            for (const line of lines) {
                const obj = JSON.parse(line);
                handleServerEvent(obj, opt);
            }
        } catch (err: any) {
            debugLog(`onmessage parse error: ${String(err?.message || err)}`, opt);
        }
    };

    // Remote audio sink (sound mode only)
    let remoteStream: MediaStream | null = null;
    if (currentMode === 'sound') {
        remoteAudioEl = document.getElementById('oai-remote-audio') as HTMLAudioElement | null;
        if (!remoteAudioEl) {
            remoteAudioEl = document.createElement('audio');
            remoteAudioEl.id = 'oai-remote-audio';
            remoteAudioEl.autoplay = true;
            (remoteAudioEl as any).playsInline = true;
            remoteAudioEl.style.display = 'none';
            document.body.appendChild(remoteAudioEl);
        }
        remoteStream = new MediaStream();
        remoteAudioEl.srcObject = remoteStream;
    }
    pc.ontrack = (event) => {
        try { event.streams[0]?.getAudioTracks().forEach(() => {}); } catch {}
        if (remoteStream) { remoteStream.addTrack(event.track); }
    };

    // Attach analyser to remote audio for amplitude-based lipsync fallback (sound mode only)
    try {
        if (currentMode === 'sound' && opt?.enableLipSync && remoteStream) {
            outCtx = outCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
            // Proactively resume the audio context to avoid being stuck in 'suspended'
            const tryResume = (why: string) => {
                try { outCtx?.resume(); debugLog(`outCtx.resume() → ${outCtx?.state} (${why})`, opt); } catch {}
            };
            if (outCtx.state === 'suspended') tryResume('init');
            outCtx.onstatechange = () => debugLog(`outCtx state → ${outCtx?.state}`, opt);
            // Resume on first interaction and when playback starts
            document.addEventListener('pointerdown', () => tryResume('pointerdown'), { once: true });
            document.addEventListener('keydown', () => tryResume('keydown'), { once: true });
            remoteAudioEl?.addEventListener('play', () => tryResume('remote play'));

            const src = outCtx.createMediaStreamSource(remoteStream);
            outAnalyser = outCtx.createAnalyser();
            outAnalyser.fftSize = 1024;
            src.connect(outAnalyser);
            const buf = new Uint8Array(outAnalyser.fftSize);
            const loop = () => {
                if (!outAnalyser) return;
                if (outCtx && outCtx.state === 'suspended') tryResume('meter loop');
                outAnalyser.getByteTimeDomainData(buf);
                let min = 255, max = 0;
                for (let i = 0; i < buf.length; i++) { const v = buf[i]; if (v < min) min = v; if (v > max) max = v; }
                const amp = (max - min) / 255; // 0..1
                const alpha = 0.35;
                outEnv = outEnv * (1 - alpha) + amp * alpha;
                const open = Math.min(1.2, Math.max(0.02, (outEnv - 0.02) * 2.8));
                const round = Math.max(0.0, Math.min(0.9, outEnv * 0.6));
                const wide = Math.max(0.0, 0.3 - outEnv * 0.25);
                applyViseme({ open, wide, round }, 24);
                outLevelLoop = requestAnimationFrame(loop);
            };
            if (outLevelLoop) cancelAnimationFrame(outLevelLoop);
            outLevelLoop = requestAnimationFrame(loop);
        }
    } catch {}

    // Mic source (sound mode only)
    if (currentMode === 'sound') {
        try {
            // Check and log permission status before asking
            if (navigator.permissions && typeof navigator.permissions.query === 'function') {
                try {
                    const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
                    debugLog(`mic permission state: ${permissionStatus.state}`, opt);
                    permissionStatus.onchange = () => debugLog(`mic permission state changed to: ${permissionStatus.state}`, opt);
                } catch (e) { debugLog('mic permission query failed', opt); }
            }
            micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
            micStream.getAudioTracks().forEach((t) => pc!.addTrack(t, micStream!));
            startMicLevelMeter(micStream, opt);
        } catch (err: any) {
            debugLog(`mic unavailable → continuing without mic (${String(err?.name || err)})`, opt);
        }
    }

    const offer = await pc.createOffer({ offerToReceiveAudio: currentMode === 'sound', offerToReceiveVideo: false } as any);
    await pc.setLocalDescription(offer);
    await waitForIceGatheringComplete(pc);

    const url = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${sessionToken}`,
            'Content-Type': 'application/sdp',
            'Accept': 'application/sdp',
            'OpenAI-Beta': 'realtime=v1'
        },
        body: pc.localDescription?.sdp || ''
    });
    const text = await resp.text();
    if (!(resp.ok && /^v=/m.test(text))) {
        const bodyText = text.length > 300 ? `${text.slice(0, 300)}...` : text;
        throw new Error(`webrtc SDP failed for model=${model} status=${resp.status} body=${bodyText}`);
    }
    const answer = text;
    await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    debugLog('webrtc connected', opt);

    // Re-affirm session configuration at connection time (optional, mirrors server-side config)
    sendEvent({ type: 'session.update', session: { tool_choice: 'auto' } });
}

function waitForIceGatheringComplete(conn: RTCPeerConnection): Promise<void> {
    if (conn.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise((resolve) => {
        function checkState() {
            if (conn.iceGatheringState === 'complete') {
                conn.removeEventListener('icegatheringstatechange', checkState as any);
                resolve();
            }
        }
        conn.addEventListener('icegatheringstatechange', checkState as any);
    });
}

export async function startRealtime(options?: StartOptions) {
    const opt: StartOptions = { ...defaultOptions, ...options };
    try {
        lastStartOptions = opt;
        lipSyncEnabled = !!opt.enableLipSync;
        // Always show debug overlay in text mode or when debug is enabled
        if (isDebugEnabled(opt) || currentMode === 'text') {
            ensureDebugOverlay();
            setupDebugInputHandlers(opt);
        }

        if (currentMode === 'text') {
            // Text mode: no WebRTC, just setup for text chat
            debugLog('text mode enabled - no realtime session', opt);
            return;
        }

        // Sound mode: setup WebRTC realtime session
        const { token, model } = await getEphemeralSession();
        await createPeerConnection(token, model, opt);
        debugLog('realtime session started', opt);
    } catch (err: any) {
        debugLog(`startRealtime ERROR: ${String(err?.message || err)}`, options);
    }
}

export function stopRealtime() {
    try { if (dc) { dc.close(); dc = null; } } catch {}
    try { if (pc) { pc.close(); pc = null; } } catch {}
    try { if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; } } catch {}
    try { if (micLevelLoopHandle != null) { cancelAnimationFrame(micLevelLoopHandle); micLevelLoopHandle = null; } } catch {}
    analyser = null;
    debugLog('realtime session stopped');
}

export function setRealtimeDebug(enabled: boolean) {
    try { localStorage.setItem('realtimeDebug', enabled ? '1' : '0'); } catch {}
}

// Optional: programmatic text send for debugging
export function sendDebugText(text: string) {
    sendTextToModel(text, { debug: isDebugEnabled(), vadLevelThreshold: defaultOptions.vadLevelThreshold });
}



