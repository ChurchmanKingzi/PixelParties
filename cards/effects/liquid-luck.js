// ═══════════════════════════════════════════
//  CARD EFFECT: "Liquid Luck"
//  Potion (Normal) — neu am 23.10. (Als Auftrag)
//
//  "Declare a card name. Whenever your opponent plays a card of that
//   name until the beginning of your next turn, search your deck for
//   any card, reveal it and add it to your hand."
//
//  Das Gegenstück zu Luck (Ability): gleiche Deklaration, gleiches
//  Fenster, gleiche Liste der Ereignisse („plays a card" — siehe
//  `_card-played-shared.js`) — statt zu ziehen sucht der Trank.
//
//  ── LINGERING EFFECT, KEIN PERMANENT ────────────────────────────
//  Liquid Luck ist eine ganz normale Normal Potion (Al 23.10.): sie wird
//  gespielt und danach wie jeder Trank gelöscht (Gelöscht-Stapel des
//  Besitzers, Server-Weg). Der Effekt lingert weiter: wie bei Trial of
//  Knowledge legt `resolve` eine EIGENE Marker-Instanz in die Zone
//  'deleted' an (der Server kennt sie nicht und räumt sie nicht weg);
//  sie ist der Zuhörer für die „plays a card"-Hooks. Auf dem Brett
//  bleibt NICHTS liegen. Damit der Gegner trotzdem weiß, worauf er
//  achten muss, wird das Bild der deklarierten Karte an ihn gestreamt
//  (`card_reveal`) — die Deklaration ist öffentlich.
//
//  ── „UNTIL THE BEGINNING OF YOUR NEXT TURN" ──────────────────────
//  Der `onTurnStart` des DEKLARIERENDEN räumt den Marker weg (Bauform
//  Luck: nicht über einen Zähler, sondern „wessen Zug beginnt"). Bis
//  dahin zählen alle Karten, die der Gegner spielt, auch die, die er in
//  MEINEM Zug als Reaktion spielt.
//
//  ── DIE SUCHE ───────────────────────────────────────────────────
//  Pflicht („search"), nicht abbrechbar — die Wahl ist bezahlt (Muster
//  Crushing Defeat). Aufgedeckt wird die Karte offen, danach wird
//  gemischt. Such-Sperre (Bauform ④ des Such-Templates): der Such-SCHRITT
//  entfällt, die Deklaration selbst bleibt spielbar — sonst könnte man
//  den Trank gegen jede Sperre nie einsetzen, obwohl der Effekt erst
//  später und nur bei einem Treffer sucht. Ist das Deck leer, geschieht
//  nichts.
//
//  ── DER WÄHLER ───────────────────────────────────────────────────
//  Dieselbe Liste wie bei Luck: jeder Kartenname außer Tokens, auch
//  Reactions und Surprises (Al 23.10.). Surprises zählen bei der
//  Aktivierung, nicht beim verdeckten Setzen; wiederbelebte Creatures
//  zählen, wiederbelebte Helden nicht.
// ═══════════════════════════════════════════

const { baseCardName } = require('./_hooks');
const { kartenSpielBeobachter } = require('./_card-played-shared');
const { skipIfSearchBlocked, suchAbfrage } = require('./_search-shared');

const CARD_NAME = 'Liquid Luck';

/** Alle deklarierbaren Kartennamen (wie bei Luck: alles außer Tokens, auch Reactions und Surprises). */
function deklarierbareNamen(engine) {
  const cardDB = engine._getCardDB();
  return Object.keys(cardDB).filter(n => {
    const cd = cardDB[n];
    if (!cd) return false;
    if (cd.cardType === 'Token') return false;
    return true;
  }).sort((a, b) => a.localeCompare(b));
}

/** „Search your deck for any card, reveal it and add it to your hand." */
async function sucheBeliebigeKarte(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps || (ps.mainDeck || []).length === 0) {
    engine.log('liquid_luck_search_skipped', { player: ps?.username, reason: 'empty_deck' });
    return null;
  }
  if (skipIfSearchBlocked(engine, pi, CARD_NAME)) return null;
  const karten = [...new Set(ps.mainDeck)].sort((a, b) => a.localeCompare(b))
    .map(name => ({ name, source: 'deck', count: ps.mainDeck.filter(x => x === name).length }));
  const wahl = await engine.promptGeneric(pi, {
    type: 'cardGallery', cards: karten, ...suchAbfrage('deck'),
    title: CARD_NAME, source: CARD_NAME,
    description: 'Choose any card from your deck to reveal and add to your hand.',
    confirmLabel: '🔎 Search', confirmClass: 'btn-info',
    cancellable: false,
  });
  const name = wahl?.cardName && ps.mainDeck.includes(wahl.cardName) ? wahl.cardName : karten[0]?.name;
  if (!name) return null;
  return engine.searchDeckForNamedCard(pi, name, CARD_NAME);
}

