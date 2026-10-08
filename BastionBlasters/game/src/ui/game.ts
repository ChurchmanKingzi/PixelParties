// Spielsteuerung und Oberfläche: Menü, Loadout, Bauphase, Kampf-HUD, Zeitstopp, Inspektor

import { Application } from 'pixi.js';
import { CELL, DT, PLOT, PRIORITIES, PRIORITY_LABEL, ZONES, ZONE_LABEL, RANK_NAMES, RANK_XP, type Priority, type Team, type Zone } from '../sim/constants';
import { BUILDINGS, UNITS, isBuilding } from '../sim/data';
import { botChoose, botPlay } from '../sim/bot';
import { checkRoom, checkTower, checkWallCard, checkYardBuilding, checkYardCell, findOwnModule, footprint, wallRun } from '../sim/bastion';
import { entryStats, freeSlotCount, operatingDegree, citizenLimit, lineActive } from '../sim/systems';
import { keepCount, modEff } from '../sim/bfx';
import { unitFx } from '../sim/fx';
import { buildingImpl } from '../sim/impl';
import { modCenter } from '../sim/combat';
import { Match } from '../sim/match';
import type { Module, Unit } from '../sim/types';
import { ci, type World } from '../sim/world';
import { GameAssets } from '../render/assets';
import { Scene, type Ghost } from '../render/scene';
import { $, assetUrl, clear, el, fmtTime, put, save, store } from './dom';

interface Settings { buildSec: number; pauseSec: number; bars: boolean; nums: boolean; speed: number; seed: number }

const DEFAULTS: Settings = { buildSec: 180, pauseSec: 60, bars: true, nums: true, speed: 1, seed: 7 };

export class Game {
  app!: Application;
  scene!: Scene;
  assets!: GameAssets;
  match: Match | null = null;
  human: Team | null = 0;
  settings: Settings = { ...DEFAULTS, ...store<Partial<Settings>>('settings', {}) };
  speed = 1;
  paused = false;
  acc = 0;
  last = 0;
  lastPhase = '';
  deadline: number | null = null;
  dirty = true;
  focusMode: 'all' | 'plot' = 'all';
  // Bauen
  armed: { card: string; rot: number } | null = null;
  yardMode = false;
  replaceCard: string | null = null;
  ghostKey = '';
  hover: { cx: number; cy: number; wx: number; wy: number } | null = null;
  selected: { kind: 'unit' | 'module'; id: number } | null = null;
  feed: { msg: string; team: number }[] = [];
  top: Record<string, HTMLElement> = {};
  sideT = 0;
  pickSel: string[] = [];
  loadSel: number[] = [];
  endShown = false;
  preview: string | null = null;

  static async boot(): Promise<Game> {
    const g = new Game();
    const stage = $('stage');
    g.app = new Application();
    await g.app.init({ width: Math.max(320, stage.clientWidth), height: Math.max(240, stage.clientHeight), background: '#15281b', antialias: false, resolution: 1, autoDensity: false, preference: 'webgl' });
    stage.insertBefore(g.app.canvas, stage.firstChild);
    g.assets = await GameAssets.load();
    g.scene = new Scene(g.app);
    await g.scene.init(g.assets);
    g.scene.onFeed = (msg, team) => g.pushFeed(msg, team);
    previewHook = (id) => { g.preview = id; g.sideT = 1; };
    g.buildTop();
    g.bindPointer();
    g.bindKeys();
    new ResizeObserver(() => g.onResize()).observe(stage);
    g.onResize();
    g.showMenu();
    g.app.ticker.add(() => g.frame());
    return g;
  }

  onResize() {
    const s = $('stage');
    const w = s.clientWidth, h = s.clientHeight;
    if (w < 100 || h < 100) return;
    this.app.renderer.resize(w, h);
    this.scene.setView(w, h);
    this.applyFocus(true);
  }

  applyFocus(instant = false) {
    if (this.focusMode === 'plot' && this.human !== null) this.scene.focusPlot(this.human, instant);
    else this.scene.focusAll(instant);
  }

  // ---------------------------------------------------------------- Menü

  showMenu() {
    this.match = null;
    this.endShown = false;
    const box = $('box');
    clear(box);
    const buildSel = el('select', {}, ...[[60, '60 s'], [120, '120 s (GDD)'], [180, '180 s'], [0, 'no timer']].map(([v, t]) => el('option', { value: String(v), selected: this.settings.buildSec === v }, String(t))));
    const pauseSel = el('select', {}, ...[[25, '25 s (GDD)'], [45, '45 s'], [60, '60 s'], [120, '120 s'], [0, 'no timer']].map(([v, t]) => el('option', { value: String(v), selected: this.settings.pauseSec === v }, String(t))));
    const seed = el('input', { type: 'number', value: String(this.settings.seed), style: 'width:90px' });
    const start = (mode: 'play' | 'watch') => {
      this.settings.buildSec = Number(buildSel.value);
      this.settings.pauseSec = Number(pauseSel.value);
      this.settings.seed = Number(seed.value) || 1;
      save('settings', this.settings);
      this.startMatch(mode);
    };
    box.append(
      el('h1', {}, 'BASTION BLASTERS'),
      el('div', { class: 'hint' }, 'Combat prototype v0.1 · build a modular bastion, send troops, freeze time every two waves.'),
      el('div', { style: 'height:12px' }),
      el('div', { class: 'panel' },
        el('h3', {}, 'How to play'),
        el('div', {}, '1. Loadout: draw 10 cards, keep 7.  2. Build: place buildings next to your courtyard, put troop cards into the contingent.  3. Battle: everything runs by itself. Artillery breaks walls and rooms, assault troops conquer the core chamber, defenders hold it.  4. Every 2 waves the game freezes: draw 5, keep 3 (placing is mandatory, unplayed cards are lost).'),
        el('div', { class: 'hint', style: 'margin-top:6px' }, 'Win by destroying the enemy core (artillery) or by conquering the core chamber. You are the left (crimson) bastion.'),
      ),
      el('div', { style: 'height:10px' }),
      el('div', { class: 'row' },
        el('div', { class: 'grp' }, el('span', { class: 'lbl' }, 'Build timer'), buildSel),
        el('div', { class: 'grp' }, el('span', { class: 'lbl' }, 'Timestop timer'), pauseSel),
        el('div', { class: 'grp' }, el('span', { class: 'lbl' }, 'Seed'), seed),
      ),
      el('div', { style: 'height:12px' }),
      el('div', { class: 'row' },
        el('button', { class: 'primary', onclick: () => start('play') }, 'Play vs Bot'),
        el('button', { onclick: () => start('watch') }, 'Watch Bot vs Bot'),
        el('span', { class: 'hint' }, 'Cards, art and rules are the real ones from the design docs; not every card ability is wired up yet.'),
      ),
    );
    $('overlay').classList.add('show');
    this.scene?.focusAll(true);
  }

