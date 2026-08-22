// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Bomb"
//  Potion (Normal)
//
//  "Deal 20 damage to all targets your opponent controls times the
//   number of different \"Future Tech\" cards in your discard pile.
//   This damage cannot exceed 100. You can only play 1 \"Future Tech
//   Bomb\" per turn."
//
//  ── Die zweite Zählart des Archetyps ──
//  Nicht „wie viele Kopien von MIR", sondern „wie viele VERSCHIEDENE
//  Future-Tech-Namen". Die Bombe belohnt also Breite statt Tiefe — wer
//  mit Mysterious Core drei verschiedene Artefakte entsorgt hat, trifft
//  härter als jemand mit drei Kopien derselben Karte.
//
//  Und wie alles hier zählt sie sich NICHT selbst mit (Als Ruling
//  21.8.): bei leerer Ablage 0 Schaden. Die Bombe bleibt trotzdem
//  spielbar — sie ist danach selbst ein Name in der Ablage.
//
//  ── Der Deckel ──
//  „This damage cannot exceed 100" heißt: 5 verschiedene Namen sind das
//  Maximum, alles darüber verpufft. Bewusst VOR der Schadensausteilung
//  gedeckelt, nicht danach — Erhöhungen von außen (Angler Angel) sollen
//  auf den gedeckelten Wert wirken dürfen, nicht auf den rohen.
//
//  ── Gleichzeitig, nicht nacheinander ──
//  Alle Ziele teilen sich EIN Quellobjekt. Das ist die Kennzeichnung,
//  an der Angler Angel „das fällt gleichzeitig" erkennt (v518) — sonst
//  bekäme nur das erste Ziel den Bonus.
// ═══════════════════════════════════════════

const { verschiedeneFutureTechInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Bomb';
const JE_NAME = 20;
const DECKEL = 100;

module.exports = {
  isPotion: true,

  canActivate(gs, playerIdx) {
    // Harte Rundensperre — sonst KEIN Gate: eine Bombe ohne Ablage ist
    // eine legitime (wenn auch magere) Investition in die Ablage.
    return gs.hoptUsed?.[`future-tech-bomb:${playerIdx}`] !== gs.turn;
  },

  async resolve(engine, pi) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    const oi = pi === 0 ? 1 : 0;
    if (!ps) return;

    engine.claimHOPT('future-tech-bomb', pi);

    const namen = verschiedeneFutureTechInAblage(gs, pi);
    const schaden = Math.min(DECKEL, JE_NAME * namen);

    engine.log('ft_bomb', {
      player: ps.username, names: namen, damage: schaden,
      capped: JE_NAME * namen > DECKEL,
    });

    if (schaden <= 0) { engine.sync(); return; }

    const ziele = [...engine.getHeroTargets(oi), ...engine.getCreatureTargets(oi)];
    if (ziele.length === 0) { engine.sync(); return; }

    // ── Wuchtigere Explosion (Als Rueckmeldung 21.8.) ──
    // Statt der Standard-`explosion` der skalierende Feuerschlag
    // `soul_shard_inferno`: weisser Kern, aufsteigende Flammensaeule,
    // nachgelagerte zweite Welle — und `intensity` (1-8) steuert, wie
    // heftig. Das koppelt die Show an den Schaden: eine 20er-Bombe
    // knallt kleiner als eine gedeckelte 100er. Die Animation hat
    // bereits einen Klang (`elem_fire`), es ist also kein neuer Typ
    // und damit auch keine neue Klangzeile noetig.
    const wucht = Math.max(1, Math.min(8, Math.round(schaden / 12)));
    for (const t of ziele) {
      engine._broadcastEvent('play_zone_animation', {
        type: 'soul_shard_inferno', intensity: wucht,
        owner: t.owner, heroIdx: t.heroIdx,
        zoneSlot: t.type === 'equip' ? t.slotIdx : -1,
      });
    }
    await engine._delay(520);

    // EIN Quellobjekt für den ganzen Schlag — siehe Kopf.
    const quelle = { name: CARD_NAME, owner: pi, heroIdx: -1, controller: pi };
    const stapel = [];
    for (const t of ziele) {
      if (t.type === 'hero') {
        const held = gs.players[t.owner]?.heroes?.[t.heroIdx];
        if (held && held.hp > 0) await engine.actionDealDamage(quelle, held, schaden, 'other');
      } else if (t.cardInstance) {
        stapel.push({
          inst: t.cardInstance, amount: schaden, type: 'other', source: quelle,
          sourceOwner: pi, canBeNegated: true, isStatusDamage: false, animType: null,
        });
      }
    }
    if (stapel.length > 0) await engine.processCreatureDamageBatch(stapel);
    engine.sync();
  },
};
