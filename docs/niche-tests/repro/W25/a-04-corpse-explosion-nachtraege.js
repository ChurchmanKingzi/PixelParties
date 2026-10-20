'use strict';
// W25a · Corpse-Explosion-Nachträge aus W24a (Al 21.10.2026: „1 ja", „2 ja, gewollt", „den anderen Fall fixen").
//  (a) Eine GEGNERISCHE Kreatur, die von einem Spell ohne Schaden besiegt wird (Trial of Dominance, Goldify), darf auch vom GEGNER ihres Kontrolleurs mit Corpse Explosion beantwortet werden –
//      analog zum Schadenpfad (`firesForOpponentDefeat`): nur wenn dieser Gegner ein Mensch ist (CPU nie), die Explosion trifft „den Gegner der gefallenen Kreatur" = den Spieler selbst. Der Kontrolleur der Kreatur
//      behält sein eigenes Fenster (Gegenprobe).
//  (b) Cure / vollflächiger Cleanse einer Decisive-Defeat-Negierung nimmt die überlagerte fremde Negierung mit (gewollt) – gesichert durch W24/a-04-decisive-defeat-fremde-negierung-heilen.js und N1-reaktionen-a/09.
//  (c) Ein DAUERHAFT übernommener Held, der ohne Schaden besiegt wird (`actionDefeatHero`, `ohneSchaden`), löst Corpse Explosion für den KONTROLLEUR aus (nicht für Besitzer/Brettseite);
//      die Explosion trifft den Gegner des Kontrolleurs (= den Besitzer des Helden).
// Aufruf: node docs/niche-tests/repro/W25/a-04-corpse-explosion-nachtraege.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const hps = (t, s) => [0, 1, 2].map(h => t.hp(s, h));
(async () => {
  const R = H.runner();
  const CE = 'Corpse Explosion';
  // ── (a) ────────────────────────────────────────────────────────────────
  const laufA = async (label, { mensch0, hand }) => {
    const t = await H.fresh({ hand: [['Trial of Dominance', ...(hand[0] ? [CE] : [])], hand[1] ? [CE] : []] });
    t.grantFor(0, 1, CE); t.grantFor(1, 1, CE);
    if (mensch0) { t.engine._isSelfPlay = false; t.engine._cpuPlayerIdx = 1; }   // Sitz 0 „Mensch", Sitz 1 CPU
    t.put(1, 1, 0, H.INERT.frail);
    await t.play(0, 'Trial of Dominance', { hero: 0 });
    return t;
  };
  R.section('(a) gegnerische Kreatur ohne Schaden besiegt');
  { const t = await laufA('Mensch am Zug', { mensch0: true, hand: [true, false] });
    R.check('Kreatur besiegt', t.inst(i => i.zone === 'support' && i.owner === 1).length === 0);
    R.check('Sitz 0 (Gegner des Kontrolleurs, Mensch) bekommt das Fenster Corpse Explosion', t.prompts.some(p => p.pi === 0 && p.d.title === CE), t.prompts.map(p => p.pi + ':' + p.d.title));
    R.check('Die Explosion trifft den Gegner der gefallenen Kreatur (= Sitz 0): 750 je Held, Sitz 1 unversehrt', hps(t, 0).every(h => h === 750) && hps(t, 1).every(h => h === 800), [hps(t, 0), hps(t, 1)]);
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  { const t = await laufA('beide CPU', { mensch0: false, hand: [true, false] });
    R.check('Gegenprobe beide CPU: Sitz 0 bekommt KEIN Fenster (Gegner-Durchgang nur für Menschen)', !t.prompts.some(p => p.pi === 0 && p.d.title === CE), t.prompts.map(p => p.pi + ':' + p.d.title));
    R.check('kein Schaden', hps(t, 0).every(h => h === 800) && hps(t, 1).every(h => h === 800), [hps(t, 0), hps(t, 1)]); }
  { const t = await laufA('Kontrolleur', { mensch0: true, hand: [false, true] });
    R.check('Gegenprobe Kontrolleur: Sitz 1 behält sein eigenes Fenster und trifft Sitz 0 (750)', t.prompts.some(p => p.pi === 1 && p.d.title === CE) && hps(t, 0).every(h => h === 750), [t.prompts.map(p => p.pi + ':' + p.d.title), hps(t, 0)]);
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  // ── (c) ────────────────────────────────────────────────────────────────
  R.section('(c) dauerhaft übernommener Held, Besiegen ohne Schaden');
  for (const hatOwnerCE of [false, true]) {
    const t = await H.fresh({ hand: [[CE], hatOwnerCE ? [CE] : []] });
    t.grantFor(0, 1, CE); t.grantFor(1, 1, CE);
    await t.engine.actionTakeHeroPermanently(0, 1, 0); await sleep(300);   // Sitz 0 übernimmt Held 1:0 dauerhaft
    await t.run(() => t.engine.actionDefeatHero({ name: 'Hand of Death', owner: 1, heroIdx: 0, controller: 1, counters: {} }, t.hero(1, 0), {}));
    const lbl = hatOwnerCE ? 'auch der Besitzer hält Corpse Explosion' : 'nur der Kontrolleur hält sie';
    R.check(`(${lbl}) Held 1:0 besiegt`, t.hp(1, 0) <= 0, t.hp(1, 0));
    R.check(`(${lbl}) der KONTROLLEUR (Sitz 0) bekommt das Fenster`, t.prompts.some(p => p.pi === 0 && p.d.title === CE), t.prompts.map(p => p.pi + ':' + p.d.title));
    R.check(`(${lbl}) der Besitzer (Sitz 1) bekommt KEIN Fenster`, !t.prompts.some(p => p.pi === 1 && p.d.title === CE), t.prompts.map(p => p.pi + ':' + p.d.title));
    R.check(`(${lbl}) Explosion trifft den Gegner des Kontrolleurs: Sitz 1 (übrige Helden) 750, Sitz 0 unversehrt`, t.hp(1, 1) === 750 && t.hp(1, 2) === 750 && hps(t, 0).every(h => h === 800), [hps(t, 0), hps(t, 1)]);
    R.check(`(${lbl}) sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  }
  { // Gegenprobe: eigener, nicht übernommener Held
    const t = await H.fresh({ hand: [[], [CE]] });
    t.grantFor(1, 1, CE);
    await t.run(() => t.engine.actionDefeatHero({ name: 'Hand of Death', owner: 0, heroIdx: 0, controller: 0, counters: {} }, t.hero(1, 0), {}));
    R.check('Gegenprobe eigener Held ohne Schaden besiegt: Sitz 1 bekommt sein Fenster, Sitz 0 verliert 50 je Held', t.prompts.some(p => p.pi === 1 && p.d.title === CE) && hps(t, 0).every(h => h === 750), [t.prompts.map(p => p.pi + ':' + p.d.title), hps(t, 0)]);
    R.check('sauber', t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() }); }
  R.finish();
})();
