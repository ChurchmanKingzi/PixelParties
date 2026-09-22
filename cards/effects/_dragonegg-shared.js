// ═══════════════════════════════════════════
//  GETEILT: die „Dragonegg"-Familie
//
//  Icy Dragonegg und Flaming Dragonegg (v1267) haben denselben
//  Wortlaut bis auf den Status:
//
//    „If you control no Creatures, summoning this counts as an
//     additional Action. When this Creature is defeated during your
//     turn, you may choose any target on the board and <Status> it."
//
//  Diese Datei ist die EINZIGE Auslegungsstelle beider Saetze. Ein
//  weiteres Ei ist ein Eintrag in `EI_STATUS` plus eine Kartendatei
//  mit drei Zeilen Inhalt.
//
//  ── Satz 1: die Zusatzaktion ──
//  Vertrag `inherentAction(gs, pi, heroIdx, engine)` (Bauart Aggressive
//  Town Guard). „If you control no Creatures" heisst: keine einzige
//  Kreatur unter eigener Kontrolle, egal bei welchem Helden. Das Ei
//  liegt beim Pruefen noch nicht auf dem Brett und zaehlt nicht mit.
//  Gezaehlt ueber `controller ?? owner` — eine gecharmte eigene Kreatur
//  zaehlt nicht mehr, eine uebernommene gegnerische schon.
//
//  ── Satz 2: der Todeseffekt ──
//  ★ ALS RULING (22.9., bindend): NUR ein Tod in der EIGENEN Runde
//  loest aus — etwa per Sacrifice. Toetet der Gegner das Ei in seiner
//  Runde, geschieht nichts. „Your" ist der KONTROLLEUR zum Todes-
//  zeitpunkt (`deathInfo.controller`, seit v1267 in beiden Todespfaden
//  gesetzt); massgeblich ist die Runde, nicht wer den Tod verursacht:
//  stirbt das Ei in der eigenen Runde durch eine gegnerische Reaktion,
//  loest es trotzdem aus.
//
//  „you may" → abbrechbare Zielwahl. „any target on the board" = jedes
//  Ziel, Freund wie Feind, Held wie Kreatur (Als Ruling 4.8.).
//  Angeboten werden nur Ziele, an denen der Status haften KANN (schon
//  gefroren/verbrannt faellt weg, Freeze zusaetzlich nicht auf immune
//  Helden — Burn ignoriert Immune, Vorbild Fiery Slime).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');

/**
 * Je Status: Wortlaut, Pruefung und Anwendung. `turns` nur, wo der
 * Kartentext eine Dauer nennt („Freeze it for 1 turn" = kurze Dauer,
 * `duration: 1`; Icy Slimes 3 stehen fuer „until the end of your next
 * turn" und sind hier nicht gemeint).
 */
const EI_STATUS = {
  frozen: {
    turns: 1,
    anim: 'ice_encase',
    beschreibung: 'Select a target to Freeze for 1 turn.',
    knopf: '❄️ Freeze!',
    knopfKlasse: 'btn-info',
    logTyp: 'freeze',
    heldOk: (hero) => !hero.statuses?.frozen && !hero.statuses?.immune,
    kreaturOk: (inst) => !inst.counters?.frozen,
  },
  burned: {
    turns: null,
    anim: 'flame_strike',
    beschreibung: 'Select a target to Burn.',
    knopf: '🔥 Burn!',
    knopfKlasse: 'btn-danger',
    logTyp: 'burn',
    heldOk: (hero) => !hero.statuses?.burned,       // Burn ignoriert Immune
    kreaturOk: (inst) => !inst.counters?.burned,
  },
};

/** Kontrolliert dieser Spieler ueberhaupt eine Kreatur? */
function controlsAnyCreature(engine, pi) {
  if (!engine?.cardInstances) return false;
  const cardDB = engine._getCardDB();
  for (const inst of engine.cardInstances) {
    if (inst.zone !== 'support') continue;
    if ((inst.controller ?? inst.owner) !== pi) continue;
    const cd = engine.getEffectiveCardData(inst) || cardDB[inst.name];
    if (cd && hasCardType(cd, 'Creature')) return true;
  }
  return false;
}

