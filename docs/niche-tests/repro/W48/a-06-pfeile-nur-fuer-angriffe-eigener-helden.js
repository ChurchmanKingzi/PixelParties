'use strict';
// W48a · Zusatz B · Al, 22.10.2026: Racket Arrow – und JEDER Arrow (Angelfeather, Bomb, Flame, Golden, Hydra Blood, Poisoned, Rainbow's, Racket) sowie Magic Topaz / Bow of the Hunt Goddess – ist eine Reaction
// („Play this card when a Hero YOU CONTROL performs an Attack") und darf NUR für Angriffe EIGENER Helden aktiviert/gekettet werden; Ketten an einen gegnerischen Angriff wären ein Fehler.
// Zentrale Prüfung: `_arrows-shared.arrowTriggerCondition` (Magic Topaz, alle Pfeile) bzw. `bow-of-the-hunt-goddess.equipReactionCondition`: `initial.owner === pi` (Besitzer des Anfangsglieds = der
// Spieler, der den Angriff AUSFÜHRT = Kontrolleur des angreifenden Helden).
// Matrix Quelle × Pfeil × Sitz mit Gegenprobe: eigener Angriff → der Pfeil des Angreifers wird angeboten; gegnerischer Angriff → der Pfeil des VERTEIDIGERS wird nie angeboten. Quellen: echte Attack-Karte,
// alle als-Attack-zählenden Effekte (Broghan, Brackle, Arthor, Heragas, Kohta, Javelin Throw, Sword in a Bottle, Crusader's ×4, Bamboo Staff, Sacrificial Dagger, Infected Greatmaw, Alluring Light [der gezwungene
// Gegner-Held ist der Angreifer: dessen Pfeile ja, die des Besitzers der Karte nein]), Aktivierung einer Attack-Surprise (Bluff, W47a), Kontrollwechsel (gecharmter Held: der KONTROLLEUR darf, der Besitzer nicht).
// Befund: kein Weg ließ einen Pfeil an einen gegnerischen Angriff ketten (Ist-Zustand korrekt, kein Code geändert) — Exit 0 auf Basis UND Branch.
// Aufruf: node docs/niche-tests/repro/W48/a-06-pfeile-nur-fuer-angriffe-eigener-helden.js   (Exit 0 = korrekt)
const { H, TREIBER, szene, sauber } = require('../W39/_helfer.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });

const PFEILE = ['Angelfeather Arrow', 'Bomb Arrow', 'Flame Arrow', 'Golden Arrow', 'Hydra Blood Arrow', 'Poisoned Arrow', 'Racket Arrow', "Rainbow's Arrow", 'Magic Topaz'];
/** Wurde `pi` der Pfeil `name` als Reaktion angeboten (Ja/Nein-Frage mit dem Kartentitel)? */
const angeboten = (t, pi, name) => t.prompts.some(p => p.pi === pi && p.d && (p.d.title === name || (p.d.type === 'cardGallery' && (p.d.cards || []).some(c => c.name === name))));
const QUELLEN = Object.keys(TREIBER).filter(k => TREIBER[k].kind === 'attack');

/** Pfeile in die Hand + Schulen für alle Helden des Besitzers, damit sie spielbar sind; Racket Arrow braucht eine Gegner-Kreatur. */
function pfeile(t, seite, gegner) {
  for (const a of PFEILE) { t.addHand(seite, a); }
  t.gs.players[seite].gold = 500;
  const c = t.put(gegner, 2, 2, H.INERT.creature); c.turnPlayed = 1;
}

(async () => {
  const R = H.runner();
  for (const [me, op] of [[0, 1], [1, 0]]) {
    R.section(`Sitz ${me} löst die Quelle aus — Pfeile des Verteidigers werden nie angeboten, die des Angreifers schon`);
    for (const q of QUELLEN) {
      const sp = TREIBER[q];
      // negativ: nur der VERTEIDIGER hält alle Pfeile
      const verteidiger = sp.angreifer === 'op' ? me : op, angreifer = sp.angreifer === 'op' ? op : me;
      const n = await szene(q, me, op, { vorbereiten: (t) => { pfeile(t, verteidiger, angreifer); } });
      const fremd = PFEILE.filter(a => angeboten(n.t, verteidiger, a));
      if (q === 'Duel') {
        // Duel: beide Helden schlagen abwechselnd — der Verteidiger ist bei seinem EIGENEN Schlag Angreifer; hier nur: kein Hänger, keine Fehler
        R.check(`Duel: kein Hänger/Fehler (Verteidiger-Pfeile dürfen bei seinem eigenen Schlag erscheinen: ${fremd.length})`, sauber(n.t), { e: n.t.errors });
        continue;
      }
      R.check(`${q}: Pfeile/Topaz des VERTEIDIGERS (Sitz ${verteidiger}) werden bei einem Angriff des Gegners nie angeboten`, fremd.length === 0 && sauber(n.t), { fremd, e: n.t.errors });
      // positiv: der Angreifer hält alle Pfeile
      const p = await szene(q, me, op, { vorbereiten: (t) => { pfeile(t, angreifer, verteidiger); } });
      const eigen = PFEILE.filter(a => angeboten(p.t, angreifer, a));
      R.check(`${q}: Gegenprobe — der Angreifer (Sitz ${angreifer}) bekommt seine Pfeile angeboten (${eigen.length} von ${PFEILE.length})`, eigen.length >= 1, { eigen });
    }

    R.section(`Sitz ${me}: Aktivierung einer Attack-Surprise (Bluff, W47a) — nur der Steuerer der Surprise darf seine Pfeile ketten`);
    {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: op, gold: 500 });
      t.putSurprise(me, 0, 'Bluff'); t.grantFor(me, 0, 'Bluff');
      pfeile(t, op, me);                      // Angreifer op hält Pfeile — sie gehören nicht zur Bluff-Aktivierung (Held des Gegners führt sie aus)
      for (const a of PFEILE) t.addHand(me, a);   // der Steuerer me hält ebenfalls welche
      const c = t.put(op, 2, 1, H.INERT.creature); c.turnPlayed = 1;
      t.addHand(op, 'Fireball'); t.targetFn = (v) => [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 0) || v[0]).id];
      await t.play(op, 'Fireball', { hero: 0 });
      const aufBluff = (pi, a) => t.prompts.some(p => p.pi === pi && p.d && (p.d.title === a || (p.d.cards || []).some(c => c.name === a)) && /Bluff was activated/.test(JSON.stringify(p.d)));
      R.check('Bluff-Aktivierung: kein Pfeil des Gegners (op) wird an die Bluff-Aktivierung von me gekettet', !PFEILE.some(a => aufBluff(op, a)), PFEILE.filter(a => aufBluff(op, a)));
      R.check('Bluff-Aktivierung: die Pfeile des Steuerers (me) werden angeboten (eigener Held „performs")', PFEILE.some(a => aufBluff(me, a)), PFEILE.filter(a => aufBluff(me, a)));
      R.check('sauber', sauber(t), { e: t.errors });
    }

    R.section(`Sitz ${me}: Kontrollwechsel — ein gecharmter Held (Kontrolleur = ${me}); der Kontrolleur darf, der Besitzer nicht`);
    {
      const t = await H.fresh({ hand: [[], []], hp: 800, deckSize: 20, active: me, gold: 500 });
      t.gs.players[op].heroes[0].charmedBy = me;   // Held 0 des Gegners wird von `me` kontrolliert
      pfeile(t, me, op); for (const a of PFEILE) t.addHand(op, a);
      for (let hi = 0; hi < 3; hi++) { t.grantFor(me, hi, 'Attack'); }
      t.addHand(me, 'Attack');
      t.targetFn = (v) => [(v.find(x => x.type === 'hero' && x.owner === me && x.heroIdx === 2) || v.find(x => x.owner === me) || v[0]).id];
      const r = await t.play(me, 'Attack', { hero: 0, charmedOwner: op });
      R.check('Charme: der Angriff mit dem übernommenen Held lief (play = true) und der Besitzer (Gegner) bekommt KEINE Pfeile angeboten', r === true && !PFEILE.some(a => angeboten(t, op, a)), { r, op: PFEILE.filter(a => angeboten(t, op, a)) });
      R.check('Charme: der Kontrolleur bekommt seine Pfeile angeboten', PFEILE.some(a => angeboten(t, me, a)), { me: PFEILE.filter(a => angeboten(t, me, a)) });
    }
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
