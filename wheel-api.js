'use strict';
// ═══════════════════════════════════════════════════════════════
//  WHEEL-API — Server-Routen des Glücksrads („Kork-Board“, Shop). Würfel- und Tabellenlogik: wheel.js.
//
//    GET  /api/wheel/state            → { rarities: { <r>: { total, free } }, tickets: { <r>: n }, boards: { <r>: [{ id, key, table, boosts }] }, maxStake, spinArrows }
//    GET  /api/wheel/cards?rarity=<r> → { cards: [{ name, total, free }] }   (Kopien in Decks sind gesperrt: free = Besitz − größte Nutzung in EINEM Deck)
//    POST /api/wheel/throw            { rarity, board, cards: { <Karte>: Anzahl } } → { arrows: [{ i, kind, bonus, boosted, prize? }], summary, sc, rarities, tickets, packs }
//    POST /api/wheel/ticket           { rarity, card } → { card, from, to }   (Ticket <rarity>: eine freie Kopie von <rarity> → die nächsthöhere Rarity)
//
//  Alles Zufällige passiert HIER. Einsatz-Abbuchung, Würfeln und Preisvergabe laufen in EINER Transaktion: entweder alles oder nichts.
//  Preise: Karten (Sammlung), Booster/Golden-/Jackpot-Pack (als offene Packs, pending_booster – öffnet der Shop wie gekaufte), Avatar/Sleeve/Skin
//  (Kopien werten den Rahmen auf, wie im Shop-Würfel), SC (sc_log 'wheel:prize'), Tickets (user_wheel_tickets).
// ═══════════════════════════════════════════════════════════════
const W = require('./wheel');

const SC_REASON = 'wheel:prize';
const TICKET_RARITIES = W.INPUT_RARITIES.slice(0, -1);   // Umbra hat keine höhere Stufe

