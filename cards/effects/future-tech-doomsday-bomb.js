// ═══════════════════════════════════════════
//  CARD EFFECT: "Future Tech Doomsday Bomb"
//  Artifact (Equipment, Cost 10)
//
//  "When the equipped Hero would hit 1 or more targets your opponent
//   controls with an Attack, negate that Attack. If you do, all targets
//   on the board take damage equal to 50 times the combined number of
//   \"Future Tech Doomsday Bomb\" cards in all discard piles. This
//   damage cannot be increased. Send this card to the discard pile
//   afterwards. If all Heroes both players control are defeated after
//   this effect resolves, this card's original owner loses the game.
//   You can only play 1 \"Future Tech Doomsday Bomb\" per game."
//
//  ── Der Ausloeser: `onAttackDeclare` ───────────────────────────────
//  Der kanonische Platz für „zwischen Zielwahl und Einschlag"
//  (CARD_API). Er feuert genau EINMAL je Attacke (Dedup über
//  `source._attackDeclareFired`) und trägt die gewählten Ziele.
//
//  „negate that Attack" heisst hier `ctx.setAmount(0)`: die Attacke
//  löst sich auf, richtet aber nichts aus. Ein härteres Abbrechen gibt
//  es an dieser Stelle nicht — und es wäre auch falsch, denn die
//  Attacke IST erklärt worden, sie verpufft nur.
//
//  ★ „targets YOUR OPPONENT controls" (Als Präzisierung 22.8.):
//  mindestens ein Ziel muss dem Gegner des Trägers gehören. Ein
//  Angriff, der ausschliesslich eigene Ziele trifft (umgeleitet,
//  bezaubert, oder eine Karte, die auf die eigene Seite schlägt),
//  zündet die Bombe NICHT.
//
//  ── Der Zähler geht über BEIDE Ablagen ─────────────────────────────
//  „in all discard piles" — anders als im ganzen restlichen Archetyp,
//  wo nur die eigene zählt. Deshalb hier ausdrücklich beide Seiten
//  über `zaehleInAblage`, damit Aliasse (Copy Device) auf beiden
//  Seiten korrekt mitgezählt werden.
//
//  ── „This damage cannot be increased" ──────────────────────────────
//  Neuer Engine-Vertrag `cannotBeIncreased` (v579), einseitig: Angler
//  Angel & Co. dürfen nicht draufschlagen, Schilde dürfen weiter
//  abziehen. Der Kartentext verbietet nur das Erhöhen.
//
//  ── Die Verlustbedingung ───────────────────────────────────────────
//  Bunny Bombs hat exakt dieselbe Klausel und damit die Bauform:
//   • `gs._deferGameOverCheck` hält die Auswertung an, solange der
//     Schlag läuft — sonst entschiede die Reihenfolge der Ziele über
//     den Sieger.
//   • `gs._drawLoserIdx` benennt den Verlierer für den Fall, dass am
//     Ende BEIDE Seiten ausgelöscht sind. Das ist der
//     `original owner` — bei einer Ausrüstung auf einem gegnerischen
//     Helden wäre das nicht dieselbe Seite wie `inst.owner`.
//   • Danach EINMAL `checkAllHeroesDead()`, mit dem Hinweis noch
//     gesetzt.
//
//  ── „per game" ─────────────────────────────────────────────────────
//  `oncePerGame` — der Server prüft und stempelt es im Equip-Zweig von
//  `doPlayArtifact` selbst. Copy Device liest denselben Merker und
//  bietet eine bereits verbrauchte Bombe nicht mehr zum Kopieren an.
// ═══════════════════════════════════════════

const { zaehleInAblage } = require('./_future-tech-shared');

const CARD_NAME = 'Future Tech Doomsday Bomb';
const SCHADEN_JE_KOPIE = 50;
/** Vorlauf des Kernschlags, bevor der Schaden faellt — so lange,
 *  bis der Feuerball steht und die Kappe aufquillt. */
const ZUENDUNG_MS = 900;

/** Kopien in BEIDEN Ablagen — „in all discard piles". */
function kopienUeberall(gs) {
  return zaehleInAblage(gs, 0, CARD_NAME) + zaehleInAblage(gs, 1, CARD_NAME);
}

/** Alle Ziele auf dem GANZEN Brett, beide Seiten. */
function alleZiele(engine) {
  return {
    helden: [...engine.getHeroTargets(0), ...engine.getHeroTargets(1)],
    kreaturen: [...engine.getCreatureTargets(0), ...engine.getCreatureTargets(1)],
  };
}

/**
 * Gehört mindestens ein getroffenes Ziel dem Gegner des Trägers?
 *
 * `ctx.target` ist bei Einzelzielen ein Objekt, bei Flächenangriffen
 * ein Array — der Hook-Vertrag sagt ausdrücklich, dass Listener beide
 * Formen aushalten müssen.
 */
function trifftGegner(ziele, gegnerIdx) {
  const liste = Array.isArray(ziele) ? ziele : (ziele ? [ziele] : []);
  for (const t of liste) {
    if (!t) continue;
    // Kreaturziele tragen ihre Seite in `owner`; ein Heldenobjekt aus
    // dem Zielsammler ebenfalls. Eine rohe Heldenreferenz (ohne
    // `owner`) kommt hier nicht an — der Hook bekommt Zieleintraege.
    const seite = t.owner ?? t.controller;
    if (seite === gegnerIdx) return true;
  }
  return false;
}

