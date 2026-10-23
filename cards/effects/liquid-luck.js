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
//  ── WO LEBT DER EFFEKT? ──────────────────────────────────────────
//  Ein Trank hat kein Brett, aber ein Dauereffekt braucht einen Zuhörer
//  für die Hooks. Wie „Elixir of Immortality" legt sich der Trank deshalb
//  OFFEN vor den Spieler (`ps.permanents` + Instanz in der Zone
//  'permanent', `resolve` meldet `{ placed: true }` — der Server löscht
//  ihn dann NICHT). Der Eintrag trägt den deklarierten Namen (`declared`),
//  damit der Client ihn zeigen kann: die Deklaration ist öffentlich.
//
//  ── „UNTIL THE BEGINNING OF YOUR NEXT TURN" ──────────────────────
//  Der `onTurnStart` des DEKLARIERENDEN löscht den Trank (Bauform Luck:
//  nicht über einen Zähler, sondern „wessen Zug beginnt"). Bis dahin
//  zählen alle Karten, die der Gegner spielt, auch die, die er in MEINEM
//  Zug als Reaktion spielt — und der Trank ist selbst nach dem Ablauf
//  verbraucht: er landet im Gelöscht-Stapel (wie jeder andere Trank).
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
const { getResolvingHandIndex } = require('./_hand-resolve');

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

/** Der Permanent-Eintrag dieser Instanz (oder undefined). */
function eintragVon(engine, pi, inst) {
  const permId = inst?.counters?.permId;
  return (engine.gs.players[pi]?.permanents || []).find(p => p.id === permId);
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

/** Der Trank verfällt: Permanent und Instanz weg, die Karte in den Gelöscht-Stapel. */
async function laufeAb(engine, pi, inst) {
  const ps = engine.gs.players[pi];
  const permId = inst.counters?.permId;
  const idx = (ps.permanents || []).findIndex(p => p.id === permId);
  engine._broadcastEvent('play_pile_transfer', {
    owner: pi, cardName: CARD_NAME, from: 'permanent', to: 'deleted', fromPermId: inst.id,
  });
  if (idx >= 0) ps.permanents.splice(idx, 1);
  (inst.counters?.liquidLuckBesitzer != null ? engine.gs.players[inst.counters.liquidLuckBesitzer] : ps).deletedPile.push(CARD_NAME);
  engine._untrackCard(inst.id);
  engine.log('permanent_removed', { card: CARD_NAME, player: ps.username });
  engine.sync();
}

/** Ein Gegner hat `gespielt` gespielt — passt er zum deklarierten Namen? Dann suchen. */
async function trigger(ctx, gespielt, spieler) {
  const inst = ctx.card;
  if (inst?.zone !== 'permanent') return;
  const ziel = inst.counters?.liquidLuckZiel;
  const pi = inst.counters?.liquidLuckSpieler;
  if (!ziel || pi == null) return;
  if (spieler === pi || spieler == null || spieler < 0) return;     // nur Karten des Gegners
  if (baseCardName(gespielt) !== baseCardName(ziel)) return;
  const engine = ctx._engine;
  engine.log('liquid_luck_trigger', { player: engine.gs.players[pi]?.username, card: ziel });
  engine._broadcastEvent('play_permanent_animation', { owner: pi, permId: inst.counters.permId, type: 'liquid_rainbow' });
  await sucheBeliebigeKarte(engine, pi);
  engine.sync();
}

module.exports = {
  isPotion: true,
  activeIn: ['permanent'],

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

    // Offen vor den Spieler legen (Bauform Elixir of Immortality).
    if (!ps.permanents) ps.permanents = [];
    const permId = 'perm-' + Date.now() + '-' + Math.random();
    ps.permanents.push({ name: CARD_NAME, id: permId, declared: deklariert });
    const inst = engine._trackCard(CARD_NAME, pi, 'permanent', -1, -1);
    inst.counters.permId = permId;
    inst.counters.liquidLuckZiel = deklariert;
    inst.counters.liquidLuckSpieler = pi;
    // Ein fremder Trank (Magic Lamp & Co.) gehört seinem Besitzer: beim Ablauf wandert er in DESSEN Gelöscht-Stapel.
    const handIdx = getResolvingHandIndex(ps);
    const herkunft = handIdx >= 0 ? engine._handOriginAt(ps, handIdx) : null;
    if (Number.isInteger(herkunft) && herkunft !== pi) inst.counters.liquidLuckBesitzer = herkunft;

    engine.log('liquid_luck_declare', { player: ps.username, card: deklariert });
    engine.log('permanent_placed', { card: CARD_NAME, player: ps.username });
    engine.sync();
    await engine._delay(60);
    engine._broadcastEvent('play_permanent_animation', { owner: pi, permId, type: 'liquid_rainbow' });
    await engine._delay(240);
    return { placed: true };
  },

  hooks: {
    ...kartenSpielBeobachter(trigger),

    /** „… until the beginning of YOUR next turn": der Zug des Deklarierenden beendet den Effekt. */
    onTurnStart: async (ctx) => {
      const inst = ctx.card;
      if (inst?.zone !== 'permanent') return;
      const pi = inst.counters?.liquidLuckSpieler;
      if (pi == null || ctx.activePlayer !== pi) return;
      await laufeAb(ctx._engine, pi, inst);
    },
  },
};
