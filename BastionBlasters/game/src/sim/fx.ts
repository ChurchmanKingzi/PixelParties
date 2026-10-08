// Kartenverhalten: deklarative Parameter und kleine Hooks je Karte.
// Die Engine liest nur diese Strukturen; neue Karten brauchen hier einen Eintrag, nicht neuen Engine-Code.

import type { DType, Team } from './constants';
import type { Area, StatusId, Unit } from './types';
import type { World } from './world';

export interface HitStatus {
  s: StatusId;
  dur: number;
  chance?: number;
  power?: number;
}

export interface UnitFx {
  // Bewegung und Sichtbarkeit
  flying?: boolean;
  ghost?: boolean;
  invisible?: boolean; // unsichtbar bis zum ersten Angriff
  burrow?: boolean;
  stationary?: boolean;
  ignoreTraps?: boolean;
  // Immunitäten
  immune?: StatusId[];
  noKnock?: boolean;
  fireImmune?: boolean;
  poisonImmune?: boolean;
  // Verwundbarkeit und Schutz
  blockMelee?: number;
  fireVuln?: number;
  dormantMult?: number;
  dodge?: number; // Sekunden Abklingzeit (weicht Nahkampfangriffen aus)
  // Angriff
  lifesteal?: number;
  onHit?: HitStatus[];
  firstHit?: { mult?: number; knock?: number; stun?: number; root?: number };
  firstVsCiv?: number;
  knock?: number;
  area?: number;
  multi?: number;
  structBonus?: number;
  randomType?: boolean;
  fearCiv?: number; // Chance auf Furcht bei Zivilisten
  fearAny?: number;
  ramp?: { perS: number; max: number }; // Angriffstempo wächst im Kampf
  overheat?: { after: number; pause: number };
  // Tod
  revive?: { delay: number; frac: number; per?: 'wave' | 'once' };
  onDeath?: (w: World, u: Unit, killer: Unit | null) => void;
  onKill?: (w: World, u: Unit, victim: Unit) => void;
  onAttack?: (w: World, u: Unit, target: Unit) => void;
  // Auren
  auraEnemy?: { r: number; speed?: number; atk?: number };
  auraAlly?: { r: number; dmgDealt?: number; dmgTaken?: number; atk?: number; fearImmune?: boolean; room?: boolean; civ?: boolean };
  taunt?: number;
  controlZone?: number;
  // Zivilisten
  heal?: { r: number; hps: number; targets: number };
  repair?: { hps: number; r: number; rebuild: boolean };
  tick?: (w: World, u: Unit) => void;
  leash?: number;
  // Beschreibung für die Oberfläche: ist die Kartenwirkung im Prototyp umgesetzt?
  impl?: 'full' | 'partial' | 'stats';
}

export const UNIT_FX: Record<string, UnitFx> = {};
const EMPTY: UnitFx = {};
export function unitFx(cid: string): UnitFx {
  return UNIT_FX[cid] ?? EMPTY;
}

export type { Area, DType, Team };
