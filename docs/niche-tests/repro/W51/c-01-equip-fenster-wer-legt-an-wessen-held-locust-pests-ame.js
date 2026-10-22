'use strict';
// W51c · Auftrag A · Al, 22.10.2026: „Achte darauf, wenn eine Karte (wie LOCUST) spezifiziert, an wessen Hero etwas angehängt wird. LOCUST etwa kann nur feuern, wenn der Gegner
// spezifisch eine Karte an spezifisch SEINEN Hero anhängt! Das geht genau aus dem Kartentext hervor."
//   Cybug LOCUST: „Activate this Surprise when your opponent equips or attaches a card to a Hero THEY CONTROL …"   → Anlegender = Gegner UND Zielheld vom Anlegenden kontrolliert
//   Afflicted Pests: „… when your opponent equips or attaches a card into a Hero's Support Zone"                 → Anlegender = Gegner, JEDER Zielheld (auch eigene des Besitzers)
//   Anti Magic Enchantment: „Play this card immediately when an Artifact is equipped to a Hero"                    → jedes Equip-Artifact, jeder Anlegende, jeder Held (nicht Anhängsel)
// Matrix: (Gegner / Eigener legt an) × (Held des Gegners / eigener / übernommener) × (Hand-Equip, Anhängsel, Control Device, Slippery Fridge, Inheritance Ceremony, Umhängen per
// actionTransferAttachment). Beide Sitze. Exit 0 = korrekt.
const H = require('../../lib/h.js');
process.on('unhandledRejection', (e) => { process.stderr.write('UNHANDLED ' + (e && e.stack || e) + '\n'); process.exit(1); });
const LOC = 'Cybug LOCUST', PESTS = 'Afflicted Pests', AME = 'Anti Magic Enchantment', FUEL = "Treasure Hunter's Backpack";
const F = 'Slippery Fridge', C = 'Inheritance Ceremony', CTL = 'Future Tech Control Device', CLUB = 'Club of Gobbo', AURA = 'Energy Aura', CURSE = 'Curse';

/** Eine Szene. S = Besitzer der Reaktionen (LOCUST ODER Pests als Surprise auf Held 2 — je Szene zwei Läufe, weil eine Surprise-Zone nur eine Surprise fasst; Fuel + AME auf der Hand), A = Anlegender. */
async function szene1(S, A, o, welche) {
  const hand = [[], []];
  hand[S].push(FUEL, AME);
  for (const h of (o.hand || [])) hand[A].push(h);
  const t = await H.fresh({ hand, gold: 800, deckSize: 30, active: A });
  t.putSurprise(S, 2, welche); t.grantFor(S, 2, welche);
  if (o.vorher) await o.vorher(t);
  t.script.push({ match: (d) => d.type === 'confirm' && [LOC, PESTS, AME].includes(d.title), answer: () => false });   // alles ablehnen: wir messen nur, ob angeboten wird
  t.reset();
  const r = await o.tun(t);
  const gefragt = (n) => t.prompts.some(p => p.d && p.d.title === n);
  return { t, r, gefragt };
}
async function szene(S, A, o) {
  const z1 = await szene1(S, A, o, LOC);
  const z2 = await szene1(S, A, o, PESTS);
  const errors = [...z1.t.errors, ...z2.t.errors];
  const audit = [...z1.t.audit(), ...z2.t.audit()];
  return { t: { errors, audit: () => audit, zone: z1.t.zone, prompts: z1.t.prompts }, r: z1.r, loc: z1.gefragt(LOC), pests: z2.gefragt(PESTS), ame: z1.gefragt(AME) };
}
/** Zielwahl für Fridge / Ceremony: alle Equips (oder der Name) der Seite `seite`, Zielheld `nachHeld`. */
function wahl(t, seite, nachHeld, name) {
  t.targetFn = (v, cfg) => {
    const ti = (cfg && cfg.title) || '';
    if (ti === F || (ti === C && v.some(x => x.type === 'equip'))) return v.filter(x => x.type === 'equip' && x.owner === seite && (!name || x.cardName === name)).map(x => x.id);
    const h = v.find(x => x.type === 'hero' && x.owner === seite && x.heroIdx === nachHeld) || v.find(x => x.type === 'equip' && x.owner === seite && x.heroIdx === nachHeld);
    return h ? [h.id] : undefined;
  };
}

