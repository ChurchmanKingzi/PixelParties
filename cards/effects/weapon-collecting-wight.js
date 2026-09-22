// ═══════════════════════════════════════════
//  CARD EFFECT: "Weapon Collecting Wight"
//  Creature (Normal, Lv0, 50 HP, Summoning Magic) — PP MBS1, neu in v1268
//
//  "You may once per turn choose an equippable Artifact from your
//   discard pile with a Cost of 15 or less and equip it to one of your
//   Heroes without paying its Cost."
//
//  ── Lesart ──
//  • AKTIVER Kreatureffekt (`creatureEffect` + `onCreatureEffect`),
//    AKTIONSFREI (Als Regel 7.9.: nur, wenn der Text eine Aktion nennt).
//    „once per turn" ohne „You can only" = weich, je Instanz — die
//    Sperre `creature-effect:<instId>` stempelt die Engine, ebenso die
//    Beschwoerungsmuedigkeit (nicht im Zug, in dem sie kam).
//  • „equippable Artifact" = Artefakt mit Subtyp Equipment (wie Riffel).
//    „Cost of 15 or less": gedruckte Kosten, fehlende zaehlen als 0.
//  • „your discard pile" = die Ablage des Kontrolleurs.
//  • Zur Wahl steht nur, was einen legalen Traeger hat (Als Regel 19.8.)
//    — Traegerregeln, Zielwahl und das Anlegen selbst kommen aus
//    `_equip-shared.js`, derselben Stelle wie bei Riffel und Backpack.
//    Damit greift auch die Dauerwirkung der Ausruestung (`onPlay`) und
//    das Surprise-Fenster beim Ausruesten.
//  • Unter Knight of Kings [B] nicht aktivierbar (Ruling 8.9.: reine
//    Stapel-Bewegung → komplett gesperrt), siehe `canActivateCreatureEffect`.
//  • Rueckgabevertrag: jeder Weg ohne Wirkung gibt `false` zurueck, dann
//    stempelt die Engine die Einmal-pro-Zug-Sperre nicht (Abbruch
//    kostet nichts).
// ═══════════════════════════════════════════

const { ausruestTraeger, waehleAusruestPlatz, ruesteAusStapelAus } = require('./_equip-shared');

const CARD_NAME = 'Weapon Collecting Wight';
const MAX_KOSTEN = 15;

/** Ausruestungen in der eigenen Ablage, die in Frage kommen (je Name einmal). */
function kandidaten(engine, pi) {
  const ps = engine.gs.players[pi];
  if (!ps) return [];
  const cardDB = engine._getCardDB();
  const gesehen = new Set();
  const out = [];
  for (const name of (ps.discardPile || [])) {
    if (gesehen.has(name)) continue;
    gesehen.add(name);
    const cd = cardDB[name];
    if (!cd || cd.cardType !== 'Artifact') continue;
    if ((cd.subtype || '') !== 'Equipment') continue;          // „equippable"
    if ((cd.cost || 0) > MAX_KOSTEN) continue;                 // „Cost of 15 or less"
    if (ausruestTraeger(engine, pi, name).length === 0) continue;
    out.push(name);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,

  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    // Als Ruling 8.9. (Knight of Kings [B]): eine Karte, deren einziger
    // Effekt eine Stapel-Bewegung ist, ist unter der Sperre GAR NICHT
    // aktivierbar — nicht aktivierbar-und-verpuffend. Die allgemeine
    // Sperre (`blockedByPileLock`) deckt Kreatur-Effekte nicht ab, und die
    // Loader-Erkennung sieht die Bewegung hier nicht (sie steckt im
    // gemeinsamen Ausruestweg). Deshalb prueft die Karte es selbst.
    if (engine.isPileLockedFor?.(ctx.cardOwner)) return false;
    return kandidaten(engine, ctx.cardOwner).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    if (!ps) return false;

    const wahl = kandidaten(engine, pi);
    if (wahl.length === 0) return false;
    const anzahl = {};
    for (const n of ps.discardPile || []) anzahl[n] = (anzahl[n] || 0) + 1;

    const antwort = await engine.promptGeneric(pi, {
      type: 'cardGallery',
      cards: wahl.map(name => ({ name, source: 'discard', count: anzahl[name] || 1 })),
      title: CARD_NAME,
      description: `Choose an equippable Artifact (Cost ${MAX_KOSTEN} or less) from your discard pile. It is equipped for free.`,
      cancellable: true,
    });
    const name = antwort?.cardName;
    if (!name || antwort.cancelled || !wahl.includes(name)) return false;

    const platz = await waehleAusruestPlatz(engine, pi, name, {
      title: `${CARD_NAME} — Equip ${name}`,
      description: `Select a Hero or a Support Zone to equip ${name} to.`,
      confirmLabel: '⚔️ Equip!',
    });
    if (!platz) return false;

    const inst = await ruesteAusStapelAus(engine, pi, 'discard', name, platz.heroIdx, platz.slot, { source: CARD_NAME });
    if (!inst) return false;

    engine.log('weapon_collecting_wight', {
      player: ps.username, card: name, hero: ps.heroes[platz.heroIdx]?.name, slot: platz.slot,
    });
    engine.sync();
    return true;
  },

  /**
   * CPU: die Engine lehnt abbrechbare Galerien ohne Kartenantwort ab
   * (v828-Befund) — dann waere der Effekt fuer die CPU tot. Sie nimmt
   * die teuerste Ausruestung (Kosten als grobes Mass fuer den Wert).
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'generic' || promptData?.type !== 'cardGallery') return undefined;
    const cardDB = engine._getCardDB();
    const karten = promptData.cards || [];
    if (karten.length === 0) return undefined;
    const beste = [...karten].sort((a, b) =>
      ((cardDB[b.name]?.cost || 0) - (cardDB[a.name]?.cost || 0)) || a.name.localeCompare(b.name))[0];
    return { cardName: beste.name, source: beste.source };
  },
};
