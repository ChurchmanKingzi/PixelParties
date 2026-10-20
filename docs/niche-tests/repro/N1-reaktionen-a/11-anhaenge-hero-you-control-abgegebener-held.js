'use strict';
// N1-11 · „Attach this Spell to a Hero you control": Divine Awakening / Call of the Deepsea bieten einen ABGEGEBENEN eigenen Helden als Wirt an; Divine Awakening schließt einen ÜBERNOMMENEN Helden aus
// Kartentexte: Divine Awakening „Attach this Spell to a Hero you control. That Hero can Ascend … without fulfilling its Ascension Conditions."
//              Call of the Deepsea „Attach this card to a Hero you control. …"
// Ruling Welle 22 (Al 20.10.): „Karten mit ‚Hero you control': Nur der aktuelle Kontrolleur, inklusive eines temporären Kontrolleurs" (Ist-Zustand für Skeleton Necromancer, Layn, Deepsea Bats, Guard Change,
//   Reincarnation, Lone Survivor; Dark Deepsea God, Staff of Illusions, Cloudy Slime nachgezogen). Divine Awakening und Call of the Deepsea stehen nicht auf dieser Liste.
// Skripte: `candidateHosts` (`_attachment-shared.js`) nimmt ohne `opts.sides` die komplette EIGENE Spalte (auch Helden, die der Gegner dauerhaft übernommen hat) und die übernommenen Helden der Gegenspalte
//   (`fremdAusruestHelden`); Divine Awakening filtert zusätzlich hart auf `side === pi` (`legaleZiele`, `heroFilter`) – ein übernommener Gegnerheld mit Ascended-Form fällt heraus.
// Aufbau: Sitz 0 hat Fern, the Ship Slave (hat eine Ascended-Form) in 0:0 – bzw. Sitz 1 hat ihn in 1:0 und Sitz 0 hat ihn dauerhaft übernommen; Karten: Divine Awakening, Call of the Deepsea.
// Erwartet (nach W22): der abgegebene Held 0:0 ist KEIN Wirt; der übernommene Held 1:0 ist ein Wirt (bei Divine Awakening, da er eine Ascended-Form hat).
// Beobachtet: abgegeben → 0:0 wird als Wirt angeboten (beide Karten); übernommen → Divine Awakening bietet 1:0 nicht an (Call of the Deepsea schon).
const H = require('../../lib/h.js');
const { loadCardEffect } = require('../../../../cards/effects/_loader.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const hostsVon = async (karte, variante) => {
  const t = await H.fresh({ hand: [[karte], []] });
  t.setHero(0, 0, 'Fern, the Ship Slave', 800); t.setHero(0, 1, 'Kohta, the Silent Observer', 800); t.setHero(0, 2, 'Fiona, the Princess of the Forgotten', 800);
  t.setHero(1, 0, 'Fern, the Ship Slave', 800);
  if (variante === 'abgegeben') { await t.engine.actionTakeHeroPermanently(1, 0, 0); await sleep(250); }
  if (variante === 'uebernommen') { await t.engine.actionTakeHeroPermanently(0, 1, 0); await sleep(250); }
  const sc = loadCardEffect(karte);
  return [...new Set(sc.attachmentHosts(t.gs, 0, t.engine).map(h => h.owner + ':' + h.heroIdx))];
};
(async () => {
  const R = H.runner();
  for (const karte of ['Divine Awakening', 'Call of the Deepsea']) {
    const normal = await hostsVon(karte, 'normal');
    R.check(`${karte}, Gegenprobe ohne Übernahme: eigener Held 0:0 ist Wirt`, normal.includes('0:0'), normal);
    const abg = await hostsVon(karte, 'abgegeben');
    R.check(`${karte}: an den Gegner abgegebener Held 0:0 ist KEIN Wirt`, !abg.includes('0:0'), abg);
    const ueb = await hostsVon(karte, 'uebernommen');
    R.check(`${karte}: von mir übernommener Gegnerheld 1:0 (hat Ascended-Form) ist ein Wirt`, ueb.includes('1:0'), ueb);
  }
  R.finish();
})();
