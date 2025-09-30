export type ThemeConfig = Partial<{
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
}>;

export type RuntimeConfig = {
    mode: 'sound' | 'text';
    devMode: boolean;
    memoryEnabled?: boolean;
    lipsync?: boolean;
    themeName?: string;
    avatarUrl?: string;
    avatarScale?: number;
    theme?: ThemeConfig;
    realtimeModel?: string;
    realtimeVoice?: string;
};

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
    try {
        const res = await fetch('/api/config', { method: 'GET' });
        if (!res.ok) throw new Error(`cfg ${res.status}`);
        const json = await res.json();
        // Minimal shape validation
        const mode = json?.mode === 'text' ? 'text' : 'sound';
        const devMode = !!json?.devMode;
        const cfg: RuntimeConfig = {
            mode,
            devMode,
            memoryEnabled: typeof json?.memoryEnabled === 'boolean' ? json.memoryEnabled : undefined,
            lipsync: typeof json?.lipsync === 'boolean' ? json.lipsync : undefined,
            themeName: typeof json?.themeName === 'string' ? json.themeName : undefined,
            avatarUrl: typeof json?.avatarUrl === 'string' ? json.avatarUrl : undefined,
            avatarScale: typeof json?.avatarScale === 'number' ? json.avatarScale : undefined,
            theme: (json?.theme && typeof json.theme === 'object') ? json.theme as ThemeConfig : undefined,
            realtimeModel: typeof json?.realtimeModel === 'string' ? json.realtimeModel : undefined,
            realtimeVoice: typeof json?.realtimeVoice === 'string' ? json.realtimeVoice : undefined,
        };
        return cfg;
    } catch (_) {
        return { mode: 'sound', devMode: false };
    }
}


