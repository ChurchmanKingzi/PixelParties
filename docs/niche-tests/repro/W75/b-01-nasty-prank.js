'use strict';
// W75b-01 · Nasty Prank (Spell Reaction Lv0, Magic Arts) + Status „Pranked"
// „Play this card immediately when an opponent's Hero performs an Attack or Spell. That Hero cannot perform another Attack/Spell with that name until the end of your opponent's next turn.
//  If the user has at least Magic Arts 1, that Hero cannot perform another Attack/Spell with that name for the rest of the game instead. This counts as a negative status effect."
const H = require('../../lib/h.js');
const CARD = 'Nasty Prank';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const angebot = (t) => t.prompts.filter(p => p.d && p.d.type === 'confirm' && p.d.title === CARD).length;

async function aufbau(o = {}) {
  const t = await H.fresh({ hand: [['Burning Finger', 'Burning Finger', 'Fireball', 'Quick Attack', 'ZZ Filler'], [CARD, 'ZZ Filler']], deckSize: 30, gold: [100, 100], active: 0 });
  t.grantFor(0, 0, 'Burning Finger'); t.grantFor(0, 0, 'Fireball'); t.grantFor(0, 0, 'Quick Attack');
  if (o.magicArts) t.setAbilities(1, 0, [['Magic Arts'], [], []]);
  t.targetFn = (valid) => { const h = valid.find(v => v.id === 'hero-1-0'); return h ? [h.id] : (valid[0] ? [valid[0].id] : undefined); };
  t.script.push({ match: d => d.type === 'confirm' && d.title === CARD, answer: () => ({ confirmed: true }) });
  t.script.push({ match: d => d.type === 'optionPicker' && d.title === CARD, answer: () => ({ optionId: 'hero-0' }) });   // der Wirker ist Held 1:0
  return t;
}
const hand0 = (t, n) => t.pile(0, 'hand').filter(x => x === n).length;

