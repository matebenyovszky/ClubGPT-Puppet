Update 2026.01.11.: I open source this, but I do not plan to continue (I have a new version on a totally different architecture). [Sample videos](https://www.youtube.com/playlist?list=PLAKNcEe8hRMllqKaLAeT6KAO-U4WntnCR)

# Puppet - AI‑Driven Avatar Project

## 1. Goal

Build a web‑based, responsive 3D experience where a humanoid avatar is controlled by a Large Language Model (LLM) through a simple, high‑level API. The LLM can dynamically change the avatar’s look (materials/colors) and motion (animations, custom poses).

## 2. Core Principles

- **AI‑First Design**: APIs, naming, and structure are designed to be easy for an AI to use and reason about.
- **Modularity**: Scene management and avatar control are split into clean, focused modules.
- **Engine**: We use [Babylon.js](https://www.babylonjs.com/) for its powerful graphics and tooling.

## 3. Project Structure (`/src`)

- `main.ts`: Entry point. Instantiates `App`.
- `app.ts`: Main application class. Creates the Babylon engine/scene and the `AvatarController`. Exposes the `window.puppet` API.
- `avatarController.ts`: The heart of the project – wraps Babylon specifics behind a simple, high‑level avatar control API.

## 4. Live Control API

During runtime, the browser’s dev console exposes a `window.puppet` object for simulating LLM tool calls.

### `puppet.performAction(action: string)`
Play a predefined animation. The method attempts to find the closest match by name.

```javascript
// Start walk animation
puppet.performAction("Walking")

// Start yawn animation
puppet.performAction("Yawn")

// Enter T‑Pose
puppet.performAction("TPose")
```

### `puppet.setMaterialColor(meshName: string, hexColor: string)`
Change a mesh’s material color.

```javascript
// Dress to pink
puppet.setMaterialColor("Saber_maid_dress", "#FF00FF")

// Hair to blue
puppet.setMaterialColor("F010_Saber_Hair.001", "#0000FF")
```

### `puppet.setBoneRotation(boneName: string, rotation: { x: number, y: number, z: number })`
Set a bone’s rotation (degrees).

```javascript
// Look left
puppet.setBoneRotation("Armature_mixamorig:Head", { x: 0, y: 30, z: 0 })

// Raise left arm sideways
puppet.setBoneRotation("Armature_mixamorig:LeftArm", { x: 0, y: 0, z: -90 })

// Bend right forearm
puppet.setBoneRotation("Armature_mixamorig:RightForeArm", { x: -70, y: 0, z: 0 })
```

### `puppet.stopAll()`
Stop all animations and reset the animation system.

```javascript
puppet.stopAll()
```

### `puppet.forceTPose()`
Force T‑pose for debugging (arms out to the side).

```javascript
puppet.forceTPose()
```

### 4.1 Smooth tweened motion for the LLM

#### `puppet.rotateBoneTo(boneName, eulerDeg, opts)`
- **boneName**: bone name (partial match allowed)
- **eulerDeg**: `{ x, y, z }` in degrees
- **opts**: `{ durationMs?, speedDegPerSec?, easing? }`, `easing` ∈ `{ "linear", "easeInOut" }` (default `easeInOut`)

```javascript
// 1.2s, ease‑in‑out
puppet.rotateBoneTo("Armature_mixamorig:Head", { x: 0, y: 45, z: 0 }, { durationMs: 1200 })

// Speed‑based (90°/s), ease‑in‑out
puppet.rotateBoneTo("Armature_mixamorig:LeftArm", { x: 0, y: 0, z: -90 }, { speedDegPerSec: 90, easing: "easeInOut" })

// Linear interpolation
puppet.rotateBoneTo("Armature_mixamorig:Neck", { x: 10, y: 0, z: 0 }, { durationMs: 800, easing: "linear" })
```

#### `puppet.moveRootTo(target, speedMetersPerSec, easing?)`
- **target**: `{ x, y, z }`
- **speedMetersPerSec**: e.g. `1.0`
- **easing**: `"linear" | "easeInOut"` (default `easeInOut`)

```javascript
// 1 m/s, ease‑in‑out
puppet.moveRootTo({ x: 1.5, y: 0, z: -1.0 }, 1.0)

// Linear
puppet.moveRootTo({ x: 0, y: 0, z: 2 }, 0.5, "linear")
```

#### `puppet.stopTweens()`
Immediately stop all active tweens.

### 4.2 Debug overlay & manual chat (always available)
- The debug overlay auto‑appears when:
  - `DEV_MODE=true`, or
  - `localStorage.setItem('realtimeDebug','1')`, or
  - URL has `?debug=1`.
- Use the input at the top and press ENTER to send a message. This works regardless of connection state:
  - If the datachannel is OPEN → text goes to the Realtime API (audio+text if `MODE=sound`).
  - If NOT OPEN → we auto‑fallback to text `/api/chat` (your command still executes).

Note: modern browsers require a user gesture before playing audio. On first load a "Click to Start" button appears; click to start audio.

## 🔧 Critical technical note – Transform Node issue

**⚠️ IMPORTANT:** In Mixamo rigs and many GLTFs, bones are linked to **Transform Nodes**, which can block direct bone rotation from taking effect visually.

### Problem
- `bone.setRotationQuaternion()` changes may not show visually.
- Bone rotation values change, but the mesh does not update.
- Transform Node overrides bone transforms.

### Solution
```javascript
// BEFORE manipulating any bone:
const transformNode = bone.getTransformNode();
if (transformNode) {
  bone.linkTransformNode(null); // Unlink the Transform Node
}
// Now direct bone rotation works
bone.setRotationQuaternion(quaternion, Space.LOCAL);
```

### Implementation
`AvatarController.setBoneRotation()` automatically unlinks Transform Nodes when needed:
```javascript
const transformNode = bone.getTransformNode();
if (transformNode) {
  console.log(`Transform Node detected for ${boneName}, unlinking...`);
  bone.linkTransformNode(null);
}
```

## 5. How to run

1) Install dependencies
```bash
npm install
```
2) Start dev server
```bash
npm run dev
```
3) Open the printed localhost URL in the browser

