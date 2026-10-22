'use strict';
// W50a · Punkt 2 · Al, 22.10.2026: „Der Equip-Artifact-Teil sollte bei Ceremony genauso funktionieren wie bei Fridge. Ceremony hat einfach nur zusätzlich noch mehr."
// Dazu (Ergänzung): Fridge ("… equip them to a different Hero the same player controls") bewegt Artifacts zwischen zwei Heroes EINES BELIEBIGEN Spielers (auch des Gegners);
// Ceremony nur zwischen zwei eigenen Heroes.
// Gemeinsamer Baustein: cards/effects/_equip-shared.js (istUmhaengbaresEquip, umhaengZielHelden, fuehreUmhaengenAus).
// Geprüft (beide Sitze): (1) Ceremony-Equip öffnet das Equip-Fenster (Afflicted Pests) wie Fridge; Ceremony-ANHÄNGSEL (Energy Aura) bleibt still (unverändert);
// (2) Boni wandern mit, nichts wird bezahlt, Fridge/Ceremony liefern dasselbe Endbild; (3) Crusader's-Einschränkung und "1 X je Held"-Grenze gelten gleich;
// (4) immovable-Equip bleibt liegen; (5) Zonensperre/versiegelte Zone zählt nicht als frei (beide); (6) Equip-Hooks: Leave/Enter/On-Play mit _isMove;
// (7) Fridge auf GEGNERISCHE Helden: Equips des Gegners wandern zwischen den Gegner-Helden, Pests-Fenster mit dem Ausführenden als Ausrüstendem;
// (8) Ceremony wählt nie gegnerische Helden. Exit 0 = korrekt.
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const PESTS = 'Afflicted Pests';
const F = 'Slippery Fridge', C = 'Inheritance Ceremony';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const pestsGefragt = (t) => t.prompts.some(p => /Afflicted Pests/.test(JSON.stringify(p.d)));
const pestsAktiv = (t) => pestsGefragt(t) || t.inst(c => c.name === PESTS && c.zone === 'support').length > 0;
const stuetz = (t, s, hi) => (t.gs.players[s].supportZones[hi] || []).flat();
const wo = (t, s, n) => [0, 1, 2].filter(hi => stuetz(t, s, hi).includes(n));

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me + ' (Gegner Sitz ' + op + ')');
    const opts = (hand, extra = {}) => ({ hand: [0, 1].map(i => i === me ? hand : []), gold: 500, deckSize: 30, ...(me ? { active: 1 } : {}), ...extra });
    // Pests-Wahl: den Dummy opfern, nicht die umgehängte Karte
    const pestsBei = (t, seat) => {
      t.putSurprise(seat, 0, PESTS); t.grantFor(seat, 0, PESTS); t.put(seat, 0, 0, H.INERT.creature);
      const vorher = t.targetFn;
      t.targetFn = (v, cfg) => (cfg && cfg.title === PESTS) ? [(v.find(x => x.cardName === H.INERT.creature) || v[0]).id] : (vorher ? vorher(v, cfg) : undefined);
    };
    const wahlFuer = (t, name, nachHeld) => {
      t.targetFn = (v, cfg) => {
        const ti = (cfg && cfg.title) || '';
        if (ti === PESTS) return [(v.find(x => x.cardName === H.INERT.creature) || v[0]).id];
        if (ti === F) { const e = v.filter(x => x.type === 'equip' && (name ? x.cardName === name : true)); return e.map(x => x.id); }
        if (ti === C && v.some(x => x.type === 'equip')) return v.filter(x => name ? x.cardName === name : true).map(x => x.id);
        if (/Slippery Fridge — Move|Inheritance Ceremony/.test(ti) || v.some(x => x.type === 'hero')) { const h = v.find(x => x.type === 'hero' && x.heroIdx === nachHeld) || v.find(x => x.type === 'equip' && x.heroIdx === nachHeld); return h ? [h.id] : undefined; }
        return undefined;
      };
    };
    const aufbauEigen = async (equips, zusatz = [], extra = {}) => {
      const t = await H.fresh(opts([...equips.map(e => e[0]), ...zusatz], extra));
      for (const [n, hi, slot] of equips) await t.play(me, n, { hero: hi ?? 0, slot: slot ?? 0 });
      return t;
    };

    // (1) Ceremony-EQUIP öffnet Pests wie die Fridge
    for (const [name, karte] of [['Fridge', F], ['Ceremony', C]]) {
      const t = await aufbauEigen([['Club of Gobbo', 0, 0]], [karte]);
      pestsBei(t, op); t.reset();
      const vorher = t.targetFn;
      wahlFuer(t, 'Club of Gobbo', 1);
      const r = await t.play(me, karte, { hero: 0 });
      R.check(name + ': Club of Gobbo von Held 0 → Held 1 umgehängt', r === true && wo(t, me, 'Club of Gobbo').join() === '1', { r, w: wo(t, me, 'Club of Gobbo') });
      R.check(name + ': Equip-Fenster (Afflicted Pests des Gegners) öffnet', pestsAktiv(t), t.prompts.map(p => p.d.type));
      R.check(name + ': sauber', sauber(t), { e: t.errors, a: t.audit() });
      void vorher;
    }
    // Gegenprobe: Ceremony-ANHÄNGSEL bleibt still (unverändert, Vorgabe 12.10.)
    { const t = await aufbauEigen([], ['Energy Aura', C]);
      t.script.push({ match: d => d.type === 'confirm' && !/Afflicted Pests/.test(JSON.stringify(d)), answer: () => ({ confirmed: true }) });
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0).id];
      await t.play(me, 'Energy Aura', { hero: 0 });
      pestsBei(t, op); t.reset();
      wahlFuer(t, 'Energy Aura', 1);
      const r = await t.play(me, C, { hero: 0 });
      R.check('Ceremony-Anhängsel (Energy Aura) wird umgehängt', r === true && wo(t, me, 'Energy Aura').join() === '1', { r, w: wo(t, me, 'Energy Aura') });
      R.check('Ceremony-Anhängsel: Pests öffnet NICHT (Anhängsel-Teil unverändert)', !pestsAktiv(t), t.prompts.map(p => p.d.type)); }
    // Gemischt: Equip + Anhängsel in einem Zug – Equip öffnet das Fenster, beides landet am Zielhelden
    { const t = await aufbauEigen([['Club of Gobbo', 0, 0]], ['Energy Aura', C]);
      t.script.push({ match: d => d.type === 'confirm' && !/Afflicted Pests/.test(JSON.stringify(d)), answer: () => ({ confirmed: true }) });
      const v0 = t.targetFn; t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0).id];
      await t.play(me, 'Energy Aura', { hero: 0, extra: 0 });
      void v0;
      pestsBei(t, op); t.reset();
      t.targetFn = (v, cfg) => {
        if (cfg && cfg.title === PESTS) return [(v.find(x => x.cardName === H.INERT.creature) || v[0]).id];
        if (v.some(x => x.type === 'equip')) return v.map(x => x.id);
        const h = v.find(x => x.type === 'hero' && x.heroIdx === 1); return h ? [h.id] : undefined;
      };
      const r = await t.play(me, C, { hero: 0 });
      R.check('Ceremony gemischt: Club of Gobbo UND Energy Aura liegen bei Held 1', r === true && wo(t, me, 'Club of Gobbo').join() === '1' && wo(t, me, 'Energy Aura').join() === '1', { r, c: wo(t, me, 'Club of Gobbo'), a: wo(t, me, 'Energy Aura') });
      R.check('Ceremony gemischt: das Equip öffnet das Equip-Fenster', pestsAktiv(t), t.prompts.map(p => p.d.type));
      R.check('Ceremony gemischt: sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // (2) Boni wandern mit (Warhorse = ATK-Bonus): Fridge und Ceremony liefern dasselbe Endbild
    const bilder = {};
    for (const [name, karte] of [['Fridge', F], ['Ceremony', C]]) {
      const t = await aufbauEigen([["The Master's Sword", 0, 0]], [karte]);
      const a0 = [t.hero(me, 0).atk, t.hero(me, 1).atk];   // nach dem Anlegen (Bonus liegt bei Held 0)
      wahlFuer(t, "The Master's Sword", 1);
      await t.play(me, karte, { hero: 0 });
      bilder[name] = { atk: [t.hero(me, 0).atk, t.hero(me, 1).atk], wo: wo(t, me, "The Master's Sword").join(), a0 };
      R.check(name + ': ATK-Bonus wandert (Held 0 verliert, Held 1 gewinnt)', bilder[name].atk[0] < a0[0] && bilder[name].atk[1] > a0[1], bilder[name]);
    }
    R.check('Fridge und Ceremony: identisches Endbild (ATK-Verteilung und Platz)', JSON.stringify({ ...bilder.Fridge, a0: 0 }) === JSON.stringify({ ...bilder.Ceremony, a0: 0 }), bilder);

    // (3) Ausrüst-Regeln gelten gleich: Crusader's nur auf Cecilia (Held 2 ist keine Cecilia und wird nie angeboten)
    for (const [name, karte] of [['Fridge', F], ['Ceremony', C]]) {
      const cec = ['Cecilia, the Harrowing Crusader', 'Cecilia, the Harrowing Crusader', H.BLANK_HEROES[2]];
      const t = await aufbauEigen([["Crusader's Flintlock", 0, 0]], [karte], { heroes: [me === 0 ? cec : null, me === 1 ? cec : null] });
      wahlFuer(t, "Crusader's Flintlock", 1);
      const angeboten = [];
      const w0 = t.targetFn; t.targetFn = (v, cfg) => { if (cfg && /Move|Inheritance Ceremony/.test(cfg.title || '') || v.some(x => x.type === 'hero')) angeboten.push(...v.filter(x => x.type === 'hero' || x.type === 'equip').map(x => x.heroIdx)); return w0(v, cfg); };
      await t.play(me, karte, { hero: 0 });
      R.check(name + ": Crusader's Flintlock → Cecilia (Held 1), Held 2 wird nie angeboten", wo(t, me, "Crusader's Flintlock").join() === '1' && !angeboten.includes(2), { w: wo(t, me, "Crusader's Flintlock"), angeboten }); }

    // (4) immovable
    for (const [name, karte] of [['Fridge', F], ['Ceremony', C]]) {
      const t = await aufbauEigen([['Club of Gobbo', 0, 0]], [karte]);
      t.inst(c => c.name === 'Club of Gobbo' && c.zone === 'support')[0].counters.immovable = true;
      wahlFuer(t, 'Club of Gobbo', 1);
      const r = await t.play(me, karte, { hero: 0 });
      R.check(name + ': ein "immovable" Equip bleibt liegen', wo(t, me, 'Club of Gobbo').join() === '0', { r, w: wo(t, me, 'Club of Gobbo') });
      R.check(name + ': (immovable) sauber', sauber(t), { e: t.errors, a: t.audit() }); }

    // (5) gesperrte Zielzone zählt nicht als frei (beide): Held 1 gesperrt -> nur Held 2 wird angeboten
    for (const [name, karte] of [['Fridge', F], ['Ceremony', C]]) {
      const t = await aufbauEigen([['Club of Gobbo', 0, 0]], [karte]);
      const o = t.engine.isSupportZoneLocked.bind(t.engine);
      t.engine.isSupportZoneLocked = (p, h, op2) => (p === me && h === 1) ? true : o(p, h, op2);
      const angeboten = [];
      t.targetFn = (v, cfg) => {
        const ti = (cfg && cfg.title) || '';
        if (ti === F || (ti === C && v.some(x => x.type === 'equip'))) return v.filter(x => x.type === 'equip' && x.cardName === 'Club of Gobbo').map(x => x.id);
        angeboten.push(...v.map(x => x.heroIdx));
        const h = v.find(x => x.type === 'hero' && x.heroIdx === 2) || v.find(x => x.type === 'equip' && x.heroIdx === 2); return h ? [h.id] : undefined;
      };
      await t.play(me, karte, { hero: 0 });
      R.check(name + ': Held 1 (Zonensperre) wird nicht angeboten, das Equip landet bei Held 2', wo(t, me, 'Club of Gobbo').join() === '2' && !angeboten.includes(1), { w: wo(t, me, 'Club of Gobbo'), angeboten }); }

    // (6) Hooks: Leave (nur die bewegte Karte), Enter mit _isMove, On-Play mit _isMove
    for (const [name, karte] of [['Fridge', F], ['Ceremony', C]]) {
      const t = await aufbauEigen([['Club of Gobbo', 0, 0]], [karte]);
      const ev = []; const orig = t.engine.runHooks.bind(t.engine);
      t.engine.runHooks = async (n, c) => { if (['onCardLeaveZone', 'onCardEnterZone', 'onPlay'].includes(n) && c && c._onlyCard && c._onlyCard.name === 'Club of Gobbo') ev.push(n + (c._isMove ? '+move' : '')); return orig(n, c); };
      wahlFuer(t, 'Club of Gobbo', 1);
      await t.play(me, karte, { hero: 0 });
      R.check(name + ': Haken-Folge Leave → Enter(_isMove) → On-Play(_isMove) für die bewegte Karte', ev.join() === 'onCardLeaveZone,onCardEnterZone+move,onPlay+move', ev); }

    // (7) Fridge auf GEGNERISCHE Heroes
    { const t = await H.fresh({ hand: [0, 1].map(i => i === op ? ['Club of Gobbo'] : (i === me ? [F] : [])), gold: 500, deckSize: 30, ...(me ? { active: 1 } : {}) });
      await t.play(op, 'Club of Gobbo', { hero: 0, slot: 0 });
      t.gs.activePlayer = me;
      wahlFuer(t, 'Club of Gobbo', 1);
      const ziele = [];
      const w0 = t.targetFn; t.targetFn = (v, cfg) => { ziele.push({ ti: cfg && cfg.title, o: [...new Set(v.map(x => x.owner))] }); return w0(v, cfg); };
      const r = await t.play(me, F);
      R.check('Fridge: Equip des GEGNERS wandert zwischen den Gegner-Helden (Held 0 → Held 1)', r === true && wo(t, op, 'Club of Gobbo').join() === '1', { r, w: wo(t, op, 'Club of Gobbo'), ziele });
      R.check('Fridge auf Gegner-Equip: nur Brettseite des Gegners angeboten, eigene Helden nicht als Ziel', ziele.every(z => z.o.length === 1 && z.o[0] === op), ziele);
      R.check('Fridge auf Gegner-Equip: sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    // … Pests: der Ausführende (me) ist der „Ausrüstende": Afflicted Pests des GEGNERS (op) öffnet, die eigene (me) nicht
    { const t = await H.fresh({ hand: [0, 1].map(i => i === op ? ['Club of Gobbo'] : (i === me ? [F] : [])), gold: 500, deckSize: 30, ...(me ? { active: 1 } : {}) });
      await t.play(op, 'Club of Gobbo', { hero: 0, slot: 0 });
      t.gs.activePlayer = me;
      pestsBei(t, op); t.reset();
      const w = (() => { const x = t.targetFn; return x; })();
      t.targetFn = (v, cfg) => {
        const ti = (cfg && cfg.title) || '';
        if (ti === PESTS) return [(v.find(x => x.cardName === H.INERT.creature) || v[0]).id];
        if (ti === F) return v.filter(x => x.type === 'equip' && x.cardName === 'Club of Gobbo').map(x => x.id);
        const h = v.find(x => x.type === 'hero' && x.heroIdx === 1); return h ? [h.id] : undefined;
      };
      void w;
      await t.play(me, F);
      R.check('Fridge auf Gegner-Equip: Pests des Gegners (der „Gegner" des Ausführenden) öffnet', pestsAktiv(t), t.prompts.map(p => p.d.type));
    }
    { const t = await H.fresh({ hand: [0, 1].map(i => i === op ? ['Club of Gobbo'] : (i === me ? [F] : [])), gold: 500, deckSize: 30, ...(me ? { active: 1 } : {}) });
      await t.play(op, 'Club of Gobbo', { hero: 0, slot: 0 });
      t.gs.activePlayer = me;
      pestsBei(t, me); t.reset();   // Pests beim Ausführenden selbst: reagiert nicht auf die eigene Handlung
      t.targetFn = (v, cfg) => {
        const ti = (cfg && cfg.title) || '';
        if (ti === PESTS) return [(v.find(x => x.cardName === H.INERT.creature) || v[0]).id];
        if (ti === F) return v.filter(x => x.type === 'equip' && x.cardName === 'Club of Gobbo').map(x => x.id);
        const h = v.find(x => x.type === 'hero' && x.heroIdx === 1); return h ? [h.id] : undefined;
      };
      await t.play(me, F);
      R.check('Fridge auf Gegner-Equip: die EIGENE Pests des Ausführenden öffnet nicht', !pestsGefragt(t) && t.inst(c => c.name === PESTS && c.zone === 'support').length === 0, t.prompts.map(p => p.d.type)); }

    // (8) Ceremony bietet nie gegnerische Helden als Ziel an
    { const t = await aufbauEigen([['Club of Gobbo', 0, 0]], [C]);
      const gesehen = [];
      t.targetFn = (v, cfg) => { gesehen.push(...v.map(x => x.owner)); const h = v.find(x => x.type === 'hero' && x.heroIdx === 1); const e = v.filter(x => x.type === 'equip'); return h ? [h.id] : (e.length ? e.map(x => x.id) : undefined); };
      await t.play(me, C, { hero: 0 });
      R.check('Ceremony: nur eigene Helden/Zonen zur Wahl', gesehen.length > 0 && gesehen.every(o => o === me), gesehen); }
  }
  R.finish();
})();
