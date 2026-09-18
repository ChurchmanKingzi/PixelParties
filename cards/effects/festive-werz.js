// ═══════════════════════════════════════════
//  CARD EFFECT: „Festive Werz"
//  Creature (Summoning Magic Lv0, 70 HP)   (banned)
//
//  "When you summon this Creature, pay your opponent any amount of
//   Gold. Then, draw a card for every 5 Gold paid that way, to a
//   maximum of 4. You can only activate this effect once per turn."
//
//  ── VERWANDT MIT „Smuggler's Pier", ABER NICHT GLEICH ─────────────
//  Beide kaufen Karten fuer Gold in Fuenferschritten. Drei Unterschiede
//  entscheiden den Bau:
//
//  ① DAS GOLD GEHT AN DEN GEGNER, es wird nicht bloss ausgegeben. Also
//     zwei Buchungen: `_payCardCost` beim Zahler UND `actionGainGold`
//     beim Empfaenger. Wichtig: der Gegner kann eine Gold-Sperre tragen
//     (`goldLocked`, Golden Arrow) — dann kommt die Zahlung bei ihm
//     nicht an. Der Zahler hat trotzdem bezahlt und zieht trotzdem;
//     das ist die Wirkung der Sperre, nicht ein Fehlschlag der Karte.
//
//  ② „ANY AMOUNT OF GOLD" — nicht „a multiple of 5". Gezahlt werden
//     darf jeder Betrag; gezogen wird nur je VOLLE fuenf Gold. Die
//     Auswahl bietet deshalb bewusst nur die sinnvollen Stufen an
//     (5/10/15/20) plus die Null — ein krummer Betrag waere nur
//     verschenktes Gold und ist ueber die Auswahl gar nicht erreichbar.
//     ★ Das ist eine Darstellungsentscheidung, keine Regelaenderung:
//     wer 7 zahlen wollte, bekaeme dieselbe eine Karte wie fuer 5.
//
//  ③ KEINE Zieh-Sperre danach. Smuggler's Pier setzt `handLocked`;
//     Werz' Text sagt davon nichts, also bleibt die Hand offen.
//
//  ── HOPT ──────────────────────────────────────────────────────────
//  „once per turn" je SEITE — zwei Werz in derselben Runde auf
//  derselben Seite feuern also nur einmal. Bauform von Exploding Skull.
//
//  ── ANIMATION ────────────────────────────────────────────────────
//  Al 14.9.: Geschenke. Neuer Zonen-Effekt `gift_shower` — bunte
//  Paeckchen, die ueber dem Ziel aufsteigen und aufplatzen.
// ═══════════════════════════════════════════

const CARD_NAME = 'Festive Werz';
const GOLD_PRO_KARTE = 5;
const MAX_KARTEN = 4;

