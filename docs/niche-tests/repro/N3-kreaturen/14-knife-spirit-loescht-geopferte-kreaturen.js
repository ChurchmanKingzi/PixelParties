'use strict';
// N3-14 · Spirit of the Super-Killing Knife: geopferte UND per Status-Schaden gestorbene Kreaturen werden gelöscht (Stufe C, Welle 25 entschieden)
// Kartentext: „While this Creature remains on the board, any Hero or Creature that is defeated is deleted."
// Entscheidung Al (Welle 25): „Deleted" – geopferte Kreaturen (Tribut/Kosten) werden ebenfalls gelöscht (Ist-Zustand); Kreaturen, die an Status-Schaden (Brand/Gift) sterben, gelten als besiegt
//   und werden ebenfalls gelöscht (Welle 25: der Schadens-Batch löschte vorher nicht – `_gefalleneKreaturenGeloescht` kennt jetzt auch den Spirit).
// Aufbau: (a) Foresta, the Guard wird mit zwei Dummies als Tribut beschworen; (b) eine Dummy-Kreatur stirbt an Brand bzw. Gift (echte Zugwechsel); (c) Schaden.
//   Gegenprobe jeweils ohne Spirit: Ablage. Zusatz: ein eingefrorener Spirit löscht nicht.
// Exit 0 = geopferte und per Status-Schaden gestorbene Kreaturen liegen im Gelöscht-Stapel.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const KNIFE = 'Super-Killing Knife, the Tool of Liquidation';
  async function opfer(mitSpirit) {
    const t = await H.fresh({ hand: [['Foresta, the Guard'], []] });
    if (mitSpirit) { t.put(0, 0, 0, KNIFE); t.put(0, 0, 1, 'Spirit of the Super-Killing Knife').turnPlayed = 5; }   // Zug 5 = aktueller Zug: kein wählbares Tribut
    t.put(0, 1, 0, H.INERT.creature).turnPlayed = 1; t.put(0, 1, 1, H.INERT.creature).turnPlayed = 1;
    const r = await t.play(0, 'Foresta, the Guard', { hero: 1 });
    return { r, foresta: !!t.find('Foresta, the Guard', 'support'), ablage: t.pile(0, 'discardPile'), geloescht: t.pile(0, 'deletedPile'), errors: t.errors };
  }
  const o = await opfer(false);
  R.check('Gegenprobe: ohne Spirit gehen die zwei Tribut-Dummies in die Ablage', o.foresta && o.ablage.length === 2 && o.geloescht.length === 0, o);
  const m = await opfer(true);
  R.check('mit Spirit: die zwei geopferten Tribute (Opfer) werden gelöscht', m.foresta && m.ablage.length === 0 && m.geloescht.length === 2, m);

  async function status(st, mitSpirit, eingefroren) {
    const t = await H.fresh({});
    if (mitSpirit) {
      t.put(0, 0, 0, KNIFE);
      const sp = t.put(0, 0, 1, 'Spirit of the Super-Killing Knife');
      if (eingefroren) await t.engine.applyCreatureStatus(sp, 'frozen', { sourceOwner: 1 });
    }
    const d = t.put(0, 1, 0, H.INERT.frail);
    await t.engine.applyCreatureStatus(d, st, { sourceOwner: 1 });
    await t.endTurn(); await t.endTurn();
    return { weg: !t.find(H.INERT.frail, 'support'), ablage: t.pile(0, 'discardPile'), geloescht: t.pile(0, 'deletedPile'), errors: t.errors, audit: t.audit() };
  }
  for (const st of ['burned', 'poisoned']) {
    const o2 = await status(st, false, false);
    R.check(`Gegenprobe (${st}): ohne Spirit stirbt die Kreatur in die Ablage`, o2.weg && o2.ablage.length === 1 && o2.geloescht.length === 0, o2);
    const m2 = await status(st, true, false);
    R.check(`mit Spirit: an ${st} gestorbene Kreatur wird gelöscht`, m2.weg && m2.ablage.length === 0 && m2.geloescht.length === 1 && m2.errors.length === 0 && m2.audit.length === 0, m2);
  }
  {
    const t = await H.fresh({});
    t.put(0, 0, 0, KNIFE);
    const sp = t.put(0, 0, 1, 'Spirit of the Super-Killing Knife');
    await t.engine.applyCreatureStatus(sp, 'frozen', { sourceOwner: 1 });
    const d = t.put(0, 1, 0, H.INERT.frail);
    await t.engine.actionDealCreatureDamage({ name: 'Fireball', owner: 1 }, d, 50, 'fire');
    R.check('eingefrorener Spirit löscht nicht (Aura ruht): Ablage', t.pile(0, 'discardPile').length === 1 && t.pile(0, 'deletedPile').length === 0, { a: t.pile(0, 'discardPile'), g: t.pile(0, 'deletedPile') });
  }
  {
    const t = await H.fresh({});
    t.put(0, 0, 0, KNIFE); t.put(0, 0, 1, 'Spirit of the Super-Killing Knife');
    const d = t.put(0, 1, 0, H.INERT.frail);
    await t.engine.actionDealCreatureDamage({ name: 'Fireball', owner: 1 }, d, 50, 'fire');
    R.check('mit Spirit: durch direkten Schaden besiegte Kreatur wird gelöscht', t.pile(0, 'discardPile').length === 0 && t.pile(0, 'deletedPile').length === 1, { a: t.pile(0, 'discardPile'), g: t.pile(0, 'deletedPile') });
    R.check('keine Engine-Fehler / Zustand sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  for (const st of ['burned', 'poisoned']) {   // Helden: Tod an Status-Schaden löscht den Helden (Ist-Zustand, mitgemessen)
    const t = await H.fresh({ hp: 5 });
    t.put(1, 0, 0, KNIFE); t.put(1, 0, 1, 'Spirit of the Super-Killing Knife');
    t.engine.addHeroStatus(0, 1, st, { appliedBy: 1 });
    await t.endTurn(); await t.endTurn();
    R.check(`mit Spirit: an ${st} gestorbener Held wird gelöscht`, t.pile(0, 'deletedPile').length === 1 && !t.gs.players[0].heroes[1].name && t.errors.length === 0, { g: t.pile(0, 'deletedPile'), e: t.errors });
  }
  R.check('keine Engine-Fehler (Opfer)', o.errors.length + m.errors.length === 0);
  R.finish();
})();
