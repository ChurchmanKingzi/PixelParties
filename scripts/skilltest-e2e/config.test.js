'use strict';
// Raum-Konfiguration (headless): Timer-Felder — 0 heißt „aus", sonst Sekunden innerhalb der Grenzen; alte …Disabled-Flaggen gelten weiter.
const { buildRoomConfig } = require('../../skilltest/index');
const { CONFIG } = require('../../skilltest/config');
let fails = 0;
const check = (name, cond, info) => { if (cond) console.log('  ✓', name); else { fails++; console.log('  ✗', name, info !== undefined ? '→ ' + JSON.stringify(info).slice(0, 300) : ''); } };

console.log('Timer-Felder');
let c = buildRoomConfig({ prepTimerSec: 0, turnTimerSec: 0 });
check('0 schaltet beide Timer aus', c.prepTimerDisabled && c.turnTimerDisabled, c);
c = buildRoomConfig({ prepTimerSec: '0', turnTimerSec: '0' });
check('„0" als Text (Eingabefeld) schaltet ebenfalls aus', c.prepTimerDisabled && c.turnTimerDisabled, c);
c = buildRoomConfig({ prepTimerSec: 120, turnTimerSec: 45 });
check('Zahlen > 0 bleiben an', !c.prepTimerDisabled && !c.turnTimerDisabled && c.prepTimerSec === 120 && c.turnTimerSec === 45, c);
c = buildRoomConfig({ prepTimerSec: 5, turnTimerSec: 5 });
check('Kleine Werte > 0 werden auf das Minimum angehoben, nicht abgeschaltet', !c.prepTimerDisabled && c.prepTimerSec === CONFIG.PREP_TIMER_RANGE[0] && c.turnTimerSec === CONFIG.TURN_TIMER_RANGE[0], c);
c = buildRoomConfig({ prepTimerSec: 99999, turnTimerSec: 99999 });
check('Zu große Werte werden gedeckelt', c.prepTimerSec === CONFIG.PREP_TIMER_RANGE[1] && c.turnTimerSec === CONFIG.TURN_TIMER_RANGE[1], c);
c = buildRoomConfig({ prepTimerSec: 300, prepTimerDisabled: true, turnTimerSec: 90, turnTimerDisabled: true });
check('Alte …Disabled-Flaggen werden weiter akzeptiert', c.prepTimerDisabled && c.turnTimerDisabled, c);
c = buildRoomConfig({});
check('Ohne Angaben gelten die Standardwerte, Timer an', !c.prepTimerDisabled && !c.turnTimerDisabled && c.prepTimerSec === CONFIG.DEFAULT_PREP_TIMER_SEC && c.turnTimerSec === CONFIG.DEFAULT_TURN_TIMER_SEC, c);
c = buildRoomConfig({ prepTimerSec: '', turnTimerSec: '' });
check('Leeres Feld → Standardwert, Timer an', !c.prepTimerDisabled && !c.turnTimerDisabled && c.turnTimerSec === CONFIG.DEFAULT_TURN_TIMER_SEC, c);
process.exit(fails ? 1 : 0);