  startMatch(mode: 'play' | 'watch') {
    this.human = mode === 'play' ? 0 : null;
    this.match = new Match({ seed: this.settings.seed, bots: [mode === 'watch', true], ponds: this.assets.bgInfo.ponds });
    this.armed = null; this.yardMode = false; this.replaceCard = null; this.selected = null; this.scene.selected = null;
    this.feed = [];
    this.lastPhase = '';
    this.endShown = false;
    this.speed = this.settings.speed;
    this.paused = false;
    this.scene.showBars = this.settings.bars;
    this.scene.showNumbers = this.settings.nums;
    this.scene.sig = '';
    this.match.startLoadout();
    $('overlay').classList.remove('show');
    this.dirty = true;
  }

  get world(): World { return this.match!.world; }

  // ---------------------------------------------------------------- Hauptschleife

  frame() {
    const now = performance.now();
    const dtReal = Math.min(0.1, (now - (this.last || now)) / 1000);
    this.last = now;
    const m = this.match;
    if (!m) { this.scene.update(emptyWorld()); return; }
    const w = m.world;
    if (w.phase !== this.lastPhase) this.onPhase(w.phase);
    if (w.phase === 'battle' && !this.paused) {
      this.acc += dtReal * this.speed;
      let n = 0;
      while (this.acc >= DT && n < 12) { m.tick(); this.acc -= DT; n++; if (w.phase !== 'battle') break; }
      if (n >= 12) this.acc = 0;
    } else if (w.phase === 'loadout' && this.human === null) m.tick();
    // Zeitgeber der Spielerphasen
    if (this.deadline !== null && (w.phase === 'build' || w.phase === 'pause') && Date.now() > this.deadline) this.timeUp();
    if (w.phase !== this.lastPhase) this.onPhase(w.phase);
    this.scene.update(w);
    this.updateTop();
    this.sideT += dtReal;
    if (this.sideT > 0.25 || this.dirty) { this.sideT = 0; this.renderSide(); }
    if (this.dirty) { this.renderTray(); this.dirty = false; }
    if (w.phase === 'over' && !this.endShown) { this.endShown = true; this.showEnd(); }
  }

  onPhase(phase: string) {
    const w = this.world;
    this.lastPhase = phase;
    $('stage').classList.toggle('frozen', phase === 'pause');
    this.armed = null; this.yardMode = false; this.replaceCard = null;
    this.scene.setGhost(null);
    this.scene.gridTeam = null;
    this.deadline = null;
    this.pickSel = [];
    hudMsg('');
    if (phase === 'loadout') {
      if (this.human === null) { /* Zuschauer: Bots haben schon gewählt */ }
      else this.showLoadout();
    } else if (phase === 'build') {
      $('overlay').classList.remove('show');
      this.focusMode = 'plot';
      if (this.human !== null) {
        this.scene.gridTeam = this.human;
        if (this.settings.buildSec) this.deadline = Date.now() + this.settings.buildSec * 1000;
        hudMsg('Build phase: select a card below, place it next to your courtyard (right click rotates). Press Ready when done.');
      } else this.focusMode = 'all';
      this.applyFocus();
    } else if (phase === 'battle') {
      this.focusMode = 'all';
      this.applyFocus();
      this.acc = 0;
    } else if (phase === 'pause') {
      if (this.human !== null) {
        this.focusMode = 'plot';
        this.scene.gridTeam = this.human;
        if (this.settings.pauseSec) this.deadline = Date.now() + this.settings.pauseSec * 1000;
        hudMsg('TIME STOP: pick the cards you keep, then place them. Unplayed cards are lost.');
      } else this.focusMode = 'all';
      this.applyFocus();
    }
    this.dirty = true;
  }

  timeUp() {
    if (this.human === null) return;
    toast('Time is up');
    this.deadline = null;
    this.ready();
  }

  ready() {
    if (!this.match || this.human === null) return;
    const w = this.world;
    const p = w.players[this.human];
    if (w.phase === 'pause' && p.kept.length === 0 && p.played.length === 0 && p.hand.length) {
      // nichts gewählt: nichts spielen
    }
    this.match.cmd({ t: 'ready', p: this.human });
    this.dirty = true;
  }

  // ---------------------------------------------------------------- Loadout

