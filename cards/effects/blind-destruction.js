// ═══════════════════════════════════════════
//  CARD EFFECT: "Blind Destruction"
//  Spell (Normal, Lv1, Destruction Magic)   ← Level ab v737 (war 2)
//
//  „Send all Artifacts equipped to all Heroes on the board, except the
//   user, to the discard pile. Every Hero takes 50 damage times the
//   number of their Artifacts discarded by this effect.\"
//
//  Lesart
//  ──────
//  • „except the user\" nimmt den WIRKENDEN HELDEN aus der Menge der
//    Helden heraus — seine Ausruestung bleibt liegen, und er nimmt
//    folglich auch keinen Schaden. Alle uebrigen Helden BEIDER Seiten
//    sind betroffen, die eigenen eingeschlossen: „blind\" ist hier
//    Programm.
//  • Gezaehlt wird pro Held, was DIESER Effekt tatsaechlich abgeraeumt
//    hat. Was an einer Schutzklausel haengenbleibt (Cardinal-Immunitaet,
//    `immovable`, Defending the Gate, Effekt-Waechter), zaehlt nicht
//    mit — kein Schaden fuer ein Artefakt, das noch da ist.
//  • Reihenfolge wie im Text: ERST alles abraeumen, DANN der Schaden.
//    Sonst koennte ein Heldentod mitten im Abraeumen die restliche
//    Ausruestung verschieben.
//  • Der Schaden ist Effektschaden vom Zauber, kein Angriff — Rueckstoss
//    und Angriffsreiter greifen nicht.
//
//  Auftritt (v738, Als Vorgabe 5.9.)
//  ─────────────────────────────────
//  Hohe Stichflammen (`flame_jet`) in ZWEI Wellen, passend zur
//  Reihenfolge des Textes: erst schiessen sie ueber jedem betroffenen
//  Artefakt hoch und huellen es ein, dann — nachdem alles abgeraeumt
//  ist — ueber den Helden selbst.
//
//  Innerhalb einer Welle laeuft alles GLEICHZEITIG, nicht Held fuer
//  Held: der Zauber ist ein einziger Schlag. Erst stehen alle Saeulen,
//  dann faellt der gesamte Schaden ohne Pause dazwischen.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Blind Destruction';
const DAMAGE_JE_ARTEFAKT = 50;

/** Alle an diesem Helden ausgeruesteten Artefakte. */
function ausruestungAm(engine, pi, heroIdx) {
  const out = [];
  for (const inst of (engine.cardInstances || [])) {
    if (inst.zone !== 'support') continue;
    if (inst.owner !== pi || inst.heroIdx !== heroIdx) continue;
    if (inst.faceDown) continue;
    const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
    if (!cd || !hasCardType(cd, 'Artifact')) continue;
    if (!engine.isEquipInZone(inst.name, inst)) continue;
    out.push(inst);
  }
  return out;
}

/** Alle betroffenen Helden — beide Seiten, ohne den Wirker. */
function betroffeneHelden(engine, casterPi, casterHeroIdx) {
  const treffer = [];
  const gs = engine.gs;
  for (let pi = 0; pi < (gs.players || []).length; pi++) {
    const ps = gs.players[pi];
    for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
      if (pi === casterPi && hi === casterHeroIdx) continue;   // „except the user\"
      const hero = ps.heroes[hi];
      if (!hero?.name) continue;
      const eq = ausruestungAm(engine, pi, hi);
      if (eq.length === 0) continue;
      treffer.push({ pi, heroIdx: hi, hero, ausruestung: eq });
    }
  }
  return treffer;
}

module.exports = {
  cpuMeta: {
    dealsDamage: true,
    // Trifft auch die EIGENEN Helden — der Pilot soll das einpreisen.
    hitsOwnSide: true,
  },

  /** Spielbar, sobald irgendwo ausserhalb des Wirkers Ausruestung liegt. */
  spellPlayCondition(gs, pi, engine) {
    if (!engine) return true;
    for (let p = 0; p < (gs.players || []).length; p++) {
      for (let hi = 0; hi < (gs.players[p]?.heroes || []).length; hi++) {
        if (ausruestungAm(engine, p, hi).length > 0) return true;
      }
    }
    return false;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const casterHeroIdx = ctx.cardHeroIdx;

      const betroffen = betroffeneHelden(engine, pi, casterHeroIdx);
      if (betroffen.length === 0) { gs._spellCancelled = true; return; }

      // Auftritt: ab hier gibt es keine Abbruchstelle mehr — der Zauber
      // laeuft ohne Zielwahl und ohne Kosten durch (Regel v736).
      await engine.showTriggeredEffect(CARD_NAME);

      // ── Welle 1: Stichflammen ueber der Ausruestung ──────────────
      let gestaffelt = 0;
      for (const eintrag of betroffen) {
        for (const inst of eintrag.ausruestung) {
          engine._broadcastEvent('play_zone_animation', {
            type: 'flame_jet', owner: eintrag.pi,
            heroIdx: eintrag.heroIdx, zoneSlot: inst.zoneSlot,
          });
          gestaffelt++;
          if (gestaffelt % 2 === 0) await engine._delay(90);
        }
      }
      // Die Saeulen brennen, BEVOR die Karten verschwinden — sonst
      // stuende die Flamme ueber einer leeren Zone.
      await engine._delay(430);

      // ── Schritt 1: abraeumen, und dabei zaehlen, was WIRKLICH faellt ──
      for (const eintrag of betroffen) {
        eintrag.gefallen = 0;
        for (const inst of eintrag.ausruestung) {
          const vorher = inst.zone;
          await engine.actionDestroyCard(ctx.card, inst, { sourceName: CARD_NAME });
          // Nur zaehlen, was die Zone tatsaechlich verlassen hat —
          // Schutzklauseln lassen `actionDestroyCard` still aussteigen.
          if (vorher === 'support' && inst.zone !== 'support') eintrag.gefallen++;
        }
      }
      engine.sync();
      await engine._delay(260);

      // ── Welle 2: alle Helden GLEICHZEITIG ─────────────────────────
      // Al 5.9.: entweder Flamme+Schaden je Held nacheinander oder
      // alles auf einmal. Gewaehlt ist „auf einmal", weil der Zauber
      // EIN Schlag ist und der Schaden ohnehin gesammelt auf dem
      // Brett landet — nacheinander sah es aus, als kaeme erst eine
      // Reihe Flammen und dann irgendwann der Schaden.
      const treffer = betroffen.filter(x => x.gefallen > 0
        && gs.players[x.pi]?.heroes?.[x.heroIdx]?.hp > 0);

      for (const eintrag of treffer) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'flame_jet', owner: eintrag.pi, heroIdx: eintrag.heroIdx, zoneSlot: -1,
        });
      }
      engine.sync();
      // Die Saeulen stehen, dann faellt der Schaden — in einem Zug fuer
      // alle, ohne Pause dazwischen.
      await engine._delay(420);

      for (const eintrag of treffer) {
        const hero = gs.players[eintrag.pi]?.heroes?.[eintrag.heroIdx];
        if (!hero?.name || hero.hp <= 0) continue;
        await engine.actionDealDamage(
          { name: CARD_NAME, owner: pi, heroIdx: casterHeroIdx, controller: pi },
          hero, DAMAGE_JE_ARTEFAKT * eintrag.gefallen, 'destruction_spell',
        );
      }
      await engine._delay(240);

      engine.sync();
    },
  },
};
