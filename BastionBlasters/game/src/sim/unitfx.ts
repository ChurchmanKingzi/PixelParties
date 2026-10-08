// Fähigkeiten der Einheitenkarten (Verbindung zwischen Kartentext und Engine).
// impl: 'full' = Text vollständig umgesetzt (ohne Rank-3-Talent), 'partial' = Kern umgesetzt, 'stats' = nur Werte und Rolle.

import { DT, TPS, type Team } from './constants';
import { modCenter } from './combat';
import { UNIT_FX, type UnitFx } from './fx';
import { UNITS } from './data';
import { addStatus, gainXp, healUnit, hurt, hasStatus, removeStatus } from './units';
import type { Unit } from './types';
import { dist, type World } from './world';

const enemyOf = (t: Team): Team => (t === 0 ? 1 : 0);
const every = (w: World, u: Unit, key: string, secs: number): boolean => {
  if (w.tick < (u.s[key] ?? 0)) return false;
  u.s[key] = w.tick + Math.round(secs * TPS);
  return true;
};

function cloud(w: World, team: Team, x: number, y: number, r: number, secs: number, dps: number, dtype: 'G' | 'F', src: number) {
  w.areas.push({ id: w.id(), team, x, y, r, until: w.tick + Math.round(secs * TPS), kind: 'cloud', dps, dtype, src });
}

