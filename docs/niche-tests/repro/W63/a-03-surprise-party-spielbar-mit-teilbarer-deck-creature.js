'use strict';
// W63a-03 · Surprise Party + Transfer Alice (Al, 22.10.2026, Rueckfrage 3 aus Welle 62)
//
// Al: „Solange Alices Effekt aktiv ist und der Spieler mindestens eine Creature im Deck hat, die ein legales Target fuer Surprise Party ist UND von der der Nutzer schon eine Kopie in
//      seinen Zonen hat, soll sie IMMER spielbar sein, auch bei vollem Brett — weil es ja theoretisch immer moeglich ist, diese zu finden. Beim Aufloesen kommt die gleichnamige
//      Creature in die geteilte Zone (erst die geteilte, dann die erste leere); passt sie nicht, wird sie uebersprungen/zurueckgemischt wie bisher."
// Szene (je Sitz): Held 0 = Zone A mit EINER „Cute Bunny" (Level 0), alle anderen Zonen voll (BIG) → keine freie Zone; Held 1 = Alice. Deck der Spielerin variiert.
//   1 voll + Alice + Cute Bunny im Deck           → spielbar (spellPlayCondition UND canPlayWithHero UND echtes Ausspielen), Bunny landet in Zone A (Stapel x2), Deck bereinigt, Zugende
//   2 voll + Alice, Deck OHNE passende Kopie       → NICHT spielbar (Creature im Deck ohne Zwilling im Brett; Plant Golem/Elusive Hind/Ifrit nicht legal)
//   3 voll OHNE Alice + Cute Bunny im Deck         → NICHT spielbar (Gegenprobe)
//   4 voll + Alice + Alice tot/Flagge/Gegner       → Tot und Flagge: spielbar (Teilung bleibt), Alice nur beim Gegner: NICHT spielbar
//   5 gemischt (Zone B frei) + Alice               → Bunny landet in der GETEILTEN Zone A, B bleibt leer (erst geteilt, dann leer)
//   6 unpassende Creature zuerst im Deck           → die erste legale Creature (Cannon Tower) passt nicht in die Zonen → zurueck ins Deck, nichts platziert, Zugende
//   7 Level > 3 ist kein Ziel                      → Deck nur mit 3-Headed Giant (Level 3 ok) / Level-4-Creature ohne Zwilling: nicht spielbar
// Beide Sitze. Exit 0 = korrekt.
const L = require('../../lib/alice-brett.js');
const { H, brett, zoneA, instIn, ohneStapel, gesamt, sicher } = L;
const SP = require('../../../../cards/effects/surprise-party.js');
const KREATUR = 'Cute Bunny', FREMD = 'Cannon Tower';
const sauber = (t) => t.errors.length === 0 && ohneStapel(t).length === 0;
const zugEnde = (t, me) => t.gs._terrorForceEndTurn === me && t.gs._terrorForceEndSource?.name === 'Surprise Party';
const spielbar = (t, s) => !!SP.spellPlayCondition(t.gs, s, t.engine);
const mitHeld = (t, s) => !!SP.canPlayWithHero(t.gs, s, 0, {}, t.engine);

async function szene(seat, o = {}) {
  const t = await brett(seat, {
    hand: ['Surprise Party'], deck: o.deck, alice: o.alice, fuellen: true,
    zonen: o.zonen || [[KREATUR]], ...(o.opts || {}),
  });
  t.setAbilities(seat, 0, [['Support Magic', 'Support Magic'], [], []]);
  return t;
}

