// ═══════════════════════════════════════════
//  SPELL (Reaction): "Troop Annihilation"
//  Level 1 — Cybug-Archetyp, die einzige Nicht-Kreatur darin
//
//  "Play this card immediately when a Surprise Creature you control is
//   defeated. Defeat all other Creatures you control. Then, place up to
//   the same number of Surprise Creatures with different names from
//   your deck face-down into the Surprise Zones of Heroes you control
//   without showing them to your opponent."
//
//  Mechanics
//  ─────────
//   • Auslöser: `isCreatureDefeatedReaction`, das NEUE Fenster
//     `_checkCreatureDefeatedHandReactions`. Es gab keins: für
//     Kreaturen existierte nur das VOR-dem-Tod-Fenster
//     (`isCreaturePreDefeatReaction`, „rette sie noch"). Und der
//     Hook-Weg war versperrt — `onCreatureDeath` steht nicht in
//     `HOOK_DESCRIPTIONS`, und alle Feuerstellen setzen
//     `_skipReactionCheck`.
//   • „Surprise Creature" heißt `cardType` enthält Creature UND
//     `subtype` ist Surprise — im Kartenpool sind das 16 Karten,
//     darunter alle sieben Cybugs.
//   • ZÄHLWEISE: „up to the same number" bezieht sich auf die Zahl der
//     Kreaturen, die DIESER Effekt besiegt hat — nicht auf die
//     Surprise Creature, die den Auslöser gestellt hat (die war schon
//     vorher besiegt) und nicht auf die Zahl der freien Surprise
//     Zonen. Besiegt der Effekt keine Kreatur, wird auch nichts
//     gesetzt.
//   • „all other Creatures you control" — jede Kreatur in einer eigenen
//     Support Zone. Die auslösende liegt zu diesem Zeitpunkt schon
//     nicht mehr auf dem Brett; der Filter über `instId` hält sie
//     zusätzlich heraus, falls eine Route sie noch stehen lässt.
//   • Abgeräumt wird über `actionDestroyCard` — der kanonische Weg mit
//     Todes-Hooks. Wichtig: der Riegel `_inCreatureDefeatedReaction`
//     im Fenster verhindert, dass sich diese Karte über die eigenen
//     Todesfälle rekursiv neu anbietet.
//   • „with different names" — die GESETZTEN untereinander verschieden.
//     Wirksam wird das beim BAUEN der Kandidatenliste: je Name kommt
//     nur ein Eintrag in die Auswahl. Der zusätzliche Riegel im
//     Setz-Lauf (`benutzteNamen`) ist dadurch unbeobachtbar — eine
//     Gegenprobe, die ihn entfernt, bleibt grün (nachgemessen 19.8.).
//     Er bleibt trotzdem stehen: er kostet nichts und deckt einen
//     Picker ab, der dieselbe Id zweimal zurückgäbe.
//     Eine Karte, die schon in einer Surprise Zone liegt, schließt
//     ihren Namen nicht aus; der Text sagt nichts dazu.
//   • Gesetzt wird über die neue Primitive
//     `engine.actionSetSurpriseFromDeck` — verdeckt, ohne
//     `card_reveal`. „Ohne sie dem Gegner zu zeigen" ergibt sich
//     daraus von selbst, weil der Zustandsversand fremde verdeckte
//     Surprises zu `'?'` maskiert.
//   • Nach dem letzten Setzen wird EINMAL gemischt — die Karten sind
//     aus dem Deck gesucht.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Troop Annihilation';
// Takt zwischen zwei Setzvorgaengen (Als Vorgabe 19.8.).
const SETZ_TAKT_MS = 320;
// Standzeit der Explosionen, bevor abgeraeumt wird.
const EXPLOSIONS_MS = 520;

/** Ist das eine Surprise Creature? */
function istSurpriseCreature(cd) {
  if (!cd) return false;
  if (!hasCardType(cd, 'Creature')) return false;
  return (cd.subtype || '').split('/').some(t => t.trim() === 'Surprise');
}

