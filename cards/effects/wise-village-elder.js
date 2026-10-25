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
//  • Hand: wie bei Training — Fähigkeitskarte aus der Hand auf den Helden (Ziel-Zone wählbar). Deck: Galerie der anlegbaren Abilities, die gewählte Karte wird gesucht und angelegt
//    (kein Mischen, keine Kosten). Summoning Magic 1 = `heroSchoolLevel('Summoning Magic') ≥ 1` des Helden; mit ihr darf der Spieler zwischen Hand und Deck wählen („instead":
//    entweder-oder), ohne sie nur die Hand.
//  • Einmal pro Zug je Karte (Engine-HOPT bei nicht-`false`-Rückgabe). Abbrechen vor dem Anlegen verbraucht den Effekt nicht („you MAY").
//
//  ── Bild und Klang ────────────────────────────────────────────────────
//  `play_zone_animation` `elder_teaching` (Pixelart, `ppSalve` auf der Karte des Ältesten): drei Sprechblasen poppen nacheinander über dem Ältesten auf („!", „…", Funkel), wippen und
//  verschwinden gedithert — er bringt dem Helden etwas bei. Klang in ZONE_ANIM_SFX; Log `wise_village_elder`.
//
//  ── CPU ─────────────────────────────────────────────────────────────
//  Hand-Prompt wie Training (`abilityAttach`: vorhandene Abilities des Helden stapeln, dann neue, dann gestreute); Hand oder Deck: das Deck (kostet keine Handkarte); die Galerie nach demselben Muster.
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { loadCardEffect } = require('./_loader');

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

/** Aus der Hand anlegen (wie Training Stufe 1). @returns {'ok'|'blocked'|'abbruch'} */
async function ausDerHand(engine, pi, feld, heroIdx, heroName, ortCtx) {
  const eligible = handAbilities(engine, pi, feld, heroIdx);
  if (eligible.length === 0) return 'abbruch';
  let cardName, zoneOpts = {};
  if (feld === pi) {
    const result = await engine.promptGeneric(pi, {
      type: 'abilityAttach', ownerIdx: pi, heroIdx, eligibleCards: eligible,
      title: CARD_NAME, description: `Attach an Ability from your hand to ${heroName}.`,
      cancellable: true, canFinish: false,
    });
    if (!result || result.cancelled || result.finished || !result.cardName || !eligible.includes(result.cardName)) return 'abbruch';
    cardName = result.cardName;
    zoneOpts = { targetZoneSlot: result.zoneSlot, targetSupportSlot: result.supportSlot };
    // Karten bleiben gedimmt, bis das Anlegen durch ist (kein kurzes Aufflackern) — wie Training.
    engine.gs.effectPrompt = { type: 'abilityAttach', ownerIdx: pi, eligibleCards: [], heroIdx, title: CARD_NAME, description: '', cancellable: false, canFinish: false };
  } else {
    // Übernommener Held der Gegenspalte: das Zieh-Prompt kennt nur eigene Helden → Handkarte wählen (wie Training bei geliehenen Helden).
    const ps = engine.gs.players[pi];
    const indices = (ps.hand || []).map((n, i) => (eligible.includes(n) ? i : -1)).filter(i => i >= 0);
    const result = await engine.promptGeneric(pi, {
      type: 'handPick', title: CARD_NAME, description: `Attach an Ability from your hand to ${heroName}.`,
      eligibleIndices: indices, minSelect: 1, maxSelect: 1, cancellable: true, confirmLabel: '📚 Attach!', pickIntent: 'use',
    });
    const pick = result && !result.cancelled && Array.isArray(result.selectedCards) ? result.selectedCards[0] : null;
    if (!pick?.cardName || !eligible.includes(pick.cardName)) return 'abbruch';
    cardName = pick.cardName;
    zoneOpts = { heroOwner: feld };
  }
  await ortCtx.lehren();
  const res = await engine.attachAbilityFromHand(pi, cardName, heroIdx, { skipAbilityGivenCheck: true, source: CARD_NAME, ...zoneOpts });
  engine.gs.effectPrompt = null;
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
async function ausDemDeck(engine, pi, feld, heroIdx, heroName, ortCtx) {
  const ps = engine.gs.players[pi];
  const galerie = deckAbilities(engine, pi, feld, heroIdx);
  if (galerie.length === 0) return 'abbruch';
  const picked = await engine.promptGeneric(pi, {
    type: 'cardGallery', cards: galerie, title: CARD_NAME, ownerIdx: pi, heroIdx,        // ownerIdx/heroIdx: für die CPU-Antwort
    description: `Choose an Ability from your deck to attach to ${heroName}.`,
    cancellable: true,
  });
  if (!picked || picked.cancelled || !picked.cardName) return 'abbruch';
  const cardName = picked.cardName;
  if (!galerie.some(g => g.name === cardName)) return 'abbruch';
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

    const hand = handAbilities(engine, pi, feld, heroIdx);
    const deckOk = deckErlaubt(engine, feld, heroIdx) && deckAbilities(engine, pi, feld, heroIdx).length > 0;
    if (hand.length === 0 && !deckOk) return false;

    // Quelle: Hand oder (mit Summoning Magic 1) Deck — „instead".
    let quelle = hand.length > 0 ? 'hand' : 'deck';
    if (hand.length > 0 && deckOk) {
      const opt = await engine.promptGeneric(pi, {
        type: 'optionPicker', title: CARD_NAME, showCard: CARD_NAME,
        description: `${heroName} has Summoning Magic 1 or higher: attach an additional Ability from your hand — or from your deck instead?`,
        options: [
          { id: 'hand', label: 'From my hand' },
          { id: 'deck', label: 'From my deck instead' },
        ],
        cancellable: true,
      });
      if (!opt || opt.cancelled || !opt.optionId) return false;           // „may": Abbruch verbraucht den Effekt nicht
      quelle = opt.optionId === 'deck' ? 'deck' : 'hand';
    }

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
      ? await ausDemDeck(engine, pi, feld, heroIdx, heroName, ortCtx)
      : await ausDerHand(engine, pi, feld, heroIdx, heroName, ortCtx);
    return ergebnis !== 'abbruch';      // 'ok' und 'blocked' (von Resistance abgefangen) zählen als gewirkt
  },

  /** CPU: Hand-Prompt wie Training; Quelle = Deck; Galerie nach demselben Muster. */
  cpuResponse(engine, kind, payload) {
    if (kind !== 'generic' || !payload || payload.title !== CARD_NAME) return undefined;
    if (payload.type === 'abilityAttach') return loadCardEffect('Training').cpuResponse(engine, kind, payload);
    if (payload.type === 'optionPicker') return { optionId: 'deck' };
    if (payload.type === 'cardGallery') {
      const pick = cpuBeste(engine, payload.ownerIdx, payload.heroIdx, (payload.cards || []).map(c => c.name));
      return pick ? { cardName: pick } : undefined;
    }
    return undefined;
  },

  _test: { entsprechenderHeld, handAbilities, deckAbilities, deckErlaubt, LEHR_MS },
};