  showLoadout() {
    const w = this.world;
    const h = this.human!;
    const p = w.players[h];
    this.loadSel = [];
    const box = $('box');
    const render = () => {
      clear(box);
      const grid = el('div', { class: 'grid' });
      p.hand.forEach((id, i) => {
        grid.append(cardEl(id, { big: true, sel: this.loadSel.includes(i), onClick: () => {
          const k = this.loadSel.indexOf(i);
          if (k >= 0) this.loadSel.splice(k, 1); else if (this.loadSel.length < 7) this.loadSel.push(i);
          render();
        } }));
      });
      const ok = this.loadSel.length === 7;
      box.append(
        el('h2', {}, `Loadout: keep 7 of your 10 cards (${this.loadSel.length}/7)`),
        el('div', { class: 'hint' }, 'Buildings go on your plot, troops go into your contingent. Artillery needs a platform (Battlement Ring, Gun Deck, Observatory ...) and troops of other lines need their unlock room (Barracks, Arcanum ...).'),
        grid,
        el('div', { class: 'row' },
          el('button', { class: 'primary', disabled: !ok, onclick: () => { this.match!.keepLoadout(h, this.loadSel.map((i) => p.hand[i])); $('overlay').classList.remove('show'); this.dirty = true; } }, 'Keep these 7'),
          el('button', { disabled: p.mulligan <= 0, onclick: () => { this.match!.mulligan(h); this.loadSel = []; render(); } }, `Mulligan (${p.mulligan})`),
          el('button', { onclick: () => { this.loadSel = []; const keep = botChoose(w, h, p.hand, 7); const pool = p.hand.slice(); for (const id of keep) { const i = pool.indexOf(id); if (i >= 0) { this.loadSel.push(i); pool[i] = ''; } } render(); } }, 'Suggest'),
        ),
      );
    };
    render();
    $('overlay').classList.add('show');
  }

  // ---------------------------------------------------------------- Oberleiste

  buildTop() {
    const top = $('top');
    const mk = (cls: string) => { const i = el('i'); const s = el('span'); const d = el('div', { class: 'bar ' + cls }, i, s); return { d, i, s }; };
    const b0 = mk('p1'), b1 = mk('p2'), c0 = mk('thin conq'), c1 = mk('thin conq');
    this.top = { b0: b0.i, b0t: b0.s, b1: b1.i, b1t: b1.s, c0: c0.i, c1: c1.i };
    const status = el('div', { class: 'grp' }, el('span', { class: 'lbl', id: 'lblPhase' }, ''), el('b', { id: 'txtPhase' }, ''));
    const info = el('div', { class: 'grp' }, el('span', { class: 'lbl' }, 'Bastion'), el('span', { id: 'txtInfo' }, ''));
    const speed = el('div', { class: 'row', style: 'gap:4px' },
      el('button', { id: 'bPause', onclick: () => { this.paused = !this.paused; this.dirty = true; } }, '⏸'),
      ...[1, 2, 4, 8].map((s) => el('button', { id: 'sp' + s, onclick: () => { this.speed = s; this.settings.speed = s; save('settings', this.settings); } }, s + '×')),
    );
    const tog = el('div', { class: 'row', style: 'gap:4px' },
      el('button', { id: 'tBars', title: 'HP bars', onclick: () => { this.scene.showBars = !this.scene.showBars; this.settings.bars = this.scene.showBars; save('settings', this.settings); } }, 'bars'),
      el('button', { id: 'tNums', title: 'Damage numbers', onclick: () => { this.scene.showNumbers = !this.scene.showNumbers; this.settings.nums = this.scene.showNumbers; save('settings', this.settings); } }, 'numbers'),
      el('button', { title: 'Fit map (F)', onclick: () => { this.focusMode = 'all'; this.applyFocus(); } }, 'fit'),
      el('button', { onclick: () => this.showMenu() }, 'menu'),
    );
    top.append(
      el('div', { class: 'grp' }, el('span', { class: 'lbl', style: 'color:var(--p1)' }, 'P1 core'), b0.d, c0.d),
      status, info,
      el('span', { class: 'sp' }),
      speed, tog,
      el('div', { class: 'grp' }, el('span', { class: 'lbl', style: 'color:var(--p2)' }, 'P2 core'), b1.d, c1.d),
    );
  }

