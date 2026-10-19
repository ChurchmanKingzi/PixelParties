'use strict';
// A09-02 · Bonded Companion (alle vier) wird auf die Hand zurückgenommen: Karte liegt danach in Hand UND Ablage (+1 Kopie)
// Kartentext Bonded Companion …: „When this Creature leaves the board, defeat the corresponding Hero."
// Aufbau: Seed 1234. Seite 1: Held 0 mit "Bonded Companion Humby" in Support Zone 0. Seite 0: Held 0 mit Fighting 1, Hand [Racket Arrow].
// Schritte: 1. "Attack" spielen, "Racket Arrow" ketten (Rücknahme einer gegnerischen Kreatur), den Companion wählen.
//           (Zusatzprobe: dieselbe Rücknahme direkt über _deepsea-shared.returnSupportCreatureToHand für alle vier Companions.)
// Erwartet: Companion verlässt das Brett EINMAL: die Karte liegt danach genau einmal (Hand) – der Held ist besiegt.
// Beobachtet: Der Held wird besiegt UND der Companion liegt zweimal vor (Hand + Ablage), Kartenbilanz +1.
// Ursache: _deepsea-shared.returnSupportCreatureToHand legt die Karte in die Hand und feuert danach onCardLeaveZone, solange inst.zone noch 'support' ist;
//          der Companion-Abgang besiegt den Helden -> onHeroKO -> companionHeldGefallen (_bonded-companions-shared.js) sieht ich.zone==='support' und schiebt die Karte in die Ablage.
const H = require('../../lib/h.js');
const { returnSupportCreatureToHand } = require(H.ROOT + '/cards/effects/_deepsea-shared');
(async () => {
  const R = H.runner();
  R.section('über Racket Arrow (echter Spielweg)');
  {
    const t = await H.fresh({ hand: [['Racket Arrow', 'Attack'], []], gold: [100, 100] });
    t.setAbilities(0, 0, [['Fighting'], [], []]);
    t.put(1, 0, 0, 'Bonded Companion Humby');
    t.targetFn = (valid) => { const e = valid.find(x => x.type === 'equip' && x.cardName === 'Bonded Companion Humby'); const h = valid.find(x => x.type === 'hero' && x.owner === 1 && x.heroIdx === 1); const pick = e || h || valid[0]; return pick ? [pick.id] : null; };
    const before = t.census();
    await t.play(0, 'Attack', { hero: 0 });
    const diff = t.censusDiff(before, t.census());
    const n = t.pile(1, 'hand').filter(x => x === 'Bonded Companion Humby').length + t.pile(1, 'discardPile').filter(x => x === 'Bonded Companion Humby').length;
    // W16d: seit A09-03 bietet Racket Arrow den Companion nicht mehr an (unaffected by effects that can't affect Heroes) - er bleibt auf dem Brett (n = 0);
    // die Rücknahme selbst prüft der zweite Teil (direkter Aufruf). Maßstab hier: nie mehr als EINE Kopie.
    R.check('Companion liegt höchstens einmal (Hand oder Ablage)', n <= 1, { hand: t.pile(1, 'hand'), discard: t.pile(1, 'discardPile') });
    R.check('Kartenbilanz unverändert (Hand/Ablage zählen gleich)', !diff.some(d => /Bonded/.test(d)), diff);
    R.check('keine Engine-Fehler', t.errors.length === 0, t.errors);
  }
  R.section('alle vier Companions, direkte Rücknahme');
  for (const name of ['Bonded Companion Humby', 'Bonded Companion Mellvy', 'Bonded Companion Orphy', 'Bonded Companion Thuly']) {
    const t = await H.fresh({ hand: [[], []] });
    const comp = t.put(0, 0, 0, name);
    const before = t.census();
    await t.run(() => returnSupportCreatureToHand(t.engine, comp, 'Test'));
    const diff = t.censusDiff(before, t.census());
    R.check(name + ': Kartenbilanz bleibt 0', diff.length === 0, { diff, hand: t.pile(0, 'hand'), discard: t.pile(0, 'discardPile') });
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
