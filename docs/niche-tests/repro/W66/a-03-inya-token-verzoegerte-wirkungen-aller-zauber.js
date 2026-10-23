'use strict';
// W66a-03 · Bug-KLASSE „verzögerte Wirkung hängt an der Karteninstanz statt am Spieler/Spielstand": alle spielbaren Spells mit und ohne Inya-Token
//
// Methode (Wirkungs-Äquivalenz über den ECHTEN Zugwechsel): jeder spielbare Spell wird in einer festen Szene (Inya als Wirker, Brett mit Kreaturen auf beiden Seiten, Seed fest) gewirkt und dann durch
//   ZWEI volle Zugwechsel getrieben (Ende des eigenen Zuges, Gegnerzug, Beginn des nächsten eigenen Zuges — hier feuern „next turn"/„end of your opponent's next turn"-Wirkungen).
//   Variante A  Inya lehnt den Buddy ab (Karte in der Ablage)                   — die Referenz (== Kartentext)
//   Variante B  Inya beschwört den Buddy, er LEBT bis zum Schluss               — Karte nur als Token auf dem Brett
//   Variante C  Inya beschwört den Buddy, er STIRBT sofort nach dem Wirken       — Token weg, Karte in der Ablage (W64a)
//   Verglichen wird ein Fingerabdruck (Helden-HP/Status/Buffs, Hände, Decks, Ablagen, Brett inkl. Zähler/Status der Karten-Instanzen, alle `_`-Felder von Spieler und Spielstand, Areas, Permanents).
//   Erwartet: B == A und C == A (nach Abzug des Tokens selbst: Token-Instanz, Spell-Name in Ablage ↔ Brett). Abweichungen sind NUR die in `ERLAUBT` begründeten.
// Zusätzlich: nach dem Lauf kein Geist (`audit`), keine Engine-Fehler, kein liegengebliebenes `_spellPlacedOnBoard`/`_spellBecameToken`.
// Beide Sitze. Exit 0 = korrekt.
const H = require('../../lib/h.js');
const IN = 'Card Game Player Inya';
const ID = /[0-9a-f]{8}-[0-9a-f]{3}/g;
const RAUSCH = /_ablageStamps|_gameStartTime|_scTracking|_lastCreatureDefeatedTurn|_rewriteLog|_defeatedOppTargetTurn|_creatureDefeated|\._(lethe|killed|tokenDied)/;
// Begründete Abweichungen (Name → Muster der erlaubten Diff-Pfade)
const ERLAUBT = {
  'Chaos Magic': /./,                                                      // wirkt einen ZUFÄLLIGEN Spell (Zufallsfolge verschiebt sich durch Inyas Frage)
  'Fire Bolts': /heroes\[0\]\.hp:/,                                       // Rückstoß auf den Wirker: solange der Buddy lebt, nimmt Inya keinen Schaden (Inyas Text; der Schild steht schon beim Rückstoß)
  'Torchure': /heroes\[0\]\.hp:/,                                         // Gift-Kosten/-Ticks am Wirker: dito
};

function fp(t, seat, spell) {
  const gs = t.gs, o = {};
  const bud = t.inst(c => c.counters && c.counters._fantasyBuddyToken && c.zone === 'support');
  o.turn = gs.turn; o.active = gs.activePlayer;
  o.players = gs.players.map((ps, pi) => {
    const r = {};
    r.heroes = ps.heroes.map(h => h && h.name ? { hp: h.hp, max: h.maxHp, atk: h.atk, st: Object.keys(h.statuses || {}).sort(), bf: JSON.stringify(h.buffs || {}), att: (h.attachments || []).length } : null);
    r.hand = ps.hand.slice().sort(); r.deck = ps.mainDeck.length; r.gold = ps.gold;
    r.disc = ps.discardPile.slice(); r.del = ps.deletedPile.slice().sort();
    r.sup = ps.supportZones.map(hh => hh.map(z => z.slice())); r.abil = ps.abilityZones;
    r.perm = (ps.permanents || []).map(p => p && p.name);
    r.us = {};
    for (const k of Object.keys(ps)) if (k[0] === '_' && typeof ps[k] !== 'function' && !/^_(resolvingCard|actionsPlayed|handOriginals|bonusMain)/.test(k)) { try { r.us[k] = JSON.stringify(ps[k]); } catch { r.us[k] = '?'; } }
    return r;
  });
  // der Token selbst: Zone leeren, Spell-Name in die Ablage des Besitzers zählen (so liegt er in A und C)
  for (const b of bud) {
    const pl = o.players[b.owner];
    pl.sup[b.heroIdx][b.zoneSlot] = pl.sup[b.heroIdx][b.zoneSlot].filter((_, i, a) => false);
    pl.disc = pl.disc.concat([b.name]);
  }
  for (const p of o.players) p.disc = p.disc.slice().sort();
  o.gs = {};
  for (const k of Object.keys(gs)) if (k[0] === '_' && typeof gs[k] !== 'function') { try { o.gs[k] = JSON.stringify(gs[k]); } catch { o.gs[k] = '?'; } }
  o.area = gs.areaZones;
  o.inst = t.engine.cardInstances.filter(c => !(c.counters && c.counters._fantasyBuddyToken))
    .filter(c => !(c.zone === 'discard' && JSON.stringify(c.counters || {}) === '{}' && JSON.stringify(c.statuses || {}) === '{}'))   // reine Ablage-Lauscher (Buchführungs-Hooks) sind kein Spielzustand
    .map(c => [c.name, c.zone, c.owner, c.heroIdx, c.zoneSlot, JSON.stringify(c.counters || {}), JSON.stringify(c.statuses || {})].join('|')).sort();
  return JSON.parse(JSON.stringify(o).replace(ID, 'ID').replace(/perm-\d+-[0-9.]+/g, 'perm'));
}
function diff(a, b, p = '', out = []) {
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a)) { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], p + '.' + k, out); return out; }
  if (Array.isArray(a) && Array.isArray(b) && a.length === b.length) { a.forEach((x, i) => diff(x, b[i], p + '[' + i + ']', out)); return out; }
  out.push(p + ': ' + String(JSON.stringify(a)).slice(0, 140) + ' <> ' + String(JSON.stringify(b)).slice(0, 140)); return out;
}

