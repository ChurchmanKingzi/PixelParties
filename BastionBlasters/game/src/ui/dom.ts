// kleine DOM-Helfer

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;

type Child = Node | string | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | number | boolean | ((e: Event) => void) | undefined> = {}, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') e.className = String(v);
    else if (k === 'html') e.innerHTML = String(v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of kids) if (c !== null && c !== undefined && c !== false) e.append(c as Node | string);
  return e;
}

export function clear(e: HTMLElement) {
  while (e.firstChild) e.removeChild(e.firstChild);
}

export function fmtTime(s: number): string {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function store<T>(key: string, def: T): T {
  try {
    const v = localStorage.getItem('bb.' + key);
    return v === null ? def : (JSON.parse(v) as T);
  } catch {
    return def;
  }
}
export function save(key: string, v: unknown) {
  try { localStorage.setItem('bb.' + key, JSON.stringify(v)); } catch { /* ignorieren */ }
}

/** wie append, ignoriert null und false */
export function put(parent: HTMLElement, ...kids: Child[]) {
  for (const c of kids) if (c !== null && c !== undefined && c !== false) parent.append(c as Node | string);
}

/** URL einer Spieldatei: eingebettete Daten (Einzeldatei-Build) oder relativer Pfad */
export function assetUrl(path: string): string {
  const emb = (window as unknown as { __BB_ASSETS__?: { files: Record<string, string> } }).__BB_ASSETS__;
  return emb?.files[path] ?? path;
}
