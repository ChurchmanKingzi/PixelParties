'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Wise Village Elder"
//  Creature (Normal, Lv0, 50 HP, Summoning Magic)
//
//  „You may once per turn attach an additional Ability from your hand to the corresponding Hero. If that Hero has at least Summoning Magic 1, you may attach an Ability from your deck instead."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────────
//  • „The corresponding Hero" = der Held, in dessen Support Zone der Älteste liegt (auch eine seitenfremde Zone eines übernommenen Helden). Er muss leben und von mir kontrolliert werden
//    (`heroSideOf`); sonst ist die Fähigkeit nicht aktivierbar.
//  • „Additional": das Anlegen verbraucht das Anlegen dieses Helden für den Zug NICHT (`skipAbilityGivenCheck`, wie Training); es gelten die Zonenregeln des Anlegens
//    (`canAttachAbilityToHero` → freie Zone oder gleichnamiger Stapel unter Stufe 3, Support-Zonen-Stapel bei Xal/Xalibur, verwahrte Zonen, `restrictedAttachment`).
//    Das Anlegen PER EFFEKT prallt an Resistance ab (der Einsatz gilt dann als gewirkt, die Karte bleibt, wo sie war).
//  • EIN Picker für alle Quellen (Regel „Mehrere Quellen = ein Picker", CARD_API.md): eine Kartengalerie mit allen anlegbaren Abilities der HAND und — mit Summoning Magic 1
//    (`heroSchoolLevel('Summoning Magic') ≥ 1` des Helden) — des DECKS; jeder Eintrag trägt sein Herkunfts-Label (HAND / DECK, wie bei Barker und Hulijing). Es gibt KEINE Vorfrage
//    „Hand oder Deck?". Gleichnamige Karten aus Hand und Deck sind zwei Einträge („instead": die Wahl entscheidet die Quelle). Die Karte wird an die erste passende Stelle des
//    Helden gelegt (Stapel einer gleichnamigen Ability, sonst die erste freie Zone — wie bei Super Fan und dem Deck-Zweig von Training); keine Kosten, kein Mischen.
//  • Einmal pro Zug je Karte (Engine-HOPT bei nicht-`false`-Rückgabe). Abbrechen vor dem Anlegen verbraucht den Effekt nicht („you MAY").
//
//  ── Bild und Klang ────────────────────────────────────────────────────
//  `play_zone_animation` `elder_teaching` (Pixelart, `ppSalve` auf der Karte des Ältesten): drei Sprechblasen poppen nacheinander über dem Ältesten auf („!", „…", Funkel), wippen und
//  verschwinden gedithert — er bringt dem Helden etwas bei. Klang in ZONE_ANIM_SFX; Log `wise_village_elder`.
//
//  ── CPU ─────────────────────────────────────────────────────────────
//  Die Galerie wird nach `cpuBeste` beantwortet (vorhandene Abilities des Helden stapeln, dann neue, dann gestreute); Deckeinträge gehen vor (kosten keine Handkarte).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Wise Village Elder';
const LEHR_MS = 1500;        // Länge von `elder_teaching` im Client
const LEHR_VOR_MS = 700;     // so lange sprechen die Blasen, bevor die Ability angelegt wird

/** Der Held, dem der Älteste „entspricht": { feld, heroIdx, hero } oder null. */
function entsprechenderHeld(engine, inst) {
  const feld = engine.physicalSide(inst);
  const hero = engine.gs.players[feld]?.heroes?.[inst.heroIdx];
  if (!hero?.name || hero.hp <= 0) return null;
  const pi = inst.controller ?? inst.owner;
  if (engine.heroSideOf(feld, hero) !== pi) return null;
  return { feld, heroIdx: inst.heroIdx, hero, pi };
}

/** Ability-Namen auf der Hand, die der Held jetzt aufnehmen kann. */
function handAbilities(engine, pi, feld, heroIdx) {
  const db = engine._getCardDB();
  const seen = new Set(), out = [];
  for (const n of (engine.gs.players[pi]?.hand || [])) {
    if (seen.has(n)) continue;
    const cd = db[n];
    if (!cd || !hasCardType(cd, 'Ability')) continue;
    if (!engine.canAttachAbilityToHero(feld, n, heroIdx)) continue;
    seen.add(n); out.push(n);
  }
  return out;
}