async function lauf(name, variante, seat) {
  const opp = 1 - seat;
  const eigene = [IN, H.BLANK_HEROES[1], H.BLANK_HEROES[2]];
  const heroes = seat === 0 ? [eigene, H.BLANK_HEROES_B] : [H.BLANK_HEROES_B, eigene];
  const hand = [[], []]; hand[seat] = [name, H.INERT.filler];
  const t = await H.fresh({ heroes, hand, turn: 5, active: seat, deckSize: 20, seed: 77, gold: 300 });
  t.put(opp, 0, 0, H.INERT.big); t.put(opp, 1, 1, H.INERT.creature); t.put(seat, 1, 0, H.INERT.creature); t.put(seat, 2, 2, H.INERT.big);
  const ja = variante !== 'A';
  t.script.push({ match: d => d.type === 'confirm' && d.title === IN, answer: () => ({ confirmed: ja }) });
  const r = await t.play(seat, name, { hero: 0 });
  const buddy = t.inst(c => c.counters && c.counters._fantasyBuddyToken && c.zone === 'support')[0];
  const out = { r, buddy: !!buddy, t };
  if (variante === 'C' && buddy) await t.run(() => t.engine.actionDestroyCard({ name: 'X', owner: opp }, buddy));
  await t.endTurn(); await t.endTurn();
  out.fp = fp(t, seat, name);
  out.sauber = t.errors.length === 0 && t.audit().length === 0 && !t.hung;
  out.flags = !!(t.gs._spellPlacedOnBoard || t.gs._spellBecameToken);
  return out;
}

(async () => {
  const R = H.runner();
  const namen = Object.values(H.DB).filter(c => c.cardType === 'Spell').map(c => c.name).filter(n => H.loadCardEffect(n));
  for (const seat of [0, 1]) {
    R.section(`── Sitz ${seat} ──`);
    let gespielt = 0, mitBuddy = 0; const bad = [], abw = [];
    for (const name of namen) {
      const a = await lauf(name, 'A', seat);
      if (a.r !== true) continue;
      gespielt++;
      const b = await lauf(name, 'B', seat), c = await lauf(name, 'C', seat);
      if (b.buddy) mitBuddy++;
      const rb = diff(a.fp, b.fp).filter(x => !RAUSCH.test(x)), rc = diff(a.fp, c.fp).filter(x => !RAUSCH.test(x));
      const erl = ERLAUBT[name];
      const unerlaubt = [...rb.map(x => 'B ' + x), ...rc.map(x => 'C ' + x)].filter(x => !(erl && erl.test(x)));
      if (unerlaubt.length) bad.push([name, unerlaubt.slice(0, 3)]);
      if ((rb.length || rc.length) && erl) abw.push(name);
      if (!(a.sauber && b.sauber && c.sauber) || a.flags || b.flags || c.flags) bad.push([name, ['Engine-Fehler/Geist/Rest-Flag', { a: a.sauber, b: b.sauber, c: c.sauber, fl: [a.flags, b.flags, c.flags] }]]);
    }
    R.check(`[S${seat}] ${gespielt} spielbare Spells, ${mitBuddy} davon Inya-fähig: Wirkung nach zwei Zugwechseln mit lebendem und mit totem Token == ohne Token (Fingerabdruck)`, bad.length === 0, bad.slice(0, 6));
    R.check(`[S${seat}] die Abdeckung ist plausibel (≥ 150 Spells gespielt, ≥ 90 Inya-fähig)`, gespielt >= 150 && mitBuddy >= 90, { gespielt, mitBuddy });
    R.note(`[S${seat}] begründete Abweichungen`, abw);
  }
  R.finish();
})().catch(e => { process.stdout.write('CRASH ' + (e && e.stack || e) + '\n'); process.exit(2); });