  updateTop() {
    const m = this.match;
    if (!m) return;
    const w = m.world;
    const c0 = w.modules.get(w.coreMod[0])!, c1 = w.modules.get(w.coreMod[1])!;
    this.top.b0.style.width = `${Math.max(0, c0.hp / c0.maxHp) * 100}%`;
    this.top.b1.style.width = `${Math.max(0, c1.hp / c1.maxHp) * 100}%`;
    this.top.b0t.textContent = `${Math.max(0, Math.round(c0.hp))} / ${c0.maxHp}`;
    this.top.b1t.textContent = `${Math.max(0, Math.round(c1.hp))} / ${c1.maxHp}`;
    // Eroberung der eigenen Kernkammer durch den Gegner (Leiste unter dem jeweiligen Kern)
    this.top.c0.style.width = `${w.conquest[0]}%`;
    this.top.c1.style.width = `${w.conquest[1]}%`;
    const ph = $('txtPhase'), lb = $('lblPhase');
    const nextWave = Math.max(0, (w.nextWaveTick - w.tick) / 30);
    if (w.phase === 'battle') {
      lb.textContent = `time ${fmtTime(w.battleTime)} · wave ${w.waveNo}`;
      ph.textContent = w.pendingPause ? 'TIME STOP incoming' : `next wave ${nextWave.toFixed(0)}s${w.waveInCycle === 1 ? '' : ''}`;
    } else if (w.phase === 'pause') {
      lb.textContent = `pause ${w.pauseNo}`;
      ph.textContent = this.deadline ? `time left ${fmtTime((this.deadline - Date.now()) / 1000)}` : 'plan your bastion';
    } else if (w.phase === 'build') {
      lb.textContent = 'build phase';
      ph.textContent = this.deadline ? `time left ${fmtTime((this.deadline - Date.now()) / 1000)}` : 'plan your bastion';
    } else if (w.phase === 'loadout') { lb.textContent = 'loadout'; ph.textContent = 'choose your cards'; } else { lb.textContent = 'match over'; ph.textContent = ''; }
    const h = this.human ?? 0;
    const cnt = (t: number) => w.units.filter((u) => !u.dead && u.team === t && u.cat !== 'citizen').length;
    $('txtInfo').textContent = `units ${cnt(0)} : ${cnt(1)} · ops ${(operatingDegree(w, h as Team) * 100).toFixed(0)}% · citizens ${w.units.filter((u) => !u.dead && u.team === h && u.cat === 'citizen').length}/${citizenLimit(w, h as Team)}${w.madness > 0 ? ' · MADNESS +' + (w.madness * 100).toFixed(0) + '%' : ''}`;
    for (const s of [1, 2, 4, 8]) $('sp' + s).classList.toggle('on', this.speed === s && !this.paused);
    $('bPause').classList.toggle('on', this.paused);
    $('tBars').classList.toggle('on', this.scene.showBars);
    $('tNums').classList.toggle('on', this.scene.showNumbers);
  }

  pushFeed(msg: string, team: number) {
    this.feed.push({ msg, team });
    if (this.feed.length > 60) this.feed.shift();
  }

  // ---------------------------------------------------------------- Seitenleiste

  renderSide() {
    const side = $('side');
    const m = this.match;
    if (!m) { clear(side); return; }
    const w = m.world;
    clear(side);
    if (this.preview) side.append(el('div', { class: 'panel' }, el('h3', {}, 'Card'), cardEl(this.preview, { w: 232 })));
    else side.append(this.inspector(w));
    if (this.human !== null) side.append(this.contingentPanel(w));
    const feed = el('div', { id: 'feed' });
    for (const f of this.feed.slice(-9)) feed.append(el('div', { class: f.team === 0 ? 't0' : f.team === 1 ? 't1' : 'tn' }, f.msg));
    side.append(el('div', { class: 'panel' }, el('h3', {}, 'Event feed'), feed));
    side.append(el('div', { class: 'panel hint legend' },
      el('div', {}, 'click: inspect · wheel: zoom · drag: pan · F: fit · space: pause'),
      el('div', {}, el('span', { style: 'background:var(--p1)' }), 'P1 crimson  ', el('span', { style: 'background:var(--p2)' }), 'P2 teal'),
    ));
  }

  inspector(w: World): HTMLElement {
    const box = el('div', { class: 'panel' }, el('h3', {}, 'Inspector'));
    const sel = this.selected;
    if (!sel) { box.append(el('div', { class: 'hint' }, 'Click a unit or a building.')); return box; }
    if (sel.kind === 'unit') {
      const u = w.byId.get(sel.id);
      if (!u || u.dead) { this.selected = null; this.scene.selected = null; box.append(el('div', { class: 'hint' }, 'Gone.')); return box; }
      const d = UNITS[u.cid];
      const next = u.rank < 5 ? RANK_XP[u.rank + 1] : RANK_XP[5];
      put(box,
        el('div', { class: 'row', style: 'align-items:flex-start;gap:8px' },
          d ? cardEl(u.cid, { w: 96 }) : el('div', {}, 'Citizen'),
          el('div', { class: 'kv' },
            el('b', {}, 'Name'), el('span', {}, d ? d.name : 'Citizen'),
            el('b', {}, 'Team'), el('span', { style: `color:var(--p${u.team + 1})` }, `P${u.team + 1}`),
            el('b', {}, 'HP'), el('span', {}, `${Math.round(u.hp)} / ${u.maxHp}`),
            el('b', {}, 'Rank'), el('span', {}, `${RANK_NAMES[u.rank]} (${Math.round(u.xp)}/${next} XP)`),
            el('b', {}, 'State'), el('span', {}, u.state + (u.berserk ? ' (berserk)' : '')),
            el('b', {}, 'Status'), el('span', {}, u.st.map((s) => s.id).join(', ') || '-'),
          ),
        ),
        d ? el('div', { class: 'hint', style: 'margin-top:4px' }, abilityNote(u.cid)) : null,
      );
    } else {
      const mod = w.modules.get(sel.id);
      if (!mod) { this.selected = null; this.scene.selected = null; box.append(el('div', { class: 'hint' }, 'Gone.')); return box; }
      const def = BUILDINGS[mod.card];
      put(box,
        el('div', { class: 'row', style: 'align-items:flex-start;gap:8px' },
          def ? cardEl(mod.card, { w: 96 }) : el('div', {}, 'Core'),
          el('div', { class: 'kv' },
            el('b', {}, 'Name'), el('span', {}, def ? def.name : 'Core'),
            el('b', {}, 'Owner'), el('span', { style: `color:var(--p${mod.owner + 1})` }, `P${mod.owner + 1}`),
            el('b', {}, 'HP'), el('span', {}, `${Math.round(mod.hp)} / ${mod.maxHp}${mod.destroyed ? ' (ruin)' : ''}`),
            el('b', {}, 'Staff'), el('span', {}, mod.posts ? `${mod.staffed} / ${mod.posts}` : '-'),
            el('b', {}, 'Efficiency'), el('span', {}, `${Math.round(modEff(w, mod) * 100)}%`),
            el('b', {}, 'Rank'), el('span', {}, '★'.repeat(mod.star)),
          ),
        ),
        def ? el('div', { class: 'hint', style: 'margin-top:4px' }, `${stripMd(def.rules || def.effectText)} [${buildingImpl(mod.card) === 'full' ? 'effects implemented' : buildingImpl(mod.card) === 'partial' ? 'effects partly implemented' : 'stats only'}]`) : null,
      );
      if (this.human === mod.owner && (w.phase === 'pause' || w.phase === 'build') && mod.kind !== 'core') {
        const pl = w.players[mod.owner];
        box.append(el('button', { style: 'margin-top:6px', disabled: w.phase === 'pause' && pl.moveBudget <= 0, onclick: () => this.pickUp(mod.id) }, w.phase === 'pause' ? `Pick up and move (${pl.moveBudget} left)` : 'Pick up and move'));
      }
    }
    return box;
  }

