'use strict';
// W8/02 · Welle 8 (Al, 14.10.2026): „Sofern ein Effekt/eine Beschränkung nicht explizit nicht negiert/abgestellt werden kann,
// ja - dann ist er während Freeze/Stun/Negation deaktiviert." Kreaturen: Bonded Companion (gemeinsamer HP-Pool, Zonensperre,
// „unaffected by …"), Hell Fox / Cute Hydra (Selbstlöschung bei Niederlage), Cute Hydra (Lösch-Rettung).
// Ausnahme (Kartentext „cannot be negated"): Puppet-Tokens von Tri Fecta/Tri Ad teilen den HP-Pool IMMER (Kontrolle unten).
// Aufruf: node docs/niche-tests/repro/W8/02-kreaturen-beschraenkungen-ruhen.js   (Exit 1 = Fehler tritt auf)
const H = require('../../lib/h.js');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const ZUSTAENDE = [null, 'frozen', 'stunned', 'negated'];
async function setze(t, c, st) {
  if (st === 'negated') await t.engine.actionNegateCreature(c, 'Test');
  else if (st) await t.engine.applyCreatureStatus(c, st, { sourceOwner: 1 });
}

(async () => {
  const R = H.runner();

  // ── Bonded Companion: gemeinsamer HP-Pool ────────────────────────────────────────────────────
  for (const st of ZUSTAENDE) {
    const nm = st || 'ohne Status';
    const t = await H.fresh({ hp: 500 });
    const c = t.put(0, 0, 0, 'Bonded Companion Humby'); c.turnPlayed = 1;
    await setze(t, c, st);
    await t.run(() => t.engine.actionDealCreatureDamage({ name: 'x', owner: 1, heroIdx: 0 }, c, 100, 'spell'));
    if (!st) {
      R.check(`Companion ${nm}: Schaden trifft den Helden-Pool (500 -> 400)`, t.hp(0, 0) === 400, t.hp(0, 0));
      R.check(`Companion ${nm}: bleibt auf dem Brett`, !!t.zone(0, 0, 0), t.zone(0, 0, 0));
    } else {
      R.check(`Companion ${nm}: Pool ruht - der Held bleibt bei 500`, t.hp(0, 0) === 500, t.hp(0, 0));
      R.check(`Companion ${nm}: ohne eigenen Vorrat (0 HP) fällt er selbst`, !t.zone(0, 0, 0) && t.pile(0, 'discardPile').includes('Bonded Companion Humby'), { zone: t.zone(0, 0, 0), ablage: t.pile(0, 'discardPile') });
    }
    R.check(`Companion ${nm}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
    R.check(`Companion ${nm}: Zustand sauber`, t.audit().length === 0, t.audit());
  }
  // Heilung: der Pool heilt den Helden nur, solange er wirkt
  for (const st of [null, 'frozen']) {
    const t = await H.fresh({ hp: 500 });
    t.hero(0, 0).hp = 300;
    const c = t.put(0, 0, 0, 'Bonded Companion Humby'); c.turnPlayed = 1;
    await setze(t, c, st);
    await t.run(() => t.engine.actionHealCreature({ name: 'x', owner: 0, heroIdx: 0 }, c, 100));
    R.check(`Companion ${st || 'ohne Status'}: Heilung des Companions ${st ? 'heilt den Helden nicht (Pool ruht)' : 'heilt den Helden'}`, t.hp(0, 0) === (st ? 300 : 400), t.hp(0, 0));
    R.check(`Companion ${st || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  // ── Bonded Companion: Zonensperre („A Hero can only have 1 Bonded Companion") ─────────────────
  for (const st of ZUSTAENDE) {
    const t = await H.fresh({ hp: 500 });
    const c = t.put(0, 0, 0, 'Bonded Companion Humby'); c.turnPlayed = 1;
    await setze(t, c, st);
    const gesperrt = t.engine.isSupportZoneLocked(0, 0, { cardName: 'Bonded Companion Mellvy' });
    R.check(`Companion ${st || 'ohne Status'}: zweiter Companion ${st ? 'möglich (Sperre ruht)' : 'gesperrt'}`, gesperrt === !st, gesperrt);
  }
  // ... „cannot be moved into a different Support Zone"
  for (const st of ZUSTAENDE) {
    const t = await H.fresh({ hp: 500 });
    const c = t.put(0, 0, 0, 'Bonded Companion Humby'); c.turnPlayed = 1;
    await setze(t, c, st);
    await t.run(() => t.engine.actionMoveCard(c, 'support', 0, 2, { source: 'Test', sourceOwner: 0 }));
    const bewegt = c.zoneSlot === 2;
    R.check(`Companion ${st || 'ohne Status'}: Umsetzen in andere Zone ${st ? 'möglich (Sperre ruht)' : 'verhindert'}`, bewegt === !!st, { slot: c.zoneSlot });
    R.check(`Companion ${st || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }
  // ... „unaffected by cards and effects that can't affect Heroes"
  for (const st of ZUSTAENDE) {
    const t = await H.fresh({ hp: 500 });
    const c = t.put(0, 0, 0, 'Bonded Companion Humby'); c.turnPlayed = 1;
    await setze(t, c, st);
    const geschuetzt = t.engine.isUnaffectedByCreatureOnly(c, ['creature']);
    R.check(`Companion ${st || 'ohne Status'}: Kreaturen-only-Schutz ${st ? 'ruht' : 'gilt'}`, geschuetzt === !st, geschuetzt);
  }

  // ── Kontrolle „cannot be negated": Puppet-Tokens teilen den Pool auch gefroren ────────────────
  {
    const t = await H.fresh({ heroes: [['Tri Fecta, the Puppet Master', 'Tushu, the Knowledge Keeper', 'Zwei, the Lucky Thief'], null], hp: 500 });
    await t.run(() => t.engine.runHooks('onGameStart', {}));
    const tok = t.find('Destructive Puppet Shishi', 'support') || t.find('Creative Puppet Brammi', 'support') || t.find('Preserving Puppet Vinny', 'support');
    R.check('Puppet-Token liegt auf dem Brett', !!tok, null);
    if (tok) {
      await t.engine.applyCreatureStatus(tok, 'frozen', { sourceOwner: 1 });
      R.check('Puppet-Token gefroren: Pool ruht NICHT (cannot be negated)', t.engine.isCardPassiveDormant(tok) === false);
      const hp0 = t.hp(0, 0);
      await t.run(() => t.engine.actionDealCreatureDamage({ name: 'x', owner: 1, heroIdx: 0 }, tok, 100, 'spell'));
      R.check('Puppet-Token gefroren: Schaden geht weiter auf den Helden', t.hp(0, 0) === hp0 - 100, { vorher: hp0, nachher: t.hp(0, 0) });
    }
    R.check('Puppets: keine Engine-Fehler', t.errors.length === 0, t.errors);
  }

  // ── Hell Fox / Cute Hydra: „When this Creature is defeated, delete it" ───────────────────────
  for (const nm of ['Hell Fox', 'Cute Hydra']) {
    for (const st of ZUSTAENDE) {
      for (const weg of ['Schaden', 'Zerstörung']) {
        const t = await H.fresh({ hp: 500, deckSize: 10 });
        const c = t.put(0, 0, 0, nm); c.turnPlayed = 1;
        await setze(t, c, st);
        t.policy.confirm = false;
        if (weg === 'Schaden') await t.run(() => t.engine.actionDealCreatureDamage({ name: 'x', owner: 1, heroIdx: 0 }, c, 999, 'spell'));
        else await t.run(() => t.engine.actionDestroyCard({ name: 'x', owner: 1, heroIdx: 0 }, c));
        await wait(900);
        const ablage = t.pile(0, 'discardPile').includes(nm), geloescht = t.pile(0, 'deletedPile').includes(nm);
        R.check(`${nm} ${st || 'ohne Status'} (${weg}): ${st ? 'landet in der Ablage (Selbstlöschen ruht)' : 'wird gelöscht'}`, st ? (ablage && !geloescht) : (geloescht && !ablage), { ablage, geloescht });
        R.check(`${nm} ${st || 'ohne Status'} (${weg}): keine Engine-Fehler`, t.errors.length === 0, t.errors);
      }
    }
  }

  // ── Cute Hydra: Lösch-Rettung („if this Creature would be deleted from anywhere …") ruht ─────
  for (const st of [null, 'frozen', 'negated']) {
    const t = await H.fresh({ hp: 500, deckSize: 10, hand: [['ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler', 'ZZ Filler'], []] });
    t.grantFor(0, 0, 'Cute Hydra');
    const c = t.put(0, 0, 0, 'Cute Hydra'); c.turnPlayed = 1;
    await setze(t, c, st);
    t.policy.confirm = true;
    await t.run(() => t.engine.actionMoveCard(c, 'deleted', -1, -1, { source: 'Test', sourceOwner: 1 }));
    await wait(600);
    const gerettet = !!t.zone(0, 0, 0) && t.zone(0, 0, 0).name === 'Cute Hydra' || t.pile(0, 'hand').length < 5;
    R.check(`Cute Hydra ${st || 'ohne Status'}: Lösch-Rettung ${st ? 'findet nicht statt (ruht)' : 'greift'}`, st ? !gerettet : gerettet, { gerettet, geloescht: t.pile(0, 'deletedPile'), prompts: t.prompts.length });
    R.check(`Cute Hydra ${st || 'ohne Status'}: keine Engine-Fehler`, t.errors.length === 0, t.errors);
  }

  R.finish();
})().catch(e => { console.error(e); process.exit(2); });