/**
 * Eigene Kreaturen auf dem Brett, ohne die eben gefallene.
 *
 * ★ Der Todes-Hook feuert ZWISCHEN dem Ausspleissen aus der Zone und
 * dem Umsetzen von `inst.zone` — die gerade gestorbene Kreatur traegt
 * also noch `zone === 'support'` und steht noch in `cardInstances`.
 * Drei Filter halten sie heraus (Als Befund 19.8.: „die initial
 * getoetete Creature wird anscheinend auch betroffen"):
 *   1. die Instanz-Id aus dem Todes-Hook,
 *   2. `_deathResolved` — der Riegel, den die Engine auf jede bereits
 *      gestorbene Instanz stempelt,
 *   3. der Slot muss den Namen WIRKLICH noch tragen; bei der
 *      Gestorbenen ist er schon leer.
 * Punkt 3 ist der belastbarste, weil er ohne Sonderwissen auskommt.
 */
function eigeneKreaturen(engine, pi, ausserInstId) {
  const cardDB = engine._getCardDB();
  return engine.cardInstances.filter((c) => {
    if (c.zone !== 'support') return false;
    if ((c.controller ?? c.owner) !== pi) return false;
    if (ausserInstId != null && c.id === ausserInstId) return false;
    if (c._deathResolved) return false;
    const slot = ((engine.gs.players[c.owner]?.supportZones || [])[c.heroIdx] || [])[c.zoneSlot];
    if (!Array.isArray(slot) || !slot.includes(c.name)) return false;
    const cd = cardDB[c.name];
    return !!(cd && hasCardType(cd, 'Creature'));
  });
}

/** Freie Surprise Zonen lebender eigener Helden. */
function freieSurpriseZonen(gs, pi) {
  const ps = gs.players[pi];
  const frei = [];
  for (let hi = 0; hi < (ps?.heroes || []).length; hi++) {
    const hero = ps.heroes[hi];
    if (!hero?.name || hero.hp <= 0) continue;
    if (((ps.surpriseZones?.[hi]) || []).length > 0) continue;
    frei.push(hi);
  }
  return frei;
}