  contingentPanel(w: World): HTMLElement {
    const h = this.human!;
    const p = w.players[h];
    p.slotsMax = Math.max(p.slotsMax, 5);
    const box = el('div', { class: 'panel' }, el('h3', {}, `Contingent ${p.contingent.length}/${p.slotsMax}`));
    const editable = w.phase === 'build' || w.phase === 'pause';
    if (!p.contingent.length) box.append(el('div', { class: 'hint' }, 'Empty. Play troop cards from your hand.'));
    p.contingent.forEach((e, idx) => {
      const d = UNITS[e.card];
      const { S, N } = entryStats(w, h, idx);
      const alive = e.alive.filter((id) => { const u = w.byId.get(id); return u && !u.dead; }).length;
      const inactive = !lineActive(w, h, d.line);
      const sel: HTMLElement[] = [];
      if (d.cat === 'defender') {
        const s = el('select', { onchange: (ev: Event) => { this.match!.cmd({ t: 'zone', p: h, idx, zone: (ev.target as HTMLSelectElement).value as Zone }); } }, ...ZONES.map((z) => el('option', { value: z, selected: e.zone === z }, ZONE_LABEL[z])));
        s.disabled = !editable && false;
        sel.push(s);
      }
      if (d.cat === 'artillery') {
        sel.push(el('select', { onchange: (ev: Event) => { this.match!.cmd({ t: 'prio', p: h, idx, prio: (ev.target as HTMLSelectElement).value as Priority }); } }, ...PRIORITIES.map((z) => el('option', { value: z, selected: e.prio === z }, PRIORITY_LABEL[z]))));
      }
      const row = el('div', { class: 'ent' + (this.replaceCard ? ' replace' : ''), title: stripMd(d.rules), onclick: () => { if (this.replaceCard) this.doReplace(idx); } },
        el('div', { class: 'th' }, el('img', { src: assetUrl(`cards/${e.card}.png`) })),
        el('div', {},
          el('div', {}, `${d.name} ${'★'.repeat(e.star)}`),
          el('div', { class: 'hint' }, `${d.cat} · ${d.line} · alive ${alive}/${S} · +${N}/wave${inactive ? ' · LOCKED (room missing)' : ''}${d.cat === 'artillery' ? ` · gp ${d.gp}` : ''}`),
          ...sel,
        ),
      );
      box.append(row);
    });
    if (w.phase === 'build' || w.phase === 'pause') box.append(el('div', { class: 'hint', style: 'margin-top:4px' }, `free gun slots ${freeSlotCount(w, h)} · courtyard cells left ${p.yardBudget}`));
    return box;
  }

  // ---------------------------------------------------------------- Tray (Hand)

  renderTray() {
    const tray = $('tray');
    clear(tray);
    this.preview = null;
    const m = this.match;
    if (!m) return;
    const w = m.world;
    const h = this.human;
    if (h === null) {
      tray.append(el('span', { class: 'hint' }, 'Spectating a bot match. Use the speed buttons above.'));
      return;
    }
    const p = w.players[h];
    if (w.phase === 'loadout') { tray.append(el('span', { class: 'hint' }, 'Choose the 7 cards you keep.')); return; }
    if (w.phase === 'battle') {
      tray.append(el('span', { class: 'hint' }, 'Battle runs by itself. Click units to inspect them; select an artillery unit to see its range.'));
      return;
    }
    if (w.phase === 'over') return;
    if (w.phase === 'pause' && p.kept.length === 0 && p.played.length === 0) {
      // Auswahl: 3 von 5
      const n = keepCount(w, h);
      tray.append(el('div', { class: 'grp' }, el('span', { class: 'lbl' }, `Keep ${n} of ${p.hand.length}`), el('b', {}, `${this.pickSel.length}/${n}`)));
      p.hand.forEach((id, i) => {
        tray.append(cardEl(id, { preview: true, sel: this.pickSel.includes(String(i)), onClick: () => {
          const k = this.pickSel.indexOf(String(i));
          if (k >= 0) this.pickSel.splice(k, 1); else if (this.pickSel.length < n) this.pickSel.push(String(i));
          this.dirty = true;
        } }));
      });
      tray.append(el('div', { class: 'grp' },
        el('button', { class: 'primary', disabled: this.pickSel.length === 0, onclick: () => { this.match!.keepPause(h, this.pickSel.map((i) => p.hand[Number(i)])); this.pickSel = []; this.dirty = true; } }, 'Keep selected'),
        el('button', { disabled: p.rerolls <= 0, onclick: () => { this.match!.reroll(h); this.pickSel = []; this.dirty = true; } }, `Reroll (${p.rerolls})`),
        el('button', { onclick: () => { const keep = botChoose(w, h, p.hand, n); const pool = p.hand.slice(); this.pickSel = []; for (const id of keep) { const i = pool.indexOf(id); if (i >= 0) { this.pickSel.push(String(i)); pool[i] = ''; } } this.dirty = true; } }, 'Suggest'),
      ));
      return;
    }
    // Karten spielen
    if (p.kept.length) {
      for (const id of p.kept) {
        const b = isBuilding(id);
        const dup = b && !!findOwnModule(w, h, id);
        tray.append(cardEl(id, {
          preview: true,
          sel: this.armed?.card === id || this.replaceCard === id,
          badge: dup ? 'upgrade ★' : undefined,
          onClick: () => this.clickCard(id),
        }));
      }
    } else tray.append(el('span', { class: 'hint' }, w.phase === 'pause' ? 'All cards played.' : 'Nothing left to play.'));
    const ctl = el('div', { class: 'grp' });
    ctl.append(
      el('button', { class: this.yardMode ? 'on' : '', disabled: p.yardBudget <= 0, onclick: () => { this.yardMode = !this.yardMode; this.armed = null; this.replaceCard = null; this.refreshGhost(); this.dirty = true; if (this.yardMode) hudMsg('Click empty cells next to your courtyard to extend it (free).'); else hudMsg(''); } }, `+ Courtyard cell (${p.yardBudget})`),
      el('button', { disabled: p.kept.length === 0, onclick: () => this.autoPlay() }, 'Auto-place my cards'),
      el('button', { class: 'primary', onclick: () => this.ready() }, w.phase === 'build' ? 'Ready: start battle' : 'Ready: resume'),
    );
    tray.append(ctl);
  }

