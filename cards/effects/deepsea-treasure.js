// ═══════════════════════════════════════════
//  CARD EFFECT: „Deepsea Treasure"
//  Spell (Support Magic Lv 2, PP DD)
//
//  „Reveal the top 3 cards of your deck. You may play any Artifacts you
//   find there immediately without paying their Cost. Add all other
//   revealed cards to your hand."
//
//  (Von 2 auf 3 Karten erhoeht, Text neu — Als Vorgaben 12.9.)
//
//  BAUART
//  ──────
//  • ★ AUFDECKEN IN DER BILDMITTE (Als Vorgabe): jede Karte fliegt vom
//    Deckstapel in die MITTE des Bildes, klappt dabei auf, steht kurz
//    still — und fliegt dann an IHREN Handplatz, wo sie ab der Ankunft
//    dauerhaft liegt. Client-Takt `treasure_reveal` (v1022/v1023).
//
//  • ★ Die Karte geht SOFORT in den Zustand, nicht erst am Flugende:
//    der Client versteckt ihren Handplatz bis zur Ankunft. Anders
//    herum gaebe es den Platz beim Anflug noch gar nicht — genau
//    deshalb flogen die Karten anfangs zur Mitte des Handkastens.
//
//  • ★ ALLE DREI GEHEN AUF DIE HAND — auch die Artefakte. Der Text
//    trennt nicht „Artefakte aufs Brett, Rest auf die Hand", sondern
//    sagt „play any Artifacts … immediately"; gespielt wird also von
//    der Hand aus. Wer das Angebot ausschlaegt, behaelt sie dort.
//
//  • Das Untermenue fragt EINZELN: „dieses Artefakt jetzt gratis
//    spielen?" — und zwar so lange, wie noch ungefragte Artefakte aus
//    DIESER Enthuellung auf der Hand liegen.
//
//  • ★ WAS „SOFORT SPIELEN" HEISST, HAENGT AN DER UNTERART:
//      – Equipment          → wird ueber `equipArtifactToHero` sofort
//                             an einen gewaehlten Helden gelegt (mit
//                             `onPlay`/`onCardEnterZone`).
//      – Artifact/Creature  → wird ueber `actionPlaceCreature` sofort
//                             in eine gewaehlte Support Zone gesetzt.
//      – alles andere       → bekommt den Nullpreis-Vermerk
//                             (`_freeArtifactNames`, Misfire-Vertrag)
//                             und wird vom Spieler im selben Zug
//                             regulaer, aber KOSTENLOS gespielt. Deren
//                             Spielweg haengt an Kettenfenster,
//                             Zielwahl und Zahlstellen im Server — der
//                             laesst sich aus einem Kartenskript nicht
//                             sauber nachbauen.
// ═══════════════════════════════════════════

const { isEquipArtifact, equipDestinations, equipArtifactToHero } = require('./_orchestra-shared');
const { hasCardType } = require('./_hooks');

const CARD_NAME = 'Deepsea Treasure';
const ANZAHL = 3;
// Takte des Client-Flugs (`treasure_reveal`): 780 ms zur Mitte, kurz
// verharren, 620 ms an den Handplatz.
// ★ v1024 (Als Befund): das Verharren ist fast null — sonst steht die
// zweite Karte in der Mitte, waehrend die erste noch dort ist.
const ZUR_MITTE_MS = 780;
const HALT_MS      = 90;
const ZUR_HAND_MS  = 620;
const FLUG_MS      = ZUR_MITTE_MS + HALT_MS + ZUR_HAND_MS;
const VERSATZ_MS   = 560;   // Abstand zwischen den drei Karten

function istArtefakt(cd) { return !!cd && hasCardType(cd, 'Artifact'); }
function istArtefaktKreatur(cd) {
  return istArtefakt(cd) && (cd.subtype || '').toLowerCase().split('/').some(t => t.trim() === 'creature');
}