## 6. AI integration – plan (Grok 4, GPT‑5)

### 6.1 Goal
- Real‑time voice while issuing tool calls in parallel.
- All operations map to `window.puppet`; transitions are tweened, not jumps.

### 6.2 Model capabilities (summary)

| Model | Streaming audio | Parallel tool calls | Voice+Tools together | Mini version |
|---|---|---|---|---|
| Grok 4 (xAI) | Yes (voice mode, realtime) | Yes (native, RL‑based) | Yes | No official mini noted |
| GPT‑5 (OpenAI) | Yes (Realtime API) | Yes (sequence/parallel) | Yes | GPT‑5 mini: tools supported, audio limited |

Note: for simultaneous behavior we maintain our own client loop/threading.

### 6.3 Architecture
- Browser (Babylon.js) ⇄ AI Gateway (Node/Edge) ⇄ LLM Realtime API
- Audio I/O: WebRTC/WS – mic in → LLM, speech out → playback
- Tool calls: Gateway exposes a "tool adapter"; the browser receives commands and maps to `window.puppet`
- Concurrency: every command gets `id`, `ts`, `priority`; the client queues tweens with last‑write wins per bone/root

### 6.4 Tool (function) schema – example
```json
{
  "name": "rotateBoneTo",
  "description": "Rotate a bone to target Euler degrees using tweened motion.",
  "parameters": {
    "type": "object",
    "properties": {
      "bone": { "type": "string" },
      "x": { "type": "number" },
      "y": { "type": "number" },
      "z": { "type": "number" },
      "durationMs": { "type": "number", "minimum": 0 },
      "speedDegPerSec": { "type": "number", "minimum": 1 },
      "easing": { "type": "string", "enum": ["linear", "easeInOut"] }
    },
    "required": ["bone", "x", "y", "z"]
  }
}
```
Other tools in the same pattern:
- `moveRootTo(targetX, targetY, targetZ, speedMetersPerSec, easing)`
- `performAction(name)`
- `setMaterialColor(meshName, hexHex)`
- `stopTweens()`