  autoPlay() {
    const h = this.human!;
    botPlay(this.world, h);
    this.dirty = true;
  }

  clickCard(id: string) {
    const w = this.world;
    const h = this.human!;
    this.yardMode = false;
    this.replaceCard = null;
    if (!isBuilding(id)) {
      const p = w.players[h];
      const have = p.contingent.some((e) => e.card === id);
      p.slotsMax = Math.max(p.slotsMax, 5);
      if (!have && p.contingent.length >= p.slotsMax) {
        this.replaceCard = id;
        this.armed = null;
        hudMsg('Contingent is full: click the entry in the side panel that this troop should replace.');
        this.dirty = true;
        return;
      }
      const r = this.match!.cmd({ t: 'play', p: h, card: id });
      if (!r.ok) toast(r.reason);
      this.dirty = true;
      return;
    }
    const def = BUILDINGS[id];
    if (findOwnModule(w, h, id) && def.kind !== 'wall' && def.kind !== 'gate') {
      const r = this.match!.cmd({ t: 'play', p: h, card: id, upgrade: true });
      toast(r.ok ? 'Upgraded to a higher star rank' : r.reason);
      this.dirty = true;
      return;
    }
    if (def.kind === 'gate') {
      const r = this.match!.cmd({ t: 'play', p: h, card: id });
      toast(r.ok ? 'Gate replaced' : r.reason);
      this.dirty = true;
      return;
    }
    this.armed = this.armed?.card === id ? null : { card: id, rot: 0 };
    hudMsg(this.armed ? `${def.name}: hover your plot, right click rotates, click to place, Esc cancels.` : '');
    this.refreshGhost();
    this.dirty = true;
  }

  doReplace(idx: number) {
    if (!this.replaceCard) return;
    const r = this.match!.cmd({ t: 'play', p: this.human!, card: this.replaceCard, replace: idx });
    if (!r.ok) toast(r.reason);
    this.replaceCard = null;
    hudMsg('');
    this.dirty = true;
  }

  pickUp(id: number) {
    const r = this.match!.cmd({ t: 'pickup', p: this.human!, moduleId: id });
    if (!r.ok) toast(r.reason); else { toast('Building picked up: place it again from your hand'); this.selected = null; this.scene.selected = null; }
    this.dirty = true;
  }

  // ---------------------------------------------------------------- Zeiger