module.exports = {
  requiresTarget: false,

  spellPlayCondition: (gs, pi) => (gs.players[pi]?.mainDeck || []).length > 0 && !gs.players[pi]?.handLocked,   // v1396: „add to hand“

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }
      if ((ps.mainDeck || []).length === 0) { gs._spellCancelled = true; return; }
      // v1396 (Als Ruling 25.9.): aufgedeckte Karten auf die Hand zu nehmen
      // IST „add to hand" — unter einer Hand-Sperre geht das nicht.
      // Keine Such-Sperre: das Aufdecken ist keine Suche.
      if (engine.handZugangGesperrt(pi)) { gs._spellCancelled = true; return; }

      await engine.showTriggeredEffect(CARD_NAME, { playerIdx: pi });

      // ── ① Aufdecken: Deck → Bildmitte → eigener Handplatz ───────
      // ★ DER ZIELPLATZ WIRD MITGESCHICKT (v1023): der Client soll an
      // IHREN Handplatz fliegen, nicht in die Mitte des Handkastens.
      // `handIdx` ist der Platz, den die Karte bekommt, `finalHandSize`
      // die Handgroesse NACH allen drei Karten — die Hand ist
      // zentriert, die Reihe rueckt also beim Wachsen, und ohne die
      // Endgroesse landete jede Karte eine halbe Kartenbreite daneben.
      const gezeigt = [];
      const handVorher = (ps.hand || []).length;
      const wieviele = Math.min(ANZAHL, (ps.mainDeck || []).length);
      for (let i = 0; i < ANZAHL; i++) {
        const name = (ps.mainDeck || [])[0];
        if (!name) break;
        if (!(await engine.takeFromPile(ps, 'deck', 0, { source: CARD_NAME }))) break;
        const handIdx = handVorher + gezeigt.length;
        engine._broadcastEvent('treasure_reveal', {
          cardName: name, playerIdx: pi,
          handIdx, finalHandSize: handVorher + wieviele,
        });
        // ★ Die Karte gehoert schon jetzt in den Zustand — der Client
        // versteckt ihren Handplatz, bis der Flug ankommt. Waere sie
        // erst am Flugende im Zustand, gaebe es den Platz beim Anflug
        // noch gar nicht.
        await engine.handZugang(ps, name, { von: 'deck', source: CARD_NAME });
        gezeigt.push(name);
        engine.sync();
        await engine._delay(VERSATZ_MS);
      }
      if (gezeigt.length === 0) { gs._spellCancelled = true; return; }
      // Die letzte Karte muss noch ankommen, bevor das Menue aufgeht.
      await engine._delay(FLUG_MS - VERSATZ_MS + 120);

      engine.log('deepsea_treasure', { player: ps.username, cards: gezeigt });
      engine.sync();

      // ── ② Untermenue: welche Artefakte jetzt gratis spielen? ────
      const cardDB = engine._getCardDB();
      const offen = gezeigt.filter(n => istArtefakt(cardDB[n]));
      let schleifen = 0;
      while (offen.length > 0 && schleifen++ < 8) {
        // Nur, was noch auf der Hand liegt.
        const waehlbar = offen.filter(n => (ps.hand || []).includes(n));
        if (waehlbar.length === 0) break;

        const wahl = await engine.promptGeneric(pi, {
          type: 'cardGallery',
          cards: waehlbar.map(n => ({ name: n, source: 'hand' })),
          title: CARD_NAME,
          description: 'Play a revealed Artifact right now — without paying its Cost? '
            + '(Anything you skip simply stays in your hand.)',
          confirmLabel: '🪙 Play for free',
          confirmClass: 'btn-info',
          cancelLabel: 'Keep the rest',
          cancellable: true,
        });
        if (!wahl || wahl.cancelled || !wahl.cardName) break;
        const name = wahl.cardName;
        const pos = offen.indexOf(name);
        if (pos >= 0) offen.splice(pos, 1);           // jedes nur EINMAL fragen
        const cd = cardDB[name];
        if (!cd) continue;

        // ── Equipment: sofort an einen Helden ────────────────────
        if (isEquipArtifact(cd)) {
          const ziele = equipDestinations(engine, pi, name);
          if (ziele.length === 0) {
            engine.log('deepsea_treasure_skip', { card: name, reason: 'kein_platz' });
            continue;
          }
          const zonen = ziele.map(z => ({
            heroIdx: z.heroIdx, slotIdx: z.slotIdx, owner: pi,
            label: `${ps.heroes[z.heroIdx]?.name || 'Hero'} · Slot ${z.slotIdx + 1}`,
          }));
          const platz = await ctx.promptZonePick(zonen, {
            title: name,
            description: `Equip ${name} to which Hero?`,
            cancellable: true,
          });
          if (!platz) continue;
          await equipArtifactToHero(engine, pi, name, pi, platz.heroIdx, platz.slotIdx, {
            from: 'hand', source: CARD_NAME,
          });
          engine.log('deepsea_treasure_played', { player: ps.username, card: name, as: 'equipment' });
          engine.sync();
          continue;
        }

        // ── Artefakt-Kreatur: sofort in eine Support Zone ────────
        if (istArtefaktKreatur(cd)) {
          const zonen = [];
          for (let hi = 0; hi < (ps.heroes || []).length; hi++) {
            const held = ps.heroes[hi];
            if (!held?.name || held.hp <= 0) continue;
            for (let si = 0; si < 3; si++) {
              if (((ps.supportZones[hi] || [])[si] || []).length === 0) {
                zonen.push({ heroIdx: hi, slotIdx: si, owner: pi, label: `${held.name} · Slot ${si + 1}` });
              }
            }
          }
          if (zonen.length === 0) {
            engine.log('deepsea_treasure_skip', { card: name, reason: 'kein_platz' });
            continue;
          }
          const platz = await ctx.promptZonePick(zonen, {
            title: name,
            description: `Place ${name} into which Support Zone?`,
            cancellable: true,
          });
          if (!platz) continue;
          const idx = (ps.hand || []).indexOf(name);
          if (idx < 0) continue;
          engine.takeFromPileSync(ps, 'hand', idx);
          engine.notePlayedFromHand(pi);
          await engine.actionPlaceCreature(name, pi, platz.heroIdx, platz.slotIdx, {
            source: 'external', sourceName: CARD_NAME, fireHooks: true,
          });
          engine.log('deepsea_treasure_played', { player: ps.username, card: name, as: 'creature' });
          engine.sync();
          continue;
        }

        // ── Alles andere: Nullpreis-Vermerk (s. Kopf) ────────────
        ps._freeArtifactNames = ps._freeArtifactNames || {};
        ps._freeArtifactNames[name] = true;
        engine.log('deepsea_treasure_free', { player: ps.username, card: name });
        engine.sync();
      }
    },
  },
};