### 6.5 Client adapter (browser)
- WS message format: `{ type: "tool", name: "rotateBoneTo", args: {...}, id }`
- On receive: call `window.puppet[name](...mappedArgs)`
- Acknowledge: `{ id, ok: true }` or `{ id, ok: false, error }`

### 6.6 GPT‑5 Realtime API – sketch
- Connection: Realtime WS/WebRTC
- Audio: 16‑bit/24kHz PCM; automatic function calling; parallel chains
- Gateway: token handling, tool call queueing, idempotency

### 6.7 Grok 4 (xAI) voice mode – sketch
- Voice stream ⇄ Grok 4 with RL‑based tool usage
- Gateway maps Grok tool calls to our JSON schema and forwards to the client

### 6.8 Prompt guidance (LLM)
- Provide bone name patterns in context (e.g., `Armature_mixamorig:Head`, `...:LeftArm`)
- Keep commands idempotent; one motion = one tool call
- For look targets use `lookAt` or `rotateBoneTo` appropriately

### 6.9 Test scenario
1) “Rotate the head 45° right in 1.2s” → `rotateBoneTo(Head, {y:45}, {durationMs:1200})`
2) “Walk forward 2 meters at 1 m/s” → `moveRootTo({x:0,z:-2}, 1.0)`
3) “Stop and cancel transitions” → `stopTweens()`

### 6.10 Next steps
- Build AI Gateway (Node + WS) with tool proxy
- Model hookups: GPT‑5 Realtime, then Grok 4 voice
- Telemetry: command latency, success rate, tween queue size

## 7. Memory (shopping cart) feature

- **What**: A simple client‑side memory list for storing important items (preferences, reminders, shopping intents). The Hungarian phrase “tedd a kosárba” is auto‑captured.
- **Where**: bottom‑left box listing `date`, `ID`, `weight`, `text`
- **Schema**:
  - `date`: epoch ms (auto)
  - `id`: incremental id
  - `weight`: importance score
  - `text`: the stored text
- **Storage**: `localStorage` under `clubgpt.memory`
- **Dev API (console):**
```javascript
memory.list()
memory.add('piros alma', 2)
memory.update(1, { weight: 3, text: 'zöld alma' })
memory.remove(1)
```
- **AI tools**:
  - `memory_add({ text, weight? })`
  - `memory_update({ id, text?, weight? })`
  - `memory_delete({ id })`
  - `memory_list({})`
- **Proactive saving**:
  - The AI may proactively save important details using `memory_add`
  - “tedd a kosárba” is auto‑captured from ASR and text inputs
- **Personality**:
  - Cute, warm, and brief replies
 
## 8. Environment variables & runtime configuration

On load the browser fetches `/api/config`. In dev this is served by Vite; in production by the Cloudflare Function.

### 8.1 Dev – quick env management

Use the helper script to edit `.env.local`. See `env-example.txt` for keys and examples.

```bash
npm run env:set KEY=VALUE [KEY=VALUE ...]
npm run env:print
```

#### Test configs menu
```bash
npm run test:config
```
Choose from:
- 🎨 Themes: Neon Purple, Deep Teal, custom colors
- 🎵 Modes: Sound, Text‑only
- ⚙️ Features: Debug mode, Memory, Lipsync, Avatar overrides
- 🔄 Combinations: common setups
- 🎯 Presets: Production, Dev full debug, Minimal text chat

Examples:
```bash
# Text‑only (no mic/audio) + debug overlay, memory off
npm run env:set MODE=text DEV_MODE=true MEMORY_ENABLED=false

# Avatar URL and theme overrides
npm run env:set AVATAR_URL=/models/avatar.glb AVATAR_SCALE=1.8 THEME.backgroundHex=#000000

# Theme preset
npm run env:set THEME_NAME=neon_purple
```

Start:
```bash
npm run dev
```

### 8.2 Keys