module.exports = {
  isCreatureDefeatedReaction: true,

  // Rein reaktiv — nie aus der Hand heraus proaktiv spielbar.
  canActivate: () => false,

  /**
   * Auslöserbedingung: eine Surprise Creature, die ICH kontrolliere,
   * ist gefallen. Ohne eigene weitere Kreatur auf dem Brett hätte die
   * Karte keinen Effekt, also wird sie dann auch nicht angeboten.
   */
  creatureDefeatedCondition(gs, pi, engine, deathInfo) {
    if (!deathInfo) return false;
    const gefallenSeite = deathInfo.controller ?? deathInfo.owner;
    if (gefallenSeite !== pi) return false;
    const cd = engine._getCardDB()[deathInfo.name];
    if (!istSurpriseCreature(cd)) return false;
    // Es muss etwas zu opfern geben — sonst ist die Karte verschenkt.
    return eigeneKreaturen(engine, pi, deathInfo.instId).length > 0;
  },

  /**
   * Alle anderen eigenen Kreaturen besiegen, dann ebenso viele
   * verschieden benannte Surprise Creatures verdeckt aus dem Deck
   * setzen.
   */
  async creatureDefeatedResolve(engine, pi, deathInfo) {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return;

    // ── 1. Alle anderen eigenen Kreaturen besiegen ──
    const opfer = eigeneKreaturen(engine, pi, deathInfo?.instId);
    // Als Vorgabe 19.8.: Explosionen auf ALLEN Kreaturen, die dieser
    // Effekt abraeumt — erst alle zeigen, dann abraeumen, damit der
    // Schlag als EIN Ereignis lesbar ist.
    if (opfer.length > 0) {
      for (const inst of opfer) {
        engine._broadcastEvent('play_zone_animation', {
          type: 'explosion', owner: inst.owner,
          heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
        });
      }
      await engine._delay(EXPLOSIONS_MS);
    }
    let besiegt = 0;
    for (const inst of opfer) {
      if (inst.zone !== 'support') continue;          // zwischenzeitlich weg
      await engine.actionDestroyCard(
        { name: CARD_NAME, owner: pi, heroIdx: inst.heroIdx },
        inst,
        { sourceOwner: pi, sourceName: CARD_NAME },
      );
      // Nur zählen, was wirklich gefallen ist — Schutzeffekte
      // (Defending the Gate, Cardinal Beast, Monia) können eine
      // Kreatur stehen lassen.
      if (inst.zone !== 'support') besiegt++;
    }
    engine.log('troop_annihilation_wipe', {
      player: ps.username, defeated: besiegt, trigger: deathInfo?.name,
    });
    engine.sync();
    if (besiegt === 0) return;

    // ── 2. Ebenso viele Surprise Creatures verdeckt aus dem Deck ──
    const cardDB = engine._getCardDB();
    const zonen = freieSurpriseZonen(gs, pi);
    const maximal = Math.min(besiegt, zonen.length);
    if (maximal === 0) return;

    // Kandidaten aus dem Deck, je Name nur einmal — „with different
    // names" bezieht sich auf die gesetzten untereinander.
    const kandidaten = [];
    const gesehen = new Set();
    for (const name of (ps.mainDeck || [])) {
      if (gesehen.has(name)) continue;
      gesehen.add(name);
      if (!istSurpriseCreature(cardDB[name])) continue;
      kandidaten.push(name);
    }
    if (kandidaten.length === 0) return;

    // „up to" — der Spieler darf weniger nehmen. Abbrechbar, und die
    // Auswahl läuft über den normalen Ziel-Picker, damit sie im
    // Puzzle-Modus und für die CPU gleich funktioniert.
    const ziele = kandidaten.map((name, i) => ({
      id: `troopannihilation-${i}`,
      type: 'card', cardName: name, owner: pi,
    }));
    const gewaehlt = await engine.promptEffectTarget(pi, ziele, {
      title: CARD_NAME,
      source: CARD_NAME,
      description: `Choose up to ${maximal} Surprise Creature${maximal === 1 ? '' : 's'} `
        + 'with different names to set face-down from your deck.',
      confirmLabel: '🂠 Set!',
      confirmClass: 'btn-info',
      minRequired: 0,
      maxTotal: maximal,
      alwaysConfirmable: true,
      cancellable: true,
    });
    const ids = Array.isArray(gewaehlt) ? gewaehlt.slice(0, maximal) : [];
    if (ids.length === 0) { engine.sync(); return; }

    let gesetzt = 0;
    const benutzteNamen = new Set();
    for (const id of ids) {
      const eintrag = ziele.find(z => z.id === id);
      if (!eintrag) continue;
      if (benutzteNamen.has(eintrag.cardName)) continue;   // Namensregel
      // Zonen neu bestimmen: jede Setzung belegt eine.
      const frei = freieSurpriseZonen(gs, pi);
      if (frei.length === 0) break;
      const inst = await engine.actionSetSurpriseFromDeck(
        pi, eintrag.cardName, frei[0], { sourceName: CARD_NAME },
      );
      if (!inst) continue;
      benutzteNamen.add(eintrag.cardName);
      gesetzt++;
      // Als Vorgabe 19.8.: nacheinander mit kurzem Delay aufs Feld,
      // wie beim Ziehen. Nach dem LETZTEN nicht mehr warten.
      if (gesetzt < ids.length) await engine._delay(SETZ_TAKT_MS);
    }

    // Aus dem Deck gesucht → einmal mischen, nachdem alles gesetzt ist.
    if (gesetzt > 0) engine.shuffleDeck(pi, 'main');
    engine.log('troop_annihilation_set', {
      player: ps.username, count: gesetzt,
    });
    engine.sync();
  },

  /**
   * CPU: möglichst viele setzen. Bewertet wird nicht — jede Surprise
   * Creature im Deck ist besser als eine im Deck.
   */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'effectTarget') return undefined;
    const cfg = payload?.config;
    if (!cfg || (cfg.source || cfg.title) !== CARD_NAME) return undefined;
    const ziele = payload.validTargets || [];
    const max = Number(cfg.maxTotal) || 1;
    return ziele.slice(0, max).map(z => z.id);
  },
};
