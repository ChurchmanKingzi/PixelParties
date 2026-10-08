// Artillerie-Zusatzwirkungen je Karte (Einschlag, Abschuss)

import { TPS } from './constants';
import { igniteModule, hurtModule, modCenter } from './combat';
import { addStatus, createUnit, hurt } from './units';
import { UNITS } from './data';
import type { Projectile, Unit } from './types';
import { dist, type World } from './world';

export interface ArtFx {
  coreMult?: number;
  personMult?: (u: Unit) => number;
  onFire?: (w: World, u: Unit, tgt: { x: number; y: number }) => void;
  onImpact?: (w: World, p: Projectile, x: number, y: number, src: Unit | null) => void;
}

function moduleAt(w: World, x: number, y: number) {
  return w.moduleAt(Math.floor(x), Math.floor(y));
}

function launchUnit(w: World, p: Projectile, cid: string, hp: number, life: number, x: number, y: number) {
  const u = createUnit(w, p.team, cid, x, y);
  u.baseHp = hp; u.maxHp = hp; u.hp = hp;
  u.s.lifeUntil = w.tick + Math.round(life * TPS);
  w.emit({ t: 'fx', x, y, name: 'puff' });
  return u;
}

export const ART_FX: Record<string, ArtFx> = {
  'UA-02': {
    onImpact: (w, p, x, y) => {
      const m = moduleAt(w, x, y);
      if (m && m.owner !== p.team && (m.material === 'wood' || m.material === 'organic')) igniteModule(w, m, 5);
    },
  },
  'UA-04': { onImpact: (w, p, x, y) => { launchUnit(w, p, 'US-02', 25, 12, x, y); } },
  'UA-05': { onImpact: (w, p, x, y) => { launchUnit(w, p, 'US-05', 70, 20, x, y); } },
  'UA-06': {
    onImpact: (w, p, x, y) => {
      const m = moduleAt(w, x, y);
      if (m && m.owner !== p.team) m.frozen = w.tick + 5 * TPS;
      for (const u of w.near(x, y, 1.6, (o) => o.team !== p.team)) addStatus(w, u, 'chilled', 5);
    },
  },
  'UA-07': {
    onImpact: (w, p, x, y) => {
      w.areas.push({ id: w.id(), team: p.team === 0 ? 1 : 0, x, y, r: 1.6, until: w.tick + 8 * TPS, kind: 'cloud', dps: 6, dtype: 'G', src: p.src });
    },
  },
  'UA-08': {
    onImpact: (w, p, x, y) => {
      for (const u of w.near(x, y, 1.3, (o) => o.team !== p.team)) {
        const d = UNITS[u.cid];
        if (d && (d.range ?? 1) > 3) addStatus(w, u, 'blinded', 8);
      }
      for (const m of w.modules.values()) {
        if (m.owner !== p.team && m.kind === 'tower' && !m.destroyed) {
          const c = modCenter(m);
          if (dist(c.x, c.y, x, y) <= 1.5) m.s.blind = w.tick + 8 * TPS;
        }
      }
    },
  },
  'UA-11': {
    onImpact: (w, p, x, y, src) => {
      const m = moduleAt(w, x, y);
      if (m && m.owner !== p.team && w.rng.chance(0.2)) m.shortCircuit = w.tick + 3 * TPS;
      let n = 0;
      for (const o of w.modules.values()) {
        if (o.owner === p.team || o.destroyed || (m && o.id === m.id) || n >= 3) continue;
        const c = modCenter(o);
        if (dist(c.x, c.y, x, y) <= 3.5) { hurtModule(w, o, p.structDmg * 0.5, 'B', src, p.team); n++; }
      }
    },
  },
  'UA-13': {
    onImpact: (w, p, x, y) => {
      for (const u of w.near(x, y, 1.6, (o) => o.team !== p.team && (o.cat === 'citizen' || o.cat === 'civilian' || o.maxHp <= 150))) addStatus(w, u, 'frogged', 6);
    },
  },
  'UA-15': { personMult: (u) => (u.armor === 'bone' || u.armor === 'spirit' ? 2 : 1) },
  'UA-17': { coreMult: 1.3 },
  'UA-18': {
    onImpact: (w, p, x, y, src) => {
      const dx = x - p.x0, dy = y - p.y0, d = Math.hypot(dx, dy) || 1;
      for (let k = 1; k <= 3; k++) {
        const px = x + (dx / d) * k, py = y + (dy / d) * k;
        const m = moduleAt(w, px, py);
        if (m && m.owner !== p.team && !m.destroyed) hurtModule(w, m, p.structDmg * 0.5, p.dtype, src, p.team);
        for (const u of w.near(px, py, 0.8, (o) => o.team !== p.team)) hurt(w, u, p.personDmg * 0.5, p.dtype, src);
      }
    },
  },
};
