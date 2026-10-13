'use strict';
// R02-09 · Mountain Tear River: lehnt der Surprise-Besitzer die „additional targets" ab, gilt der Zauber des GEGNERS als abgebrochen (Karte zurück auf die Hand, Aktion erstattet – obwohl der Schaden schon getroffen hat)
// Kartentext: „Activate this Surprise when the user or a Creature … is chosen by an Attack, Spell or Creature effect. Burn the attacker. If the user has Destruction Magic 3, Burn up to 2 additional targets afterwards."
// Skriptkopf (mountain-tear-river.js): „Mountain Tear River never cancels the triggering effect" – der Angriff läuft normal weiter.
// Aufbau: Sitz 1: Held 0 mit Destruction Magic 3 und Mountain Tear River in der Surprise Zone. Sitz 0 spielt Burning Finger (100 Schaden) auf Held 0 von Sitz 1.
//   Die Surprise fragt „Choose up to 2 additional targets to Burn" (min 0, max 2, abbrechbar). Varianten: (a) 0 gewählt (b) abbrechen (Mensch: null) (c) 1 Ziel gewählt (Kontrolle).
// Erwartet: (a),(b),(c) identisch für den Zauber: 100 Schaden an Held 0, Burning Finger liegt in der Ablage von Sitz 0, die Aktion ist verbraucht (ein zweiter Zauber ohne Aktions-Reset wird abgelehnt).
// Beobachtet: nur (c) korrekt. Bei (a)/(b) steht Burning Finger wieder auf der Hand von Sitz 0, die Aktion ist erstattet (heroesActedThisTurn leer) – der Schaden wurde aber zugefügt;
//   ein zweiter Burning Finger geht ohne Aktions-Reset durch (insgesamt 200 Schaden für eine Karte und eine Aktion, beliebig oft wiederholbar, solange der Verteidiger ablehnt).
// Ursache: `promptMultiTarget` (_engine.js ~5844) setzt bei leerer/abgebrochener Wahl `gs._spellCancelled = true`, außer `config.noSpellCancel` ist gesetzt („ein Abbruch ausserhalb eines Zaubers … darf keine Zauber-Abbruchmarke hinterlassen").
//   mountain-tear-river.js (~Z. 177–195, `ctx.promptMultiTarget({ … cancellable: true })`) setzt `noSpellCancel` nicht (Gegenstück: toxic-trap.js tut es). doPlaySpell wertet die Marke (~_engine.js 21888) als Abbruch des laufenden Zaubers.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  for (const modus of ['(a) 0 Ziele gewählt', '(b) Abbrechen (null)', '(c) 1 Ziel gewählt (Kontrolle)']) {
    const t = await H.fresh({ hand: [['Burning Finger'], []], hp: 800 });
    t.setAbilities(1, 0, [['Destruction Magic', 'Destruction Magic', 'Destruction Magic'], [], []]);
    t.putSurprise(1, 0, 'Mountain Tear River');
    t.grantFor(0, 0, 'Burning Finger');
    t.targetFn = (valid, cfg) => {
      if (cfg && /additional/i.test(cfg.description || '')) {
        if (modus.startsWith('(b)')) return null;
        if (modus.startsWith('(a)')) return [];
        return [valid.find(v => v.type === 'hero' && v.owner === 0 && v.heroIdx === 1).id];
      }
      return [valid.find(v => v.type === 'hero' && v.owner === 1 && v.heroIdx === 0).id];
    };
    t.policy.confirm = true;
    await t.play(0, 'Burning Finger', { hero: 0, noGrant: true });
    R.check(`${modus}: Aufbau – Surprise feuerte, Burning Finger traf (700 HP)`, t.hp(1, 0) === 700 && !!t.hero(0, 0).statuses.burned, { hp: t.hp(1, 0), burned: !!t.hero(0, 0).statuses.burned });
    R.check(`${modus}: Burning Finger liegt in der Ablage von Sitz 0 (nicht auf der Hand)`, t.pile(0, 'discardPile').includes('Burning Finger') && !t.pile(0, 'hand').includes('Burning Finger'), { hand0: t.pile(0, 'hand'), disc0: t.pile(0, 'discardPile') });
    const zweiter = await t.play(0, 'Burning Finger', { hero: 0, noGrant: true, keepActions: true });
    R.check(`${modus}: ein zweiter Zauber ohne Aktions-Reset wird abgelehnt (Aktion verbraucht)`, zweiter === false, { zweiter, hp1: t.hp(1, 0) });
    R.check(`${modus}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  R.finish();
})();
