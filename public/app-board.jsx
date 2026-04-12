// ═══════════════════════════════════════════
//  PIXEL PARTIES — GAME BOARD
//  BoardCard, BoardZone, animations, effects,
//  prompts, and the main GameBoard component
// ═══════════════════════════════════════════
const { useState, useEffect, useRef, useCallback, useMemo, useContext, useLayoutEffect } = React;
const { api, emitSocket, socket, AppContext, CardMini, FoilOverlay, useFoilBands,
        cardImageUrl, skinImageUrl, typeColor, typeClass, CARDS_BY_NAME, SKINS_DB } = window;

// ═══════════════════════════════════════════
//  SHARED BOARD TOOLTIP SYSTEM
//  Single tooltip rendered in GameBoard, driven
//  by mouse events from BoardCard / CardRevealEntry.
//  Eliminates orphan portal tooltips.
// ═══════════════════════════════════════════
let _boardTooltipSetter = null;
let _activeLuckTooltipTarget = null;
let _boardTooltipLocked = false;
function setBoardTooltip(card) {
  // When locked (prompt card hovered), ignore external clears
  if (!card && _boardTooltipLocked) return;
  _boardTooltipSetter?.(card);
}

function BoardCard({ cardName, faceDown, flipped, label, hp, maxHp, atk, hpPosition, style, noTooltip, skins }) {
  const card = faceDown ? null : CARDS_BY_NAME[cardName];
  const imgUrl = card ? cardImageUrl(card.name, skins) : null;

  // Foil support
  const foilType = card?.foil || null;
  const isFoil = foilType === 'secret_rare' || foilType === 'diamond_rare';
  const foilClass = foilType === 'diamond_rare' ? 'foil-diamond-rare' : foilType === 'secret_rare' ? 'foil-secret-rare' : '';
  const foilBands = useFoilBands(isFoil);
  const foilMeta = useRef(null);
  if (isFoil && !foilMeta.current) {
    foilMeta.current = {
      shimmerOffset: `${-Math.random() * 5000}ms`,
      sparkleDelays: SPARKLE_POSITIONS.map(sp => sp.delay + Math.random() * 2),
    };
  } else if (!isFoil && foilMeta.current) {
    foilMeta.current = null;
  }

  return (
    <div className={'board-card' + (faceDown ? ' face-down' : '') + (flipped ? ' flipped' : '') + (foilClass ? ' ' + foilClass : '')}
      style={style}
      onMouseEnter={() => !noTooltip && !faceDown && card && setBoardTooltip(card)}
      onMouseLeave={() => setBoardTooltip(null)}
      onTouchStart={() => {
        if (noTooltip || faceDown || !card) return;
        window._longPressFired = false;
        window._longPressTimer = setTimeout(() => {
          window._longPressFired = true;
          setTapTooltip(card.name);
          setBoardTooltip(card);
        }, window.LONG_PRESS_MS || 400);
      }}>
      {isFoil && foilMeta.current && <FoilOverlay bands={foilBands} shimmerOffset={foilMeta.current.shimmerOffset} sparkleDelays={foilMeta.current.sparkleDelays} foilType={foilType} />}
      {faceDown ? (
        <img src="/cardback.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
      ) : imgUrl ? (
        <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
      ) : (
        <div className="board-card-text">{cardName || '?'}</div>
      )}
      {label && <div className="board-card-label">{label}</div>}
      {hp != null && maxHp != null && hp > maxHp && (
        <div className="board-card-overheal-barrier" />
      )}
      {hp != null && hpPosition && (
        <div className={'board-card-hp board-card-hp-' + hpPosition}
          style={hp != null && maxHp != null && hp > maxHp ? { color: '#44ff88' } : undefined}>
          {hp}
        </div>
      )}
      {atk != null && hpPosition === 'hero' && (
        <div className="board-card-atk board-card-atk-hero">
          {atk}
        </div>
      )}
    </div>
  );
}

function BoardZone({ type, cards, label, faceDown, flipped, stackLabel, children, onClick, onHoverCard, style }) {
  const cls = 'board-zone board-zone-' + type;
  const topCardName = cards && cards.length > 0 && !faceDown ? cards[cards.length - 1] : null;
  const suppressChildTooltip = !!onClick && !!onHoverCard;
  return (
    <div className={cls + (onClick && cards?.length > 0 ? ' board-zone-clickable' : '')}
      style={style}
      onClick={onClick && cards?.length > 0 ? onClick : undefined}
      onMouseEnter={() => topCardName && onHoverCard && !window.activeDragData && !window.deckDragState && onHoverCard(topCardName)}
      onMouseLeave={() => onHoverCard && onHoverCard(null)}>
      {cards && cards.length > 0 ? (
        cards.length === 1 ? (
          <BoardCard cardName={cards[0]} faceDown={faceDown} flipped={flipped} label={stackLabel} noTooltip={suppressChildTooltip} />
        ) : (
          <div className="board-stack">
            <BoardCard cardName={cards[cards.length - 1]} faceDown={faceDown} flipped={flipped} label={stackLabel || (cards.length + '')} noTooltip={suppressChildTooltip} />
          </div>
        )
      ) : children || (
        <div className="board-zone-empty">{label || ''}</div>
      )}
    </div>
  );
}

// Floating damage number that finds its target hero and animates above it
function DamageNumber({ amount, heroName }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const ownerLabels = ['me', 'opp'];
    for (const ol of ownerLabels) {
      for (let hi = 0; hi < 3; hi++) {
        const el = document.querySelector(`[data-hero-zone][data-hero-owner="${ol}"][data-hero-idx="${hi}"]`);
        if (!el) continue;
        const nameEl = el.querySelector('.board-card-name, .card-name');
        const heroEl = el;
        const rect = heroEl.getBoundingClientRect();
        const nameText = heroEl.getAttribute('data-hero-name') || el.textContent;
        if (nameText && nameText.includes(heroName.split(',')[0])) {
          setPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.3 });
          return;
        }
      }
    }
    // Fallback: center of screen
    if (!pos) {
      setPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
  }, [heroName]);

  if (!pos) return null;
  return (
    <div className="damage-number" style={{ left: pos.x, top: pos.y }}>
      -{amount}
    </div>
  );
}

// Floating heal number for heroes (green, rising)
function HealNumber({ amount, ownerLabel, heroIdx }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const el = document.querySelector(`[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top + r.height * 0.3 });
    }
  }, [ownerLabel, heroIdx]);

  if (!pos) return null;
  return (
    <div className="damage-number heal-number" style={{ left: pos.x, top: pos.y }}>
      +{amount}
    </div>
  );
}

// Floating damage number for creatures (finds by support zone data attributes)
function CreatureDamageNumber({ amount, ownerLabel, heroIdx, zoneSlot }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const el = document.querySelector(`[data-support-zone="1"][data-support-owner="${ownerLabel}"][data-support-hero="${heroIdx}"][data-support-slot="${zoneSlot}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top + r.height * 0.3 });
    }
  }, [ownerLabel, heroIdx, zoneSlot]);

  if (!pos) return null;
  return (
    <div className="damage-number" style={{ left: pos.x, top: pos.y }}>
      -{amount}
    </div>
  );
}

// Floating gold gain number
function GoldGainNumber({ amount, playerIdx, isMe }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const el = document.querySelector(`[data-gold-player="${playerIdx}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      // Player's gold: float upward from above. Opponent's gold: float downward from below.
      setPos({ x: r.left - 10, y: isMe ? r.top - 40 : r.bottom + 10, isMe });
    }
  }, [playerIdx]);

  if (!pos) return null;
  return (
    <div className={isMe ? 'gold-gain-number' : 'gold-gain-number gold-gain-down'} style={{ left: pos.x, top: pos.y }}>
      +{amount}
    </div>
  );
}

function GoldLossNumber({ amount, playerIdx, isMe }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const el = document.querySelector(`[data-gold-player="${playerIdx}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ x: r.left - 10, y: isMe ? r.top - 40 : r.bottom + 10, isMe });
    }
  }, [playerIdx]);

  if (!pos) return null;
  return (
    <div className={isMe ? 'gold-loss-number' : 'gold-loss-number gold-loss-down'} style={{ left: pos.x, top: pos.y }}>
      -{amount}
    </div>
  );
}

// Floating level change number above a creature
function LevelChangeNumber({ delta, owner, heroIdx, zoneSlot, myIdx }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const ownerLabel = owner === myIdx ? 'me' : 'opp';
    const el = document.querySelector(`[data-support-zone][data-support-owner="${ownerLabel}"][data-support-hero="${heroIdx}"][data-support-slot="${zoneSlot}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top });
    }
  }, [owner, heroIdx, zoneSlot]);

  if (!pos) return null;
  return (
    <div className={delta > 0 ? 'level-change-number' : 'level-change-number level-change-negative'} style={{ left: pos.x, top: pos.y }}>
      {delta > 0 ? '+' : ''}{delta}
    </div>
  );
}

// Floating HP change number above a hero (Toughness)
function ToughnessHpNumber({ amount, owner, heroIdx, myIdx }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const ownerLabel = owner === myIdx ? 'me' : 'opp';
    const el = document.querySelector(`[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top - 10 });
    }
  }, [owner, heroIdx]);

  if (!pos) return null;
  return (
    <div className={amount > 0 ? 'toughness-hp-number toughness-hp-up' : 'toughness-hp-number toughness-hp-down'} style={{ left: pos.x, top: pos.y }}>
      {amount > 0 ? '+' : ''}{amount}
    </div>
  );
}

// Floating ATK change number above a hero (Fighting)
function FightingAtkNumber({ amount, owner, heroIdx, myIdx }) {
  const [pos, setPos] = useState(null);
  useEffect(() => {
    const ownerLabel = owner === myIdx ? 'me' : 'opp';
    const el = document.querySelector(`[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ x: r.left + r.width / 2, y: r.top - 10 });
    }
  }, [owner, heroIdx]);

  if (!pos) return null;
  return (
    <div className={amount > 0 ? 'fighting-atk-number fighting-atk-up' : 'fighting-atk-number fighting-atk-down'} style={{ left: pos.x, top: pos.y }}>
      {amount > 0 ? '+' : ''}{amount}
    </div>
  );
}

// Floating card that animates from deck position to hand slot position
function DrawAnimCard({ cardName, origIdx, startX, startY, dimmed }) {
  const [endPos, setEndPos] = useState(null);

  useEffect(() => {
    // Wait one frame for the invisible hand slot to be laid out
    requestAnimationFrame(() => {
      const targetSlot = document.querySelector(`.game-hand-me .hand-slot[data-hand-idx="${origIdx}"]`);
      if (targetSlot) {
        const r = targetSlot.getBoundingClientRect();
        setEndPos({ x: r.left, y: r.top });
      }
    });
  }, [origIdx]);

  // Before we know the end position, render at deck position (hidden)
  if (!endPos) return null;

  const dx = endPos.x - startX;
  const dy = endPos.y - startY;

  return (
    <div className={'draw-anim-card' + (dimmed ? ' hand-card-dimmed' : '')}
      style={{ left: startX, top: startY, '--dx': dx + 'px', '--dy': dy + 'px' }}>
      <BoardCard cardName={cardName} />
    </div>
  );
}

// Opponent draw animation — face-down card flies from opp deck to opp hand
function OppDrawAnimCard({ id, startX, startY, endX, endY, cardName, cardbackUrl }) {
  const dx = endX - startX;
  const dy = endY - startY;
  return (
    <div className="draw-anim-card"
      style={{ left: startX, top: startY, '--dx': dx + 'px', '--dy': dy + 'px' }}>
      {cardName ? (
        <BoardCard cardName={cardName} noTooltip />
      ) : (
        <div className="board-card face-down" style={{ width: '100%', height: '100%' }}>
          <img src={cardbackUrl || "/cardback.png"} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
        </div>
      )}
    </div>
  );
}

function DiscardAnimCard({ cardName, startX, startY, endX, endY, dest }) {
  const dx = endX - startX;
  const dy = endY - startY;
  const card = CARDS_BY_NAME[cardName];
  const imgUrl = card ? cardImageUrl(card.name) : null;
  const isDeleted = dest === 'deleted';
  const isDeckReturn = dest === 'deck';
  return (
    <div className={'discard-anim-card' + (isDeleted ? ' discard-anim-deleted' : '') + (isDeckReturn ? ' discard-anim-deck-return' : '')}
      style={{ left: startX, top: startY, '--dx': dx + 'px', '--dy': dy + 'px' }}>
      <div className="board-card" style={{ width: '100%', height: '100%' }}>
        {imgUrl ? <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
        : <div className="board-card-text">{cardName || '?'}</div>}
      </div>
      {isDeleted && <div className="delete-energy-overlay" />}
    </div>
  );
}

// ═══════════════════════════════════════════
//  MODULAR GAME ANIMATION SYSTEM
//  Add new animation types by adding to ANIM_REGISTRY.
//  Usage: playAnimation('explosion', '#target-selector', { duration: 800 })
// ═══════════════════════════════════════════

// Draggable floating panel — used for targeting dialogs, first-choice, etc.
function DraggablePanel({ children, className, style }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });
  const panelRef = useRef(null);
  const cleanupRef = useRef(null);
  const onDown = (e) => {
    if (e.target.tagName === 'BUTTON') return; // Don't drag when clicking buttons
    const r = panelRef.current?.getBoundingClientRect();
    if (!r) return;
    const pt = window.getPointerXY(e);
    offsetRef.current = { x: pt.x - r.left, y: pt.y - r.top };
    setDragging(true);
    if (e.cancelable) e.preventDefault();
  };
  useEffect(() => {
    if (!dragging) return;
    const cleanup = window.addDragListeners(
      (mx, my) => {
        setPos({ x: mx - offsetRef.current.x, y: my - offsetRef.current.y });
      },
      () => setDragging(false)
    );
    cleanupRef.current = cleanup;
    return cleanup;
  }, [dragging]);
  const hasCustomPos = pos.x !== 0 || pos.y !== 0;
  const posStyle = hasCustomPos
    ? { position: 'fixed', left: pos.x, top: pos.y, transform: 'none' }
    : {};
  return (
    <div ref={panelRef} className={className} style={{ ...style, ...posStyle, cursor: dragging ? 'grabbing' : 'grab' }}
      onMouseDown={onDown} onTouchStart={onDown} onClick={e => e.stopPropagation()}>
      {children}
    </div>
  );
}

// Frozen overlay with animated snowflake particles
function FrozenOverlay() {
  const particles = useMemo(() => Array.from({ length: 14 }, () => ({
    x: 5 + Math.random() * 90,
    y: 5 + Math.random() * 90,
    size: 5 + Math.random() * 7,
    delay: Math.random() * 3,
    dur: 1.5 + Math.random() * 2,
    char: ['❄','❅','❆','✦','✧','·','*'][Math.floor(Math.random() * 7)],
  })), []);
  return (
    <div className="status-frozen-overlay">
      {particles.map((p, i) => (
        <span key={i} className="frozen-particle" style={{
          left: p.x + '%', top: p.y + '%', fontSize: p.size,
          animationDelay: p.delay + 's', animationDuration: p.dur + 's',
        }}>{p.char}</span>
      ))}
    </div>
  );
}

// Immune/Shielded status icon with instant custom tooltip
function ImmuneIcon({ heroName, statusType }) {
  const tooltipKey = statusType === 'shielded' ? 'shielded' : 'immune';
  return (
    <div className={'status-immune-icon' + (statusType === 'shielded' ? ' status-shielded-icon' : '')}
      onMouseEnter={() => { window._immuneTooltip = heroName; window._immuneTooltipType = tooltipKey; window.dispatchEvent(new Event('immuneHover')); }}
      onMouseLeave={() => { window._immuneTooltip = null; window._immuneTooltipType = null; window.dispatchEvent(new Event('immuneHover')); }}>
      🛡️
    </div>
  );
}

// Card reveal — opponent's played card appears centered and expands/fades
function CardRevealOverlay({ reveals, onRemove }) {
  return (
    <div className="card-reveal-stack">
      {reveals.map((rev, idx) => (
        <CardRevealEntry key={rev.id} cardName={rev.cardName} onDone={() => onRemove(rev.id)} />
      ))}
    </div>
  );
}

function CardRevealEntry({ cardName, onDone }) {
  const card = CARDS_BY_NAME[cardName];
  const imgUrl = card ? cardImageUrl(card.name) : null;
  const foilType = card?.foil || null;
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => { clearTimeout(t); setBoardTooltip(null); }; // Clear tooltip on unmount
  }, []);
  if (!card) return null;
  return (
    <div className="card-reveal-entry"
      onMouseEnter={() => setBoardTooltip(card)} onMouseLeave={() => setBoardTooltip(null)}>
      <div className="card-reveal-card">
        {imgUrl ? (
          <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6,
            border: foilType === 'diamond_rare' ? '3px solid rgba(120,200,255,.7)' : foilType === 'secret_rare' ? '3px solid rgba(255,215,0,.6)' : '2px solid var(--bg4)' }} draggable={false} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg3)', borderRadius: 6, border: '2px solid var(--bg4)', padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: typeColor(card.cardType), marginBottom: 8 }}>{card.name}</div>
            <div style={{ fontSize: 14, color: 'var(--text2)' }}>{card.cardType}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExplosionEffect({ x, y }) {
  const particles = useMemo(() => Array.from({ length: 24 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 25 + Math.random() * 55;
    return {
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 8,
      color: ['#ff4400','#ff8800','#ffcc00','#ff2200','#ffaa00','#fff'][Math.floor(Math.random() * 6)],
      delay: Math.random() * 80,
      dur: 350 + Math.random() * 400,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-explosion-flash" />
      {particles.map((p, i) => (
        <div key={i} className="anim-explosion-particle" style={{
          '--dx': p.dx + 'px', '--dy': p.dy + 'px', '--size': p.size + 'px',
          '--color': p.color, animationDelay: p.delay + 'ms', animationDuration: p.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

function FreezeEffect({ x, y, w, h }) {
  // Snowballs from right side + ice crystal burst
  const snowballs = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    startX: 120 + Math.random() * 40,
    startY: -40 + Math.random() * 40,
    delay: i * 60 + Math.random() * 40,
    dur: 250 + Math.random() * 150,
    size: 6 + Math.random() * 6,
  })), []);
  const crystals = useMemo(() => Array.from({ length: 16 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 15 + Math.random() * 35;
    return {
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 7,
      color: ['#aaddff','#88ccff','#cceeFF','#ffffff','#66bbff'][Math.floor(Math.random() * 5)],
      delay: 400 + Math.random() * 200,
      dur: 400 + Math.random() * 300,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      {/* Ice flash */}
      <div className="anim-freeze-flash" />
      {/* Snowballs from right */}
      {snowballs.map((s, i) => (
        <div key={'sb'+i} className="anim-snowball" style={{
          '--startX': s.startX + 'px', '--startY': s.startY + 'px',
          '--size': s.size + 'px',
          animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
        }} />
      ))}
      {/* Ice crystal particles */}
      {crystals.map((c, i) => (
        <div key={'cr'+i} className="anim-explosion-particle" style={{
          '--dx': c.dx + 'px', '--dy': c.dy + 'px', '--size': c.size + 'px',
          '--color': c.color, animationDelay: c.delay + 'ms', animationDuration: c.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

function ThawEffect({ x, y }) {
  const drips = useMemo(() => Array.from({ length: 12 }, () => ({
    xOff: -20 + Math.random() * 40,
    speed: 30 + Math.random() * 50,
    size: 3 + Math.random() * 5,
    delay: Math.random() * 300,
    dur: 500 + Math.random() * 400,
    color: ['#aaddff','#88ccff','#cceeFF','#ddf4ff'][Math.floor(Math.random() * 4)],
  })), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-thaw-flash" />
      {drips.map((d, i) => (
        <div key={i} className="anim-thaw-drip" style={{
          '--xOff': d.xOff + 'px', '--speed': d.speed + 'px', '--size': d.size + 'px',
          '--color': d.color, animationDelay: d.delay + 'ms', animationDuration: d.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

// Electric strike — small lightning bolts from all directions converging on target
function ElectricStrikeEffect({ x, y }) {
  const bolts = useMemo(() => Array.from({ length: 16 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 55 + Math.random() * 45;
    return {
      startX: Math.cos(angle) * dist,
      startY: Math.sin(angle) * dist,
      size: 8 + Math.random() * 10,
      delay: Math.random() * 200,
      dur: 150 + Math.random() * 150,
      rotation: (angle * 180 / Math.PI) + 180, // Point toward center
    };
  }), []);
  const sparks = useMemo(() => Array.from({ length: 14 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 12 + Math.random() * 30;
    return {
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 5,
      color: ['#ffe033','#fff','#ffcc00','#ffffaa','#ffd700'][Math.floor(Math.random() * 5)],
      delay: 250 + Math.random() * 150,
      dur: 250 + Math.random() * 250,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-electric-flash" />
      {bolts.map((b, i) => (
        <div key={'eb'+i} className="anim-electric-bolt" style={{
          '--startX': b.startX + 'px', '--startY': b.startY + 'px', '--size': b.size + 'px',
          '--rotation': b.rotation + 'deg',
          animationDelay: b.delay + 'ms', animationDuration: b.dur + 'ms',
        }}>⚡</div>
      ))}
      {sparks.map((s, i) => (
        <div key={'es'+i} className="anim-explosion-particle" style={{
          '--dx': s.dx + 'px', '--dy': s.dy + 'px', '--size': s.size + 'px',
          '--color': s.color, animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

// Negated overlay — persistent small electricity sparks on the hero
function NegatedOverlay() {
  const sparks = useMemo(() => Array.from({ length: 10 }, () => ({
    x: 8 + Math.random() * 84,
    y: 8 + Math.random() * 84,
    size: 7 + Math.random() * 6,
    delay: Math.random() * 2,
    dur: 0.4 + Math.random() * 0.6,
  })), []);
  return (
    <div className="status-negated-overlay">
      {sparks.map((s, i) => (
        <span key={i} className="negated-spark" style={{
          left: s.x + '%', top: s.y + '%', fontSize: s.size,
          animationDelay: s.delay + 's', animationDuration: s.dur + 's',
        }}>⚡</span>
      ))}
    </div>
  );
}

// Flame strike — fire converging from all directions onto target
function FlameStrikeEffect({ x, y }) {
  const flames = useMemo(() => Array.from({ length: 18 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 55 + Math.random() * 45;
    return {
      startX: Math.cos(angle) * dist,
      startY: Math.sin(angle) * dist,
      size: 10 + Math.random() * 12,
      delay: Math.random() * 180,
      dur: 200 + Math.random() * 150,
      char: ['🔥','🔥','🔥','✦','·'][Math.floor(Math.random() * 5)],
    };
  }), []);
  const sparks = useMemo(() => Array.from({ length: 12 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 15 + Math.random() * 30;
    return {
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 5,
      color: ['#ff4400','#ff8800','#ffcc00','#ff2200','#ffaa00'][Math.floor(Math.random() * 5)],
      delay: 300 + Math.random() * 150,
      dur: 300 + Math.random() * 250,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-flame-flash" />
      {flames.map((f, i) => (
        <div key={'fl'+i} className="anim-flame-shard" style={{
          '--startX': f.startX + 'px', '--startY': f.startY + 'px', '--size': f.size + 'px',
          animationDelay: f.delay + 'ms', animationDuration: f.dur + 'ms',
        }}>{f.char}</div>
      ))}
      {sparks.map((s, i) => (
        <div key={'fs'+i} className="anim-explosion-particle" style={{
          '--dx': s.dx + 'px', '--dy': s.dy + 'px', '--size': s.size + 'px',
          '--color': s.color, animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

// Burned overlay — persistent small flame particles on the hero
function BurnedOverlay({ ticking }) {
  const flames = useMemo(() => Array.from({ length: 10 }, () => ({
    x: 8 + Math.random() * 84,
    y: 15 + Math.random() * 70,
    size: 8 + Math.random() * 6,
    delay: Math.random() * 2,
    dur: 0.6 + Math.random() * 0.6,
  })), []);
  return (
    <div className={'status-burned-overlay' + (ticking ? ' burn-ticking' : '')}>
      {flames.map((f, i) => (
        <span key={i} className="burned-particle" style={{
          left: f.x + '%', top: f.y + '%', fontSize: f.size,
          animationDelay: f.delay + 's', animationDuration: f.dur + 's',
        }}>🔥</span>
      ))}
    </div>
  );
}

function PoisonedOverlay({ stacks }) {
  const bubbles = useMemo(() => Array.from({ length: 8 }, () => ({
    x: 10 + Math.random() * 80,
    y: 20 + Math.random() * 60,
    size: 6 + Math.random() * 5,
    delay: Math.random() * 2.5,
    dur: 0.8 + Math.random() * 0.8,
  })), []);
  return (
    <div className="status-poisoned-overlay">
      {bubbles.map((b, i) => (
        <span key={i} className="poisoned-particle" style={{
          left: b.x + '%', top: b.y + '%', fontSize: b.size,
          animationDelay: b.delay + 's', animationDuration: b.dur + 's',
        }}>☠️</span>
      ))}
      {stacks >= 1 && <div className="poison-stack-count">{stacks}</div>}
    </div>
  );
}

function HealReversedOverlay() {
  const particles = useMemo(() => Array.from({ length: 10 }, () => ({
    x: 10 + Math.random() * 80,
    y: 20 + Math.random() * 60,
    size: 5 + Math.random() * 4,
    delay: Math.random() * 3,
    dur: 1.2 + Math.random() * 1.2,
    isSkull: Math.random() < 0.25,
    color: Math.random() < 0.5,
  })), []);
  return (
    <div className="status-heal-reversed-overlay">
      {particles.map((p, i) => (
        <span key={i} className="heal-reversed-particle" style={{
          left: p.x + '%', top: p.y + '%', fontSize: p.size,
          animationDelay: p.delay + 's', animationDuration: p.dur + 's',
          color: p.isSkull ? '#ddd' : p.color ? '#66ff99' : '#cc66ff',
        }}>{p.isSkull ? '💀' : '✦'}</span>
      ))}
    </div>
  );
}

// ═══ GENERIC GAME TOOLTIP ═══
// Global tooltip system — renders at top level, escapes overflow:hidden.
// Usage: onMouseEnter={e => showGameTooltip(e, 'text')} onMouseLeave={hideGameTooltip}
function showGameTooltip(e, text) {
  const r = e.currentTarget.getBoundingClientRect();
  window._gameTooltip = { text, x: r.right + 6, y: r.top + r.height / 2 };
  window.dispatchEvent(new Event('gameTooltip'));
}
function hideGameTooltip() {
  window._gameTooltip = null;
  window.dispatchEvent(new Event('gameTooltip'));
}
function GameTooltip() {
  const [tip, setTip] = useState(null);
  useEffect(() => {
    const handler = () => setTip(window._gameTooltip ? { ...window._gameTooltip } : null);
    window.addEventListener('gameTooltip', handler);
    return () => window.removeEventListener('gameTooltip', handler);
  }, []);
  if (!tip) return null;
  return (
    <div className="game-tooltip" style={{ position: 'fixed', left: tip.x, top: tip.y, transform: 'translateY(-50%)', zIndex: 9990 }}>
      {tip.text}
    </div>
  );
}

// Status badges — small icons showing active negative statuses at a glance
function StatusBadges({ statuses, counters, isHero, player }) {
  const badges = [];
  const s = statuses || {};
  const c = counters || {};
  // Helper: build duration text from status data
  const dur = (statusData) => {
    if (!statusData || typeof statusData !== 'object') return ' Wears off at the end of its owner\'s turn.';
    if (statusData.duration != null && statusData.duration > 1) {
      return ` Lasts for ${statusData.duration} of its owner's turns.`;
    }
    return ' Wears off at the end of its owner\'s turn.';
  };
  const durStart = (statusData) => {
    if (!statusData || typeof statusData !== 'object') return ' Wears off at the start of its owner\'s turn.';
    return ' Wears off at the start of its owner\'s turn.';
  };
  if (s.frozen || c.frozen) badges.push({ key: 'frozen', icon: '❄️', tooltip: 'Frozen: Cannot act and has its effects and Abilities negated.' + (isHero ? ' Cannot be equipped with Artifacts.' : '') + dur(s.frozen || c.frozen) });
  if (s.stunned || c.stunned) badges.push({ key: 'stunned', icon: '⚡', tooltip: 'Stunned: Cannot act and has its effects and Abilities negated.' + dur(s.stunned || c.stunned) });
  if (c._baihuStunned) badges.push({ key: 'petrified', icon: '🪨', tooltip: `Petrified: Stunned and immune to all damage. Lasts for ${c._baihuStunned.duration || 1} of its owner's turns.` });
  if (s.burned || c.burned) badges.push({ key: 'burned', icon: '🔥', tooltip: 'Burned: Takes 60 damage at the start of each of its owner\'s turns.' });
  if (s.poisoned || c.poisoned) {
    const stacks = s.poisoned?.stacks || c.poisonStacks || c.poisoned || 1;
    const perStack = player?.poisonDamagePerStack || 30;
    const isUnhealable = s.poisoned?.unhealable || c.poisonedUnhealable;
    badges.push({ key: 'poisoned', icon: isUnhealable ? '💀' : '☠️', tooltip: `${isUnhealable ? 'Unhealable ' : ''}Poisoned: Takes ${perStack * stacks} damage at the start of each of its owner's turns.${isUnhealable ? ' Cannot be removed.' : ''}`, className: isUnhealable ? 'status-unhealable' : '' });
  }
  if (s.negated || c.negated) badges.push({ key: 'negated', icon: '🚫', tooltip: (isHero ? 'Negated: Has its effects and Abilities negated.' : 'Negated: Has its effects negated.') + dur(s.negated || c.negated) });
  if (s.immune) badges.push({ key: 'immune', icon: '🛡️', tooltip: 'Immune: Cannot be affected by Crowd Control effects.' + durStart(s.immune) });
  if (s.shielded) badges.push({ key: 'shielded', icon: '✨', tooltip: 'Shielded: Cannot be affected by anything during its first turn.' + durStart(s.shielded) });
  if (s.untargetable) badges.push({ key: 'untargetable', icon: '🦋', tooltip: 'Untargetable: Cannot be chosen by the opponent with Attacks, Spells or Creature effects while other Heroes can be chosen.' });
  if (s.healReversed) badges.push({ key: 'healReversed', icon: '💀', tooltip: 'Overheal Shock: Takes any healing as damage.' });
  if (badges.length === 0) return null;
  return (
    <div className="status-badges-row">
      {badges.map(b => (
        <div key={b.key} className="status-badge"
          onMouseEnter={e => showGameTooltip(e, b.tooltip)}
          onMouseLeave={hideGameTooltip}>
          {b.icon}
        </div>
      ))}
    </div>
  );
}

// Buff column — displays positive buff icons on heroes/creatures
function BuffColumn({ buffs }) {
  if (!buffs || Object.keys(buffs).length === 0) return null;
  const BUFF_ICONS = { cloudy: { icon: '☁️', tooltip: 'Takes half damage from all sources!' }, dark_gear_negated: { icon: '⚙️', tooltip: 'Effects negated by Dark Gear!' }, diplomacy_negated: { icon: '🕊️', tooltip: 'Effects negated due to Diplomacy!' }, necromancy_negated: { icon: '💀', tooltip: 'Effects negated due to Necromancy!' }, freeze_immune: { icon: '🔥', tooltip: 'Cannot be Frozen!' }, immortal: { icon: '✨', tooltip: 'Cannot have its HP dropped below 1.' }, combo_locked: { icon: '🔒', tooltip: 'Cannot perform Actions this turn.' }, submerged: { icon: '🌊', tooltip: 'Unaffected by all cards and effects while other possible targets exist!' }, negative_status_immune: { icon: '😎', tooltip: 'Immune to all negative status effects!' }, charmed: { icon: '💕', tooltip: 'Charmed! Under opponent control and immune to all effects.' } };
  return (
    <div className="buff-column">
      {Object.entries(buffs).map(([key]) => {
        const def = BUFF_ICONS[key] || { icon: '✦', tooltip: key };
        return (
          <div key={key} className="buff-icon"
            onMouseEnter={e => showGameTooltip(e, def.tooltip)}
            onMouseLeave={hideGameTooltip}>
            {def.icon}
          </div>
        );
      })}
    </div>
  );
}

// Wind swirl — gentle wind particles spiraling around target
function WindEffect({ x, y }) {
  const particles = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    const radius = 20 + Math.random() * 30;
    return {
      startAngle: angle,
      radius,
      size: 6 + Math.random() * 8,
      delay: i * 40 + Math.random() * 60,
      dur: 500 + Math.random() * 300,
      char: ['~','≈','∿','⌇','·'][Math.floor(Math.random() * 5)],
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-wind-flash" />
      {particles.map((p, i) => (
        <div key={'wp'+i} className="anim-wind-particle" style={{
          '--startAngle': p.startAngle + 'rad', '--radius': p.radius + 'px', '--size': p.size + 'px',
          animationDelay: p.delay + 'ms', animationDuration: p.dur + 'ms',
        }}>{p.char}</div>
      ))}
    </div>
  );
}

// Shadow summon effect — dark tendrils rising from below
function ShadowSummonEffect({ x, y }) {
  const tendrils = useMemo(() => Array.from({ length: 16 }, () => {
    const xOff = -30 + Math.random() * 60;
    return {
      xOff,
      size: 6 + Math.random() * 10,
      delay: Math.random() * 200,
      dur: 400 + Math.random() * 400,
      char: ['▓','░','▒','◆','●'][Math.floor(Math.random() * 5)],
    };
  }), []);
  const wisps = useMemo(() => Array.from({ length: 10 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 10 + Math.random() * 25;
    return {
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 4,
      color: ['#6633aa','#442288','#553399','#221144','#7744bb'][Math.floor(Math.random() * 5)],
      delay: 300 + Math.random() * 200,
      dur: 300 + Math.random() * 300,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-shadow-flash" />
      {tendrils.map((t, i) => (
        <div key={'st'+i} className="anim-shadow-tendril" style={{
          '--xOff': t.xOff + 'px', '--size': t.size + 'px',
          animationDelay: t.delay + 'ms', animationDuration: t.dur + 'ms',
        }}>{t.char}</div>
      ))}
      {wisps.map((w, i) => (
        <div key={'sw'+i} className="anim-explosion-particle" style={{
          '--dx': w.dx + 'px', '--dy': w.dy + 'px', '--size': w.size + 'px',
          '--color': w.color, animationDelay: w.delay + 'ms', animationDuration: w.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

// Gold sparkle — particles burst from the gold counter
function GoldSparkleEffect({ x, y }) {
  const sparkles = useMemo(() => Array.from({ length: 12 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 12 + Math.random() * 25;
    return {
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 5,
      color: ['#ffd700','#ffcc00','#ffee55','#fff','#ffaa00'][Math.floor(Math.random() * 5)],
      delay: Math.random() * 150,
      dur: 400 + Math.random() * 400,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-gold-flash" />
      {sparkles.map((s, i) => (
        <div key={'gs'+i} className="anim-explosion-particle" style={{
          '--dx': s.dx + 'px', '--dy': s.dy + 'px', '--size': s.size + 'px',
          '--color': s.color, animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

// Beer bubbles — yellow bubbles and foam rising upward
function BeerBubblesEffect({ x, y }) {
  const bubbles = useMemo(() => Array.from({ length: 18 }, () => ({
    xOff: -25 + Math.random() * 50,
    size: 4 + Math.random() * 8,
    delay: Math.random() * 300,
    dur: 500 + Math.random() * 500,
    color: ['#ffd700','#ffcc33','#fff8dc','#ffe680','#fff'][Math.floor(Math.random() * 5)],
    wobble: -8 + Math.random() * 16,
  })), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-gold-flash" />
      {bubbles.map((b, i) => (
        <div key={'bb'+i} className="anim-beer-bubble" style={{
          '--xOff': b.xOff + 'px', '--size': b.size + 'px', '--wobble': b.wobble + 'px',
          '--color': b.color, animationDelay: b.delay + 'ms', animationDuration: b.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

function CreatureDeathEffect({ x, y }) {
  // Rising soul particles + flash + falling sparkles
  const souls = useMemo(() => Array.from({ length: 14 }, () => ({
    dx: -20 + Math.random() * 40,
    dy: -(40 + Math.random() * 60),
    size: 4 + Math.random() * 6,
    color: ['#ffffff','#aaccff','#88aaff','#ccddff','#ddeeff'][Math.floor(Math.random() * 5)],
    delay: Math.random() * 200,
    dur: 600 + Math.random() * 500,
  })), []);
  const sparks = useMemo(() => Array.from({ length: 18 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 15 + Math.random() * 40;
    return {
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      size: 2 + Math.random() * 4,
      color: ['#ff4444','#ff6666','#ffaaaa','#ff8888','#cc3333'][Math.floor(Math.random() * 5)],
      delay: 50 + Math.random() * 150,
      dur: 400 + Math.random() * 400,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-creature-death-flash" />
      {souls.map((p, i) => (
        <div key={'s'+i} className="anim-creature-death-soul" style={{
          '--dx': p.dx + 'px', '--dy': p.dy + 'px', '--size': p.size + 'px',
          '--color': p.color, animationDelay: p.delay + 'ms', animationDuration: p.dur + 'ms',
        }} />
      ))}
      {sparks.map((p, i) => (
        <div key={'k'+i} className="anim-creature-death-spark" style={{
          '--dx': p.dx + 'px', '--dy': p.dy + 'px', '--size': p.size + 'px',
          '--color': p.color, animationDelay: p.delay + 'ms', animationDuration: p.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

// Spider Avalanche — torrential downpour of tiny spiders
function SpiderAvalancheEffect({ x, y, w, h }) {
  const spiders = useMemo(() => Array.from({ length: 80 }, () => ({
    startX: -60 + Math.random() * 120,
    delay: Math.random() * 600,
    dur: 300 + Math.random() * 400,
    size: 6 + Math.random() * 8,
    drift: -15 + Math.random() * 30,
    char: ['🕷','🕷','🕷','🕷','·','·'][Math.floor(Math.random() * 6)],
  })), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y - 60, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-spider-flash" />
      {spiders.map((s, i) => (
        <div key={i} className="anim-spider-drop" style={{
          '--startX': s.startX + 'px', '--drift': s.drift + 'px',
          '--size': s.size + 'px',
          animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
        }}>{s.char}</div>
      ))}
    </div>
  );
}

function VenomFogEffect({ x, y, w, h }) {
  const particles = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
    dx: -30 + Math.random() * 60,
    dy: -20 + Math.random() * 40,
    size: 30 + Math.random() * 40,
    delay: i * 40 + Math.random() * 80,
    dur: 800 + Math.random() * 600,
    opacity: 0.4 + Math.random() * 0.4,
  })), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      {particles.map((p, i) => (
        <div key={i} className="anim-venom-fog-particle" style={{
          '--vdx': p.dx + 'px', '--vdy': p.dy + 'px', '--vsize': p.size + 'px', '--vopacity': p.opacity,
          animationDelay: p.delay + 'ms', animationDuration: p.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

function PoisonedWellEffect({ x, y, w, h }) {
  const bubbles = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    dx: -25 + Math.random() * 50,
    size: 8 + Math.random() * 16,
    delay: i * 50 + Math.random() * 100,
    dur: 600 + Math.random() * 500,
  })), []);
  const steam = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
    dx: -20 + Math.random() * 40,
    size: 20 + Math.random() * 30,
    delay: 200 + i * 60 + Math.random() * 100,
    dur: 700 + Math.random() * 400,
  })), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      {bubbles.map((b, i) => (
        <div key={'b'+i} className="anim-well-bubble" style={{
          '--wdx': b.dx + 'px', '--wsize': b.size + 'px',
          animationDelay: b.delay + 'ms', animationDuration: b.dur + 'ms',
        }} />
      ))}
      {steam.map((s, i) => (
        <div key={'s'+i} className="anim-well-steam" style={{
          '--sdx': s.dx + 'px', '--ssize': s.size + 'px',
          animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

const ANIM_REGISTRY = {
  explosion: ExplosionEffect,
  creature_death: CreatureDeathEffect,
  freeze: FreezeEffect,
  ice_encase: IceEncaseEffect,
  spider_avalanche: SpiderAvalancheEffect,
  electric_strike: ElectricStrikeEffect,
  flame_strike: FlameStrikeEffect,
  venom_fog: VenomFogEffect,
  poisoned_well: PoisonedWellEffect,
  plague_smoke: (() => {
    return function PlagueSmokeEffect({ x, y }) {
      const clouds = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
        dx: -30 + Math.random() * 60,
        dy: -15 + Math.random() * 30,
        size: 25 + Math.random() * 35,
        delay: i * 35 + Math.random() * 80,
        dur: 700 + Math.random() * 500,
        opacity: 0.5 + Math.random() * 0.4,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {clouds.map((c, i) => (
            <div key={i} className="anim-plague-smoke" style={{
              '--pdx': c.dx + 'px', '--pdy': c.dy + 'px', '--psize': c.size + 'px', '--popacity': c.opacity,
              animationDelay: c.delay + 'ms', animationDuration: c.dur + 'ms',
            }} />
          ))}
        </div>
      );
    };
  })(),
  biomancy_bloom: (() => {
    return function BiomancyBloomEffect({ x, y }) {
      const flowers = useMemo(() => Array.from({ length: 16 }, (_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        return {
          dx: Math.cos(angle) * (15 + Math.random() * 25),
          dy: Math.sin(angle) * (10 + Math.random() * 20),
          size: 10 + Math.random() * 14,
          delay: i * 40 + Math.random() * 60,
          dur: 600 + Math.random() * 400,
          emoji: ['🌸', '🌺', '🌼', '🍀', '🌿', '☘️'][Math.floor(Math.random() * 6)],
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {flowers.map((f, i) => (
            <span key={i} className="anim-biomancy-flower" style={{
              '--bdx': f.dx + 'px', '--bdy': f.dy + 'px', fontSize: f.size + 'px',
              animationDelay: f.delay + 'ms', animationDuration: f.dur + 'ms',
            }}>{f.emoji}</span>
          ))}
        </div>
      );
    };
  })(),
  biomancy_vines: (() => {
    return function BiomancyVinesEffect({ x, y }) {
      const vines = useMemo(() => Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return {
          dx: Math.cos(angle) * 30,
          dy: Math.sin(angle) * 20,
          rot: (angle * 180 / Math.PI) + 90,
          delay: i * 30 + Math.random() * 50,
          dur: 500 + Math.random() * 300,
          emoji: ['🌿', '🌱', '☘️', '🍃', '🌾'][Math.floor(Math.random() * 5)],
          size: 12 + Math.random() * 10,
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {vines.map((v, i) => (
            <span key={i} className="anim-biomancy-vine" style={{
              '--vdx': v.dx + 'px', '--vdy': v.dy + 'px', '--vrot': v.rot + 'deg', fontSize: v.size + 'px',
              animationDelay: v.delay + 'ms', animationDuration: v.dur + 'ms',
            }}>{v.emoji}</span>
          ))}
        </div>
      );
    };
  })(),
  stranglehold_squeeze: (() => {
    return function StrangleholdSqueezeEffect({ x, y }) {
      useEffect(() => {
        const timer = setTimeout(() => {
          const els = document.querySelectorAll('[data-hero-zone],[data-support-zone]');
          let best = null, bestDist = Infinity;
          els.forEach(el => {
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const d = Math.abs(cx - x) + Math.abs(cy - y);
            if (d < bestDist) { bestDist = d; best = el; }
          });
          if (best && bestDist < 80) {
            best.classList.add('stranglehold-squeezed');
            setTimeout(() => best.classList.remove('stranglehold-squeezed'), 1200);
          }
        }, 50);
        return () => clearTimeout(timer);
      }, []);
      return null; // No visual overlay — the CSS class does all the work
    };
  })(),
  tiger_impact: (() => {
    return function TigerImpactEffect({ x, y }) {
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 64, animation: 'tigerFadeInOut 1.2s ease-in-out forwards', marginLeft: -32, marginTop: -32 }}>🐯</div>
        </div>
      );
    };
  })(),
  ox_impact: (() => {
    return function OxImpactEffect({ x, y }) {
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 64, animation: 'tigerFadeInOut 1.2s ease-in-out forwards', marginLeft: -32, marginTop: -32 }}>𖤍</div>
        </div>
      );
    };
  })(),
  snake_impact: (() => {
    return function SnakeImpactEffect({ x, y }) {
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 64, animation: 'tigerFadeInOut 1.2s ease-in-out forwards', marginLeft: -32, marginTop: -32 }}>🐍</div>
        </div>
      );
    };
  })(),
  whirlwind_spin: (() => {
    return function WhirlwindSpinEffect({ x, y }) {
      useEffect(() => {
        const els = document.querySelectorAll('[data-hero-zone],[data-support-zone]');
        let best = null, bestDist = Infinity;
        els.forEach(el => {
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
          const d = Math.abs(cx - x) + Math.abs(cy - y);
          if (d < bestDist) { bestDist = d; best = el; }
        });
        if (best && bestDist < 80) {
          best.classList.add('whirlwind-spinning');
          setTimeout(() => best.classList.remove('whirlwind-spinning'), 2200);
        }
      }, []);
      return null;
    };
  })(),
  deep_sea_bubbles: (() => {
    return function DeepSeaBubblesEffect({ x, y }) {
      const bubbles = useMemo(() => Array.from({ length: 20 }, () => ({
        xOff: -40 + Math.random() * 80,
        startY: 25 + Math.random() * 30,
        endY: -80 - Math.random() * 60,
        delay: Math.random() * 800,
        dur: 800 + Math.random() * 600,
        size: 6 + Math.random() * 14,
        opacity: 0.4 + Math.random() * 0.4,
        wobble: -8 + Math.random() * 16,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {bubbles.map((b, i) => (
            <div key={'bb'+i} style={{
              position: 'absolute', left: b.xOff, top: b.startY,
              width: b.size, height: b.size, borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 35%, rgba(100,160,220,.6), rgba(20,50,100,.3))',
              border: '1px solid rgba(80,140,200,.4)',
              boxShadow: `inset 0 -2px 4px rgba(10,30,60,.3), 0 0 ${b.size/2}px rgba(40,80,140,.3)`,
              animation: `bubbleRise ${b.dur}ms ease-out ${b.delay}ms forwards`,
              opacity: 0,
              '--endY': b.endY + 'px',
              '--wobble': b.wobble + 'px',
              '--bubbleOpacity': b.opacity,
            }} />
          ))}
        </div>
      );
    };
  })(),
  holy_revival: (() => {
    // Golden-white holy light rising upward — revival/resurrection effect
    return function HolyRevivalEffect({ x, y }) {
      const rays = useMemo(() => Array.from({ length: 16 }, () => ({
        angle: Math.random() * 360,
        len: 60 + Math.random() * 80,
        width: 2 + Math.random() * 3,
        delay: Math.random() * 400,
        dur: 600 + Math.random() * 400,
      })), []);
      const sparkles = useMemo(() => Array.from({ length: 24 }, () => ({
        xOff: -50 + Math.random() * 100,
        startY: 20 + Math.random() * 30,
        endY: -60 - Math.random() * 80,
        delay: 200 + Math.random() * 600,
        dur: 500 + Math.random() * 500,
        size: 4 + Math.random() * 8,
        color: ['#fffbe6','#ffd700','#fff','#ffe082','#fff9c4'][Math.floor(Math.random() * 5)],
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-flame-flash" style={{ width: 160, height: 160, marginLeft: -80, marginTop: -80, background: 'radial-gradient(circle, rgba(255,255,240,.9) 0%, rgba(255,215,0,.4) 35%, rgba(255,255,200,.1) 60%, transparent 80%)', animationDuration: '800ms' }} />
          <div className="anim-flame-flash" style={{ width: 100, height: 100, marginLeft: -50, marginTop: -50, background: 'radial-gradient(circle, rgba(255,255,255,.95) 0%, rgba(255,240,180,.5) 40%, transparent 70%)', animationDelay: '200ms', animationDuration: '600ms' }} />
          {rays.map((r, i) => (
            <div key={'hr'+i} style={{
              position: 'absolute', left: 0, top: 0,
              transform: `rotate(${r.angle}deg)`,
              transformOrigin: 'center center',
            }}>
              <div style={{
                width: r.width, height: r.len, marginLeft: -r.width/2,
                background: 'linear-gradient(to top, rgba(255,215,0,.8), rgba(255,255,240,.3) 70%, transparent)',
                borderRadius: r.width,
                transformOrigin: 'center bottom',
                animation: `holyRayGrow ${r.dur}ms ease-out ${r.delay}ms forwards`,
                opacity: 0,
              }} />
            </div>
          ))}
          {sparkles.map((s, i) => (
            <div key={'hs'+i} style={{
              position: 'absolute', left: s.xOff, top: s.startY,
              width: s.size, height: s.size, borderRadius: '50%',
              background: s.color,
              boxShadow: `0 0 ${s.size}px ${s.color}`,
              animation: `holySparkleRise ${s.dur}ms ease-out ${s.delay}ms forwards`,
              opacity: 0,
            }} />
          ))}
        </div>
      );
    };
  })(),
  arrow_rain: (() => {
    // Sharp arrow projectiles raining down from above — Rain of Arrows
    return function ArrowRainEffect({ x, y }) {
      const arrows = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
        xOff: -70 + Math.random() * 140,
        startY: -150 - Math.random() * 100,
        delay: Math.random() * 600,
        dur: 200 + Math.random() * 200,
        rot: 170 + Math.random() * 20,
        len: 18 + Math.random() * 14,
      })), []);
      const impacts = useMemo(() => Array.from({ length: 16 }, () => ({
        xOff: -50 + Math.random() * 100,
        delay: 250 + Math.random() * 500,
        dur: 300 + Math.random() * 200,
        size: 3 + Math.random() * 5,
        color: ['#ffcc44','#ff8800','#ffaa22','#ddaa00','#ffe066'][Math.floor(Math.random() * 5)],
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-flame-flash" style={{ width: 80, height: 80, marginLeft: -40, marginTop: -40, background: 'radial-gradient(circle, rgba(255,200,50,.5) 0%, rgba(255,150,0,.2) 50%, transparent 80%)', animationDelay: '300ms' }} />
          {arrows.map((a, i) => (
            <div key={'ar'+i} style={{
              position: 'absolute', left: a.xOff, top: a.startY,
              animation: `arrowFall ${a.dur}ms ease-in ${a.delay}ms forwards`,
              opacity: 0,
            }}>
              <div style={{
                width: 2, height: a.len,
                background: 'linear-gradient(to bottom, transparent 0%, #ffdd66 20%, #ffaa22 80%, #ff8800 100%)',
                borderRadius: '0 0 1px 1px',
                boxShadow: '0 0 4px rgba(255,200,50,.6)',
                transform: `rotate(${a.rot}deg)`,
                transformOrigin: 'center top',
              }}>
                <div style={{ position: 'absolute', bottom: -4, left: -3, width: 0, height: 0, borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderTop: '6px solid #ff8800' }} />
              </div>
            </div>
          ))}
          {impacts.map((imp, i) => (
            <div key={'ai'+i} className="anim-explosion-particle" style={{
              '--dx': imp.xOff + 'px', '--dy': (Math.random() * -20) + 'px', '--size': imp.size + 'px',
              '--color': imp.color, animationDelay: imp.delay + 'ms', animationDuration: imp.dur + 'ms',
            }} />
          ))}
        </div>
      );
    };
  })(),
  flame_avalanche: (() => {
    // Massive, screen-shaking fire effect for Flame Avalanche
    return function FlameAvalancheEffect({ x, y }) {
      const flames = useMemo(() => Array.from({ length: 40 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 100;
        return {
          startX: Math.cos(angle) * dist,
          startY: Math.sin(angle) * dist,
          size: 16 + Math.random() * 24,
          delay: Math.random() * 400,
          dur: 400 + Math.random() * 400,
          char: ['🔥','🔥','🔥','🔥','💥','✦','☄️'][Math.floor(Math.random() * 7)],
        };
      }), []);
      const sparks = useMemo(() => Array.from({ length: 30 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 60;
        return {
          dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
          size: 4 + Math.random() * 8,
          color: ['#ff2200','#ff4400','#ff8800','#ffcc00','#ffaa00','#ff0000','#ff6600'][Math.floor(Math.random() * 7)],
          delay: Math.random() * 300,
          dur: 500 + Math.random() * 400,
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-flame-flash" style={{ width: 200, height: 200, marginLeft: -100, marginTop: -100, background: 'radial-gradient(circle, rgba(255,100,0,.9) 0%, rgba(255,60,0,.6) 30%, rgba(255,0,0,.2) 60%, transparent 80%)' }} />
          <div className="anim-flame-flash" style={{ width: 140, height: 140, marginLeft: -70, marginTop: -70, animationDelay: '100ms', background: 'radial-gradient(circle, rgba(255,255,200,.8) 0%, rgba(255,180,0,.4) 40%, transparent 70%)' }} />
          {flames.map((f, i) => (
            <div key={'fa'+i} className="anim-flame-shard" style={{
              '--startX': f.startX + 'px', '--startY': f.startY + 'px', '--size': f.size + 'px',
              animationDelay: f.delay + 'ms', animationDuration: f.dur + 'ms',
            }}>{f.char}</div>
          ))}
          {sparks.map((s, i) => (
            <div key={'fas'+i} className="anim-explosion-particle" style={{
              '--dx': s.dx + 'px', '--dy': s.dy + 'px', '--size': s.size + 'px',
              '--color': s.color, animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
            }} />
          ))}
        </div>
      );
    };
  })(),
  wind: WindEffect,
  shadow_summon: ShadowSummonEffect,
  gold_sparkle: GoldSparkleEffect,
  beer_bubbles: BeerBubblesEffect,
  juice_bubbles: (() => {
    // Orange juice bubbles — same as beer but orange palette
    return function JuiceBubblesEffect({ x, y }) {
      const bubbles = useMemo(() => Array.from({ length: 18 }, () => ({
        xOff: -25 + Math.random() * 50,
        size: 4 + Math.random() * 8,
        delay: Math.random() * 300,
        dur: 500 + Math.random() * 500,
        color: ['#ff8c00','#ffa033','#ffcc66','#ff6600','#ffe0b0'][Math.floor(Math.random() * 5)],
        wobble: -8 + Math.random() * 16,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-gold-flash" style={{ background: 'radial-gradient(circle, rgba(255,140,0,.8) 0%, rgba(255,100,0,.3) 40%, transparent 70%)' }} />
          {bubbles.map((b, i) => (
            <div key={'jb'+i} className="anim-beer-bubble" style={{
              '--xOff': b.xOff + 'px', '--size': b.size + 'px', '--wobble': b.wobble + 'px',
              '--color': b.color, animationDelay: b.delay + 'ms', animationDuration: b.dur + 'ms',
            }} />
          ))}
        </div>
      );
    };
  })(),
  poison_tick: (() => {
    return function PoisonTickEffect({ x, y }) {
      const bubbles = useMemo(() => Array.from({ length: 14 }, () => ({
        xOff: -25 + Math.random() * 50,
        size: 4 + Math.random() * 7,
        delay: Math.random() * 250,
        dur: 400 + Math.random() * 400,
        color: ['#9933cc','#7722aa','#bb55ee','#6611aa','#dd88ff'][Math.floor(Math.random() * 5)],
        wobble: -8 + Math.random() * 16,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-gold-flash" style={{ background: 'radial-gradient(circle, rgba(130,0,180,.8) 0%, rgba(100,0,160,.3) 40%, transparent 70%)' }} />
          {bubbles.map((b, i) => (
            <div key={'pt'+i} className="anim-beer-bubble" style={{
              '--xOff': b.xOff + 'px', '--size': b.size + 'px', '--wobble': b.wobble + 'px',
              '--color': b.color, animationDelay: b.delay + 'ms', animationDuration: b.dur + 'ms',
            }} />
          ))}
        </div>
      );
    };
  })(),
  poison_vial: (() => {
    return function PoisonVialEffect({ x, y }) {
      const ooze = useMemo(() => Array.from({ length: 12 }, () => ({
        xOff: -30 + Math.random() * 60,
        size: 6 + Math.random() * 10,
        delay: Math.random() * 200,
        dur: 500 + Math.random() * 500,
        wobble: -10 + Math.random() * 20,
        color: ['#7722bb','#9933dd','#6611aa','#aa44ee','#551199'][Math.floor(Math.random() * 5)],
      })), []);
      const skulls = useMemo(() => Array.from({ length: 5 }, () => ({
        xOff: -20 + Math.random() * 40,
        delay: 200 + Math.random() * 300,
        dur: 600 + Math.random() * 400,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-gold-flash" style={{ background: 'radial-gradient(circle, rgba(100,0,160,.9) 0%, rgba(80,0,140,.4) 40%, transparent 70%)' }} />
          {ooze.map((o, i) => (
            <div key={'po'+i} className="anim-beer-bubble" style={{
              '--xOff': o.xOff + 'px', '--size': o.size + 'px', '--wobble': o.wobble + 'px',
              '--color': o.color, animationDelay: o.delay + 'ms', animationDuration: o.dur + 'ms',
            }} />
          ))}
          {skulls.map((s, i) => (
            <div key={'ps'+i} className="anim-beer-bubble" style={{
              '--xOff': s.xOff + 'px', '--size': '14px', '--wobble': '0px',
              '--color': 'rgba(150,50,200,.6)', animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
              fontSize: 14, opacity: 0,
            }}>💀</div>
          ))}
        </div>
      );
    };
  })(),
  tea_steam: (() => {
    return function TeaSteamEffect({ x, y }) {
      const particles = useMemo(() => Array.from({ length: 16 }, () => ({
        xOff: -20 + Math.random() * 40,
        size: 5 + Math.random() * 7,
        delay: Math.random() * 300,
        dur: 500 + Math.random() * 500,
        char: ['🍃','~','≈','☁','·','🍃'][Math.floor(Math.random() * 6)],
        color: ['#88cc66','#aaddaa','#66aa44','#ccddbb','#bbeeaa'][Math.floor(Math.random() * 5)],
        wobble: -8 + Math.random() * 16,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-gold-flash" style={{ background: 'radial-gradient(circle, rgba(100,180,80,.7) 0%, rgba(80,150,60,.3) 40%, transparent 70%)' }} />
          {particles.map((p, i) => (
            <div key={'ts'+i} className="anim-beer-bubble" style={{
              '--xOff': p.xOff + 'px', '--size': p.size + 'px', '--wobble': p.wobble + 'px',
              '--color': p.color, animationDelay: p.delay + 'ms', animationDuration: p.dur + 'ms',
              fontSize: p.size,
            }}>{p.char}</div>
          ))}
        </div>
      );
    };
  })(),
  coffee_steam: (() => {
    return function CoffeeSteamEffect({ x, y }) {
      const particles = useMemo(() => Array.from({ length: 16 }, () => ({
        xOff: -22 + Math.random() * 44,
        size: 5 + Math.random() * 7,
        delay: Math.random() * 300,
        dur: 500 + Math.random() * 500,
        char: ['☕','~','≈','☁','·','♨'][Math.floor(Math.random() * 6)],
        color: ['#3a2a1a','#5c3d1e','#2a1a0a','#8b6b4a','#4a3020'][Math.floor(Math.random() * 5)],
        wobble: -8 + Math.random() * 16,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-gold-flash" style={{ background: 'radial-gradient(circle, rgba(60,40,20,.8) 0%, rgba(40,25,10,.4) 40%, transparent 70%)' }} />
          {particles.map((p, i) => (
            <div key={'cs'+i} className="anim-beer-bubble" style={{
              '--xOff': p.xOff + 'px', '--size': p.size + 'px', '--wobble': p.wobble + 'px',
              '--color': p.color, animationDelay: p.delay + 'ms', animationDuration: p.dur + 'ms',
              fontSize: p.size,
            }}>{p.char}</div>
          ))}
        </div>
      );
    };
  })(),
  magic_hammer: (() => {
    return function MagicHammerEffect({ x, y, w, h }) {
      const targetW = w || 70;
      const targetH = h || 90;
      const hammerW = 55;
      const hammerH = 80;
      // Impact sparks
      const sparks = useMemo(() => Array.from({ length: 14 }, () => {
        const angle = -Math.PI * 0.15 + Math.random() * Math.PI * 1.3; // mostly sideways/upward
        const speed = 20 + Math.random() * 50;
        return {
          dx: Math.cos(angle) * speed,
          dy: -Math.abs(Math.sin(angle) * speed) - 5,
          size: 2 + Math.random() * 4,
          color: ['#ccc','#fff','#aaa','#ff8','#ffa'][Math.floor(Math.random() * 5)],
          delay: 320 + Math.random() * 80,
          dur: 250 + Math.random() * 200,
        };
      }), []);
      // Apply squash class to actual target DOM element
      useEffect(() => {
        const timer = setTimeout(() => {
          // Find the hero or support zone element under this animation
          const els = document.querySelectorAll('[data-hero-zone],[data-support-zone]');
          let best = null, bestDist = Infinity;
          els.forEach(el => {
            const r = el.getBoundingClientRect();
            const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
            const d = Math.abs(cx - x) + Math.abs(cy - y);
            if (d < bestDist) { bestDist = d; best = el; }
          });
          if (best && bestDist < 80) {
            best.classList.add('magic-hammer-squashed');
            setTimeout(() => best.classList.remove('magic-hammer-squashed'), 650);
          }
        }, 330);
        return () => clearTimeout(timer);
      }, []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Hammerhead — drops from above, bounces back */}
          <div className="anim-hammer-head" style={{
            width: hammerW, height: hammerH,
            marginLeft: -hammerW / 2, marginTop: -targetH / 2 - hammerH,
          }} />
          {/* Impact flash */}
          <div className="anim-hammer-impact" />
          {/* Impact sparks */}
          {sparks.map((s, i) => (
            <div key={'hs'+i} className="anim-explosion-particle" style={{
              '--dx': s.dx + 'px', '--dy': s.dy + 'px', '--size': s.size + 'px',
              '--color': s.color, animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
            }} />
          ))}
        </div>
      );
    };
  })(),
  dark_gear_spin_cw: (() => {
    return function DarkGearCWEffect({ x, y }) {
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-dark-gear-flash" />
          <div className="anim-dark-gear cw">⚙</div>
        </div>
      );
    };
  })(),
  dark_gear_spin_ccw: (() => {
    return function DarkGearCCWEffect({ x, y }) {
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-dark-gear-flash" />
          <div className="anim-dark-gear ccw">⚙</div>
        </div>
      );
    };
  })(),
  cloud_gather: (() => {
    return function CloudGatherEffect({ x, y }) {
      const puffs = useMemo(() => Array.from({ length: 16 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 50;
        return {
          startX: Math.cos(angle) * dist,
          startY: Math.sin(angle) * dist,
          size: 14 + Math.random() * 18,
          delay: Math.random() * 300,
          dur: 500 + Math.random() * 300,
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {puffs.map((p, i) => (
            <div key={'cg'+i} style={{
              position: 'absolute', left: p.startX, top: p.startY,
              fontSize: p.size, color: '#fff',
              filter: 'drop-shadow(0 0 6px rgba(255,255,255,.7))',
              animation: `cloudGather ${p.dur}ms ease-in ${p.delay}ms forwards`,
              opacity: 0,
              '--startX': p.startX + 'px', '--startY': p.startY + 'px',
            }}>☁</div>
          ))}
          <div style={{
            position: 'absolute', left: -20, top: -14,
            fontSize: 40, color: '#fff',
            filter: 'drop-shadow(0 0 10px rgba(220,240,255,.8))',
            animation: 'cloudFormCenter 400ms ease-out 600ms forwards',
            opacity: 0,
          }}>☁️</div>
        </div>
      );
    };
  })(),
  cloud_disperse: (() => {
    return function CloudDisperseEffect({ x, y }) {
      const puffs = useMemo(() => Array.from({ length: 18 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 50 + Math.random() * 60;
        return {
          endX: Math.cos(angle) * dist,
          endY: Math.sin(angle) * dist,
          size: 10 + Math.random() * 14,
          delay: 250 + Math.random() * 200,
          dur: 400 + Math.random() * 300,
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div style={{
            position: 'absolute', left: -20, top: -14,
            fontSize: 40, color: '#fff',
            filter: 'drop-shadow(0 0 10px rgba(220,240,255,.8))',
            animation: 'cloudDisperseCenter 350ms ease-in forwards',
            opacity: 1,
          }}>☁️</div>
          {puffs.map((p, i) => (
            <div key={'cd'+i} style={{
              position: 'absolute', left: 0, top: 0,
              fontSize: p.size, color: '#fff',
              filter: 'drop-shadow(0 0 5px rgba(255,255,255,.6))',
              animation: `cloudDisperse ${p.dur}ms ease-out ${p.delay}ms forwards`,
              opacity: 0,
              '--endX': p.endX + 'px', '--endY': p.endY + 'px',
            }}>☁</div>
          ))}
        </div>
      );
    };
  })(),
  healing_hearts: (() => {
    return function HealingHeartsEffect({ x, y }) {
      const particles = useMemo(() => Array.from({ length: 20 }, () => {
        const isHeart = Math.random() > 0.4;
        return {
          char: isHeart ? (Math.random() > 0.5 ? '❤️' : '💚') : '✚',
          xOff: -40 + Math.random() * 80,
          delay: Math.random() * 500,
          dur: 600 + Math.random() * 600,
          size: isHeart ? (12 + Math.random() * 14) : (10 + Math.random() * 12),
          color: isHeart ? undefined : (Math.random() > 0.5 ? '#ff4466' : '#44cc66'),
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-gold-flash" style={{ background: 'radial-gradient(circle, rgba(100,255,120,.7) 0%, rgba(50,200,80,.3) 40%, transparent 70%)' }} />
          {particles.map((p, i) => (
            <div key={'hh'+i} style={{
              position: 'absolute', left: p.xOff, top: 10,
              fontSize: p.size, color: p.color,
              filter: `drop-shadow(0 0 4px ${p.color || 'rgba(100,255,120,0.6)'})`,
              animation: `holySparkleRise ${p.dur}ms ease-out ${p.delay}ms forwards`,
              opacity: 0,
            }}>{p.char}</div>
          ))}
        </div>
      );
    };
  })(),
  golden_ankh_revival: (() => {
    return function GoldenAnkhRevivalEffect({ x, y }) {
      const ankhs = useMemo(() => Array.from({ length: 12 }, () => ({
        xOff: -45 + Math.random() * 90,
        startY: 20 + Math.random() * 30,
        endY: -70 - Math.random() * 80,
        delay: 100 + Math.random() * 500,
        dur: 700 + Math.random() * 500,
        size: 14 + Math.random() * 16,
        rot: -20 + Math.random() * 40,
      })), []);
      const sparkles = useMemo(() => Array.from({ length: 20 }, () => ({
        xOff: -50 + Math.random() * 100,
        startY: 10 + Math.random() * 40,
        endY: -50 - Math.random() * 70,
        delay: 200 + Math.random() * 600,
        dur: 500 + Math.random() * 500,
        size: 3 + Math.random() * 7,
        color: ['#ffd700','#ffec80','#fff5cc','#ffb300','#ffe066'][Math.floor(Math.random() * 5)],
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-flame-flash" style={{ width: 150, height: 150, marginLeft: -75, marginTop: -75, background: 'radial-gradient(circle, rgba(255,215,0,.85) 0%, rgba(255,180,0,.4) 35%, rgba(255,240,150,.1) 60%, transparent 80%)', animationDuration: '900ms' }} />
          <div className="anim-flame-flash" style={{ width: 90, height: 90, marginLeft: -45, marginTop: -45, background: 'radial-gradient(circle, rgba(255,255,220,.95) 0%, rgba(255,215,0,.5) 40%, transparent 70%)', animationDelay: '250ms', animationDuration: '700ms' }} />
          {ankhs.map((a, i) => (
            <div key={'ak'+i} style={{
              position: 'absolute', left: a.xOff, top: a.startY,
              fontSize: a.size, color: '#ffd700',
              filter: 'drop-shadow(0 0 6px rgba(255,200,0,.9))',
              transform: `rotate(${a.rot}deg)`,
              animation: `ankhFloat ${a.dur}ms ease-out ${a.delay}ms forwards`,
              opacity: 0,
              '--endY': a.endY + 'px',
            }}>𓋹</div>
          ))}
          {sparkles.map((s, i) => (
            <div key={'as'+i} style={{
              position: 'absolute', left: s.xOff, top: s.startY,
              width: s.size, height: s.size, borderRadius: '50%',
              background: s.color,
              boxShadow: `0 0 ${s.size}px ${s.color}`,
              animation: `ankhFloat ${s.dur}ms ease-out ${s.delay}ms forwards`,
              opacity: 0,
              '--endY': s.endY + 'px',
            }} />
          ))}
        </div>
      );
    };
  })(),
  thaw: ThawEffect,
  music_notes: (() => {
    return function MusicNotesEffect({ x, y }) {
      const notes = useMemo(() => Array.from({ length: 32 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 60;
        return {
          startX: Math.cos(angle) * dist * 0.4,
          startY: Math.random() * 20 - 10,
          endX: Math.cos(angle) * dist,
          endY: -40 - Math.random() * 120,
          size: 16 + Math.random() * 20,
          delay: Math.random() * 600,
          dur: 700 + Math.random() * 500,
          char: ['♪','♫','🎵','🎶','♩','♬'][Math.floor(Math.random() * 6)],
          rot: -30 + Math.random() * 60,
          opacity: 0.7 + Math.random() * 0.3,
        };
      }), []);
      const sparkles = useMemo(() => Array.from({ length: 16 }, () => ({
        xOff: -40 + Math.random() * 80,
        startY: 10 + Math.random() * 20,
        endY: -50 - Math.random() * 60,
        delay: 100 + Math.random() * 500,
        dur: 500 + Math.random() * 400,
        size: 3 + Math.random() * 5,
        color: ['#ff66aa','#ffaa44','#66ccff','#ffdd55','#cc88ff','#44ffaa'][Math.floor(Math.random() * 6)],
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-flame-flash" style={{ width: 100, height: 100, marginLeft: -50, marginTop: -50, background: 'radial-gradient(circle, rgba(255,100,200,.4) 0%, rgba(200,100,255,.2) 40%, transparent 70%)' }} />
          {notes.map((n, i) => (
            <div key={'mn'+i} style={{
              position: 'absolute', left: n.startX, top: n.startY,
              fontSize: n.size, opacity: 0,
              transform: `rotate(${n.rot}deg)`,
              animation: `musicNoteFloat ${n.dur}ms ease-out ${n.delay}ms forwards`,
              '--endX': n.endX + 'px', '--endY': n.endY + 'px',
              '--noteOpacity': n.opacity,
              filter: `hue-rotate(${Math.random() * 360}deg)`,
              textShadow: '0 0 8px rgba(255,150,255,.6)',
            }}>{n.char}</div>
          ))}
          {sparkles.map((s, i) => (
            <div key={'ms'+i} style={{
              position: 'absolute', left: s.xOff, top: s.startY,
              width: s.size, height: s.size, borderRadius: '50%',
              background: s.color,
              boxShadow: `0 0 ${s.size + 2}px ${s.color}`,
              animation: `holySparkleRise ${s.dur}ms ease-out ${s.delay}ms forwards`,
              opacity: 0,
            }} />
          ))}
        </div>
      );
    };
  })(),
  necromancy_summon: (() => {
    return function NecromancySummonEffect({ x, y }) {
      const skulls = useMemo(() => Array.from({ length: 12 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 50;
        return {
          startX: Math.cos(angle) * dist * 0.3,
          startY: Math.random() * 15,
          endX: Math.cos(angle) * dist,
          endY: -30 - Math.random() * 90,
          size: 16 + Math.random() * 16,
          delay: Math.random() * 500,
          dur: 600 + Math.random() * 500,
          char: ['💀','☠️','💀','☠️','💀','👻'][Math.floor(Math.random() * 6)],
          rot: -20 + Math.random() * 40,
        };
      }), []);
      const particles = useMemo(() => Array.from({ length: 28 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 20 + Math.random() * 50;
        return {
          dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed - 20,
          size: 4 + Math.random() * 8,
          color: ['#8b00ff','#6a0dad','#9932cc','#4b0082','#7b2d8e','#cc44ff','#220033'][Math.floor(Math.random() * 7)],
          delay: Math.random() * 400,
          dur: 400 + Math.random() * 400,
        };
      }), []);
      const wisps = useMemo(() => Array.from({ length: 8 }, () => ({
        xOff: -30 + Math.random() * 60,
        startY: 20 + Math.random() * 20,
        endY: -50 - Math.random() * 50,
        delay: 100 + Math.random() * 400,
        dur: 700 + Math.random() * 400,
        size: 10 + Math.random() * 15,
        opacity: 0.4 + Math.random() * 0.3,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-flame-flash" style={{ width: 120, height: 120, marginLeft: -60, marginTop: -60, background: 'radial-gradient(circle, rgba(100,0,180,.7) 0%, rgba(60,0,120,.4) 40%, transparent 70%)' }} />
          <div className="anim-flame-flash" style={{ width: 80, height: 80, marginLeft: -40, marginTop: -40, animationDelay: '100ms', background: 'radial-gradient(circle, rgba(180,50,255,.5) 0%, rgba(100,0,200,.2) 50%, transparent 70%)' }} />
          {skulls.map((s, i) => (
            <div key={'ns'+i} style={{
              position: 'absolute', left: s.startX, top: s.startY,
              fontSize: s.size, opacity: 0,
              transform: `rotate(${s.rot}deg)`,
              animation: `musicNoteFloat ${s.dur}ms ease-out ${s.delay}ms forwards`,
              '--endX': s.endX + 'px', '--endY': s.endY + 'px',
              '--noteOpacity': 0.85,
              textShadow: '0 0 12px rgba(130,0,220,.8), 0 0 24px rgba(80,0,160,.4)',
            }}>{s.char}</div>
          ))}
          {particles.map((p, i) => (
            <div key={'np'+i} className="anim-explosion-particle" style={{
              '--dx': p.dx + 'px', '--dy': p.dy + 'px', '--size': p.size + 'px',
              '--color': p.color, animationDelay: p.delay + 'ms', animationDuration: p.dur + 'ms',
            }} />
          ))}
          {wisps.map((w, i) => (
            <div key={'nw'+i} style={{
              position: 'absolute', left: w.xOff, top: w.startY,
              width: w.size, height: w.size, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(150,50,255,.6), rgba(80,0,150,.2))',
              boxShadow: '0 0 8px rgba(130,0,220,.5)',
              animation: `holySparkleRise ${w.dur}ms ease-out ${w.delay}ms forwards`,
              opacity: 0,
            }} />
          ))}
        </div>
      );
    };
  })(),
  dumbbell_pump: (() => {
    // Dumbbell pumps up and down twice — Muscle Training
    return function DumbbellPumpEffect({ x, y }) {
      const sparks1 = useMemo(() => Array.from({ length: 10 }, () => {
        const angle = Math.random() * Math.PI;
        const speed = 15 + Math.random() * 30;
        return {
          dx: Math.cos(angle) * speed - speed / 2,
          dy: -Math.abs(Math.sin(angle) * speed),
          size: 2 + Math.random() * 4,
          color: ['#ffcc00','#ff8800','#ffaa33','#ffe066','#fff'][Math.floor(Math.random() * 5)],
          delay: 480 + Math.random() * 60,
          dur: 300 + Math.random() * 200,
        };
      }), []);
      const sparks2 = useMemo(() => Array.from({ length: 10 }, () => {
        const angle = Math.random() * Math.PI;
        const speed = 15 + Math.random() * 30;
        return {
          dx: Math.cos(angle) * speed - speed / 2,
          dy: -Math.abs(Math.sin(angle) * speed),
          size: 2 + Math.random() * 4,
          color: ['#ffcc00','#ff8800','#ffaa33','#ffe066','#fff'][Math.floor(Math.random() * 5)],
          delay: 1080 + Math.random() * 60,
          dur: 300 + Math.random() * 200,
        };
      }), []);
      const weightStyle = {
        width: 10, height: 36,
        background: 'linear-gradient(to right, #999, #555)',
        borderRadius: 3,
        boxShadow: '0 2px 6px rgba(0,0,0,.5), inset 0 1px 2px rgba(255,255,255,.3)',
      };
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div style={{
            animation: 'dumbbellPump 1.5s ease-in-out forwards',
            display: 'flex', flexDirection: 'row', alignItems: 'center',
            marginLeft: -35, marginTop: -50,
          }}>
            <div style={weightStyle} />
            <div style={{
              width: 50, height: 8,
              background: 'linear-gradient(to bottom, #bbb, #888, #bbb)',
              boxShadow: 'inset 0 0 4px rgba(0,0,0,.3)',
            }} />
            <div style={weightStyle} />
          </div>
          {sparks1.map((s, i) => (
            <div key={'ms1'+i} className="anim-explosion-particle" style={{
              '--dx': s.dx + 'px', '--dy': s.dy + 'px', '--size': s.size + 'px',
              '--color': s.color, animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
            }} />
          ))}
          {sparks2.map((s, i) => (
            <div key={'ms2'+i} className="anim-explosion-particle" style={{
              '--dx': s.dx + 'px', '--dy': s.dy + 'px', '--size': s.size + 'px',
              '--color': s.color, animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
            }} />
          ))}
        </div>
      );
    };
  })(),
  water_splash: (() => {
    // Water splash — hero dives into water (Jump in the River)
    return function WaterSplashEffect({ x, y }) {
      const drops = useMemo(() => Array.from({ length: 24 }, () => {
        const angle = -Math.PI * 0.1 + Math.random() * Math.PI * 1.2;
        const speed = 25 + Math.random() * 55;
        return {
          dx: Math.cos(angle) * speed,
          dy: -Math.abs(Math.sin(angle) * speed) - 10,
          size: 4 + Math.random() * 8,
          delay: Math.random() * 200,
          dur: 500 + Math.random() * 400,
          color: ['#4488cc','#66aaee','#3377bb','#88ccff','#aaddff','#2266aa'][Math.floor(Math.random() * 6)],
        };
      }), []);
      const ripples = useMemo(() => Array.from({ length: 3 }, (_, i) => ({
        delay: i * 200,
        dur: 800 + i * 200,
        size: 40 + i * 30,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-flame-flash" style={{ width: 120, height: 60, marginLeft: -60, marginTop: -10, background: 'radial-gradient(ellipse, rgba(60,140,220,.7) 0%, rgba(40,100,180,.3) 50%, transparent 80%)' }} />
          {ripples.map((r, i) => (
            <div key={'wr'+i} style={{
              position: 'absolute', left: -r.size/2, top: -8,
              width: r.size, height: r.size * 0.35, borderRadius: '50%',
              border: '2px solid rgba(100,180,255,.5)',
              animation: `waterRipple ${r.dur}ms ease-out ${r.delay}ms forwards`,
              opacity: 0,
            }} />
          ))}
          {drops.map((d, i) => (
            <div key={'wd'+i} className="anim-explosion-particle" style={{
              '--dx': d.dx + 'px', '--dy': d.dy + 'px', '--size': d.size + 'px',
              '--color': d.color, animationDelay: d.delay + 'ms', animationDuration: d.dur + 'ms',
            }} />
          ))}
        </div>
      );
    };
  })(),
  sunglasses_drop: (() => {
    // Sunglasses slowly descend onto the Hero — Divine Gift of Coolness
    return function SunglassesDropEffect({ x, y }) {
      const sparkles = useMemo(() => Array.from({ length: 12 }, () => ({
        xOff: -30 + Math.random() * 60,
        startY: -5 + Math.random() * 15,
        endY: -40 - Math.random() * 50,
        delay: 1000 + Math.random() * 400,
        dur: 500 + Math.random() * 400,
        size: 3 + Math.random() * 5,
        color: ['#ffdd44','#fff','#ffcc00','#ffe088','#ffffff'][Math.floor(Math.random() * 5)],
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div style={{
            animation: 'sunglassesDrop 1.8s ease-in-out forwards',
            fontSize: 48, marginLeft: -24, marginTop: -70,
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.4))',
          }}>🕶️</div>
          {sparkles.map((s, i) => (
            <div key={'sg'+i} style={{
              position: 'absolute', left: s.xOff, top: s.startY,
              width: s.size, height: s.size, borderRadius: '50%',
              background: s.color,
              boxShadow: `0 0 ${s.size + 2}px ${s.color}`,
              animation: `holySparkleRise ${s.dur}ms ease-out ${s.delay}ms forwards`,
              opacity: 0,
            }} />
          ))}
        </div>
      );
    };
  })(),
  anger_mark: (() => {
    // 💢 anger symbol — pops in and fades (Challenge redirect)
    return function AngerMarkEffect({ x, y }) {
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 52, animation: 'tigerFadeInOut 1s ease-in-out forwards', marginLeft: -26, marginTop: -36 }}>💢</div>
        </div>
      );
    };
  })(),
  heal_sparkle: (() => {
    return function HealSparkleEffect({ x, y }) {
      const particles = useMemo(() => Array.from({ length: 36 }, (_, i) => ({
        id: i,
        x: -40 + Math.random() * 80,
        y: -40 + Math.random() * 80,
        size: 4 + Math.random() * 10,
        delay: Math.random() * 0.5,
        dur: 0.5 + Math.random() * 0.6,
        angle: Math.random() * 360,
        dist: 10 + Math.random() * 45,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}>
          {particles.map(p => (
            <div key={p.id} style={{
              position: 'absolute',
              left: p.x, top: p.y,
              width: p.size, height: p.size,
              borderRadius: '50%',
              background: `radial-gradient(circle, #88ffaa, #44ff88, #22cc66)`,
              boxShadow: '0 0 6px #44ff88, 0 0 12px #22cc66',
              opacity: 0,
              animation: `healSparkleParticle ${p.dur}s ease-out ${p.delay}s forwards`,
              '--spark-tx': `${Math.cos(p.angle) * p.dist}px`,
              '--spark-ty': `${Math.sin(p.angle) * p.dist - 20}px`,
            }} />
          ))}
        </div>
      );
    };
  })(),
  overheal_shock_equip: (() => {
    return function OverhealShockEquipEffect({ x, y }) {
      const particles = useMemo(() => Array.from({ length: 28 }, (_, i) => ({
        id: i,
        x: -40 + Math.random() * 80,
        y: -40 + Math.random() * 80,
        size: i < 6 ? 14 + Math.random() * 6 : 5 + Math.random() * 9,
        delay: Math.random() * 0.4,
        dur: 0.6 + Math.random() * 0.5,
        angle: Math.random() * 360,
        dist: 15 + Math.random() * 40,
        isSkull: i < 6,
        color: Math.random() < 0.5,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}>
          {particles.map(p => (
            <div key={p.id} style={{
              position: 'absolute',
              left: p.x, top: p.y,
              width: p.isSkull ? 'auto' : p.size, height: p.isSkull ? 'auto' : p.size,
              borderRadius: p.isSkull ? 0 : '50%',
              background: p.isSkull ? 'none' : `radial-gradient(circle, ${p.color ? '#88ff99' : '#cc66ff'}, ${p.color ? '#44ff88' : '#9933cc'})`,
              boxShadow: p.isSkull ? 'none' : `0 0 6px ${p.color ? '#44ff88' : '#9933cc'}`,
              fontSize: p.isSkull ? p.size : 0,
              opacity: 0,
              animation: `healSparkleParticle ${p.dur}s ease-out ${p.delay}s forwards`,
              '--spark-tx': `${Math.cos(p.angle) * p.dist}px`,
              '--spark-ty': `${Math.sin(p.angle) * p.dist - 15}px`,
            }}>{p.isSkull ? '💀' : ''}</div>
          ))}
        </div>
      );
    };
  })(),
  death_skulls: (() => {
    return function DeathSkullsEffect({ x, y }) {
      const particles = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: -35 + Math.random() * 70,
        y: -35 + Math.random() * 70,
        size: i < 5 ? 16 + Math.random() * 6 : 5 + Math.random() * 8,
        delay: Math.random() * 0.3,
        dur: 0.5 + Math.random() * 0.5,
        angle: Math.random() * 360,
        dist: 12 + Math.random() * 35,
        isSkull: i < 5,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}>
          {particles.map(p => (
            <div key={p.id} style={{
              position: 'absolute',
              left: p.x, top: p.y,
              width: p.isSkull ? 'auto' : p.size, height: p.isSkull ? 'auto' : p.size,
              borderRadius: p.isSkull ? 0 : '50%',
              background: p.isSkull ? 'none' : `radial-gradient(circle, #9933cc, #660099)`,
              boxShadow: p.isSkull ? 'none' : `0 0 6px #9933cc`,
              fontSize: p.isSkull ? p.size : 0,
              opacity: 0,
              animation: `healSparkleParticle ${p.dur}s ease-out ${p.delay}s forwards`,
              '--spark-tx': `${Math.cos(p.angle) * p.dist}px`,
              '--spark-ty': `${Math.sin(p.angle) * p.dist - 15}px`,
            }}>{p.isSkull ? '💀' : ''}</div>
          ))}
        </div>
      );
    };
  })(),
  acid_splash: (() => {
    return function AcidSplashEffect({ x, y }) {
      const drops = useMemo(() => Array.from({ length: 22 }, () => ({
        xOff: -50 + Math.random() * 100,
        size: 8 + Math.random() * 16,
        delay: Math.random() * 120,
        dur: 500 + Math.random() * 600,
        wobble: -20 + Math.random() * 40,
        color: ['#cc1111','#ee3322','#ff4433','#dd2200','#aa0000','#ff6644','#ff2200','#cc0000'][Math.floor(Math.random() * 8)],
      })), []);
      const splats = useMemo(() => Array.from({ length: 6 }, () => ({
        xOff: -25 + Math.random() * 50,
        yOff: -15 + Math.random() * 30,
        delay: 50 + Math.random() * 200,
        dur: 600 + Math.random() * 400,
        size: 18 + Math.random() * 8,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-gold-flash" style={{ background: 'radial-gradient(circle, rgba(220,0,0,.95) 0%, rgba(180,0,0,.5) 35%, rgba(120,0,0,.2) 60%, transparent 80%)', width: 120, height: 120, marginLeft: -60, marginTop: -60 }} />
          {drops.map((d, i) => (
            <div key={'ad'+i} className="anim-beer-bubble" style={{
              '--xOff': d.xOff + 'px', '--size': d.size + 'px', '--wobble': d.wobble + 'px',
              '--color': d.color, animationDelay: d.delay + 'ms', animationDuration: d.dur + 'ms',
            }} />
          ))}
          {splats.map((s, i) => (
            <div key={'as'+i} className="anim-beer-bubble" style={{
              '--xOff': s.xOff + 'px', '--size': s.size + 'px', '--wobble': '0px',
              '--color': 'rgba(200,20,0,.7)', animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
              fontSize: s.size, opacity: 0, left: s.yOff,
            }}>🧪</div>
          ))}
        </div>
      );
    };
  })(),
  laser_burst: (() => {
    return function LaserBurstEffect({ x, y }) {
      const beams = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
        angle: (i * 30) + Math.random() * 10 - 5,
        length: 40 + Math.random() * 30,
        delay: Math.random() * 150,
        dur: 400 + Math.random() * 300,
        width: 2 + Math.random() * 2,
      })), []);
      const sparks = useMemo(() => Array.from({ length: 8 }, () => ({
        angle: Math.random() * 360,
        dist: 20 + Math.random() * 25,
        size: 3 + Math.random() * 4,
        delay: 100 + Math.random() * 200,
        dur: 300 + Math.random() * 300,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-gold-flash" style={{ background: 'radial-gradient(circle, rgba(255,0,0,.9) 0%, rgba(200,0,0,.4) 40%, transparent 70%)', width: 80, height: 80, marginLeft: -40, marginTop: -40 }} />
          {beams.map((b, i) => (
            <div key={'lb'+i} style={{
              position: 'absolute',
              left: 0, top: 0,
              width: b.length, height: b.width,
              background: `linear-gradient(90deg, #ff2222, #ff4444, transparent)`,
              boxShadow: '0 0 6px #ff2222, 0 0 12px rgba(255,0,0,.4)',
              transform: `rotate(${b.angle}deg)`,
              transformOrigin: '0 50%',
              opacity: 0,
              animation: `laserBeamShoot ${b.dur}ms ease-out ${b.delay}ms forwards`,
            }} />
          ))}
          {sparks.map((s, i) => (
            <div key={'ls'+i} style={{
              position: 'absolute',
              left: Math.cos(s.angle * Math.PI / 180) * s.dist,
              top: Math.sin(s.angle * Math.PI / 180) * s.dist,
              width: s.size, height: s.size,
              borderRadius: '50%',
              background: '#ff4444',
              boxShadow: '0 0 4px #ff2222',
              opacity: 0,
              animation: `healSparkleParticle ${s.dur}ms ease-out ${s.delay}ms forwards`,
              '--spark-tx': `${Math.cos(s.angle * Math.PI / 180) * 15}px`,
              '--spark-ty': `${Math.sin(s.angle * Math.PI / 180) * 15}px`,
            }} />
          ))}
        </div>
      );
    };
  })(),
  thought_bubbles: (() => {
    return function ThoughtBubblesEffect({ x, y }) {
      const bubbles = useMemo(() => [
        { emoji: '💭', x: -15, delay: 0, size: 20, rise: -40 },
        { emoji: '💡', x: 10, delay: 0.2, size: 24, rise: -55 },
        { emoji: '💭', x: -5, delay: 0.4, size: 16, rise: -35 },
        { emoji: '✨', x: 15, delay: 0.15, size: 14, rise: -50 },
        { emoji: '💭', x: -20, delay: 0.35, size: 18, rise: -45 },
      ], []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}>
          {bubbles.map((b, i) => (
            <span key={i} style={{
              position: 'absolute',
              left: b.x, top: -10,
              fontSize: b.size,
              opacity: 0,
              animation: `thoughtBubbleFloat 0.9s ease-out ${b.delay}s forwards`,
              '--thought-rise': `${b.rise}px`,
            }}>{b.emoji}</span>
          ))}
        </div>
      );
    };
  })(),
  whirlpool: (() => {
    return function WhirlpoolEffect({ x, y }) {
      const rings = useMemo(() => Array.from({ length: 9 }, (_, i) => ({
        radius: 20 + i * 16,
        delay: i * 60,
        dur: 900 - i * 40,
        opacity: 1 - i * 0.08,
        width: 4 - i * 0.25,
      })), []);
      const drops = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
        angle: (i / 24) * 360 + Math.random() * 15,
        dist: 35 + Math.random() * 55,
        delay: Math.random() * 300,
        dur: 700 + Math.random() * 300,
        size: 5 + Math.random() * 8,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}>
          {rings.map((r, i) => (
            <div key={'r'+i} style={{
              position: 'absolute', left: -r.radius, top: -r.radius,
              width: r.radius * 2, height: r.radius * 2,
              border: `${r.width}px solid rgba(40,140,220,${r.opacity})`,
              borderRadius: '50%', opacity: 0,
              boxShadow: `0 0 ${8+i*3}px rgba(60,170,255,${r.opacity * 0.6}), inset 0 0 ${6+i*2}px rgba(80,190,255,${r.opacity * 0.35})`,
              animation: `whirlSpin ${r.dur}ms ease-in ${r.delay}ms forwards`,
            }} />
          ))}
          {drops.map((d, i) => {
            const rad = (d.angle * Math.PI) / 180;
            return (
              <span key={'d'+i} style={{
                position: 'absolute', width: d.size, height: d.size, borderRadius: '50%',
                background: 'rgba(60,180,255,0.9)',
                boxShadow: '0 0 6px rgba(80,200,255,0.8)',
                left: Math.cos(rad) * d.dist - d.size/2,
                top: Math.sin(rad) * d.dist - d.size/2,
                opacity: 0,
                animation: `whirlDrop ${d.dur}ms ease-in ${d.delay}ms forwards`,
                '--wd-tx': `${-Math.cos(rad) * d.dist * 0.9}px`,
                '--wd-ty': `${-Math.sin(rad) * d.dist * 0.9}px`,
              }} />
            );
          })}
          <span style={{
            position: 'absolute', fontSize: 40, left: -20, top: -20, opacity: 0,
            animation: 'whirlEmoji 900ms ease-in 50ms forwards',
            filter: 'drop-shadow(0 0 8px rgba(60,180,255,0.8))',
          }}>🌊</span>
          <style>{`
            @keyframes whirlSpin {
              0% { opacity: 0; transform: rotate(0deg) scale(1.8); }
              20% { opacity: 1; transform: rotate(180deg) scale(1.2); }
              55% { opacity: 0.9; transform: rotate(540deg) scale(0.55); }
              100% { opacity: 0; transform: rotate(1080deg) scale(0.03); }
            }
            @keyframes whirlDrop {
              0% { opacity: 0.9; transform: translate(0,0) scale(1); }
              40% { opacity: 0.8; transform: translate(calc(var(--wd-tx)*0.4), calc(var(--wd-ty)*0.4)) scale(0.8); }
              100% { opacity: 0; transform: translate(var(--wd-tx), var(--wd-ty)) scale(0.05); }
            }
            @keyframes whirlEmoji {
              0% { opacity: 0; transform: scale(0.6) rotate(0deg); }
              20% { opacity: 1; transform: scale(1.8) rotate(120deg); }
              55% { opacity: 0.8; transform: scale(1) rotate(450deg); }
              100% { opacity: 0; transform: scale(0.1) rotate(900deg); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  gate_shield: (() => {
    return function GateShieldEffect({ x, y }) {
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}>
          <span style={{
            position: 'absolute', fontSize: 48, left: -24, top: -35, opacity: 0,
            filter: 'drop-shadow(0 0 10px rgba(80,180,255,0.8)) drop-shadow(0 0 20px rgba(60,140,220,0.5))',
            animation: 'gateShieldPop 900ms ease-out forwards',
          }}>🛡️</span>
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * 360;
            const rad = (angle * Math.PI) / 180;
            return (
              <div key={i} style={{
                position: 'absolute',
                width: 6, height: 6, borderRadius: '50%',
                background: 'rgba(100,200,255,0.9)',
                boxShadow: '0 0 6px rgba(80,180,255,0.7)',
                left: Math.cos(rad) * 30 - 3,
                top: Math.sin(rad) * 30 - 3,
                opacity: 0,
                animation: `gateShieldRing 700ms ease-out ${i * 50}ms forwards`,
              }} />
            );
          })}
          <style>{`
            @keyframes gateShieldPop {
              0% { opacity: 0; transform: scale(0.3) translateY(10px); }
              30% { opacity: 1; transform: scale(1.4) translateY(-5px); }
              60% { opacity: 0.9; transform: scale(1) translateY(0); }
              100% { opacity: 0; transform: scale(0.8) translateY(-15px); }
            }
            @keyframes gateShieldRing {
              0% { opacity: 0; transform: scale(0.5); }
              40% { opacity: 1; transform: scale(1.3); }
              100% { opacity: 0; transform: scale(0.3); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  sand_twister: (() => {
    return function SandTwisterEffect({ x, y }) {
      const particles = useMemo(() => Array.from({ length: 24 }, (_, i) => ({
        angle: (i / 24) * 360 * 2 + Math.random() * 30,
        radius: 4 + (i / 24) * 18,
        size: 3 + Math.random() * 4,
        delay: i * 20,
        dur: 600 + Math.random() * 200,
        rise: 10 + (i / 24) * 30,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}>
          {particles.map((p, i) => (
            <span key={i} style={{
              position: 'absolute', width: p.size, height: p.size, borderRadius: '50%',
              background: `rgba(${190+Math.random()*40},${160+Math.random()*40},${100+Math.random()*40},${0.6+Math.random()*0.3})`,
              left: -p.size / 2, top: -p.size / 2, opacity: 0,
              animation: `sandTwist ${p.dur}ms ease-out ${p.delay}ms forwards`,
              '--tw-r': `${p.radius}px`, '--tw-rise': `${p.rise}px`,
              '--tw-a': `${p.angle}deg`,
              boxShadow: '0 0 3px rgba(190,160,100,0.4)',
            }} />
          ))}
          <span style={{
            position: 'absolute', fontSize: 18, left: -9, top: -9, opacity: 0,
            animation: 'twisterEmoji 700ms ease-out 100ms forwards',
          }}>🌪️</span>
          <style>{`
            @keyframes sandTwist {
              0% { opacity: 0; transform: rotate(var(--tw-a)) translateX(2px) translateY(0); }
              30% { opacity: 0.9; transform: rotate(calc(var(--tw-a) + 180deg)) translateX(var(--tw-r)) translateY(calc(var(--tw-rise) * -0.3)); }
              70% { opacity: 0.7; transform: rotate(calc(var(--tw-a) + 360deg)) translateX(var(--tw-r)) translateY(calc(var(--tw-rise) * -0.7)); }
              100% { opacity: 0; transform: rotate(calc(var(--tw-a) + 540deg)) translateX(calc(var(--tw-r) * 0.5)) translateY(calc(var(--tw-rise) * -1)); }
            }
            @keyframes twisterEmoji {
              0% { opacity: 0; transform: scale(0.3) rotate(0deg); }
              40% { opacity: 1; transform: scale(1.3) rotate(180deg); }
              100% { opacity: 0; transform: scale(0.5) rotate(360deg) translateY(-20px); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  mummy_wrap: (() => {
    return function MummyWrapEffect({ x, y }) {
      const strips = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
        angle: (i / 12) * 360 + Math.random() * 30,
        width: 12 + Math.random() * 16,
        height: 3 + Math.random() * 2,
        dist: 6 + Math.random() * 20,
        delay: i * 30 + Math.random() * 60,
        dur: 400 + Math.random() * 300,
        rot: Math.random() * 60 - 30,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}>
          {strips.map((s, i) => {
            const rad = (s.angle * Math.PI) / 180;
            return (
              <div key={i} style={{
                position: 'absolute',
                width: s.width, height: s.height, borderRadius: 1,
                background: `linear-gradient(90deg, rgba(220,200,160,0.9), rgba(180,160,120,0.7))`,
                boxShadow: '0 0 3px rgba(180,160,120,0.4)',
                left: -s.width / 2, top: -s.height / 2,
                opacity: 0,
                transform: `rotate(${s.rot}deg)`,
                animation: `mummyStripWrap ${s.dur}ms ease-in ${s.delay}ms forwards`,
                '--wrap-sx': `${Math.cos(rad) * 35}px`,
                '--wrap-sy': `${Math.sin(rad) * 35}px`,
                '--wrap-ex': `${Math.cos(rad) * s.dist}px`,
                '--wrap-ey': `${Math.sin(rad) * s.dist}px`,
              }} />
            );
          })}
          <span style={{
            position: 'absolute', fontSize: 22, left: -11, top: -11, opacity: 0,
            animation: 'mummyEmojiPop 600ms ease-out 100ms forwards',
          }}>👻</span>
          <style>{`
            @keyframes mummyStripWrap {
              0% { opacity: 0; transform: translate(var(--wrap-sx), var(--wrap-sy)) rotate(0deg) scaleX(0.3); }
              40% { opacity: 0.9; transform: translate(0,0) rotate(180deg) scaleX(1.2); }
              70% { opacity: 0.8; transform: translate(var(--wrap-ex), var(--wrap-ey)) rotate(300deg) scaleX(1); }
              100% { opacity: 0; transform: translate(var(--wrap-ex), var(--wrap-ey)) rotate(360deg) scaleX(0.5); }
            }
            @keyframes mummyEmojiPop {
              0% { opacity: 0; transform: scale(0.3); }
              40% { opacity: 1; transform: scale(1.4); }
              100% { opacity: 0; transform: scale(0.6) translateY(-15px); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  fan_blow: (() => {
    return function FanBlowEffect({ x, y }) {
      const particles = useMemo(() => [
        ...Array.from({ length: 6 }, (_, i) => ({
          type: 'fan', x: -12 + Math.random() * 24, y: -5 + Math.random() * 10,
          delay: i * 40, dur: 500 + Math.random() * 200,
          size: 14 + Math.random() * 6,
        })),
        ...Array.from({ length: 14 }, (_, i) => ({
          type: 'wind', x: -8 + Math.random() * 16, y: -10 + Math.random() * 20,
          delay: 50 + Math.random() * 200, dur: 400 + Math.random() * 300,
          size: 8 + Math.random() * 16,
          angle: -30 + Math.random() * 60,
        })),
      ], []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}>
          {particles.map((p, i) => p.type === 'fan' ? (
            <span key={i} style={{
              position: 'absolute', fontSize: p.size,
              left: p.x, top: p.y, opacity: 0,
              animation: `fanAppear ${p.dur}ms ease-out ${p.delay}ms forwards`,
            }}>🪭</span>
          ) : (
            <span key={i} style={{
              position: 'absolute', left: p.x, top: p.y, opacity: 0,
              width: p.size, height: 2, borderRadius: 2,
              background: `rgba(${200+Math.random()*55},${180+Math.random()*50},${120+Math.random()*80},0.7)`,
              transform: `rotate(${p.angle}deg)`,
              animation: `fanWindLine ${p.dur}ms ease-out ${p.delay}ms forwards`,
              '--fan-dist': `${40 + Math.random() * 30}px`,
            }} />
          ))}
          <style>{`
            @keyframes fanAppear {
              0% { opacity: 0; transform: scale(0.5) rotate(-20deg); }
              30% { opacity: 1; transform: scale(1.3) rotate(10deg); }
              60% { opacity: 0.8; transform: scale(1.1) rotate(-5deg); }
              100% { opacity: 0; transform: scale(0.8) rotate(15deg) translateX(20px); }
            }
            @keyframes fanWindLine {
              0% { opacity: 0; transform: translateX(0) scaleX(0.5); }
              30% { opacity: 0.8; transform: translateX(10px) scaleX(1.5); }
              100% { opacity: 0; transform: translateX(var(--fan-dist)) scaleX(0.3); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  cactus_burst: (() => {
    return function CactusBurstEffect({ x, y }) {
      const particles = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
        angle: (i / 16) * 360 + Math.random() * 22,
        dist: 12 + Math.random() * 22,
        size: 6 + Math.random() * 8,
        delay: Math.random() * 100,
        dur: 400 + Math.random() * 300,
        drift: -8 - Math.random() * 15,
        isCactus: Math.random() < 0.4,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}>
          {particles.map((p, i) => {
            const rad = (p.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * p.dist;
            const ty = Math.sin(rad) * p.dist + p.drift;
            return p.isCactus ? (
              <span key={i} style={{
                position: 'absolute', fontSize: p.size + 4,
                left: -p.size / 2, top: -p.size / 2, opacity: 0,
                animation: `cactusPop ${p.dur}ms ease-out ${p.delay}ms forwards`,
                '--cact-tx': `${tx}px`, '--cact-ty': `${ty}px`,
              }}>🌵</span>
            ) : (
              <span key={i} style={{
                position: 'absolute', width: p.size, height: p.size, borderRadius: '50%',
                background: `rgba(${60+Math.random()*40},${140+Math.random()*60},${50+Math.random()*30},0.8)`,
                left: -p.size / 2, top: -p.size / 2, opacity: 0,
                animation: `cactusPop ${p.dur}ms ease-out ${p.delay}ms forwards`,
                '--cact-tx': `${tx}px`, '--cact-ty': `${ty}px`,
                boxShadow: '0 0 4px rgba(80,180,60,0.5)',
              }} />
            );
          })}
          <style>{`
            @keyframes cactusPop {
              0% { opacity: 0; transform: translate(0,0) scale(0.4); }
              20% { opacity: 1; transform: translate(calc(var(--cact-tx)*0.3), calc(var(--cact-ty)*0.3)) scale(1.2); }
              60% { opacity: 0.8; transform: translate(var(--cact-tx), var(--cact-ty)) scale(1); }
              100% { opacity: 0; transform: translate(calc(var(--cact-tx)*1.3), calc(var(--cact-ty)*1.2)) scale(0.2); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  mushroom_spore: (() => {
    return function MushroomSporeEffect({ x, y }) {
      const particles = useMemo(() => Array.from({ length: 20 }, (_, i) => ({
        angle: Math.random() * 360,
        dist: 8 + Math.random() * 28,
        size: 5 + Math.random() * 8,
        delay: Math.random() * 150,
        dur: 400 + Math.random() * 300,
        drift: -15 - Math.random() * 25,
        emoji: ['🍄', '☁'][Math.random() < 0.35 ? 0 : 1],
        color: `rgba(${80+Math.random()*60},${120+Math.random()*60},${40+Math.random()*40},${0.6+Math.random()*0.3})`,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}>
          {particles.map((p, i) => {
            const rad = (p.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * p.dist;
            const ty = Math.sin(rad) * p.dist + p.drift;
            return p.emoji === '🍄' ? (
              <span key={i} style={{
                position: 'absolute', fontSize: p.size + 2,
                left: -p.size / 2, top: -p.size / 2, opacity: 0,
                animation: `sporeFloat ${p.dur}ms ease-out ${p.delay}ms forwards`,
                '--spore-tx': `${tx}px`, '--spore-ty': `${ty}px`,
              }}>{p.emoji}</span>
            ) : (
              <span key={i} style={{
                position: 'absolute', width: p.size, height: p.size, borderRadius: '50%',
                background: p.color, filter: 'blur(2px)',
                left: -p.size / 2, top: -p.size / 2, opacity: 0,
                animation: `sporeFloat ${p.dur}ms ease-out ${p.delay}ms forwards`,
                '--spore-tx': `${tx}px`, '--spore-ty': `${ty}px`,
              }} />
            );
          })}
          <style>{`
            @keyframes sporeFloat {
              0% { opacity: 0; transform: translate(0,0) scale(0.5); }
              25% { opacity: 0.9; transform: translate(calc(var(--spore-tx) * 0.3), calc(var(--spore-ty) * 0.2)) scale(1.1); }
              70% { opacity: 0.7; transform: translate(var(--spore-tx), calc(var(--spore-ty) * 0.7)) scale(0.9); }
              100% { opacity: 0; transform: translate(calc(var(--spore-tx) * 1.2), var(--spore-ty)) scale(0.3); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  dark_swarm: (() => {
    return function DarkSwarmEffect({ x, y }) {
      const particles = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
        angle: Math.random() * 360,
        dist: 5 + Math.random() * 25,
        size: 4 + Math.random() * 6,
        delay: Math.random() * 200,
        dur: 300 + Math.random() * 300,
        orbit: 15 + Math.random() * 20,
        orbitSpeed: 0.8 + Math.random() * 1.2,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}>
          {particles.map((p, i) => {
            const rad = (p.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * p.dist;
            const ty = Math.sin(rad) * p.dist;
            return (
              <span key={i} style={{
                position: 'absolute', width: p.size, height: p.size, borderRadius: '50%',
                background: `radial-gradient(circle, rgba(${120+Math.random()*40},${20+Math.random()*30},${160+Math.random()*60},0.9), rgba(40,0,60,0.7))`,
                left: -p.size / 2, top: -p.size / 2,
                opacity: 0,
                animation: `darkSwarmFly ${p.dur}ms ease-in-out ${p.delay}ms forwards`,
                '--swarm-tx': `${tx}px`, '--swarm-ty': `${ty}px`,
                '--swarm-orbit': `${p.orbit}px`,
                boxShadow: '0 0 6px 2px rgba(130,30,180,0.6)',
              }} />
            );
          })}
          <style>{`
            @keyframes darkSwarmFly {
              0% { opacity: 0; transform: translate(0,0) scale(0.3); }
              20% { opacity: 0.95; transform: translate(calc(var(--swarm-tx) * 0.3), calc(var(--swarm-ty) * 0.3)) scale(1.2); }
              50% { opacity: 1; transform: translate(var(--swarm-tx), var(--swarm-ty)) scale(1); }
              80% { opacity: 0.8; transform: translate(calc(var(--swarm-tx) * 0.6), calc(var(--swarm-ty) * 1.3)) scale(0.8); }
              100% { opacity: 0; transform: translate(var(--swarm-tx), calc(var(--swarm-ty) + 10px)) scale(0.2); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  sand_reset: (() => {
    return function SandResetEffect({ x, y }) {
      const particles = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
        angle: (i / 18) * 360 + Math.random() * 20,
        dist: 10 + Math.random() * 30,
        size: 3 + Math.random() * 5,
        delay: Math.random() * 300,
        dur: 500 + Math.random() * 400,
        emoji: ['🏜', '✨'][Math.random() < 0.8 ? 0 : 1],
        drift: -20 - Math.random() * 30,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 9999 }}>
          {particles.map((p, i) => {
            const rad = (p.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * p.dist;
            const ty = Math.sin(rad) * p.dist + p.drift;
            return (
              <span key={i} style={{
                position: 'absolute', fontSize: p.size + 4,
                left: -p.size / 2, top: -p.size / 2,
                opacity: 0,
                animation: `sandParticleFly ${p.dur}ms ease-out ${p.delay}ms forwards`,
                '--sand-tx': `${tx}px`, '--sand-ty': `${ty}px`,
              }}>{p.emoji}</span>
            );
          })}
          <style>{`
            @keyframes sandParticleFly {
              0% { opacity: 0.9; transform: translate(0,0) scale(1); }
              60% { opacity: 0.7; }
              100% { opacity: 0; transform: translate(var(--sand-tx), var(--sand-ty)) scale(0.3); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  quick_slash: (() => {
    return function QuickSlashEffect({ x, y }) {
      const sparks = useMemo(() => Array.from({ length: 10 }, () => ({
        angle: -60 + Math.random() * 120,
        dist: 15 + Math.random() * 30,
        size: 2 + Math.random() * 4,
        delay: 50 + Math.random() * 100,
        dur: 200 + Math.random() * 200,
        color: ['#ffffff','#ffffcc','#ffeeaa','#ccddff'][Math.floor(Math.random() * 4)],
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div style={{
            position: 'absolute', left: -40, top: -40, width: 80, height: 80,
            background: 'radial-gradient(circle, rgba(255,255,255,.9) 0%, rgba(255,255,255,0) 70%)',
            animation: 'slashFlash 250ms ease-out forwards',
          }} />
          <div style={{
            position: 'absolute', left: -30, top: 0, width: 60, height: 3,
            background: 'linear-gradient(90deg, transparent, #fff, #ffffaa, #fff, transparent)',
            transform: 'rotate(-35deg)', transformOrigin: 'center',
            animation: 'slashStrike1 180ms ease-out forwards',
            boxShadow: '0 0 8px 2px rgba(255,255,200,.8)',
          }} />
          <div style={{
            position: 'absolute', left: -25, top: 2, width: 50, height: 2,
            background: 'linear-gradient(90deg, transparent, #fff, #ffddaa, #fff, transparent)',
            transform: 'rotate(25deg)', transformOrigin: 'center',
            animation: 'slashStrike2 200ms ease-out 40ms forwards',
            boxShadow: '0 0 6px 1px rgba(255,255,180,.6)',
          }} />
          {sparks.map((s, i) => {
            const rad = (s.angle * Math.PI) / 180;
            const tx = Math.cos(rad) * s.dist;
            const ty = Math.sin(rad) * s.dist;
            return (
              <div key={i} style={{
                position: 'absolute', width: s.size, height: s.size, borderRadius: '50%',
                background: s.color, boxShadow: `0 0 4px ${s.color}`,
                left: -s.size / 2, top: -s.size / 2, opacity: 0,
                animation: `slashSpark ${s.dur}ms ease-out ${s.delay}ms forwards`,
                '--spark-tx': `${tx}px`, '--spark-ty': `${ty}px`,
              }} />
            );
          })}
          <style>{`
            @keyframes slashFlash {
              0% { opacity: 0; transform: scale(0.3); }
              30% { opacity: 1; transform: scale(1.2); }
              100% { opacity: 0; transform: scale(1.5); }
            }
            @keyframes slashStrike1 {
              0% { opacity: 0; transform: rotate(-35deg) scaleX(0); }
              40% { opacity: 1; transform: rotate(-35deg) scaleX(1.3); }
              100% { opacity: 0; transform: rotate(-35deg) scaleX(0.5); }
            }
            @keyframes slashStrike2 {
              0% { opacity: 0; transform: rotate(25deg) scaleX(0); }
              40% { opacity: 1; transform: rotate(25deg) scaleX(1.3); }
              100% { opacity: 0; transform: rotate(25deg) scaleX(0.5); }
            }
            @keyframes slashSpark {
              0% { opacity: 0; transform: translate(0,0) scale(1); }
              20% { opacity: 1; }
              100% { opacity: 0; transform: translate(var(--spark-tx), var(--spark-ty)) scale(0.2); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  poison_pollen_rain: (() => {
    return function PoisonPollenRainEffect({ x, y }) {
      const spores = useMemo(() => Array.from({ length: 24 }, () => ({
        xOff: -35 + Math.random() * 70,
        size: 4 + Math.random() * 7,
        delay: Math.random() * 300,
        dur: 500 + Math.random() * 400,
        color: Math.random() < 0.5
          ? ['#9933cc','#7722aa','#bb55ee','#aa44dd'][Math.floor(Math.random() * 4)]
          : ['#ddcc33','#ccbb22','#eedd55','#bbaa11'][Math.floor(Math.random() * 4)],
        wobble: -6 + Math.random() * 12,
        emoji: Math.random() < 0.2 ? (Math.random() < 0.5 ? '🍄' : '✨') : null,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div style={{
            position: 'absolute', left: -30, top: -30, width: 60, height: 60,
            background: 'radial-gradient(circle, rgba(150,50,200,.5) 0%, rgba(200,180,40,.3) 40%, transparent 70%)',
            animation: 'pollenFlash 400ms ease-out forwards',
          }} />
          {spores.map((s, i) => (
            s.emoji ? (
              <span key={i} style={{
                position: 'absolute', fontSize: s.size + 4,
                left: s.xOff - s.size / 2, top: -40, opacity: 0,
                animation: `pollenFall ${s.dur}ms ease-in ${s.delay}ms forwards`,
                '--pollen-drift': `${s.wobble}px`,
              }}>{s.emoji}</span>
            ) : (
              <div key={i} style={{
                position: 'absolute', width: s.size, height: s.size, borderRadius: '50%',
                background: s.color, filter: 'blur(1px)',
                boxShadow: `0 0 4px ${s.color}`,
                left: s.xOff - s.size / 2, top: -40, opacity: 0,
                animation: `pollenFall ${s.dur}ms ease-in ${s.delay}ms forwards`,
                '--pollen-drift': `${s.wobble}px`,
              }} />
            )
          ))}
          <style>{`
            @keyframes pollenFlash {
              0% { opacity: 0; transform: scale(0.5); }
              30% { opacity: 0.8; transform: scale(1.2); }
              100% { opacity: 0; transform: scale(1.5); }
            }
            @keyframes pollenFall {
              0% { opacity: 0; transform: translate(0, 0) scale(0.5); }
              15% { opacity: 0.9; transform: translate(calc(var(--pollen-drift) * 0.3), 8px) scale(1); }
              70% { opacity: 0.7; transform: translate(var(--pollen-drift), 35px) scale(0.9); }
              100% { opacity: 0; transform: translate(calc(var(--pollen-drift) * 1.3), 55px) scale(0.4); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  snake_devour: (() => {
    return function SnakeDevourEffect({ x, y }) {
      const coils = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
        angle: i * 60 + Math.random() * 20,
        dist: 20 + Math.random() * 15,
        delay: i * 60,
        dur: 600 + Math.random() * 200,
        size: 20 + Math.random() * 10,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Central snake head */}
          <span style={{
            position: 'absolute', left: -16, top: -50, fontSize: 36,
            animation: 'snakeStrike 700ms ease-in-out forwards',
          }}>🐍</span>
          {/* Dark vortex */}
          <div style={{
            position: 'absolute', left: -35, top: -35, width: 70, height: 70,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(30,0,50,.9) 0%, rgba(80,20,120,.5) 40%, transparent 70%)',
            animation: 'snakeVortex 800ms ease-in forwards',
          }} />
          {/* Coiling segments */}
          {coils.map((c, i) => {
            const rad = (c.angle * Math.PI) / 180;
            return (
              <span key={i} style={{
                position: 'absolute', fontSize: c.size,
                left: Math.cos(rad) * c.dist - c.size / 2,
                top: Math.sin(rad) * c.dist - c.size / 2,
                opacity: 0,
                animation: `snakeCoil ${c.dur}ms ease-in ${c.delay}ms forwards`,
                '--coil-x': `${-Math.cos(rad) * c.dist}px`,
                '--coil-y': `${-Math.sin(rad) * c.dist}px`,
              }}>🐍</span>
            );
          })}
          <style>{`
            @keyframes snakeStrike {
              0% { opacity: 0; transform: translate(0, -20px) scale(0.5) rotate(-30deg); }
              30% { opacity: 1; transform: translate(0, 5px) scale(1.3) rotate(10deg); }
              60% { opacity: 1; transform: translate(0, 0) scale(1.1) rotate(-5deg); }
              100% { opacity: 0; transform: translate(0, 10px) scale(0.3) rotate(0deg); }
            }
            @keyframes snakeVortex {
              0% { opacity: 0; transform: scale(0.3) rotate(0deg); }
              30% { opacity: 0.9; transform: scale(1.2) rotate(90deg); }
              70% { opacity: 0.7; transform: scale(1.0) rotate(200deg); }
              100% { opacity: 0; transform: scale(0.1) rotate(360deg); }
            }
            @keyframes snakeCoil {
              0% { opacity: 0; transform: translate(0,0) scale(1) rotate(0deg); }
              30% { opacity: 0.8; transform: translate(calc(var(--coil-x)*0.3), calc(var(--coil-y)*0.3)) scale(0.8) rotate(120deg); }
              70% { opacity: 0.6; transform: translate(calc(var(--coil-x)*0.8), calc(var(--coil-y)*0.8)) scale(0.5) rotate(240deg); }
              100% { opacity: 0; transform: translate(var(--coil-x), var(--coil-y)) scale(0.1) rotate(360deg); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  warlord_bite: (() => {
    return function WarlordBiteEffect({ x, y }) {
      const [phase, setPhase] = useState('open');
      useEffect(() => {
        const t = setTimeout(() => setPhase('shut'), 350);
        return () => clearTimeout(t);
      }, []);
      const fangStyle = (side) => ({
        position: 'absolute',
        left: side === 'left' ? -18 : 6,
        fontSize: 0, width: 0, height: 0,
        borderLeft: '8px solid transparent',
        borderRight: '8px solid transparent',
        borderTop: side === 'left' ? '22px solid #e8e0d0' : '22px solid #d8d0c0',
        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.6))',
        transition: 'transform 0.25s ease-in',
        transform: phase === 'open'
          ? (side === 'left' ? 'translateY(-30px) rotate(-15deg)' : 'translateY(-30px) rotate(15deg)')
          : (side === 'left' ? 'translateY(0) rotate(-5deg)' : 'translateY(0) rotate(5deg)'),
      });
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Upper jaw */}
          <div style={{ position: 'absolute', top: -20, left: -12,
            transition: 'transform 0.25s ease-in',
            transform: phase === 'open' ? 'translateY(-18px)' : 'translateY(0)' }}>
            <div style={fangStyle('left')} />
            <div style={fangStyle('right')} />
          </div>
          {/* Lower jaw */}
          <div style={{ position: 'absolute', top: 8, left: -12,
            transition: 'transform 0.25s ease-in',
            transform: phase === 'open' ? 'translateY(18px) scaleY(-1)' : 'translateY(0) scaleY(-1)' }}>
            <div style={fangStyle('left')} />
            <div style={fangStyle('right')} />
          </div>
          {/* Impact flash on bite */}
          {phase === 'shut' && <div style={{
            position: 'absolute', left: -20, top: -20, width: 40, height: 40,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(200,120,255,.7), transparent 70%)',
            animation: 'warlordBiteFlash .5s ease-out forwards',
          }} />}
          <style>{`
            @keyframes warlordBiteFlash {
              0% { opacity: 1; transform: scale(0.5); }
              100% { opacity: 0; transform: scale(1.5); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  poison_ooze: (() => {
    return function PoisonOozeEffect({ x, y }) {
      const drips = useMemo(() => Array.from({ length: 14 }, () => ({
        dx: -30 + Math.random() * 60,
        delay: Math.random() * 400,
        dur: 600 + Math.random() * 500,
        size: 6 + Math.random() * 10,
        opacity: 0.5 + Math.random() * 0.4,
        endY: 20 + Math.random() * 50,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {drips.map((d, i) => (
            <div key={i} style={{
              position: 'absolute', left: d.dx, top: -10,
              width: d.size, height: d.size, borderRadius: '50% 50% 50% 20%',
              background: 'radial-gradient(circle at 35% 35%, rgba(180,60,255,.8), rgba(100,0,180,.5))',
              boxShadow: '0 0 6px rgba(150,30,220,.6)',
              opacity: 0,
              animation: `poisonDrip ${d.dur}ms ease-in ${d.delay}ms forwards`,
              '--dripEndY': d.endY + 'px',
            }} />
          ))}
          {/* Purple pool spreading at center */}
          <div style={{
            position: 'absolute', left: -25, top: 5, width: 50, height: 20,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(150,30,220,.6), rgba(100,0,160,.2) 70%, transparent)',
            animation: 'poisonPoolSpread 0.8s ease-out 300ms forwards',
            opacity: 0,
          }} />
          <style>{`
            @keyframes poisonDrip {
              0% { opacity: 0; transform: translateY(-5px) scale(0.5); }
              20% { opacity: var(--popacity, 0.7); transform: translateY(0) scale(1); }
              100% { opacity: 0; transform: translateY(var(--dripEndY, 40px)) scale(0.6); }
            }
            @keyframes poisonPoolSpread {
              0% { opacity: 0; transform: scale(0.3); }
              40% { opacity: 0.7; }
              100% { opacity: 0; transform: scale(1.5); }
            }
          `}</style>
        </div>
      );
    };
  })(),
};

function IceEncaseEffect({ x, y }) {
  // Ice shards from ALL sides converging on target
  const shards = useMemo(() => Array.from({ length: 20 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 40;
    return {
      startX: Math.cos(angle) * dist,
      startY: Math.sin(angle) * dist,
      size: 4 + Math.random() * 8,
      delay: Math.random() * 150,
      dur: 200 + Math.random() * 200,
      char: ['❄','❅','❆','✦','·'][Math.floor(Math.random() * 5)],
    };
  }), []);
  const burstCrystals = useMemo(() => Array.from({ length: 12 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 10 + Math.random() * 25;
    return {
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 6,
      color: ['#aaddff','#88ccff','#cceeFF','#fff','#ddeeff'][Math.floor(Math.random() * 5)],
      delay: 350 + Math.random() * 100,
      dur: 300 + Math.random() * 200,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      <div className="anim-freeze-flash" style={{ animationDelay: '300ms' }} />
      {shards.map((s, i) => (
        <div key={'sh'+i} className="anim-ice-shard" style={{
          '--startX': s.startX + 'px', '--startY': s.startY + 'px', '--size': s.size + 'px',
          animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
        }}>{s.char}</div>
      ))}
      {burstCrystals.map((c, i) => (
        <div key={'bc'+i} className="anim-explosion-particle" style={{
          '--dx': c.dx + 'px', '--dy': c.dy + 'px', '--size': c.size + 'px',
          '--color': c.color, animationDelay: c.delay + 'ms', animationDuration: c.dur + 'ms',
        }} />
      ))}
    </div>
  );
}

function GameAnimationRenderer({ type, x, y, w, h }) {
  const Component = ANIM_REGISTRY[type];
  if (!Component) return null;
  return <Component x={x} y={y} w={w} h={h} />;
}

// Renders an ability zone stack — handles Performance visual transformation
function AbilityStack({ cards }) {
  const [hovered, setHovered] = useState(false);
  // Check if top card is Performance — if so, display the ability below it
  const topCard = cards[cards.length - 1];
  const isTopPerformance = topCard === 'Performance';
  const displayName = isTopPerformance && cards.length > 1 ? cards[cards.length - 2] : topCard;

  return (
    <div className="board-ability-stack"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {cards.map((c, ci) => {
        // When top is Performance: show the underlying ability image for Performance cards,
        // but on hover, show the actual Performance card
        let showName = c;
        if (c === 'Performance' && !hovered && ci > 0) {
          // Not hovered: Performance looks like the ability below
          showName = cards.find(x => x !== 'Performance') || c;
        }
        return (
          <div key={ci} className="board-ability-stack-card" style={{ top: ci * 5 }}>
            <BoardCard cardName={hovered && ci === cards.length - 1 && isTopPerformance ? 'Performance' : showName} />
          </div>
        );
      })}
      {cards.length > 1 && <div className="board-card-label">{cards.length}</div>}
    </div>
  );
}

// Card name picker prompt component (for Luck, etc.) — must be a proper component to preserve state across re-renders
const CARD_NAME_TYPE_COLORS = { Hero:'#aa44ff', 'Ascended Hero':'#7722cc', Ability:'#4488ff', Artifact:'#ddaa22', Creature:'#44bb44', Attack:'#ff4444', Spell:'#ff4444', Potion:'#8B4513' };
function CardNamePickerPrompt({ ep, onRespond }) {
  const [filter, setFilter] = useState('');
  // Only show cards that have images (exist in AVAILABLE_MAP), exclude Tokens
  const names = useMemo(() => {
    const avMap = window.AVAILABLE_MAP || {};
    return Object.keys(avMap).filter(n => {
      const cd = CARDS_BY_NAME[n];
      return cd && cd.cardType !== 'Token';
    }).sort((a, b) => a.localeCompare(b));
  }, []);
  const filtered = filter ? names.filter(n => n.toLowerCase().includes(filter.toLowerCase())) : names;
  return (
    <div className="modal-overlay" onClick={ep.cancellable !== false ? () => onRespond({ cancelled: true }) : undefined}>
      <DraggablePanel className="modal animate-in" style={{ maxWidth: 380, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
        <div className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 4 }}>{ep.title || 'Declare a Card'}</div>
        {ep.description && <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 10 }}>{ep.description}</div>}
        <input type="text" value={filter} onChange={e => setFilter(e.target.value)} autoFocus
          placeholder="Type to search..." style={{
            width: '100%', padding: '8px 12px', fontSize: 13, marginBottom: 8,
            background: 'var(--bg2)', border: '1px solid var(--bg4)', borderRadius: 6,
            color: 'var(--text1)', outline: 'none', boxSizing: 'border-box',
          }} />
        <div style={{ flex: 1, maxHeight: 400, overflowY: 'auto', border: '1px solid var(--bg4)', borderRadius: 6, background: 'var(--bg2)' }}>
          {filtered.length === 0 && <div style={{ padding: 12, color: 'var(--text2)', fontSize: 11, textAlign: 'center' }}>No cards found</div>}
          {filtered.map(name => {
            const card = CARDS_BY_NAME[name];
            const tc = CARD_NAME_TYPE_COLORS[card?.cardType] || 'var(--text2)';
            return (
              <div key={name} className="card-name-picker-row"
                style={{ padding: '5px 10px', cursor: 'pointer', fontSize: 12,
                  borderBottom: '1px solid var(--bg3)', display: 'flex', alignItems: 'center', gap: 8,
                }}
                onMouseEnter={() => { if (card) _boardTooltipSetter?.(card); }}
                onMouseLeave={() => { _boardTooltipSetter?.(null); }}
                onClick={() => { _boardTooltipSetter?.(null); onRespond({ cardName: name }); }}>
                <span style={{ color: tc, fontWeight: 600, fontSize: 8, minWidth: 48, textTransform: 'uppercase' }}>
                  {card?.cardType || '?'}
                </span>
                <span style={{ color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              </div>
            );
          })}
        </div>
        {ep.cancellable !== false && (
          <button className="btn" style={{ padding: '6px 14px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)', marginTop: 10, width: '100%' }}
            onClick={() => onRespond({ cancelled: true })}>Cancel</button>
        )}
      </DraggablePanel>
    </div>
  );
}

// Status select prompt component (for Beer, etc.) — must be a proper component for hooks
function CardGalleryMultiPrompt({ ep, onRespond }) {
  const cards = ep.cards || [];
  const maxSelect = ep.selectCount || 3;
  const minSelect = ep.minSelect || (ep.maxBudget != null ? 1 : maxSelect);
  const maxBudget = ep.maxBudget;
  const costKey = ep.costKey || 'cost';
  const [selected, setSelected] = useState([]);

  const totalCost = maxBudget != null
    ? selected.reduce((sum, name) => {
        const entry = cards.find(c => c.name === name);
        return sum + (entry?.[costKey] || 0);
      }, 0)
    : 0;

  const toggleCard = (name) => {
    setSelected(prev => {
      if (prev.includes(name)) return prev.filter(n => n !== name);
      if (prev.length >= maxSelect) return prev;
      // Budget check
      if (maxBudget != null) {
        const entry = cards.find(c => c.name === name);
        const entryCost = entry?.[costKey] || 0;
        const currentTotal = prev.reduce((sum, n) => {
          const e = cards.find(c => c.name === n);
          return sum + (e?.[costKey] || 0);
        }, 0);
        if (currentTotal + entryCost > maxBudget) return prev;
      }
      return [...prev, name];
    });
  };

  const canConfirm = selected.length >= minSelect && selected.length <= maxSelect;

  // Enter/Space confirms selection
  useEffect(() => {
    if (!canConfirm) return;
    const handleKey = (e) => {
      if (e.key !== 'Enter' && e.code !== 'Space') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onRespond({ selectedCards: selected });
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [canConfirm, selected, onRespond]);

  return (
    <div className="modal-overlay" onClick={ep.cancellable !== false ? () => onRespond({ cancelled: true }) : undefined}>
      <div className="modal animate-in deck-viewer-modal" style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexShrink: 0 }}>
          <span className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)' }}>
            {ep.title || 'Select Cards'}
          </span>
          {ep.cancellable !== false && (
            <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }}
              onClick={() => onRespond({ cancelled: true })}>✕ CANCEL</button>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12, flexShrink: 0 }}>
          {ep.description}
          {maxBudget != null && (
            <span style={{ marginLeft: 8, color: totalCost > maxBudget * 0.8 ? '#ffaa33' : 'var(--accent)', fontWeight: 600 }}>
              (Cost: {totalCost}/{maxBudget})
            </span>
          )}
        </div>
        <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          <div className="deck-viewer-grid">
            {cards.map((entry, i) => {
              const card = CARDS_BY_NAME[entry.name];
              if (!card) return null;
              const isSel = selected.includes(entry.name);
              const entryCost = entry[costKey] || 0;
              const wouldExceedBudget = maxBudget != null && !isSel && totalCost + entryCost > maxBudget;
              const atMax = !isSel && selected.length >= maxSelect;
              const dimmed = wouldExceedBudget || atMax;
              return (
                <div key={entry.name + '-' + i} style={{ position: 'relative' }}>
                  <CardMini card={card}
                    onClick={dimmed ? undefined : () => toggleCard(entry.name)}
                    style={{ width: '100%', height: 120, cursor: dimmed ? 'not-allowed' : 'pointer',
                      outline: isSel ? '3px solid var(--accent)' : 'none',
                      filter: isSel ? 'brightness(1.2)' : (dimmed ? 'brightness(0.4) saturate(0.3)' : 'none'),
                    }} />
                  {isSel && <div style={{ position: 'absolute', top: 3, right: 3, background: 'var(--accent)', color: '#000', fontSize: 10, fontWeight: 800, padding: '1px 6px', borderRadius: 3, zIndex: 5 }}>✓</div>}
                  {maxBudget != null && <div style={{ position: 'absolute', bottom: 3, left: 3, background: 'rgba(0,0,0,.7)', color: '#ffd700', fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3, zIndex: 5 }}>{entryCost}G</div>}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ textAlign: 'center', marginTop: 12, flexShrink: 0 }}>
          <button className={'btn ' + (ep.confirmClass || '')} style={{ padding: '8px 24px', fontSize: 12 }}
            disabled={!canConfirm}
            onClick={() => onRespond({ selectedCards: selected })}>
            {ep.confirmLabel || `Confirm (${selected.length}/${maxSelect})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusSelectPrompt({ ep, onRespond }) {
  const [localSelected, setLocalSelected] = useState(() => (ep.statuses || []).map(s => s.key));
  const toggleStatus = (key) => {
    setLocalSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  // Enter/Space confirms selection
  useEffect(() => {
    if (localSelected.length === 0) return;
    const handleKey = (e) => {
      if (e.key !== 'Enter' && e.code !== 'Space') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onRespond({ selectedStatuses: localSelected });
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [localSelected, onRespond]);

  return (
    <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: '#33dd55', minWidth: 260 }}>
      <div className="orbit-font" style={{ fontSize: 13, color: '#33dd55', marginBottom: 4 }}>{ep.title}</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>{ep.description}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
        {(ep.statuses || []).map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '4px 8px', borderRadius: 4,
            background: localSelected.includes(s.key) ? 'rgba(50,220,80,.15)' : 'rgba(255,255,255,.03)',
            border: localSelected.includes(s.key) ? '1px solid rgba(50,220,80,.5)' : '1px solid rgba(255,255,255,.08)',
          }} onClick={() => toggleStatus(s.key)}>
            <span style={{ fontSize: 16 }}>{s.icon}</span>
            <span style={{ fontSize: 12, color: localSelected.includes(s.key) ? '#88ffaa' : 'var(--text2)' }}>{s.label}{s.stacks > 1 ? ` (×${s.stacks})` : ''}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: localSelected.includes(s.key) ? '#33dd55' : 'var(--text2)', opacity: .6 }}>
              {localSelected.includes(s.key) ? '✓' : '○'}
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="btn btn-success" style={{ padding: '6px 20px', fontSize: 11 }}
          onClick={() => onRespond({ selectedStatuses: localSelected })}>
          {ep.confirmLabel || 'Confirm'}
        </button>
        {ep.cancellable !== false && (
          <button className="btn" style={{ padding: '6px 16px', fontSize: 11 }}
            onClick={() => onRespond({ cancelled: true })}>← Back</button>
        )}
      </div>
    </DraggablePanel>
  );
}

function GameBoard({ gameState, lobby, onLeave, decks, sampleDecks, selectedDeck, setSelectedDeck }) {
  const { user, setUser, notify } = useContext(AppContext);
  const isSpectator = gameState.isSpectator || false;
  const myIdx = gameState.myIndex;
  const oppIdx = myIdx === 0 ? 1 : 0;
  const me = gameState.players[myIdx];
  const opp = gameState.players[oppIdx];
  const gameSkins = useMemo(() => ({ ...(me.deckSkins || {}), ...(opp.deckSkins || {}) }), [me.deckSkins, opp.deckSkins]);
  const result = gameState.result;
  const iWon = result && result.winnerIdx === myIdx;
  const oppLeft = opp.left || false;
  const oppDisconnected = opp.disconnected || false;
  const meDisconnected = me.disconnected || false;
  const myRematchSent = !isSpectator && (gameState.rematchRequests || []).includes(user.id);

  // ── Shared board tooltip (single instance, driven by BoardCard/CardRevealEntry) ──
  const [tooltipCard, setTooltipCard] = useState(null);
  useEffect(() => {
    _boardTooltipSetter = setTooltipCard;
    return () => { _boardTooltipSetter = null; };
  }, []);
  // Sync: when global tap-tooltip clears, also clear board tooltip
  useEffect(() => {
    if (!window._isTouchDevice) return;
    const sync = (activeCard) => {
      if (!activeCard) setTooltipCard(null);
    };
    window._tapTooltipSetters.add(sync);
    return () => window._tapTooltipSetters.delete(sync);
  }, []);
  // Safety: if the mouse isn't over any board-card element, clear the tooltip.
  // Catches cases where the source element was removed (overlay dismissed, card reveal expired).
  useEffect(() => {
    if (!tooltipCard) return;
    // On touch devices, tooltip stays until explicitly dismissed by tap
    if (window._isTouchDevice) return;
    const check = () => {
      if (!document.querySelector('.board-card:hover, .card-reveal-entry:hover, .card-mini:hover, .card-name-picker-row:hover, .revealed-hand-card:hover')) {
        setTooltipCard(null);
      }
    };
    const id = setInterval(check, 300);
    return () => clearInterval(id);
  }, [tooltipCard]);

  // Board skin helpers — construct zone background style from board ID
  const boardZoneStyle = (boardId, zoneType) => {
    if (!boardId) return undefined;
    const num = boardId.replace(/\D/g, '');
    return {
      backgroundImage: 'url(/data/shop/boards/' + encodeURIComponent(zoneType + num) + '.png)',
      backgroundSize: 'cover', backgroundPosition: 'center',
    };
  };
  const myBoardZone = (zoneType) => boardZoneStyle(me.board, zoneType);
  const oppBoardZone = (zoneType) => boardZoneStyle(opp.board, zoneType);

  // Area zone positioning — measure hero zones to find midpoints between columns
  const boardCenterRef = useRef(null);
  const [areaPositions, setAreaPositions] = useState([undefined, undefined]);

  useEffect(() => {
    const measure = () => {
      const container = boardCenterRef.current;
      if (!container) return;
      // Find all hero zones from the "me" side (bottom) for stable measurement
      const myHeroes = container.querySelectorAll('[data-hero-owner="me"][data-hero-zone]');
      if (myHeroes.length < 3) return;
      const containerRect = container.getBoundingClientRect();
      const rects = Array.from(myHeroes).sort((a, b) => +a.dataset.heroIdx - +b.dataset.heroIdx).map(el => el.getBoundingClientRect());
      // Half-zone offset: use actual rendered zone width (scales with --board-scale)
      const halfZone = (myHeroes[0]?.offsetWidth || 68) / 2;
      // Midpoint between hero 0 right edge and hero 1 left edge
      const mid01 = ((rects[0].left + rects[0].right) / 2 + (rects[1].left + rects[1].right) / 2) / 2 - containerRect.left - halfZone;
      // Midpoint between hero 1 right edge and hero 2 left edge
      const mid12 = ((rects[1].left + rects[1].right) / 2 + (rects[2].left + rects[2].right) / 2) / 2 - containerRect.left - halfZone;
      setAreaPositions([mid01, mid12]);
    };
    measure();
    window.addEventListener('resize', measure);
    const timer = setTimeout(measure, 200);
    return () => { window.removeEventListener('resize', measure); clearTimeout(timer); };
  }, [gameState.turn, gameState.players[0]?.islandZoneCount, gameState.players[1]?.islandZoneCount]);

  // ── Board auto-scaling: fit board to available width ──
  useEffect(() => {
    const container = boardCenterRef.current;
    if (!container) return;
    const IDEAL_WIDTH = 1100; // px at scale 1.0 — matches full-size reference layout
    const MIN_SCALE = 0.45;  // never go smaller than this (touch target safety)
    const updateScale = () => {
      const available = container.clientWidth;
      const scale = Math.max(MIN_SCALE, Math.min(1, available / IDEAL_WIDTH));
      document.documentElement.style.setProperty('--board-scale', scale.toFixed(4));
    };
    const ro = new ResizeObserver(updateScale);
    ro.observe(container);
    updateScale();
    return () => { ro.disconnect(); document.documentElement.style.setProperty('--board-scale', '1'); };
  }, []);

  // Local hand state for reordering
  const [hand, setHand] = useState(me.hand || []);
  // Compute resolving card index from LOCAL hand order + server marker
  const resolvingHandIndex = useMemo(() => {
    const rc = me.resolvingCard;
    if (!rc) return -1;
    let count = 0;
    for (let i = 0; i < hand.length; i++) {
      if (hand[i] === rc.name) {
        count++;
        if (count === rc.nth) return i;
      }
    }
    return -1;
  }, [hand, me.resolvingCard]);
  const handKeyRef = useRef(JSON.stringify(me.hand || []));
  const [drawAnimCards, setDrawAnimCards] = useState([]); // [{id, cardName, origIdx}]
  const prevHandLenRef = useRef((me.hand || []).length);
  // Spectator: track bottom player hand count for draw animations (like opponent draw)
  const [specMeDrawAnims, setSpecMeDrawAnims] = useState([]);
  const [specMeDrawHidden, setSpecMeDrawHidden] = useState(new Set());
  const prevSpecMeHandCountRef = useRef(me.handCount || 0);
  useLayoutEffect(() => {
    if (isSpectator) {
      const newCount = me.handCount || 0;
      const prevCount = prevSpecMeHandCountRef.current;
      if (newCount > prevCount) {
        const hiddenIdxs = new Set();
        for (let i = prevCount; i < newCount; i++) hiddenIdxs.add(i);
        setSpecMeDrawHidden(prev => new Set([...prev, ...hiddenIdxs]));
        requestAnimationFrame(() => {
          const deckEl = document.querySelector('[data-my-deck]');
          const handCards = document.querySelectorAll('.game-hand-me .game-hand-cards .hand-card');
          const deckRect = deckEl?.getBoundingClientRect();
          if (deckRect && handCards.length > 0) {
            const newAnims = [];
            for (let i = 0; i < newCount - prevCount; i++) {
              const targetCard = handCards[handCards.length - 1 - (newCount - prevCount - 1 - i)];
              const targetRect = targetCard?.getBoundingClientRect();
              if (!targetRect) continue;
              newAnims.push({
                id: Date.now() + Math.random() + i,
                startX: deckRect.left + deckRect.width / 2 - 32,
                startY: deckRect.top + deckRect.height / 2 - 45,
                endX: targetRect.left, endY: targetRect.top,
              });
            }
            if (newAnims.length > 0) {
              setSpecMeDrawAnims(prev => [...prev, ...newAnims]);
              setTimeout(() => {
                setSpecMeDrawAnims(prev => prev.filter(a => !newAnims.some(n => n.id === a.id)));
                setSpecMeDrawHidden(prev => {
                  const next = new Set(prev);
                  hiddenIdxs.forEach(idx => next.delete(idx));
                  return next.size > 0 ? next : new Set();
                });
              }, 500);
            } else {
              setSpecMeDrawHidden(new Set());
            }
          } else {
            setSpecMeDrawHidden(new Set());
          }
        });
      }
      prevSpecMeHandCountRef.current = newCount;
      return;
    }
    const newKey = JSON.stringify(me.hand || []);
    if (newKey !== handKeyRef.current) {
      const newHand = me.hand || [];
      const prevLen = prevHandLenRef.current;
      handKeyRef.current = newKey;
      setHand(newHand);
      // Clear tooltip in case a hovered card was removed from hand
      setBoardTooltip(null);
      // Clear stale steal-hidden indices when hand state changes (sync arrived)
      if (stealHiddenMe.size > 0) setStealHiddenMe(new Set());
      // Detect newly drawn cards (added at end of hand)
      if (newHand.length > prevLen && !stealInProgressRef.current) {
        // If cards arrived via steal, skip draw animation for them
        const skipCount = stealSkipDrawRef.current;
        if (skipCount > 0) {
          stealSkipDrawRef.current = 0;
        } else {
        const deckEl = document.querySelector('[data-my-deck]');
        const deckRect = deckEl?.getBoundingClientRect();
        const potionDeckEl = document.querySelector('[data-my-potion-deck]');
        const potionRect = potionDeckEl?.getBoundingClientRect();
        if (deckRect) {
          const newAnims = [];
          for (let i = prevLen; i < newHand.length; i++) {
            const isPotion = CARDS_BY_NAME[newHand[i]]?.cardType === 'Potion';
            const srcRect = (isPotion && potionRect) ? potionRect : deckRect;
            newAnims.push({
              id: Date.now() + Math.random() + i,
              cardName: newHand[i],
              origIdx: i,
              startX: srcRect.left + srcRect.width / 2 - 32,
              startY: srcRect.top + srcRect.height / 2 - 45,
            });
          }
          setDrawAnimCards(prev => [...prev, ...newAnims]);
          setTimeout(() => {
            setDrawAnimCards(prev => prev.filter(a => !newAnims.some(n => n.id === a.id)));
          }, 500);
        }
        }
      }
      prevHandLenRef.current = newHand.length;
    }
  }, [me.hand, me.handCount]);

  // Opponent draw animation tracking
  const [oppDrawAnims, setOppDrawAnims] = useState([]);
  const [oppDrawHidden, setOppDrawHidden] = useState(new Set()); // indices to hide during anim
  const prevOppHandCountRef = useRef(opp.handCount || 0);
  useEffect(() => {
    const newCount = opp.handCount || 0;
    const prevCount = prevOppHandCountRef.current;
    if (newCount > prevCount && !stealInProgressRef.current) {
      const hiddenIdxs = new Set();
      for (let i = prevCount; i < newCount; i++) hiddenIdxs.add(i);
      setOppDrawHidden(prev => new Set([...prev, ...hiddenIdxs]));
      // Wait one frame for DOM to update with new hand cards
      requestAnimationFrame(() => {
        const deckEl = document.querySelector('[data-opp-deck]');
        const handCards = document.querySelectorAll('.game-hand-opp .game-hand-cards .hand-card');
        const deckRect = deckEl?.getBoundingClientRect();
        if (deckRect && handCards.length > 0) {
          const newAnims = [];
          const deckSearchPending = deckSearchPendingRef.current;
          for (let i = 0; i < newCount - prevCount; i++) {
            // Target the last card(s) in the hand — new cards appear at the end
            const targetCard = handCards[handCards.length - 1 - (newCount - prevCount - 1 - i)];
            const targetRect = targetCard?.getBoundingClientRect();
            if (!targetRect) continue;
            const sx = deckRect.left + deckRect.width / 2 - 32;
            const sy = deckRect.top + deckRect.height / 2 - 45;
            // If this is a deck-searched card, show face-up in the normal draw animation
            if (deckSearchPending.length > 0) {
              const searchCardName = deckSearchPending.shift();
              newAnims.push({
                id: Date.now() + Math.random() + i,
                startX: sx, startY: sy,
                endX: targetRect.left, endY: targetRect.top,
                cardName: searchCardName, // Face-up
              });
            } else {
              newAnims.push({
                id: Date.now() + Math.random() + i,
                startX: sx, startY: sy,
                endX: targetRect.left, endY: targetRect.top,
              });
            }
          }
          if (newAnims.length > 0) {
            setOppDrawAnims(prev => [...prev, ...newAnims]);
            setTimeout(() => {
              setOppDrawAnims(prev => prev.filter(a => !newAnims.some(n => n.id === a.id)));
              setOppDrawHidden(prev => {
                const next = new Set(prev);
                hiddenIdxs.forEach(idx => next.delete(idx));
                return next.size > 0 ? next : new Set();
              });
            }, 500);
          } else {
            setOppDrawHidden(prev => {
              const next = new Set(prev);
              hiddenIdxs.forEach(idx => next.delete(idx));
              return next.size > 0 ? next : new Set();
            });
          }
        } else {
          setOppDrawHidden(new Set());
        }
      });
    }
    // Clear stale steal-hidden indices when opp hand state changes (sync arrived)
    if (newCount !== prevCount && stealHiddenOpp.size > 0) setStealHiddenOpp(new Set());
    prevOppHandCountRef.current = newCount;
  }, [opp.handCount]);

  // ─── Discard/Delete animation tracking (hand-to-pile + board-to-pile, both players) ───
  const [gameAnims, setGameAnims] = useState([]); // Active particle animations (moved up for creature death access)
  const [beamAnims, setBeamAnims] = useState([]); // Beam animations (laser, etc.)
  const [ramAnims, setRamAnims] = useState([]); // Ram animations (hero charges to target and back)

  // ── Chat & Action Log state ──
  const [chatMessages, setChatMessages] = useState([]);
  const [privateChats, setPrivateChats] = useState({}); // { pairKey: [msgs] }
  const [chatView, setChatView] = useState('main'); // 'main' | 'players' | 'private:username'
  const [chatInput, setChatInput] = useState('');
  const [actionLog, setActionLog] = useState([]);
  // Clear action log when a new game starts (rematch) to prevent ID collisions
  const prevMulliganRef = useRef(false);
  useEffect(() => {
    if (gameState.mulliganPending && !prevMulliganRef.current) {
      setActionLog([]);
      setSideDeckPhase(null);
      setSideDeckDone(false);
    }
    prevMulliganRef.current = !!gameState.mulliganPending;
  }, [gameState.mulliganPending]);
  const [pingFlash, setPingFlash] = useState(null); // { color }
  const chatBodyRef = useRef(null);
  const actionLogRef = useRef(null);
  const [transferAnims, setTransferAnims] = useState([]); // Card transfer animations (Dark Gear, etc.)
  const [projectileAnims, setProjectileAnims] = useState([]); // Projectile animations (phoenix cannon, etc.)
  const [discardAnims, setDiscardAnims] = useState([]);
  const [myDiscardHidden, setMyDiscardHidden] = useState(0);
  const [oppDiscardHidden, setOppDiscardHidden] = useState(0);
  const [myDeletedHidden, setMyDeletedHidden] = useState(0);
  const [oppDeletedHidden, setOppDeletedHidden] = useState(0);
  const myHandRectsRef = useRef([]);
  const oppHandRectsRef = useRef([]);
  const boardCardRectsRef = useRef({ me: {}, opp: {} }); // cardName → [DOMRect, ...]
  const prevMyHandForDiscardRef = useRef([...(me.hand || [])]);
  const prevMyHandCountForDiscardRef = useRef(me.handCount || 0); // spectator mode
  const prevMyDiscardLenRef = useRef((me.discardPile || []).length);
  const prevMyDeletedLenRef = useRef((me.deletedPile || []).length);
  const prevOppHandCountForDiscardRef = useRef(opp.handCount || 0);
  const prevOppDiscardLenRef = useRef((opp.discardPile || []).length);
  const prevOppDeletedLenRef = useRef((opp.deletedPile || []).length);

  // Helper: build pile-target rect
  const getPileCenter = (selector) => {
    const el = document.querySelector(selector);
    const r = el?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2 - 32, y: r.top + r.height / 2 - 45 } : null;
  };

  // Helper: create anims from board rects for unmatched pile entries
  const animsFromBoard = (entries, boardRects, dest, destSelector) => {
    const target = getPileCenter(destSelector);
    if (!target) return [];
    const anims = [];
    for (const cardName of entries) {
      const positions = boardRects[cardName];
      if (!positions || positions.length === 0) continue;
      const sr = positions.shift();
      anims.push({ id: Date.now() + Math.random(), cardName, startX: sr.left, startY: sr.top, endX: target.x, endY: target.y, dest });
    }
    return anims;
  };

  // Helper: schedule anim state + pile hiding
  const scheduleAnims = (newAnims, setDiscardHidden, setDeletedHidden) => {
    if (newAnims.length === 0) return;
    const dc = newAnims.filter(a => a.dest === 'discard').length;
    const dl = newAnims.filter(a => a.dest === 'deleted').length;
    if (dc > 0) setDiscardHidden(prev => prev + dc);
    if (dl > 0) setDeletedHidden(prev => prev + dl);
    setDiscardAnims(prev => [...prev, ...newAnims]);
    setTimeout(() => {
      setDiscardAnims(prev => prev.filter(a => !newAnims.some(n => n.id === a.id)));
      if (dc > 0) setDiscardHidden(prev => Math.max(0, prev - dc));
      if (dl > 0) setDeletedHidden(prev => Math.max(0, prev - dl));
    }, 500);
  };

  // Helper: capture board card positions into boardCardRectsRef
  const captureBoardRects = () => {
    const br = { me: {}, opp: {} };
    for (const ow of ['me', 'opp']) {
      const pi = ow === 'me' ? myIdx : oppIdx;
      const p = gameState.players[pi];
      if (!p) continue;
      document.querySelectorAll(`[data-support-zone][data-support-owner="${ow}"]`).forEach(el => {
        const cards = p.supportZones?.[el.dataset.supportHero]?.[el.dataset.supportSlot] || [];
        if (cards.length > 0) { const r = el.getBoundingClientRect(); for (const cn of cards) (br[ow][cn] = br[ow][cn] || []).push(r); }
      });
      document.querySelectorAll(`[data-ability-zone][data-ability-owner="${ow}"]`).forEach(el => {
        const cards = p.abilityZones?.[el.dataset.abilityHero]?.[el.dataset.abilitySlot] || [];
        if (cards.length > 0) { const r = el.getBoundingClientRect(); for (const cn of cards) (br[ow][cn] = br[ow][cn] || []).push(r); }
      });
      document.querySelectorAll(`[data-surprise-zone][data-surprise-owner="${ow}"]`).forEach(el => {
        const cards = p.surpriseZones?.[el.dataset.surpriseHero] || [];
        if (cards.length > 0) { const r = el.getBoundingClientRect(); for (const cn of cards) (br[ow][cn] = br[ow][cn] || []).push(r); }
      });
    }
    boardCardRectsRef.current = br;
  };

  // Own discard/delete detection (useLayoutEffect prevents flash before paint)
  useLayoutEffect(() => {
    if (isSpectator) {
      // Spectator mode: use handCount-based detection (same as opponent discard)
      const newCount = me.handCount || 0;
      const prevCount = prevMyHandCountForDiscardRef.current;
      const newDiscardLen = (me.discardPile || []).length;
      const prevDiscardLen = prevMyDiscardLenRef.current;
      const newDeletedLen = (me.deletedPile || []).length;
      const prevDeletedLen = prevMyDeletedLenRef.current;
      const discardGrew = newDiscardLen > prevDiscardLen;
      const deletedGrew = newDeletedLen > prevDeletedLen;

      if (discardGrew || deletedGrew) {
        const newDiscardEntries = discardGrew ? [...me.discardPile.slice(prevDiscardLen)] : [];
        const newDeletedEntries = deletedGrew ? [...me.deletedPile.slice(prevDeletedLen)] : [];
        const newAnims = [];

        // 1. Match against hand removals (hand count decreased)
        if (newCount < prevCount) {
          const storedRects = myHandRectsRef.current;
          let handSlotCursor = prevCount - 1;
          const handDiscardCount = Math.min(prevCount - newCount, newDiscardEntries.length);
          for (let i = 0; i < handDiscardCount; i++) {
            const sr = storedRects[Math.max(0, Math.min(handSlotCursor--, storedRects.length - 1))];
            if (!sr) continue;
            const cardName = newDiscardEntries.shift();
            const t = getPileCenter('[data-my-discard]');
            if (t) newAnims.push({ id: Date.now() + Math.random() + i, cardName, startX: sr.left, startY: sr.top, endX: t.x, endY: t.y, dest: 'discard' });
          }
          const handDeletedCount = Math.min(Math.max(0, (prevCount - newCount) - handDiscardCount), newDeletedEntries.length);
          for (let i = 0; i < handDeletedCount; i++) {
            const sr = storedRects[Math.max(0, Math.min(handSlotCursor--, storedRects.length - 1))];
            if (!sr) continue;
            const cardName = newDeletedEntries.shift();
            const t = getPileCenter('[data-my-deleted]');
            if (t) newAnims.push({ id: Date.now() + Math.random() + 0.5 + i, cardName, startX: sr.left, startY: sr.top, endX: t.x, endY: t.y, dest: 'deleted' });
          }
        }

        // 2. Remaining entries from board
        const br = boardCardRectsRef.current.me || {};
        const boardAnims = [...animsFromBoard(newDiscardEntries, br, 'discard', '[data-my-discard]'), ...animsFromBoard(newDeletedEntries, br, 'deleted', '[data-my-deleted]')];
        newAnims.push(...boardAnims);
        for (const a of boardAnims) {
          const card = CARDS_BY_NAME[a.cardName];
          if (card?.cardType === 'Creature') {
            const id = Date.now() + Math.random();
            setGameAnims(prev => [...prev, { id, type: 'creature_death', x: a.startX + 32, y: a.startY + 45 }]);
            setTimeout(() => setGameAnims(prev => prev.filter(g => g.id !== id)), 1200);
          }
        }
        scheduleAnims(newAnims, setMyDiscardHidden, setMyDeletedHidden);
      }

      // Spectator: Mulligan / hand-return-to-deck (hand count shrinks but no pile grows)
      if (!discardGrew && !deletedGrew && newCount < prevCount && (gameState.mulliganPending || gameState.handReturnToDeck)) {
        const storedRects = myHandRectsRef.current;
        const deckEl = document.querySelector('[data-my-deck]');
        const deckR = deckEl?.getBoundingClientRect();
        const deckTarget = deckR ? { x: deckR.left + deckR.width / 2 - 32, y: deckR.top + deckR.height / 2 - 45 } : null;
        if (deckTarget) {
          const returnAnims = [];
          for (let i = 0; i < prevCount - newCount; i++) {
            const sr = storedRects[Math.max(0, prevCount - 1 - i)];
            if (!sr) continue;
            returnAnims.push({ id: Date.now() + Math.random() + i, cardName: '', startX: sr.left, startY: sr.top, endX: deckTarget.x, endY: deckTarget.y, dest: 'deck' });
          }
          if (returnAnims.length > 0) {
            setDiscardAnims(prev => [...prev, ...returnAnims]);
            setTimeout(() => setDiscardAnims(prev => prev.filter(a => !returnAnims.some(n => n.id === a.id))), 500);
          }
        }
      }

      // Capture positions for NEXT cycle (spectator uses face-down .hand-card)
      requestAnimationFrame(() => {
        const rects = [];
        document.querySelectorAll('.game-hand-me .hand-card').forEach((el, i) => { rects[i] = el.getBoundingClientRect(); });
        myHandRectsRef.current = rects;
        captureBoardRects();
      });

      prevMyHandCountForDiscardRef.current = newCount;
      prevMyDiscardLenRef.current = newDiscardLen;
      prevMyDeletedLenRef.current = newDeletedLen;
      return;
    }

    const newHand = me.hand || [];
    const prevHand = prevMyHandForDiscardRef.current;
    const newDiscardLen = (me.discardPile || []).length;
    const prevDiscardLen = prevMyDiscardLenRef.current;
    const newDeletedLen = (me.deletedPile || []).length;
    const prevDeletedLen = prevMyDeletedLenRef.current;
    const discardGrew = newDiscardLen > prevDiscardLen;
    const deletedGrew = newDeletedLen > prevDeletedLen;

    if (discardGrew || deletedGrew) {
      const newDiscardEntries = discardGrew ? [...me.discardPile.slice(prevDiscardLen)] : [];
      const newDeletedEntries = deletedGrew ? [...me.deletedPile.slice(prevDeletedLen)] : [];
      const newAnims = [];

      // 1. Match against hand removals
      if (newHand.length < prevHand.length) {
        // Sequential subsequence match: newHand is a subsequence of prevHand
        // (splice preserves relative order), so a forward scan correctly
        // identifies which exact positions were removed — even for duplicates.
        const removed = [];
        let ni = 0;
        for (let i = 0; i < prevHand.length; i++) {
          if (ni < newHand.length && prevHand[i] === newHand[ni]) {
            ni++;
          } else {
            removed.push({ cardName: prevHand[i], handIdx: i });
          }
        }
        const storedRects = myHandRectsRef.current;
        for (const r of removed) {
          const sr = storedRects[r.handIdx];
          if (!sr) continue;
          let idx = newDiscardEntries.indexOf(r.cardName);
          if (idx >= 0) {
            newDiscardEntries.splice(idx, 1);
            const t = getPileCenter('[data-my-discard]');
            if (t) newAnims.push({ id: Date.now() + Math.random(), cardName: r.cardName, startX: sr.left, startY: sr.top, endX: t.x, endY: t.y, dest: 'discard' });
            continue;
          }
          idx = newDeletedEntries.indexOf(r.cardName);
          if (idx >= 0) {
            newDeletedEntries.splice(idx, 1);
            const t = getPileCenter('[data-my-deleted]');
            if (t) newAnims.push({ id: Date.now() + Math.random(), cardName: r.cardName, startX: sr.left, startY: sr.top, endX: t.x, endY: t.y, dest: 'deleted' });
          }
        }
      }

      // 2. Remaining entries came from the board — use stored board positions
      const br = boardCardRectsRef.current.me || {};
      const boardAnims = [...animsFromBoard(newDiscardEntries, br, 'discard', '[data-my-discard]'), ...animsFromBoard(newDeletedEntries, br, 'deleted', '[data-my-deleted]')];
      newAnims.push(...boardAnims);

      // Trigger creature death effect for board-sourced creatures
      for (const a of boardAnims) {
        const card = CARDS_BY_NAME[a.cardName];
        if (card?.cardType === 'Creature') {
          const id = Date.now() + Math.random();
          setGameAnims(prev => [...prev, { id, type: 'creature_death', x: a.startX + 32, y: a.startY + 45 }]);
          setTimeout(() => setGameAnims(prev => prev.filter(g => g.id !== id)), 1200);
        }
      }

      scheduleAnims(newAnims, setMyDiscardHidden, setMyDeletedHidden);
    }

    // Mulligan / hand-return-to-deck: cards returning to deck (hand shrinks but no pile grows)
    if (!discardGrew && !deletedGrew && newHand.length < prevHand.length && (gameState.mulliganPending || gameState.handReturnToDeck)) {
      const removed = [];
      let ni = 0;
      for (let i = 0; i < prevHand.length; i++) {
        if (ni < newHand.length && prevHand[i] === newHand[ni]) { ni++; }
        else { removed.push({ cardName: prevHand[i], handIdx: i }); }
      }
      const storedRects = myHandRectsRef.current;
      const deckEl = document.querySelector('[data-my-deck]');
      const deckR = deckEl?.getBoundingClientRect();
      const deckTarget = deckR ? { x: deckR.left + deckR.width / 2 - 32, y: deckR.top + deckR.height / 2 - 45 } : null;
      const potionDeckEl = document.querySelector('[data-my-potion-deck]');
      const potionR = potionDeckEl?.getBoundingClientRect();
      const potionTarget = potionR ? { x: potionR.left + potionR.width / 2 - 32, y: potionR.top + potionR.height / 2 - 45 } : null;
      const returnAnims = [];
      for (const r of removed) {
        const sr = storedRects[r.handIdx];
        if (!sr) continue;
        const isPotion = CARDS_BY_NAME[r.cardName]?.cardType === 'Potion';
        const target = (isPotion && potionTarget) ? potionTarget : deckTarget;
        if (!target) continue;
        returnAnims.push({ id: Date.now() + Math.random(), cardName: r.cardName, startX: sr.left, startY: sr.top, endX: target.x, endY: target.y, dest: isPotion ? 'potion' : 'deck' });
      }
      if (returnAnims.length > 0) {
        setDiscardAnims(prev => [...prev, ...returnAnims]);
        setTimeout(() => setDiscardAnims(prev => prev.filter(a => !returnAnims.some(n => n.id === a.id))), 500);
      }
    }

    // Capture positions for NEXT cycle
    requestAnimationFrame(() => {
      const rects = [];
      document.querySelectorAll('.game-hand-me .hand-slot').forEach((el, i) => { rects[i] = el.getBoundingClientRect(); });
      myHandRectsRef.current = rects;
      captureBoardRects();
    });

    prevMyHandForDiscardRef.current = [...newHand];
    prevMyDiscardLenRef.current = newDiscardLen;
    prevMyDeletedLenRef.current = newDeletedLen;
  }, [me.hand, me.handCount, me.discardPile, me.deletedPile]);

  // Opponent discard/delete detection (useLayoutEffect prevents flash before paint)
  useLayoutEffect(() => {
    const newCount = opp.handCount || 0;
    const prevCount = prevOppHandCountForDiscardRef.current;
    const newDiscardLen = (opp.discardPile || []).length;
    const prevDiscardLen = prevOppDiscardLenRef.current;
    const newDeletedLen = (opp.deletedPile || []).length;
    const prevDeletedLen = prevOppDeletedLenRef.current;
    const discardGrew = newDiscardLen > prevDiscardLen;
    const deletedGrew = newDeletedLen > prevDeletedLen;

    if (discardGrew || deletedGrew) {
      const newDiscardEntries = discardGrew ? [...opp.discardPile.slice(prevDiscardLen)] : [];
      const newDeletedEntries = deletedGrew ? [...opp.deletedPile.slice(prevDeletedLen)] : [];
      const newAnims = [];

      // 1. Match against hand removals (hand count decreased)
      if (newCount < prevCount) {
        const storedRects = oppHandRectsRef.current;
        let handSlotCursor = prevCount - 1;
        const handDiscardCount = Math.min(prevCount - newCount, newDiscardEntries.length);
        for (let i = 0; i < handDiscardCount; i++) {
          const sr = storedRects[Math.max(0, Math.min(handSlotCursor--, storedRects.length - 1))];
          if (!sr) continue;
          const cardName = newDiscardEntries.shift();
          const t = getPileCenter('[data-opp-discard]');
          if (t) newAnims.push({ id: Date.now() + Math.random() + i, cardName, startX: sr.left, startY: sr.top, endX: t.x, endY: t.y, dest: 'discard' });
        }
        const handDeletedCount = Math.min(Math.max(0, (prevCount - newCount) - handDiscardCount), newDeletedEntries.length);
        for (let i = 0; i < handDeletedCount; i++) {
          const sr = storedRects[Math.max(0, Math.min(handSlotCursor--, storedRects.length - 1))];
          if (!sr) continue;
          const cardName = newDeletedEntries.shift();
          const t = getPileCenter('[data-opp-deleted]');
          if (t) newAnims.push({ id: Date.now() + Math.random() + 0.5 + i, cardName, startX: sr.left, startY: sr.top, endX: t.x, endY: t.y, dest: 'deleted' });
        }
      }

      // 2. Remaining entries came from the opponent's board
      const br = boardCardRectsRef.current.opp || {};
      const boardAnims = [...animsFromBoard(newDiscardEntries, br, 'discard', '[data-opp-discard]'), ...animsFromBoard(newDeletedEntries, br, 'deleted', '[data-opp-deleted]')];
      newAnims.push(...boardAnims);

      // Trigger creature death effect for board-sourced creatures
      for (const a of boardAnims) {
        const card = CARDS_BY_NAME[a.cardName];
        if (card?.cardType === 'Creature') {
          const id = Date.now() + Math.random();
          setGameAnims(prev => [...prev, { id, type: 'creature_death', x: a.startX + 32, y: a.startY + 45 }]);
          setTimeout(() => setGameAnims(prev => prev.filter(g => g.id !== id)), 1200);
        }
      }

      scheduleAnims(newAnims, setOppDiscardHidden, setOppDeletedHidden);
    }

    // Opponent mulligan / hand-return-to-deck: cards returning to deck (hand count shrinks but no pile grows)
    if (!discardGrew && !deletedGrew && newCount < prevCount && (gameState.mulliganPending || gameState.handReturnToDeck)) {
      const storedRects = oppHandRectsRef.current;
      const deckEl = document.querySelector('[data-opp-deck]');
      const deckR = deckEl?.getBoundingClientRect();
      const deckTarget = deckR ? { x: deckR.left + deckR.width / 2 - 32, y: deckR.top + deckR.height / 2 - 45 } : null;
      if (deckTarget) {
        const returnAnims = [];
        for (let i = 0; i < prevCount - newCount; i++) {
          const sr = storedRects[Math.max(0, prevCount - 1 - i)];
          if (!sr) continue;
          returnAnims.push({ id: Date.now() + Math.random() + i, cardName: '', startX: sr.left, startY: sr.top, endX: deckTarget.x, endY: deckTarget.y, dest: 'deck' });
        }
        if (returnAnims.length > 0) {
          setDiscardAnims(prev => [...prev, ...returnAnims]);
          setTimeout(() => setDiscardAnims(prev => prev.filter(a => !returnAnims.some(n => n.id === a.id))), 500);
        }
      }
    }

    // Capture positions for NEXT cycle
    requestAnimationFrame(() => {
      const rects = [];
      document.querySelectorAll('.game-hand-opp .hand-card').forEach((el, i) => { rects[i] = el.getBoundingClientRect(); });
      oppHandRectsRef.current = rects;
      captureBoardRects();
    });

    prevOppHandCountForDiscardRef.current = newCount;
    prevOppDiscardLenRef.current = newDiscardLen;
    prevOppDeletedLenRef.current = newDeletedLen;
  }, [opp.handCount, opp.discardPile, opp.deletedPile]);

  // Phase helpers
  const currentPhase = gameState.currentPhase || 0;
  const activePlayer = gameState.activePlayer || 0;
  const isMyTurn = !isSpectator && activePlayer === myIdx;
  const activePlayerData = gameState.players[activePlayer];
  const phaseColor = activePlayerData?.color || 'var(--accent)';

  // Card graying logic based on phase
  const ACTION_TYPES = ['Attack', 'Spell', 'Creature'];

  // Check if a creature can be played on ANY hero (level/spell school reqs + free zone)
  const canCreatureBePlayed = (card) => {
    if (!card || card.cardType !== 'Creature') return false;
    // heroPlayableCards already includes free support zone check for creatures
    return [0,1,2].some(hi => canHeroPlayCard(me, hi, card));
  };

  // Check if a Spell or Attack can be used by ANY hero (level/spell school reqs, no zone needed)
  const canActionCardBePlayed = (card) => {
    if (!card) return false;
    if (card.cardType === 'Creature') return canCreatureBePlayed(card);
    // Spells and Attacks: just need a hero that meets spell school requirements
    if ([0,1,2].some(hi => canHeroPlayCard(me, hi, card))) return true;
    // Also check charmed opponent heroes
    for (let hi = 0; hi < (opp.heroes || []).length; hi++) {
      if (opp.heroes[hi]?.charmedBy === myIdx && canHeroPlayCard(opp, hi, card)) return true;
    }
    return false;
  };

  const getCardDimmed = (cardName, handIdx) => {
    if (gameState.awaitingFirstChoice) return false; // Let player see hand clearly
    if (gameState.mulliganPending) return false; // Let player see hand during mulligan
    if (gameState.potionTargeting) return true; // All cards dimmed during targeting

    // The specific resolving card instance is always dimmed (non-interactive)
    if (handIdx != null && resolvingHandIndex >= 0 && resolvingHandIndex === handIdx) return true;

    // Hero Action mode (Coffee) — only eligible cards are playable
    const heroActionPrompt = gameState.effectPrompt?.type === 'heroAction' && gameState.effectPrompt.ownerIdx === myIdx ? gameState.effectPrompt : null;
    if (heroActionPrompt) {
      return !(heroActionPrompt.eligibleCards || []).includes(cardName);
    }

    // Force Discard mode (Wheels) — all cards are selectable
    const forceDiscardPrompt = gameState.effectPrompt?.type === 'forceDiscard' && gameState.effectPrompt.ownerIdx === myIdx;
    if (forceDiscardPrompt) return false;

    // Cancellable Force Discard mode (Training, etc.) — all cards are selectable
    const forceDiscardCancellable = gameState.effectPrompt?.type === 'forceDiscardCancellable' && gameState.effectPrompt.ownerIdx === myIdx;
    if (forceDiscardCancellable) return false;

    // Hand Pick mode (Shard of Chaos) — dim ineligible cards
    const handPickActive = gameState.effectPrompt?.type === 'handPick' && gameState.effectPrompt.ownerIdx === myIdx;
    if (handPickActive) {
      const eligible = gameState.effectPrompt.eligibleIndices || [];
      return !eligible.includes(handIdx);
    }

    // Ability Attach mode (Training, etc.) — only eligible abilities are visible
    const abilityAttachPrompt = gameState.effectPrompt?.type === 'abilityAttach' && gameState.effectPrompt.ownerIdx === myIdx;
    if (abilityAttachPrompt) {
      return !(gameState.effectPrompt.eligibleCards || []).includes(cardName);
    }

    if (!isMyTurn) return true;
    const card = CARDS_BY_NAME[cardName];
    if (!card) return false;

    // Hand-lock: dim non-Ability cards that are blocked by handLock
    if (me.handLocked && card.cardType !== 'Ability' && (me.handLockBlockedCards || []).includes(cardName)) return true;

    // Divine Gift of Creation lock: dim cards with locked names
    if ((me.creationLockedNames || []).includes(cardName)) return true;

    const isActionType = ACTION_TYPES.includes(card.cardType);
    const isSurprise = (card.subtype || '').toLowerCase() === 'surprise';
    if (currentPhase === 2 || currentPhase === 4) {
      // Surprise cards: playable if any hero has an empty surprise zone
      if (isSurprise) {
        const canSetSurprise = [0,1,2].some(hi => {
          const hero = me.heroes[hi];
          if (!hero || !hero.name || hero.hp <= 0) return false;
          return ((me.surpriseZones || [])[hi] || []).length === 0;
        });
        // Also check Bakhm support zones for Surprise Creatures
        const canSetBakhm = card.cardType === 'Creature' && (gameState.bakhmSurpriseSlots || []).some(b => b.freeSlots.length > 0);
        if (canSetSurprise || canSetBakhm) return false; // Un-gray: can be set face-down
        // Surprise can also be played normally if it has additional action coverage — fall through
      }
      // Main Phase 1 or 2: gray out action types UNLESS they have Additional Action coverage
      if (isActionType) {
        // Check if this is an inherent action (playable without additional action provider)
        const isInherent = (gameState.inherentActionCards || []).includes(cardName);
        // Check if any Additional Action covers this card
        const additionalActions = gameState.additionalActions || [];
        const hasAdditional = additionalActions.some(aa => aa.eligibleHandCards.includes(cardName));
        if (!hasAdditional && !isInherent) return true;
        // Has additional action — check summonLocked for creatures
        if (card.cardType === 'Creature' && me.summonLocked) return true;
        // Check if the card can actually be played on any hero
        if (!canActionCardBePlayed(card)) return true;
        // Check blockedSpells even for inherent/additional action cards
        if ((gameState.blockedSpells || []).includes(cardName)) return true;
        return false; // Un-gray: playable via Additional Action
      }
      // Gray out Abilities that can't be played on any hero
      if (card.cardType === 'Ability') {
        const canPlaySomewhere = [0,1,2].some(hi => canHeroReceiveAbility(me, hi, cardName));
        if (!canPlaySomewhere) return true;
      }
      // Gray out Artifacts if not enough gold or item-locked
      if (card.cardType === 'Artifact') {
        if (me.itemLocked) return true;
        if ((me.gold || 0) < (card.cost || 0)) return true;
        // Once-per-game artifacts (Smug Coin, etc.)
        if ((me.oncePerGameUsed || []).includes(cardName)) return true;
        // Gray out Equip artifacts if no hero has a free base support zone
        const isEquip = (card.subtype || '').toLowerCase() === 'equipment';
        if (isEquip) {
          const hasTarget = [0,1,2].some(hi => {
            const hero = me.heroes[hi];
            if (!hero || !hero.name || hero.hp <= 0) return false;
            if (hero.statuses?.frozen) return false; // Can't equip to frozen heroes
            const supZones = me.supportZones[hi] || [];
            for (let z = 0; z < 3; z++) { if ((supZones[z] || []).length === 0) return true; }
            return false;
          });
          if (!hasTarget) return true;
        }
        // Gray out targeting artifacts/potions with no valid targets
        if ((gameState.unactivatableArtifacts || []).includes(cardName)) return true;
      }
      // Gray out Potions with no valid targets or when locked
      if (card.cardType === 'Potion') {
        if (me.potionLocked) return true;
        if ((gameState.unactivatableArtifacts || []).includes(cardName)) return true;
      }
      // Gray out spells/attacks with custom play conditions that aren't met (Flame Avalanche, etc.)
      if ((gameState.blockedSpells || []).includes(cardName)) return true;
      // Gray out Ascended Heroes if no eligible base hero exists
      if (card.cardType === 'Ascended Hero') {
        const hasEligible = (me.heroes || []).some(h => h?.name && h.hp > 0 && h.ascensionReady && h.ascensionTarget === cardName);
        return !hasEligible;
      }
      return false;
    } else if (currentPhase === 3) {
      // Action Phase: gray out non-action types, and check playability
      if (!isActionType) return true;
      if (card.cardType === 'Creature' && (gameState.summonBlocked || []).includes(cardName)) return true;
      if (card.cardType === 'Creature' && me.summonLocked) return true;
      if ((gameState.blockedSpells || []).includes(cardName)) return true;
      if (!canActionCardBePlayed(card)) return true;
      return false;
    }
    return true; // Start, Resource, End phases: all dimmed
  };

  // Mouse-based drag state (reorder)
  const [handDrag, setHandDrag] = useState(null);
  const handRef = useRef(null);
  const handAnimDataRef = useRef(null); // FLIP animation data: { oldRects[], indexMap[] }

  // ── Hand Shuffle & Sort with FLIP animation ──
  const captureHandRects = () => {
    const slots = handRef.current?.querySelectorAll('.hand-slot');
    if (!slots) return [];
    const rects = [];
    slots.forEach((el, i) => rects[i] = el.getBoundingClientRect());
    return rects;
  };

  const shuffleHand = () => {
    if (hand.length <= 1) return;
    const oldRects = captureHandRects();
    const indices = hand.map((_, i) => i);
    // Fisher-Yates shuffle on indices
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    const newHand = indices.map(i => hand[i]);
    // indexMap[newIdx] = oldIdx
    handAnimDataRef.current = { oldRects, indexMap: indices };
    setHand(newHand);
    socket.emit('reorder_hand', { roomId: gameState.roomId, hand: newHand });
  };

  const sortHand = () => {
    if (hand.length <= 1) return;
    const oldRects = captureHandRects();
    const TYPE_ORDER = { Hero: 0, Creature: 1, Ability: 2, Spell: 3, Attack: 4, Artifact: 5, Potion: 6 };
    // Build indexed entries for stable sort
    const entries = hand.map((card, i) => ({ card, oldIdx: i }));
    entries.sort((a, b) => {
      const ca = CARDS_BY_NAME[a.card], cb = CARDS_BY_NAME[b.card];
      const ta = TYPE_ORDER[ca?.cardType] ?? 99, tb = TYPE_ORDER[cb?.cardType] ?? 99;
      if (ta !== tb) return ta - tb;
      return a.card.localeCompare(b.card);
    });
    const newHand = entries.map(e => e.card);
    const indexMap = entries.map(e => e.oldIdx); // indexMap[newIdx] = oldIdx
    handAnimDataRef.current = { oldRects, indexMap };
    setHand(newHand);
    socket.emit('reorder_hand', { roomId: gameState.roomId, hand: newHand });
  };

  // FLIP animation effect — runs after React re-renders the hand
  useLayoutEffect(() => {
    if (!handAnimDataRef.current) return;
    const { oldRects, indexMap } = handAnimDataRef.current;
    handAnimDataRef.current = null;
    const slots = handRef.current?.querySelectorAll('.hand-slot');
    if (!slots || slots.length === 0) return;
    slots.forEach((el, newIdx) => {
      const oldIdx = indexMap[newIdx];
      if (oldIdx === undefined || !oldRects[oldIdx]) return;
      const newRect = el.getBoundingClientRect();
      const dx = oldRects[oldIdx].left - newRect.left;
      if (Math.abs(dx) < 1) return;
      el.style.transition = 'none';
      el.style.transform = `translateX(${dx}px)`;
    });
    // Force reflow, then animate to final positions
    void handRef.current?.offsetHeight;
    slots.forEach((el) => {
      if (!el.style.transform || el.style.transform === 'none') return;
      el.style.transition = 'transform 0.3s ease-out';
      el.style.transform = '';
    });
    // Clean up transition after animation
    const cleanup = () => {
      slots.forEach(el => { el.style.transition = ''; });
    };
    setTimeout(cleanup, 350);
  }, [hand]);

  // Play-mode drag state (Action Phase — dragging to board)
  const [playDrag, setPlayDrag] = useState(null);

  // Ability drag state (Main Phases — dragging ability to hero/zone)
  const [abilityDrag, setAbilityDrag] = useState(null); // { idx, cardName, card, mouseX, mouseY, targetHero, targetZone }

  // Surprise drag state (Main Phases — dragging Surprise card to hero's surprise zone)
  // surpriseDrag merged into playDrag (with isSurprise: true flag)

  // Additional Action provider selection state
  const [pendingAdditionalPlay, setPendingAdditionalPlay] = useState(null); // { cardName, handIndex, heroIdx, zoneSlot, providers: [{cardId, cardName, heroIdx, zoneSlot}] }
  const [pendingAbilityActivation, setPendingAbilityActivation] = useState(null); // { heroIdx, zoneIdx, abilityName, level }
  const [spellHeroPick, setSpellHeroPick] = useState(null); // { cardName, handIndex, card, eligible, isHeroAction }
  // Clear spell hero pick when game state changes
  useEffect(() => { setSpellHeroPick(null); }, [gameState.activePlayer, gameState.currentPhase, gameState.effectPrompt, gameState.turn]);

  // Check if a hero can receive a specific ability
  const canHeroReceiveAbility = (playerData, heroIdx, abilityName) => {
    const hero = playerData.heroes[heroIdx];
    if (!hero || !hero.name || hero.hp <= 0) return false;
    if ((playerData.abilityGivenThisTurn || [])[heroIdx]) return false;
    const abZones = playerData.abilityZones[heroIdx] || [[], [], []];
    const isCustom = (gameState.customPlacementCards || []).includes(abilityName);

    if (isCustom) {
      // Custom placement (e.g. Performance): needs any occupied zone with <3 cards
      return abZones.some(slot => (slot || []).length > 0 && (slot || []).length < 3);
    }

    // Standard: check if hero already has this ability
    for (const slot of abZones) {
      if ((slot || []).length > 0 && slot[0] === abilityName) {
        return slot.length < 3;
      }
    }
    // Doesn't have it — needs a free zone
    return abZones.some(slot => (slot || []).length === 0);
  };

  // Check if a hero can play a card (server-driven constraint check + client-side phase checks)
  const canHeroPlayCard = (playerData, heroIdx, card) => {
    // ── Server-driven hero constraint check ──
    // heroPlayableCards covers: alive, frozen/stunned, combo lock, action limit,
    // level/school (with all overrides), hero script restrictions (Ghuanjun, etc.),
    // equip restrictions, and creature support zone availability.
    const isOwn = playerData === me;
    const playableMap = isOwn
      ? (gameState.heroPlayableCards?.own || {})
      : (gameState.heroPlayableCards?.charmed || {});
    const playableList = playableMap[heroIdx] || [];
    if (!playableList.includes(card.name)) return false;

    // ── Phase-related checks (client-side, driven by other server-computed fields) ──

    // Action Phase: after normal action used, all plays need an additional action provider
    if (currentPhase === 3 && isOwn && (playerData.heroesActedThisTurn?.length > 0)) {
      const isActionType = ACTION_TYPES.includes(card.cardType);
      if (isActionType) {
        const categoryMap = { Creature: 'creature', Spell: 'spell', Attack: 'attack' };
        const cardCategory = categoryMap[card.cardType];
        const additionalForCard = (gameState.additionalActions || []).filter(aa =>
          aa.eligibleHandCards.includes(card.name) ||
          (aa.allowedCategories?.includes(cardCategory))
        );
        if (additionalForCard.length === 0) return false;
        if (additionalForCard.every(aa => aa.heroRestricted)) {
          const heroHasProvider = additionalForCard.some(aa => aa.providers.some(p => p.heroIdx === heroIdx));
          if (!heroHasProvider) return false;
        }
      }
    }

    // Main Phase: per-hero inherent action restrictions (Muscle Training, etc.)
    if ((currentPhase === 2 || currentPhase === 4) && isOwn) {
      const inherentHeroes = gameState.inherentActionHeroes?.[card.name];
      if (inherentHeroes !== undefined) {
        const hasAdditional = (gameState.additionalActions || []).some(aa => {
          if (!aa.eligibleHandCards.includes(card.name)) return false;
          if (aa.heroRestricted) return aa.providers.some(p => p.heroIdx === heroIdx);
          return true;
        });
        if (!hasAdditional && !inherentHeroes.includes(heroIdx)) return false;
      }
    }

    // Bonus actions: only allowed card types during active bonus
    if (isOwn && playerData.bonusActions?.heroIdx === heroIdx && playerData.bonusActions.remaining > 0) {
      const allowed = playerData.bonusActions.allowedTypes || [];
      if (allowed.length > 0 && !allowed.includes(card.cardType)) return false;
    }

    return true;
  };

  // Find free support zone slot for a hero
  const findFreeSupportSlot = (playerData, heroIdx) => {
    const supZones = playerData.supportZones[heroIdx] || [[], [], []];
    for (let s = 0; s < supZones.length; s++) {
      if (!supZones[s] || supZones[s].length === 0) return s;
    }
    return -1;
  };

  // Game start announcement + turn change announcements
  const [announcement, setAnnouncement] = useState(() => {
    if (gameState.reconnected || gameState.awaitingFirstChoice) return null;
    if (isSpectator) {
      const firstPlayer = gameState.players[gameState.activePlayer || 0];
      return { text: `${firstPlayer?.username || 'Player'} goes first!`, color: 'var(--accent)' };
    }
    const goesFirst = (gameState.activePlayer || 0) === myIdx;
    return { text: goesFirst ? 'YOU GO FIRST!' : 'YOU GO SECOND!', color: goesFirst ? 'var(--success)' : 'var(--accent)' };
  });
  const prevTurnRef = useRef(gameState.turn);
  useEffect(() => {
    if (announcement) {
      const duration = announcement.short ? 2000 : 3500;
      const t = setTimeout(() => setAnnouncement(null), duration);
      return () => clearTimeout(t);
    }
  }, [announcement]);
  // Detect turn changes — but not during awaitingFirstChoice
  useEffect(() => {
    if (gameState.awaitingFirstChoice) { prevTurnRef.current = gameState.turn; return; }
    if (gameState.turn !== prevTurnRef.current) {
      prevTurnRef.current = gameState.turn;
      if (isSpectator) {
        const ap = gameState.players[gameState.activePlayer || 0];
        setAnnouncement({ text: `${ap?.username || 'Player'}'s turn!`, color: 'var(--accent)', short: true });
      } else if ((gameState.activePlayer || 0) === myIdx) {
        setAnnouncement({ text: 'YOUR TURN!', color: 'var(--success)', short: true });
      }
    }
  }, [gameState.turn, gameState.awaitingFirstChoice]);

  // Clear Divine Rain overlay when the turn changes
  useEffect(() => {
    const overlay = document.getElementById('divine-rain-overlay');
    if (overlay && overlay.dataset.rainTurn !== String(gameState.turn)) {
      overlay.style.transition = 'opacity 1s';
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 1100);
    }
  }, [gameState.turn]);

  const [mulliganDecided, setMulliganDecided] = useState(false);
  // Reset mulligan state when a new game starts
  useEffect(() => {
    if (!gameState.mulliganPending) setMulliganDecided(false);
  }, [gameState.mulliganPending]);

  // Reset SC earned display when a new round starts (result clears)
  useEffect(() => {
    if (!gameState.result) setScEarned(null);
  }, [gameState.result]);

  const onHandMouseDown = (e, idx) => {
    if (e.type === 'mousedown' && e.button !== 0) return;
    if (isSpectator) return; // Spectators can't interact with cards
    const cardName = hand[idx];
    const dimmed = getCardDimmed(cardName, idx);

    // Force Discard mode — any card in hand can be discarded EXCEPT the specific resolving card
    const forceDiscardActive = gameState.effectPrompt?.type === 'forceDiscard' && gameState.effectPrompt.ownerIdx === myIdx;
    if (forceDiscardActive) {
      if (resolvingHandIndex >= 0 && resolvingHandIndex === idx) return; // Can't discard the resolving card
      if (e.cancelable) e.preventDefault();
      socket.emit('effect_prompt_response', { roomId: gameState.roomId, response: { cardName, handIndex: idx } });
      return;
    }

    // Cancellable Force Discard mode (Training, etc.) — clicking a card discards it
    const forceDiscardCancellableActive = gameState.effectPrompt?.type === 'forceDiscardCancellable' && gameState.effectPrompt.ownerIdx === myIdx;
    if (forceDiscardCancellableActive) {
      if (resolvingHandIndex >= 0 && resolvingHandIndex === idx) return; // Can't discard the resolving card
      if (e.cancelable) e.preventDefault();
      socket.emit('effect_prompt_response', { roomId: gameState.roomId, response: { cardName, handIndex: idx } });
      return;
    }

    // Hand Pick mode (Shard of Chaos) — toggle card selection
    const handPickPrompt = gameState.effectPrompt?.type === 'handPick' && gameState.effectPrompt.ownerIdx === myIdx;
    if (handPickPrompt) {
      const eligible = gameState.effectPrompt.eligibleIndices || [];
      if (!eligible.includes(idx)) return;
      if (e.cancelable) e.preventDefault();
      setHandPickSelected(prev => {
        const next = new Set(prev);
        if (next.has(idx)) {
          next.delete(idx);
        } else {
          const maxSelect = gameState.effectPrompt.maxSelect || 3;
          if (next.size >= maxSelect) return prev;
          // Check per-type limit
          const cardTypes = gameState.effectPrompt.cardTypes || {};
          const typeLimits = gameState.effectPrompt.typeLimits || {};
          const thisType = cardTypes[idx];
          if (thisType && typeLimits[thisType] !== undefined) {
            let selectedOfType = 0;
            for (const si of next) {
              if (cardTypes[si] === thisType) selectedOfType++;
            }
            if (selectedOfType >= typeLimits[thisType]) return prev; // Type quota full
          }
          next.add(idx);
        }
        return next;
      });
      return;
    }

    // Block hand play while any dialog/submenu is open
    if (showSurrender || showEndTurnConfirm || spellHeroPick) return;
    if (gameState.surprisePending) return; // Lock hand during surprise prompts for both players
    const activePrompt = gameState.effectPrompt;
    if (activePrompt && activePrompt.ownerIdx === myIdx
        && !['forceDiscard','forceDiscardCancellable','handPick','abilityAttach','heroAction'].includes(activePrompt.type)) return;

    // Block activation of the specific resolving card (spam-click prevention) — but NOT force-discard (handled above)
    if (resolvingHandIndex >= 0 && resolvingHandIndex === idx) return;

    if (e.cancelable) e.preventDefault();
    const card = CARDS_BY_NAME[cardName];

    // Ability Attach mode (Training, etc.) — only eligible ability cards are draggable
    const abilityAttachPrompt = gameState.effectPrompt?.type === 'abilityAttach' && gameState.effectPrompt.ownerIdx === myIdx ? gameState.effectPrompt : null;
    const isAbilityAttachEligible = abilityAttachPrompt && (abilityAttachPrompt.eligibleCards || []).includes(cardName);

    const heroActionPrompt = gameState.effectPrompt?.type === 'heroAction' && gameState.effectPrompt.ownerIdx === myIdx ? gameState.effectPrompt : null;
    const isHeroAction = !dimmed && heroActionPrompt && (heroActionPrompt.eligibleCards || []).includes(cardName);
    const isPlayable = !dimmed && (isHeroAction || (isMyTurn && card && ACTION_TYPES.includes(card.cardType)
      && !(card.cardType === 'Creature' && (gameState.summonBlocked || []).includes(cardName))
      && (currentPhase === 3 || ((currentPhase === 2 || currentPhase === 4) && ((gameState.additionalActions || []).some(aa => aa.eligibleHandCards.includes(cardName)) || (gameState.inherentActionCards || []).includes(cardName))))));
    const isAbilityPlayable = isAbilityAttachEligible || (!dimmed && isMyTurn && (currentPhase === 2 || currentPhase === 4) && card && card.cardType === 'Ability');
    const isEquipPlayable = !dimmed && isMyTurn && (currentPhase === 2 || currentPhase === 4) && card && card.cardType === 'Artifact'
      && (card.subtype || '').toLowerCase() === 'equipment' && (me.gold || 0) >= (card.cost || 0);
    const isArtifactActivatable = !dimmed && isMyTurn && (currentPhase === 2 || currentPhase === 4) && card
      && card.cardType === 'Artifact' && (card.subtype || '').toLowerCase() !== 'equipment' && (card.subtype || '').toLowerCase() !== 'reaction';
    const isPotionActivatable = !dimmed && isMyTurn && (currentPhase === 2 || currentPhase === 4) && card && card.cardType === 'Potion';
    const isSurprisePlayable = !dimmed && isMyTurn && (currentPhase === 2 || currentPhase === 4) && card
      && (card.subtype || '').toLowerCase() === 'surprise'
      && ([0,1,2].some(hi => { const h = me.heroes[hi]; return h && h.name && h.hp > 0 && ((me.surpriseZones || [])[hi] || []).length === 0; })
        || (card.cardType === 'Creature' && (gameState.bakhmSurpriseSlots || []).some(b => b.freeSlots.length > 0)));
    const isAscensionPlayable = !dimmed && isMyTurn && (currentPhase === 2 || currentPhase === 4) && card
      && card.cardType === 'Ascended Hero'
      && (me.heroes || []).some((h) => h?.name && h.hp > 0 && h.ascensionReady && h.ascensionTarget === cardName);
    const _startPt = window.getPointerXY(e);
    const startX = _startPt.x, startY = _startPt.y;
    let dragging = false;

    // Helper: check if cursor is inside the hand zone
    const isInsideHandZone = (mx, my) => {
      const r = handRef.current?.getBoundingClientRect();
      return r && mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom;
    };

    const onMove = (mx, my) => {
      if (!dragging) {
        if (Math.abs(mx - startX) + Math.abs(my - startY) < 5) return;
        dragging = true;
      }

      const inHand = isInsideHandZone(mx, my);

      // Inside hand zone → always reorder mode (any card type, even dimmed)
      if (inHand) {
        setPlayDrag(null);
        setAbilityDrag(null);
        setHandDrag({ idx, cardName, mouseX: mx, mouseY: my });
        return;
      }

      // Outside hand zone — use card-type-specific drag mode
      setHandDrag(null);

      if (isAbilityPlayable) {
        // Ability play-mode drag — find valid hero/zone target
        let targetHero = -1, targetZone = -1;
        // During abilityAttach prompt, restrict to specified hero and skip abilityGivenThisTurn
        const attachHeroOnly = abilityAttachPrompt ? abilityAttachPrompt.heroIdx : -1;
        const skipAbilityGiven = !!abilityAttachPrompt;
        const canReceive = (hi, cn) => {
          if (attachHeroOnly >= 0 && hi !== attachHeroOnly) return false;
          // Custom canHeroReceiveAbility that optionally skips abilityGivenThisTurn
          const hero2 = me.heroes[hi];
          if (!hero2 || !hero2.name || hero2.hp <= 0) return false;
          if (!skipAbilityGiven && (me.abilityGivenThisTurn || [])[hi]) return false;
          const abZ = me.abilityZones[hi] || [[], [], []];
          const isCust = (gameState.customPlacementCards || []).includes(cn);
          if (isCust) return abZ.some(sl => (sl||[]).length > 0 && (sl||[]).length < 3);
          for (const sl of abZ) { if ((sl||[]).length > 0 && sl[0] === cn) return sl.length < 3; }
          return abZ.some(sl => (sl||[]).length === 0);
        };
        // Check hero zones
        const heroEls = document.querySelectorAll('[data-hero-zone]');
        for (const el of heroEls) {
          const r = el.getBoundingClientRect();
          if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
            if (el.dataset.heroOwner === 'me') {
              const hi = parseInt(el.dataset.heroIdx);
              if (canReceive(hi, cardName)) { targetHero = hi; targetZone = -1; }
            }
          }
        }
        // Check ability zones (more specific target)
        if (targetHero < 0) {
          const abEls = document.querySelectorAll('[data-ability-zone]');
          for (const el of abEls) {
            const r = el.getBoundingClientRect();
            if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
              if (el.dataset.abilityOwner === 'me') {
                const hi = parseInt(el.dataset.abilityHero);
                const zi = parseInt(el.dataset.abilitySlot);
                if (canReceive(hi, cardName)) {
                  const abSlot = (me.abilityZones[hi] || [])[zi] || [];
                  const isCustom = (gameState.customPlacementCards || []).includes(cardName);

                  if (isCustom) {
                    // Custom placement: occupied zones with <3 cards
                    if (abSlot.length > 0 && abSlot.length < 3) { targetHero = hi; targetZone = zi; }
                  } else {
                    // Standard: only matching or empty zones
                    const existingZone = ((me.abilityZones[hi] || []).findIndex(s => (s||[]).length > 0 && s[0] === cardName));
                    if (existingZone >= 0) {
                      if (zi === existingZone && abSlot.length < 3) { targetHero = hi; targetZone = zi; }
                    } else {
                      if (abSlot.length === 0) { targetHero = hi; targetZone = zi; }
                    }
                  }
                }
              }
            }
          }
        }
        setAbilityDrag({ idx, cardName, card, mouseX: mx, mouseY: my, targetHero, targetZone });
      } else if (isPlayable && card.cardType === 'Creature') {
        // Play-mode drag — find valid drop target
        let targetHero = -1, targetSlot = -1;
        const heroActionHeroIdx = heroActionPrompt?.heroIdx;
        const els = document.querySelectorAll('[data-support-zone]');
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
            const hi = parseInt(el.dataset.supportHero);
            const si = parseInt(el.dataset.supportSlot);
            const isOwn = el.dataset.supportOwner === 'me';
            // During heroAction, only the Coffee hero's zones are valid
            if (heroActionHeroIdx !== undefined && hi !== heroActionHeroIdx) continue;
            if (isOwn && canHeroPlayCard(me, hi, card) && findFreeSupportSlot(me, hi) >= 0) {
              // Check this specific slot is free (base or island zones OK for creatures)
              const slotCards = (me.supportZones[hi] || [])[si] || [];
              if (slotCards.length === 0 && si < ((me.supportZones[hi] || []).length || 3)) { targetHero = hi; targetSlot = si; }
            }
          }
        }
        setPlayDrag({ idx, cardName, card, mouseX: mx, mouseY: my, targetHero, targetSlot });
      } else if (isEquipPlayable) {
        // Equip artifact drag — can drop on support zones OR heroes
        let targetHero = -1, targetSlot = -1;
        // Check hero zones first (auto-place in first free base support zone)
        const heroEls = document.querySelectorAll('[data-hero-zone]');
        for (const el of heroEls) {
          const r = el.getBoundingClientRect();
          if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
            if (el.dataset.heroOwner === 'me') {
              const hi = parseInt(el.dataset.heroIdx);
              const hero = me.heroes[hi];
              if (hero && hero.name && hero.hp > 0) {
                // Check for a free base support zone (indices 0-2 only)
                const supZones = me.supportZones[hi] || [];
                for (let z = 0; z < 3; z++) {
                  if ((supZones[z] || []).length === 0) { targetHero = hi; targetSlot = -1; break; }
                }
              }
            }
          }
        }
        // Check support zones (specific placement)
        if (targetHero < 0) {
          const els = document.querySelectorAll('[data-support-zone]');
          for (const el of els) {
            const r = el.getBoundingClientRect();
            if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
              const hi = parseInt(el.dataset.supportHero);
              const si = parseInt(el.dataset.supportSlot);
              const isOwn = el.dataset.supportOwner === 'me';
              const isIsland = el.dataset.supportIsland === 'true';
              if (isOwn && !isIsland && si < 3) { // Can only equip to base zones
                const hero = me.heroes[hi];
                if (hero && hero.name && hero.hp > 0) {
                  const slotCards = (me.supportZones[hi] || [])[si] || [];
                  if (slotCards.length === 0) { targetHero = hi; targetSlot = si; }
                }
              }
            }
          }
        }
        setPlayDrag({ idx, cardName, card, mouseX: mx, mouseY: my, targetHero, targetSlot, isEquip: true });
      } else if (isSurprisePlayable && !isPlayable) {
        // Surprise drag — target hero zones (hero must be alive with empty surprise zone)
        let targetHero = -1;
        let targetBakhmSlot = -1;
        const surEls = document.querySelectorAll('[data-surprise-zone]');
        for (const el of surEls) {
          const r = el.getBoundingClientRect();
          if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
            if (el.dataset.surpriseOwner === 'me') {
              const hi = parseInt(el.dataset.surpriseHero);
              const hero = me.heroes[hi];
              if (hero && hero.name && hero.hp > 0 && ((me.surpriseZones || [])[hi] || []).length === 0) {
                targetHero = hi;
              }
            }
          }
        }
        // Also check hero zones for convenience (drop on hero = surprise zone)
        if (targetHero < 0) {
          const heroEls3 = document.querySelectorAll('[data-hero-zone]');
          for (const el of heroEls3) {
            const r = el.getBoundingClientRect();
            if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
              if (el.dataset.heroOwner === 'me') {
                const hi = parseInt(el.dataset.heroIdx);
                const hero = me.heroes[hi];
                if (hero && hero.name && hero.hp > 0 && ((me.surpriseZones || [])[hi] || []).length === 0) {
                  targetHero = hi;
                }
              }
            }
          }
        }
        // Check Bakhm support zones for Surprise Creatures
        if (targetHero < 0 && card.cardType === 'Creature') {
          const bakhmSlots = gameState.bakhmSurpriseSlots || [];
          const supEls = document.querySelectorAll('[data-support-zone]');
          for (const el of supEls) {
            const r = el.getBoundingClientRect();
            if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
              if (el.dataset.supportOwner === 'me') {
                const hi = parseInt(el.dataset.supportHero);
                const si = parseInt(el.dataset.supportSlot);
                const bEntry = bakhmSlots.find(b => b.heroIdx === hi);
                if (bEntry && bEntry.freeSlots.includes(si)) {
                  targetHero = hi;
                  targetBakhmSlot = si;
                }
              }
            }
          }
        }
        setPlayDrag({ idx, cardName, card, mouseX: mx, mouseY: my, targetHero, targetBakhmSlot, isSurprise: true });
      } else if (isPlayable && (card.cardType === 'Spell' || card.cardType === 'Attack')) {
        // Spell/Attack drag — target hero zones (hero must have required spell schools)
        let targetHero = -1;
        let targetSlot = -1;
        let targetCharmedOwner = undefined;
        const heroActionHeroIdx2 = heroActionPrompt?.heroIdx;
        const isAttachmentCard = (card.subtype || '').toLowerCase() === 'attachment';

        // Attachment spells/attacks: also check support zones (like creatures/equipment)
        if (isAttachmentCard) {
          const supEls = document.querySelectorAll('[data-support-zone]');
          for (const el of supEls) {
            const r = el.getBoundingClientRect();
            if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
              const hi = parseInt(el.dataset.supportHero);
              const si = parseInt(el.dataset.supportSlot);
              const isOwn = el.dataset.supportOwner === 'me';
              const isIsland = el.dataset.supportIsland === 'true';
              if (isOwn && !isIsland && si < 3 && canHeroPlayCard(me, hi, card)) {
                const slotCards = (me.supportZones[hi] || [])[si] || [];
                if (slotCards.length === 0) { targetHero = hi; targetSlot = si; }
              }
            }
          }
        }

        // Check hero zones (all spells/attacks, including attachments for auto-place)
        if (targetHero < 0) {
        const heroEls2 = document.querySelectorAll('[data-hero-zone]');
        for (const el of heroEls2) {
          const r = el.getBoundingClientRect();
          if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
            const hi = parseInt(el.dataset.heroIdx);
            if (el.dataset.heroOwner === 'me') {
              if (heroActionHeroIdx2 !== undefined && hi !== heroActionHeroIdx2) continue;
              if (canHeroPlayCard(me, hi, card)) {
                if (isAttachmentCard) {
                  // Auto-place: only if hero has a free support zone
                  const supZones = me.supportZones[hi] || [];
                  if ([0,1,2].some(z => (supZones[z] || []).length === 0)) targetHero = hi;
                } else {
                  targetHero = hi;
                }
              }
            } else if (el.dataset.heroOwner === 'opp') {
              // Check if this is a charmed hero we control
              const oppHero = opp.heroes?.[hi];
              if (oppHero?.charmedBy === myIdx && canHeroPlayCard(opp, hi, card)) {
                targetHero = hi;
                targetCharmedOwner = oppIdx;
              }
            }
          }
        }
        }
        setPlayDrag({ idx, cardName, card, mouseX: mx, mouseY: my, targetHero, targetSlot: targetSlot, isSpell: true, charmedOwner: targetCharmedOwner });
      } else if (isAscensionPlayable) {
        // Ascended Hero drag — target hero zones with eligible base heroes
        let targetHero = -1;
        const heroEls4 = document.querySelectorAll('[data-hero-zone]');
        for (const el of heroEls4) {
          const r = el.getBoundingClientRect();
          if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
            if (el.dataset.heroOwner === 'me') {
              const hi = parseInt(el.dataset.heroIdx);
              const hero = me.heroes[hi];
              if (hero?.name && hero.hp > 0 && hero.ascensionReady && hero.ascensionTarget === cardName) {
                targetHero = hi;
              }
            }
          }
        }
        setPlayDrag({ idx, cardName, card, mouseX: mx, mouseY: my, targetHero, isAscension: true });
      } else {
        // Non-playable card outside hand zone — show floating card (no reorder gap)
        setPlayDrag(null);
        setAbilityDrag(null);
        setHandDrag({ idx, cardName, mouseX: mx, mouseY: my });
      }
    };

    const onUp = (upX, upY) => {
      if (!dragging) {
        // Click (no drag) — check for potion or non-equip artifact activation
        if (!dimmed && isMyTurn && (currentPhase === 2 || currentPhase === 3 || currentPhase === 4) && card) {
          if (card.cardType === 'Potion') {
            socket.emit('use_potion', { roomId: gameState.roomId, cardName, handIndex: idx });
          } else if (card.cardType === 'Artifact' && (card.subtype || '').toLowerCase() !== 'equipment') {
            socket.emit('use_artifact_effect', { roomId: gameState.roomId, cardName, handIndex: idx });
          } else if ((card.cardType === 'Spell' || card.cardType === 'Attack') && isPlayable) {
            // Find all heroes that can play this card (own + charmed opponent)
            const eligible = [];
            for (let hi = 0; hi < (me.heroes || []).length; hi++) {
              if (canHeroPlayCard(me, hi, card)) {
                eligible.push({ idx: hi, name: me.heroes[hi].name });
              }
            }
            // Also check charmed opponent heroes
            for (let hi = 0; hi < (opp.heroes || []).length; hi++) {
              const oppHero = opp.heroes[hi];
              if (oppHero?.charmedBy === myIdx && canHeroPlayCard(opp, hi, card)) {
                eligible.push({ idx: hi, name: oppHero.name, charmedOwner: oppIdx });
              }
            }
            if (eligible.length === 1) {
              // Only one eligible hero — auto-play
              if (isHeroAction) {
                socket.emit('effect_prompt_response', {
                  roomId: gameState.roomId,
                  response: { cardName, handIndex: idx, heroIdx: eligible[0].idx },
                });
              } else {
                socket.emit('play_spell', { roomId: gameState.roomId, cardName, handIndex: idx, heroIdx: eligible[0].idx, charmedOwner: eligible[0].charmedOwner });
              }
            } else if (eligible.length > 1) {
              // Multiple eligible — show hero selection popup
              setSpellHeroPick({ cardName, handIndex: idx, card, eligible, isHeroAction });
            }
          } else if (isAscensionPlayable) {
            // Click on Ascended Hero — find eligible base heroes
            const eligible = [];
            for (let hi = 0; hi < (me.heroes || []).length; hi++) {
              const h = me.heroes[hi];
              if (h?.name && h.hp > 0 && h.ascensionReady && h.ascensionTarget === cardName) {
                eligible.push({ idx: hi, name: h.name });
              }
            }
            if (eligible.length === 1) {
              socket.emit('ascend_hero', { roomId: gameState.roomId, heroIdx: eligible[0].idx, cardName, handIndex: idx });
            } else if (eligible.length > 1) {
              setSpellHeroPick({ cardName, handIndex: idx, card, eligible, isAscension: true });
            }
          } else if (isSurprisePlayable) {
            // Click on a Surprise card — find heroes with empty surprise zones
            const eligible = [];
            for (let hi = 0; hi < (me.heroes || []).length; hi++) {
              const hero = me.heroes[hi];
              if (hero && hero.name && hero.hp > 0 && ((me.surpriseZones || [])[hi] || []).length === 0) {
                eligible.push({ idx: hi, name: hero.name });
              }
            }
            // Add Bakhm support zone slots for Surprise Creatures
            if (card.cardType === 'Creature') {
              for (const bEntry of (gameState.bakhmSurpriseSlots || [])) {
                const hero = me.heroes[bEntry.heroIdx];
                if (!hero?.name) continue;
                for (const si of bEntry.freeSlots) {
                  eligible.push({ idx: bEntry.heroIdx, name: `${hero.name} (Zone ${si + 1})`, bakhmSlot: si });
                }
              }
            }
            if (eligible.length === 1) {
              socket.emit('play_surprise', { roomId: gameState.roomId, cardName, handIndex: idx, heroIdx: eligible[0].idx, bakhmSlot: eligible[0].bakhmSlot });
            } else if (eligible.length > 1) {
              setSpellHeroPick({ cardName, handIndex: idx, card, eligible, isSurprise: true });
            }
          }
        }
        setHandDrag(null); setPlayDrag(null); setAbilityDrag(null); return;
      }

      // Determine if dropped inside the hand zone
      const droppedInHand = isInsideHandZone(upX, upY);

      if (droppedInHand) {
        // Dropped inside hand zone — ALWAYS reorder, regardless of card type
        const newHand = [...hand];
        newHand.splice(idx, 1);
        const dropIdx = calcDropIdx(upX, idx);
        newHand.splice(dropIdx, 0, cardName);
        setHand(newHand);
        socket.emit('reorder_hand', { roomId: gameState.roomId, hand: newHand });
        setHandDrag(null); setPlayDrag(null); setAbilityDrag(null);
        return;
      }

      // Dropped outside hand zone — try to play/activate the card
      if (isAbilityPlayable) {
        setAbilityDrag(prev => {
          if (!prev || prev.targetHero < 0) return null;
          // During abilityAttach prompt — send as effect_prompt_response
          if (isAbilityAttachEligible) {
            socket.emit('effect_prompt_response', {
              roomId: gameState.roomId,
              response: { cardName: prev.cardName, handIndex: prev.idx, heroIdx: prev.targetHero, zoneSlot: prev.targetZone },
            });
          } else {
            socket.emit('play_ability', {
              roomId: gameState.roomId,
              cardName: prev.cardName,
              handIndex: prev.idx,
              heroIdx: prev.targetHero,
              zoneSlot: prev.targetZone,
            });
          }
          return null;
        });
      } else if (isPlayable && card.cardType === 'Creature') {
        setPlayDrag(prev => {
          if (!prev || prev.targetHero < 0 || prev.targetSlot < 0) return null;

          // Hero Action mode (Coffee) — send as effect_prompt_response
          if (isHeroAction) {
            socket.emit('effect_prompt_response', {
              roomId: gameState.roomId,
              response: { cardName: prev.cardName, handIndex: prev.idx, zoneSlot: prev.targetSlot },
            });
            return null;
          }

          // Check if this play uses an additional action
          const additionalActions = gameState.additionalActions || [];
          const matchingAAs = additionalActions.filter(aa => aa.eligibleHandCards.includes(prev.cardName));
          const isMainPhase = currentPhase === 2 || currentPhase === 4;
          const needsAdditional = isMainPhase || matchingAAs.length > 0;

          if (needsAdditional && matchingAAs.length > 0) {
            const allProviders = matchingAAs.flatMap(aa => aa.providers);
            if (allProviders.length > 1) {
              setPendingAdditionalPlay({
                cardName: prev.cardName, handIndex: prev.idx,
                heroIdx: prev.targetHero, zoneSlot: prev.targetSlot,
                providers: allProviders,
              });
              socket.emit('pending_placement', { roomId: gameState.roomId, heroIdx: prev.targetHero, zoneSlot: prev.targetSlot, cardName: prev.cardName });
              return null;
            }
            socket.emit('play_creature', {
              roomId: gameState.roomId, cardName: prev.cardName,
              handIndex: prev.idx, heroIdx: prev.targetHero, zoneSlot: prev.targetSlot,
              additionalActionProvider: allProviders[0].cardId,
            });
          } else {
            socket.emit('play_creature', {
              roomId: gameState.roomId, cardName: prev.cardName,
              handIndex: prev.idx, heroIdx: prev.targetHero, zoneSlot: prev.targetSlot,
            });
          }
          return null;
        });
      } else if (isEquipPlayable) {
        setPlayDrag(prev => {
          if (!prev || prev.targetHero < 0) return null;
          socket.emit('play_artifact', {
            roomId: gameState.roomId,
            cardName: prev.cardName,
            handIndex: prev.idx,
            heroIdx: prev.targetHero,
            zoneSlot: prev.targetSlot, // -1 means auto-place
          });
          return null;
        });
      } else if (isSurprisePlayable && !isPlayable) {
        setPlayDrag(prev => {
          if (!prev || !prev.isSurprise || prev.targetHero < 0) return null;
          socket.emit('play_surprise', {
            roomId: gameState.roomId,
            cardName: prev.cardName,
            handIndex: prev.idx,
            heroIdx: prev.targetHero,
            bakhmSlot: prev.targetBakhmSlot >= 0 ? prev.targetBakhmSlot : undefined,
          });
          return null;
        });
      } else if (isPlayable && (card.cardType === 'Spell' || card.cardType === 'Attack')) {
        setPlayDrag(prev => {
          if (!prev || prev.targetHero < 0) return null;

          // Hero Action mode (Coffee) — send as effect_prompt_response
          if (isHeroAction) {
            socket.emit('effect_prompt_response', {
              roomId: gameState.roomId,
              response: { cardName: prev.cardName, handIndex: prev.idx, heroIdx: prev.targetHero },
            });
            return null;
          }

          socket.emit('play_spell', {
            roomId: gameState.roomId,
            cardName: prev.cardName,
            handIndex: prev.idx,
            heroIdx: prev.targetHero,
            charmedOwner: prev.charmedOwner,
            attachmentZoneSlot: prev.targetSlot >= 0 ? prev.targetSlot : undefined,
          });
          return null;
        });
      } else if (isArtifactActivatable) {
        // Non-equip artifact dragged outside hand — activate
        socket.emit('use_artifact_effect', { roomId: gameState.roomId, cardName, handIndex: idx });
      } else if (isAscensionPlayable) {
        // Ascended Hero dropped on eligible base hero
        setPlayDrag(prev => {
          if (!prev || prev.targetHero < 0 || !prev.isAscension) return null;
          socket.emit('ascend_hero', {
            roomId: gameState.roomId, heroIdx: prev.targetHero,
            cardName: prev.cardName, handIndex: prev.idx,
          });
          return null;
        });
      } else if (isPotionActivatable) {
        // Potion dragged outside hand — activate
        socket.emit('use_potion', { roomId: gameState.roomId, cardName, handIndex: idx });
      }
      // Clean up all drag states
      setHandDrag(null); setPlayDrag(null); setAbilityDrag(null);
    };

    window.addDragListeners(onMove, onUp);
  };

  const calcDropIdx = (mouseX, excludeIdx) => {
    if (!handRef.current) return 0;
    const slots = handRef.current.querySelectorAll('.hand-slot:not(.hand-dragging)');
    let targetIdx = slots.length;
    for (let i = 0; i < slots.length; i++) {
      const r = slots[i].getBoundingClientRect();
      if (mouseX < r.left + r.width / 2) { targetIdx = i; break; }
    }
    // Adjust for the removed card
    if (excludeIdx <= targetIdx) return targetIdx;
    return targetIdx;
  };

  // Build display hand with gap
  const displayHand = useMemo(() => {
    const dragIdx = handDrag?.idx ?? playDrag?.idx ?? abilityDrag?.idx ?? null;
    if (dragIdx === null) return hand.map((c, i) => ({ card: c, origIdx: i, isGap: false }));
    // Keep dragged card in array (DOM element must persist for mobile touch tracking).
    // The render code applies hand-dragging class to hide it visually.
    const items = hand.map((c, i) => ({ card: c, origIdx: i, isGap: false }));
    // Only show gap for reorder drag, not play drag
    if (handDrag) {
      const dropIdx = calcDropIdx(handDrag.mouseX, handDrag.idx);
      // Adjust for drag source still being in the array
      let insertAt = dropIdx;
      if (insertAt >= handDrag.idx) insertAt++;
      items.splice(insertAt, 0, { card: null, origIdx: -1, isGap: true });
    }
    return items;
  }, [hand, handDrag, playDrag, abilityDrag]);

  const [showSurrender, setShowSurrender] = useState(false);
  const [sideDeckPhase, setSideDeckPhase] = useState(null); // { currentDeck, originalDeck, opponentDone, setScore, format }
  const [sideDeckDone, setSideDeckDone] = useState(false);
  const [sideDeckSel, setSideDeckSel] = useState(null); // { pool: 'main'|'potion'|'side'|'hero', idx: number }
  const [scEarned, setScEarned] = useState(null); // { rewards: [{id,title,amount,description}], total }

  // Listen for SC earned event + profile stats update
  useEffect(() => {
    const onSC = (data) => {
      setScEarned(data);
      if (data.total > 0) setUser(u => ({ ...u, sc: (u.sc || 0) + data.total }));
    };
    const onSCSpec = (data) => {
      // Spectators get both players' SC data — just show a combined view
      if (isSpectator) setScEarned(data);
    };
    const onStatsUpdated = (data) => {
      setUser(u => ({ ...u, ...data }));
    };
    socket.on('sc_earned', onSC);
    socket.on('sc_earned_spectator', onSCSpec);
    socket.on('user_stats_updated', onStatsUpdated);
    return () => { socket.off('sc_earned', onSC); socket.off('sc_earned_spectator', onSCSpec); socket.off('user_stats_updated', onStatsUpdated); };
  }, []);
  const [showFirstChoice, setShowFirstChoice] = useState(false);
  const [deckViewer, setDeckViewer] = useState(null); // 'deck' | 'potion' | null
  const [pileViewer, setPileViewer] = useState(null); // { title, cards } | null
  const [hoveredPileCard, setHoveredPileCard] = useState(null); // card name for pile tooltip
  const [handPickSelected, setHandPickSelected] = useState(new Set()); // hand indices selected for handPick prompt
  const [blindPickSelected, setBlindPickSelected] = useState(new Set()); // opp hand indices selected for blindHandPick prompt
  const [stealMarkedMe, setStealMarkedMe] = useState(new Set()); // own hand indices marked for stealing (victim's screen)
  const [stealHiddenMe, setStealHiddenMe] = useState(new Set()); // own hand indices hidden during steal flight (victim)
  const [stealHiddenOpp, setStealHiddenOpp] = useState(new Set()); // opp hand indices hidden during steal flight (stealer)
  const [stealAnims, setStealAnims] = useState([]); // flying card elements [{id, cardName, startX, startY, endX, endY}]
  const stealInProgressRef = useRef(false); // suppress draw animations during steals
  const stealSkipDrawRef = useRef(0); // number of new hand cards to skip draw-anim for after steal
  const stealExpectedOppCountRef = useRef(-1); // opp hand count when stealHiddenOpp was set
  const stealExpectedMeCountRef = useRef(-1); // my hand count when stealHiddenMe was set
  const [stealHighlightMe, setStealHighlightMe] = useState(new Set()); // hand indices highlighted by opponent's blind pick selection
  // Clear stale hoveredPileCard when force-discard prompt ends
  useEffect(() => { setHoveredPileCard(null); setHandPickSelected(new Set()); setBlindPickSelected(new Set()); setStealHighlightMe(new Set()); }, [gameState.effectPrompt]);
  // Broadcast blind-pick selection to opponent so they see highlighted cards
  useEffect(() => {
    if (gameState.effectPrompt?.type === 'blindHandPick' && gameState.effectPrompt?.ownerIdx === myIdx) {
      socket.emit('blind_pick_update', { roomId: gameState.roomId, indices: [...blindPickSelected] });
    }
  }, [blindPickSelected]);
  const [immuneTooltip, setImmuneTooltip] = useState(null); // hero name for immune tooltip
  const [immuneTooltipType, setImmuneTooltipType] = useState(null); // 'immune' or 'shielded'

  // Listen for immune icon hover (uses window event to escape component boundaries)
  useEffect(() => {
    const onHover = () => {
      setImmuneTooltip(window._immuneTooltip || null);
      setImmuneTooltipType(window._immuneTooltipType || null);
    };
    window.addEventListener('immuneHover', onHover);
    return () => window.removeEventListener('immuneHover', onHover);
  }, []);

  // Listen for additional action icon hover
  const [aaTooltipKey, setAaTooltipKey] = useState(null);
  useEffect(() => {
    const onHover = () => setAaTooltipKey(window._aaTooltipKey || null);
    window.addEventListener('aaHover', onHover);
    return () => window.removeEventListener('aaHover', onHover);
  }, []);

  const [potionSelection, setPotionSelection] = useState([]); // Selected target IDs during potion targeting
  // Clear selection when targeting changes (prevents stale selections between multi-step effects)
  useEffect(() => {
    setPotionSelection([]);
  }, [gameState.potionTargeting]);
  const [oppPendingPlacement, setOppPendingPlacement] = useState(null); // { owner, heroIdx, zoneSlot, cardName }
  useEffect(() => {
    const onOppPending = (data) => setOppPendingPlacement(data);
    socket.on('opponent_pending_placement', onOppPending);
    return () => socket.off('opponent_pending_placement', onOppPending);
  }, []);
  const [explosions, setExplosions] = useState([]); // Target IDs currently showing explosion
  const [cardReveals, setCardReveals] = useState([]); // [{id, cardName}] — stacked reveals
  const [summonGlow, setSummonGlow] = useState(null); // { owner, heroIdx, zoneSlot }
  const [oppTargetHighlight, setOppTargetHighlight] = useState([]); // Target IDs highlighted on opponent's screen
  const [burnTickingHeroes, setBurnTickingHeroes] = useState([]); // Hero keys ('pi-hi') currently showing burn escalation
  const [abilityFlash, setAbilityFlash] = useState(null); // { owner, heroIdx, zoneIdx } — flashing ability zone
  const [levelChanges, setLevelChanges] = useState([]); // [{id, delta, owner, heroIdx, zoneSlot}]
  const deckSearchPendingRef = useRef([]); // Card names queued before sync triggers opp draw anim
  const [reactionChain, setReactionChain] = useState(null); // [{id, cardName, owner, cardType, isInitialCard, negated, status}]
  const [cameraFlash, setCameraFlash] = useState(false);
  const [toughnessHpChanges, setToughnessHpChanges] = useState([]); // [{id, amount, owner, heroIdx}]
  const toughnessHpSuppressRef = useRef({}); // { 'owner-heroIdx': true } — suppress damage numbers for Toughness HP removal
  const creatureMoveSuppressRef = useRef({}); // { 'owner-heroIdx-slot': true } — suppress damage numbers when creature moves zones
  const [fightingAtkChanges, setFightingAtkChanges] = useState([]); // [{id, amount, owner, heroIdx}]

  // End-turn confirmation
  const [askBeforeEndTurn, setAskBeforeEndTurn] = useState(() => localStorage.getItem('pp_ask_end_turn') !== '0');
  const [showEndTurnConfirm, setShowEndTurnConfirm] = useState(false);
  const pendingEndTurnRef = useRef(null); // stores the target phase for deferred advance

  // Shared phase advance with optional end-turn confirmation
  const tryAdvancePhase = useCallback((targetPhase) => {
    if (targetPhase === 5 && askBeforeEndTurn) {
      pendingEndTurnRef.current = targetPhase;
      setShowEndTurnConfirm(true);
    } else {
      socket.emit('advance_phase', { roomId: gameState.roomId, targetPhase });
    }
  }, [askBeforeEndTurn, gameState.roomId]);

  const confirmEndTurn = useCallback(() => {
    const target = pendingEndTurnRef.current;
    pendingEndTurnRef.current = null;
    setShowEndTurnConfirm(false);
    if (target != null) socket.emit('advance_phase', { roomId: gameState.roomId, targetPhase: target });
  }, [gameState.roomId]);

  const cancelEndTurn = useCallback(() => {
    pendingEndTurnRef.current = null;
    setShowEndTurnConfirm(false);
  }, []);

  // Listen for opponent card reveal
  useEffect(() => {
    const onReveal = ({ cardName }) => setCardReveals(prev => [...prev, { id: Date.now() + Math.random(), cardName }]);
    const onDeckSearchAdd = ({ cardName, playerIdx }) => {
      // If the OPPONENT searched, prepare face-up draw animation
      if (playerIdx !== myIdx) {
        deckSearchPendingRef.current = [...deckSearchPendingRef.current, cardName];
      }
    };
    // Reaction chain events
    const onChainUpdate = ({ links }) => {
      setReactionChain(links.map(l => ({ ...l, status: l.negated ? 'negated' : 'pending' })));
    };
    const onChainResolvingStart = () => {}; // Chain is about to resolve
    const onChainLinkResolving = ({ linkIndex }) => {
      setReactionChain(prev => prev?.map((l, i) => i === linkIndex ? { ...l, status: 'resolving' } : l));
    };
    const onChainLinkResolved = ({ linkIndex }) => {
      setReactionChain(prev => prev?.map((l, i) => i === linkIndex ? { ...l, status: 'resolved' } : l));
    };
    const onChainLinkNegated = ({ linkIndex, negationStyle }) => {
      setReactionChain(prev => prev?.map((l, i) => i === linkIndex ? { ...l, status: 'negated', negated: true, negationStyle: negationStyle || null } : l));
    };
    const onChainDone = () => {
      setTimeout(() => setReactionChain(null), 800);
    };
    const onCameraFlash = () => {
      setCameraFlash(true);
      setTimeout(() => setCameraFlash(false), 900);
    };
    const onToughnessHp = ({ owner, heroIdx, amount }) => {
      const entry = { id: Date.now() + Math.random(), amount, owner, heroIdx };
      setToughnessHpChanges(prev => [...prev, entry]);
      setTimeout(() => setToughnessHpChanges(prev => prev.filter(e => e.id !== entry.id)), 1800);
      // Mark this hero's HP change as non-damage so the damage number system skips it
      if (amount < 0) {
        toughnessHpSuppressRef.current[`${owner}-${heroIdx}`] = true;
      }
    };
    const onCreatureZoneMove = ({ owner, heroIdx, zoneSlot }) => {
      creatureMoveSuppressRef.current[`${owner}-${heroIdx}-${zoneSlot}`] = true;
    };
    const onFightingAtk = ({ owner, heroIdx, amount }) => {
      const entry = { id: Date.now() + Math.random(), amount, owner, heroIdx };
      setFightingAtkChanges(prev => [...prev, entry]);
      setTimeout(() => setFightingAtkChanges(prev => prev.filter(e => e.id !== entry.id)), 1800);
    };
    const onSummon = ({ owner, heroIdx, zoneSlot, cardName }) => {
      setSummonGlow({ owner, heroIdx, zoneSlot });
      setTimeout(() => setSummonGlow(null), 1200);
    };
    const onBurnTick = ({ heroes }) => {
      const keys = heroes.map(h => `${h.owner}-${h.heroIdx}`);
      setBurnTickingHeroes(keys);
      setTimeout(() => setBurnTickingHeroes([]), 1500);
    };
    const onZoneAnim = ({ type, owner, heroIdx, zoneSlot, zoneType, permId }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      let sel;
      if (zoneType === 'ability' && heroIdx >= 0 && zoneSlot >= 0) {
        sel = `[data-ability-zone][data-ability-owner="${ownerLabel}"][data-ability-hero="${heroIdx}"][data-ability-slot="${zoneSlot}"]`;
      } else if (zoneType === 'surprise' && heroIdx >= 0) {
        sel = `[data-surprise-zone][data-surprise-owner="${ownerLabel}"][data-surprise-hero="${heroIdx}"]`;
      } else if (zoneType === 'permanent' && permId) {
        sel = `[data-perm-id="${permId}"][data-perm-owner="${ownerLabel}"]`;
      } else if (zoneSlot >= 0) {
        sel = `[data-support-zone][data-support-owner="${ownerLabel}"][data-support-hero="${heroIdx}"][data-support-slot="${zoneSlot}"]`;
      } else {
        sel = `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`;
      }
      setTimeout(() => playAnimation(type, sel, { duration: 1000 }), 100);
    };
    const onLevelChange = ({ delta, owner, heroIdx, zoneSlot }) => {
      const entry = { id: Date.now() + Math.random(), delta, owner, heroIdx, zoneSlot };
      setLevelChanges(prev => [...prev, entry]);
      setTimeout(() => setLevelChanges(prev => prev.filter(e => e.id !== entry.id)), 1600);
    };
    const onAbilityActivated = ({ owner, heroIdx, zoneIdx, abilityName }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const abSel = `[data-ability-zone][data-ability-owner="${ownerLabel}"][data-ability-hero="${heroIdx}"][data-ability-slot="${zoneIdx}"]`;
      // Set flash overlay on the ability zone (visible to both players)
      setAbilityFlash({ owner, heroIdx, zoneIdx });
      setTimeout(() => setAbilityFlash(null), 1800);
      // Big flashy burst on the ability zone — staggered multi-layer
      setTimeout(() => playAnimation('gold_sparkle', abSel, { duration: 1400 }), 50);
      setTimeout(() => playAnimation('gold_sparkle', abSel, { duration: 1200 }), 250);
      setTimeout(() => playAnimation('gold_sparkle', abSel, { duration: 1000 }), 450);
      // Sparkle on the gold counter after a short delay
      setTimeout(() => {
        const goldEl = document.querySelector(`[data-gold-player="${owner}"]`);
        if (goldEl) {
          playAnimation('gold_sparkle', goldEl, { duration: 1000 });
          setTimeout(() => playAnimation('gold_sparkle', goldEl, { duration: 800 }), 200);
        }
      }, 400);
    };
    const onBeamAnimation = ({ sourceOwner, sourceHeroIdx, sourceZoneSlot, targetOwner, targetHeroIdx, targetZoneSlot, color, duration }) => {
      const srcLabel = sourceOwner === myIdx ? 'me' : 'opp';
      const tgtLabel = targetOwner === myIdx ? 'me' : 'opp';
      const srcEl = sourceZoneSlot != null && sourceZoneSlot >= 0
        ? document.querySelector(`[data-support-zone][data-support-owner="${srcLabel}"][data-support-hero="${sourceHeroIdx}"][data-support-slot="${sourceZoneSlot}"]`)
        : document.querySelector(`[data-hero-zone][data-hero-owner="${srcLabel}"][data-hero-idx="${sourceHeroIdx}"]`);
      let tgtEl;
      if (targetZoneSlot !== undefined && targetZoneSlot >= 0) {
        tgtEl = document.querySelector(`[data-support-zone][data-support-owner="${tgtLabel}"][data-support-hero="${targetHeroIdx}"][data-support-slot="${targetZoneSlot}"]`);
      } else {
        tgtEl = document.querySelector(`[data-hero-zone][data-hero-owner="${tgtLabel}"][data-hero-idx="${targetHeroIdx}"]`);
      }
      if (!srcEl || !tgtEl) return;
      const sr = srcEl.getBoundingClientRect();
      const tr = tgtEl.getBoundingClientRect();
      const id = Date.now() + Math.random();
      const dur = duration || 1500;
      setBeamAnims(prev => [...prev, {
        id, color: color || '#ff2222',
        x1: sr.left + sr.width / 2, y1: sr.top + sr.height / 2,
        x2: tr.left + tr.width / 2, y2: tr.top + tr.height / 2,
      }]);
      // Also play explosion on target
      setTimeout(() => playAnimation('explosion', tgtEl, { duration: 800 }), 250);
      setTimeout(() => setBeamAnims(prev => prev.filter(a => a.id !== id)), dur);
    };
    socket.on('card_reveal', onReveal);
    socket.on('deck_search_add', onDeckSearchAdd);
    socket.on('reaction_chain_update', onChainUpdate);
    socket.on('reaction_chain_resolving_start', onChainResolvingStart);
    socket.on('reaction_chain_link_resolving', onChainLinkResolving);
    socket.on('reaction_chain_link_resolved', onChainLinkResolved);
    socket.on('reaction_chain_link_negated', onChainLinkNegated);
    socket.on('reaction_chain_done', onChainDone);
    socket.on('camera_flash', onCameraFlash);
    socket.on('toughness_hp_change', onToughnessHp);
    socket.on('creature_zone_move', onCreatureZoneMove);
    socket.on('fighting_atk_change', onFightingAtk);
    socket.on('summon_effect', onSummon);
    socket.on('burn_tick', onBurnTick);
    socket.on('play_zone_animation', onZoneAnim);
    const onNomuDraw = ({ playerIdx: drawPlayer }) => {
      const ownerLabel = drawPlayer === myIdx ? 'me' : 'opp';
      const handEl = ownerLabel === 'me' ? document.querySelector('.hand-container')
        : document.querySelector('.board-row'); // fallback
      if (!handEl) return;
      const r = handEl.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      // Spawn purple particles
      for (let i = 0; i < 12; i++) {
        const spark = document.createElement('div');
        spark.className = 'nomu-particle';
        const angle = (i / 12) * 360 + Math.random() * 30;
        const dist = 20 + Math.random() * 40;
        spark.style.cssText = `
          position:fixed; left:${cx}px; top:${cy}px; width:${4+Math.random()*4}px; height:${4+Math.random()*4}px;
          border-radius:50%; background:rgba(160,80,255,0.9); pointer-events:none; z-index:9999;
          box-shadow: 0 0 6px rgba(180,100,255,0.8), 0 0 12px rgba(140,60,220,0.4);
          animation: nomuSparkle 0.7s ease-out ${i*30}ms forwards;
          --np-x: ${Math.cos(angle*Math.PI/180)*dist}px;
          --np-y: ${Math.sin(angle*Math.PI/180)*dist - 30}px;
        `;
        document.body.appendChild(spark);
        setTimeout(() => spark.remove(), 1000);
      }
    };
    socket.on('nomu_draw', onNomuDraw);
    socket.on('level_change', onLevelChange);
    socket.on('ability_activated', onAbilityActivated);
    socket.on('play_beam_animation', onBeamAnimation);
    const onHeroAscension = ({ owner, heroIdx, oldHero, newHero }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const el = document.querySelector(`[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      // Phase 1: radial light burst overlay
      const burst = document.createElement('div');
      burst.className = 'ascension-burst';
      burst.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:9999;pointer-events:none;`;
      document.body.appendChild(burst);
      setTimeout(() => burst.remove(), 2200);

      // Phase 2: spiraling particles rising from the hero
      const colors = ['#ff44aa','#aa44ff','#4488ff','#44ff88','#ffdd44','#ff4444','#ffffff'];
      for (let i = 0; i < 40; i++) {
        const p = document.createElement('div');
        const c = colors[i % colors.length];
        const size = 3 + Math.random() * 5;
        const angle = (i / 40) * 720 + Math.random() * 60;
        const dist = 30 + Math.random() * 80;
        const rise = 60 + Math.random() * 120;
        const delay = Math.random() * 600;
        p.style.cssText = `
          position:fixed;left:${cx}px;top:${cy}px;width:${size}px;height:${size}px;
          border-radius:50%;background:${c};pointer-events:none;z-index:10000;opacity:0;
          box-shadow:0 0 ${size*2}px ${c};
          animation:ascensionParticle 1.4s ease-out ${delay}ms forwards;
          --ap-x:${Math.cos(angle*Math.PI/180)*dist}px;
          --ap-y:${-rise}px;
        `;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 2200);
      }

      // Phase 3: firework bursts at staggered heights
      const fireworkColors = ['#ff44aa','#aa44ff','#ffdd44','#44ff88','#4488ff'];
      for (let f = 0; f < 5; f++) {
        const fx = cx + (Math.random() - 0.5) * r.width * 2;
        const fy = cy - 40 - Math.random() * 120;
        const fDelay = 300 + f * 200 + Math.random() * 150;
        const fc = fireworkColors[f % fireworkColors.length];
        for (let s = 0; s < 14; s++) {
          const sp = document.createElement('div');
          const sa = (s / 14) * 360;
          const sd = 15 + Math.random() * 35;
          const ss = 2 + Math.random() * 3;
          sp.style.cssText = `
            position:fixed;left:${fx}px;top:${fy}px;width:${ss}px;height:${ss}px;
            border-radius:50%;background:${fc};pointer-events:none;z-index:10001;opacity:0;
            box-shadow:0 0 ${ss*3}px ${fc}, 0 0 ${ss*6}px ${fc}44;
            animation:fireworkSpark .9s ease-out ${fDelay}ms forwards;
            --fw-x:${Math.cos(sa*Math.PI/180)*sd}px;
            --fw-y:${Math.sin(sa*Math.PI/180)*sd}px;
          `;
          document.body.appendChild(sp);
          setTimeout(() => sp.remove(), fDelay + 1200);
        }
      }

      // Phase 4: golden ring expanding from hero
      const ring = document.createElement('div');
      ring.style.cssText = `
        position:fixed;left:${cx}px;top:${cy}px;width:0;height:0;
        border:3px solid rgba(255,220,100,.9);border-radius:50%;pointer-events:none;z-index:10002;
        transform:translate(-50%,-50%);box-shadow:0 0 20px rgba(255,200,50,.6),inset 0 0 20px rgba(255,200,50,.3);
        animation:ascensionRing 1.2s ease-out 200ms forwards;
      `;
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 1600);
    };
    socket.on('hero_ascension', onHeroAscension);
    const onWillyLeprechaun = ({ owner, heroIdx }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const el = document.querySelector(`[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const symbols = ['🍀','🌈','🪙','🫕','☘️','💰','🌈','🍀','🪙','💰','☘️','🫕'];
      for (let i = 0; i < 24; i++) {
        const p = document.createElement('div');
        const sym = symbols[i % symbols.length];
        const angle = (i / 24) * 360 + Math.random() * 30;
        const dist = 25 + Math.random() * 60;
        const rise = 20 + Math.random() * 80;
        const delay = Math.random() * 500;
        const size = 12 + Math.random() * 10;
        p.textContent = sym;
        p.style.cssText = `
          position:fixed;left:${cx}px;top:${cy}px;font-size:${size}px;
          pointer-events:none;z-index:10000;opacity:0;
          animation:willyParticle 1.6s ease-out ${delay}ms forwards;
          --wp-x:${Math.cos(angle*Math.PI/180)*dist}px;
          --wp-y:${-rise}px;
        `;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 2300);
      }
      // Golden glow burst
      const glow = document.createElement('div');
      glow.style.cssText = `
        position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;
        border-radius:8px;z-index:9999;pointer-events:none;
        background:radial-gradient(ellipse at center, rgba(255,215,0,.8) 0%, rgba(50,200,50,.4) 40%, transparent 70%);
        animation:ascensionBurstAnim 1.8s ease-out forwards;
      `;
      document.body.appendChild(glow);
      setTimeout(() => glow.remove(), 2000);
    };
    socket.on('willy_leprechaun', onWillyLeprechaun);
    const onAlleriaSpiderRedirect = ({ srcOwner, srcHeroIdx, tgtOwner, tgtHeroIdx, alleriaOwner, alleriaHeroIdx }) => {
      const srcLabel = srcOwner === myIdx ? 'me' : 'opp';
      const tgtLabel = tgtOwner === myIdx ? 'me' : 'opp';
      const srcEl = document.querySelector(`[data-hero-zone][data-hero-owner="${srcLabel}"][data-hero-idx="${srcHeroIdx}"]`);
      const tgtEl = document.querySelector(`[data-hero-zone][data-hero-owner="${tgtLabel}"][data-hero-idx="${tgtHeroIdx}"]`);
      if (!srcEl || !tgtEl) return;
      const sr = srcEl.getBoundingClientRect();
      const tr = tgtEl.getBoundingClientRect();
      const sx = sr.left + sr.width / 2, sy = sr.top + sr.height / 2;
      const tx = tr.left + tr.width / 2, ty = tr.top + tr.height / 2;
      const dx = tx - sx, dy = ty - sy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;

      // Spider thread line
      const thread = document.createElement('div');
      thread.style.cssText = `
        position:fixed;left:${sx}px;top:${sy}px;width:0;height:2px;
        background:linear-gradient(90deg, rgba(180,180,180,.9), rgba(220,220,220,.6));
        transform-origin:0 50%;transform:rotate(${angle}deg);
        pointer-events:none;z-index:10000;box-shadow:0 0 4px rgba(200,200,200,.5);
        animation:spiderThread .4s ease-out forwards;--thread-len:${dist}px;
      `;
      document.body.appendChild(thread);

      // Spiders running along the thread
      const spiderEmoji = '🕷️';
      for (let s = 0; s < 6; s++) {
        const spider = document.createElement('div');
        const delay = 300 + s * 120;
        spider.textContent = spiderEmoji;
        spider.style.cssText = `
          position:fixed;left:${sx}px;top:${sy - 8}px;font-size:14px;
          pointer-events:none;z-index:10001;opacity:0;
          animation:spiderRun 0.7s ease-in-out ${delay}ms forwards;
          --sr-x:${dx}px;--sr-y:${dy}px;
        `;
        document.body.appendChild(spider);
        setTimeout(() => spider.remove(), delay + 900);
      }

      // Cleanup thread after spiders finish
      setTimeout(() => {
        thread.style.animation = 'spiderThreadFade .3s ease-out forwards';
        setTimeout(() => thread.remove(), 400);
      }, 1200);
    };
    socket.on('alleria_spider_redirect', onAlleriaSpiderRedirect);
    const onDarkControl = ({ owner, heroIdx }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const el = document.querySelector(`[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      // Dark tendrils radiating inward
      for (let i = 0; i < 16; i++) {
        const tendril = document.createElement('div');
        const angle = (i / 16) * Math.PI * 2;
        const dist = 60 + Math.random() * 40;
        const sx = Math.cos(angle) * dist, sy = Math.sin(angle) * dist;
        tendril.style.cssText = `
          position:fixed;left:${cx + sx}px;top:${cy + sy}px;
          width:3px;height:3px;border-radius:50%;
          background:radial-gradient(circle,#9b30ff,#4b0082);
          box-shadow:0 0 6px #9b30ff,0 0 12px #4b0082;
          pointer-events:none;z-index:10000;opacity:0;
          animation:darkTendril .7s ease-in ${i * 40}ms forwards;
          --dt-x:${-sx}px;--dt-y:${-sy}px;
        `;
        document.body.appendChild(tendril);
        setTimeout(() => tendril.remove(), 700 + i * 40 + 100);
      }
      // Central dark pulse
      const pulse = document.createElement('div');
      pulse.style.cssText = `
        position:fixed;left:${cx - 30}px;top:${cy - 30}px;
        width:60px;height:60px;border-radius:50%;
        border:2px solid #9b30ff;
        pointer-events:none;z-index:10000;opacity:0;
        animation:darkControlPulse .6s ease-out .5s forwards;
      `;
      document.body.appendChild(pulse);
      setTimeout(() => pulse.remove(), 1200);
      // Dark eye symbol
      const eye = document.createElement('div');
      eye.textContent = '👁️';
      eye.style.cssText = `
        position:fixed;left:${cx - 12}px;top:${cy - 12}px;
        font-size:24px;pointer-events:none;z-index:10001;opacity:0;
        animation:darkEyeAppear .8s ease-out .4s forwards;
      `;
      document.body.appendChild(eye);
      setTimeout(() => eye.remove(), 1300);
    };
    socket.on('dark_control', onDarkControl);
    const onBurningFingerSlash = ({ owner, heroIdx, zoneSlot }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const sel = zoneSlot >= 0
        ? `[data-support-zone][data-support-owner="${ownerLabel}"][data-support-hero="${heroIdx}"][data-support-slot="${zoneSlot}"]`
        : `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`;
      const el = document.querySelector(sel);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      // Fiery slash line
      const slash = document.createElement('div');
      slash.style.cssText = `
        position:fixed;left:${cx - 50}px;top:${cy - 4}px;width:100px;height:8px;
        background:linear-gradient(90deg,transparent,#ff6600,#ffcc00,#ff6600,transparent);
        border-radius:4px;pointer-events:none;z-index:10000;opacity:0;
        transform:rotate(-30deg);
        animation:fierySlash .35s ease-out forwards;
        box-shadow:0 0 16px #ff6600,0 0 30px #ff4400;
      `;
      document.body.appendChild(slash);
      // Sparks
      for (let i = 0; i < 10; i++) {
        const spark = document.createElement('div');
        const sx = (Math.random() - 0.5) * 60, sy = (Math.random() - 0.5) * 40;
        const hue = 20 + Math.random() * 30;
        spark.style.cssText = `
          position:fixed;left:${cx}px;top:${cy}px;
          width:4px;height:4px;border-radius:50%;
          background:hsl(${hue},100%,60%);
          box-shadow:0 0 4px hsl(${hue},100%,50%);
          pointer-events:none;z-index:10001;opacity:0;
          animation:fireSpark .5s ease-out ${80 + i * 30}ms forwards;
          --fs-x:${sx}px;--fs-y:${sy - 20}px;
        `;
        document.body.appendChild(spark);
        setTimeout(() => spark.remove(), 650 + i * 30);
      }
      setTimeout(() => slash.remove(), 500);
    };
    socket.on('burning_finger_slash', onBurningFingerSlash);
    const onPunchImpact = ({ owner, heroIdx, zoneSlot }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const sel = zoneSlot >= 0
        ? `[data-equip-zone][data-equip-owner="${ownerLabel}"][data-equip-hero="${heroIdx}"][data-equip-slot="${zoneSlot}"]`
        : `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`;
      const el = document.querySelector(sel);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      // Fist emoji
      const fist = document.createElement('div');
      fist.textContent = '👊';
      fist.style.cssText = `
        position:fixed;left:${cx - 16}px;top:${cy - 16}px;font-size:32px;
        pointer-events:none;z-index:10001;opacity:0;
        animation:punchStrike .35s ease-out forwards;
      `;
      document.body.appendChild(fist);
      // Impact ring
      const ring = document.createElement('div');
      ring.style.cssText = `
        position:fixed;left:${cx - 20}px;top:${cy - 20}px;width:40px;height:40px;
        border-radius:50%;border:3px solid #ffcc00;
        pointer-events:none;z-index:10000;opacity:0;
        animation:punchRing .4s ease-out .1s forwards;
        box-shadow:0 0 10px #ffcc00;
      `;
      document.body.appendChild(ring);
      // Impact lines
      for (let i = 0; i < 6; i++) {
        const line = document.createElement('div');
        const angle = (i / 6) * Math.PI * 2;
        const len = 20 + Math.random() * 15;
        line.style.cssText = `
          position:fixed;left:${cx}px;top:${cy}px;
          width:${len}px;height:3px;border-radius:2px;
          background:#ffcc00;pointer-events:none;z-index:10000;opacity:0;
          transform-origin:0 50%;transform:rotate(${angle}rad);
          animation:punchLine .3s ease-out .05s forwards;
        `;
        document.body.appendChild(line);
        setTimeout(() => line.remove(), 400);
      }
      setTimeout(() => { fist.remove(); ring.remove(); }, 500);
    };
    socket.on('punch_impact', onPunchImpact);
    const onBaihuPetrify = ({ owner, heroIdx }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const el = document.querySelector(`[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const stone = document.createElement('div');
      stone.style.cssText = `position:fixed;left:${cx-35}px;top:${cy-35}px;width:70px;height:70px;border-radius:8px;background:rgba(140,140,140,.6);pointer-events:none;z-index:10000;opacity:0;animation:petrifyFlash .8s ease-out forwards;border:2px solid rgba(180,180,180,.5);`;
      document.body.appendChild(stone);
      setTimeout(() => stone.remove(), 900);
    };
    socket.on('baihu_petrify', onBaihuPetrify);
    const onCardinalBeastWin = ({ owner }) => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:20000;pointer-events:none;overflow:hidden;';
      // Animals: Tiger, Dragon, Turtle, Phoenix
      const animals = ['🐅', '🐉', '🐢', '🐦‍🔥'];
      const animalColors = ['#ffaa00', '#00ccff', '#00cc66', '#ff4444'];
      const animalAnims = ['cardinalAnimalRight', 'cardinalAnimalDown', 'cardinalAnimalLeft', 'cardinalAnimalUp'];
      // Center burst with 4 animals spiraling outward
      for (let a = 0; a < 4; a++) {
        const el = document.createElement('div');
        el.style.cssText = `position:absolute;left:50%;top:50%;font-size:60px;transform:translate(-50%,-50%);z-index:20002;animation:${animalAnims[a]} 2.5s ease-out forwards;text-shadow:0 0 20px ${animalColors[a]};`;
        el.textContent = animals[a];
        overlay.appendChild(el);
      }
      // Fireworks
      for (let i = 0; i < 30; i++) {
        const fw = document.createElement('div');
        const x = 10 + Math.random() * 80;
        const y = 10 + Math.random() * 70;
        const delay = Math.random() * 2;
        const color = animalColors[Math.floor(Math.random() * 4)];
        const size = 6 + Math.random() * 8;
        fw.style.cssText = `position:absolute;left:${x}%;top:${y}%;width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:0;animation:cardinalFirework 1s ${delay}s ease-out forwards;box-shadow:0 0 ${size*2}px ${color};`;
        overlay.appendChild(fw);
      }
      // Title text
      const title = document.createElement('div');
      title.style.cssText = 'position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);font-size:28px;font-weight:900;color:#ffd700;text-shadow:0 0 30px #ffd700,0 0 60px #ff8800;opacity:0;animation:cardinalTitle 3s 0.3s ease-out forwards;white-space:nowrap;font-family:var(--font-orbit),sans-serif;';
      title.textContent = '⭐ CARDINAL BEASTS ASSEMBLED ⭐';
      overlay.appendChild(title);
      document.body.appendChild(overlay);
      setTimeout(() => overlay.remove(), 3600);
    };
    socket.on('cardinal_beast_win', onCardinalBeastWin);
    const onQinglongLightning = ({ srcOwner, srcHeroIdx, srcZoneSlot, tgtOwner, tgtHeroIdx, tgtZoneSlot, step }) => {
      const sLabel = srcOwner === myIdx ? 'me' : 'opp';
      const tLabel = tgtOwner === myIdx ? 'me' : 'opp';
      const srcSel = srcZoneSlot >= 0
        ? `[data-support-zone][data-support-owner="${sLabel}"][data-support-hero="${srcHeroIdx}"][data-support-slot="${srcZoneSlot}"]`
        : `[data-hero-zone][data-hero-owner="${sLabel}"][data-hero-idx="${srcHeroIdx}"]`;
      const tgtSel = tgtZoneSlot >= 0
        ? `[data-support-zone][data-support-owner="${tLabel}"][data-support-hero="${tgtHeroIdx}"][data-support-slot="${tgtZoneSlot}"]`
        : `[data-hero-zone][data-hero-owner="${tLabel}"][data-hero-idx="${tgtHeroIdx}"]`;
      const srcEl = document.querySelector(srcSel);
      const tgtEl = document.querySelector(tgtSel);
      if (!srcEl || !tgtEl) return;
      const sr = srcEl.getBoundingClientRect();
      const tr = tgtEl.getBoundingClientRect();
      const sx = sr.left+sr.width/2, sy = sr.top+sr.height/2;
      const tx = tr.left+tr.width/2, ty = tr.top+tr.height/2;
      const dx = tx-sx, dy = ty-sy;
      const dist = Math.sqrt(dx*dx+dy*dy);
      const angle = Math.atan2(dy,dx)*180/Math.PI;
      // Spawn 3 erratic bolts with slight offsets
      for (let b = 0; b < 3; b++) {
        const bolt = document.createElement('div');
        const yOff = (b - 1) * (4 + Math.random() * 4);
        const h = 5 + Math.random() * 4;
        const delay = b * 40;
        bolt.style.cssText = `position:fixed;left:${sx}px;top:${sy-h/2+yOff}px;width:0;height:${h}px;`
          + `background:linear-gradient(90deg,transparent,#ffee55,#ffffff,#ffee55,transparent);`
          + `border-radius:${h/2}px;transform-origin:0 50%;transform:rotate(${angle + (Math.random()-0.5)*4}deg);`
          + `pointer-events:none;z-index:10000;`
          + `box-shadow:0 0 14px #ffcc00,0 0 30px #ffaa00,0 0 50px rgba(255,200,0,.4);`
          + `animation:lightningBolt .35s ${delay}ms ease-out forwards;--bolt-len:${dist}px;`;
        document.body.appendChild(bolt);
        setTimeout(() => bolt.remove(), 450 + delay);
      }
      // Impact flash on target
      const flash = document.createElement('div');
      flash.style.cssText = `position:fixed;left:${tx-20}px;top:${ty-20}px;width:40px;height:40px;border-radius:50%;`
        + `background:radial-gradient(circle,rgba(255,255,200,.9),rgba(255,220,50,.5),transparent);`
        + `pointer-events:none;z-index:10001;animation:petrifyFlash .4s 100ms ease-out forwards;`;
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 550);
    };
    socket.on('qinglong_lightning', onQinglongLightning);
    const onJumpscareBox = ({ owner, heroIdx }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const el = document.querySelector(`[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      // Box base
      const box = document.createElement('div');
      box.textContent = '🎁';
      box.style.cssText = `
        position:fixed;left:${cx - 16}px;top:${cy}px;font-size:32px;
        pointer-events:none;z-index:10000;
        animation:jumpscareBoxShake .4s ease-in-out forwards;
      `;
      document.body.appendChild(box);
      // Spring out after shake
      setTimeout(() => {
        const spring = document.createElement('div');
        spring.textContent = '🤡';
        spring.style.cssText = `
          position:fixed;left:${cx - 18}px;top:${cy - 10}px;font-size:36px;
          pointer-events:none;z-index:10001;opacity:0;
          animation:jumpscareSpring .5s ease-out forwards;
        `;
        document.body.appendChild(spring);
        // Scare stars
        for (let i = 0; i < 6; i++) {
          const star = document.createElement('div');
          star.textContent = '⭐';
          const angle = (i / 6) * Math.PI * 2;
          const dist = 30 + Math.random() * 20;
          star.style.cssText = `
            position:fixed;left:${cx}px;top:${cy - 20}px;font-size:12px;
            pointer-events:none;z-index:10001;opacity:0;
            animation:jumpscareStars .5s ease-out ${i * 50}ms forwards;
            --js-x:${Math.cos(angle) * dist}px;--js-y:${Math.sin(angle) * dist - 15}px;
          `;
          document.body.appendChild(star);
          setTimeout(() => star.remove(), 600 + i * 50);
        }
        setTimeout(() => spring.remove(), 600);
      }, 350);
      setTimeout(() => box.remove(), 800);
    };
    socket.on('jumpscare_box', onJumpscareBox);
    const onAntiMagicBubble = ({ owner, heroIdx }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const el = document.querySelector(`[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const bubble = document.createElement('div');
      bubble.style.cssText = `
        position:fixed;left:${cx - 35}px;top:${cy - 35}px;width:70px;height:70px;
        border-radius:50%;border:3px solid rgba(100,180,255,.6);
        background:radial-gradient(circle at 30% 30%, rgba(180,220,255,.3), rgba(100,160,255,.1));
        pointer-events:none;z-index:10000;opacity:0;
        animation:magicBubble 1s ease-out forwards;
        box-shadow:0 0 20px rgba(100,180,255,.4), inset 0 0 15px rgba(150,200,255,.2);
      `;
      document.body.appendChild(bubble);
      // Shine highlight
      const shine = document.createElement('div');
      shine.style.cssText = `
        position:fixed;left:${cx - 12}px;top:${cy - 20}px;width:10px;height:6px;
        border-radius:50%;background:rgba(255,255,255,.6);
        pointer-events:none;z-index:10001;opacity:0;
        animation:magicBubbleShine 1s ease-out .1s forwards;
        transform:rotate(-30deg);
      `;
      document.body.appendChild(shine);
      setTimeout(() => { bubble.remove(); shine.remove(); }, 1100);
    };
    socket.on('anti_magic_bubble', onAntiMagicBubble);
    const onFireshieldCorona = ({ owner, heroIdx }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const el = document.querySelector(`[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      // Flame corona ring
      for (let i = 0; i < 14; i++) {
        const flame = document.createElement('div');
        const angle = (i / 14) * Math.PI * 2;
        const dist = 35 + Math.random() * 10;
        const fx = Math.cos(angle) * dist, fy = Math.sin(angle) * dist;
        const hue = 10 + Math.random() * 30;
        flame.style.cssText = `
          position:fixed;left:${cx + fx - 5}px;top:${cy + fy - 8}px;
          width:10px;height:16px;border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;
          background:radial-gradient(ellipse, hsl(${hue},100%,65%), hsl(${hue-10},100%,45%));
          pointer-events:none;z-index:10000;opacity:0;
          transform:rotate(${angle + Math.PI}rad);
          animation:fireshieldFlame .7s ease-out ${i * 30}ms forwards;
          box-shadow:0 0 8px hsl(${hue},100%,50%);
        `;
        document.body.appendChild(flame);
        setTimeout(() => flame.remove(), 750 + i * 30);
      }
      // Central glow
      const glow = document.createElement('div');
      glow.style.cssText = `
        position:fixed;left:${cx - 40}px;top:${cy - 40}px;width:80px;height:80px;
        border-radius:50%;pointer-events:none;z-index:9999;opacity:0;
        background:radial-gradient(circle, rgba(255,120,0,.4), transparent 70%);
        animation:fireshieldGlow .8s ease-out forwards;
      `;
      document.body.appendChild(glow);
      setTimeout(() => glow.remove(), 900);
    };
    socket.on('fireshield_corona', onFireshieldCorona);
    const onSurpriseFlip = ({ owner, heroIdx, cardName, isBakhmSlot, bakhmZoneSlot }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      let el;
      if (isBakhmSlot && bakhmZoneSlot >= 0) {
        el = document.querySelector(`[data-support-zone][data-support-owner="${ownerLabel}"][data-support-hero="${heroIdx}"][data-support-slot="${bakhmZoneSlot}"]`);
      } else {
        el = document.querySelector(`[data-surprise-zone][data-surprise-owner="${ownerLabel}"][data-surprise-hero="${heroIdx}"]`);
      }
      if (el) {
        el.classList.add('surprise-flipping');
        playAnimation('explosion', el, { duration: 1000 });
        setTimeout(() => el.classList.remove('surprise-flipping'), 1200);
      }
    };
    socket.on('surprise_flip', onSurpriseFlip);
    const onSurpriseReset = ({ owner, heroIdx, cardName, isBakhmSlot, zoneSlot }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      let el;
      if (isBakhmSlot && zoneSlot >= 0) {
        el = document.querySelector(`[data-support-zone][data-support-owner="${ownerLabel}"][data-support-hero="${heroIdx}"][data-support-slot="${zoneSlot}"]`);
      } else {
        el = document.querySelector(`[data-surprise-zone][data-surprise-owner="${ownerLabel}"][data-surprise-hero="${heroIdx}"]`);
      }
      if (el) {
        el.classList.add('surprise-resetting');
        playAnimation('sand_reset', el, { duration: 1200 });
        setTimeout(() => el.classList.remove('surprise-resetting'), 1400);
      }
    };
    socket.on('surprise_reset', onSurpriseReset);
    const onPermanentAnim = ({ owner, permId, type }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const el = document.querySelector(`[data-perm-id="${permId}"][data-perm-owner="${ownerLabel}"]`);
      if (el) playAnimation(type || 'holy_revival', el, { duration: 1200 });
    };
    socket.on('play_permanent_animation', onPermanentAnim);
    const onRamAnimation = ({ sourceOwner, sourceHeroIdx, targetOwner, targetHeroIdx, targetZoneSlot, targetZoneType, targetPermId, cardName, duration, trailType }) => {
      const srcLabel = sourceOwner === myIdx ? 'me' : 'opp';
      const tgtLabel = targetOwner === myIdx ? 'me' : 'opp';
      const srcEl = document.querySelector(`[data-hero-zone][data-hero-owner="${srcLabel}"][data-hero-idx="${sourceHeroIdx}"]`);
      let tgtEl;
      if (targetZoneType === 'ability' && targetHeroIdx >= 0 && targetZoneSlot >= 0) {
        tgtEl = document.querySelector(`[data-ability-zone][data-ability-owner="${tgtLabel}"][data-ability-hero="${targetHeroIdx}"][data-ability-slot="${targetZoneSlot}"]`);
      } else if (targetZoneType === 'permanent' && targetPermId) {
        tgtEl = document.querySelector(`[data-perm-id="${targetPermId}"][data-perm-owner="${tgtLabel}"]`);
      } else if (targetZoneSlot !== undefined && targetZoneSlot >= 0) {
        tgtEl = document.querySelector(`[data-support-zone][data-support-owner="${tgtLabel}"][data-support-hero="${targetHeroIdx}"][data-support-slot="${targetZoneSlot}"]`);
      } else {
        tgtEl = document.querySelector(`[data-hero-zone][data-hero-owner="${tgtLabel}"][data-hero-idx="${targetHeroIdx}"]`);
      }
      if (!srcEl || !tgtEl) return;
      const sr = srcEl.getBoundingClientRect();
      const tr = tgtEl.getBoundingClientRect();
      const dx = tr.left + tr.width / 2 - (sr.left + sr.width / 2);
      const dy = tr.top + tr.height / 2 - (sr.top + sr.height / 2);
      // Angle so the card's top edge faces the target
      const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      const id = Date.now() + Math.random();
      const dur = duration || 1600;
      setRamAnims(prev => [...prev, {
        id, cardName,
        srcX: sr.left + sr.width / 2, srcY: sr.top + sr.height / 2,
        tgtX: tr.left + tr.width / 2, tgtY: tr.top + tr.height / 2,
        srcOwner: sourceOwner, srcHeroIdx: sourceHeroIdx, dur, angle, trailType,
      }]);
      setTimeout(() => setRamAnims(prev => prev.filter(a => a.id !== id)), dur);
    };
    socket.on('play_ram_animation', onRamAnimation);
    const onCardTransfer = ({ sourceOwner, sourceHeroIdx, sourceZoneSlot, targetOwner, targetHeroIdx, targetZoneSlot, cardName, duration, particles }) => {
      const srcLabel = sourceOwner === myIdx ? 'me' : 'opp';
      const tgtLabel = targetOwner === myIdx ? 'me' : 'opp';
      // Support hero zones (zoneSlot === -1) as source or target
      const srcEl = sourceZoneSlot < 0
        ? document.querySelector(`[data-hero-zone][data-hero-owner="${srcLabel}"][data-hero-idx="${sourceHeroIdx}"]`)
        : document.querySelector(`[data-support-zone][data-support-owner="${srcLabel}"][data-support-hero="${sourceHeroIdx}"][data-support-slot="${sourceZoneSlot}"]`);
      const tgtEl = targetZoneSlot < 0
        ? document.querySelector(`[data-hero-zone][data-hero-owner="${tgtLabel}"][data-hero-idx="${targetHeroIdx}"]`)
        : document.querySelector(`[data-support-zone][data-support-owner="${tgtLabel}"][data-support-hero="${targetHeroIdx}"][data-support-slot="${targetZoneSlot}"]`);
      if (!srcEl || !tgtEl) return;
      const sr = srcEl.getBoundingClientRect();
      const tr = tgtEl.getBoundingClientRect();
      const id = Date.now() + Math.random();
      const dur = duration || 800;
      setTransferAnims(prev => [...prev, {
        id, cardName,
        srcX: sr.left + sr.width / 2 - 34, srcY: sr.top + sr.height / 2 - 48,
        tgtX: tr.left + tr.width / 2 - 34, tgtY: tr.top + tr.height / 2 - 48,
        dur,
      }]);
      setTimeout(() => setTransferAnims(prev => prev.filter(a => a.id !== id)), dur + 100);
      // Play particle effects on source and target if requested
      if (particles) {
        playAnimation(particles, srcEl, { duration: dur });
        setTimeout(() => playAnimation(particles, tgtEl, { duration: dur }), 200);
      }
    };
    socket.on('play_card_transfer', onCardTransfer);
    const onProjectileAnimation = ({ sourceOwner, sourceHeroIdx, targetOwner, targetHeroIdx, targetZoneSlot, emoji, duration, trailClass, emojiStyle, projectileClass }) => {
      const srcLabel = sourceOwner === myIdx ? 'me' : 'opp';
      const tgtLabel = targetOwner === myIdx ? 'me' : 'opp';
      const srcEl = document.querySelector(`[data-hero-zone][data-hero-owner="${srcLabel}"][data-hero-idx="${sourceHeroIdx}"]`);
      let tgtEl;
      if (targetZoneSlot !== undefined && targetZoneSlot >= 0) {
        tgtEl = document.querySelector(`[data-support-zone][data-support-owner="${tgtLabel}"][data-support-hero="${targetHeroIdx}"][data-support-slot="${targetZoneSlot}"]`);
      } else {
        tgtEl = document.querySelector(`[data-hero-zone][data-hero-owner="${tgtLabel}"][data-hero-idx="${targetHeroIdx}"]`);
      }
      if (!srcEl || !tgtEl) return;
      const sr = srcEl.getBoundingClientRect();
      const tr = tgtEl.getBoundingClientRect();
      const id = Date.now() + Math.random();
      const dur = duration || 600;
      setProjectileAnims(prev => [...prev, {
        id, emoji: emoji || '🐦‍🔥',
        trailClass: trailClass || null,
        emojiStyle: emojiStyle || null,
        projectileClass: projectileClass || null,
        srcX: sr.left + sr.width / 2, srcY: sr.top + sr.height / 2,
        tgtX: tr.left + tr.width / 2, tgtY: tr.top + tr.height / 2,
        dur,
      }]);
      setTimeout(() => setProjectileAnims(prev => prev.filter(a => a.id !== id)), dur + 200);
    };
    socket.on('play_projectile_animation', onProjectileAnimation);
    const onButterflyCloud = ({ sourceOwner, sourceHeroIdx, targets }) => {
      const srcLabel = sourceOwner === myIdx ? 'me' : 'opp';
      const srcEl = document.querySelector(`[data-hero-zone][data-hero-owner="${srcLabel}"][data-hero-idx="${sourceHeroIdx}"]`);
      if (!srcEl) return;
      const sr = srcEl.getBoundingClientRect();
      const srcX = sr.left + sr.width / 2;
      const srcY = sr.top + sr.height / 2;

      // Resolve target element positions
      const tgtPositions = [];
      for (const t of (targets || [])) {
        const tLabel = t.owner === myIdx ? 'me' : 'opp';
        let el;
        if (t.type === 'creature' && t.zoneSlot != null) {
          el = document.querySelector(`[data-support-zone][data-support-owner="${tLabel}"][data-support-hero="${t.heroIdx}"][data-support-slot="${t.zoneSlot}"]`);
        } else {
          el = document.querySelector(`[data-hero-zone][data-hero-owner="${tLabel}"][data-hero-idx="${t.heroIdx}"]`);
        }
        if (el) {
          const r = el.getBoundingClientRect();
          tgtPositions.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, el });
        }
      }
      if (tgtPositions.length === 0) return;

      // Inject keyframes once
      if (!document.getElementById('butterfly-cloud-keyframes')) {
        const style = document.createElement('style');
        style.id = 'butterfly-cloud-keyframes';
        style.textContent = `
          @keyframes butterflyFly {
            0% { transform: translate(0,0) scale(0.3) rotate(0deg); opacity: 0; }
            15% { opacity: 1; transform: translate(calc(var(--bfDx)*0.15 + var(--bfWobble1)), calc(var(--bfDy)*0.15 + var(--bfWobble2))) scale(0.8) rotate(var(--bfSpin1)); }
            50% { transform: translate(calc(var(--bfDx)*0.5 + var(--bfWobble2)*1.5), calc(var(--bfDy)*0.5 + var(--bfWobble1)*-1)) scale(1) rotate(var(--bfSpin2)); }
            85% { opacity: 1; transform: translate(calc(var(--bfDx)*0.85 + var(--bfWobble1)*-0.5), calc(var(--bfDy)*0.85 + var(--bfWobble2)*0.5)) scale(0.9) rotate(var(--bfSpin3)); }
            100% { transform: translate(var(--bfDx), var(--bfDy)) scale(0.4) rotate(var(--bfSpin4)); opacity: 0; }
          }
          @keyframes butterflyBurst {
            0% { transform: scale(0); opacity: 0.9; }
            50% { transform: scale(1.5); opacity: 0.7; }
            100% { transform: scale(2.5); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      // Spawn butterflies from source to each target
      const totalButterflies = Math.min(120, tgtPositions.length * 30);
      const perTarget = Math.floor(totalButterflies / tgtPositions.length);
      const butterflyChars = ['🦋'];
      const colors = ['#ffd700','#ffec80','#fff4cc','#f0c040','#ffe066'];

      for (let ti = 0; ti < tgtPositions.length; ti++) {
        const tgt = tgtPositions[ti];
        const dx = tgt.x - srcX;
        const dy = tgt.y - srcY;

        for (let i = 0; i < perTarget; i++) {
          const bf = document.createElement('div');
          const delay = Math.random() * 500;
          const dur = 700 + Math.random() * 500;
          const wobble1 = -30 + Math.random() * 60;
          const wobble2 = -25 + Math.random() * 50;
          const spin1 = -40 + Math.random() * 80;
          const spin2 = -60 + Math.random() * 120;
          const spin3 = -30 + Math.random() * 60;
          const spin4 = Math.random() * 360;
          const size = 10 + Math.random() * 10;
          const color = colors[Math.floor(Math.random() * colors.length)];

          bf.textContent = butterflyChars[0];
          bf.style.cssText = `
            position:fixed; left:${srcX}px; top:${srcY}px; z-index:10200; pointer-events:none;
            font-size:${size}px; filter:drop-shadow(0 0 4px ${color}) drop-shadow(0 0 8px rgba(255,215,0,0.5));
            --bfDx:${dx + (-15 + Math.random()*30)}px; --bfDy:${dy + (-15 + Math.random()*30)}px;
            --bfWobble1:${wobble1}px; --bfWobble2:${wobble2}px;
            --bfSpin1:${spin1}deg; --bfSpin2:${spin2}deg; --bfSpin3:${spin3}deg; --bfSpin4:${spin4}deg;
            animation: butterflyFly ${dur}ms ease-in-out ${delay}ms forwards;
            opacity: 0;
          `;
          document.body.appendChild(bf);
          setTimeout(() => bf.remove(), delay + dur + 100);
        }

        // Golden burst at target on impact
        setTimeout(() => {
          const burst = document.createElement('div');
          burst.style.cssText = `
            position:fixed; left:${tgt.x - 40}px; top:${tgt.y - 40}px; width:80px; height:80px;
            z-index:10201; pointer-events:none; border-radius:50%;
            background: radial-gradient(circle, rgba(255,215,0,0.9) 0%, rgba(255,236,128,0.5) 40%, transparent 70%);
            animation: butterflyBurst 500ms ease-out forwards;
          `;
          document.body.appendChild(burst);
          setTimeout(() => burst.remove(), 600);
        }, 900);
      }
    };
    socket.on('butterfly_cloud_animation', onButterflyCloud);
    const onSmugCoinSave = ({ owner, heroIdx }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const heroEl = document.querySelector(`[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`);
      if (!heroEl) return;
      const hr = heroEl.getBoundingClientRect();
      const cx = hr.left + hr.width / 2;
      const cy = hr.top + hr.height / 2;

      // Inject keyframes once
      if (!document.getElementById('smug-coin-keyframes')) {
        const style = document.createElement('style');
        style.id = 'smug-coin-keyframes';
        style.textContent = `
          @keyframes smugCoinFall {
            0% { transform: translateY(var(--scStartY)) rotate(var(--scRot1)) scale(0.6); opacity: 0; }
            10% { opacity: 1; }
            70% { opacity: 1; transform: translateY(var(--scMidY)) rotate(var(--scRot2)) scale(1); }
            100% { transform: translateY(var(--scEndY)) rotate(var(--scRot3)) scale(0.8); opacity: 0; }
          }
          @keyframes smugCoinFlash {
            0% { transform: scale(0); opacity: 0.9; }
            40% { transform: scale(1.8); opacity: 0.6; }
            100% { transform: scale(3); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      // Golden flash on hero
      const flash = document.createElement('div');
      flash.style.cssText = `
        position:fixed; left:${cx - 50}px; top:${cy - 50}px; width:100px; height:100px;
        z-index:10201; pointer-events:none; border-radius:50%;
        background: radial-gradient(circle, rgba(255,200,50,0.95) 0%, rgba(255,170,0,0.5) 40%, transparent 70%);
        animation: smugCoinFlash 600ms ease-out forwards;
      `;
      document.body.appendChild(flash);
      setTimeout(() => flash.remove(), 700);

      // Rain ~100 sc.png coins from above onto the hero
      const coinCount = 100;
      for (let i = 0; i < coinCount; i++) {
        const coin = document.createElement('img');
        coin.src = '/data/sc.png';
        const size = 16 + Math.random() * 16;
        const xOff = -70 + Math.random() * 140;
        const startY = -120 - Math.random() * 200;
        const midY = -10 + Math.random() * 20;
        const endY = 30 + Math.random() * 40;
        const rot1 = Math.random() * 360;
        const rot2 = rot1 + (-180 + Math.random() * 360);
        const rot3 = rot2 + (-90 + Math.random() * 180);
        const delay = Math.random() * 800;
        const dur = 600 + Math.random() * 500;

        coin.style.cssText = `
          position:fixed; left:${cx + xOff - size/2}px; top:${cy - size/2}px;
          width:${size}px; height:${size}px; z-index:10200; pointer-events:none;
          object-fit:contain;
          filter: drop-shadow(0 0 3px rgba(255,200,50,0.8)) drop-shadow(0 0 6px rgba(255,170,0,0.4));
          --scStartY:${startY}px; --scMidY:${midY}px; --scEndY:${endY}px;
          --scRot1:${rot1}deg; --scRot2:${rot2}deg; --scRot3:${rot3}deg;
          animation: smugCoinFall ${dur}ms ease-in ${delay}ms forwards;
          opacity: 0;
        `;
        document.body.appendChild(coin);
        setTimeout(() => coin.remove(), delay + dur + 100);
      }
    };
    socket.on('smug_coin_save', onSmugCoinSave);
    const onDivineRainStart = ({ turn }) => {
      // Remove any existing rain overlay
      const existing = document.getElementById('divine-rain-overlay');
      if (existing) existing.remove();

      // Inject keyframes once
      if (!document.getElementById('divine-rain-keyframes')) {
        const style = document.createElement('style');
        style.id = 'divine-rain-keyframes';
        style.textContent = `
          @keyframes rainDrop {
            0% { transform: translateY(-20px) translateX(0); opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 0.7; }
            100% { transform: translateY(110vh) translateX(-30px); opacity: 0; }
          }
          @keyframes rainFlash {
            0% { opacity: 0; }
            5% { opacity: 0.15; }
            10% { opacity: 0; }
            100% { opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      const overlay = document.createElement('div');
      overlay.id = 'divine-rain-overlay';
      overlay.dataset.rainTurn = turn;
      overlay.style.cssText = `
        position:fixed; top:0; left:0; width:100vw; height:100vh;
        z-index:9500; pointer-events:none; overflow:hidden;
      `;

      // Flash on start
      const flash = document.createElement('div');
      flash.style.cssText = `
        position:absolute; top:0; left:0; width:100%; height:100%;
        background: rgba(100,150,255,0.15);
        animation: rainFlash 2s ease-out forwards;
      `;
      overlay.appendChild(flash);

      // Spawn rain drops in waves
      const dropCount = 200;
      for (let i = 0; i < dropCount; i++) {
        const drop = document.createElement('div');
        const x = Math.random() * 110 - 5;
        const dur = 0.5 + Math.random() * 0.6;
        const delay = Math.random() * 2;
        const width = 1 + Math.random() * 1.5;
        const height = 12 + Math.random() * 18;
        const opacity = 0.15 + Math.random() * 0.35;

        drop.style.cssText = `
          position:absolute; left:${x}%; top:-20px;
          width:${width}px; height:${height}px;
          background: linear-gradient(to bottom, rgba(140,180,255,0), rgba(140,180,255,${opacity}), rgba(180,210,255,${opacity * 0.5}));
          border-radius: 0 0 2px 2px;
          animation: rainDrop ${dur}s linear ${delay}s infinite;
          transform: rotate(-5deg);
        `;
        overlay.appendChild(drop);
      }

      document.body.appendChild(overlay);
    };
    socket.on('divine_rain_start', onDivineRainStart);
    const onMoeBomb = () => {
      // Inject keyframes once
      if (!document.getElementById('moe-bomb-keyframes')) {
        const style = document.createElement('style');
        style.id = 'moe-bomb-keyframes';
        style.textContent = `
          @keyframes moePulse {
            0% { transform: scale(0); opacity: 0; }
            15% { transform: scale(1); opacity: 1; }
            25% { transform: scale(1.3); }
            35% { transform: scale(0.95); }
            50% { transform: scale(1.5); }
            60% { transform: scale(1.0); }
            75% { transform: scale(1.8); filter: brightness(1.5) drop-shadow(0 0 30px rgba(255,50,80,0.9)); }
            85% { transform: scale(1.6); }
            95% { transform: scale(2.2); filter: brightness(2) drop-shadow(0 0 60px rgba(255,50,80,1)); }
            100% { transform: scale(6); opacity: 0; filter: brightness(3) drop-shadow(0 0 100px white); }
          }
          @keyframes moeFlash {
            0% { opacity: 0; }
            30% { opacity: 0.7; }
            100% { opacity: 0; }
          }
          @keyframes moePart {
            0% { transform: translate(0,0) rotate(0deg) scale(1); opacity: 1; }
            60% { opacity: 1; }
            100% { transform: translate(var(--mpDx), var(--mpDy)) rotate(var(--mpRot)) scale(var(--mpScale)); opacity: 0; }
          }
          @keyframes moeConfetti {
            0% { transform: translateY(0) rotateZ(0deg) rotateX(0deg); opacity: 1; }
            100% { transform: translateY(var(--mcFall)) rotateZ(var(--mcSpin)) rotateX(720deg); opacity: 0; }
          }
          @keyframes moeGlitter {
            0% { transform: translate(0,0) scale(0); opacity: 1; }
            50% { opacity: 1; transform: translate(var(--mgDx2), var(--mgDy2)) scale(1.2); }
            100% { transform: translate(var(--mgDx), var(--mgDy)) scale(0); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;

      // Container
      const container = document.createElement('div');
      container.style.cssText = `position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:10300;pointer-events:none;overflow:hidden;`;
      document.body.appendChild(container);

      // Giant pulsating heart — centered via wrapper so animation scale doesn't break position
      const heartWrap = document.createElement('div');
      heartWrap.style.cssText = `
        position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
        display:flex; align-items:center; justify-content:center;
      `;
      const heart = document.createElement('div');
      heart.textContent = '❤️';
      heart.style.cssText = `
        font-size:180px; line-height:1;
        animation: moePulse 2.8s ease-in-out forwards;
        filter: drop-shadow(0 0 30px rgba(255,50,80,0.8));
      `;
      heartWrap.appendChild(heart);
      container.appendChild(heartWrap);

      // Explosion at ~2.6s
      setTimeout(() => {
        // White flash
        const flash = document.createElement('div');
        flash.style.cssText = `
          position:absolute; top:0; left:0; width:100%; height:100%;
          background: radial-gradient(circle at 50% 50%, rgba(255,200,220,0.9) 0%, rgba(255,100,150,0.4) 30%, transparent 60%);
          animation: moeFlash 800ms ease-out forwards;
        `;
        container.appendChild(flash);

        // Exploding hearts
        const heartEmojis = ['❤️','💖','💗','💕','💘','💝','💓','🩷','🩵','💜'];
        for (let i = 0; i < 60; i++) {
          const p = document.createElement('div');
          const angle = (i / 60) * 360 + Math.random() * 20;
          const dist = 150 + Math.random() * 350;
          const dx = Math.cos(angle * Math.PI / 180) * dist;
          const dy = Math.sin(angle * Math.PI / 180) * dist;
          const size = 16 + Math.random() * 32;
          const dur = 800 + Math.random() * 600;
          const rot = -360 + Math.random() * 720;
          const sc = 0.2 + Math.random() * 0.5;
          p.textContent = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];
          p.style.cssText = `
            position:absolute; left:${cx}px; top:${cy}px; font-size:${size}px;
            --mpDx:${dx}px; --mpDy:${dy}px; --mpRot:${rot}deg; --mpScale:${sc};
            animation: moePart ${dur}ms ease-out forwards;
            pointer-events:none;
          `;
          container.appendChild(p);
        }

        // Glitter sparkles
        const glitterColors = ['#ff69b4','#ffd700','#ff1493','#ff6eb4','#fff','#ffc0cb','#ff85a2','#ffb7d5','#87ceeb','#dda0dd'];
        for (let i = 0; i < 80; i++) {
          const g = document.createElement('div');
          const angle = Math.random() * 360;
          const dist = 80 + Math.random() * 400;
          const dx = Math.cos(angle * Math.PI / 180) * dist;
          const dy = Math.sin(angle * Math.PI / 180) * dist;
          const dx2 = dx * 0.4 + (-20 + Math.random() * 40);
          const dy2 = dy * 0.4 + (-20 + Math.random() * 40);
          const size = 3 + Math.random() * 7;
          const dur = 600 + Math.random() * 800;
          const delay = Math.random() * 200;
          const color = glitterColors[Math.floor(Math.random() * glitterColors.length)];
          g.style.cssText = `
            position:absolute; left:${cx}px; top:${cy}px;
            width:${size}px; height:${size}px; border-radius:50%;
            background:${color}; box-shadow: 0 0 ${size}px ${color};
            --mgDx:${dx}px; --mgDy:${dy}px; --mgDx2:${dx2}px; --mgDy2:${dy2}px;
            animation: moeGlitter ${dur}ms ease-out ${delay}ms forwards;
            opacity:0; pointer-events:none;
          `;
          container.appendChild(g);
        }

        // Confetti ribbons
        const confettiColors = ['#ff1493','#ff69b4','#ffd700','#ff4500','#ff6eb4','#87ceeb','#dda0dd','#98fb98','#ffc0cb'];
        for (let i = 0; i < 50; i++) {
          const c = document.createElement('div');
          const x = Math.random() * window.innerWidth;
          const fall = 200 + Math.random() * 400;
          const spin = 360 + Math.random() * 720;
          const dur = 1200 + Math.random() * 1000;
          const delay = Math.random() * 400;
          const w = 6 + Math.random() * 8;
          const h = 12 + Math.random() * 16;
          const color = confettiColors[Math.floor(Math.random() * confettiColors.length)];
          c.style.cssText = `
            position:absolute; left:${x}px; top:${cy - 100 - Math.random() * 200}px;
            width:${w}px; height:${h}px; background:${color};
            border-radius:2px;
            --mcFall:${fall}px; --mcSpin:${spin}deg;
            animation: moeConfetti ${dur}ms ease-in ${delay}ms forwards;
            pointer-events:none;
          `;
          container.appendChild(c);
        }
      }, 2500);

      // Cleanup
      setTimeout(() => container.remove(), 5000);
    };
    socket.on('moe_bomb_animation', onMoeBomb);
    const onDiscardToDeck = ({ owner, cardNames }) => {
      const isMe = owner === myIdx;
      const discardSel = isMe ? '[data-my-discard]' : '[data-opp-discard]';
      const deckSel = isMe ? '[data-my-deck]' : '[data-opp-deck]';
      const srcEl = document.querySelector(discardSel);
      const tgtEl = document.querySelector(deckSel);
      if (!srcEl || !tgtEl || !cardNames || cardNames.length === 0) return;

      const sr = srcEl.getBoundingClientRect();
      const tr = tgtEl.getBoundingClientRect();
      const srcX = sr.left + sr.width / 2;
      const srcY = sr.top + sr.height / 2;
      const tgtX = tr.left + tr.width / 2;
      const tgtY = tr.top + tr.height / 2;
      const dx = tgtX - srcX;
      const dy = tgtY - srcY;

      // Inject keyframes once
      if (!document.getElementById('discard-to-deck-keyframes')) {
        const style = document.createElement('style');
        style.id = 'discard-to-deck-keyframes';
        style.textContent = `
          @keyframes discardToDeck {
            0% { transform: translate(0,0) scale(1); opacity: 1; }
            20% { transform: translate(0, -20px) scale(1.1); opacity: 1; }
            80% { transform: translate(var(--dtdDx), calc(var(--dtdDy) - 10px)) scale(0.9); opacity: 1; }
            100% { transform: translate(var(--dtdDx), var(--dtdDy)) scale(0.7); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      for (let i = 0; i < cardNames.length; i++) {
        const card = document.createElement('div');
        const imgUrl = window.cardImageUrl ? window.cardImageUrl(cardNames[i]) : null;
        const delay = i * 200;
        card.style.cssText = `
          position:fixed; left:${srcX - 32}px; top:${srcY - 44}px;
          width:64px; height:88px; z-index:10200; pointer-events:none;
          border-radius:4px; overflow:hidden;
          box-shadow: 0 0 12px rgba(100,255,150,0.7), 0 0 4px rgba(50,200,100,0.5);
          --dtdDx:${dx}px; --dtdDy:${dy}px;
          animation: discardToDeck 700ms ease-in-out ${delay}ms forwards;
          opacity: 0;
        `;
        if (imgUrl) {
          const img = document.createElement('img');
          img.src = imgUrl;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          img.draggable = false;
          card.appendChild(img);
          card.style.opacity = '1';
        } else {
          card.style.background = 'linear-gradient(135deg, #2a5a3a, #1a3a2a)';
          card.style.opacity = '1';
          card.innerHTML = `<div style="color:#8f8;font-size:8px;padding:4px;text-align:center;word-break:break-word;">${cardNames[i]}</div>`;
        }
        document.body.appendChild(card);
        setTimeout(() => card.remove(), delay + 800);
      }
    };
    socket.on('discard_to_deck_animation', onDiscardToDeck);
    const onPunchBox = ({ targetOwner, targetHeroIdx, targetZoneSlot }) => {
      const tgtLabel = targetOwner === myIdx ? 'me' : 'opp';
      let tgtEl;
      if (targetZoneSlot >= 0) {
        tgtEl = document.querySelector(`[data-support-zone][data-support-owner="${tgtLabel}"][data-support-hero="${targetHeroIdx}"][data-support-slot="${targetZoneSlot}"]`);
      } else {
        tgtEl = document.querySelector(`[data-hero-zone][data-hero-owner="${tgtLabel}"][data-hero-idx="${targetHeroIdx}"]`);
      }
      if (!tgtEl) return;
      const tr = tgtEl.getBoundingClientRect();
      const cx = tr.left + tr.width / 2;
      const cy = tr.top + tr.height / 2;

      // Inject keyframes once
      if (!document.getElementById('punch-box-keyframes')) {
        const style = document.createElement('style');
        style.id = 'punch-box-keyframes';
        style.textContent = `
          @keyframes punchSwing {
            0% { transform: translateX(-250px) rotate(15deg) scale(0.5); opacity: 0; }
            20% { opacity: 1; transform: translateX(-180px) rotate(10deg) scale(0.9); }
            45% { transform: translateX(0px) rotate(-5deg) scale(1.3); }
            55% { transform: translateX(-10px) rotate(0deg) scale(1.1); }
            70% { transform: translateX(0px) scale(1.0); opacity: 1; }
            100% { transform: translateX(30px) scale(0.6); opacity: 0; }
          }
          @keyframes punchImpact {
            0% { transform: scale(0) rotate(0deg); opacity: 1; }
            30% { transform: scale(1.5) rotate(10deg); opacity: 1; }
            100% { transform: scale(2.5) rotate(-5deg); opacity: 0; }
          }
          @keyframes punchStar {
            0% { transform: translate(0,0) scale(1); opacity: 1; }
            100% { transform: translate(var(--psDx), var(--psDy)) scale(0.3); opacity: 0; }
          }
          @keyframes punchShake {
            0%, 100% { transform: translate(0,0); }
            15% { transform: translate(-6px, 3px); }
            30% { transform: translate(5px, -4px); }
            45% { transform: translate(-4px, 2px); }
            60% { transform: translate(3px, -2px); }
            75% { transform: translate(-2px, 1px); }
          }
        `;
        document.head.appendChild(style);
      }

      // Screen shake
      document.body.style.animation = 'punchShake 400ms ease-out 350ms';
      setTimeout(() => { document.body.style.animation = ''; }, 800);

      // Boxing glove from the left — wrapper flips horizontally, animation handles position
      const gloveWrap = document.createElement('div');
      gloveWrap.style.cssText = `
        position:fixed; left:${cx - 40}px; top:${cy - 40}px;
        z-index:10300; pointer-events:none;
        animation: punchSwing 700ms ease-out forwards;
      `;
      const glove = document.createElement('div');
      glove.textContent = '🥊';
      glove.style.cssText = `font-size:80px; line-height:1; transform:rotate(90deg); filter:drop-shadow(0 0 10px rgba(255,50,0,0.6));`;
      gloveWrap.appendChild(glove);
      document.body.appendChild(gloveWrap);
      setTimeout(() => gloveWrap.remove(), 800);

      // Impact burst at ~350ms
      setTimeout(() => {
        // "POW!" text
        const pow = document.createElement('div');
        pow.textContent = 'POW!';
        pow.style.cssText = `
          position:fixed; left:${cx - 50}px; top:${cy - 60}px;
          font-size:48px; font-weight:900; color:#ff3300; z-index:10301;
          pointer-events:none; text-shadow: 3px 3px 0 #ffcc00, -2px -2px 0 #ff6600;
          font-family: 'Comic Sans MS', cursive, sans-serif;
          animation: punchImpact 500ms ease-out forwards;
        `;
        document.body.appendChild(pow);
        setTimeout(() => pow.remove(), 600);

        // Impact starburst
        const burstColors = ['#ff3300','#ffcc00','#ff6600','#fff','#ff9900'];
        const stars = ['⭐','💥','✦','★','⚡'];
        for (let i = 0; i < 15; i++) {
          const s = document.createElement('div');
          const angle = (i / 15) * 360 + Math.random() * 20;
          const dist = 40 + Math.random() * 80;
          const dx = Math.cos(angle * Math.PI / 180) * dist;
          const dy = Math.sin(angle * Math.PI / 180) * dist;
          const size = 14 + Math.random() * 18;
          const dur = 400 + Math.random() * 300;
          s.textContent = stars[Math.floor(Math.random() * stars.length)];
          s.style.cssText = `
            position:fixed; left:${cx}px; top:${cy}px; font-size:${size}px;
            z-index:10301; pointer-events:none;
            color:${burstColors[Math.floor(Math.random() * burstColors.length)]};
            --psDx:${dx}px; --psDy:${dy}px;
            animation: punchStar ${dur}ms ease-out forwards;
          `;
          document.body.appendChild(s);
          setTimeout(() => s.remove(), dur + 50);
        }
      }, 350);
    };
    socket.on('punch_box_animation', onPunchBox);
    const onTearsOfCreation = ({ owner, targets }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const goldEl = document.querySelector(`[data-gold-player="${owner}"]`);
      if (!goldEl || !targets || targets.length === 0) return;
      const gr = goldEl.getBoundingClientRect();
      const goldX = gr.left + gr.width / 2;
      const goldY = gr.top + gr.height / 2;

      // Inject keyframes once
      if (!document.getElementById('tears-creation-keyframes')) {
        const style = document.createElement('style');
        style.id = 'tears-creation-keyframes';
        style.textContent = `
          @keyframes tearsSparkle {
            0% { transform: translate(0,0) scale(0.3); opacity: 0; }
            15% { opacity: 1; transform: translate(var(--tcMidX), var(--tcMidY)) scale(1); }
            50% { opacity: 1; transform: translate(calc(var(--tcDx)*0.6 + var(--tcMidX)*0.4), calc(var(--tcDy)*0.6 + var(--tcMidY)*0.3)) scale(0.8); }
            100% { transform: translate(var(--tcDx), var(--tcDy)) scale(0.3); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      const colors = ['#ffd700','#ffec80','#fff4cc','#f0c040','#ffe066','#fff'];
      const perTarget = 25;

      for (const t of targets) {
        const tLabel = t.owner === myIdx ? 'me' : 'opp';
        let srcEl;
        if (t.zoneSlot >= 0) {
          srcEl = document.querySelector(`[data-support-zone][data-support-owner="${tLabel}"][data-support-hero="${t.heroIdx}"][data-support-slot="${t.zoneSlot}"]`);
        } else {
          srcEl = document.querySelector(`[data-hero-zone][data-hero-owner="${tLabel}"][data-hero-idx="${t.heroIdx}"]`);
        }
        if (!srcEl) continue;
        const sr = srcEl.getBoundingClientRect();
        const srcX = sr.left + sr.width / 2;
        const srcY = sr.top + sr.height / 2;
        const dx = goldX - srcX;
        const dy = goldY - srcY;

        for (let i = 0; i < perTarget; i++) {
          const p = document.createElement('div');
          const size = 3 + Math.random() * 5;
          const color = colors[Math.floor(Math.random() * colors.length)];
          const delay = Math.random() * 600;
          const dur = 500 + Math.random() * 500;
          const midX = -20 + Math.random() * 40;
          const midY = -30 - Math.random() * 30;

          p.style.cssText = `
            position:fixed; left:${srcX}px; top:${srcY}px;
            width:${size}px; height:${size}px; border-radius:50%;
            background:${color}; z-index:10200; pointer-events:none;
            box-shadow: 0 0 ${size + 2}px ${color}, 0 0 ${size * 2}px rgba(255,215,0,0.3);
            --tcDx:${dx}px; --tcDy:${dy}px; --tcMidX:${midX}px; --tcMidY:${midY}px;
            animation: tearsSparkle ${dur}ms ease-in ${delay}ms forwards;
            opacity:0;
          `;
          document.body.appendChild(p);
          setTimeout(() => p.remove(), delay + dur + 100);
        }
      }
    };
    socket.on('tears_of_creation_animation', onTearsOfCreation);
    const onHandSteal = ({ fromPlayer, toPlayer, indices, cardNames, count, duration }) => {
      stealInProgressRef.current = true;
      const iAmVictim = fromPlayer === myIdx;
      const fromLabel = fromPlayer === myIdx ? 'me' : 'opp';
      const toLabel = fromPlayer === myIdx ? 'opp' : 'me';
      const dur = duration || 800;
      const stealIndices = indices || [];
      const names = cardNames || [];

      // Phase 1: Highlight the stolen cards (800ms)
      if (iAmVictim) {
        setStealMarkedMe(new Set(stealIndices));
      } else {
        stealIndices.forEach(idx => {
          const el = document.querySelector(`.game-hand-opp [data-hand-idx="${idx}"]`);
          if (el) {
            el.style.outline = '3px solid rgba(255,150,50,.95)';
            el.style.filter = 'brightness(1.4) drop-shadow(0 0 10px rgba(255,150,50,.7))';
          }
        });
      }

      // Phase 2: After highlight, hide source cards and fly face-up clones
      setTimeout(() => {
        if (iAmVictim) {
          setStealMarkedMe(new Set());
          setStealHiddenMe(new Set(stealIndices));
          stealExpectedMeCountRef.current = (document.querySelectorAll('.game-hand-me .hand-slot') || []).length;
        } else {
          setStealHiddenOpp(new Set(stealIndices));
          stealExpectedOppCountRef.current = count > 0 ? document.querySelectorAll('.game-hand-opp .game-hand-cards .hand-card').length : -1;
          stealIndices.forEach(idx => {
            const el = document.querySelector(`.game-hand-opp [data-hand-idx="${idx}"]`);
            if (el) { el.style.outline = ''; el.style.filter = ''; }
          });
        }

        // Find source card positions
        const sourceRects = [];
        stealIndices.forEach(idx => {
          const sel = fromLabel === 'me'
            ? `.game-hand-me .hand-slot[data-hand-idx="${idx}"]`
            : `.game-hand-opp [data-hand-idx="${idx}"]`;
          const el = document.querySelector(sel);
          sourceRects.push(el ? el.getBoundingClientRect() : null);
        });

        // Find target position: just right of last visible card in destination hand
        const toHandCards = document.querySelectorAll(`.game-hand-${toLabel} .game-hand-cards > *`);
        const lastCard = toHandCards.length > 0 ? toHandCards[toHandCards.length - 1] : null;
        const lastRect = lastCard?.getBoundingClientRect();
        const toHandEl = document.querySelector(`.game-hand-${toLabel} .game-hand-cards`);
        const toRect = toHandEl?.getBoundingClientRect();
        const cardW = lastRect?.width || 64;

        stealIndices.forEach((idx, i) => {
          const sr = sourceRects[i];
          if (!sr) return;
          const name = names[i] || '';
          const targetX = lastRect ? (lastRect.right + i * (cardW * 0.6)) : (toRect ? toRect.right - cardW : sr.left);
          const targetY = lastRect ? lastRect.top : (toRect ? toRect.top : sr.top);
          const dx = targetX - sr.left;
          const dy = targetY - sr.top;

          const flyEl = document.createElement('div');
          flyEl.style.cssText = `position:fixed;left:${sr.left}px;top:${sr.top}px;width:${sr.width}px;height:${sr.height}px;z-index:10200;pointer-events:none;border-radius:4px;overflow:hidden;box-shadow:0 0 15px rgba(255,150,50,.8);animation:handStealFly ${dur}ms ease-in-out ${i * 100}ms forwards;--steal-dx:${dx}px;--steal-dy:${dy}px;`;
          const imgUrl = name ? window.cardImageUrl(name) : null;
          if (imgUrl) {
            const img = document.createElement('img');
            img.src = imgUrl;
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
            img.draggable = false;
            flyEl.appendChild(img);
          } else {
            flyEl.style.background = 'var(--bg3)';
            flyEl.style.display = 'flex';
            flyEl.style.alignItems = 'center';
            flyEl.style.justifyContent = 'center';
            flyEl.style.fontSize = '9px';
            flyEl.style.color = 'var(--text2)';
            flyEl.textContent = name;
          }
          document.body.appendChild(flyEl);
          setTimeout(() => flyEl.remove(), dur + i * 100 + 2200);
        });

        // Phase 3: Clear hidden states AFTER server sync arrives (~2000ms + latency)
        setTimeout(() => {
          setStealHiddenMe(new Set());
          setStealHiddenOpp(new Set());
          // If I'm the stealer (toPlayer === myIdx), skip draw anims for incoming cards
          if (!iAmVictim) stealSkipDrawRef.current = stealIndices.length;
          stealInProgressRef.current = false;
        }, 2500);
      }, 800);
    };
    socket.on('play_hand_steal', onHandSteal);
    const onBlindPickHighlight = ({ indices }) => {
      setStealHighlightMe(new Set(indices || []));
    };
    socket.on('blind_pick_highlight', onBlindPickHighlight);
    const onCloakVanish = ({ owner, heroIdx, zoneSlot }) => {
      const label = owner === myIdx ? 'me' : 'opp';
      let el;
      if (zoneSlot !== undefined && zoneSlot >= 0) {
        el = document.querySelector(`[data-support-zone][data-support-owner="${label}"][data-support-hero="${heroIdx}"][data-support-slot="${zoneSlot}"]`);
      } else {
        el = document.querySelector(`[data-hero-zone][data-hero-owner="${label}"][data-hero-idx="${heroIdx}"]`);
      }
      if (!el) return;
      // Fade out over 1s
      el.style.transition = 'opacity 1s ease';
      el.style.opacity = '0';
      // Stay invisible for 1s, then fade back in over 1s
      setTimeout(() => { el.style.transition = 'opacity 1s ease'; el.style.opacity = '1'; }, 2000);
      setTimeout(() => { el.style.transition = ''; }, 3000);
    };
    socket.on('play_cloak_vanish', onCloakVanish);
    const onSkullBurst = ({ owner, heroIdx }) => {
      const label = owner === myIdx ? 'me' : 'opp';
      const el = document.querySelector(`[data-hero-zone][data-hero-owner="${label}"][data-hero-idx="${heroIdx}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const skull = document.createElement('div');
      skull.textContent = '💀';
      skull.style.cssText = `position:fixed;left:${cx}px;top:${cy}px;z-index:10200;pointer-events:none;font-size:40px;transform:translate(-50%,-50%) scale(1);opacity:1;transition:transform 1s ease-out, opacity 0.8s ease-in 0.2s;`;
      document.body.appendChild(skull);
      requestAnimationFrame(() => {
        skull.style.transform = 'translate(-50%,-50%) scale(12)';
        skull.style.opacity = '0';
      });
      setTimeout(() => skull.remove(), 1200);
    };
    socket.on('play_skull_burst', onSkullBurst);
    const onHealBeam = ({ phase, sourceOwner, sourceHeroIdx, targetOwner, targetHeroIdx, targetZoneSlot }) => {
      const srcLabel = sourceOwner === myIdx ? 'me' : 'opp';
      const tgtLabel = targetOwner === myIdx ? 'me' : 'opp';
      const srcEl = document.querySelector(`[data-hero-zone][data-hero-owner="${srcLabel}"][data-hero-idx="${sourceHeroIdx}"]`);
      let tgtEl;
      if (targetZoneSlot !== undefined && targetZoneSlot >= 0) {
        tgtEl = document.querySelector(`[data-support-zone][data-support-owner="${tgtLabel}"][data-support-hero="${targetHeroIdx}"][data-support-slot="${targetZoneSlot}"]`);
      } else {
        tgtEl = document.querySelector(`[data-hero-zone][data-hero-owner="${tgtLabel}"][data-hero-idx="${targetHeroIdx}"]`);
      }
      if (phase === 'rise' && srcEl) {
        const sr = srcEl.getBoundingClientRect();
        const beam = document.createElement('div');
        beam.className = 'heal-beam heal-beam-rise';
        beam.style.left = (sr.left + sr.width / 2 - 11) + 'px';
        beam.style.top = (sr.top + sr.height / 2) + 'px';
        document.body.appendChild(beam);
        setTimeout(() => beam.remove(), 600);
      }
      if (phase === 'strike' && tgtEl) {
        const tr = tgtEl.getBoundingClientRect();
        const beam = document.createElement('div');
        beam.className = 'heal-beam heal-beam-strike';
        beam.style.left = (tr.left + tr.width / 2 - 11) + 'px';
        beam.style.top = (tr.top + tr.height * 0.25) + 'px';
        document.body.appendChild(beam);
        setTimeout(() => beam.remove(), 600);
      }
    };
    socket.on('play_heal_beam', onHealBeam);
    const onGuardianAngel = ({ owner, heroIdx }) => {
      const label = owner === myIdx ? 'me' : 'opp';
      const el = document.querySelector(`[data-hero-zone][data-hero-owner="${label}"][data-hero-idx="${heroIdx}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const angel = document.createElement('div');
      angel.className = 'guardian-angel-descend';
      angel.style.left = (r.left + r.width / 2 - 20) + 'px';
      angel.style.top = r.top + 'px';
      angel.textContent = '👼';
      document.body.appendChild(angel);
      setTimeout(() => angel.remove(), 1200);
    };
    socket.on('play_guardian_angel', onGuardianAngel);
    const onHeroAnnouncement = ({ text }) => {
      setAnnouncement({ text, color: 'var(--success)', short: true });
    };
    socket.on('hero_announcement', onHeroAnnouncement);
    const onChaosScreen = () => {
      const overlay = document.createElement('div');
      overlay.className = 'chaos-screen-overlay';
      document.body.appendChild(overlay);
      setTimeout(() => overlay.remove(), 1600);
    };
    socket.on('play_chaos_screen', onChaosScreen);
    const onGoldCoins = ({ owner }) => {
      const sel = `[data-gold-player="${owner}"]`;
      for (let i = 0; i < 4; i++) {
        setTimeout(() => playAnimation('gold_sparkle', sel, { duration: 1200 }), i * 150);
      }
    };
    socket.on('play_gold_coins', onGoldCoins);
    const onDeckToDeleted = ({ owner, cards }) => {
      const prefix = owner === myIdx ? 'my' : 'opp';
      const deckEl = document.querySelector(`[data-${prefix}-deck]`);
      const deletedEl = document.querySelector(`[data-${prefix}-deleted]`);
      const deckR = deckEl?.getBoundingClientRect();
      const delR = deletedEl?.getBoundingClientRect();
      if (!deckR || !delR || !cards || cards.length === 0) return;
      const startX = deckR.left + deckR.width / 2 - 32;
      const startY = deckR.top + deckR.height / 2 - 45;
      const endX = delR.left + delR.width / 2 - 32;
      const endY = delR.top + delR.height / 2 - 45;
      const newAnims = cards.map((cardName, i) => ({
        id: Date.now() + Math.random() + i,
        cardName, startX, startY, endX, endY, dest: 'deleted',
        delay: i * 150,
      }));
      // Stagger the animations
      for (const anim of newAnims) {
        setTimeout(() => {
          setDiscardAnims(prev => [...prev, anim]);
          setTimeout(() => setDiscardAnims(prev => prev.filter(a => a.id !== anim.id)), 500);
        }, anim.delay);
      }
    };
    socket.on('deck_to_deleted', onDeckToDeleted);
    return () => {
      socket.off('card_reveal', onReveal); socket.off('deck_search_add', onDeckSearchAdd);
      socket.off('reaction_chain_update', onChainUpdate); socket.off('reaction_chain_resolving_start', onChainResolvingStart);
      socket.off('reaction_chain_link_resolving', onChainLinkResolving); socket.off('reaction_chain_link_resolved', onChainLinkResolved);
      socket.off('reaction_chain_link_negated', onChainLinkNegated); socket.off('reaction_chain_done', onChainDone);
      socket.off('camera_flash', onCameraFlash); socket.off('toughness_hp_change', onToughnessHp); socket.off('creature_zone_move', onCreatureZoneMove); socket.off('fighting_atk_change', onFightingAtk);
      socket.off('summon_effect', onSummon); socket.off('burn_tick', onBurnTick);
      socket.off('play_zone_animation', onZoneAnim); socket.off('level_change', onLevelChange);
      socket.off('nomu_draw', onNomuDraw);
      socket.off('ability_activated', onAbilityActivated); socket.off('play_beam_animation', onBeamAnimation);
      socket.off('hero_ascension', onHeroAscension);
      socket.off('willy_leprechaun', onWillyLeprechaun);
      socket.off('alleria_spider_redirect', onAlleriaSpiderRedirect);
      socket.off('dark_control', onDarkControl);
      socket.off('burning_finger_slash', onBurningFingerSlash);
      socket.off('punch_impact', onPunchImpact);
      socket.off('baihu_petrify', onBaihuPetrify);
      socket.off('cardinal_beast_win', onCardinalBeastWin);
      socket.off('qinglong_lightning', onQinglongLightning);
      socket.off('jumpscare_box', onJumpscareBox);
      socket.off('anti_magic_bubble', onAntiMagicBubble);
      socket.off('fireshield_corona', onFireshieldCorona);
      socket.off('play_permanent_animation', onPermanentAnim);
      socket.off('surprise_flip', onSurpriseFlip);
      socket.off('surprise_reset', onSurpriseReset);
      socket.off('play_ram_animation', onRamAnimation);
      socket.off('play_card_transfer', onCardTransfer);
      socket.off('play_projectile_animation', onProjectileAnimation);
      socket.off('butterfly_cloud_animation', onButterflyCloud);
      socket.off('smug_coin_save', onSmugCoinSave);
      socket.off('divine_rain_start', onDivineRainStart);
      socket.off('moe_bomb_animation', onMoeBomb);
      socket.off('discard_to_deck_animation', onDiscardToDeck);
      socket.off('punch_box_animation', onPunchBox);
      socket.off('tears_of_creation_animation', onTearsOfCreation);
      socket.off('play_hand_steal', onHandSteal);
      socket.off('blind_pick_highlight', onBlindPickHighlight);
      socket.off('play_cloak_vanish', onCloakVanish);
      socket.off('play_skull_burst', onSkullBurst);
      socket.off('play_heal_beam', onHealBeam);
      socket.off('play_guardian_angel', onGuardianAngel);
      socket.off('hero_announcement', onHeroAnnouncement);
      socket.off('play_chaos_screen', onChaosScreen);
      socket.off('play_gold_coins', onGoldCoins);
      socket.off('deck_to_deleted', onDeckToDeleted);
    };
  }, []);

  // ── Chat & Action Log socket listeners ──
  useEffect(() => {
    const onChatMsg = (entry) => {
      setChatMessages(prev => [...prev, entry]);
      setTimeout(() => chatBodyRef.current?.scrollTo({ top: chatBodyRef.current.scrollHeight, behavior: 'smooth' }), 50);
    };
    const onChatPrivate = (entry) => {
      const pairKey = [entry.from, entry.to].sort().join('::');
      setPrivateChats(prev => ({ ...prev, [pairKey]: [...(prev[pairKey] || []), entry] }));
    };
    const onChatPing = ({ from, color }) => {
      setPingFlash({ color });
      setTimeout(() => setPingFlash(null), 900);
    };
    const onActionLog = (entry) => {
      setActionLog(prev => [...prev, entry]);
      setTimeout(() => actionLogRef.current?.scrollTo({ top: actionLogRef.current.scrollHeight, behavior: 'smooth' }), 50);
    };
    const onChatHistory = ({ main, private: priv }) => {
      if (main) setChatMessages(main);
      if (priv) setPrivateChats(priv);
    };
    socket.on('chat_message', onChatMsg);
    socket.on('chat_private', onChatPrivate);
    socket.on('chat_ping', onChatPing);
    socket.on('action_log', onActionLog);
    socket.on('chat_history', onChatHistory);
    // Request chat history on mount (for reconnects)
    if (gameState?.roomId) socket.emit('request_chat_history', { roomId: gameState.roomId });
    return () => {
      socket.off('chat_message', onChatMsg);
      socket.off('chat_private', onChatPrivate);
      socket.off('chat_ping', onChatPing);
      socket.off('action_log', onActionLog);
      socket.off('chat_history', onChatHistory);
    };
  }, []);

  // ── Scrollable battlefield detection + centering offset ──
  useEffect(() => {
    const el = boardCenterRef.current;
    if (!el) return;
    const check = () => {
      // First compute centering offset WITHOUT scroll mode
      el.classList.remove('can-scroll');
      const rect = el.getBoundingClientRect();
      const viewportCenter = window.innerWidth / 2;
      const boardCenter = rect.left + rect.width / 2;
      const offset = viewportCenter - boardCenter;
      // Set on game-layout so hands can also use the offset
      const layout = el.closest('.game-layout');
      if (layout) layout.style.setProperty('--center-offset', offset + 'px');
      el.style.setProperty('--center-offset', offset + 'px');
      // Now check if natural content overflows (ignoring transform)
      // Use scrollWidth which reflects content width before transform
      if (el.scrollWidth > el.clientWidth + 4) {
        el.classList.add('can-scroll');
        // In scroll mode, disable centering transform to avoid layout confusion
        el.style.setProperty('--center-offset', '0px');
        if (layout) layout.style.setProperty('--center-offset', '0px');
      }
    };
    check();
    const obs = new ResizeObserver(check);
    obs.observe(el);
    window.addEventListener('resize', check);
    return () => { obs.disconnect(); window.removeEventListener('resize', check); };
  });

  /** Play a visual animation at a DOM element's position. */
  const playAnimation = (type, selector, options = {}) => {
    const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const id = Date.now() + Math.random();
    const dur = options.duration || 800;
    setGameAnims(prev => [...prev, { id, type, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, ...options }]);
    setTimeout(() => setGameAnims(prev => prev.filter(a => a.id !== id)), dur);
  };

  // Listen for potion resolved — trigger explosion animation
  useEffect(() => {
    const onResolved = ({ destroyedIds, animationType }) => {
      if (!destroyedIds || destroyedIds.length === 0) return;
      setExplosions(destroyedIds);
      setTimeout(() => setExplosions([]), 800);
      // Spawn particle animations on each target after a tiny delay for DOM to update
      setTimeout(() => {
        for (const targetId of destroyedIds) {
          // Find DOM element by target ID — ability or equip
          const parts = targetId.split('-');
          const type = parts[0]; // 'ability' or 'equip'
          const ownerPi = parseInt(parts[1]);
          const heroIdx = parseInt(parts[2]);
          const slotIdx = parseInt(parts[3]);
          const ownerLabel = ownerPi === myIdx ? 'me' : 'opp';
          let selector;
          if (type === 'ability') {
            selector = `[data-ability-zone][data-ability-owner="${ownerLabel}"][data-ability-hero="${heroIdx}"][data-ability-slot="${slotIdx}"]`;
          } else if (type === 'hero') {
            selector = `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`;
          } else {
            selector = `[data-support-zone][data-support-owner="${ownerLabel}"][data-support-hero="${heroIdx}"][data-support-slot="${slotIdx}"]`;
          }
          playAnimation(animationType || 'explosion', selector, { duration: 900 });
        }
      }, 50);
    };
    socket.on('potion_resolved', onResolved);
    return () => socket.off('potion_resolved', onResolved);
  }, []);

  // Listen for rematch first-choice prompt (loser only)
  useEffect(() => {
    const onChooseFirst = () => setShowFirstChoice(true);
    socket.on('rematch_choose_first', onChooseFirst);
    return () => socket.off('rematch_choose_first', onChooseFirst);
  }, []);

  // Listen for side-deck phase events (Bo3/Bo5)
  useEffect(() => {
    const onSideDeckPhase = (data) => {
      setSideDeckPhase(data);
      // Auto-done if player has no side deck
      if (data.autoDone) {
        setSideDeckDone(true);
      } else {
        setSideDeckDone(false);
      }
    };
    const onSideDeckUpdate = (data) => {
      setSideDeckPhase(prev => prev ? { ...prev, currentDeck: data.currentDeck, opponentDone: data.opponentDone } : null);
    };
    const onSideDeckOppDone = () => {
      setSideDeckPhase(prev => prev ? { ...prev, opponentDone: true } : null);
    };
    const onSideDeckComplete = () => {
      setSideDeckPhase(null);
      setSideDeckDone(false);
    };
    socket.on('side_deck_phase', onSideDeckPhase);
    socket.on('side_deck_update', onSideDeckUpdate);
    socket.on('side_deck_opponent_done', onSideDeckOppDone);
    socket.on('side_deck_complete', onSideDeckComplete);
    return () => {
      socket.off('side_deck_phase', onSideDeckPhase);
      socket.off('side_deck_update', onSideDeckUpdate);
      socket.off('side_deck_opponent_done', onSideDeckOppDone);
      socket.off('side_deck_complete', onSideDeckComplete);
    };
  }, []);

  const handleLeave = () => {
    if (isSpectator) {
      socket.emit('leave_room', { roomId: gameState.roomId });
    } else {
      socket.emit('leave_game', { roomId: gameState.roomId });
    }
    onLeave();
  };
  const handleSurrender = () => {
    setShowSurrender(false);
    socket.emit('leave_game', { roomId: gameState.roomId });
    // Don't call onLeave — server will send updated game state with result
  };
  const handleRematch = () => {
    socket.emit('request_rematch', { roomId: gameState.roomId });
  };

  // Keyboard shortcuts on game-over screen: Escape=Leave, Enter/Space=Rematch
  const showGameOver = result && (result.setOver || !result.format || result.format === 1 || (result.format > 1 && result.setOver));
  useEffect(() => {
    if (!showGameOver) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); handleLeave(); }
      if ((e.key === 'Enter' || e.key === ' ') && !isSpectator && !oppLeft && !oppDisconnected && !myRematchSent) {
        e.preventDefault(); handleRematch();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showGameOver, isSpectator, oppLeft, oppDisconnected, myRematchSent]);

  // Escape closes surrender dialog, deck viewer, cancels potion targeting, cancels effect prompts, declines mulligan — or opens surrender dialog
  useEffect(() => {
    const mulliganActive = gameState.mulliganPending && !mulliganDecided && !isSpectator;
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      if (showEndTurnConfirm) { cancelEndTurn(); return; }
      if (spellHeroPick) { setSpellHeroPick(null); return; }
      if (mulliganActive) { setMulliganDecided(true); socket.emit('mulligan_decision', { roomId: gameState.roomId, accept: false }); return; }
      if (pendingAbilityActivation) { setPendingAbilityActivation(null); return; }
      if (gameState.effectPrompt && gameState.effectPrompt.ownerIdx === myIdx && gameState.effectPrompt.cancellable !== false) {
        socket.emit('effect_prompt_response', { roomId: gameState.roomId, response: { cancelled: true } });
      } else if (gameState.potionTargeting && gameState.potionTargeting.ownerIdx === myIdx) {
        if (gameState.potionTargeting.config?.cancellable === false) return;
        socket.emit('cancel_potion', { roomId: gameState.roomId });
        setPotionSelection([]);
      } else if (pileViewer) setPileViewer(null);
      else if (pendingAdditionalPlay) { setPendingAdditionalPlay(null); socket.emit('pending_placement_clear', { roomId: gameState.roomId }); }
      else if (deckViewer) setDeckViewer(null);
      else if (showSurrender) setShowSurrender(false);
      else if (gameState.effectPrompt && gameState.effectPrompt.ownerIdx === myIdx) return; // Non-cancellable prompt active — ignore Escape
      else if (!gameState.result && !isSpectator) setShowSurrender(true);
      else if (gameState.result) handleLeave();
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [showSurrender, showEndTurnConfirm, cancelEndTurn, spellHeroPick, deckViewer, pileViewer, gameState.potionTargeting, gameState.effectPrompt, pendingAdditionalPlay, pendingAbilityActivation, gameState.mulliganPending, mulliganDecided, gameState.result, isSpectator]);

  // Enter/Space confirms active confirmation dialogs and prompts
  useEffect(() => {
    const ep = gameState.effectPrompt;
    const pt = gameState.potionTargeting;
    const isMyPrompt = ep && ep.ownerIdx === myIdx;
    const isMyPotion = pt && pt.ownerIdx === myIdx;
    const mulliganActive = gameState.mulliganPending && !mulliganDecided && !isSpectator;
    // Only attach if there's something confirmable
    if (!showSurrender && !showEndTurnConfirm && !(isMyPrompt && ep.type === 'confirm') && !(isMyPrompt && ep.type === 'deckSearchReveal') && !isMyPotion && !mulliganActive) return;
    const handleConfirm = (e) => {
      if (e.key !== 'Enter' && e.code !== 'Space') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (showSurrender) { handleSurrender(); return; }
      if (showEndTurnConfirm) { confirmEndTurn(); return; }
      if (isMyPrompt && (ep.type === 'confirm' || ep.type === 'deckSearchReveal')) {
        socket.emit('effect_prompt_response', { roomId: gameState.roomId, response: { confirmed: true } }); return;
      }
      if (isMyPotion && potionSelection.length > 0) {
        // Check min required
        const minReq = pt?.config?.minRequired || 0;
        if (potionSelection.length >= minReq) {
          socket.emit('confirm_potion', { roomId: gameState.roomId, selectedIds: potionSelection }); return;
        }
      }
      if (mulliganActive) {
        setMulliganDecided(true);
        socket.emit('mulligan_decision', { roomId: gameState.roomId, accept: true }); return;
      }
    };
    window.addEventListener('keydown', handleConfirm, true);
    return () => window.removeEventListener('keydown', handleConfirm, true);
  }, [showSurrender, showEndTurnConfirm, confirmEndTurn, gameState.effectPrompt, gameState.potionTargeting, gameState.mulliganPending, mulliganDecided, potionSelection, myIdx, gameState.roomId, isSpectator]);

  // Space hotkey — advance to next phase
  useEffect(() => {
    const handleSpace = (e) => {
      if (e.code !== 'Space') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (isSpectator) return;
      if (showEndTurnConfirm || showSurrender) return;
      const isMyTurn = (gameState.activePlayer || 0) === myIdx;
      if (!isMyTurn || gameState.result || gameState.effectPrompt || gameState.potionTargeting || gameState.mulliganPending || gameState.heroEffectPending) return;
      if (spellHeroPick || pendingAdditionalPlay || pendingAbilityActivation) return;
      const cp = gameState.currentPhase;
      const nextMap = { 2: 3, 3: 4, 4: 5 }; // Main1→Action, Action→Main2, Main2→End
      const target = nextMap[cp];
      if (target == null) return;
      e.preventDefault();
      tryAdvancePhase(target);
    };
    window.addEventListener('keydown', handleSpace);
    return () => window.removeEventListener('keydown', handleSpace);
  }, [gameState.activePlayer, gameState.currentPhase, gameState.result, gameState.effectPrompt, gameState.potionTargeting, gameState.mulliganPending, gameState.heroEffectPending, gameState.roomId, myIdx, tryAdvancePhase, showEndTurnConfirm, showSurrender, spellHeroPick, pendingAdditionalPlay, pendingAbilityActivation]);

  // Listen for opponent's target selections
  useEffect(() => {
    const onOppTargets = ({ selectedIds }) => setOppTargetHighlight(selectedIds || []);
    socket.on('opponent_targeting', onOppTargets);
    return () => socket.off('opponent_targeting', onOppTargets);
  }, []);

  // ── Card Ping System ──
  const [pingAnims, setPingAnims] = useState([]); // [{id, selector, color}]

  // Helper: find board zone info from a hovered .board-card element
  const getPingInfo = useCallback((el) => {
    if (!el) return null;
    // Walk up to find zone container with data attributes
    let node = el;
    for (let i = 0; i < 8 && node; i++) {
      if (node.dataset?.heroZone) {
        return { type: 'hero', owner: node.dataset.heroOwner, heroIdx: node.dataset.heroIdx };
      }
      if (node.dataset?.supportZone) {
        return { type: 'support', owner: node.dataset.supportOwner, heroIdx: node.dataset.supportHero, slot: node.dataset.supportSlot };
      }
      if (node.dataset?.abilityZone) {
        return { type: 'ability', owner: node.dataset.abilityOwner, heroIdx: node.dataset.abilityHero };
      }
      if (node.dataset?.permId) {
        return { type: 'perm', owner: node.dataset.permOwner, permId: node.dataset.permId };
      }
      if (node.dataset?.handIdx !== undefined && node.closest('.game-hand-me')) {
        return { type: 'hand-me', idx: node.dataset.handIdx };
      }
      if (node.dataset?.handIdx !== undefined && node.closest('.game-hand-opp')) {
        return { type: 'hand-opp', idx: node.dataset.handIdx };
      }
      node = node.parentElement;
    }
    return null;
  }, []);

  const buildPingSelector = useCallback((info) => {
    if (!info) return null;
    switch (info.type) {
      case 'hero': return `[data-hero-zone][data-hero-owner="${info.owner}"][data-hero-idx="${info.heroIdx}"]`;
      case 'support': return `[data-support-zone][data-support-owner="${info.owner}"][data-support-hero="${info.heroIdx}"][data-support-slot="${info.slot}"]`;
      case 'ability': return `[data-ability-zone][data-ability-owner="${info.owner}"][data-ability-hero="${info.heroIdx}"]`;
      case 'perm': return `[data-perm-id="${info.permId}"]`;
      case 'hand-me': return `.game-hand-me .hand-slot[data-hand-idx="${info.idx}"]`;
      case 'hand-opp': return `.game-hand-opp [data-hand-idx="${info.idx}"]`;
      default: return null;
    }
  }, []);

  const emitPing = useCallback((info) => {
    if (!info || !gameState.roomId || isSpectator) return;
    socket.emit('ping_card', { roomId: gameState.roomId, ping: info, color: user.color || '#00f0ff' });
  }, [gameState.roomId, user.color, isSpectator]);

  // Tab key + contextmenu (right-click) → ping hovered card
  // Mobile: double-tap → ping
  useEffect(() => {
    const handlePing = (e) => {
      if (isSpectator || gameState.result) return;
      const hovered = document.querySelector('.board-card:hover');
      if (!hovered) return;
      const info = getPingInfo(hovered);
      if (!info) return;
      if (e.type === 'keydown') { if (e.code !== 'Tab') return; e.preventDefault(); }
      if (e.type === 'contextmenu') {
        // Only ping if the right-click is directly on a board card
        if (!e.target.closest('.board-card')) return;
        e.preventDefault();
      }
      emitPing(info);
    };
    // Double-tap detection for mobile pinging
    let lastTapTime = 0;
    let lastTapTarget = null;
    const handleDoubleTap = (e) => {
      if (!window._isTouchDevice || isSpectator || gameState.result) return;
      const card = e.target.closest('.board-card');
      if (!card) { lastTapTarget = null; return; }
      const now = Date.now();
      if (lastTapTarget === card && now - lastTapTime < 300) {
        // Double-tap detected — ping this card
        const info = getPingInfo(card);
        if (info) {
          emitPing(info);
          // Cancel any pending long-press tooltip
          clearTimeout(window._longPressTimer);
          window._longPressFired = false;
        }
        lastTapTarget = null;
        lastTapTime = 0;
      } else {
        lastTapTarget = card;
        lastTapTime = now;
      }
    };
    window.addEventListener('keydown', handlePing);
    window.addEventListener('contextmenu', handlePing);
    document.addEventListener('touchstart', handleDoubleTap, { passive: true });
    return () => {
      window.removeEventListener('keydown', handlePing);
      window.removeEventListener('contextmenu', handlePing);
      document.removeEventListener('touchstart', handleDoubleTap);
    };
  }, [isSpectator, gameState.result, getPingInfo, emitPing]);

  // Receive pings
  useEffect(() => {
    const onPing = ({ ping, color }) => {
      const selector = buildPingSelector(ping);
      const id = Date.now() + Math.random();
      setPingAnims(prev => [...prev, { id, selector, color }]);
      setTimeout(() => setPingAnims(prev => prev.filter(p => p.id !== id)), 1200);
    };
    socket.on('ping_card', onPing);
    return () => socket.off('ping_card', onPing);
  }, [buildPingSelector]);

  // Broadcast selection changes to opponent
  useEffect(() => {
    if (isTargeting && gameState.roomId) {
      socket.emit('targeting_update', { roomId: gameState.roomId, selectedIds: potionSelection });
    }
  }, [potionSelection, isTargeting]);

  // Reset potion selection and opponent highlight when targeting clears
  useEffect(() => {
    if (!gameState.potionTargeting) {
      setPotionSelection([]);
      setOppTargetHighlight([]);
    }
  }, [gameState.potionTargeting]);

  // Damage number + Gold gain animations — detect changes from game state
  const [damageNumbers, setDamageNumbers] = useState([]);
  const [healNumbers, setHealNumbers] = useState([]);
  const [creatureDamageNumbers, setCreatureDamageNumbers] = useState([]);
  const [goldGains, setGoldGains] = useState([]);
  const [goldLosses, setGoldLosses] = useState([]);
  const prevHpRef = useRef(null);
  const prevCreatureHpRef = useRef(null);
  const prevGoldRef = useRef(null);
  const prevStatusRef = useRef(null);
  useEffect(() => {
    // Build current HP map
    const currentHp = {};
    for (let pi = 0; pi < 2; pi++) {
      const p = gameState.players[pi];
      for (let hi = 0; hi < (p.heroes || []).length; hi++) {
        const h = p.heroes[hi];
        if (h?.name) currentHp[`${pi}-${hi}`] = { name: h.name, hp: h.hp, owner: pi === myIdx ? 'me' : 'opp' };
      }
    }
    // Compare HP
    if (prevHpRef.current) {
      const newDmgNums = [];
      for (const [key, cur] of Object.entries(currentHp)) {
        const prev = prevHpRef.current[key];
        if (prev && cur.hp < prev.hp) {
          // Skip if this HP decrease was from Toughness removal (not real damage)
          if (toughnessHpSuppressRef.current[key]) {
            delete toughnessHpSuppressRef.current[key];
            continue;
          }
          const dmg = prev.hp - cur.hp;
          newDmgNums.push({ id: Date.now() + Math.random(), amount: dmg, heroName: cur.name });
        }
      }
      if (newDmgNums.length > 0) {
        setDamageNumbers(prev => [...prev, ...newDmgNums]);
        setTimeout(() => {
          setDamageNumbers(prev => prev.filter(d => !newDmgNums.some(n => n.id === d.id)));
        }, 1800);
      }
      // Detect HP increases (healing)
      const newHealNums = [];
      for (const [key, cur] of Object.entries(currentHp)) {
        const prev = prevHpRef.current[key];
        if (prev && cur.hp > prev.hp && prev.hp > 0) {
          const healed = cur.hp - prev.hp;
          const [piStr, hiStr] = key.split('-');
          newHealNums.push({ id: Date.now() + Math.random(), amount: healed, ownerLabel: cur.owner, heroIdx: parseInt(hiStr) });
        }
      }
      if (newHealNums.length > 0) {
        setHealNumbers(prev => [...prev, ...newHealNums]);
        setTimeout(() => {
          setHealNumbers(prev => prev.filter(d => !newHealNums.some(n => n.id === d.id)));
        }, 1800);
      }
    }
    prevHpRef.current = currentHp;

    // Build current creature HP map — include ALL creatures on the board
    const currentCreatureHp = {};
    for (let pi = 0; pi < 2; pi++) {
      const p = gameState.players[pi];
      for (let hi = 0; hi < (p.supportZones || []).length; hi++) {
        const zones = p.supportZones[hi] || [];
        for (let si = 0; si < zones.length; si++) {
          const slot = zones[si] || [];
          if (slot.length === 0) continue;
          const cKey = `${pi}-${hi}-${si}`;
          const counters = (gameState.creatureCounters || {})[cKey];
          // Use currentHp from counters if available, otherwise max HP from card DB or override
          const maxHp = counters?.maxHp ?? counters?._cardDataOverride?.hp ?? CARDS_BY_NAME[slot[0]]?.hp;
          if (maxHp != null) {
            currentCreatureHp[cKey] = counters?.currentHp ?? maxHp;
          }
        }
      }
    }
    // Compare creature HP
    if (prevCreatureHpRef.current) {
      const newCreatureDmg = [];
      for (const [key, curHp] of Object.entries(currentCreatureHp)) {
        const prevHp = prevCreatureHpRef.current[key];
        if (prevHp != null && curHp < prevHp) {
          const [ownerStr, heroIdxStr, slotStr] = key.split('-');
          const ownerIdx = parseInt(ownerStr);
          newCreatureDmg.push({
            id: Date.now() + Math.random(),
            amount: prevHp - curHp,
            ownerLabel: ownerIdx === myIdx ? 'me' : 'opp',
            heroIdx: parseInt(heroIdxStr),
            zoneSlot: parseInt(slotStr),
          });
        }
      }
      // Detect lethal damage: creature existed last frame but is now gone (destroyed)
      for (const [key, prevHp] of Object.entries(prevCreatureHpRef.current)) {
        if (!(key in currentCreatureHp) && prevHp > 0) {
          // Skip if creature moved zones (not destroyed)
          if (creatureMoveSuppressRef.current[key]) {
            delete creatureMoveSuppressRef.current[key];
            continue;
          }
          const [ownerStr, heroIdxStr, slotStr] = key.split('-');
          const ownerIdx = parseInt(ownerStr);
          newCreatureDmg.push({
            id: Date.now() + Math.random(),
            amount: prevHp,
            ownerLabel: ownerIdx === myIdx ? 'me' : 'opp',
            heroIdx: parseInt(heroIdxStr),
            zoneSlot: parseInt(slotStr),
          });
        }
      }
      if (newCreatureDmg.length > 0) {
        setCreatureDamageNumbers(prev => [...prev, ...newCreatureDmg]);
        setTimeout(() => {
          setCreatureDamageNumbers(prev => prev.filter(d => !newCreatureDmg.some(n => n.id === d.id)));
        }, 1800);
      }
    }
    prevCreatureHpRef.current = currentCreatureHp;

    // Compare Gold
    const currentGold = [gameState.players[0].gold || 0, gameState.players[1].gold || 0];
    if (prevGoldRef.current) {
      const newGoldGains = [];
      for (let pi = 0; pi < 2; pi++) {
        const diff = currentGold[pi] - prevGoldRef.current[pi];
        if (diff > 0) {
          newGoldGains.push({ id: Date.now() + Math.random() + pi, amount: diff, playerIdx: pi });
        }
      }
      if (newGoldGains.length > 0) {
        setGoldGains(prev => [...prev, ...newGoldGains]);
        setTimeout(() => {
          setGoldGains(prev => prev.filter(g => !newGoldGains.some(n => n.id === g.id)));
        }, 1800);
        // Trigger gold sparkle animation on the gold counter
        for (const g of newGoldGains) {
          const sel = `[data-gold-player="${g.playerIdx}"]`;
          setTimeout(() => playAnimation('gold_sparkle', sel, { duration: 1200 }), 50);
        }
      }
      // Detect gold losses
      const newGoldLosses = [];
      for (let pi = 0; pi < 2; pi++) {
        const diff = currentGold[pi] - prevGoldRef.current[pi];
        if (diff < 0) {
          newGoldLosses.push({ id: Date.now() + Math.random() + pi + 0.5, amount: -diff, playerIdx: pi });
        }
      }
      if (newGoldLosses.length > 0) {
        setGoldLosses(prev => [...prev, ...newGoldLosses]);
        setTimeout(() => {
          setGoldLosses(prev => prev.filter(g => !newGoldLosses.some(n => n.id === g.id)));
        }, 1800);
      }
    }
    prevGoldRef.current = currentGold;

    // Compare hero statuses for freeze/thaw animations
    const currentStatuses = {};
    for (let pi = 0; pi < 2; pi++) {
      for (let hi = 0; hi < (gameState.players[pi].heroes || []).length; hi++) {
        const h = gameState.players[pi].heroes[hi];
        if (h?.name) {
          const key = `${pi}-${hi}`;
          currentStatuses[key] = { ...h.statuses };
        }
      }
    }
    if (prevStatusRef.current) {
      for (const [key, cur] of Object.entries(currentStatuses)) {
        const prev = prevStatusRef.current[key] || {};
        const [pi, hi] = key.split('-').map(Number);
        const ownerLabel = pi === myIdx ? 'me' : 'opp';
        // Gained frozen → freeze animation
        if (cur.frozen && !prev.frozen) {
          const sel = `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${hi}"]`;
          const animType = cur.frozen?.animationType || 'freeze';
          setTimeout(() => playAnimation(animType, sel, { duration: 1000 }), 50);
        }
        // Gained stunned → stun animation (only if not also gaining frozen)
        if (cur.stunned && !prev.stunned && !(cur.frozen && !prev.frozen)) {
          const sel = `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${hi}"]`;
          const animType = cur.stunned?.animationType;
          if (animType) setTimeout(() => playAnimation(animType, sel, { duration: 1000 }), 50);
        }
        // Gained negated → electric strike animation
        if (cur.negated && !prev.negated) {
          const sel = `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${hi}"]`;
          const animType = cur.negated?.animationType || 'electric_strike';
          setTimeout(() => playAnimation(animType, sel, { duration: 1000 }), 50);
        }
        // Lost frozen or stunned → thaw animation
        if ((!cur.frozen && prev.frozen) || (!cur.stunned && prev.stunned)) {
          const sel = `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${hi}"]`;
          setTimeout(() => playAnimation('thaw', sel, { duration: 900 }), 50);
        }
        // Lost negated → thaw animation
        if (!cur.negated && prev.negated) {
          const sel = `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${hi}"]`;
          setTimeout(() => playAnimation('thaw', sel, { duration: 900 }), 50);
        }
        // Gained burned → flame strike animation
        if (cur.burned && !prev.burned) {
          const sel = `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${hi}"]`;
          const animType = cur.burned?.animationType || 'flame_strike';
          setTimeout(() => playAnimation(animType, sel, { duration: 1000 }), 50);
        }
      }
    }
    prevStatusRef.current = currentStatuses;
  }, [gameState]);

  // ── Potion targeting helpers ──
  const pt = gameState.potionTargeting;
  const isTargeting = !isSpectator && !result && pt && pt.ownerIdx === myIdx;
  // Generic lock: blocks ALL effect activations (hero effects, abilities, creature effects)
  // whenever ANY targeting/prompt overlay is active
  const isEffectLocked = !!(isTargeting || gameState.effectPrompt || gameState.surprisePending || gameState.mulliganPending || gameState.heroEffectPending || spellHeroPick || pendingAdditionalPlay || pendingAbilityActivation || showSurrender || showEndTurnConfirm);
  const validTargetIds = isTargeting ? new Set((pt.validTargets || []).map(t => t.id)) : new Set();
  const selectedSet = new Set(potionSelection);

  const togglePotionTarget = (targetId) => {
    if (!isTargeting || !validTargetIds.has(targetId)) return;
    const target = pt.validTargets.find(t => t.id === targetId);
    if (!target) return;
    setPotionSelection(prev => {
      if (prev.includes(targetId)) {
        // Deselect
        return prev.filter(id => id !== targetId);
      }
      // Check exclusive types
      const config = pt.config || {};
      if (config.exclusiveTypes) {
        const prevTargets = prev.map(id => pt.validTargets.find(t => t.id === id)).filter(Boolean);
        const prevTypes = new Set(prevTargets.map(t => t.type));
        if (prevTypes.size > 0 && !prevTypes.has(target.type)) {
          // Switching type — clear previous
          return [targetId];
        }
      }
      // Check max per type
      const maxPerType = config.maxPerType || {};
      const max = maxPerType[target.type] ?? Infinity;
      const sameType = prev.filter(id => {
        const t2 = pt.validTargets.find(t => t.id === id);
        return t2 && t2.type === target.type;
      });
      if (sameType.length >= max) {
        // At limit — swap: remove oldest same-type selection, add new one
        const without = prev.filter(id => !sameType.includes(id));
        return [...without, targetId];
      }
      // Check global max total
      const maxTotal = config.maxTotal ?? Infinity;
      if (prev.length >= maxTotal) {
        // At global limit — swap: replace with new selection
        return [targetId];
      }
      return [...prev, targetId];
    });
  };

  const canConfirmPotion = (() => {
    if (pt?.config?.alwaysConfirmable) return true;
    if (potionSelection.length === 0) return false;
    const minReq = pt?.config?.minRequired || 0;
    return potionSelection.length >= minReq;
  })();

  // ── Effect prompt helpers (confirm, card gallery, zone picker) ──
  const ep = gameState.effectPrompt;
  const isMyEffectPrompt = !isSpectator && !result && ep && ep.ownerIdx === myIdx;
  const isOppEffectPrompt = !isSpectator && !result && ep && ep.ownerIdx !== myIdx && ep.ownerIdx !== (gameState.activePlayer ?? -1);
  const isActivePlayerPromptForOpp = !isSpectator && !result && ep && ep.ownerIdx !== myIdx && ep.ownerIdx === (gameState.activePlayer ?? -1) && ep.showOpponentWaiting;
  const zonePickSet = new Set();
  if (isMyEffectPrompt && ep.type === 'zonePick') {
    for (const z of (ep.zones || [])) {
      zonePickSet.add(`${myIdx}-${z.heroIdx}-${z.slotIdx}`);
    }
  }
  // ── Slippery Skates two-step move ──
  const [skatesSelected, setSkatesSelected] = useState(null); // selected creature zoneSlot or null
  const skatesCreatureSet = new Set();
  const skatesDestSet = new Set();
  if (isMyEffectPrompt && ep.type === 'skatesMove') {
    for (const c of (ep.creatures || [])) {
      skatesCreatureSet.add(`${myIdx}-${ep.heroIdx}-${c.zoneSlot}`);
    }
    if (skatesSelected != null) {
      for (const z of (ep.destZones || [])) {
        skatesDestSet.add(`${myIdx}-${z.heroIdx}-${z.slotIdx}`);
      }
    }
  }
  // Reset skatesSelected when prompt changes
  useEffect(() => {
    if (!isMyEffectPrompt || ep?.type !== 'skatesMove') setSkatesSelected(null);
  }, [ep?.type]);

  // ── Chain Target Pick (Chain Lightning / Qinglong / Bottled Lightning) ──
  const [chainPickSelected, setChainPickSelected] = useState([]); // [{id, type, owner, heroIdx, slotIdx?, cardName}]
  useEffect(() => {
    if (!ep || ep.type !== 'chainTargetPick') setChainPickSelected([]);
  }, [ep?.type, ep?.title]);

  const chainPickData = (isMyEffectPrompt && ep?.type === 'chainTargetPick') ? ep : null;
  const chainPickValidIds = new Set();
  const chainPickSelectedIds = new Set(chainPickSelected.map(t => t.id));
  const chainPickDamages = chainPickData?.damages || [];
  const chainPickMaxTargets = chainPickDamages.length;
  const chainPickHeroesFirst = chainPickData?.heroesFirst || false;
  if (chainPickData) {
    const allTargets = chainPickData.targets || [];
    // Determine which targets are valid for the current step
    const step = chainPickSelected.length;
    if (step < chainPickMaxTargets) {
      for (const t of allTargets) {
        if (chainPickSelectedIds.has(t.id)) continue;
        // Heroes-first: if there are unselected heroes, only heroes are valid
        if (chainPickHeroesFirst) {
          const unselectedHeroes = allTargets.filter(x => x.type === 'hero' && !chainPickSelectedIds.has(x.id));
          if (unselectedHeroes.length > 0 && t.type !== 'hero') continue;
        }
        chainPickValidIds.add(t.id);
      }
    }
  }
  const chainPickIsFinal = !!(chainPickData && chainPickSelected.length > 0 && (
    chainPickSelected.length >= chainPickMaxTargets || chainPickValidIds.size === 0
  ));
  const chainPickCanConfirm = chainPickIsFinal;

  // Escape removes last selection, Enter confirms chain
  useEffect(() => {
    if (!chainPickData) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        if (chainPickSelected.length > 0) {
          setChainPickSelected(prev => prev.slice(0, -1));
        }
      } else if ((e.key === 'Enter' || e.code === 'Space') && chainPickCanConfirm) {
        e.preventDefault();
        e.stopImmediatePropagation();
        respondToPrompt({ selectedTargets: chainPickSelected });
        setChainPickSelected([]);
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [chainPickData, chainPickSelected.length, chainPickCanConfirm]);
  const respondToPrompt = (response) => {
    socket.emit('effect_prompt_response', { roomId: gameState.roomId, response });
  };

  // Escape key dismisses deckSearchReveal prompts (opponent's search result confirmation)
  useEffect(() => {
    const ep = gameState.effectPrompt;
    if (!ep || ep.type !== 'deckSearchReveal' || ep.ownerIdx !== myIdx) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        respondToPrompt({ confirmed: true });
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [gameState.effectPrompt]);

  // Escape key cancels skatesMove prompt
  useEffect(() => {
    const ep = gameState.effectPrompt;
    if (!ep || ep.type !== 'skatesMove' || ep.ownerIdx !== myIdx) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        setSkatesSelected(null);
        respondToPrompt({ cancelled: true });
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [gameState.effectPrompt]);

  // ── SC earned display helper ──
  const renderSCEarned = () => {
    if (!scEarned) return null;
    if (isSpectator) {
      // Spectator sees both players' SC data
      const entries = [];
      for (const [piStr, data] of Object.entries(scEarned)) {
        if (data?.total > 0) {
          const pName = gameState.players[parseInt(piStr)]?.username || 'Player';
          entries.push({ name: pName, ...data });
        }
      }
      if (entries.length === 0) return null;
      return (
        <div style={{ marginTop: 20, marginBottom: 20, textAlign: 'center' }}>
          {entries.map(e => (
            <div key={e.name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#ffd700', fontWeight: 700, fontSize: 15 }}>
                <span>{e.name}:</span>
                <span>{e.total}</span>
                <img src="/data/sc.png" style={{ width: 18, height: 18, imageRendering: 'pixelated' }} />
                <span>earned!</span>
              </div>
              <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {(e.rewards || []).map(r => (
                  <div key={r.id} style={{ fontSize: 12, color: 'var(--text2)' }}>
                    <span style={{ color: '#ffd700', fontWeight: 600 }}>{r.title}</span>
                    {' — '}{r.description}{' '}
                    <span style={{ color: '#ffd700' }}>+{r.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
    if (!scEarned.total || scEarned.total <= 0) return null;
    return (
      <div style={{ marginTop: 20, marginBottom: 20, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#ffd700', fontWeight: 700, fontSize: 18, textShadow: '0 0 12px rgba(255,215,0,.5)' }}>
          <span>{scEarned.total}</span>
          <img src="/data/sc.png" style={{ width: 24, height: 24, imageRendering: 'pixelated' }} />
          <span>earned!</span>
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(scEarned.rewards || []).map(r => (
            <div key={r.id} style={{ fontSize: 13, color: 'var(--text2)' }}>
              <span style={{ color: '#ffd700', fontWeight: 700 }}>{r.title}</span>
              {' — '}{r.description}{' '}
              <span style={{ color: '#ffd700', fontWeight: 700 }}>+{r.amount}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Compute per-column max support zone count AND left/right island padding across both players
  const columnLayout = [0, 1, 2].map(hi => {
    const counts = [0, 1].map(pi => {
      const ic = (gameState.players[pi].islandZoneCount || [0,0,0])[hi] || 0;
      return { left: Math.floor(ic / 2), right: ic - Math.floor(ic / 2) };
    });
    const maxLeft = Math.max(counts[0].left, counts[1].left);
    const maxRight = Math.max(counts[0].right, counts[1].right);
    const maxZones = maxLeft + 3 + maxRight;
    return { maxZones, maxLeft, maxRight };
  });

  // Render a player's side (3 hero columns, each with hero+surprise, 3 abilities, N supports)
  // ── Collapse state for log/chat ──
  const [logCollapsed, setLogCollapsed] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const toggleLogCollapse = () => { setLogCollapsed(v => !v); if (chatCollapsed) setChatCollapsed(false); };
  const toggleChatCollapse = () => { setChatCollapsed(v => !v); if (logCollapsed) setLogCollapsed(false); };

  // ── Action Log Formatter ──
  const formatLogEntry = (entry) => {
    const pName = (name, color) => <span className="log-player-name" style={{ color: color || '#fff' }}>{name}</span>;
    const logCardColor = (name) => {
      const card = CARDS_BY_NAME[name];
      if (!card) return '#ffcc44';
      const m = { Artifact:'#ffd700', Potion:'#a0724a', Ability:'#4488ff', Spell:'#ff4444', Attack:'#ff4444', Creature:'#44cc66', Hero:'#bb66ff', 'Ascended Hero':'#bb66ff', Token:'#999' };
      return m[card.cardType] || '#ffcc44';
    };
    const cName = (name) => <span className="log-card-name" style={{ color: logCardColor(name) }}>{name}</span>;
    const p0 = gameState.players[0], p1 = gameState.players[1];
    const getPlayer = (username) => {
      if (username === p0.username) return { name: p0.username, color: p0.color };
      if (username === p1.username) return { name: p1.username, color: p1.color };
      return { name: username || '?', color: '#aaa' };
    };
    const playerByName = (n) => getPlayer(n);
    const t = entry.type;
    const statusColor = (s) => {
      const sl = (s||'').toLowerCase();
      if (sl === 'burned' || sl === 'burn') return '#ff8833';
      if (sl === 'frozen' || sl === 'freeze') return '#88ddff';
      if (sl === 'stunned' || sl === 'stun') return '#ffdd44';
      if (sl === 'negated' || sl === 'negate') return '#ccaa22';
      if (sl === 'poisoned' || sl === 'poison') return '#bb66ff';
      if (sl === 'petrified' || sl === 'petrify') return '#999';
      if (sl === 'shielded' || sl === 'shield') return '#44ddff';
      if (sl === 'charmed' || sl === 'charme') return '#ff66aa';
      if (sl === 'submerged' || sl === 'submerge') return '#4488cc';
      if (sl === 'immune' || sl === 'immunity') return '#66ffaa';
      return '#aa88ff';
    };
    /** Capitalize first letter of a status/buff name */
    const capStatus = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
    /** Render a status/buff name in its color, capitalized */
    const styledStatus = (s) => <strong style={{ color: statusColor(s) }}>{capStatus(s)}</strong>;
    try {
      if (t === 'turn_start') { const p = playerByName(entry.username); return <span className="log-info">── Turn {entry.turn} ({pName(p.name, p.color)}) ──</span>; }
      if (t === 'spell_played') {
        const p = playerByName(entry.player);
        const verb = entry.type === 'Attack' || (entry.cardType || entry.type2) === 'Attack' ? 'used' : 'played';
        return <span>{pName(p.name, p.color)} {verb} {cName(entry.card)}!</span>;
      }
      if (t === 'creature_summoned') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} summoned {cName(entry.card)}!</span>; }
      if (t === 'hero_ascension') { const p = playerByName(entry.player); return <span>🦋 {pName(p.name, p.color)}'s {entry.oldHero} ascended into {cName(entry.newHero)}!</span>; }
      if (t === 'torchure_poison') { const p = playerByName(entry.player); return <span>☠️ {pName(p.name, p.color)} torchured {entry.hero}!</span>; }
      if (t === 'willy_draw') { const p = playerByName(entry.player); return <span>🍀 {pName(p.name, p.color)}'s Willy drew {entry.count} cards!</span>; }
      if (t === 'willy_gold') { const p = playerByName(entry.player); return <span>💰 {pName(p.name, p.color)}'s Willy granted {entry.amount} Gold!</span>; }
      if (t === 'luck_declare') { const p = playerByName(entry.player); return <span>🍀 {pName(p.name, p.color)} declared {cName(entry.card)} with Luck (Lv{entry.level})!</span>; }
      if (t === 'luck_trigger') { const p = playerByName(entry.player); return <span>🌈 {pName(p.name, p.color)}'s Luck triggered on {cName(entry.card)}! Drew {entry.drawn} cards.</span>; }
      if (t === 'alleria_surprise_draw') { const p = playerByName(entry.player); return <span>🕸️ {pName(p.name, p.color)}'s Alleria drew 1 card from Surprise activation!</span>; }
      if (t === 'trapping_set') { const p = playerByName(entry.player); return <span>🪤 {pName(p.name, p.color)}'s {entry.hero} set {cName(entry.card)} via Trapping!</span>; }
      if (t === 'controlled_attack') { const p = playerByName(entry.player); return <span>🔮 {pName(p.name, p.color)} took control of {entry.target}'s abilities!</span>; }
      if (t === 'jumpscare_stun') { const p = playerByName(entry.player); return <span>😱 {pName(p.name, p.color)}'s Jumpscare stunned {entry.target}!</span>; }
      if (t === 'slippery_skates_move') { const p = playerByName(entry.player); return <span>⛸️ {pName(p.name, p.color)} slid {cName(entry.card)} from {entry.fromHero} to {entry.toHero}!</span>; }
      if (t === 'anti_magic_shield') { const p = playerByName(entry.player); return <span>🛡️ {pName(p.name, p.color)}'s Anti Magic Shield negated {cName(entry.negated)}!</span>; }
      if (t === 'fireshield_recoil') { const p = playerByName(entry.player); return <span>🔥 {pName(p.name, p.color)}'s {entry.hero} reflected {entry.recoil} damage{entry.fullDamage ? ' (full!)' : ''} back to {entry.attacker}!</span>; }
      if (t === 'creation_lock') { const p = playerByName(entry.player); return <span>✨ {pName(p.name, p.color)} locked {entry.cards.map(c => cName(c)).reduce((a, b, i) => i === 0 ? [b] : [...a, ', ', b], [])} for the turn.</span>; }
      if (t === 'alchemic_journal_draw') { const p = playerByName(entry.player); return <span>📓 {pName(p.name, p.color)} drew a Potion via Alchemic Journal!</span>; }
      if (t === 'alchemic_journal_choose') { const p = playerByName(entry.player); return <span>📓 {pName(p.name, p.color)} chose {cName(entry.card)} via Alchemic Journal!</span>; }
      if (t === 'baihu_petrify') { const p = playerByName(entry.player); return <span>🐅 {pName(p.name, p.color)}'s Baihu petrified {entry.target}!</span>; }
      if (t === 'xuanwu_revive') { const p = playerByName(entry.player); return <span>🐢 {pName(p.name, p.color)}'s Xuanwu revived {cName(entry.card)} with {entry.hp} HP!</span>; }
      if (t === 'zhuque_burn') { const p = playerByName(entry.player); return <span>🐦 {pName(p.name, p.color)}'s Zhuque burned {entry.target}!</span>; }
      if (t === 'cardinal_win') { const p = playerByName(entry.player); return <span>🏆 {pName(p.name, p.color)} controls all 4 Cardinal Beasts! VICTORY!</span>; }
      if (t === 'bottled_discard') { const p = playerByName(entry.player); return <span>🗑️ {pName(p.name, p.color)} discarded {cName(entry.card)} ({entry.by}).</span>; }
      if (t === 'bottled_take') { const p = playerByName(entry.player); return <span>💥 {pName(p.name, p.color)} takes the {cName(entry.potion)} effect!</span>; }
      if (t === 'ability_attached') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} attached {cName(entry.card)} to {entry.hero}.</span>; }
      if (t === 'artifact_equipped') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} equipped {cName(entry.card)} to {entry.hero}{entry.cost ? ` (${entry.cost}G)` : ''}.</span>; }
      if (t === 'ability_activated') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} activated {cName(entry.card)} (Lv{entry.level})!</span>; }
      if (t === 'hero_effect_activated') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)}'s {entry.hero} activated their effect!</span>; }
      if (t === 'creature_effect_activated') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)}'s {cName(entry.card)} activated its effect!</span>; }
      if (t === 'surprise_set') { const p = playerByName(entry.player); return <span>🎭 {pName(p.name, p.color)} set a Surprise on {entry.hero}.</span>; }
      if (t === 'surprise_activated') { const p = playerByName(entry.player); return <span>💥 {pName(p.name, p.color)} activated {cName(entry.card)} on {entry.hero}!</span>; }
      if (t === 'surprise_reset') { const p = playerByName(entry.player); return <span>🎭 {cName(entry.card)} returned to Surprise position.</span>; }
      if (t === 'surprise_negate') { const p = playerByName(entry.player); return <span>🚫 {cName(entry.card)} negated the effect!</span>; }
      if (t === 'surprise_destroyed') { const p = playerByName(entry.player); return <span>🌊 {pName(p.name, p.color)} destroyed {cName(entry.card)}!</span>; }
      if (t === 'terror_triggered') { const p = playerByName(entry.player); return <span>😱 Terror! {pName(p.name, p.color)} resolved {entry.count} effects — turn ends!</span>; }
      if (t === 'ushabti_entomb') { const p = playerByName(entry.player); return <span>🏺 {cName(entry.card)} was entombed in {entry.hero}'s Surprise Zone!</span>; }
      if (t === 'nomu_draw') { const p = playerByName(entry.player); return <span>🌌 {pName(p.name, p.color)}'s Nomu drew an extra card!</span>; }
      if (t === 'gate_activated') { const p = playerByName(entry.player); return <span>🛡️ {pName(p.name, p.color)} activated {cName(entry.card)}! Support Zones protected!</span>; }
      if (t === 'token_placed') { const p = playerByName(entry.player); return <span>{cName(entry.card)} placed on {pName(p.name, p.color)}'s {entry.hero}.</span>; }
      if (t === 'damage') { return <span className="log-damage">{cName(entry.source)} dealt <span className="log-amount">{entry.amount}</span> to {entry.target}!</span>; }
      if (t === 'creature_damage') { return <span className="log-damage">{cName(entry.source)} dealt <span className="log-amount">{entry.amount}</span> to {cName(entry.target)}!</span>; }
      if (t === 'recoil') { return <span className="log-damage">{entry.hero} takes <span className="log-amount">{entry.amount}</span> recoil from {cName(entry.by)}!</span>; }
      if (t === 'creature_destroyed') { return <span className="log-damage">{cName(entry.card)} was defeated!</span>; }
      if (t === 'hero_ko') { return <span className="log-hero-defeated">💀 {entry.hero} was defeated!</span>; }
      if (t === 'heal') { return <span className="log-heal">{entry.target} healed <span className="log-amount">{entry.amount}</span> HP!</span>; }
      if (t === 'heal_creature') { return <span className="log-heal">{cName(entry.target)} healed <span className="log-amount">{entry.amount}</span> HP!</span>; }
      if (t === 'draw_batch') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} drew {entry.count} card{entry.count>1?'s':''}.</span>; }
      if (t === 'potion_draw') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} drew a card from Potion Deck!</span>; }
      if (t === 'status_add') {
        const s = entry.status || '';
        if (s.toLowerCase() === 'shielded') return null;
        const src = entry.source ? <> by {cName(entry.source)}</> : '';
        return <span>{entry.target} was {styledStatus(s)}{src}!</span>;
      }
      if (t === 'status_remove') {
        if ((entry.status||'').toLowerCase() === 'shielded') return null;
        return <span className="log-info">{entry.target} lost {styledStatus(entry.status)}.</span>;
      }
      if (t === 'status_blocked') {
        return <span className="log-info">{styledStatus(entry.status)} on {entry.target} was blocked ({entry.reason}).</span>;
      }
      if (t === 'buff_add') {
        const target = entry.hero || entry.creature;
        return <span>{target} received {styledStatus(entry.buff)}!</span>;
      }
      if (t === 'buff_remove') {
        const target = entry.hero || entry.creature;
        return <span className="log-info">{target} lost {styledStatus(entry.buff)}.</span>;
      }
      if (t === 'card_negated') { return <span className="log-info">{cName(entry.card)} was {styledStatus('negated')}!</span>; }
      if (t === 'effect_negated') { return <span className="log-info">{cName(entry.card)} was {styledStatus('negated')}!</span>; }
      if (t === 'creature_negated') { return <span className="log-info">{cName(entry.creature)}'s effects were {styledStatus('negated')}!</span>; }
      if (t === 'hero_revived') { return <span className="log-heal">{entry.hero} was revived with {entry.hp} HP!</span>; }
      if (t === 'gold_gain') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} gained <span className="log-amount" style={{color:'#ffcc44'}}>+{entry.amount}</span> Gold.</span>; }
      if (t === 'gold_spend') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} spent <span className="log-amount" style={{color:'#cc8844'}}>{entry.amount}</span> Gold.</span>; }
      if (t === 'forced_discard') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} discarded {cName(entry.card)}.</span>; }
      if (t === 'discard') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} discarded {cName(entry.card)}.</span>; }
      if (t === 'discard_batch') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} discarded {entry.count} card{entry.count>1?'s':''}.</span>; }
      if (t === 'delete_batch') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} deleted {entry.count} card{entry.count>1?'s':''}.</span>; }
      if (t === 'force_delete') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} deleted {cName(entry.card)}{entry.by ? ` (${entry.by})` : ''}.</span>; }
      if (t === 'destroy') { return <span className="log-damage">{cName(entry.target)} was destroyed!</span>; }
      if (t === 'all_heroes_dead') { return <span className="log-damage" style={{fontWeight:700}}>All heroes defeated!</span>; }
      if (t === 'reaction_activated') { return <span className="log-status">{cName(entry.card)} activated as a Reaction!</span>; }
      if (t === 'burn_damage') { return <span className="log-damage">{entry.target} took <span className="log-amount" style={{color:'#ff8833'}}>{entry.amount}</span> {styledStatus('burn')} damage!</span>; }
      if (t === 'poison_damage') { return <span className="log-damage">{entry.target} took <span className="log-amount" style={{color:'#bb66ff'}}>{entry.amount}</span> {styledStatus('poison')} damage!</span>; }
      if (t === 'level_change') { return <span className="log-info">{cName(entry.card)} is now Lv{entry.newLevel}.</span>; }
      if (t === 'deck_out') { const p = playerByName(entry.player); return <span className="log-damage">{pName(p.name, p.color)} decked out!</span>; }
      if (t === 'target_redirect') { return <span className="log-info">Target redirected to {entry.newTarget}!</span>; }
      if (t === 'move') { return <span className="log-info">{cName(entry.card)} was moved.</span>; }
      if (t === 'card_played') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} used {cName(entry.card)}{entry.cost ? ` (${entry.cost}G)` : ''}!</span>; }
      if (t === 'placement') { return <span>{cName(entry.card)} was summoned by {cName(entry.by)}!</span>; }
      if (t === 'hand_limit_discard') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} discarded {cName(entry.card)} (hand limit).</span>; }
      if (t === 'hand_limit_deleted') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} deleted {cName(entry.card)} (hand limit).</span>; }
      if (t === 'card_added_to_hand') {
        const p = playerByName(entry.player);
        const via = entry.by ? <> via {cName(entry.by)}</> : '';
        return <span>{pName(p.name, p.color)} added {cName(entry.card)} to hand{via}!</span>;
      }
      if (t === 'deck_search') {
        const p = playerByName(entry.player);
        return <span>{pName(p.name, p.color)} added {cName(entry.card)} from their deck to their hand via {cName(entry.by)}!</span>;
      }
      if (t === 'charme_steal') { const p = playerByName(entry.player); return <span className="log-status">{pName(p.name, p.color)} stole {cName(entry.card)} from {entry.from}!</span>; }
      if (t === 'charme_control') { const p = playerByName(entry.player); return <span className="log-status">{pName(p.name, p.color)} took control of {entry.target}!</span>; }
      if (t === 'damage_blocked') { return <span className="log-info">Damage to {entry.target} was blocked ({entry.reason}).</span>; }
      if (t === 'bartas_second_cast') { const p = playerByName(entry.player); return <span className="log-status">{pName(p.name, p.color)}'s {entry.hero} casts {cName(entry.spell)} at a second target!</span>; }
      if (t === 'force_discard') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} discarded {cName(entry.card)}{entry.by ? ` (${entry.by})` : ''}.</span>; }
      if (t === 'shuffle_back') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} shuffled {entry.count} card{entry.count>1?'s':''} back into deck{entry.source ? ` (${entry.source})` : ''}.</span>; }
      if (t === 'leadership_shuffle') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} shuffled {entry.count} card{entry.count!==1?'s':''} back and redraws.</span>; }
      if (t === 'elana_shuffle') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} shuffled hand back and draws {entry.drawing} cards.</span>; }
      if (t === 'mill') {
        const p = playerByName(entry.player);
        const dest = entry.destination === 'delete' ? 'deleted' : 'discarded';
        return <span>{pName(p.name, p.color)} milled {entry.count} card{entry.count>1?'s':''} ({dest}){entry.source ? <> by {cName(entry.source)}</> : ''}.</span>;
      }
      if (t === 'additional_action_used') { const p = playerByName(entry.player); return <span className="log-info">{pName(p.name, p.color)} used an additional action ({cName(entry.provider)}).</span>; }
      if (t === 'atk_grant') { return <span className="log-info">{entry.hero} gained +{entry.amount} ATK from {cName(entry.source)}.</span>; }
      if (t === 'atk_revoke') { return <span className="log-info">{entry.hero} lost {entry.amount} ATK ({cName(entry.source)}).</span>; }
      if (t === 'max_hp_increase') { return <span className="log-info">{entry.hero} max HP increased to {entry.newMax}.</span>; }
      if (t === 'max_hp_decrease') { return <span className="log-info">{entry.hero} max HP decreased to {entry.newMax}.</span>; }
      if (t === 'shard_retrieve') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} retrieved {(entry.retrieved||[]).map((c,i) => <React.Fragment key={i}>{i>0 && ', '}{cName(c)}</React.Fragment>)} from discard!</span>; }
      if (t === 'shard_delete') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)} deleted {(entry.deleted||[]).length} card{(entry.deleted||[]).length!==1?'s':''}.</span>; }
      if (t === 'creature_revived') { const p = playerByName(entry.player); return <span className="log-heal">{cName(entry.card)} was revived{entry.by ? <> by {cName(entry.by)}</> : ''}!</span>; }
      if (t === 'permanent_placed') { const p = playerByName(entry.player); return <span className="log-info">{cName(entry.card)} entered play for {pName(p.name, p.color)}.</span>; }
      if (t === 'permanent_removed') { const p = playerByName(entry.player); return <span className="log-info">{cName(entry.card)} left play for {pName(p.name, p.color)}.</span>; }
      if (t === 'monia_protect') {
        if (entry.protectedCreature) return <span className="log-status">{entry.hero} protected {cName(entry.protectedCreature)}!</span>;
        if (entry.creaturesProtected?.length) return <span className="log-status">{entry.hero} protected {entry.creaturesProtected.map((c,i) => <React.Fragment key={i}>{i>0 && ', '}{cName(c)}</React.Fragment>)}!</span>;
        return null;
      }
      if (t === 'diamond_protect') { return <span className="log-status">Diamond protected {cName(entry.creature)} — damage {styledStatus('negated')}!</span>; }
      if (t === 'diamond_protect_failed') { return <span className="log-info">Diamond tried to protect {cName(entry.creature)} but damage cannot be negated.</span>; }
      if (t === 'diamond_self_damage') { return <span className="log-damage">{entry.hero} takes <span className="log-amount">{entry.amount}</span> self-damage protecting {entry.protectedCount} creature{entry.protectedCount!==1?'s':''}!</span>; }
      if (t === 'diamond_status_immune') { return <span className="log-info">{cName(entry.creature)} is immune to status effects (Diamond).</span>; }
      if (t === 'ghuanjun_combo') { const p = playerByName(entry.player); return <span className="log-status">{pName(p.name, p.color)}'s {entry.hero} enters combo mode!</span>; }
      if (t === 'immortal_applied') { return <span className="log-status">{entry.target} gained Immortal from {entry.by}!</span>; }
      if (t === 'bill_equip') { const p = playerByName(entry.player); return <span>{pName(p.name, p.color)}'s Bill equipped {cName(entry.equip)} to {entry.hero}!</span>; }
      if (t === 'kazena_storm') { const p = playerByName(entry.player); return <span className="log-status">{pName(p.name, p.color)}'s Kazena drew {entry.drawn} card{entry.drawn!==1?'s':''}!</span>; }
      if (t === 'tharx_draw') { const p = playerByName(entry.player); return <span className="log-status">{pName(p.name, p.color)}'s Tharx drew {entry.drawn} card{entry.drawn!==1?'s':''} ({entry.creatures} creature{entry.creatures!==1?'s':''})!</span>; }
      if (t === 'venom_infusion') { const p = playerByName(entry.player); return <span className="log-status">{pName(p.name, p.color)}'s {entry.hero} poisoned {entry.target}{entry.unhealable ? ' with Unhealable Poison' : ''}!</span>; }
      if (t === 'poisoned_well') { const p = playerByName(entry.player); return <span className="log-status">{pName(p.name, p.color)}'s {entry.hero} poisoned {entry.targets} target{entry.targets !== 1 ? 's' : ''} with Poisoned Well!</span>; }
      if (t === 'zsos_ssar_cost') { const p = playerByName(entry.player); return <span className="log-status">{pName(p.name, p.color)}'s {entry.hero} inflicted Poison on {entry.target} (Serpent's Cost).</span>; }
      if (t === 'zsos_ssar_boost') { return <span className="log-damage">{entry.hero}'s damage boosted by <span className="log-amount">+{entry.bonus}</span> ({entry.poisonedCount} poisoned target{entry.poisonedCount !== 1 ? 's' : ''})!</span>; }
      if (t === 'peszet_plague') { const p = playerByName(entry.player); return <span className="log-status">{pName(p.name, p.color)}'s {entry.hero} poisoned {entry.target} ({cName(entry.trigger)} summoned).</span>; }
      if (t === 'biomancy_token_created') { const p = playerByName(entry.player); return <span className="log-info">{pName(p.name, p.color)}'s {entry.hero} converted {cName(entry.potion)} into a Biomancy Token ({entry.hp} HP)!</span>; }
      if (t === 'biomancy_token_attack') { const p = playerByName(entry.player); return <span className="log-damage">Biomancy Token dealt <span className="log-amount">{entry.damage}</span> damage to {entry.target}!</span>; }
      if (t === 'intrude_placed') { const p = playerByName(entry.player); return <span className="log-info">{pName(p.name, p.color)} attached {cName('Intrude')} to {entry.hero}.</span>; }
      if (t === 'intrude_negate') { const p = playerByName(entry.player); return <span className="log-status">{pName(p.name, p.color)}'s Intrude negated {entry.target}'s draw of {entry.blocked} card{entry.blocked!==1?'s':''}!</span>; }
      if (t === 'intrude_copy') { const p = playerByName(entry.player); return <span className="log-status">{pName(p.name, p.color)}'s Intrude copied {entry.from}'s draw — drew {entry.copied} card{entry.copied!==1?'s':''}!</span>; }
    } catch(e) {}
    return null;
  };

  // ── Pre-process action log: batch consecutive draws and discards ──
  const processedLog = useMemo(() => {
    const result = [];
    for (let i = 0; i < actionLog.length; i++) {
      const entry = actionLog[i];
      if (entry.type === 'draw') {
        let count = 1;
        while (i + 1 < actionLog.length && actionLog[i + 1].type === 'draw' && actionLog[i + 1].player === entry.player) { count++; i++; }
        result.push({ ...entry, type: 'draw_batch', count, id: entry.id });
      } else if (entry.type === 'discard' || entry.type === 'forced_discard') {
        let count = 1;
        const firstCard = entry.card;
        while (i + 1 < actionLog.length && (actionLog[i + 1].type === 'discard' || actionLog[i + 1].type === 'forced_discard') && actionLog[i + 1].player === entry.player) { count++; i++; }
        if (count > 1) result.push({ ...entry, type: 'discard_batch', count, id: entry.id });
        else result.push(entry);
      } else if (entry.type === 'force_delete') {
        let count = 1;
        while (i + 1 < actionLog.length && actionLog[i + 1].type === 'force_delete' && actionLog[i + 1].player === entry.player) { count++; i++; }
        if (count > 1) result.push({ ...entry, type: 'delete_batch', count, id: entry.id });
        else result.push(entry);
      } else {
        result.push(entry);
      }
    }
    return result;
  }, [actionLog]);

  // ── Render Action Log ──
  const renderActionLog = () => {
    return (
      <div className="action-log-panel" style={logCollapsed ? { flex: '0 0 28px' } : chatCollapsed ? { flex: 1 } : undefined}>
        <div className="action-log-header" style={{ cursor: 'pointer' }} onClick={toggleLogCollapse}>
          <span style={{ flex: 1 }}>⚔ Action Log</span>
          <span style={{ fontSize: 10, opacity: .6 }}>{logCollapsed ? '▸' : '▾'}</span>
        </div>
        {!logCollapsed && (
          <div className="action-log-body" ref={actionLogRef}>
            {processedLog.map((entry, i) => {
              const formatted = formatLogEntry(entry);
              if (!formatted) return null;
              return <div key={entry.id || i} className="action-log-entry">{formatted}</div>;
            })}
          </div>
        )}
      </div>
    );
  };

  // ── Chat send handler ──
  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    if (chatView.startsWith('private:')) {
      const target = chatView.slice(8);
      socket.emit('chat_private', { roomId: gameState.roomId, targetUsername: target, text });
    } else {
      socket.emit('chat_message', { roomId: gameState.roomId, text });
    }
    setChatInput('');
  };

  // ── Render Chat Panel ──
  const renderChatPanel = () => {
    const participants = gameState.roomParticipants || { players: [], spectators: [] };
    const isPrivate = chatView.startsWith('private:');
    const privateTarget = isPrivate ? chatView.slice(8) : null;
    const myUsername = gameState.players[gameState.myIndex]?.username || '';
    const pairKey = privateTarget ? [myUsername, privateTarget].sort().join('::') : null;
    const privateMsgs = pairKey ? (privateChats[pairKey] || []) : [];

    return (
      <div className="chat-panel" style={chatCollapsed ? { flex: '0 0 28px' } : logCollapsed ? { flex: 1 } : { position: 'relative' }}>
        {!chatCollapsed && pingFlash && <div className="chat-ping-flash" style={{ color: pingFlash.color, background: pingFlash.color }} />}
        <div className="chat-header" style={{ cursor: 'pointer' }} onClick={toggleChatCollapse}>
          {!chatCollapsed && isPrivate && <span className="chat-header-back" onClick={(e) => { e.stopPropagation(); setChatView('main'); }}>◀</span>}
          <span style={{ flex: 1 }}>{isPrivate && !chatCollapsed ? `DM: ${privateTarget}` : '💬 Chat'}</span>
          <span style={{ fontSize: 10, opacity: .6 }}>{chatCollapsed ? '▸' : '▾'}</span>
        </div>
        {!chatCollapsed && (<>
        {!isPrivate && (
          <div className="chat-tabs">
            <div className={'chat-tab' + (chatView === 'main' ? ' active' : '')} onClick={() => setChatView('main')}>Chat</div>
            <div className={'chat-tab' + (chatView === 'players' ? ' active' : '')} onClick={() => setChatView('players')}>Players</div>
          </div>
        )}
        {chatView === 'players' ? (
          <div className="chat-body">
            {participants.players.map(p => (
              <div key={p.username} className="player-list-entry" onClick={() => p.username !== myUsername && setChatView('private:' + p.username)}>
                {p.avatar && <img className="player-list-avatar" src={p.avatar} alt="" />}
                <span className="player-list-name" style={{ color: p.color }}>{p.username}{p.username === myUsername ? ' (you)' : ''}</span>
                <span className="player-list-badge">PLAYER</span>
              </div>
            ))}
            {participants.spectators.map(s => (
              <div key={s.username} className="player-list-entry" onClick={() => s.username !== myUsername && setChatView('private:' + s.username)}>
                {s.avatar && <img className="player-list-avatar" src={s.avatar} alt="" />}
                <span className="player-list-name" style={{ color: '#888' }}>{s.username}{s.username === myUsername ? ' (you)' : ''}</span>
                <span className="player-list-badge">SPECTATOR</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="chat-body" ref={chatBodyRef}>
            {(isPrivate ? privateMsgs : chatMessages).map(msg => (
              <div key={msg.id} className={'chat-msg' + (msg.isSpectator ? ' spectator-msg' : '')}>
                {msg.avatar && <img className="chat-msg-avatar" src={msg.avatar} alt="" />}
                <span className="chat-msg-name"
                  style={{ color: msg.isSpectator ? '#888' : (msg.color || '#fff') }}
                  onClick={() => (msg.from || msg.username) !== myUsername && setChatView('private:' + (msg.from || msg.username))}
                >{msg.from || msg.username}</span>
                <span className="chat-msg-text">: {msg.text}</span>
              </div>
            ))}
          </div>
        )}
        <div className="chat-input-row">
          <input
            className="chat-input"
            placeholder={isPrivate ? `Message ${privateTarget}...` : 'Type a message...'}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendChat(); } }}
            maxLength={500}
          />
          <button className="chat-send-btn" onClick={sendChat}>►</button>
        </div>
        </>)}
      </div>
    );
  };

  const renderPlayerSide = (p, isOpp) => {
    const heroes = p.heroes || [];
    const abZones = p.abilityZones || [];
    const supZones = p.supportZones || [];
    const surZones = p.surpriseZones || [];
    const islandCounts = p.islandZoneCount || [0, 0, 0];
    const ownerLabel = isOpp ? 'opp' : 'me';

    // Board skin: extract number from board ID (e.g. "board1" → "1")
    const boardNum = p.board ? p.board.replace(/\D/g, '') : null;
    const zs = (zoneType) => boardNum ? {
      backgroundImage: 'url(/data/shop/boards/' + encodeURIComponent(zoneType + boardNum) + '.png)',
      backgroundSize: 'cover', backgroundPosition: 'center',
    } : undefined;
    const zsMerge = (zoneType, extra) => {
      const bg = zs(zoneType);
      return bg ? { ...bg, ...extra } : extra;
    };

    const heroRow = (
      <div className="board-row board-hero-row">
        {[0, 1, 2].flatMap(i => {
          const hero = heroes[i];
          const isDead = hero && hero.hp !== undefined && hero.hp <= 0;
          const abilityAttachActive = !isOpp && gameState.effectPrompt?.type === 'abilityAttach' && gameState.effectPrompt?.ownerIdx === myIdx;
          const abilityIneligible = !isOpp && abilityDrag && (() => {
            if (abilityAttachActive) {
              // During abilityAttach: only the specified hero is eligible, skip abilityGivenThisTurn
              if (i !== gameState.effectPrompt.heroIdx) return true;
              const hero2 = heroes[i];
              if (!hero2 || !hero2.name || hero2.hp <= 0) return true;
              // Check ability zone capacity without abilityGivenThisTurn
              const abZ = abZones[i] || [[], [], []];
              const cn = abilityDrag.cardName;
              const isCust = (gameState.customPlacementCards || []).includes(cn);
              if (isCust) return !abZ.some(sl => (sl||[]).length > 0 && (sl||[]).length < 3);
              for (const sl of abZ) { if ((sl||[]).length > 0 && sl[0] === cn) return sl.length >= 3; }
              return !abZ.some(sl => (sl||[]).length === 0);
            }
            return !canHeroReceiveAbility(p, i, abilityDrag.cardName);
          })();
          const equipIneligible = !isOpp && playDrag && playDrag.isEquip && (() => {
            const hero = heroes[i];
            if (!hero || !hero.name || hero.hp <= 0) return true;
            if (hero.statuses?.frozen) return true; // Can't equip to frozen heroes
            const supZ = supZones[i] || [];
            for (let z = 0; z < 3; z++) { if ((supZ[z] || []).length === 0) return false; }
            return true;
          })();
          const creatureIneligible = !isOpp && playDrag && playDrag.card?.cardType === 'Creature' && !playDrag.isEquip && (() => {
            if (!canHeroPlayCard(p, i, playDrag.card)) return true;
            if (findFreeSupportSlot(p, i) < 0) return true;
            return false;
          })();
          const isCharmedByMe = isOpp && hero?.charmedBy === myIdx;
          const spellAttackIneligible = (!isOpp || isCharmedByMe) && playDrag && !playDrag.isEquip && (playDrag.card?.cardType === 'Spell' || playDrag.card?.cardType === 'Attack') && !canHeroPlayCard(p, i, playDrag.card);
          const surpriseIneligible = !isOpp && playDrag?.isSurprise && (() => {
            if (!hero || !hero.name || hero.hp <= 0) return true;
            if (((surZones[i] || []).length === 0)) return false; // Regular surprise zone free
            // Check Bakhm support zones for Creature surprises
            if (playDrag.card?.cardType === 'Creature') {
              const bEntry = (gameState.bakhmSurpriseSlots || []).find(b => b.heroIdx === i);
              if (bEntry && bEntry.freeSlots.length > 0) return false;
            }
            return true;
          })();
          const surpriseTarget = !isOpp && playDrag?.isSurprise && playDrag.targetHero === i;
          const ascensionIneligible = !isOpp && playDrag?.isAscension && (() => {
            const h = heroes[i];
            return !(h?.name && h.hp > 0 && h.ascensionReady && h.ascensionTarget === playDrag.cardName);
          })();
          const ascensionTarget = !isOpp && playDrag?.isAscension && playDrag.targetHero === i;
          // During heroAction, dim all heroes except the Coffee hero
          const heroActionDimmed = !isOpp && gameState.effectPrompt?.type === 'heroAction' && gameState.effectPrompt?.ownerIdx === myIdx && gameState.effectPrompt?.heroIdx !== undefined && gameState.effectPrompt?.heroIdx !== i;
          // Dim heroes that can't use hero-restricted additional actions (e.g. Reiza's extra action)
          const additionalActionDimmed = !isOpp && !isDead && isMyTurn && currentPhase === 3 && (me.heroesActedThisTurn?.length > 0) && (() => {
            const aas = gameState.additionalActions || [];
            if (aas.length === 0) return false;
            // If all additional actions are hero-restricted, dim heroes without providers
            const hasAnyAvail = aas.some(aa => aa.providers?.length > 0);
            if (!hasAnyAvail) return false;
            if (aas.every(aa => aa.heroRestricted)) {
              return !aas.some(aa => aa.providers.some(p => p.heroIdx === i));
            }
            return false;
          })();
          const abilityTarget = !isOpp && abilityDrag && abilityDrag.targetHero === i && abilityDrag.targetZone < 0;
          const equipTarget = !isOpp && playDrag && playDrag.isEquip && playDrag.targetHero === i && playDrag.targetSlot === -1;
          const spellTarget = playDrag && playDrag.isSpell && playDrag.targetHero === i && (playDrag.charmedOwner != null ? isOpp : !isOpp);
          const pi = isOpp ? oppIdx : myIdx;
          const heroTargetId = `hero-${pi}-${i}`;
          const isValidHeroTarget = isTargeting && validTargetIds.has(heroTargetId);
          const isSelectedHeroTarget = selectedSet.has(heroTargetId);
          const isFrozen = hero?.statuses?.frozen;
          const isStunned = hero?.statuses?.stunned;
          const isImmune = hero?.statuses?.immune;
          const isNegated = hero?.statuses?.negated;
          const isBurned = hero?.statuses?.burned;
          const isPoisoned = hero?.statuses?.poisoned;
          const isShielded = hero?.statuses?.shielded;
          const isHealReversed = hero?.statuses?.healReversed;
          const isUntargetable = hero?.statuses?.untargetable;
          // Check if this hero has an active hero effect
          const heroEffectEntry = (gameState.activeHeroEffects || []).find(e => e.heroIdx === i && ((!isOpp && !e.charmedOwner) || (isOpp && e.charmedOwner === pi)));
          const isHeroEffectActive = !!heroEffectEntry;
          const isCharmed = !!hero?.statuses?.charmed;
          const isControlled = hero?.controlledBy != null && !isCharmed;
          const charmedByColor = isCharmed ? (hero.charmedBy === myIdx ? me.color : opp.color)
            : isControlled ? (hero.controlledBy === myIdx ? me.color : opp.color)
            : null;
          const isRamming = ramAnims.some(r => r.srcOwner === pi && r.srcHeroIdx === i);
          // Chain target pick
          const isChainPickValid = chainPickValidIds.has(heroTargetId);
          const isChainPickSelected = chainPickSelectedIds.has(heroTargetId);
          const chainPickStep = chainPickSelected.findIndex(t => t.id === heroTargetId);
          const onHeroClick = isChainPickValid
            ? () => {
                const tgt = (chainPickData?.targets || []).find(t => t.id === heroTargetId);
                if (tgt) setChainPickSelected(prev => [...prev, tgt]);
              }
            : (isHeroEffectActive && !isEffectLocked && !isValidHeroTarget)
            ? () => socket.emit('activate_hero_effect', { roomId: gameState.roomId, heroIdx: i, charmedOwner: heroEffectEntry?.charmedOwner })
            : (isValidHeroTarget ? () => togglePotionTarget(heroTargetId) : undefined);
          const heroGroup = (
            <div key={i} className="board-hero-group">
              {columnLayout[i].maxZones > 3 && Array.from({ length: columnLayout[i].maxLeft }).map((_, s) => (
                <div key={'lpad-'+s} className="board-zone-spacer" />
              ))}
              <div className="board-zone-spacer" />
              <div className={'board-zone board-zone-hero' + (isDead ? ' board-zone-dead' : '') + ((abilityIneligible || equipIneligible || creatureIneligible || spellAttackIneligible || surpriseIneligible || ascensionIneligible || heroActionDimmed || additionalActionDimmed) ? ' board-zone-dead' : '') + ((abilityTarget || equipTarget || spellTarget || surpriseTarget || ascensionTarget) ? ' board-zone-play-target' : '') + (isValidHeroTarget ? ' potion-target-valid' : '') + (isSelectedHeroTarget ? ' potion-target-selected' : '') + (oppTargetHighlight.includes(heroTargetId) ? ' opp-target-highlight' : '') + (isHeroEffectActive ? ' zone-hero-effect-active' : '') + (isCharmed ? ' hero-charmed' : '') + (isControlled ? ' hero-charmed' : '') + (isChainPickValid ? ' chain-pick-valid' : '') + (isChainPickSelected ? ' chain-pick-selected' : '')}
                data-hero-zone="1" data-hero-idx={i} data-hero-owner={ownerLabel} data-hero-name={hero?.name || ''}
                onClick={onHeroClick}
                style={zsMerge('hero', { ...((isHeroEffectActive || isValidHeroTarget || isChainPickValid) ? { cursor: 'pointer' } : undefined), ...((isCharmed || isControlled) ? { '--charmed-color': charmedByColor || '#ff69b4' } : undefined) })}>
                {isChainPickSelected && <div className="chain-pick-number">{chainPickStep + 1}</div>}
                {hero?.name && !isRamming ? (
                  <BoardCard cardName={hero.name} hp={hero.hp} maxHp={hero.maxHp} atk={hero.atk} hpPosition="hero" skins={gameSkins}
                    style={isStunned?._baihuPetrify ? { filter: 'saturate(0) brightness(0.7) contrast(1.1)', transition: 'filter 0.5s' } : undefined} />
                ) : hero?.name && isRamming ? (
                  <div className="board-zone-empty" style={{ opacity: 0.3 }}>{hero.name.split(',')[0]}</div>
                ) : (
                  <div className="board-zone-empty">{'Hero ' + (i+1)}</div>
                )}
                {isDead && hero?.name && <div className="hero-dead-marker">🪦</div>}
                {hero?.name && isFrozen && <FrozenOverlay />}
                {hero?.name && isStunned && !isStunned._baihuPetrify && <div className="status-stunned-overlay"><div className="stun-bolt s1" /><div className="stun-bolt s2" /><div className="stun-bolt s3" /></div>}
                {hero?.name && isStunned?._baihuPetrify && <div className="baihu-petrify-overlay" />}
                {hero?.name && isNegated && <NegatedOverlay />}
                {hero?.name && isBurned && <BurnedOverlay ticking={burnTickingHeroes.includes(`${pi}-${i}`)} />}
                {hero?.name && isPoisoned && <PoisonedOverlay stacks={isPoisoned.stacks || 1} />}
                {hero?.name && isHealReversed && <HealReversedOverlay />}
                {hero?.name && (isFrozen || isStunned || isBurned || isPoisoned || isNegated || isHealReversed || isUntargetable) && <StatusBadges statuses={hero.statuses} isHero={true} player={p} />}
                {hero?.name && isShielded && <ImmuneIcon heroName={hero.name} statusType="shielded" />}
                {hero?.name && isImmune && !isShielded && <ImmuneIcon heroName={hero.name} statusType="immune" />}
                {hero?.name && (p.supportZones?.[i] || []).some(slot => (slot || []).includes('Mummy Token')) && (
                  <div className="mummified-icon"
                    onMouseEnter={e => showGameTooltip(e, "This Hero's effect has been replaced by a Mummy Token's.")}
                    onMouseLeave={hideGameTooltip}
                  >🧟</div>
                )}
                {hero?.name && hero.buffs && <BuffColumn buffs={hero.buffs} />}
                {/* ── Ascension Orbs ── */}
                {hero?.name && hero.ascensionOrbs && (
                  <div className="ascension-orbs-container"
                    onMouseEnter={e => showGameTooltip(e, hero.ascensionReady ? 'All schools collected — ready to Ascend!' : 'Collect all spell school orbs to Ascend')}
                    onMouseLeave={hideGameTooltip}>
                    {hero.ascensionOrbs.map((orb, oi) => {
                      const count = hero.ascensionOrbs.length;
                      const angle = (oi / count) * 2 * Math.PI - Math.PI / 2;
                      const radius = 22;
                      const cx = 50 + Math.cos(angle) * radius;
                      const cy = 50 + Math.sin(angle) * radius;
                      return (
                        <div key={oi} className={'ascension-orb' + (orb.collected ? ' ascension-orb-collected' : '')}
                          style={{
                            left: cx + '%', top: cy + '%',
                            background: orb.collected ? orb.color : 'rgba(60,60,60,.7)',
                            boxShadow: orb.collected ? `0 0 8px ${orb.color}, 0 0 16px ${orb.color}55` : 'none',
                          }}
                          onMouseEnter={e => { e.stopPropagation(); showGameTooltip(e, `${orb.school}${orb.collected ? ' ✓' : ''}`); }}
                          onMouseLeave={hideGameTooltip}
                        />
                      );
                    })}
                  </div>
                )}
                {/* ── Ascension drag highlight ── */}
                {!isOpp && playDrag?.isAscension && playDrag.targetHero === i && (
                  <div className="ascension-drop-glow" />
                )}
                {!isOpp && gameState.bonusActions?.heroIdx === i && gameState.bonusActions.remaining > 0 && (
                  <div className="bonus-action-counter"
                    onMouseEnter={e => showGameTooltip(e, `${gameState.bonusActions.remaining} bonus Action${gameState.bonusActions.remaining > 1 ? 's' : ''} remaining`)}
                    onMouseLeave={hideGameTooltip}>
                    ⚔️{gameState.bonusActions.remaining}
                  </div>
                )}
              </div>
              <div data-surprise-zone="1" data-surprise-hero={i} data-surprise-owner={ownerLabel}
                className={(() => {
                  const cards = surZones[i] || [];
                  const zoneEmpty = cards.length === 0;
                  const hero2 = heroes[i];
                  const heroAlive = hero2 && hero2.name && hero2.hp > 0;
                  const isFaceDown = (p.surpriseFaceDown || [])[i];
                  const isKnownSurprise = (p.surpriseKnown || [])[i];
                  let cls = '';
                  // Own face-down surprise: semi-transparent indicator
                  if (!isOpp && !zoneEmpty && isFaceDown) cls += ' surprise-own-facedown';
                  // Opponent's known re-set surprise: semi-transparent, face-up
                  if (isOpp && !zoneEmpty && isKnownSurprise) cls += ' surprise-known-facedown';
                  // Targeting highlight for Mizune etc.
                  const surpriseTargetId = `surprise-${pi}-${i}`;
                  if (isTargeting && validTargetIds.has(surpriseTargetId)) cls += ' potion-target-valid';
                  if (isTargeting && selectedSet.has(surpriseTargetId)) cls += ' potion-target-selected';
                  // Drag highlight logic
                  if (!isOpp && playDrag?.isSurprise) {
                    const isEligible = zoneEmpty && heroAlive;
                    const isActive = playDrag.targetHero === i;
                    if (isActive && isEligible) cls += ' surprise-drop-active';
                    else if (isEligible) cls += ' surprise-drop-eligible';
                    else cls += ' surprise-drop-ineligible';
                  }
                  // Ushabti summon highlight
                  const ushabtiEntry = !isOpp && (gameState.ushabtiSummonable || []).find(u => u.heroIdx === i);
                  if (ushabtiEntry && !isEffectLocked) cls += ' zone-creature-activatable';
                  return cls;
                })()}
                onClick={(() => {
                  const surpriseTargetId = `surprise-${pi}-${i}`;
                  if (isTargeting && validTargetIds.has(surpriseTargetId)) return () => togglePotionTarget(surpriseTargetId);
                  // Ushabti summon
                  const ushabtiEntry = !isOpp && (gameState.ushabtiSummonable || []).find(u => u.heroIdx === i);
                  if (ushabtiEntry && !isEffectLocked) return () => {
                    socket.emit('summon_ushabti', { roomId: gameState.roomId, heroIdx: i });
                  };
                  return undefined;
                })()}
                style={(() => {
                  const surpriseTargetId = `surprise-${pi}-${i}`;
                  if (isTargeting && validTargetIds.has(surpriseTargetId)) return { cursor: 'pointer' };
                  const ushabtiEntry = !isOpp && (gameState.ushabtiSummonable || []).find(u => u.heroIdx === i);
                  if (ushabtiEntry && !isEffectLocked) return { cursor: 'pointer' };
                  return undefined;
                })()}>
                <BoardZone type="surprise" cards={surZones[i] || []} faceDown={isOpp && !(p.surpriseKnown || [])[i] && (surZones[i] || []).every(c => c === '?')} label="Surprise" style={zs('surprise')} />
              </div>
              {columnLayout[i].maxZones > 3 && Array.from({ length: columnLayout[i].maxRight }).map((_, s) => (
                <div key={'rpad-'+s} className="board-zone-spacer" />
              ))}
            </div>
          );
          if (i < 2) {
            return [heroGroup, <div key={'area-gap-'+i} className="board-area-spacer" />];
          }
          return [heroGroup];
        })}
      </div>
    );

    const abilityRow = (
      <div className="board-row">
        {[0, 1, 2].flatMap(i => {
          const hero = heroes[i];
          const isDead = hero && hero.hp !== undefined && hero.hp <= 0;
          const isFrozenOrStunned = hero?.statuses?.frozen || hero?.statuses?.stunned || hero?.statuses?.negated;
          const abilityAttachActive2 = !isOpp && gameState.effectPrompt?.type === 'abilityAttach' && gameState.effectPrompt?.ownerIdx === myIdx;
          const heroIneligible = !isOpp && abilityDrag && (() => {
            if (abilityAttachActive2) {
              if (i !== gameState.effectPrompt.heroIdx) return true;
              const hero2 = heroes[i];
              if (!hero2 || !hero2.name || hero2.hp <= 0) return true;
              const abZ = abZones[i] || [[], [], []];
              const cn = abilityDrag.cardName;
              const isCust = (gameState.customPlacementCards || []).includes(cn);
              if (isCust) return !abZ.some(sl => (sl||[]).length > 0 && (sl||[]).length < 3);
              for (const sl of abZ) { if ((sl||[]).length > 0 && sl[0] === cn) return sl.length >= 3; }
              return !abZ.some(sl => (sl||[]).length === 0);
            }
            return !canHeroReceiveAbility(p, i, abilityDrag.cardName);
          })();
          const abilityGroup = (
            <div key={i} className="board-hero-group">
              {columnLayout[i].maxZones > 3 && Array.from({ length: columnLayout[i].maxLeft }).map((_, s) => (
                <div key={'ablpad-'+s} className="board-zone-spacer" />
              ))}
              {[0, 1, 2].map(z => {
                const cards = (abZones[i]||[])[z]||[];
                const isAbTarget = !isOpp && abilityDrag && abilityDrag.targetHero === i && abilityDrag.targetZone === z;
                const pi = isOpp ? oppIdx : myIdx;
                const abTargetId = `ability-${pi}-${i}-${z}`;
                const isValidPotionTarget = isTargeting && validTargetIds.has(abTargetId);
                const isSelectedPotionTarget = selectedSet.has(abTargetId);
                const isExploding = explosions.includes(abTargetId);
                // Check if this ability is activatable (action-costing)
                const activatableEntry = cards.length > 0 && (
                  (!isOpp && (gameState.activatableAbilities || []).find(a => a.heroIdx === i && a.zoneIdx === z && !a.charmedOwner)) ||
                  (isOpp && (gameState.activatableAbilities || []).find(a => a.heroIdx === i && a.zoneIdx === z && a.charmedOwner === pi))
                );
                const isActivatable = !!activatableEntry;
                // Check if this ability is free-activatable (no action cost, Main Phase)
                const freeAbilityEntry = cards.length > 0 && (
                  (!isOpp && (gameState.freeActivatableAbilities || []).find(a => a.heroIdx === i && a.zoneIdx === z && !a.charmedOwner)) ||
                  (isOpp && (gameState.freeActivatableAbilities || []).find(a => a.heroIdx === i && a.zoneIdx === z && a.charmedOwner === pi))
                );
                const isFreeActivatable = freeAbilityEntry?.canActivate === true;
                const isFreeExhausted = freeAbilityEntry && !freeAbilityEntry.canActivate;
                const isAbilityHandLockBlocked = freeAbilityEntry?.handLockBlocked === true;
                // Also activatable during heroAction if listed
                const heroActionPromptAbilities = (!isOpp && gameState.effectPrompt?.type === 'heroAction' && gameState.effectPrompt?.ownerIdx === myIdx) ? (gameState.effectPrompt.activatableAbilities || []) : [];
                const isHeroActionActivatable = heroActionPromptAbilities.some(a => a.heroIdx === i && a.zoneIdx === z);
                const canActivate = isActivatable || isHeroActionActivatable || isFreeActivatable;
                const isFlashing = abilityFlash && abilityFlash.owner === (isOpp ? oppIdx : myIdx) && abilityFlash.heroIdx === i && abilityFlash.zoneIdx === z;
                // Friendship highlight: ability has an available additional action with eligible hand cards
                const isFriendshipActive = !isOpp && cards.includes('Friendship') && (gameState.additionalActions || []).some(aa =>
                  aa.typeId.startsWith('friendship_support') && aa.eligibleHandCards.length > 0 && aa.providers.some(p => p.heroIdx === i)
                );
                const onAbilityClick = (canActivate && !isEffectLocked) ? () => {
                  if (isFreeActivatable) {
                    // Free activation — no confirmation needed, activate directly
                    socket.emit('activate_free_ability', { roomId: gameState.roomId, heroIdx: i, zoneIdx: z, charmedOwner: freeAbilityEntry?.charmedOwner });
                  } else {
                    setPendingAbilityActivation({ heroIdx: i, zoneIdx: z, abilityName: cards[0], level: cards.length, isHeroAction: isHeroActionActivatable, charmedOwner: activatableEntry?.charmedOwner });
                  }
                } : (isValidPotionTarget ? () => togglePotionTarget(abTargetId) : undefined);
                return (
                  <div key={z}
                    className={'board-zone board-zone-ability' + (heroIneligible || isDead || isFrozenOrStunned ? ' board-zone-dead' : '') + (isAbTarget ? ' board-zone-play-target' : '') + (isValidPotionTarget ? ' potion-target-valid' : '') + (isSelectedPotionTarget ? ' potion-target-selected' : '') + (isExploding ? ' zone-exploding' : '') + (oppTargetHighlight.includes(abTargetId) ? ' opp-target-highlight' : '') + (canActivate && !isFreeActivatable ? ' zone-ability-activatable' : '') + (isFreeActivatable ? ' zone-ability-free-activatable' : '') + (isFriendshipActive ? ' zone-friendship-active' : '') + (isFlashing ? ' zone-ability-activated' : '')}
                    data-ability-zone="1" data-ability-hero={i} data-ability-slot={z} data-ability-owner={ownerLabel}
                    onClick={onAbilityClick}
                    onMouseEnter={() => {
                      // Track hovered Luck's declared target for tooltip
                      if (cards[0] === 'Luck') {
                        const h = heroes[i];
                        const entry = h?._luckDeclared?.[z];
                        _activeLuckTooltipTarget = entry?.target || null;
                      }
                    }}
                    onMouseLeave={() => { _activeLuckTooltipTarget = null; }}
                    style={zsMerge('ability', canActivate ? { cursor: 'pointer' } : (isValidPotionTarget ? { cursor: 'pointer' } : undefined))}>
                    {cards.length > 0 ? (
                      <>
                        <AbilityStack cards={cards} />
                        {cards[0] === 'Terror' && gameState.terrorThreshold != null && (() => {
                          const count = gameState.terrorCount || 0;
                          const threshold = gameState.terrorThreshold;
                          const progress = Math.min(count / threshold, 1);
                          const isActive = gameState.activePlayer != null;
                          const fontSize = 18 + progress * 12;
                          const glowSize = 2 + progress * 10;
                          const pulseSpeed = Math.max(0.3, 1.2 - progress * 0.9);
                          const r = Math.round(180 + progress * 75);
                          const g = Math.round(60 - progress * 60);
                          const color = `rgb(${r},${g},0)`;
                          const shadow = `0 0 ${glowSize}px ${color}, 0 0 ${glowSize * 2}px rgba(${r},${g},0,0.4)`;
                          return isActive ? (
                            <div style={{
                              position: 'absolute', inset: 0, display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                              pointerEvents: 'none', zIndex: 5,
                            }}>
                              <div style={{
                                fontSize, fontWeight: 900, color,
                                textShadow: shadow + ', -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 -1px 0 #000, 0 1px 0 #000, -1px 0 0 #000, 1px 0 0 #000',
                                WebkitTextStroke: '1.5px #000',
                                animation: progress >= 0.7 ? `terrorPulse ${pulseSpeed}s ease-in-out infinite` : 'none',
                                opacity: progress < 0.1 ? 0.5 : 0.95,
                                letterSpacing: '-1px',
                                fontFamily: 'monospace',
                                lineHeight: 1,
                              }}>
                                {count}<span style={{ fontSize: fontSize * 0.6, opacity: 0.6 }}>/{threshold}</span>
                              </div>
                            </div>
                          ) : null;
                        })()}
                        {isAbilityHandLockBlocked && <div className="hand-lock-indicator" style={{ fontSize: 32 }}>⦸</div>}
                      </>
                    ) : (
                      <div className="board-zone-empty">Ability</div>
                    )}
                  </div>
                );
              })}
              {columnLayout[i].maxZones > 3 && Array.from({ length: columnLayout[i].maxRight }).map((_, s) => (
                <div key={'abrpad-'+s} className="board-zone-spacer" />
              ))}
            </div>
          );
          if (i < 2) return [abilityGroup, <div key={'abspc-'+i} className="board-area-spacer" />];
          return [abilityGroup];
        })}
      </div>
    );

    const supportRow = (
      <div className="board-row">
        {[0, 1, 2].flatMap(i => {
          const actualZoneCount = (supZones[i] || []).length || 3;
          const islandCount = islandCounts[i] || 0;
          const baseCount = actualZoneCount - islandCount;
          const myLeft = Math.floor(islandCount / 2);
          const myRight = islandCount - myLeft;
          const { maxLeft, maxRight } = columnLayout[i];

          // Build render order: left spacers, left islands, base zones, right islands, right spacers
          const renderOrder = [];
          // Left spacers (align with other player's islands)
          for (let s = 0; s < maxLeft - myLeft; s++) renderOrder.push({ z: -1, isIsland: false, isSpacer: true });
          // Left island zones
          for (let li = 0; li < myLeft; li++) renderOrder.push({ z: baseCount + li, isIsland: true });
          // Base zones
          for (let bz = 0; bz < baseCount; bz++) renderOrder.push({ z: bz, isIsland: false });
          // Right island zones
          for (let ri = 0; ri < myRight; ri++) renderOrder.push({ z: baseCount + myLeft + ri, isIsland: true });
          // Right spacers
          for (let s = 0; s < maxRight - myRight; s++) renderOrder.push({ z: -1, isIsland: false, isSpacer: true });

          // First free base zone (for equip auto-place highlight)
          let autoSlot = -1;
          for (let fz = 0; fz < baseCount; fz++) { if (((supZones[i]||[])[fz]||[]).length === 0) { autoSlot = fz; break; } }
          const supportGroup = (
          <div key={i} className="board-hero-group">
            {renderOrder.map((slot, renderIdx) => {
              if (slot.isSpacer) return <div key={'sp-'+renderIdx} className="board-zone-spacer" />;
              const z = slot.z;
              const isIsland = slot.isIsland;
              const cards = (supZones[i]||[])[z]||[];
              const isPlayTarget = !isOpp && playDrag && playDrag.targetHero === i && playDrag.targetSlot === z;
              const isAutoTarget = !isOpp && playDrag && playDrag.isEquip && playDrag.targetHero === i && playDrag.targetSlot === -1 && z === autoSlot;
              const pi = isOpp ? oppIdx : myIdx;
              // Check all possible equip target IDs for this zone
              const equipTargetIds = (pt?.validTargets || []).filter(t => t.type === 'equip' && t.owner === pi && t.heroIdx === i && t.slotIdx === z).map(t => t.id);
              const isValidEquipTarget = isTargeting && equipTargetIds.some(id => validTargetIds.has(id));
              const isSelectedEquipTarget = equipTargetIds.some(id => selectedSet.has(id));
              const isEquipExploding = equipTargetIds.some(id => explosions.includes(id));
              const isSummonGlow = summonGlow && summonGlow.owner === pi && summonGlow.heroIdx === i && summonGlow.zoneSlot === z;
              const isZonePickTarget = !isOpp && zonePickSet.has(`${pi}-${i}-${z}`);
              // During creature drag: highlight valid zones, dim invalid ones
              const isDraggingCreature = !isOpp && playDrag && playDrag.card?.cardType === 'Creature' && !playDrag.isEquip && !playDrag.isSurprise;
              const isDraggingAttachment = !isOpp && playDrag && playDrag.isSpell && (playDrag.card?.subtype || '').toLowerCase() === 'attachment';
              const heroActionActive = !isOpp && gameState.effectPrompt?.type === 'heroAction' && gameState.effectPrompt?.ownerIdx === myIdx;
              const heroActionHeroIdx = heroActionActive ? gameState.effectPrompt.heroIdx : undefined;
              const isDragValidZone = (isDraggingCreature || isDraggingAttachment) && cards.length === 0 && canHeroPlayCard(me, i, playDrag.card) && z < ((me.supportZones[i] || []).length || 3) && (heroActionHeroIdx === undefined || heroActionHeroIdx === i);
              const isDragInvalidZone = (isDraggingCreature || isDraggingAttachment) && !isDragValidZone;
              // heroAction: dim zones for non-Coffee heroes
              const isHeroActionZoneDimmed = heroActionActive && !isDraggingCreature && !isDraggingAttachment && i !== heroActionHeroIdx;
              // Additional Action provider selection highlight
              const isProviderZone = !isOpp && pendingAdditionalPlay && pendingAdditionalPlay.providers.some(p => p.heroIdx === i && p.zoneSlot === z);
              const isProviderSelectionActive = !isOpp && !!pendingAdditionalPlay;
              // Active creature effect check
              const creatureEffectEntry = cards.length > 0 && (gameState.activatableCreatures || []).find(c =>
                c.heroIdx === i && c.zoneSlot === z && ((!isOpp && !c.charmedOwner) || (isOpp && c.charmedOwner === pi))
              );
              const isCreatureActivatable = creatureEffectEntry?.canActivate === true;
              const equipEffectEntry = cards.length > 0 && !isCreatureActivatable && (gameState.activatableEquips || []).find(c =>
                c.heroIdx === i && c.zoneSlot === z && !isOpp
              );
              const isEquipActivatable = equipEffectEntry?.canActivate === true;
              // Bakhm surprise drag highlight
              const isBakhmSurpriseTarget = !isOpp && playDrag?.isSurprise && playDrag.card?.cardType === 'Creature' && cards.length === 0
                && (gameState.bakhmSurpriseSlots || []).some(b => b.heroIdx === i && b.freeSlots.includes(z));
              const isBakhmSurpriseActive = isBakhmSurpriseTarget && playDrag.targetHero === i && playDrag.targetBakhmSlot === z;
              // Slippery Skates move
              const isSkatesCreature = skatesCreatureSet.has(`${pi}-${i}-${z}`);
              const isSkatesCreatureSelected = isSkatesCreature && skatesSelected === z;
              const isSkatesDest = skatesDestSet.has(`${pi}-${i}-${z}`);
              // Chain target pick for creatures
              const creatureChainId = `equip-${pi}-${i}-${z}`;
              const isChainPickCreatureValid = chainPickValidIds.has(creatureChainId);
              const isChainPickCreatureSelected = chainPickSelectedIds.has(creatureChainId);
              const chainPickCreatureStep = chainPickSelected.findIndex(t => t.id === creatureChainId);
              return (
                <div key={z} className={'board-zone board-zone-support' + (isIsland ? ' board-zone-island' : '') + ((isPlayTarget || isAutoTarget) ? ' board-zone-play-target' : '') + (isValidEquipTarget ? ' potion-target-valid' : '') + (isSelectedEquipTarget ? ' potion-target-selected' : '') + (isEquipExploding ? ' zone-exploding' : '') + (isSummonGlow ? ' zone-summon-glow' : '') + (equipTargetIds.some(id => oppTargetHighlight.includes(id)) ? ' opp-target-highlight' : '') + (isZonePickTarget ? ' zone-pick-target' : '') + (isDragValidZone ? ' zone-drag-valid' : '') + (isDragInvalidZone ? ' zone-drag-invalid' : '') + (isProviderZone ? ' zone-provider-highlight' : '') + (isProviderSelectionActive && !isProviderZone ? ' zone-provider-dimmed' : '') + (isHeroActionZoneDimmed ? ' zone-drag-invalid' : '') + (isCreatureActivatable ? ' zone-creature-activatable' : '') + (isEquipActivatable ? ' zone-equip-activatable' : '') + (isBakhmSurpriseActive ? ' surprise-drop-active' : isBakhmSurpriseTarget ? ' surprise-drop-eligible' : '') + (isSkatesCreature ? ' zone-skates-creature' : '') + (isSkatesCreatureSelected ? ' zone-skates-selected' : '') + (isSkatesDest ? ' zone-skates-dest' : '') + (isChainPickCreatureValid ? ' chain-pick-valid' : '') + (isChainPickCreatureSelected ? ' chain-pick-selected' : '')}
                  data-support-zone="1" data-support-hero={i} data-support-slot={z} data-support-owner={ownerLabel} data-support-island={isIsland ? 'true' : 'false'}
                  onClick={isChainPickCreatureValid ? () => {
                    const tgt = (chainPickData?.targets || []).find(t => t.id === creatureChainId);
                    if (tgt) setChainPickSelected(prev => [...prev, tgt]);
                  } : isSkatesCreature ? () => {
                    setSkatesSelected(prev => prev === z ? null : z);
                  } : isSkatesDest ? () => {
                    respondToPrompt({ creatureSlot: skatesSelected, destHeroIdx: i, destSlot: z });
                    setSkatesSelected(null);
                  } : (isCreatureActivatable && !isEffectLocked) ? () => {
                    socket.emit('activate_creature_effect', { roomId: gameState.roomId, heroIdx: i, zoneSlot: z, charmedOwner: creatureEffectEntry?.charmedOwner });
                  } : (isEquipActivatable && !isEffectLocked) ? () => {
                    socket.emit('activate_equip_effect', { roomId: gameState.roomId, heroIdx: i, zoneSlot: z });
                  } : isProviderZone ? () => {
                    const provider = pendingAdditionalPlay.providers.find(p => p.heroIdx === i && p.zoneSlot === z);
                    if (provider) {
                      socket.emit('play_creature', {
                        roomId: gameState.roomId, cardName: pendingAdditionalPlay.cardName,
                        handIndex: pendingAdditionalPlay.handIndex, heroIdx: pendingAdditionalPlay.heroIdx,
                        zoneSlot: pendingAdditionalPlay.zoneSlot, additionalActionProvider: provider.cardId,
                      });
                      setPendingAdditionalPlay(null);
                      socket.emit('pending_placement_clear', { roomId: gameState.roomId });
                    }
                  } : isZonePickTarget ? () => respondToPrompt({ heroIdx: i, slotIdx: z }) : isValidEquipTarget ? () => equipTargetIds.forEach(id => togglePotionTarget(id)) : undefined}
                  style={zsMerge('support', (isValidEquipTarget || isZonePickTarget || isProviderZone || isCreatureActivatable || isEquipActivatable || isSkatesCreature || isSkatesDest || isChainPickCreatureValid) ? { cursor: 'pointer' } : undefined)}>
                  {isChainPickCreatureSelected && <div className="chain-pick-number">{chainPickCreatureStep + 1}</div>}
                  {(isPlayTarget || isAutoTarget) && playDrag.card ? (
                    <BoardCard cardName={playDrag.cardName} hp={playDrag.card.hp} maxHp={playDrag.card.hp} hpPosition="creature" style={{ opacity: 0.5 }} />
                  ) : (!isOpp && pendingAdditionalPlay && pendingAdditionalPlay.heroIdx === i && pendingAdditionalPlay.zoneSlot === z) ? (
                    <BoardCard cardName={pendingAdditionalPlay.cardName} hp={CARDS_BY_NAME[pendingAdditionalPlay.cardName]?.hp} maxHp={CARDS_BY_NAME[pendingAdditionalPlay.cardName]?.hp} hpPosition="creature" style={{ opacity: 0.6 }} />
                  ) : (isOpp && oppPendingPlacement && oppPendingPlacement.heroIdx === i && oppPendingPlacement.zoneSlot === z) ? (
                    <BoardCard cardName={oppPendingPlacement.cardName} hp={CARDS_BY_NAME[oppPendingPlacement.cardName]?.hp} maxHp={CARDS_BY_NAME[oppPendingPlacement.cardName]?.hp} hpPosition="creature" style={{ opacity: 0.6 }} />
                  ) : cards.length > 0 ? (
                    (() => { const cKey = `${pi}-${i}-${z}`; const cc = (gameState.creatureCounters || {})[cKey];
                    // Unknown face-down surprise (opponent/spectator sees '?')
                    if (cards[0] === '?') {
                      return <BoardCard cardName="?" faceDown={true} style={{ opacity: 0.6 }} />;
                    }
                    // Face-down surprise creature in Bakhm's support zone
                    if (cc?.faceDown) {
                      if (isOpp) {
                        // Opponent sees known re-set surprise: face-up, semi-transparent
                        return <BoardCard cardName={cards[0]} style={{ opacity: 0.6, filter: 'sepia(0.3)' }} />;
                      } else {
                        // Owner sees own face-down surprise: face-up, semi-transparent (like surprise zones)
                        return <BoardCard cardName={cards[0]} style={{ opacity: 0.6 }} />;
                      }
                    }
                    const isCreature = (cc?._cardDataOverride?.cardType || CARDS_BY_NAME[cards[cards.length-1]]?.cardType || '').split('/').some(t => t.trim() === 'Creature'); const creatureStyle = cc?._baihuPetrify ? { filter: 'saturate(0) brightness(0.7) contrast(1.1)', transition: 'filter 0.5s' } : cc?._xuanwuRevived ? { filter: 'sepia(0.2) hue-rotate(180deg) brightness(1.1)', opacity: 0.75 } : undefined; return !isCreature ? (
                      <BoardCard cardName={cards[cards.length-1]} skins={gameSkins} />
                    ) : (
                    <>
                    {cards.length === 1 ? (
                      (() => { const curHp = cc?.currentHp ?? cc?._cardDataOverride?.hp ?? CARDS_BY_NAME[cards[0]]?.hp; const mHp = cc?.maxHp ?? cc?._cardDataOverride?.hp ?? CARDS_BY_NAME[cards[0]]?.hp; return <BoardCard cardName={cards[0]} hp={curHp} maxHp={mHp} hpPosition="creature" skins={gameSkins} style={creatureStyle} />; })()
                    ) : (
                      <div className="board-stack">
                        {(() => { const curHp = cc?.currentHp ?? cc?._cardDataOverride?.hp ?? CARDS_BY_NAME[cards[cards.length-1]]?.hp; const mHp = cc?.maxHp ?? cc?._cardDataOverride?.hp ?? CARDS_BY_NAME[cards[cards.length-1]]?.hp; return <BoardCard cardName={cards[cards.length-1]} hp={curHp} maxHp={mHp} hpPosition="creature" label={cards.length+''} skins={gameSkins} />; })()}
                      </div>
                    )}
                    {(() => { const lvl = cc?.level; return lvl ? <div className="creature-level">Lv{lvl}</div> : null; })()}
                    {(() => { return cc?.additionalActionAvail ? <div className="additional-action-icon"
                      onMouseEnter={() => { window._aaTooltipKey = cKey; window.dispatchEvent(new Event('aaHover')); }}
                      onMouseLeave={() => { window._aaTooltipKey = null; window.dispatchEvent(new Event('aaHover')); }}
                    >⚡</div> : null; })()}
                    {cc?.summoningSickness ? <div className="summoning-sickness-icon"
                      onMouseEnter={e => showGameTooltip(e, 'This Creature cannot act the turn it was summoned.')}
                      onMouseLeave={hideGameTooltip}
                    >🌀</div> : null}
                    {cc?.burned ? <BurnedOverlay /> : null}
                    {cc?.frozen ? <FrozenOverlay /> : null}
                    {cc?.negated ? <NegatedOverlay /> : null}
                    {cc?.poisoned ? <PoisonedOverlay stacks={cc.poisonStacks || 1} /> : null}
                    {(cc?.frozen || cc?.stunned || cc?.burned || cc?.poisoned || cc?.negated || cc?._baihuStunned) ? <StatusBadges counters={cc} isHero={false} player={p} /> : null}
                    {cc?.buffs ? <BuffColumn buffs={cc.buffs} /> : null}
                    </>
                    ); })()
                  ) : (
                    <div className="board-zone-empty">{isIsland ? 'Island' : 'Support'}</div>
                  )}
                </div>
              );
            })}
          </div>
          );
          if (i < 2) return [supportGroup, <div key={'supspc-'+i} className="board-area-spacer" />];
          return [supportGroup];
        })}
      </div>
    );

    return isOpp
      ? <>{supportRow}{abilityRow}{heroRow}</>
      : <>{heroRow}{abilityRow}{supportRow}</>;
  };

  return (
    <div className="screen-full" style={{ background: '#0c0c14' }}>
      <div className="top-bar" style={{ justifyContent: 'space-between', position: 'relative' }}>
        {isSpectator ? (
          <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={handleLeave}>
            ✕ LEAVE
          </button>
        ) : (
          <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => result ? handleLeave() : setShowSurrender(true)}>
            {result ? '✕ LEAVE' : '⚑ SURRENDER'}
          </button>
        )}
        <h2 className="orbit-font" style={{ fontSize: 14, color: isSpectator ? 'var(--text2)' : 'var(--accent)', position: 'absolute', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none' }}>
          {isSpectator ? '👁 SPECTATING' : 'PIXEL PARTIES'}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge" style={{ background: lobby?.type === 'ranked' ? 'rgba(255,170,0,.12)' : 'rgba(0,240,255,.12)', color: lobby?.type === 'ranked' ? 'var(--accent4)' : 'var(--accent)' }}>
            {lobby?.type?.toUpperCase() || 'GAME'}
          </span>
          <VolumeControl />
        </div>
      </div>

      <div className="game-layout">
        {/* Opponent hand */}
        <div className="game-hand game-hand-opp">
          <div className="game-hand-info">
            {opp.avatar && <img src={opp.avatar} className={'game-hand-avatar game-hand-avatar-big' + (!result && (isMyTurn ? ' avatar-inactive' : ' avatar-active'))} />}
            <span className="orbit-font" style={{ fontSize: 18, fontWeight: 800, color: opp.color }}>{opp.username}</span>
            {oppDisconnected && <span style={{ fontSize: 10, color: 'var(--danger)', animation: 'pulse 1.5s infinite' }}>DISCONNECTED</span>}
          </div>
          <div className={"game-hand-cards" + (gameState.effectPrompt?.type === 'blindHandPick' && gameState.effectPrompt?.ownerIdx === myIdx ? ' blind-pick-active' : '')}>
            {Array.from({ length: opp.handCount || 0 }).map((_, i) => {
              const isBlindPick = gameState.effectPrompt?.type === 'blindHandPick' && gameState.effectPrompt?.ownerIdx === myIdx;
              const isSelected = isBlindPick && blindPickSelected.has(i);
              const maxSelect = isBlindPick ? (gameState.effectPrompt.maxSelect || 2) : 0;
              const isFull = isBlindPick && !isSelected && blindPickSelected.size >= maxSelect;
              const revealEntry = (opp.revealedHandCards || []).find(r => r.index === i);
              return (
                <div key={i}
                  className={'board-card hand-card' + (revealEntry ? ' revealed-hand-card' : ' face-down') + (isSelected ? ' blind-pick-selected' : '') + (isBlindPick && !isSelected && !isFull ? ' blind-pick-eligible' : '') + (isFull ? ' hand-card-dimmed' : '')}
                  data-hand-idx={i} style={(oppDrawHidden.has(i) || (stealHiddenOpp.has(i) && (opp.handCount || 0) === stealExpectedOppCountRef.current)) ? { visibility: 'hidden' } : (isBlindPick ? { cursor: 'pointer' } : undefined)}
                  onClick={isBlindPick ? () => {
                    setBlindPickSelected(prev => {
                      const next = new Set(prev);
                      if (next.has(i)) { next.delete(i); } else if (next.size < maxSelect) { next.add(i); }
                      return next;
                    });
                  } : undefined}>
                  {revealEntry ? (
                    <img src={cardImageUrl(revealEntry.name)} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} draggable={false}
                      onMouseEnter={() => { const c = CARDS_BY_NAME[revealEntry.name]; if (c) setBoardTooltip(c); }}
                      onMouseLeave={() => setBoardTooltip(null)} />
                  ) : (
                    <img src={opp.cardback || "/cardback.png"} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                  )}
                </div>
              );
            })}
          </div>
          <div className="game-gold-display">
            <span className="game-gold-icon">🪙</span>
            <span className="game-gold-value orbit-font" data-gold-player={oppIdx}>{opp.gold || 0}</span>
          </div>
        </div>
        {/* Board */}
        <div className={'game-board' + (showFirstChoice ? ' game-board-dimmed' : '') + (pt?.config?.greenSelect ? ' beer-targeting' : '')}>
          {/* ── Generic Player Debuff Warnings (top of battlefield) ── */}
          {(() => {
            const debuffs = [];
            if (me.summonLocked) debuffs.push({ key: 'summon-me', text: 'You cannot summon any more Creatures this turn!', color: '#ff6644' });
            if (opp.summonLocked) debuffs.push({ key: 'summon-opp', text: `${opp.username} cannot summon any more Creatures this turn!`, color: '#cc8800' });
            if (me.damageLocked) debuffs.push({ key: 'damage-me', icon: '🔥', text: 'You cannot deal any more damage to your opponent this turn!', color: '#ff4444' });
            if (opp.damageLocked) debuffs.push({ key: 'damage-opp', icon: '🛡️', text: `${opp.username} cannot deal any more damage to your targets this turn!`, color: '#ff8844' });
            if (me.potionLocked) debuffs.push({ key: 'potion-me', icon: '🧪', text: 'You cannot play any more Potions this turn!', color: '#aa44ff' });
            if (opp.potionLocked) debuffs.push({ key: 'potion-opp', icon: '🧪', text: `${opp.username} cannot play any more Potions this turn!`, color: '#8844cc' });
            if (me.supportSpellLocked) debuffs.push({ key: 'support-me', icon: '💚', text: 'You cannot use another Support Spell this turn.', color: '#ff4444' });
            if (opp.supportSpellLocked) debuffs.push({ key: 'support-opp', icon: '💚', text: `Your opponent cannot use another Support Spell this turn.`, color: '#ff8844' });
            if (me.itemLocked) debuffs.push({ key: 'item-me', icon: '🔨', text: 'You cannot use Artifacts this turn!', color: '#ff6633' });
            if (opp.itemLocked) debuffs.push({ key: 'item-opp', icon: '🔨', text: `${opp.username} cannot use Artifacts this turn!`, color: '#cc5522' });
            if (debuffs.length === 0) return null;
            return (
              <div className="phase-debuffs">
                {debuffs.map(d => (
                  <div key={d.key} className="phase-debuff-item" style={{ color: d.color }}>
                    {d.icon ? d.icon + ' ' : ''}{d.text}
                  </div>
                ))}
              </div>
            );
          })()}
          <div className="board-util board-util-left">
            <div className="board-util-side">
              <div data-opp-discard="1"><BoardZone type="discard" cards={oppDiscardHidden > 0 ? opp.discardPile.slice(0, -oppDiscardHidden) : opp.discardPile} label="Discard" onClick={() => setPileViewer({ title: 'Opponent Discard', cards: opp.discardPile })} onHoverCard={setHoveredPileCard} style={oppBoardZone('discard')} /></div>
              <div data-opp-deleted="1"><BoardZone type="deleted" cards={oppDeletedHidden > 0 ? opp.deletedPile.slice(0, -oppDeletedHidden) : opp.deletedPile} label="Deleted" onClick={() => setPileViewer({ title: 'Opponent Deleted', cards: opp.deletedPile })} onHoverCard={setHoveredPileCard} style={oppBoardZone('delete')} /></div>
              <div className="board-util-spacer" />
            </div>
            <div className="board-util-mid" />
            <div className="board-util-side">
              <div className="board-util-spacer" />
              <div data-my-deleted="1"><BoardZone type="deleted" cards={myDeletedHidden > 0 ? me.deletedPile.slice(0, -myDeletedHidden) : me.deletedPile} label="Deleted" onClick={() => setPileViewer({ title: 'My Deleted', cards: me.deletedPile })} onHoverCard={setHoveredPileCard} style={myBoardZone('delete')} /></div>
              <div data-my-discard="1"><BoardZone type="discard" cards={myDiscardHidden > 0 ? me.discardPile.slice(0, -myDiscardHidden) : me.discardPile} label="Discard" onClick={() => setPileViewer({ title: 'My Discard', cards: me.discardPile })} onHoverCard={setHoveredPileCard} style={myBoardZone('discard')} /></div>
            </div>
          </div>

          {/* Phase tracker — positioned absolutely, left edge */}
          <div className="phase-column">
            <div className="board-phase-tracker">
              {['Start Phase', 'Resource Phase', 'Main Phase 1', 'Action Phase', 'Main Phase 2', 'End Phase'].map((phase, i) => {
                const isActive = currentPhase === i;
                const canClick = isMyTurn && !result && !gameState.effectPrompt && !gameState.potionTargeting && !gameState.mulliganPending && !gameState.heroEffectPending && !spellHeroPick && !pendingAdditionalPlay && !pendingAbilityActivation && !showSurrender && !showEndTurnConfirm && (
                  (currentPhase === 2 && (i === 3 || i === 5)) ||
                  (currentPhase === 3 && (i === 4 || i === 5)) ||
                  (currentPhase === 4 && i === 5)
                );
                return (
                  <div key={i}
                    className={'board-phase-item' + (isActive ? ' active' : '') + (canClick ? ' clickable' : '')}
                    style={isActive ? { borderColor: phaseColor, boxShadow: `0 0 10px ${phaseColor}44` } : undefined}
                    onClick={() => { if (canClick) tryAdvancePhase(i); }}>
                    {phase}
                  </div>
                );
              })}
            </div>
            {!isSpectator && (() => {
              const canAdvance = isMyTurn && !result && !gameState.effectPrompt && !gameState.potionTargeting && !gameState.mulliganPending && !gameState.heroEffectPending && !spellHeroPick && !pendingAdditionalPlay && !pendingAbilityActivation && !showSurrender && !showEndTurnConfirm && currentPhase >= 2 && currentPhase <= 4;
              const nextMap = { 2: 3, 3: 4, 4: 5 };
              return (
                <div className="phase-buttons-row">
                  <button className="btn phase-btn" disabled={!canAdvance}
                    onClick={() => canAdvance && tryAdvancePhase(nextMap[currentPhase])}>
                    Next Phase ▸
                  </button>
                  <button className="btn btn-danger phase-btn" disabled={!canAdvance}
                    onClick={() => canAdvance && tryAdvancePhase(5)}>
                    End Turn ⏹
                  </button>
                  <label className="phase-end-check">
                    <input type="checkbox" checked={askBeforeEndTurn} onChange={e => {
                      setAskBeforeEndTurn(e.target.checked);
                      localStorage.setItem('pp_ask_end_turn', e.target.checked ? '1' : '0');
                    }} />
                    <span>Confirm end</span>
                  </label>
                </div>
              );
            })()}
          </div>

          <div className="board-center-spacer" />
          <div className="board-center" ref={boardCenterRef} style={{ position: 'relative' }}>
            {pendingAdditionalPlay && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 200, fontSize: 13, fontWeight: 700, color: '#ffcc00', textShadow: '0 0 10px rgba(255,200,0,.5), 2px 2px 0 #000', textAlign: 'center', pointerEvents: 'none', animation: 'summonLockPulse 1.5s ease-in-out infinite', whiteSpace: 'nowrap' }}>Choose which additional Action to use!</div>}
            <div className="board-player-side board-side-opp">{renderPlayerSide(opp, true)}</div>
            <div className="board-area-zones-center">
              <BoardZone type="area" cards={gameState.areaZones?.[myIdx] || []} label="Area" style={{...myBoardZone('area'), left: areaPositions[0]}} />
              <BoardZone type="area" cards={gameState.areaZones?.[oppIdx] || []} label="Area" style={{...oppBoardZone('area'), left: areaPositions[1]}} />
            </div>
            <div className="board-mid-row" style={{ position: 'relative' }}>
              <div className="board-area-line" />
              {gameState.format > 1 && !result && (
                <div className="set-score-fixed orbit-font">
                  <span style={{ color: 'var(--success)' }}>{gameState.setScore?.[myIdx] || 0}</span>
                  <span style={{ color: 'var(--text2)', margin: '0 8px' }}>—</span>
                  <span style={{ color: 'var(--danger)' }}>{gameState.setScore?.[oppIdx] || 0}</span>
                  <span style={{ fontSize: 10, color: 'var(--text2)', marginLeft: 10 }}>Bo{gameState.format}</span>
                </div>
              )}
            </div>
            <div className="board-player-side board-side-me">{renderPlayerSide(me, false)}</div>
            {/* Permanent zones — positioned absolutely to avoid layout interference */}
            {(opp.permanents || []).length > 0 && (
              <div className="board-permanents board-permanents-opp">
                {opp.permanents.map(perm => {
                  const permTargetId = `perm-${oppIdx}-${perm.id}`;
                  const isValidPermTarget = isTargeting && validTargetIds.has(permTargetId);
                  const isSelectedPermTarget = selectedSet.has(permTargetId);
                  return (
                    <div key={perm.id}
                      className={'board-permanent-slot' + (isValidPermTarget ? ' potion-target-valid' : '') + (isSelectedPermTarget ? ' potion-target-selected' : '')}
                      data-perm-id={perm.id} data-perm-owner="opp"
                      onClick={isValidPermTarget ? () => togglePotionTarget(permTargetId) : undefined}
                      style={isValidPermTarget ? { cursor: 'pointer' } : undefined}>
                      <BoardCard cardName={perm.name} />
                    </div>
                  );
                })}
              </div>
            )}
            {(me.permanents || []).length > 0 && (
              <div className="board-permanents board-permanents-me">
                {me.permanents.map(perm => {
                  const permTargetId = `perm-${myIdx}-${perm.id}`;
                  const isValidPermTarget = isTargeting && validTargetIds.has(permTargetId);
                  const isSelectedPermTarget = selectedSet.has(permTargetId);
                  return (
                    <div key={perm.id}
                      className={'board-permanent-slot' + (isValidPermTarget ? ' potion-target-valid' : '') + (isSelectedPermTarget ? ' potion-target-selected' : '')}
                      data-perm-id={perm.id} data-perm-owner="me"
                      onClick={isValidPermTarget ? () => togglePotionTarget(permTargetId) : undefined}
                      style={isValidPermTarget ? { cursor: 'pointer' } : undefined}>
                      <BoardCard cardName={perm.name} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="chat-log-column">
            {renderActionLog()}
            {renderChatPanel()}
          </div>

          <div className="board-util board-util-right">
            <div className="board-util-side">
              <BoardZone type="deck" label="Deck" faceDown style={oppBoardZone('deck')}>
                <div className="board-card face-down" data-opp-deck="1"><img src={opp.cardback || "/cardback.png"} style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false} /><div className="board-card-label">{opp.deckCount}</div></div>
              </BoardZone>
              <BoardZone type="potion" label="Potions" faceDown style={oppBoardZone('potion')}>
                {opp.potionDeckCount > 0 && <div className="board-card face-down"><img src={opp.cardback || "/cardback.png"} style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false} /><div className="board-card-label">{opp.potionDeckCount}</div></div>}
              </BoardZone>
              <div className="board-util-spacer" />
            </div>
            <div className="board-util-mid" />
            <div className="board-util-side">
              <div className="board-util-spacer" />
              <div onClick={() => !isSpectator && me.potionDeckCount > 0 && setDeckViewer('potion')} style={{ cursor: !isSpectator && me.potionDeckCount > 0 ? 'pointer' : 'default' }} data-my-potion-deck="1">
              <BoardZone type="potion" label="Potions" faceDown style={myBoardZone('potion')}>
                {me.potionDeckCount > 0 && <div className="board-card face-down"><img src={me.cardback || "/cardback.png"} style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false} /><div className="board-card-label">{me.potionDeckCount}</div></div>}
              </BoardZone>
              </div>
              <div onClick={() => !isSpectator && me.deckCount > 0 && setDeckViewer('deck')} style={{ cursor: !isSpectator && me.deckCount > 0 ? 'pointer' : 'default' }} data-my-deck="1">
              <BoardZone type="deck" label="Deck" faceDown style={myBoardZone('deck')}>
                <div className="board-card face-down"><img src={me.cardback || "/cardback.png"} style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false} /><div className="board-card-label">{me.deckCount}</div></div>
              </BoardZone>
              </div>
            </div>
          </div>
        </div>

        {/* My hand (bottom player) — drag to reorder for players, face-down for spectators */}
        <div className="game-hand game-hand-me" ref={isSpectator ? undefined : handRef}>
          <div className="game-hand-info">
            {me.avatar && <img src={me.avatar} className={'game-hand-avatar game-hand-avatar-big' + (!result && (isMyTurn ? ' avatar-active' : ' avatar-inactive'))} />}
            <span className="orbit-font" style={{ fontSize: 18, fontWeight: 800, color: me.color }}>{me.username}</span>
            {meDisconnected && <span style={{ fontSize: 10, color: 'var(--danger)', animation: 'pulse 1.5s infinite' }}>DISCONNECTED</span>}
          </div>
          {isSpectator ? (
            <div className="game-hand-cards">
              {Array.from({ length: me.handCount || 0 }).map((_, i) => (
                <div key={i} className="board-card face-down hand-card" data-hand-idx={i} style={specMeDrawHidden.has(i) ? { visibility: 'hidden' } : undefined}>
                  <img src={me.cardback || "/cardback.png"} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                </div>
              ))}
            </div>
          ) : (
            <div className={"game-hand-cards" + (stealHighlightMe.size > 0 ? ' hand-steal-highlight-active' : '') + (gameState.effectPrompt?.type === 'handPick' && gameState.effectPrompt?.ownerIdx === myIdx ? ' blind-pick-active' : '')}>
              {displayHand.map((item, i) => {
                if (item.isGap) return <div key="gap" className="hand-drop-gap" />;
                const isBeingDragged = (handDrag && handDrag.idx === item.origIdx) || (playDrag && playDrag.idx === item.origIdx) || (abilityDrag && abilityDrag.idx === item.origIdx);
                const dimmed = getCardDimmed(item.card, item.origIdx);
                const isHandLockBlocked = dimmed && me.handLocked && (me.handLockBlockedCards || []).includes(item.card);
                const isDrawAnim = drawAnimCards.some(a => a.origIdx === item.origIdx);
                const isPendingPlay = pendingAdditionalPlay && pendingAdditionalPlay.handIndex === item.origIdx;
                const isForceDiscard = gameState.effectPrompt?.type === 'forceDiscard' && gameState.effectPrompt?.ownerIdx === myIdx;
                const isForceDiscardCancellable = gameState.effectPrompt?.type === 'forceDiscardCancellable' && gameState.effectPrompt?.ownerIdx === myIdx;
                const isAbilityAttach = gameState.effectPrompt?.type === 'abilityAttach' && gameState.effectPrompt?.ownerIdx === myIdx;
                const isAttachEligible = isAbilityAttach && (gameState.effectPrompt.eligibleCards || []).includes(item.card);
                const isAnyDiscard = isForceDiscard || isForceDiscardCancellable;
                const isHandPick = gameState.effectPrompt?.type === 'handPick' && gameState.effectPrompt?.ownerIdx === myIdx;
                const isHandPickSelected = isHandPick && handPickSelected.has(item.origIdx);
                const isHandPickEligible = isHandPick && (gameState.effectPrompt.eligibleIndices || []).includes(item.origIdx);
                const isHandPickTypeFull = (() => {
                  if (!isHandPick || !isHandPickEligible || isHandPickSelected) return false;
                  const cardTypes = gameState.effectPrompt.cardTypes || {};
                  const typeLimits = gameState.effectPrompt.typeLimits || {};
                  const thisType = cardTypes[item.origIdx];
                  if (!thisType || typeLimits[thisType] === undefined) return false;
                  let selectedOfType = 0;
                  for (const si of handPickSelected) {
                    if (cardTypes[si] === thisType) selectedOfType++;
                  }
                  return selectedOfType >= typeLimits[thisType];
                })();
                const isHandPickMaxed = isHandPick && !isHandPickSelected && handPickSelected.size >= (gameState.effectPrompt.maxSelect || 3);
                const isStealMarked = stealMarkedMe.has(item.origIdx);
                const isStealHighlighted = stealHighlightMe.has(item.origIdx);
                const isStealHidden = stealHiddenMe.has(item.origIdx) && hand.length === stealExpectedMeCountRef.current;
                return (
                  <div key={'h-' + item.origIdx} data-hand-idx={item.origIdx} data-touch-drag="1"
                    className={'hand-slot' + (isBeingDragged ? ' hand-dragging' : '') + (dimmed ? ' hand-card-dimmed' : '') + (isAnyDiscard ? ' hand-discard-target' : '') + (isAttachEligible ? ' hand-card-attach-eligible' : '') + (isAbilityAttach && !isAttachEligible ? ' hand-card-attach-dimmed' : '') + (isHandPickSelected ? ' hand-pick-selected' : '') + (isHandPickEligible && !isHandPickSelected && !isHandPickTypeFull && !isHandPickMaxed ? ' hand-pick-eligible' : '') + ((isHandPickTypeFull || isHandPickMaxed) ? ' hand-card-dimmed' : '') + ((isStealMarked || isStealHighlighted) ? ' blind-pick-selected' : '')}
                    style={(isDrawAnim || isPendingPlay || isStealHidden) ? { visibility: 'hidden' } : undefined}
                    onMouseDown={(e) => onHandMouseDown(e, item.origIdx)}
                    onTouchStart={(e) => onHandMouseDown(e, item.origIdx)}
                    onMouseEnter={() => isAnyDiscard && setHoveredPileCard(item.card)}
                    onMouseLeave={() => isAnyDiscard && setHoveredPileCard(null)}>
                    <BoardCard cardName={item.card} noTooltip={isAnyDiscard} skins={gameSkins} />
                    {isHandLockBlocked && <div className="hand-lock-indicator">⦸</div>}
                  </div>
                );
              })}
            </div>
          )}
          {!isSpectator && (
            <div className="hand-actions">
              <button className="btn hand-action-btn" onClick={sortHand} title="Sort hand by type, then name">Sort</button>
              <button className="btn hand-action-btn" onClick={shuffleHand} title="Shuffle hand randomly">Shuffle</button>
            </div>
          )}
          <div className="game-gold-display">
            <span className="game-gold-icon">🪙</span>
            <span className="game-gold-value orbit-font" data-gold-player={myIdx}>{me.gold || 0}</span>
          </div>
        </div>

        </div>
      {/* end game-layout */}

      {/* Floating draw animation cards (outside game-layout to avoid overflow clip) */}
      {!isSpectator && drawAnimCards.map(anim => (
        <DrawAnimCard key={anim.id} cardName={anim.cardName} origIdx={anim.origIdx}
          startX={anim.startX} startY={anim.startY} dimmed={getCardDimmed(anim.cardName)} />
      ))}
      {oppDrawAnims.map(anim => (
        <OppDrawAnimCard key={anim.id} startX={anim.startX} startY={anim.startY}
          endX={anim.endX} endY={anim.endY} cardName={anim.cardName} cardbackUrl={opp.cardback} />
      ))}
      {/* Spectator: bottom player draw animations (face-down, like opponent) */}
      {isSpectator && specMeDrawAnims.map(anim => (
        <OppDrawAnimCard key={anim.id} startX={anim.startX} startY={anim.startY}
          endX={anim.endX} endY={anim.endY} cardbackUrl={me.cardback} />
      ))}

      {/* Floating discard animation cards */}
      {discardAnims.map(anim => (
        <DiscardAnimCard key={anim.id} cardName={anim.cardName} dest={anim.dest}
          startX={anim.startX} startY={anim.startY} endX={anim.endX} endY={anim.endY} />
      ))}

      {/* Floating drag card (outside game-layout to avoid overflow clip) */}
      {handDrag && (
        <div className="hand-floating-card" style={{ left: handDrag.mouseX - 32, top: handDrag.mouseY - 45 }}>
          <BoardCard cardName={handDrag.cardName} />
        </div>
      )}
      {playDrag && (
        <div className="hand-floating-card" style={{ left: playDrag.mouseX - 32, top: playDrag.mouseY - 45 }}>
          <BoardCard cardName={playDrag.cardName} />
        </div>
      )}
      {abilityDrag && (
        <div className="hand-floating-card" style={{ left: abilityDrag.mouseX - 32, top: abilityDrag.mouseY - 45 }}>
          <BoardCard cardName={abilityDrag.cardName} />
        </div>
      )}

      {/* Damage numbers */}
      {damageNumbers.map(d => (
        <DamageNumber key={d.id} amount={d.amount} heroName={d.heroName} />
      ))}
      {healNumbers.map(d => (
        <HealNumber key={d.id} amount={d.amount} ownerLabel={d.ownerLabel} heroIdx={d.heroIdx} />
      ))}
      {creatureDamageNumbers.map(d => (
        <CreatureDamageNumber key={d.id} amount={d.amount} ownerLabel={d.ownerLabel} heroIdx={d.heroIdx} zoneSlot={d.zoneSlot} />
      ))}

      {/* Gold gain numbers */}
      {goldGains.map(g => (
        <GoldGainNumber key={g.id} amount={g.amount} playerIdx={g.playerIdx} isMe={g.playerIdx === myIdx} />
      ))}

      {/* Gold loss numbers */}
      {goldLosses.map(g => (
        <GoldLossNumber key={g.id} amount={g.amount} playerIdx={g.playerIdx} isMe={g.playerIdx === myIdx} />
      ))}

      {/* Level change numbers */}
      {levelChanges.map(lc => (
        <LevelChangeNumber key={lc.id} delta={lc.delta} owner={lc.owner} heroIdx={lc.heroIdx} zoneSlot={lc.zoneSlot} myIdx={myIdx} />
      ))}

      {/* Toughness HP change numbers */}
      {toughnessHpChanges.map(thp => (
        <ToughnessHpNumber key={thp.id} amount={thp.amount} owner={thp.owner} heroIdx={thp.heroIdx} myIdx={myIdx} />
      ))}

      {/* Fighting ATK change numbers */}
      {fightingAtkChanges.map(fa => (
        <FightingAtkNumber key={fa.id} amount={fa.amount} owner={fa.owner} heroIdx={fa.heroIdx} myIdx={myIdx} />
      ))}

      {/* Modular game animations (explosions, etc.) */}
      {gameAnims.map(a => (
        <GameAnimationRenderer key={a.id} {...a} />
      ))}

      {/* Beam animations (laser beams, etc.) */}
      {beamAnims.length > 0 && (
        <div className="beam-animation-container">
          <svg>
            {beamAnims.map(b => (
              <g key={b.id}>
                <line className="beam-line-outer" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} />
                <line className="beam-line-glow" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} />
                <line className="beam-line-core" x1={b.x1} y1={b.y1} x2={b.x2} y2={b.y2} style={{ stroke: b.color }} />
                <circle className="beam-impact" cx={b.x2} cy={b.y2} r="5" fill={b.color} opacity="0.8" />
              </g>
            ))}
          </svg>
        </div>
      )}

      {/* Ram animations (hero charges to target and back) */}
      {ramAnims.map(r => (
        <div key={r.id} className={'ram-anim-card' + (r.trailType === 'fire_stars' ? ' ram-fire-stars' : '')} style={{
          left: r.srcX - 34, top: r.srcY - 48,
          '--ramDx': (r.tgtX - r.srcX) + 'px',
          '--ramDy': (r.tgtY - r.srcY) + 'px',
          '--ramAngle': (r.angle || 0) + 'deg',
          animationDuration: r.dur + 'ms',
        }}>
          <BoardCard cardName={r.cardName} noTooltip />
          <div className="ram-flame-trail" />
          {r.trailType === 'fire_stars' && <>
            <div className="ram-fire-particle" style={{ '--fp-delay': '0s', '--fp-x': '-8px', '--fp-y': '12px' }}>🔥</div>
            <div className="ram-fire-particle" style={{ '--fp-delay': '0.1s', '--fp-x': '10px', '--fp-y': '8px' }}>🔥</div>
            <div className="ram-fire-particle" style={{ '--fp-delay': '0.15s', '--fp-x': '-4px', '--fp-y': '20px' }}>⭐</div>
            <div className="ram-fire-particle" style={{ '--fp-delay': '0.2s', '--fp-x': '6px', '--fp-y': '16px' }}>⭐</div>
            <div className="ram-fire-particle" style={{ '--fp-delay': '0.25s', '--fp-x': '-12px', '--fp-y': '6px' }}>🔥</div>
          </>}
        </div>
      ))}

      {/* Card transfer animations (Dark Gear creature steal, etc.) */}
      {transferAnims.map(t => (
        <div key={t.id} className="transfer-anim-card" style={{
          left: t.srcX, top: t.srcY,
          '--transferDx': (t.tgtX - t.srcX) + 'px',
          '--transferDy': (t.tgtY - t.srcY) + 'px',
          animationDuration: t.dur + 'ms',
        }}>
          <BoardCard cardName={t.cardName} noTooltip />
        </div>
      ))}

      {/* Projectile animations (phoenix cannon, etc.) */}
      {projectileAnims.map(p => (
        <div key={p.id} className="projectile-anim" style={{
          left: p.srcX, top: p.srcY,
          '--projDx': (p.tgtX - p.srcX) + 'px',
          '--projDy': (p.tgtY - p.srcY) + 'px',
          animationDuration: p.dur + 'ms',
        }}>
          <span className={p.projectileClass || 'projectile-emoji'} style={p.emojiStyle || {}}>{p.projectileClass ? '' : p.emoji}</span>
          <div className={p.trailClass || 'projectile-flame-trail'} />
        </div>
      ))}

      {/* Opponent card reveal */}
      {cardReveals.length > 0 && (
        <CardRevealOverlay reveals={cardReveals} onRemove={(id) => setCardReveals(prev => prev.filter(r => r.id !== id))} />
      )}

      {/* ── Reaction Chain Visualization ── */}
      {reactionChain && reactionChain.length >= 2 && (
        <div className="reaction-chain-overlay">
          <div className="reaction-chain-label orbit-font">Chain</div>
          <div className="reaction-chain-cards">
            {reactionChain.map((link, i) => (
              <div key={link.id} className={
                'reaction-chain-card'
                + (link.status === 'resolving' ? ' chain-glow' : '')
                + (link.status === 'negated' ? ' chain-negated' : '')
                + (link.status === 'resolved' ? ' chain-resolved' : '')
              }>
                <BoardCard cardName={link.cardName} style={{ width: 80, height: 112, borderRadius: 4 }} />
                {link.isInitialCard && <div className="chain-badge chain-badge-initial">INITIAL</div>}
                {link.status === 'negated' && <div className="chain-negate-symbol">🚫</div>}
                {link.status === 'negated' && link.negationStyle === 'ice' && (
                  <div className="chain-ice-overlay">
                    <div className="chain-ice-crystal" style={{ left: 8, top: 12, fontSize: 14, animationDelay: '0ms' }}>❄</div>
                    <div className="chain-ice-crystal" style={{ left: 55, top: 30, fontSize: 18, animationDelay: '50ms' }}>❄</div>
                    <div className="chain-ice-crystal" style={{ left: 20, top: 55, fontSize: 12, animationDelay: '100ms' }}>❆</div>
                    <div className="chain-ice-crystal" style={{ left: 50, top: 75, fontSize: 16, animationDelay: '150ms' }}>❄</div>
                    <div className="chain-ice-crystal" style={{ left: 12, top: 85, fontSize: 14, animationDelay: '200ms' }}>❅</div>
                    <div className="chain-ice-crystal" style={{ left: 40, top: 15, fontSize: 11, animationDelay: '80ms' }}>❆</div>
                  </div>
                )}
                <div className="chain-owner-dot" style={{ background: link.owner === myIdx ? 'var(--accent)' : 'var(--danger)' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Camera Flash ── */}
      {cameraFlash && (
        <div className="camera-flash-overlay">
          <div className="camera-flash-icon">
            <svg viewBox="0 0 100 100" width="120" height="120">
              <rect x="20" y="30" width="60" height="45" rx="8" fill="#ff69b4" stroke="#fff" strokeWidth="2"/>
              <circle cx="50" cy="52" r="14" fill="#222" stroke="#fff" strokeWidth="2"/>
              <circle cx="50" cy="52" r="8" fill="#4af"/>
              <rect x="38" y="24" width="24" height="10" rx="3" fill="#ff69b4" stroke="#fff" strokeWidth="1.5"/>
              <ellipse cx="28" cy="22" rx="10" ry="16" fill="none" stroke="#ff69b4" strokeWidth="2" transform="rotate(-30 28 22)"/>
              <ellipse cx="72" cy="22" rx="10" ry="16" fill="none" stroke="#ff69b4" strokeWidth="2" transform="rotate(30 72 22)"/>
            </svg>
          </div>
        </div>
      )}

      {/* ── Global Game Tooltip ── */}
      <GameTooltip />

      {/* Immune status tooltip */}
      {immuneTooltip && (() => {
        const el = document.querySelector(`[data-hero-name="${CSS.escape(immuneTooltip)}"] .status-immune-icon`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return <div className="immune-tooltip" style={{ position: 'fixed', left: r.right + 8, top: r.top - 4 }}>{immuneTooltipType === 'shielded' ? 'Immune to anything during your first turn!' : 'Cannot be Frozen, Stunned or otherwise incapacitated this turn.'}</div>;
      })()}

      {/* Additional Action icon tooltip */}
      {aaTooltipKey && (() => {
        const [ow, hi, sl] = aaTooltipKey.split('-');
        const ownerLabel = parseInt(ow) === myIdx ? 'me' : 'opp';
        const el = document.querySelector(`[data-support-owner="${ownerLabel}"][data-support-hero="${hi}"][data-support-slot="${sl}"] .additional-action-icon`);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return <div className="immune-tooltip" style={{ position: 'fixed', left: r.right + 8, top: r.top - 4, borderColor: 'rgba(255,200,0,.4)', color: '#ffdd88' }}>Provides an additional Action.</div>;
      })()}

      {/* Pile hover tooltip (rendered at top level to escape overflow clipping) */}
      {hoveredPileCard && CARDS_BY_NAME[hoveredPileCard] && (() => {
        const card = CARDS_BY_NAME[hoveredPileCard];
        const imgUrl = cardImageUrl(card.name);
        const foilType = card.foil || null;
        const isFoil = foilType === 'secret_rare' || foilType === 'diamond_rare';
        return (
          <div className="board-tooltip">
            {imgUrl && (
              <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
                <img src={imgUrl} style={{ width: '100%', aspectRatio: '750/1050', objectFit: 'cover', display: 'block',
                  border: foilType === 'diamond_rare' ? '2px solid rgba(120,200,255,.6)' : foilType === 'secret_rare' ? '2px solid rgba(255,215,0,.5)' : 'none' }} />
              </div>
            )}
            <div style={{ padding: '10px 12px' }}>
              <div style={{ fontWeight: 700, fontSize: 18, color: typeColor(card.cardType), marginBottom: 5 }}>{card.name}</div>
              <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 8 }}>
                {card.cardType}{card.subtype ? ' · ' + card.subtype : ''}{card.archetype ? ' · ' + card.archetype : ''}
              </div>
              {card.effect && <div style={{ fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>{card.effect}</div>}
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8, display: 'flex', gap: 12 }}>
                {card.hp != null && <span style={{ color: '#ff6666' }}>♥ HP {card.hp}</span>}
                {card.atk != null && <span style={{ color: '#ffaa44' }}>⚔ ATK {card.atk}</span>}
                {card.cost != null && <span style={{ color: '#44aaff' }}>◆ Cost {card.cost}</span>}
                {card.level != null && <span>Lv{card.level}</span>}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Board card hover tooltip (shared single instance) */}
      {tooltipCard && !hoveredPileCard && (() => {
        const imgUrl = cardImageUrl(tooltipCard.name);
        const foilType = tooltipCard.foil || null;
        const isFoil = foilType === 'secret_rare' || foilType === 'diamond_rare';
        // Token mapping — cards that create tokens show the token tooltip alongside
        const CARD_TOKEN_MAP = {
          'Pyroblast': ['Pollution Token'],
          'Mummy Maker Machine': ['Mummy Token'],
        };
        const relatedTokens = [...(CARD_TOKEN_MAP[tooltipCard.name] || [])];
        // Luck declared target — show the declared card alongside ONLY for the specific hovered Luck
        if (tooltipCard.name === 'Luck' && _activeLuckTooltipTarget) {
          if (!relatedTokens.includes(_activeLuckTooltipTarget)) relatedTokens.push(_activeLuckTooltipTarget);
        }
        return (
          <>
            {relatedTokens.map(tokenName => {
              const tokenCard = CARDS_BY_NAME[tokenName];
              if (!tokenCard) return null;
              const tokenImg = cardImageUrl(tokenCard.name);
              return (
                <div key={tokenName} className="board-tooltip board-tooltip-token">
                  {tokenImg && (
                    <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
                      <img src={tokenImg} style={{ width: '100%', aspectRatio: '750/1050', objectFit: 'cover', display: 'block' }} />
                    </div>
                  )}
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 700, fontSize: 18, color: typeColor(tokenCard.cardType), marginBottom: 5 }}>{tokenCard.name}</div>
                    <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 8 }}>
                      {tokenCard.cardType}{tokenCard.subtype ? ' · ' + tokenCard.subtype : ''}
                    </div>
                    {tokenCard.effect && <div style={{ fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>{tokenCard.effect}</div>}
                    <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8, display: 'flex', gap: 12 }}>
                      {tokenCard.hp != null && <span style={{ color: '#ff6666' }}>♥ HP {tokenCard.hp}</span>}
                      {tokenCard.atk != null && <span style={{ color: '#ffaa44' }}>⚔ ATK {tokenCard.atk}</span>}
                      {tokenCard.cost != null && <span style={{ color: '#44aaff' }}>◆ Cost {tokenCard.cost}</span>}
                      {tokenCard.level != null && <span>Lv{tokenCard.level}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="board-tooltip">
              {imgUrl && (
                <div style={{ position: 'relative', width: '100%', flexShrink: 0 }}>
                  <img src={imgUrl} style={{ width: '100%', aspectRatio: '750/1050', objectFit: 'cover', display: 'block',
                    border: foilType === 'diamond_rare' ? '2px solid rgba(120,200,255,.6)' : foilType === 'secret_rare' ? '2px solid rgba(255,215,0,.5)' : 'none' }} />
                  {isFoil && <FoilOverlay bands={[]} shimmerOffset="0ms" sparkleDelays={[]} foilType={foilType} />}
                </div>
              )}
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontWeight: 700, fontSize: 18, color: typeColor(tooltipCard.cardType), marginBottom: 5 }}>{tooltipCard.name}</div>
                <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 8 }}>
                  {tooltipCard.cardType}{tooltipCard.subtype ? ' · ' + tooltipCard.subtype : ''}{tooltipCard.archetype ? ' · ' + tooltipCard.archetype : ''}
                </div>
                {tooltipCard.effect && <div style={{ fontSize: 14, marginTop: 4, lineHeight: 1.5 }}>{tooltipCard.effect}</div>}
                <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8, display: 'flex', gap: 12 }}>
                  {tooltipCard.hp != null && <span style={{ color: '#ff6666' }}>♥ HP {tooltipCard.hp}</span>}
                  {tooltipCard.atk != null && <span style={{ color: '#ffaa44' }}>⚔ ATK {tooltipCard.atk}</span>}
                  {tooltipCard.cost != null && <span style={{ color: '#44aaff' }}>◆ Cost {tooltipCard.cost}</span>}
                  {tooltipCard.level != null && <span>Lv{tooltipCard.level}</span>}
                </div>
              </div>
            </div>
          </>
        );
      })()}

      {/* Ping flash overlays */}
      {pingAnims.map(p => {
        const el = document.querySelector(p.selector);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return (
          <div key={p.id} className="ping-flash" style={{
            position: 'fixed', left: r.left, top: r.top, width: r.width, height: r.height,
            boxShadow: `0 0 16px ${p.color}, 0 0 32px ${p.color}, inset 0 0 12px ${p.color}`,
            borderColor: p.color,
            pointerEvents: 'none', zIndex: 10050,
          }} />
        );
      })}

      {/* ── Side-Deck Phase Overlay (Bo3/Bo5) ── */}
      {sideDeckPhase && !isSpectator && (() => {
        const dk = sideDeckPhase.currentDeck;
        if (!dk) return null;
        const sel = sideDeckSel;
        const heroes = dk.heroes || [];
        const mainCards = dk.mainDeck || [];
        const potionCards = dk.potionDeck || [];
        const sideCards = dk.sideDeck || [];
        const oppDone = sideDeckPhase.opponentDone;

        const getCardType = (pool, idx) => {
          let name;
          if (pool === 'main') name = mainCards[idx];
          else if (pool === 'potion') name = potionCards[idx];
          else if (pool === 'side') name = sideCards[idx];
          else if (pool === 'hero') return 'Hero';
          else return null;
          return CARDS_BY_NAME[name]?.cardType || null;
        };

        const canSwap = (fromPool, fromIdx, toPool, toIdx) => {
          // No same-pool swaps, no direct main↔potion
          if (fromPool === toPool) return false;
          if ((fromPool === 'main' && toPool === 'potion') || (fromPool === 'potion' && toPool === 'main')) return false;

          // Get card names for the swap
          const getCardName = (pool, idx) => {
            if (pool === 'main') return mainCards[idx];
            if (pool === 'potion') return potionCards[idx];
            if (pool === 'side') return sideCards[idx];
            if (pool === 'hero') return heroes[idx]?.hero;
            return null;
          };
          const fromName = getCardName(fromPool, fromIdx);
          const toName = getCardName(toPool, toIdx);
          if (!fromName || !toName) return false;

          // Simulate deck state after swap for Nicolas checks
          const simDeck = {
            mainDeck: [...mainCards], potionDeck: [...potionCards], sideDeck: [...sideCards],
            heroes: heroes.map(h => h ? { ...h } : h),
          };
          // Perform the simulated swap
          if (fromPool === 'hero' && toPool === 'side') {
            simDeck.heroes[fromIdx] = { hero: toName, ability1: null, ability2: null };
            simDeck.sideDeck[toIdx] = fromName;
          } else if (fromPool === 'side' && toPool === 'hero') {
            simDeck.heroes[toIdx] = { hero: fromName, ability1: null, ability2: null };
            simDeck.sideDeck[fromIdx] = toName;
          }
          // Use canCardTypeEnterSection to validate both directions
          const canEnter = window.canCardTypeEnterSection;
          if (!canEnter(simDeck, fromName, toPool)) return false;
          if (!canEnter(simDeck, toName, fromPool)) return false;

          // For hero swaps: also check that swapping out Nicolas doesn't leave potions stranded in main
          if ((fromPool === 'hero' || toPool === 'hero') && (fromPool === 'side' || toPool === 'side')) {
            // After swap, if main has potions but no Nicolas, block it
            const mainPotions = simDeck.mainDeck.some(n => CARDS_BY_NAME[n]?.cardType === 'Potion');
            if (mainPotions && !simDeck.heroes.some(h => h?.hero === 'Nicolas, the Hidden Alchemist')) return false;
          }

          return true;
        };

        // Simplified pool-level check for highlighting (without specific indices)
        const canSwapPool = (fromPool, toPool) => {
          if (fromPool === 'hero' || toPool === 'hero') return (fromPool === 'side' || toPool === 'side');
          if ((fromPool === 'main' && toPool === 'potion') || (fromPool === 'potion' && toPool === 'main')) return false;
          return (fromPool === 'side' || toPool === 'side');
        };

        const handleCardClick = (pool, idx) => {
          if (sideDeckDone) return;
          if (!sel) {
            setSideDeckSel({ pool, idx });
          } else if (sel.pool === pool && sel.idx === idx) {
            setSideDeckSel(null);
          } else if (canSwap(sel.pool, sel.idx, pool, idx)) {
            socket.emit('side_deck_swap', { roomId: gameState.roomId, from: sel.pool, fromIdx: sel.idx, to: pool, toIdx: idx });
            setSideDeckSel(null);
          } else if (sel.pool === pool) {
            // Click different card in same pool — reselect
            setSideDeckSel({ pool, idx });
          } else {
            setSideDeckSel({ pool, idx });
          }
        };

        const renderCard = (name, pool, idx) => {
          const card = CARDS_BY_NAME[name];
          const imgUrl = card ? cardImageUrl(name) : null;
          const isSelected = sel?.pool === pool && sel?.idx === idx;
          const isSwapTarget = sel && canSwapPool(sel.pool, pool) && !(sel.pool === pool && sel.idx === idx);
          // For hero targets, only highlight if side card is a Hero
          const isValidHeroTarget = pool === 'hero' && sel?.pool === 'side' && (() => {
            const sideCard = CARDS_BY_NAME[sideCards[sel.idx]];
            return sideCard?.cardType === 'Hero';
          })();
          const isValidSideForHero = pool === 'side' && sel?.pool === 'hero';

          return (
            <div key={pool + '-' + idx} onClick={() => handleCardClick(pool, idx)}
              onMouseEnter={() => card && setBoardTooltip(card)} onMouseLeave={() => setBoardTooltip(null)}
              style={{
                width: 64, height: 90, borderRadius: 4, overflow: 'hidden', cursor: sideDeckDone ? 'default' : 'pointer',
                border: isSelected ? '2px solid #ffaa00' : (isSwapTarget && (pool !== 'hero' || isValidHeroTarget) || isValidSideForHero) ? '2px solid rgba(100,255,100,.6)' : '2px solid transparent',
                opacity: sideDeckDone ? 0.5 : 1,
                boxShadow: isSelected ? '0 0 12px rgba(255,170,0,.6)' : undefined,
                transition: 'border .15s, box-shadow .15s',
                flexShrink: 0,
              }}>
              {imgUrl ? (
                <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'var(--text2)', textAlign: 'center', padding: 2 }}>{name}</div>
              )}
            </div>
          );
        };

        const renderHeroSlot = (h, idx) => {
          const card = h?.hero ? CARDS_BY_NAME[h.hero] : null;
          const isSelected = sel?.pool === 'hero' && sel?.idx === idx;
          const isSwapTarget = sel?.pool === 'side' && (() => {
            const sc = CARDS_BY_NAME[sideCards[sel.idx]];
            return sc?.cardType === 'Hero';
          })();
          return (
            <div key={'hero-' + idx} onClick={() => h?.hero && handleCardClick('hero', idx)}
              onMouseEnter={() => card && setBoardTooltip(card)} onMouseLeave={() => setBoardTooltip(null)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                padding: 6, borderRadius: 6, cursor: h?.hero && !sideDeckDone ? 'pointer' : 'default',
                border: isSelected ? '2px solid #ffaa00' : isSwapTarget ? '2px solid rgba(100,255,100,.6)' : '2px solid var(--bg4)',
                background: 'var(--bg2)', minWidth: 90,
                opacity: sideDeckDone ? 0.5 : 1,
                boxShadow: isSelected ? '0 0 12px rgba(255,170,0,.6)' : undefined,
              }}>
              <div style={{ width: 72, height: 100, borderRadius: 4, overflow: 'hidden' }}>
                {card ? (
                  <img src={cardImageUrl(h.hero)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', fontSize: 10 }}>Empty</div>
                )}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text2)', textAlign: 'center' }}>
                {h?.ability1 && <span style={{ color: '#88ccff' }}>{h.ability1}</span>}
                {h?.ability1 && h?.ability2 && ' / '}
                {h?.ability2 && <span style={{ color: '#88ccff' }}>{h.ability2}</span>}
              </div>
            </div>
          );
        };

        const sectionStyle = { marginBottom: 12 };
        const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 4, fontFamily: "'Orbitron', sans-serif" };
        const cardRowStyle = { display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 200, overflowY: 'auto', padding: 4, background: 'var(--bg2)', borderRadius: 6, border: '1px solid var(--bg4)' };

        return (
          <div className="modal-overlay" style={{ zIndex: 10200, background: 'rgba(0,0,0,.85)' }}>
            <div className="animate-in" style={{ width: '90vw', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg1)', borderRadius: 12, padding: 24, border: '1px solid var(--bg4)' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div className="pixel-font" style={{ fontSize: 16, color: 'var(--accent)' }}>SIDE DECKING</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                    Best of {sideDeckPhase.format} — Score: {(sideDeckPhase.setScore || [0, 0]).join(' – ')}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {oppDone && <span style={{ fontSize: 18, color: '#44ff44' }} title="Opponent is done">✅</span>}
                  <span style={{ fontSize: 11, color: oppDone ? '#44ff44' : 'var(--text2)' }}>
                    {oppDone ? 'Opponent ready' : 'Opponent siding...'}
                  </span>
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.5 }}>
                Click a card to select it, then click a card in the Side Deck (or vice versa) to swap them. Heroes can only be swapped with Side Deck Heroes.
              </div>

              {/* Heroes */}
              <div style={sectionStyle}>
                <div style={labelStyle}>HEROES</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  {heroes.map((h, i) => renderHeroSlot(h, i))}
                </div>
              </div>

              {/* Main Deck */}
              <div style={sectionStyle}>
                <div style={labelStyle}>MAIN DECK ({mainCards.length})</div>
                <div style={cardRowStyle}>
                  {mainCards.length === 0 ? <div style={{ color: 'var(--text2)', fontSize: 11, padding: 8 }}>Empty</div> : mainCards.map((c, i) => renderCard(c, 'main', i))}
                </div>
              </div>

              {/* Potion Deck */}
              <div style={sectionStyle}>
                <div style={labelStyle}>POTION DECK ({potionCards.length})</div>
                <div style={cardRowStyle}>
                  {potionCards.length === 0 ? <div style={{ color: 'var(--text2)', fontSize: 11, padding: 8 }}>Empty</div> : potionCards.map((c, i) => renderCard(c, 'potion', i))}
                </div>
              </div>

              {/* Side Deck */}
              <div style={sectionStyle}>
                <div style={{ ...labelStyle, color: '#ffaa00' }}>SIDE DECK ({sideCards.length})</div>
                <div style={{ ...cardRowStyle, borderColor: 'rgba(255,170,0,.3)' }}>
                  {sideCards.length === 0 ? <div style={{ color: 'var(--text2)', fontSize: 11, padding: 8 }}>No side deck cards</div> : sideCards.map((c, i) => renderCard(c, 'side', i))}
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
                <button className="btn" style={{ padding: '10px 24px', fontSize: 12, borderColor: 'var(--text2)', color: 'var(--text2)' }}
                  disabled={sideDeckDone}
                  onClick={() => {
                    socket.emit('side_deck_reset', { roomId: gameState.roomId });
                    setSideDeckSel(null);
                  }}>
                  🔄 Reset
                </button>
                <button className={'btn' + (sideDeckDone ? '' : ' btn-success')} style={{ padding: '10px 24px', fontSize: 12 }}
                  disabled={sideDeckDone}
                  onClick={() => {
                    setSideDeckDone(true);
                    setSideDeckSel(null);
                    socket.emit('side_deck_done', { roomId: gameState.roomId });
                  }}>
                  {sideDeckDone ? '✅ Waiting for opponent...' : '✔ Done Siding'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Surrender confirmation */}
      {showSurrender && (() => {
        const isBestOf = (gameState.format || 1) > 1;
        return (
        <div className="modal-overlay" onClick={() => setShowSurrender(false)}>
          <div className="modal animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, textAlign: 'center' }}>
            <div className="pixel-font" style={{ fontSize: 14, color: 'var(--danger)', marginBottom: 16 }}>SURRENDER?</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
              {isBestOf ? `Best of ${gameState.format} — Score: ${(gameState.setScore||[0,0]).join(' – ')}` : 'Do you really want to give up?'}
            </div>
            <div style={{ display: 'flex', flexDirection: isBestOf ? 'column' : 'row', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
              {isBestOf ? (<>
                <button className="btn btn-danger" style={{ padding: '10px 28px', fontSize: 13, width: 220 }} onClick={() => {
                  setShowSurrender(false);
                  socket.emit('surrender_game', { roomId: gameState.roomId });
                }}>Surrender Game</button>
                <button className="btn" style={{ padding: '10px 28px', fontSize: 13, width: 220, borderColor: '#ff2222', color: '#ff2222' }} onClick={() => {
                  setShowSurrender(false);
                  socket.emit('surrender_match', { roomId: gameState.roomId });
                }}>Surrender Match</button>
                <button className="btn" style={{ padding: '10px 28px', fontSize: 13, width: 220 }} onClick={() => setShowSurrender(false)}>Cancel</button>
              </>) : (<>
                <button className="btn btn-danger" style={{ padding: '10px 28px', fontSize: 13 }} onClick={handleSurrender}>YES</button>
                <button className="btn" style={{ padding: '10px 28px', fontSize: 13 }} onClick={() => setShowSurrender(false)}>Cancel</button>
              </>)}
            </div>
          </div>
        </div>
        );
      })()}

      {/* End Turn confirmation */}
      {showEndTurnConfirm && (
        <div className="modal-overlay" onClick={cancelEndTurn}>
          <div className="modal animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 320, textAlign: 'center' }}>
            <div className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', marginBottom: 16 }}>END YOUR TURN?</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-success" style={{ padding: '10px 28px', fontSize: 13 }} onClick={confirmEndTurn}>YES</button>
              <button className="btn" style={{ padding: '10px 28px', fontSize: 13 }} onClick={cancelEndTurn}>NO</button>
            </div>
          </div>
        </div>
      )}

      {/* Deck viewer */}
      {deckViewer && (() => {
        const raw = deckViewer === 'potion' ? (me.potionDeckCards || []) : (me.mainDeckCards || []);
        const TYPE_ORDER = ['Hero','Creature','Spell','Attack','Artifact','Ability','Potion','Ascended Hero','Token'];
        const sorted = [...raw].sort((a, b) => {
          const ca = CARDS_BY_NAME[a], cb = CARDS_BY_NAME[b];
          const ta = TYPE_ORDER.indexOf(ca?.cardType || ''), tb = TYPE_ORDER.indexOf(cb?.cardType || '');
          if (ta !== tb) return ta - tb;
          return a.localeCompare(b);
        });
        return (
          <div className="modal-overlay" onClick={() => setDeckViewer(null)}>
            <DraggablePanel className="modal animate-in deck-viewer-modal" style={{ maxWidth: 600 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)' }}>
                  {deckViewer === 'potion' ? '🧪 POTION DECK' : '📋 MAIN DECK'} ({sorted.length})
                </span>
                <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setDeckViewer(null)}>✕ CLOSE</button>
              </div>
              <div className="deck-viewer-grid">
                {sorted.map((name, i) => {
                  const card = CARDS_BY_NAME[name];
                  if (!card) return null;
                  return <CardMini key={name + '-' + i} card={card} onClick={() => {}} style={{ width: '100%', height: 120 }} />;
                })}
              </div>
            </DraggablePanel>
          </div>
        );
      })()}

      {/* Pile viewer (discard/deleted) */}
      {pileViewer && (() => {
        const TYPE_ORDER = ['Hero','Creature','Spell','Attack','Artifact','Ability','Potion','Ascended Hero','Token'];
        const sorted = [...(pileViewer.cards || [])].sort((a, b) => {
          const ca = CARDS_BY_NAME[a], cb = CARDS_BY_NAME[b];
          const ta = TYPE_ORDER.indexOf(ca?.cardType || ''), tb = TYPE_ORDER.indexOf(cb?.cardType || '');
          if (ta !== tb) return ta - tb;
          return a.localeCompare(b);
        });
        return (
          <div className="modal-overlay" onClick={() => setPileViewer(null)}>
            <DraggablePanel className="modal animate-in deck-viewer-modal">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)' }}>
                  {pileViewer.title} ({sorted.length})
                </span>
                <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setPileViewer(null)}>✕ CLOSE</button>
              </div>
              {sorted.length > 0 ? (
                <div className="deck-viewer-grid">
                  {sorted.map((name, i) => {
                    const card = CARDS_BY_NAME[name];
                    if (!card) return null;
                    return <CardMini key={name + '-' + i} card={card} onClick={() => {}} style={{ width: '100%', height: 120 }} />;
                  })}
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--text2)', padding: 20 }}>Empty</div>
              )}
            </DraggablePanel>
          </div>
        );
      })()}

      {/* ── Effect Prompt: Confirm Dialog ── */}
      {isMyEffectPrompt && ep.type === 'confirm' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)', display: 'flex', gap: 16, alignItems: 'stretch' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>{ep.title || 'Confirm'}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>{ep.message}</div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-success" style={{ padding: '10px 24px', fontSize: 13 }}
                onClick={() => respondToPrompt({ confirmed: true })}>
                {ep.confirmLabel || 'Yes'}
              </button>
              {ep.thirdOption && (
                <button className="btn btn-info" style={{ padding: '10px 24px', fontSize: 13 }}
                  onClick={() => respondToPrompt({ option: 'third' })}>
                  {ep.thirdOption}
                </button>
              )}
              <button className="btn" style={{ padding: '10px 24px', fontSize: 13, borderColor: 'var(--danger)', color: 'var(--danger)' }}
                onClick={() => respondToPrompt({ cancelled: true })}>
                {ep.cancelLabel || 'No'}
              </button>
            </div>
          </div>
          {ep.showCard && CARDS_BY_NAME[ep.showCard] && (() => {
            const showCardData = CARDS_BY_NAME[ep.showCard];
            const showCardImg = cardImageUrl(ep.showCard);
            return (
              <div className="board-card" style={{ width: 100, minHeight: 130, flexShrink: 0, borderRadius: 6, overflow: 'hidden', border: '2px solid var(--bg4)', background: 'var(--bg3)' }}
                onMouseEnter={() => { _boardTooltipLocked = true; setBoardTooltip(showCardData); }}
                onMouseLeave={() => { _boardTooltipLocked = false; setBoardTooltip(null); }}>
                {showCardImg ? (
                  <img src={showCardImg} alt={ep.showCard} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8, textAlign: 'center', fontSize: 11, color: 'var(--text2)' }}>{ep.showCard}</div>
                )}
              </div>
            );
          })()}
        </DraggablePanel>
      )}

      {/* ── Effect Prompt: Player Picker ── */}
      {isMyEffectPrompt && ep.type === 'playerPicker' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)', minWidth: 280 }}>
          <div className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>{ep.title || 'Choose a Player'}</div>
          {ep.description && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>{ep.description}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1].map(pIdx => {
              const p = pIdx === myIdx ? me : opp;
              const isMe = pIdx === myIdx;
              const clr = isMe ? 'var(--success)' : 'var(--danger)';
              return (
                <button key={pIdx} className="btn" style={{ padding: '12px 18px', fontSize: 13, borderColor: clr, color: clr, display: 'flex', alignItems: 'center', gap: 12 }}
                  onClick={() => respondToPrompt({ playerIdx: pIdx })}>
                  {p.avatar && <img src={p.avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />}
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.username}{isMe ? ' (you)' : ''}</div>
                  </div>
                </button>
              );
            })}
            {ep.cancellable !== false && (
              <button className="btn" style={{ padding: '8px 18px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)', marginTop: 4 }}
                onClick={() => respondToPrompt({ cancelled: true })}>Cancel (Esc)</button>
            )}
          </div>
        </DraggablePanel>
      )}

      {/* ── Effect Prompt: Option Picker (generic multi-option) ── */}
      {isMyEffectPrompt && ep.type === 'optionPicker' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>{ep.title || 'Choose'}</div>
          {ep.description && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>{ep.description}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(ep.options || []).map(opt => (
              <button key={opt.id} className="btn" style={{ padding: '10px 18px', fontSize: 12, borderColor: opt.color || 'var(--accent)', color: opt.color || 'var(--accent)', textAlign: 'left' }}
                onClick={() => respondToPrompt({ optionId: opt.id })}>
                <div style={{ fontWeight: 600 }}>{opt.label}</div>
                {opt.description && <div style={{ fontSize: 10, opacity: .7, marginTop: 2 }}>{opt.description}</div>}
              </button>
            ))}
            {ep.cancellable !== false && (
              <button className="btn" style={{ padding: '8px 18px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)', marginTop: 4 }}
                onClick={() => respondToPrompt({ cancelled: true })}>Cancel (Esc)</button>
            )}
          </div>
        </DraggablePanel>
      )}

      {/* ── Effect Prompt: Card Name Picker (Luck, etc.) ── */}
      {/* ── Effect Prompt: Card Name Picker (Luck, etc.) ── */}
      {isMyEffectPrompt && ep.type === 'cardNamePicker' && (
        <CardNamePickerPrompt ep={ep} onRespond={respondToPrompt} />
      )}

      {/* ── Effect Prompt: Card Gallery Picker ── */}
      {isMyEffectPrompt && ep.type === 'cardGallery' && (() => {
        const cards = ep.cards || [];
        return (
          <div className="modal-overlay" onClick={ep.cancellable !== false ? () => respondToPrompt({ cancelled: true }) : undefined}>
            <DraggablePanel className="modal animate-in deck-viewer-modal" style={{ maxWidth: 600 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)' }}>
                  {ep.title || 'Select a Card'}
                </span>
                {ep.cancellable !== false && (
                  <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }}
                    onClick={() => respondToPrompt({ cancelled: true })}>✕ CANCEL</button>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>{ep.description}</div>
              <div className="deck-viewer-grid">
                {cards.map((entry, i) => {
                  const card = CARDS_BY_NAME[entry.name];
                  if (!card) return null;
                  return (
                    <div key={entry.name + '-' + entry.source + '-' + i} style={{ position: 'relative' }}>
                      <CardMini card={card}
                        onClick={() => respondToPrompt({ cardName: entry.name, source: entry.source })}
                        style={{ width: '100%', height: 120, cursor: 'pointer' }} />
                      {entry.count != null && (
                        <div style={{
                          position: 'absolute', top: 3, right: 3,
                          background: 'rgba(0,0,0,.75)', color: '#fff',
                          fontSize: 10, fontWeight: 700, padding: '1px 5px',
                          borderRadius: 3, pointerEvents: 'none', zIndex: 5,
                          border: '1px solid rgba(255,255,255,.25)',
                        }}>×{entry.count}</div>
                      )}
                      <div className="gallery-source-badge" style={{
                        background: entry.source === 'hand' ? 'rgba(80,200,120,.85)' : entry.source === 'discard' ? 'rgba(180,80,200,.85)' : 'rgba(80,140,220,.85)',
                      }}>
                        {entry.source === 'hand' ? 'HAND' : entry.source === 'discard' ? 'DISCARD' : 'DECK'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </DraggablePanel>
          </div>
        );
      })()}

      {/* ── Effect Prompt: Multi-Select Card Gallery ── */}
      {isMyEffectPrompt && ep.type === 'cardGalleryMulti' && (
        <CardGalleryMultiPrompt ep={ep} onRespond={respondToPrompt} />
      )}

      {/* ── Effect Prompt: Zone Picker Panel ── */}
      {isMyEffectPrompt && ep.type === 'zonePick' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 8 }}>{ep.title || 'Select a Zone'}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>{ep.description}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', opacity: .7 }}>Click a highlighted zone on the board.</div>
          {ep.cancellable !== false && (
            <button className="btn" style={{ marginTop: 10, padding: '6px 16px', fontSize: 11 }}
              onClick={() => respondToPrompt({ cancelled: true })}>← Back</button>
          )}
        </DraggablePanel>
      )}

      {/* ── Effect Prompt: Chain Target Pick (Chain Lightning / Qinglong / Bottled Lightning) ── */}
      {isMyEffectPrompt && ep.type === 'chainTargetPick' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: '#ffcc00' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: '#ffcc00', marginBottom: 8 }}>⚡ {ep.title || 'Chain Lightning'}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
            {chainPickSelected.length < chainPickMaxTargets && chainPickValidIds.size > 0
              ? `Click target #${chainPickSelected.length + 1} (${chainPickDamages[chainPickSelected.length]} dmg).`
              : 'Confirm the chain!'}
          </div>
          {chainPickSelected.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 8 }}>
              {chainPickSelected.map((t, i) => (
                <span key={String(t.id)} style={{ display: 'block', color: '#ffcc00' }}>#{i+1} {String(t.cardName || '?')} → {chainPickDamages[i] || 0} dmg</span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {chainPickSelected.length > 0 && (
              <button className="btn" style={{ padding: '6px 14px', fontSize: 11 }}
                onClick={() => setChainPickSelected(prev => prev.slice(0, -1))}>↩ Undo</button>
            )}
            {chainPickCanConfirm && (
              <button className="btn btn-danger" style={{ padding: '6px 16px', fontSize: 11 }}
                onClick={() => { respondToPrompt({ selectedTargets: chainPickSelected }); setChainPickSelected([]); }}>⚡ Confirm Chain!</button>
            )}
          </div>
        </DraggablePanel>
      )}

      {/* ── Effect Prompt: Slippery Skates Move ── */}
      {isMyEffectPrompt && ep.type === 'skatesMove' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: '#00ccff' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: '#00ccff', marginBottom: 8 }}>⛸️ Slippery Skates</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
            {skatesSelected != null
              ? 'Now click a highlighted zone to move the Creature there.'
              : 'Click a Creature to select it for moving.'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)', opacity: .7 }}>Press Escape to cancel.</div>
          <button className="btn" style={{ marginTop: 10, padding: '6px 16px', fontSize: 11 }}
            onClick={() => { setSkatesSelected(null); respondToPrompt({ cancelled: true }); }}>✕ Cancel</button>
        </DraggablePanel>
      )}

      {/* ── Effect Prompt: Status Select (Beer, etc.) ── */}
      {isMyEffectPrompt && ep.type === 'statusSelect' && (
        <StatusSelectPrompt key={ep.title} ep={ep} onRespond={respondToPrompt} />
      )}

      {/* ── Effect Prompt: Hero Action (Coffee) ── */}
      {isMyEffectPrompt && ep.type === 'heroAction' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: '#8b6b4a' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: '#cc9966', marginBottom: 4 }}>{ep.title}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>{ep.description}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', opacity: .7, marginBottom: 12 }}>{ep.heroName ? `Drag a highlighted card onto ${ep.heroName}'s zones to play it.` : 'Drag a highlighted card onto any Hero\'s zones to play it.'}</div>
          {ep.cancellable !== false && <button className="btn" style={{ padding: '6px 16px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)' }}
            onClick={() => respondToPrompt({ cancelled: true })}>Cancel (Esc)</button>}
        </DraggablePanel>
      )}

      {/* ── Waiting for opponent (when they have an active effect prompt) ── */}
      {(isOppEffectPrompt || isActivePlayerPromptForOpp) && !gameState.potionTargeting && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)', minWidth: 260 }}>
          <div className="orbit-font" style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 6 }}>
            {ep.type === 'cardGallery' || ep.type === 'cardGalleryMulti' ? '🔍 Opponent is choosing...' :
             ep.type === 'deckSearchReveal' ? '🔍 Opponent is viewing...' :
             ep.type === 'optionPicker' ? '🤔 Opponent is deciding...' :
             ep.type === 'forceDiscard' || ep.type === 'forceDiscardCancellable' ? (ep.opponentTitle || '🗑 Opponent is discarding...') :
             ep.type === 'abilityAttach' ? '⚡ Opponent is equipping...' :
             ep.type === 'blindHandPick' ? '🫳 Opponent is stealing...' :
             ep.type === 'cardNamePicker' ? '🍀 Opponent is declaring...' :
             '⏳ Waiting for opponent...'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>
            {ep.type === 'cardGallery' ? 'Waiting for opponent to choose a card...' :
             ep.type === 'cardGalleryMulti' ? 'Waiting for opponent to select cards...' :
             ep.type === 'confirm' ? 'Waiting for opponent to confirm...' :
             ep.type === 'zonePick' ? 'Waiting for opponent to select a zone...' :
             ep.type === 'skatesMove' ? 'Waiting for opponent to move a creature...' :
             ep.type === 'chainTargetPick' ? 'Waiting for opponent to select targets...' :
             ep.type === 'heroAction' ? 'Waiting for opponent to play a card...' :
             ep.type === 'forceDiscard' ? (ep.opponentSubtitle || 'Waiting for opponent to discard a card...') :
             ep.type === 'forceDiscardCancellable' ? 'Waiting for opponent to discard or pass...' :
             ep.type === 'handPick' ? 'Waiting for opponent to select cards...' :
             ep.type === 'optionPicker' ? 'Waiting for opponent to choose an option...' :
             ep.type === 'playerPicker' ? 'Waiting for opponent to pick a player...' :
             ep.type === 'statusSelect' ? 'Waiting for opponent to choose a status...' :
             ep.type === 'abilityAttach' ? 'Waiting for opponent to attach an ability...' :
             ep.type === 'blindHandPick' ? 'Opponent is choosing cards from your hand...' :
             ep.type === 'deckSearchReveal' ? 'Waiting for opponent to dismiss search result...' :
             ep.type === 'cardNamePicker' ? 'Waiting for opponent to declare a card name...' :
             'Waiting for opponent...'}
          </div>
        </DraggablePanel>
      )}

      {/* ── Waiting for opponent's pre-game hero effect (Bill, etc.) ── */}
      {!isSpectator && !result && gameState.heroEffectPending && gameState.heroEffectPending.ownerIdx !== myIdx && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)', minWidth: 280 }}>
          <div className="orbit-font" style={{ fontSize: 12, color: 'var(--accent)', marginBottom: 6 }}>
            ⏳ Waiting for opponent...
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)' }}>
            Waiting for opponent to resolve {gameState.heroEffectPending.heroName || 'hero'}'s effect...
          </div>
        </DraggablePanel>
      )}

      {/* ── Ability Activation Confirmation ── */}
      {pendingAbilityActivation && !result && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: '#ffcc33' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: '#ffcc33', marginBottom: 8 }}>⚡ Activate Ability</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 16 }}>Activate {pendingAbilityActivation.abilityName} (Lv.{pendingAbilityActivation.level})?</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-success" style={{ padding: '8px 20px', fontSize: 12 }}
              onClick={() => {
                const pa = pendingAbilityActivation;
                setPendingAbilityActivation(null);
                if (pa.isHeroAction) {
                  socket.emit('effect_prompt_response', { roomId: gameState.roomId, response: { abilityActivation: true, heroIdx: pa.heroIdx, zoneIdx: pa.zoneIdx } });
                } else {
                  socket.emit('activate_ability', { roomId: gameState.roomId, heroIdx: pa.heroIdx, zoneIdx: pa.zoneIdx, charmedOwner: pa.charmedOwner });
                }
              }}>Yes!</button>
            <button className="btn" style={{ padding: '8px 20px', fontSize: 12, borderColor: 'var(--danger)', color: 'var(--danger)' }}
              onClick={() => setPendingAbilityActivation(null)}>No</button>
          </div>
        </DraggablePanel>
      )}

      {/* ── Spell/Attack Hero Selection (click-to-play) ── */}
      {spellHeroPick && !result && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 4 }}>
            {spellHeroPick.isSurprise ? '🎭' : spellHeroPick.isAscension ? '🦋' : spellHeroPick.card?.cardType === 'Attack' ? '⚔️' : '✦'} {spellHeroPick.isSurprise ? 'Set' : spellHeroPick.isAscension ? 'Ascend' : 'Play'} {spellHeroPick.cardName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 12 }}>{spellHeroPick.isSurprise ? 'Choose a Hero to set this Surprise face-down:' : spellHeroPick.isAscension ? 'Choose a Hero to Ascend:' : 'Choose a Hero to play this card:'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {spellHeroPick.eligible.map(h => (
              <button key={(h.charmedOwner != null ? 'c' : '') + h.idx} className="btn" style={{ padding: '8px 16px', fontSize: 12, borderColor: h.charmedOwner != null ? '#ff69b4' : 'var(--accent)', color: h.charmedOwner != null ? '#ff69b4' : 'var(--accent)', textAlign: 'left' }}
                onClick={() => {
                  const pick = spellHeroPick;
                  setSpellHeroPick(null);
                  if (pick.isSurprise) {
                    socket.emit('play_surprise', {
                      roomId: gameState.roomId, cardName: pick.cardName,
                      handIndex: pick.handIndex, heroIdx: h.idx,
                      bakhmSlot: h.bakhmSlot,
                    });
                  } else if (pick.isAscension) {
                    socket.emit('ascend_hero', {
                      roomId: gameState.roomId, cardName: pick.cardName,
                      handIndex: pick.handIndex, heroIdx: h.idx,
                    });
                  } else if (pick.isHeroAction) {
                    socket.emit('effect_prompt_response', {
                      roomId: gameState.roomId,
                      response: { cardName: pick.cardName, handIndex: pick.handIndex, heroIdx: h.idx },
                    });
                  } else {
                    socket.emit('play_spell', {
                      roomId: gameState.roomId, cardName: pick.cardName,
                      handIndex: pick.handIndex, heroIdx: h.idx,
                      charmedOwner: h.charmedOwner,
                    });
                  }
                }}>
                {h.charmedOwner != null ? `💕 ${h.name} (charmed)` : (me.heroes[h.idx]?.name || 'Hero ' + (h.idx + 1))}
              </button>
            ))}
            <button className="btn" style={{ padding: '6px 16px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)', marginTop: 4 }}
              onClick={() => setSpellHeroPick(null)}>Cancel</button>
          </div>
        </DraggablePanel>
      )}

      {/* ── Force Discard Prompt (Wheels) ── */}
      {isMyEffectPrompt && ep.type === 'forceDiscard' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--danger)' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 4 }}>{ep.title || 'Discard'}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>{ep.description}</div>
          <div style={{ fontSize: 11, color: 'var(--danger)', opacity: .8 }}>{ep.instruction || 'Click a card in your hand to discard it.'}</div>
        </DraggablePanel>
      )}

      {/* ── Cancellable Force Discard Prompt (Training, etc.) ── */}
      {isMyEffectPrompt && ep.type === 'forceDiscardCancellable' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--danger)' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 4 }}>{ep.title || 'Discard'}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>{ep.description}</div>
          <div style={{ fontSize: 11, color: 'var(--danger)', opacity: .8, marginBottom: 12 }}>{ep.instruction || 'Click a card in your hand to discard it.'}</div>
          <button className="btn" style={{ padding: '6px 16px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)' }}
            onClick={() => respondToPrompt({ cancelled: true })}>{ep.cancelLabel || 'Cancel (Esc)'}</button>
        </DraggablePanel>
      )}

      {/* ── Hand Pick Prompt (Shard of Chaos) ── */}
      {isMyEffectPrompt && ep.type === 'handPick' && (() => {
        const minSel = ep.minSelect ?? 1;
        const canConfirm = handPickSelected.size >= minSel;
        return (
          <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'rgba(200,100,255,.85)' }}>
            <div className="orbit-font" style={{ fontSize: 13, color: '#cc66ff', marginBottom: 4 }}>{ep.title || 'Select Cards'}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>{ep.description}</div>
            <div style={{ fontSize: 11, color: '#cc66ff', opacity: .8, marginBottom: 8 }}>
              Selected: {handPickSelected.size}/{ep.maxSelect || 3} (min {minSel})
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ padding: '6px 16px', fontSize: 11, borderColor: canConfirm ? '#cc66ff' : '#555', color: canConfirm ? '#cc66ff' : '#555' }}
                disabled={!canConfirm}
                onClick={() => {
                  const selected = [...handPickSelected].map(idx => ({ handIndex: idx, cardName: me.hand[idx] }));
                  respondToPrompt({ selectedCards: selected });
                }}>{ep.confirmLabel || 'Confirm'}</button>
              <button className="btn" style={{ padding: '6px 16px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)' }}
                onClick={() => respondToPrompt({ cancelled: true })}>Cancel</button>
            </div>
          </DraggablePanel>
        );
      })()}

      {/* ── Blind Hand Pick Prompt (Loot the Leftovers, etc.) ── */}
      {isMyEffectPrompt && ep.type === 'blindHandPick' && (() => {
        const maxSel = ep.maxSelect || 2;
        const canConfirm = blindPickSelected.size >= maxSel;
        return (
          <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'rgba(255,150,50,.85)' }}>
            <div className="orbit-font" style={{ fontSize: 13, color: '#ff9933', marginBottom: 4 }}>{ep.title || 'Steal Cards'}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>{ep.description || `Click ${maxSel} face-down cards from your opponent's hand.`}</div>
            <div style={{ fontSize: 11, color: '#ff9933', opacity: .8, marginBottom: 8 }}>
              Selected: {blindPickSelected.size}/{maxSel}
            </div>
            <button className="btn" style={{ padding: '6px 16px', fontSize: 11, borderColor: canConfirm ? '#ff9933' : '#555', color: canConfirm ? '#ff9933' : '#555' }}
              disabled={!canConfirm}
              onClick={() => {
                respondToPrompt({ selectedIndices: [...blindPickSelected] });
              }}>{ep.confirmLabel || '🫳 Steal!'}</button>
          </DraggablePanel>
        );
      })()}

      {/* ── Ability Attach Prompt (Training, etc.) ── */}
      {isMyEffectPrompt && ep.type === 'abilityAttach' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'rgba(100,220,150,.85)' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: '#7fffaa', marginBottom: 4 }}>✦ {ep.title || 'Attach Ability'}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>{ep.description}</div>
          <div style={{ fontSize: 11, color: '#7fffaa', opacity: .8, marginBottom: 12 }}>Drag a highlighted Ability from your hand onto the Hero.</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            {ep.canFinish && (
              <button className="btn btn-success" style={{ padding: '6px 16px', fontSize: 11 }}
                onClick={() => respondToPrompt({ finished: true })}>Done</button>
            )}
            <button className="btn" style={{ padding: '6px 16px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)' }}
              onClick={() => respondToPrompt({ cancelled: true })}>Cancel (Esc)</button>
          </div>
        </DraggablePanel>
      )}

      {/* ── Effect Prompt: Deck Search Reveal (opponent sees searched card) ── */}
      {isMyEffectPrompt && ep.type === 'deckSearchReveal' && (() => {
        return (
          <div className="modal-overlay" style={{ zIndex: 10070, background: 'rgba(0,0,0,.55)' }}
            onClick={() => respondToPrompt({ confirmed: true })}>
            <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }} onClick={e => e.stopPropagation()}>
              <div className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', textShadow: '0 2px 8px rgba(0,0,0,.8)' }}>
                {ep.title || 'Card Searched'}
              </div>
              <div style={{
                boxShadow: '0 0 50px rgba(0,0,0,.9), 0 0 100px rgba(255,255,255,.08)',
                borderRadius: 8,
              }}>
                <BoardCard cardName={ep.cardName} style={{ width: 220, height: 308, borderRadius: 8 }} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                {ep.searcherName} searched this card from their deck.
              </div>
              <button className="btn btn-success" style={{ padding: '10px 36px', fontSize: 13 }}
                onClick={() => {
                  respondToPrompt({ confirmed: true });
                }}>
                OK
              </button>
            </div>
          </div>
        );
      })()}

      {/* Rematch first-choice dialog (loser only) — floating panel so hand is visible */}
      {showFirstChoice && !isSpectator && (
        <DraggablePanel className="first-choice-panel animate-in">
          <div className="pixel-font" style={{ fontSize: 14, color: 'var(--accent)', marginBottom: 12 }}>REMATCH!</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>Would you like to go first or second?</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-success" style={{ padding: '12px 28px', fontSize: 13 }}
              onClick={() => { setShowFirstChoice(false); socket.emit('rematch_first_choice', { roomId: gameState.roomId, goFirst: true }); }}>
              GO FIRST
            </button>
            <button className="btn" style={{ padding: '12px 28px', fontSize: 13, borderColor: 'var(--accent)', color: 'var(--accent)' }}
              onClick={() => { setShowFirstChoice(false); socket.emit('rematch_first_choice', { roomId: gameState.roomId, goFirst: false }); }}>
              GO SECOND
            </button>
          </div>
        </DraggablePanel>
      )}

      {/* Spectator: waiting for first-choice decision */}
      {isSpectator && gameState.awaitingFirstChoice && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)', minWidth: 280 }}>
          <div className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', marginBottom: 10 }}>⏳ NEXT ROUND</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>
            {gameState.choosingPlayerName
              ? <><span style={{ color: 'var(--accent2)', fontWeight: 700 }}>{gameState.choosingPlayerName}</span> is deciding who goes first...</>
              : 'Deciding who goes first...'}
          </div>
        </DraggablePanel>
      )}

      {/* Potion/Artifact targeting panel */}
      {!isSpectator && isTargeting && pt && !gameState.effectPrompt && (
        <DraggablePanel className="first-choice-panel" style={{ borderColor: 'var(--danger)', animation: 'fadeIn .2s ease-out' }}>
          <div className="pixel-font" style={{ fontSize: 12, color: pt.config?.greenSelect ? '#33dd55' : 'var(--danger)', marginBottom: 8 }}>{pt.potionName}</div>
          <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14 }}>{pt.config?.description || 'Select targets'}</div>
          {pt.config?.maxTotal > 0 && pt.validTargets?.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 10, fontWeight: 600 }}>
              {potionSelection.length} / {pt.config.maxTotal} selected
              {pt.config.minRequired > 0 && potionSelection.length < pt.config.minRequired
                ? ` (min ${pt.config.minRequired})`
                : ''}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className={'btn ' + (pt.config?.confirmClass || 'btn-success')} style={{ padding: '8px 24px', fontSize: 12 }}
              disabled={!canConfirmPotion}
              onClick={() => { socket.emit('confirm_potion', { roomId: gameState.roomId, selectedIds: potionSelection }); }}>
              {pt.config?.confirmLabel || 'Confirm'}
              {pt.config?.dynamicCostPerTarget > 0 && ` (${pt.config.dynamicCostPerTarget * potionSelection.length} Gold)`}
            </button>
            {pt.config?.cancellable !== false && (
              <button className="btn" style={{ padding: '8px 24px', fontSize: 12 }}
                onClick={() => { socket.emit('cancel_potion', { roomId: gameState.roomId }); setPotionSelection([]); }}>
                Cancel
              </button>
            )}
          </div>
        </DraggablePanel>
      )}

      {/* Mulligan prompt */}
      {!isSpectator && gameState.mulliganPending && !announcement && !mulliganDecided && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)', minWidth: 300 }}>
          <div className="orbit-font" style={{ fontSize: 15, color: 'var(--accent)', marginBottom: 10 }}>MULLIGAN</div>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>Would you like to replace your hand with 5 new cards?</div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn btn-success" style={{ padding: '10px 28px', fontSize: 13 }}
              onClick={() => { setMulliganDecided(true); socket.emit('mulligan_decision', { roomId: gameState.roomId, accept: true }); }}>
              Yes, replace
            </button>
            <button className="btn" style={{ padding: '10px 28px', fontSize: 13, borderColor: 'var(--accent)', color: 'var(--accent)' }}
              onClick={() => { setMulliganDecided(true); socket.emit('mulligan_decision', { roomId: gameState.roomId, accept: false }); }}>
              No, keep
            </button>
          </div>
        </DraggablePanel>
      )}
      {!isSpectator && gameState.mulliganPending && mulliganDecided && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)', minWidth: 240 }}>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Waiting for opponent...</div>
        </DraggablePanel>
      )}
      {/* Spectator: waiting for mulligan */}
      {isSpectator && gameState.mulliganPending && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)', minWidth: 280 }}>
          <div className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', marginBottom: 10 }}>⏳ MULLIGAN</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>Players are deciding to mulligan...</div>
        </DraggablePanel>
      )}

      {/* Game announcements */}
      {announcement && (
        <div className={'game-announcement' + (announcement.short ? ' game-announcement-short' : '')}
          onClick={() => setAnnouncement(null)} style={{ cursor: 'pointer' }}>
          <div className="game-announcement-text" style={{ color: announcement.color }}>
            {announcement.text}
          </div>
        </div>
      )}

      {/* Win/Loss overlay — round result (non-final) */}
      {result && !showFirstChoice && !result.setOver && result.format > 1 && !sideDeckPhase && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,.65)' }}>
          <div className="animate-in" style={{ textAlign: 'center' }}>
            <div className="pixel-font" style={{
              fontSize: 28, marginBottom: 12,
              color: isSpectator ? 'var(--accent)' : (iWon ? 'var(--success)' : 'var(--danger)'),
              textShadow: isSpectator ? '0 0 30px rgba(0,240,255,.3)' : (iWon ? '0 0 30px rgba(51,255,136,.4)' : '0 0 30px rgba(255,51,102,.4)'),
            }}>
              {isSpectator ? `${result.winnerName} wins the round!` : (iWon ? 'ROUND WIN!' : 'ROUND LOSS')}
            </div>
            <div className="orbit-font" style={{ fontSize: 32, marginBottom: 8, color: 'var(--text)' }}>
              {result.setScore[0]} — {result.setScore[1]}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text2)' }}>Next round starting soon...</div>
            {renderSCEarned()}
          </div>
        </div>
      )}

      {/* Set complete overlay — fireworks + final score */}
      {result && !showFirstChoice && result.setOver && result.format > 1 && (
        <div className="modal-overlay set-complete-overlay" style={{ background: 'rgba(0,0,0,.8)' }}>
          <div className="set-fireworks">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="firework-particle" style={{
                '--fw-x': (Math.random() * 200 - 100) + 'px',
                '--fw-y': (Math.random() * -200 - 40) + 'px',
                '--fw-color': ['#ffd700','#ff3366','#33ff88','#44aaff','#ff8800','#cc44ff'][i % 6],
                '--fw-delay': (Math.random() * 2) + 's',
                '--fw-dur': (1 + Math.random()) + 's',
                left: (20 + Math.random() * 60) + '%',
                top: (30 + Math.random() * 30) + '%',
              }} />
            ))}
          </div>
          <div className="animate-in" style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
            <div className="pixel-font" style={{
              fontSize: 40, marginBottom: 8,
              color: isSpectator ? '#ffd700' : (iWon ? '#ffd700' : 'var(--danger)'),
              textShadow: isSpectator ? '0 0 40px rgba(255,215,0,.6)' : (iWon ? '0 0 40px rgba(255,215,0,.6)' : '0 0 40px rgba(255,51,102,.5)'),
            }}>
              {isSpectator ? `🏆 ${result.winnerName} WINS! 🏆` : (iWon ? '🏆 SET VICTORY! 🏆' : 'SET DEFEAT')}
            </div>
            <div className="orbit-font" style={{ fontSize: 48, margin: '16px 0', color: 'var(--text)' }}>
              {result.setScore[0]} — {result.setScore[1]}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>
              Best of {result.format}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
              {result.reason === 'disconnect_timeout' ? `${result.loserName} timed out` :
               result.reason === 'surrender' ? `${result.loserName} surrendered` :
               result.reason === 'all_heroes_dead' ? `All of ${result.loserName}'s heroes defeated!` : ''}
            </div>
            {result.eloChanges && (
              <div style={{ marginBottom: 20 }}>
                {result.eloChanges.map(ec => (
                  <div key={ec.username} style={{ fontSize: 12, color: ec.username === user.username ? 'var(--text)' : 'var(--text2)' }}>
                    {ec.username}: {ec.oldElo} → <span style={{ color: ec.newElo > ec.oldElo ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{ec.newElo}</span>
                    {' '}({ec.newElo > ec.oldElo ? '+' : ''}{ec.newElo - ec.oldElo})
                  </div>
                ))}
              </div>
            )}
            {renderSCEarned()}
            {!isSpectator && decks && decks.length > 0 && (
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text2)' }}>🃏 Deck:</label>
                <select className="select" value={selectedDeck} onChange={e => {
                  const id = e.target.value;
                  setSelectedDeck(id);
                  socket.emit('change_deck', { roomId: gameState.roomId, deckId: id });
                }} style={{ fontSize: 11, minWidth: 160, padding: '4px 8px', borderColor: 'var(--accent)', color: 'var(--text)' }}>
                  {(decks||[]).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  {(sampleDecks||[]).filter(d => isDeckLegal(d).legal).length > 0 && <option disabled>── Sample Decks ──</option>}
                  {(sampleDecks||[]).filter(d => isDeckLegal(d).legal).map(d => <option key={d.id} value={d.id}>📋 {d.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {isSpectator ? (
                <button className="btn btn-danger" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleLeave}>LEAVE</button>
              ) : !oppLeft && !oppDisconnected ? (
                <>
                  <button className="btn btn-success" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleRematch} disabled={myRematchSent}>
                    {myRematchSent ? '⏳ WAITING...' : '🔄 REMATCH'}
                  </button>
                  <button className="btn btn-danger" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleLeave}>LEAVE</button>
                </>
              ) : (
                <button className="btn btn-danger" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleLeave}>LEAVE</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Win/Loss overlay — Bo1 or fallback */}
      {result && !showFirstChoice && (result.setOver || !result.format || result.format === 1) && !(result.format > 1) && (
        <div className="modal-overlay" style={{ background: 'rgba(0,0,0,.75)' }}>
          <div className="animate-in" style={{ textAlign: 'center' }}>
            <div className="pixel-font" style={{
              fontSize: 36, marginBottom: 16,
              color: isSpectator ? '#ffd700' : (iWon ? 'var(--success)' : 'var(--danger)'),
              textShadow: isSpectator ? '0 0 40px rgba(255,215,0,.5)' : (iWon ? '0 0 40px rgba(51,255,136,.5)' : '0 0 40px rgba(255,51,102,.5)'),
            }}>
              {isSpectator ? `🏆 ${result.winnerName} WINS!` : (iWon ? 'YOU WIN!' : 'YOU LOSE')}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
              {isSpectator ? (
                result.reason === 'disconnect_timeout' ? `${result.loserName} timed out` :
                result.reason === 'surrender' ? `${result.loserName} surrendered` :
                result.reason === 'all_heroes_dead' ? `All of ${result.loserName}'s heroes defeated!` : ''
              ) : (
                result.reason === 'disconnect_timeout' ? 'Opponent timed out' :
                result.reason === 'opponent_left' ? 'Opponent left the game' :
                result.reason === 'surrender' ? (iWon ? 'Opponent surrendered' : 'You surrendered') :
                result.reason === 'all_heroes_dead' ? (iWon ? 'All enemy heroes defeated!' : 'All your heroes were defeated') : ''
              )}
            </div>
            {result.eloChanges && (
              <div style={{ marginBottom: 20 }}>
                {result.eloChanges.map(ec => (
                  <div key={ec.username} style={{ fontSize: 12, color: ec.username === user.username ? 'var(--text)' : 'var(--text2)' }}>
                    {ec.username}: {ec.oldElo} → <span style={{ color: ec.newElo > ec.oldElo ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>{ec.newElo}</span>
                    {' '}({ec.newElo > ec.oldElo ? '+' : ''}{ec.newElo - ec.oldElo})
                  </div>
                ))}
              </div>
            )}
            {renderSCEarned()}
            {!isSpectator && decks && decks.length > 0 && (
              <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text2)' }}>🃏 Deck:</label>
                <select className="select" value={selectedDeck} onChange={e => {
                  const id = e.target.value;
                  setSelectedDeck(id);
                  socket.emit('change_deck', { roomId: gameState.roomId, deckId: id });
                }} style={{ fontSize: 11, minWidth: 160, padding: '4px 8px', borderColor: 'var(--accent)', color: 'var(--text)' }}>
                  {(decks||[]).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  {(sampleDecks||[]).filter(d => isDeckLegal(d).legal).length > 0 && <option disabled>── Sample Decks ──</option>}
                  {(sampleDecks||[]).filter(d => isDeckLegal(d).legal).map(d => <option key={d.id} value={d.id}>📋 {d.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {isSpectator ? (
                <button className="btn btn-danger" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleLeave}>LEAVE</button>
              ) : !oppLeft && !oppDisconnected ? (
                <>
                  <button className="btn btn-success" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleRematch} disabled={myRematchSent}>
                    {myRematchSent ? '⏳ WAITING...' : '🔄 REMATCH'}
                  </button>
                  <button className="btn btn-danger" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleLeave}>LEAVE</button>
                </>
              ) : (
                <button className="btn btn-danger" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleLeave}>LEAVE</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════
//  PLAY SCREEN
// ═══════════════════════════════════════════

// ===== CROSS-FILE EXPORTS =====
window.BoardCard = BoardCard;
window.GameBoard = GameBoard;
