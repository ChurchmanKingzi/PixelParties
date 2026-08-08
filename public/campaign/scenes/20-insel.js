// ═══════════════════════════════════════════════════════════════════
//  SZENEN AUF DER INSEL
//  Zeigt die drei Duell-Sorten, die du beschrieben hast:
//    · Ellie   — Ausgang egal, die Story geht so oder so weiter
//    · Mithuru — verzweigt, Sieg und Niederlage führen woandershin
//    · Ethan   — MUSS gewonnen werden (sonst Rücksetzpunkt)
// ═══════════════════════════════════════════════════════════════════

// ── VERPASSBAR ────────────────────────────────────────────────────
// Läuft nur, wenn der Spieler am ersten Tag zwischen 17 und 19 Uhr
// auf dem Hügel ist (siehe `events` in 00-welt.js). Wer trödelt oder
// den Hügel nie kennenlernt, sieht diese Szene nie.
scene('ellie_huegel', {
  once: true,
  music: 'menu',
  steps: [
    { bg: 'bg_hill' },
    { text: 'The sun hangs low over the water and turns the whole slope gold. So it was true.' },
    { enter: 'ellie', x: 68, y: 96, flip: true },
    { wait: 500 },
    { say: 'ellie', text: 'Oh. Nobody usually finds their way up here.' },
    { say: 'ellie', text: 'Ellie. Third year. I come up when the hall gets too loud.' },
    {
      choice: [
        { text: '"I came to watch the sunset."', goto: 'sanft' },
        { text: '"Then let us duel up here instead."', goto: 'direkt' },
      ],
    },

    { label: 'sanft' },
    { say: 'ellie', text: 'Then sit down. But do not talk.' },
    { wait: 900 },
    { text: 'You sit in silence for a while. It is the quietest moment you have had on this island so far.' },
    { flag: 'ellie_ruhe' },
    { time: 30 },
    { jump: 'duell' },

    { label: 'direkt' },
    { say: 'ellie', text: '…you are like the others.' },
    { say: 'ellie', text: 'Fine. Have it your way.' },
    { jump: 'duell' },

    { label: 'duell' },
    {
      duel: 'ellie_1',
      opponent: 'ellie',
      opponentName: 'Ellie',
      mustWin: false,
      rewardWin: { coins: 200, cards: { 'Coffee': 1 }, flags: ['ellie_besiegt'] },
      rewardLose: { coins: 60 },
      onWin: [
        { say: 'ellie', text: 'Hm. You listen while you play. Not many do.' },
        { say: 'ellie', text: 'Come back up here if you like. Around this hour.' },
        { flag: 'ellie_offen' },
      ],
      onLose: [
        { say: 'ellie', text: 'Your mind was elsewhere. That is not a disgrace, only a result.' },
      ],
    },
    { say: 'ellie', text: 'It is getting cold. I am going in.' },
    { exit: 'ellie' },
    { time: 20 },
    { end: true },
  ],
});

// ── VERZWEIGEND ───────────────────────────────────────────────────
// Zeigt zugleich, wie eine Szene auf ein FRÜHERES Duell reagiert:
// wer Mithuru schon auf der Fähre begegnet ist, bekommt hier einen
// anderen Einstieg.
scene('mithuru_bibliothek', {
  once: true,
  steps: [
    { bg: 'bg_library' },
    { enter: 'mithuru', x: 40, y: 100 },

    { when: { flag: 'mithuru_ferry_done' }, say: 'mithuru',
      text: 'The ferry sample. Good — I had questions about your third turn.' },
    { when: { notFlag: 'mithuru_ferry_done' }, say: 'mithuru',
      text: 'Shh. Not so loud, I am in the middle of a calculation.' },
    { when: { notFlag: 'mithuru_ferry_done' }, say: 'mithuru',
      text: 'Mithuru. I keep statistics on every duel on this island.' },

    { say: 'mithuru', text: 'I already have your match from this morning. Want to know where your mistake was?' },
    {
      choice: [
        { text: '"Go on, then."', goto: 'ja' },
        { text: '"Show me in a duel instead."', goto: 'nein' },
      ],
    },

    { label: 'ja' },
    { say: 'mithuru', text: 'You commit everything too early. Classic. Costs you two turns on average.' },
    { card: 'Coffee', n: 1 },
    { text: 'Mithuru slides a card across the table. *"Keep it. I have three."*' },
    { flag: 'mithuru_rat' },
    { jump: 'duell' },

    { label: 'nein' },
    { say: 'mithuru', text: 'Empiricism over theory. Also a position.' },
    { jump: 'duell' },

    { label: 'duell' },
    { time: 10 },
    {
      duel: 'mithuru_1',
      opponent: 'mithuru',
      opponentName: 'Mithuru',
      mustWin: false,
      rewardWin: { coins: 250, flags: ['mithuru_besiegt'] },
      gotoWin: 'gewonnen',
      gotoLose: 'verloren',
    },

    { label: 'gewonnen' },
    { say: 'mithuru', text: 'Interesting. My forecast gave you 31 percent.' },
    { say: 'mithuru', text: 'I like it when numbers are wrong. Come by more often.' },
    { unlock: 'huegel' },
    { learn: 'huegel' },
    { say: 'mithuru', text: 'By the way: the hill behind the Academy. At sunset. Do not ask, just go.' },
    { end: true },

    { label: 'verloren' },
    { say: 'mithuru', text: 'Forecast confirmed. Nothing personal.' },
    { say: 'mithuru', text: 'Rebuild your deck. I mean it. Your desk is not decorative.' },
    { flag: 'mithuru_spott' },
    { end: true },
  ],
});

// ── MUSS GEWONNEN WERDEN ──────────────────────────────────────────
// Bei einer Niederlage greift `mustWin`: es gibt eine Abschlusstafel
// und der Stand springt auf den Beginn dieser Szene zurück.
scene('ethan_halle', {
  music: 'menu',
  steps: [
    { bg: 'bg_hall' },
    { enter: 'ethan', x: 66, y: 100, flip: true },
    { say: 'ethan', text: 'You are the new one off the morning ferry.' },
    { say: 'ethan', text: 'Ethan. And before you settle in, we settle something.' },
    { say: 'ethan', text: 'This hall belongs to the people who earned it. Everyone else practises outside.' },
    { say: 'ich', text: 'And if I win?' },
    { say: 'ethan', text: 'Then it is yours just as much. That is how simple it is here.' },
    { wait: 400 },
    {
      duel: 'ethan_1',
      opponent: 'ethan',
      opponentName: 'Ethan',
      mustWin: true,
      loseText: 'Ethan keeps the hall — and you head back to the courtyard to try again.',
      reward: { coins: 400, flags: ['halle_frei'] },
      onWin: [
        { say: 'ethan', text: '…' },
        { say: 'ethan', text: 'Good. Practise here, then. I will tell the others.' },
        { say: 'ethan', text: 'And I will be back. You can count on that.' },
        { exit: 'ethan' },
        { text: 'The Duel Hall is open to you.' },
      ],
    },
    { end: true },
  ],
});
