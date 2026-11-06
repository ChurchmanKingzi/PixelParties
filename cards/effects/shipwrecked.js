'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Shipwrecked"  (Welle 82)
//  Spell (Decay Magic Lv3, Attachment)
//
//  „While one of your Heroes has this Spell attached to it, you and all targets you control are unaffected by Areas and you cannot activate the effects of or play Areas."
//
//  ── ANLEGEN (Al: die Karte darf AUCH an einen Gegner-Helden gelegt werden) ───────────────
//  „Your Heroes" = der KONTROLLEUR des Helden, der die Karte trägt. Liegt Shipwrecked an einem Gegnerhelden, gelten alle drei Wirkungen für den GEGNER: er und alle Ziele, die er
//  kontrolliert, sind von Areas unbetroffen, und er kann Areas weder spielen noch deren Effekte aktivieren — so macht man den Gegner „immun" gegen seine eigenen Areas (und gegen deine).
//  Cross-Side-Anhängsel wie Berserk / Overheal Shock: Ziehen/Klick wählt den Wirker, die Wirtswahl (alle lebenden Helden mit freier Support Zone, beide Seiten) öffnet `onPlay`
//  (`ignoreDropHints`). Die Karte folgt dem gemeinsamen Anlege-Vorgang (`_attachment-shared.js`): Anti Magic, Resistance und Effekt-Immunität des Wirts, Treffer-Fenster (Surprises, Hand-
//  Reaktionen, Umlenker) bei einem gegnerischen Wirt. Ein gegnerischer Wirt in der Erste-Runden-Sicherheit (`firstTurnProtectedPlayer`) ist ausgegraut (nichts kann ihn betreffen).
//  Die Karte geht beim Verlassen in die Ablage ihres BESITZERS (`originalOwner` = Wirker).
//
//  ── ZENTRALE ENGINE-FRAGE (kein Skript pro Area) ─────────────────────────────────────────
//  `engine.spielerIstVonAreasAusgenommen(pi)`: wahr, solange ein Held, den `pi` kontrolliert, eine aufgedeckte Shipwrecked in seinen Support Zonen trägt (auch ein übernommener oder an den
//  Gegner abgegebener Held; ruht nie mit dem Wirt; kein Stapeln — eine Karte genügt, weitere Kopien ändern nichts). Daran hängen:
//   (1) „unaffected by Areas": `heldIstVonAreasAusgenommen(Seite, Held)` (Kontrolleur des Helden) und `karteIstVonAreasAusgenommen(inst)` (Kontrolleur der Karte) — dieselben Fragen wie bei
//       Diver Helmet (ATK-Aura von Rioting Village, Blood Rock, Stinky Stables, Graveyard of Limited Power, Pangaia, Shared Blood Tanks, Tearing Mountain, Dark Ocean (Kreaturenschaden),
//       Slippery Ice, Paraseed Greenhouse, Seventh Circle, Fifth Circle (Verdopplung) …); Spieler-Wirkungen der Areas (Acid Rain, Doom Clock, die Circles, Golden Gate, Tarleinn, Temple,
//       Bonegrinder, Clock Tower, Spider Hive, Wowhalla, Barrel Home / Gigalopolis …) fragen `spielerIstVonAreasAusgenommen` im jeweiligen Skript (Kommentar „W82").
//   (2) „cannot activate the effects of Areas": `getActivatableAreas` (ausgegraut) / `activateAreaEffect` (verweigert) und die Hook-Effekte der Areas, die ein Spieler auslöst.
//   (3) „cannot play Areas": Hand-Spiel (`getHeroPlayableCards`, `validateActionPlay`, `getBlockedSpells`: Area-Karten ausgegraut), Zusatzaktions-Wege (Circles-Wiederholung, Cooldin,
//       Cleansing of the Land). Auch „direkt ins Spiel bringen" ist gesperrt (Al 27.10.: „auf KEINEM Weg"): `engine.placeArea` verweigert dem ausgenommenen AKTEUR (`opts.actor`, sonst Zonenbesitzer) als zentraler Wächter; die Skripte prüfen
//       vorher, damit keine Karte verloren geht: Planet in a Bottle (Trank ausgegraut), Aquanian Orkallion (Beschwörung ohne Suche), Dante (Area-Weg entfällt), Spirit of the Barbarian Sword (Effekt gesperrt, da Wegsenden = Kosten
//       der Platzierung), Doom Prophecy (nicht spielbar), Secret Spell Book (Area wird nicht übernommen), Reality Crack (Auslegung: Wegsenden aller Areas läuft, die Hereinbringung und damit der Pollution-Teil entfallen).
//       Der Gegner des Ausgenommenen legt Areas normal (auch in die Zone des Ausgenommenen, Doom Prophecy).
//   Eigene Areas auf dem Brett bleiben liegen; sie wirken nur nicht auf den Ausgenommenen (und er nutzt sie nicht) und wirken auf Nicht-Ausgenommene weiter.
//
//  ── ABGLEICH ─────────────────────────────────────────────────────────────────────────────
//  Die zustandsbasierten Areas (Barrel Home −1 Zone, Gigalopolis +1 Zone: `_zonen-welt-shared.js`) werden beim Anlegen/Abgang der Karte neu abgeglichen (Helden des Ausgenommenen bekommen
//  ihre Zone zurück bzw. verlieren die Zusatzzone). Die ATK-Aura (Rioting Village) und alle Abfragen zur Laufzeit lesen den Ist-Zustand des Bretts.
//
//  ── Bild und Klang ───────────────────────────────────────────────────────────────────────
//  Pixelart-Animation `shipwrecked_attach` (Vorlage: das Kartenbild — Strand, Wellenkante, Treibholz, Fass): eine Welle (Schaumkamm, vier Ebenen, Dithering) läuft in ganzen Pixeln über die Füße des Helden, lässt
//  Planken, Fass, Treibholz und Tang am Strand zurück; Abzeichen 🌊 in der Buff-Spalte des Wirts (Tooltip nennt den Kontrolleur).
// ═══════════════════════════════════════════