  bindPointer() {
    const c = this.scene.canvas;
    let down: { x: number; y: number; px: number; py: number; moved: boolean; btn: number } | null = null;
    const pos = (e: PointerEvent | WheelEvent) => {
      const r = c.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
    };
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      const p = pos(e);
      down = { x: p.x, y: p.y, px: p.x, py: p.y, moved: false, btn: e.button };
      c.setPointerCapture(e.pointerId);
    });
    c.addEventListener('pointermove', (e) => {
      const p = pos(e);
      this.setHover(p.x, p.y);
      if (down) {
        const dx = p.x - down.px, dy = p.y - down.py;
        if (Math.abs(p.x - down.x) + Math.abs(p.y - down.y) > 5) down.moved = true;
        const building = this.armed || this.yardMode;
        if (down.moved && (down.btn === 1 || (down.btn === 0 && !building))) this.scene.pan(dx, dy);
        down.px = p.x; down.py = p.y;
      }
    });
    c.addEventListener('pointerup', (e) => {
      const p = pos(e);
      const d = down;
      down = null;
      if (!d) return;
      if (d.moved && d.btn !== 2) return;
      if (e.button === 2) { this.rotate(); return; }
      if (e.button === 0) this.click(p.x, p.y);
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = pos(e);
      this.scene.zoomAt(p.x, p.y, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
  }

  bindKeys() {
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
      if (e.key === 'r' || e.key === 'R') this.rotate();
      else if (e.key === 'Escape') { this.armed = null; this.yardMode = false; this.replaceCard = null; hudMsg(''); this.scene.setGhost(null); this.dirty = true; }
      else if (e.key === 'f' || e.key === 'F') { this.focusMode = 'all'; this.applyFocus(); }
      else if (e.key === ' ') { e.preventDefault(); if (this.match?.world.phase === 'battle') { this.paused = !this.paused; } }
      else if (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4') { this.speed = [1, 2, 4, 8][Number(e.key) - 1]; }
    });
  }

  setHover(px: number, py: number) {
    const wp = this.scene.toWorld(px, py);
    this.hover = { wx: wp.x, wy: wp.y, cx: Math.floor(wp.x / CELL), cy: Math.floor(wp.y / CELL) };
    this.refreshGhost();
  }

  rotate() {
    if (this.armed) { this.armed.rot = (this.armed.rot + 1) % 2; this.refreshGhost(); }
  }

  /** Vorschau der aktuellen Platzierung */
  refreshGhost() {
    const sc = this.scene;
    const w = this.match?.world;
    const h = this.human;
    if (!w || h === null || !this.hover || (w.phase !== 'build' && w.phase !== 'pause')) { sc.setGhost(null); return; }
    const { cx, cy, wx, wy } = this.hover;
    if (this.yardMode) {
      const r = checkYardCell(w, h, cx, cy);
      this.ghostKey = `y${cx},${cy}${r.ok}`;
      sc.setGhost({ cells: [[cx, cy]], ok: r.ok });
      return;
    }
    if (!this.armed) { sc.setGhost(null); return; }
    const card = this.armed.card;
    const def = BUILDINGS[card];
    if (def.kind === 'wall') {
      let best: { x: number; y: number; dir: 'E' | 'S'; d: number } | null = null;
      for (const wl of w.walls.values()) {
        if (wl.owner !== h || wl.door || wl.gate || wl.hp <= 0) continue;
        const mx = wl.dir === 'E' ? (wl.x + 1) * CELL : (wl.x + 0.5) * CELL, my = wl.dir === 'E' ? (wl.y + 0.5) * CELL : (wl.y + 1) * CELL;
        const d = Math.hypot(mx - wx, my - wy);
        if (d < 26 && (!best || d < best.d)) best = { x: wl.x, y: wl.y, dir: wl.dir, d };
      }
      if (!best) { sc.setGhost(null); return; }
      const r = checkWallCard(w, h, card, best.x, best.y, best.dir);
      const run = wallRun(w, h, best.x, best.y, best.dir);
      sc.setGhost({ cells: [], ok: r.ok, edges: run.map((x) => ({ x: x.x, y: x.y, dir: x.dir })) });
      this.wallHover = best;
      return;
    }
    if (def.kind === 'tower') {
      const r = checkTower(w, h, card, cx, cy);
      sc.setGhost({ cells: [[cx, cy]], ok: r.ok, card, x: cx, y: cy, cols: 1, rows: 1 });
      return;
    }
    const rot = this.armed.rot;
    const cols = rot % 2 ? def.rows : def.cols, rows = rot % 2 ? def.cols : def.rows;
    const ox = cx - Math.floor(cols / 2), oy = cy - Math.floor(rows / 2);
    const r = def.kind === 'room' ? checkRoom(w, h, card, ox, oy, rot) : checkYardBuilding(w, h, card, ox, oy, rot);
    const fp = footprint(def, ox, oy, rot);
    sc.setGhost({ cells: fp.cells, ok: r.ok, card, x: ox, y: oy, cols: fp.cols, rows: fp.rows, rot });
    this.ghostReason = r.ok ? '' : r.reason;
  }
  wallHover: { x: number; y: number; dir: 'E' | 'S' } | null = null;
  ghostReason = '';

  click(px: number, py: number) {
    const m = this.match;
    if (!m) return;
    const w = m.world;
    const h = this.human;
    const wp = this.scene.toWorld(px, py);
    const cx = Math.floor(wp.x / CELL), cy = Math.floor(wp.y / CELL);
    if (h !== null && (w.phase === 'build' || w.phase === 'pause')) {
      if (this.yardMode) {
        const r = m.cmd({ t: 'yard', p: h, x: cx, y: cy });
        if (!r.ok) toast(r.reason);
        this.dirty = true;
        this.refreshGhost();
        return;
      }
      if (this.armed) {
        const card = this.armed.card;
        const def = BUILDINGS[card];
        let r;
        if (def.kind === 'wall') {
          if (!this.wallHover) return;
          r = m.cmd({ t: 'play', p: h, card, edge: this.wallHover });
        } else if (def.kind === 'tower') r = m.cmd({ t: 'play', p: h, card, x: cx, y: cy });
        else {
          const rot = this.armed.rot;
          const cols = rot % 2 ? def.rows : def.cols, rows = rot % 2 ? def.cols : def.rows;
          r = m.cmd({ t: 'play', p: h, card, x: cx - Math.floor(cols / 2), y: cy - Math.floor(rows / 2), rot });
        }
        if (!r.ok) { toast(r.reason); return; }
        this.armed = null;
        hudMsg('');
        this.scene.setGhost(null);
        this.dirty = true;
        return;
      }
    }
    this.select(wp.x / CELL, wp.y / CELL);
  }

  select(x: number, y: number) {
    const w = this.world;
    let best: Unit | null = null, bd = 0.85;
    for (const u of w.units) {
      if (u.dead || u.state === 'swallowed') continue;
      const d = Math.hypot(u.x - x, u.y - 0.4 - y);
      if (d < bd) { bd = d; best = u; }
    }
    if (best) {
      this.selected = { kind: 'unit', id: best.id };
      this.scene.selected = this.selected;
      this.setRange(best);
      this.dirty = true;
      return;
    }
    const mod = w.moduleAt(Math.floor(x), Math.floor(y));
    if (mod) {
      this.selected = { kind: 'module', id: mod.id };
      this.scene.selected = this.selected;
      this.scene.rangeRings = [];
    } else {
      this.selected = null;
      this.scene.selected = null;
      this.scene.rangeRings = [];
    }
    this.dirty = true;
  }

  setRange(u: Unit) {
    const d = UNITS[u.cid];
    this.scene.rangeRings = [];
    if (d && d.cat === 'artillery' && d.reach) {
      let x = u.x, y = u.y;
      if (u.slot) { const m = this.world.modules.get(u.slot.mod); const s = m?.slots[u.slot.idx]; if (s) { x = s.x; y = s.y; } }
      this.scene.rangeRings = [{ x, y, r: d.reach }];
    } else if (d && (d.range ?? 0) > 1.5) this.scene.rangeRings = [{ x: u.x, y: u.y, r: d.range! }];
  }

  // ---------------------------------------------------------------- Ende

  showEnd() {
    const w = this.world;
    const box = $('box');
    clear(box);
    const s = w.stats;
    const who = w.winner === 0 ? 'Player 1 (crimson) wins' : w.winner === 1 ? 'Player 2 (teal) wins' : 'Draw';
    const how = w.winType === 'core' ? 'by destroying the core' : w.winType === 'conquest' ? 'by conquering the core chamber' : '';
    const row = (k: string, a: string | number, b: string | number) => el('tr', {}, el('td', {}, k), el('td', { style: 'text-align:right;color:var(--p1);padding:0 10px' }, String(a)), el('td', { style: 'text-align:right;color:var(--p2)' }, String(b)));
    box.append(
      el('h1', {}, who),
      el('div', { class: 'hint' }, `${how} · ${fmtTime(w.battleTime)} of battle · ${w.pauseNo} time stops · ${w.waveNo} waves`),
      el('div', { style: 'height:10px' }),
      el('table', {}, el('tbody', {},
        row('', 'P1', 'P2'),
        row('kills', s.kills[0], s.kills[1]),
        row('civilians killed', s.civKilled[0], s.civKilled[1]),
        row('retreats', s.retreats[0], s.retreats[1]),
        row('HP healed', Math.round(s.healed[0]), Math.round(s.healed[1])),
        row('walls breached', s.wallsBroken[0], s.wallsBroken[1]),
        row('buildings lost', s.modulesLost[0], s.modulesLost[1]),
        row('structure damage dealt', Math.round(s.dmgStruct[0]), Math.round(s.dmgStruct[1])),
        row('artillery shots', s.shots[0], s.shots[1]),
      )),
      el('div', { style: 'height:12px' }),
      el('div', { class: 'row' },
        el('button', { class: 'primary', onclick: () => { this.settings.seed += 1; save('settings', this.settings); this.startMatch(this.human === null ? 'watch' : 'play'); } }, 'Rematch (next seed)'),
        el('button', { onclick: () => $('overlay').classList.remove('show') }, 'Look at the battlefield'),
        el('button', { onclick: () => this.showMenu() }, 'Menu'),
      ),
    );
    $('overlay').classList.add('show');
  }
}