/** Galerie-Einträge { name, source, count } der anlegbaren Abilities im Deck. */
function deckAbilities(engine, pi, feld, heroIdx) {
  const db = engine._getCardDB();
  const zaehler = {};
  for (const n of (engine.gs.players[pi]?.mainDeck || [])) {
    const cd = db[n];
    if (!cd || !hasCardType(cd, 'Ability')) continue;
    if (!engine.canAttachAbilityToHero(feld, n, heroIdx)) continue;
    zaehler[n] = (zaehler[n] || 0) + 1;
  }
  return Object.entries(zaehler).sort(([a], [b]) => a.localeCompare(b)).map(([name, count]) => ({ name, source: 'deck', count }));
}

/** Darf der Held aus dem Deck anlegen? (Summoning Magic ≥ 1) */
function deckErlaubt(engine, feld, heroIdx) {
  return engine.heroSchoolLevel('Summoning Magic', feld, heroIdx) >= 1;
}

/** CPU: die beste Ability aus `namen` für diesen Helden (stapeln > neu > streuen, alphabetisch). */
function cpuBeste(engine, pi, heroIdx, namen) {
  const ps = engine.gs.players[pi];
  const lebende = (ps?.heroes || []).map((h, i) => ({ h, i })).filter(({ h }) => h?.name && h.hp > 0);
  const hat = (hi, n) => !!engine.abilityStapelOrtVon(pi, hi, n);
  const t1 = [], t2 = [], t3 = [];
  for (const n of namen) {
    if (hat(heroIdx, n)) t1.push(n);
    else if (!lebende.some(({ i }) => hat(i, n))) t2.push(n);
    else t3.push(n);
  }
  const s = (a) => a.slice().sort((x, y) => x.localeCompare(y));
  return s(t1)[0] || s(t2)[0] || s(t3)[0] || null;
}

/** Die Galerie: erst die Hand, dann das Deck (je alphabetisch), jeder Eintrag mit seinem Herkunfts-Label (`source`). Deck nur mit Summoning Magic 1. */
function galerieFuer(engine, pi, feld, heroIdx) {
  const hand = handAbilities(engine, pi, feld, heroIdx).sort((a, b) => a.localeCompare(b)).map(name => ({ name, source: 'hand' }));
  const deck = deckErlaubt(engine, feld, heroIdx) ? deckAbilities(engine, pi, feld, heroIdx) : [];
  return [...hand, ...deck];
}

/** Aus der Hand anlegen. @returns {'ok'|'blocked'|'abbruch'} */
async function ausDerHand(engine, pi, feld, heroIdx, heroName, cardName, ortCtx) {
  await ortCtx.lehren();
  const res = await engine.attachAbilityFromHand(pi, cardName, heroIdx, { skipAbilityGivenCheck: true, source: CARD_NAME, ...(feld !== pi ? { heroOwner: feld } : {}) });
  engine.sync();
  if (res.blocked) return 'blocked';
  if (!res.success) return 'abbruch';
  engine._broadcastEvent('ability_activated', { owner: feld, heroIdx, zoneIdx: res.zoneSlot, zoneKind: res.zoneKind, abilityName: cardName });
  engine.log('wise_village_elder', { player: engine.gs.players[pi].username, card: cardName, hero: heroName, from: 'hand' });
  engine.sync();
  await engine._delay(300);
  return 'ok';
}

/** Aus dem Deck anlegen (wie Training Stufe 3, Option B). @returns {'ok'|'blocked'|'abbruch'} */
async function ausDemDeck(engine, pi, feld, heroIdx, heroName, cardName, ortCtx) {
  const ps = engine.gs.players[pi];
  // Anlegen per Effekt prallt an Resistance ab (die Karte bleibt im Deck, kein Mischen); der Einsatz gilt als gewirkt.
  if (await engine.abilityAnlegenDurchResistanceBlockiert(pi, feld, heroIdx, CARD_NAME)) {
    engine.log('wise_village_elder_blocked', { player: ps.username, ability: cardName, hero: heroName });
    engine.sync();
    return 'blocked';
  }
  await ortCtx.lehren();
  const entnommen = await engine.takeFromPile(ps, 'deck', cardName, { source: 'wise-village-elder' });
  if (!entnommen) return 'abbruch';
  const ort = engine.abilityZielOrt(feld, heroIdx, cardName);
  if (!ort) { ps.mainDeck.push(cardName); return 'abbruch'; }       // kein Platz: die Karte geht zurück (sollte nach `canAttachAbilityToHero` nicht vorkommen)
  const inst = engine.abilityOrtBelegen(feld, heroIdx, cardName, ort);
  if (feld !== pi) inst.originalOwner = pi;                          // Karte aus meinem Deck
  engine._broadcastEvent('deck_search_add', { cardName, playerIdx: pi });
  engine.log('deck_search', { player: ps.username, card: cardName, by: CARD_NAME });
  await engine.abilityOrtHooks(inst, ort, { _skipReactionCheck: true });
  engine._broadcastEvent('ability_activated', { owner: feld, heroIdx, zoneIdx: ort.slot, zoneKind: ort.art, abilityName: cardName });
  engine.log('wise_village_elder', { player: ps.username, card: cardName, hero: heroName, from: 'deck' });
  engine.sync();
  await engine._delay(600);
  return 'ok';
}

