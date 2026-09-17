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

const IFRIT = 'Ifrit';
const ARMAGEDDON = 'Armageddon';
const DAMUS = 'Damus, the Prophet of Apocalypse';

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
    if (hero?.name !== DAMUS) continue;
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

module.exports = {
  IFRIT, ARMAGEDDON, DAMUS,
  ifritsOf, damusActive, isArmageddon, sourceSide,
};