- `MODE`: `sound` | `text`
  - `sound`: full audio + mic (Realtime API)
  - `text`: text‑only (no audio/mic) (Chat API)
- `DEV_MODE`: `true`/`false` (debug overlay)
- `MEMORY_ENABLED`: `true`/`false` (bottom‑left memory box)
- `LIPSYNC_ENABLED`: `true`/`false` (amplitude‑driven lipsync)
- `AVATAR_URL`: path to `.glb`
- `AVATAR_SCALE`: number (e.g. `1.8`)
- `REALTIME_MODEL`: e.g. `gpt-realtime`
- `REALTIME_VOICE`: e.g. `shimmer` (options: alloy, ash, ballad, coral, echo, sage, shimmer, verse)

#### Theme keys
Use with `THEME_` prefix, combinable with presets:
- `THEME_BACKGROUNDHEX`, `THEME_FOGHEX`, `THEME_FOGDENSITY`
- `THEME_GRIDMAINHEX`, `THEME_GRIDLINEHEX`, `THEME_GRIDOPACITY`
- `THEME_FLOORHEX`, `THEME_FLOORSPECULARHEX`, `THEME_GLOWINTENSITY`
- `THEME_SPOTLIGHT1HEX`..`THEME_SPOTLIGHT6HEX`
- `THEME_ORB1HEX`..`THEME_ORB5HEX`
- `THEME_TRIANGLEHEX`
- `THEME_SINEWAVE1HEX`, `THEME_SINEWAVE2HEX`, `THEME_SINEWAVE3HEX`
- `THEME_PARTICLERAYHEX`
- `THEME_DRESSBASEHEX`, `THEME_DRESSEMISSIVEHEX`
- `THEME_HAIRHEX`, `THEME_HAIREMISSIVEHEX`
- `THEME_SKINHEX`, `THEME_SKINEMISSIVEHEX`

#### Theme presets
- `THEME_NAME=neon_purple`
- `THEME_NAME=deep_teal`

### 8.3 /api/config (Cloudflare) and dev route

- Cloudflare: `functions/api/config.ts` reads Worker env and returns JSON
- Dev: `vite.config.ts` serves the same schema from process env

Example response:
```json
{
  "mode": "text",
  "devMode": true,
  "memoryEnabled": false,
  "lipsync": true,
  "themeName": "neon_purple",
  "avatarUrl": "/models/avatar.glb",
  "avatarScale": 1.8,
  "theme": { "backgroundHex": "#000000" }
}
```

### 8.4 Text mode details

If `MODE=text`, we use the standard OpenAI Chat Completions API (e.g., `gpt-4.1-mini`) instead of Realtime/WebRTC.

- **Endpoint**: `/api/chat` (Cloudflare) or dev middleware
- **Pros**: no mic permission required, simpler setup, more predictable API
- **Cons**: no real‑time audio or lipsync, slower responses

All tools (move avatar, change theme, memory) are supported via text responses.

### 8.5 Theme propagation

Theme settings affect (in real time):
- Background and fog color/density
- Floor colors, Glow intensity
- Grid backdrops (GridMaterial) main/line/opacity
- Moving spotlights (6 colors)
- Orbs (5 colors), particle rays
- Triangle meshes, 3‑tube sine waves (3 distinct colors)
- Avatar default style (dress/hair/skin base + emissive)

Add a new theme by editing `src/themes.ts` and set `THEME_NAME` accordingly. Override any field with `THEME_*`.

### 8.6 Mic optional + fallback
- The microphone is **optional**. If the user **denies** it:
  - text input still works (debug overlay),
  - commands execute via **text fallback** (`/api/chat`),
  - meanwhile the client attempts to reconnect the realtime channel.

### 8.7 Datachannel auto‑reconnect
- If the datachannel **closes** or **errors**, the client backoffs and **restarts** the realtime session (few attempts).
- While disconnected, **text fallback** remains active so commands aren’t lost.

### 8.8 Realtime endpoints (quick ref)
- Mint session: `POST /api/realtime/session`
- Runtime config: `GET /api/config`
- Text chat: `POST /api/chat`

