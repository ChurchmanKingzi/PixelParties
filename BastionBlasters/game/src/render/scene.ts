// Darstellung der Schlacht mit PixiJS: Boden, Bastionen (Räume, Mauern, Türme, Kern), Einheiten, Geschosse, Effekte.
// Alle Koordinaten sind Weltpixel (1 Zelle = 32 px); y-Sortierung nach Fußpunkt.

import { Application, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { CELL, MAP_H, MAP_W, PLOT, TPS, type Team } from '../sim/constants';
import { BUILDINGS, UNITS } from '../sim/data';
import { modCenter, wallMid } from '../sim/combat';
import type { Module, Projectile, SimEvent, Unit, Wall } from '../sim/types';
import { K_EMPTY, K_ROOM, K_YARD } from '../sim/types';
import { ci, type World } from '../sim/world';
import { GameAssets, type Frame } from './assets';

const W_PX = MAP_W * CELL, H_PX = MAP_H * CELL;
const TEAM_COL = [0xe0484c, 0x35c1b4];
/** Umrandung und Fußring der Einheiten: etwas heller als die Teamfarbe, damit sie auf Gras und Stein leuchtet */
const TEAM_GLOW = [0xff4a50, 0x2ef0dc];
const OUTLINE_OFF: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];

interface UnitView {
  root: Container;
  body: Sprite;
  shadow: Sprite;
  ring: Graphics;
  outline: Sprite[];
  bar: Graphics;
  rank: Sprite;
  last: { x: number; y: number };
  born: number;
}

interface Fx {
  obj: Container;
  t0: number;
  dur: number;
  update: (k: number) => void;
}

export interface Ghost {
  cells: [number, number][];
  ok: boolean;
  card?: string;
  x?: number;
  y?: number;
  cols?: number;
  rows?: number;
  rot?: number;
  edges?: { x: number; y: number; dir: 'E' | 'S' }[];
}

export class Scene {
  app: Application;
  a!: GameAssets;
  root = new Container();
  bg!: Sprite;
  floors = new Container();
  groundFx = new Container();
  objects = new Container();
  fxLayer = new Container();
  overlay = new Container();
  textLayer = new Container();
  staticItems: (Container | Sprite | Graphics)[] = [];
  dyn = new Graphics(); // HP-Balken, Kuppeln, Auswahl
  dynWorld = new Graphics(); // Boden-Effekte (Zielschatten, Wolken)
  gridG = new Graphics();
  ghostG = new Graphics();
  ghostSpr: Sprite | null = null;
  views = new Map<number, UnitView>();
  fx: Fx[] = [];
  sig = '';
  coreSprites: (Sprite | null)[] = [null, null];
  rangeRings: { x: number; y: number; r: number }[] = [];
  selected: { kind: 'unit' | 'module' | 'wall'; id: number } | null = null;
  showNumbers = true;
  showBars = true;
  frame = 0;
  // Kamera
  cam = { x: 0, y: 0, s: 1 };
  camTarget = { x: 0, y: 0, s: 1 };
  viewW = W_PX;
  viewH = H_PX;
  gridTeam: Team | null = null;
  onFeed: ((msg: string, team: number) => void) | null = null;

  constructor(app: Application) {
    this.app = app;
  }

  async init(a: GameAssets) {
    this.a = a;
    this.bg = new Sprite(a.bg);
    this.objects.sortableChildren = true;
    this.root.addChild(this.bg, this.floors, this.dynWorld, this.groundFx, this.objects, this.fxLayer, this.overlay, this.textLayer);
    this.overlay.addChild(this.gridG, this.ghostG, this.dyn);
    this.app.stage.addChild(this.root);
    // Bäume als eigene Sprites (Einheiten laufen dahinter)
    const trees = a.bgInfo.trees ?? [];
    for (let i = 0; i < trees.length; i++) {
      const f = a.world.get('tree.' + ((a.bgInfo.tree_kind ?? [])[i] ?? i % 3));
      if (!f) continue;
      const s = new Sprite(f.tex);
      s.anchor.set(f.ax / f.w, f.ay / f.h);
      s.position.set(trees[i][0], trees[i][1]);
      s.zIndex = trees[i][1];
      this.objects.addChild(s);
    }
  }

  // ---------------------------------------------------------------- Kamera

  setView(w: number, h: number) {
    this.viewW = w;
    this.viewH = h;
  }
  /** Kamera auf einen Weltausschnitt richten (Pixel) */
  focus(x: number, y: number, w: number, h: number, instant = false) {
    const s = Math.min(this.viewW / w, this.viewH / h);
    this.camTarget = { s, x: -(x + w / 2) * s + this.viewW / 2, y: -(y + h / 2) * s + this.viewH / 2 };
    if (instant) this.cam = { ...this.camTarget };
  }
  focusAll(instant = false) {
    this.focus(0, 0, W_PX, H_PX, instant);
  }
  focusPlot(team: Team, instant = false) {
    const r = PLOT[team];
    this.focus((r.x0 - 1) * CELL, (r.y0 - 1) * CELL, (r.x1 - r.x0 + 2) * CELL, (r.y1 - r.y0 + 2) * CELL, instant);
  }
  /** Bildschirm (Canvas-Pixel) -> Weltpixel */
  toWorld(px: number, py: number) {
    return { x: (px - this.cam.x) / this.cam.s, y: (py - this.cam.y) / this.cam.s };
  }
  zoomAt(px: number, py: number, factor: number) {
    const before = this.toWorld(px, py);
    const s = Math.max(0.35, Math.min(6, this.camTarget.s * factor));
    this.camTarget.s = s;
    this.camTarget.x = px - before.x * s;
    this.camTarget.y = py - before.y * s;
  }
  pan(dx: number, dy: number) {
    this.camTarget.x += dx;
    this.camTarget.y += dy;
  }
  private camStep() {
    const k = 0.18;
    this.cam.x += (this.camTarget.x - this.cam.x) * k;
    this.cam.y += (this.camTarget.y - this.cam.y) * k;
    this.cam.s += (this.camTarget.s - this.cam.s) * k;
    this.root.scale.set(this.cam.s);
    this.root.position.set(Math.round(this.cam.x), Math.round(this.cam.y));
  }

