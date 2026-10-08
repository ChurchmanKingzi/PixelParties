// Laden der Atlanten (units_a/b, rooms, world, bg_field) und Zugriff auf Texturen mit Anker

import { Assets, ImageSource, Rectangle, Texture, TextureStyle } from 'pixi.js';

declare global {
  interface Window { __BB_ASSETS__?: { files: Record<string, string>; json: Record<string, unknown> } }
}

function texFromDataUri(uri: string): Promise<Texture> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const source = new ImageSource({ resource: img, scaleMode: 'nearest' });
      res(new Texture({ source }));
    };
    img.onerror = () => rej(new Error('image failed to load'));
    img.src = uri;
  });
}

export interface Frame { tex: Texture; ax: number; ay: number; w: number; h: number }
interface AtlasJson { image: string; frames: Record<string, { x: number; y: number; w: number; h: number; ax?: number; ay?: number }> }

/** Alle sichtbaren Pixel eines Atlas in Weiß (für Umrandungen in Teamfarbe) */
function makeSilhouette(base: Texture): ImageSource | null {
  try {
    const src = base.source.resource as CanvasImageSource;
    const w = base.source.pixelWidth, h = base.source.pixelHeight;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(src, 0, 0);
    const im = g.getImageData(0, 0, w, h);
    const d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 40) { d[i] = d[i + 1] = d[i + 2] = 255; d[i + 3] = 255; } else d[i + 3] = 0;
    }
    g.putImageData(im, 0, 0);
    return new ImageSource({ resource: c, scaleMode: 'nearest' });
  } catch {
    return null;
  }
}

class Atlas {
  frames = new Map<string, Frame>();
  private silSrc: ImageSource | null | undefined;
  private silFrames = new Map<string, Frame>();
  constructor(public base: Texture, public json: AtlasJson) {
    for (const [k, f] of Object.entries(json.frames)) {
      const tex = new Texture({ source: base.source, frame: new Rectangle(f.x, f.y, f.w, f.h) });
      this.frames.set(k, { tex, ax: f.ax ?? 0, ay: f.ay ?? 0, w: f.w, h: f.h });
    }
  }
  get(key: string): Frame | undefined {
    return this.frames.get(key);
  }
  /** Umriss-Rahmen (einfarbige Silhouette) zum Rahmen `key` */
  sil(key: string): Frame | undefined {
    let s = this.silFrames.get(key);
    if (s) return s;
    const f = this.frames.get(key);
    if (!f) return undefined;
    if (this.silSrc === undefined) this.silSrc = makeSilhouette(this.base);
    if (!this.silSrc) return undefined;
    const fr = f.tex.frame;
    s = { tex: new Texture({ source: this.silSrc, frame: new Rectangle(fr.x, fr.y, fr.width, fr.height) }), ax: f.ax, ay: f.ay, w: f.w, h: f.h };
    this.silFrames.set(key, s);
    return s;
  }
}

export interface BgInfo { ponds: number[][]; trees: number[][]; tree_kind?: number[] }

export class GameAssets {
  unitsA!: Atlas;
  unitsB!: Atlas;
  rooms!: Atlas;
  world!: Atlas;
  bg!: Texture;
  bgInfo!: BgInfo;
  cropCache = new Map<string, Texture>();

  static async load(base = './assets/'): Promise<GameAssets> {
    TextureStyle.defaultOptions.scaleMode = 'nearest';
    const a = new GameAssets();
    const emb = window.__BB_ASSETS__;
    const json = async (f: string) => (emb ? emb.json[f] : await (await fetch(base + f)).json()) as never;
    const tex = (f: string): Promise<Texture> => (emb ? texFromDataUri(emb.files[f]) : Assets.load(base + f));
    const [uj, rj, wj, bj] = await Promise.all([json('units.json'), json('rooms.json'), json('world.json'), json('bg_field.json')]);
    const [ua, ub, rt, wt, bg] = await Promise.all([tex('units_a.png'), tex('units_b.png'), tex('rooms.png'), tex('world.png'), tex('bg_field.png')]);
    for (const t of [ua, ub, rt, wt, bg]) t.source.scaleMode = 'nearest';
    a.unitsA = new Atlas(ua, uj);
    a.unitsB = new Atlas(ub, uj);
    a.rooms = new Atlas(rt, rj);
    a.world = new Atlas(wt, wj);
    a.bg = bg;
    a.bgInfo = bj;
    return a;
  }

  unit(key: string, team: number): Frame | undefined {
    return (team === 1 ? this.unitsB : this.unitsA).get(key);
  }
  unitSil(key: string, team: number): Frame | undefined {
    return (team === 1 ? this.unitsB : this.unitsA).sil(key);
  }
  /** Teilstück einer Textur (Ausschnitt in Rahmenpixeln) */
  crop(f: Frame, x: number, y: number, w: number, h: number): Texture {
    const k = `${f.tex.uid}:${x},${y},${w},${h}`;
    let t = this.cropCache.get(k);
    if (!t) {
      const fr = f.tex.frame;
      t = new Texture({ source: f.tex.source, frame: new Rectangle(fr.x + x, fr.y + y, w, h) });
      this.cropCache.set(k, t);
    }
    return t;
  }
  /** Textur um 90° gedreht (für senkrechte Mauerkronen) über Canvas */
  rotated90(f: Frame, key: string): Texture {
    let t = this.cropCache.get('rot:' + key);
    if (t) return t;
    const fr = f.tex.frame;
    const src = f.tex.source.resource as CanvasImageSource;
    const c = document.createElement('canvas');
    c.width = fr.height; c.height = fr.width;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.translate(c.width, 0);
    g.rotate(Math.PI / 2);
    g.drawImage(src, fr.x, fr.y, fr.width, fr.height, 0, 0, fr.width, fr.height);
    t = Texture.from(c);
    t.source.scaleMode = 'nearest';
    this.cropCache.set('rot:' + key, t);
    return t;
  }
}
