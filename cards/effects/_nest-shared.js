// ═══════════════════════════════════════════
//  SHARED HELPER: EINE KARTE LIEGT AUF EINER ANDEREN
//  („Monster Nest", 5.9.)
//
//  „…place it on top of this card. […] the new Creature replaces this
//   one until the end of the turn. At the end of your turn, remove any
//   Creature placed on top of this one and delete it. This doesn't
//   count as the Creature being defeated."
//
//  ── ABGRENZUNG ZUR VORHANDENEN STAPEL-FAMILIE ──────────────────────
//  Goff/Gon, Clausss/Klaus, Smugbeth, Stellin, Wolflesia, Antonia und
//  Vullary legen einen HELDEN UNTER eine Kreatur
//  (`actionAttachHeroToCreature`). Dort bleibt die Kreatur die Kreatur
//  des Platzes und der Held ist nur ein Counter. Hier ist es
//  umgekehrt: eine KREATUR kommt oben drauf und ERSETZT die untere.
//  Das gab es bisher nicht, deshalb ein eigenes Modul.
//
//  ── DAS MODELL ─────────────────────────────────────────────────────
//  Verdecken heisst NICHT „zwei Namen in einem Platz". Ein
//  Support-Platz ist zwar ein Array, aber alle rund 131 Leser fragen
//  `slot[0]` nach dem Namen und der Client zeichnet ihn — ein zweiter
//  Name dort haette an jeder dieser Stellen mitgedacht werden muessen.
//
//  Stattdessen:
//    • Der Name der verdeckten Karte VERLAESST den Platz. Danach steht
//      dort ausschliesslich die obenliegende Kreatur, und jede
//      bestehende Stelle liest automatisch die richtige Karte.
//    • Die INSTANZ der verdeckten Karte bleibt bestehen und wandert in
//      die Zone `nested` (siehe ZONES in `_hooks.js`). Damit ist sie
//      fuer jede Brettabfrage weg — Als Ruling: nicht zielbar, zaehlt
//      nicht als kontrollierte Kreatur — behaelt aber HP, Counter,
//      Status und ihre Instanz-ID.
//    • `heroIdx` / `zoneSlot` der verdeckten Instanz merken sich den
//      Platz, auf den sie zurueckkehrt.
//
//  ── AUFTAUCHEN ─────────────────────────────────────────────────────
//  Als Ruling: stirbt die obenliegende Kreatur noch in derselben
//  Runde, ist die verdeckte Karte SOFORT wieder normal da. Der
//  Todespfad entfernt den Namen der Kreatur aus dem Platz — danach ist
//  er leer, und `reconcile()` legt die verdeckte Karte zurueck.
//  Aufgerufen wird das aus dem Todes-Hook UND aus
//  `afterCreatureDamageBatch` (dieselbe Lehre wie beim
//  Paraseed-Kadaver: nicht jeder Weg vom Brett feuert dieselben Hooks,
//  ein Zustands-Abgleich faengt den Rest).
//
//  Dasselbe greift, wenn die obenliegende Kreatur WEGGEHT statt zu
//  sterben (Bounce, Umzug, dauerhafter Kontrollwechsel): der Platz
//  wird frei, die verdeckte Karte taucht auf — und sie wird am
//  Zugende folgerichtig NICHT geloescht, denn sie liegt dann nicht
//  mehr „on top of this one".
//
//  ── WAS BEIM VERDECKEN AUSDRUECKLICH NICHT FEUERT ──────────────────
//  Weder `onCardLeaveZone` beim Verdecken noch `onCardEnterZone` beim
//  Auftauchen. Der Kartentext beschreibt eine ERSETZUNG, keine
//  Entfernung mit spaeterer Rueckkehr: die verdeckte Karte wird nicht
//  neu beschworen, und ein Eintritts-Fenster (v699) wuerde beim
//  Auftauchen Beobachter auf eine Karte hetzen, die die ganze Zeit da
//  war. `turnPlayed` und damit die Beschwoerungskrankheit wandern
//  unveraendert mit — es ist dieselbe Instanz.
// ═══════════════════════════════════════════

const { ZONES } = require('./_hooks');