module.exports = {
  activeIn: ['support'],
  oncePerGame: true,

  hooks: {
    onAttackDeclare: async (ctx) => {
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;
      const engine = ctx._engine;
      const gs = engine.gs;

      // Der Träger — bei einer Ausrüstung auf fremder Seite ist das
      // NICHT `inst.owner` (Powder-Keg-Modell).
      const besitzer = inst.originalOwner ?? inst.owner;
      const gegner = besitzer === 0 ? 1 : 0;

      // Nur die Attacke des AUSGERUESTETEN Helden.
      const q = ctx.source;
      if (!q) return;
      if (q.heroIdx !== inst.heroIdx) return;
      if ((q.owner ?? q.controller) !== inst.owner) return;
      // Nur, wenn wirklich etwas ausgeteilt würde.
      if (!(ctx.amount > 0)) return;
      // ★ Und nur bei mindestens einem GEGNERISCHEN Ziel.
      if (!trifftGegner(ctx.target, gegner)) return;

      // Einmal ist einmal: eine zweite Attacke im selben Zug findet die
      // Karte ohnehin nicht mehr im Feld, aber der Riegel macht das
      // unabhängig von der Reihenfolge sicher.
      if (inst.counters?._doomsdayFired) return;
      if (!inst.counters) inst.counters = {};
      inst.counters._doomsdayFired = true;

      // ── „negate that Attack" ──
      ctx.setAmount(0);

      const kopien = kopienUeberall(gs);
      const schaden = SCHADEN_JE_KOPIE * kopien;
      engine.log('ft_doomsday_bomb', {
        player: gs.players[besitzer]?.username,
        copies: kopien, damage: schaden,
      });

      engine._broadcastEvent('card_reveal', {
        cardName: CARD_NAME, playerIdx: besitzer, sfx: 'ability_activate',
      });
      await engine._delay(320);

      const { helden, kreaturen } = alleZiele(engine);

      // ── Der Schlag ──
      // Spielende-Prüfung anhalten und den Verlierer eines
      // Unentschiedens benennen — beides bis zum Ende der Explosion
      // (Bunny-Bombs-Bauform).
      gs._deferGameOverCheck = (gs._deferGameOverCheck || 0) + 1;
      const vorherigerVerlierer = gs._drawLoserIdx;
      gs._drawLoserIdx = besitzer;
      try {
        if (schaden > 0) {
          // ── EIN Kernschlag ueber dem ganzen Brett (Als Vorgabe 22.8.:
          //    „eine zentrale, gewaltige Explosion in der Mitte des
          //    Kampffeldes, die alle Ziele gleichzeitig trifft, am
          //    besten mit Pilzwolke") ──
          // Vorher lief je Ziel eine kleine `explosion` — bei sieben
          // Zielen sieben Wuemmse auf Kartengroesse, was der Karte
          // nicht gerecht wird. Der neue Kanal `zoneType: 'board'`
          // haengt die Animation an die KAMPFFLAECHE statt an eine
          // Zone; sie skaliert sich an deren Masse.
          engine._broadcastEvent('play_screen_shake', { intensity: 'heavy' });
          engine._broadcastEvent('play_zone_animation', {
            type: 'nuke_blast', zoneType: 'board', owner: besitzer, heroIdx: -1, zoneSlot: -1,
          });
          await engine._delay(ZUENDUNG_MS);

          // EIN Quellobjekt fuer den ganzen Schlag — Reaktionen und die
          // Effekt-Immunitaet sehen ihn als EINEN Vorgang.
          const quelle = { name: CARD_NAME, owner: besitzer, heroIdx: inst.heroIdx };
          for (const t of helden) {
            const held = gs.players[t.owner]?.heroes?.[t.heroIdx];
            if (!held?.name || held.hp <= 0) continue;
            await engine.actionDealDamage(quelle, held, schaden, 'artifact',
              { cannotBeIncreased: true });
          }
          for (const t of kreaturen) {
            if (!t.cardInstance || t.cardInstance.zone !== 'support') continue;
            await engine.actionDealCreatureDamage(
              quelle, t.cardInstance, schaden, 'artifact',
              { sourceOwner: besitzer, canBeNegated: true, cannotBeIncreased: true },
            );
          }
        }
      } finally {
        gs._deferGameOverCheck = Math.max(0, (gs._deferGameOverCheck || 1) - 1);
      }

      // ── „Send this card to the discard pile afterwards" ──
      // VOR der Siegpruefung: der Kartentext sagt „afterwards", und die
      // Pruefung soll das endgueltige Brett sehen.
      if (inst.zone === 'support') {
        await engine.actionDestroyCard(
          { name: CARD_NAME, owner: besitzer, heroIdx: inst.heroIdx }, inst,
          { toOwnerDiscard: true },
        );
      }

      // Jetzt EINMAL auswerten — mit dem Unentschieden-Hinweis noch
      // gesetzt, damit „its original owner loses the game" greift.
      try {
        await engine.checkAllHeroesDead();
      } finally {
        if (vorherigerVerlierer === 0 || vorherigerVerlierer === 1) {
          gs._drawLoserIdx = vorherigerVerlierer;
        } else {
          delete gs._drawLoserIdx;
        }
      }
      engine.sync();
    },
  },
};
