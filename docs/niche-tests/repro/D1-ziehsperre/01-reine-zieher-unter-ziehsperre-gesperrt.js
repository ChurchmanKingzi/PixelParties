'use strict';
// D1-01 · Reine Zieh-Aktivierungen sind unter Zieh-Sperre (drawLocked) UND Hand-Sperre (handLocked) nicht aktivierbar/spielbar –
//         ohne Kosten und ohne Einmal-Stempel zu verbrauchen.
//
// Regel von Al (verbindlich): Unter einer Zieh-Sperre darf eine Aktivierung weiterhin gespielt werden, solange NICHT der komplette
// Effekt nur Ziehen ist. Gesperrt (ausgegraut) sind nur Aktivierungen, deren ganzer Nutzen das Ziehen ist und deren Kosten nur der
// Preis fürs Ziehen sind (Gold, Zähler, "Zug-Nachteil" wie "danach abwerfen" / "danach nicht mehr ziehen" / "Aktionsphase überspringen").
// Gegenstück (Mischeffekte bleiben aktivierbar): 02-mischeffekte-unter-ziehsperre-aktivierbar.js.
// Messung: nach dem Versuch ist der Zustand (Einmal-Stempel, Hand, Ablage, Gelöscht, Gold, Deck, Zähler, Ladungen) unverändert.
const H = require('../../lib/h.js');
const F = H.INERT.filler;
const KENT = 'Kent, the Indebted Apprentice', MP = 'Debt-O-Tron Model Money Printer';
const snap = (t) => JSON.stringify({
  hopt: t.gs.hoptUsed, hand: t.pile(0, 'hand'), disc: t.pile(0, 'discardPile'), del: t.pile(0, 'deletedPile'),
  gold: t.gs.players[0].gold, deck: t.pile(0, 'mainDeck').length, pd: t.gs.players[0].potionDeck?.length,
  skip: t.gs.players[0]._skipActionPhaseTurn, perms: (t.gs.players[0].permanents || []).map(p => p._usedThisTurn),
  ctr: t.inst(i => i.owner === 0 && i.zone !== 'hand').map(i => [i.name, JSON.stringify(i.counters)]),
});
const putC = (t, hi, slot, name, o) => { const i = t.put(0, hi, slot, name, o); i.turnPlayed = 1; return i; };
const gold = (t) => t.gs.players[0].gold;
const mid = (t) => { t.gs.activePlayer = 0; t.phase(2); };

