// Aufholmechanismen: Wer im Rückstand liegt, bekommt zum Zeitstopp Hilfe (mehr behalten, Neuwurf, bessere Karten,
// kostenloser Wiederaufbau von Ruinen) und lernt schneller. Gemessen wird der Zustand der Bastion, nicht die Spielleistung.

import type { Team } from './constants';
import type { World } from './world';

export interface AidLevel {
  /** Rückstand ab diesem Wert (0..1) */
  from: number;
  /** zusätzlich behaltene Karten beim Zeitstopp */
  keep: number;
  /** zusätzliche Neuwürfe */
  reroll: number;
  /** Ziehgewichte, als wäre der Zeitstopp so viele Schritte weiter (bessere Tiers) */
  tier: number;
  /** kostenlos wiederherstellbare Ruinen je Zeitstopp */
  rebuild: number;
  /** zusätzliche XP-Rate aller Einheiten bis zum nächsten Zeitstopp */
  xp: number;
  /** Anteil der Max-HP, den Kern, Bauteile und Mauern zu Beginn des Zeitstopps zurückbekommen */
  repair: number;
  /** Verstärkung: Sturmtruppen und Verteidiger bekommen so viel mehr Soll und Nachschub je Eintrag */
  surge: number;
  /** Schadensminderung gegen Bauteile, Mauern und Kern (Befestigung) */
  shield: number;
  /** Mehrschaden der eigenen Artillerie (Gegenfeuer) */
  arty: number;
}

export const AID: AidLevel[] = [
  { from: 0, keep: 0, reroll: 0, tier: 0, rebuild: 0, xp: 0, repair: 0, surge: 0, shield: 0, arty: 0 },
  { from: 0.12, keep: 1, reroll: 0, tier: 0, rebuild: 1, xp: 0.15, repair: 0.08, surge: 0, shield: 0.1, arty: 0.1 },
  { from: 0.25, keep: 1, reroll: 1, tier: 1, rebuild: 2, xp: 0.3, repair: 0.15, surge: 1, shield: 0.2, arty: 0.2 },
  { from: 0.4, keep: 2, reroll: 1, tier: 2, rebuild: 3, xp: 0.5, repair: 0.25, surge: 2, shield: 0.35, arty: 0.35 },
];

/** Zustand der Bastion 0..1: Kern (45 %), Bauwerk (45 %), kein Eroberungsdruck (10 %) */
export function standing(world: World, team: Team): number {
  const core = world.modules.get(world.coreMod[team]);
  const coreFrac = core ? Math.max(0, core.hp / core.maxHp) : 0;
  let hp = 0, max = 0;
  for (const m of world.modules.values()) {
    if (m.owner !== team || m.kind === 'core') continue;
    max += m.maxHp;
    if (!m.destroyed) hp += Math.min(m.hp, m.maxHp);
  }
  const integrity = max > 0 ? hp / max : 1;
  const pressure = Math.min(1, world.conquest[team] / 100);
  return 0.45 * coreFrac + 0.45 * integrity + 0.1 * (1 - pressure);
}

/** Rückstand gegenüber dem Gegner 0..1 (0, wenn man vorn liegt) */
export function deficit(world: World, team: Team): number {
  const other: Team = team === 0 ? 1 : 0;
  return Math.max(0, Math.min(1, standing(world, other) - standing(world, team)));
}

/** Schalter für Balancing-Läufe (Bot-Sim ohne Aufholhilfe vergleichen) */
export const catchupConfig = { enabled: true };

export function aidLevelFor(d: number): number {
  if (!catchupConfig.enabled) return 0;
  let lvl = 0;
  for (let i = 1; i < AID.length; i++) if (d >= AID[i].from) lvl = i;
  return lvl;
}

/** Stufe, die jetzt gelten würde (Vorschau in der Oberfläche) */
export function liveAidLevel(world: World, team: Team): number {
  return aidLevelFor(deficit(world, team));
}

/** Bei Beginn des Zeitstopps festgehaltene Stufe, gilt bis zum nächsten Zeitstopp */
export function aidOf(world: World, team: Team): AidLevel {
  return AID[world.aidLevel[team]];
}
