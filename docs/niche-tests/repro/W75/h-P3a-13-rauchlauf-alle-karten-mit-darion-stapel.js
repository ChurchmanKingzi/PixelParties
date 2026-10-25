'use strict';
// W75 · Darion (Audit P3a) — Rauchlauf: jede der 57 Spells (Untertyp Normal und Area) der Partition P3a wird gegen einen Darion-Stapel gespielt (Club / Blade / Crown in EINER Zone) —
//   (1) Stapel beim Gegner, (2) Stapel bei einem eigenen Helden, der nicht wirkt, (3) Darion selbst wirkt. Gepruefte Zusicherung: keine Engine-Ausnahme, keine haengende/ausufernde Abfrage, Zustandsrauchmelder
//   (`t.audit`) ruhig. Wo ein Zauber den Stapel gezielt trifft, pruefen die Einzeltests h-P3a-01 … 12, was GENAU passiert; dieser Lauf faengt alles Uebrige (Abstuerze, Geister-Instanzen, doppelte Namen).
// Ausnahmen: Teleport laesst den Stapel bei einem Held ohne Darions Effekt liegen (Regeltext „Support Zones remain where they were") — der Melder darf dort „hält 3 Karten" melden;
//   Dangerous Knowledge legt eine unsichtbare Traegerinstanz des gewonnenen Effekts an (Platz -1) — das meldet der Rauchmelder immer als „Geister-Instanz" (keine Darion-Folge).
// Aufruf: node docs/niche-tests/repro/W75/h-P3a-13-rauchlauf-alle-karten-mit-darion-stapel.js [Kartenname,…]   (Exit 0 = korrekt; ca. 1 Minute)
const H = require('../../lib/h.js');
const D = 'Darion, the Blood-Crazy Groundskeeper', F = H.INERT.filler, K = H.INERT.creature;
const T = 'Tushu, the Knowledge Keeper', Z = 'Zwei, the Lucky Thief';
const NAMEN = ['Club of Gobbo', 'Blade of the Frostbringer', 'Cute Crown'];
const KARTEN = ['Acid Rain', 'Aligning Goals', 'Blind Destruction', 'Chain Lightning', 'Cold Coffin', 'Coolness Overcharge', 'Cute Conversion', 'Dangerous Knowledge', 'Deepsea Treasure', 'Disarm',
  'Divine Gift of Biseria', 'Divine Gift of Equality', 'Divine Gift of Sacrifice', 'Divine Gift of the Deepsea', 'Divine Gift of The Light', 'Divine Zeal', 'Dream World Portal', 'Exorcism', 'Fire Bolts',
  'Gate to the Armory', 'Goldify', 'Graveyard of Limited Power', 'Great Offensive', 'Guard Change', 'Hand of Death', 'Heal', 'Holy Selection', 'Icebolt', 'Inheritance Ceremony', 'Kidnapping', 'Laser Volley',
  'Love Shot', 'Magic Hammer', 'Mana Beacon', 'Mass Routing', 'Missing People', 'Overcharge', 'Overheat', 'Pangaia, the Dino Domain', 'Paraseed Greenhouse', 'Phoenix Tackle', 'Pressure Projectile',
  'Shared Blood Tanks', 'Slippery Ice', 'Sun Beam', 'Tearing Mountain', 'Telekinesis', 'Teleport', 'Tengu Windstorm', 'The Seventh Circle of Hell', "The Warlord's Bite", 'Trap Sabotage', 'Treasure Theft',
  'Trial of Coolness', 'Venom Infusion', 'Victory Phoenix Cannon', 'Voodoo Curse'];
const nur = process.argv[2] ? process.argv[2].split(',') : null;
(async () => {
  const R = H.runner();
  const probleme = [];
  let gelaufen = 0;
  for (const name of KARTEN) {
    if (nur && !nur.includes(name)) continue;
    for (const modus of ['gegner', 'eigen', 'darionWirkt']) {
      const seite = modus === 'gegner' ? 1 : 0;
      const heroes = modus === 'gegner' ? [[T, Z, null], [D, T, null]] : [[D, T, Z], [T, Z, null]];
      const t = await H.fresh({ active: 0, heroes, hand: [[name, F], [F]], deck: [Array(15).fill(F), Array(15).fill(F)], gold: 500, discard: [['Club of Gobbo', 'Rebelliokai Terror Tengu'], ['Club of Gobbo']] });
      const ps = t.gs.players[seite];
      ps.supportZones[0][1] = [];
      for (const n of NAMEN) { ps.supportZones[0][1].push(n); const i = t.engine._trackCard(n, seite, 'support', 0, 1); i.turnPlayed = 1; }
      t.put(seite, 1, 0, K);
      if (name === 'Coolness Overcharge') t.gs.players[0].coolnessStack = Array(6).fill(F);
      t.script.push({ match: d => d.type === 'instancePick', answer: (d) => (d.doneLabel ? { done: true } : { instId: d.instances[1 % d.instances.length].instId }) });
      t.script.push({ match: d => d.type === 'slider' || d.type === 'amountPicker', answer: () => ({ amount: 0, value: 0 }) });
      t.targetFn = (valid) => {
        const eq = valid.find(v => v.type === 'equip' && v.owner === seite && v.heroIdx === 0 && v.slotIdx === 1);
        return [(eq || valid.find(v => v.type === 'hero' && v.owner === 1) || valid[0]).id];
      };
      t.policy.confirm = true;
      let wurf = null;
      try {
        await Promise.race([t.play(0, name, { hero: modus === 'eigen' ? 1 : 0 }), new Promise(r => setTimeout(() => r(null), 12000))]);
        await t.drain();
      } catch (e) { wurf = String(e && e.stack || e).split('\n').slice(0, 2).join(' | '); }
      gelaufen++;
      let aud = t.audit();
      if (name === 'Teleport') aud = aud.filter(x => !/hält 3 Karten/.test(x));
      if (name === 'Dangerous Knowledge') aud = aud.filter(x => !/slot-1\)/.test(x));
      const fehler = t.errors.filter(e => !/^\[harness\]/.test(e));
      if (wurf || fehler.length || aud.length || t.hung || t.runaway) probleme.push({ name, modus, wurf, fehler: fehler.slice(0, 2), audit: aud.slice(0, 2), haengt: !!t.hung, ausufernd: !!t.runaway });
    }
  }
  R.check(`${gelaufen} Laeufe (Karte × Lage) ohne Ausnahme, Haenger oder Auffaelligkeit`, probleme.length === 0, probleme);
  R.finish();
})();
