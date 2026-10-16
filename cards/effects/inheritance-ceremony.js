'use strict';
// ═══════════════════════════════════════════
//  CARD EFFECT: "Inheritance Ceremony"
//  Spell (Support Magic Lv0, Normal)
//
//  „Choose another Hero you control. Move any number of cards attached or equipped to the user to the target's free Support Zones. Then, you may decrease the user's HP
//   by any amount to heal the target's HP by the same amount. The user must have at least 1 HP left afterwards and the target's HP cannot be increased beyond their max.
//   This counts as an additional Action. You can only play 1 "Inheritance Ceremony" per turn."
//
//  ── VORGABE 12.10. ──────────────────────────────────────────────────────
//  „Hier wichtig: Equips/Attachments triggern beim Verschieben KEINE On-Play-Effekte und Kosten auch nichts!"
//  → Das Verschieben ist ein UMHÄNGEN (`engine.actionTransferAttachment` mit `quiet: true`): nichts wird bezahlt, nichts „gespielt", kein „when equipped"-Beobachter
//  anderer Karten feuert (Anti Magic Enchantment, Surprises auf „equipped"). Nur die verschobene Karte selbst bekommt ihr Eintrittsereignis und die Dauerwirkung
//  (`onPlay` mit `_isMove`: ATK-Bonus u. ä. greift auf dem neuen Träger wieder; Attachment-Spells sperren `onPlay` auf die Hand, tun dabei also nichts).
//
//  ── ABLAUF ──────────────────────────────────────────────────────────────
//  1. „another Hero you control": jeder andere LEBENDE Held, den der Spieler kontrolliert (`heroesControlledBy`). Ein einziger Kandidat entfällt als Frage; Abbruch bringt
//     die Karte zurück. Der Nutzer („the user") ist der wirkende Held.
//  2. „Move any number of cards attached or equipped to the user": Auswahl (beliebig viele, auch keine) unter den Karten in den BASIS-Support-Zonen des Nutzers, die keine
//     Kreaturen sind (Equips und Attachments). Obergrenze = die FREIEN Basis-Support-Zonen des Ziels (versiegelte und gesperrte zählen nicht). Sie landen in den freien Zonen
//     in der Reihenfolge ihrer alten Plätze (Annahme: der Text lässt den Platz offen). Ausgenommen:
//       • Attachments mit `onCardLeaveZone`-Hook (Curse, Berserk, Overheal Shock, Anti Magic, Invisibility, Prophecy of Tempeste …): sie binden einen Status an ihren Wirt
//         und lösen ihn beim Verlassen — nach dem Umhängen wäre der Effekt weg. Sie bleiben liegen (Annahme).
//       • Karten, die der Zielheld nicht tragen darf (`canEquipCardToHero`: Crusader's-Familie, Race Boats …), `counters.immovable`, als Equip angelegte Helden.
//     Der Zielheld muss ausrüstbar sein (lebend, nicht eingefroren, nicht Charme); nur auf der EIGENEN Brettseite (nutzt oder trifft der Zauber einen geliehenen Helden
//     der Gegenseite, entfällt das Verschieben, der HP-Teil bleibt — Annahme).
//  3. „Then, you may decrease the user's HP by any amount to heal the target's HP by the same amount": Schieberegler 0 bis min(HP des Nutzers − 1, Fehl-HP des Ziels).
//     Das Abziehen ist HP-VERLUST (kein Schaden: keine Schadens-Hooks, keine Reduktion), das Heilen läuft über `engine.actionHealHero` (Heilsperren, Anti Magic & Co. greifen).
//     Abbruch des Reglers = nichts übertragen.
//  4. „counts as an additional Action": `inherentAction: true`. „You can only play 1 per turn": HOPT (`inheritance-ceremony`), erst bei Bestätigung der Wahl belegt;
//     die Karte ist danach ausgegraut. Spielbar nur, wenn sie etwas bewirken kann (Karten zum Verschieben samt freier Zone ODER HP zum Übertragen).
//
//  ── Bild und Klang ──────────────────────────────────────────────────────
//  Die Karten fliegen einzeln (`play_card_transfer`, Engine), die HP fließen als goldener Strom (`play_zone_animation` `inheritance_flow`, Pixelart, Quelle = Nutzer,
//  Ziel = Zielheld). Klänge in ZONE_ANIM_SFX; Logs `inheritance_move`, `inheritance_hp`.
// ═══════════════════════════════════════════

