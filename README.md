# Puppet - AI-vezérelt Avatár Projekt

## 1. Célkitűzés (Goal)

A projekt célja egy web-alapú, reszponzív 3D-s alkalmazás létrehozása, amelyben egy humanoid avatárt egy Nagy Nyelvi Modell (LLM) képes irányítani egy egyszerű, magas szintű API-n keresztül. Az LLM képes legyen az avatár kinézetét (ruházat, színek) és mozgását (animációk, egyedi pózok) is dinamikusan változtatni.

## 2. Alapelvek (Core Principles)

- **AI-First Design:** A kódot, a változóneveket és az API-kat úgy alakítjuk ki, hogy egy mesterséges intelligencia számára a lehető legkönnyebben értelmezhető és használható legyen.
- **Modularitás:** A fő funkciókat (jelenetkezelés, avatárvezérlés) különálló, tiszta interfésszel rendelkező modulokba szervezzük.
- **Keretrendszer:** [Babylon.js](https://www.babylonjs.com/) 3D motort használjuk a fejlett grafikai és fizikai képességei miatt.

## 3. Projekt Struktúra (`/src`)

- `main.ts`: Az alkalmazás belépési pontja. Inicializálja az `App` osztályt.
- `app.ts`: A központi alkalmazás osztály. Felelős a Babylon.js motor, a jelenet létrehozásáért és az `AvatarController` példányosításáért. Itt található a `window.puppet` API "kihelyezése" is.
- `avatarController.ts`: A projekt lelke. Ez az osztály absztrahálja a Babylon.js-specifikus hívásokat, és egy egyszerű, magas szintű API-t biztosít az avatár teljes körű irányításához.

## 4. Élő Vezérlési API (Live Control API)

Az alkalmazás futása közben a böngésző fejlesztői konzoljából elérhető a `window.puppet` objektum, amelyen keresztül szimulálhatjuk az LLM parancsait.

### `puppet.performAction(action: string)`

Előre definiált animációk lejátszása. A metódus megpróbálja a `action` string alapján megtalálni a leginkább illeszkedő animációt.

**Példák (a jelenlegi Saber modellhez):**
```javascript
// Sétáló animáció indítása
puppet.performAction("Walking")

// Ásító animáció indítása
puppet.performAction("Yawn")

// T-Póz beállítása
puppet.performAction("TPose")
```

### `puppet.setMaterialColor(meshName: string, hexColor: string)`

Megváltoztatja egy adott `mesh` (3D objektum) anyagának színét.

**Példák (a jelenlegi Saber modellhez):**
```javascript
// A ruha színének beállítása pinkre
puppet.setMaterialColor("Saber_maid_dress", "#FF00FF")

// A haj színének beállítása kékre
puppet.setMaterialColor("F010_Saber_Hair.001", "#0000FF")
```

### `puppet.setBoneRotation(boneName: string, rotation: { x: number, y: number, z: number })`

Beállítja egy adott csont rotációját. A rotációt **fokokban** kell megadni.

**Példák (a jelenlegi Saber modellhez):**
```javascript
// Fej elfordítása balra
puppet.setBoneRotation("Armature_mixamorig:Head", { x: 0, y: 30, z: 0 })

// Bal kar felemelése oldalra
puppet.setBoneRotation("Armature_mixamorig:LeftArm", { x: 0, y: 0, z: -90 })

// Jobb alkar behajlítása
puppet.setBoneRotation("Armature_mixamorig:RightForeArm", { x: -70, y: 0, z: 0 })
```

### `puppet.stopAll()`

Megállítja az összes futó animációt és reseteli az animációs rendszert.

```javascript
// Minden animáció megállítása
puppet.stopAll()
```

### `puppet.forceTPose()`

Debug metódus, amely T-pózba állítja az avatárt (karok kinyújtva oldalra).

```javascript
// T-póz kényszerítése (debug)
puppet.forceTPose()
```

## 4.1 Gördülékeny (tweenelt) mozgatás az LLM számára

### `puppet.rotateBoneTo(boneName, eulerDeg, opts)`
- **boneName**: csontnév (részleges egyezés is ok)
- **eulerDeg**: `{ x, y, z }` fokokban
- **opts**: `{ durationMs?, speedDegPerSec?, easing? }`, ahol `easing` = `"linear" | "easeInOut"` (alap: `easeInOut`)

```javascript
// 1.2s alatt, ease-in-out
puppet.rotateBoneTo("Armature_mixamorig:Head", { x: 0, y: 45, z: 0 }, { durationMs: 1200 })

// Sebességalapú (90°/s), ease-in-out
puppet.rotateBoneTo("Armature_mixamorig:LeftArm", { x: 0, y: 0, z: -90 }, { speedDegPerSec: 90, easing: "easeInOut" })

// Lineáris interpoláció
puppet.rotateBoneTo("Armature_mixamorig:Neck", { x: 10, y: 0, z: 0 }, { durationMs: 800, easing: "linear" })
```

### `puppet.moveRootTo(target, speedMetersPerSec, easing?)`
- **target**: `{ x, y, z }`
- **speedMetersPerSec**: m/s érték (pl. `1.0`)
- **easing**: `"linear" | "easeInOut"` (alap: `easeInOut`)

```javascript
// 1 m/s tempóval, ease-in-out
puppet.moveRootTo({ x: 1.5, y: 0, z: -1.0 }, 1.0)

// Lineáris
puppet.moveRootTo({ x: 0, y: 0, z: 2 }, 0.5, "linear")
```

### `puppet.stopTweens()`
Minden folyamatban lévő tween azonnali leállítása.

## 🔧 **KRITIKUS TECHNIKAI MEGJEGYZÉS - Transform Node Probléma**

**⚠️ FONTOS:** Mixamo rigeknél és sok GLTF modellnél a csontok **Transform Node-okhoz** vannak csatolva, ami **blokkolja** a közvetlen bone rotációkat!

### A Probléma:
- `bone.setRotationQuaternion()` hívások **nem hatnak vizuálisan**
- A csont rotáció értékek **változnak**, de a mesh **nem frissül**
- Ez azért van, mert a Transform Node **felülírja** a bone transzformációkat

### A Megoldás:
```javascript
// MINDEN bone manipuláció előtt:
const transformNode = bone.getTransformNode();
if (transformNode) {
    bone.linkTransformNode(null);  // Transform Node leválasztása
}
// Most már működik a közvetlen bone rotáció
bone.setRotationQuaternion(quaternion, Space.LOCAL);
```

### Implementáció:
Az `AvatarController.setBoneRotation()` metódus automatikusan **leválasztja** a Transform Node-okat:
```javascript
// CRITICAL: Check for Transform Node blocking
const transformNode = bone.getTransformNode();
if (transformNode) {
    console.log(`Transform Node detected for ${boneName}, unlinking...`);
    bone.linkTransformNode(null);
}
```

**Ez a trükk nélkül a bone manipuláció NEM MŰKÖDIK!** 🚨

## 5. Futtatás (How to Run)

1.  **Függőségek telepítése:**
    ```bash
    npm install
    ```
2.  **Fejlesztői szerver indítása:**
    ```bash
    npm run dev
    ```
3.  **Megnyitás:** Nyisd meg a böngészőben a terminálban jelzett `localhost` címet.

## 6. AI integráció – Grok 4 és GPT‑5 (terv)

### 6.1 Cél
- Realtime, folyamatos beszéd (audio stream) közben az AI párhuzamosan hívja a vezérlő API-t.
- Minden műveletet a `window.puppet` API-ra képezünk le; az átmenetek tweenelve történnek, nem ugranak.

### 6.2 Modellek képességei (összefoglaló)

| Modell | Streaming audio | Párhuzamos tool hívás | Együttes (voice+tools) | Mini verzió |
|---|---|---|---|---|
| Grok 4 (xAI) | Igen (voice mode, realtime) | Igen (natív, RL-alapú) | Igen | Nincs hivatalos mini említve |
| GPT‑5 (OpenAI) | Igen (Realtime API) | Igen (sequence/parallel) | Igen | GPT‑5 mini: tool támogatott, audio korlátozott |

Megjegyzés: a simultán működéshez saját kliens‑szál/folyamkezelés kell (WS kapcsolat + háttér tool hívások).

### 6.3 Architektúra váz
- Böngésző (Babylon.js) ⇄ AI Gateway (Node/Edge) ⇄ LLM Realtime API.
- Audio I/O: WebRTC/WS (Realtime API) – mikrofon be → LLM, beszéd vissza → lejátszás.
- Tool hívások: a Gateway exponál egy „tool adaptert”, ami a böngésző felé `postMessage`/WS‑en parancsot küld; a kliens oldalt ezek a parancsok `window.puppet` hívásokká fordulnak.
- Párhuzamosság: minden parancs kap `id`, `ts` és `priority` mezőt; a kliens sorban tart, de tweenek összefésülhetők (utolsó nyer elv ugyanarra a csont/gyökér célra).

### 6.4 Tool (function) séma – javaslat
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
További eszközök ugyanebben a formában:
- `moveRootTo(targetX, targetY, targetZ, speedMetersPerSec, easing)`
- `performAction(name)`
- `setMaterialColor(meshName, hexHex)`
- `stopTweens()`

### 6.5 Kliens oldali adapter (böngésző)
- WS üzenet formátum: `{ type: "tool", name: "rotateBoneTo", args: {...}, id }`.
- Beérkezéskor: `window.puppet[name](...mappedArgs)` meghívása.
- Visszajelzés: `{ id, ok: true }` vagy `{ id, ok: false, error }`.

### 6.6 GPT‑5 Realtime API bekötés (vázlat)
- Kapcsolat: Realtime WS/WebRTC.
- Audio stream: 16‑bit/24kHz PCM; parancsok a tool‑schema alapján automatikus function callinggel (parallel chains engedélyezve).
- Gateway feladatai: token kezelés, tool‑hívások sorba állítása, idempotencia.

### 6.7 Grok 4 (xAI) voice mode bekötés (vázlat)
- Voice stream ⇄ Grok 4; közben RL‑alapú tool usage.
- Gateway a Grok tool‑hívásait ugyanarra a JSON sémára map‑peli, és továbbítja a kliensnek.

### 6.8 Prompt irányelvek (LLM)
- Kontextusban adjuk meg a csontnevek mintáit (pl. `Armature_mixamorig:Head`, `...:LeftArm`).
- Parancsok legyenek idempotensek; egy mozgás = 1 tool‑hívás.
- Ha célzott koordináta is van (pl. nézési cél), használja a `lookAt`‑ot vagy `rotateBoneTo`‑t kombinálva.

### 6.9 Teszt forgatókönyv
1) „Fordítsd a fejet 45°‑kal jobbra 1.2s alatt” → `rotateBoneTo(Head, {y:45}, {durationMs:1200})`.
2) „Sétálj előre 2 métert 1 m/s tempóval” → `moveRootTo({x:0,z:-2}, 1.0)`.
3) „Állj meg, állítsd le az átmeneteket” → `stopTweens()`.

### 6.10 Következő lépések
- AI Gateway skeleton (Node + WS) létrehozása, tool proxyval.
- Modellkapcsolatok: GPT‑5 Realtime, majd Grok 4 voice.
- Telemetria: parancs latency, sikerességi arány, tween queue méret.