/** Der Platz eines Spielers als Array (nie undefined). */
function slotOf(engine, pi, heroIdx, zoneSlot) {
  const ps = engine.gs.players[pi];
  if (!ps) return null;
  if (!ps.supportZones[heroIdx]) ps.supportZones[heroIdx] = [[], [], []];
  if (!ps.supportZones[heroIdx][zoneSlot]) ps.supportZones[heroIdx][zoneSlot] = [];
  return ps.supportZones[heroIdx][zoneSlot];
}

/** Die verdeckte Instanz unter einem Platz, falls es eine gibt. */
function nestedUnder(engine, pi, heroIdx, zoneSlot) {
  return engine.cardInstances.find(c =>
    c.zone === ZONES.NESTED
    && (c.controller ?? c.owner) === pi
    && c.heroIdx === heroIdx
    && c.zoneSlot === zoneSlot,
  ) || null;
}

/**
 * Die Kreatur, die gerade auf `nestInst` liegt — oder null.
 *
 * Erkannt wird sie ueber die Instanz-ID, nicht ueber den Platz allein:
 * liegt dort inzwischen etwas ANDERES (weil die urspruengliche Kreatur
 * weggewandert ist und ein neuer Zug den Platz gefuellt hat), ist das
 * ausdruecklich KEINE Karte „placed on top of this one".
 */
function coveringInstance(engine, nestInst) {
  const id = nestInst?.counters?._nestCoverId;
  if (!id) return null;
  const inst = engine.cardInstances.find(c => c.id === id);
  if (!inst || inst.zone !== ZONES.SUPPORT) return null;
  if (inst.heroIdx !== nestInst.heroIdx || inst.zoneSlot !== nestInst.zoneSlot) return null;
  if ((inst.controller ?? inst.owner) !== (nestInst.controller ?? nestInst.owner)) return null;
  return inst;
}

/**
 * Karte verdecken: `nestInst` verschwindet LOGISCH vom Brett (Zone
 * `nested`), ihr NAME bleibt aber im Platz stehen.
 *
 * ★ Das ist der Kern der Sache (Als Vorgabe 5.9.): „aus Perspektive des
 * Spielers verlaesst Monster Nest die Zone nie und die andere Creature
 * kommt nur darueber." Wuerde der Name den Platz verlassen und spaeter
 * zurueckkehren, gaebe es zwangslaeufig einen Zustand dazwischen, in dem
 * er fehlt — und genau den bekommt der Spieler irgendwann zu sehen, egal
 * wie eng man die Reihenfolge zieht. Er bleibt deshalb einfach liegen.
 *
 * Die darueberkommende Karte wird per `coverNested` VORNE eingefuegt
 * (`safePlaceInSupport`), `slot[0]` bleibt also die Karte, die den Platz
 * definiert.
 *
 * Ruft ABSICHTLICH keine Zonen-Hooks (siehe Kopfkommentar).
 */
function sink(engine, nestInst) {
  if (!nestInst || nestInst.zone !== ZONES.SUPPORT) return -1;
  nestInst.zone = ZONES.NESTED;
  return nestInst.zoneSlot;
}

/**
 * Verdeckte Karte zurueck aufs Brett.
 *
 * SYNCHRON, mit Absicht: der Aufruf steht in `_removeCardFromState`
 * und im Schadens-Todespfad — beides Stellen ohne `await`. Die Funktion
 * kommt ohne aus.
 *
 * Normalfall ist der gemerkte Platz. Ist der wider Erwarten belegt,
 * wird ein freier Platz DESSELBEN Helden genommen; gibt es auch den
 * nicht, geht die Karte in den Ablagestapel ihres Besitzers, damit
 * keine Instanz in der Zwischenzone haengenbleibt.
 *
 * KEINE Aufdeck-Animation: die Karte wird im Platz selbst wieder
 * sichtbar, und zwar unter der Karte, die gerade wegfliegt (siehe
 * `surfaceOnDeparture`). Ein zusaetzliches `card_reveal` mitten im
 * Todesablauf waere nur Laerm.
 */
