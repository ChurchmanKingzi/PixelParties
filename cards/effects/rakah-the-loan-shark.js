// ═══════════════════════════════════════════
//  CARD EFFECT: „Rakah, the Loan Shark"
//  Hero (350 HP / 0 ATK, Fighting + Occultism, PP MBS1)
//
//  „Whenever you sacrifice a Creature you control with 150 or less HP,
//   this Hero's Attack stat is permanently increased by that Creature's
//   current HP."
//
//  (Die Schwelle stand bis v950 bei 100 — Als Anpassung 12.9., in
//   cards.json UND hier.)
//
//  BAUART
//  ──────
//  • Ausloeser `onCreatureSacrificed`. Die Engine fuehrt darin die
//    zentrale Opfer-Buchhaltung (`_sacrificedTurn`, Zaehler des
//    Opfernden) — jeder Weg, der ein Opfer darstellt, laeuft durch
//    diesen Hook, egal welche Karte ihn ausloest.
//
//  • „you sacrifice a Creature you control": das Opfer gehoert MEINER
//    Seite UND ich habe es gebracht. Beides geprueft (Muster
//    Sacrificial Dagger) — sonst fuettert ein gegnerischer Effekt, der
//    meine Kreatur opfert, auch noch meinen Helden.
//
//  • ★ HP: gemeint ist in beiden Haelften des Satzes die AKTUELLE HP —
//    die zweite sagt es ausdruecklich („that Creature's current HP"),
//    und nur so passt Schwelle und Ertrag zusammen: was gemessen wird,
//    ist auch das, was man bekommt. Eine Kreatur mit 200 gedruckten,
//    aber 60 verbliebenen HP zaehlt also und bringt 60.
//
//  • ★ DAUERHAFT heisst dauerhaft, auch ueber den Tod hinweg (Als
//    Vorgabe 12.9.): `engine._applyHeroAtkDelta` schreibt direkt auf
//    `hero.atk`, ohne Ruecknahme-Zaehler auf einer Karteninstanz. Es
//    gibt in der Engine keinen Weg, der das zurueckdreht:
//    `actionReviveHero` fasst `atk` nicht an, und die einzigen
//    Rueckbuchungen (`actionRevokeAtk`, Ablauf von `_tempAtkGrants`)
//    ruecken nur eigene, ausdruecklich gebuchte Gaben zurueck.
//    Stirbt Rakah, bleibt der Wert also stehen und ist nach der
//    Wiederbelebung sofort wieder da — im Repro nachgewiesen.
//    Die Curse-Unterdrueckung kennt `_applyHeroAtkDelta` dabei
//    trotzdem: waehrend `cursed` wandert der Zuwachs in den
//    versteckten Sammler und kommt beim Reinigen mit zurueck.
//
//  • Waehrend Rakah SELBST besiegt ist, feuert der Hook nicht — der
//    Zuhoerer-Filter der Engine laesst Karten an einem toten Helden
//    grundsaetzlich aus (Regelwerk: Effekte eines besiegten Helden sind
//    negiert). Das bereits Angesammelte bleibt davon unberuehrt.
// ═══════════════════════════════════════════

const CARD_NAME = 'Rakah, the Loan Shark';
const SCHWELLE = 150;

/** Aktuelle HP einer geopferten Kreatur — Instanz oder Schnappschuss. */
function aktuelleHp(engine, opfer) {
  if (!opfer) return null;
  const ausZaehler = opfer.counters?.currentHp;
  if (Number.isFinite(ausZaehler)) return ausZaehler;
  // Manche Aufrufer reichen kreaturfoermige Nutzlasten durch (siehe
  // `runHooks`-Buchhaltung). Dann bleibt nur der gedruckte Wert.
  const cd = engine._getCardDB()[opfer.name];
  return Number.isFinite(cd?.hp) ? cd.hp : null;
}

module.exports = {
  activeIn: ['hero'],

  hooks: {
    onCreatureSacrificed: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const heroIdx = ctx.cardHeroIdx;
      const hero = gs.players[pi]?.heroes?.[heroIdx];
      if (!hero?.name) return;

      const opfer = ctx.creature;
      if (!opfer) return;
      // Meine Kreatur …
      if ((opfer.controller ?? opfer.owner) !== pi) return;
      // … und MEIN Opfer.
      const opfernder = ctx.source?.owner ?? ctx.source?.controller;
      if (opfernder != null && opfernder !== pi) return;

      const hp = aktuelleHp(engine, opfer);
      if (!Number.isFinite(hp) || hp <= 0) return;
      if (hp > SCHWELLE) return;

      // ★ Grundregel (CARD_API): ein Effekt, der aus einem HOOK heraus
      // feuert, streamt seine Karte an BEIDE Spieler.
      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      engine._applyHeroAtkDelta(hero, pi, heroIdx, hp);
      engine.log('atk_grant', { hero: hero.name, amount: hp, source: CARD_NAME });
      engine.log('rakah_collect', {
        player: gs.players[pi]?.username,
        creature: opfer.name, amount: hp, newAtk: hero.atk,
      });
      engine.sync();
    },
  },
};
