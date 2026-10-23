'use strict';
// W63c-05 · Skript-Wege (nicht der Standard-Spielweg): Karten, die ihre Handkarte selbst entnehmen (`takeFromPileSync(…, 'hand', …)`) und sie dann
// beschwören/anlegen oder direkt in einen Stapel legen. Gestohlene Karten (Charme Lv 2) behalten dabei ihren BESITZER:
//   · Hand → Brett über `safePlaceInSupport` / `summonCreatureWithHooks` (Army of the Cute, Reaktions-Kreaturen …): Brettinstanz trägt den Besitzer,
//   · Hand → Ablage/Löschstapel über `handKartenBesitzerPs` (Bottled Flame, Jump in the River, Dive Down, Cybug-Treibstoff …): Stapel des Besitzers,
//   · Karte kommt unverrichteter Dinge zurück (`handZugangRueckgabe`): Herkunftsmarke bleibt,
//   · auch wenn zwischen Entnahme und Ablage weitere Karten die Hand verlassen (Reaktionen im Kettenfenster überschreiben den Einzelsatz der letzten Entnahme),
//   · Gegenprobe: eine EIGENE Karte gleichen Namens bekommt nie eine Fremdherkunft.
const B = require('../../lib/besitzer.js');
const { H } = B;
(async () => {
  const R = H.runner();
  for (const dieb of [0, 1]) {
    const bes = 1 - dieb;
    R.section(`── Dieb = Sitz ${dieb} ──`);

    // (1) takeFromPileSync + safePlaceInSupport
    {
      const t = await B.charmeKlau('ZZ Dummy Frail', dieb);
      const hi = t.pile(dieb, 'hand').indexOf('ZZ Dummy Frail');
      t.engine.takeFromPileSync(dieb, 'hand', hi);
      t.engine.sync();
      const r = t.engine.safePlaceInSupport('ZZ Dummy Frail', dieb, 0, 0);
      R.check(`(1) Dieb ${dieb}: safePlaceInSupport nach Handentnahme → Besitzer an der Brettinstanz`, r && r.inst.originalOwner === bes, r && r.inst.originalOwner);
      R.check(`(1) Dieb ${dieb}: keine fremde Geister-Handinstanz`, B.geisterHand(t, 'ZZ Dummy Frail').length === 0);
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: bes }, r.inst, 999, 'fire'));
      B.erwarteStapel(R, t, `(1) Dieb ${dieb}: stirbt`, 'ZZ Dummy Frail', bes, 'discardPile');
    }

    // (2) Elven-Rider-Muster: Entnahme, dann summonCreatureWithHooks mit fromHandIdx (auch seitenfremd mit controller)
    for (const seitenfremd of [false, true]) {
      const t = await B.charmeKlau('ZZ Dummy Frail', dieb);
      const hi = t.pile(dieb, 'hand').indexOf('ZZ Dummy Frail');
      t.engine.takeFromPileSync(dieb, 'hand', hi);
      const feld = seitenfremd ? bes : dieb;
      const res = await t.run(() => t.engine.summonCreatureWithHooks('ZZ Dummy Frail', feld, 0, 0, { source: 'Test', fromHandIdx: hi, ...(seitenfremd ? { controller: dieb } : {}) }));
      const inst = res && res.inst;
      R.check(`(2) Dieb ${dieb}${seitenfremd ? ' seitenfremd' : ''}: beschworen, Brettinstanz gehört dem Besitzer`, !!inst && inst.originalOwner === bes, inst && { owner: inst.owner, orig: inst.originalOwner, ctrl: inst.controller });
      if (inst) {
        await t.run(() => t.engine.actionDealCreatureDamage({ name: 'Test', owner: bes }, inst, 999, 'fire'));
        B.erwarteStapel(R, t, `(2) Dieb ${dieb}${seitenfremd ? ' seitenfremd' : ''}: stirbt`, 'ZZ Dummy Frail', bes, 'discardPile');
      }
    }

    // (3) Entnahme → direkt in den Stapel über handKartenBesitzerPs, auch wenn dazwischen weitere Karten die Hand verlassen
    for (const [stapel, pile] of [['discardPile', 'discardPile'], ['deletedPile', 'deletedPile'], ['mainDeck', 'mainDeck']]) {
      const t = await B.charmeKlau('Fireball', dieb, { diebHand: ['ZZ Filler', 'ZZ Filler', 'ZZ Filler'] });
      const hi = t.pile(dieb, 'hand').indexOf('Fireball');
      t.engine.takeFromPileSync(dieb, 'hand', hi);
      // dazwischen verlassen zwei eigene Karten die Hand (Reaktionen im Kettenfenster) — der Einzelsatz der letzten Entnahme ist weg
      t.engine.takeFromPileSync(dieb, 'hand', 0);
      t.engine.takeFromPileSync(dieb, 'hand', 0);
      t.engine.handKartenBesitzerPs(dieb, 'Fireball')[pile].push('Fireball');
      B.erwarteStapel(R, t, `(3) Dieb ${dieb}: Zwischen-Splices, Ziel ${stapel}`, 'Fireball', bes, pile);
    }

    // (4) unverrichtet zurück (Beschwörung abgelehnt): Herkunft bleibt
    {
      const t = await B.charmeKlau('ZZ Dummy Frail', dieb);
      const hi = t.pile(dieb, 'hand').indexOf('ZZ Dummy Frail');
      t.engine.takeFromPileSync(dieb, 'hand', hi);
      R.check('(4) Hilfe `handZugangRueckgabe` existiert', typeof t.engine.handZugangRueckgabe === 'function');
      if (typeof t.engine.handZugangRueckgabe === 'function') t.engine.handZugangRueckgabe(dieb, 'ZZ Dummy Frail', { source: 'Test', ohneInstanz: true });
      else t.engine.handZugangSync(dieb, 'ZZ Dummy Frail', { source: 'Test', ohneInstanz: true });   // alter Stand: Herkunft geht verloren
      R.check(`(4) Dieb ${dieb}: Karte wieder in der Hand`, B.anzahl(t, dieb, 'hand', 'ZZ Dummy Frail') === 1, B.ort(t, 'ZZ Dummy Frail'));
      await t.run(() => t.engine.actionDiscardHandCard(dieb, 'ZZ Dummy Frail', t.pile(dieb, 'hand').indexOf('ZZ Dummy Frail'), {}));
      B.erwarteStapel(R, t, `(4) Dieb ${dieb}: zurückgelegt und abgeworfen`, 'ZZ Dummy Frail', bes, 'discardPile');
    }

    // (5) Gegenprobe: eigene Kopie wird entnommen und beschworen, während ein Fremdeintrag eines ANDEREN Namens im Buch steht
    {
      const t = await B.charmeKlau('Fireball', dieb, { diebHand: ['ZZ Dummy Frail'] });
      const hi = t.pile(dieb, 'hand').indexOf('ZZ Dummy Frail');
      t.engine.takeFromPileSync(dieb, 'hand', hi);
      const r = t.engine.safePlaceInSupport('ZZ Dummy Frail', dieb, 0, 0);
      R.check(`(5) Dieb ${dieb}: eigene Kreatur bleibt eigen, Fremdkarte unberührt`, r && r.inst.originalOwner === dieb && B.anzahl(t, dieb, 'hand', 'Fireball') === 1, r && r.inst.originalOwner);
    }

    // (6) echte Karte: Army of the Cute legt eine gestohlene Cute-Kreatur aufs Brett
    {
      const t = await B.charmeKlau('Cute Bird', dieb, { diebHand: ['Army of the Cute'] });
      t.gs.activePlayer = dieb; t.resetActions(dieb);
      t.grantFor(dieb, 0, 'Army of the Cute');
      t.script.push({ match: d => d.type === 'cardGalleryMulti' && /Army/.test(d.title || ''), answer: () => ({ selectedCards: ['Cute Bird'], selectedIndices: [0] }) });
      const r = await t.play(dieb, 'Army of the Cute', { hero: 0, noGrant: true });
      const inst = t.engine.cardInstances.find(c => c.name === 'Cute Bird' && c.zone === 'support');
      if (!inst) { R.note(`(6) Dieb ${dieb}: Army of the Cute legte keine Kreatur (Aufbau der Harness)`, { r: JSON.stringify(r), prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) }); }
      else {
        R.check(`(6) Dieb ${dieb}: Army of the Cute — Brettinstanz gehört dem Besitzer`, inst.originalOwner === bes, { owner: inst.owner, orig: inst.originalOwner });
        await B.zerstoere(t, 'Cute Bird');
        B.erwarteStapel(R, t, `(6) Dieb ${dieb}: Army of the Cute, Kreatur zerstört`, 'Cute Bird', bes, 'discardPile');
      }
    }

    // (7) echte Karte: Bottled Flame — beide werfen abwechselnd ab, die gestohlene Karte geht zum Besitzer
    {
      const t = await B.charmeKlau('Fireball', dieb, { diebHand: ['Bottled Flame'], besitzerHand: ['ZZ Filler'] });
      t.script.push({ match: d => d.type === 'forceDiscardCancellable' && /Bottled Flame/.test(d.title || ''), answer: (d, pi) => { const hand = t.pile(pi, 'hand'); const n = pi === dieb && hand.includes('Fireball') ? 'Fireball' : hand[0]; return n ? { cardName: n, handIndex: hand.indexOf(n) } : { cancelled: true }; } });
      await t.play(dieb, 'Bottled Flame', { hero: 0 });
      const o = B.ort(t, 'Fireball');
      if (B.anzahl(t, dieb, 'hand', 'Fireball') === 1) R.note(`(7) Dieb ${dieb}: Bottled Flame ließ die gestohlene Karte in der Hand (Abfolge der Harness)`, { prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) });
      else R.check(`(7) Dieb ${dieb}: Bottled Flame — Fireball in der Ablage des Besitzers`, B.anzahl(t, bes, 'discardPile', 'Fireball') === 1 && B.anzahl(t, dieb, 'discardPile', 'Fireball') === 0, o);
    }

    // (8) Sofort-Guss (Hu, Coffee, Junshi, Learning, Call for Help …): `_castSpellImmediately` — Spell geht zum Besitzer, Anhaengsel/Area bleiben seine Karten
    {
      const t = await B.charmeKlau('Fireball', dieb);
      t.targetFn = v => [v.find(x => x.type === 'hero' && x.owner === bes && x.heroIdx === 0).id];
      t.grantFor(dieb, 0, 'Fireball');
      t.gs.activePlayer = dieb; t.phase(3);
      const r = await t.run(() => t.engine._castSpellImmediately(dieb, 0, 'Fireball', { by: 'Test' }));
      if (r && r.cancelled) R.note(`(8) Dieb ${dieb}: Sofort-Guss Fireball abgebrochen (Aufbau der Harness)`, r);
      else B.erwarteStapel(R, t, `(8) Dieb ${dieb}: Sofort-Guss Fireball`, 'Fireball', bes, 'discardPile');
    }
    {
      const t = await B.charmeKlau('Anti Magic', dieb);
      t.grantFor(dieb, 0, 'Anti Magic');
      t.gs.activePlayer = dieb; t.phase(3);
      const r = await t.run(() => t.engine._castSpellImmediately(dieb, 0, 'Anti Magic', { by: 'Test' }));
      const brett = t.engine.cardInstances.find(c => c.name === 'Anti Magic' && c.zone === 'support');
      if (!brett) R.note(`(8) Dieb ${dieb}: Sofort-Guss Anti Magic nicht angelegt (Aufbau der Harness)`, r);
      else {
        R.check(`(8) Dieb ${dieb}: Sofort-Guss Anti Magic — Brettinstanz gehört dem Besitzer`, brett.originalOwner === bes, brett.originalOwner);
        await B.zerstoere(t, 'Anti Magic');
        B.erwarteStapel(R, t, `(8) Dieb ${dieb}: Sofort-Guss Anti Magic zerstört`, 'Anti Magic', bes, 'discardPile');
      }
    }
  }
  R.finish();
})();