module.exports = {
  // ★★ v1182 — ENTKOPPELTE BILDER (CARD_API): wird die Karte NEGIERT,
  // laeuft ihr Effekt-Rumpf nie — die Engine spielt dann diese Bilder.
  // Im normalen Weg bleibt es bei den Broadcasts im Effekt selbst.
  spellVisual: {
    impact: { type: 'gift_shower' }, impactMs: 260,
  },

  activeIn: ['hand', 'support'],

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const inst = ctx.card;
      if (!inst || inst.zone !== 'support') return;   // nur beim Beschwoeren

      const pi = inst.controller ?? inst.owner;
      const oppIdx = pi === 0 ? 1 : 0;
      const ps = gs.players[pi];
      const ops = gs.players[oppIdx];
      if (!ps || !ops) return;

      // „once per turn" je Seite.
      const hoptKey = `festive-werz:${pi}`;
      if (gs.hoptUsed?.[hoptKey] === gs.turn) return;

      const gold = ps.gold || 0;
      const deck = (ps.mainDeck || []).length;
      const maxStufen = Math.min(
        MAX_KARTEN,
        Math.floor(gold / GOLD_PRO_KARTE),
        deck,
      );
      if (maxStufen <= 0) return;                     // nichts zu holen

      // Nur die sinnvollen Stufen anbieten (siehe Kopf, Punkt ②).
      //
      // ★ DIE REIHENFOLGE UND DIE BESCHRIFTUNG SIND VERTRAG, NICHT KOSMETIK
      // (v1083). Der ordinale Lernkanal liest die Zahlenreihe aus den
      // Beschriftungen — die ERSTE Zahl je Zeile:
      //   • „Pay nothing" ohne Ziffer laesst den Kanal komplett
      //     verstummen (`zahlen.some(x => x === null)` → null), deshalb
      //     steht dort ausdruecklich „Pay 0 Gold";
      //   • aufsteigend sortiert, damit der Rueckfall des Piloten
      //     (》letzte Option《 = all in) das tut, was er dokumentiert.
      //     Mit der Null am Ende haette die CPU ohne Profil IMMER nichts
      //     gezahlt.
      const optionen = [{ id: '0', label: 'Pay 0 Gold  —  draw nothing' }];
      for (let k = 1; k <= maxStufen; k++) {
        const kosten = k * GOLD_PRO_KARTE;
        optionen.push({
          id: String(kosten),
          label: `Pay ${kosten} Gold  →  Draw ${k} card${k === 1 ? '' : 's'}`,
        });
      }

      // ★★ v1137 (Al 15.9.): REGLER statt einzelner Knoepfe, in
      // Fuenferschritten. Die Optionsliste bleibt daneben bestehen —
      // sie ist der Lernkanal (siehe Kopf, FORM 3: ORDINAL) und die
      // Beschriftungen tragen die Zahlenreihe. Der Client zeichnet bei
      // `renderAs: 'slider'` den Regler, der Server bekommt dieselbe
      // Antwortform.
      const wahl = await engine.promptGeneric(pi, {
        type: 'optionPicker',
        renderAs: 'slider',
        sliderMin: 0,
        sliderMax: maxStufen * GOLD_PRO_KARTE,     // = min(eigenes Gold, 20)
        sliderStep: GOLD_PRO_KARTE,                // nur Fuenferschritte
        sliderDefault: 0,
        sliderUnit: ' Gold',
        title: CARD_NAME,
        showCard: CARD_NAME,
        description: `Pay ${ops.username} Gold to draw 1 card per ${GOLD_PRO_KARTE} Gold (max ${MAX_KARTEN}).`,
        options: optionen,
        cancellable: true,
      });
      // ★★ DER EIGENTLICHE FEHLER (Al: „ich zahle keines und ziehe
      // nichts"): der Client antwortet mit `optionId`, NICHT mit `id`.
      // `wahl?.id` war immer undefined, `kosten` also 0 — und die Karte
      // stieg eine Zeile spaeter kommentarlos aus.
      const kosten = Number(wahl?.optionId ?? wahl?.id ?? 0);
      if (!(kosten > 0)) return;

      // Nach der Abfrage neu pruefen — waehrend des Ueberlegens kann
      // ein Effekt das Gold oder das Deck veraendert haben.
      if ((ps.gold || 0) < kosten) return;
      const karten = Math.floor(kosten / GOLD_PRO_KARTE);
      if ((ps.mainDeck || []).length < karten) return;

      if (!gs.hoptUsed) gs.hoptUsed = {};
      gs.hoptUsed[hoptKey] = gs.turn;

      // ★★ v1138 (Al 15.9.): „Bunte Geschenke, die von der eigenen
      // Goldanzeige zur gegnerischen fliegen, waehrend das Gold nicht
      // in einem Schritt, sondern als fliessende Anzeige reduziert/
      // erhoeht wird."
      //
      // ★ BEIDES GAB ES SCHON, nur nicht zusammen:
      //   • `play_gold_crash` zaehlt die Anzeigen fliessend von einem
      //     Stand zum anderen (Market Crash, Loan Shredder). Mit `to`
      //     laesst sich je Spieler ein ZIEL angeben — genau das, was
      //     hier gebraucht wird: einer runter, einer rauf.
      //   • `gold_gift_flight` (neu) traegt die Geschenke dazwischen.
      //
      // Der Broadcast geht VORAUS, damit die Zaehlung mit dem Flug
      // beginnt und nicht erst, wenn das Gold laengst gebucht ist.
      const goldVorher = [gs.players[0].gold || 0, gs.players[1].gold || 0];
      const goldNachher = goldVorher.slice();
      goldNachher[pi] = Math.max(0, goldVorher[pi] - kosten);
      goldNachher[oppIdx] = goldVorher[oppIdx] + kosten;
      const FLUG_MS = 1100;

      engine._broadcastEvent('play_gold_crash', {
        amounts: goldVorher, to: goldNachher, durationMs: FLUG_MS, tone: 'recover',
      });
      engine._broadcastEvent('gold_gift_flight', {
        fromPlayer: pi, toPlayer: oppIdx, amount: kosten, durationMs: FLUG_MS,
      });
      await engine._delay(FLUG_MS);

      // ① Zwei Buchungen: raus beim Zahler, rein beim Gegner.
      await engine._payCardCost(pi, kosten);
      engine._broadcastEvent('play_zone_animation', {
        type: 'gift_shower', owner: oppIdx, heroIdx: 0, zoneSlot: -1,
      });
      await engine.actionGainGold(oppIdx, kosten, { source: CARD_NAME });
      await engine._delay(280);

      await engine.actionDrawCards(pi, karten, { source: CARD_NAME });

      engine.log('festive_werz', {
        player: ps.username, to: ops.username, gold: kosten, cards: karten,
      });
      engine.sync();
    },
  },

  // ── CPU: BEWUSST KEIN `cpuResponse` (v1083, Als Vorgabe 14.9.) ────
  //
  // ★ „Statt arbitraer die Haelfte zu zahlen, sollte die CPU per ML
  // lernen, wann wie viel zu zahlen ist." Eine erste Fassung hatte hier
  // eine handgeschriebene Regel (》hoechstens die Haelfte des Vorrats《).
  // Die war nicht nur geraten, sie war SCHAEDLICH: ein
  // `cpuResponse('generic')` greift VOR dem Piloten — die Karte haette
  // den Lernkanal dauerhaft blockiert und nie eine Kontrastgruppe
  // erzeugt. (Dieselbe Falle wie bei `cpuMeta.reactionHeuristic`,
  // 6.9.)
  //
  // Der passende Kanal existiert bereits: `ordinalPick` /
  // `ordinalRules` — 》FORM 3: ORDINAL (wie viel)《. Er liest die
  // Zahlenreihe aus den Optionsbeschriftungen und waehlt die Stufe, die
  // der GELERNTEN Zielhoehe am naechsten kommt, je Karte getrennt (Als
  // Ruling 24.8.: keine deckweiten 》You may《-Kanaele). Im Training
  // streut `PP_OPTION_EXPLORE` die Wahl, damit ueberhaupt Kontrast
  // entsteht; ohne Profil bleibt es beim dokumentierten Rueckfall.
  //
  // Die Karte muss dafuer nichts anmelden — nur eine saubere
  // Zahlenreihe anbieten (siehe Kommentar an den Optionen) und dem
  // Piloten nicht ins Lenkrad greifen.
};
