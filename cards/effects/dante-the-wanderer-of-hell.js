// ═══════════════════════════════════════════
//  CARD EFFECT: "Dante, the Wanderer of Hell"
//  Hero — 400 HP, 80 ATK (Destruction Magic + Luck) — Archetyp Hell Circles
//
//  „You may once per turn delete a level 3 or lower Spell from your hand, and if you do, draw cards
//   equal to its level, then delete the same number of cards -1 from your hand afterwards, OR delete
//   any Areas you currently control and then bring one of your deleted level 3 or lower Areas
//   directly into play."
//
//  ── AUSLEGUNG ─────────────────────────────────────────────────────
//  • Aktiver Held-Effekt, einmal pro Zug (Held-Effekt-Sperre der Engine); zwei Wege, einer pro Aktivierung.
//    Mit loeschbarem Spell in der Hand geht es DIREKT in den Handwahl-Modus (`forceDiscardCancellable`, gueltige
//    Spells leuchten, Escape = Abbruch ohne Verbrauch); gibt es auch Areas, bietet derselbe Modus einen Knopf
//    „Delete Areas instead". Ohne loeschbaren Spell nur Weg 2 (mit kurzer Bestaetigung, abbrechbar).
//  • Weg 1: Spell (Kartentyp Spell, KEINE Attack) mit WIRKSAMEM Level ≤ 3 aus der eigenen Hand waehlen und
//    LOESCHEN (Loesch-Rettung moeglich; wird er gerettet, ist „if you do" nicht erfuellt). Dann so viele Karten
//    ziehen wie sein Level, danach (Level − 1) Karten aus der Hand loeschen (frei waehlbar; bei Level 0/1
//    entfaellt das Loeschen). Das Loeschen ist ein Selbst-Abwurf (kein Gegner-Effekt).
//  • Weg 2: alle eigenen Areas loeschen (Schutzfenster wie bei jedem fremden Loeschen), danach eine eigene
//    GELOESCHTE Area (Level ≤ 3, dieselbe Regel wie bei den Area-Tutoren, `isTutorableArea`) waehlen — auch eine
//    gerade eben geloeschte — und DIREKT ins Spiel bringen: ihr `onPlay` laeuft, aber sie wird nicht gewirkt (kein
//    Wirker, keine Kosten, keine Zusatzaktion) und zaehlt nicht als „played a deleted Area" der Circles. Gibt es
//    keine, bleibt es beim Loeschen. Die Karte kommt aus dem Geloescht-Stapel (still, ohne neue Meldung).
// ═══════════════════════════════════════════

const { hasCardType } = require('./_hooks');
const { isTutorableArea } = require('./_area-shared');
const { ausGeloeschtEntnehmen } = require('./_hell-circles-shared');

const CARD_NAME = 'Dante, the Wanderer of Hell';
const MAX_LEVEL = 3;

function spellsInHand(engine, pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  const out = [];
  const gesehen = new Set();
  for (const name of (ps?.hand || [])) {
    if (gesehen.has(name)) continue;
    gesehen.add(name);
    const cd = db[name];
    if (!cd || !hasCardType(cd, 'Spell') || hasCardType(cd, 'Attack')) continue;
    const level = engine.effectiveCardLevel(cd, pi, { pileSide: 'hand' });
    if (level == null || level > MAX_LEVEL) continue;
    out.push({ name, level });
  }
  return out;
}

function geloeschteAreas(engine, pi) {
  const ps = engine.gs.players[pi];
  const db = engine._getCardDB();
  return [...new Set((ps?.deletedPile || []).filter(n => isTutorableArea(db[n], engine, pi)))];
}

/** Eine Handkarte gezielt loeschen (Loesch-Rettung, Flug). true = wirklich geloescht. */
async function handkarteLoeschen(engine, pi, name) {
  const ps = engine.gs.players[pi];
  const idx = ps.hand.indexOf(name);
  if (idx < 0) return false;
  const inst = engine.findCards({ owner: pi, zone: 'hand', name })[0] || null;
  engine.takeFromPileSync(pi, 'hand', idx, { source: CARD_NAME });   // Stapel-Schicht (kein direktes Splicen)
  const gerettet = await engine._tryBeforeDelete(name, pi, { fromZone: 'hand', fromInstance: inst, source: CARD_NAME });
  if (gerettet) { engine.log('delete_rescued', { player: ps.username, card: name, source: CARD_NAME }); engine.sync(); return false; }
  engine._pileFlight(pi, name, 'hand', 'deleted', { fromHandIdx: idx });
  engine._geloeschtVerfolgen(pi);
  ps.deletedPile.push(name);
  if (inst) engine._untrackCard(inst.id);
  engine.log('forced_delete', { player: ps.username, card: name, source: CARD_NAME });
  engine.sync();
  return true;
}

