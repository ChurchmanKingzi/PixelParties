'use strict';
// W36a · Punkt 2 (Allgemeinregel) · Al, 22.10.2026: „Sofern ein Klau-Effekt einen Hero nicht ausdrücklich am Handeln hindert, darf er immer auch Reactions einsetzen" (und damit auch handeln).
//  AUDIT über ALLE Reaktionswege: ein vom Spieler kontrollierter (übernommener) Held — dauerhaft (`actionTakeHeroPermanently`, Paraseed Control) oder temporär (`actionStealHero`, Charme/Styx) — darf jede
//  Reaktion einsetzen, deren Bedingungen ER erfüllt (Schule/Stufe aus SEINEN Ability Zones, Hand/Gold des Kontrolleurs); gesperrt ist er nur, wenn ihn ein Status ausdrücklich am Handeln hindert
//  (Frozen/Stunned/Webbed; Spell-Sperren magic_silenced/frightened/nulled/berserked für Spells) bzw. ein Kontrollrecht (`kontrollRechte`) es verbietet (heute stempelt das keine Karte).
//  Teile (je Variante dauerhaft / temporär; Gegenproben Frozen, Besitzer des abgegebenen Helden, Held ohne Schule):
//   1  Hand-Reaktionen Spell/Attack/Creature (alle Karten mit Untertyp Reaction): zentrale Wirkersuche `engine._rxCastKandidaten` liefert den übernommenen Helden
//   2  Surprises (alle Karten mit Untertyp Surprise; Zone des übernommenen Helden): `_canHeroActivateSurprise(…, { reaktor })` + Zonen-Sammler `_getAllSurpriseEntries`
//   3  Artefakt-/Trank-Reaktionen: brauchen keinen Wirker (`_rxCastKandidaten` → null)
//   4  Ausrüstungs-Reaktion (Bow of the Hunt Goddess am übernommenen Helden): das Fenster bietet sie dem Kontrolleur an (Verhalten über den echten Spielweg)
//  Karten mit eigener Fenster-Bedingung (`reactionCasterAllowed`: Furious Anger, Looting, Old Couple, Stealthy Pursuit, Test Flight, Triumphant Return) prüft das Repro nicht über die Wirkersuche (sie hängt vom Fenster ab) – siehe W20c/c-1 und W21.
//  Gegenprobe-Charakter: Exit 0 auch auf der Basis 98a18e17 (Audit ohne Befund: alle Wege waren schon nach Kontrolle ausgelegt).
// Aufruf: node docs/niche-tests/repro/W36/a-04-reaktionen-uebernommener-helden-audit.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const DB = H.DB;

async function uebernehmen(t, v, ctrl, besitzer, hi) {
  if (v === 'dauerhaft') await t.engine.actionTakeHeroPermanently(ctrl, besitzer, hi);
  else t.engine.actionStealHero(ctrl, besitzer, hi);
  await sleep(120);
}
/** `casterIsTarget`-Karten (Escape, Fireshield …): der Wirker ist der getroffene Held – das Fenster reicht ihn als Ziel mit (W20c). */
const zielOpts = (n) => (H.loadCardEffect(n)?.casterIsTarget ? { targetHeroIdx: 2, targetSeite: 1 } : {});
const hatKand = (k, seite, hi) => Array.isArray(k) && k.some(x => x.casterSeite === seite && x.casterIdx === hi);

