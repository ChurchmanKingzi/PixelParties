// ═══════════════════════════════════════════
//  GETEILTE HELFER: Damus / Ifrit / Armageddon  (v1100)
//
//  Die drei Karten verweisen kreuz und quer aufeinander — Ifrit
//  verstaerkt Armageddon, Damus schuetzt Ifrit und verbilligt
//  Armageddon, Armageddon verschont Ifrit. Damit jede Frage NUR EINMAL
//  beantwortet wird, stehen die gemeinsamen Abfragen hier.
//
//  ★ Warum ein eigenes Modul und keine drei Kopien: die Frage „wieviele
//  Ifrits kontrolliert X" wird an SECHS Stellen gebraucht (Damus'
//  Stufensenkung, Damus' Armageddon-Immunitaet, Armageddons
//  Schadensaufschlag, Ifrits Platzierungs-Gate …). Drei Kopien liefen
//  beim ersten Regelwechsel auseinander.
// ═══════════════════════════════════════════

const { hatEffekt } = require('./_gained-effects-shared');

const IFRIT = 'Ifrit';
const ARMAGEDDON = 'Armageddon';
const DAMUS = 'Damus, the Prophet of Apocalypse';

/**
 * ★ Traegt dieser Held Damus' Effekt — als Damus selbst ODER als
 * GEWONNENER Effekt („This Hero gains the effects of …": Pseudonia & Co.)?
 *
 * Als Befund (Tester): Pseudonia erbte Damus' Armageddon-Verbilligung nicht.
 * Die Vertraege am Heldenskript laufen ueber `heroScriptOf` und kommen
 * deshalb auch bei Pseudonia an — aber Damus' eigener Code und dieser
 * Helfer fragten ausdruecklich `hero.name === DAMUS` und blieben fuer jeden
 * Erben stumm. EIN Ort fuer diese Frage, damit kein weiterer Aufrufer sie
 * wieder am Namen festmacht.
 */
function hatDamusEffekt(hero) {
  return hatEffekt(hero, DAMUS);
}

/** Alle „Ifrit"-Kreaturen, die `pi` gerade KONTROLLIERT. */
function ifritsOf(engine, pi) {
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.name !== IFRIT) continue;
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    out.push(inst);
  }
  return out;
}

/** Liegt ein lebender, handlungsfaehiger Damus auf Seite `pi`? */
function damusActive(engine, pi) {
  const ps = engine.gs.players[pi];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hatDamusEffekt(hero)) continue;
    if (hero.hp <= 0) continue;
    if (engine._isHeroEffectSilenced(pi, hi)) continue;
    return { hero, heroIdx: hi };
  }
  return null;
}

/** Ist `name` eine „Armageddon"-Karte? (Namensstamm, wie im Projekt ueblich) */
function isArmageddon(name) {
  return typeof name === 'string' && name.includes(ARMAGEDDON);
}

/**
 * ★ Der Seitenvergleich, den Damus' Schutz braucht.
 * „take no damage from YOUR OPPONENT's cards or effects" — es zaehlt,
 * wem die QUELLE gehoert, nicht wer die Kreatur kontrolliert.
 */
function sourceSide(source) {
  if (!source || typeof source !== 'object') return -1;
  const s = source.controller ?? source.owner;
  return (typeof s === 'number') ? s : -1;
}

/** Wirkt Damus' Effekt am Helden (pi, hi) gerade — lebend, nicht stummgeschaltet? */
function damusEffektWirkt(engine, pi, hi) {
  const hero = engine.gs.players[pi]?.heroes?.[hi];
  if (!hatDamusEffekt(hero) || hero.hp <= 0) return false;
  return !engine._isHeroEffectSilenced(pi, hi);
}

/**
 * ★ CPU-Deck-Regel (Al): „Spielt die CPU Damus, beschwoert sie JEDE Runde
 * mindestens eine Ifrit." — ist diese Pflicht in diesem Zug schon erfuellt?
 * Eine Ifrit, die in DIESEM Zug aufs Brett kam (Damus' Platzierung ODER
 * eine normale Beschwoerung), erfuellt sie; `turnPlayed` stempelt die Engine
 * bei jedem Betreten der Support Zone.
 */
function ifritDiesenZugAufsBrett(engine, pi) {
  const zug = engine.gs?.turn || 0;
  return ifritsOf(engine, pi).some(i => i.turnPlayed === zug);
}

/**
 * Steht Damus' Platzierung fuer `pi` in diesem Zug noch offen UND ist sie
 * ausfuehrbar (Ifrit auf der Hand, freie Zone, Effekt nicht schon benutzt)?
 * Damus selbst oder ein Erbe seines Effekts (Pseudonia): die Sperre haengt am
 * Kartennamen und am Spieler (`engine.heroHoptKey`), nicht am Traeger.
 */
function damusPlatzierungOffen(engine, pi) {
  const gs = engine.gs;
  const ps = gs?.players?.[pi];
  if (!(ps?.hand || []).includes(IFRIT)) return false;
  for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hatDamusEffekt(hero) || hero.hp <= 0) continue;     // Damus selbst ODER Erbe des Effekts
    if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.negated) continue;
    if (engine._isHeroEffectSilenced(pi, hi)) continue;
    if (gs.hoptUsed?.[engine.heroHoptKey(DAMUS, pi)] === gs.turn) continue;
    if (engine.getFreeSupportZones(pi, { nachKontrolle: true, livingHeroesOnly: true }).length > 0) return true;
  }
  return false;
}

module.exports = {
  IFRIT, ARMAGEDDON, DAMUS,
  ifritsOf, damusActive, damusEffektWirkt, hatDamusEffekt, isArmageddon, sourceSide,
  ifritDiesenZugAufsBrett, damusPlatzierungOffen,
};
