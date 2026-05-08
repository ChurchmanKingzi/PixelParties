#!/usr/bin/env node
// One-shot migration: tag every card script that needs a target
// (calls promptDamageTarget / promptEffectTarget) with
// `requiresTarget: true` so the engine's Blinded gate can recognize it.
//
// EXCLUSIONS (these card types aren't blocked by Blinded):
//   • isTargetingArtifact — the artifact does the targeting, not its
//     bearer (e.g. Beer, Juice, Lifeforce Howitzer).
//   • isPotion — same rationale.
//   • isReaction / isSurprise / isTargetRedirect — these activate
//     reactively, not as the controller's normal action.
//   • Engine internals (`_engine.js`, `_cpu.js`) and shared helpers.

const fs = require('fs');
const path = require('path');

const EFFECTS_DIR = path.join(__dirname, '..', 'cards', 'effects');
const ALREADY_TAGGED = new Set();

const files = fs.readdirSync(EFFECTS_DIR)
  .filter(f => f.endsWith('.js') && !f.startsWith('_') && f !== 'CARD_API.md');

let added = 0;
let skippedTargetingArtifact = 0;
let skippedPotion = 0;
let skippedReaction = 0;
let skippedNoPrompt = 0;
let skippedAlreadyTagged = 0;
const tagged = [];

for (const f of files) {
  const fp = path.join(EFFECTS_DIR, f);
  const src = fs.readFileSync(fp, 'utf8');

  if (!/promptDamageTarget|promptEffectTarget/.test(src)) {
    skippedNoPrompt++;
    continue;
  }

  if (/isTargetingArtifact\s*:\s*true/.test(src)) {
    skippedTargetingArtifact++;
    continue;
  }
  if (/isPotion\s*:\s*true/.test(src)) {
    skippedPotion++;
    continue;
  }
  if (/isReaction\s*:\s*true/.test(src) || /isSurprise\s*:\s*true/.test(src) || /isTargetRedirect\s*:\s*true/.test(src)) {
    skippedReaction++;
    continue;
  }

  if (/requiresTarget\s*:\s*true/.test(src)) {
    skippedAlreadyTagged++;
    ALREADY_TAGGED.add(f);
    continue;
  }

  // Insert `requiresTarget: true,` right after the FIRST `module.exports = {` or
  // `module.exports = Object.assign({` in the file. Almost every card script
  // in this repo opens with one of those two forms.
  const m = src.match(/module\.exports\s*=\s*\{/);
  if (!m) {
    console.warn('[skip] could not find module.exports opener:', f);
    continue;
  }
  const insertAt = m.index + m[0].length;
  const indent = '\n  ';
  const insertion = `${indent}requiresTarget: true,${indent}// ^ Tagged for Blinded gating — see cards/effects/_hooks.js (blinded status).`;

  const next = src.slice(0, insertAt) + insertion + src.slice(insertAt);
  fs.writeFileSync(fp, next, 'utf8');
  added++;
  tagged.push(f);
}

console.log('--- requiresTarget backfill ---');
console.log('Added         :', added);
console.log('AlreadyTagged :', skippedAlreadyTagged);
console.log('NoPrompt      :', skippedNoPrompt);
console.log('TargetingArt. :', skippedTargetingArtifact);
console.log('Potions       :', skippedPotion);
console.log('Reactions     :', skippedReaction);
console.log('');
console.log('Tagged files:');
tagged.sort().forEach(f => console.log('  ' + f));
