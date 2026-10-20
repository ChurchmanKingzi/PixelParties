'use strict';
// W27a · Entscheidung Al (21.10.2026): „Nein, nimm das Ruling zurück. Das neue allgemeine Ruling lautet 'Attachments liegen bei Frozen/Stunned nicht still'."
// Das Welle-8-Ruling (Frage 2: Prophecy-Umleitung läuft nicht unter Freeze/Stun) ist ZURÜCKGENOMMEN: Spell-Anhängsel (Untertyp Attachment) wirken bei Frozen/Stunned/Negated
// des Trägers weiter. Geprüft: (a) Prophecy of Tempeste leitet Helden- UND Kreaturenschaden um, mit Rückfrage, Deckel 100 (Zustände frozen, stunned, negiert hart/leicht);
// (b) Prayer (Klick-Effekt eines Anhängsels) bleibt bei gefrorenem/betäubtem Träger aktivierbar (Webbed: W29a – Al: „Webbed negiert NICHT Attachments!" – sperrt ebenfalls nicht mehr; Repro W29/a-03);
// (c) statische Gegenprobe: kein Anhangs-Skript liest einen Ruhe-Prüfer des Wirts.
// Aufruf: node docs/niche-tests/repro/W27/a-01-attachments-liegen-bei-frozen-stunned-nicht-still.js   (Exit 0 = korrekt)
const fs = require('fs');
const path = require('path');
const H = require('../../lib/h.js');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const ZUSTAENDE = [['ohne Status', null], ['gefroren', (t) => t.heroStatus(0, 0, 'frozen')], ['betäubt', (t) => t.heroStatus(0, 0, 'stunned')],
  ['negiert (hart)', (t) => t.heroStatus(0, 0, 'negated')], ['negiert (Effekt)', (t) => t.heroStatus(0, 0, 'negated', { appliedTurn: 0, effectOnly: true })]];

async function szene(set) {
  const t = await H.fresh({ hand: [['Prophecy of Tempeste'], []], hp: 800 });
  t.grantFor(0, 0, 'Prophecy of Tempeste');
  t.targetFn = (valid) => [(valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0) || valid[0]).id];
  await t.play(0, 'Prophecy of Tempeste', { hero: 0, noGrant: true });
  t.policy.confirm = true;                                     // „Redirect!" bestätigen
  if (set) set(t);
  t.reset();
  return t;
}

