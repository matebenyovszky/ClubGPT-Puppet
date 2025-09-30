// Simple client-side memory store with localStorage persistence and UI rendering.
// Fields: date (epoch ms), id (number), weight (number), text (string)

export type MemoryItem = {
    id: number;
    date: number; // epoch ms
    weight: number;
    text: string;
};

const STORAGE_KEY = 'clubgpt.memory';

function readAll(): MemoryItem[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        return arr.filter(Boolean);
    } catch (err) {
        console.warn('[memory] readAll error', err);
        return [];
    }
}

function writeAll(items: MemoryItem[]): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
        console.warn('[memory] writeAll error', err);
    }
    try { dispatchChange(); } catch {}
}

function nextId(items: MemoryItem[]): number {
    let maxId = 0;
    for (const it of items) { if (typeof it?.id === 'number' && it.id > maxId) maxId = it.id; }
    return maxId + 1;
}

export function listMemory(): MemoryItem[] {
    return readAll();
}

export function addMemory(text: string, weight: number = 1): MemoryItem {
    const items = readAll();
    const item: MemoryItem = {
        id: nextId(items),
        date: Date.now(),
        weight: Number.isFinite(weight) ? weight : 1,
        text: String(text ?? '')
    };
    items.push(item);
    writeAll(items);
    console.debug('[memory] add', item);
    return item;
}

export function updateMemory(id: number, updates: Partial<Pick<MemoryItem, 'text' | 'weight'>>): MemoryItem | null {
    const items = readAll();
    const idx = items.findIndex(it => it.id === id);
    if (idx === -1) return null;
    const cur = items[idx];
    const next: MemoryItem = {
        ...cur,
        text: updates.text != null ? String(updates.text) : cur.text,
        weight: updates.weight != null && Number.isFinite(updates.weight) ? Number(updates.weight) : cur.weight,
    };
    items[idx] = next;
    writeAll(items);
    console.debug('[memory] update', { id, updates, next });
    return next;
}

export function deleteMemory(id: number): boolean {
    const items = readAll();
    const next = items.filter(it => it.id !== id);
    const changed = next.length !== items.length;
    if (changed) writeAll(next);
    if (changed) console.debug('[memory] delete', { id });
    return changed;
}

export function clearMemory(silent: boolean = false): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
        console.warn('[memory] clearMemory error', err);
    }
    if (!silent) {
        try { dispatchChange(); } catch {}
    }
    try { console.debug('[memory] cleared'); } catch {}
}

// --- UI ---

function ensureContainer(): HTMLDivElement {
    let el = document.getElementById('memory-box') as HTMLDivElement | null;
    if (!el) {
        el = document.createElement('div');
        el.id = 'memory-box';
        el.style.position = 'fixed';
        el.style.left = '8px';
        el.style.bottom = '8px';
        el.style.background = 'rgba(0,0,0,0.35)';
        el.style.color = '#fff';
        el.style.padding = '6px 8px';
        el.style.borderRadius = '6px';
        el.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif';
        el.style.fontSize = '12px';
        el.style.maxWidth = '36vw';
        el.style.maxHeight = '40vh';
        el.style.overflow = 'auto';
        document.body.appendChild(el);
    }
    return el;
}

export function renderMemoryBox(): void {
    const el = ensureContainer();
    const items = listMemory().sort((a, b) => a.id - b.id);
    const rows = items.map(it => {
        const dt = new Date(it.date);
        const dstr = `${dt.toLocaleDateString()} ${dt.toLocaleTimeString()}`;
        return `<div style="display:flex;gap:6px;align-items:center;margin:2px 0;">
            <span style="opacity:0.8;">#${it.id}</span>
            <span style="opacity:0.7;">${dstr}</span>
            <span style="opacity:0.9;">[w=${it.weight}]</span>
            <span>${escapeHtml(it.text)}</span>
        </div>`;
    }).join('');
    el.innerHTML = `<div style="font-weight:600;margin-bottom:4px;">Memory</div>${rows || '<div style="opacity:0.7;">(empty)</div>'}`;
}

function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function dispatchChange(): void {
    try { window.dispatchEvent(new CustomEvent('memory:changed', { detail: { items: listMemory() } })); } catch {}
    try { renderMemoryBox(); } catch {}
}

export function initMemoryUI(): void {
    // Initial render and subscribe to changes
    try { renderMemoryBox(); } catch {}
    try {
        window.addEventListener('memory:changed', () => { try { renderMemoryBox(); } catch {} });
        // Also re-render on storage changes (multi-tab safety)
        window.addEventListener('storage', (e) => {
            if (e.key === STORAGE_KEY) { try { renderMemoryBox(); } catch {} }
        });
    } catch {}
    // Expose simple debug API
    try { (window as any).memory = { list: listMemory, add: addMemory, update: updateMemory, remove: deleteMemory }; } catch {}
}

// Utility: convenience capture based on Hungarian trigger phrase
export function captureBasketFromText(raw: string): MemoryItem | null {
    const text = String(raw || '').trim();
    if (!text) return null;
    // Basic trigger: "tedd a kosárba"; accept punctuation and extra spaces
    const trigger = /tedd\s+a\s+kos[áa]rba/i;
    if (!trigger.test(text)) return null;
    // Optionally extract what to add if provided after the trigger
    // e.g., "tedd a kosárba a piros almát" → we keep the whole sentence for now
    const item = addMemory(text, 1);
    return item;
}

// Broad intent capture for memory-like commands in HU/EN
export function captureMemoryFromText(raw: string): MemoryItem | null {
    const text = String(raw || '').trim();
    if (!text) return null;

    const patterns: RegExp[] = [
        // Hungarian: "jegyezd meg, hogy ..." or "jegyezd meg ..."
        /^jegyezd\s+meg(?:,?\s*hogy)?\s+(.+)$/i,
        // English variants
        /^save\s+to\s+memory\s*:?\s+(.+)$/i,
        /^add\s+to\s+memory\s*:?\s+(.+)$/i,
        /^remember\s*(?:that)?\s*:?\s+(.+)$/i,
        /^note\s*:?\s+(.+)$/i
    ];

    for (const re of patterns) {
        const m = text.match(re);
        if (m && m[1]) {
            const payload = m[1].trim();
            if (payload) {
                const item = addMemory(payload, 1);
                return item;
            }
        }
    }
    return null;
}


