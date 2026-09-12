// ═══════════════════════════════════════════
//  CARD EFFECT: "Great Offensive"
//  Spell (Destruction Magic + Support Magic, Lv2, Normal)
//
//  „All Creatures you control immediately use their active effects an
//   additional time (even if they were summoned this turn)."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • „All Creatures you control" geht nach KONTROLLE, nicht Besitz:
//    eine geklaute Creature in meiner Reihe zaehlt mit, eine eigene,
//    die beim Gegner steht, nicht.
//  • „use their active effects" — nur Creatures, die ueberhaupt einen
//    AKTIVEN Effekt haben (`onCreatureEffect`). Passive Kreaturen sind
//    keine stillen Ausfaelle, sie haben schlicht nichts zu wiederholen.
//  • „an additional time" = ein GESCHENK: keine Aktion, keine Kosten,
//    kein HOPT-Stempel, und die normale Einmal-je-Zug-Sperre steht
//    nicht im Weg. Genau dafuer gibt es `reactivateCreatureEffect`
//    (v740, Kohta-Bauart) — kein Nachbau hier.
//  • „even if they were summoned this turn" braucht KEINEN Sonderweg:
//    die Beschwoerungsrunde wird nur im regulaeren Aktivierungspfad
//    des Servers geprueft, nicht in `reactivateCreatureEffect`.
//  • Die HARTE Sperre `_effectLockedTurn` („cannot be used another time
//    for the rest of the turn IN ANY WAY", Spirit of the Forbidden
//    Grimoire) bleibt bewusst stehen — sie ist ausdruecklich staerker
//    als eine geschenkte Wiederholung. Deshalb KEIN `ignoreEffectLock`.
//  • Die karteneigene Eignungspruefung (`canActivateCreatureEffect`)
//    bleibt ebenfalls stehen: sie sagt, ob der Effekt ueberhaupt
//    legal ausfuehrbar ist (Ziel vorhanden, Vorrat da). Ein Geschenk
//    macht einen unmoeglichen Effekt nicht moeglich.
//
//  ── REIHENFOLGE (Als Vorgabe 11.9.) ───────────────────────────────
//  Der SPIELER bestimmt die Reihenfolge: vor jeder einzelnen Creature
//  eine Galerie „Which Creature should attack next?" mit allen noch
//  offenen Creatures, sortiert wie auf dem Brett von links nach rechts
//  (Held 0..2, dann Zone 0..2). Bleibt nur noch EINE uebrig, wird sie
//  ohne Rueckfrage genommen — eine Galerie mit einer einzigen Karte
//  waere ein Klick ohne Entscheidung.
//  Die Abfrage ist NICHT abbrechbar: die Karte fragt nach der
//  Reihenfolge, nicht nach dem Ob.
//
//  Gleichnamige Creatures (zwei Cannon Tower) muessen unterscheidbar
//  bleiben. Die Galerie antwortet mit `{ cardName, source }` — deshalb
//  traegt jeder Eintrag die INSTANZ-KENNUNG als `source` und den Platz
//  als `label` (v862: die Galerie zeigt `label` als Abzeichen, statt
//  alles Unbekannte „DECK" zu nennen).
//
//  Aufgeloest wird NACHEINANDER — der Kartentext sagt „immediately",
//  nicht „at the same time"; der Gleichzeitig-Vertrag
//  (`prepareCreatureEffect`) bleibt dem Grimoire vorbehalten. Weil ein
//  Effekt das Brett veraendern kann (eigene Creature stirbt an Recoil,
//  wird geopfert, wechselt die Seite), wird VOR JEDER Abfrage neu
//  ermittelt, welche der urspruenglichen Creatures noch stehen.
// ═══════════════════════════════════════════

const CARD_NAME = 'Great Offensive';

/**
 * Alle Creatures, die `pi` gerade kontrolliert UND die einen aktiven
 * Effekt haben — in Brettreihenfolge.
 */
function eigeneAktivKreaturen(engine, pi) {
  const { loadCardEffect } = require('./_loader');
  const out = [];
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support' || inst.faceDown) continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    if (inst.counters?.treatAsEquip) continue;
    const script = loadCardEffect(inst.counters?._effectOverride || inst.name);
    if (typeof script?.onCreatureEffect !== 'function') continue;
    out.push(inst);
  }
  out.sort((a, b) => (a.heroIdx - b.heroIdx) || (a.zoneSlot - b.zoneSlot));
  return out;
}