const U: Record<string, UnitFx> = {
  // ---- Sturm
  'US-01': { impl: 'full' },
  'US-02': {
    impl: 'full',
    onKill: (w, u, v) => { if (v.cat === 'citizen' || v.cat === 'civilian') { gainXp(w, u, 15); healUnit(w, u, 10, null); } },
  },
  'US-03': { impl: 'full' },
  'US-04': { impl: 'full', dodge: 5 },
  'US-05': { impl: 'full' },
  'US-06': {
    impl: 'partial',
    firstHit: { knock: 2, stun: 1 },
    tick: (w, u) => { if (!u.s.slid) u.mods.speed *= 2; },
    onAttack: (w, u) => { u.s.slid = 1; },
  },
  'US-07': { impl: 'partial', ignoreTraps: true },
  'US-08': { impl: 'partial', burrow: true },
  'US-09': { impl: 'full', ghost: true, ignoreTraps: true, fearCiv: 0.2 },
  'US-10': { impl: 'full', onHit: [{ s: 'rooted', dur: 1.5 }] },
  'US-11': {
    impl: 'full',
    onHit: [{ s: 'chilled', dur: 4 }],
    onDeath: (w, u) => { w.areas.push({ id: w.id(), team: enemyOf(u.team), x: u.x, y: u.y, r: 1.4, until: w.tick + 3 * TPS, kind: 'slush', dps: 0, dtype: 'E', status: 'chilled', statusDur: 1, src: u.id }); },
  },
  'US-12': { impl: 'partial', immune: ['stunned'], noKnock: true },
  'US-13': { impl: 'full', onDeath: (w, u) => cloud(w, enemyOf(u.team), u.x, u.y, 1.5, 5, 4, 'G', u.id) },
  'US-14': { impl: 'full', ramp: { perS: 0.05, max: 0.5 } },
  'US-15': { impl: 'partial', firstHit: { mult: 3 } },
  'US-16': { impl: 'full', randomType: true },
  'US-17': { impl: 'partial', multi: 3, onHit: [{ s: 'rooted', dur: 2 }] },
  'US-18': { impl: 'full', flying: true, lifesteal: 0.5 },
  'US-19': { impl: 'partial', flying: true },
  'US-20': { impl: 'full', invisible: true, firstVsCiv: 3 },
  'US-21': { impl: 'partial', area: 2, knock: 1 },
  'US-22': {
    impl: 'partial',
    flying: true,
    tick: (w, u) => {
      if (!every(w, u, 'roar', 8)) return;
      for (const o of w.near(u.x, u.y, 3, (x) => x.team !== u.team && (x.cat === 'citizen' || x.cat === 'civilian'))) addStatus(w, o, 'feared', 3, 1, u.id);
    },
  },
  'US-23': {
    impl: 'partial',
    tick: (w, u) => {
      if (u.s.copied) return;
      let best: Unit | null = null;
      for (const o of w.near(u.x, u.y, 3, (x) => x.team !== u.team && x.cat !== 'citizen' && !x.dead)) if (!best || o.baseHp > best.baseHp) best = o;
      if (!best) return;
      u.s.copied = 1;
      u.baseHp = best.baseHp * 1.2;
      u.hp = u.baseHp;
      const bd = UNITS[best.cid];
      if (bd?.dmg) u.s.dmgOverride = bd.dmg * 1.2;
      w.emit({ t: 'text', x: u.x, y: u.y - 0.8, text: 'copy!', color: '#c8e8ff' });
    },
  },
  // ---- Verteidiger
  'UV-01': { impl: 'full', blockMelee: 0.3 },
  'UV-02': {
    impl: 'full',
    dormantMult: 0.5,
    poisonImmune: true,
    tick: (w, u) => {
      if (u.s.dormant === undefined) u.s.dormant = 1;
      if (u.s.dormant && w.near(u.x, u.y, 3, (o) => o.team !== u.team && !o.dead && o.state !== 'burrow').length) u.s.dormant = 0;
    },
  },
  'UV-03': { impl: 'full', auraEnemy: { r: 1.0, speed: 0.65 } },
  'UV-04': {
    impl: 'full',
    tick: (w, u) => {
      const n = w.near(u.x, u.y, 1.6, (o) => o.team === u.team && o.cat === 'defender' && o.id !== u.id && !o.dead).length;
      u.mods.dmgTaken /= 1 + Math.min(0.5, 0.25 * n);
    },
  },
  'UV-05': { impl: 'partial', taunt: 3, auraEnemy: { r: 2, speed: 0.4 } },
  'UV-06': { impl: 'full', revive: { delay: 5, frac: 0.4, per: 'wave' } },
  'UV-07': {
    impl: 'full',
    fireVuln: 1.5,
    tick: (w, u) => {
      if (!every(w, u, 'rootAt', 6)) return;
      const t = w.near(u.x, u.y, 2.2, (o) => o.team !== u.team && !o.dead && !o.flying)[0];
      if (t) addStatus(w, t, 'rooted', 2, 1, u.id);
    },
  },
  'UV-08': { impl: 'full', immune: ['feared', 'poisoned', 'stunned'], poisonImmune: true },
  'UV-09': { impl: 'full', fearAny: 0.15, leash: 6 },
  'UV-10': { impl: 'full', auraEnemy: { r: 3, speed: 0.7, atk: 0.7 } },
  'UV-11': { impl: 'full', fireImmune: true, onHit: [{ s: 'burning', dur: 3 }] },
  'UV-12': { impl: 'full', stationary: true, overheat: { after: 8, pause: 2 } },
  'UV-13': { impl: 'full', auraAlly: { r: 3, dmgDealt: 1.15 } },
  'UV-14': { impl: 'partial', taunt: 3, auraAlly: { r: 4, dmgTaken: 0.7, civ: true } },
  'UV-15': {
    impl: 'full',
    onAttack: (w, u, t) => { if (!t.dead && t.maxHp <= 150) { t.state = 'swallowed'; t.s.spitAt = w.tick + 8 * TPS; t.s.reviveAt = 0; } },
  },
  'UV-16': { impl: 'full', revive: { delay: 3, frac: 0.5, per: 'once' } },
  'UV-17': {
    impl: 'partial',
    taunt: 3,
    tick: (w, u) => {
      for (const m of w.modules.values()) {
        if (m.owner !== u.team || m.destroyed || m.hp >= m.maxHp) continue;
        const c = modCenter(m);
        if (dist(c.x, c.y, u.x, u.y) < Math.max(m.cols, m.rows) / 2 + 2) m.hp = Math.min(m.maxHp, m.hp + 10 * DT);
      }
    },
  },
  // ---- Zivilisten
  'UZ-01': { impl: 'full', heal: { r: 4, hps: 8, targets: 1 } },
  'UZ-02': { impl: 'full', repair: { hps: 12, r: 1.6, rebuild: true } },
  'UZ-03': { impl: 'partial', auraAlly: { r: 4, dmgTaken: 0.87, dmgDealt: 1.1 } },
  'UZ-04': {
    impl: 'full',
    tick: (w, u) => { if (every(w, u, 'stew', 10)) for (const o of w.near(u.x, u.y, 4, (x) => x.team === u.team && !x.dead && x.cat !== 'citizen')) addStatus(w, o, 'fed', 40, 1, u.id); },
  },
  'UZ-05': {
    impl: 'partial',
    tick: (w, u) => {
      for (const o of w.near(u.x, u.y, 4, (x) => x.team === u.team)) removeStatus(o, 'burning');
      if (w.tick % 15 === 0) for (const m of w.modules.values()) if (m.owner === u.team && m.burning > w.tick) { const c = modCenter(m); if (dist(c.x, c.y, u.x, u.y) < 5) m.burning = 0; }
    },
  },
  'UZ-06': { impl: 'full', auraAlly: { r: 3, atk: 1.15, fearImmune: true } },
  'UZ-07': {
    impl: 'partial',
    tick: (w, u) => {
      const pupils = w.near(u.x, u.y, 3, (x) => x.team === u.team && x.cat !== 'citizen' && x.id !== u.id && !x.dead).slice(0, 2);
      for (const p of pupils) gainXp(w, p, 1.2 * DT);
    },
  },
  'UZ-08': {
    impl: 'full',
    tick: (w, u) => {
      if (w.tick % 15 !== 0) return;
      for (const o of w.near(u.x, u.y, 5, (x) => x.team === u.team && !x.dead && x.cat !== 'citizen')) {
        if (w.tick < (o.s.blessedAt ?? 0) || hasStatus(o, 'blessed')) continue;
        o.s.blessedAt = w.tick + 15 * TPS;
        addStatus(w, o, 'blessed', 15, 40, u.id);
        gainXp(w, u, 0.5);
        break;
      }
    },
  },
  'UZ-09': {
    impl: 'full',
    tick: (w, u) => {
      if (!every(w, u, 'potion', 12)) return;
      const cand = w.near(u.x, u.y, 4, (x) => x.team === u.team && !x.dead && x.cat !== 'citizen');
      if (!cand.length) { u.s.potion = w.tick + 30; return; }
      const t = cand[w.rng.int(cand.length)];
      const r = w.rng.int(4);
      if (r === 0) addStatus(w, t, 'strong', 10, 25);
      else if (r === 1) addStatus(w, t, 'haste', 10, 25);
      else if (r === 2) healUnit(w, t, 40, u);
      else addStatus(w, t, 'blessed', 15, 30);
      gainXp(w, u, 2);
    },
  },
  'UZ-10': { impl: 'stats' },
  'UZ-11': {
    impl: 'partial',
    tick: (w, u) => {
      const foes = w.near(u.x, u.y, 3.5, (x) => x.team !== u.team && !x.dead && !x.flying && x.state !== 'burrow');
      if (foes.length) hurt(w, foes[0], 12 * DT, 'W', u);
      for (const o of w.near(u.x, u.y, 3, (x) => x.team === u.team && !x.dead)) healUnit(w, o, 3 * DT, u);
    },
  },
  'UZ-12': { impl: 'partial', taunt: 2.5, dodge: 2 },
  'UZ-13': { impl: 'stats' },
  'UZ-14': { impl: 'full' },
  'UZ-15': { impl: 'full' },
  'UZ-16': {
    impl: 'partial',
    tick: (w, u) => {
      if (every(w, u, 'rainAt', 60)) {
        const c = w.modules.get(w.coreMod[u.team])!;
        const cc = modCenter(c);
        w.areas.push({ id: w.id(), team: enemyOf(u.team), x: cc.x, y: cc.y, r: 5, until: w.tick + 60 * TPS, kind: 'rain', dps: 0, dtype: 'W', status: 'wet', statusDur: 1.5, src: u.id });
      }
    },
  },
  'UZ-17': { impl: 'full' },
  'UZ-18': { impl: 'partial', repair: { hps: 8, r: 2.4, rebuild: false } },
  'UZ-19': {
    impl: 'partial',
    heal: { r: 4, hps: 4, targets: 1 },
    tick: (w, u) => {
      if (u.s.tw === w.waveNo) return;
      let best: Unit | null = null, bf = 0.7;
      for (const o of w.units) {
        if (o.dead || o.team !== u.team || o.cat === 'citizen' || o.id === u.id) continue;
        const f = o.hp / o.maxHp;
        if (f < bf) { bf = f; best = o; }
      }
      if (!best) return;
      u.s.tw = w.waveNo;
      healUnit(w, best, best.maxHp, u);
      gainXp(w, best, 60);
      for (const m of w.modules.values()) {
        if (m.owner !== u.team || m.destroyed) continue;
        const c = modCenter(m);
        if (dist(c.x, c.y, u.x, u.y) <= 3 + Math.max(m.cols, m.rows) / 2) m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.15);
      }
      w.emit({ t: 'text', x: u.x, y: u.y - 1, text: 'transmutation', color: '#ffe066' });
    },
  },
  // ---- Beschwörungen
  HORNET: { impl: 'full', flying: true, leash: 6 },
};

Object.assign(UNIT_FX, U);
export { U as UNIT_FX_TABLE };
