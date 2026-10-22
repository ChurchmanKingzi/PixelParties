'use strict';
// W51a · Punkt A · Al, 22.10.2026: „Ein Umhängen soll auch das 'on Equip/Attachment gained'-Fenster für Pests öffnen (das übrigens GENERISCH sein soll …)."
// EIN Fenster: `engine.fireEquipGained` → Hook `onEquipGained` (Lauscher: Passive, Hand-Reaktionen wie Anti Magic Enchantment) → Surprise-Fenster `surpriseEquipTrigger`
// (Afflicted Pests, Cybug LOCUST). Ausgelöst vom Standard-Eintritt (Hand-Equip, Anhängsel, Effekt-Equip), von Slippery Fridge, Inheritance Ceremony (Equips UND
// Anhängsel) und `actionTransferAttachment` (Cybug LOCUST, Secret Spell Book …). Ausrüstender beim Umhängen = der AUSFÜHRENDE.
// Beide Sitze. Exit 0 = korrekt.
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const PESTS = 'Afflicted Pests', F = 'Slippery Fridge', C = 'Inheritance Ceremony', AME = 'Anti Magic Enchantment';
const sauber = (t) => t.errors.length === 0 && t.audit().length === 0;
const pestsGefragt = (t) => t.prompts.some(p => /Afflicted Pests/.test(JSON.stringify(p.d)));
const pestsAktiv = (t) => pestsGefragt(t) || t.inst(c => c.name === PESTS && c.zone === 'support').length > 0;
const ameGefragt = (t) => t.prompts.some(p => p.d && p.d.title === AME);
const stuetz = (t, s, hi) => (t.gs.players[s].supportZones[hi] || []).flat();
const wo = (t, s, n) => [0, 1, 2].filter(hi => stuetz(t, s, hi).includes(n));
/** Spion auf den neuen Hook. */
function spion(t) {
  const ev = []; const orig = t.engine.runHooks.bind(t.engine);
  t.engine.runHooks = async (n, c) => {
    if (n === 'onEquipGained') ev.push({ name: c.equipName, owner: c.equipOwner, hero: c.equipHeroIdx, side: c.hostSide, ctrl: c.heroController, kind: c.kind, move: c.isMove, fromHero: c.fromHeroIdx, fromOwner: c.fromOwner, src: c.source });
    return orig(n, c);
  };
  return ev;
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section('Sitz ' + me + ' (Gegner Sitz ' + op + ')');
    const opts = (hand, extra = {}) => ({ hand: [0, 1].map(i => i === me ? hand : []), gold: 500, deckSize: 30, ...(me ? { active: 1 } : {}), ...extra });
    const pestsBei = (t, seat) => {
      t.putSurprise(seat, 0, PESTS); t.grantFor(seat, 0, PESTS); t.put(seat, 0, 0, H.INERT.creature);
      const vorher = t.targetFn;
      t.targetFn = (v, cfg) => (cfg && cfg.title === PESTS) ? [(v.find(x => x.cardName === H.INERT.creature) || v[0]).id] : (vorher ? vorher(v, cfg) : undefined);
    };
    const wahl = (t, name, nachHeld) => {
      t.targetFn = (v, cfg) => {
        const ti = (cfg && cfg.title) || '';
        if (ti === PESTS) return [(v.find(x => x.cardName === H.INERT.creature) || v[0]).id];
        if (ti === F || (ti === C && v.some(x => x.type === 'equip'))) return v.filter(x => x.type === 'equip' && (!name || x.cardName === name)).map(x => x.id);
        const h = v.find(x => x.type === 'hero' && x.heroIdx === nachHeld) || v.find(x => x.type === 'equip' && x.heroIdx === nachHeld); return h ? [h.id] : undefined;
      };
    };
    const aufbau = async (platziert, hand, extra = {}) => {
      const t = await H.fresh(opts([...platziert.map(e => e[0]), ...hand], extra));
      t.script.push({ match: d => d.type === 'confirm' && !/Afflicted Pests|Anti Magic Enchantment/.test(JSON.stringify(d)), answer: () => ({ confirmed: true }) });
      for (const [n, hi, slot] of platziert) {
        if (n === 'Energy Aura') { t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === (hi ?? 0)).id]; await t.play(me, n, { hero: hi ?? 0 }); }
        else await t.play(me, n, { hero: hi ?? 0, slot: slot ?? 0 });
      }
      return t;
    };

    // ── (1) Der Hook feuert mit Nutzlast: Hand-Equip ──
    { const t = await H.fresh(opts(['Club of Gobbo'])); const ev = spion(t);
      await t.play(me, 'Club of Gobbo', { hero: 0, slot: 0 });
      R.check('Hand-Equip: onEquipGained einmal, kind=equip, Ausrüstender=ich, kein Umhängen', ev.length === 1 && ev[0].kind === 'equip' && ev[0].owner === me && ev[0].hero === 0 && ev[0].side === me && ev[0].move === false, ev); }
    // Anhängsel (Energy Aura) auf eigenen Helden
    { const t = await H.fresh(opts(['Energy Aura'])); const ev = spion(t);
      t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0).id];
      await t.play(me, 'Energy Aura', { hero: 0 });
      R.check('Anhängsel (Energy Aura): onEquipGained kind=attachment, Ausrüstender=ich', ev.length === 1 && ev[0].kind === 'attachment' && ev[0].owner === me && ev[0].move === false, ev); }
    // Curse auf einen GEGNER-Helden: Ausrüstender = Wirker, Seite = Gegner
    { const t = await H.fresh(opts(['Curse'])); const ev = spion(t);
      t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === op && x.heroIdx === 0); return [(h || v[0]).id]; };
      await t.play(me, 'Curse', { hero: 0, targetOwner: op });
      R.check('Curse auf Gegner-Held: Ausrüstender=ich, Wirtsseite=Gegner', ev.length === 1 && ev[0].owner === me && ev[0].side === op && ev[0].kind === 'attachment', ev); }

    // ── (2) Umhängen: Fridge (Equip) ──
    { const t = await aufbau([['Club of Gobbo', 0, 0]], [F]); const ev = spion(t); pestsBei(t, op); t.reset(); const t0 = t.targetFn; wahl(t, 'Club of Gobbo', 1); void t0;
      await t.play(me, F, { hero: 0 });
      R.check('Fridge: onEquipGained mit isMove, Quelle Held 0 → Held 1, Quelle=Slippery Fridge', ev.length === 1 && ev[0].move === true && ev[0].fromHero === 0 && ev[0].hero === 1 && ev[0].owner === me && ev[0].src === F && ev[0].kind === 'equip', ev);
      R.check('Fridge: Afflicted Pests des Gegners öffnet (selber Mechanismus)', pestsAktiv(t), t.prompts.map(p => p.d.type)); R.check('Fridge: sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    // ── (3) Umhängen: Ceremony – Equip UND Anhängsel ──
    { const t = await aufbau([['Club of Gobbo', 0, 0], ['Energy Aura', 0]], [C]); const ev = spion(t); pestsBei(t, op); t.reset(); wahl(t, null, 1);
      await t.play(me, C, { hero: 0 });
      const namen = ev.map(e => e.name).sort().join();
      R.check('Ceremony: Club of Gobbo UND Energy Aura wandern zu Held 1', wo(t, me, 'Club of Gobbo').join() === '1' && wo(t, me, 'Energy Aura').join() === '1', { c: wo(t, me, 'Club of Gobbo'), a: wo(t, me, 'Energy Aura') });
      R.check('Ceremony: onEquipGained für beide (equip + attachment, isMove, Ausführender=ich, Quelle Ceremony)', namen === 'Club of Gobbo,Energy Aura' && ev.every(e => e.move && e.owner === me && e.hero === 1 && e.fromHero === 0 && e.src === C) && ev.find(e => e.name === 'Energy Aura').kind === 'attachment' && ev.find(e => e.name === 'Club of Gobbo').kind === 'equip', ev);
      R.check('Ceremony: Pests des Gegners öffnet', pestsAktiv(t), t.prompts.map(p => p.d.type)); R.check('Ceremony: sauber', sauber(t), { e: t.errors, a: t.audit() }); }
    // Nur ein Anhängsel: Pests öffnet trotzdem
    { const t = await aufbau([['Energy Aura', 0]], [C]); const ev = spion(t); pestsBei(t, op); t.reset(); wahl(t, 'Energy Aura', 1);
      await t.play(me, C, { hero: 0 });
      R.check('Ceremony nur Anhängsel: Pests öffnet, Hook feuert einmal (attachment)', pestsAktiv(t) && ev.length === 1 && ev[0].kind === 'attachment', { ev, p: t.prompts.map(p => p.d.type) }); }
    // Die eigene Pests des Ausführenden reagiert nicht (Gegenprobe)
    { const t = await aufbau([['Energy Aura', 0]], [C]); pestsBei(t, me); t.reset(); wahl(t, 'Energy Aura', 1);
      await t.play(me, C, { hero: 0 });
      R.check('Gegenprobe: die EIGENE Pests des Ausführenden öffnet beim Umhängen nicht', !pestsGefragt(t) && t.inst(c => c.name === PESTS && c.zone === 'support').length === 0, t.prompts.map(p => p.d.type)); }

    // ── (4) actionTransferAttachment (Cybug LOCUST, Secret Spell Book …): nicht-stilles Umhängen ──
    { const t = await aufbau([['Energy Aura', 0]], []); const ev = spion(t); pestsBei(t, op); t.reset();
      const inst = t.find('Energy Aura', 'support');
      const r = await t.run(() => t.engine.actionTransferAttachment(inst, me, 1, 0, { sourceName: 'Test', anleger: me }));
      R.check('actionTransferAttachment (Aura Held 0 → 1): Hook + Pests-Fenster mit Ausführendem als Ausrüstendem', r && r.success && ev.length === 1 && ev[0].move && ev[0].owner === me && pestsAktiv(t), { r, ev, p: t.prompts.map(p => p.d.type) }); }
    { // ohne `anleger` gilt der neue Kontrolleur
      const t = await aufbau([['Energy Aura', 0]], []); const ev = spion(t);
      const inst = t.find('Energy Aura', 'support');
      await t.run(() => t.engine.actionTransferAttachment(inst, me, 1, 0, { sourceName: 'Test' }));
      R.check('actionTransferAttachment ohne anleger: Ausrüstender = neuer Kontrolleur', ev.length === 1 && ev[0].owner === me, ev); }

    // ── (5) Anti Magic Enchantment hängt sich an denselben Hook: auch beim Umhängen von Equips ──
    for (const [name, karte] of [['Fridge', F], ['Ceremony', C]]) {
      const t = await aufbau([['Club of Gobbo', 0, 0]], [karte]); t.addHand(me, AME); wahl(t, 'Club of Gobbo', 1); t.reset();
      await t.play(me, karte, { hero: 0 });
      R.check(name + ': Anti Magic Enchantment wird auf das umgehängte Equip angeboten (selber Hook)', ameGefragt(t), t.prompts.map(p => p.d.title || p.d.type)); }
    { // Normales Anlegen weiter wie vorher
      const t = await H.fresh(opts(['Club of Gobbo', AME]));
      await t.play(me, 'Club of Gobbo', { hero: 0, slot: 0 });
      R.check('Hand-Equip: Anti Magic Enchantment wird wie vorher angeboten', ameGefragt(t), t.prompts.map(p => p.d.title || p.d.type)); }
    { // Anhängsel (kein Equipment-Artifact): AME bietet nichts an
      const t = await aufbau([['Energy Aura', 0]], [C]); t.addHand(me, AME); wahl(t, 'Energy Aura', 1); t.reset();
      await t.play(me, C, { hero: 0 });
      R.check('Ceremony-Anhängsel: AME bleibt still (nur Equipment-Artifacts)', !ameGefragt(t), t.prompts.map(p => p.d.title || p.d.type)); }

    // ── (6) Abilities und Kreaturen öffnen das Fenster nicht ──
    { const t = await H.fresh(opts(['Fighting'])); const ev = spion(t);
      await t.play(me, 'Fighting', { hero: 0 });
      R.check('Ability angelegt: onEquipGained feuert nicht (Q59)', ev.length === 0, ev); }
    { const t = await H.fresh(opts([H.INERT.creature])); const ev = spion(t);
      await t.play(me, H.INERT.creature, { hero: 0, slot: 0 });
      R.check('Kreatur beschworen: onEquipGained feuert nicht', ev.length === 0, ev); }
  }
  R.finish();
})();