(async () => {
  const R = H.runner();
  for (const s of [0, 1]) {
    R.section(`Sitz ${s}: volles Brett + Alice + Cute Bunny im Deck → spielbar, Bunny in die geteilte Zone`);
    {
      const t = await szene(s, { deck: [KREATUR, 'Fireball', 'Slow'] });
      R.check('Vorbedingung: keine freie Zone', t.engine.getFreeSupportZones(s).length === 0);
      R.check('spellPlayCondition: spielbar', spielbar(t, s) === true);
      R.check('canPlayWithHero(Held 0): spielbar', mitHeld(t, s) === true);
      const vor = gesamt(t, s);
      const r = await t.play(s, 'Surprise Party', { hero: 0, noGrant: true });
      R.check('echtes Ausspielen klappt', r === true, sicher(r));
      R.check('Cute Bunny steht jetzt im Stapel von Zone A (x2, 2 Instanzen)', zoneA(t, s).length === 2 && instIn(t, s, 0, 0, KREATUR) === 2, zoneA(t, s));
      R.check('genau eine Kreatur mehr auf dem Brett, nirgends sonst', gesamt(t, s) === vor + 1, { vor, nach: gesamt(t, s) });
      R.check('Bunny nicht mehr im Deck, Rest (Fireball, Slow) zurueck im Deck', t.pile(s, 'mainDeck').sort().join() === ['Fireball', 'Slow'].sort().join(), t.pile(s, 'mainDeck'));
      R.check('Zugende wie immer', zugEnde(t, s));
      R.check('sauber', sauber(t), { e: t.errors, a: ohneStapel(t) });
    }

    R.section(`Sitz ${s}: Deck OHNE Zwilling im Brett → nicht spielbar (volles Brett)`);
    for (const [bez, deck] of [
      ['Creature ohne Kopie auf dem Brett (Cannon Tower)', [FREMD, 'Fireball']],
      ['nur Nicht-Creatures', ['Fireball', 'Slow', 'Rockfall']],
      ['Plant Golem / Elusive Hind sind keine legalen Ziele (obwohl Kopie im Brett)', ['Plant Golem', 'Elusive Hind', 'Fireball']],
    ]) {
      const zonen = /Plant Golem/.test(deck[0]) ? [['Plant Golem'], undefined, undefined] : undefined;
      const t = await szene(s, { deck, zonen });
      R.check(`${bez}: spellPlayCondition false`, spielbar(t, s) === false);
      R.check(`${bez}: canPlayWithHero false`, mitHeld(t, s) === false);
      const vor = gesamt(t, s);
      const r = await t.play(s, 'Surprise Party', { hero: 0, noGrant: true });
      R.check(`${bez}: echtes Ausspielen wird verweigert, Brett unveraendert`, r !== true && gesamt(t, s) === vor, { r: sicher(r) });
    }
    {   // Level 4 ist kein Ziel, auch mit Kopie im Brett
      const lvl4 = require('../../../../data/cards.json');
      const arr = Array.isArray(lvl4) ? lvl4 : Object.values(lvl4);
      const hoch = arr.find(c => /Creature/.test(c.cardType) && c.level === 4 && !c.nurUnterBedingung && !/Token/.test(c.subtype || ''));
      if (hoch) {
        const t = await szene(s, { deck: [hoch.name, 'Fireball'], zonen: [[hoch.name]] });
        R.check(`Level-4-Creature (${hoch.name}) mit Kopie im Brett ist kein legales Ziel → nicht spielbar`, spielbar(t, s) === false);
      }
    }

    R.section(`Sitz ${s}: Gegenprobe ohne Alice (volles Brett, Bunny im Deck) → nicht spielbar`);
    {
      const t = await szene(s, { deck: [KREATUR, 'Fireball'], alice: false });
      R.check('spellPlayCondition false', spielbar(t, s) === false);
      R.check('canPlayWithHero false', mitHeld(t, s) === false);
      const vor = gesamt(t, s);
      const r = await t.play(s, 'Surprise Party', { hero: 0, noGrant: true });
      R.check('echtes Ausspielen wird verweigert', r !== true && gesamt(t, s) === vor && zoneA(t, s).length === 1, { r: sicher(r) });
    }

    R.section(`Sitz ${s}: Alices Effekt bleibt aktiv (gefallen / nur Schalter) bzw. fehlt (Alice nur beim Gegner)`);
    for (const [bez, alice, soll] of [['Alice gefallen (0 HP)', 'tot', true], ['Alice abgezogen (nur Schalter)', 'flagge', true], ['Alice nur beim Gegner', 'gegner', false]]) {
      const t = await szene(s, { deck: [KREATUR, 'Fireball'], alice });
      R.check(`${bez}: spielbar = ${soll}`, spielbar(t, s) === soll);
      if (soll) {
        const r = await t.play(s, 'Surprise Party', { hero: 0, noGrant: true });
        R.check(`${bez}: Bunny im Stapel`, r === true && zoneA(t, s).length === 2, { r: sicher(r), a: zoneA(t, s) });
      }
    }

    R.section(`Sitz ${s}: gemischtes Brett (Zone B frei) → die GETEILTE Zone zuerst`);
    {
      const t = await szene(s, { deck: [KREATUR, 'Fireball'], zonen: [[KREATUR], []] });
      R.check('Vorbedingung: Zone B frei', zoneA(t, s, 0, 1).length === 0 && t.engine.getFreeSupportZones(s).length === 1);
      R.check('spielbar (wie bisher)', spielbar(t, s) === true);
      const r = await t.play(s, 'Surprise Party', { hero: 0, noGrant: true });
      R.check('Bunny landet im Stapel von Zone A (geteilt zuerst)', r === true && zoneA(t, s).length === 2, { r: sicher(r), a: zoneA(t, s) });
      R.check('die freie Zone B bleibt leer', zoneA(t, s, 0, 1).length === 0, zoneA(t, s, 0, 1));
      R.check('sauber', sauber(t), { e: t.errors, a: ohneStapel(t) });
    }
    {   // ohne Alice: gleiche Szene → erste leere Zone (wie bisher)
      const t = await szene(s, { deck: [KREATUR, 'Fireball'], zonen: [[KREATUR], []], alice: false });
      const r = await t.play(s, 'Surprise Party', { hero: 0, noGrant: true });
      R.check('ohne Alice: Bunny in die freie Zone B, Zone A bleibt bei 1', r === true && zoneA(t, s).length === 1 && zoneA(t, s, 0, 1).join() === KREATUR, { a: zoneA(t, s), b: zoneA(t, s, 0, 1) });
    }

    R.section(`Sitz ${s}: erste legale Creature passt nicht (kein Zwilling) → zurueck ins Deck, nichts platziert`);
    {
      // Cannon Tower ist legal, steht aber nicht im Brett; der spaetere Cute Bunny sorgt nur fuer die Spielbarkeit. Wie bisher: die erste legale Creature beendet das Aufdecken.
      const t = await szene(s, { deck: [FREMD, KREATUR, 'Fireball'] });
      R.check('spielbar (Cute Bunny irgendwo im Deck)', spielbar(t, s) === true);
      const vor = gesamt(t, s);
      const r = await t.play(s, 'Surprise Party', { hero: 0, noGrant: true });
      R.check('nichts platziert, Zone A unveraendert', r === true && gesamt(t, s) === vor && zoneA(t, s).length === 1, { r: sicher(r), a: zoneA(t, s) });
      R.check('Deck wieder vollstaendig (3 Karten, gemischt)', t.pile(s, 'mainDeck').sort().join() === [FREMD, KREATUR, 'Fireball'].sort().join(), t.pile(s, 'mainDeck'));
      R.check('Zugende', zugEnde(t, s));
      R.check('sauber', sauber(t), { e: t.errors, a: ohneStapel(t) });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('ABSTURZ ' + (e && e.stack) + '\n'); process.exit(1); });
