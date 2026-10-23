'use strict';
// W63a-06 · Reincarnation (Kreaturen-Modus) + Transfer Alice (Al, 22.10.2026, Rueckfrage 5 aus Welle 62)
//
// Kartentext: „Place 2 Pollution Tokens into your free Support Zones to use this Spell. Choose a defeated Hero and revive it … OR choose a level 4 or lower Creature from your discard pile and place it
//              into the free Support Zone of a Hero you control."
// Al: „Der Kreaturen-Modus ist spielbar mit 3 freien Zonen ODER (Alices Effekt aktiv und eine geteilte Zone fuer die Kreatur verfuegbar) mit 2 freien Zonen fuer die Tokens + der geteilten Zone.
//      Spielbarkeit, Zonenwahl und Platzierung muessen zusammenpassen — auch fuer die CPU."
// Szene (je Sitz): Held 0 / Zone A = [Cute Bunny] (Stapel gleichnamiger Kreaturen), in der Ablage ein Cute Bunny (Level 0); Held 1 = Alice. Freie Zonen:
//   1 zwei freie (Held 0 / Slot 2+3) + geteilte Zone    → spielbar; Bunny in Zone A (x2), die 2 Pollution Tokens in die 2 freien Zonen
//   2 zwei freie, OHNE Alice                            → NICHT spielbar (3 freie Zonen noetig)
//   3 zwei freie + Alice, aber KEINE gleichnamige Kopie auf dem Brett → NICHT spielbar
//   4 eine freie + geteilte Zone                        → NICHT spielbar (die 2 Tokens brauchen 2 freie Zonen)
//   5 drei freie + Alice                                → spielbar; Mensch darf frei waehlen: die geteilte Zone steht VORN, die freie Zone bleibt waehlbar; CPU nimmt die geteilte
//   6 Alice gefallen / abgezogen (Schalter)             → wie mit Alice (spielbar)
// Beide Sitze, Mensch- und CPU-Pfad. Exit 0 = korrekt.
const L = require('../../lib/alice-brett.js');
const { H, brett, zoneA, instIn, ohneStapel, gesamt, sicher } = L;
const RE = require('../../../../cards/effects/reincarnation.js');
const CB = 'Cute Bunny', TOKEN = 'Pollution Token';
const sauber = (t) => t.errors.length === 0 && ohneStapel(t).length === 0;
const tokens = (t, s) => t.inst(c => c.zone === 'support' && c.owner === s && c.name === TOKEN).length;
const spielbar = (t, s) => !!RE.spellPlayCondition(t.gs, s, t.engine);

/** frei: Anzahl freier Zonen von Held 0 (Slot 2, 3) plus optional eine bei Held 2. */
async function szene(seat, o) {
  const zonen = [o.mitKopie === false ? ['Cute Dog'] : [CB]];
  if (o.frei >= 1) zonen[1] = [];
  if (o.frei >= 2) zonen[2] = [];
  const t = await brett(seat, { hand: ['Reincarnation'], discard: [CB], alice: o.alice, fuellen: true, zonen, frei2: o.frei >= 3 ? 0 : undefined });
  t.setAbilities(seat, 0, [['Support Magic', 'Support Magic'], [], []]);
  return t;
}
const frei = (t, s) => t.engine.getFreeSupportZones(s).length;