module.exports = {
  activeIn: ['support'],
  creatureEffect: true,
  canSummon: () => true,

  /** Aktivierbar, solange der entsprechende Held eine Ability aus der Hand — oder mit Summoning Magic 1 aus dem Deck — aufnehmen kann. */
  canActivateCreatureEffect(ctx) {
    const engine = ctx._engine;
    const h = entsprechenderHeld(engine, ctx.card);
    if (!h) return false;
    if (handAbilities(engine, h.pi, h.feld, h.heroIdx).length > 0) return true;
    return deckErlaubt(engine, h.feld, h.heroIdx) && deckAbilities(engine, h.pi, h.feld, h.heroIdx).length > 0;
  },

  async onCreatureEffect(ctx) {
    const engine = ctx._engine;
    const inst = ctx.card;
    const h = entsprechenderHeld(engine, inst);
    if (!h) return false;
    const { feld, heroIdx, hero, pi } = h;
    const heroName = hero.name;

    // EIN Picker für alle Quellen: Hand und (mit Summoning Magic 1) Deck, jeder Eintrag mit Herkunfts-Label — keine Vorfrage „Hand oder Deck?".
    const galerie = galerieFuer(engine, pi, feld, heroIdx);
    if (galerie.length === 0) return false;
    const deckOk = galerie.some(g => g.source === 'deck');
    const picked = await engine.promptGeneric(pi, {
      type: 'cardGallery', cards: galerie, title: CARD_NAME, ownerIdx: pi, heroIdx,        // ownerIdx/heroIdx: für die CPU-Antwort
      description: `Choose an additional Ability to attach to ${heroName} — from your hand${deckOk ? ' or, with Summoning Magic 1, from your deck instead' : ''}.`,
      confirmLabel: '📚 Attach!',
      cancellable: true,
    });
    if (!picked || picked.cancelled || !picked.cardName) return false;           // „may": Abbruch verbraucht den Effekt nicht
    // Herkunft: die Antwort nennt sie; fehlt sie (Automat), gilt die erste passende Karte (Hand vor Deck).
    const treffer = galerie.find(g => g.name === picked.cardName && (!picked.source || g.source === picked.source));
    if (!treffer) return false;
    const cardName = treffer.name;
    const quelle = treffer.source;

    // Die Sprechblasen laufen, sobald die Wahl feststeht und das Anlegen sicher ist (nach der letzten abbrechbaren Frage).
    let gelehrt = false;
    const ortCtx = {
      lehren: async () => {
        if (gelehrt) return;
        gelehrt = true;
        engine._broadcastEvent('play_zone_animation', {
          type: 'elder_teaching', zoneType: 'board', owner: feld, heroIdx: -1, zoneSlot: -1, duration: LEHR_MS,
          targets: [{ owner: engine.physicalSide(inst), heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot, cardName: CARD_NAME }],
          originOwner: engine.physicalSide(inst), originHeroIdx: inst.heroIdx, originZoneSlot: inst.zoneSlot,
        });
        await engine._delay(LEHR_VOR_MS);
      },
    };

    const ergebnis = quelle === 'deck'
      ? await ausDemDeck(engine, pi, feld, heroIdx, heroName, cardName, ortCtx)
      : await ausDerHand(engine, pi, feld, heroIdx, heroName, cardName, ortCtx);
    return ergebnis !== 'abbruch';      // 'ok' und 'blocked' (von Resistance abgefangen) zählen als gewirkt
  },

  /** CPU: die Galerie nach `cpuBeste`; Deckeinträge zuerst (kosten keine Handkarte), sonst die Hand. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic' || !payload || payload.title !== CARD_NAME || payload.type !== 'cardGallery') return undefined;
    const karten = payload.cards || [];
    for (const quelle of ['deck', 'hand']) {
      const pick = cpuBeste(engine, payload.ownerIdx, payload.heroIdx, karten.filter(c => c.source === quelle).map(c => c.name));
      if (pick) return { cardName: pick, source: quelle };
    }
    return undefined;
  },

  _test: { entsprechenderHeld, handAbilities, deckAbilities, deckErlaubt, galerieFuer, LEHR_MS },
};