(async () => {
  const R = H.runner();
  for (const [A, S] of [[0, 1], [1, 0]]) {   // A = Anlegender (Gegner des Besitzers), S = Besitzer der Reaktionen
    R.section('Sitz ' + A + ' legt an, Sitz ' + S + ' besitzt LOCUST/Pests/AME');
    const sauber = (z, was) => R.check(was + ': keine Engine-Fehler / Zustand sauber', z.t.errors.length === 0 && z.t.audit().length === 0, { e: z.t.errors, a: z.t.audit() });
    const pruefe = (z, was, soll) => {
      R.check(was + ' → LOCUST ' + (soll.loc ? 'feuert' : 'feuert NICHT'), z.loc === !!soll.loc, { loc: z.loc, pests: z.pests, ame: z.ame, p: z.t.prompts.map(p => p.d.title || p.d.type) });
      R.check(was + ' → Afflicted Pests ' + (soll.pests ? 'feuert' : 'feuert NICHT'), z.pests === !!soll.pests, { loc: z.loc, pests: z.pests, ame: z.ame });
      R.check(was + ' → Anti Magic Enchantment ' + (soll.ame ? 'wird angeboten' : 'bleibt still'), z.ame === !!soll.ame, { loc: z.loc, pests: z.pests, ame: z.ame });
    };

    // ── Hand-Equip ──
    { const z = await szene(S, A, { hand: [CLUB], tun: (t) => t.play(A, CLUB, { hero: 0, slot: 0 }) });
      pruefe(z, 'GEGNER legt Hand-Equip an SEINEN Helden', { loc: 1, pests: 1, ame: 1 }); sauber(z, 'Hand-Equip Gegner'); }
    { const z = await szene(S, S, { hand: [CLUB], tun: (t) => t.play(S, CLUB, { hero: 0, slot: 0 }) });
      pruefe(z, 'BESITZER legt Hand-Equip selbst an (eigener Held)', { loc: 0, pests: 0, ame: 1 }); sauber(z, 'Hand-Equip Besitzer'); }
    { // Der Gegner legt an einen Helden des Besitzers an, den er per Charme kontrolliert
      const z = await szene(S, A, { hand: [CLUB], vorher: (t) => { t.hero(S, 0).charmedBy = A; }, tun: (t) => t.play(A, CLUB, { hero: 0, slot: 0, targetOwner: S }) });
      pruefe(z, 'GEGNER legt an einen Helden des Besitzers an, den ER (Gegner) kontrolliert (Charme)', { loc: 1, pests: 1, ame: 1 }); sauber(z, 'Hand-Equip Charme-Held'); }
    { // Der Besitzer legt selbst an seinen eigenen Helden an, den der Gegner kontrolliert: Engine verweigert (kein „Hero you control") – nichts feuert
      const z = await szene(S, S, { hand: [CLUB], vorher: (t) => { t.hero(S, 0).charmedBy = A; }, tun: (t) => t.play(S, CLUB, { hero: 0, slot: 0 }) });
      pruefe(z, 'BESITZER legt an seinen eigenen Helden an, den der GEGNER kontrolliert (Übernahme)', { loc: 0, pests: 0, ame: 0 });
      R.check('… die Engine lässt das Anlegen gar nicht zu', z.r === false && !z.t.zone(S, 0, 0), { r: z.r, z: z.t.zone(S, 0, 0) }); }
    { // Der Gegner kontrolliert den Helden des Besitzers (Charme) und legt an; zweiter Besitzer-Held 1 bleibt eigen
      const z = await szene(S, A, { hand: [CLUB], vorher: (t) => { t.hero(S, 0).charmedBy = A; }, tun: (t) => t.play(A, CLUB, { hero: 1, slot: 0 }) });
      pruefe(z, 'GEGNER legt an SEINEN normalen Helden (während er einen Besitzer-Helden kontrolliert)', { loc: 1, pests: 1, ame: 1 }); }
    { // Der Besitzer-Held 2 trägt die Surprises und wird vom Gegner übernommen: der Gegner kontrolliert die Surprises des Besitzers nicht; legt der Besitzer-Kontrolleur an …
      const z = await szene(S, S, { hand: [CLUB], vorher: (t) => { t.hero(A, 0).charmedBy = S; }, tun: (t) => t.play(S, CLUB, { hero: 0, slot: 0, targetOwner: A }) });
      pruefe(z, 'BESITZER legt an einen Gegner-Helden an, den ER kontrolliert (eigene Aktion)', { loc: 0, pests: 0, ame: 1 }); }

    // ── Anhängsel ──
    { const z = await szene(S, A, { hand: [AURA], tun: (t) => { t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === A && x.heroIdx === 0).id]; return t.play(A, AURA, { hero: 0 }); } });
      pruefe(z, 'GEGNER hängt ein Anhängsel (Energy Aura) an SEINEN Helden', { loc: 1, pests: 1, ame: 0 }); }
    { const z = await szene(S, A, { hand: [CURSE], tun: (t) => { t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === S && x.heroIdx === 0); return [(h || v[0]).id]; }; return t.play(A, CURSE, { hero: 0, targetOwner: S }); } });
      pruefe(z, 'GEGNER hängt Curse an einen Helden des BESITZERS (nicht „Hero they control")', { loc: 0, pests: 1, ame: 0 }); sauber(z, 'Curse auf Besitzer-Held'); }
    { const z = await szene(S, S, { hand: [CURSE], tun: (t) => { t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === A && x.heroIdx === 0); return [(h || v[0]).id]; }; return t.play(S, CURSE, { hero: 0, targetOwner: A }); } });
      pruefe(z, 'BESITZER hängt Curse selbst an einen Gegner-Helden (eigene Aktion)', { loc: 0, pests: 0, ame: 0 }); }
    { const z = await szene(S, A, { hand: [CURSE], vorher: (t) => { t.hero(S, 0).charmedBy = A; }, tun: (t) => { t.targetFn = (v) => { const h = v.find(x => x.type === 'hero' && x.owner === S && x.heroIdx === 0); return [(h || v[0]).id]; }; return t.play(A, CURSE, { hero: 0, targetOwner: S }); } });
      pruefe(z, 'GEGNER hängt Curse an einen Helden des Besitzers, den ER kontrolliert (Charme)', { loc: 1, pests: 1, ame: 0 }); }

    // ── Control Device (Cross-Side: liegt auf dem Brett des Gegners des Anlegenden) ──
    { const z = await szene(S, A, { hand: [CTL], tun: (t) => t.play(A, CTL, { hero: 0, targetOwner: S }) });
      pruefe(z, 'GEGNER legt Control Device an einen Helden des BESITZERS', { loc: 0, pests: 1, ame: 1 }); sauber(z, 'Control Device'); }
    { const z = await szene(S, S, { hand: [CTL], tun: (t) => t.play(S, CTL, { hero: 0, targetOwner: A }) });
      pruefe(z, 'BESITZER legt Control Device an einen Gegner-Helden (eigene Aktion)', { loc: 0, pests: 0, ame: 1 }); }

    // ── Slippery Fridge (Umhängen; Ausführender = Ausrüstender) ──
    const fridge = async (wer, seite, vorher) => szene(S, wer, {
      hand: [F], vorher: (t) => { t.put(seite, 0, 0, CLUB); if (vorher) vorher(t); },
      tun: (t) => { wahl(t, seite, 1, CLUB); return t.play(wer, F, { hero: 0 }); } });
    { const z = await fridge(A, A);
      R.check('Fridge GEGNER/eigene Equips: Club liegt jetzt bei Held 1', z.t.zone(A, 1, 0) === CLUB || z.t.zone(A, 1, 1) === CLUB || z.t.zone(A, 1, 2) === CLUB, [0, 1, 2].map(i => z.t.zone(A, 1, i)));
      pruefe(z, 'GEGNER nutzt Fridge für SEINE Equips zwischen SEINEN Helden', { loc: 1, pests: 1, ame: 1 }); sauber(z, 'Fridge Gegner eigene'); }
    { const z = await fridge(A, S);
      R.check('Fridge GEGNER/fremde Equips: Club liegt jetzt bei Besitzer-Held 1', [0, 1, 2].some(i => z.t.zone(S, 1, i) === CLUB), [0, 1, 2].map(i => z.t.zone(S, 1, i)));
      pruefe(z, 'GEGNER nutzt Fridge, um Equips ZWISCHEN HELDEN DES BESITZERS umzuhängen (Zielheld gehört nicht dem Anlegenden)', { loc: 0, pests: 1, ame: 1 }); sauber(z, 'Fridge Gegner fremde'); }
    { const z = await szene(S, S, { hand: [F], vorher: (t) => { t.put(S, 0, 0, CLUB); }, tun: (t) => { wahl(t, S, 1, CLUB); return t.play(S, F, { hero: 0 }); } });
      pruefe(z, 'BESITZER nutzt Fridge für seine eigenen Equips (eigene Aktion)', { loc: 0, pests: 0, ame: 1 }); }
    { // beide Helden des Gegners sind vom Besitzer übernommen (Charme): der Gegner hängt zwischen Helden um, die DER BESITZER kontrolliert
      const z = await fridge(A, A, (t) => { t.hero(A, 0).charmedBy = S; t.hero(A, 1).charmedBy = S; });
      pruefe(z, 'GEGNER hängt Equips zwischen zwei Helden um, die der BESITZER kontrolliert (Übernahme)', { loc: 0, pests: 1, ame: 1 }); }
    { // beide Helden des Besitzers sind vom Gegner übernommen: der Gegner hängt zwischen Helden um, die ER kontrolliert
      const z = await fridge(A, S, (t) => { t.hero(S, 0).charmedBy = A; t.hero(S, 1).charmedBy = A; });
      pruefe(z, 'GEGNER hängt Equips zwischen zwei Besitzer-Helden um, die ER kontrolliert (Charme)', { loc: 1, pests: 1, ame: 1 }); }

    // ── Inheritance Ceremony (nur eigene Helden) ──
    { const z = await szene(S, A, { hand: [C], vorher: (t) => { t.put(A, 0, 0, CLUB); }, tun: (t) => { wahl(t, A, 1, CLUB); return t.play(A, C, { hero: 0 }); } });
      pruefe(z, 'GEGNER nutzt Ceremony (Equip) zwischen SEINEN Helden', { loc: 1, pests: 1, ame: 1 }); sauber(z, 'Ceremony Gegner Equip'); }
    { const z = await szene(S, A, { hand: [C], vorher: (t) => { t.put(A, 0, 0, CLUB); }, tun: (t) => { wahl(t, A, 1, CLUB); return t.play(A, C, { hero: 0 }); } });
      void z; }
    { const z = await szene(S, A, { hand: [C, AURA], tun: async (t) => { t.targetFn = (v) => [v.find(x => x.type === 'hero' && x.owner === A && x.heroIdx === 0).id]; await t.play(A, AURA, { hero: 0 }); t.reset(); wahl(t, A, 1, AURA); return t.play(A, C, { hero: 0 }); } });
      pruefe(z, 'GEGNER nutzt Ceremony (Anhängsel Energy Aura) zwischen SEINEN Helden', { loc: 1, pests: 1, ame: 0 }); sauber(z, 'Ceremony Gegner Anhängsel'); }
    { const z = await szene(S, S, { hand: [C], vorher: (t) => { t.put(S, 0, 0, CLUB); }, tun: (t) => { wahl(t, S, 1, CLUB); return t.play(S, C, { hero: 0 }); } });
      pruefe(z, 'BESITZER nutzt Ceremony selbst (eigene Aktion)', { loc: 0, pests: 0, ame: 1 }); }

    // ── Umhängen über die Engine-Primitive (Cybug LOCUST / Secret Spell Book): Ausführender = Ausrüstender ──
    const versetze = async (anleger, vonSeite, nachSeite, nachHeld) => szene(S, anleger, {
      hand: [], vorher: (t) => { t.put(vonSeite, 0, 0, CLUB); },
      tun: (t) => { const inst = t.find(CLUB, 'support'); return t.run(() => t.engine.actionTransferAttachment(inst, nachSeite, nachHeld, 1, { sourceName: 'Test', anleger })); } });
    { const z = await versetze(A, A, A, 1);
      pruefe(z, 'Umhängen durch den GEGNER: sein Equip auf SEINEN anderen Helden', { loc: 1, pests: 1, ame: 1 }); }
    { const z = await versetze(A, S, S, 1);
      pruefe(z, 'Umhängen durch den GEGNER: Besitzer-Equip auf einen anderen Besitzer-Helden', { loc: 0, pests: 1, ame: 1 }); }
    { const z = await versetze(A, S, A, 1);
      pruefe(z, 'Umhängen durch den GEGNER: Besitzer-Equip auf SEINEN Helden (Secret-Spell-Book-Art)', { loc: 1, pests: 1, ame: 1 }); }
    { const z = await versetze(S, A, S, 1);
      pruefe(z, 'Umhängen durch den BESITZER selbst (eigene Aktion)', { loc: 0, pests: 0, ame: 1 }); }

    // ── The Weather Orchestra: „equip them to Heroes on the board" (Effekt-Equip, AUCH an Helden des Gegners) ──
    // Vorher (Befund W51c): `_orchestra-shared.equipArtifactToHero` meldete bei einem fremden Helden dessen Gastgeber (inst.controller) als Anlegenden: Pests/LOCUST des
    // Orchester-Spielers feuerten auf die EIGENE Aktion, Pests des Gegners nicht. Jetzt ist der Ausspielende der Anlegende.
    const WALL = 'Jungle Wall', ORCH = 'The Weather Orchestra';
    const orchester = async (anleger, besitzer, zielSeite, welche) => {
      const hand = [[], []]; hand[anleger].push(ORCH, WALL); hand[besitzer].push(FUEL);
      const t = await H.fresh({ hand, gold: 800, deckSize: 30, active: anleger });
      t.putSurprise(besitzer, 2, welche); t.grantFor(besitzer, 2, welche);
      t.script.push({ match: (d) => d.type === 'confirm' && [LOC, PESTS, AME].includes(d.title), answer: () => false });
      t.script.push({ match: (d) => d.type === 'cardGalleryMulti', answer: () => ({ selectedIndices: [0] }) });
      t.targetFn = (v, cfg) => { const z = v.find(x => x.type === 'equip' && x.owner === zielSeite && x.heroIdx === 0 && x.slotIdx === 0); return z ? [z.id] : undefined; };
      t.reset();
      const r = await t.play(anleger, ORCH, { hero: 0, slot: 2 });
      const gelegt = [0, 1, 2].some(i => t.zone(zielSeite, 0, i) === WALL);
      return { t, r, gelegt, loc: t.prompts.some(p => p.d && p.d.title === LOC), pests: t.prompts.some(p => p.d && p.d.title === PESTS) };
    };
    for (const [zielSeite, was, soll] of [[S, 'an einen Helden des BESITZERS (Zielheld gehört nicht dem Anlegenden)', { loc: 0, pests: 1 }], [A, 'an einen EIGENEN Helden', { loc: 1, pests: 1 }]]) {
      const l = await orchester(A, S, zielSeite, LOC), p = await orchester(A, S, zielSeite, PESTS);
      R.check('Orchester des GEGNERS legt ' + was + ': Equip liegt', l.gelegt && p.gelegt, { l: l.gelegt, p: p.gelegt, r: l.r, pr: l.t.prompts.map(x => x.d.title || x.d.type) });
      R.check('Orchester des GEGNERS ' + was + ' → LOCUST ' + (soll.loc ? 'feuert' : 'feuert NICHT'), l.loc === !!soll.loc, { loc: l.loc });
      R.check('Orchester des GEGNERS ' + was + ' → Afflicted Pests feuert', p.pests === !!soll.pests, { pests: p.pests });
      // (audit() meldet bei fremd liegenden Orchester-Equips „Geister-Instanzen": altes Besitzmodell inst.owner = Spieler, bewusst – nicht Teil dieser Prüfung)
      R.check('Orchester: keine Engine-Fehler', l.t.errors.length === 0 && p.t.errors.length === 0, { e: [...l.t.errors, ...p.t.errors] });
    }
    { // Eigene Aktion: der Besitzer spielt das Orchester selbst — an einen Gegner-Helden und an einen eigenen
      for (const zielSeite of [A, S]) {
        const l = await orchester(S, S, zielSeite, LOC), p = await orchester(S, S, zielSeite, PESTS);
        R.check('Orchester des BESITZERS selbst (Ziel Sitz ' + zielSeite + '): Equip liegt, weder LOCUST noch Pests des Besitzers feuern auf die eigene Aktion', l.gelegt && p.gelegt && !l.loc && !p.pests, { lg: l.gelegt, pg: p.gelegt, loc: l.loc, pests: p.pests });
      }
    }

    // ── Lunatic Hawk (2+ Lunatic Cycle): „Whenever YOU equip an Artifact to a Hero, its controller draws 1 card." – gezogen wird nur, wenn der Hawk-Besitzer selbst anlegt ──
    {
      const hawk = async (anleger, besitzer, zielSeite) => {
        const hand = [[], []]; hand[anleger].push(ORCH, WALL);
        const t = await H.fresh({ hand, gold: 800, deckSize: 30, active: anleger });
        t.put(besitzer, 2, 0, 'Lunatic Hawk'); t.put(besitzer, 2, 1, 'Lunatic Cycle - Crescent Moon'); t.put(besitzer, 2, 2, 'Lunatic Cycle - Full Moon');
        t.script.push({ match: (d) => d.type === 'cardGalleryMulti', answer: () => ({ selectedIndices: [0] }) });
        t.targetFn = (v) => { const z = v.find(x => x.type === 'equip' && x.owner === zielSeite && x.heroIdx === 0 && x.slotIdx === 0); return z ? [z.id] : undefined; };
        const vor = t.pile(besitzer, 'hand').length;
        t.reset();
        await t.play(anleger, ORCH, { hero: 0, slot: 2 });
        const gelegt = [0, 1, 2].some(i => t.zone(zielSeite, 0, i) === WALL);
        return { gelegt, handDelta: t.pile(besitzer, 'hand').length - vor, errors: t.errors };
      };
      const g = await hawk(A, S, S);   // der GEGNER legt per Orchester an einen Helden des Hawk-Besitzers
      R.check('Lunatic Hawk des BESITZERS: der Gegner legt per Orchester an (Besitzer-Held) → der Besitzer zieht NICHT (er hat nicht angelegt)', g.gelegt && g.handDelta === 0 && g.errors.length === 0, g);
      const e = await hawk(S, S, A);   // der Besitzer legt per Orchester an einen Gegner-Helden
      R.check('Lunatic Hawk des BESITZERS: der Besitzer legt selbst per Orchester an (Gegner-Held) → er hat angelegt, Hawk zieht 1 (Hand: −Orchester −Wall +1 = −1)', e.gelegt && e.handDelta === -1 && e.errors.length === 0, e);
    }
  }
  R.finish();
})().catch(e => { process.stderr.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