/** Spell loeschen, ziehen, Level−1 Karten loeschen. `k` = {name, level}. */
async function weg1(engine, pi, k) {
  const ps = engine.gs.players[pi];
  if (!(await handkarteLoeschen(engine, pi, k.name))) return true;       // gerettet: Aktivierung verbraucht, kein Ziehen
  const n = Math.max(0, k.level);
  if (n > 0) await engine.actionDrawCards(pi, n, { source: CARD_NAME });
  const loeschen = Math.min(Math.max(0, n - 1), (ps.hand || []).length);
  if (loeschen > 0) {
    await engine.actionPromptForceDiscard(pi, loeschen, {
      deleteMode: true, selfInflicted: true, source: CARD_NAME, skipSourceGlow: true, title: CARD_NAME,
    });
  }
  engine.log('dante_spell', { player: ps.username, spell: k.name, level: n });
  engine.sync();
  return true;
}

async function weg2(engine, pi) {
  const ps = engine.gs.players[pi];
  const areas = engine.getAreas(pi).slice();
  for (const inst of areas) await engine.deleteArea(inst, CARD_NAME, { _skipLimitEnforce: true });
  const kandidaten = geloeschteAreas(engine, pi);
  let gebracht = null;
  if (kandidaten.length > 0) {
    const db = engine._getCardDB();
    let wahl = kandidaten[0];
    if (kandidaten.length > 1) {
      const a = await engine.promptGeneric(pi, {
        type: 'cardGallery',
        cards: kandidaten.map(name => ({ name, source: 'deleted', level: db[name]?.level || 0 })),
        title: CARD_NAME,
        description: 'Choose one of your deleted level 3 or lower Areas to bring directly into play.',
        confirmLabel: '🔥 Bring it into play!',
        confirmClass: 'btn-danger',
        cancellable: false,
      });
      if (a?.cardName && kandidaten.includes(a.cardName)) wahl = a.cardName;
    }
    if (await ausGeloeschtEntnehmen(engine, pi, wahl, CARD_NAME)) {
      const inst = engine._trackCard(wahl, pi, 'hand', -1, -1);
      await engine.runHooks('onPlay', {
        _onlyCard: inst, playedCard: inst, cardName: wahl, zone: 'hand', heroIdx: -1, _skipReactionCheck: true,
      });
      if (inst.zone !== 'area') await engine.placeArea(pi, inst);   // Rueckfall fuer Areas ohne eigenes Platzieren
      gebracht = wahl;
    }
  }
  engine.log('dante_area', { player: ps.username, deleted: areas.length, broughtIn: gebracht });
  engine.sync();
  return true;
}

module.exports = {
  activeIn: ['hero'],
  heroEffect: true,

  canActivateHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const feld = ctx.cardHeroOwner ?? pi;
    const hero = engine.gs.players[feld]?.heroes?.[ctx.cardHeroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    return spellsInHand(engine, pi).length > 0 || geloeschteAreas(engine, pi).length > 0
      || engine.getAreas(pi).length > 0;
  },

  async onHeroEffect(ctx) {
    const engine = ctx._engine;
    const pi = ctx.cardOwner;
    const ps = engine.gs.players[pi];
    const spells = spellsInHand(engine, pi);
    const area = geloeschteAreas(engine, pi).length > 0 || engine.getAreas(pi).length > 0;
    if (spells.length === 0 && !area) return false;

    // Weg 2 allein (keine loeschbare Handkarte): kurze Bestaetigung, dann die Areas.
    if (spells.length === 0) {
      const ja = await engine.promptGeneric(pi, {
        type: 'confirm', title: CARD_NAME, showCard: CARD_NAME,
        message: 'Delete all Areas you control and bring one of your deleted Areas into play?',
        confirmLabel: '🔥 Do it!', cancelLabel: 'Cancel', cancellable: true,
      });
      if (!engine._confirmSaidYes(ja)) return false;
      await engine.showTriggeredEffect?.(CARD_NAME, { playerIdx: pi });
      return await weg2(engine, pi);
    }

    // Direkt in den Handwahl-Modus: gueltige Spells leuchten, alles andere ist ausgegraut. Escape/Cancel bricht
    // ab (Effekt NICHT verbraucht); mit Areas gibt es zusaetzlich den Knopf fuer den zweiten Weg.
    const namen = new Set(spells.map(s => s.name));
    const erlaubt = [];
    (ps.hand || []).forEach((n, i) => { if (namen.has(n)) erlaubt.push(i); });
    const antwort = await engine.promptGeneric(pi, {
      type: 'forceDiscardCancellable',
      title: CARD_NAME,
      description: 'Delete a level 3 or lower Spell from your hand, draw cards equal to its level, then delete that many cards -1.',
      instruction: area ? 'Click a highlighted Spell to delete it, or choose the Area option.' : 'Click a highlighted Spell to delete it.',
      cancelLabel: 'Cancel (Esc)',
      ...(area ? { altLabel: '🔥 Delete Areas instead' } : {}),
      eligibleIndices: erlaubt,
      eligibleCards: [...namen],
      cancellable: true,
    });
    if (!antwort || antwort.cancelled) return false;
    if (antwort.alt) {
      if (!area) return false;
      await engine.showTriggeredEffect?.(CARD_NAME, { playerIdx: pi });
      return await weg2(engine, pi);
    }
    const k = spells.find(s => s.name === antwort.cardName);
    if (!k) return false;
    await engine.showTriggeredEffect?.(CARD_NAME, { playerIdx: pi });
    return await weg1(engine, pi, k);
  },
};