const { loadCardEffect } = require('./_loader');
const { hasCardType, heroCanBeEquipped } = require('./_hooks');
const { freieBasisZonen } = require('./_equip-shared');

const CARD_NAME = 'Inheritance Ceremony';
const HOPT_KEY = 'inheritance-ceremony';
const FLOW_MS = 1000;        // Länge von `inheritance_flow` (deckt sich mit der Animation im Client)
const FLOW_VOR_MS = 650;     // bis die HP "ankommen" (der Strom erreicht das Ziel bei ~600 ms + Einbau-Versatz)

/** Brettseite des Nutzers und sein Held. */
function nutzerVon(ctx, engine, pi) {
  const seite = ctx.cardHeroOwner ?? pi;
  const heroIdx = ctx.cardHeroIdx;
  const hero = ctx.attachedHero || engine.gs.players[seite]?.heroes?.[heroIdx];
  return { seite, heroIdx, hero };
}

/** Andere lebende Helden, die `pi` kontrolliert. */
function zielHelden(engine, pi, nutzer) {
  return engine.heroesControlledBy(pi)
    .filter(({ physOwner, heroIdx, hero }) => hero?.name && hero.hp > 0 && !(physOwner === nutzer.seite && heroIdx === nutzer.heroIdx))
    .map(({ physOwner, heroIdx, hero }) => ({ seite: physOwner, heroIdx, hero }));
}

/** Darf diese Karte überhaupt umgehängt werden? (Nicht-Kreatur, kein Statusbinder, nicht festgesetzt) */
function verschiebbar(engine, inst) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  if (inst.counters?.immovable || inst.counters?.treatAsEquip) return false;
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  if (!cd || hasCardType(cd, 'Creature')) return false;
  const script = loadCardEffect(inst.name);
  // Attachments, die beim Verlassen ihren Wirt aufräumen (Status/ATK am Wirt): nach dem Umhängen wäre ihre Wirkung weg — sie bleiben.
  if (cd.cardType !== 'Artifact' && typeof script?.hooks?.onCardLeaveZone === 'function') return false;
  return true;
}

/** Karten des Nutzers in seinen Basis-Support-Zonen, die zu dem Zielhelden wandern dürfen. */
function bewegbareKarten(engine, pi, nutzer, ziel) {
  if (nutzer.seite !== pi || ziel.seite !== pi) return [];                  // nur auf der eigenen Brettseite
  if (!heroCanBeEquipped(ziel.hero)) return [];
  if (engine.isSupportZoneLocked?.(ziel.seite, ziel.heroIdx, { cardName: CARD_NAME, via: 'move' })) return [];
  return engine.cardInstances
    .filter(c => c.zone === 'support' && c.owner === nutzer.seite && c.heroIdx === nutzer.heroIdx && c.zoneSlot >= 0 && c.zoneSlot <= 2)
    .filter(c => verschiebbar(engine, c) && engine.canEquipCardToHero(c.name, ziel.seite, ziel.heroIdx, engine.ausruestOpts(c)))   // W14b (Q153)
    .sort((a, b) => a.zoneSlot - b.zoneSlot);
}

/** Wie viele HP dürfen fließen? */
function maxHp(nutzer, ziel) {
  return Math.max(0, Math.min((nutzer.hero?.hp || 0) - 1, (ziel.hero?.maxHp || 0) - (ziel.hero?.hp || 0)));
}

/** Kann der Zauber mit diesem Paar etwas bewirken? */
function wirkt(engine, pi, nutzer, ziel) {
  const frei = freieBasisZonen(engine.gs.players[ziel.seite], ziel.heroIdx, engine, ziel.seite).length;
  return (frei > 0 && bewegbareKarten(engine, pi, nutzer, ziel).length > 0) || maxHp(nutzer, ziel) > 0;
}

