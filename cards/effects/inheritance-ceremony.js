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
//     Kreaturen sind (Equips und Attachments, auch vom Gegner angelegte). Obergrenze = die FREIEN Basis-Support-Zonen des Ziels (versiegelte und gesperrte zählen nicht). Sie
//     landen in den freien Zonen in der Reihenfolge ihrer alten Plätze (Annahme: der Text lässt den Platz offen). Ausgenommen sind nur Karten, die der Zielheld nicht tragen darf
//     (`canEquipCardToHero`: Crusader's-Familie, Race Boats …), `counters.immovable`, Tokens (W52a) und Tempelunas angehängte Fee (W53a: bleibt bei Tempeluna).
//     ★ WIRKUNG WANDERT MIT (Vorgabe 12.10.): Anhängsel, die einen Status/Buff an ihrem Wirt halten, nehmen ihn am alten Helden zurück (`onCardLeaveZone`) und legen ihn am neuen
//     wieder an — über den Karten-Vertrag `attachmentMovedToHost` (Curse, Berserk, Overheal Shock, Anti Magic, Invisibility, Prophecy of Tempeste, Crimson Web; die
//     Status-Anhängsel mit `anhaengselStatusHooks` — Decisive Defeat, Forbidden Curse of Aging — binden über ihr eigenes Eintrittsereignis; Equips über `onPlay` mit `_isMove`).
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

const { hasCardType, heroCanBeEquipped } = require('./_hooks');
const { freieBasisZonen, istUmhaengbaresEquip, darfAn, fuehreUmhaengenAus } = require('./_equip-shared');

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

/**
 * Darf diese Karte überhaupt umgehängt werden? (Nicht-Kreatur, nicht festgesetzt; ihre Wirkung zieht über `attachmentMovedToHost` / ihre Eintrittshaken mit)
 * ★ W50a (Al, 22.10.2026): EQUIPS (Equipment-Artifacts, `isEquip`, als Equip angelegte Helden/Initiation Ritual) sind der Fridge-Teil und laufen über den
 * gemeinsamen Baustein `_equip-shared.js` (`istUmhaengbaresEquip`) — genau wie bei Slippery Fridge. Alles andere (angehängte Spells/Attacks, Abilities …) ist der
 * Ceremony-eigene Anhängsel-Teil und bleibt wie er war.
 */
function verschiebbar(engine, inst) {
  if (!inst || inst.zone !== 'support' || inst.faceDown) return false;
  if (inst.counters?.immovable) return false;
  // ★ W52a (Al, 22.10.2026: „Generell sollten Tokens ausgenommen sein!"): Tokens (Puppets: „Cannot be moved to a different Support Zone", Pollution Token …) werden nie umgehängt.
  if (engine.isTokenCard(inst)) return false;
  if (istUmhaengbaresEquip(engine, inst)) return true;
  // ★ W53a (Al, 22.10.2026: „Soll Ceremony die Fee überhaupt als Anhängsel mitnehmen?" — „Nein."): Tempelunas angehängte Fee (`_keinEquip`) bleibt bei Tempeluna: weder angeboten noch bewegt.
  // Alle übrigen als Equip angelegten Helden (Initiation Ritual) gingen schon oben durch `istUmhaengbaresEquip`.
  if (inst.counters?.treatAsEquip || inst.counters?._keinEquip) return false;
  const cd = engine.getEffectiveCardData(inst) || engine._getCardDB()[inst.name];
  if (!cd || hasCardType(cd, 'Creature')) return false;
  return true;
}