/** Die Deklaration verfällt: nur der Marker geht — der Trank selbst liegt längst im Gelöscht-Stapel seines Besitzers. */
function laufeAb(engine, inst) {
  engine._untrackCard(inst.id);
}

/** Erster lebender Held des Spielers: Anker der Regenbogen-Animation (der Trank selbst hat keinen Platz auf dem Brett). */
function ankerHeld(engine, pi) {
  const heroes = engine.gs.players[pi]?.heroes || [];
  const hi = heroes.findIndex(h => h?.name && h.hp > 0);
  return hi >= 0 ? hi : 0;
}

/** Das Bild der deklarierten Karte geht an den Gegner (`card_reveal`, derselbe Auftritt wie bei einer gespielten Karte) — nur an ihn, der Deklarierende weiß es ja. */
function streameDeklaration(engine, pi, name) {
  engine._broadcastEvent('card_reveal', { cardName: name, sfx: 'ability_activate', playerIdx: pi }, { toPlayers: [engine.opponentOf(pi)] });
}

/** Ein Gegner hat `gespielt` gespielt — passt er zum deklarierten Namen? Dann suchen. */
async function trigger(ctx, gespielt, spieler) {
  const inst = ctx.card;
  if (inst?.zone !== 'deleted') return;
  const ziel = inst.counters?.liquidLuckZiel;
  const pi = inst.counters?.liquidLuckSpieler;
  if (!ziel || pi == null) return;
  if (spieler === pi || spieler == null || spieler < 0) return;     // nur Karten des Gegners
  if (baseCardName(gespielt) !== baseCardName(ziel)) return;
  const engine = ctx._engine;
  engine.log('liquid_luck_trigger', { player: engine.gs.players[pi]?.username, card: ziel });
  // Grundregel (CARD_API): ein passiver Effekt, der per Trigger feuert, wird an BEIDE Spieler gestreamt.
  await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi, source: inst.id + ':' + gespielt + ':' + (engine.gs.turn || 0) });
  engine._broadcastEvent('play_zone_animation', { type: 'liquid_rainbow', owner: pi, heroIdx: ankerHeld(engine, pi), zoneSlot: -1 });
  await sucheBeliebigeKarte(engine, pi);
  engine.sync();
}

module.exports = {
  isPotion: true,
  activeIn: ['deleted'],

  // Wie Luck / Elixir of Immortality: der Nutzen liegt in der Zukunft und ist für die Zugbewertung der CPU unsichtbar.
  // `alwaysCommit` als Funktion: nur spielen, solange das Deck etwas zum Suchen hergibt (sonst verpufft der Trank beim Auslösen).
  cpuMeta: { alwaysCommit: (engine, cpuIdx) => (engine.gs.players[cpuIdx]?.mainDeck || []).length > 0 },

  resolve: async (engine, pi) => {
    const gs = engine.gs;
    const ps = gs.players[pi];
    if (!ps) return { cancelled: true };

    const wahl = await engine.promptGeneric(pi, {
      type: 'cardNamePicker',
      title: CARD_NAME,
      description: 'Declare a card name. If your opponent plays it before your next turn, search your deck for any card!',
      cardNames: deklarierbareNamen(engine),
      cancellable: true,
    });
    const deklariert = wahl && !wahl.cancelled ? wahl.cardName : null;
    if (!deklariert || !engine._getCardDB()[deklariert]) return { cancelled: true };     // Abbruch: nichts ist passiert

    // Lingering Effect: eine Marker-Instanz im Gelöscht-Stapel hört auf die Karten des Gegners (Bauform Trial of Knowledge). Der Trank selbst
    // wird vom Server wie jede Normal Potion gelöscht — ein fremder Trank (Magic Lamp & Co.) wandert dort in den Stapel seines Besitzers.
    const marker = engine._trackCard(CARD_NAME, pi, 'deleted', -1, -1);
    marker.counters.liquidLuckZiel = deklariert;
    marker.counters.liquidLuckSpieler = pi;

    engine.log('liquid_luck_declare', { player: ps.username, card: deklariert });
    streameDeklaration(engine, pi, deklariert);
    engine._broadcastEvent('play_zone_animation', { type: 'liquid_rainbow', owner: pi, heroIdx: ankerHeld(engine, pi), zoneSlot: -1 });
    engine.sync();
    await engine._delay(600);
    return true;
  },

  hooks: {
    ...kartenSpielBeobachter(trigger),

    /** „… until the beginning of YOUR next turn": der Zug des Deklarierenden beendet den Effekt. */
    onTurnStart: async (ctx) => {
      const inst = ctx.card;
      if (inst?.zone !== 'deleted') return;
      const pi = inst.counters?.liquidLuckSpieler;
      if (pi == null || ctx.activePlayer !== pi) return;
      laufeAb(ctx._engine, inst);
    },
  },
};