  // ---------------------------------------------------------------- Aufbau der statischen Teile

  private signature(world: World): string {
    let h = 0;
    const mix = (n: number) => { h = (Math.imul(h ^ n, 16777619) + 0x9e3779b9) | 0; };
    for (const m of world.modules.values()) {
      mix(m.id); mix(m.destroyed ? 1 : 0); mix(m.star); mix(m.buildEnd > world.tick ? 1 : 0); mix(m.cols * 7 + m.rows); mix(m.x0 * 64 + m.y0);
      mix(m.hp < m.maxHp * 0.5 ? 1 : 0);
    }
    for (const w of world.walls.values()) {
      mix(w.id); mix(w.hp <= 0 ? 2 : w.hp < w.maxHp * 0.5 ? 1 : 0); mix(w.variant.length); mix(w.door ? 1 : 0); mix(w.gate ? 1 : 0);
    }
    for (let i = 0; i < world.kind.length; i++) if (world.kind[i] === K_YARD) mix(i);
    return String(h);
  }

  private clearStatic() {
    for (const s of this.staticItems) { s.parent?.removeChild(s); s.destroy({ children: true }); }
    this.staticItems = [];
    this.coreSprites = [null, null];
  }

  private addStatic<T extends Container>(c: T, layer: Container): T {
    layer.addChild(c);
    this.staticItems.push(c);
    return c;
  }

  private sprite(f: Frame | undefined, x: number, y: number, z?: number, layer: Container = this.objects): Sprite | null {
    if (!f) return null;
    const s = new Sprite(f.tex);
    s.anchor.set(f.ax / f.w, f.ay / f.h);
    s.position.set(x, y);
    if (z !== undefined) s.zIndex = z;
    return this.addStatic(s, layer);
  }

  private tileKey(x: number, y: number): string {
    return 'tile.yard.' + ((x * 7 + y * 3) % 3);
  }