(async () => {
  const R = H.runner();
  // Nur Karten MIT Skript gehören zum Projekt (Karten ohne Skript werden nicht angefasst).
  const mitSkript = (c) => !!H.loadCardEffect(c.name);
  const REAKTION = Object.values(DB).filter(c => c.subtype === 'Reaction' && ['Spell', 'Attack', 'Creature'].includes(c.cardType) && mitSkript(c)).map(c => c.name);
  const SURPRISE = Object.values(DB).filter(c => c.subtype === 'Surprise' && ['Spell', 'Attack', 'Creature'].includes(c.cardType) && mitSkript(c)).map(c => c.name);
  const ARTREAK = Object.values(DB).filter(c => c.subtype === 'Reaction' && ['Artifact', 'Potion'].includes(c.cardType) && mitSkript(c)).map(c => c.name);
  const ausgenommen = new Set();   // Karten mit fensterabhängiger Wirkerbedingung
  for (const n of REAKTION) { const s = H.loadCardEffect(n); if (s && typeof s.reactionCasterAllowed === 'function') ausgenommen.add(n); }
  const unklar = [];

  // ═══ Teil 1 · Hand-Reaktionen: zentrale Wirkersuche ═══
  for (const v of ['dauerhaft', 'temporaer']) {
    R.section(`Teil 1 (${v}): ${REAKTION.length - ausgenommen.size} Hand-Reaktionskarten – der übernommene Held ist Wirker (Sitz 0 übernimmt 1:2)`);
    let ok = 0, nok = [];
    for (const n of REAKTION) {
      if (ausgenommen.has(n)) continue;
      const t = await H.fresh({ hand: [[], []], deckSize: 20, hp: 800 });
      t.grantFor(1, 2, n);
      await uebernehmen(t, v, 0, 1, 2);
      const k = t.engine._rxCastKandidaten(t.gs.players[0], n, H.loadCardEffect(n), zielOpts(n));
      if (hatKand(k, 1, 2)) ok++; else nok.push(n);
    }
    R.check(`${v}: alle Reaktionskarten bieten den übernommenen Helden als Wirker an`, nok.length === 0, nok);
    R.check(`${v}: ${ok} Hand-Reaktionskarten über die Wirkersuche geprüft (alle ${REAKTION.length - ausgenommen.size} ohne fensterabhängige Wirkerbedingung)`, ok === REAKTION.length - ausgenommen.size, ok);
    // Gegenproben an EINER Karte je Typ (Spell/Attack/Creature)
    const proben = [REAKTION.find(n => DB[n].cardType === 'Spell' && !ausgenommen.has(n) && H.loadCardEffect(n)?.isPostTargetReaction), REAKTION.find(n => DB[n].cardType === 'Attack'), REAKTION.find(n => DB[n].cardType === 'Creature')].filter(Boolean);
    for (const n of proben) {
      const lauf = async (label, aufbau, erwartet) => {
        const t = await H.fresh({ hand: [[], []], deckSize: 20, hp: 800 });
        t.grantFor(1, 2, n); await uebernehmen(t, v, 0, 1, 2); aufbau && aufbau(t);
        const k = t.engine._rxCastKandidaten(t.gs.players[0], n, H.loadCardEffect(n), zielOpts(n));
        R.check(`${v}, ${n} (${DB[n].cardType}): ${label} → ${erwartet ? 'Wirker' : 'KEIN Wirker'}`, hatKand(k, 1, 2) === erwartet, k);
      };
      await lauf('Held nicht gesperrt (Gegenprobe)', null, true);
      await lauf('Held Frozen', (t) => t.heroStatus(1, 2, 'frozen'), false);
      await lauf('Held Stunned', (t) => t.heroStatus(1, 2, 'stunned'), false);
      await lauf('Held Webbed', (t) => t.heroStatus(1, 2, 'webbed'), false);
      // Ein Klau-Effekt, der AUSDRÜCKLICH Spells/Attacks bzw. Beschwörungen verbietet (`_kontrollRechte`; heute stempelt das keine Karte), sperrt den Wirker – sonst nicht.
      const rechte = { beschwoeren: true, ausruesten: true, abilities: true };
      await lauf('Kontrollrechte `zauber:false, attacken:false` gestempelt', (t) => { t.gs.players[1].heroes[2]._kontrollRechte = { ...rechte, zauber: false, attacken: false }; }, DB[n].cardType === 'Creature');
      await lauf('Kontrollrecht `beschwoeren:false` gestempelt' + (v === 'dauerhaft' ? ' (dauerhaft zählt wie ein eigener: nur zauber/attacken sind sperrbar)' : ''), (t) => { t.gs.players[1].heroes[2]._kontrollRechte = { ...rechte, beschwoeren: false }; }, v === 'dauerhaft' || DB[n].cardType !== 'Creature');
      // Held ohne Schule
      { const t = await H.fresh({ hand: [[], []], deckSize: 20, hp: 800 });
        await uebernehmen(t, v, 0, 1, 2);
        const k = t.engine._rxCastKandidaten(t.gs.players[0], n, H.loadCardEffect(n), zielOpts(n));
        R.check(`${v}, ${n}: übernommener Held OHNE Schule → kein Wirker`, !hatKand(k, 1, 2) || DB[n].level === 0 || !DB[n].level, k); }
      // der Besitzer wirkt mit dem abgegebenen Helden nicht
      { const t = await H.fresh({ hand: [[], []], deckSize: 20, hp: 800 });
        t.grantFor(1, 2, n); await uebernehmen(t, v, 0, 1, 2);
        const k = t.engine._rxCastKandidaten(t.gs.players[1], n, H.loadCardEffect(n), zielOpts(n));
        R.check(`${v}, ${n}: der BESITZER (Sitz 1) wirkt mit dem abgegebenen Helden nicht`, !hatKand(k, 1, 2), k); }
    }
  }

  // ═══ Teil 2 · Surprises in der Zone des übernommenen Helden ═══
  for (const v of ['dauerhaft', 'temporaer']) {
    R.section(`Teil 2 (${v}): ${SURPRISE.length} Surprise-Karten – der Kontrolleur aktiviert sie am übernommenen Helden (Zone geht mit dem Helden mit)`);
    let ok = 0, nok = [], sammlerFehl = [];
    for (const n of SURPRISE) {
      const t = await H.fresh({ hand: [[], []], deckSize: 20, hp: 800 });
      t.grantFor(1, 2, n);
      t.putSurprise(1, 2, n);
      await uebernehmen(t, v, 0, 1, 2);
      const kann = t.engine._canHeroActivateSurprise(1, 2, n, { reaktor: 0 });
      if (kann) ok++; else nok.push(n);
      const kannBesitzer = t.engine._canHeroActivateSurprise(1, 2, n, { reaktor: 1 });
      if (kannBesitzer) sammlerFehl.push(n);
    }
    R.check(`${v}: der Kontrolleur (Sitz 0) darf jede Surprise am übernommenen Helden auslösen`, nok.length === 0, nok);
    R.check(`${v}: der Besitzer (Sitz 1) darf keine auslösen, solange der Gegner den Helden kontrolliert`, sammlerFehl.length === 0, sammlerFehl);
    R.note(`${v}: ${ok} Surprises geprüft`, ok);
  }

  // ═══ Teil 3 · Artefakt-/Trank-Reaktionen: kein Wirker nötig ═══
  R.section(`Teil 3: ${ARTREAK.length} Artefakt-/Trank-Reaktionen brauchen keinen Helden (jeder Spieler, auch wenn alle seine Helden fremd/übernommen sind)`);
  { const nok = [];
    for (const n of ARTREAK) {
      const t = await H.fresh({ hand: [[], []], deckSize: 20, hp: 800 });
      const k = t.engine._rxCastKandidaten(t.gs.players[0], n, H.loadCardEffect(n), {});
      if (k !== null) nok.push(n);
    }
    R.check('alle: `_rxCastKandidaten` == null (kein Wirker verlangt)', nok.length === 0, nok); }

  // ═══ Teil 4 · Ausrüstungs-Reaktion: Bow of the Hunt Goddess am übernommenen Helden ═══
  const BOW = 'Bow of the Hunt Goddess';
  for (const v of ['eigen', 'dauerhaft', 'temporaer']) {
    R.section(`Teil 4 (${v}): ${BOW} am ${v === 'eigen' ? 'eigenen' : 'übernommenen'} Helden – der Angriff des Trägers bietet dem Kontrolleur den Pfeil aus dem Deck an`);
    const t = await H.fresh({ hand: [['Attack'], []], deck: [['Flame Arrow', 'Poisoned Arrow', 'ZZ Dummy', 'ZZ Dummy', 'ZZ Dummy'], undefined], gold: [100, 100] });
    const traeger = v === 'eigen' ? { seite: 0, hi: 0 } : { seite: 1, hi: 2 };
    t.put(traeger.seite, traeger.hi, 0, BOW);
    if (v !== 'eigen') await uebernehmen(t, v, 0, 1, 2);
    t.policy.confirm = true;
    t.script.push({ match: d => d.type === 'cardGallery' && /Bow/.test(d.title || ''), answer: () => ({ cardName: 'Flame Arrow', source: 'deck' }), once: true });
    t.targetFn = (valid) => [valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === (v === 'eigen' ? 0 : 0)).id];
    const hp0 = t.hp(1, 0);
    const r = await t.play(0, 'Attack', v === 'eigen' ? { hero: 0 } : { hero: 2, charmedOwner: 1 });
    const gal = t.prompts.some(p => p.pi === 0 && p.d.type === 'cardGallery' && /Bow/.test(p.d.title || ''));
    R.check(`${v}: Attack gespielt`, r === true, r);
    R.check(`${v}: Pfeil-Galerie des Bow wurde dem Kontrolleur angeboten`, gal, t.prompts.map(p => p.d.type + ':' + p.d.title));
    R.check(`${v}: Flame Arrow gewirkt (liegt in der Ablage, 5 Gold bezahlt)`, t.pile(0, 'discardPile').includes('Flame Arrow') && t.gs.players[0].gold === 95, { d: t.pile(0, 'discardPile'), g: t.gs.players[0].gold });
    R.check(`${v}: keine Engine-Fehler, Zustand sauber`, sauber(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})();