const { candidateHosts, attachToHero } = require('./_attachment-shared');
const { opponentsOfGs } = require('./_opp');

const CARD_NAME = 'Shipwrecked';
const ANIM = 'shipwrecked_attach';

/** Beide Seiten: eigene Spalte und alle Gegnerspalten („Cross-Side", Al). */
function seiten(gs, pi) {
  return [pi, ...opponentsOfGs(gs, pi)];
}

/** Ausgegraut: Helden eines Gegners in der Erste-Runden-Sicherheit (kein Effekt kann sie betreffen). */
function heldGedimmt(gs, pi, side) {
  return side !== pi && gs.firstTurnProtectedPlayer != null && side === gs.firstTurnProtectedPlayer;
}

/** Wirte, die jetzt wählbar sind (lebender Held mit freier Support Zone, beide Seiten, ohne ausgegraute). */
function waehlbareWirte(gs, pi, engine) {
  return candidateHosts(gs, pi, engine, { sides: seiten(gs, pi) }).filter(h => !heldGedimmt(gs, pi, h.side));
}

// ═══════════════════════════════════════════
//  CPU
//
//  Wert für die Seite `ich`, wenn `immun` von Areas ausgenommen ist (Zahlen = Eval-Punkte, Handkarte ≈ 25, Slot ≈ 30, Schwelle +3):
//    · eine FREMDE Area auf dem Brett wirkt nicht mehr auf `immun`   → +18 (sie trifft ihn nicht mehr; sie hilft ihm aber auch nicht — symmetrische Areas wie Blood Rock / Rioting Village
//      sind meist ein Nachteil für den Ausgenommenen, weil der Gegner sie weiter nutzt)
//    · eine EIGENE Area auf dem Brett wirkt nicht mehr auf `immun`   → −10 (ihr Nutzen entfällt; gegen den Gegner wirkt sie weiter)
//    · Area-Karten in der Hand (nur bei der CPU selbst bekannt)         → −12 je Karte (nicht mehr spielbar), im Deck −3 je Karte (höchstens 4)
//    · für den Gegner nur öffentliche Hinweise: Areas in seiner Ablage/Gelöscht-Stapel → −3 je Karte (höchstens 3), d. h. „er spielt Areas"
//  Aus Sicht des anderen Spielers zählt das Gegenteil: `wertFuer(engine, ich, immun) = ich === immun ? wert : −wert`.
// ═══════════════════════════════════════════
const W_FREMDE_AREA = 18, W_EIGENE_AREA = 10, W_HANDKARTE = 12, W_DECKKARTE = 3, W_HINWEIS = 3;

function istAreaKarte(db, name) {
  return ((db[name]?.subtype) || '').toLowerCase() === 'area';
}

function wertImmun(engine, immun) {
  const gs = engine.gs;
  const db = engine._getCardDB();
  let v = 0;
  for (let o = 0; o < (gs.areaZones || []).length; o++) {
    for (const name of (gs.areaZones[o] || [])) {
      if (!name) continue;
      v += o === immun ? -W_EIGENE_AREA : W_FREMDE_AREA;
    }
  }
  const ps = gs.players[immun];
  if (engine._cpuPlayerIdx === immun) {
    v -= W_HANDKARTE * (ps?.hand || []).filter(n => istAreaKarte(db, n)).length;
    v -= W_DECKKARTE * Math.min(4, (ps?.mainDeck || []).filter(n => istAreaKarte(db, n)).length);
  } else {
    const hinweise = [...(ps?.discardPile || []), ...(ps?.deletedPile || [])].filter(n => istAreaKarte(db, n)).length;
    v -= W_HINWEIS * Math.min(3, hinweise);
  }
  return v;
}