  private rebuild(world: World) {
    this.clearStatic();
    const A = this.a;
    // Böden
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = ci(x, y);
        const k = world.kind[i];
        if (k === K_EMPTY) continue;
        const m = world.modules.get(world.mod[i]);
        if (k === K_YARD || (k !== K_ROOM)) {
          const f = A.world.get(k === K_YARD ? this.tileKey(x, y) : 'tile.slab');
          const s = this.sprite(f, x * CELL, y * CELL, undefined, this.floors);
          void s;
        } else if (!m) {
          this.sprite(A.world.get('tile.planks.0'), x * CELL, y * CELL, undefined, this.floors);
        }
        if (world.rubble[i] && (!m || m.kind !== 'tower')) this.sprite(A.world.get('tile.rubble'), x * CELL, y * CELL, undefined, this.floors);
      }
    }
    // Kernkammer-Boden (Platten) für die 4x4
    for (const t of [0, 1] as Team[]) {
      const cm = world.modules.get(world.coreMod[t]);
      if (!cm) continue;
      for (let yy = cm.y0 - 1; yy < cm.y0 + 3; yy++) for (let xx = cm.x0 - 1; xx < cm.x0 + 3; xx++) {
        this.sprite(A.world.get('tile.slab'), xx * CELL, yy * CELL, undefined, this.floors);
      }
    }
    // Module
    for (const m of world.modules.values()) this.buildModule(world, m);
    // Mauern
    for (const w of world.walls.values()) this.buildWall(world, w);
  }

  private frameFor(card: string, team: number): Frame | undefined {
    return (team === 1 ? this.a.world.get(card + '@B') : undefined) ?? this.a.world.get(card);
  }

  private buildModule(world: World, m: Module) {
    const A = this.a;
    const px = m.x0 * CELL, py = m.y0 * CELL;
    const building = m.buildEnd > world.tick;
    if (m.kind === 'core') {
      const key = m.destroyed || m.hp <= 0 ? 'core.ruin' : (m.owner === 1 ? 'core.crystal@B' : 'core.crystal');
      const f = A.world.get(key) ?? A.world.get('core.crystal');
      const s = this.sprite(f, (m.x0 + 1) * CELL, (m.y0 + 2) * CELL, (m.y0 + 2) * CELL);
      this.coreSprites[m.owner] = s;
      return;
    }
    const def = BUILDINGS[m.card];
    if (!def) return;
    if (m.kind === 'room') {
      const key = `${m.card}@${m.cols}x${m.rows}`;
      const f = A.rooms.get(key);
      if (m.destroyed) {
        for (const c of m.cells) {
          this.sprite(A.world.get('tile.dark'), (c % MAP_W) * CELL, Math.floor(c / MAP_W) * CELL, undefined, this.floors);
          this.sprite(A.world.get('tile.rubble'), (c % MAP_W) * CELL, Math.floor(c / MAP_W) * CELL, undefined, this.floors);
        }
        return;
      }
      if (f) {
        const s = new Sprite(f.tex);
        s.position.set(px, py);
        if (building) s.alpha = 0.55;
        this.addStatic(s, this.floors);
      } else {
        for (const c of m.cells) this.sprite(A.world.get('tile.planks.0'), (c % MAP_W) * CELL, Math.floor(c / MAP_W) * CELL, undefined, this.floors);
      }
      if (building) this.blueprint(m);
      return;
    }
    if (m.destroyed) {
      for (const c of m.cells) this.sprite(A.world.get('tile.rubble'), (c % MAP_W) * CELL, Math.floor(c / MAP_W) * CELL, undefined, this.floors);
      if (m.kind === 'tower') this.sprite(A.world.get('tower.ruin'), (m.x0 + 0.5) * CELL, (m.y0 + 1) * CELL - 2, (m.y0 + 1) * CELL);
      return;
    }
    // Turm und Hof-Bauteil: Heldensprite am Fußpunkt der Grundfläche
    const f = this.frameFor(m.card, m.owner) ?? (m.kind === 'tower' ? A.world.get(m.owner === 1 ? 'tower@B' : 'tower@A') : undefined);
    const bx = (m.x0 + m.cols / 2) * CELL, by = (m.y0 + m.rows) * CELL;
    if (f) {
      const s = this.sprite(f, bx, by - (m.kind === 'tower' ? 0 : 0), by);
      if (s && building) s.alpha = 0.55;
    } else {
      const g = new Graphics();
      g.rect(px + 2, py + 2, m.cols * CELL - 4, m.rows * CELL - 4).fill({ color: 0x8a6a4a, alpha: 0.9 }).stroke({ width: 2, color: 0x2a1a12 });
      this.addStatic(g, this.objects);
      g.zIndex = by;
    }
    if (building) this.blueprint(m);
  }

  private blueprint(m: Module) {
    const g = new Graphics();
    g.rect(m.x0 * CELL, m.y0 * CELL, m.cols * CELL, m.rows * CELL).fill({ color: 0x5aa0ff, alpha: 0.22 }).stroke({ width: 1, color: 0x9ac8ff, alpha: 0.8 });
    this.addStatic(g, this.groundFx);
  }

  private variantKey(base: string, w: Wall, dmg: boolean): string {
    return base + (w.variant === 'stone' ? '' : '.' + w.variant) + (dmg ? '.dmg' : '');
  }

  private wallHeight(world: World, w: Wall): number {
    if (w.dir === 'E') return 20;
    const a = { x: w.x, y: w.y }, b = { x: w.x, y: w.y + 1 };
    const aOwn = world.isOwned(a.x, a.y, w.owner), bOwn = world.isOwned(b.x, b.y, w.owner);
    const ma = world.mod[ci(a.x, a.y)], mb = world.mod[ci(b.x, b.y)];
    const platform = [ma, mb].some((id) => (world.modules.get(id)?.slots.length ?? 0) > 0);
    let tall: boolean;
    if (!aOwn) tall = true;
    else if (!bOwn) tall = false;
    else tall = !(ma !== 0 && mb === 0);
    return platform || !tall ? 10 : 22;
  }

  private buildWall(world: World, w: Wall) {
    const A = this.a;
    const dmg = w.hp > 0 && w.hp < w.maxHp * 0.5 && !w.door;
    if (w.dir === 'S') {
      const Y = (w.y + 1) * CELL;
      const X = w.x * CELL;
      if (w.hp <= 0 && !w.door) { // Bresche
        const f = A.world.get('wall.breach');
        this.sprite(f, X, Y - 6, Y + 4);
        const g = this.sprite(f, X, Y - 6, Y + 4);
        void g;
        return;
      }
      const h = this.wallHeight(world, w);
      const topF = A.world.get(this.variantKey('wall.top', w, dmg)) ?? A.world.get('wall.top');
      const frontKey = w.door ? (h >= 22 ? 'door.front' : 'door.front.10') : this.variantKey('wall.front.' + (h >= 22 ? 22 : 10), w, dmg);
      const frontF = A.world.get(frontKey) ?? A.world.get('wall.front.' + (h >= 22 ? 22 : 10));
      const z = Y + 4;
      // 40 px breit: Ecken schließen
      for (const [ox, ow] of [[-4, 4], [0, 32], [32, 4]] as const) {
        if (topF) {
          const t = ow === 32 ? topF.tex : this.a.crop(topF, ox < 0 ? 28 : 0, 0, ow, topF.h);
          const s = new Sprite(t); s.position.set(X + ox, Y - 4 - h); s.zIndex = z; this.addStatic(s, this.objects);
        }
        if (frontF) {
          const useDoor = w.door && ow !== 32;
          const ff = useDoor ? A.world.get('wall.front.' + (h >= 22 ? 22 : 10)) ?? frontF : frontF;
          const t = ow === 32 ? ff.tex : this.a.crop(ff, ox < 0 ? 28 : 0, 0, ow, ff.h);
          const s = new Sprite(t); s.position.set(X + ox, Y + 4 - h); s.zIndex = z; this.addStatic(s, this.objects);
        }
      }
      return;
    }
    // senkrechte Kante
    const X = (w.x + 1) * CELL;
    const Y0 = w.y * CELL;
    if (w.door) return; // Tür in der Seitenwand: offener Durchlass
    if (w.gate) { this.buildGate(world, w); return; }
    if (w.hp <= 0) {
      const f = A.world.get('wall.breach');
      if (f) {
        const t = this.a.rotated90(f, 'breach');
        const s = new Sprite(t); s.position.set(X - 6, Y0); s.zIndex = Y0 + CELL; this.addStatic(s, this.objects);
      }
      return;
    }
    const h = 20;
    const topF = A.world.get(this.variantKey('wall.top', w, dmg)) ?? A.world.get('wall.top');
    const frontF = A.world.get(this.variantKey('wall.front.20', w, dmg)) ?? A.world.get('wall.front.20');
    const z = Y0 + CELL;
    if (topF) {
      const t = this.a.rotated90(topF, this.variantKey('wall.top', w, dmg));
      const s = new Sprite(t); s.position.set(X - 4, Y0 - h); s.zIndex = z; this.addStatic(s, this.objects);
    }
    if (frontF) {
      const t = this.a.crop(frontF, 12, 0, 8, h);
      const s = new Sprite(t); s.position.set(X - 4, Y0 + CELL - h); s.zIndex = z; this.addStatic(s, this.objects);
    }
  }

  private buildGate(world: World, w: Wall) {
    const A = this.a;
    const X = (w.x + 1) * CELL, Y0 = w.y * CELL;
    const post = A.world.get('wall.post');
    this.sprite(post, X, Y0 + 3, Y0 + 3);
    this.sprite(post, X, Y0 + CELL + 3, Y0 + CELL + 3);
    const thr = A.world.get('gate.side');
    if (thr) { const s = new Sprite(thr.tex); s.position.set(X - 4, Y0); this.addStatic(s, this.floors); }
    if (w.hp > 0) {
      const g = new Graphics();
      g.rect(X - 4, Y0 + 4, 8, CELL - 8).fill({ color: 0x6b4423 }).stroke({ width: 1, color: 0x2a170a });
      g.rect(X - 4, Y0 + 9, 8, 2).fill({ color: 0x8c8f97 });
      g.rect(X - 4, Y0 + CELL - 12, 8, 2).fill({ color: 0x8c8f97 });
      g.zIndex = Y0 + CELL - 2;
      g.label = 'gate' + w.id;
      this.addStatic(g, this.objects);
    }
  }

  // ---------------------------------------------------------------- Einheiten

  private makeView(u: Unit): UnitView {
    const root = new Container();
    const shadow = new Sprite(this.a.unit('shadow', 0)?.tex);
    shadow.anchor.set(0.5);
    shadow.alpha = 0.55;
    const col = TEAM_GLOW[u.team];
    const ring = new Graphics();
    const rx = Math.max(8, Math.min(18, u.radius * CELL * 0.85));
    ring.ellipse(0, -1, rx, rx * 0.46).fill({ color: col, alpha: 0.22 }).stroke({ width: 2, color: col, alpha: 0.9 });
    const outline = OUTLINE_OFF.map(() => { const s = new Sprite(); s.tint = col; s.alpha = 0.95; return s; });
    const body = new Sprite();
    const bar = new Graphics();
    const rank = new Sprite();
    rank.anchor.set(0.5, 1);
    root.addChild(shadow, ring, ...outline, body, bar, rank);
    this.objects.addChild(root);
    return { root, body, shadow, ring, outline, bar, rank, last: { x: u.x, y: u.y }, born: this.frame };
  }

  private unitKey(u: Unit, f: number): { key: string; fr?: Frame } {
    let key: string;
    if (u.cid === 'citizen') key = `citizen.${u.id % 6}#${f}`;
    else if (u.cid === 'HORNET') key = 'fx.spark#0';
    else key = `${u.cid}#${f}`;
    return { key, fr: this.a.unit(key, u.team) ?? this.a.unit(key.replace(/#\d+$/, '#0'), u.team) };
  }

  private updateUnits(world: World) {
    const seen = new Set<number>();
    const t = world.tick;
    for (const u of world.units) {
      if (u.dead) continue;
      seen.add(u.id);
      let v = this.views.get(u.id);
      if (!v) { v = this.makeView(u); this.views.set(u.id, v); }
      const moving = u.state === 'move' || u.state === 'flee' || u.state === 'retreat' || u.state === 'return' || Math.abs(u.x - v.last.x) + Math.abs(u.y - v.last.y) > 0.003;
      const phase = Math.floor((t + u.id * 5) / (moving ? 7 : 16)) % 2;
      const { fr } = this.unitKey(u, phase);
      if (fr) {
        v.body.texture = fr.tex;
        v.body.anchor.set(fr.ax / fr.w, fr.ay / fr.h);
      }
      v.body.scale.x = u.face;
      const bob = u.cat === 'artillery' ? 0 : moving ? -Math.abs(Math.sin((t + u.id * 3) * 0.45)) * 1.6 : 0;
      const lift = u.flying && u.state !== 'burrow' ? -5 : 0;
      const lunge = u.state === 'attack' && u.cat !== 'artillery' ? Math.sin((t + u.id) * 0.6) * 1.2 * u.face : 0;
      v.body.position.set(lunge, bob + lift);
      // Umrandung in Teamfarbe: beim Herauszoomen dicker, damit man die Lager noch unterscheidet
      const key = fr ? this.unitKey(u, phase).key : '';
      const sil = fr ? this.a.unitSil(this.a.unit(key, u.team) ? key : key.replace(/#\d+$/, '#0'), u.team) : undefined;
      const off = Math.min(2.6, Math.max(1, 0.9 / this.cam.s));
      for (let i = 0; i < v.outline.length; i++) {
        const o = v.outline[i];
        o.visible = !!sil;
        if (!sil) continue;
        o.texture = sil.tex;
        o.anchor.set(sil.ax / sil.w, sil.ay / sil.h);
        o.scale.x = u.face;
        o.position.set(lunge + OUTLINE_OFF[i][0] * off, bob + lift + OUTLINE_OFF[i][1] * off);
        o.tint = TEAM_GLOW[u.team];
      }
      v.ring.scale.set(Math.min(2, Math.max(1, 0.8 / this.cam.s)));
      v.shadow.position.set(0, -1);
      v.shadow.scale.set(Math.max(0.7, u.radius * 2.6), 1);
      v.root.position.set(Math.round(u.x * CELL), Math.round(u.y * CELL));
      v.root.zIndex = Math.round(u.y * CELL) + (u.flying ? 400 : 0);
      v.root.alpha = u.state === 'swallowed' ? 0 : u.invisible ? 0.4 : u.state === 'burrow' ? 0.35 : 1;
      v.body.tint = u.st.some((s) => s.id === 'frozen') ? 0xa8d8ff : u.st.some((s) => s.id === 'frogged') ? 0x88ee88 : u.st.some((s) => s.id === 'burning') ? 0xffb080 : 0xffffff;
      // Balken
      const fh = fr ? fr.ay : 24;
      const top = -fh - 4 + lift;
      v.bar.clear();
      const showBar = this.showBars && (u.hp < u.maxHp - 0.5 || this.selected?.kind === 'unit' && this.selected.id === u.id);
      if (showBar) {
        const bw = u.cat === 'artillery' ? 20 : 14;
        const f = Math.max(0, u.hp / u.maxHp);
        v.bar.rect(-bw / 2 - 1, top - 1, bw + 2, 4).fill({ color: 0x000000, alpha: 0.7 });
        v.bar.rect(-bw / 2, top, bw * f, 2).fill({ color: f > 0.5 ? 0x62d26f : f > 0.25 ? 0xe5c14a : 0xe5534b });
        v.bar.rect(-bw / 2 - 1, top - 1, 2, 4).fill({ color: TEAM_COL[u.team] });
      }
      if (u.rank > 0) {
        const rf = this.a.unit('rank.' + Math.min(5, u.rank), 0);
        if (rf) { v.rank.texture = rf.tex; v.rank.anchor.set(0.5, 1); v.rank.position.set(0, top - 2); v.rank.visible = true; v.rank.scale.set(0.9); }
      } else v.rank.visible = false;
      // Statuspunkte
      let sx = -u.st.length * 2;
      for (const s of u.st) {
        const c = STATUS_COL[s.id];
        if (!c) continue;
        v.bar.rect(sx, top - 6, 3, 3).fill({ color: c });
        sx += 4;
      }
      if (u.rt.phase === 'heal' || u.rt.phase === 'go') v.bar.rect(-3, top - 10, 6, 2).fill({ color: 0x7affc0 });
      if (u.berserk) v.bar.rect(-3, top - 10, 6, 2).fill({ color: 0xff6644 });
      v.last.x = u.x; v.last.y = u.y;
    }
    for (const [id, v] of this.views) {
      if (!seen.has(id)) { v.root.destroy({ children: true }); this.views.delete(id); }
    }
  }

  // ---------------------------------------------------------------- Geschosse, Gebiete, Module-Overlays

  private projTex(vis: string, team: number, n: number): { fr?: Frame; scale: number } {
    const map: Record<string, string> = {
      stone: 'proj.stone', fire: 'proj.fire', ice: 'proj.ice', icicle: 'proj.ice', bolt: 'proj.bolt', poison: 'proj.poison', arcane: 'proj.arcane',
      ink: 'proj.ink', goo: 'proj.goo', fish: 'proj.fish', bomb: 'proj.bomb', arrow: 'proj.arrow', meteor: 'proj.fire', bat: 'proj.arcane', flame: 'fx.flame',
    };
    if (vis === 'goblin') return { fr: this.a.unit('US-02#0', team), scale: 1 };
    const key = map[vis] ?? 'proj.stone';
    return { fr: this.a.unit(key + '#' + (n % 2), team) ?? this.a.unit(key + '#0', team), scale: vis === 'meteor' ? 2.2 : 1 };
  }

  private projSprites = new Map<number, { s: Sprite; sh: Sprite }>();

  private updateProjectiles(world: World) {
    const seen = new Set<number>();
    for (const p of world.projectiles) {
      seen.add(p.id);
      let v = this.projSprites.get(p.id);
      const { fr, scale } = this.projTex(p.vis, p.team, 0);
      if (!v) {
        const s = new Sprite(fr?.tex);
        const sh = new Sprite(this.a.unit('shadow', 0)?.tex);
        sh.anchor.set(0.5); sh.alpha = 0.5;
        this.fxLayer.addChild(sh, s);
        v = { s, sh };
        this.projSprites.set(p.id, v);
      }
      const k = Math.max(0, Math.min(1, (world.tick - p.t0) / Math.max(1, p.t1 - p.t0)));
      const x = (p.x0 + (p.x1 - p.x0) * k) * CELL, y = (p.y0 + (p.y1 - p.y0) * k) * CELL;
      const arc = p.kind === 'arc' || p.kind === 'air' || p.kind === 'scatter' ? Math.hypot(p.x1 - p.x0, p.y1 - p.y0) * CELL * 0.22 : p.kind === 'vertical' ? 220 : 0;
      let h = 0;
      if (p.kind === 'vertical') h = (1 - k) * (1 - k) * arc;
      else if (arc) h = Math.sin(k * Math.PI) * arc;
      if (fr) {
        v.s.texture = fr.tex;
        v.s.anchor.set(0.5);
        v.s.scale.set(scale * (p.x1 < p.x0 ? -1 : 1), scale);
        v.s.rotation = p.vis === 'arrow' || p.vis === 'bolt' ? Math.atan2(p.y1 - p.y0, p.x1 - p.x0) + (p.x1 < p.x0 ? Math.PI : 0) : (world.tick * 0.2) * 0;
      }
      v.s.position.set(x, y - h - 4);
      v.sh.position.set(x, y);
      v.sh.scale.set(1 - Math.min(0.5, h / 300), 1);
      v.s.zIndex = 5000;
    }
    for (const [id, v] of this.projSprites) {
      if (!seen.has(id)) { v.s.destroy(); v.sh.destroy(); this.projSprites.delete(id); }
    }
  }

  private updateAreas(world: World, now: number) {
    const g = this.dynWorld;
    g.clear();
    for (const a of world.areas) {
      const cx = a.x * CELL, cy = a.y * CELL, r = a.r * CELL;
      if (a.kind === 'shadow') {
        const left = Math.max(0, a.until - world.tick);
        const pulse = 0.55 + 0.25 * Math.sin(now / 90);
        g.ellipse(cx, cy, r, r * 0.62).fill({ color: 0x120a02, alpha: 0.28 });
        g.ellipse(cx, cy, r * (0.6 + 0.4 * Math.min(1, left / 40)), r * 0.62 * (0.6 + 0.4 * Math.min(1, left / 40))).stroke({ width: 2, color: 0xffa84a, alpha: pulse });
      } else if (a.kind === 'cloud') {
        g.ellipse(cx, cy, r, r * 0.7).fill({ color: 0x7ad24a, alpha: 0.28 + 0.07 * Math.sin(now / 200) });
      } else if (a.kind === 'rain') {
        g.ellipse(cx, cy, r, r * 0.7).fill({ color: 0x4a7ad2, alpha: 0.18 });
      } else if (a.kind === 'slush' || a.kind === 'frost') {
        g.ellipse(cx, cy, r, r * 0.7).fill({ color: 0xbfe6ff, alpha: 0.3 });
      } else if (a.kind === 'fire') {
        g.ellipse(cx, cy, r, r * 0.7).fill({ color: 0xff7a2a, alpha: 0.3 });
      }
    }
  }

  private updateOverlays(world: World, now: number) {
    const g = this.dyn;
    g.clear();
    for (const m of world.modules.values()) {
      if (m.destroyed) continue;
      const c = modCenter(m);
      if (m.hp < m.maxHp - 0.5 || this.selected?.kind === 'module' && this.selected.id === m.id) {
        const bw = Math.max(18, m.cols * CELL * 0.7);
        const f = Math.max(0, m.hp / m.maxHp);
        const y = (m.kind === 'core' ? m.y0 - 1.5 : m.y0 - 0.15) * CELL - (m.kind === 'tower' ? 52 : 0);
        g.rect(c.x * CELL - bw / 2 - 1, y - 1, bw + 2, 5).fill({ color: 0x000000, alpha: 0.75 });
        g.rect(c.x * CELL - bw / 2, y, bw * f, 3).fill({ color: f > 0.5 ? 0x62d26f : f > 0.25 ? 0xe5c14a : 0xe5534b });
      }
      if (world.tick < m.burning) {
        const fl = this.a.world.get('icon.heart');
        void fl;
        for (let k = 0; k < 3; k++) {
          const fx = (m.x0 + ((k * 0.37 + (world.tick / 90)) % 1) * m.cols) * CELL;
          const fy = (m.y0 + m.rows * 0.5) * CELL - ((world.tick + k * 7) % 22);
          g.circle(fx, fy, 3 - ((world.tick + k * 7) % 22) / 10).fill({ color: 0xff8a2a, alpha: 0.85 });
        }
      }
      if (world.tick < m.frozen) g.rect(m.x0 * CELL, m.y0 * CELL, m.cols * CELL, m.rows * CELL).fill({ color: 0xbfe6ff, alpha: 0.25 });
      if (world.tick < m.shortCircuit) {
        for (let k = 0; k < 2; k++) g.rect((m.x0 + Math.random() * m.cols) * CELL, (m.y0 + Math.random() * m.rows) * CELL, 2, 6).fill({ color: 0xffe14a });
      }
      if (m.card === 'BA-01' && world.tick >= (m.s.domeDown ?? 0)) {
        g.circle(c.x * CELL, c.y * CELL, 3.5 * CELL).stroke({ width: 2, color: 0xc8f0ff, alpha: 0.5 + 0.2 * Math.sin(now / 250) });
      }
    }
    for (const w of world.walls.values()) {
      if (w.door || w.hp <= 0 || w.hp >= w.maxHp - 0.5) continue;
      const mid = wallMid(w);
      const f = w.hp / w.maxHp;
      g.rect(mid.x * CELL - 8, mid.y * CELL - 12, 16, 3).fill({ color: 0x000000, alpha: 0.7 });
      g.rect(mid.x * CELL - 8, mid.y * CELL - 12, 16 * f, 2).fill({ color: f > 0.5 ? 0x62d26f : f > 0.25 ? 0xe5c14a : 0xe5534b });
    }
    // Eroberungs-/Kern-Marker
    for (const t of [0, 1] as Team[]) {
      const c = world.modules.get(world.coreMod[t]);
      if (!c) continue;
      if (world.conquest[t] > 0) {
        const cx = (c.x0 + 1) * CELL, cy = (c.y0 + 1) * CELL;
        g.circle(cx, cy, 2.4 * CELL).stroke({ width: 2, color: TEAM_COL[t === 0 ? 1 : 0], alpha: 0.4 + world.conquest[t] / 200 });
      }
    }
    // Auswahl
    const sel = this.selected;
    if (sel) {
      if (sel.kind === 'unit') {
        const u = world.byId.get(sel.id);
        if (u && !u.dead) g.ellipse(u.x * CELL, u.y * CELL - 1, 13, 7).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
      } else if (sel.kind === 'module') {
        const m = world.modules.get(sel.id);
        if (m) g.rect(m.x0 * CELL - 1, m.y0 * CELL - 1, m.cols * CELL + 2, m.rows * CELL + 2).stroke({ width: 2, color: 0xffffff, alpha: 0.9 });
      }
    }
    // Reichweitenringe
    for (const r of this.rangeRings) g.circle(r.x * CELL, r.y * CELL, r.r * CELL).stroke({ width: 1, color: 0xffd34a, alpha: 0.45 });
    // Baugrund-Raster
    this.gridG.clear();
    if (this.gridTeam !== null) {
      const r = PLOT[this.gridTeam];
      for (let y = r.y0; y < r.y1; y++) {
        for (let x = r.x0; x < r.x1; x++) {
          const free = world.kind[ci(x, y)] === K_EMPTY;
          this.gridG.rect(x * CELL, y * CELL, CELL, CELL).stroke({ width: 1, color: 0xffffff, alpha: free ? 0.28 : 0.1 });
        }
      }
      this.gridG.rect(r.x0 * CELL, r.y0 * CELL, (r.x1 - r.x0) * CELL, (r.y1 - r.y0) * CELL).stroke({ width: 2, color: TEAM_COL[this.gridTeam], alpha: 0.9 });
    }
  }

  // ---------------------------------------------------------------- Ereignisse und Effekte

  private addFx(obj: Container, dur: number, update: (k: number) => void, layer: Container = this.fxLayer) {
    layer.addChild(obj);
    this.fx.push({ obj, t0: performance.now(), dur, update });
  }

  private anim(key: string, x: number, y: number, dur: number, scale = 1, frames = 4, team = 0, lift = 0) {
    const first = this.a.unit(key + '#0', team);
    if (!first) return;
    const s = new Sprite(first.tex);
    s.anchor.set(first.ax / first.w, first.ay / first.h);
    s.position.set(x, y - lift);
    s.scale.set(scale);
    s.zIndex = 9000;
    this.addFx(s, dur, (k) => {
      const i = Math.min(frames - 1, Math.floor(k * frames));
      const f = this.a.unit(key + '#' + i, team);
      if (f) { s.texture = f.tex; s.anchor.set(f.ax / f.w, f.ay / f.h); }
      s.alpha = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
    });
  }

  private floatText(x: number, y: number, text: string, color: string, size = 11) {
    const t = new Text({ text, style: { fontFamily: 'monospace', fontSize: size, fontWeight: 'bold', fill: color, stroke: { color: '#000000', width: 3 } } });
    t.anchor.set(0.5);
    t.position.set(x, y);
    this.addFx(t, 900, (k) => { t.position.y = y - k * 22; t.alpha = 1 - k * k; }, this.textLayer);
  }

  private handleEvents(world: World) {
    for (const e of world.events) this.handleEvent(e);
    world.events.length = 0;
  }

  private handleEvent(e: SimEvent) {
    switch (e.t) {
      case 'shot': {
        // kurze Sichtlinie für Nahkampf-Fernangriffe und Türme
        const { fr, scale } = this.projTex(e.vis, e.team, 0);
        if (!fr) return;
        const s = new Sprite(fr.tex);
        s.anchor.set(0.5);
        s.scale.set(scale);
        const x0 = e.x0 * CELL, y0 = e.y0 * CELL, x1 = e.x1 * CELL, y1 = e.y1 * CELL;
        s.position.set(x0, y0);
        s.rotation = e.vis === 'arrow' || e.vis === 'bolt' ? Math.atan2(y1 - y0, x1 - x0) : 0;
        const dur = Math.max(80, (e.fly / TPS) * 1000);
        if (e.fly <= 20) this.addFx(s, dur, (k) => { s.position.set(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k); s.alpha = k > 0.9 ? 0 : 1; });
        else s.destroy();
        break;
      }
      case 'impact': {
        const x = e.x * CELL, y = e.y * CELL;
        if (e.vis === 'dome') { this.ring(x, y, 40, 0xc8f0ff); break; }
        if (e.vis === 'ice' || e.vis === 'icicle') this.anim('fx.snow', x, y, 500, 1.2, 2);
        else if (e.vis === 'poison' || e.vis === 'dust' || e.vis === 'ink' || e.vis === 'goo') this.anim('fx.puff', x, y, 450, 1 + e.r * 0.3, 4);
        else if (e.vis === 'arcane' || e.vis === 'bolt') this.anim('fx.spark', x, y, 400, 1.4, 4);
        else this.anim('fx.explosion', x, y, 520, 0.6 + e.r * 0.35, 5, 0, 4);
        break;
      }
      case 'death': {
        const x = e.x * CELL, y = e.y * CELL;
        if (e.cat === 'citizen' || e.cat === 'civilian') this.anim('fx.confetti', x, y, 700, 1, 4);
        else if (UNITS[e.cid]?.armor === 'bone') this.anim('fx.bones', x, y, 900, 1, 1);
        else this.anim('fx.puff', x, y, 400, 0.9, 4);
        break;
      }
      case 'rank': {
        const x = e.x * CELL, y = e.y * CELL;
        this.anim('fx.star', x, y - 6, 700, 1.2, 2);
        this.floatText(x, y - 28, 'RANK UP', '#ffe066', 10);
        break;
      }
      case 'text': this.floatText(e.x * CELL, e.y * CELL, e.text, e.color, 9); break;
      case 'hit': if (this.showNumbers) this.floatText(e.x * CELL + (Math.random() - 0.5) * 8, e.y * CELL - 18, String(e.dmg), e.team === 0 ? '#ffb0a8' : '#a8f0ea', 9); break;
      case 'heal': this.anim('fx.heal', e.x * CELL, e.y * CELL - 6, 500, 1, 3); break;
      case 'break': {
        const x = e.x * CELL, y = e.y * CELL;
        this.anim('fx.explosion', x, y, 520, e.what === 'core' ? 2.2 : 1, 5, 0, 6);
        this.anim('fx.puff', x, y, 600, 1.3, 4);
        break;
      }
      case 'feed': this.onFeed?.(e.msg, e.team); break;
      case 'spawn': this.anim('fx.puff', e.x * CELL, e.y * CELL, 300, 0.6, 4); break;
      case 'fx': {
        const k = e.name;
        if (k === 'flame' || k === 'puff' || k === 'bones' || k === 'spark') this.anim('fx.' + k, e.x * CELL, e.y * CELL, 500, 1, k === 'bones' ? 1 : k === 'flame' ? 3 : 4);
        else if (k === 'revive') this.anim('fx.heal', e.x * CELL, e.y * CELL - 6, 600, 1.2, 3);
        else if (k === 'dirt') this.anim('fx.puff', e.x * CELL, e.y * CELL, 400, 0.8, 4);
        break;
      }
      default: break;
    }
  }

  private ring(x: number, y: number, r: number, color: number) {
    const g = new Graphics();
    this.addFx(g, 400, (k) => { g.clear(); g.circle(x, y, r * (0.4 + k * 0.6)).stroke({ width: 2, color, alpha: 1 - k }); });
  }

  private updateFx(now: number) {
    const keep: Fx[] = [];
    for (const f of this.fx) {
      const k = (now - f.t0) / f.dur;
      if (k >= 1) { f.obj.destroy({ children: true }); continue; }
      f.update(k);
      keep.push(f);
    }
    this.fx = keep;
  }

  // ---------------------------------------------------------------- Vorschau beim Bauen

  setGhost(g: Ghost | null) {
    this.ghostG.clear();
    if (this.ghostSpr) { this.ghostSpr.destroy(); this.ghostSpr = null; }
    if (!g) return;
    const col = g.ok ? 0x4adf7a : 0xff5a5a;
    for (const [x, y] of g.cells) this.ghostG.rect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2).fill({ color: col, alpha: 0.28 }).stroke({ width: 1, color: col, alpha: 0.9 });
    if (g.edges) for (const e of g.edges) {
      if (e.dir === 'S') this.ghostG.rect(e.x * CELL, (e.y + 1) * CELL - 4, CELL, 8).fill({ color: col, alpha: 0.7 });
      else this.ghostG.rect((e.x + 1) * CELL - 4, e.y * CELL, 8, CELL).fill({ color: col, alpha: 0.7 });
    }
    if (g.card && g.x !== undefined && g.cols && g.rows) {
      const def = BUILDINGS[g.card];
      let f: Frame | undefined;
      let sx = g.x * CELL, sy = g.y! * CELL;
      if (def?.kind === 'room') f = this.a.rooms.get(`${g.card}@${g.cols}x${g.rows}`);
      else if (def) {
        f = this.a.world.get(g.card);
        if (f) { sx = (g.x + g.cols / 2) * CELL - f.ax; sy = (g.y! + g.rows) * CELL - f.ay; }
      }
      if (f) {
        const s = new Sprite(f.tex);
        s.position.set(sx, sy);
        s.alpha = 0.7;
        s.tint = g.ok ? 0xffffff : 0xff9a9a;
        s.zIndex = 8000;
        this.overlay.addChild(s);
        this.ghostSpr = s;
      }
    }
  }

  // ---------------------------------------------------------------- Einstieg pro Bild

  update(world: World) {
    this.frame++;
    const now = performance.now();
    this.camStep();
    const sg = this.frame % 6 === 0 || this.sig === '' ? this.signature(world) : this.sig;
    if (sg !== this.sig) {
      this.sig = sg;
      this.rebuild(world);
    }
    this.updateUnits(world);
    this.updateProjectiles(world);
    this.updateAreas(world, now);
    this.updateOverlays(world, now);
    this.handleEvents(world);
    this.updateFx(now);
    // Tor: offen, wenn ein Freund davorsteht
    for (const o of this.staticItems) {
      if (o.label && o.label.startsWith('gate')) {
        const w = world.walls.get(Number(o.label.slice(4)));
        if (w) {
          const cx = (w.x + 1), cy = w.y + 0.5;
          const open = world.near(cx, cy, 1.3, (u) => u.team === w.owner && !u.flying).length > 0;
          o.visible = !open;
        }
      }
    }
    // Kernkristall: Glühen
    for (const t of [0, 1] as Team[]) {
      const s = this.coreSprites[t];
      if (s) {
        const f = this.a.world.get((t === 1 ? 'core.crystal@B' : 'core.crystal') + '#' + (Math.floor(world.tick / 12) % 3));
        if (f) s.texture = f.tex;
      }
    }
  }

  get canvas(): HTMLCanvasElement {
    return this.app.canvas as HTMLCanvasElement;
  }
}

const STATUS_COL: Record<string, number> = {
  burning: 0xff7a2a, chilled: 0x7ac8ff, frozen: 0xbfe6ff, slimed: 0x7ad24a, poisoned: 0x9a4ad2, stunned: 0xffe14a, confused: 0xff8ad2,
  feared: 0xb0b0b0, rooted: 0x8a5a2a, frogged: 0x4ad24a, dancing: 0xff4aa0, blinded: 0x303030, blessed: 0xfff0a0, hardened: 0xa0a0b0,
  fed: 0xf0c080, spurred: 0xffa040, wet: 0x4a7ad2, marked: 0xff4a4a, floating: 0xc0c0ff,
};
export { Texture, W_PX, H_PX };