/** Abzeichen fuer die Galerie: auf welchem Helden, in welcher Zone. */
function platzLabel(engine, pi, inst) {
  const held = engine.gs.players[pi]?.heroes?.[inst.heroIdx]?.name || '';
  const kurz = held.split(',')[0].split(' ').slice(-1)[0] || `Hero ${inst.heroIdx + 1}`;
  return `${kurz} · ${inst.zoneSlot + 1}`;
}

module.exports = {
  // Die CPU waehlt die linkeste offene Creature — dieselbe Reihenfolge,
  // die auch der Rueckfall nimmt. Ohne diesen Eintrag lehnt der
  // generische Responder ab und die Karte fiele nach der ersten
  // Creature aus.
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'cardGallery') return undefined;
    const erste = (promptData.cards || [])[0];
    return erste ? { cardName: erste.name, source: erste.source } : undefined;
  },

  /**
   * Ohne eine eigene Creature mit aktivem Effekt bewirkt die Karte
   * nichts — dann bleibt sie grau. Bewusst genauer als der generische
   * Vertrag `requiresTargetKind: 'ownCreature'`: entscheidend ist nicht
   * die Creature, sondern ob sie etwas zu WIEDERHOLEN hat.
   */
  spellPlayCondition(gs, playerIdx, engine) {
    if (!engine) return true;   // ohne Engine keine Aussage → nicht sperren
    return eigeneAktivKreaturen(engine, playerIdx).length > 0;
  },

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;

      // Liste EINMAL festhalten (siehe Kopfkommentar) — als Kennungen,
      // nicht als Objekte: eine Instanz kann zwischendurch sterben und
      // durch eine gleichnamige ersetzt werden.
      const ids = eigeneAktivKreaturen(engine, pi).map(i => i.id);
      if (ids.length === 0) return;

      engine.log('great_offensive', {
        player: gs.players[pi]?.username, creatures: ids.length,
      });

      let gefeuert = 0;
      const offen = new Set(ids);
      while (offen.size > 0) {
        // Nur die, die JETZT noch stehen und mir noch gehoeren.
        const kandidaten = [...offen]
          .map(id => engine.cardInstances.find(c => c.id === id))
          .filter(i => i && i.zone === 'support' && (i.controller ?? i.owner) === pi)
          .sort((a, b) => (a.heroIdx - b.heroIdx) || (a.zoneSlot - b.zoneSlot));
        // Verschwundene aus der Warteliste nehmen, damit die Schleife
        // endet, auch wenn niemand mehr uebrig ist.
        const nochDa = new Set(kandidaten.map(i => i.id));
        for (const id of [...offen]) if (!nochDa.has(id)) offen.delete(id);
        if (kandidaten.length === 0) break;

        let inst = kandidaten[0];
        if (kandidaten.length > 1) {
          const wahl = await engine.promptGeneric(pi, {
            type: 'cardGallery',
            title: CARD_NAME,
            description: 'Which Creature should attack next?',
            cards: kandidaten.map(i => ({
              name: i.name,
              source: i.id,                       // eindeutig, auch bei Namensgleichheit
              label: platzLabel(engine, pi, i),   // Abzeichen: wo steht sie?
            })),
            cancellable: false,
          });
          const treffer = wahl?.source
            ? kandidaten.find(i => i.id === wahl.source)
            : kandidaten.find(i => i.name === wahl?.cardName);
          inst = treffer || kandidaten[0];   // Rueckfall: linkeste
        }

        offen.delete(inst.id);
        // Signal JE CREATURE statt eines Blobs ueber der ganzen Seite:
        // so sieht man, welche Kreatur gerade dran ist. Bewusst ein
        // VORHANDENER Klang/Bild-Eintrag (`field_standard_rally`,
        // Trompetenstoss, Klang `buff`) — die Karte braucht kein eigenes
        // Bild, und ein neuer Name ohne Komponente waere ein stiller
        // Ausfall.
        engine._broadcastEvent('play_zone_animation', {
          type: 'field_standard_rally', owner: pi,
          heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
        });
        await engine._delay(200);
        const ok = await engine.reactivateCreatureEffect(inst, pi);
        if (ok) {
          gefeuert++;
          await engine._delay(180);
        }
      }

      engine.log('great_offensive_done', {
        player: gs.players[pi]?.username, fired: gefeuert, offered: ids.length,
      });
      engine.sync();
    },
  },

  cpuMeta: {
    // Der Wert haengt am eigenen Brett, nicht an der Hand: je mehr
    // aktive Creatures stehen, desto besser. Ohne den Hinweis haelt die
    // CPU einen „Spell ohne Ziel" fuer wertlos.
    scalesWithOwnActiveCreatures: true,
  },
};