// [Name, Aufbau(opts) -> opts für H.fresh, nach dem Aufbau(t), Aktion(t)]
const FAELLE = [
  ['Gigantisaur Raptoren (Ziehen = Anzahl Gigantisaurs)', {}, (t) => { putC(t, 0, 0, 'Gigantisaur Raptoren'); putC(t, 1, 0, 'Gigantisaur Spinor'); }, (t) => { mid(t); return t.activateCreature(0, 0, 0); }],
  ['Skeleton Mage (zieh 2, danach 1 abwerfen)', {}, (t) => { putC(t, 0, 0, 'Skeleton Mage'); }, (t) => { mid(t); return t.activateCreature(0, 0, 0); }],
  ['Populated Island Turtle (zieh bis 10)', {}, (t) => { putC(t, 0, 0, 'Populated Island Turtle'); }, (t) => { mid(t); return t.activateCreature(0, 0, 0); }],
  ['Rebelliokai Timid Tanuki (zieh nach Ablage-Namen)', { discard: [['Rebelliokai Backup Bakus', 'Rebelliokai Timid Tanuki'], []] }, (t) => { putC(t, 0, 0, 'Rebelliokai Timid Tanuki'); }, (t) => { mid(t); return t.activateCreature(0, 0, 0); }],
  ['Nimble Monkee (8 Invest Counter -> zieh 2)', {}, (t) => { putC(t, 0, 0, 'Nimble Monkee'); t.gs.players[0].heroes[0]._investCounters = 8; }, (t) => { mid(t); return t.activateCreature(0, 0, 0); }],
  ['Clever Puppet Saras (zieh 4, danach 1 abwerfen)', { hand: [[F], []] }, (t) => { putC(t, 0, 0, 'Clever Puppet Saras'); }, (t) => { mid(t); return t.activateCreature(0, 0, 0); }],
  ['Waflav (Evolution Counter -> zieh 3; keine anderen Wahlen)', { heroes: [['Waflav, the Metamorphing Monstrosity', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[F], []] }, (t) => { t.gs.players[0].heroes[0]._evolutionCounters = 2; }, (t) => t.activateHero(0, 0, { effect: 'Waflav, the Metamorphing Monstrosity', phase: 2 })],
  ['Sparkfly Queen, Architect-Modus (zieh bis zur Gegnerhand)', { hand: [[F], [F, F, F, F, F]] }, (t) => { const q = putC(t, 0, 0, 'Sparkfly Queen'); q.counters._sparkflyGifts = { architect: true }; q.counters._sparkflyQueenModeUsed = { main: t.gs.turn }; }, (t) => { mid(t); return t.activateCreature(0, 0, 0); }],
  ['Kazena (zieh bis 7, danach Zieh-Sperre)', { heroes: [['Kazena, the Storming Rebel', H.BLANK_HEROES[1], H.BLANK_HEROES[2]], null], hand: [[F, F], []] }, () => {}, (t) => t.activateHero(0, 0, { effect: 'Kazena, the Storming Rebel', phase: 2 })],
  ['Charm of Balance (zieh = Balance-Zähler)', { hand: [[F], []] }, (t) => { t.put(0, 0, 0, 'Charm of Balance', { counters: { balance: 2 } }).turnPlayed = 1; }, (t) => t.activateEquip(0, 0, 0)],
  ['Alchemy Lv1 (8 Gold -> Zug aus dem Potion Deck)', { hand: [[F], []], potionDeck: [Array(3).fill('Healing Potion'), []], gold: 100, abilities: { 0: { 0: [['Alchemy'], [], []] } } }, () => {}, (t) => { mid(t); return t.run(() => t.host.doActivateFreeAbility(t.room, 0, { heroIdx: 0, zoneIdx: 0 })); }],
  ['Debt-O-Tron Money Printer (Überziehung -> zieh)', { hand: [['Future Tech Gun'], []], gold: [0, 100], deck: [Array(10).fill(H.INERT.creature), []] }, (t) => { t.setHero(0, 0, KENT, 400); t.mp = putC(t, 0, 2, MP); }, async (t) => { await t.play(0, 'Future Tech Gun', { hero: 0 }); }, 'printer'],
  ['Divine Gift of Balance (zieh bis zur Gegnerhand)', { hand: [[F], [F, F, F, F, F]] }, (t) => { t.gs.players[0].permanents = [{ name: 'Divine Gift of Balance', id: 'p1' }]; }, async (t) => {   // doActivatePermanent ist nicht exportiert: das Tor des Servers (canActivatePermanent) + Effekt von Hand
      mid(t); const sc = H.loadCardEffect('Divine Gift of Balance'); const perm = t.gs.players[0].permanents[0];
      if (sc.canActivatePermanent(t.gs, 0, 0, t.engine)) await t.run(() => sc.onActivatePermanent(t.engine, 0, 0, perm));
    }],
  ['Heart of the Mountain (zieh = Brennende)', { hand: [['Heart of the Mountain'], []], gold: 100 }, (t) => { t.heroStatus(1, 0, 'burned'); }, (t) => t.play(0, 'Heart of the Mountain'), 'hand'],
  ['Elixir of Quickness (zieh 3)', { hand: [['Elixir of Quickness'], []] }, () => {}, (t) => t.play(0, 'Elixir of Quickness'), 'hand'],
  ['Potion of Greed (zieh 2, Aktionsphase überspringen)', { hand: [['Potion of Greed'], []], potionDeck: [Array(5).fill('Healing Potion'), []] }, () => {}, (t) => t.play(0, 'Potion of Greed', { phase: 2 }), 'hand'],
  ['Ice Sculpture Garden (zieh = Gefrorene, danach Sperre)', { hand: [['Ice Sculpture Garden', F], []] }, (t) => { t.heroStatus(1, 0, 'frozen'); }, (t) => t.play(0, 'Ice Sculpture Garden', { hero: 0 }), 'hand'],
  ['Voice in your Head (zieh bis 7 + Zusatzaktion)', { hand: [['Voice in your Head', F], []] }, (t) => { t.setHero(0, 0, 'Arthor, Inheritor of the Barbarian Sword', 600); }, (t) => t.play(0, 'Voice in your Head', { hero: 0 }), 'hand'],
];

(async () => {
  const R = H.runner();
  for (const sperre of ['keine', 'drawLocked', 'handLocked']) {
    for (const [name, opts, aufbau, aktion, art] of FAELLE) {
      const t = await H.fresh({ deckSize: 12, ...opts });
      aufbau(t);
      if (sperre !== 'keine') t.gs.players[0][sperre] = true;
      const vor = snap(t);
      let ladungVor = null;
      if (art === 'printer') ladungVor = H.loadCardEffect(MP).remainingCharges(t.mp, t.gs).remaining;
      const r = await aktion(t);
      let ok = snap(t) === vor;
      let info = { r, vorher: vor === snap(t) ? 'gleich' : snap(t).slice(0, 400) };
      if (art === 'printer') {
        const gefragt = t.prompts.some(p => /Draw 1 card/.test(p.d.message || ''));
        const ladung = H.loadCardEffect(MP).remainingCharges(t.mp, t.gs).remaining;
        ok = !gefragt && ladung === ladungVor;
        info = { gefragt, ladung, ladungVor };
      } else if (art === 'hand') {
        // gesperrt = Karte bleibt auf der Hand, nichts abgelegt/gelöscht
        ok = t.pile(0, 'hand').includes(opts.hand[0][0]) && t.pile(0, 'discardPile').length === 0 && t.pile(0, 'deletedPile').length === 0;
        info.hand = t.pile(0, 'hand');
      }
      if (sperre === 'keine') {   // Kontrolle: ohne Sperre läuft die Aktivierung (sonst misst die Probe nichts)
        const lief = art === 'printer' ? info.gefragt === true : (art === 'hand' ? !t.pile(0, 'hand').includes(opts.hand[0][0]) : snap(t) !== vor);
        R.check(`${name} OHNE Sperre: läuft (Kontrolle)`, lief, info);
        continue;
      }
      R.check(`${name} unter ${sperre}: nicht aktivierbar, nichts bezahlt/gestempelt`, ok, info);
      R.check(`${name} unter ${sperre}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    }
  }
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
