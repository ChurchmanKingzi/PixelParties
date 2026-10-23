'use strict';
// W63b-03 · Card Game Player Inya: Zauber mit AUSSTEHENDER Wirkung OHNE Instanzbindung (Spielerstempel, Pile-Marker, Permanents) laufen mit Token wie ohne — Token überlebt oder stirbt
//
// Das ist die „Instant-Kill, der später feuert"-Lesart von Als Meldung: **Hand of Death** („If the user is not defeated, Frozen or Stunned at the end of your opponent's next turn, you may
//   choose any target and defeat it. … skip your next turn.") ist der einzige Zauber, dessen „defeat" NACH dem Auflösen (Ende des nächsten gegnerischen Zuges) geschieht. Der Auftrag liegt
//   am SPIELER (`ps._handOfDeathArmed`), die Ablage-Instanz ist nur Lauscher; Welle 14 (Q171) hat `nachholenOhneKarte` ergänzt (läuft am Zugende auch ohne Karte in der Ablage). Mit Inya liegt die
//   Karte nie in der Ablage → dieser Rückweg muss tragen. Dazu: Teleportal (Karte „openly in front of you", Rückholung zum nächsten Zugbeginn: `ps.permanents` + Instanz in `permanent`) und
//   Trial of Knowledge (Marker-Instanz in der Ablage, „levels of all Trial of Spells become 0 for the rest of the game").
// Erwartet: Ergebnis mit Inya (Token überlebt / Token stirbt) == Ergebnis ohne Inya (== Kartentext). Beide Sitze. Gegenproben: Nutzer eingefroren → kein Defeat (wie ohne Inya).
// Exit 0 = korrekt.
const H = require('../../lib/h.js');
const IN = 'Card Game Player Inya';

async function brett(seat, inya, hand, o = {}) {
  const eigene = [inya ? IN : H.BLANK_HEROES[0], H.BLANK_HEROES[1], H.BLANK_HEROES[2]];
  const heroes = seat === 0 ? [eigene, null] : [null, eigene];
  const h = [[], []]; h[seat] = hand;
  const t = await H.fresh({ heroes, hand: h, turn: 5, active: seat, deckSize: 20, ...(o.deck ? { deck: o.deck } : {}) });
  let ja = 1;
  t.script.push({ match: (d) => d.type === 'confirm' && d.title === IN, answer: () => ({ confirmed: ja-- > 0 }) });
  return t;
}
const buddy = (t) => t.inst(c => c.counters && c.counters._fantasyBuddyToken && c.zone === 'support')[0] || null;
async function tokenWeg(t, wie, seat) {
  const b = buddy(t); if (!b) return;
  if (wie === 'tot') await t.run(() => t.engine.actionDestroyCard({ name: 'X', owner: 1 - seat }, b));
}

// ── Hand of Death ──
async function hod(seat, inya, wie, o = {}) {
  const opp = 1 - seat;
  const t = await brett(seat, inya, ['Hand of Death']);
  const ziel = t.put(opp, 0, 0, H.INERT.creature);
  t.targetFn = (v) => {
    const x = o.ziel === 'held' ? v.find(q => q.type === 'hero' && q.owner === opp && q.heroIdx === 0) : v.find(q => q.owner === opp && q.type === 'equip' && q.slotIdx === 0);
    return x ? [x.id] : undefined;
  };
  await t.play(seat, 'Hand of Death', { hero: 0 });
  await tokenWeg(t, wie, seat);
  const out = { geladen: !!t.gs.players[seat]._handOfDeathArmed };
  await t.endTurn();                                    // Ende des eigenen Zuges: noch nichts
  if (o.eingefroren) t.heroStatus(seat, 0, 'frozen');    // der Nutzer ist am Ende des Gegnerzuges eingefroren
  out.nachEigenemZug = o.ziel === 'held' ? t.hp(opp, 0) > 0 : t.inst(c => c.id === ziel.id && c.zone === 'support').length === 1;
  await t.endTurn();                                    // Ende des GEGNERZUGES: der Defeat
  out.besiegt = o.ziel === 'held' ? t.hp(opp, 0) <= 0 : t.inst(c => c.id === ziel.id && c.zone === 'support').length === 0;
  out.verbraucht = !t.gs.players[seat]._handOfDeathArmed;
  out.zugUebersprungen = !!t.gs.players[seat]._skipNextTurn || t.lg('hand_of_death_skip_turn').length > 0;
  out.einmal = t.lg('hand_of_death_resolved').length <= 1;
  out.fehler = t.errors.length;
  return { out, t };
}

