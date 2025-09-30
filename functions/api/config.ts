export async function onRequestGet(context: { request: Request; env: Record<string, string | undefined> }) {
  try {
    const e = context.env || {};

    // Helpers
    const bool = (v: string | undefined, def = false) => {
      if (v == null) return def;
      const s = String(v).trim().toLowerCase();
      return s === '1' || s === 'true' || s === 'yes' || s === 'on';
    };
    const num = (v: string | undefined, def: number) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : def;
    };
    const str = (v: string | undefined, def: string | undefined = undefined) => (v != null && String(v).length ? String(v) : def);

    // Modes: 'sound' | 'text'
    const modeRaw = (e.MODE || '').toLowerCase();
    const mode = modeRaw === 'text' ? 'text' : 'sound';

    // THEME_NAME allows selecting a preset on client
    const themeName = str(e.THEME_NAME, undefined);

    // Theme mapping (only include keys that are present to avoid over-writing client defaults)
    const themeKeys = [
      'backgroundHex','fogHex','fogDensity','gridMainHex','gridLineHex','gridOpacity','floorHex','floorSpecularHex','glowIntensity',
      'spotLight1Hex','spotLight2Hex','spotLight3Hex','spotLight4Hex','spotLight5Hex','spotLight6Hex',
      'orb1Hex','orb2Hex','orb3Hex','orb4Hex','orb5Hex','triangleHex','sineWave1Hex','sineWave2Hex','sineWave3Hex','particleRayHex',
      'dressBaseHex','dressEmissiveHex','hairHex','hairEmissiveHex','skinHex','skinEmissiveHex'
    ] as const;
    const theme: Record<string, any> = {};
    for (const k of themeKeys) {
      const envKey = `THEME_${k.toUpperCase()}`;
      const val = e[envKey];
      if (val != null && String(val).length) {
        // Numeric fields
        if (k === 'fogDensity' || k === 'gridOpacity' || k === 'glowIntensity') {
          const n = Number(val);
          if (Number.isFinite(n)) theme[k] = n;
        } else {
          theme[k] = String(val);
        }
      }
    }

    // Avatar
    const avatarUrl = str(e.AVATAR_URL, undefined);
    const avatarScale = e.AVATAR_SCALE != null ? num(e.AVATAR_SCALE, 1.8) : undefined;

    // Flags
    const memoryEnabled = e.MEMORY_ENABLED != null ? bool(e.MEMORY_ENABLED, true) : undefined;
    const devMode = e.DEV_MODE != null ? bool(e.DEV_MODE, false) : (mode === 'dev');
    const lipsync = e.LIPSYNC_ENABLED != null ? bool(e.LIPSYNC_ENABLED, false) : undefined;

    // Optional model/voice overrides for Realtime; client may ignore
    const realtimeModel = str(e.REALTIME_MODEL, undefined);
    const realtimeVoice = str(e.REALTIME_VOICE, undefined);

    const config = {
      mode,            // 'sound' | 'text' | 'dev'
      devMode,         // boolean
      memoryEnabled,   // boolean | undefined
      lipsync,         // boolean | undefined
      themeName,       // string | undefined
      avatarUrl,       // string | undefined
      avatarScale,     // number | undefined
      theme,           // Partial theme
      realtimeModel,
      realtimeVoice,
    };

    return Response.json(config);
  } catch (err: any) {
    return new Response(String(err?.message || err), { status: 500 });
  }
}


