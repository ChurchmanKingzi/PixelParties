'use strict';
// W75 · Darion · P6 (Engine `kreaturImPlatz`, `getCreatureTargets`, `promptDamageTarget`/`promptMultiTarget`-Sammler, `istEquipArtifact`) — Tempeste Moana macht aus einem Instrument eine Creature
// (wirksame Daten „Artifact/Creature", bleibt Equipment). Liegt es in Darions Equip-Stapel und ist NICHT die erste Karte, muss es als Kreaturenziel waehlbar sein; die uebrigen Equips des Stapels
// (Cute Crown …) sind keine Kreaturen-Ziele und duerfen weder angeboten noch getroffen werden.
// Kartentext Tempeste Moana: „… once per turn, Rain Viola / Thunder Trumpet / Storm Piano … counts as a Creature (50 HP)"; Darion: „All Artifacts equipped to this Hero share 1 Support Zone."
// Erwartet: Stapel [Cute Crown, Thunder Trumpet(Creature), Club]: `getCreatureTargets` liefert EIN Ziel fuer den Platz, dessen Karte das Trompeten-Instrument ist, mit der einzigen waehlbaren
// Instanz = Trompete (keine Rueckfrage unter den Equips). Auch `istEquipArtifact` erkennt das Instrument weiter als Equip (Pflicht-Platz beim Umhaengen).
// Aufruf: node docs/niche-tests/repro/W75/h-P6-09-moana-kreatur-im-equip-stapel-ziele.js   (Exit 0 = korrekt)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', T = 'Tushu, the Knowledge Keeper', TT = 'Thunder Trumpet';
(async () => {
  const R = H.runner();
  for (const pos of [0, 1, 2]) {
    R.section('Trompete (Creature) an Stapelposition ' + pos);
    const t = await H.fresh({ active: 0, heroes: [[T, null, null], [D, null, null]], hand: [[], []] });
    const namen = ['Cute Crown', 'Club of Gobbo'];
    namen.splice(pos, 0, TT);
    const ps = t.gs.players[1];
    ps.supportZones[0][1] = [];
    const ins = namen.map(n => { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, 1, 'support', 0, 1); i.turnPlayed = 1; return i; });
    const trompete = ins.find(i => i.name === TT);
    const cd = t.engine._getCardDB()[TT];
    trompete.counters._moanaCreature = true;
    trompete.counters._cardDataOverride = { ...cd, cardType: 'Artifact/Creature', hp: 50, level: 0 };
    trompete.counters.currentHp = 50; trompete.counters.maxHp = 50;
    R.check('istEquipArtifact erkennt das Instrument (Artifact/Creature) weiter als Equip', t.engine.istEquipArtifact(trompete) === true);
    const ziele = t.engine.getCreatureTargets(1).filter(z => z.owner === 1 && z.slotIdx === 1);
    R.note('ziele', JSON.stringify(ziele.map(z => ({ id: z.id, name: z.cardName, erl: z._erlaubteInstanzen }))));
    R.check('genau ein Kreaturenziel fuer den Platz, und es ist die Trompete', ziele.length === 1 && ziele[0].cardInstance === trompete && ziele[0].cardName === TT, ziele.map(z => z.cardName));
    R.check('waehlbare Instanzen: nur die Trompete', JSON.stringify(ziele[0]?._erlaubteInstanzen) === JSON.stringify([trompete.id]), ziele[0]?._erlaubteInstanzen);
    // Zielwahl-Abschluss: keine Rueckfrage unter den Equips, die Wahl bleibt die Trompete
    t.engine.isCpuPlayer = () => false;
    await t.run(() => t.engine._zielwahlAbschliessen(1, ziele, { maxTotal: 1 }, [ziele[0].id]));
    R.check('keine Rueckfrage „welches Equip?"', t.prompts.filter(p => p.d.type === 'instancePick').length === 0, t.prompts.map(p => p.d.type));
    R.check('gewaehlt ist die Trompete', ziele[0].cardInstance === trompete, ziele[0].cardName);
    R.check('Sauber', t.errors.length === 0 && t.audit().length === 0, [t.errors, t.audit()]);
  }
  R.finish();
})();
