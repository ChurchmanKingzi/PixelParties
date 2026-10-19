'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { MessagePayload } = require('discord.js');
const { installMentionGuard, sanitizeAllowedMentions } = require('../lib/mention-guard');

test('sanitize: everyone/here/Rollen/pauschale Nutzer-Pings fliegen raus, einzelne Nutzer-IDs bleiben', () => {
  assert.deepEqual(sanitizeAllowedMentions({ parse: ['everyone', 'roles', 'users'], roles: ['123456789012345678'] }), { parse: [] });
  assert.deepEqual(sanitizeAllowedMentions(undefined), { parse: [] });
  assert.deepEqual(sanitizeAllowedMentions({ users: ['123456789012345678'], roles: ['1'], parse: ['everyone'] }), { parse: [], users: ['123456789012345678'] });
  assert.deepEqual(sanitizeAllowedMentions({ users: ['<@evil>', '12'] }), { parse: [] }, 'nur echte IDs');
  assert.equal(sanitizeAllowedMentions({ users: Array.from({ length: 300 }, (_, i) => String(100000000000000000 + i)) }).users.length, 100);
});

test('jede ausgehende Nachricht läuft durch die Sperre (echter discord.js-Weg), auch mit bösem allowedMentions und @everyone im Text', () => {
  installMentionGuard();
  installMentionGuard();   // zweimal installieren ändert nichts
  const target = { client: { options: { allowedMentions: { parse: ['everyone', 'roles'] }, jsonTransformer: x => x } } };
  const body = o => new MessagePayload(target, o).resolveBody().body;

  const evil = body({ content: '@everyone @here <@&123456789012345678> hallo', allowedMentions: { parse: ['everyone', 'roles', 'users'], roles: ['123456789012345678'] } });
  assert.deepEqual(evil.allowed_mentions, { parse: [] });
  assert.equal(body({ content: 'x' }).allowed_mentions.parse.length, 0, 'auch der Client-Standard wird entschärft');
  const one = body({ content: 'hi <@123456789012345678>', allowedMentions: { users: ['123456789012345678'] } });
  assert.deepEqual(one.allowed_mentions, { parse: [], users: ['123456789012345678'] });
});

test('Quelltext: kein Modul erlaubt everyone/roles — weder per parse noch per roles-Liste', () => {
  const dirs = ['features', 'lib'].map(d => path.join(__dirname, '..', d));
  const files = dirs.flatMap(d => fs.readdirSync(d).filter(f => f.endsWith('.js')).map(f => path.join(d, f)))
    .concat(path.join(__dirname, '..', 'index.js'))
    .filter(f => !f.endsWith('mention-guard.js'));
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/allowedMentions\s*:\s*\{[^}]*\}/g)) {
      assert.ok(!/everyone|roles/.test(m[0]), `${path.basename(f)}: ${m[0]}`);
      assert.ok(!/parse\s*:\s*\[\s*['"]/.test(m[0]), `${path.basename(f)}: pauschales parse in ${m[0]}`);
    }
  }
});