module.exports = function registerWheel(d) {
  const { app, db, authMiddleware, uuidv4, RARITIES, ownedRarities, addRarityCopies, packPool, cardHasMask, boosterManifest } = d;

  // ── Kartenpool des Rads (alle Pack-Karten, gleich verteilt) ──
  let _all = null, _masked = null;
  function allNames() {
    if (!_all) {
      const set = new Set();
      for (const id of RARITIES.PACK_IDS) for (const c of packPool(id) || []) set.add(typeof c === 'string' ? c : c.name);
      _all = [...set];
      _masked = _all.filter(n => cardHasMask(n));
    }
    return _all;
  }
  const pick = (arr, rand) => arr[Math.min(arr.length - 1, Math.floor(rand() * arr.length))];
  function randomCard(rarity, rand) {
    const names = allNames();
    return pick(RARITIES.NEEDS_MASK[rarity] && _masked.length ? _masked : names, rand);
  }

  // ── Besitz und Deck-Sperre ──
  /** Größte Nutzung je (Karte, Rarity) in EINEM Deck: so viele Kopien braucht der Spieler mindestens, damit jedes Deck gültig bleibt. */
  async function deckLocks(dbh, userId) {
    const rows = await dbh.all('SELECT main_deck, heroes, potion_deck, side_deck, rarities FROM decks WHERE user_id = ?', [userId]);
    const lock = {};
    for (const r of rows) {
      try {
        const zonen = { mainDeck: JSON.parse(r.main_deck || '[]'), heroes: JSON.parse(r.heroes || '[]'), potionDeck: JSON.parse(r.potion_deck || '[]'), sideDeck: JSON.parse(r.side_deck || '[]') };
        const use = RARITIES.rarityUsage(zonen, RARITIES.normalizeDeckRarities(zonen, JSON.parse(r.rarities || '{}')));
        for (const name of Object.keys(use)) for (const rar of Object.keys(use[name])) {
          const l = lock[name] || (lock[name] = {});
          l[rar] = Math.max(l[rar] || 0, use[name][rar]);
        }
      } catch { /* kaputtes Deck sperrt nichts */ }
    }
    return lock;
  }
  /** { <Karte>: { <rarity>: freie Kopien } } (nur > 0). */
  async function freeCopies(dbh, userId) {
    const owned = await ownedRarities(userId, dbh), lock = await deckLocks(dbh, userId), out = {};
    for (const name of Object.keys(owned)) for (const rar of Object.keys(owned[name])) {
      const f = owned[name][rar] - ((lock[name] && lock[name][rar]) || 0);
      if (f > 0) (out[name] || (out[name] = {}))[rar] = f;
    }
    return out;
  }
  async function tickets(dbh, userId) {
    const rows = await dbh.all('SELECT rarity, count FROM user_wheel_tickets WHERE user_id = ? AND count > 0', [userId]);
    const out = {}; for (const r of rows) out[r.rarity] = Number(r.count);
    return out;
  }

  // ── Packs als Preis ──
  function randomVariant(packId) {
    const pack = (boosterManifest().packs || []).find(p => p.id === packId);
    const v = pack && pack.variants && pack.variants.length ? pack.variants[Math.floor(Math.random() * pack.variants.length)] : null;
    return v ? v.id : null;
  }
  function randomPackId(rand) {
    const ids = RARITIES.PACK_IDS.filter(id => (packPool(id) || []).length && randomVariant(id));
    return pick(ids, rand);
  }
  /** Golden Pack: jede Karte des Gesamtpools, jede erwürfelte Rarity um 1–2 angehoben (höchstens Umbra). */
  function rollGolden(rand) {
    const pool = allNames();
    const top = RARITIES.ORDER.length - 1;
    const cards = RARITIES.rollPack(pool, { rand, hasMask: cardHasMask }).map(c => {
      const rank = Math.min(top, RARITIES.rank(c.rarity) + (rand() < 0.5 ? 1 : 2));
      const rarity = RARITIES.ORDER[rank];
      const name = RARITIES.NEEDS_MASK[rarity] && !cardHasMask(c.name) ? randomCard(rarity, rand) : c.name;
      return { name, rarity };
    });
    cards.sort((a, b) => RARITIES.rank(a.rarity) - RARITIES.rank(b.rarity));
    return cards;
  }
  /** Jackpot-Pack: 9 Umbras. */
  function rollJackpot(rand) {
    const names = _masked && _masked.length ? _masked : allNames();
    const out = [];
    const bag = names.slice();
    for (let i = 0; i < RARITIES.PACK_SIZE; i++) {
      if (!bag.length) bag.push(...names);
      out.push({ name: bag.splice(Math.floor(rand() * bag.length), 1)[0], rarity: 'umbra' });
    }
    return out;
  }

  /** Kosmetik ziehen (Kopie wertet den Rahmen auf). Alles auf Maximum: null → der Aufrufer zahlt 25 SC aus. */
  async function pullCosmetic(tx, userId, kind) {
    if (kind === 'skin') {
      const pool = [...new Set([...d.getAvailableSkins().map(s => s.skinName), ...d.unlockableSkinNames()])];
      const extras = await d.extraPullItems(userId, 'skin');
      const got = await d.pullFromPool(userId, 'skin', pool, extras.map(x => x.id), tx);
      return got && { kind, id: got.id, heroName: d.heroOfSkin(got.id) || null, isNew: got.isNew, dupes: got.dupes };
    }
    const subdir = kind === 'avatar' ? 'avatars' : 'sleeves';
    const ids = d.scanShopDir(subdir).map(f => d.path.basename(f, d.path.extname(f)))
      .filter(id => kind !== 'sleeve' || !d.cpuSleeves.isCpuSleeve(id))
      .filter(id => kind !== 'avatar' || !d.cpuAvatars.isCpuAvatar(id));
    const extras = await d.extraPullItems(userId, kind);
    const got = await d.pullFromPool(userId, kind, ids, extras.map(x => x.id), tx);
    if (!got) return null;
    const extra = extras.find(x => x.id === got.id) || null;
    return { kind, id: got.id, src: extra && extra.src ? extra.src : '/data/shop/' + subdir + '/' + encodeURIComponent(got.id) + '.png', label: extra && extra.name ? extra.name : null, isNew: got.isNew, dupes: got.dupes };
  }

  // ── GET /api/wheel/state ──
  app.get('/api/wheel/state', authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      const owned = await ownedRarities(userId), free = await freeCopies(db, userId);
      const rarities = {};
      for (const r of W.INPUT_RARITIES) rarities[r] = { total: 0, free: 0 };
      for (const n of Object.keys(owned)) for (const r of Object.keys(owned[n])) if (rarities[r]) rarities[r].total += owned[n][r];
      for (const n of Object.keys(free)) for (const r of Object.keys(free[n])) if (rarities[r]) rarities[r].free += free[n][r];
      const boards = {};
      for (const r of W.INPUT_RARITIES) boards[r] = W.boards(r).map(b => ({
        id: b.id, key: b.key, table: b.table, ev: b.ev,
        boosts: Object.fromEntries(W.BOOST_KINDS.map(k => [k, W.boostSpec(r, b.id, k)])),
      }));
      res.json({ rarities, tickets: await tickets(db, userId), boards, maxStake: W.MAX_STAKE, spinArrows: W.SPIN_ARROWS, ticketRarities: TICKET_RARITIES });
    } catch (err) { console.error('[wheel/state]', err.message); res.status(500).json({ error: 'Failed to load wheel' }); }
  });

  // ── GET /api/wheel/cards ──
  app.get('/api/wheel/cards', authMiddleware, async (req, res) => {
    try {
      const rarity = String(req.query.rarity || '');
      if (!W.INPUT_RARITIES.includes(rarity)) return res.status(400).json({ error: 'Invalid rarity' });
      const userId = req.user.userId;
      const owned = await ownedRarities(userId), free = await freeCopies(db, userId);
      const cards = [];
      for (const name of Object.keys(owned)) {
        const total = owned[name][rarity] || 0;
        if (total > 0) cards.push({ name, total, free: (free[name] && free[name][rarity]) || 0 });
      }
      cards.sort((a, b) => a.name.localeCompare(b.name));
      res.json({ rarity, cards });
    } catch (err) { console.error('[wheel/cards]', err.message); res.status(500).json({ error: 'Failed to load cards' }); }
  });

  // ── POST /api/wheel/throw ──
  app.post('/api/wheel/throw', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    const rarity = String(req.body?.rarity || ''), board = String(req.body?.board || '');
    if (!W.INPUT_RARITIES.includes(rarity)) return res.status(400).json({ error: 'Invalid rarity' });
    if (!W.BOARD_IDS.includes(board)) return res.status(400).json({ error: 'Invalid board' });
    const stakeIn = req.body && typeof req.body.cards === 'object' && req.body.cards ? req.body.cards : null;
    if (!stakeIn || Array.isArray(stakeIn)) return res.status(400).json({ error: 'Missing cards' });
    const stake = {}; let stakeN = 0;
    for (const name of Object.keys(stakeIn)) {
      const n = stakeIn[name];
      if (!Number.isInteger(n) || n < 0) return res.status(400).json({ error: 'Invalid card count' });
      if (n > 0) { stake[name] = n; stakeN += n; }
    }
    if (stakeN < 1 || stakeN > W.MAX_STAKE) return res.status(400).json({ error: 'Invalid stake (1 to ' + W.MAX_STAKE + ' cards)', max: W.MAX_STAKE });

    let out = null, problem = null;
    try {
      await db.transaction(async (tx) => {
        // Einsatz prüfen: nur freie (nicht durch Decks gesperrte) Kopien dieser Rarity
        const free = await freeCopies(tx, userId);
        for (const name of Object.keys(stake)) {
          if (!((free[name] && free[name][rarity]) >= stake[name])) { problem = { status: 409, body: { error: 'Not enough free copies of ' + name, card: name } }; throw new Error('stake'); }
        }
        for (const name of Object.keys(stake)) {
          const upd = await tx.run('UPDATE user_card_rarities SET count = count - ? WHERE user_id = ? AND card = ? AND rarity = ? AND count >= ?', [stake[name], userId, name, rarity, stake[name]]);
          if (!upd.rowsAffected) { problem = { status: 409, body: { error: 'Not enough copies of ' + name, card: name } }; throw new Error('stake'); }
        }
        await tx.run('DELETE FROM user_card_rarities WHERE user_id = ? AND count <= 0', [userId]);

        const rand = Math.random;
        const throwRes = W.rollThrow(rarity, board, stakeN, rand);
        const gainCards = [], packRows = [];
        let sc = 0;
        const tix = {};
        const existing = await tx.all('SELECT COUNT(*) AS n FROM pending_booster WHERE user_id = ?', [userId]);
        let seq = Number(existing[0] && existing[0].n) || 0;
        const addPack = async (packId, cards) => {
          const id = uuidv4();
          await tx.run('INSERT INTO pending_booster (id, user_id, pack_id, variant_id, cards_json, seq) VALUES (?, ?, ?, ?, ?, ?)', [id, userId, packId, randomVariant(packId), JSON.stringify(cards), seq++]);
          packRows.push(id);
        };
        for (const a of throwRes.arrows) {
          const k = a.kind;
          if (k.startsWith('card:')) {
            const r = k.slice(5), name = randomCard(r, rand);
            gainCards.push({ name, rarity: r }); a.prize = { name, rarity: r };
          } else if (k.startsWith('ticket:')) {
            const r = k.slice(7); tix[r] = (tix[r] || 0) + 1; a.prize = { rarity: r };
          } else if (W.SC_AMOUNT[k]) {
            sc += W.SC_AMOUNT[k]; a.prize = { amount: W.SC_AMOUNT[k] };
          } else if (k === 'booster') {
            const packId = randomPackId(rand);
            await addPack(packId, RARITIES.rollPack(packPool(packId), { rand, hasMask: cardHasMask })); a.prize = { packId };
          } else if (k === 'golden') {
            const packId = randomPackId(rand);
            await addPack(packId, rollGolden(rand)); a.prize = { packId };
          } else if (k === 'jackpot') {
            const packId = randomPackId(rand);
            await addPack(packId, rollJackpot(rand)); a.prize = { packId };
          } else if (k === 'avatar' || k === 'sleeve' || k === 'skin') {
            const got = await pullCosmetic(tx, userId, k);
            if (got) a.prize = got;
            else { sc += 25; a.prize = { maxed: true, amount: 25 }; }   // alles auf Maximum: 25 SC statt nichts
          }
        }
        await addRarityCopies(userId, gainCards, tx);
        for (const r of Object.keys(tix)) {
          await tx.run('INSERT INTO user_wheel_tickets (user_id, rarity, count) VALUES (?, ?, ?) ON CONFLICT(user_id, rarity) DO UPDATE SET count = count + ?', [userId, r, tix[r], tix[r]]);
        }
        if (sc > 0) {
          await tx.run('UPDATE users SET sc = sc + ? WHERE id = ?', [sc, userId]);
          await tx.run('INSERT INTO sc_log (id, user_id, reward_id, opponent_id, amount) VALUES (?, ?, ?, ?, ?)', [uuidv4(), userId, SC_REASON, rarity + ':' + board, sc]);
        }
        out = { arrows: throwRes.arrows, capped: throwRes.capped, summary: { stake: stakeN, arrows: throwRes.arrows.length, sc, cards: gainCards.length, packs: packRows.length } };
      });
    } catch (err) {
      if (problem) return res.status(problem.status).json(problem.body);
      console.error('[wheel/throw]', err.message);
      return res.status(500).json({ error: 'Throw failed' });
    }
    try {
      const u = await db.get('SELECT sc FROM users WHERE id = ?', [userId]);
      out.sc = u ? u.sc : 0;
      out.rarities = await ownedRarities(userId);
      out.tickets = await tickets(db, userId);
    } catch { /* Antwort bleibt gültig */ }
    res.json(out);
  });

  // ── POST /api/wheel/ticket ──
  app.post('/api/wheel/ticket', authMiddleware, async (req, res) => {
    const userId = req.user.userId;
    const rarity = String(req.body?.rarity || ''), card = String(req.body?.card || '');
    if (!TICKET_RARITIES.includes(rarity)) return res.status(400).json({ error: 'Invalid rarity' });
    const to = RARITIES.ORDER[RARITIES.rank(rarity) + 1];
    if (RARITIES.NEEDS_MASK[to] && !cardHasMask(card)) return res.status(400).json({ error: 'This card cannot reach ' + RARITIES.label(to) });
    let problem = null;
    try {
      await db.transaction(async (tx) => {
        const t = await tx.run('UPDATE user_wheel_tickets SET count = count - 1 WHERE user_id = ? AND rarity = ? AND count >= 1', [userId, rarity]);
        if (!t.rowsAffected) { problem = { status: 409, body: { error: 'No ticket' } }; throw new Error('t'); }
        const free = await freeCopies(tx, userId);
        if (!((free[card] && free[card][rarity]) >= 1)) { problem = { status: 409, body: { error: 'No free copy of that card' } }; throw new Error('t'); }
        await tx.run('UPDATE user_card_rarities SET count = count - 1 WHERE user_id = ? AND card = ? AND rarity = ? AND count >= 1', [userId, card, rarity]);
        await addRarityCopies(userId, [{ name: card, rarity: to }], tx);
      });
    } catch (err) {
      if (problem) return res.status(problem.status).json(problem.body);
      console.error('[wheel/ticket]', err.message);
      return res.status(500).json({ error: 'Ticket failed' });
    }
    res.json({ ok: true, card, from: rarity, to, rarities: await ownedRarities(userId), tickets: await tickets(db, userId) });
  });
};