(async () => {
  const R = H.runner();

  // (a) Prophecy of Tempeste
  for (const [name, set] of ZUSTAENDE) {
    R.section(`Prophecy of Tempeste, Wirt ${name}`);
    {   // Heldenschaden an einen ANDEREN eigenen Helden
      const t = await szene(set);
      await t.run(() => t.engine.actionDealDamage({ name: 'T', owner: 1, heroIdx: 0 }, t.hero(0, 1), 60, 'normal'));
      await wait(900);
      R.check('Held: Schaden wird auf den Wirt umgeleitet (Wirt 740, Held 1 unversehrt)', t.hp(0, 1) === 800 && t.hp(0, 0) === 740, { held1: t.hp(0, 1), wirt: t.hp(0, 0) });
      R.check('Held: Rückfrage erschien', t.prompts.length >= 1, t.prompts.length);
      R.check('Held: keine Engine-Fehler', t.errors.length === 0, t.errors);
    }
    {   // Schaden an eine eigene KREATUR
      const t = await szene(set);
      const c = t.put(0, 1, 0, H.INERT.creature);
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'T', owner: 1, heroIdx: 0 }, c, 60, 'spell'));
      await wait(900);
      R.check('Kreatur: Schaden wird auf den Wirt umgeleitet', t.hp(0, 0) === 740 && (c.counters.currentHp ?? 200) === 200, { wirt: t.hp(0, 0), kreatur: c.counters.currentHp });
      R.check('Kreatur: keine Engine-Fehler', t.errors.length === 0, t.errors);
    }
    {   // Deckel 100 und „einmal pro Zug"
      const t = await szene(set);
      await t.run(() => t.engine.actionDealDamage({ name: 'T', owner: 1, heroIdx: 0 }, t.hero(0, 1), 300, 'normal'));
      await wait(900);
      R.check('umgeleiteter Schaden wird auf 100 gedeckelt', 800 - t.hp(0, 0) === 100 && t.hp(0, 1) === 800, { wirt: t.hp(0, 0), held1: t.hp(0, 1) });
      await t.run(() => t.engine.actionDealDamage({ name: 'T', owner: 1, heroIdx: 0 }, t.hero(0, 1), 60, 'normal'));
      await wait(500);
      R.check('einmal pro Zug: der zweite Treffer wird nicht mehr umgeleitet', t.hp(0, 1) === 740, t.hp(0, 1));
      R.check('Deckel gegen den Wirt gilt', (await t.engine.actionDealDamage({ name: 'T', owner: 1 }, t.hero(0, 0), 300, 'normal'), 800 - 100 - t.hp(0, 0) === 100), t.hp(0, 0));
    }
  }

  // (b) Prayer: Klick-Effekt eines Anhängsels am gefrorenen/betäubten Träger
  for (const [name, status, soll] of [['ohne Status', null, true], ['gefroren', 'frozen', true], ['betäubt', 'stunned', true], ['negiert', 'negated', true], ['verwebt (Webbed)', 'webbed', true]]) {
    R.section(`Prayer, Träger ${name}`);
    const t = await H.fresh({ hand: [['Prayer', 'Fighting', 'Fighting'], []], hp: 800, phase: 2 });
    t.targetFn = (valid) => { const h = valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 0); return [(h || valid[0]).id]; };
    await t.play(0, 'Prayer', { hero: 0, phase: 3 }); t.phase(2);
    if (status) t.heroStatus(0, 0, status);
    t.script.push({ match: d => d.type === 'handPick', answer: (d) => ({ selectedCards: d.eligibleIndices.map(i => ({ handIndex: i, cardName: t.pile(0, 'hand')[i] })) }) });
    t.policy.confirm = false;
    const liste = t.engine.getActivatableEquips(0).filter(e => e.cardName === 'Prayer');
    R.check(`getActivatableEquips ${soll ? 'bietet Prayer an (canActivate)' : 'bietet Prayer nicht an'}`, soll ? (liste.length === 1 && liste[0].canActivate) : liste.length === 0, liste);
    const hand0 = t.pile(0, 'hand').length;
    await t.activateEquip(0, 0, 0);
    const abgeworfen = t.pile(0, 'discardPile').filter(c => c === 'Fighting').length;
    R.check(`Server-Tor: Prayer ${soll ? 'wirkt (2 Abilities abgeworfen, 2 gezogen)' : 'bleibt gesperrt'}`, soll ? (abgeworfen === 2 && t.pile(0, 'hand').length === hand0) : abgeworfen === 0, { abgeworfen, hand: [hand0, t.pile(0, 'hand').length] });
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  // (c) statisch: kein Anhangs-Skript benutzt einen Ruhe-Prüfer des Wirts
  {
    R.section('statische Gegenprobe: Anhangs-Skripte ohne Ruhe-Prüfung');
    const cards = require('../../../../data/cards.json');
    const arr = Array.isArray(cards) ? cards : Object.values(cards);
    const dir = path.join(__dirname, '../../../../cards/effects');
    const namen = arr.filter(c => String(c.subtype || '').toLowerCase() === 'attachment').map(c => c.name);
    let geprueft = 0; const verstoesse = [];
    for (const n of namen) {
      const f = path.join(dir, n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.js');
      if (!fs.existsSync(f)) continue;
      geprueft++;
      const src = fs.readFileSync(f, 'utf8').split('\n').filter(l => !/^\s*(\/\/|\*)/.test(l)).join('\n');
      if (/_isHeroEffectSilenced|isCardPassiveDormant|isHeroPassiveDormant|_isHeroAbilityPassiveSilenced/.test(src)) verstoesse.push(n);
    }
    R.check(`${geprueft} Anhangs-Skripte: keiner fragt einen Ruhe-Prüfer`, geprueft >= 20 && verstoesse.length === 0, { geprueft, verstoesse });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
