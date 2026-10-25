'use strict';
// W76e-01 · Uncool Malfunction (Artifact Normal, Cost 0)
// „Name an Ability. Your opponent cannot activate the active effect of Abilities with that name during their next turn."
const H = require('../../lib/h.js');
const CARD = 'Uncool Malfunction', TRADE = 'Trade';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const frei = (t, seat, hi, zi) => { t.gs.activePlayer = seat; t.phase(2); return t.run(() => t.host.doActivateFreeAbility(t.room, seat, { heroIdx: hi, zoneIdx: zi })); };
const gold = (t, s) => t.gs.players[s].gold;

async function aufbau(o = {}) {
  const t = await H.fresh({ hand: [[CARD, 'ZZ Filler'], []], deckSize: 30, gold: [100, 100], active: 0 });
  t.setAbilities(1, 0, [[TRADE], [], []]);
  t.setAbilities(1, 2, [[TRADE], [], []]);                       // zweite Kopie an einem anderen Helden
  if (o.besiegt) t.hero(1, 2).hp = 0;                            // … die am besiegten Helden liegt
  t.setAbilities(0, 0, [[TRADE], [], []]);                       // eigene Kopie des Spielers: bleibt frei
  t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cardName: o.name || TRADE }) });
  return t;
}
async function spiele(t) {
  t.policy.confirm = true;
  await t.play(0, CARD, { noAutoConfirm: true });
  const pt = t.gs.potionTargeting;
  if (pt) await t.run(() => t.host.doConfirmPotion(t.room, 0, { selectedIds: [] }));
  t.policy.confirm = false;
}

(async () => {
  const R = H.runner();

  R.section('A · Namenspicker: nur Abilities mit AKTIVEM Effekt; Abbruch verbraucht nichts');
  {
    const t = await aufbau();
    let liste = null;
    t.script.length = 0;
    t.script.push({ match: d => d.type === 'cardNamePicker', answer: (d) => { liste = d.cardNames; return { cardName: TRADE }; } });
    await spiele(t);
    R.check('Picker bekam eine Liste', Array.isArray(liste) && liste.length > 5, liste && liste.length);
    R.check('Trade / Alchemy (aktive Effekte) stehen drin', liste.includes('Trade') && liste.includes('Alchemy'), liste.slice(0, 8));
    R.check('Passive Abilities (Toughness, Resistance) stehen NICHT drin', !liste.includes('Toughness') && !liste.includes('Resistance'), liste.filter(n => /Tough|Resist/.test(n)));
    R.check('Keine Nicht-Abilities (Fireball, Held)', !liste.includes('Fireball') && !liste.includes(H.BLANK_HEROES[0]), liste.filter(n => /Fireball/.test(n)));
    R.check('Karte liegt in der Ablage', t.pile(0, 'discardPile').includes(CARD), t.pile(0, 'discardPile'));
  }
  {
    const t = await aufbau();
    t.script.length = 0;
    t.script.push({ match: d => d.type === 'cardNamePicker', answer: () => ({ cancelled: true }) });
    await spiele(t);
    R.check('Abbruch: keine Sperre, Karte nicht verbraucht', !t.gs.players[1]._abilityNameLocks && t.pile(0, 'hand').includes(CARD), [t.gs.players[1]._abilityNameLocks, t.pile(0, 'hand')]);
  }

  R.section('B · Sperre im nächsten Zug des Gegners (Trade gesperrt), danach wieder frei');
  {
    const t = await aufbau();
    await spiele(t);
    const lock = t.gs.players[1]._abilityNameLocks && t.gs.players[1]._abilityNameLocks[TRADE];
    R.check('Sperre am Gegner eingetragen (Frist = Zug + 2)', !!lock && lock.expiresAtTurn === t.gs.turn + 2 && lock.expiresForPlayer === 0, lock);
    R.check('eigene Trade-Kopie des Spielers bleibt frei', t.engine._abilityNegatedOnHero(0, 0, TRADE) === false);
    await t.endTurn();
    R.check('Zug des Gegners: Aktivierung gesperrt (Held 1:0)', t.engine._abilityNegatedOnHero(1, 0, TRADE) === true);
    const g = gold(t, 1);
    await frei(t, 1, 0, 0);
    R.check('… kein Gold gewonnen (Trade lief nicht)', gold(t, 1) === g, [g, gold(t, 1)]);
    R.check('… auch die zweite Kopie (1:2) ist gesperrt', t.engine._abilityNegatedOnHero(1, 2, TRADE) === true);
    R.check('andere Ability (Alchemy) bleibt frei', t.engine._abilityNegatedOnHero(1, 0, 'Alchemy') === false);
    await t.endTurn();    // Zug des Spielers
    await t.endTurn();    // der nächste Zug des Gegners
    R.check('übernächster Gegnerzug: Sperre abgelaufen', t.engine._abilityNegatedOnHero(1, 0, TRADE) === false && !(t.gs.players[1]._abilityNameLocks || {})[TRADE], t.gs.players[1]._abilityNameLocks);
    R.check('keine Engine-Fehler, Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  {
    // Gegenprobe: ohne die Karte läuft Trade im Gegnerzug und bringt 5 Gold
    const t = await aufbau();
    await t.endTurn();
    const g = gold(t, 1);
    await frei(t, 1, 0, 0);
    R.check('Gegenprobe ohne Sperre: Trade bringt +5 Gold', gold(t, 1) === g + 5, [g, gold(t, 1)]);
  }

  R.section('C · Aktivierung ohne Sperre läuft (Gegenprobe) und die Sperre ist an den NAMEN gebunden');
  {
    const t = await aufbau({ name: 'Alchemy' });
    await spiele(t);
    await t.endTurn();
    R.check('Alchemy genannt: Trade (anderer Name) ist frei', t.engine._abilityNegatedOnHero(1, 0, TRADE) === false);
    R.check('… und Alchemy gesperrt', t.engine._abilityNegatedOnHero(1, 0, 'Alchemy') === true);
  }

  R.section('D · Animation: Qualm auf JEDER Kopie des Gegners — auch am besiegten Helden; nicht auf eigenen');
  {
    const t = await aufbau({ besiegt: true });
    await spiele(t);
    const rauch = t.evs('play_zone_animation').filter(e => e.type === 'uncool_smoke');
    R.check('Qualm auf beiden Kopien des Gegners (1:0 und 1:2 [besiegt])', rauch.length === 2 && rauch.some(e => e.owner === 1 && e.heroIdx === 0 && e.zoneSlot === 0) && rauch.some(e => e.owner === 1 && e.heroIdx === 2 && e.zoneSlot === 0), rauch);
    R.check('… nicht auf der eigenen Kopie', !rauch.some(e => e.owner === 0), rauch);
    R.check('der Gegner sieht die genannte Ability (card_reveal)', t.evs('card_reveal').some(e => e.cardName === TRADE), t.evs('card_reveal'));
  }

  R.section('E · Gegner im Erstrunden-Schutz: nicht spielbar (trifft nur ihn)');
  {
    const t = await aufbau();
    t.gs.firstTurnProtectedPlayer = 1;
    const r = await t.play(0, CARD, { noAutoConfirm: true });
    R.check('unspielbar, Karte bleibt auf der Hand', t.pile(0, 'hand').includes(CARD) && !t.gs.players[1]._abilityNameLocks, r);
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