// ------------------------------------------------------------------ Hilfsfunktionen

function emptyWorld(): World {
  return EMPTY_WORLD ??= new Match({ seed: 1, bots: [true, true] }).world;
}
let EMPTY_WORLD: World | null = null;

export function stripMd(s: string): string {
  return (s || '').replace(/\*\*/g, '');
}

function abilityNote(cid: string): string {
  const d = UNITS[cid];
  const fx = unitFx(cid);
  const impl = fx.impl === 'full' ? 'effects implemented' : fx.impl === 'partial' ? 'effects partly implemented' : 'stats and role only';
  return `${stripMd(d.rules) || '(no rules text)'}${d.talent ? ' · R3: ' + stripMd(d.talent) : ''} [${impl}]`;
}

let previewHook: ((id: string | null) => void) | null = null;

function cardEl(id: string, o: { big?: boolean; sel?: boolean; dim?: boolean; badge?: string; w?: number; preview?: boolean; onClick?: () => void } = {}): HTMLElement {
  const d = UNITS[id] ?? BUILDINGS[id];
  const c = el('div', { class: 'card' + (o.big ? ' big' : '') + (o.sel ? ' sel' : '') + (o.dim ? ' dim' : ''), title: d ? `${d.name}\n${stripMd(d.rules)}${(d as { talent?: string }).talent ? '\nRank 3: ' + stripMd((d as { talent?: string }).talent!) : ''}` : id },
    el('img', { src: assetUrl(`cards/${id}.png`), alt: d?.name ?? id, draggable: false }),
    o.badge ? el('div', { class: 'badge' }, o.badge) : null);
  if (o.w) c.style.width = o.w + 'px';
  if (o.onClick) c.addEventListener('click', o.onClick);
  if (o.preview) {
    c.addEventListener('mouseenter', () => previewHook?.(id));
    c.addEventListener('mouseleave', () => previewHook?.(null));
  }
  return c;
}

let toastT = 0;
export function toast(msg: string) {
  const t = $('toast');
  t.textContent = msg;
  t.style.display = 'block';
  clearTimeout(toastT);
  toastT = window.setTimeout(() => { t.style.display = 'none'; }, 2200);
}
export function hudMsg(msg: string) {
  const t = $('hudmsg');
  t.textContent = msg;
  t.style.display = msg ? 'block' : 'none';
}

export type { Module };
void ci; void modCenter;
