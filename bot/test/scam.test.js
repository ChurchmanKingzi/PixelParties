'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { hasLink, hasMassPing, isNewMember, isPhishing, loadBlockedDomains, defang } = require('../lib/scam');
const path = require('path');

test('Links erkennen', () => {
  for (const t of ['look https://example.com/x', 'http://a.io', 'www.foo.bar', 'discord.gg/abc123', 'discord.com/invite/abc', 'check example.com',
    'hey <https://example.com>', 'free nitro at get-nitro.gift now', 'a.xyz/path?q=1']) assert.ok(hasLink(t), t);
  for (const t of ['hello world', 'e.g. this', 'version 3.5 is out', 'I think so. Maybe.', 'Mr. Smith', 'pixel.parties is great', '', null]) assert.ok(!hasLink(t), String(t));
});

test('Massenping erkennen (auch ohne echte Berechtigung)', () => {
  assert.ok(hasMassPing('@everyone look', {}));
  assert.ok(hasMassPing('hi @here', {}));
  assert.ok(hasMassPing('hi <@&123456789012345678>', {}));
  assert.ok(hasMassPing('x', { everyone: true }));
  assert.ok(hasMassPing('x', { roles: { size: 1 } }));
  assert.ok(!hasMassPing('hi <@123456789012345678>', { roles: { size: 0 } }));
  assert.ok(!hasMassPing('everyone is welcome', {}));
  assert.ok(!hasMassPing('mail me@here.com', {}));   // E-Mail-Adresse ist kein Ping
});

test('Mitgliedsdauer: unter einem halben Jahr = neu', () => {
  const now = Date.UTC(2026, 9, 19);
  assert.ok(isNewMember(now - 10 * 86400000, now));
  assert.ok(isNewMember(now - 182 * 86400000, now));
  assert.ok(!isNewMember(now - 184 * 86400000, now));
  assert.ok(isNewMember(null, now));
});

test('Phishing: Liste, Unterdomänen, Lookalikes — echte Seiten bleiben unberührt', () => {
  const blocked = loadBlockedDomains(path.join(__dirname, '..', 'data', 'blocked-domains.txt'));
  assert.ok(blocked.includes('discord-nitro.gift'));
  assert.ok(isPhishing('https://discord-nitro.gift/claim', blocked));
  assert.ok(isPhishing('go to promo.discord-nitro.gift', blocked));
  assert.ok(isPhishing('free https://dlscord-nitro.com/x', blocked));
  assert.ok(isPhishing('https://steamcommunlty.com/gift', blocked));
  for (const ok of ['https://discord.com/channels/1/2', 'https://pixelpartiestcg.com/', 'https://steamcommunity.com/id/x', 'https://discord.gg/K8PFRjr', 'https://github.com/x']) {
    assert.ok(!isPhishing(ok, blocked), ok);
  }
});

test('defang macht Links unklickbar', () => {
  const d = defang('https://evil.example.com/x');
  assert.ok(!d.includes('http://') && !d.includes('https://') && !/\.com/.test(d));
});