/** Karten des Nutzers in seinen Basis-Support-Zonen, die zu dem Zielhelden wandern dürfen. */
function bewegbareKarten(engine, pi, nutzer, ziel) {
  if (nutzer.seite !== pi || ziel.seite !== pi) return [];                  // nur auf der eigenen Brettseite
  if (!heroCanBeEquipped(ziel.hero)) return [];
  if (engine.isSupportZoneLocked?.(ziel.seite, ziel.heroIdx, { cardName: CARD_NAME, via: 'move' })) return [];
  return engine.cardInstances
    .filter(c => c.zone === 'support' && engine.physicalSide(c) === nutzer.seite && c.heroIdx === nutzer.heroIdx && c.zoneSlot >= 0 && c.zoneSlot <= 2)
    .filter(c => verschiebbar(engine, c) && (istUmhaengbaresEquip(engine, c)
      ? darfAn(engine, c, ziel.seite, ziel.heroIdx)                                                                          // W50a: Equips wie bei der Fridge (die bewegte Karte zählt bei „1 X je Held" nicht mit)
      : engine.canEquipCardToHero(c.name, ziel.seite, ziel.heroIdx, engine.ausruestOpts(c))))                               // W14b (Q153)
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
        const zielId = (c) => `equip-${engine.physicalSide(c)}-${c.heroIdx}-${c.zoneSlot}`;     // die Seite, auf der die Karte LIEGT (Crimson Web: nicht ihr Besitzer)
        const ids = await engine.promptEffectTarget(pi, karten.map(c => ({
          id: zielId(c), type: 'equip', owner: engine.physicalSide(c), heroIdx: c.heroIdx, slotIdx: c.zoneSlot, cardName: c.name, cardInstance: c,
        })), {
          maxTotal: cap, maxPerType: { equip: cap }, minRequired: 0, alwaysConfirmable: true, cancellable: true, greenSelect: true,
          title: CARD_NAME, confirmLabel: '🕊️ Move!',
          description: `Move any number of cards attached or equipped to ${nutzer.hero.name} to ${ziel.hero.name}'s free Support Zones (up to ${cap}). Nothing is played or paid.`,
        });
        if (ids == null) { gs._spellCancelled = true; return; }              // Abbruch: noch nichts geschehen
        gewaehlt = (Array.isArray(ids) ? ids : [])
          .map(id => { const c = karten.find(k => zielId(k) === id); return c ? engine.stapelWahlFuer({ id, heroIdx: c.heroIdx, slotIdx: c.zoneSlot, cardInstance: c }) : null; }).filter(Boolean).slice(0, cap)   // Darion: die gewaehlte Karte des Stapels
          .sort((a, b) => a.zoneSlot - b.zoneSlot);
      }

      // Ab hier ist die Karte gespielt: „only 1 per turn".
      engine.claimHOPT(HOPT_KEY, pi);

      // ── 2b. Umhängen: still, ohne Kosten und ohne „On Play" ──
      // ★ W50a: die Zonen werden vorab in der Reihenfolge der alten Plätze vergeben. EQUIPS (Fridge-Teil) wechseln dann ALLE gleichzeitig über den gemeinsamen
      // Baustein (`fuehreUmhaengenAus`: Leave/Enter/On-Play-Haken, `_isMove`, Equip-Fenster für Afflicted Pests mit dem Wirker als Ausrüstendem); die ANHÄNGSEL
      // (Spells/Attacks u. ä.) wandern danach wie bisher still über `actionTransferAttachment`.
      let bewegt = 0;
      const freiListe = freieBasisZonen(zps, ziel.heroIdx, engine, ziel.seite);
      const zuteilung = gewaehlt.slice(0, freiListe.length).map((inst, i) => ({ inst, platz: freiListe[i] }));
      const equips = zuteilung.filter(z => istUmhaengbaresEquip(engine, z.inst));
      if (equips.length) {
        const plan = equips.map(({ inst, platz }) => ({ inst, owner: ziel.seite, srcHeroIdx: inst.heroIdx, srcSlot: inst.zoneSlot, destHeroIdx: ziel.heroIdx, destSlot: platz }));
        const namen = equips.map(z => z.inst.name);
        await fuehreUmhaengenAus(engine, plan, { anleger: pi, quelle: CARD_NAME });
        for (const name of namen) {
          bewegt++;
          engine.log('inheritance_move', { player: ps.username, from: nutzer.hero.name, to: ziel.hero.name, card: name });
        }
      }
      for (const { inst, platz } of zuteilung) {
        if (istUmhaengbaresEquip(engine, inst) && inst.heroIdx === ziel.heroIdx) continue;   // schon (als Equip) umgehängt
        const name = inst.name;
        const r = await engine.actionTransferAttachment(inst, ziel.seite, ziel.heroIdx, platz, { sourceName: CARD_NAME, quiet: true, anleger: pi });
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