function surface(engine, nestInst, opts = {}) {
  if (!nestInst || nestInst.zone !== ZONES.NESTED) return false;
  const pi = nestInst.controller ?? nestInst.owner;
  const ps = engine.gs.players[pi];
  if (!ps) return false;
  const hi = nestInst.heroIdx;
  if (!ps.supportZones[hi]) ps.supportZones[hi] = [[], [], []];
  const zonen = ps.supportZones[hi];

  delete nestInst.counters._nestCoverId;

  // ── NORMALFALL ───────────────────────────────────────────────────
  // Der Name lag die ganze Zeit im Platz (siehe `sink`). Es ist also
  // nichts einzusetzen — nur die Zone zurueckzudrehen. Damit kann es
  // schlicht keinen Zustand geben, in dem der Platz leer ist.
  if ((zonen[nestInst.zoneSlot] || []).includes(nestInst.name)) {
    nestInst.zone = ZONES.SUPPORT;
    engine.log('nest_surfaced', {
      card: nestInst.name, player: ps.username, by: opts.by || null,
    });
    if (!opts.skipSync) engine.sync();
    return true;
  }

  // ── AUSNAHMEFALL ─────────────────────────────────────────────────
  // Der Name ist doch aus dem Platz verschwunden (ein fremder Effekt
  // hat die Zone geleert oder die Karte umgehaengt). Dann greift die
  // alte Wiedereinsetz-Logik: gemerkter Platz, sonst ein freier Platz
  // desselben Helden, sonst Ablage — damit keine Instanz in der
  // Zwischenzone haengenbleibt.
  const belegt = (z) => ((zonen[z] || []).length > 0);
  let ziel = -1;
  if (!belegt(nestInst.zoneSlot)) {
    ziel = nestInst.zoneSlot;
  } else {
    for (let z = 0; z < zonen.length; z++) { if (!belegt(z)) { ziel = z; break; } }
  }

  if (ziel < 0) {
    engine.cardInstances = engine.cardInstances.filter(c => c.id !== nestInst.id);
    const zielPs = engine.gs.players[nestInst.originalOwner ?? nestInst.owner];
    if (zielPs) {
      if (!zielPs.discardPile) zielPs.discardPile = [];
      zielPs.discardPile.push(nestInst.name);
    }
    engine.log('nest_surface_failed', {
      card: nestInst.name, player: ps.username, hero: hi,
    });
    engine.sync();
    return false;
  }

  zonen[ziel] = [nestInst.name];
  nestInst.zone = ZONES.SUPPORT;
  nestInst.zoneSlot = ziel;

  engine.log('nest_surfaced', {
    card: nestInst.name, player: ps.username, by: opts.by || null,
  });
  if (!opts.skipSync) engine.sync();
  return true;
}

/**
 * ★ DER ZEITPUNKT (Als Befund 5.9.: „die Support Zone wird kurz leer").
 *
 * Aufzurufen GENAU dann, wenn eine Karte aus einem Support-Platz
 * herausgeloest wurde, aber BEVOR ihr Flug zum Stapel gesendet wird.
 * Liegt unter ihr eine verdeckte Karte, ist die dann schon im Platz —
 * der Client zeichnet sie unter der davonfliegenden Karte, statt fuer
 * die Dauer des Fluges ein leeres Feld zu zeigen.
 *
 * Zugeordnet wird ueber die Instanz-ID (`_nestCoverId`), nicht ueber
 * den Platz: nur die Karte, die WIRKLICH auf dem Nest lag, deckt es
 * beim Weggehen wieder auf.
 *
 * Idempotent und billig — laeuft in `_removeCardFromState` bei JEDER
 * Kartenbewegung mit und steigt ohne Verdeckung sofort wieder aus.
 */
function surfaceOnDeparture(engine, departingInst) {
  if (!departingInst?.id) return false;
  const nestInst = engine.cardInstances.find(c =>
    c.zone === ZONES.NESTED && c.counters?._nestCoverId === departingInst.id);
  if (!nestInst) return false;
  return surface(engine, nestInst, { by: 'departure' });
}