// ── Teleportal: gesuchte Karte kommt zum nächsten eigenen Zugbeginn auf die Hand ──
async function teleportal(seat, inya, wie) {
  const t = await brett(seat, inya, ['Teleportal'], { deck: [['Rockfall', 'Meteor Crash', 'Fireball', 'Slow'], ['ZZ Dummy']].concat([]).slice(0, 2).map((d, i) => i === seat ? d : ['ZZ Dummy']) });
  if (seat === 1) t.setDeck(1, ['Rockfall', 'Meteor Crash', 'Fireball', 'Slow']);
  else t.setDeck(0, ['Rockfall', 'Meteor Crash', 'Fireball', 'Slow']);
  t.script.push({ match: (d) => d.type === 'cardGallery', answer: () => ({ cardName: 'Fireball' }) });
  await t.play(seat, 'Teleportal', { hero: 0 });
  await tokenWeg(t, wie, seat);
  const out = { offenVorSich: t.gs.players[seat].permanents.some(p => !!p) && !t.gs.players[seat].hand.includes('Fireball') };
  await t.endTurn(); await t.endTurn();                  // Gegnerzug, dann wieder eigener Zug
  out.aufDerHand = t.gs.players[seat].hand.includes('Fireball');
  out.nichtMehrOffen = t.gs.players[seat].permanents.length === 0;
  out.fehler = t.errors.length;
  return { out, t };
}

// ── Trial of Knowledge: Stufen aller „Trial of"-Zauber werden 0 (Marker-Instanz) ──
async function trial(seat, inya, wie) {
  const t = await brett(seat, inya, ['Trial of Knowledge']);
  const stufe = () => t.engine.effectiveCardLevel(t.engine._getCardDB()['Trial of Coolness'], seat, {});
  const out = { vorher: stufe() };
  await t.play(seat, 'Trial of Knowledge', { hero: 0 });
  await tokenWeg(t, wie, seat);
  out.nachher = stufe();
  await t.endTurn(); await t.endTurn();
  out.einenZugSpaeter = stufe();
  out.fehler = t.errors.length;
  return { out, t };
}

const FAELLE = [
  ['Hand of Death · Kreaturenziel', (s, i, w) => hod(s, i, w), { geladen: true, nachEigenemZug: true, besiegt: true, verbraucht: true, zugUebersprungen: true, einmal: true, fehler: 0 }],
  ['Hand of Death · Heldenziel', (s, i, w) => hod(s, i, w, { ziel: 'held' }), { geladen: true, nachEigenemZug: true, besiegt: true, verbraucht: true, zugUebersprungen: true, einmal: true, fehler: 0 }],
  ['Hand of Death · Nutzer eingefroren (kein Defeat)', (s, i, w) => hod(s, i, w, { eingefroren: true }), { geladen: true, nachEigenemZug: true, besiegt: false, verbraucht: true, zugUebersprungen: false, einmal: true, fehler: 0 }],
  ['Teleportal', teleportal, { offenVorSich: true, aufDerHand: true, nichtMehrOffen: true, fehler: 0 }],
  ['Trial of Knowledge', trial, { vorher: 1, nachher: 0, einenZugSpaeter: 0, fehler: 0 }],
];

(async () => {
  const R = H.runner();
  for (const seat of [0, 1]) {
    for (const [name, fn, soll] of FAELLE) {
      R.section(`── Sitz ${seat} · ${name} ──`);
      const ohne = await fn(seat, false, 'lebt');
      R.check(`[S${seat}] ${name} · Kontrolle ohne Inya == Kartentext`, JSON.stringify(ohne.out) === JSON.stringify(soll), { ist: ohne.out, soll });
      for (const wie of ['lebt', 'tot']) {
        const m = await fn(seat, true, wie);
        R.check(`[S${seat}] ${name} · Inya, Token ${wie === 'lebt' ? 'überlebt' : 'stirbt (vor der Auslösung)'}: Wirkung == ohne Token`, JSON.stringify(m.out) === JSON.stringify(ohne.out), { mit: m.out, ohne: ohne.out });
      }
    }
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