function wertFuer(engine, ich, immun) {
  const w = wertImmun(engine, immun);
  return ich === immun ? w : -w;
}

/** Alle aufgedeckten Shipwrecked-Karten an lebenden Helden, die `immun` kontrolliert. */
function traeger(engine, immun) {
  return engine.cardInstances.filter(c => {
    if (c.name !== CARD_NAME || c.zone !== 'support' || c.faceDown) return false;
    const s = engine.physicalSide(c), h = engine.gs.players[s]?.heroes?.[c.heroIdx];
    return !!h?.name && h.hp > 0 && engine.heroSideOf(s, h) === immun;
  });
}

/** Wirt-Held: der mit den meisten HP (er hält die Karte am längsten). */
function besterWirt(engine, kandidaten) {
  let best = null, bestHp = -Infinity;
  for (const t of kandidaten) {
    const hero = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
    const hp = hero?.hp || 0;
    if (hp > bestHp) { bestHp = hp; best = t; }
  }
  return best;
}

module.exports = {
  // „… all targets you control are unaffected by Areas": die Wirkung gilt ALLEN Zielen des Kontrolleurs (AoE-Erkennbarkeit, `check-aoe-text`; kein Schaden, daher von Hand — wie Light Ball).
  hitsMultipleTargets: true,

  // ENTKOPPELTES ZAUBERBILD (CARD_API): wird der Zauber negiert, läuft sein Rumpf nie — die Engine spielt dann dieses Bild.
  spellVisual: { impact: { type: ANIM }, impactMs: 260 },

  requiresTarget: true,
  // ^ Blinded-Gating (cards/effects/_hooks.js): die Karte öffnet eine Wirtswahl.

  // 'hand': der Selbstleger-onPlay; 'support': die Abgleich-Hooks, solange sie am Helden liegt.
  activeIn: ['hand', 'support'],

  /** Spielbar, wenn irgendein Held (beide Seiten) eine freie Support Zone hat und nicht ausgegraut ist. */
  spellPlayCondition(gs, pi, engine) {
    return waehlbareWirte(gs, pi, engine).length > 0;
  },

  // ── CPU ─────────────────────────────────────────────────────────────
  cpuMeta: {
    // Die Karte liegt auch in der Zone des GEGNERS möglich: weder Ausrüstung des Wirts noch sein Brett-Besitz — ihren Wert meldet `cpuInstBonus`.
    hostileAttachment: true,

    /**
     * Wert für die Seite `ctrl` (Besitzer der Zone). Der Nutznießer der Immunität ist der KONTROLLEUR des Wirts; liegt die Karte bei ihm, ist der Wert positiv (für `ctrl`), sonst das
     * Gegenteil. Nur die erste Karte je Nutznießer zählt (kein Stapeln).
     */
    cpuInstBonus(engine, inst, ctrl) {
      try {
        if (!inst || inst.zone !== 'support' || inst.name !== CARD_NAME || inst.faceDown) return 0;
        const seite = engine.physicalSide(inst);
        const hero = engine.gs.players[seite]?.heroes?.[inst.heroIdx];
        if (!hero?.name || hero.hp <= 0) return 0;
        const immun = engine.heroSideOf(seite, hero);
        // Nur die erste Karte (kleinste Instanz-Id) je Nutznießer zählt.
        const erste = traeger(engine, immun).sort((x, y) => String(x.id).localeCompare(String(y.id), undefined, { numeric: true }))[0];
        if (erste !== inst) return 0;
        return wertFuer(engine, ctrl, immun);
      } catch { return 0; }
    },
  },

  /**
   * CPU-Wirtswahl: die Seite wählen, für die die Immunität mehr bringt (`wertFuer`); ist keine Seite im Plus, die Wahl ablehnen (`[]` → die Karte bleibt auf der Hand).
   */
  cpuResponse(engine, kind, promptData) {
    if (kind !== 'effectTarget' && kind !== 'target') return undefined;
    if (promptData?.config?.title && promptData.config.title !== CARD_NAME) return undefined;
    const ziele = (promptData?.validTargets || []).filter(t => t.type === 'hero' && !t.ineligible);
    if (ziele.length === 0) return undefined;
    const ich = engine._cpuPlayerIdx >= 0 ? engine._cpuPlayerIdx : engine.gs.activePlayer;
    const kontrolleur = (t) => {
      const hero = engine.gs.players[t.owner]?.heroes?.[t.heroIdx];
      return engine.heroSideOf(t.owner, hero);
    };
    // Gruppen nach Kontrolleur (= Nutznießer); je Gruppe der Held mit den meisten HP.
    const proSeite = new Map();
    for (const t of ziele) {
      const k = kontrolleur(t);
      if (!proSeite.has(k)) proSeite.set(k, []);
      proSeite.get(k).push(t);
    }
    let bestWert = -Infinity, bestZiel = null;
    for (const [k, liste] of proSeite) {
      // Hat der Nutznießer schon eine Shipwrecked (kein Stapeln), bringt eine zweite nichts.
      if (engine.spielerIstVonAreasAusgenommen(k)) continue;
      const w = wertFuer(engine, ich, k);
      if (w > bestWert) { bestWert = w; bestZiel = besterWirt(engine, liste); }
    }
    if (!bestZiel || bestWert <= 0) return [];
    return [bestZiel.id];
  },

  hooks: {
    onPlay: async (ctx) => {
      if (ctx.cardZone !== 'hand') return;
      if (ctx.playedCard?.id !== ctx.card.id) return;
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      if (!ps) { gs._spellCancelled = true; return; }

      // Wirt wählen und anlegen (beide Seiten); `heroDim`: Helden in der Erste-Runden-Sicherheit bleiben sichtbar, aber ausgegraut; `dimRest`: alles Übrige auf dem Brett ebenso.
      const res = await attachToHero(ctx, CARD_NAME, {
        sides: seiten(gs, pi),
        ignoreDropHints: true,
        heroDim: (h, hi, side) => heldGedimmt(gs, pi, side),
        dimRest: true,
        description: 'Attach Shipwrecked to any Hero. That Hero\'s controller and all targets they control are unaffected by Areas, and they cannot activate the effects of or play Areas.',
        confirmLabel: '🌊 Attach!', confirmClass: 'btn-primary',
        skipEnterHook: true,
      });
      if (!res) return;
      const { host, inst } = res;
      const hostHero = gs.players[host.owner]?.heroes?.[host.heroIdx];

      // Anlege-Bild (Pixelart): Welle über den Füßen des Wirts.
      engine._broadcastEvent('play_zone_animation', { type: ANIM, owner: host.owner, heroIdx: host.heroIdx, zoneSlot: -1, duration: 1940 });
      await engine._delay(1100);

      await engine.runHooks('onCardEnterZone', {
        enteringCard: inst, toZone: 'support', toHeroIdx: host.heroIdx,
        _skipReactionCheck: true, _anhaengselAnleger: pi,
      });

      engine.log('shipwrecked_attached', {
        player: ps.username, target: hostHero?.name,
        immune: gs.players[engine.heroSideOf(host.owner, hostHero)]?.username,
      });
      engine.sync();
    },

    /** Eintritt in eine Support Zone (auch Umhängen/Puzzle): zustandsbasierte Areas (Barrel Home / Gigalopolis) und Big Gwens Handgrenze neu abgleichen. */
    onCardEnterZone: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      if (ctx.enteringCard?.id !== ctx.card?.id) return;
      if (ctx.toZone !== 'support') return;
      await abgleichenNachWechsel(ctx._engine, null);
    },

    /** Austritt (Zerstörung, Bounce, Wirt besiegt …): die Wirkung endet — Abgleich ohne diese Karte. */
    onCardLeaveZone: async (ctx) => {
      if (ctx.cardZone !== 'support') return;
      if (ctx.leavingCard?.id !== ctx.card?.id) return;
      if (ctx.fromZone && ctx.fromZone !== 'support') return;
      await abgleichenNachWechsel(ctx._engine, ctx.card);
    },
  },
};

/** Barrel Home / Gigalopolis (Zonen), Big Gwen (Handgrenze) nach dem Kommen/Gehen von Shipwrecked neu abgleichen. `ausser`: die gerade gehende Karte. */
async function abgleichenNachWechsel(engine, ausser) {
  try {
    const welt = require('./_zonen-welt-shared');
    const liegt = engine.cardInstances.some(c => c.zone === 'area' && (c.name === welt.GIGA || c.name === welt.FASS));
    if (liegt) await welt.abgleichen(engine, ausser ? { ausserSchiff: ausser } : {});
    if (!ausser) {
      for (let pi = 0; pi < (engine.gs.players || []).length; pi++) {
        if (engine.spielerIstVonAreasAusgenommen(pi)) await engine._checkReactiveHandLimits(pi);
      }
    }
  } catch (err) {
    console.error('[Shipwrecked] Abgleich:', err.message);
  }
}