/**
 * „Liegt noch etwas oben?" — der Zustands-Abgleich.
 *
 * Ist die verdeckende Kreatur verschwunden (gestorben, gebounct,
 * umgezogen, uebernommen), taucht die verdeckte Karte sofort wieder
 * auf. Idempotent, darf beliebig oft laufen.
 */
async function reconcile(engine, nestInst) {
  if (!nestInst || nestInst.zone !== ZONES.NESTED) return false;
  if (coveringInstance(engine, nestInst)) return false;
  return surface(engine, nestInst, { by: 'cover_gone' });
}

/**
 * Eine Karte vom BRETT loeschen, OHNE dass sie als besiegt gilt.
 *
 * Kein Todespfad: keine `onCreatureDeath`-Listener, kein
 * Kadaver-Anspruch, keine on-kill-Effekte. Was laeuft, ist genau das,
 * was auch beim Verlassen einer Zone ohne Tod laeuft —
 * `onCardLeaveZone` fuer die Karte selbst — plus das universelle
 * „would be deleted"-Rettungsfenster `_tryBeforeDelete` (Cute Hydra),
 * das laut Engine-Vertrag JEDE neue Loeschstelle fragen muss.
 *
 * Bauform uebernommen von `artefaktInDieAblage` in `_crusader-shared`,
 * nur mit `deletedPile` als Ziel.
 */
async function deleteWithoutDefeat(engine, inst, opts = {}) {
  if (!inst || inst.zone !== ZONES.SUPPORT) return false;
  const gs = engine.gs;
  const pi = inst.controller ?? inst.owner;
  const heroIdx = inst.heroIdx;
  const zoneSlot = inst.zoneSlot;
  const name = inst.name;

  const slot = slotOf(engine, pi, heroIdx, zoneSlot);
  const idx = slot ? slot.indexOf(name) : -1;
  if (idx >= 0) slot.splice(idx, 1);

  // ★ VOR dem Flug (Als Befund 5.9.): liegt unter dieser Karte etwas
  // verdeckt, ist es JETZT schon wieder im Platz. Der Client zeichnet
  // es dann unter der davonfliegenden Karte, statt fuer die Dauer des
  // Fluges ein leeres Feld zu zeigen.
  surfaceOnDeparture(engine, inst);

  engine._broadcastEvent('play_pile_transfer', {
    owner: inst.originalOwner ?? inst.owner,
    fromOwner: pi, toOwner: inst.originalOwner ?? inst.owner,
    cardName: name, from: 'support', to: 'deleted',
    fromHeroIdx: heroIdx, fromSlotIdx: zoneSlot,
  });

  await engine.runHooks('onCardLeaveZone', {
    _onlyCard: inst, card: inst, leavingCard: inst,
    fromZone: 'support', fromOwner: pi,
    fromHeroIdx: heroIdx, fromZoneSlot: zoneSlot,
    toZone: 'deleted',
    _skipReactionCheck: true,
  });

  engine.cardInstances = engine.cardInstances.filter(c => c.id !== inst.id);

  // Rettungsfenster ZWISCHEN Quellentfernung und Stapel — so schreibt
  // es `_tryBeforeDelete` vor.
  const gerettet = await engine._tryBeforeDelete(name, inst.originalOwner ?? inst.owner, {
    fromZone: 'support', fromInstance: inst, source: opts.source || null,
  });
  if (!gerettet) {
    const zielPs = gs.players[inst.originalOwner ?? inst.owner];
    if (zielPs) {
      if (!zielPs.deletedPile) zielPs.deletedPile = [];
      zielPs.deletedPile.push(name);
    }
  }

  // KEIN eigener Log-Eintrag: der Aufrufer kennt den Anlass und loggt
  // ihn mit einem Typ, fuer den es einen Renderer gibt. Ein generisches
  // `card_deleted` von hier waere genau die Sorte Eintrag, die im
  // Log-Panel unsichtbar bleibt (Lehre aus v721).
  engine.sync();
  await engine._delay(opts.delay != null ? opts.delay : 300);
  return true;
}

module.exports = {
  slotOf,
  nestedUnder,
  coveringInstance,
  sink,
  surface,
  surfaceOnDeparture,
  reconcile,
  deleteWithoutDefeat,
};