module.exports = {
  // ★ Z7b: FIZZELT die Karte (Wirker beim Auflösen handlungsunfähig, v1328), war sie GESPIELT → Stempel (Engine: `_noteFizzledPlay`).
  // Eine ganz NEGIERTE Karte stempelt nicht (Als Entscheidung, Welle 3).
  onFizzledPlay: ({ engine, gs, pi }) => { engine.claimHOPT(HOPT_KEY, pi); },

  // „This counts as an additional Action."
  inherentAction: true,

  // „You can only play 1 per turn" + etwas muss möglich sein (irgendein Held als Nutzer, irgendein anderer Held als Ziel).
  spellPlayCondition(gs, pi, engine) {
    if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) return false;
    if (!engine) return true;
    const helden = engine.heroesControlledBy(pi).filter(h => h.hero?.name && h.hero.hp > 0).map(h => ({ seite: h.physOwner, heroIdx: h.heroIdx, hero: h.hero }));
    return helden.some(n => zielHelden(engine, pi, n).some(z => wirkt(engine, pi, n, z)));
  },

  // Ohne Wert-Rechnung wäre ein Einsatz der CPU ein Zufallsgriff — sie spielt die Karte nicht von sich aus.
  cpuSkipProactive: true,

  hooks: {
    onPlay: async (ctx) => {
      const engine = ctx._engine;
      const gs = engine.gs;
      const pi = ctx.cardOwner;
      const ps = gs.players[pi];
      const nutzer = nutzerVon(ctx, engine, pi);
      if (!ps || !nutzer.hero?.name || nutzer.hero.hp <= 0) { gs._spellCancelled = true; return; }
      if (gs.hoptUsed?.[`${HOPT_KEY}:${pi}`] === gs.turn) { gs._spellCancelled = true; return; }

      // ── 1. Zielheld ──
      const kandidaten = zielHelden(engine, pi, nutzer).filter(z => wirkt(engine, pi, nutzer, z));
      if (kandidaten.length === 0) { gs._spellCancelled = true; return; }
      let ziel = kandidaten[0];
      if (kandidaten.length > 1) {
        const ids = await engine.promptEffectTarget(pi, kandidaten.map(z => ({
          id: `hero-${z.seite}-${z.heroIdx}`, type: 'hero', owner: z.seite, heroIdx: z.heroIdx, cardName: z.hero.name,
        })), {
          maxTotal: 1, title: CARD_NAME, confirmLabel: '🕊️ Inherit!', greenSelect: true, cancellable: true,
          description: `Choose another Hero you control. ${nutzer.hero.name}'s attached and equipped cards and HP can pass to it.`,
        });
        const id = Array.isArray(ids) ? ids[0] : null;
        if (!id) { gs._spellCancelled = true; return; }
        ziel = kandidaten.find(z => `hero-${z.seite}-${z.heroIdx}` === id) || null;
        if (!ziel) { gs._spellCancelled = true; return; }
      }

      // ── 2. Karten wählen (beliebig viele, auch keine; höchstens so viele wie freie Zonen) ──
      const zps = gs.players[ziel.seite];
      const freie = freieBasisZonen(zps, ziel.heroIdx, engine, ziel.seite);
      const karten = bewegbareKarten(engine, pi, nutzer, ziel);
      let gewaehlt = [];
      if (freie.length > 0 && karten.length > 0) {
        const cap = Math.min(freie.length, karten.length);
        const ids = await engine.promptEffectTarget(pi, karten.map(c => ({
          id: `equip-${c.owner}-${c.heroIdx}-${c.zoneSlot}`, type: 'equip', owner: c.owner, heroIdx: c.heroIdx, slotIdx: c.zoneSlot, cardName: c.name, cardInstance: c,
        })), {
          maxTotal: cap, maxPerType: { equip: cap }, minRequired: 0, alwaysConfirmable: true, cancellable: true, greenSelect: true,
          title: CARD_NAME, confirmLabel: '🕊️ Move!',
          description: `Move any number of cards attached or equipped to ${nutzer.hero.name} to ${ziel.hero.name}'s free Support Zones (up to ${cap}). Nothing is played or paid.`,
        });
        if (ids == null) { gs._spellCancelled = true; return; }              // Abbruch: noch nichts geschehen
        gewaehlt = (Array.isArray(ids) ? ids : [])
          .map(id => karten.find(c => `equip-${c.owner}-${c.heroIdx}-${c.zoneSlot}` === id)).filter(Boolean).slice(0, cap)
          .sort((a, b) => a.zoneSlot - b.zoneSlot);
      }

      // Ab hier ist die Karte gespielt: „only 1 per turn".
      engine.claimHOPT(HOPT_KEY, pi);

      // ── 2b. Umhängen: still, ohne Kosten und ohne „On Play" ──
      let bewegt = 0;
      for (const inst of gewaehlt) {
        const platz = freieBasisZonen(zps, ziel.heroIdx, engine, ziel.seite)[0];
        if (platz == null) break;
        const name = inst.name;
        const r = await engine.actionTransferAttachment(inst, ziel.seite, ziel.heroIdx, platz, { sourceName: CARD_NAME, quiet: true });
        if (r?.success) {
          bewegt++;
          engine.log('inheritance_move', { player: ps.username, from: nutzer.hero.name, to: ziel.hero.name, card: name });
        }
      }

      // ── 3. HP übertragen ──
      const mx = maxHp(nutzer, ziel);
      if (mx > 0 && nutzer.hero.hp > 1 && ziel.hero.hp > 0) {
        const optionen = [];
        for (let n = 0; n <= Math.min(mx, 60); n++) optionen.push({ id: String(n), label: n === 0 ? 'Transfer nothing' : `${n} HP` });
        const wahl = await engine.promptGeneric(pi, {
          type: 'optionPicker',
          title: CARD_NAME,
          _icPhase: 'hp',
          description: `Decrease ${nutzer.hero.name}'s HP by any amount to heal ${ziel.hero.name} by the same amount? (max ${mx}; ${nutzer.hero.name} keeps at least 1 HP)`,
          renderAs: 'slider', sliderMin: 0, sliderMax: mx, sliderDefault: 0, sliderUnit: 'HP',
          confirmLabel: '🕊️ Transfer!', cancelLabel: 'Skip', cancellable: true,
          options: optionen,
        });
        const betrag = Math.max(0, Math.min(mx, parseInt(wahl?.optionId, 10) || 0));
        // Zwischen Frage und Antwort kann sich etwas geändert haben.
        const amt = Math.min(betrag, maxHp(nutzer, ziel));
        if (amt > 0) {
          engine._broadcastEvent('play_zone_animation', {
            type: 'inheritance_flow', zoneType: 'board', owner: nutzer.seite, heroIdx: -1, zoneSlot: -1, duration: FLOW_MS,
            targets: [{ owner: ziel.seite, heroIdx: ziel.heroIdx, zoneSlot: -1, cardName: ziel.hero.name }],
            originOwner: nutzer.seite, originHeroIdx: nutzer.heroIdx, originZoneSlot: -1,
          });
          await engine._delay(FLOW_VOR_MS);
          // HP-VERLUST, kein Schaden: der Held zahlt, es gibt weder Schadens-Hooks noch Reduktionen.
          const vorher = nutzer.hero.hp;
          nutzer.hero.hp = Math.max(1, nutzer.hero.hp - amt);
          engine._scNoteHeroHpLoss?.(nutzer.hero, vorher - nutzer.hero.hp);
          engine.sync();
          const hpVorher = ziel.hero.hp;
          await engine.actionHealHero(ctx.card, ziel.hero, amt);
          engine.log('inheritance_hp', { player: ps.username, from: nutzer.hero.name, to: ziel.hero.name, paid: vorher - nutzer.hero.hp, healed: ziel.hero.hp - hpVorher });
          engine.sync();
          await engine._delay(Math.max(0, FLOW_MS - FLOW_VOR_MS - 100));
        }
      }
      engine.sync();
    },
  },

  /** CPU: Regler auf 0, sonst keine Übertragung (sie spielt die Karte ohnehin nicht von sich aus). */
  cpuResponse(engine, kind, payload) {
    if (kind === 'generic' && payload?.title === CARD_NAME && payload._icPhase === 'hp') return { optionId: '0' };
    return undefined;
  },
};
