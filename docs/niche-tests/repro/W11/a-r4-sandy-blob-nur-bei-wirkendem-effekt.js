'use strict';
// W11a · R4 (Sandy Blob, „you may"-Ablehnung oder Suchen ohne Treffer) · Al, 15.10.2026: „Nein, die sollen auch nicht auslösen. Nur ein wirklich feuernder Effekt löst Sandy Blob aus!"
//   Sandy Blob: „… when the on-summon effect of a Creature you control activates …"
// Erwartet: Ein abgelehntes „you may" oder ein leeres Suchen/Wählen (Kandidatenmenge leer, kein Treffer, Wahl abgebrochen) ist KEIN feuernder On-Summon-Effekt:
//   der Blob öffnet sein Zielfenster nicht. Wirkt der Effekt (Regression), öffnet es sich wie bisher.
//   Geprüft über die Familien: Harpyformers (Ballad, Ska …), Sparkfly Architect/Worker, Deepsea (Mummy, Werewolf, Witch, Reaper, Skeleton, Stein),
//   Black Marketeer, Festive Werz, Loyal Pinpom, Barkeeper, Red Dragoneer, Aquanian Orkallion, Slimes (Fiery …), Tamed Hell Fox, Cycling Demons.
const H = require('../../lib/h.js');
(async () => {
  const R = H.runner();
  const blob = (t) => t.targets.filter(x => x.config && x.config.title === 'Sandy Blob').length;
  const mk = async (name, o = {}) => {
    const t = await H.fresh({ hand: [[name, ...(o.hand || [])], []], deck: [o.deck || Array(10).fill(H.INERT.filler), []], discard: [o.discard || [], []], gold: o.gold ?? 100 });
    t.setAbilities(0, 0, [['Summoning Magic'], [], []]);
    t.put(0, 0, 2, 'Sandy Blob').turnPlayed = 1;
    t.put(1, 0, 0, H.INERT.big);
    t.targetFn = (valid, cfg) => (cfg && cfg.title === 'Sandy Blob') ? [valid[0].id] : (o.target ? [valid[0].id] : null);
    t.policy.confirm = true;
    if (o.decline) t.script.push({ match: d => d.type === 'confirm' && d.title === name, answer: () => null });
    if (o.galleryCancel) t.script.push({ match: d => /ardGallery/.test(d.type), answer: () => null });
    if (o.galleryFirst) t.script.push({ match: d => /ardGallery/.test(d.type) && !/ardGalleryMulti/.test(d.type), answer: (d) => ({ cardName: d.cards[0].name }) });
    return t;
  };
  const fall = async (titel, name, o, erwartetBlob) => {
    const t = await mk(name, o);
    const r = await t.play(0, name, { hero: 0, slot: 0, extra: 3 });
    const da = !!t.find(name, 'support');
    const b = blob(t);
    R.check(`${titel}: ${name} beschworen`, r === true && da, { r });
    R.check(`${titel}: Sandy Blob ${erwartetBlob ? 'löst aus' : 'bleibt stumm'}`, erwartetBlob ? b >= 1 : b === 0, { blob: b, prompts: t.prompts.map(p => p.d.type + ':' + (p.d.title || '')) });
    R.check(`${titel}: keine Engine-Fehler / Zustand sauber`, t.errors.length === 0 && t.audit().length === 0, { e: t.errors, a: t.audit() });
  };
  // Harpyformers: abgelehnt / kein Treffer im Deck / Treffer
  for (const [n, ab] of [['Ballad Harpyformer', 'Support Magic'], ['Ska Harpyformer', 'Performance'], ['Metal Harpyformer', 'Fighting']]) {
    await fall('Harpyformer abgelehnt', n, { deck: [ab, ...Array(9).fill(H.INERT.filler)], decline: true }, false);
    await fall('Harpyformer kein Treffer im Deck', n, {}, false);
  }
  await fall('Harpyformer mit Treffer (Regression)', 'Ballad Harpyformer', { deck: ['Support Magic', ...Array(9).fill(H.INERT.filler)] }, true);
  // Sparkfly Architect: kein Sparkfly im Deck / abgelehnt
  await fall('Sparkfly Architect kein Treffer', 'Sparkfly Architect', {}, false);
  await fall('Sparkfly Architect mit Treffer (Regression)', 'Sparkfly Architect', { deck: ['Sparkfly Worker', ...Array(9).fill(H.INERT.filler)], galleryFirst: true }, true);
  await fall('Sparkfly Architect Galerie abgebrochen', 'Sparkfly Architect', { deck: ['Sparkfly Worker', ...Array(9).fill(H.INERT.filler)], galleryCancel: true }, false);
  // Deepsea: abgelehnt (zentral über promptOptionalOnSummon), mit Ziel (Regression)
  await fall('Deepsea Mummy abgelehnt', 'Deepsea Mummy', { decline: true }, false);
  await fall('Deepsea Mummy mit Ziel (Regression)', 'Deepsea Mummy', { target: true }, true);
  await fall('Deepsea Reaper ohne andere Kreatur', 'Deepsea Reaper', {}, false);
  await fall('Deepsea Witch kein Deepsea im Deck', 'Deepsea Witch', {}, false);
  await fall('Deepsea Werewolf Ziel abgebrochen', 'Deepsea Werewolf', {}, false);
  await fall('Deepsea Werewolf mit Ziel (Regression)', 'Deepsea Werewolf', { target: true }, true);
  // Sonstige: Black Marketeer (leere Ablage), Festive Werz (Gold 0), Barkeeper (Hand voll), Loyal Pinpom (kein Loyal), Red Dragoneer (kein Drago), Fiery Slime (Ziel abgebrochen)
  await fall('Black Marketeer leere Ablage', 'Black Marketeer', {}, false);
  await fall('Festive Werz ohne Gold', 'Festive Werz', { gold: 0 }, false);
  await fall('Barkeeper bei voller Hand', 'Barkeeper', { hand: Array(7).fill(H.INERT.filler) }, false);
  await fall('Loyal Pinpom ohne Loyal in der Hand', 'Loyal Pinpom', {}, false);
  await fall('Red Dragoneer ohne Drago im Deck', 'Red Dragoneer', {}, false);
  await fall('Fiery Slime Ziel abgebrochen', 'Fiery Slime', {}, false);
  await fall('Fiery Slime mit Ziel (Regression)', 'Fiery Slime', { target: true }, true);
  // Tamed Hell Fox / Cycling Demon: von der Hand beschworen = Bedingung („via an effect" / „with the effect of …") trifft nicht zu
  await fall('Tamed Hell Fox von der Hand', 'Tamed Hell Fox', {}, false);
  await fall('Hydrogen Demon von der Hand', 'Hydrogen Demon', {}, false);
  // Unbedingte Effekte feuern weiter (Regression)
  await fall('Frolake (draw 2) feuert', 'Frolake', {}, true);
  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