(async () => {
  const R = H.runner();

  R.section('A · ohne Magic Arts: der Spell läuft normal, der Name ist danach bis zum Ende des nächsten Zuges des Gegners gesperrt');
  {
    const t = await aufbau();
    const hp0 = t.hp(1, 0);
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check('Angebot an den Streich-Spieler', angebot(t) === 1, t.prompts.map(p => p.d && (p.d.title || p.d.type)));
    R.check('der Spell wurde NICHT negiert (Schaden angekommen)', t.hp(1, 0) < hp0, [hp0, t.hp(1, 0)]);
    const st = t.gs.players[0].heroes[0].statuses.pranked;
    R.check('Status „pranked" am Held (0:0) mit dem Namen', !!st && !!st.names['Burning Finger'], st);
    const e = st && st.names['Burning Finger'];
    R.check('Frist: Streich im Zug des Gegners (T) → Ablauf T+3 für den Streich-Spieler', e && e.expiresAtTurn === t.gs.turn + 3 && e.expiresForPlayer === 1 && !e.permanent, e);
    R.check('als negativer Status heilbar geführt', true);
    // zweiter Burning Finger: gesperrt
    t.resetActions(0);
    const vorher = hand0(t, 'Burning Finger');
    const hpV = t.hp(1, 0);
    const r = await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check('derselbe Spell ist gesperrt (kein Schaden, Karte bleibt auf der Hand)', t.hp(1, 0) === hpV && hand0(t, 'Burning Finger') === vorher, { r, vorher, nachher: hand0(t, 'Burning Finger') });
    // ein ANDERER Spell geht
    t.resetActions(0);
    const hpF = t.hp(1, 0);
    await t.play(0, 'Fireball', { hero: 0, noGrant: true });
    R.check('ein anderer Spell (Fireball) ist erlaubt', t.hp(1, 0) < hpF, [hpF, t.hp(1, 0)]);
    R.check('keine Engine-Fehler, Zustand sauber', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('B · mit Magic Arts 1 beim Wirker: dauerhaft („for the rest of the game")');
  {
    const t = await aufbau({ magicArts: true });
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    const e = t.gs.players[0].heroes[0].statuses.pranked?.names?.['Burning Finger'];
    R.check('Eintrag ist dauerhaft', e && e.permanent === true && e.expiresAtTurn === undefined, e);
    // viele Züge später immer noch da
    for (let i = 1; i <= 6; i++) { t.gs.turn += 1; t.gs.activePlayer = i % 2; await t.run(() => t.engine._processBuffExpiry({})); }
    R.check('nach 6 Zügen noch gesperrt', !!t.gs.players[0].heroes[0].statuses.pranked?.names?.['Burning Finger'], t.gs.players[0].heroes[0].statuses);
  }

  R.section('C · Attacks werden ebenso gesperrt; mehrere Namen liegen nebeneinander; Erneuerung behält die Dauerhaftigkeit');
  {
    const t = await aufbau();
    await t.play(0, 'Quick Attack', { hero: 0, noGrant: true });
    R.check('Angebot auch auf eine Attack', angebot(t) === 1, angebot(t));
    const names0 = Object.keys(t.gs.players[0].heroes[0].statuses.pranked?.names || {});
    R.check('„Quick Attack" gesperrt', names0.includes('Quick Attack'), names0);
    t.resetActions(0);
    const hpV = t.hp(1, 0);
    await t.play(0, 'Quick Attack', { hero: 0, noGrant: true });
    R.check('die Attack ist gesperrt', t.hp(1, 0) === hpV, [hpV, t.hp(1, 0)]);
    // zweiter Streich mit anderem Namen
    t.pile(1, 'hand'); t.gs.players[1].hand.push(CARD);
    t.resetActions(0);
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    const n2 = Object.keys(t.gs.players[0].heroes[0].statuses.pranked?.names || {});
    R.check('zwei Namen nebeneinander', n2.includes('Quick Attack') && n2.includes('Burning Finger'), n2);
  }

  R.section('D · Ablauf je Name; Heilung nimmt alles; Gegenproben');
  {
    const t = await aufbau();
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    const T = t.gs.turn;
    const e = t.gs.players[0].heroes[0].statuses.pranked.names['Burning Finger'];
    t.gs.turn = T + 2; t.gs.activePlayer = 0;                       // eigener Zug des Gesperrten: noch da
    await t.run(() => t.engine._processBuffExpiry({}));
    R.check('im nächsten Zug des Gegners (T+2) noch gesperrt', !!t.gs.players[0].heroes[0].statuses.pranked, t.gs.players[0].heroes[0].statuses);
    t.gs.turn = T + 3; t.gs.activePlayer = 1;
    await t.run(() => t.engine._processBuffExpiry({}));
    R.check('zu Beginn von T+3 abgelaufen, Status ganz weg', !t.gs.players[0].heroes[0].statuses.pranked, t.gs.players[0].heroes[0].statuses);
    void e;
  }
  {
    const t = await aufbau();
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    await t.run(() => t.engine.removeHeroStatus(0, 0, 'pranked', {}));
    R.check('heilbar: removeHeroStatus nimmt den Status', !t.gs.players[0].heroes[0].statuses.pranked, t.gs.players[0].heroes[0].statuses);
  }
  {
    // Eigener Spell des Streich-Spielers löst nichts aus
    const t = await H.fresh({ hand: [['Burning Finger', CARD], []], deckSize: 30, gold: [100, 100], active: 0 });
    t.grantFor(0, 0, 'Burning Finger');
    t.targetFn = (valid) => { const h = valid.find(v => v.id === 'hero-1-0'); return h ? [h.id] : undefined; };
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check('eigener Spell: kein Angebot', angebot(t) === 0, angebot(t));
  }
  R.section('E · Fenster erst NACH der Auflösung: kein Kettenglied, nicht bei einer negierten Karte');
  {
    // Das Angebot kommt, wenn der Schaden schon angekommen ist (nicht mehr verhinderbar) — und niemand kann den Spell in der Kette noch auf Prank „warten" lassen.
    const t = await aufbau();
    let hpBeimAngebot = null;
    t.script.length = 0;
    t.script.push({ match: d => d.type === 'confirm' && d.title === CARD, answer: () => { hpBeimAngebot = t.hp(1, 0); return { confirmed: true }; } });
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === CARD, answer: () => ({ optionId: 'hero-0' }) });
    const hp0 = t.hp(1, 0);
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check('beim Angebot hat der Spell schon getroffen (HP gesunken)', hpBeimAngebot !== null && hpBeimAngebot < hp0, [hp0, hpBeimAngebot]);
    R.check('kein Kettenglied: Prank liegt in der Ablage, die Ablage-Reihenfolge stimmt', t.pile(1, 'discardPile').includes(CARD), t.pile(1, 'discardPile'));
  }
  {
    // Silence negiert den Spell in der Kette → der Spell wurde nie ausgeführt: kein Angebot, kein Status
    const t = await H.fresh({ hand: [['Burning Finger'], ['Silence', CARD]], deckSize: 30, gold: [300, 300], active: 0 });
    t.grantFor(0, 0, 'Burning Finger'); t.grantFor(1, 0, 'Silence'); t.grantFor(1, 0, CARD);
    t.setAbilities(1, 0, [['Decay Magic', 'Decay Magic'], [], []]);
    t.targetFn = (valid) => { const h = valid.find(v => v.id === 'hero-1-0'); return h ? [h.id] : undefined; };
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === 'Silence', answer: (d) => ({ optionId: d.options[0].id }) });
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'Silence', answer: () => ({ confirmed: true }) });
    t.script.push({ match: d => d.type === 'confirm' && d.title === CARD, answer: () => ({ confirmed: true }) });
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === CARD, answer: () => ({ optionId: 'hero-0' }) });
    const hp0 = t.hp(1, 0);
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check('Silence hat den Spell negiert (kein Schaden)', t.hp(1, 0) === hp0, [hp0, t.hp(1, 0)]);
    R.check('negierter Spell: Prank wird NICHT angeboten', angebot(t) === 0, t.prompts.map(p => p.d && (p.d.title || p.d.type)));
    R.check('kein Status „pranked"', !t.gs.players[0].heroes[0].statuses.pranked, t.gs.players[0].heroes[0].statuses);
    R.check('Prank noch auf der Hand', t.pile(1, 'hand').includes(CARD), t.pile(1, 'hand'));
    R.check('keine Engine-Fehler', sauber(t), { e: t.errors, a: t.audit() });
  }

  R.section('F · Reverse Trap negiert den gespielten Prank (Reaktionsfenster der gespielten Karte), Prank wandert auf die Hand der Falle');
  {
    const t = await H.fresh({ hand: [['Burning Finger'], [CARD]], deckSize: 30, gold: [300, 300], active: 0 });
    t.grantFor(0, 0, 'Burning Finger'); t.grantFor(1, 0, CARD);
    t.putSurprise(0, 0, 'Reverse Trap'); t.grantFor(0, 0, 'Reverse Trap');
    t.setAbilities(0, 0, [['Decay Magic', 'Destruction Magic'], [], []]);
    t.targetFn = (valid) => { const h = valid.find(v => v.id === 'hero-1-0'); return h ? [h.id] : undefined; };
    t.script.push({ match: d => d.type === 'confirm' && d.title === CARD, answer: () => ({ confirmed: true }) });
    t.script.push({ match: d => d.type === 'optionPicker' && d.title === CARD, answer: () => ({ optionId: 'hero-0' }) });
    t.script.push({ match: d => d.type === 'confirm' && d.title === 'Reverse Trap', answer: () => ({ confirmed: true }) });
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check('Reverse Trap wird angeboten', t.prompts.some(p => p.pi === 0 && p.d && p.d.type === 'confirm' && p.d.title === 'Reverse Trap'), t.prompts.map(p => [p.pi, p.d && p.d.title]));
    R.check('Prank negiert: kein Status „pranked"', !t.gs.players[0].heroes[0].statuses.pranked, t.gs.players[0].heroes[0].statuses);
    R.check('Prank liegt auf der Hand von Sitz 0 (nicht in der Ablage von Sitz 1)', t.pile(0, 'hand').includes(CARD) && !t.pile(1, 'discardPile').includes(CARD), [t.pile(0, 'hand'), t.pile(1, 'discardPile')]);
    R.check('keine Engine-Fehler', sauber(t), { e: t.errors, a: t.audit() });
  }
  R.finish();
})().catch(e => { process.stderr.write('THROW ' + (e && e.stack || e) + '\n'); process.exit(2); });