(async () => {
  const R = H.runner();
  for (const s of [0, 1]) {
    for (const mensch of [false, true]) {
      const pfad = mensch ? 'Mensch' : 'CPU';
      const vorbereiten = (t, zone) => {
        if (mensch) t.engine.isCpuPlayer = () => false;
        t.zonenAngebote = [];
        t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Reincarnation', answer: () => ({ optionId: 'restore' }) });
        t.script.push({ match: d => d.type === 'cardGallery', answer: () => ({ cardName: CB, source: 'discard' }) });
        t.script.push({ match: d => d.type === 'zonePick', answer: (d) => {
          t.zonenAngebote.push(d.zones.map(z => `${z.owner}:${z.heroIdx}/${z.slotIdx}${z.shared ? 's' : ''}`));
          const q = zone === 'frei' ? (d.zones.find(z => !z.shared) || d.zones[0]) : d.zones[0];
          return { heroIdx: q.heroIdx, slotIdx: q.slotIdx, owner: q.owner };
        } });
      };

      R.section(`Sitz ${s} (${pfad}): 2 freie Zonen + geteilte Zone → spielbar`);
      {
        const t = await szene(s, { frei: 2, alice: true });
        R.check('Vorbedingung: genau 2 freie Zonen', frei(t, s) === 2, frei(t, s));
        R.check('spellPlayCondition: spielbar', spielbar(t, s) === true);
        vorbereiten(t);
        const r = await t.play(s, 'Reincarnation', { hero: 0 });
        R.check('Zauber wird gespielt', r === true, sicher(r));
        R.check('Cute Bunny steht im Stapel von Zone A (x2, 2 Instanzen)', zoneA(t, s).length === 2 && instIn(t, s, 0, 0, CB) === 2, { a: zoneA(t, s), pr: t.prompts.map(p => p.d.type) });
        R.check('beide Pollution Tokens liegen in den 2 freien Zonen (Held 0, Slot 2 und 3)', tokens(t, s) === 2 && zoneA(t, s, 0, 1)[0] === TOKEN && zoneA(t, s, 0, 2)[0] === TOKEN, { t: tokens(t, s), z1: zoneA(t, s, 0, 1), z2: zoneA(t, s, 0, 2) });
        R.check('die Bunny-Karte ist aus der Ablage', !t.pile(s, 'discardPile').includes(CB), t.pile(s, 'discardPile'));
        R.check('sauber', sauber(t), { e: t.errors, a: ohneStapel(t) });
      }

      R.section(`Sitz ${s} (${pfad}): Gegenproben (nicht spielbar)`);
      for (const [bez, o] of [
        ['2 freie Zonen OHNE Alice', { frei: 2, alice: false }],
        ['2 freie Zonen + Alice, aber keine gleichnamige Kopie auf dem Brett', { frei: 2, alice: true, mitKopie: false }],
        ['nur 1 freie Zone + geteilte Zone (Tokens brauchen 2)', { frei: 1, alice: true }],
        ['Alice nur beim Gegner (2 freie)', { frei: 2, alice: 'gegner' }],
      ]) {
        const t = await szene(s, o);
        R.check(`${bez}: nicht spielbar`, spielbar(t, s) === false);
        vorbereiten(t);
        const vor = gesamt(t, s);
        const r = await t.play(s, 'Reincarnation', { hero: 0 });
        R.check(`${bez}: echtes Ausspielen wird verweigert, Brett unveraendert`, r !== true && gesamt(t, s) === vor && tokens(t, s) === 0, { r: sicher(r), vor, nach: gesamt(t, s) });
      }

      R.section(`Sitz ${s} (${pfad}): Alices Effekt bleibt (gefallen / nur Schalter) → spielbar mit 2 freien Zonen`);
      for (const [bez, alice] of [['Alice gefallen', 'tot'], ['Alice abgezogen (Schalter)', 'flagge']]) {
        const t = await szene(s, { frei: 2, alice });
        R.check(`${bez}: spielbar`, spielbar(t, s) === true);
        vorbereiten(t);
        const r = await t.play(s, 'Reincarnation', { hero: 0 });
        R.check(`${bez}: Bunny im Stapel, 2 Tokens`, r === true && zoneA(t, s).length === 2 && tokens(t, s) === 2, { r: sicher(r), a: zoneA(t, s), tok: tokens(t, s) });
      }

      R.section(`Sitz ${s} (${pfad}): 3 freie Zonen + geteilte Zone → geteilte Zone vorn, freie Zone bleibt waehlbar`);
      {
        const t = await szene(s, { frei: 3, alice: true });
        R.check('Vorbedingung: 3 freie Zonen', frei(t, s) === 3, frei(t, s));
        R.check('spielbar', spielbar(t, s) === true);
        vorbereiten(t);
        const r = await t.play(s, 'Reincarnation', { hero: 0 });
        R.check('Zauber wird gespielt', r === true, sicher(r));
        R.check('Standardwahl (CPU / erster Eintrag): geteilte Zone A, Stapel x2', zoneA(t, s).length === 2 && instIn(t, s, 0, 0, CB) === 2, { a: zoneA(t, s), ang: t.zonenAngebote });
        if (mensch) R.check('Mensch: die Zonenwahl bot die geteilte Zone vorn UND mindestens eine freie Zone an', t.zonenAngebote.filter(a => a.some(z => z.endsWith('s'))).length === 1 && t.zonenAngebote.some(a => a[0] === `${s}:0/0s` && a.some(z => !z.endsWith('s'))), t.zonenAngebote);
        R.check('beide Tokens liegen in freien Zonen (2 Stueck)', tokens(t, s) === 2, tokens(t, s));
        R.check('sauber', sauber(t), { e: t.errors, a: ohneStapel(t) });
      }
      if (mensch) {
        const t = await szene(s, { frei: 3, alice: true });
        vorbereiten(t, 'frei');
        const vorG = gesamt(t, s);
        const r = await t.play(s, 'Reincarnation', { hero: 0 });
        R.check('Mensch waehlt die FREIE Zone: Bunny dort (Zone A bleibt bei 1), beide Tokens in den uebrigen freien Zonen', r === true && zoneA(t, s).length === 1 && instIn(t, s, 0, 0, CB) === 1 && tokens(t, s) === 2 && gesamt(t, s) === vorG + 3, { a: zoneA(t, s), tok: tokens(t, s), r: sicher(r), ang: t.zonenAngebote });
        R.check('sauber', sauber(t), { e: t.errors, a: ohneStapel(t) });
      }

      R.section(`Sitz ${s} (${pfad}): 3 freie Zonen OHNE Alice → wie bisher (erste freie Zone)`);
      {
        const t = await szene(s, { frei: 3, alice: false });
        R.check('spielbar', spielbar(t, s) === true);
        vorbereiten(t);
        const r = await t.play(s, 'Reincarnation', { hero: 0 });
        R.check('Bunny in einer freien Zone, Zone A unveraendert (1), 2 Tokens', r === true && zoneA(t, s).length === 1 && tokens(t, s) === 2 && instIn(t, s, 0, 0, CB) === 1, { a: zoneA(t, s), tok: tokens(t, s), r: sicher(r) });
        R.check('sauber', sauber(t), { e: t.errors, a: ohneStapel(t) });
      }
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('ABSTURZ ' + (e && e.stack) + '\n'); process.exit(1); });