/**
 * Satz 1 als Vertrag. Ohne `engine` laesst sich das Brett nicht lesen —
 * dann lieber KEINE Zusatzaktion versprechen, als eine zu behaupten, die
 * der Server hinterher nicht gewaehrt.
 */
function eiInherentAction(gs, pi, heroIdx, engine) {
  if (!engine) return false;
  return !controlsAnyCreature(engine, pi);
}

/** Wer kontrollierte das Ei beim Tod? */
function kontrolleurBeimTod(death, card) {
  return death?.controller ?? card?.controller ?? card?.owner ?? death?.owner;
}

/** Ruling 22.9.: nur ein Tod in der Runde des Kontrolleurs zaehlt. */
function starbInEigenerRunde(engine, death, card) {
  return engine.gs.activePlayer === kontrolleurBeimTod(death, card);
}

/**
 * Satz 2 — der `onCreatureDeath`-Hook eines Eis. `art` ist ein Schluessel
 * von `EI_STATUS`.
 */
async function eiTodesEffekt(ctx, cardName, art) {
  const death = ctx.creature;
  if (!death || death.instId !== ctx.card.id) return;      // nur der eigene Tod
  const engine = ctx._engine;
  if (!starbInEigenerRunde(engine, death, ctx.card)) return;
  const st = EI_STATUS[art];
  if (!st) return;
  const pi = kontrolleurBeimTod(death, ctx.card);

  const selected = await ctx.promptMultiTarget({
    types: ['hero', 'creature'],
    side: 'any',
    max: 1,
    title: cardName,
    // Sagt dem CPU-Ziel-Gate, welchen Status diese Abfrage anwendet
    // (Als Auftrag 9.8.) — sonst verbrennt/friert die CPU Ziele, die
    // Johanna schuetzt.
    appliesStatus: art,
    description: st.beschreibung,
    confirmLabel: st.knopf,
    confirmClass: st.knopfKlasse,
    cancellable: true,                                     // „you may"
    condition: (t, eng) => {
      if (t.type === 'hero') {
        const hero = eng.gs.players[t.owner]?.heroes?.[t.heroIdx];
        return !!hero && st.heldOk(hero);
      }
      if (t.cardInstance) return st.kreaturOk(t.cardInstance);
      return true;
    },
  });
  if (!selected || selected.length === 0) return;
  const target = selected[0];

  if (target.type === 'hero') {
    await engine.addHeroStatus(target.owner, target.heroIdx, art, {
      ...(st.turns ? { duration: st.turns } : {}),
      appliedBy: pi,
      animationType: st.anim,
    });
  } else {
    const inst = target.cardInstance || engine.cardInstances.find(c =>
      c.owner === target.owner && c.zone === 'support'
      && c.heroIdx === target.heroIdx && c.zoneSlot === target.slotIdx);
    if (inst) {
      // Animation laeuft unabhaengig davon, ob der Status haftet — sonst
      // sieht der Spieler bei einem immunen Ziel gar nichts.
      engine._broadcastEvent('play_zone_animation', {
        type: st.anim, owner: inst.owner,
        heroIdx: inst.heroIdx, zoneSlot: inst.zoneSlot,
      });
      await engine.applyCreatureStatus(inst, art, {
        sourceOwner: pi,
        source: cardName,
        ...(st.turns ? { frozenDuration: st.turns } : {}),
      });
    }
  }

  engine.log(st.logTyp, { target: target.cardName || target.type, by: cardName, type: target.type });
  engine.sync();
}

/**
 * Die CPU faehrt abbrechbare Confirms per Default ablehnend; ohne diesen
 * Abgriff verpufft der Todeseffekt bei ihr still (Muster Cute Bird).
 */
function eiCpuResponse(engine, kind, promptData) {
  if (kind !== 'generic') return undefined;
  if (promptData?.type === 'confirm') return { confirmed: true };
  return undefined;
}

module.exports = {
  EI_STATUS,
  controlsAnyCreature,
  eiInherentAction,
  starbInEigenerRunde,
  eiTodesEffekt,
  eiCpuResponse,
};
