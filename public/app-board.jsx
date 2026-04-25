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
let _activeLuckTooltipTarget = null;
let _boardTooltipLocked = false;
// While a card is being dragged, suppress all card-hover tooltips — the
// preview gets in the way of seeing the drop target. Flipped from the
// drag-state effect below and consulted on every setBoardTooltip(...)
// call, so any hover that tries to open a preview mid-drag is ignored.
let _isDraggingCard = false;
function setBoardTooltip(card) {
  // When locked (prompt card hovered), ignore external clears
  if (!card && _boardTooltipLocked) return;
  if (card && _isDraggingCard) return;
  window._boardTooltipSetter?.(card);
}

function BoardCard({ cardName, faceDown, flipped, label, hp, maxHp, atk, hpPosition, style, noTooltip, skins, tooltipCardOverride }) {
  const card = faceDown ? null : CARDS_BY_NAME[cardName];
  const imgUrl = card ? cardImageUrl(card.name, skins) : null;
  // A caller (e.g. Biomancy Token in the puzzle builder) can override what
  // the hover tooltip renders without changing the card image / name by
  // passing `tooltipCardOverride`. Falls back to the canonical card.
  const tooltipTarget = tooltipCardOverride || card;

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
      onMouseEnter={() => !noTooltip && !faceDown && tooltipTarget && setBoardTooltip(tooltipTarget)}
      onMouseLeave={() => setBoardTooltip(null)}
      onTouchStart={() => {
        if (noTooltip || faceDown || !card) return;
        window._longPressFired = false;
        window._longPressTimer = setTimeout(() => {
          window._longPressFired = true;
          setTapTooltip(card.name);
          setBoardTooltip(tooltipTarget || card);
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

function BoardZone({ type, cards, label, faceDown, flipped, stackLabel, children, onClick, onHoverCard, style, className, dataAttrs }) {
  const cls = 'board-zone board-zone-' + type + (className ? ' ' + className : '') + ((cards?.length > 0) ? ' zone-has-card' : '');
  const topCardName = cards && cards.length > 0 && !faceDown ? cards[cards.length - 1] : null;
  const suppressChildTooltip = !!onClick && !!onHoverCard;
  return (
    <div className={cls + (onClick && cards?.length > 0 ? ' board-zone-clickable' : '')}
      style={style}
      {...(dataAttrs || {})}
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
function DamageNumber({ amount, ownerLabel, heroIdx }) {
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
  // Damage absorbed to 0 → render the bare "0" (no minus sign), so
  // the player sees that the hit was absorbed rather than blocked
  // entirely. Anything > 0 keeps the standard `-N` form.
  const label = amount > 0 ? `-${amount}` : '0';
  return (
    <div className="damage-number" style={{ left: pos.x, top: pos.y }}>
      {label}
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
    // Don't start a drag when the pointer-down lands on an interactive
    // form control. `preventDefault()` below would otherwise swallow the
    // native mousedown that opens a <select> dropdown, focuses an <input>,
    // or toggles a checkbox.
    const tag = e.target.tagName;
    if (tag === 'BUTTON' || tag === 'SELECT' || tag === 'OPTION'
        || tag === 'INPUT' || tag === 'TEXTAREA') return;
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

// Acid Rain overlay — continuous blood-red rain covering the board area
// while an Acid Rain Area card is active in either area zone. Sized via
// position:absolute inset:0 so it fills the .board-center container
// without leaking onto the hand / side panels.
// Deepsea Castle area overlay — split into two layers:
//   • DARKNESS: radial gradient at z-index auto, rendered first inside
//     .board-center so it paints before ALL zones/cards (siblings and
//     their descendants later in DOM stack on top). Empty zones have
//     a semi-transparent bg so the darkness shows through; filled
//     zones with opaque card images naturally cover it.
//   • GODRAYS + motes: z-index 1000, rendered as a sibling above every
//     card and zone. Paints red beams on top of the entire battlefield.
//
// Both layers are pointer-events: none so they never steal clicks.
function DeepseaCastleOverlay() {
  const beams = useMemo(() => Array.from({ length: 9 }, () => ({
    left: Math.random() * 100,
    width: 10 + Math.random() * 26,
    skew: -8 + Math.random() * 16,
    delay: -Math.random() * 4,
    dur: 6 + Math.random() * 4,
    opacityPeak: 0.22 + Math.random() * 0.22,
  })), []);
  const motes = useMemo(() => Array.from({ length: 20 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 2.5,
    delay: -Math.random() * 6,
    dur: 4 + Math.random() * 5,
  })), []);
  return (
    <>
      {/* LAYER 1 — DARKNESS (beneath all cards + zones). */}
      <div className="deepsea-castle-darkness" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at center top, rgba(20,0,5,0.35) 0%, rgba(5,0,2,0.55) 70%, rgba(0,0,0,0.6) 100%)',
      }} />
      {/* LAYER 2 — GODRAYS + motes (above all cards + zones). z-index
          1000 wins over zone-has-card (z 10) and any standard board-
          layer stacking, while staying BELOW hand (z 10000) and
          modal/popup overlays (z 90000+) so UI stays usable. */}
      <div className="deepsea-castle-rays" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1000,
        overflow: 'hidden',
      }}>
        {beams.map((b, i) => (
          <span key={'b' + i} style={{
            position: 'absolute',
            left: b.left + '%', top: '-10%',
            width: b.width + 'px', height: '130%',
            transform: 'skewX(' + b.skew + 'deg)',
            transformOrigin: 'top center',
            background: 'linear-gradient(180deg, rgba(255,40,60,' + b.opacityPeak + ') 0%, rgba(180,10,25,' + (b.opacityPeak * 0.7) + ') 40%, rgba(80,0,10,0) 100%)',
            filter: 'blur(6px)',
            mixBlendMode: 'screen',
            animation: 'deepseaCastleBeam ' + b.dur + 's ease-in-out ' + b.delay + 's infinite',
          }} />
        ))}
        {motes.map((m, i) => (
          <span key={'m' + i} style={{
            position: 'absolute',
            left: m.x + '%', top: m.y + '%',
            width: m.size + 'px', height: m.size + 'px',
            borderRadius: '50%',
            background: 'rgba(255,80,100,0.85)',
            boxShadow: '0 0 6px rgba(255,40,60,0.9)',
            animation: 'deepseaCastleMote ' + m.dur + 's ease-in-out ' + m.delay + 's infinite',
          }} />
        ))}
        <style>{`
          @keyframes deepseaCastleBeam {
            0%, 100% { opacity: 0.35; transform: translateX(0) skewX(var(--skew, 0deg)); }
            50%      { opacity: 1;    transform: translateX(6px) skewX(var(--skew, 0deg)); }
          }
          @keyframes deepseaCastleMote {
            0%   { opacity: 0; transform: translateY(0) scale(0.6); }
            25%  { opacity: 0.85; }
            100% { opacity: 0; transform: translateY(-40px) scale(1); }
          }
        `}</style>
      </div>
    </>
  );
}

// Slippery Ice — a translucent frosted sheet pinned UNDER the zones and
// cards (zIndex omitted → default auto, lower than zone-has-card's 10),
// plus a swarm of slow cold-white sparkles that glint across the sheet
// like sun catching ice crystals. The sparkles sit in the same under-
// cards layer so they peek through gaps between zones rather than
// glittering on top of artwork.
function SlipperyIceOverlay() {
  const sparkles = useMemo(() => Array.from({ length: 48 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1.5 + Math.random() * 3,
    delay: -Math.random() * 3.4,
    dur: 1.8 + Math.random() * 2.6,
    // A fraction of sparkles use the 4-pointed "star glint" shape; the
    // rest are round glitter points. The split reads as a mix of "light
    // catching a facet" vs "tiny snow dust".
    star: Math.random() < 0.3,
  })), []);
  const cracks = useMemo(() => Array.from({ length: 8 }, () => ({
    x: Math.random() * 100,
    y: 10 + Math.random() * 80,
    len: 30 + Math.random() * 60,
    rot: -20 + Math.random() * 40,
    opacity: 0.08 + Math.random() * 0.1,
  })), []);
  return (
    <div className="slippery-ice-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      overflow: 'hidden',
      // Pale cyan-tinted frost sheet. The radial gradient fakes a
      // soft "centre of the rink" highlight; the top linear layer adds
      // a faint sky-reflection. mixBlendMode 'screen' keeps it readable
      // over both the light and dark areas of the playmat.
      background:
        'radial-gradient(ellipse at 50% 55%, rgba(220,245,255,0.22) 0%, rgba(180,225,245,0.14) 55%, rgba(120,195,225,0.10) 100%),'
        + 'linear-gradient(180deg, rgba(230,250,255,0.10) 0%, rgba(180,220,240,0.04) 100%)',
      mixBlendMode: 'screen',
    }}>
      {cracks.map((c, i) => (
        <span key={'crack' + i} style={{
          position: 'absolute',
          left: c.x + '%', top: c.y + '%',
          width: c.len + 'px', height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,' + c.opacity + ') 50%, transparent 100%)',
          transform: 'rotate(' + c.rot + 'deg)',
          filter: 'blur(0.4px)',
        }} />
      ))}
      {sparkles.map((s, i) => (
        <span key={'spk' + i} style={{
          position: 'absolute',
          left: s.x + '%', top: s.y + '%',
          width: s.size + 'px', height: s.size + 'px',
          transform: 'translate(-50%, -50%)',
          background: s.star
            ? 'transparent'
            : 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(220,245,255,0.85) 45%, rgba(180,225,245,0) 100%)',
          borderRadius: '50%',
          boxShadow: s.star
            ? ''
            : '0 0 ' + (s.size * 2.5) + 'px rgba(200,240,255,0.9), 0 0 ' + (s.size * 5) + 'px rgba(150,210,240,0.5)',
          animation: 'slipperyIceSparkle ' + s.dur + 's ease-in-out ' + s.delay + 's infinite',
        }}>
          {s.star && (
            <span style={{
              position: 'absolute', inset: 0,
              background:
                'linear-gradient(0deg, transparent 45%, rgba(255,255,255,1) 49%, rgba(255,255,255,1) 51%, transparent 55%),'
                + 'linear-gradient(90deg, transparent 45%, rgba(255,255,255,1) 49%, rgba(255,255,255,1) 51%, transparent 55%)',
              filter: 'blur(0.4px)',
              boxShadow: '0 0 ' + (s.size * 3) + 'px rgba(200,240,255,0.9)',
            }} />
          )}
        </span>
      ))}
      <style>{`
        @keyframes slipperyIceSparkle {
          0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          45%      { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
          55%      { opacity: 1; transform: translate(-50%, -50%) scale(1);    }
          75%      { opacity: 0.25; transform: translate(-50%, -50%) scale(0.85); }
        }
      `}</style>
    </div>
  );
}

// The Cosmic Depths — a black starfield pinned under the zones and
// cards (same z-index convention as Slippery Ice). The dark cosmos
// backdrop is its own layer; the stars render in a SEPARATE layer
// above it with no blend mode so the whites stay bright. (The earlier
// version stacked them in a single `mixBlendMode: multiply` div, which
// multiplied every white star against the background and made the
// twinkle lattice vanish entirely.)
function CosmicDepthsOverlay() {
  const stars = useMemo(() => Array.from({ length: 140 }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
    // Mostly tiny specks; a few bigger to add depth.
    size: 1.2 + Math.pow(Math.random(), 3) * 3.2,
    delay: -Math.random() * 4.2,
    dur: 2.2 + Math.random() * 3.6,
    // A fraction become 4-pointed "sparkle" glints; the rest are round.
    sparkle: Math.random() < 0.35,
  })), []);
  return (
    <div className="cosmic-depths-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {/* Layer 1: deep cosmos gradient. Solid-opaque so the stars read
          on true black; no blend mode (an earlier multiply blend
          zeroed out white stars on top). */}
      <div style={{
        position: 'absolute', inset: 0,
        background:
          'radial-gradient(ellipse at 50% 50%, rgba(22,14,50,0.96) 0%, rgba(8,5,22,0.98) 55%, rgba(0,0,0,1) 100%)',
      }} />
      {/* Layer 2: star field on its own. `mixBlendMode: screen` keeps
          the whites bright even if a future theme tints the layer
          beneath (screen of white + anything = white). */}
      <div style={{
        position: 'absolute', inset: 0,
        mixBlendMode: 'screen',
      }}>
        {stars.map((s, i) => (
          <span key={'star' + i} style={{
            position: 'absolute',
            left: s.x + '%', top: s.y + '%',
            width: s.size + 'px', height: s.size + 'px',
            transform: 'translate(-50%, -50%)',
            background: s.sparkle
              ? 'transparent'
              : 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(230,235,255,0.95) 45%, rgba(200,210,255,0) 100%)',
            borderRadius: '50%',
            boxShadow: s.sparkle
              ? ''
              : '0 0 ' + (s.size * 2.5) + 'px rgba(255,255,255,0.95), 0 0 ' + (s.size * 6) + 'px rgba(180,200,255,0.45)',
            animation: 'cosmicDepthsTwinkle ' + s.dur + 's ease-in-out ' + s.delay + 's infinite',
          }}>
            {s.sparkle && (
              <span style={{
                position: 'absolute', inset: 0,
                background:
                  'linear-gradient(0deg, transparent 44%, rgba(255,255,255,1) 49%, rgba(255,255,255,1) 51%, transparent 56%),'
                  + 'linear-gradient(90deg, transparent 44%, rgba(255,255,255,1) 49%, rgba(255,255,255,1) 51%, transparent 56%)',
                filter: 'blur(0.4px)',
                boxShadow: '0 0 ' + (s.size * 3) + 'px rgba(255,255,255,0.95)',
              }} />
            )}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes cosmicDepthsTwinkle {
          0%, 100% { opacity: 0.2; transform: translate(-50%, -50%) scale(0.7); }
          50%      { opacity: 1;   transform: translate(-50%, -50%) scale(1.2); }
        }
      `}</style>
    </div>
  );
}

// Tarleinn's Floating Island — a wide sky background with a single
// large grass-topped island floating in the middle, cut by a blue
// river that snakes across the grass plateau.
//
// The island silhouette and river path are FIXED (hardcoded points),
// so the artwork never reshuffles — only the cloud layer is animated.
// (Earlier versions seeded a per-play randomised layout, but that
// added complexity for no real benefit; a static, hand-tuned shape
// reads cleaner and lets us focus the eye on the gameplay.)
function FloatingIslandOverlay() {
  // Hardcoded island geometry. Coordinate space is the SVG viewBox
  // 0..100 in both axes; preserveAspectRatio="none" lets it stretch
  // to fill the board-center container.
  const island = {
    cx: 50, cy: 52, rxBase: 34, ryBase: 14,
    // 18 radial samples — top arc tighter (grass plateau), bottom arc
    // jaggier (rocky underside). Picked once and frozen for the
    // life of the game.
    points: [
      { x: 84.0, y: 53.5 }, { x: 80.6, y: 58.4 }, { x: 75.0, y: 63.8 },
      { x: 67.0, y: 67.1 }, { x: 58.5, y: 69.2 }, { x: 50.0, y: 70.0 },
      { x: 41.5, y: 69.5 }, { x: 33.0, y: 67.6 }, { x: 25.0, y: 64.0 },
      { x: 19.4, y: 58.7 }, { x: 16.0, y: 53.6 }, { x: 16.4, y: 49.2 },
      { x: 19.5, y: 45.8 }, { x: 25.5, y: 43.4 }, { x: 34.0, y: 41.9 },
      { x: 50.0, y: 41.0 }, { x: 66.0, y: 41.9 }, { x: 78.0, y: 44.7 },
    ],
  };

  // Fixed river S-curve across the grass surface.
  const river = {
    d: 'M 31 43.0 C 38 41.5, 46 45.5, 50 43.4 C 54 41.3, 62 45.5, 69 43.0',
    width: 2.6,
  };

  // Clouds — 7 of them, evenly distributed across the sky. Each has
  // its own scale / opacity / speed / starting offset, all hardcoded
  // so the layout doesn't reshuffle on re-render. Negative delays
  // stagger them mid-traversal at frame 0.
  const clouds = [
    { y: 10, scale: 1.05, delay:  -6, dur:  90, opacity: 0.78 },
    { y: 18, scale: 0.85, delay: -32, dur: 110, opacity: 0.65 },
    { y: 28, scale: 1.20, delay: -58, dur:  95, opacity: 0.72 },
    { y: 14, scale: 0.70, delay: -82, dur: 120, opacity: 0.55 },
    { y: 24, scale: 0.95, delay: -22, dur: 100, opacity: 0.68 },
    { y: 36, scale: 0.80, delay: -68, dur: 115, opacity: 0.60 },
    { y:  6, scale: 1.10, delay: -45, dur:  85, opacity: 0.74 },
  ];

  // Build the island polygon path — a closed Catmull-Rom-ish smooth via
  // simple Bezier between samples works fine; we use a quadratic-ish
  // smooth by routing through midpoints, which keeps the look soft
  // without introducing self-intersections from sharp jitters.
  const polyPath = useMemo(() => {
    const pts = island.points;
    if (pts.length === 0) return '';
    const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    let d = '';
    const first = mid(pts[pts.length - 1], pts[0]);
    d += `M ${first.x} ${first.y} `;
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i];
      const nxt = pts[(i + 1) % pts.length];
      const m = mid(cur, nxt);
      d += `Q ${cur.x} ${cur.y}, ${m.x} ${m.y} `;
    }
    d += 'Z';
    return d;
  }, [island]);

  return (
    <div className="floating-island-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {/* Layer 1: sky gradient (deep blue at top, lighter near horizon). */}
      <div style={{
        position: 'absolute', inset: 0,
        background:
          'linear-gradient(180deg, rgba(95,165,225,0.55) 0%, rgba(155,205,235,0.45) 55%, rgba(195,225,240,0.40) 100%)',
      }} />
      {/* Layer 2: drifting clouds. Each cloud is a couple of stacked
          ellipses + soft white blur. They animate horizontally on a
          long loop so the sky reads as alive without distracting. */}
      <div style={{ position: 'absolute', inset: 0, mixBlendMode: 'screen' }}>
        {clouds.map((c, i) => (
          <div key={'fic' + i} style={{
            position: 'absolute',
            // `left` is driven entirely by the keyframe animation — it
            // sweeps from -25% (off-screen left) to 125% (off-screen
            // right) of the parent. Each cloud's `delay` is negative
            // so they start mid-traversal at varied points, giving the
            // sky a continuous-flow feel from frame 0.
            top: c.y + '%',
            opacity: c.opacity,
            '--ficScale': c.scale,
            animation: `floatingIslandCloud ${c.dur}s linear ${c.delay}s infinite`,
          }}>
            <div style={{
              position: 'absolute', left: -50, top: -16,
              width: 100, height: 32, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(245,250,255,0.6) 60%, transparent 90%)',
              filter: 'blur(2px)',
            }} />
            <div style={{
              position: 'absolute', left: -25, top: -28,
              width: 60, height: 32, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(245,250,255,0.5) 60%, transparent 90%)',
              filter: 'blur(2px)',
            }} />
            <div style={{
              position: 'absolute', left: 5, top: -22,
              width: 50, height: 26, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(245,250,255,0.55) 60%, transparent 90%)',
              filter: 'blur(2px)',
            }} />
          </div>
        ))}
      </div>
      {/* Layer 3: the island itself, plus the river that runs through
          its grass-top surface. Drawn in one SVG so we can clip the
          river to the island silhouette via a clipPath — no matter how
          the random control points fall, the river never spills off
          the rocky underside. */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          filter: 'drop-shadow(0 6px 14px rgba(20,40,80,0.35))',
        }}
      >
        <defs>
          {/* Grass-to-rock vertical gradient: lush green up top, brown
              dirt mid, deep stone at the underside. */}
          <linearGradient id="floatingIslandBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#5cb85c" />
            <stop offset="22%" stopColor="#3d9a4a" />
            <stop offset="35%" stopColor="#7c5a36" />
            <stop offset="60%" stopColor="#553a22" />
            <stop offset="100%" stopColor="#2c1f12" />
          </linearGradient>
          {/* River gradient: brighter cyan-blue down the middle, deeper
              at the edges, so it reads as flowing water. */}
          <linearGradient id="floatingIslandRiver" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#5fc1ee" />
            <stop offset="50%" stopColor="#2c8dd6" />
            <stop offset="100%" stopColor="#1f6db0" />
          </linearGradient>
          {/* Clip the river to the island so it can't overshoot the
              silhouette regardless of where the random control points
              landed. */}
          <clipPath id="floatingIslandClip">
            <path d={polyPath} />
          </clipPath>
        </defs>
        {/* Island body */}
        <path d={polyPath} fill="url(#floatingIslandBody)" opacity="0.92" />
        {/* Subtle highlight along the grass surface — a thin lighter
            band hugging the top arc of the island. Cheap shading hack:
            a second copy of the path, scaled vertically, with a green
            tint and additive blend. */}
        <path
          d={polyPath}
          fill="rgba(140,210,140,0.45)"
          transform={`translate(0 -${island.ryBase * 0.35}) scale(1 0.32)`}
          style={{ transformOrigin: `${island.cx}% ${island.cy}%` }}
          clipPath="url(#floatingIslandClip)"
          opacity="0.7"
        />
        {/* River — drawn with two stacked strokes for the highlight */}
        <g clipPath="url(#floatingIslandClip)">
          <path d={river.d} stroke="url(#floatingIslandRiver)"
                strokeWidth={river.width} fill="none" strokeLinecap="round" />
          <path d={river.d} stroke="rgba(220,240,255,0.6)"
                strokeWidth={Math.max(0.35, river.width * 0.35)}
                fill="none" strokeLinecap="round"
                style={{ mixBlendMode: 'screen' }} />
        </g>
        {/* A few dangling roots / rocks under the bottom of the island,
            to sell the "floating" silhouette. Hardcoded positions so
            the underside doesn't shift between re-renders. */}
        {[
          { ox: -19.0, len:  6.5, drift:  1.2, w: 0.7 },
          { ox:  -9.5, len:  9.2, drift: -0.8, w: 0.65 },
          { ox:   0.5, len: 11.0, drift:  0.6, w: 0.8 },
          { ox:   9.0, len:  8.0, drift: -1.4, w: 0.6 },
          { ox:  18.0, len:  6.0, drift:  0.9, w: 0.55 },
        ].map((t, i) => (
          <path
            key={'fitend' + i}
            d={`M ${island.cx + t.ox} ${island.cy + island.ryBase * 0.65} q ${t.drift} ${t.len * 0.5}, 0 ${t.len}`}
            stroke="#3a2a18" strokeWidth={t.w}
            fill="none" strokeLinecap="round" opacity="0.85"
          />
        ))}
      </svg>
      <style>{`
        @keyframes floatingIslandCloud {
          0%   { left: -25%; transform: translateY(-50%) scale(var(--ficScale, 1)); }
          100% { left: 125%; transform: translateY(-50%) scale(var(--ficScale, 1)); }
        }
      `}</style>
    </div>
  );
}

// Gathering Storm — dark-red storm clouds drifting across the
// battlefield with red lightning bolts arcing inside and between them.
// Renders while ANY Gathering Storm card is attached in either player's
// support zone (it's an Attachment Spell, not an Area, so we walk
// support zones rather than areaZones).
//
// The overlay is composed of three layers:
//   1. Faint blood-red sky tint over the board so the clouds read as
//      "ominous storm front" rather than just "purple smudges".
//   2. A pool of crimson cloud sprites animating horizontally across
//      the battlefield at varied heights / speeds. Each cloud is a
//      handful of stacked elliptical blurs in deep-red gradients.
//   3. Lightning bursts that fire on randomised intervals — each is an
//      SVG polyline with a couple of branching forks, drawn in bright
//      red with a hot-pink core stroke for the glow.
//
// The lightning timing is driven by a single lightweight effect that
// rotates which "bolt slot" is currently flashing, keeping the React
// state churn cheap regardless of how many bolts the user sees.
function GatheringStormOverlay() {
  // Heavy, fast-moving cloud cover. Bigger sprites, more of them,
  // shorter loop durations — the storm reads as gale-force wind
  // ripping clouds across the battlefield. The slight reverse-flow
  // current (~25% of clouds going against the prevailing wind) adds
  // chaos without breaking the "wind direction" feel.
  const clouds = useMemo(() => Array.from({ length: 22 }, () => ({
    y:        -8 + Math.random() * 116,             // Wider vertical spread
    scale:    1.4 + Math.random() * 1.5,            // Much bigger (was 0.7–1.7)
    delay:    -Math.random() * 14,                  // Spread starts across the cycle
    dur:      8 + Math.random() * 7,                // Way faster (was 24–46s)
    opacity:  0.6 + Math.random() * 0.3,
    // Mostly forward, some against — strong prevailing wind with the
    // occasional updraft cross-current.
    reverse:  Math.random() < 0.25,
  })), []);

  // 6 lightning slots: each slot owns a randomised path; a rotating
  // index makes one slot "hot" at a time, restarting its CSS animation
  // by toggling a `key`. This keeps the lightning visually unpredictable
  // without re-mounting the whole overlay.
  const bolts = useMemo(() => Array.from({ length: 6 }, () => {
    // Bolts typically jag from one cloud strata down to another (not
    // floor-to-ceiling). x1/x2 are within the central battlefield band;
    // y1/y2 keep the bolt within the cloud strata.
    const x1 = 12 + Math.random() * 76;
    const y1 = 8  + Math.random() * 30;
    const x2 = x1 + (-25 + Math.random() * 50);
    const y2 = 35 + Math.random() * 50;
    // 3-segment zig-zag with a random fork off the midpoint.
    const midX = (x1 + x2) / 2 + (-8 + Math.random() * 16);
    const midY = (y1 + y2) / 2 + (-5 + Math.random() * 10);
    const forkX = midX + (-12 + Math.random() * 24);
    const forkY = midY + (4 + Math.random() * 14);
    return {
      main: `M ${x1} ${y1} L ${midX} ${midY} L ${x2} ${y2}`,
      fork: `M ${midX} ${midY} L ${forkX} ${forkY}`,
      // Per-bolt jitter for variety — 0.45–0.85s flash duration.
      dur:  450 + Math.random() * 400,
    };
  }), []);
  const [activeBolt, setActiveBolt] = useState(-1);
  const [boltSerial, setBoltSerial] = useState(0); // re-key trigger
  useEffect(() => {
    let cancelled = false;
    const fire = () => {
      if (cancelled) return;
      const idx = Math.floor(Math.random() * bolts.length);
      setActiveBolt(idx);
      setBoltSerial(s => s + 1);
      // Per-strike audio cue — distant thunder. Volume kept very low
      // so a long Gathering Storm session doesn't overwhelm the rest
      // of the soundscape.
      if (window.playSFX) {
        window.playSFX('elem_lightning', { volume: 0.12, dedupe: 250, category: 'effect' });
      }
      // The selected bolt visually disappears after its CSS animation;
      // schedule the NEXT bolt 400–1100ms later to keep the strikes
      // feeling stochastic.
      const gap = 380 + Math.random() * 750;
      setTimeout(fire, gap);
    };
    const initial = setTimeout(fire, 250 + Math.random() * 600);
    return () => { cancelled = true; clearTimeout(initial); };
  }, [bolts.length]);

  return (
    <div className="gathering-storm-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      overflow: 'hidden',
    }}>
      {/* Layer 1: blood-red atmospheric tint. Soft radial so the
          centre of the battlefield feels "thicker" with storm. */}
      <div style={{
        position: 'absolute', inset: 0,
        background:
          'radial-gradient(ellipse at 50% 50%, rgba(80,8,12,0.32) 0%, rgba(50,4,8,0.22) 55%, rgba(20,2,4,0.18) 100%)',
        mixBlendMode: 'multiply',
      }} />
      {/* Layer 2: drifting crimson cloud sprites. The keyframe drives
          `left` from off-screen left (-25%) to off-screen right (125%)
          so each cloud actually traverses the entire battlefield —
          the previous percentage-based `transform: translate(...)`
          implementation only swept the cloud's own width and parked
          everything near the left edge. */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {clouds.map((c, i) => (
          <div key={'gsc' + i} style={{
            position: 'absolute',
            top: c.y + '%',
            opacity: c.opacity,
            '--gscScale': c.scale,
            animation: `gatheringStormCloud${c.reverse ? 'Rev' : ''} ${c.dur}s linear ${c.delay}s infinite`,
            filter: 'drop-shadow(0 4px 18px rgba(120,12,16,0.5))',
          }}>
            {/* Stacked ellipses make a single cloud sprite. */}
            <div style={{
              position: 'absolute', left: -65, top: -18,
              width: 130, height: 36, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(105,12,18,0.92) 0%, rgba(75,8,14,0.7) 55%, rgba(30,2,6,0) 95%)',
              filter: 'blur(3px)',
            }} />
            <div style={{
              position: 'absolute', left: -32, top: -32,
              width: 78, height: 36, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(125,18,24,0.88) 0%, rgba(85,10,16,0.6) 60%, rgba(30,2,6,0) 95%)',
              filter: 'blur(3px)',
            }} />
            <div style={{
              position: 'absolute', left: 5, top: -26,
              width: 65, height: 30, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(95,10,16,0.85) 0%, rgba(60,6,12,0.55) 60%, rgba(20,1,4,0) 95%)',
              filter: 'blur(3px)',
            }} />
            {/* A crimson "underbelly" smear hints at active rain inside
                the cloud. */}
            <div style={{
              position: 'absolute', left: -45, top: 4,
              width: 95, height: 14, borderRadius: '50%',
              background: 'radial-gradient(ellipse, rgba(60,4,8,0.7) 0%, rgba(30,2,4,0) 80%)',
              filter: 'blur(4px)',
            }} />
          </div>
        ))}
      </div>
      {/* Layer 3: lightning bolts. We render an SVG with all bolts laid
          out, but only the `activeBolt` is visible at any moment via
          opacity. Re-keying the visible <g> on `boltSerial` restarts
          the strike-flash animation. */}
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <defs>
          <filter id="gatheringStormGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>
        {bolts.map((b, i) => activeBolt === i ? (
          <g
            key={'gsb' + i + '-' + boltSerial}
            style={{
              animation: `gatheringStormBolt ${b.dur}ms ease-out forwards`,
            }}
          >
            {/* Outer red glow */}
            <path d={b.main} stroke="#ff1830" strokeWidth="1.4"
                  fill="none" strokeLinecap="round"
                  filter="url(#gatheringStormGlow)" opacity="0.9" />
            <path d={b.fork} stroke="#ff1830" strokeWidth="1.0"
                  fill="none" strokeLinecap="round"
                  filter="url(#gatheringStormGlow)" opacity="0.85" />
            {/* Inner bright core */}
            <path d={b.main} stroke="#ffd0d8" strokeWidth="0.55"
                  fill="none" strokeLinecap="round" />
            <path d={b.fork} stroke="#ffd0d8" strokeWidth="0.4"
                  fill="none" strokeLinecap="round" />
          </g>
        ) : null)}
      </svg>
      <style>{`
        @keyframes gatheringStormCloud {
          0%   { left: -25%;  transform: translateY(-50%) scale(var(--gscScale, 1)); }
          100% { left: 125%;  transform: translateY(-50%) scale(var(--gscScale, 1)); }
        }
        @keyframes gatheringStormCloudRev {
          0%   { left: 125%;  transform: translateY(-50%) scale(var(--gscScale, 1)); }
          100% { left: -25%;  transform: translateY(-50%) scale(var(--gscScale, 1)); }
        }
        @keyframes gatheringStormBolt {
          0%   { opacity: 0; }
          12%  { opacity: 1; }
          25%  { opacity: 0.7; }
          40%  { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// Tempeste rain — permanent rain background painted while at least one
// Prophecy of Tempeste is attached. Stormy slate-blue drops with a brief
// lightning flicker every few seconds. Lighter on the atmospheric tint
// than Acid Rain since Tempeste isn't supposed to be a hostile area
// effect — it's the host's chosen burden, ambient and ominous.
function TempesteRainOverlay() {
  const drops = useMemo(() => Array.from({ length: 130 }, () => ({
    left: Math.random() * 100,
    delay: -Math.random() * 1.4,
    dur: 0.45 + Math.random() * 0.55,
    w: 1 + Math.random() * 1.4,
    h: 16 + Math.random() * 26,
    opacity: 0.4 + Math.random() * 0.5,
  })), []);
  const splashes = useMemo(() => Array.from({ length: 18 }, () => ({
    left: Math.random() * 100,
    top: 60 + Math.random() * 36,
    delay: -Math.random() * 1.4,
    dur: 0.5 + Math.random() * 0.4,
    size: 5 + Math.random() * 9,
  })), []);
  // Sporadic lightning flickers behind the rain — re-keyed via interval.
  const [flickerSerial, setFlickerSerial] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const fire = () => {
      if (cancelled) return;
      setFlickerSerial(s => s + 1);
      setTimeout(fire, 3500 + Math.random() * 4500);
    };
    const initial = setTimeout(fire, 1200 + Math.random() * 2000);
    return () => { cancelled = true; clearTimeout(initial); };
  }, []);
  return (
    <div className="tempeste-rain-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 178,
      overflow: 'hidden',
      background: 'linear-gradient(180deg, rgba(20,30,55,0.18) 0%, rgba(10,20,40,0.30) 100%)',
    }}>
      {/* Background lightning flicker — full-overlay desaturated flash. */}
      <div key={'tflk' + flickerSerial} style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse at 50% 30%, rgba(220,230,255,0.45) 0%, rgba(160,180,220,0.18) 35%, transparent 70%)',
        opacity: 0,
        animation: 'tempesteFlicker 700ms ease-out forwards',
      }} />
      {drops.map((d, i) => (
        <span key={'td'+i} style={{
          position: 'absolute',
          left: d.left + '%', top: '-10%',
          width: d.w + 'px', height: d.h + 'px',
          background: 'linear-gradient(180deg, rgba(80,110,160,0) 0%, rgba(120,150,200,' + d.opacity + ') 30%, rgba(170,200,235,' + d.opacity + ') 70%, rgba(220,235,255,' + d.opacity + ') 100%)',
          boxShadow: '0 0 3px rgba(150,180,220,' + (d.opacity * 0.5) + ')',
          borderRadius: d.w + 'px',
          animation: 'tempesteRainDrop ' + d.dur + 's linear ' + d.delay + 's infinite',
        }} />
      ))}
      {splashes.map((s, i) => (
        <span key={'ts'+i} style={{
          position: 'absolute',
          left: s.left + '%', top: s.top + '%',
          width: s.size + 'px', height: (s.size * 0.45) + 'px',
          border: '1.5px solid rgba(190,215,245,0.7)',
          borderTop: 'transparent',
          borderRadius: '50%',
          animation: 'tempesteRainSplash ' + s.dur + 's ease-out ' + s.delay + 's infinite',
          opacity: 0,
        }} />
      ))}
      <style>{`
        @keyframes tempesteRainDrop {
          0%   { transform: translateY(0) translateX(0); }
          100% { transform: translateY(115vh) translateX(-6px); }
        }
        @keyframes tempesteRainSplash {
          0%   { opacity: 0; transform: scale(0.3); }
          35%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.6); }
        }
        @keyframes tempesteFlicker {
          0%   { opacity: 0; }
          15%  { opacity: 0.85; }
          30%  { opacity: 0.4;  }
          45%  { opacity: 0.95; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function AcidRainOverlay() {
  // Spawn a large pool of drops with staggered delays / durations so the
  // rain reads as "continuous" without any visible reset point.
  const drops = useMemo(() => Array.from({ length: 110 }, () => ({
    left: Math.random() * 100,
    delay: -Math.random() * 1.6,
    dur: 0.55 + Math.random() * 0.55,
    w: 1 + Math.random() * 1.8,
    h: 14 + Math.random() * 28,
    opacity: 0.45 + Math.random() * 0.45,
  })), []);
  const splashes = useMemo(() => Array.from({ length: 14 }, () => ({
    left: Math.random() * 100,
    top: 55 + Math.random() * 40,
    delay: -Math.random() * 1.5,
    dur: 0.5 + Math.random() * 0.4,
    size: 6 + Math.random() * 10,
  })), []);
  return (
    <div className="acid-rain-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 180,
      overflow: 'hidden',
      background: 'radial-gradient(ellipse at center, rgba(80,0,10,0.15) 0%, rgba(20,0,5,0.28) 100%)',
      mixBlendMode: 'normal',
    }}>
      {drops.map((d, i) => (
        <span key={'d'+i} style={{
          position: 'absolute',
          left: d.left + '%', top: '-10%',
          width: d.w + 'px', height: d.h + 'px',
          background: 'linear-gradient(180deg, rgba(180,15,25,0) 0%, rgba(200,30,40,' + d.opacity + ') 30%, rgba(255,60,80,' + d.opacity + ') 70%, rgba(255,120,140,' + d.opacity + ') 100%)',
          boxShadow: '0 0 3px rgba(220,40,50,' + (d.opacity * 0.6) + ')',
          borderRadius: d.w + 'px',
          animation: 'acidRainDrop ' + d.dur + 's linear ' + d.delay + 's infinite',
        }} />
      ))}
      {splashes.map((s, i) => (
        <span key={'s'+i} style={{
          position: 'absolute',
          left: s.left + '%', top: s.top + '%',
          width: s.size + 'px', height: (s.size * 0.45) + 'px',
          border: '1.5px solid rgba(255,70,90,0.75)',
          borderTop: 'transparent',
          borderRadius: '50%',
          animation: 'acidRainSplash ' + s.dur + 's ease-out ' + s.delay + 's infinite',
          opacity: 0,
        }} />
      ))}
      <style>{`
        @keyframes acidRainDrop {
          0%   { transform: translateY(0) translateX(0); }
          100% { transform: translateY(115vh) translateX(-8px); }
        }
        @keyframes acidRainSplash {
          0%   { opacity: 0; transform: scale(0.3); }
          35%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.6); }
        }
      `}</style>
    </div>
  );
}

// Stinky Stables — enormous face-less dung piles pinned to the LEFT/RIGHT
// margins of the battlefield (zones live in the central ~80%). Unicode has
// no face-less poop emoji (💩 always has eyes/mouth), so each pile is drawn
// as stacked SVG swirls with brown radial gradients. Rendered as the first
// sibling inside .board-center with NO explicit z-index — later flex
// siblings (player sides, area zones, cards) therefore paint on top at
// equal-auto stacking. Stink lines drift up from each pile, flies orbit
// them in little elliptical loops, and a few free-fliers cross the air.
function StinkyStablesOverlay() {
  // 4 piles per side, vertically spread. Horizontal jitter stays inside
  // the safe outer-margin strip (≈3–7% on each side) so piles never drift
  // into the zone-filled middle.
  const piles = useMemo(() => {
    const makeSide = (xBase, flip) => Array.from({ length: 4 }, (_, i) => ({
      left: xBase + (Math.random() * 3 - 1.5),
      top: 6 + i * 23 + (Math.random() * 6 - 3),
      size: 80 + Math.random() * 55,
      skew: -8 + Math.random() * 16,
      flipX: flip,
      tint: Math.floor(Math.random() * 3),
    }));
    return [...makeSide(4, 1), ...makeSide(96, -1)];
  }, []);
  // Flies orbiting each pile — per-fly elliptical radii + phase so the
  // swarm doesn't read as marching in lockstep.
  const orbitFlies = useMemo(() => piles.flatMap((p, pi) =>
    Array.from({ length: 3 + Math.floor(Math.random() * 2) }, () => ({
      pileIdx: pi,
      anchorLeft: p.left,
      anchorTop: p.top,
      rx: 18 + Math.random() * 20,
      ry: 10 + Math.random() * 14,
      phase: Math.random(),
      dur: 2.6 + Math.random() * 2.2,
      size: 2.3 + Math.random() * 1.8,
    }))
  ), [piles]);
  // A handful of free flies meander across the battlefield air.
  const freeFlies = useMemo(() => Array.from({ length: 8 }, () => ({
    left: 3 + Math.random() * 94,
    top: 8 + Math.random() * 80,
    delay: -Math.random() * 3.5,
    dur: 3.5 + Math.random() * 2.5,
    size: 2 + Math.random() * 1.4,
  })), []);
  // Two or three wavy smoke trails rising above each pile.
  const stinkLines = useMemo(() => piles.flatMap((p) =>
    Array.from({ length: 2 + Math.floor(Math.random() * 2) }, () => ({
      left: p.left + (Math.random() * 5 - 2.5),
      top: p.top - 3 + (Math.random() * 3 - 1.5),
      delay: -Math.random() * 3,
      dur: 2.8 + Math.random() * 1.6,
      sway: -6 + Math.random() * 12,
    }))
  ), [piles]);
  const tints = [
    { light: '#8a5a2a', mid: '#5a3616', dark: '#321e0a' },
    { light: '#7a4a20', mid: '#4a2a10', dark: '#2a1808' },
    { light: '#94643a', mid: '#624020', dark: '#3a220e' },
  ];
  // Per-fly orbital keyframes — each fly needs its own ellipse. Build the
  // <style> body once via useMemo so it doesn't churn every render.
  const orbitKeyframes = useMemo(() => orbitFlies.map((f, i) =>
    `@keyframes stinkyOrbit${i} {
       0%   { transform: translate(${f.rx.toFixed(1)}px, 0); }
       25%  { transform: translate(0, ${(-f.ry).toFixed(1)}px); }
       50%  { transform: translate(${(-f.rx).toFixed(1)}px, 0); }
       75%  { transform: translate(0, ${f.ry.toFixed(1)}px); }
       100% { transform: translate(${f.rx.toFixed(1)}px, 0); }
     }`
  ).join('\n'), [orbitFlies]);
  return (
    <div className="stinky-stables-overlay" style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      overflow: 'hidden',
      // Mild miasma — kept light so it doesn't fight card readability.
      background: 'radial-gradient(ellipse at center, rgba(70,58,24,0.10) 0%, rgba(40,35,15,0.20) 100%)',
    }}>
      {piles.map((p, i) => {
        const c = tints[p.tint];
        const gid = `stinkyPoo${i}`;
        return (
          <div key={'p' + i} style={{
            position: 'absolute',
            left: p.left + '%', top: p.top + '%',
            width: p.size + 'px', height: p.size + 'px',
            transform: `translate(-50%, -50%) scaleX(${p.flipX}) skewX(${p.skew}deg)`,
            filter: 'drop-shadow(0 6px 8px rgba(0,0,0,0.55))',
          }}>
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <defs>
                <radialGradient id={gid} cx="40%" cy="30%" r="80%">
                  <stop offset="0%" stopColor={c.light} />
                  <stop offset="55%" stopColor={c.mid} />
                  <stop offset="100%" stopColor={c.dark} />
                </radialGradient>
              </defs>
              <ellipse cx="50" cy="94" rx="44" ry="5" fill="rgba(0,0,0,0.45)" />
              <path d="M 8,80 Q 8,60 26,56 Q 50,40 74,56 Q 92,60 92,80 Q 92,93 50,93 Q 8,93 8,80 Z"
                    fill={`url(#${gid})`} />
              <path d="M 22,62 Q 22,44 36,40 Q 50,28 64,40 Q 78,44 78,62 Q 78,73 50,73 Q 22,73 22,62 Z"
                    fill={`url(#${gid})`} />
              <path d="M 36,44 Q 36,28 44,26 Q 50,18 56,26 Q 64,28 64,44 Q 64,54 50,54 Q 36,54 36,44 Z"
                    fill={`url(#${gid})`} />
              <ellipse cx="50" cy="17" rx="3" ry="4.5" fill={c.dark} />
              <ellipse cx="32" cy="66" rx="8" ry="3" fill="rgba(210,170,110,0.32)" />
              <ellipse cx="42" cy="46" rx="6" ry="2.5" fill="rgba(210,170,110,0.32)" />
              <ellipse cx="47" cy="28" rx="3" ry="1.5" fill="rgba(210,170,110,0.38)" />
            </svg>
          </div>
        );
      })}
      {/* Stink lines — wavy green-brown smoke rising above each pile */}
      {stinkLines.map((s, i) => (
        <div key={'s' + i} style={{
          position: 'absolute',
          left: s.left + '%', top: s.top + '%',
          width: 24, height: 70,
          transform: 'translate(-50%, -100%)',
          animation: `stinkyStink ${s.dur}s ease-in-out ${s.delay}s infinite`,
          opacity: 0,
          '--stinkSway': s.sway + 'px',
        }}>
          <svg viewBox="0 0 24 70" width="100%" height="100%" preserveAspectRatio="none">
            <path d="M 12,70 C 18,56 4,44 18,30 C 30,16 6,8 14,0"
                  stroke="rgba(120,150,80,0.75)" strokeWidth="2.2" fill="none"
                  strokeLinecap="round" />
            <path d="M 12,70 C 8,58 20,46 10,34 C 0,22 18,14 12,2"
                  stroke="rgba(100,130,60,0.55)" strokeWidth="1.6" fill="none"
                  strokeLinecap="round" />
          </svg>
        </div>
      ))}
      {/* Orbital flies — anchor wrap + inner transform keeps orbit keyframes
          transform-only while the pile position stays in percent units. */}
      {orbitFlies.map((f, i) => (
        <div key={'of' + i} style={{
          position: 'absolute',
          left: f.anchorLeft + '%', top: f.anchorTop + '%',
          width: 0, height: 0,
        }}>
          <span style={{
            position: 'absolute',
            left: -f.size / 2, top: -f.size / 2,
            width: f.size + 'px', height: f.size + 'px',
            background: '#0a0a0a', borderRadius: '50%',
            boxShadow: '0 0 2px rgba(0,0,0,0.9)',
            animation: `stinkyOrbit${i} ${f.dur}s linear infinite`,
            animationDelay: `-${(f.phase * f.dur).toFixed(2)}s`,
            willChange: 'transform',
          }} />
        </div>
      ))}
      {/* Free-flying flies meandering across the battlefield */}
      {freeFlies.map((f, i) => (
        <span key={'ff' + i} style={{
          position: 'absolute',
          left: f.left + '%', top: f.top + '%',
          width: f.size + 'px', height: f.size + 'px',
          background: '#0a0a0a', borderRadius: '50%',
          boxShadow: '0 0 2px rgba(0,0,0,0.9)',
          animation: `stinkyFlyFree ${f.dur}s ease-in-out ${f.delay}s infinite`,
        }} />
      ))}
      <style>{`
        @keyframes stinkyStink {
          0%   { opacity: 0; transform: translate(-50%, -100%) scale(0.5); }
          25%  { opacity: 0.85; }
          70%  { opacity: 0.45; }
          100% { opacity: 0; transform: translate(calc(-50% + var(--stinkSway, 0px)), -160%) scale(1.1); }
        }
        @keyframes stinkyFlyFree {
          0%   { transform: translate(0, 0); }
          15%  { transform: translate(14px, -8px); }
          30%  { transform: translate(-8px, -18px); }
          50%  { transform: translate(22px, -10px); }
          70%  { transform: translate(6px, -22px); }
          85%  { transform: translate(-14px, -12px); }
          100% { transform: translate(0, 0); }
        }
        ${orbitKeyframes}
      `}</style>
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
// Game tooltip, StatusBadges, BuffColumn — use shared versions from app-shared.jsx
const showGameTooltip = window.showGameTooltip;
const hideGameTooltip = window.hideGameTooltip;
const GameTooltip = window.GameTooltip;
const StatusBadges = window.StatusBadges;
const BuffColumn = window.BuffColumn;
// HeroArtCrop lives in app-screens.jsx (the Singleplayer opponent-picker
// uses it) — borrowed here to render CPU / avatar-less player portraits
// next to the hand in-game using the same cropped hero art.
const HeroArtCrop = window.HeroArtCrop;

// Status badges — small icons showing active negative statuses at a glance
// StatusBadges and BuffColumn — now defined in app-shared.jsx

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

// Cosmic Summon — a black-and-purple portal tears open in the summon
// slot: void expands from the centre, star-sparkles converge inward
// from the rim, a lilac core flashes white, then everything collapses
// back to let the freshly-placed creature render. Pure dark-theme, no
// fire/ice colour families so it reads as "pulled from the depths of
// space" rather than any existing elemental strike.
function CosmicSummonEffect({ x, y }) {
  const sparkles = useMemo(() => Array.from({ length: 18 }, () => {
    const angle = Math.random() * Math.PI * 2;
    // Start somewhere between 70–130px from centre; each sparkle
    // converges all the way to the middle at peak.
    const startDist = 70 + Math.random() * 60;
    return {
      startX: Math.cos(angle) * startDist,
      startY: Math.sin(angle) * startDist,
      size: 4 + Math.random() * 6,
      delay: Math.random() * 220,
      dur: 420 + Math.random() * 260,
    };
  }), []);
  const dust = useMemo(() => Array.from({ length: 12 }, () => {
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + Math.random() * 50;
    return {
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 5,
      color: ['#b488ff','#8a4bff','#d0a8ff','#ffffff','#6a2dcf'][Math.floor(Math.random() * 5)],
      delay: 350 + Math.random() * 150,
      dur: 400 + Math.random() * 300,
    };
  }), []);
  return (
    <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
      {/* Void portal — black core with purple nebula halo. Grows then
          collapses. */}
      <div className="anim-cosmic-void" />
      {/* Ring flash — a quick purple/white halo at peak expansion. */}
      <div className="anim-cosmic-ring" />
      {/* Converging star sparkles: each starts offset, shrinks to centre. */}
      {sparkles.map((s, i) => (
        <div key={'cs' + i} className="anim-cosmic-star" style={{
          '--cstartX': s.startX + 'px', '--cstartY': s.startY + 'px',
          '--csize': s.size + 'px',
          animationDelay: s.delay + 'ms', animationDuration: s.dur + 'ms',
        }} />
      ))}
      {/* Outward dust burst at the peak — uses the shared explosion
          particle keyframes (CSS var-driven). */}
      {dust.map((d, i) => (
        <div key={'cd' + i} className="anim-explosion-particle" style={{
          '--dx': d.dx + 'px', '--dy': d.dy + 'px', '--size': d.size + 'px',
          '--color': d.color,
          animationDelay: d.delay + 'ms', animationDuration: d.dur + 'ms',
        }} />
      ))}
      <style>{`
        @keyframes cosmic-void-pulse {
          0%   { opacity: 0;   transform: translate(-50%, -50%) scale(0.15); }
          35%  { opacity: 0.95; transform: translate(-50%, -50%) scale(1.0); }
          65%  { opacity: 0.85; transform: translate(-50%, -50%) scale(1.15); }
          100% { opacity: 0;   transform: translate(-50%, -50%) scale(0.4); }
        }
        @keyframes cosmic-ring-expand {
          0%   { opacity: 0;   transform: translate(-50%, -50%) scale(0.3); }
          30%  { opacity: 0.9; transform: translate(-50%, -50%) scale(0.95); }
          60%  { opacity: 0.5; transform: translate(-50%, -50%) scale(1.35); }
          100% { opacity: 0;   transform: translate(-50%, -50%) scale(1.75); }
        }
        @keyframes cosmic-star-converge {
          0%   { opacity: 0; transform: translate(calc(-50% + var(--cstartX)), calc(-50% + var(--cstartY))) scale(0.6); }
          25%  { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -50%) scale(0.15); }
        }
        .anim-cosmic-void {
          position: absolute; left: 0; top: 0;
          width: 140px; height: 140px;
          border-radius: 50%;
          background:
            radial-gradient(circle at 50% 50%,
              #000 0%,
              rgba(40, 8, 80, 0.95) 30%,
              rgba(120, 40, 220, 0.55) 60%,
              rgba(80, 24, 180, 0.0) 100%);
          box-shadow:
            0 0 40px rgba(140, 60, 255, 0.75),
            inset 0 0 30px rgba(20, 0, 50, 0.9);
          transform: translate(-50%, -50%) scale(0.1);
          animation: cosmic-void-pulse 900ms ease-out forwards;
          filter: blur(0.5px);
        }
        .anim-cosmic-ring {
          position: absolute; left: 0; top: 0;
          width: 100px; height: 100px;
          border-radius: 50%;
          border: 3px solid rgba(220, 180, 255, 0.9);
          box-shadow:
            0 0 20px rgba(180, 100, 255, 0.9),
            inset 0 0 14px rgba(255, 255, 255, 0.65);
          transform: translate(-50%, -50%) scale(0.3);
          animation: cosmic-ring-expand 700ms ease-out forwards;
          animation-delay: 120ms;
        }
        .anim-cosmic-star {
          position: absolute; left: 0; top: 0;
          width: var(--csize); height: var(--csize);
          border-radius: 50%;
          background: radial-gradient(circle, #fff 0%, rgba(220, 200, 255, 0.95) 45%, rgba(180, 140, 255, 0) 100%);
          box-shadow:
            0 0 10px rgba(255, 255, 255, 0.95),
            0 0 20px rgba(180, 120, 255, 0.75);
          transform: translate(calc(-50% + var(--cstartX)), calc(-50% + var(--cstartY))) scale(0.6);
          animation: cosmic-star-converge ease-in forwards;
        }
      `}</style>
    </div>
  );
}

const ANIM_REGISTRY = {
  explosion: ExplosionEffect,
  cosmic_summon: CosmicSummonEffect,
  creature_death: CreatureDeathEffect,
  freeze: FreezeEffect,
  ice_encase: IceEncaseEffect,
  spider_avalanche: SpiderAvalancheEffect,
  electric_strike: ElectricStrikeEffect,
  flame_strike: FlameStrikeEffect,
  venom_fog: VenomFogEffect,
  poisoned_well: PoisonedWellEffect,
  // ── Steam Dwarfs archetype ───────────────────────────────────────
  // A puff of white/grey steam clouds rising upward. Used as a
  // generic "steam engine fired" feedback — +HP on discard, brewing,
  // engineer activation, miner end-of-turn draw, etc.
  steam_puff: (() => {
    return function SteamPuffEffect({ x, y }) {
      const puffs = useMemo(() => Array.from({ length: 12 }, (_, i) => ({
        startX: -25 + Math.random() * 50,
        startY: 15 + Math.random() * 15,
        dx: -10 + Math.random() * 20,
        dy: -(30 + Math.random() * 40),
        size: 18 + Math.random() * 22,
        delay: i * 45 + Math.random() * 100,
        dur: 700 + Math.random() * 400,
        opacity: 0.55 + Math.random() * 0.35,
        shade: Math.random() < 0.5 ? '#e8e8ec' : '#c8c8d0',
      })), []);
      const sparks = useMemo(() => Array.from({ length: 5 }, () => ({
        dx: -15 + Math.random() * 30,
        dy: -(5 + Math.random() * 20),
        size: 2 + Math.random() * 3,
        delay: Math.random() * 150,
        dur: 400 + Math.random() * 200,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {puffs.map((p, i) => (
            <div key={'sp' + i} style={{
              position: 'absolute',
              left: p.startX + 'px', top: p.startY + 'px',
              width: p.size + 'px', height: p.size + 'px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${p.shade} 0%, ${p.shade}99 45%, transparent 75%)`,
              opacity: 0,
              animation: `steam-puff-rise ${p.dur}ms ease-out ${p.delay}ms forwards`,
              '--stpdx': p.dx + 'px', '--stpdy': p.dy + 'px', '--stpop': p.opacity,
            }} />
          ))}
          {sparks.map((s, i) => (
            <div key={'ss' + i} style={{
              position: 'absolute', left: 0, top: 20,
              width: s.size + 'px', height: s.size + 'px',
              borderRadius: '50%',
              background: '#ffcc44', boxShadow: '0 0 6px #ffaa22',
              opacity: 0,
              animation: `steam-spark-pop ${s.dur}ms ease-out ${s.delay}ms forwards`,
              '--ssdx': s.dx + 'px', '--ssdy': s.dy + 'px',
            }} />
          ))}
          <style>{`
            @keyframes steam-puff-rise {
              0%   { opacity: 0; transform: translate(0, 0) scale(0.4); }
              25%  { opacity: var(--stpop, 0.8); }
              100% { opacity: 0; transform: translate(var(--stpdx), var(--stpdy)) scale(1.8); }
            }
            @keyframes steam-spark-pop {
              0%   { opacity: 0; transform: translate(0, 0) scale(0.4); }
              30%  { opacity: 1; }
              100% { opacity: 0; transform: translate(var(--ssdx), var(--ssdy)) scale(0.6); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  // ── Steam Dwarf Exterminator ─────────────────────────────────────
  // Wide cone of flamethrower fire sweeping from one side across the
  // target, followed by a lingering burst of lingering orange flames.
  // Designed to FEEL different from flame_strike (which is a radial
  // burst) — this one is directional, like a jet of flame.
  flamethrower_douse: (() => {
    return function FlamethrowerDouseEffect({ x, y, w, h }) {
      const cw = w || 100;
      const ch = h || 140;
      // Jet particles — fast-moving, stretched, coming in from the left
      const jet = useMemo(() => Array.from({ length: 26 }, (_, i) => ({
        endX: -cw * 0.2 + Math.random() * cw * 1.4,
        endY: -ch * 0.15 + Math.random() * ch * 0.3,
        size: 14 + Math.random() * 16,
        delay: (i * 18) + Math.random() * 40,
        dur: 280 + Math.random() * 160,
        char: ['🔥', '🔥', '🔥', '💥', '✦'][Math.floor(Math.random() * 5)],
        tilt: -15 + Math.random() * 30,
      })), [cw, ch]);
      // Lingering flames that stick around on the target after the jet hits
      const lingering = useMemo(() => Array.from({ length: 16 }, () => ({
        x: -cw * 0.35 + Math.random() * cw * 0.7,
        y: -ch * 0.35 + Math.random() * ch * 0.7,
        size: 10 + Math.random() * 14,
        delay: 300 + Math.random() * 300,
        dur: 400 + Math.random() * 300,
      })), [cw, ch]);
      // Embers drifting off after the strike
      const embers = useMemo(() => Array.from({ length: 14 }, () => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
        const speed = 30 + Math.random() * 50;
        return {
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 4,
          color: ['#ff3300', '#ff8800', '#ffaa00', '#ffcc33'][Math.floor(Math.random() * 4)],
          delay: 350 + Math.random() * 250,
          dur: 500 + Math.random() * 400,
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Bright initial flash on contact */}
          <div style={{
            position: 'absolute',
            left: -cw * 0.45 + 'px', top: -ch * 0.45 + 'px',
            width: cw * 0.9 + 'px', height: ch * 0.9 + 'px',
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, #fff8dd 0%, #ffaa22 30%, #ff4400aa 60%, transparent 85%)',
            opacity: 0,
            animation: 'flame-douse-flash 360ms ease-out forwards',
          }} />
          {/* Jet streaks — the flamethrower cone */}
          {jet.map((p, i) => (
            <div key={'jt' + i} style={{
              position: 'absolute',
              left: (-cw * 0.7) + 'px',
              top: p.endY + 'px',
              fontSize: p.size + 'px',
              filter: `drop-shadow(0 0 4px #ff6600)`,
              opacity: 0,
              animation: `flame-jet-streak ${p.dur}ms cubic-bezier(0.2, 0.7, 0.4, 1) ${p.delay}ms forwards`,
              '--jtdx': (p.endX + cw * 0.7) + 'px',
              '--jttilt': p.tilt + 'deg',
            }}>{p.char}</div>
          ))}
          {/* Lingering flames on the target zone */}
          {lingering.map((f, i) => (
            <div key={'lf' + i} style={{
              position: 'absolute',
              left: f.x + 'px', top: f.y + 'px',
              fontSize: f.size + 'px',
              filter: 'drop-shadow(0 0 3px #ff4400)',
              opacity: 0,
              animation: `flame-linger ${f.dur}ms ease-out ${f.delay}ms forwards`,
            }}>🔥</div>
          ))}
          {/* Drifting embers */}
          {embers.map((e, i) => (
            <div key={'em' + i} style={{
              position: 'absolute', left: 0, top: 0,
              width: e.size + 'px', height: e.size + 'px',
              borderRadius: '50%',
              background: e.color,
              boxShadow: `0 0 6px ${e.color}`,
              opacity: 0,
              animation: `flame-ember ${e.dur}ms ease-out ${e.delay}ms forwards`,
              '--emdx': e.dx + 'px', '--emdy': e.dy + 'px',
            }} />
          ))}
          <style>{`
            @keyframes flame-douse-flash {
              0%   { opacity: 0;   transform: scale(0.3); }
              30%  { opacity: 0.95; transform: scale(1.1); }
              100% { opacity: 0;   transform: scale(1.4); }
            }
            @keyframes flame-jet-streak {
              0%   { opacity: 0;   transform: translate(0, 0) rotate(0deg) scaleX(0.6); }
              20%  { opacity: 1; }
              100% { opacity: 0;   transform: translate(var(--jtdx), 0) rotate(var(--jttilt)) scaleX(1.4); }
            }
            @keyframes flame-linger {
              0%   { opacity: 0;   transform: scale(0.5) translateY(0); }
              30%  { opacity: 1;   transform: scale(1) translateY(-2px); }
              100% { opacity: 0;   transform: scale(0.7) translateY(-10px); }
            }
            @keyframes flame-ember {
              0%   { opacity: 0;   transform: translate(0, 0) scale(1); }
              20%  { opacity: 1; }
              100% { opacity: 0;   transform: translate(var(--emdx), var(--emdy)) scale(0.3); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  // ── Steam Dwarf Dragon Pilot ─────────────────────────────────────
  // A huge incoming fireball that impacts the target with a radial
  // blast wave and a cloud of smoke. Distinct from flame_strike in
  // that it has a clear "incoming projectile → impact → aftermath"
  // arc, not just a burst.
  fireball: (() => {
    return function FireballEffect({ x, y, w, h }) {
      const cw = w || 100;
      const ch = h || 140;
      // Shockwave rings expanding outward from impact
      const rings = useMemo(() => [0, 1, 2].map(i => ({
        delay: 280 + i * 90,
        dur: 500 + i * 50,
        maxSize: 140 + i * 40,
      })), []);
      // Radial fire shards blasting out from the impact
      const shards = useMemo(() => Array.from({ length: 22 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 40 + Math.random() * 60;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          size: 14 + Math.random() * 14,
          delay: 280 + Math.random() * 120,
          dur: 450 + Math.random() * 250,
          char: ['🔥', '🔥', '💥', '✦'][Math.floor(Math.random() * 4)],
        };
      }), []);
      // Smoke clouds rising from the impact site
      const smoke = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
        dx: -25 + Math.random() * 50,
        dy: -(20 + Math.random() * 35),
        size: 20 + Math.random() * 20,
        delay: 500 + i * 60 + Math.random() * 80,
        dur: 800 + Math.random() * 400,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Incoming fireball streak — comes in from top-left */}
          <div style={{
            position: 'absolute',
            left: '-80px', top: '-80px',
            fontSize: '56px',
            filter: 'drop-shadow(0 0 12px #ff6600) drop-shadow(0 0 24px #ff3300)',
            opacity: 0,
            animation: 'fireball-incoming 280ms ease-in forwards',
          }}>🔥</div>
          {/* Streak trail behind the fireball */}
          <div style={{
            position: 'absolute',
            left: '-60px', top: '-60px',
            width: '120px', height: '10px',
            background: 'linear-gradient(90deg, transparent 0%, #ff440088 40%, #ffaa22 100%)',
            borderRadius: '5px',
            transformOrigin: '100% 50%',
            transform: 'rotate(45deg)',
            opacity: 0,
            animation: 'fireball-trail 280ms ease-in forwards',
          }} />
          {/* Impact flash — massive bright pulse */}
          <div style={{
            position: 'absolute',
            left: (-cw * 0.6) + 'px', top: (-ch * 0.6) + 'px',
            width: cw * 1.2 + 'px', height: ch * 1.2 + 'px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, #ffffee 0%, #ffcc22 20%, #ff4400cc 50%, #ff220055 75%, transparent 90%)',
            opacity: 0,
            animation: 'fireball-flash 600ms ease-out 280ms forwards',
          }} />
          {/* Shockwave rings */}
          {rings.map((r, i) => (
            <div key={'rg' + i} style={{
              position: 'absolute',
              left: '0px', top: '0px',
              width: '8px', height: '8px',
              marginLeft: '-4px', marginTop: '-4px',
              borderRadius: '50%',
              border: '3px solid #ff6600',
              boxShadow: '0 0 12px #ff4400',
              opacity: 0,
              animation: `fireball-ring ${r.dur}ms ease-out ${r.delay}ms forwards`,
              '--ringSize': r.maxSize + 'px',
            }} />
          ))}
          {/* Radial fire shards */}
          {shards.map((s, i) => (
            <div key={'fs' + i} style={{
              position: 'absolute', left: 0, top: 0,
              fontSize: s.size + 'px',
              filter: 'drop-shadow(0 0 4px #ff4400)',
              opacity: 0,
              animation: `fireball-shard ${s.dur}ms ease-out ${s.delay}ms forwards`,
              '--fsdx': s.dx + 'px', '--fsdy': s.dy + 'px',
            }}>{s.char}</div>
          ))}
          {/* Rising smoke */}
          {smoke.map((sm, i) => (
            <div key={'sm' + i} style={{
              position: 'absolute', left: 0, top: 0,
              width: sm.size + 'px', height: sm.size + 'px',
              marginLeft: -sm.size / 2 + 'px', marginTop: -sm.size / 2 + 'px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #55555599 0%, #33333366 50%, transparent 80%)',
              opacity: 0,
              animation: `fireball-smoke ${sm.dur}ms ease-out ${sm.delay}ms forwards`,
              '--smdx': sm.dx + 'px', '--smdy': sm.dy + 'px',
            }} />
          ))}
          <style>{`
            @keyframes fireball-incoming {
              0%   { opacity: 0; transform: translate(0, 0) scale(0.4); }
              30%  { opacity: 1; }
              100% { opacity: 1; transform: translate(80px, 80px) scale(1.6); }
            }
            @keyframes fireball-trail {
              0%   { opacity: 0; transform: rotate(45deg) scaleX(0.3); }
              50%  { opacity: 0.9; transform: rotate(45deg) scaleX(1); }
              100% { opacity: 0; transform: rotate(45deg) scaleX(0.6); }
            }
            @keyframes fireball-flash {
              0%   { opacity: 0; transform: scale(0.2); }
              20%  { opacity: 1; transform: scale(1); }
              60%  { opacity: 0.7; transform: scale(1.15); }
              100% { opacity: 0; transform: scale(1.3); }
            }
            @keyframes fireball-ring {
              0%   { opacity: 0; transform: scale(0.2); }
              30%  { opacity: 0.8; }
              100% { opacity: 0; width: var(--ringSize); height: var(--ringSize); margin-left: calc(var(--ringSize) / -2); margin-top: calc(var(--ringSize) / -2); }
            }
            @keyframes fireball-shard {
              0%   { opacity: 0; transform: translate(0, 0) scale(0.4); }
              25%  { opacity: 1; }
              100% { opacity: 0; transform: translate(var(--fsdx), var(--fsdy)) scale(0.7); }
            }
            @keyframes fireball-smoke {
              0%   { opacity: 0; transform: translate(0, 0) scale(0.5); }
              30%  { opacity: 0.7; }
              100% { opacity: 0; transform: translate(var(--smdx), var(--smdy)) scale(1.5); }
            }
          `}</style>
        </div>
      );
    };
  })(),
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
  druid_leaf_storm: (() => {
    return function DruidLeafStormEffect({ x, y }) {
      // Leaves spawn at (0,0) and fan outwards in all directions — each one
      // picks a random angle (not evenly spaced, so the burst feels chaotic
      // rather than geometric) and a random distance. Rotation spins during
      // flight for the "wind-blown" feel.
      const leaves = useMemo(() => Array.from({ length: 36 }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 70 + Math.random() * 90;
        const spin = (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 540);
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist * 0.75, // slight vertical squash — airflow shape
          spin,
          delay: Math.random() * 220,
          dur: 750 + Math.random() * 500,
          emoji: ['🌿', '🌱', '☘️', '🍃', '🌾', '🍀'][Math.floor(Math.random() * 6)],
          size: 14 + Math.random() * 14,
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {leaves.map((l, i) => (
            <span key={i} className="anim-druid-leaf" style={{
              '--ldx': l.dx + 'px', '--ldy': l.dy + 'px', '--lspin': l.spin + 'deg',
              fontSize: l.size + 'px',
              animationDelay: l.delay + 'ms', animationDuration: l.dur + 'ms',
            }}>{l.emoji}</span>
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
  // Critical Slash — Critical Strike's signature. Two huge diagonal
  // slashes (NE↘SW and NW↘SE) cross-cut the target in quick succession
  // with a bright white glint at the intersection, a gold-red
  // "CRITICAL!" text pulse, shockwave ring, and scattering sparks.
  // Everything front-loads so the hit feels instantaneous and heavy.
  critical_slash: (() => {
    return function CriticalSlashEffect({ x, y, w, h }) {
      const ww = Math.max(w || 80, 80);
      const hh = Math.max(h || 110, 110);
      const len = Math.hypot(ww, hh) * 2.1;
      const sparks = useMemo(() => Array.from({ length: 24 }, () => ({
        angle: Math.random() * 360,
        dist: 50 + Math.random() * 120,
        delay: 120 + Math.random() * 180,
        dur: 400 + Math.random() * 260,
        size: 3 + Math.random() * 6,
        gold: Math.random() < 0.55,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10120 }}>
          {/* Bright radial shockwave pulse behind the cuts */}
          <div style={{
            position: 'absolute', left: -80, top: -80, width: 160, height: 160,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,240,.9) 0%, rgba(255,200,60,.55) 35%, rgba(220,40,40,.35) 65%, transparent 85%)',
            boxShadow: '0 0 45px rgba(255,220,100,.9), 0 0 90px rgba(255,80,40,.55)',
            animation: 'criticalShockwave 480ms ease-out forwards',
            opacity: 0,
          }} />
          {/* First slash — NE → SW, rotated -35deg */}
          <div style={{
            position: 'absolute', left: -len / 2, top: -4,
            width: len, height: 8,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,240,.15) 10%, rgba(255,230,110,.95) 44%, rgba(255,255,255,1) 50%, rgba(255,200,60,.95) 56%, rgba(255,120,60,.5) 85%, transparent 100%)',
            boxShadow: '0 0 18px rgba(255,230,120,.95), 0 0 34px rgba(255,80,40,.75)',
            transform: 'rotate(-35deg) translateX(-130%)',
            transformOrigin: 'center center',
            animation: 'criticalSlashA 220ms cubic-bezier(0.15, 0.95, 0.25, 1) forwards',
            opacity: 0,
          }} />
          {/* Second slash — NW → SE, rotated +35deg, staggered */}
          <div style={{
            position: 'absolute', left: -len / 2, top: -4,
            width: len, height: 8,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,240,.15) 10%, rgba(255,230,110,.95) 44%, rgba(255,255,255,1) 50%, rgba(255,200,60,.95) 56%, rgba(255,120,60,.5) 85%, transparent 100%)',
            boxShadow: '0 0 18px rgba(255,230,120,.95), 0 0 34px rgba(255,80,40,.75)',
            transform: 'rotate(35deg) translateX(-130%)',
            transformOrigin: 'center center',
            animation: 'criticalSlashB 220ms cubic-bezier(0.15, 0.95, 0.25, 1) 110ms forwards',
            opacity: 0,
          }} />
          {/* Intersection glint — giant white burst at the crossing */}
          <div style={{
            position: 'absolute', left: -30, top: -30, width: 60, height: 60,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,240,180,.85) 45%, transparent 80%)',
            boxShadow: '0 0 50px rgba(255,255,220,1), 0 0 90px rgba(255,190,80,.7)',
            animation: 'criticalGlint 360ms ease-out 180ms forwards',
            opacity: 0,
          }} />
          {/* "CRITICAL!" text pulse — punchy gold-red */}
          <div style={{
            position: 'absolute', left: -90, top: -56, width: 180,
            textAlign: 'center',
            fontFamily: '"Orbitron", "Rajdhani", sans-serif',
            fontSize: 28, fontWeight: 900, letterSpacing: '2px',
            color: '#fff7c0',
            textShadow: '0 0 8px rgba(255,60,20,.95), 0 0 18px rgba(255,120,40,.85), 2px 2px 0 #6b0010, -2px 2px 0 #6b0010, 2px -2px 0 #6b0010, -2px -2px 0 #6b0010',
            animation: 'criticalText 620ms cubic-bezier(0.2, 1.4, 0.4, 1) 180ms forwards',
            opacity: 0,
            transform: 'scale(0.3)',
            pointerEvents: 'none',
          }}>CRITICAL!</div>
          {/* Spark fan radiating out of the impact */}
          {sparks.map((s, i) => (
            <div key={'cs'+i} style={{
              position: 'absolute', left: 0, top: 0,
              width: s.size, height: s.size, borderRadius: '50%',
              background: s.gold ? '#ffe066' : '#ff4830',
              boxShadow: `0 0 ${s.size * 2}px ${s.gold ? 'rgba(255,220,100,.9)' : 'rgba(255,80,40,.9)'}`,
              animation: `criticalSpark ${s.dur}ms ease-out ${s.delay}ms forwards`,
              opacity: 0,
              '--csAngle': s.angle + 'deg',
              '--csDist': s.dist + 'px',
            }} />
          ))}
        </div>
      );
    };
  })(),

  // Siphem orbital laser — a tall red beam lances down from the top
  // of the viewport onto the target slot. Charge-up dot appears above,
  // the beam drops through with an explosion at the impact point, and
  // a crimson impact shockwave flashes out. Paired with Siphem's
  // Deepsea-Counter damage so the kill feels orbital-strike serious.
  orbital_laser_red: (() => {
    return function OrbitalLaserRedEffect({ x, y }) {
      // Beam travels from the viewport's top edge down to the target.
      const beamHeight = Math.max(y + 40, 180);
      const sparks = useMemo(() => Array.from({ length: 14 }, () => ({
        angle: Math.random() * 360,
        dist: 40 + Math.random() * 80,
        delay: 260 + Math.random() * 140,
        dur: 420 + Math.random() * 240,
        size: 3 + Math.random() * 5,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Charge-up pulse dot at the top of the screen, above the target */}
          <div style={{
            position: 'fixed', left: x - 18, top: 6, width: 36, height: 36,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 40% 40%, #ffd0d0 0%, #ff2a3e 50%, #6e0008 100%)',
            boxShadow: '0 0 24px rgba(255,50,70,.95), 0 0 44px rgba(200,0,30,.7)',
            animation: 'orbitalLaserCharge 260ms ease-out forwards',
            opacity: 0,
          }} />
          {/* Main beam — narrow bright core + wider red halo. Anchored
              at the viewport top (fixed positioning ignores local y). */}
          <div style={{
            position: 'fixed', left: x - 5, top: 20,
            width: 10, height: beamHeight - 20,
            background: 'linear-gradient(to bottom, rgba(255,180,190,.9), rgba(220,30,50,.95) 35%, rgba(140,0,20,.8))',
            boxShadow: '0 0 12px rgba(255,60,80,.85), 0 0 28px rgba(200,0,30,.7)',
            transformOrigin: 'center top',
            animation: 'orbitalLaserBeam 520ms cubic-bezier(0.4, 0, 0.2, 1) 260ms forwards',
            opacity: 0,
          }} />
          <div style={{
            position: 'fixed', left: x - 22, top: 20,
            width: 44, height: beamHeight - 20,
            background: 'linear-gradient(to bottom, rgba(255,80,100,.5), rgba(180,0,20,.55) 40%, rgba(100,0,10,.35))',
            filter: 'blur(2px)',
            transformOrigin: 'center top',
            animation: 'orbitalLaserBeam 520ms cubic-bezier(0.4, 0, 0.2, 1) 260ms forwards',
            opacity: 0,
          }} />
          {/* Impact flash at the target — bright white-red burst */}
          <div style={{
            position: 'absolute', left: -55, top: -55, width: 110, height: 110,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,.95) 0%, rgba(255,80,100,.85) 30%, rgba(180,0,20,.5) 60%, transparent 85%)',
            boxShadow: '0 0 40px rgba(255,60,80,.9), 0 0 80px rgba(200,0,30,.7)',
            animation: 'orbitalLaserImpact 580ms ease-out 540ms forwards',
            opacity: 0,
          }} />
          {/* Ember sparks radiating from impact */}
          {sparks.map((s, i) => (
            <div key={'ol'+i} style={{
              position: 'absolute', left: 0, top: 0,
              width: s.size, height: s.size, borderRadius: '50%',
              background: i % 3 === 0 ? '#ffdfe4' : '#ff2a3e',
              boxShadow: `0 0 ${s.size * 2}px rgba(255,60,80,.85)`,
              animation: `orbitalLaserSpark ${s.dur}ms ease-out ${s.delay}ms forwards`,
              opacity: 0,
              '--olAngle': s.angle + 'deg',
              '--olDist': s.dist + 'px',
            }} />
          ))}
        </div>
      );
    };
  })(),

  // Blood Moon pulse — Blood Moon under the Sea re-trigger signature.
  // Crimson moonlight bathes the slot: a large blood-red moon appears
  // above the card with dark halo rings, beams of red light lance
  // downward, and a sheet of red droplets drips past the card. Fires on
  // BOTH the Blood Moon's slot and the creature whose on-summon is
  // being re-triggered so the link between them reads instantly.
  blood_moon_pulse: (() => {
    return function BloodMoonPulseEffect({ x, y, w, h }) {
      const drops = useMemo(() => Array.from({ length: 14 }, () => ({
        xOff: -30 + Math.random() * 60,
        startY: -30 + Math.random() * 10,
        endY: 70 + Math.random() * 30,
        delay: 120 + Math.random() * 320,
        dur: 650 + Math.random() * 300,
        size: 3 + Math.random() * 4,
      })), []);
      const rays = useMemo(() => Array.from({ length: 7 }, (_, i) => ({
        angle: -45 + i * 15 + (Math.random() * 6 - 3),
        len: 70 + Math.random() * 30,
        delay: Math.random() * 150,
        dur: 700 + Math.random() * 250,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Dark red halo behind the card */}
          <div style={{
            position: 'absolute', left: -55, top: -55, width: 110, height: 110,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(160,10,20,.55) 0%, rgba(80,0,10,.35) 40%, transparent 80%)',
            boxShadow: '0 0 22px rgba(200,20,40,.75), inset 0 0 14px rgba(120,0,20,.55)',
            animation: 'bloodMoonHalo 1100ms ease-out forwards',
            opacity: 0,
          }} />
          {/* Blood moon orb drifting in above */}
          <div style={{
            position: 'absolute', left: -18, top: -74, width: 36, height: 36,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 30%, #c42a3a, #7a0010 55%, #3a0008 100%)',
            boxShadow: '0 0 22px rgba(220,30,50,.85), 0 0 36px rgba(140,0,20,.6)',
            animation: 'bloodMoonOrb 1000ms ease-out forwards',
            opacity: 0,
          }} />
          {/* Moonlight rays lancing downward */}
          {rays.map((r, i) => (
            <div key={'bmr'+i} style={{
              position: 'absolute', left: 0, top: -58,
              width: 3, height: r.len,
              background: 'linear-gradient(to bottom, rgba(220,40,60,.9), rgba(140,0,20,.5) 60%, transparent)',
              borderRadius: 3,
              transform: `rotate(${r.angle}deg) scaleY(0)`,
              transformOrigin: 'center top',
              animation: `bloodMoonRay ${r.dur}ms ease-out ${r.delay}ms forwards`,
              boxShadow: '0 0 6px rgba(220,40,60,.75)',
            }} />
          ))}
          {/* Red droplets trickling down past the card */}
          {drops.map((d, i) => (
            <div key={'bmd'+i} style={{
              position: 'absolute', left: d.xOff, top: d.startY,
              width: d.size, height: d.size * 1.4, borderRadius: '50% 50% 50% 50% / 40% 40% 60% 60%',
              background: 'radial-gradient(circle at 40% 30%, #ff3048, #8a0010)',
              boxShadow: '0 0 5px rgba(200,20,40,.8)',
              animation: `bloodMoonDrop ${d.dur}ms ease-in ${d.delay}ms forwards`,
              opacity: 0,
              '--bmEndY': d.endY + 'px',
            }} />
          ))}
        </div>
      );
    };
  })(),
  // Deepsea Spores rain — full-board particle shower in the archetype
  // palette (teal, blue, dark-blue, red, dark-red). Spores drift in
  // serpentine paths from the top of the viewport down through the
  // entire play area. Paired with `deepsea_spores_growth` per creature.
  deepsea_spores_rain: (() => {
    return function DeepseaSporesRainEffect({ x, y, w, h }) {
      const W = Math.max(w || window.innerWidth, 480);
      const H = Math.max(h || window.innerHeight, 320);
      const palette = ['#6adbc4', '#3a86d9', '#1a3ea8', '#c42842', '#6a0e1c'];
      const spores = useMemo(() => Array.from({ length: 180 }, () => ({
        xStart: Math.random() * W - W / 2,
        yStart: -H / 2 - 40,
        xEnd:   (-60 + Math.random() * 120),
        yEnd:   H / 2 + 40,
        wobble: (-30 + Math.random() * 60),
        delay:  Math.random() * 1400,
        dur:    1300 + Math.random() * 700,
        size:   3 + Math.random() * 7,
        color:  palette[Math.floor(Math.random() * palette.length)],
        opacity: 0.55 + Math.random() * 0.4,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10090 }}>
          {/* Ambient ominous red wash over the whole play area */}
          <div style={{
            position: 'absolute', left: -W / 2, top: -H / 2, width: W, height: H,
            background: 'radial-gradient(ellipse at center, rgba(140,0,10,.12) 0%, rgba(30,10,50,.05) 55%, transparent 85%)',
            animation: 'deepseaSporesWash 2400ms ease-in-out forwards',
            opacity: 0,
          }} />
          {spores.map((s, i) => (
            <div key={'ds'+i} style={{
              position: 'absolute', left: s.xStart, top: s.yStart,
              width: s.size, height: s.size, borderRadius: '50%',
              background: `radial-gradient(circle at 35% 35%, ${s.color}, ${s.color}80 55%, transparent 80%)`,
              boxShadow: `0 0 ${s.size * 1.5}px ${s.color}`,
              animation: `deepseaSporeFall ${s.dur}ms linear ${s.delay}ms forwards`,
              opacity: 0,
              '--dsEndX': s.xEnd + 'px',
              '--dsEndY': s.yEnd + 'px',
              '--dsWobble': s.wobble + 'px',
              '--dsOpacity': s.opacity,
            }} />
          ))}
        </div>
      );
    };
  })(),

  // Per-creature algae / anemone growth on Spores activation. Tendrils
  // sprout from the creature's slot, along with an ominous red pulse
  // and a few drifting spores that hang in place. Meant to be fired
  // via `playAnimation('deepsea_spores_growth', supportSlotSelector)`.
  deepsea_spores_growth: (() => {
    return function DeepseaSporesGrowthEffect({ x, y }) {
      const tendrils = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
        angle: -70 + (i * 20) + (Math.random() * 10 - 5),
        len:   28 + Math.random() * 18,
        delay: Math.random() * 200,
        dur:   800 + Math.random() * 300,
        width: 2.5 + Math.random() * 2,
        shade: (i % 3 === 0) ? '#8b1025' : (i % 3 === 1 ? '#5a9a7a' : '#1e4a8a'),
      })), []);
      const fronds = useMemo(() => Array.from({ length: 5 }, () => ({
        xOff: -18 + Math.random() * 36,
        delay: 150 + Math.random() * 250,
        dur: 700 + Math.random() * 200,
        size: 10 + Math.random() * 8,
        emoji: Math.random() < 0.5 ? '🌿' : '🪸',
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10110 }}>
          {/* Ominous red pulse covering the creature card */}
          <div style={{
            position: 'absolute', left: -35, top: -48, width: 70, height: 96,
            background: 'radial-gradient(ellipse at center, rgba(200,20,40,.55) 0%, rgba(120,0,20,.3) 55%, transparent 85%)',
            boxShadow: '0 0 18px rgba(180,20,40,.7), inset 0 0 12px rgba(100,0,20,.5)',
            borderRadius: 6,
            animation: 'deepseaSporeRedPulse 1600ms ease-out forwards',
            opacity: 0,
          }} />
          {/* Tendril bases — thin curved lines growing outward */}
          {tendrils.map((t, i) => (
            <div key={'dt'+i} style={{
              position: 'absolute', left: 0, top: 20,
              width: t.width, height: t.len,
              background: `linear-gradient(to top, ${t.shade}, ${t.shade}aa 60%, ${t.shade}44 100%)`,
              borderRadius: t.width,
              boxShadow: `0 0 6px ${t.shade}aa`,
              transform: `rotate(${t.angle}deg) scaleY(0)`,
              transformOrigin: 'center bottom',
              animation: `deepseaTendrilGrow ${t.dur}ms cubic-bezier(0.3, 1.4, 0.5, 1) ${t.delay}ms forwards`,
            }} />
          ))}
          {/* Fronds (algae / coral emoji) popping out at the tendril tips */}
          {fronds.map((f, i) => (
            <div key={'df'+i} style={{
              position: 'absolute', left: f.xOff, top: -8,
              fontSize: f.size,
              filter: 'drop-shadow(0 0 4px rgba(140,0,30,.8))',
              animation: `deepseaFrondPop ${f.dur}ms ease-out ${f.delay}ms forwards`,
              opacity: 0,
            }}>{f.emoji}</div>
          ))}
        </div>
      );
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
  // Claw maul — Deepsea Werewolf's damage signature. Four diagonal
  // gashes rake across the target in a tight cluster, each with its
  // own crimson wound trailing behind; a burst of red-black gore
  // splatter drops beneath the cuts.
  claw_maul: (() => {
    return function ClawMaulEffect({ x, y, w, h }) {
      const ww = Math.max(w || 80, 80);
      const hh = Math.max(h || 110, 110);
      const len = Math.hypot(ww, hh) * 1.55;
      // Four claw lines — three main gashes + one accent, each offset
      // so they form a rake pattern rather than stacking on top.
      const gashes = useMemo(() => [
        { offY: -18, delay:   0, scale: 1.0, thick: 3.5 },
        { offY:  -6, delay:  60, scale: 1.0, thick: 3.0 },
        { offY:   6, delay:  30, scale: 1.05, thick: 3.5 },
        { offY:  18, delay:  90, scale: 0.95, thick: 2.5 },
      ], []);
      const gore = useMemo(() => Array.from({ length: 16 }, () => ({
        dx: -30 + Math.random() * 60,
        dy: 8 + Math.random() * 55,
        delay: 180 + Math.random() * 220,
        dur: 420 + Math.random() * 220,
        size: 3 + Math.random() * 5,
        shade: Math.random() < 0.7 ? '#a00010' : '#550008',
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Background rage haze */}
          <div className="anim-flame-flash" style={{
            width: 110, height: 110, marginLeft: -55, marginTop: -55,
            background: 'radial-gradient(circle, rgba(180,0,0,.45) 0%, rgba(100,0,0,.2) 40%, transparent 75%)',
            animationDuration: '500ms',
          }} />
          {gashes.map((g, i) => (
            <React.Fragment key={'cm'+i}>
              {/* Steel-white claw streak */}
              <div style={{
                position: 'absolute', left: -len / 2, top: g.offY - 2,
                width: len, height: g.thick,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,240,230,.1) 20%, rgba(255,245,240,.95) 48%, rgba(255,255,255,1) 52%, rgba(255,220,210,.7) 70%, transparent 100%)',
                boxShadow: '0 0 8px rgba(255,220,210,.85), 0 0 14px rgba(200,60,60,.55)',
                transform: `rotate(-32deg) scale(${g.scale}) translateX(-120%)`,
                transformOrigin: 'center center',
                animation: `clawSlash 380ms cubic-bezier(0.2, 0.9, 0.3, 1) ${g.delay}ms forwards`,
                opacity: 0,
              }} />
              {/* Crimson wound lingering along the cut path */}
              <div style={{
                position: 'absolute', left: -ww * 0.55, top: g.offY - 1.5,
                width: ww * 1.1, height: g.thick + 1,
                background: 'linear-gradient(90deg, transparent 0%, rgba(140,0,8,.7) 18%, rgba(200,25,30,.95) 50%, rgba(140,0,8,.7) 82%, transparent 100%)',
                boxShadow: '0 0 9px rgba(170,15,20,.85)',
                transform: `rotate(-32deg) scale(${g.scale})`,
                transformOrigin: 'center center',
                animation: `clawWound 580ms ease-out ${g.delay + 160}ms forwards`,
                opacity: 0,
              }} />
            </React.Fragment>
          ))}
          {/* Gore splatter beneath the gashes */}
          {gore.map((d, i) => (
            <div key={'cd'+i} style={{
              position: 'absolute', left: d.dx, top: -4,
              width: d.size, height: d.size, borderRadius: '50%',
              background: d.shade,
              boxShadow: `0 0 4px rgba(120,0,10,.8)`,
              animation: `clawGore ${d.dur}ms ease-in ${d.delay}ms forwards`,
              opacity: 0,
              '--cmGy': d.dy + 'px',
            }} />
          ))}
        </div>
      );
    };
  })(),
  // Scythe cut — Deepsea Reaper's creature-defeat signature. A dark
  // steel blade streaks diagonally across the Creature slot, a bright
  // white glint flashes on impact, and a crimson slash wound lingers
  // briefly in the cut's wake. Tuned to ~700ms so the cut resolves
  // before destruction fires.
  scythe_cut: (() => {
    return function ScytheCutEffect({ x, y, w, h }) {
      const ww = Math.max(w || 80, 80);
      const hh = Math.max(h || 110, 110);
      // Diagonal cut: upper-right to lower-left.
      const len = Math.hypot(ww, hh) * 1.6;
      const drops = useMemo(() => Array.from({ length: 10 }, () => ({
        dx: -18 + Math.random() * 36,
        dy: 10 + Math.random() * 40,
        delay: 220 + Math.random() * 150,
        dur: 400 + Math.random() * 200,
        size: 3 + Math.random() * 4,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Steel blade streak */}
          <div style={{
            position: 'absolute', left: -len / 2, top: -2,
            width: len, height: 4,
            background: 'linear-gradient(90deg, transparent 0%, rgba(220,230,255,.1) 20%, rgba(240,250,255,.95) 48%, rgba(255,255,255,1) 52%, rgba(200,220,255,.7) 70%, transparent 100%)',
            boxShadow: '0 0 12px rgba(200,220,255,.9), 0 0 24px rgba(150,190,230,.6)',
            transform: 'rotate(-42deg) translateX(-120%)',
            transformOrigin: 'center center',
            animation: 'scytheSlash 420ms cubic-bezier(0.2, 0.9, 0.3, 1) forwards',
            opacity: 0,
          }} />
          {/* Impact glint at the midpoint */}
          <div style={{
            position: 'absolute', left: -14, top: -14, width: 28, height: 28,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(220,230,255,.7) 30%, transparent 70%)',
            animation: 'scytheGlint 360ms ease-out 180ms forwards',
            opacity: 0,
          }} />
          {/* Crimson slash wound lingering along the cut path */}
          <div style={{
            position: 'absolute', left: -ww * 0.6, top: -3,
            width: ww * 1.2, height: 6,
            background: 'linear-gradient(90deg, transparent 0%, rgba(160,0,10,.7) 20%, rgba(220,30,40,.95) 50%, rgba(160,0,10,.7) 80%, transparent 100%)',
            boxShadow: '0 0 10px rgba(180,20,30,.85)',
            transform: 'rotate(-42deg)',
            transformOrigin: 'center center',
            animation: 'scytheWound 620ms ease-out 220ms forwards',
            opacity: 0,
          }} />
          {/* Blood droplets falling off the wound */}
          {drops.map((d, i) => (
            <div key={'sd'+i} style={{
              position: 'absolute', left: d.dx, top: -2,
              width: d.size, height: d.size, borderRadius: '50%',
              background: '#b00010',
              boxShadow: '0 0 4px rgba(120,0,10,.8)',
              animation: `scytheDrop ${d.dur}ms ease-in ${d.delay}ms forwards`,
              opacity: 0,
              '--scDropY': d.dy + 'px',
            }} />
          ))}
        </div>
      );
    };
  })(),
  // Spooky ghost — Deepsea Poltergeister's artifact-destroy signature.
  // A wobbling 👻 floats up through the Artifact slot with a violet haze
  // and a handful of wisps spiraling out. Tuned to ~1200ms so the ghost
  // has time to "haunt" the artifact before destruction fires.
  spooky_ghost: (() => {
    return function SpookyGhostEffect({ x, y }) {
      const wisps = useMemo(() => Array.from({ length: 10 }, () => ({
        xOff: -35 + Math.random() * 70,
        startY: 20 + Math.random() * 20,
        endY: -70 - Math.random() * 50,
        delay: Math.random() * 500,
        dur: 700 + Math.random() * 500,
        size: 4 + Math.random() * 8,
        wobble: -12 + Math.random() * 24,
        shade: Math.random() < 0.5 ? 'rgba(200,180,255,.55)' : 'rgba(160,220,200,.45)',
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Violet haze flash */}
          <div className="anim-flame-flash" style={{
            width: 140, height: 140, marginLeft: -70, marginTop: -70,
            background: 'radial-gradient(circle, rgba(180,140,255,.55) 0%, rgba(90,60,160,.3) 45%, transparent 75%)',
            animationDuration: '900ms',
          }} />
          {/* Main ghost */}
          <div style={{
            position: 'absolute', left: -22, top: -4,
            fontSize: 44,
            filter: 'drop-shadow(0 0 10px rgba(190,150,255,.8)) drop-shadow(0 0 18px rgba(120,80,200,.6))',
            animation: 'spookyGhostFloat 1200ms ease-in-out forwards',
            opacity: 0,
          }}>
            👻
          </div>
          {/* Ectoplasm wisps */}
          {wisps.map((w, i) => (
            <div key={'sg'+i} style={{
              position: 'absolute', left: w.xOff, top: w.startY,
              width: w.size, height: w.size, borderRadius: '50%',
              background: `radial-gradient(circle at 40% 40%, ${w.shade}, transparent 70%)`,
              boxShadow: `0 0 ${w.size}px ${w.shade}`,
              animation: `spookyWispRise ${w.dur}ms ease-out ${w.delay}ms forwards`,
              opacity: 0,
              '--sgEndY': w.endY + 'px',
              '--sgWobble': w.wobble + 'px',
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
  heart_burst: (() => {
    const HEARTS = ['❤️','💖','💗','💕','💘','💝','💓','🩷'];
    return function HeartBurstEffect({ x, y }) {
      const particles = useMemo(() => Array.from({ length: 18 }, () => ({
        char:  HEARTS[Math.floor(Math.random() * HEARTS.length)],
        xOff:  -50 + Math.random() * 100,
        delay: Math.random() * 300,
        dur:   500 + Math.random() * 500,
        size:  12 + Math.random() * 16,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-gold-flash" style={{ background: 'radial-gradient(circle, rgba(255,120,160,.6) 0%, rgba(255,80,120,.25) 45%, transparent 70%)' }} />
          {particles.map((p, i) => (
            <div key={'hb'+i} style={{
              position: 'absolute', left: p.xOff, top: 10,
              fontSize: p.size,
              filter: 'drop-shadow(0 0 4px rgba(255,80,120,0.7))',
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
  // Toxic Fumes — a cloud of sickly purple gas boils out over the target.
  // Used by Toxic Fumes (Spell): thick billowing puffs that expand and
  // dissipate, a green-tinged haze behind, and small skull bubbles rising
  // through the cloud to sell the "toxic" flavor.
  toxic_fumes_gas: (() => {
    return function ToxicFumesGasEffect({ x, y, w, h }) {
      const cw = w || 90;
      const ch = h || 120;
      const puffs = useMemo(() => Array.from({ length: 10 }, () => ({
        xOff: -cw / 2 + Math.random() * cw,
        yOff: -ch / 2 + Math.random() * ch,
        size: 32 + Math.random() * 26,
        delay: Math.random() * 260,
        dur: 900 + Math.random() * 500,
        driftX: -10 + Math.random() * 20,
        driftY: -14 - Math.random() * 12,
        hue: Math.random() < 0.5
          ? ['rgba(130,40,180,0.75)','rgba(110,30,160,0.7)','rgba(150,60,200,0.7)'][Math.floor(Math.random() * 3)]
          : ['rgba(80,120,50,0.55)','rgba(100,140,60,0.5)'][Math.floor(Math.random() * 2)],
      })), [cw, ch]);
      const skulls = useMemo(() => Array.from({ length: 4 }, () => ({
        xOff: -cw / 2 + 10 + Math.random() * (cw - 20),
        startY: ch / 3 + Math.random() * 10,
        size: 10 + Math.random() * 6,
        delay: 200 + Math.random() * 400,
        dur: 900 + Math.random() * 300,
      })), [cw, ch]);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Greenish haze behind to suggest the toxic atmosphere */}
          <div style={{
            position: 'absolute',
            left: -cw / 2, top: -ch / 2,
            width: cw, height: ch,
            background: 'radial-gradient(ellipse at center, rgba(90,160,60,0.35) 0%, rgba(60,120,40,0.2) 50%, transparent 85%)',
            filter: 'blur(2px)',
            animation: 'toxicFumesHaze 1200ms ease-in-out forwards',
            opacity: 0,
          }} />
          {/* Billowing gas puffs */}
          {puffs.map((p, i) => (
            <div key={'tp' + i} style={{
              position: 'absolute',
              left: p.xOff - p.size / 2,
              top: p.yOff - p.size / 2,
              width: p.size, height: p.size,
              borderRadius: '50%',
              background: `radial-gradient(circle at 35% 35%, ${p.hue}, transparent 75%)`,
              filter: 'blur(3px)',
              mixBlendMode: 'screen',
              opacity: 0,
              animation: `toxicFumesPuff ${p.dur}ms ease-out ${p.delay}ms forwards`,
              ['--tfDriftX']: p.driftX + 'px',
              ['--tfDriftY']: p.driftY + 'px',
            }} />
          ))}
          {/* Rising skull bubbles */}
          {skulls.map((s, i) => (
            <span key={'ts' + i} style={{
              position: 'absolute',
              left: s.xOff, top: s.startY,
              fontSize: s.size,
              color: '#d6b3f2',
              textShadow: '0 0 6px rgba(150,60,200,0.9)',
              opacity: 0,
              animation: `toxicFumesSkull ${s.dur}ms ease-in-out ${s.delay}ms forwards`,
            }}>☠</span>
          ))}
          <style>{`
            @keyframes toxicFumesHaze {
              0%   { opacity: 0; transform: scale(0.6); }
              40%  { opacity: 0.9; transform: scale(1.05); }
              80%  { opacity: 0.7; transform: scale(1.1); }
              100% { opacity: 0; transform: scale(1.2); }
            }
            @keyframes toxicFumesPuff {
              0%   { opacity: 0; transform: translate(0, 0) scale(0.3); }
              30%  { opacity: 0.95; transform: translate(calc(var(--tfDriftX) * 0.4), calc(var(--tfDriftY) * 0.4)) scale(1); }
              70%  { opacity: 0.6; transform: translate(calc(var(--tfDriftX) * 0.8), calc(var(--tfDriftY) * 0.8)) scale(1.25); }
              100% { opacity: 0; transform: translate(var(--tfDriftX), var(--tfDriftY)) scale(1.5); }
            }
            @keyframes toxicFumesSkull {
              0%   { opacity: 0; transform: translate(0, 0) scale(0.5); }
              30%  { opacity: 1; transform: translate(0, -18px) scale(1); }
              70%  { opacity: 0.8; transform: translate(3px, -38px) scale(1.05); }
              100% { opacity: 0; transform: translate(-2px, -56px) scale(0.8); }
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
  golden_scale: (() => {
    return function GoldenScaleEffect({ x, y }) {
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100, transform: 'translate(-50%, -50%)' }}>
          <div style={{
            fontSize: 64,
            filter: 'drop-shadow(0 0 16px rgba(255,215,0,.9)) drop-shadow(0 0 32px rgba(255,180,0,.6))',
            animation: 'goldenScaleGrow 800ms ease-out forwards',
          }}>⚖️</div>
          <style>{`
            @keyframes goldenScaleGrow {
              0% { transform: scale(0.3); opacity: 0; }
              30% { transform: scale(1.3); opacity: 1; }
              60% { transform: scale(1.1); opacity: 1; }
              100% { transform: scale(2); opacity: 0; }
            }
          `}</style>
        </div>
      );
    };
  })(),
  guardian_shield: (() => {
    return function GuardianShieldEffect({ x, y }) {
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100, transform: 'translate(-50%, -50%)' }}>
          <div style={{
            width: 70, height: 70, borderRadius: '50%',
            border: '3px solid rgba(255,60,60,.9)',
            boxShadow: '0 0 20px rgba(255,40,40,.6), inset 0 0 14px rgba(255,60,60,.3)',
            animation: 'guardianShieldFlash 1000ms ease-out forwards',
          }} />
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            fontSize: 32, filter: 'drop-shadow(0 0 8px rgba(255,40,40,.8))',
            animation: 'guardianShieldFlash 1000ms ease-out forwards',
          }}>🛡️</div>
          <style>{`
            @keyframes guardianShieldFlash {
              0% { transform: translate(-50%, -50%) scale(0.3); opacity: 0; }
              25% { transform: translate(-50%, -50%) scale(1.2); opacity: 1; }
              60% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
              100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
            }
          `}</style>
        </div>
      );
    };
  })(),
  // ──────────────────────────────────────────────────────────────
  //  POLLUTION ARCHETYPE — 7 animations for Sun Beam, Goldify,
  //  Cold Coffin, Medusa's Curse, Reincarnation, Rain of Death,
  //  and Golden Wings. Each is self-contained; keyframes live in
  //  the same <style> tag so no global CSS edits are required.
  // ──────────────────────────────────────────────────────────────

  // ── Sun Beam ──────────────────────────────────────────────
  //  Enormous white orbital laser descending from the top of the
  //  screen onto the target. Three stacked vertical columns
  //  (outer glow + mid halo + white-hot core) scale-Y in from
  //  above, then an impact flash fans out and gold-white sparks
  //  rise from the hit point.
  sun_beam: (() => {
    return function SunBeamEffect({ x, y, w, h }) {
      const sparks = useMemo(() => Array.from({ length: 18 }, () => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
        const dist = 30 + Math.random() * 60;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist * 0.7,
          size: 3 + Math.random() * 5,
          delay: 350 + Math.random() * 300,
          dur: 450 + Math.random() * 300,
          color: ['#ffffff','#fffbe0','#fff2aa','#ffe680'][Math.floor(Math.random() * 4)],
        };
      }), []);
      const beamHeight = Math.max(window.innerHeight, 1200);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Outer wide glow column — descends from top of screen onto the target */}
          <div style={{
            position: 'absolute',
            left: -80, top: -beamHeight,
            width: 160, height: beamHeight,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,250,200,0.15) 20%, rgba(255,245,180,0.35) 70%, rgba(255,240,160,0.5) 100%)',
            filter: 'blur(8px)',
            transformOrigin: 'center top',
            animation: 'sunBeamDescend 320ms ease-out forwards, sunBeamFade 500ms ease-in 600ms forwards',
            opacity: 0,
          }} />
          {/* Mid halo column */}
          <div style={{
            position: 'absolute',
            left: -30, top: -beamHeight,
            width: 60, height: beamHeight,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,220,0.6) 30%, rgba(255,255,250,0.85) 100%)',
            filter: 'blur(3px)',
            transformOrigin: 'center top',
            animation: 'sunBeamDescend 260ms ease-out 40ms forwards, sunBeamFade 500ms ease-in 650ms forwards',
            opacity: 0,
          }} />
          {/* White-hot core */}
          <div style={{
            position: 'absolute',
            left: -10, top: -beamHeight,
            width: 20, height: beamHeight,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 40%, #ffffff 100%)',
            boxShadow: '0 0 24px rgba(255,255,220,0.9), 0 0 48px rgba(255,240,150,0.5)',
            transformOrigin: 'center top',
            animation: 'sunBeamDescend 220ms ease-out 80ms forwards, sunBeamFade 400ms ease-in 700ms forwards',
            opacity: 0,
          }} />
          {/* Impact shockwave flash at target */}
          <div style={{
            position: 'absolute', left: -70, top: -70,
            width: 140, height: 140, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,245,180,0.6) 30%, rgba(255,220,120,0.25) 55%, transparent 75%)',
            animation: 'sunBeamImpact 700ms ease-out 260ms forwards',
            opacity: 0,
          }} />
          {/* Rising sparks after impact */}
          {sparks.map((s, i) => (
            <div key={'sb'+i} style={{
              position: 'absolute', left: 0, top: 0,
              width: s.size, height: s.size, borderRadius: '50%',
              background: s.color,
              boxShadow: `0 0 ${s.size + 2}px ${s.color}`,
              opacity: 0,
              animation: `sunBeamSpark ${s.dur}ms ease-out ${s.delay}ms forwards`,
              '--sbDx': s.dx + 'px', '--sbDy': s.dy + 'px',
            }} />
          ))}
          <style>{`
            @keyframes sunBeamDescend {
              0%   { opacity: 0; transform: scaleY(0); }
              20%  { opacity: 0.9; }
              100% { opacity: 1; transform: scaleY(1); }
            }
            @keyframes sunBeamFade {
              0%   { opacity: 1; }
              100% { opacity: 0; }
            }
            @keyframes sunBeamImpact {
              0%   { opacity: 0; transform: scale(0.2); }
              25%  { opacity: 1; transform: scale(1.1); }
              100% { opacity: 0; transform: scale(2.2); }
            }
            @keyframes sunBeamSpark {
              0%   { opacity: 0; transform: translate(0, 0) scale(0.6); }
              20%  { opacity: 1; }
              100% { opacity: 0; transform: translate(var(--sbDx), var(--sbDy)) scale(0.3); }
            }
          `}</style>
        </div>
      );
    };
  })(),

  // ── Pollution Token evaporation ───────────────────────────
  //  Inverse of pollution_place: the violet goo dissipates
  //  upward as translucent smoke wisps, the dark aura fades
  //  outward, and a handful of light-lavender sparks drift up
  //  and vanish. Plays when a Pollution Token is removed from
  //  the board — the "evaporate" feel makes it clear the
  //  token is GONE (not moved to a pile).
  pollution_evaporate: (() => {
    return function PollutionEvaporateEffect({ x, y, w, h }) {
      const cw = w || 100;
      const ch = h || 140;
      const wisps = useMemo(() => Array.from({ length: 8 }, () => {
        const offX = (Math.random() - 0.5) * 40;
        return {
          dx: offX + (Math.random() - 0.5) * 30,
          dy: -40 - Math.random() * 50, // drift upward
          size: 18 + Math.random() * 18,
          delay: Math.random() * 250,
          dur: 700 + Math.random() * 300,
          rot: (Math.random() - 0.5) * 120,
          startX: offX,
        };
      }), []);
      const sparks = useMemo(() => Array.from({ length: 10 }, () => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.3;
        const dist = 22 + Math.random() * 42;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          size: 2 + Math.random() * 3,
          delay: 100 + Math.random() * 400,
          dur: 600 + Math.random() * 300,
          color: ['#d3b3ff','#e8d6ff','#a978d9','#f0e0ff'][Math.floor(Math.random() * 4)],
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Fading dark aura — shrinks and brightens as it dissipates */}
          <div style={{
            position: 'absolute',
            left: -cw / 2, top: -ch / 2,
            width: cw, height: ch, borderRadius: 6,
            background: 'radial-gradient(ellipse at center, rgba(60,15,95,0.85) 0%, rgba(30,5,55,0.55) 55%, transparent 100%)',
            mixBlendMode: 'multiply',
            opacity: 0,
            animation: 'pollutionAuraFade 850ms ease-out forwards',
          }} />
          {/* Rising smoke wisps */}
          {wisps.map((wp, i) => (
            <div key={'pev'+i} style={{
              position: 'absolute',
              left: wp.startX - wp.size / 2, top: -wp.size / 2,
              width: wp.size, height: wp.size, borderRadius: '50%',
              background: 'radial-gradient(circle at 40% 40%, rgba(170,110,220,0.75), rgba(70,30,130,0.55) 55%, transparent 85%)',
              filter: 'blur(2px)',
              opacity: 0,
              animation: `pollutionWisp ${wp.dur}ms ease-out ${wp.delay}ms forwards`,
              '--pevDx': wp.dx + 'px', '--pevDy': wp.dy + 'px', '--pevRot': wp.rot + 'deg',
            }} />
          ))}
          {/* Ascending sparks */}
          {sparks.map((s, i) => (
            <div key={'pes'+i} style={{
              position: 'absolute', left: 0, top: 0,
              width: s.size, height: s.size, borderRadius: '50%',
              background: s.color,
              boxShadow: `0 0 ${s.size + 3}px ${s.color}`,
              opacity: 0,
              animation: `pollutionEvaporateSpark ${s.dur}ms ease-out ${s.delay}ms forwards`,
              '--pesDx': s.dx + 'px', '--pesDy': s.dy + 'px',
            }} />
          ))}
          <style>{`
            @keyframes pollutionAuraFade {
              0%   { opacity: 0.9; transform: scale(1); }
              40%  { opacity: 0.6; transform: scale(0.85); }
              100% { opacity: 0; transform: scale(0.4); }
            }
            @keyframes pollutionWisp {
              0%   { opacity: 0; transform: translate(0,0) rotate(0deg) scale(0.6); }
              25%  { opacity: 0.9; }
              100% { opacity: 0; transform: translate(var(--pevDx), var(--pevDy)) rotate(var(--pevRot)) scale(1.4); }
            }
            @keyframes pollutionEvaporateSpark {
              0%   { opacity: 0; transform: translate(0,0) scale(0.5); }
              30%  { opacity: 1; }
              100% { opacity: 0; transform: translate(var(--pesDx), var(--pesDy)) scale(0.2); }
            }
          `}</style>
        </div>
      );
    };
  })(),

  // ── Pollution Token placement ─────────────────────────────
  //  Shadowy, gooey dark-magic seep: a dark-violet radial aura
  //  pulses on the slot while black-purple "drip" globs ooze
  //  outward and fade, with a few cyan-black sparks flickering
  //  through. Plays ~1100ms on each newly placed Pollution
  //  Token — signals "this thing is actively bad for you".
  pollution_place: (() => {
    return function PollutionPlaceEffect({ x, y, w, h }) {
      const cw = w || 100;
      const ch = h || 140;
      const drips = useMemo(() => Array.from({ length: 10 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 18 + Math.random() * 40;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist + 8, // slight downward bias (gooey, drips down)
          size: 10 + Math.random() * 14,
          delay: Math.random() * 300,
          dur: 650 + Math.random() * 350,
          spin: (Math.random() - 0.5) * 260,
        };
      }), []);
      const sparks = useMemo(() => Array.from({ length: 14 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 15 + Math.random() * 45;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist - 6, // slight upward bias (wispy)
          size: 2 + Math.random() * 4,
          delay: 80 + Math.random() * 400,
          dur: 500 + Math.random() * 300,
          color: ['#d3b3ff','#8f55d9','#1a0033','#4b1a7a'][Math.floor(Math.random() * 4)],
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Dark aura pulse — radial purple-black */}
          <div style={{
            position: 'absolute',
            left: -cw / 2, top: -ch / 2,
            width: cw, height: ch, borderRadius: 6,
            background: 'radial-gradient(ellipse at center, rgba(60,15,95,0.9) 0%, rgba(30,5,55,0.75) 45%, rgba(10,0,20,0.4) 80%, transparent 100%)',
            boxShadow: 'inset 0 0 24px rgba(80,20,130,0.95), 0 0 28px rgba(50,10,90,0.7)',
            mixBlendMode: 'multiply',
            opacity: 0,
            animation: 'pollutionAura 1100ms ease-in-out forwards',
          }} />
          {/* Shadow-goo veil that seeps in */}
          <div style={{
            position: 'absolute',
            left: -cw / 2, top: -ch / 2,
            width: cw, height: ch, borderRadius: 6,
            background: 'linear-gradient(180deg, rgba(18,2,32,0.0) 0%, rgba(25,5,45,0.7) 40%, rgba(40,10,70,0.85) 100%)',
            filter: 'blur(2px)',
            opacity: 0,
            animation: 'pollutionVeil 1100ms ease-out forwards',
          }} />
          {/* Central dark-magic sigil flash */}
          <div style={{
            position: 'absolute', left: -34, top: -34,
            width: 68, height: 68, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(140,60,200,0.9) 0%, rgba(70,20,130,0.7) 40%, rgba(20,0,50,0.3) 70%, transparent 100%)',
            boxShadow: '0 0 22px rgba(140,60,200,0.9), 0 0 44px rgba(70,20,130,0.55)',
            opacity: 0,
            animation: 'pollutionSigil 700ms ease-out 100ms forwards',
          }} />
          {/* Gooey drip globs oozing outward */}
          {drips.map((d, i) => (
            <div key={'pd'+i} style={{
              position: 'absolute', left: 0, top: 0,
              width: d.size, height: d.size * 1.1, borderRadius: '45% 45% 55% 55% / 60% 60% 40% 40%',
              background: 'radial-gradient(circle at 35% 30%, #7a3ec4, #2a0a55 70%, #0a0014)',
              boxShadow: '0 0 6px rgba(90,30,150,0.8), inset 0 -2px 4px rgba(0,0,0,0.6)',
              filter: 'blur(0.5px)',
              opacity: 0,
              animation: `pollutionDrip ${d.dur}ms ease-out ${d.delay}ms forwards`,
              '--pdDx': d.dx + 'px', '--pdDy': d.dy + 'px', '--pdRot': d.spin + 'deg',
            }} />
          ))}
          {/* Wispy arcane sparks */}
          {sparks.map((s, i) => (
            <div key={'ps'+i} style={{
              position: 'absolute', left: 0, top: 0,
              width: s.size, height: s.size, borderRadius: '50%',
              background: s.color,
              boxShadow: `0 0 ${s.size + 3}px ${s.color}`,
              opacity: 0,
              animation: `pollutionSpark ${s.dur}ms ease-out ${s.delay}ms forwards`,
              '--psDx': s.dx + 'px', '--psDy': s.dy + 'px',
            }} />
          ))}
          <style>{`
            @keyframes pollutionAura {
              0%   { opacity: 0; transform: scale(0.4); }
              40%  { opacity: 1; transform: scale(1.05); }
              80%  { opacity: 0.85; transform: scale(1); }
              100% { opacity: 0; transform: scale(1.1); }
            }
            @keyframes pollutionVeil {
              0%   { opacity: 0; transform: translateY(-30%); }
              50%  { opacity: 0.95; transform: translateY(0); }
              100% { opacity: 0; transform: translateY(10%); }
            }
            @keyframes pollutionSigil {
              0%   { opacity: 0; transform: scale(0.2) rotate(0deg); }
              40%  { opacity: 1; transform: scale(1) rotate(90deg); }
              100% { opacity: 0; transform: scale(1.6) rotate(180deg); }
            }
            @keyframes pollutionDrip {
              0%   { opacity: 0; transform: translate(0, 0) rotate(0deg) scale(0.4); }
              25%  { opacity: 1; }
              100% { opacity: 0; transform: translate(var(--pdDx), var(--pdDy)) rotate(var(--pdRot)) scale(0.9); }
            }
            @keyframes pollutionSpark {
              0%   { opacity: 0; transform: translate(0, 0) scale(0.5); }
              30%  { opacity: 1; }
              100% { opacity: 0; transform: translate(var(--psDx), var(--psDy)) scale(0.2); }
            }
          `}</style>
        </div>
      );
    };
  })(),

  // ── Goldify ───────────────────────────────────────────────
  //  Two-phase transmutation: (1) target is overlaid with a
  //  growing gold sheen/filter for ~500ms, then (2) the sheen
  //  explodes outward as radiating gold coins 🪙 and sparkles.
  //  Conceptually "value destroys the target" — distinct from
  //  destruction_spell explosions.
  goldify_transmute: (() => {
    return function GoldifyTransmuteEffect({ x, y, w, h }) {
      const cw = w || 100;
      const ch = h || 140;
      const coins = useMemo(() => Array.from({ length: 14 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 45 + Math.random() * 50;
        return {
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed - 15, // slight upward bias
          size: 18 + Math.random() * 12,
          delay: 500 + Math.random() * 200,
          dur: 600 + Math.random() * 300,
          rot: -180 + Math.random() * 360,
        };
      }), []);
      const sparkles = useMemo(() => Array.from({ length: 20 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 45;
        return {
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 5,
          delay: 480 + Math.random() * 300,
          dur: 500 + Math.random() * 300,
          color: ['#ffd700','#ffec80','#fff5cc','#ffb300','#ffe066'][Math.floor(Math.random() * 5)],
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Phase 1: gold sheen overlay growing on target */}
          <div style={{
            position: 'absolute',
            left: -cw / 2, top: -ch / 2,
            width: cw, height: ch, borderRadius: 4,
            background: 'radial-gradient(circle at center, rgba(255,215,0,0.85) 0%, rgba(255,180,0,0.6) 50%, rgba(255,165,0,0.3) 85%, transparent 100%)',
            boxShadow: '0 0 18px rgba(255,200,40,0.7), inset 0 0 22px rgba(255,235,120,0.7)',
            mixBlendMode: 'color-dodge',
            opacity: 0,
            animation: 'goldifySheen 600ms ease-in forwards',
          }} />
          {/* Phase 1b: bright gold flash at peak of sheen */}
          <div style={{
            position: 'absolute', left: -60, top: -60,
            width: 120, height: 120, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,220,0.95) 0%, rgba(255,215,0,0.6) 40%, transparent 75%)',
            opacity: 0,
            animation: 'goldifyBurst 400ms ease-out 450ms forwards',
          }} />
          {/* Phase 2: coins exploding outward */}
          {coins.map((c, i) => (
            <div key={'gc'+i} style={{
              position: 'absolute', left: 0, top: 0,
              fontSize: c.size, opacity: 0,
              filter: 'drop-shadow(0 0 6px rgba(255,210,60,0.9))',
              animation: `goldifyCoin ${c.dur}ms ease-out ${c.delay}ms forwards`,
              '--gcDx': c.dx + 'px', '--gcDy': c.dy + 'px', '--gcRot': c.rot + 'deg',
            }}>🪙</div>
          ))}
          {/* Phase 2b: sparkles radiating with the coins */}
          {sparkles.map((s, i) => (
            <div key={'gs'+i} style={{
              position: 'absolute', left: 0, top: 0,
              width: s.size, height: s.size, borderRadius: '50%',
              background: s.color,
              boxShadow: `0 0 ${s.size + 3}px ${s.color}`,
              opacity: 0,
              animation: `goldifySpark ${s.dur}ms ease-out ${s.delay}ms forwards`,
              '--gsDx': s.dx + 'px', '--gsDy': s.dy + 'px',
            }} />
          ))}
          <style>{`
            @keyframes goldifySheen {
              0%   { opacity: 0; transform: scale(0.85); }
              50%  { opacity: 1; transform: scale(1.05); }
              85%  { opacity: 0.95; transform: scale(1.1); }
              100% { opacity: 0; transform: scale(1.3); }
            }
            @keyframes goldifyBurst {
              0%   { opacity: 0; transform: scale(0.3); }
              30%  { opacity: 1; transform: scale(1.2); }
              100% { opacity: 0; transform: scale(2); }
            }
            @keyframes goldifyCoin {
              0%   { opacity: 0; transform: translate(0,0) rotate(0deg) scale(0.4); }
              20%  { opacity: 1; }
              100% { opacity: 0; transform: translate(var(--gcDx), var(--gcDy)) rotate(var(--gcRot)) scale(0.8); }
            }
            @keyframes goldifySpark {
              0%   { opacity: 0; transform: translate(0,0) scale(0.4); }
              25%  { opacity: 1; }
              100% { opacity: 0; transform: translate(var(--gsDx), var(--gsDy)) scale(0.3); }
            }
          `}</style>
        </div>
      );
    };
  })(),

  // ── Cold Coffin ───────────────────────────────────────────
  //  Heavy ice slabs slide inward from 4 directions and slam
  //  together over the target, with a white frost-fog overlay
  //  and snowflake particles settling slowly afterward. The
  //  target ends up "encased" — distinct from the existing
  //  ice_encase which is converging shards.
  cold_coffin_encase: (() => {
    return function ColdCoffinEncaseEffect({ x, y, w, h }) {
      const cw = w || 100;
      const ch = h || 140;
      const snowflakes = useMemo(() => Array.from({ length: 14 }, () => ({
        x: -cw / 2 + Math.random() * cw,
        startY: -ch / 2 - 20,
        endY: ch / 2 + Math.random() * 20,
        size: 8 + Math.random() * 8,
        delay: 550 + Math.random() * 400,
        dur: 700 + Math.random() * 500,
        char: ['❄','❅','❆','✦'][Math.floor(Math.random() * 4)],
        rot: -60 + Math.random() * 120,
      })), [cw, ch]);
      // Four ice slabs — one from each cardinal direction, thick & rectangular
      const slabs = [
        { // top slab — slides down
          w: cw * 0.95, h: ch * 0.4,
          startX: 0, startY: -ch * 1.2, endX: 0, endY: -ch * 0.25,
          gradient: 'linear-gradient(to bottom, rgba(220,240,255,0.95) 0%, rgba(180,220,240,0.85) 50%, rgba(210,235,250,0.9) 100%)',
          delay: 0,
        },
        { // bottom slab — slides up
          w: cw * 0.95, h: ch * 0.4,
          startX: 0, startY: ch * 1.2, endX: 0, endY: ch * 0.25,
          gradient: 'linear-gradient(to top, rgba(220,240,255,0.95) 0%, rgba(180,220,240,0.85) 50%, rgba(210,235,250,0.9) 100%)',
          delay: 40,
        },
        { // left slab — slides right
          w: cw * 0.35, h: ch * 0.75,
          startX: -cw * 1.2, startY: 0, endX: -cw * 0.30, endY: 0,
          gradient: 'linear-gradient(to right, rgba(200,230,250,0.9) 0%, rgba(175,215,240,0.85) 60%, rgba(210,235,250,0.95) 100%)',
          delay: 80,
        },
        { // right slab — slides left
          w: cw * 0.35, h: ch * 0.75,
          startX: cw * 1.2, startY: 0, endX: cw * 0.30, endY: 0,
          gradient: 'linear-gradient(to left, rgba(200,230,250,0.9) 0%, rgba(175,215,240,0.85) 60%, rgba(210,235,250,0.95) 100%)',
          delay: 120,
        },
      ];
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Frost-fog overlay — fills the target area with a pale blue-white haze */}
          <div style={{
            position: 'absolute',
            left: -cw / 2 - 10, top: -ch / 2 - 10,
            width: cw + 20, height: ch + 20, borderRadius: 6,
            background: 'radial-gradient(ellipse at center, rgba(230,245,255,0.7) 0%, rgba(200,230,250,0.5) 50%, rgba(180,220,245,0.2) 90%, transparent 100%)',
            filter: 'blur(4px)',
            opacity: 0,
            animation: 'coldCoffinFog 1000ms ease-in 250ms forwards',
          }} />
          {/* The four thick ice slabs */}
          {slabs.map((slab, i) => (
            <div key={'cc'+i} style={{
              position: 'absolute',
              left: slab.startX - slab.w / 2, top: slab.startY - slab.h / 2,
              width: slab.w, height: slab.h, borderRadius: 3,
              background: slab.gradient,
              boxShadow: '0 0 12px rgba(180,220,245,0.7), inset 0 0 18px rgba(255,255,255,0.5), inset 0 2px 6px rgba(255,255,255,0.6)',
              border: '1px solid rgba(255,255,255,0.5)',
              animation: `coldCoffinSlab 400ms cubic-bezier(0.25, 0.9, 0.35, 1) ${slab.delay}ms forwards`,
              opacity: 0,
              '--ccEndX': (slab.endX - slab.startX) + 'px',
              '--ccEndY': (slab.endY - slab.startY) + 'px',
            }} />
          ))}
          {/* Center-slam flash when slabs collide */}
          <div style={{
            position: 'absolute', left: -50, top: -50,
            width: 100, height: 100, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(220,240,255,0.5) 40%, transparent 70%)',
            opacity: 0,
            animation: 'coldCoffinSlam 350ms ease-out 380ms forwards',
          }} />
          {/* Snowflakes drifting down after the slam */}
          {snowflakes.map((s, i) => (
            <div key={'cs'+i} style={{
              position: 'absolute', left: s.x, top: s.startY,
              fontSize: s.size, color: '#ffffff',
              filter: 'drop-shadow(0 0 3px rgba(200,230,250,0.9))',
              transform: `rotate(${s.rot}deg)`,
              opacity: 0,
              animation: `coldCoffinSnow ${s.dur}ms ease-in ${s.delay}ms forwards`,
              '--ccSnowEndY': (s.endY - s.startY) + 'px',
            }}>{s.char}</div>
          ))}
          <style>{`
            @keyframes coldCoffinSlab {
              0%   { opacity: 0; transform: translate(0, 0) scale(1.05); }
              30%  { opacity: 1; }
              100% { opacity: 1; transform: translate(var(--ccEndX), var(--ccEndY)) scale(1); }
            }
            @keyframes coldCoffinFog {
              0%   { opacity: 0; }
              40%  { opacity: 1; }
              100% { opacity: 0.85; }
            }
            @keyframes coldCoffinSlam {
              0%   { opacity: 0; transform: scale(0.3); }
              30%  { opacity: 1; transform: scale(1.2); }
              100% { opacity: 0; transform: scale(2); }
            }
            @keyframes coldCoffinSnow {
              0%   { opacity: 0; transform: translateY(0) rotate(0deg); }
              15%  { opacity: 1; }
              85%  { opacity: 1; }
              100% { opacity: 0; transform: translateY(var(--ccSnowEndY)) rotate(180deg); }
            }
          `}</style>
        </div>
      );
    };
  })(),

  // ── Petrify (Medusa's Curse) ──────────────────────────────
  //  Target gains a grey stone overlay with a subtle speckle/
  //  noise texture and a brief sickly-green flash at the onset.
  //  Held mostly static — petrification is stasis, not motion.
  //  A few stone-chip particles fall off afterward to sell the
  //  "turned to stone" read.
  petrify: (() => {
    return function PetrifyEffect({ x, y, w, h }) {
      const cw = w || 100;
      const ch = h || 140;
      const chips = useMemo(() => Array.from({ length: 10 }, () => {
        const angle = Math.PI / 2 + (Math.random() - 0.5) * 1.6; // mostly downward
        const speed = 12 + Math.random() * 22;
        return {
          startX: -cw / 2 + Math.random() * cw,
          startY: -ch / 2 + Math.random() * ch,
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed + 20, // gravity
          size: 3 + Math.random() * 4,
          delay: 500 + Math.random() * 400,
          dur: 500 + Math.random() * 300,
          shade: ['#7a7a7a','#8e8e8e','#6a6a6a','#a0a0a0'][Math.floor(Math.random() * 4)],
        };
      }), [cw, ch]);
      // Speckle positions pre-computed once for stability
      const specks = useMemo(() => Array.from({ length: 22 }, () => ({
        left: -cw / 2 + Math.random() * cw,
        top: -ch / 2 + Math.random() * ch,
        size: 1 + Math.random() * 2.5,
        shade: ['#555','#666','#3a3a3a','#777'][Math.floor(Math.random() * 4)],
        opacity: 0.45 + Math.random() * 0.35,
      })), [cw, ch]);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Medusa-green pulse at onset */}
          <div style={{
            position: 'absolute', left: -cw / 2 - 8, top: -ch / 2 - 8,
            width: cw + 16, height: ch + 16, borderRadius: 6,
            background: 'radial-gradient(ellipse at center, rgba(80,190,100,0.7) 0%, rgba(60,150,80,0.35) 50%, transparent 85%)',
            opacity: 0,
            animation: 'petrifyGlow 500ms ease-out forwards',
          }} />
          {/* Stone overlay — greyscale gradient that grows in opacity */}
          <div style={{
            position: 'absolute', left: -cw / 2, top: -ch / 2,
            width: cw, height: ch, borderRadius: 4,
            background: 'linear-gradient(135deg, rgba(140,140,145,0.82) 0%, rgba(90,90,95,0.75) 45%, rgba(120,120,125,0.78) 80%, rgba(70,70,75,0.82) 100%)',
            boxShadow: 'inset 0 0 16px rgba(50,50,55,0.7), inset 0 -3px 8px rgba(40,40,45,0.6)',
            mixBlendMode: 'multiply',
            opacity: 0,
            animation: 'petrifyStone 600ms ease-out 150ms forwards',
          }} />
          {/* Speckle grain for a "mineral" texture */}
          <div style={{
            position: 'absolute', left: 0, top: 0, width: 0, height: 0,
            opacity: 0,
            animation: 'petrifyStone 600ms ease-out 200ms forwards',
          }}>
            {specks.map((sp, i) => (
              <div key={'pt'+i} style={{
                position: 'absolute', left: sp.left, top: sp.top,
                width: sp.size, height: sp.size, borderRadius: '50%',
                background: sp.shade, opacity: sp.opacity,
              }} />
            ))}
          </div>
          {/* Stone chips falling off */}
          {chips.map((c, i) => (
            <div key={'pc'+i} style={{
              position: 'absolute', left: c.startX, top: c.startY,
              width: c.size, height: c.size * 0.8,
              background: c.shade, borderRadius: 1,
              boxShadow: '0 0 2px rgba(0,0,0,0.5)',
              opacity: 0,
              animation: `petrifyChip ${c.dur}ms ease-in ${c.delay}ms forwards`,
              '--pcDx': c.dx + 'px', '--pcDy': c.dy + 'px',
            }} />
          ))}
          <style>{`
            @keyframes petrifyGlow {
              0%   { opacity: 0; }
              40%  { opacity: 1; }
              100% { opacity: 0; }
            }
            @keyframes petrifyStone {
              0%   { opacity: 0; }
              60%  { opacity: 1; }
              100% { opacity: 0.85; }
            }
            @keyframes petrifyChip {
              0%   { opacity: 0; transform: translate(0, 0) rotate(0deg); }
              20%  { opacity: 1; }
              100% { opacity: 0; transform: translate(var(--pcDx), var(--pcDy)) rotate(180deg); }
            }
          `}</style>
        </div>
      );
    };
  })(),

  // ── Angel Revival (Reincarnation) ─────────────────────────
  //  Direct structural parallel of golden_ankh_revival — same
  //  motion, palette, and timing — but with angel emoji (😇)
  //  rising upward instead of ankh glyphs. Used when
  //  Reincarnation revives a Hero or restores a Creature.
  angel_revival: (() => {
    return function AngelRevivalEffect({ x, y }) {
      const angels = useMemo(() => Array.from({ length: 12 }, () => ({
        xOff: -45 + Math.random() * 90,
        startY: 20 + Math.random() * 30,
        endY: -70 - Math.random() * 80,
        delay: 100 + Math.random() * 500,
        dur: 700 + Math.random() * 500,
        size: 18 + Math.random() * 14,
        rot: -15 + Math.random() * 30,
      })), []);
      const sparkles = useMemo(() => Array.from({ length: 20 }, () => ({
        xOff: -50 + Math.random() * 100,
        startY: 10 + Math.random() * 40,
        endY: -50 - Math.random() * 70,
        delay: 200 + Math.random() * 600,
        dur: 500 + Math.random() * 500,
        size: 3 + Math.random() * 7,
        color: ['#ffd700','#ffec80','#fff5cc','#ffffff','#ffe066'][Math.floor(Math.random() * 5)],
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div className="anim-flame-flash" style={{ width: 150, height: 150, marginLeft: -75, marginTop: -75, background: 'radial-gradient(circle, rgba(255,250,220,.9) 0%, rgba(255,215,0,.45) 35%, rgba(255,240,180,.15) 60%, transparent 80%)', animationDuration: '900ms' }} />
          <div className="anim-flame-flash" style={{ width: 90, height: 90, marginLeft: -45, marginTop: -45, background: 'radial-gradient(circle, rgba(255,255,250,.98) 0%, rgba(255,230,100,.55) 40%, transparent 70%)', animationDelay: '250ms', animationDuration: '700ms' }} />
          {angels.map((a, i) => (
            <div key={'agl'+i} style={{
              position: 'absolute', left: a.xOff, top: a.startY,
              fontSize: a.size,
              filter: 'drop-shadow(0 0 8px rgba(255,230,120,.9)) drop-shadow(0 0 14px rgba(255,255,220,.6))',
              transform: `rotate(${a.rot}deg)`,
              animation: `ankhFloat ${a.dur}ms ease-out ${a.delay}ms forwards`,
              opacity: 0,
              '--endY': a.endY + 'px',
            }}>😇</div>
          ))}
          {sparkles.map((s, i) => (
            <div key={'ags'+i} style={{
              position: 'absolute', left: s.xOff, top: s.startY,
              width: s.size, height: s.size, borderRadius: '50%',
              background: s.color,
              boxShadow: `0 0 ${s.size + 2}px ${s.color}`,
              animation: `ankhFloat ${s.dur}ms ease-out ${s.delay}ms forwards`,
              opacity: 0,
              '--endY': s.endY + 'px',
            }} />
          ))}
        </div>
      );
    };
  })(),

  // ── Rain of Death ─────────────────────────────────────────
  //  Dark red ominous particles rain down on affected targets.
  //  Skull glyphs fall with trailing blood-drops, accompanied
  //  by a low pulsing dark-red fog at the impact site. The
  //  animation runs LONG (card's resolve waits for it before
  //  removing the Ability).
  rain_of_death: (() => {
    return function RainOfDeathEffect({ x, y, w, h }) {
      const cw = w || 100;
      const drops = useMemo(() => Array.from({ length: 22 }, () => ({
        xOff: -cw * 0.7 + Math.random() * cw * 1.4,
        startY: -160 - Math.random() * 120,
        delay: Math.random() * 800,
        dur: 500 + Math.random() * 400,
        size: 10 + Math.random() * 8,
        char: Math.random() < 0.3 ? '💀' : (Math.random() < 0.5 ? '🩸' : '·'),
        rot: -10 + Math.random() * 20,
      })), [cw]);
      const impacts = useMemo(() => Array.from({ length: 18 }, () => ({
        xOff: -cw * 0.5 + Math.random() * cw,
        dy: -5 - Math.random() * 12,
        size: 3 + Math.random() * 5,
        delay: 200 + Math.random() * 900,
        dur: 350 + Math.random() * 300,
        color: ['#aa1111','#661111','#880808','#440404','#cc2222'][Math.floor(Math.random() * 5)],
      })), [cw]);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Low pulsing dark-red fog at target */}
          <div style={{
            position: 'absolute', left: -70, top: -70,
            width: 140, height: 140, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(120,10,10,0.55) 0%, rgba(70,5,5,0.35) 45%, transparent 80%)',
            filter: 'blur(3px)',
            opacity: 0,
            animation: 'rainOfDeathFog 1400ms ease-in-out 200ms forwards',
          }} />
          {/* Falling drops / skulls */}
          {drops.map((d, i) => (
            <div key={'rd'+i} style={{
              position: 'absolute', left: d.xOff, top: d.startY,
              fontSize: d.size,
              filter: 'drop-shadow(0 0 4px rgba(130,10,10,0.85)) drop-shadow(0 0 7px rgba(80,0,0,0.6))',
              transform: `rotate(${d.rot}deg)`,
              animation: `rainOfDeathFall ${d.dur}ms ease-in ${d.delay}ms forwards`,
              opacity: 0,
              color: '#aa0000',
            }}>{d.char}</div>
          ))}
          {/* Impact splatters at target level */}
          {impacts.map((imp, i) => (
            <div key={'ri'+i} style={{
              position: 'absolute', left: imp.xOff, top: 0,
              width: imp.size, height: imp.size, borderRadius: '50%',
              background: imp.color,
              boxShadow: `0 0 ${imp.size + 2}px ${imp.color}`,
              opacity: 0,
              animation: `rainOfDeathImpact ${imp.dur}ms ease-out ${imp.delay}ms forwards`,
              '--rdDy': imp.dy + 'px',
            }} />
          ))}
          <style>{`
            @keyframes rainOfDeathFog {
              0%   { opacity: 0; transform: scale(0.5); }
              30%  { opacity: 1; transform: scale(1.1); }
              70%  { opacity: 0.85; transform: scale(1.3); }
              100% { opacity: 0; transform: scale(1.5); }
            }
            @keyframes rainOfDeathFall {
              0%   { opacity: 0; }
              15%  { opacity: 1; }
              80%  { opacity: 1; }
              100% { opacity: 0; transform: translateY(220px) rotate(25deg); }
            }
            @keyframes rainOfDeathImpact {
              0%   { opacity: 0; transform: translate(0, 0) scale(0.4); }
              25%  { opacity: 1; transform: translate(0, var(--rdDy)) scale(1.2); }
              100% { opacity: 0; transform: translate(0, 8px) scale(0.6); }
            }
          `}</style>
        </div>
      );
    };
  })(),

  // ── Golden Wings ──────────────────────────────────────────
  //  Target gains a golden sheen plus two stylised wings that
  //  sweep into place on either side, flap once, and linger as
  //  a protective buff visual. This is a BUFF visual, not an
  //  attack — slower, gentler, and holds on the target.
  golden_wings: (() => {
    return function GoldenWingsEffect({ x, y, w, h }) {
      const cw = w || 100;
      const ch = h || 140;
      const sparkles = useMemo(() => Array.from({ length: 14 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 35 + Math.random() * 40;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist * 0.7 - 10,
          size: 3 + Math.random() * 5,
          delay: 250 + Math.random() * 600,
          dur: 600 + Math.random() * 400,
          color: ['#ffd700','#fff5cc','#ffec80','#ffffff'][Math.floor(Math.random() * 4)],
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Golden sheen overlay on the target */}
          <div style={{
            position: 'absolute',
            left: -cw / 2, top: -ch / 2,
            width: cw, height: ch, borderRadius: 4,
            background: 'linear-gradient(135deg, rgba(255,230,120,0.0) 20%, rgba(255,225,100,0.55) 50%, rgba(255,230,120,0.0) 80%)',
            boxShadow: 'inset 0 0 22px rgba(255,215,80,0.5), 0 0 16px rgba(255,200,40,0.6)',
            mixBlendMode: 'screen',
            opacity: 0,
            animation: 'goldenWingsSheen 1100ms ease-in-out 100ms forwards',
          }} />
          {/* Left wing — emoji dove mirrored horizontally via scaleX(-1) */}
          <div style={{
            position: 'absolute',
            left: -cw * 0.55, top: -ch * 0.15,
            fontSize: Math.max(cw, ch) * 0.55,
            transformOrigin: 'right center',
            filter: 'drop-shadow(0 0 10px rgba(255,215,80,0.9)) drop-shadow(0 0 18px rgba(255,240,160,0.55)) hue-rotate(30deg) saturate(1.4) brightness(1.2)',
            color: '#ffd700',
            opacity: 0,
            animation: 'goldenWingLeft 1100ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards',
          }}>
            <span style={{ display: 'inline-block', transform: 'scaleX(-1)' }}>🕊️</span>
          </div>
          {/* Right wing */}
          <div style={{
            position: 'absolute',
            left: cw * 0.05, top: -ch * 0.15,
            fontSize: Math.max(cw, ch) * 0.55,
            transformOrigin: 'left center',
            filter: 'drop-shadow(0 0 10px rgba(255,215,80,0.9)) drop-shadow(0 0 18px rgba(255,240,160,0.55)) hue-rotate(30deg) saturate(1.4) brightness(1.2)',
            color: '#ffd700',
            opacity: 0,
            animation: 'goldenWingRight 1100ms cubic-bezier(0.2, 0.8, 0.3, 1) forwards',
          }}>🕊️</div>
          {/* Sparkles around the target */}
          {sparkles.map((s, i) => (
            <div key={'gw'+i} style={{
              position: 'absolute', left: 0, top: 0,
              width: s.size, height: s.size, borderRadius: '50%',
              background: s.color,
              boxShadow: `0 0 ${s.size + 3}px ${s.color}`,
              opacity: 0,
              animation: `goldenWingsSpark ${s.dur}ms ease-out ${s.delay}ms forwards`,
              '--gwDx': s.dx + 'px', '--gwDy': s.dy + 'px',
            }} />
          ))}
          <style>{`
            @keyframes goldenWingsSheen {
              0%   { opacity: 0; transform: scale(0.95); }
              30%  { opacity: 1; transform: scale(1.02); }
              70%  { opacity: 0.9; transform: scale(1.02); }
              100% { opacity: 0; transform: scale(1.08); }
            }
            @keyframes goldenWingLeft {
              0%   { opacity: 0; transform: translateX(40px) scaleX(0.3); }
              35%  { opacity: 1; transform: translateX(0) scaleX(1.15); }
              55%  { transform: translateX(0) scaleX(0.95); }
              75%  { transform: translateX(0) scaleX(1.05); }
              90%  { opacity: 1; transform: translateX(0) scaleX(1); }
              100% { opacity: 0; transform: translateX(-8px) scaleX(1); }
            }
            @keyframes goldenWingRight {
              0%   { opacity: 0; transform: translateX(-40px) scaleX(0.3); }
              35%  { opacity: 1; transform: translateX(0) scaleX(1.15); }
              55%  { transform: translateX(0) scaleX(0.95); }
              75%  { transform: translateX(0) scaleX(1.05); }
              90%  { opacity: 1; transform: translateX(0) scaleX(1); }
              100% { opacity: 0; transform: translateX(8px) scaleX(1); }
            }
            @keyframes goldenWingsSpark {
              0%   { opacity: 0; transform: translate(0,0) scale(0.4); }
              30%  { opacity: 1; }
              100% { opacity: 0; transform: translate(var(--gwDx), var(--gwDy)) scale(0.3); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  // ── Null Zone ────────────────────────────────────────────────────
  // Purple cosmic void that opens on every affected target: a dark
  // event-horizon disc, concentric violet spiral rings, and a swarm of
  // stars / sparkles getting sucked inward. Signals "your effects and
  // spells are erased into the void."
  null_zone_spiral: (() => {
    return function NullZoneSpiralEffect({ x, y, w, h }) {
      const cw = w || 100;
      const ch = h || 140;
      const rings = useMemo(() => Array.from({ length: 7 }, (_, i) => ({
        radius: 18 + i * 14,
        delay: i * 55,
        dur: 1000 - i * 40,
        opacity: 1 - i * 0.08,
        width: 3 - i * 0.22,
      })), []);
      const stars = useMemo(() => Array.from({ length: 22 }, (_, i) => ({
        angle: (i / 22) * 360 + Math.random() * 20,
        dist: 40 + Math.random() * 55,
        delay: 80 + Math.random() * 400,
        dur: 750 + Math.random() * 350,
        size: 5 + Math.random() * 7,
        char: ['✦','✧','⋆','∗','✺','·'][Math.floor(Math.random() * 6)],
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Dark violet haze filling the target area */}
          <div style={{
            position: 'absolute',
            left: -cw / 2 - 10, top: -ch / 2 - 10,
            width: cw + 20, height: ch + 20, borderRadius: 8,
            background: 'radial-gradient(ellipse at center, rgba(70,10,120,0.75) 0%, rgba(90,25,160,0.55) 40%, rgba(40,5,80,0.25) 75%, transparent 100%)',
            filter: 'blur(3px)',
            opacity: 0,
            animation: 'nullZoneHaze 1100ms ease-in-out 100ms forwards',
          }} />
          {/* Event-horizon disc at the center */}
          <div style={{
            position: 'absolute', left: -32, top: -32,
            width: 64, height: 64, borderRadius: '50%',
            background: 'radial-gradient(circle, #0b0014 0%, #2a0845 45%, rgba(90,20,160,0.6) 75%, transparent 100%)',
            boxShadow: '0 0 28px rgba(140,60,220,0.85), inset 0 0 20px rgba(30,0,60,0.9)',
            opacity: 0,
            animation: 'nullZoneCore 1100ms ease-out 150ms forwards',
          }} />
          {/* Concentric violet rings collapsing toward the core */}
          {rings.map((r, i) => (
            <div key={'nzr'+i} style={{
              position: 'absolute', left: -r.radius, top: -r.radius,
              width: r.radius * 2, height: r.radius * 2,
              border: `${r.width}px solid rgba(170,80,240,${r.opacity})`,
              borderRadius: '50%', opacity: 0,
              boxShadow: `0 0 ${6 + i * 3}px rgba(180,100,255,${r.opacity * 0.65}), inset 0 0 ${4 + i * 2}px rgba(210,150,255,${r.opacity * 0.35})`,
              animation: `nullZoneSpin ${r.dur}ms ease-in ${r.delay}ms forwards`,
            }} />
          ))}
          {/* Cosmic sparkles being drawn in toward the void */}
          {stars.map((s, i) => {
            const rad = (s.angle * Math.PI) / 180;
            return (
              <span key={'nzs'+i} style={{
                position: 'absolute',
                left: Math.cos(rad) * s.dist - s.size / 2,
                top: Math.sin(rad) * s.dist - s.size / 2,
                fontSize: s.size + 6,
                color: ['#e9d6ff','#c49bff','#a277ff','#ffffff'][i % 4],
                textShadow: '0 0 6px rgba(180,110,255,0.9)',
                opacity: 0,
                animation: `nullZoneStar ${s.dur}ms ease-in ${s.delay}ms forwards`,
                '--nzTx': `${-Math.cos(rad) * s.dist * 0.95}px`,
                '--nzTy': `${-Math.sin(rad) * s.dist * 0.95}px`,
              }}>{s.char}</span>
            );
          })}
          <style>{`
            @keyframes nullZoneSpin {
              0%   { opacity: 0; transform: rotate(0deg) scale(1.8); }
              20%  { opacity: 1; transform: rotate(180deg) scale(1.15); }
              55%  { opacity: 0.85; transform: rotate(540deg) scale(0.5); }
              100% { opacity: 0; transform: rotate(1080deg) scale(0.05); }
            }
            @keyframes nullZoneStar {
              0%   { opacity: 0.9; transform: translate(0,0) rotate(0deg) scale(1); }
              40%  { opacity: 0.9; transform: translate(calc(var(--nzTx)*0.45), calc(var(--nzTy)*0.45)) rotate(180deg) scale(0.75); }
              100% { opacity: 0; transform: translate(var(--nzTx), var(--nzTy)) rotate(540deg) scale(0.05); }
            }
            @keyframes nullZoneCore {
              0%   { opacity: 0; transform: scale(0.15); }
              35%  { opacity: 1; transform: scale(1.05); }
              75%  { opacity: 0.9; transform: scale(0.95); }
              100% { opacity: 0; transform: scale(1.1); }
            }
            @keyframes nullZoneHaze {
              0%   { opacity: 0; }
              40%  { opacity: 1; }
              100% { opacity: 0; }
            }
          `}</style>
        </div>
      );
    };
  })(),

  // ── Victorica — Holy cleanse ──────────────────────────────
  //  Divine radiance burns corruption away. A warm golden-white
  //  flare bursts on the zone, four cross-shaped light rays
  //  sweep outward, and glittering motes of light drift upward.
  //  Plays BEFORE the standard pollution_evaporate, so the token
  //  visibly feels sanctified before it dissipates.
  victorica_holy_cleanse: (() => {
    return function VictoricaHolyCleanseEffect({ x, y, w, h }) {
      const cw = w || 100;
      const ch = h || 140;
      const motes = useMemo(() => Array.from({ length: 14 }, () => {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const dist = 20 + Math.random() * 55;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          size: 3 + Math.random() * 4,
          delay: Math.random() * 300,
          dur: 700 + Math.random() * 300,
        };
      }), []);
      const rays = useMemo(() => [0, 90, 180, 270].map(rot => ({
        rot,
        delay: Math.random() * 80,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10110 }}>
          {/* Radiant golden-white core flash */}
          <div style={{
            position: 'absolute', left: -44, top: -44,
            width: 88, height: 88, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,252,220,1) 0%, rgba(255,235,160,0.95) 30%, rgba(255,200,90,0.7) 60%, transparent 95%)',
            boxShadow: '0 0 40px rgba(255,240,180,0.95), 0 0 80px rgba(255,210,100,0.55)',
            opacity: 0,
            animation: 'vhcCore 900ms ease-out forwards',
          }} />
          {/* Softly expanding halo — feels sanctified */}
          <div style={{
            position: 'absolute',
            left: -cw / 2, top: -ch / 2,
            width: cw, height: ch, borderRadius: 6,
            background: 'radial-gradient(ellipse at center, rgba(255,245,200,0.6) 0%, rgba(255,215,140,0.3) 45%, transparent 80%)',
            opacity: 0,
            animation: 'vhcHalo 1000ms ease-out forwards',
          }} />
          {/* Cross-shaped light rays sweeping outward */}
          {rays.map((r, i) => (
            <div key={'vhr' + i} style={{
              position: 'absolute', left: -4, top: -72,
              width: 8, height: 144,
              background: 'linear-gradient(180deg, transparent 0%, rgba(255,250,220,0.95) 40%, rgba(255,250,220,0.95) 60%, transparent 100%)',
              boxShadow: '0 0 14px rgba(255,240,180,0.9)',
              transform: `rotate(${r.rot}deg)`,
              transformOrigin: '50% 50%',
              opacity: 0,
              animation: `vhcRay 850ms ease-out ${r.delay}ms forwards`,
            }} />
          ))}
          {/* Rising motes of light */}
          {motes.map((m, i) => (
            <div key={'vhm' + i} style={{
              position: 'absolute', left: 0, top: 0,
              width: m.size, height: m.size, borderRadius: '50%',
              background: '#fffae0',
              boxShadow: `0 0 ${m.size + 5}px rgba(255,240,180,0.95)`,
              opacity: 0,
              animation: `vhcMote ${m.dur}ms ease-out ${m.delay}ms forwards`,
              '--vhmDx': m.dx + 'px', '--vhmDy': m.dy + 'px',
            }} />
          ))}
          <style>{`
            @keyframes vhcCore {
              0%   { opacity: 0; transform: scale(0.2); }
              35%  { opacity: 1; transform: scale(1.2); }
              65%  { opacity: 1; transform: scale(1); }
              100% { opacity: 0; transform: scale(1.5); }
            }
            @keyframes vhcHalo {
              0%   { opacity: 0; transform: scale(0.5); }
              45%  { opacity: 0.9; transform: scale(1.05); }
              100% { opacity: 0; transform: scale(1.35); }
            }
            @keyframes vhcRay {
              0%   { opacity: 0; transform: rotate(var(--rot, 0deg)) scaleY(0.2); }
              40%  { opacity: 1; transform: rotate(var(--rot, 0deg)) scaleY(1.1); }
              100% { opacity: 0; transform: rotate(var(--rot, 0deg)) scaleY(1.4); }
            }
            @keyframes vhcMote {
              0%   { opacity: 0; transform: translate(0,0) scale(0.3); }
              35%  { opacity: 1; transform: translate(calc(var(--vhmDx) * 0.4), calc(var(--vhmDy) * 0.4)) scale(1); }
              100% { opacity: 0; transform: translate(var(--vhmDx), var(--vhmDy)) scale(0.3); }
            }
          `}</style>
        </div>
      );
    };
  })(),

  // ── Pollution Piranha — Bite ──────────────────────────────
  //  Two rows of jagged white teeth snap shut across the target
  //  with a quick red splatter behind. Used on summon (chomping
  //  through a Pollution Token as it's devoured) and on the
  //  activated damage effect (feeding on heroes/creatures).
  piranha_bite: (() => {
    return function PiranhaBiteEffect({ x, y, w, h }) {
      const cw = w || 100;
      const ch = h || 140;
      const splats = useMemo(() => Array.from({ length: 8 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 18 + Math.random() * 40;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist + 8,
          size: 6 + Math.random() * 9,
          delay: 150 + Math.random() * 180,
          dur: 500 + Math.random() * 300,
        };
      }), []);
      // 6 teeth per row, top & bottom
      const teeth = useMemo(() => Array.from({ length: 6 }, (_, i) => ({
        x: -38 + i * 15 + (Math.random() - 0.5) * 2,
        sizeW: 11 + Math.random() * 2,
        sizeH: 16 + Math.random() * 5,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10110 }}>
          {/* Red rupture flash */}
          <div style={{
            position: 'absolute', left: -cw / 2 + 4, top: -ch / 2 + 4,
            width: cw - 8, height: ch - 8, borderRadius: 6,
            background: 'radial-gradient(ellipse at center, rgba(200,30,30,0.75) 0%, rgba(120,10,15,0.55) 45%, transparent 80%)',
            opacity: 0,
            animation: 'pbFlash 650ms ease-out forwards',
          }} />
          {/* Top row of teeth — comes down */}
          <div style={{
            position: 'absolute', left: 0, top: 0, width: 0, height: 0,
            transform: 'translateY(-60px)',
            animation: 'pbTopJaw 650ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}>
            {teeth.map((t, i) => (
              <div key={'pbt'+i} style={{
                position: 'absolute',
                left: t.x - t.sizeW / 2, top: 0,
                width: 0, height: 0,
                borderLeft: `${t.sizeW / 2}px solid transparent`,
                borderRight: `${t.sizeW / 2}px solid transparent`,
                borderTop: `${t.sizeH}px solid #fff`,
                filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.9)) drop-shadow(0 2px 3px rgba(120,10,15,0.7))',
              }} />
            ))}
          </div>
          {/* Bottom row of teeth — comes up */}
          <div style={{
            position: 'absolute', left: 0, top: 0, width: 0, height: 0,
            transform: 'translateY(60px)',
            animation: 'pbBotJaw 650ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}>
            {teeth.map((t, i) => (
              <div key={'pbb'+i} style={{
                position: 'absolute',
                left: t.x - t.sizeW / 2, top: -t.sizeH,
                width: 0, height: 0,
                borderLeft: `${t.sizeW / 2}px solid transparent`,
                borderRight: `${t.sizeW / 2}px solid transparent`,
                borderBottom: `${t.sizeH}px solid #fff`,
                filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.9)) drop-shadow(0 -2px 3px rgba(120,10,15,0.7))',
              }} />
            ))}
          </div>
          {/* Blood splatter droplets */}
          {splats.map((s, i) => (
            <div key={'pbs' + i} style={{
              position: 'absolute', left: 0, top: 0,
              width: s.size, height: s.size, borderRadius: '50% 55% 40% 60% / 60% 40% 60% 40%',
              background: 'radial-gradient(circle at 35% 30%, #d62a2a, #700808 70%)',
              boxShadow: '0 0 6px rgba(180,20,20,0.7)',
              opacity: 0,
              animation: `pbSplat ${s.dur}ms ease-out ${s.delay}ms forwards`,
              '--pbsDx': s.dx + 'px', '--pbsDy': s.dy + 'px',
            }} />
          ))}
          <style>{`
            @keyframes pbFlash {
              0%   { opacity: 0; transform: scale(0.6); }
              35%  { opacity: 1; transform: scale(1); }
              100% { opacity: 0; transform: scale(1.1); }
            }
            @keyframes pbTopJaw {
              0%   { transform: translateY(-75px); opacity: 0; }
              30%  { opacity: 1; }
              60%  { transform: translateY(-6px); }
              78%  { transform: translateY(-14px); }
              100% { transform: translateY(-75px); opacity: 0; }
            }
            @keyframes pbBotJaw {
              0%   { transform: translateY(75px); opacity: 0; }
              30%  { opacity: 1; }
              60%  { transform: translateY(6px); }
              78%  { transform: translateY(14px); }
              100% { transform: translateY(75px); opacity: 0; }
            }
            @keyframes pbSplat {
              0%   { opacity: 0; transform: translate(0,0) scale(0.3); }
              30%  { opacity: 1; }
              100% { opacity: 0; transform: translate(var(--pbsDx), var(--pbsDy)) scale(0.7); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  // ── Firewall (Surprise Spell) ────────────────────────────────────
  // Tall wall of flames erupting from the ground around the host Hero
  // who set up the Surprise. Tower of layered flames bursts upward,
  // anchored to the bottom edge of the zone.
  firewall: (() => {
    return function FirewallEffect({ x, y, w, h }) {
      const cw = w || 100;
      const ch = h || 140;
      // Twelve vertical flame columns spanning the width, each rising
      // upward with an independent stagger.
      const cols = useMemo(() => Array.from({ length: 14 }, (_, i) => ({
        offsetX: -cw * 0.55 + (cw * 1.1 / 13) * i + (-6 + Math.random() * 12),
        size:    34 + Math.random() * 20,
        delay:   Math.random() * 220,
        dur:     780 + Math.random() * 320,
        char:    ['🔥','🔥','🔥','🔥','💥','✦'][Math.floor(Math.random() * 6)],
      })), [cw]);
      // Embers shooting upward around the wall.
      const embers = useMemo(() => Array.from({ length: 28 }, () => ({
        offsetX: -cw * 0.55 + Math.random() * cw * 1.1,
        riseY:   -(ch * 0.7 + Math.random() * ch * 1.2),
        size:    4 + Math.random() * 7,
        delay:   Math.random() * 600,
        dur:     500 + Math.random() * 500,
        color:   ['#ff2200','#ff5500','#ff8800','#ffaa00','#ffd700'][Math.floor(Math.random() * 5)],
      })), [cw, ch]);
      // Ground plume — wide hot glow at the base.
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          <div style={{
            position: 'absolute',
            left: -cw * 0.6, top: ch * 0.35,
            width: cw * 1.2, height: 50,
            borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(255,140,0,.85) 0%, rgba(255,60,0,.5) 50%, transparent 80%)',
            opacity: 0,
            animation: 'fwGroundFlash 900ms ease-out forwards',
          }} />
          {cols.map((c, i) => (
            <div key={'fwc'+i} style={{
              position: 'absolute',
              left: c.offsetX + 'px',
              top: ch * 0.45 + 'px',
              fontSize: c.size + 'px',
              opacity: 0,
              filter: 'drop-shadow(0 0 8px rgba(255,120,0,.85)) drop-shadow(0 0 14px rgba(255,60,0,.5))',
              animation: `fwColumnRise ${c.dur}ms ease-out ${c.delay}ms forwards`,
              transformOrigin: '50% 100%',
            }}>{c.char}</div>
          ))}
          {embers.map((e, i) => (
            <div key={'fwe'+i} style={{
              position: 'absolute',
              left: e.offsetX + 'px', top: ch * 0.45 + 'px',
              width: e.size + 'px', height: e.size + 'px',
              borderRadius: '50%',
              background: e.color,
              boxShadow: `0 0 8px ${e.color}`,
              opacity: 0,
              '--fwEy': e.riseY + 'px',
              animation: `fwEmberRise ${e.dur}ms ease-out ${e.delay}ms forwards`,
            }} />
          ))}
          <style>{`
            @keyframes fwGroundFlash {
              0%   { opacity: 0; transform: scaleX(0.3); }
              30%  { opacity: 1; transform: scaleX(1); }
              100% { opacity: 0; transform: scaleX(1.05); }
            }
            @keyframes fwColumnRise {
              0%   { opacity: 0; transform: translateY(20px) scaleY(0.4); }
              25%  { opacity: 1; transform: translateY(-30px) scaleY(1.2); }
              60%  { opacity: 1; transform: translateY(-90px) scaleY(1.6); }
              100% { opacity: 0; transform: translateY(-150px) scaleY(2); }
            }
            @keyframes fwEmberRise {
              0%   { opacity: 0; transform: translate(0, 0); }
              25%  { opacity: 1; }
              100% { opacity: 0; transform: translate(0, var(--fwEy)); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  // ── Cataclysm (Spell) ────────────────────────────────────────────
  // GIANT orange-red burning meteor falling from the top-right of the
  // viewport, smashing into the centre of the battlefield. Routed via
  // play_zone_animation with `heroIdx: -1, zoneSlot: -1` — the dispatch
  // selector falls back to the player's hero row, so we deliberately
  // ignore (x,y) and anchor everything to the viewport ourselves.
  cataclysm: (() => {
    return function CataclysmEffect() {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
      const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
      const startX = vw + 240;     // off-screen top-right
      const startY = -240;
      const endX   = vw / 2;
      const endY   = vh / 2;
      const sparks = useMemo(() => Array.from({ length: 40 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 200;
        return {
          dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
          size: 5 + Math.random() * 9,
          color: ['#ff2200','#ff4400','#ff8800','#ffcc00','#ffaa00','#ff0000'][Math.floor(Math.random() * 6)],
          delay: 1300 + Math.random() * 200,
          dur: 600 + Math.random() * 500,
        };
      }), []);
      const flames = useMemo(() => Array.from({ length: 32 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = 60 + Math.random() * 280;
        return {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist,
          size: 30 + Math.random() * 36,
          delay: 1300 + Math.random() * 250,
          dur: 700 + Math.random() * 500,
          char: ['🔥','🔥','💥','☄️','✦'][Math.floor(Math.random() * 5)],
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
                       pointerEvents: 'none', zIndex: 10200, overflow: 'hidden' }}>
          {/* Meteor — falls from top-right to centre over 1.3s, then explodes */}
          <div style={{
            position: 'absolute',
            left: startX + 'px', top: startY + 'px',
            fontSize: '180px',
            filter: 'drop-shadow(0 0 30px #ff5500) drop-shadow(0 0 60px #ff2200) drop-shadow(0 0 90px #ff0000)',
            '--cataDx': (endX - startX) + 'px',
            '--cataDy': (endY - startY) + 'px',
            animation: 'cataclysmFall 1300ms cubic-bezier(0.4, 0.0, 0.6, 1) forwards',
          }}>☄️</div>
          {/* Trail behind meteor */}
          <div style={{
            position: 'absolute',
            left: startX + 'px', top: startY + 'px',
            width: '0', height: '0',
            '--cataDx': (endX - startX) + 'px',
            '--cataDy': (endY - startY) + 'px',
            animation: 'cataclysmFall 1300ms cubic-bezier(0.4, 0.0, 0.6, 1) forwards',
          }}>
            <div style={{
              position: 'absolute',
              left: '20px', top: '40px',
              width: '380px', height: '12px',
              borderRadius: '6px',
              background: 'linear-gradient(90deg, transparent, rgba(255,90,0,.4) 30%, rgba(255,200,0,.85) 70%, #fff)',
              filter: 'blur(8px)',
              transformOrigin: '100% 50%',
              transform: `rotate(${Math.atan2(endY - startY, endX - startX) * 180 / Math.PI + 180}deg)`,
            }} />
          </div>
          {/* Impact flash — bright white-yellow shockwave */}
          <div style={{
            position: 'absolute',
            left: endX - 250 + 'px', top: endY - 250 + 'px',
            width: '500px', height: '500px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,200,.9) 0%, rgba(255,180,0,.7) 25%, rgba(255,80,0,.4) 55%, transparent 80%)',
            opacity: 0,
            animation: 'cataclysmFlash 900ms ease-out 1300ms forwards',
          }} />
          {/* Outer shockwave */}
          <div style={{
            position: 'absolute',
            left: endX - 50 + 'px', top: endY - 50 + 'px',
            width: '100px', height: '100px',
            border: '8px solid rgba(255,140,0,.8)',
            borderRadius: '50%',
            opacity: 0,
            animation: 'cataclysmShockwave 1100ms ease-out 1300ms forwards',
          }} />
          {/* Lingering flames at impact */}
          {flames.map((f, i) => (
            <div key={'cat-f'+i} style={{
              position: 'absolute',
              left: endX + f.x + 'px', top: endY + f.y + 'px',
              fontSize: f.size + 'px',
              opacity: 0,
              filter: 'drop-shadow(0 0 6px #ff4400)',
              animation: `cataclysmEmber ${f.dur}ms ease-out ${f.delay}ms forwards`,
            }}>{f.char}</div>
          ))}
          {/* Outward-flying sparks */}
          {sparks.map((s, i) => (
            <div key={'cat-s'+i} style={{
              position: 'absolute',
              left: endX + 'px', top: endY + 'px',
              width: s.size + 'px', height: s.size + 'px',
              borderRadius: '50%',
              background: s.color,
              boxShadow: `0 0 10px ${s.color}`,
              opacity: 0,
              '--cataSx': s.dx + 'px',
              '--cataSy': s.dy + 'px',
              animation: `cataclysmSpark ${s.dur}ms ease-out ${s.delay}ms forwards`,
            }} />
          ))}
          <style>{`
            @keyframes cataclysmFall {
              0%   { transform: translate(0, 0) rotate(0deg); }
              100% { transform: translate(var(--cataDx), var(--cataDy)) rotate(180deg); }
            }
            @keyframes cataclysmFlash {
              0%   { opacity: 0; transform: scale(0.2); }
              25%  { opacity: 1; transform: scale(1); }
              100% { opacity: 0; transform: scale(1.5); }
            }
            @keyframes cataclysmShockwave {
              0%   { opacity: 0.9; transform: scale(0.4); border-width: 8px; }
              100% { opacity: 0;   transform: scale(8);   border-width: 1px; }
            }
            @keyframes cataclysmEmber {
              0%   { opacity: 0; transform: scale(0.3); }
              25%  { opacity: 1; transform: scale(1.2); }
              100% { opacity: 0; transform: scale(0.7) translateY(20px); }
            }
            @keyframes cataclysmSpark {
              0%   { opacity: 0; transform: translate(0, 0) scale(0.4); }
              20%  { opacity: 1; transform: translate(calc(var(--cataSx) * 0.2), calc(var(--cataSy) * 0.2)) scale(1); }
              100% { opacity: 0; transform: translate(var(--cataSx), var(--cataSy)) scale(0.5); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  // ── Sacrifice (Sacrifice to Divinity, future tribute cards) ────────
  // A dagger plunges down into the target zone, pauses on contact, and
  // a small spray of blood droplets bursts outward. Composes the same
  // particle / shockwave primitives the rest of the registry uses.
  knife_sacrifice: (() => {
    return function KnifeSacrificeEffect({ x, y }) {
      const droplets = useMemo(() => Array.from({ length: 14 }, () => {
        const angle = -Math.PI + Math.random() * Math.PI; // -180° to 0°: outward + upward
        const speed = 28 + Math.random() * 36;
        return {
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed * 0.5 + 8 + Math.random() * 12,
          size: 4 + Math.random() * 5,
          delay: 380 + Math.random() * 120,
          dur: 380 + Math.random() * 220,
          color: ['#a01010', '#c01818', '#7f0808', '#d62a2a'][Math.floor(Math.random() * 4)],
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Dagger — falls from ~80px above to the centre, then sticks */}
          <div style={{
            position: 'absolute', left: -20, top: 0,
            fontSize: 56, lineHeight: '40px',
            filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.85)) drop-shadow(0 0 3px rgba(255,255,255,0.4))',
            animation: 'knifeSacPlunge 480ms cubic-bezier(0.4, 0, 0.85, 1) forwards',
          }}>🗡️</div>
          {/* Impact flash + dust ring on contact */}
          <div style={{
            position: 'absolute', left: -28, top: -4,
            width: 56, height: 56, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(255,200,200,0.4) 40%, transparent 75%)',
            opacity: 0,
            animation: 'knifeSacImpact 320ms ease-out 380ms forwards',
          }} />
          {/* Outer crimson shockwave */}
          <div style={{
            position: 'absolute', left: -16, top: -2,
            width: 32, height: 32, borderRadius: '50%',
            border: '3px solid rgba(180, 20, 20, 0.85)',
            opacity: 0,
            animation: 'knifeSacShockwave 480ms ease-out 380ms forwards',
          }} />
          {/* Blood droplets — burst outward from the impact point */}
          {droplets.map((d, i) => (
            <div key={'kbd' + i} style={{
              position: 'absolute', left: 0, top: 0,
              width: d.size + 'px', height: d.size + 'px',
              borderRadius: '50% 55% 40% 60% / 60% 40% 60% 40%',
              background: `radial-gradient(circle at 35% 30%, ${d.color}, ${d.color}aa 70%)`,
              boxShadow: `0 0 ${d.size * 1.5}px ${d.color}88`,
              opacity: 0,
              '--ksDx': d.dx + 'px',
              '--ksDy': d.dy + 'px',
              animation: `knifeSacDroplet ${d.dur}ms ease-out ${d.delay}ms forwards`,
            }} />
          ))}
          <style>{`
            @keyframes knifeSacPlunge {
              0%   { transform: translate(0, -90px) rotate(20deg); opacity: 0; }
              25%  { transform: translate(0, -45px) rotate(15deg); opacity: 1; }
              80%  { transform: translate(0, 4px)   rotate(0deg);  opacity: 1; }
              100% { transform: translate(0, 6px)   rotate(0deg);  opacity: 1; }
            }
            @keyframes knifeSacImpact {
              0%   { opacity: 0; transform: scale(0.4); }
              30%  { opacity: 1; transform: scale(1.1); }
              100% { opacity: 0; transform: scale(1.6); }
            }
            @keyframes knifeSacShockwave {
              0%   { opacity: 0.95; transform: scale(0.5); border-width: 3px; }
              100% { opacity: 0; transform: scale(3.2); border-width: 0.5px; }
            }
            @keyframes knifeSacDroplet {
              0%   { opacity: 0; transform: translate(0, 0) scale(0.3); }
              25%  { opacity: 1; transform: translate(calc(var(--ksDx) * 0.3), calc(var(--ksDy) * 0.3)) scale(1); }
              100% { opacity: 0; transform: translate(var(--ksDx), var(--ksDy)) scale(0.6); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  // ── Hell Fox death: black-flame eruption ───────────────────────────
  // When a Hell Fox is defeated, a column of pitch-black flames erupts
  // from its support slot. Stacks a few jagged flame sprites with
  // upward jitter + a brief shadow halo so the eruption reads as
  // hellish rather than ordinary fire.
  hell_fox_death: (() => {
    return function HellFoxDeathEffect({ x, y }) {
      const flames = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
        startX: -22 + Math.random() * 44,
        riseY:  -(60 + Math.random() * 70),
        scale:  0.7 + Math.random() * 0.7,
        delay:  i * 28 + Math.random() * 90,
        dur:    520 + Math.random() * 320,
        glyph:  ['🔥', '🔥', '🜲', '∆'][Math.floor(Math.random() * 4)],
      })), []);
      const sparks = useMemo(() => Array.from({ length: 22 }, () => {
        const angle = -Math.PI + Math.random() * Math.PI;
        const speed = 26 + Math.random() * 36;
        return {
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed * 0.6 - 6,
          size: 3 + Math.random() * 4,
          delay: 60 + Math.random() * 280,
          dur: 460 + Math.random() * 260,
        };
      }), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Ground halo — deep crimson-into-black ring on the slot. */}
          <div style={{
            position: 'absolute', left: -42, top: -18,
            width: 84, height: 36, borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(60,0,0,0.85) 0%, rgba(20,0,0,0.7) 50%, rgba(0,0,0,0) 90%)',
            filter: 'blur(2px)',
            opacity: 0,
            animation: 'hellFoxHalo 760ms ease-out forwards',
          }} />
          {/* Black flame sprites — each is a darkened emoji + crimson
              under-glow that rises and dissipates. We stack 'em close to
              the centre so the column reads as one belching pyre. */}
          {flames.map((f, i) => (
            <div key={'hff' + i} style={{
              position: 'absolute',
              left: f.startX,
              top: 0,
              fontSize: 32 * f.scale,
              lineHeight: '32px',
              filter: 'brightness(0.35) drop-shadow(0 0 6px rgba(120,0,0,0.95)) drop-shadow(0 0 14px rgba(180,0,0,0.5))',
              '--hffRise': f.riseY + 'px',
              opacity: 0,
              animation: `hellFoxFlame ${f.dur}ms ease-out ${f.delay}ms forwards`,
            }}>{f.glyph}</div>
          ))}
          {/* Crimson sparks — outward burst on impact. */}
          {sparks.map((s, i) => (
            <div key={'hfs' + i} style={{
              position: 'absolute', left: 0, top: 0,
              width: s.size + 'px', height: s.size + 'px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #ff3030 0%, #c00000 60%, transparent 100%)',
              boxShadow: '0 0 8px #c00000aa',
              '--hfsDx': s.dx + 'px',
              '--hfsDy': s.dy + 'px',
              opacity: 0,
              animation: `hellFoxSpark ${s.dur}ms ease-out ${s.delay}ms forwards`,
            }} />
          ))}
          <style>{`
            @keyframes hellFoxHalo {
              0%   { opacity: 0; transform: scale(0.4); }
              25%  { opacity: 1; transform: scale(1); }
              100% { opacity: 0; transform: scale(1.6); }
            }
            @keyframes hellFoxFlame {
              0%   { opacity: 0; transform: translate(0, 16px) scale(0.5); }
              30%  { opacity: 1; transform: translate(0, calc(var(--hffRise) * 0.35)) scale(1); }
              100% { opacity: 0; transform: translate(0, var(--hffRise)) scale(0.7); }
            }
            @keyframes hellFoxSpark {
              0%   { opacity: 0; transform: translate(0, 0) scale(0.4); }
              25%  { opacity: 1; transform: translate(calc(var(--hfsDx) * 0.3), calc(var(--hfsDy) * 0.3)) scale(1); }
              100% { opacity: 0; transform: translate(var(--hfsDx), var(--hfsDy)) scale(0.5); }
            }
          `}</style>
        </div>
      );
    };
  })(),
  // ── Dog bite (Loyal Terrier, future fang-tribe cards) ──────────────
  // Two fang silhouettes snap shut on the target's slot, paired with a
  // shock-line halo and a couple of saliva droplets that fly outward
  // post-impact. Mirrors the knife_sacrifice / punch_impact tempo so
  // the existing ZONE_ANIM_SFX system can hook a bark / chomp later
  // without re-tuning timing.
  dog_bite: (() => {
    return function DogBiteEffect({ x, y }) {
      const drops = useMemo(() => Array.from({ length: 10 }, () => {
        const angle = -Math.PI + Math.random() * Math.PI; // upward arc
        const speed = 24 + Math.random() * 28;
        return {
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed * 0.55 + 6 + Math.random() * 8,
          size: 3 + Math.random() * 3,
          delay: 220 + Math.random() * 140,
          dur: 320 + Math.random() * 200,
        };
      }), []);
      const shockLines = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
        rot: -90 + i * 22.5 + (Math.random() * 14 - 7),
        len: 22 + Math.random() * 14,
        delay: 200 + Math.random() * 80,
      })), []);
      return (
        <div style={{ position: 'fixed', left: x, top: y, pointerEvents: 'none', zIndex: 10100 }}>
          {/* Top fang — descends from upper-left, rotates to bite */}
          <div style={{
            position: 'absolute', left: -20, top: -28,
            fontSize: 38, lineHeight: '32px',
            filter: 'drop-shadow(0 0 4px rgba(40,20,10,0.8))',
            transformOrigin: '60% 90%',
            animation: 'dogBiteTopFang 360ms cubic-bezier(0.4, 0, 0.85, 1) forwards',
          }}>🦷</div>
          {/* Bottom fang — descends from lower-right, mirrored. Using
              the same tooth glyph rotated 180° with `scaleY(-1)` to
              make the bite read as upper + lower jaw closing. */}
          <div style={{
            position: 'absolute', left: -2, top: 4,
            fontSize: 38, lineHeight: '32px',
            filter: 'drop-shadow(0 0 4px rgba(40,20,10,0.8))',
            transform: 'scaleY(-1)',
            transformOrigin: '40% 10%',
            animation: 'dogBiteBottomFang 360ms cubic-bezier(0.4, 0, 0.85, 1) forwards',
          }}>🦷</div>
          {/* Impact flash — quick pale flash at the bite point. */}
          <div style={{
            position: 'absolute', left: -22, top: -12,
            width: 44, height: 32, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,235,200,0.85) 0%, rgba(255,200,140,0.35) 50%, transparent 80%)',
            opacity: 0,
            animation: 'dogBiteImpact 280ms ease-out 320ms forwards',
          }} />
          {/* Shock-line halo — short rays radiating outward from the
              bite at impact, sells the pinch. */}
          {shockLines.map((s, i) => (
            <div key={'dbs' + i} style={{
              position: 'absolute', left: -1, top: -1,
              width: s.len + 'px', height: 2,
              background: 'linear-gradient(90deg, rgba(70,40,20,0.95), rgba(70,40,20,0))',
              transform: `rotate(${s.rot}deg)`,
              transformOrigin: '0 50%',
              opacity: 0,
              animation: `dogBiteShock 280ms ease-out ${s.delay}ms forwards`,
            }} />
          ))}
          {/* Saliva / fur droplets bursting outward post-impact. */}
          {drops.map((d, i) => (
            <div key={'dbd' + i} style={{
              position: 'absolute', left: 0, top: 0,
              width: d.size + 'px', height: d.size + 'px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #f5f1d8 0%, #cfc7a0 70%, transparent 100%)',
              boxShadow: '0 0 4px rgba(220,210,170,0.7)',
              opacity: 0,
              '--dbDx': d.dx + 'px',
              '--dbDy': d.dy + 'px',
              animation: `dogBiteDroplet ${d.dur}ms ease-out ${d.delay}ms forwards`,
            }} />
          ))}
          <style>{`
            @keyframes dogBiteTopFang {
              0%   { opacity: 0; transform: translate(-26px, -28px) rotate(-25deg); }
              50%  { opacity: 1; transform: translate(-6px, -8px) rotate(-8deg); }
              80%  { opacity: 1; transform: translate(0, 0) rotate(0deg); }
              100% { opacity: 0; transform: translate(0, 0) rotate(2deg); }
            }
            @keyframes dogBiteBottomFang {
              0%   { opacity: 0; transform: scaleY(-1) translate(22px, -28px) rotate(28deg); }
              50%  { opacity: 1; transform: scaleY(-1) translate(6px, -10px) rotate(10deg); }
              80%  { opacity: 1; transform: scaleY(-1) translate(0, -2px) rotate(0deg); }
              100% { opacity: 0; transform: scaleY(-1) translate(0, -2px) rotate(-2deg); }
            }
            @keyframes dogBiteImpact {
              0%   { opacity: 0; transform: scale(0.4); }
              35%  { opacity: 1; transform: scale(1.2); }
              100% { opacity: 0; transform: scale(1.6); }
            }
            @keyframes dogBiteShock {
              0%   { opacity: 0; transform: rotate(var(--rot, 0deg)) scaleX(0.2); }
              40%  { opacity: 0.95; transform: rotate(var(--rot, 0deg)) scaleX(1); }
              100% { opacity: 0; transform: rotate(var(--rot, 0deg)) scaleX(1.3); }
            }
            @keyframes dogBiteDroplet {
              0%   { opacity: 0; transform: translate(0, 0) scale(0.4); }
              25%  { opacity: 1; transform: translate(calc(var(--dbDx) * 0.3), calc(var(--dbDy) * 0.3)) scale(1); }
              100% { opacity: 0; transform: translate(var(--dbDx), var(--dbDy)) scale(0.6); }
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
// Dropdown variant of the generic Option Picker prompt. Used when a prompt
// has many scalar choices (Siphem spending 1..N counters) and the usual
// stack of wide buttons would eat too much vertical space.
function OptionPickerDropdown({ ep, respondToPrompt }) {
  const options = ep.options || [];
  const [selectedId, setSelectedId] = useState(options[0]?.id || '');
  const confirm = () => {
    if (!selectedId) return;
    respondToPrompt({ optionId: selectedId });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <select value={selectedId} onChange={e => setSelectedId(e.target.value)} autoFocus
        style={{
          width: '100%', padding: '8px 12px', fontSize: 13,
          background: 'var(--bg2)', border: '1px solid var(--accent)', borderRadius: 6,
          color: 'var(--text1)', outline: 'none', boxSizing: 'border-box', cursor: 'pointer',
        }}>
        {options.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" style={{ flex: 1, padding: '10px 18px', fontSize: 12, borderColor: 'var(--accent)', color: 'var(--accent)' }}
          onClick={confirm}>{ep.confirmLabel || 'Confirm'}</button>
        {ep.cancellable !== false && (
          <button className="btn" style={{ padding: '10px 18px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)' }}
            onClick={() => respondToPrompt({ cancelled: true })}>Cancel (Esc)</button>
        )}
      </div>
    </div>
  );
}

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
  // `ep.minSelect` was previously guarded by a falsy `||` check, which
  // turned a legitimate `minSelect: 0` into the `maxSelect` fallback —
  // forcing "select all" and making the confirm button impossible to
  // enable unless every card was picked. Use explicit null-check instead.
  const minSelect = ep.minSelect != null ? ep.minSelect : (ep.maxBudget != null ? 1 : maxSelect);
  const maxBudget = ep.maxBudget;
  const costKey = ep.costKey || 'cost';
  // Track selections by gallery INDEX rather than card name so duplicate
  // names (e.g. Spontaneous Reappearance showing 3 copies of the same
  // card in the discard pile) can be checked / unchecked independently.
  // We map back to `{ selectedCards: [names] }` at response time so all
  // existing callers that read names out of the response keep working.
  const [selected, setSelected] = useState([]);

  const totalCost = maxBudget != null
    ? selected.reduce((sum, idx) => sum + (cards[idx]?.[costKey] || 0), 0)
    : 0;

  const toggleCard = (idx) => {
    setSelected(prev => {
      if (prev.includes(idx)) {
        if (window.playSFX) window.playSFX('ui_click');
        return prev.filter(i => i !== idx);
      }
      if (prev.length >= maxSelect) return prev;
      // Budget check
      if (maxBudget != null) {
        const entryCost = cards[idx]?.[costKey] || 0;
        const currentTotal = prev.reduce((sum, i) => sum + (cards[i]?.[costKey] || 0), 0);
        if (currentTotal + entryCost > maxBudget) return prev;
      }
      if (window.playSFX) window.playSFX('ui_click');
      return [...prev, idx];
    });
  };

  const canConfirm = selected.length >= minSelect && selected.length <= maxSelect;

  const confirmSelection = () => {
    onRespond({ selectedCards: selected.map(i => cards[i]?.name).filter(Boolean) });
  };

  // Enter/Space confirms selection
  useEffect(() => {
    if (!canConfirm) return;
    const handleKey = (e) => {
      if (e.key !== 'Enter' && e.code !== 'Space') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      confirmSelection();
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              const isSel = selected.includes(i);
              const entryCost = entry[costKey] || 0;
              const wouldExceedBudget = maxBudget != null && !isSel && totalCost + entryCost > maxBudget;
              const atMax = !isSel && selected.length >= maxSelect;
              const dimmed = wouldExceedBudget || atMax;
              return (
                <div key={entry.name + '-' + i} style={{ position: 'relative' }}>
                  <CardMini card={card}
                    onClick={dimmed ? undefined : () => toggleCard(i)}
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
            onClick={confirmSelection}>
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
  const resultSfxPlayedRef = useRef(false);
  const oppLeft = opp.left || false;
  const oppDisconnected = opp.disconnected || false;
  const meDisconnected = me.disconnected || false;
  const myRematchSent = !isSpectator && (gameState.rematchRequests || []).includes(user.id);

  // ── Tutorial outro: show textbox before victory screen ──
  const [tutorialOutroPending, setTutorialOutroPending] = useState(false);
  const [resultFading, setResultFading] = useState(false);
  const tutorialOutroFiredRef = useRef(null);
  // Synchronous mirror of tutorialOutroPending — written alongside the
  // setState call so other effects running in the same commit can see the
  // gate without waiting for the next render (React batches setState, but
  // refs update immediately). The fanfare SFX effect consults this.
  const outroPendingRef = useRef(false);
  useEffect(() => {
    if (!result || !result.isTutorial || result.puzzleResult !== 'success') return;
    const num = window._currentTutorialNum;
    if (!num || tutorialOutroFiredRef.current === num) return;
    const script = (window.TUTORIAL_SCRIPTS || {})[num];
    if (script?.outro) {
      tutorialOutroFiredRef.current = num;
      outroPendingRef.current = true;
      setTutorialOutroPending(true);
      setTimeout(() => {
        const outroPages = Array.isArray(script.outro) ? script.outro : undefined;
        const outroText = typeof script.outro === 'string' ? script.outro : undefined;
        showTextBox({
          speaker: '/MoniaBot.png',
          speakerName: 'Monia Bot',
          ...(outroPages ? { pages: outroPages } : { text: outroText }),
          ...(script.opts || {}),
          onDismiss: () => { outroPendingRef.current = false; setTutorialOutroPending(false); },
        });
      }, 300);
    }
  }, [result]);

  // Victory / defeat fanfare — fires exactly once when result first appears.
  // Spectators get the victory cue (neutral-positive) regardless of winner.
  // For tutorials with an outro textbox, delay the fanfare until that
  // textbox closes so it doesn't overlap the Monia Bot dialogue.
  //
  // We check outroPendingRef (synchronous) rather than the state flag,
  // because on the initial `result` commit both the outro effect and this
  // one run back-to-back: the outro effect queues setState(true) but the
  // state hasn't applied yet by the time this effect reads it. The ref
  // has already been set inside the outro effect, so it's the reliable
  // gate for this same-commit timing.
  useEffect(() => {
    if (!result || resultSfxPlayedRef.current) return;
    if (outroPendingRef.current) return;
    resultSfxPlayedRef.current = true;
    const sfx = isSpectator ? 'victory' : (iWon ? 'victory' : 'defeat');
    if (window.playSFX) window.playSFX(sfx);
  }, [result, iWon, isSpectator, tutorialOutroPending]);

  // ── Shared board tooltip (single instance, driven by BoardCard/CardRevealEntry) ──
  const { tooltipCard, setTooltipCard } = useCardTooltip({
    hoverSelectors: '.board-card:hover, .card-reveal-entry:hover, .card-mini:hover, .card-name-picker-row:hover, .revealed-hand-card:hover, .status-badge:hover, .buff-icon:hover, .option-tooltip-hover:hover',
  });

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
    const container = boardCenterRef.current;
    if (!container) return;
    const measure = () => {
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
    // Defer the initial measure one frame so the board auto-scaling
    // ResizeObserver (defined in the effect below) has a chance to apply
    // its scale before we compute area-zone positions. Without this, the
    // first measure runs at scale=1 and the zones visibly "snap" to the
    // real scaled position once setTimeout(200) fires.
    const raf1 = requestAnimationFrame(() => {
      measure();
      // Second rAF catches any trailing layout from the scale ResizeObserver.
      requestAnimationFrame(measure);
    });
    // ResizeObserver on the board container AND the first hero zone so
    // any later scale change (window resize, device orientation) triggers
    // an immediate remeasure rather than waiting for the setTimeout tail.
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    const firstHero = container.querySelector('[data-hero-owner="me"][data-hero-zone]');
    if (firstHero) ro.observe(firstHero);
    window.addEventListener('resize', measure);
    const timer = setTimeout(measure, 200);
    return () => {
      cancelAnimationFrame(raf1);
      ro.disconnect();
      window.removeEventListener('resize', measure);
      clearTimeout(timer);
    };
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
  const prevRoomIdRef = useRef(gameState.roomId);
  const prevDeckCountRef = useRef(me.deckCount || 0);
  const prevPotionDeckCountRef = useRef(me.potionDeckCount || 0);
  // Tracked specifically for the hand-grew watcher — distinguishes "discard
  // shrank → card reclaimed into hand" (Spontaneous Reappearance, etc.)
  // from "deck shrank → normal draw" and "no pile change → steal from
  // opponent." Owns its own ref so it doesn't collide with the hand→pile
  // auto-animation's separate discard-length tracking further down.
  const prevHandDiscardLenRef = useRef((me.discardPile || []).length);
  const roomJustChanged = gameState.roomId !== prevRoomIdRef.current;
  // On retry/new game (roomId changes), reset hand length tracking to suppress draw animations
  if (roomJustChanged) {
    prevRoomIdRef.current = gameState.roomId;
    prevHandLenRef.current = (me.hand || []).length;
    prevDeckCountRef.current = me.deckCount || 0;
    prevPotionDeckCountRef.current = me.potionDeckCount || 0;
    prevHandDiscardLenRef.current = (me.discardPile || []).length;
  }
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
      const newDeckCount = me.deckCount || 0;
      const newPotionCount = me.potionDeckCount || 0;
      const deckDecreased = newDeckCount < prevDeckCountRef.current || newPotionCount < prevPotionDeckCountRef.current;
      const newDiscardLenForHand = (me.discardPile || []).length;
      const discardDecreased = newDiscardLenForHand < prevHandDiscardLenRef.current;
      prevDeckCountRef.current = newDeckCount;
      prevPotionDeckCountRef.current = newPotionCount;
      prevHandDiscardLenRef.current = newDiscardLenForHand;
      // Pile-transfer handshake: every card arriving via a server-driven
      // `play_pile_transfer` (Deepsea bounce, Castle swap, Monstrosity
      // second-bounce, Shu'Chaku artifact return, etc.) already has its
      // own flying-card animation. Consume one slot of the pending
      // counter per new hand card and skip the auto branches below.
      const delta = newHand.length - prevLen;
      if (delta > 0 && pileTransferToHandPendingMeRef.current > 0) {
        pileTransferToHandPendingMeRef.current = Math.max(0, pileTransferToHandPendingMeRef.current - delta);
        prevHandLenRef.current = newHand.length;
        return;
      }
      // Length-neutral hand change with a pending pile-transfer-to-hand —
      // this is the Deepsea bounce-place swap: hand contents changed
      // (bounced creature in, played creature out) but the length stayed
      // the same. No auto-draw phantom would fire here (it's gated on
      // delta > 0), but we still have to burn the credit so the NEXT
      // genuine hand-grew event (e.g. Deepsea Witch's on-summon tutor)
      // isn't wrongly muted by the handshake block above.
      if (delta <= 0 && pileTransferToHandPendingMeRef.current > 0) {
        pileTransferToHandPendingMeRef.current = Math.max(0, pileTransferToHandPendingMeRef.current - 1);
      }
      if (newHand.length > prevLen && !stealInProgressRef.current && deckDecreased) {
        // If cards arrived via steal, skip draw animation for them
        const skipCount = stealSkipDrawRef.current;
        if (skipCount > 0) {
          stealSkipDrawRef.current = 0;
        } else {
        // Play the draw cue per card. This catches server-side paths that
        // bypass engine.log('draw') — namely the initial-mulligan redraw
        // (server.js shifts cards directly from mainDeck/potionDeck). For
        // normal engine-driven draws, the `draw` log already fires its
        // SFX; the 80ms dedupe suppresses the duplicate here.
        if (window.playSFX) {
          for (let i = prevLen; i < newHand.length; i++) {
            setTimeout(() => window.playSFX('draw', { dedupe: 80 }), (i - prevLen) * 80);
          }
        }
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
      } else if (newHand.length > prevLen && !stealInProgressRef.current && !deckDecreased && discardDecreased) {
        // Cards reclaimed from the discard pile into hand (Spontaneous
        // Reappearance, etc.) — animate from the discard pile rect so
        // every returned card visibly flies out of discard into its
        // new hand slot, matching the draw-from-deck animation's arc.
        const discardEl = document.querySelector('[data-my-discard]');
        const discardRect = discardEl?.getBoundingClientRect();
        if (discardRect) {
          const newAnims = [];
          for (let i = prevLen; i < newHand.length; i++) {
            newAnims.push({
              id: Date.now() + Math.random() + i,
              cardName: newHand[i],
              origIdx: i,
              startX: discardRect.left + discardRect.width / 2 - 32,
              startY: discardRect.top + discardRect.height / 2 - 45,
            });
          }
          setDrawAnimCards(prev => [...prev, ...newAnims]);
          setTimeout(() => {
            setDrawAnimCards(prev => prev.filter(a => !newAnims.some(n => n.id === a.id)));
          }, 500);
        }
      } else if (newHand.length > prevLen && !stealInProgressRef.current && !deckDecreased) {
        // Cards arrived without deck or discard changing — likely stolen from
        // opponent's hand. Animate from opponent's hand area.
        const oppHandEl = document.querySelector('.game-hand-opp .game-hand-cards');
        const oppRect = oppHandEl?.getBoundingClientRect();
        if (oppRect) {
          const newAnims = [];
          for (let i = prevLen; i < newHand.length; i++) {
            newAnims.push({
              id: Date.now() + Math.random() + i,
              cardName: newHand[i],
              origIdx: i,
              startX: oppRect.left + oppRect.width / 2 - 32,
              startY: oppRect.top + oppRect.height / 2 - 45,
            });
          }
          setDrawAnimCards(prev => [...prev, ...newAnims]);
          setTimeout(() => {
            setDrawAnimCards(prev => prev.filter(a => !newAnims.some(n => n.id === a.id)));
          }, 500);
        }
      }
      prevHandLenRef.current = newHand.length;
    }
  }, [me.hand, me.handCount]);

  // Opponent draw animation tracking
  const [oppDrawAnims, setOppDrawAnims] = useState([]);
  const [oppDrawHidden, setOppDrawHidden] = useState(new Set()); // indices to hide during anim
  // Bounce-return animation tracking — keys are `${owner}-${handIdx}`.
  // Hand slot matching this key stays invisible while the flying card is
  // still in flight (support→hand pile-transfer animation). Cleared
  // slightly AFTER the 700ms keyframe so the reveal aligns with the
  // landing moment.
  const [bounceReturnHidden, setBounceReturnHidden] = useState(new Set());
  // Bounce-outgoing animation tracking — keys are `${owner}-${heroIdx}-${slotIdx}`.
  // Support-slot card matching this key stays invisible while the flying
  // card is inbound from hand (hand→support pile-transfer). Paired with
  // bounceReturnHidden to achieve the visual crossing of Deepsea/Castle
  // swaps — old creature flies out while new creature flies in.
  const [bounceOutgoingHidden, setBounceOutgoingHidden] = useState(new Set());
  const prevOppHandCountRef = useRef(opp.handCount || 0);
  if (roomJustChanged) prevOppHandCountRef.current = opp.handCount || 0;
  useEffect(() => {
    const newCount = opp.handCount || 0;
    const prevCount = prevOppHandCountRef.current;
    // Pile-transfer handshake (opponent view): cards arriving via a
    // server-driven `play_pile_transfer` already animate; consume one
    // suppression slot per new hand card and skip the deck auto-anim.
    const oppDelta = newCount - prevCount;
    if (oppDelta > 0 && pileTransferToHandPendingOppRef.current > 0) {
      pileTransferToHandPendingOppRef.current = Math.max(0, pileTransferToHandPendingOppRef.current - oppDelta);
      prevOppHandCountRef.current = newCount;
      return;
    }
    if (newCount > prevCount && !stealInProgressRef.current) {
      // Draw cue per new opp card. For engine-driven draws the `draw`
      // action log already fired this sound via the dispatcher — the
      // 80ms dedupe collapses the duplicate. The initial-mulligan redraw
      // (server.js shifts cards directly without logging) relies on this
      // block to make the sound audible at all.
      if (window.playSFX) {
        for (let i = 0; i < newCount - prevCount; i++) {
          setTimeout(() => window.playSFX('draw', { dedupe: 80 }), i * 80);
        }
      }
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
  const [tempesteRainInsts, setTempesteRainInsts] = useState([]); // Active Prophecy of Tempeste instance ids — one rain overlay per
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

        // 2. Deck→pile handshake: drop names already animated by the
        //    server's deck_to_discard broadcast so they don't get a
        //    duplicate phantom flight from a matching board card.
        const pendingMe = deckToDiscardPendingMeRef.current;
        for (let i = newDiscardEntries.length - 1; i >= 0; i--) {
          const pIdx = pendingMe.discard.indexOf(newDiscardEntries[i]);
          if (pIdx >= 0) { pendingMe.discard.splice(pIdx, 1); newDiscardEntries.splice(i, 1); }
        }
        for (let i = newDeletedEntries.length - 1; i >= 0; i--) {
          const pIdx = pendingMe.deleted.indexOf(newDeletedEntries[i]);
          if (pIdx >= 0) { pendingMe.deleted.splice(pIdx, 1); newDeletedEntries.splice(i, 1); }
        }

        // 3. Remaining entries from board
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

    // Discard cue for any card hitting the discard pile. Engine-logged
    // discards already fire this sound via the dispatcher; 80ms dedupe
    // suppresses the duplicate. This catches cards pushed to discard
    // without a log — Artifacts that resolve and drop (Cute Cheese, etc.).
    if (discardGrew && window.playSFX) {
      const addedCount = newDiscardLen - prevDiscardLen;
      for (let k = 0; k < addedCount; k++) {
        setTimeout(() => window.playSFX('discard', { dedupe: 80 }), k * 80);
      }
    }

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

      // Deck→pile handshake: drop names already animated by the server's
      // deck_to_discard broadcast (mill) so they don't get a duplicate
      // phantom flight from a matching board card.
      const pendingMe = deckToDiscardPendingMeRef.current;
      for (let i = newDiscardEntries.length - 1; i >= 0; i--) {
        const pIdx = pendingMe.discard.indexOf(newDiscardEntries[i]);
        if (pIdx >= 0) { pendingMe.discard.splice(pIdx, 1); newDiscardEntries.splice(i, 1); }
      }
      for (let i = newDeletedEntries.length - 1; i >= 0; i--) {
        const pIdx = pendingMe.deleted.indexOf(newDeletedEntries[i]);
        if (pIdx >= 0) { pendingMe.deleted.splice(pIdx, 1); newDeletedEntries.splice(i, 1); }
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
      // Discard cue per returned card (dedupe so a big mulligan collapses).
      if (removed.length > 0 && window.playSFX) {
        for (let k = 0; k < removed.length; k++) {
          setTimeout(() => window.playSFX('discard', { dedupe: 60 }), k * 80);
        }
      }
      const storedRects = myHandRectsRef.current;
      const deckEl = document.querySelector('[data-my-deck]');
      const deckR = deckEl?.getBoundingClientRect();
      const deckTarget = deckR ? { x: deckR.left + deckR.width / 2 - 32, y: deckR.top + deckR.height / 2 - 45 } : null;
      const potionDeckEl = document.querySelector('[data-my-potion-deck]');
      const potionR = potionDeckEl?.getBoundingClientRect();
      const potionTarget = potionR ? { x: potionR.left + potionR.width / 2 - 32, y: potionR.top + potionR.height / 2 - 45 } : null;
      const oppCards = gameState.handReturnToOppCards || [];
      const oppDeckEl = document.querySelector('[data-opp-deck]');
      const oppDeckR = oppDeckEl?.getBoundingClientRect();
      const oppDeckTarget = oppDeckR ? { x: oppDeckR.left + oppDeckR.width / 2 - 32, y: oppDeckR.top + oppDeckR.height / 2 - 45 } : null;
      const returnAnims = [];
      for (const r of removed) {
        const sr = storedRects[r.handIdx];
        if (!sr) continue;
        const isToOpp = oppCards.includes(r.cardName);
        const isPotion = CARDS_BY_NAME[r.cardName]?.cardType === 'Potion';
        const target = isToOpp ? (oppDeckTarget || deckTarget)
          : (isPotion && potionTarget) ? potionTarget : deckTarget;
        if (!target) continue;
        returnAnims.push({ id: Date.now() + Math.random(), cardName: r.cardName, startX: sr.left, startY: sr.top, endX: target.x, endY: target.y, dest: isToOpp ? 'opp-deck' : isPotion ? 'potion' : 'deck' });
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

    // Discard cue for opponent-side discard pile growth (mirrors own-side).
    if (discardGrew && window.playSFX) {
      const addedCount = newDiscardLen - prevDiscardLen;
      for (let k = 0; k < addedCount; k++) {
        setTimeout(() => window.playSFX('discard', { dedupe: 80 }), k * 80);
      }
    }

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

      // Deck→pile handshake: drop names already animated by the server's
      // deck_to_discard broadcast (mill) so they don't get a duplicate
      // phantom flight from a matching opp-board card.
      const pendingOpp = deckToDiscardPendingOppRef.current;
      for (let i = newDiscardEntries.length - 1; i >= 0; i--) {
        const pIdx = pendingOpp.discard.indexOf(newDiscardEntries[i]);
        if (pIdx >= 0) { pendingOpp.discard.splice(pIdx, 1); newDiscardEntries.splice(i, 1); }
      }
      for (let i = newDeletedEntries.length - 1; i >= 0; i--) {
        const pIdx = pendingOpp.deleted.indexOf(newDeletedEntries[i]);
        if (pIdx >= 0) { pendingOpp.deleted.splice(pIdx, 1); newDeletedEntries.splice(i, 1); }
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
      const returnedCount = prevCount - newCount;
      // Discard cue per card, staggered so a batch sounds like a shuffle.
      if (returnedCount > 0 && window.playSFX) {
        for (let k = 0; k < returnedCount; k++) {
          setTimeout(() => window.playSFX('discard', { dedupe: 60 }), k * 80);
        }
      }
      const storedRects = oppHandRectsRef.current;
      const deckEl = document.querySelector('[data-opp-deck]');
      const deckR = deckEl?.getBoundingClientRect();
      const deckTarget = deckR ? { x: deckR.left + deckR.width / 2 - 32, y: deckR.top + deckR.height / 2 - 45 } : null;
      if (deckTarget) {
        const returnAnims = [];
        for (let i = 0; i < returnedCount; i++) {
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

    // Hand-activated-effect: if THIS specific hand index is still
    // activatable (not already revealed, per-copy check), keep it
    // clickable. The rest of the dim logic below only bears on SUMMON
    // eligibility — reveal remains a valid click for this slot.
    if (handIdx != null && (gameState.handActivatableCards || []).some(h => h.handIndex === handIdx)) return false;

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

    // Pick Hand Card mode — only eligible indices are clickable; dim
    // the rest so the player's eye lands on the legal picks.
    const pickHandCard = gameState.effectPrompt?.type === 'pickHandCard' && gameState.effectPrompt.ownerIdx === myIdx;
    if (pickHandCard) {
      const eligible = gameState.effectPrompt.eligibleIndices;
      return !(!eligible || eligible.includes(handIdx));
    }

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

    // Never-playable cards (e.g. Glass of Marbles, Mystery Box) — always dimmed
    if ((me.neverPlayableCards || []).includes(cardName)) return true;

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
      // Main Phase: gray out action types that can't be played on any hero
      // (server-side heroPlayableCards handles inherent/additional action economy)
      if (isActionType) {
        if (card.cardType === 'Creature' && me.summonLocked) return true;
        // Per-turn summon gate (Deepsea: "only 1 X per turn"). Applies
        // in Main Phase too because Deepsea Creatures can cheat
        // themselves out mid-Main via their own bounce-place effect,
        // so once the first copy has been summoned the second copy
        // must grey out even before the Action Phase.
        if (card.cardType === 'Creature' && (gameState.summonBlocked || []).includes(cardName)) return true;
        if (!canActionCardBePlayed(card)) return true;
        if ((gameState.blockedSpells || []).includes(cardName)) return true;
        return false; // Un-gray: playable
      }
      // Gray out Abilities that can't be played on any hero
      if (card.cardType === 'Ability') {
        const canPlaySomewhere = [0,1,2].some(hi => canHeroReceiveAbility(me, hi, cardName));
        if (!canPlaySomewhere) return true;
      }
      // Gray out Artifacts if not enough gold or item-locked
      if (card.cardType === 'Artifact') {
        if (me.itemLocked && (me.hand || []).length < 2) return true;
        // Boomerang's "no Artifacts for the rest of this turn" lockout —
        // every Artifact in hand greys out for the duration. Server
        // enforces the same gate; this is purely visual.
        if (me.artifactLocked) return true;
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
    socket.emit('reorder_hand', { roomId: gameState.roomId, hand: newHand, indexMap: indices });
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
    socket.emit('reorder_hand', { roomId: gameState.roomId, hand: newHand, indexMap });
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

  // Sync the module-level `_isDraggingCard` flag with the active drag
  // state so every setBoardTooltip(...) call suppresses mid-drag card
  // previews. Any tooltip already open when the drag starts is
  // dismissed immediately so the player sees the drop target clearly.
  useEffect(() => {
    const dragging = !!(playDrag || abilityDrag);
    _isDraggingCard = dragging;
    if (dragging) window._boardTooltipSetter?.(null);
  }, [playDrag, abilityDrag]);

  // Additional Action provider selection state
  const [pendingAdditionalPlay, setPendingAdditionalPlay] = useState(null); // { cardName, handIndex, heroIdx, zoneSlot, providers: [{cardId, cardName, heroIdx, zoneSlot}] }
  const [pendingAbilityActivation, setPendingAbilityActivation] = useState(null); // { heroIdx, zoneIdx, abilityName, level }
  const [spellHeroPick, setSpellHeroPick] = useState(null); // { cardName, handIndex, card, eligible, isHeroAction }
  // Click-to-swap state for Deepsea-style bounce-place cards. When set,
  // the board shows highlights on every legal drop target (bounce
  // candidates + free Support Zones) and the user clicks one to
  // dispatch play_creature — identical to having drag-dropped the
  // card there. Cleared on turn change, phase change, or Esc/cancel.
  const [pendingBouncePick, setPendingBouncePick] = useState(null); // { cardName, handIndex, card, bounceTargets, freeSlotTargets }
  // Click-to-attach an Ability. When set, eligible hero zones + their valid
  // ability slots (or existing stacks of the same ability) light up; clicking
  // one dispatches play_ability. Cleared on cancel / turn change / etc.
  // { cardName, handIndex?, card?, source?: 'hand'|'effectPrompt',
  //   eligibleHeroIdxs?, skipAbilityGiven?, cancellable? }
  // Two sources feed this state:
  //   - `source === 'hand'` (default): set when the player clicks an Ability
  //     hand card to "pick it up". Click emits `play_ability` with handIndex.
  //   - `source === 'effectPrompt'`: synced from a server-side
  //     `abilityAttachTarget` prompt (Alex's deck-search tutor, etc.). Click
  //     emits `effect_prompt_response` with `{ heroIdx, zoneSlot }`.
  const [abilityAttachPick, setAbilityAttachPick] = useState(null);
  // Clear transient picks when the game state shifts. Preserve an
  // effectPrompt-driven attach-pick while its prompt is still the active
  // server prompt, since the prompt IS the source of truth for that state.
  useEffect(() => {
    setSpellHeroPick(null);
    setPendingBouncePick(null);
    const ep = gameState.effectPrompt;
    const epIsAttachTarget = ep?.type === 'abilityAttachTarget' && ep.ownerIdx === myIdx;
    if (!epIsAttachTarget) setAbilityAttachPick(null);
  }, [gameState.activePlayer, gameState.currentPhase, gameState.effectPrompt, gameState.turn, myIdx]);
  // Sync the attach-pick state from a server-side `abilityAttachTarget` prompt.
  useEffect(() => {
    const ep = gameState.effectPrompt;
    if (ep?.type === 'abilityAttachTarget' && ep.ownerIdx === myIdx) {
      setAbilityAttachPick({
        cardName: ep.cardName,
        source: 'effectPrompt',
        eligibleHeroIdxs: Array.isArray(ep.eligibleHeroIdxs) ? ep.eligibleHeroIdxs : null,
        skipAbilityGiven: !!ep.skipAbilityGiven,
        cancellable: ep.cancellable !== false,
      });
    }
  }, [gameState.effectPrompt, myIdx]);

  // Play a single open cue whenever any hand-card target picker appears.
  useEffect(() => { if (spellHeroPick && window.playSFX) window.playSFX('ui_prompt_open'); }, [spellHeroPick]);
  useEffect(() => { if (abilityAttachPick && window.playSFX) window.playSFX('ui_prompt_open'); }, [abilityAttachPick]);
  useEffect(() => { if (pendingBouncePick && window.playSFX) window.playSFX('ui_prompt_open'); }, [pendingBouncePick]);
  useEffect(() => { if (pendingAdditionalPlay && window.playSFX) window.playSFX('ui_prompt_open'); }, [pendingAdditionalPlay]);
  useEffect(() => { if (pendingAbilityActivation && window.playSFX) window.playSFX('ui_prompt_open'); }, [pendingAbilityActivation]);
  // Server-driven targeting / effect prompts — e.g. clicking Magic Hammer
  // skips the hero picker (only one caster possible) and lands directly in
  // target selection. Play the open cue once when that state appears for me.
  const targetingActive = !!(gameState.potionTargeting && gameState.potionTargeting.ownerIdx === myIdx);
  const effectPromptActive = !!(gameState.effectPrompt && gameState.effectPrompt.ownerIdx === myIdx);
  useEffect(() => { if (targetingActive && window.playSFX) window.playSFX('ui_prompt_open'); }, [targetingActive]);
  useEffect(() => { if (effectPromptActive && window.playSFX) window.playSFX('ui_prompt_open'); }, [effectPromptActive]);

  // Check if a hero can receive a specific ability
  const canHeroReceiveAbility = (playerData, heroIdx, abilityName, opts = {}) => {
    const hero = playerData.heroes[heroIdx];
    if (!hero || !hero.name || hero.hp <= 0) return false;
    if (!opts.skipAbilityGiven && (playerData.abilityGivenThisTurn || [])[heroIdx]) return false;

    // Ascended Hero restriction (Smugness, etc.)
    if ((gameState.ascendedOnlyAbilities || []).includes(abilityName)) {
      const heroData = CARDS_BY_NAME[hero.name];
      if (heroData?.cardType !== 'Ascended Hero') return false;
    }

    // Restricted-attachment abilities (Divinity, etc.) are never
    // playable from hand — only specific cards that name them can
    // attach. The card stays grayed-out in hand exactly like any
    // other ability with no valid hero target. The `allowRestricted`
    // opt-in lets server-driven attach prompts (e.g. "Sacrifice to
    // Divinity"'s `abilityAttachTarget`) bypass the gate, since the
    // server has already vetted the eligibleHeroIdxs list.
    if (!opts.allowRestricted && (gameState.restrictedAttachmentAbilities || []).includes(abilityName)) return false;

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

  // Check if a hero can play a card (fully server-driven via heroPlayableCards).
  // All action economy logic (bonus actions, additional actions, inherent actions,
  // phase restrictions) is computed server-side in getHeroPlayableCards().
  const canHeroPlayCard = (playerData, heroIdx, card) => {
    const isOwn = playerData === me;
    const playableMap = isOwn
      ? (gameState.heroPlayableCards?.own || {})
      : (gameState.heroPlayableCards?.charmed || {});
    const playableList = playableMap[heroIdx] || [];
    return playableList.includes(card.name);
  };

  // Stricter sibling of canHeroPlayCard: "can this hero summon this Creature
  // NORMALLY, into a free Support Zone?" Skips the card-level bypass (Deepsea
  // canBypassLevelReq) that canHeroPlayCard honors, so cards with a
  // placement-style alternate path don't wrongly light up empty slots on
  // heroes that can only host them via bounce-place / tribute. Replicates the
  // engine's countAbilitiesForSchool + bypassLevelReq logic — close enough for
  // the drop/highlight UI; the server still re-validates on play.
  const canHeroNormalSummon = (playerData, heroIdx, card) => {
    if (!card || card.cardType !== 'Creature') return false;
    const hero = playerData.heroes?.[heroIdx];
    if (!hero?.name || hero.hp <= 0) return false;
    if (hero.statuses?.frozen || hero.statuses?.stunned || hero.statuses?.bound) return false;
    // Apply board-wide level reductions from `reduceCardLevel` hooks (Elven
    // Forager, …) so the highlight agrees with `heroMeetsLevelReq`. Only
    // meaningful for the own player — the charmed-summon path calls this
    // with `me` too, so the opponent's side does not need its own delta.
    const rawLevel = card.level || 0;
    const reduction = (playerData === me ? (gameState.cardLevelReductions || {})[card.name] : 0) || 0;
    const level = Math.max(0, rawLevel - reduction);
    if (level <= 0 && !card.spellSchool1) return true;
    // Negated heroes contribute no abilities for level-req purposes — only
    // Lv0 creatures without a school requirement can still land on them.
    const abZones = hero.statuses?.negated ? [] : (playerData.abilityZones?.[heroIdx] || []);
    const countSchool = (school) => {
      let count = 0;
      for (const slot of abZones) {
        if (!slot || slot.length === 0) continue;
        for (const ab of slot) if (ab === school) count++;
      }
      return count;
    };
    if (card.spellSchool1 && countSchool(card.spellSchool1) >= level) return true;
    if (card.spellSchool2 && countSchool(card.spellSchool2) >= level) return true;
    // Generic hero-level bypass — Ascended Beato, etc. Card-level bypasses
    // are deliberately NOT consulted here; see function docstring above.
    const blr = hero.bypassLevelReq;
    if (blr && level <= blr.maxLevel && (blr.types || []).includes(card.cardType)) return true;
    return false;
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
    if (gameState.reconnected || gameState.awaitingFirstChoice || gameState.isPuzzle) return null;
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
      const eligible = gameState.effectPrompt.eligibleIndices;
      if (eligible && !eligible.includes(idx)) return; // Not an eligible card for this discard
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

    // Pick Hand Card mode (Deepsea Castle second pick, etc.) — click
    // a highlighted hand card to submit { cardName, handIndex }. Unlike
    // forceDiscard, the clicked card isn't implicitly discarded — the
    // caller decides what to do with the selection.
    const pickHandCardActive = gameState.effectPrompt?.type === 'pickHandCard' && gameState.effectPrompt.ownerIdx === myIdx;
    if (pickHandCardActive) {
      const eligible = gameState.effectPrompt.eligibleIndices;
      if (eligible && !eligible.includes(idx)) return;
      if (resolvingHandIndex >= 0 && resolvingHandIndex === idx) return;
      if (e.cancelable) e.preventDefault();
      socket.emit('effect_prompt_response', { roomId: gameState.roomId, response: { cardName, handIndex: idx } });
      return;
    }

    // Hand Pick mode (Shard of Chaos, Leadership) — toggle card selection
    const handPickPrompt = gameState.effectPrompt?.type === 'handPick' && gameState.effectPrompt.ownerIdx === myIdx;
    if (handPickPrompt) {
      const eligible = gameState.effectPrompt.eligibleIndices || [];
      if (!eligible.includes(idx)) return;
      if (e.cancelable) e.preventDefault();
      // Decide up front (synchronously) whether this click will actually
      // toggle the selection. React 18's automatic batching can defer the
      // setHandPickSelected updater past the end of this handler, so any
      // side-effect flag set inside it is unreliable for "did a change
      // happen" checks. Reading state from closure avoids that race.
      const maxSelect = gameState.effectPrompt.maxSelect || 3;
      const cardTypes = gameState.effectPrompt.cardTypes || {};
      const typeLimits = gameState.effectPrompt.typeLimits || {};
      const thisType = cardTypes[idx];
      let willChange;
      if (handPickSelected.has(idx)) {
        willChange = true; // Deselection always succeeds.
      } else if (handPickSelected.size >= maxSelect) {
        willChange = false;
      } else if (thisType && typeLimits[thisType] !== undefined) {
        let selectedOfType = 0;
        for (const si of handPickSelected) {
          if (cardTypes[si] === thisType) selectedOfType++;
        }
        willChange = selectedOfType < typeLimits[thisType];
      } else {
        willChange = true;
      }
      if (willChange && window.playSFX) window.playSFX('ui_click');
      setHandPickSelected(prev => {
        const next = new Set(prev);
        if (next.has(idx)) { next.delete(idx); return next; }
        if (next.size >= maxSelect) return prev;
        if (thisType && typeLimits[thisType] !== undefined) {
          let selectedOfType = 0;
          for (const si of next) {
            if (cardTypes[si] === thisType) selectedOfType++;
          }
          if (selectedOfType >= typeLimits[thisType]) return prev;
        }
        next.add(idx);
        return next;
      });
      return;
    }

    // Block hand play while any dialog/submenu is open
    if (showSurrender || showEndTurnConfirm || spellHeroPick || abilityAttachPick || summonOrRevealPick) return;
    if (gameState.surprisePending) return; // Lock hand during surprise prompts for both players
    const activePrompt = gameState.effectPrompt;
    if (activePrompt && activePrompt.ownerIdx === myIdx
        && !['forceDiscard','forceDiscardCancellable','pickHandCard','handPick','abilityAttach','heroAction'].includes(activePrompt.type)) return;

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
      && (currentPhase === 2 || currentPhase === 3 || currentPhase === 4)));
    const isAbilityPlayable = isAbilityAttachEligible || (!dimmed && isMyTurn && (currentPhase === 2 || currentPhase === 4) && card && card.cardType === 'Ability');
    // "Equip-playable" covers standard Equipment Artifacts AND the Artifact-
    // Creature hybrid (Pollution Spewer & future equivalents) — both are
    // dragged from hand onto a Hero's Support Zone and routed through the
    // same `play_artifact` socket event.
    const isEquipPlayable = !dimmed && isMyTurn && (currentPhase === 2 || currentPhase === 4) && card && card.cardType === 'Artifact'
      && (['equipment','creature'].includes((card.subtype || '').toLowerCase().trim())
          || (card.subtype || '').toLowerCase().split('/').some(t => t.trim() === 'creature'))
      && (me.gold || 0) >= (card.cost || 0);
    // "Artifact-activatable" is click-to-use (potions / Wheels-style). It
    // excludes Equipment AND Artifact-Creatures — both of those are drag-
    // to-hero plays instead.
    const isArtifactActivatable = !dimmed && isMyTurn && (currentPhase === 2 || currentPhase === 4) && card
      && card.cardType === 'Artifact'
      && (card.subtype || '').toLowerCase() !== 'equipment'
      && !(card.subtype || '').toLowerCase().split('/').some(t => t.trim() === 'creature');
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
          return canHeroReceiveAbility(me, hi, cn, { skipAbilityGiven });
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
        let targetBakhmSlot = -1;
        let surpriseTarget = false;
        const heroActionHeroIdx = heroActionPrompt?.heroIdx;
        const isSurpriseCard = (card.subtype || '').toLowerCase() === 'surprise';

        // Surprise-subtype Creatures: check Surprise Zones (set face-down above
        // hero) AND Bakhm support slots (set face-down into Bakhm's support).
        // The `!isPlayable` surprise branch never matches for Creatures since
        // they're always `isPlayable`; recover that functionality here. Falls
        // through to the normal support-zone scan below for face-up summons.
        if (isSurpriseCard && isSurprisePlayable) {
          const surEls = document.querySelectorAll('[data-surprise-zone]');
          for (const el of surEls) {
            const r = el.getBoundingClientRect();
            if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
              if (el.dataset.surpriseOwner === 'me') {
                const hi = parseInt(el.dataset.surpriseHero);
                const hero = me.heroes[hi];
                if (hero && hero.name && hero.hp > 0 && ((me.surpriseZones || [])[hi] || []).length === 0) {
                  targetHero = hi;
                  surpriseTarget = true;
                }
              }
            }
          }
          // Bakhm support slots accept face-down Surprise Creatures too.
          if (!surpriseTarget) {
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
                    surpriseTarget = true;
                  }
                }
              }
            }
          }
        }

        if (!surpriseTarget) {
          // Two distinct drop modes:
          //  • Bounce mode (the card publishes bouncePlacementTargets): the
          //    destination slot is the one the bounced creature already
          //    occupies. ONLY those specific occupied slots are valid drops.
          //    Empty slots must NOT be highlighted — dropping there would
          //    land the card somewhere else entirely (the server's
          //    beforeSummon would pick a bounce target itself), which
          //    violates "don't highlight what isn't the destination".
          //  • Normal mode (no bounce targets): highlight empty slots on
          //    heroes that can actually summon this card (canHeroPlayCard
          //    is the engine's source of truth — it already honors
          //    canBypassLevelReq and inherentAction for the hero-specific
          //    case). Occupied slots stay un-highlighted.
          const bpTargets = (gameState.bouncePlacementTargets || {})[cardName] || [];
          const bpSet = new Set(bpTargets.map(t => t.heroIdx + ':' + t.slotIdx));
          const hasBounceTargets = bpTargets.length > 0;

          const els = document.querySelectorAll('[data-support-zone]');
          for (const el of els) {
            const r = el.getBoundingClientRect();
            if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
              const hi = parseInt(el.dataset.supportHero);
              const si = parseInt(el.dataset.supportSlot);
              const isOwn = el.dataset.supportOwner === 'me';
              if (!isOwn) continue;
              // During heroAction, only the Coffee hero's zones are valid.
              if (heroActionHeroIdx !== undefined && hi !== heroActionHeroIdx) continue;
              const slotCards = (me.supportZones[hi] || [])[si] || [];
              const isOccupied = slotCards.length > 0;
              const isBounceSlot = bpSet.has(hi + ':' + si);
              // Unified drop resolution. A Deepsea Creature in hand publishes
              // `bouncePlacementTargets` listing occupied bounce-target slots,
              // but normal summoning into a free slot of an eligible Hero
              // remains a valid alternative — the player's Action covers the
              // summon and the server handles both paths (occupied slot →
              // bounce-place, empty slot → normal summon). Empty-slot drops
              // use the STRICT eligibility check (canHeroNormalSummon) so
              // the bypass that lets Deepsea swap onto any hero doesn't
              // leak into "which heroes can summon this normally" — an
              // empty slot on a Lv0-summoner hero shouldn't accept a Lv1
              // Deepsea Creature even if a bounceable exists elsewhere.
              if (isOccupied) {
                if (hasBounceTargets && isBounceSlot) { targetHero = hi; targetSlot = si; }
              } else if (card.cardType === 'Creature') {
                const canPlayHere = isHeroAction || canHeroNormalSummon(me, hi, card);
                if (!canPlayHere) continue;
                if (si >= ((me.supportZones[hi] || []).length || 3)) continue;
                targetHero = hi; targetSlot = si;
              } else {
                const canPlayHere = isHeroAction || canHeroPlayCard(me, hi, card);
                if (!canPlayHere) continue;
                if (si >= ((me.supportZones[hi] || []).length || 3)) continue;
                targetHero = hi; targetSlot = si;
              }
            }
          }
        }
        setPlayDrag({ idx, cardName, card, mouseX: mx, mouseY: my, targetHero, targetSlot, targetBakhmSlot, isSurprise: surpriseTarget });
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
        let surpriseTarget = false;
        const heroActionHeroIdx2 = heroActionPrompt?.heroIdx;
        const isAttachmentCard = (card.subtype || '').toLowerCase() === 'attachment';
        const isSurpriseCard = (card.subtype || '').toLowerCase() === 'surprise';
        const isAreaCard = (card.subtype || '').toLowerCase() === 'area';

        // Area-subtype drop target: the player's own Area Zone acts as a
        // shortcut drop zone. Dropping here picks the FIRST hero eligible
        // to cast the card and routes the play through them. Falls back to
        // the normal hero-zone drop below if the cursor isn't over the
        // area zone.
        if (isAreaCard && ((me.areaZones || [])[0] === undefined || ((gameState.areaZones?.[myIdx] || []).length === 0))) {
          const areaEls = document.querySelectorAll('[data-area-zone][data-area-owner="me"]');
          for (const el of areaEls) {
            const r = el.getBoundingClientRect();
            if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
              // Find first hero that can cast this card — canHeroPlayCard
              // hits the server-computed heroPlayableCards map which already
              // incorporates schools / area-empty / action-economy rules.
              for (let hi = 0; hi < (me.heroes || []).length; hi++) {
                if (canHeroPlayCard(me, hi, card)) { targetHero = hi; break; }
              }
            }
          }
        }

        // Surprise-subtype Spells/Attacks: check Surprise Zones first so
        // the card can be set face-down by dropping onto them. The original
        // `isSurprisePlayable && !isPlayable` branch above skips Spell/Attack
        // Surprises because they are always `isPlayable`; we recover that
        // functionality here. If no surprise-zone hit, fall through to the
        // normal hero-zone targeting below for a face-up cast.
        if (isSurpriseCard && isSurprisePlayable) {
          const surEls = document.querySelectorAll('[data-surprise-zone]');
          for (const el of surEls) {
            const r = el.getBoundingClientRect();
            if (mx >= r.left && mx <= r.right && my >= r.top && my <= r.bottom) {
              if (el.dataset.surpriseOwner === 'me') {
                const hi = parseInt(el.dataset.surpriseHero);
                const hero = me.heroes[hi];
                if (hero && hero.name && hero.hp > 0 && ((me.surpriseZones || [])[hi] || []).length === 0) {
                  targetHero = hi;
                  surpriseTarget = true;
                }
              }
            }
          }
        }

        // Attachment spells/attacks: also check support zones (like creatures/equipment)
        if (!surpriseTarget && isAttachmentCard) {
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
              // During heroAction, isHeroAction already asserts the card is
              // playable with this hero — skip canHeroPlayCard (which uses
              // the normal action-economy gate and returns false for a hero
              // who's already acted this turn).
              if (isHeroAction || canHeroPlayCard(me, hi, card)) {
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
        setPlayDrag({ idx, cardName, card, mouseX: mx, mouseY: my, targetHero, targetSlot: targetSlot, isSpell: !surpriseTarget, isSurprise: surpriseTarget, charmedOwner: surpriseTarget ? undefined : targetCharmedOwner });
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
        // Hand-activated-effect intercept (Luna Kiai's "Summon or Reveal").
        // PER-COPY: this specific hand slot is activatable iff its index
        // is listed in `handActivatableByIdx`. Already-revealed copies are
        // not in that list, so they drop through to the normal click flow.
        const canHandActivate = handActivatableByIdx.has(idx);
        if (canHandActivate && isMyTurn && (currentPhase === 2 || currentPhase === 3 || currentPhase === 4)) {
          let summonEligible = [];
          if (isPlayable && card?.cardType === 'Creature') {
            for (let hi = 0; hi < (me.heroes || []).length; hi++) {
              if (!canHeroPlayCard(me, hi, card)) continue;
              const slot = findFreeSupportSlot(me, hi);
              if (slot < 0) continue;
              summonEligible.push({ idx: hi, name: me.heroes[hi].name, zoneSlot: slot });
            }
          }
          if (summonEligible.length > 0) {
            setSummonOrRevealPick({ cardName, handIndex: idx, card, summonEligible });
          } else {
            if (window.playSFX) window.playSFX('ui_click');
            socket.emit('activate_hand_card', { roomId: gameState.roomId, cardName, handIndex: idx });
          }
          setHandDrag(null); setPlayDrag(null); setAbilityDrag(null);
          return;
        }
        // Click (no drag) — check for potion or non-equip artifact activation
        if (!dimmed && isMyTurn && (currentPhase === 2 || currentPhase === 3 || currentPhase === 4) && card) {
          if (card.cardType === 'Potion') {
            socket.emit('use_potion', { roomId: gameState.roomId, cardName, handIndex: idx });
          } else if (card.cardType === 'Artifact' && (card.subtype || '').toLowerCase() !== 'equipment') {
            socket.emit('use_artifact_effect', { roomId: gameState.roomId, cardName, handIndex: idx });
          } else if ((card.cardType === 'Spell' || card.cardType === 'Attack') && isPlayable) {
            // Hero-locked path: a heroAction prompt names a single Hero
            // who's getting the additional Action (Body Swap, Coffee,
            // Trample Sounds, any future immediate-additional card).
            // Clicking an eligible card auto-routes to that Hero — no
            // hero picker, no fallthrough to "any Hero who can cast".
            // The prompt's `eligibleCards` list is already narrowed
            // server-side to only what THIS hero can legally cast, so
            // the click is always safe to dispatch directly.
            if (isHeroAction) {
              socket.emit('effect_prompt_response', {
                roomId: gameState.roomId,
                response: { cardName, handIndex: idx, heroIdx: heroActionPrompt.heroIdx },
              });
            } else {
              // Normal flow: find every Hero that could cast this card,
              // own + charmed opponent. Single eligible auto-plays;
              // multiple eligible opens the hero-selection popup.
              const eligible = [];
              for (let hi = 0; hi < (me.heroes || []).length; hi++) {
                if (canHeroPlayCard(me, hi, card)) {
                  eligible.push({ idx: hi, name: me.heroes[hi].name });
                }
              }
              for (let hi = 0; hi < (opp.heroes || []).length; hi++) {
                const oppHero = opp.heroes[hi];
                if (oppHero?.charmedBy === myIdx && canHeroPlayCard(opp, hi, card)) {
                  eligible.push({ idx: hi, name: oppHero.name, charmedOwner: oppIdx });
                }
              }
              if (eligible.length === 1) {
                socket.emit('play_spell', { roomId: gameState.roomId, cardName, handIndex: idx, heroIdx: eligible[0].idx, charmedOwner: eligible[0].charmedOwner });
              } else if (eligible.length > 1) {
                setSpellHeroPick({ cardName, handIndex: idx, card, eligible, isHeroAction });
              }
            }
          } else if (card.cardType === 'Ability' && isAbilityPlayable && !isAbilityAttachEligible) {
            // Click-to-attach. Instead of a popup, enter "pick-a-zone" mode:
            // eligible hero zones light up, existing stacks of the same
            // ability or empty ability slots become clickable.
            const anyEligible = (me.heroes || []).some((_, hi) => canHeroReceiveAbility(me, hi, cardName));
            if (anyEligible) {
              setAbilityAttachPick({ cardName, handIndex: idx, card });
            }
          } else if (card.cardType === 'Creature' && isPlayable) {
            // Hero-locked path: heroAction prompt is up and this
            // Creature is in its eligibleCards. Auto-summon onto the
            // prompt's named Hero — no hero picker. The first free
            // Support Zone on that hero is used; performImmediate
            // Action's server validation checks the slot.
            if (isHeroAction) {
              const lockedHi = heroActionPrompt.heroIdx;
              const lockedSlot = findFreeSupportSlot(me, lockedHi);
              if (lockedSlot >= 0) {
                socket.emit('effect_prompt_response', {
                  roomId: gameState.roomId,
                  response: { cardName, handIndex: idx, heroIdx: lockedHi, zoneSlot: lockedSlot },
                });
              }
              setHandDrag(null); setPlayDrag(null); setAbilityDrag(null); return;
            }
            // Click-to-summon. Two routing paths:
            //
            // (A) Bounce-place is available (Deepsea archetype / any
            //     future card publishing bouncePlacementTargets). The
            //     hero choice is irrelevant — only WHICH Creature gets
            //     bounced matters, so we skip the hero picker entirely
            //     and dispatch play_creature directly. The server's
            //     beforeSummon hook runs tryBouncePlace which prompts
            //     for the bounce selection.
            //     To keep the server's zone validation happy, we first
            //     try to pass a free slot (letting the prompt appear);
            //     if no free slot anywhere, we fall back to the first
            //     bounce-target slot (the server sets
            //     _requestedBouncePlaceSlot and the swap happens
            //     immediately on that target).
            //
            // (B) No bounce targets — fall through to the standard
            //     hero picker: eligible heroes must meet canHeroPlay
            //     Card AND have a free Support Zone (base OR Flying
            //     Island extension).
            const bpTargets = (gameState.bouncePlacementTargets || {})[cardName] || [];
            if (bpTargets.length > 0) {
              // Enter "pick a target" mode — highlight BOTH occupied
              // bounce-target slots (swap-in) AND empty slots on Heroes
              // that can legally summon the card (normal summon). The
              // server routes the resulting `play_creature` based on
              // whether the picked slot is occupied. Users shouldn't
              // lose the ability to normal-summon just because a
              // bounce-candidate also exists — both plays stay legal.
              // Normal-summon uses the strict eligibility check so
              // low-level / dead heroes aren't offered as targets.
              const normalTargets = [];
              for (let hi = 0; hi < (me.heroes || []).length; hi++) {
                if (!canHeroNormalSummon(me, hi, card)) continue;
                const slot = findFreeSupportSlot(me, hi);
                if (slot < 0) continue;
                normalTargets.push({ heroIdx: hi, slotIdx: slot });
              }
              setPendingBouncePick({
                cardName, handIndex: idx, card,
                bounceTargets: [...bpTargets, ...normalTargets],
              });
            } else {
              const eligible = [];
              for (let hi = 0; hi < (me.heroes || []).length; hi++) {
                if (!canHeroPlayCard(me, hi, card)) continue;
                const slot = findFreeSupportSlot(me, hi);
                if (slot < 0) continue;
                eligible.push({ idx: hi, name: me.heroes[hi].name, zoneSlot: slot });
              }
              if (eligible.length === 1) {
                socket.emit('play_creature', {
                  roomId: gameState.roomId, cardName,
                  handIndex: idx, heroIdx: eligible[0].idx,
                  zoneSlot: eligible[0].zoneSlot,
                });
              } else if (eligible.length > 1) {
                setSpellHeroPick({ cardName, handIndex: idx, card, eligible, isCreature: true });
              }
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
              hideGameTooltip(); socket.emit('ascend_hero', { roomId: gameState.roomId, heroIdx: eligible[0].idx, cardName, handIndex: idx });
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
        // Dropped inside hand zone — ALWAYS reorder, regardless of card type.
        // Build an indexMap (newIdx → oldIdx) so the server can remap any
        // per-index state (Luna Kiai's reveal marker, etc.) — without it,
        // revealed copies "lose" their state when their position changes.
        const newHand = [...hand];
        newHand.splice(idx, 1);
        const dropIdx = calcDropIdx(upX, idx);
        newHand.splice(dropIdx, 0, cardName);
        const indexMap = hand.map((_, i) => i);
        const [movedOldIdx] = indexMap.splice(idx, 1);
        indexMap.splice(dropIdx, 0, movedOldIdx);
        setHand(newHand);
        socket.emit('reorder_hand', { roomId: gameState.roomId, hand: newHand, indexMap });
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
          if (!prev) return null;

          // Surprise placement path (dropped onto a Surprise Zone or Bakhm
          // support slot). Set via the Creature drag branch above.
          if (prev.isSurprise && prev.targetHero >= 0) {
            socket.emit('play_surprise', {
              roomId: gameState.roomId,
              cardName: prev.cardName,
              handIndex: prev.idx,
              heroIdx: prev.targetHero,
              bakhmSlot: prev.targetBakhmSlot >= 0 ? prev.targetBakhmSlot : undefined,
            });
            return null;
          }

          if (prev.targetHero < 0 || prev.targetSlot < 0) return null;

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

          // Surprise placement path (dragged onto a Surprise Zone) — the
          // onMove branch above sets isSurprise when the cursor hits one.
          if (prev.isSurprise) {
            socket.emit('play_surprise', {
              roomId: gameState.roomId,
              cardName: prev.cardName,
              handIndex: prev.idx,
              heroIdx: prev.targetHero,
            });
            return null;
          }

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
          hideGameTooltip(); socket.emit('ascend_hero', {
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

  // Per-copy revealed hand indices (Luna Kiai). Server stamps the
  // specific clicked index and returns the list here — the client just
  // renders them semi-transparent.
  const revealedHandIdxSet = useMemo(() => {
    return new Set(gameState.revealedOwnHandIndices || []);
  }, [gameState.revealedOwnHandIndices]);
  // Per-copy activatable map: handIndex → { cardName, label }. A given
  // copy is clickable for Reveal iff its index is in this map. This is
  // what lets the owner click a SPECIFIC Luna Kiai (and not some other
  // copy) to reveal it.
  const handActivatableByIdx = useMemo(() => {
    const out = new Map();
    for (const h of (gameState.handActivatableCards || [])) {
      if (typeof h?.handIndex === 'number') out.set(h.handIndex, h);
    }
    return out;
  }, [gameState.handActivatableCards]);

  // Click-without-drag picker for cards that can be BOTH summoned and
  // hand-activated (Luna Kiai). `null` when nothing is pending. Shape:
  // `{ cardName, handIndex, card, onSummon, onReveal }`.
  const [summonOrRevealPick, setSummonOrRevealPick] = useState(null);
  useEffect(() => { if (summonOrRevealPick && window.playSFX) window.playSFX('ui_prompt_open'); }, [summonOrRevealPick]);

  const [showSurrender, setShowSurrender] = useState(false);
  const surrenderOpenedAt = React.useRef(0);
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
  // Number of upcoming hand additions to suppress auto-animations for —
  // incremented by each incoming `play_pile_transfer` whose destination is
  // `hand`. The server-driven pile-transfer is the authoritative flying-
  // card animation for those arrivals; without these counters the
  // client's hand-count auto-detection would overlay a second (incorrect)
  // draw-from-opp-hand animation. Counters are per-side because both
  // players' views react to the same event: the card's owner suppresses
  // their own me.hand auto-anim; the spectator / opponent suppresses
  // their opp.handCount auto-anim. Decremented in the hand-animation
  // branches that early-return when > 0.
  const pileTransferToHandPendingMeRef  = useRef(0);
  const pileTransferToHandPendingOppRef = useRef(0);
  // Deck→discard handshake: tracks card names that the server has
  // already animated from the deck to the discard / deleted pile via
  // `deck_to_discard_animation`. The pile-growth auto-detector would
  // otherwise match those names against same-named cards on the board
  // and spawn a phantom board→pile flight. When the detector sees a
  // pile grow, it consults these lists and removes matching names
  // BEFORE falling through to the board-match path.
  const deckToDiscardPendingMeRef  = useRef({ discard: [], deleted: [] });
  const deckToDiscardPendingOppRef = useRef({ discard: [], deleted: [] });
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
    const onReveal = ({ cardName }) => { if (window.playSFX) window.playSFX('reveal'); setCardReveals(prev => [...prev, { id: Date.now() + Math.random(), cardName }]); };
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
      if (window.playSFX) window.playSFX('spell_cast', { category: 'effect' });
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
      if (window.playSFXForZoneAnim) window.playSFXForZoneAnim(type);
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      let sel;
      if (zoneType === 'ability' && heroIdx >= 0 && zoneSlot >= 0) {
        sel = `[data-ability-zone][data-ability-owner="${ownerLabel}"][data-ability-hero="${heroIdx}"][data-ability-slot="${zoneSlot}"]`;
      } else if (zoneType === 'surprise' && heroIdx >= 0) {
        sel = `[data-surprise-zone][data-surprise-owner="${ownerLabel}"][data-surprise-hero="${heroIdx}"]`;
      } else if (zoneType === 'permanent' && permId) {
        sel = `[data-perm-id="${permId}"][data-perm-owner="${ownerLabel}"]`;
      } else if (zoneType === 'area') {
        sel = `[data-area-zone][data-area-owner="${ownerLabel}"]`;
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
      // Training (and similar effects) re-broadcasts ability_activated as
      // a visual flash for the secondary zone it affects. Dedupe 800ms
      // collapses those extra flashes into the single "ability triggered"
      // cue the player cares about, while still letting genuinely separate
      // ability activations play their own sound.
      if (window.playSFX) window.playSFX('ability_activate', { dedupe: 800 });
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
      if (window.playSFX) window.playSFX('laser', { dedupe: 60, category: 'effect' });
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
    // Hand-to-board card-fly animation. The server fires this right before
    // the sendGameState that removes the card from the owner's hand, so the
    // source cardback is still in the DOM at the handIndex we were told.
    const onHandToBoard = ({ ownerIdx, cardName, handIndex, zoneType, heroIdx, slotIdx, faceDown }) => {
      // Don't animate for the owner — they already saw their own drag/drop.
      if (ownerIdx === myIdx) return;
      const sourceEl = document.querySelector(`.game-hand-opp [data-hand-idx="${handIndex}"]`);
      let destEl = null;
      if (zoneType === 'support') {
        destEl = document.querySelector(`[data-support-zone][data-support-owner="opp"][data-support-hero="${heroIdx}"][data-support-slot="${slotIdx}"]`);
      } else if (zoneType === 'ability') {
        destEl = document.querySelector(`[data-ability-zone][data-ability-owner="opp"][data-ability-hero="${heroIdx}"][data-ability-slot="${slotIdx}"]`);
      } else if (zoneType === 'surprise') {
        destEl = document.querySelector(`[data-surprise-zone][data-surprise-owner="opp"][data-surprise-hero="${heroIdx}"]`);
      } else if (zoneType === 'hero') {
        // Attachment Spells: land on the hero's card itself.
        destEl = document.querySelector(`[data-hero-zone][data-hero-owner="opp"][data-hero-idx="${heroIdx}"]`);
      } else if (zoneType === 'permanent') {
        // Permanent Artifacts: land on the opp permanents row if rendered,
        // otherwise default to the center of the opp hero row.
        destEl = document.querySelector('.board-permanents-opp')
          || document.querySelector('[data-hero-zone][data-hero-owner="opp"][data-hero-idx="1"]');
      }
      if (!sourceEl || !destEl) return;
      const sr = sourceEl.getBoundingClientRect();
      const dr = destEl.getBoundingClientRect();
      const fly = document.createElement('div');
      fly.className = 'board-card hand-to-board-fly';
      const imgUrl = !faceDown && cardName ? cardImageUrl(cardName) : null;
      fly.innerHTML = imgUrl
        ? `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit" draggable="false" />`
        : `<img src="${opp.cardback || '/cardback.png'}" style="width:100%;height:100%;object-fit:cover" draggable="false" />`;
      const dx = (dr.left + dr.width / 2) - (sr.left + sr.width / 2);
      const dy = (dr.top + dr.height / 2) - (sr.top + sr.height / 2);
      fly.style.cssText = `position:fixed;left:${sr.left}px;top:${sr.top}px;width:${sr.width}px;height:${sr.height}px;z-index:10150;pointer-events:none;border-radius:4px;overflow:hidden;box-shadow:0 0 20px rgba(255,200,80,.6);transition:transform 600ms cubic-bezier(.22,.8,.3,1),opacity 600ms ease-out;`;
      document.body.appendChild(fly);
      // Next frame: kick off the transform so the transition plays.
      requestAnimationFrame(() => {
        fly.style.transform = `translate(${dx}px, ${dy}px) scale(${dr.width / sr.width})`;
        fly.style.opacity = '0.2';
      });
      setTimeout(() => { fly.remove(); }, 700);
    };
    socket.on('hand_to_board_fly', onHandToBoard);

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

    // Deepsea Spores activation — spawn a full-board particle rain
    // overlay AND fire a per-creature algae/anemone-growth + red glow
    // on every existing creature. The server supplies the list of
    // affected creature coordinates so the client doesn't have to
    // re-derive them from state.
    const onDeepseaSporesActivated = ({ creatures }) => {
      if (window.playSFX) window.playSFX('elem_water', { category: 'effect' });
      // Board-wide particle overlay: play on the full-screen container
      // (coords are the viewport center, so the animation component
      // paints across the whole play area).
      const vx = window.innerWidth / 2;
      const vy = window.innerHeight / 2;
      const id = Date.now() + Math.random();
      setGameAnims(prev => [...prev, {
        id, type: 'deepsea_spores_rain', x: vx, y: vy,
        w: window.innerWidth, h: window.innerHeight,
      }]);
      setTimeout(() => setGameAnims(prev => prev.filter(a => a.id !== id)), 2400);

      // Per-creature anemone growth + red glow. Staggered so the
      // screen doesn't flash 6 creatures simultaneously.
      for (let i = 0; i < (creatures || []).length; i++) {
        const c = creatures[i];
        const ownerLabel = c.owner === myIdx ? 'me' : 'opp';
        const sel = `[data-support-zone][data-support-owner="${ownerLabel}"][data-support-hero="${c.heroIdx}"][data-support-slot="${c.zoneSlot}"]`;
        setTimeout(() => playAnimation('deepsea_spores_growth', sel, { duration: 1800 }), 200 + i * 120);
      }
    };
    socket.on('deepsea_spores_activated', onDeepseaSporesActivated);
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
      if (window.playSFX) window.playSFX('elem_dark', { category: 'effect' });
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
      if (window.playSFX) window.playSFX('slash', { category: 'effect' });
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
      // punchStrike keyframes put the fist AT the target at 30% of 350ms
      // (~105ms in). Delay the hit so the sound lands on the impact frame
      // instead of during the wind-up.
      if (window.playSFX) window.playSFX('heavy_impact', { delay: 110, category: 'effect' });
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
      if (window.playSFX) window.playSFX('elem_lightning', { dedupe: 80, category: 'effect' });
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
    const onRedLightningRain = ({ owner, heroIdx, zoneSlot }) => {
      if (window.playSFX) window.playSFX('elem_lightning', { dedupe: 80, category: 'effect' });
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const sel = zoneSlot >= 0
        ? `[data-support-zone][data-support-owner="${ownerLabel}"][data-support-hero="${heroIdx}"][data-support-slot="${zoneSlot}"]`
        : `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`;
      const tgtEl = document.querySelector(sel);
      if (!tgtEl) return;
      const tr = tgtEl.getBoundingClientRect();
      const cx = tr.left + tr.width / 2;
      const cy = tr.top + tr.height / 2;

      // Inject keyframes once
      if (!document.getElementById('red-lightning-rain-kf')) {
        const style = document.createElement('style');
        style.id = 'red-lightning-rain-kf';
        style.textContent = `
          @keyframes redBoltFall {
            0%   { transform: scaleY(0); opacity: 0; }
            15%  { transform: scaleY(1); opacity: 1; }
            60%  { opacity: 1; }
            100% { opacity: 0; }
          }
          @keyframes redImpact {
            0%   { transform: scale(0); opacity: 1; }
            50%  { transform: scale(1.4); opacity: 0.8; }
            100% { transform: scale(2); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      // Spawn 6 red bolts raining down with staggered timing
      for (let i = 0; i < 6; i++) {
        const xOff  = (Math.random() - 0.5) * tr.width * 1.2;
        const boltH = 60 + Math.random() * 80;
        const boltW = 3 + Math.random() * 4;
        const delay = i * 60 + Math.random() * 40;
        const bolt  = document.createElement('div');
        bolt.style.cssText = [
          `position:fixed`,
          `left:${cx + xOff - boltW / 2}px`,
          `top:${cy - boltH}px`,
          `width:${boltW}px`,
          `height:${boltH}px`,
          `background:linear-gradient(180deg,transparent 0%,#ff3333 30%,#ff8888 60%,#ffffff 80%,transparent 100%)`,
          `border-radius:${boltW}px`,
          `transform-origin:50% 0%`,
          `box-shadow:0 0 10px #ff2222,0 0 25px #cc0000,0 0 50px rgba(200,0,0,.4)`,
          `pointer-events:none`,
          `z-index:10000`,
          `animation:redBoltFall .5s ${delay}ms ease-out forwards`,
        ].join(';');
        document.body.appendChild(bolt);
        setTimeout(() => bolt.remove(), 650 + delay);

        // Impact flash at strike point
        const flash = document.createElement('div');
        flash.style.cssText = [
          `position:fixed`,
          `left:${cx + xOff - 14}px`,
          `top:${cy - 14}px`,
          `width:28px`,
          `height:28px`,
          `border-radius:50%`,
          `background:radial-gradient(circle,rgba(255,180,180,.9),rgba(200,0,0,.5),transparent)`,
          `pointer-events:none`,
          `z-index:10001`,
          `animation:redImpact .4s ${delay + 150}ms ease-out forwards`,
        ].join(';');
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 650 + delay);
      }
    };
    socket.on('red_lightning_rain', onRedLightningRain);
    // ── Area card placement: big flashy descend + shockwave ──
    const onAreaDescend = ({ owner, cardName }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const tgtEl = document.querySelector(`[data-area-zone][data-area-owner="${ownerLabel}"]`);
      if (!tgtEl) return;
      const tr = tgtEl.getBoundingClientRect();
      const cx = tr.left + tr.width / 2;
      const cy = tr.top + tr.height / 2;

      // Inject keyframes once
      if (!document.getElementById('area-descend-kf')) {
        const style = document.createElement('style');
        style.id = 'area-descend-kf';
        style.textContent = `
          @keyframes areaCardFall {
            0%   { transform: translate(-50%, -720px) rotateZ(-14deg) scale(1.45); opacity: 0; filter: brightness(2.2) drop-shadow(0 0 24px rgba(255,220,120,.8)); }
            20%  { opacity: 1; }
            75%  { transform: translate(-50%, 0) rotateZ(4deg) scale(1.35); filter: brightness(1.9) drop-shadow(0 0 28px rgba(255,240,160,.9)); }
            82%  { transform: translate(-50%, 12px) rotateZ(-2deg) scale(1.18); filter: brightness(1.4) drop-shadow(0 0 18px rgba(255,220,120,.6)); }
            90%  { transform: translate(-50%, -4px) rotateZ(1deg) scale(1.22); filter: brightness(1.3); }
            100% { transform: translate(-50%, 0) rotateZ(0deg) scale(1); opacity: 1; filter: brightness(1); }
          }
          @keyframes areaImpactRing {
            0%   { transform: translate(-50%, -50%) scale(0.1); opacity: 1; }
            60%  { transform: translate(-50%, -50%) scale(2.6); opacity: 0.6; }
            100% { transform: translate(-50%, -50%) scale(4.2); opacity: 0; }
          }
          @keyframes areaImpactFlash {
            0%   { transform: translate(-50%, -50%) scale(0.1); opacity: 0; }
            40%  { transform: translate(-50%, -50%) scale(1.8); opacity: 1; }
            100% { transform: translate(-50%, -50%) scale(3.5); opacity: 0; }
          }
          @keyframes areaDustParticle {
            0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.3); }
            30%  { opacity: 1; }
            100% { opacity: 0; transform: translate(calc(-50% + var(--adx)), calc(-50% + var(--ady))) scale(1.4); }
          }
          @keyframes areaBgFlash {
            0%   { background: radial-gradient(ellipse at center, rgba(255,240,160,0) 0%, transparent 60%); }
            30%  { background: radial-gradient(ellipse at center, rgba(255,240,160,.55) 0%, rgba(255,180,60,.25) 30%, transparent 70%); }
            100% { background: radial-gradient(ellipse at center, rgba(255,240,160,0) 0%, transparent 60%); }
          }
        `;
        document.head.appendChild(style);
      }

      // Full-viewport flash dimming (feels "important")
      const flashBg = document.createElement('div');
      flashBg.style.cssText = `position:fixed;inset:0;pointer-events:none;z-index:9995;animation:areaBgFlash 1.1s ease-out forwards;`;
      document.body.appendChild(flashBg);
      setTimeout(() => flashBg.remove(), 1200);

      // Falling card body — uses card image when available, large scale
      const imgUrl = window.cardImageUrl ? window.cardImageUrl(cardName) : null;
      const cardEl = document.createElement('div');
      const cardW = Math.max(90, tr.width * 1.15);
      const cardH = cardW * 1.4;
      cardEl.style.cssText = [
        `position:fixed`,
        `left:${cx}px`, `top:${cy - cardH / 2}px`,
        `width:${cardW}px`, `height:${cardH}px`,
        `pointer-events:none`, `z-index:10010`,
        `animation:areaCardFall 1.1s cubic-bezier(0.6, -0.05, 0.4, 1.2) forwards`,
      ].join(';');
      if (imgUrl) {
        const img = document.createElement('img');
        img.src = imgUrl;
        img.style.cssText = `width:100%;height:100%;object-fit:cover;border-radius:6px;box-shadow:0 0 28px rgba(255,200,80,.9),0 0 60px rgba(255,180,40,.5);border:2px solid rgba(255,220,120,.95);`;
        img.draggable = false;
        cardEl.appendChild(img);
      } else {
        cardEl.style.background = 'linear-gradient(135deg,#ffe58a,#d48c1a)';
        cardEl.style.borderRadius = '6px';
        cardEl.style.boxShadow = '0 0 28px rgba(255,200,80,.9)';
      }
      document.body.appendChild(cardEl);
      setTimeout(() => cardEl.remove(), 1300);

      // Impact ring + flash at landing point — fires right before the
      // card fully settles (~75% into the fall).
      setTimeout(() => {
        const ring = document.createElement('div');
        ring.style.cssText = [
          `position:fixed`, `left:${cx}px`, `top:${cy}px`,
          `width:${tr.width * 1.2}px`, `height:${tr.width * 1.2}px`,
          `border:4px solid rgba(255,230,120,.95)`, `border-radius:50%`,
          `box-shadow:0 0 40px rgba(255,220,120,.8), inset 0 0 30px rgba(255,200,80,.4)`,
          `pointer-events:none`, `z-index:10005`,
          `animation:areaImpactRing .9s ease-out forwards`,
        ].join(';');
        document.body.appendChild(ring);
        setTimeout(() => ring.remove(), 950);

        const flash = document.createElement('div');
        flash.style.cssText = [
          `position:fixed`, `left:${cx}px`, `top:${cy}px`,
          `width:${tr.width * 1.6}px`, `height:${tr.width * 1.6}px`,
          `background:radial-gradient(circle, rgba(255,255,220,.95) 0%, rgba(255,200,80,.55) 35%, transparent 75%)`,
          `border-radius:50%`,
          `pointer-events:none`, `z-index:10004`,
          `animation:areaImpactFlash .7s ease-out forwards`,
        ].join(';');
        document.body.appendChild(flash);
        setTimeout(() => flash.remove(), 750);

        // Radial dust particles
        for (let i = 0; i < 18; i++) {
          const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
          const dist = 60 + Math.random() * 80;
          const dx = Math.cos(angle) * dist;
          const dy = Math.sin(angle) * dist * 0.6;
          const size = 6 + Math.random() * 10;
          const p = document.createElement('div');
          p.style.cssText = [
            `position:fixed`, `left:${cx}px`, `top:${cy}px`,
            `width:${size}px`, `height:${size}px`,
            `border-radius:50%`,
            `background:rgba(${200 + Math.random() * 55},${160 + Math.random() * 70},${60 + Math.random() * 80},.9)`,
            `box-shadow:0 0 10px rgba(255,200,100,.5)`,
            `pointer-events:none`, `z-index:10006`,
            `--adx:${dx}px`, `--ady:${dy}px`,
            `animation:areaDustParticle .7s ease-out forwards`,
          ].join(';');
          document.body.appendChild(p);
          setTimeout(() => p.remove(), 750);
        }
      }, 820);
    };
    socket.on('area_descend', onAreaDescend);

    // ── Eraser Beam ──
    //  One of the deadliest Spells in the game. A thick blood-red energy
    //  beam lances from caster to target, wrapped in crackling lightning
    //  arcs. On impact, a dark-red rupture explodes outward with a
    //  lingering smoke/ember afterglow. Plays over ~1.5s total.
    const onEraserBeam = ({ sourceOwner, sourceHeroIdx, targetOwner, targetHeroIdx, targetZoneSlot }) => {
      const srcLabel = sourceOwner === myIdx ? 'me' : 'opp';
      const tgtLabel = targetOwner === myIdx ? 'me' : 'opp';
      const srcEl = document.querySelector(`[data-hero-zone][data-hero-owner="${srcLabel}"][data-hero-idx="${sourceHeroIdx}"]`);
      let tgtEl;
      if (targetZoneSlot != null && targetZoneSlot >= 0) {
        tgtEl = document.querySelector(`[data-support-zone][data-support-owner="${tgtLabel}"][data-support-hero="${targetHeroIdx}"][data-support-slot="${targetZoneSlot}"]`);
      } else {
        tgtEl = document.querySelector(`[data-hero-zone][data-hero-owner="${tgtLabel}"][data-hero-idx="${targetHeroIdx}"]`);
      }
      if (!srcEl || !tgtEl) return;
      const sr = srcEl.getBoundingClientRect();
      const tr = tgtEl.getBoundingClientRect();
      const sx = sr.left + sr.width / 2;
      const sy = sr.top + sr.height / 2;
      const tx = tr.left + tr.width / 2;
      const ty = tr.top + tr.height / 2;
      const dx = tx - sx;
      const dy = ty - sy;
      const len = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;

      if (!document.getElementById('eraser-beam-kf')) {
        const style = document.createElement('style');
        style.id = 'eraser-beam-kf';
        style.textContent = `
          @keyframes eraserBeamCharge {
            0%   { opacity: 0; transform: scale(0.3); }
            35%  { opacity: 1; transform: scale(1.4); }
            70%  { opacity: 1; transform: scale(1.2); }
            100% { opacity: 0; transform: scale(0.9); }
          }
          @keyframes eraserBeamCore {
            0%   { opacity: 0; transform: scaleX(0); }
            25%  { opacity: 1; transform: scaleX(1); }
            75%  { opacity: 1; transform: scaleX(1); }
            100% { opacity: 0; transform: scaleX(1); }
          }
          @keyframes eraserBeamOuter {
            0%   { opacity: 0; transform: scaleX(0) scaleY(0.6); }
            30%  { opacity: 0.9; transform: scaleX(1) scaleY(1.3); }
            70%  { opacity: 0.7; transform: scaleX(1) scaleY(1); }
            100% { opacity: 0; transform: scaleX(1) scaleY(0.5); }
          }
          @keyframes eraserBeamArc {
            0%   { opacity: 0; transform: translateY(-50%) scaleX(0); }
            25%  { opacity: 1; transform: translateY(-50%) scaleX(1); }
            70%  { opacity: 0.8; transform: translateY(-50%) scaleX(1); }
            100% { opacity: 0; transform: translateY(-50%) scaleX(1); }
          }
          @keyframes eraserBeamImpact {
            0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.2); }
            35%  { opacity: 1; transform: translate(-50%, -50%) scale(1.8); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(3); }
          }
          @keyframes eraserBeamEmber {
            0%   { opacity: 0; transform: translate(0,0) scale(0.4); }
            30%  { opacity: 1; }
            100% { opacity: 0; transform: translate(var(--ebeDx), var(--ebeDy)) scale(0.2); }
          }
          @keyframes eraserBeamBolt {
            0%   { opacity: 0; transform: translate(-50%,-50%) rotate(var(--ebbRot)) scaleX(0); }
            30%  { opacity: 1; transform: translate(-50%,-50%) rotate(var(--ebbRot)) scaleX(1); }
            60%  { opacity: 1; }
            100% { opacity: 0; transform: translate(-50%,-50%) rotate(var(--ebbRot)) scaleX(1); }
          }
        `;
        document.head.appendChild(style);
      }

      // Caster charge-up orb — ominous red glow forms at Cooldin... I mean, the source
      const charge = document.createElement('div');
      charge.style.cssText = [
        `position:fixed`, `left:${sx - 36}px`, `top:${sy - 36}px`,
        `width:72px`, `height:72px`, `border-radius:50%`,
        `background:radial-gradient(circle, rgba(255,60,60,1) 0%, rgba(180,0,10,0.95) 40%, rgba(70,0,0,0.75) 70%, transparent 100%)`,
        `box-shadow:0 0 40px rgba(220,20,30,0.95), 0 0 80px rgba(160,0,20,0.7)`,
        `pointer-events:none`, `z-index:10015`, `opacity:0`,
        `animation:eraserBeamCharge 500ms ease-out forwards`,
      ].join(';');
      document.body.appendChild(charge);
      setTimeout(() => charge.remove(), 550);

      // Fire the beam after a short charge delay
      setTimeout(() => {
        // Outer beam glow — thicker, hazier
        const outer = document.createElement('div');
        outer.style.cssText = [
          `position:fixed`, `left:${sx}px`, `top:${sy}px`,
          `width:${len}px`, `height:28px`,
          `transform-origin:0 50%`, `transform:rotate(${angle}deg)`,
          `background:linear-gradient(180deg, transparent 0%, rgba(180,10,20,0.65) 40%, rgba(255,60,60,0.85) 50%, rgba(180,10,20,0.65) 60%, transparent 100%)`,
          `filter:blur(6px)`,
          `pointer-events:none`, `z-index:10011`, `opacity:0`,
          `animation:eraserBeamOuter 1000ms ease-out forwards`,
        ].join(';');
        document.body.appendChild(outer);
        setTimeout(() => outer.remove(), 1050);

        // Rotated container for the beam itself + lightning (so bolts
        // can be placed along the beam axis using left/top relative to
        // a translated origin at the caster).
        const beamWrap = document.createElement('div');
        beamWrap.style.cssText = [
          `position:fixed`, `left:${sx}px`, `top:${sy}px`,
          `width:${len}px`, `height:12px`,
          `transform-origin:0 50%`, `transform:rotate(${angle}deg)`,
          `pointer-events:none`, `z-index:10012`,
        ].join(';');
        document.body.appendChild(beamWrap);

        // Beam core — bright white-red
        const core = document.createElement('div');
        core.style.cssText = [
          `position:absolute`, `left:0`, `top:0`,
          `width:100%`, `height:100%`,
          `transform-origin:0 50%`,
          `background:linear-gradient(180deg, transparent 0%, rgba(220,30,40,0.95) 30%, rgba(255,255,255,0.95) 45%, rgba(255,220,220,0.95) 55%, rgba(220,30,40,0.95) 70%, transparent 100%)`,
          `border-radius:6px`,
          `box-shadow:0 0 20px rgba(255,40,40,0.95), 0 0 40px rgba(180,0,20,0.8)`,
          `opacity:0`,
          `animation:eraserBeamCore 1000ms ease-out forwards`,
        ].join(';');
        beamWrap.appendChild(core);

        // Lightning bolts crackling along the beam — jagged white/yellow
        // segments at random positions, flicker on and off
        for (let i = 0; i < 10; i++) {
          const pos = 0.1 + (i / 10) * 0.85 + Math.random() * 0.05;
          const boltLen = 28 + Math.random() * 44;
          const rot = (Math.random() - 0.5) * 80 + (i % 2 ? 30 : -30);
          const delay = Math.random() * 350;
          const bolt = document.createElement('div');
          bolt.style.cssText = [
            `position:absolute`, `left:${pos * 100}%`, `top:50%`,
            `width:${boltLen}px`, `height:3px`,
            `background:linear-gradient(90deg, transparent 0%, rgba(255,240,180,0.95) 20%, rgba(255,255,255,1) 50%, rgba(255,240,180,0.95) 80%, transparent 100%)`,
            `box-shadow:0 0 10px rgba(255,220,140,0.95), 0 0 20px rgba(255,180,60,0.7)`,
            `opacity:0`, `transform-origin:center`,
            `--ebbRot:${rot}deg`,
            `animation:eraserBeamBolt ${550 + Math.random() * 300}ms ease-out ${delay}ms forwards`,
          ].join(';');
          beamWrap.appendChild(bolt);
        }
        setTimeout(() => beamWrap.remove(), 1100);

        // Impact: dark-red rupture at target + radial embers
        const impact = document.createElement('div');
        impact.style.cssText = [
          `position:fixed`, `left:${tx}px`, `top:${ty}px`,
          `width:120px`, `height:120px`, `border-radius:50%`,
          `background:radial-gradient(circle, rgba(255,240,220,0.95) 0%, rgba(255,60,60,0.9) 25%, rgba(150,0,10,0.75) 55%, rgba(50,0,5,0.4) 85%, transparent 100%)`,
          `box-shadow:0 0 60px rgba(220,30,40,0.9), 0 0 120px rgba(140,0,20,0.55)`,
          `pointer-events:none`, `z-index:10014`, `opacity:0`,
          `animation:eraserBeamImpact 900ms ease-out forwards`,
        ].join(';');
        document.body.appendChild(impact);
        setTimeout(() => impact.remove(), 950);

        for (let i = 0; i < 18; i++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 50 + Math.random() * 90;
          const size = 4 + Math.random() * 6;
          const ember = document.createElement('div');
          ember.style.cssText = [
            `position:fixed`, `left:${tx}px`, `top:${ty}px`,
            `width:${size}px`, `height:${size}px`, `border-radius:50%`,
            `background:radial-gradient(circle, #ffeeaa 0%, #ff4422 50%, #800800 100%)`,
            `box-shadow:0 0 10px rgba(255,80,40,0.9)`,
            `pointer-events:none`, `z-index:10013`, `opacity:0`,
            `--ebeDx:${Math.cos(ang) * dist}px`, `--ebeDy:${Math.sin(ang) * dist - 20}px`,
            `animation:eraserBeamEmber ${700 + Math.random() * 300}ms ease-out ${100 + Math.random() * 200}ms forwards`,
          ].join(';');
          document.body.appendChild(ember);
          setTimeout(() => ember.remove(), 1050);
        }
      }, 350);
    };
    socket.on('eraser_beam', onEraserBeam);

    // ── Cooldin — Terraform ──
    //  Reality-warping wave that engulfs the entire battlefield when
    //  Cooldin reshapes the world with an Area. Fires before the standard
    //  area_descend. The effect is a full-viewport hexagonal grid pulse +
    //  spreading verdant/golden ripples, with bits of earth/stone glyphs
    //  cresting and dissolving — the feel of reality being rewritten.
    const onCooldinTerraform = ({ owner, cardName }) => {
      const container = document.querySelector('.board-center') || document.body;
      const r = container.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      if (!document.getElementById('cooldin-terraform-kf')) {
        const style = document.createElement('style');
        style.id = 'cooldin-terraform-kf';
        style.textContent = `
          @keyframes cooldinBgSweep {
            0%   { opacity: 0; background-position: 0% 0%; }
            20%  { opacity: 0.85; }
            60%  { opacity: 0.75; }
            100% { opacity: 0; background-position: 100% 100%; }
          }
          @keyframes cooldinRipple {
            0%   { opacity: 0; transform: translate(-50%,-50%) scale(0.1); }
            25%  { opacity: 1; }
            100% { opacity: 0; transform: translate(-50%,-50%) scale(4.5); }
          }
          @keyframes cooldinPillar {
            0%   { opacity: 0; transform: translate(-50%, 100%) scaleY(0.2); }
            30%  { opacity: 1; transform: translate(-50%, 0) scaleY(1); }
            70%  { opacity: 0.8; transform: translate(-50%, 0) scaleY(1); }
            100% { opacity: 0; transform: translate(-50%, -20%) scaleY(0.6); }
          }
          @keyframes cooldinGlyph {
            0%   { opacity: 0; transform: translate(-50%,-50%) rotate(0deg) scale(0.3); }
            30%  { opacity: 1; transform: translate(-50%,-50%) rotate(180deg) scale(1); }
            100% { opacity: 0; transform: translate(-50%,-50%) rotate(540deg) scale(1.4); }
          }
        `;
        document.head.appendChild(style);
      }

      // Full-viewport hexagonal grid sweep (emerald-gold shimmer) —
      // reality feels "rewritten"
      const bg = document.createElement('div');
      bg.style.cssText = [
        `position:fixed`, `inset:0`, `pointer-events:none`, `z-index:9993`,
        `background:`
          + `radial-gradient(circle at 50% 50%, rgba(60,180,120,0.35) 0%, transparent 60%),`
          + `radial-gradient(circle at 30% 30%, rgba(255,220,120,0.28) 0%, transparent 55%),`
          + `radial-gradient(circle at 70% 70%, rgba(120,220,200,0.28) 0%, transparent 55%)`,
        `background-size:200% 200%`,
        `animation:cooldinBgSweep 1600ms ease-in-out forwards`,
      ].join(';');
      document.body.appendChild(bg);
      setTimeout(() => bg.remove(), 1650);

      // Concentric ripples expanding from battlefield center
      for (let i = 0; i < 3; i++) {
        const ring = document.createElement('div');
        ring.style.cssText = [
          `position:fixed`, `left:${cx}px`, `top:${cy}px`,
          `width:200px`, `height:200px`, `border-radius:50%`,
          `border:3px solid rgba(120,255,180,0.85)`,
          `box-shadow:0 0 30px rgba(100,240,160,0.8), inset 0 0 25px rgba(80,200,140,0.5)`,
          `pointer-events:none`, `z-index:9994`, `opacity:0`,
          `animation:cooldinRipple 1400ms ease-out ${i * 220}ms forwards`,
        ].join(';');
        document.body.appendChild(ring);
        setTimeout(() => ring.remove(), 1500 + i * 220);
      }

      // Earth pillars rising from the bottom of the field
      const pillarCount = 8;
      for (let i = 0; i < pillarCount; i++) {
        const px = r.left + ((i + 0.5) / pillarCount) * r.width;
        const pillar = document.createElement('div');
        const h = 80 + Math.random() * 110;
        pillar.style.cssText = [
          `position:fixed`, `left:${px}px`, `top:${r.bottom}px`,
          `width:26px`, `height:${h}px`,
          `background:linear-gradient(180deg, rgba(160,100,50,0) 0%, rgba(140,85,40,0.85) 40%, rgba(90,55,20,0.95) 100%)`,
          `border-top:3px solid rgba(200,160,100,0.95)`,
          `box-shadow:0 0 14px rgba(100,220,150,0.75)`,
          `transform-origin:50% 100%`,
          `pointer-events:none`, `z-index:9995`, `opacity:0`,
          `animation:cooldinPillar 1100ms cubic-bezier(0.4, 1.6, 0.55, 1) ${i * 60}ms forwards`,
        ].join(';');
        document.body.appendChild(pillar);
        setTimeout(() => pillar.remove(), 1150 + i * 60);
      }

      // Rotating runic glyphs (just emoji-sized divs) scattered across
      // the battlefield — symbols of god-tier reality-rewriting
      const glyphChars = ['⟐','⟡','✦','❃','✸','◈','☸'];
      for (let i = 0; i < 10; i++) {
        const gx = r.left + Math.random() * r.width;
        const gy = r.top + Math.random() * r.height;
        const glyph = document.createElement('div');
        glyph.textContent = glyphChars[Math.floor(Math.random() * glyphChars.length)];
        glyph.style.cssText = [
          `position:fixed`, `left:${gx}px`, `top:${gy}px`,
          `font-size:${28 + Math.random() * 22}px`,
          `color:rgba(255,240,170,0.95)`,
          `text-shadow:0 0 14px rgba(120,255,160,0.95), 0 0 24px rgba(255,220,100,0.7)`,
          `pointer-events:none`, `z-index:9996`, `opacity:0`,
          `animation:cooldinGlyph ${900 + Math.random() * 400}ms ease-out ${i * 70}ms forwards`,
        ].join(';');
        document.body.appendChild(glyph);
        setTimeout(() => glyph.remove(), 1400 + i * 70);
      }
    };
    socket.on('cooldin_terraform', onCooldinTerraform);

    // ── Big Gwen activation: a huge clock face over the battlefield with
    //    two hands ticking from 11:55 to 12:00 exactly. Not anchored to any
    //    zone — it sits centered above the board-center element.
    const onBigGwenClockActivation = ({ owner }) => {
      const container = document.querySelector('.board-center');
      if (!container) return;
      const r = container.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const size = Math.min(420, Math.min(r.width, r.height) * 0.72);
      if (!document.getElementById('big-gwen-clock-kf')) {
        const style = document.createElement('style');
        style.id = 'big-gwen-clock-kf';
        style.textContent = `
          @keyframes bgClockFadeIn {
            0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.3) rotate(-18deg); }
            40%  { opacity: 1; transform: translate(-50%, -50%) scale(1.08) rotate(4deg); }
            60%  { transform: translate(-50%, -50%) scale(0.98) rotate(-2deg); }
            100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(0deg); }
          }
          @keyframes bgClockFadeOut {
            0%   { opacity: 1; transform: translate(-50%, -50%) scale(1); filter: brightness(1); }
            40%  { opacity: 1; transform: translate(-50%, -50%) scale(1.12); filter: brightness(1.8) drop-shadow(0 0 40px #ffcc33); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(0.7); filter: brightness(1); }
          }
          @keyframes bgHourTick {
            0%   { transform: translate(-50%, -100%) rotate(-30deg); }
            /* tick at each minute from 55 → 60 (= hour 11 → 12) */
            20%  { transform: translate(-50%, -100%) rotate(-24deg); }
            40%  { transform: translate(-50%, -100%) rotate(-18deg); }
            60%  { transform: translate(-50%, -100%) rotate(-12deg); }
            80%  { transform: translate(-50%, -100%) rotate(-6deg); }
            100% { transform: translate(-50%, -100%) rotate(0deg); }
          }
          @keyframes bgMinuteTick {
            /* Minute hand sweeps from 11 (−30°) to 12 (0°) in 5 discrete
               one-second ticks. */
            0%,  19% { transform: translate(-50%, -100%) rotate(-30deg); }
            20%, 39% { transform: translate(-50%, -100%) rotate(-24deg); }
            40%, 59% { transform: translate(-50%, -100%) rotate(-18deg); }
            60%, 79% { transform: translate(-50%, -100%) rotate(-12deg); }
            80%, 99% { transform: translate(-50%, -100%) rotate(-6deg); }
            100%     { transform: translate(-50%, -100%) rotate(0deg); }
          }
          @keyframes bgBell {
            0%   { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
            30%  { opacity: 1; transform: translate(-50%, -50%) scale(1.3); }
            100% { opacity: 0; transform: translate(-50%, -50%) scale(2); }
          }
        `;
        document.head.appendChild(style);
      }

      // Dimmer behind the clock
      const dimmer = document.createElement('div');
      dimmer.style.cssText = 'position:fixed;inset:0;background:radial-gradient(ellipse at center,rgba(20,10,0,.45),rgba(0,0,0,.15) 60%,transparent 90%);pointer-events:none;z-index:10020;opacity:0;animation:bgClockFadeIn 0.6s ease-out forwards,bgClockFadeOut 0.6s ease-in 1.6s forwards;';
      document.body.appendChild(dimmer);
      setTimeout(() => dimmer.remove(), 2300);

      const clock = document.createElement('div');
      clock.style.cssText = [
        `position:fixed`, `left:${cx}px`, `top:${cy}px`,
        `width:${size}px`, `height:${size}px`,
        `pointer-events:none`, `z-index:10021`,
        `transform:translate(-50%,-50%)`,
        `animation:bgClockFadeIn 0.6s cubic-bezier(0.2,0.7,0.4,1.3) forwards,bgClockFadeOut 0.6s ease-in 1.6s forwards`,
      ].join(';');
      // Clock face
      const face = document.createElement('div');
      face.style.cssText = `position:absolute;inset:0;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fffaea 0%,#f2d98a 35%,#b58a2a 75%,#6b4a10 100%);border:8px solid #3a2a0d;box-shadow:0 0 60px rgba(255,200,80,.6),0 0 120px rgba(255,170,40,.3),inset 0 0 24px rgba(120,80,20,.7);`;
      clock.appendChild(face);
      // Numerals (12 roman-ish positions)
      const nums = ['XII','I','II','III','IV','V','VI','VII','VIII','IX','X','XI'];
      for (let i = 0; i < 12; i++) {
        const angle = i * 30 - 90;
        const rad = angle * Math.PI / 180;
        const rr = size * 0.40;
        const nx = size / 2 + Math.cos(rad) * rr;
        const ny = size / 2 + Math.sin(rad) * rr;
        const n = document.createElement('div');
        n.textContent = nums[i];
        n.style.cssText = `position:absolute;left:${nx}px;top:${ny}px;transform:translate(-50%,-50%);color:#2a1a05;font-family:'Cinzel',Georgia,serif;font-weight:900;font-size:${Math.round(size*0.08)}px;text-shadow:0 1px 0 rgba(255,240,180,.7);`;
        clock.appendChild(n);
      }
      // Center pin
      const pin = document.createElement('div');
      pin.style.cssText = `position:absolute;left:50%;top:50%;width:${size*0.06}px;height:${size*0.06}px;border-radius:50%;background:radial-gradient(circle,#ffcc44,#8a5a10);transform:translate(-50%,-50%);box-shadow:0 0 8px rgba(255,200,80,.7);z-index:3;`;
      clock.appendChild(pin);
      // Hour hand (11:55 → 12:00)
      const hour = document.createElement('div');
      hour.style.cssText = `position:absolute;left:50%;top:50%;width:${size*0.045}px;height:${size*0.26}px;background:linear-gradient(180deg,#1a0f05 0%,#3a2a0d 100%);border-radius:${size*0.03}px;transform-origin:50% 100%;transform:translate(-50%,-100%) rotate(-30deg);animation:bgHourTick 1s steps(5,end) forwards;box-shadow:0 0 6px rgba(0,0,0,.6);z-index:2;`;
      clock.appendChild(hour);
      // Minute hand
      const minute = document.createElement('div');
      minute.style.cssText = `position:absolute;left:50%;top:50%;width:${size*0.03}px;height:${size*0.38}px;background:linear-gradient(180deg,#2a1a05 0%,#6b4a10 100%);border-radius:${size*0.02}px;transform-origin:50% 100%;transform:translate(-50%,-100%) rotate(-30deg);animation:bgMinuteTick 1s steps(5,end) forwards;box-shadow:0 0 6px rgba(0,0,0,.6);z-index:2;`;
      clock.appendChild(minute);
      document.body.appendChild(clock);
      setTimeout(() => clock.remove(), 2300);

      // Bell toll flash at 12:00 (after the 1s tick animation completes)
      setTimeout(() => {
        const bell = document.createElement('div');
        bell.style.cssText = [
          `position:fixed`, `left:${cx}px`, `top:${cy}px`,
          `width:${size*0.6}px`, `height:${size*0.6}px`,
          `border-radius:50%`,
          `background:radial-gradient(circle,rgba(255,240,160,.95),rgba(255,190,60,.4),transparent 75%)`,
          `pointer-events:none`, `z-index:10022`,
          `animation:bgBell 0.55s ease-out forwards`,
        ].join(';');
        document.body.appendChild(bell);
        setTimeout(() => bell.remove(), 600);
      }, 1050);
    };
    socket.on('big_gwen_clock_activation', onBigGwenClockActivation);
    const onBoulderFall = ({ owner, heroIdx, zoneSlot }) => {
      if (window.playSFX) window.playSFX('heavy_impact', { category: 'effect' });
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const sel = zoneSlot >= 0
        ? `[data-support-zone][data-support-owner="${ownerLabel}"][data-support-hero="${heroIdx}"][data-support-slot="${zoneSlot}"]`
        : `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`;
      const tgtEl = document.querySelector(sel);
      if (!tgtEl) return;
      const tr = tgtEl.getBoundingClientRect();
      const cx = tr.left + tr.width / 2;
      const cy = tr.top + tr.height / 2;

      if (!document.getElementById('boulder-fall-kf')) {
        const style = document.createElement('style');
        style.id = 'boulder-fall-kf';
        style.textContent = `
          @keyframes boulderDrop {
            0%   { transform: translateY(-220px) rotate(-15deg) scale(0.6); opacity: 0; }
            20%  { opacity: 1; }
            80%  { transform: translateY(0px) rotate(10deg) scale(1.1); opacity: 1; }
            90%  { transform: translateY(8px) rotate(12deg) scale(1.15); }
            100% { transform: translateY(0px) rotate(8deg) scale(0); opacity: 0; }
          }
          @keyframes boulderCrash {
            0%   { transform: scale(0); opacity: 0.9; }
            40%  { transform: scale(2.2); opacity: 0.7; }
            100% { transform: scale(3.5); opacity: 0; }
          }
          @keyframes boulderDebris {
            0%   { transform: translate(0,0) scale(1); opacity: 1; }
            100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      // Giant boulder emoji
      const boulder = document.createElement('div');
      boulder.textContent = '🪨';
      boulder.style.cssText = [
        'position:fixed',
        `left:${cx - 30}px`,
        `top:${cy - 30}px`,
        'width:60px', 'height:60px',
        'font-size:56px', 'line-height:60px', 'text-align:center',
        'pointer-events:none', 'z-index:10002',
        'filter:drop-shadow(0 8px 16px rgba(80,40,0,0.8))',
        'animation:boulderDrop 0.55s ease-in forwards',
      ].join(';');
      document.body.appendChild(boulder);

      // Crash shockwave ring
      setTimeout(() => {
        const ring = document.createElement('div');
        ring.style.cssText = [
          'position:fixed',
          `left:${cx - 20}px`, `top:${cy - 20}px`,
          'width:40px', 'height:40px', 'border-radius:50%',
          'background:radial-gradient(circle,rgba(160,100,40,.9),rgba(100,60,20,.5),transparent)',
          'pointer-events:none', 'z-index:10001',
          'animation:boulderCrash 0.5s ease-out forwards',
        ].join(';');
        document.body.appendChild(ring);
        setTimeout(() => ring.remove(), 550);

        // Debris chunks flying outward
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * 360;
          const dist  = 30 + Math.random() * 40;
          const dx = Math.cos(angle * Math.PI / 180) * dist;
          const dy = Math.sin(angle * Math.PI / 180) * dist;
          const chunk = document.createElement('div');
          chunk.textContent = '🪨';
          chunk.style.cssText = [
            'position:fixed',
            `left:${cx - 8}px`, `top:${cy - 8}px`,
            'font-size:14px',
            'pointer-events:none', 'z-index:10001',
            `--dx:${dx}px`, `--dy:${dy}px`,
            `animation:boulderDebris ${0.4 + Math.random() * 0.2}s ease-out forwards`,
          ].join(';');
          document.body.appendChild(chunk);
          setTimeout(() => chunk.remove(), 700);
        }
      }, 450);

      setTimeout(() => boulder.remove(), 700);
    };
    socket.on('boulder_fall', onBoulderFall);
    const onSlowDarkMagic = ({ ownerIdx }) => {
      if (window.playSFX) window.playSFX('elem_dark', { category: 'effect' });
      // Animate on the hand of the player who is discarding
      const ownerLabel = ownerIdx === myIdx ? 'me' : 'opp';
      const handEl = document.querySelector(`.game-hand-${ownerLabel}`);
      if (!handEl) return;
      const r = handEl.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;

      if (!document.getElementById('slow-dark-magic-kf')) {
        const style = document.createElement('style');
        style.id = 'slow-dark-magic-kf';
        style.textContent = `
          @keyframes slowMagicRise {
            0%   { transform: translate(0, 0) scale(0.4); opacity: 0; }
            25%  { opacity: 1; }
            100% { transform: translate(var(--smx), var(--smy)) scale(0); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      const symbols = ['✦','✧','⬟','◆','✵','❋','⁕'];
      for (let i = 0; i < 14; i++) {
        const p = document.createElement('div');
        const angle = (i / 14) * 360 + Math.random() * 20;
        const dist  = 20 + Math.random() * 55;
        const dx    = Math.cos(angle * Math.PI / 180) * dist;
        const dy    = Math.sin(angle * Math.PI / 180) * dist;
        const size  = 10 + Math.random() * 14;
        const delay = Math.random() * 200;
        const dur   = 500 + Math.random() * 400;
        const col   = Math.random() > 0.5 ? '#cc44ff' : '#8822dd';
        p.textContent = symbols[Math.floor(Math.random() * symbols.length)];
        p.style.cssText = [
          'position:fixed',
          `left:${cx + (Math.random() - 0.5) * r.width * 0.7}px`,
          `top:${cy + (Math.random() - 0.5) * r.height * 0.7}px`,
          `font-size:${size}px`, `color:${col}`,
          `filter:drop-shadow(0 0 5px ${col})`,
          'pointer-events:none', 'z-index:10100',
          `--smx:${dx}px`, `--smy:${dy}px`,
          `animation:slowMagicRise ${dur}ms ease-out ${delay}ms forwards`,
          'opacity:0',
        ].join(';');
        document.body.appendChild(p);
        setTimeout(() => p.remove(), dur + delay + 50);
      }
    };
    socket.on('slow_dark_magic', onSlowDarkMagic);
    const onCardEffectFlash = ({ owner, heroIdx, zoneSlot }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const sel = (zoneSlot != null && zoneSlot >= 0)
        ? `[data-support-zone][data-support-owner="${ownerLabel}"][data-support-hero="${heroIdx}"][data-support-slot="${zoneSlot}"]`
        : `[data-hero-zone][data-hero-owner="${ownerLabel}"][data-hero-idx="${heroIdx}"]`;
      setTimeout(() => playAnimation('gold_sparkle', sel, { duration: 1400 }), 50);
      setTimeout(() => playAnimation('gold_sparkle', sel, { duration: 1200 }), 250);
      setTimeout(() => playAnimation('gold_sparkle', sel, { duration: 1000 }), 450);
    };
    socket.on('card_effect_flash', onCardEffectFlash);

    // Gold steal — paint a coin-particle burst on the victim's and the
    // thief's gold counters. The +/− numeric overlays are already
    // handled automatically by the gold-change watcher.
    const onGoldStealBurst = ({ fromPlayer, toPlayer, amount }) => {
      const fromSel = `[data-gold-player="${fromPlayer}"]`;
      const toSel = `[data-gold-player="${toPlayer}"]`;
      const fromEl = document.querySelector(fromSel);
      const toEl = document.querySelector(toSel);
      if (!fromEl || !toEl) return;
      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();
      // Flash both counters with gold_sparkle for a quick pop.
      setTimeout(() => playAnimation('gold_sparkle', fromSel, { duration: 900 }), 50);
      setTimeout(() => playAnimation('gold_sparkle', toSel,   { duration: 900 }), 180);
      // Spawn `amount` coin particles (capped at 12 for visual density)
      // that arc from the victim's counter to the thief's counter.
      const count = Math.min(12, Math.max(4, amount));
      const startX = fromRect.left + fromRect.width / 2;
      const startY = fromRect.top + fromRect.height / 2;
      const endX = toRect.left + toRect.width / 2;
      const endY = toRect.top + toRect.height / 2;
      for (let i = 0; i < count; i++) {
        const coin = document.createElement('div');
        const delay = i * 55;
        const jitterX = (Math.random() - 0.5) * 44;
        const jitterY = -30 - Math.random() * 35;
        const dur = 700 + Math.random() * 200;
        coin.textContent = '🪙';
        coin.style.cssText = [
          'position:fixed',
          `left:${startX - 10}px`, `top:${startY - 10}px`,
          'font-size:20px', 'line-height:1', 'pointer-events:none',
          'z-index:10250',
          'filter:drop-shadow(0 0 6px rgba(255,220,100,.85)) drop-shadow(0 0 10px rgba(255,160,40,.6))',
          `--gsDx:${endX - startX}px`, `--gsDy:${endY - startY}px`,
          `--gsMx:${jitterX}px`, `--gsMy:${jitterY}px`,
          `animation:goldStealCoin ${dur}ms cubic-bezier(0.4, 0.1, 0.2, 1) ${delay}ms forwards`,
          'opacity:0',
        ].join(';');
        document.body.appendChild(coin);
        setTimeout(() => coin.remove(), delay + dur + 100);
      }
    };
    socket.on('gold_steal_burst', onGoldStealBurst);
    const onJumpscareBox = ({ owner, heroIdx }) => {
      if (window.playSFX) window.playSFX('jumpscare', { category: 'effect' });
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
      if (window.playSFX) window.playSFX('negate');
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
      if (window.playSFX) window.playSFX('elem_fire', { category: 'effect' });
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
    // ── Flashbang: full-viewport white flash ──
    // The Potion broadcasts `flashbang_screen` from its resolve() and again
    // when the trigger fires on the opponent's first action. Both events
    // produce the same overlay — a brief opaque-white flash that fades out.
    const onFlashbangScreen = () => {
      // 'match_found' has the bright, sharp tone that fits the
      // disorienting flashbang — see SFX_NAMES in app-shared.jsx.
      if (window.playSFX) window.playSFX('match_found', { dedupe: 200, category: 'effect' });
      if (!document.getElementById('flashbang-screen-kf')) {
        const style = document.createElement('style');
        style.id = 'flashbang-screen-kf';
        style.textContent = `
          @keyframes flashbangScreen {
            0%   { opacity: 0; }
            10%  { opacity: 1; }
            45%  { opacity: 1; }
            100% { opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }
      const overlay = document.createElement('div');
      overlay.style.cssText = [
        'position:fixed', 'left:0', 'top:0',
        'width:100vw', 'height:100vh',
        'background:#fff',
        'pointer-events:none', 'z-index:99999',
        'opacity:0',
        'animation:flashbangScreen 850ms ease-out forwards',
      ].join(';');
      document.body.appendChild(overlay);
      setTimeout(() => overlay.remove(), 900);
    };
    socket.on('flashbang_screen', onFlashbangScreen);
    // ── Gathering Storm: per-target lightning strike SFX ──
    // Server fires this alongside the electric_strike zone animation
    // for each target hit by the storm's start-of-turn damage. Plays
    // the lightning SFX at full volume (the ambient bolt rumbles use
    // a much lower volume; THIS one is the "strike landed" punch).
    const onGatheringStormStrike = () => {
      if (window.playSFX) window.playSFX('elem_lightning', { dedupe: 80, category: 'effect' });
    };
    socket.on('gathering_storm_strike', onGatheringStormStrike);
    // ── Compulsory Body Swap: two ghost copies cross paths between heroes ──
    // Server broadcasts `body_swap_souls` with the two hero coords + a
    // duration; we paint a semi-transparent ghost portrait of each hero
    // anchored at its origin and animate it across to the other slot.
    // The two ghosts cross at the midpoint, symbolising the souls
    // changing places.
    const onBodySwapSouls = ({ a, b, durationMs }) => {
      const dur = durationMs || 1000;
      const labelA = a.owner === myIdx ? 'me' : 'opp';
      const labelB = b.owner === myIdx ? 'me' : 'opp';
      const aEl = document.querySelector(`[data-hero-zone][data-hero-owner="${labelA}"][data-hero-idx="${a.heroIdx}"]`);
      const bEl = document.querySelector(`[data-hero-zone][data-hero-owner="${labelB}"][data-hero-idx="${b.heroIdx}"]`);
      if (!aEl || !bEl) return;
      const ar = aEl.getBoundingClientRect();
      const br = bEl.getBoundingClientRect();
      const ax = ar.left + ar.width / 2, ay = ar.top + ar.height / 2;
      const bx = br.left + br.width / 2, by = br.top + br.height / 2;

      // Inject keyframes once per session.
      if (!document.getElementById('body-swap-souls-kf')) {
        const style = document.createElement('style');
        style.id = 'body-swap-souls-kf';
        style.textContent = `
          @keyframes bodySwapGhostFly {
            0%   { opacity: 0; transform: translate(0, 0) scale(0.9); }
            15%  { opacity: 0.85; transform: translate(calc(var(--bsDx) * 0.15), calc(var(--bsDy) * 0.15)) scale(1.05); }
            85%  { opacity: 0.85; transform: translate(calc(var(--bsDx) * 0.85), calc(var(--bsDy) * 0.85)) scale(1.05); }
            100% { opacity: 0; transform: translate(var(--bsDx), var(--bsDy)) scale(0.9); }
          }
          @keyframes bodySwapGhostHalo {
            0%, 100% { box-shadow: 0 0 18px rgba(180, 220, 255, 0.55), 0 0 38px rgba(120, 180, 255, 0.35); }
            50%      { box-shadow: 0 0 30px rgba(220, 240, 255, 0.85), 0 0 60px rgba(160, 200, 255, 0.5);  }
          }
        `;
        document.head.appendChild(style);
      }

      // Each ghost is the hero's actual card image at reduced opacity,
      // wrapped in a frosty halo so it reads as a soul rather than a
      // duplicate portrait. Image URL routes through window.cardImageUrl
      // (defined in app-shared.jsx) — same lookup BoardCard uses, so
      // skin overrides aren't relevant here (skins are server-managed
      // per-card and we want the canonical hero portrait for the swap).
      const imgFor = (heroName) => (window.cardImageUrl ? window.cardImageUrl(heroName) : null);
      const makeGhost = (sx, sy, dx, dy, heroName) => {
        const ghost = document.createElement('div');
        ghost.style.cssText = [
          'position:fixed',
          `left:${sx - 40}px`, `top:${sy - 56}px`,
          'width:80px', 'height:112px',
          'border-radius:10px',
          'overflow:hidden',
          // Soft cyan-white halo around the soul portrait.
          'box-shadow:0 0 18px rgba(180,220,255,0.65), 0 0 38px rgba(120,180,255,0.4)',
          'border:1.5px solid rgba(220,240,255,0.7)',
          'pointer-events:none', 'z-index:10080',
          'opacity:0',
          `--bsDx:${dx}px`, `--bsDy:${dy}px`,
          `animation:bodySwapGhostFly ${dur}ms ease-in-out forwards, bodySwapGhostHalo ${Math.round(dur / 2)}ms ease-in-out infinite`,
        ].join(';');
        const url = imgFor(heroName);
        if (url) {
          // Layer 1: the actual portrait.
          const img = document.createElement('img');
          img.src = url;
          img.style.cssText = [
            'position:absolute', 'inset:0',
            'width:100%', 'height:100%',
            'object-fit:cover',
            'opacity:0.7',
            'filter:saturate(0.85) brightness(1.1)',
          ].join(';');
          img.draggable = false;
          ghost.appendChild(img);
          // Layer 2: cool blue tint over the portrait so it reads as a
          // ghost rather than a duplicate live hero.
          const tint = document.createElement('div');
          tint.style.cssText = [
            'position:absolute', 'inset:0',
            'background:linear-gradient(180deg, rgba(180,220,255,0.45) 0%, rgba(140,190,240,0.35) 60%, rgba(110,170,230,0.40) 100%)',
            'mix-blend-mode:screen',
          ].join(';');
          ghost.appendChild(tint);
        } else {
          // Fallback for cards without a registered image — labelled
          // soul ribbon so the swap still reads correctly.
          ghost.style.cssText += ';background:linear-gradient(180deg, rgba(220,240,255,0.55) 0%, rgba(150,200,255,0.45) 100%);display:flex;align-items:flex-end;justify-content:center;padding-bottom:6px;font-size:11px;font-weight:700;color:#fff;text-shadow:0 0 4px rgba(60,100,160,0.9)';
          ghost.textContent = (heroName || '').split(',')[0].slice(0, 14);
        }
        document.body.appendChild(ghost);
        setTimeout(() => ghost.remove(), dur + 60);
      };

      makeGhost(ax, ay, bx - ax, by - ay, a.name);
      makeGhost(bx, by, ax - bx, ay - by, b.name);

      if (window.playSFX) window.playSFX('ability_activate', { dedupe: 200, category: 'effect' });
    };
    socket.on('body_swap_souls', onBodySwapSouls);
    // ── Forbidden Zone: battlefield-wide eerie red light ──
    // Brief overlay that bathes the entire viewport in a pulsing red
    // glow while the spell resolves. Fades in fast, holds at full,
    // fades out over the back half. Pure visual — the per-target
    // damage flashes inside still play normally underneath.
    const onForbiddenZoneOverlay = ({ durationMs } = {}) => {
      const dur = durationMs || 2200;
      if (window.playSFX) window.playSFX('elem_dark', { dedupe: 200, category: 'effect' });
      if (!document.getElementById('forbidden-zone-overlay-kf')) {
        const style = document.createElement('style');
        style.id = 'forbidden-zone-overlay-kf';
        style.textContent = `
          @keyframes forbiddenZoneFade {
            0%   { opacity: 0; }
            12%  { opacity: 1; }
            70%  { opacity: 0.85; }
            100% { opacity: 0; }
          }
          @keyframes forbiddenZonePulse {
            0%, 100% { filter: hue-rotate(-6deg) saturate(1.15) brightness(0.95); }
            50%      { filter: hue-rotate(8deg)  saturate(1.4)  brightness(1.05); }
          }
        `;
        document.head.appendChild(style);
      }
      const overlay = document.createElement('div');
      overlay.style.cssText = [
        'position:fixed', 'left:0', 'top:0',
        'width:100vw', 'height:100vh',
        'background:radial-gradient(ellipse at 50% 50%, rgba(140,0,0,0.55) 0%, rgba(80,0,0,0.45) 55%, rgba(30,0,0,0.55) 100%)',
        'mix-blend-mode:multiply',
        'pointer-events:none', 'z-index:9998',
        'opacity:0',
        `animation:forbiddenZoneFade ${dur}ms ease-out forwards, forbiddenZonePulse 900ms ease-in-out infinite`,
      ].join(';');
      document.body.appendChild(overlay);
      // Concentric ring pulse to sell the "forbidden seal" vibe.
      const ring = document.createElement('div');
      ring.style.cssText = [
        'position:fixed',
        'left:50%', 'top:50%',
        'width:60px', 'height:60px',
        'transform:translate(-50%, -50%)',
        'border:6px solid rgba(255,40,40,0.9)',
        'border-radius:50%',
        'box-shadow:0 0 60px rgba(255,40,40,0.7), inset 0 0 30px rgba(255,40,40,0.5)',
        'pointer-events:none', 'z-index:9999',
        'opacity:0',
        `animation:forbiddenZoneFade ${dur}ms ease-out forwards`,
      ].join(';');
      document.body.appendChild(ring);
      setTimeout(() => { overlay.remove(); ring.remove(); }, dur + 60);
    };
    socket.on('forbidden_zone_overlay', onForbiddenZoneOverlay);
    // ── Prophecy of Tempeste: permanent rain while attached ──
    // Lifecycle is owned by the server: `tempeste_rain_start` adds an
    // entry keyed by instance id, `tempeste_rain_stop` removes it. The
    // <TempesteRainOverlay/> component renders one per active entry.
    const onTempesteRainStart = ({ instId }) => {
      if (instId == null) return;
      setTempesteRainInsts(prev => prev.includes(instId) ? prev : [...prev, instId]);
    };
    const onTempesteRainStop = ({ instId }) => {
      if (instId == null) {
        setTempesteRainInsts([]);
        return;
      }
      setTempesteRainInsts(prev => prev.filter(id => id !== instId));
    };
    socket.on('tempeste_rain_start', onTempesteRainStart);
    socket.on('tempeste_rain_stop', onTempesteRainStop);
    // Tempeste single-strike redirect line — same SFX as Gathering
    // Storm's distant rumble so the redirect reads as a thunderclap.
    const onTempesteRedirectStrike = () => {
      if (window.playSFX) window.playSFX('elem_lightning', { dedupe: 120, category: 'effect' });
    };
    socket.on('tempeste_redirect_strike', onTempesteRedirectStrike);
    // ── Creature damage absorbed-to-zero floater ──
    // The HP-diff-based floater pass downstream only fires when HP
    // actually changed. Damage absorbed all the way to 0 (Loyal
    // Labradoodle, Flame Avalanche damageLocked, future "reduce to
    // 0" effects) leaves HP unchanged, so the engine emits this
    // explicit event with `amount: 0` and we surface a "0" floater
    // on the absorbing creature's slot.
    const onCreatureDamageFloater = ({ owner, heroIdx, zoneSlot, amount }) => {
      if (owner == null || heroIdx == null || zoneSlot == null) return;
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const entry = {
        id: Date.now() + Math.random(),
        amount: amount || 0,
        ownerLabel, heroIdx, zoneSlot,
      };
      setCreatureDamageNumbers(prev => [...prev, entry]);
      setTimeout(() => {
        setCreatureDamageNumbers(prev => prev.filter(d => d.id !== entry.id));
      }, 1800);
    };
    socket.on('creature_damage_floater', onCreatureDamageFloater);
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
      if (window.playSFX) window.playSFX('ability_activate');
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const el = document.querySelector(`[data-perm-id="${permId}"][data-perm-owner="${ownerLabel}"]`);
      if (el) playAnimation(type || 'holy_revival', el, { duration: 1200 });
    };
    socket.on('play_permanent_animation', onPermanentAnim);
    const onRamAnimation = ({ sourceOwner, sourceHeroIdx, sourceZoneSlot, targetOwner, targetHeroIdx, targetZoneSlot, targetZoneType, targetPermId, cardName, duration, trailType }) => {
      if (window.playSFX) window.playSFX('attack_ram', { category: 'effect' });
      const srcLabel = sourceOwner === myIdx ? 'me' : 'opp';
      const tgtLabel = targetOwner === myIdx ? 'me' : 'opp';
      // If sourceZoneSlot is provided, originate from that support zone; otherwise from the hero zone.
      const srcEl = (sourceZoneSlot != null && sourceZoneSlot >= 0)
        ? document.querySelector(`[data-support-zone][data-support-owner="${srcLabel}"][data-support-hero="${sourceHeroIdx}"][data-support-slot="${sourceZoneSlot}"]`)
        : document.querySelector(`[data-hero-zone][data-hero-owner="${srcLabel}"][data-hero-idx="${sourceHeroIdx}"]`);
      let tgtEl;
      if (targetZoneType === 'ability' && targetHeroIdx >= 0 && targetZoneSlot >= 0) {
        tgtEl = document.querySelector(`[data-ability-zone][data-ability-owner="${tgtLabel}"][data-ability-hero="${targetHeroIdx}"][data-ability-slot="${targetZoneSlot}"]`);
      } else if (targetZoneType === 'permanent' && targetPermId) {
        tgtEl = document.querySelector(`[data-perm-id="${targetPermId}"][data-perm-owner="${tgtLabel}"]`);
      } else if (targetZoneType === 'area') {
        tgtEl = document.querySelector(`[data-area-zone][data-area-owner="${tgtLabel}"]`);
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
        srcOwner: sourceOwner, srcHeroIdx: sourceHeroIdx,
        // Preserve the source zone slot so the hero-hide check
        // (isRamming) can distinguish a hero-originated ram (slot < 0)
        // from a creature-originated ram (slot >= 0). Creature rams
        // must NOT hide the hero in the same column.
        srcZoneSlot: (sourceZoneSlot != null && sourceZoneSlot >= 0) ? sourceZoneSlot : -1,
        dur, angle, trailType,
      }]);
      setTimeout(() => setRamAnims(prev => prev.filter(a => a.id !== id)), dur);
    };
    socket.on('play_ram_animation', onRamAnimation);
    const onCardTransfer = ({ sourceOwner, sourceHeroIdx, sourceZoneSlot, targetOwner, targetHeroIdx, targetZoneSlot, cardName, duration, particles }) => {
      if (window.playSFX) window.playSFX('placement');
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
    const onProjectileAnimation = ({ sourceOwner, sourceHeroIdx, sourceZoneSlot, targetOwner, targetHeroIdx, targetZoneSlot, emoji, duration, trailClass, emojiStyle, projectileClass }) => {
      if (window.playSFX) window.playSFX('projectile', { category: 'effect' });
      const srcLabel = sourceOwner === myIdx ? 'me' : 'opp';
      const tgtLabel = targetOwner === myIdx ? 'me' : 'opp';
      const srcEl = (sourceZoneSlot != null && sourceZoneSlot >= 0)
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
      if (window.playSFX) window.playSFX('heavy_impact', { category: 'effect' });
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
    // Generic pile-to-pile flying card animation. Used for moves the
    // automatic hand → pile detector can't see — specifically
    // discard → deleted (Mass Multiplication's consumed source card).
    const onPileTransfer = ({ owner, cardName, from, to, fromHeroIdx, fromSlotIdx, fromHandIdx, toHandIdx, toHeroIdx, toSlotIdx }) => {
      const isMe = owner === myIdx;
      const ownerLabel = isMe ? 'me' : 'opp';
      // Pre-register the upcoming hand arrival so the hand-count auto-
      // animation effect(s) suppress their own draw anim. Without this,
      // the client would overlay a spurious "flew from deck / opp hand"
      // animation on top of the authoritative pile-transfer flight.
      if (to === 'hand') {
        if (isMe) pileTransferToHandPendingMeRef.current  += 1;
        else      pileTransferToHandPendingOppRef.current += 1;
      }
      // Resolve `pile` + locator extras to a DOM element. Tries the most
      // specific selector first and falls back on a generic container
      // when the specific target may not exist yet (e.g. a hand slot
      // that's about to be added on the next React render).
      const elementFor = (pile, extras = {}) => {
        if (pile === 'discard') return document.querySelector(isMe ? '[data-my-discard]' : '[data-opp-discard]');
        if (pile === 'deleted') return document.querySelector(isMe ? '[data-my-deleted]' : '[data-opp-deleted]');
        if (pile === 'area')    return document.querySelector(`[data-area-zone][data-area-owner="${ownerLabel}"]`);
        if (pile === 'support' && extras.heroIdx != null && extras.slotIdx != null) {
          return document.querySelector(`[data-support-zone][data-support-owner="${ownerLabel}"][data-support-hero="${extras.heroIdx}"][data-support-slot="${extras.slotIdx}"]`);
        }
        if (pile === 'hand') {
          const base = isMe ? '.game-hand-me' : '.game-hand-opp';
          if (extras.handIdx != null) {
            const specific =
              document.querySelector(`${base} .hand-slot[data-hand-idx="${extras.handIdx}"]`) ||
              document.querySelector(`${base} [data-hand-idx="${extras.handIdx}"]`);
            if (specific) return specific;
            // Slot might not exist yet — fall back to the last existing slot
            // (end of hand where new cards land) or the container.
            const slots = document.querySelectorAll(`${base} .hand-slot, ${base} [data-hand-idx]`);
            if (slots.length > 0) return slots[slots.length - 1];
          }
          return document.querySelector(base);
        }
        return null;
      };
      const srcEl = elementFor(from, { heroIdx: fromHeroIdx, slotIdx: fromSlotIdx, handIdx: fromHandIdx });
      const tgtEl = elementFor(to,   { handIdx: toHandIdx, heroIdx: toHeroIdx, slotIdx: toSlotIdx });
      if (!srcEl || !tgtEl) return;

      // Hide the landing hand slot until the flying card arrives so both
      // copies aren't simultaneously visible. Keyed by `${owner}-${idx}`.
      if (to === 'hand' && toHandIdx != null) {
        const hideKey = `${owner}-${toHandIdx}`;
        setBounceReturnHidden(prev => {
          const next = new Set(prev);
          next.add(hideKey);
          return next;
        });
        setTimeout(() => {
          setBounceReturnHidden(prev => {
            if (!prev.has(hideKey)) return prev;
            const next = new Set(prev);
            next.delete(hideKey);
            return next;
          });
        }, 720); // Animation is 700ms; +20ms to avoid a visible flicker.
      }

      // Mirror for hand → support: hide the destination support-slot's
      // rendered card until the flying card lands, so the newly-placed
      // creature "appears" only when the inbound animation arrives. This
      // is what makes the Deepsea swap visually CROSS — old flies to
      // hand while new flies to support at the same time.
      if (to === 'support' && toHeroIdx != null && toSlotIdx != null) {
        const hideKey = `${owner}-${toHeroIdx}-${toSlotIdx}`;
        setBounceOutgoingHidden(prev => {
          const next = new Set(prev);
          next.add(hideKey);
          return next;
        });
        setTimeout(() => {
          setBounceOutgoingHidden(prev => {
            if (!prev.has(hideKey)) return prev;
            const next = new Set(prev);
            next.delete(hideKey);
            return next;
          });
        }, 720);
      }

      const sr = srcEl.getBoundingClientRect();
      const tr = tgtEl.getBoundingClientRect();
      const srcX = sr.left + sr.width  / 2;
      const srcY = sr.top  + sr.height / 2;
      const dx = (tr.left + tr.width  / 2) - srcX;
      const dy = (tr.top  + tr.height / 2) - srcY;

      if (!document.getElementById('pile-transfer-keyframes')) {
        const style = document.createElement('style');
        style.id = 'pile-transfer-keyframes';
        style.textContent = `
          @keyframes pileTransfer {
            0%   { transform: translate(0,0) scale(1); opacity: 1; }
            20%  { transform: translate(0, -16px) scale(1.08); opacity: 1; }
            80%  { transform: translate(var(--ptDx), calc(var(--ptDy) - 10px)) scale(0.92); opacity: 1; }
            100% { transform: translate(var(--ptDx), var(--ptDy)) scale(0.7); opacity: 0; }
          }
          /* Hand-landing variant: no fade/shrink at the end. The card
             arrives solidly so the reveal of the hidden hand slot
             (unhid at t=720ms) is visually continuous. */
          @keyframes pileTransferToHand {
            0%   { transform: translate(0,0) scale(1); opacity: 1; }
            20%  { transform: translate(0, -16px) scale(1.08); opacity: 1; }
            80%  { transform: translate(var(--ptDx), calc(var(--ptDy) - 10px)) scale(0.98); opacity: 1; }
            100% { transform: translate(var(--ptDx), var(--ptDy)) scale(1); opacity: 1; }
          }
        `;
        document.head.appendChild(style);
      }

      const card = document.createElement('div');
      const imgUrl = window.cardImageUrl ? window.cardImageUrl(cardName) : null;
      const isToHand = (to === 'hand');
      const isToSupport = (to === 'support');
      // Hand-landing and support-landing use a teal glow (matches
      // Deepsea's aesthetic) and the solid-landing variant; discard/
      // deleted/area destinations keep the classic violet fade-out.
      const glow = (isToHand || isToSupport)
        ? 'box-shadow:0 0 14px rgba(100,220,255,0.85),0 0 4px rgba(60,170,230,0.55)'
        : 'box-shadow:0 0 12px rgba(180,80,255,0.7),0 0 4px rgba(120,40,200,0.5)';
      const anim = (isToHand || isToSupport) ? 'pileTransferToHand' : 'pileTransfer';
      card.style.cssText = [
        'position:fixed',
        `left:${srcX - 32}px`, `top:${srcY - 44}px`,
        'width:64px', 'height:88px', 'z-index:10200', 'pointer-events:none',
        'border-radius:4px', 'overflow:hidden',
        glow,
        `--ptDx:${dx}px`, `--ptDy:${dy}px`,
        `animation:${anim} 700ms ease-in-out forwards`,
        'opacity:0',
      ].join(';');
      if (imgUrl) {
        const img = document.createElement('img');
        img.src = imgUrl;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        img.draggable = false;
        card.appendChild(img);
        card.style.opacity = '1';
      } else {
        card.style.background = 'linear-gradient(135deg,#2a1a4a,#1a0a3a)';
        card.style.opacity = '1';
        card.innerHTML = `<div style="color:#c8a;font-size:8px;padding:4px;text-align:center;word-break:break-word;">${cardName}</div>`;
      }
      document.body.appendChild(card);
      setTimeout(() => card.remove(), 800);
    };
    socket.on('play_pile_transfer', onPileTransfer);
    const onDeckToDiscard = ({ owner, cardNames, deleteMode, holdDuration }) => {
      const isMe    = owner === myIdx;
      // Pre-register the milled names so the pile-growth auto-detector
      // doesn't spawn a phantom board→pile flight when one of these
      // names happens to also exist on the board (common case:
      // Abilities being milled while a same-named Ability is equipped).
      if (Array.isArray(cardNames) && cardNames.length > 0) {
        const pending = isMe ? deckToDiscardPendingMeRef.current : deckToDiscardPendingOppRef.current;
        const bucket = deleteMode ? 'deleted' : 'discard';
        pending[bucket].push(...cardNames);
      }
      const deckSel     = isMe ? '[data-my-deck]'    : '[data-opp-deck]';
      const discardSel  = isMe
        ? (deleteMode ? '[data-my-deleted]'  : '[data-my-discard]')
        : (deleteMode ? '[data-opp-deleted]' : '[data-opp-discard]');
      const srcEl = document.querySelector(deckSel);
      const tgtEl = document.querySelector(discardSel);
      if (!srcEl || !tgtEl || !cardNames || cardNames.length === 0) return;

      const sr  = srcEl.getBoundingClientRect();
      const tr  = tgtEl.getBoundingClientRect();
      const srcX = sr.left + sr.width  / 2;
      const srcY = sr.top  + sr.height / 2;
      const dx  = (tr.left + tr.width  / 2) - srcX;
      const dy  = (tr.top  + tr.height / 2) - srcY;

      if (!document.getElementById('deck-to-discard-keyframes')) {
        const style = document.createElement('style');
        style.id = 'deck-to-discard-keyframes';
        style.textContent = `
          @keyframes deckToDiscard {
            0%   { transform: translate(0,0) scale(1); opacity: 1; }
            20%  { transform: translate(0,-18px) scale(1.08); opacity: 1; }
            80%  { transform: translate(var(--dtdsDx), calc(var(--dtdsDy) - 10px)) scale(0.92); opacity: 1; }
            100% { transform: translate(var(--dtdsDx), var(--dtdsDy)) scale(0.72); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      for (let i = 0; i < cardNames.length; i++) {
        const card    = document.createElement('div');
        const imgUrl  = window.cardImageUrl ? window.cardImageUrl(cardNames[i]) : null;
        const delay   = i * 200;
        const holdMs  = holdDuration || 0;
        const travelMs = 700;
        const totalMs  = travelMs + holdMs + (holdMs > 0 ? 300 : 0); // travel + hold + fade-out

        // For cards with a hold phase, generate a unique keyframe
        let animName = 'deckToDiscard';
        if (holdMs > 0) {
          const kfId   = `dtd-hold-${travelMs}-${holdMs}`;
          animName     = kfId;
          if (!document.getElementById(kfId)) {
            const tPct  = Math.round((travelMs / totalMs) * 100);
            const hPct  = Math.round(((travelMs + holdMs) / totalMs) * 100);
            const style = document.createElement('style');
            style.id    = kfId;
            style.textContent = `
              @keyframes ${kfId} {
                0%     { transform: translate(0,0) scale(1); opacity: 1; }
                ${Math.round(tPct * 0.25)}% { transform: translate(0,-18px) scale(1.08); opacity: 1; }
                ${Math.round(tPct * 0.85)}% { transform: translate(var(--dtdsDx), calc(var(--dtdsDy) - 10px)) scale(0.92); opacity: 1; }
                ${tPct}%  { transform: translate(var(--dtdsDx), var(--dtdsDy)) scale(0.88); opacity: 1; }
                ${hPct}%  { transform: translate(var(--dtdsDx), var(--dtdsDy)) scale(0.88); opacity: 1; }
                100%   { transform: translate(var(--dtdsDx), var(--dtdsDy)) scale(0.72); opacity: 0; }
              }
            `;
            document.head.appendChild(style);
          }
        }

        card.style.cssText = [
          'position:fixed',
          `left:${srcX - 32}px`, `top:${srcY - 44}px`,
          'width:64px', 'height:88px', 'z-index:10200', 'pointer-events:none',
          'border-radius:4px', 'overflow:hidden',
          'box-shadow:0 0 12px rgba(180,80,255,0.7),0 0 4px rgba(120,40,200,0.5)',
          `--dtdsDx:${dx}px`, `--dtdsDy:${dy}px`,
          `animation:${animName} ${totalMs}ms ease-in-out ${delay}ms forwards`,
          'opacity:0',
        ].join(';');
        if (imgUrl) {
          const img = document.createElement('img');
          img.src        = imgUrl;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          img.draggable  = false;
          card.appendChild(img);
          card.style.opacity = '1';
        } else {
          card.style.background = 'linear-gradient(135deg,#2a1a4a,#1a0a3a)';
          card.style.opacity    = '1';
          card.innerHTML = `<div style="color:#c8a;font-size:8px;padding:4px;text-align:center;word-break:break-word;">${cardNames[i]}</div>`;
        }
        document.body.appendChild(card);
        setTimeout(() => card.remove(), delay + totalMs + 100);
      }
    };
    socket.on('deck_to_discard_animation', onDeckToDiscard);
    const onDeckToAbility = ({ owner, heroIdx, slotIdx, cardName, count }) => {
      const ownerLabel = owner === myIdx ? 'me' : 'opp';
      const deckSel = ownerLabel === 'me' ? '[data-my-deck]' : '[data-opp-deck]';
      const abSel   = `[data-ability-zone][data-ability-owner="${ownerLabel}"][data-ability-hero="${heroIdx}"][data-ability-slot="${slotIdx}"]`;
      const srcEl   = document.querySelector(deckSel);
      const tgtEl   = document.querySelector(abSel);
      if (!srcEl || !tgtEl || !count) return;

      const sr  = srcEl.getBoundingClientRect();
      const tr  = tgtEl.getBoundingClientRect();
      const srcX = sr.left + sr.width  / 2;
      const srcY = sr.top  + sr.height / 2;
      const dx  = (tr.left + tr.width  / 2) - srcX;
      const dy  = (tr.top  + tr.height / 2) - srcY;

      if (!document.getElementById('deck-to-ability-kf')) {
        const style = document.createElement('style');
        style.id = 'deck-to-ability-kf';
        style.textContent = `
          @keyframes deckToAbility {
            0%   { transform: translate(0,0) scale(1); opacity: 1; }
            20%  { transform: translate(0,-18px) scale(1.08); opacity: 1; }
            80%  { transform: translate(var(--dtaDx), calc(var(--dtaDy) - 10px)) scale(0.85); opacity: 1; }
            100% { transform: translate(var(--dtaDx), var(--dtaDy)) scale(0.7); opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      for (let i = 0; i < count; i++) {
        const card   = document.createElement('div');
        const imgUrl = window.cardImageUrl ? window.cardImageUrl(cardName) : null;
        const delay  = i * 300;
        card.style.cssText = [
          'position:fixed',
          `left:${srcX - 32}px`, `top:${srcY - 44}px`,
          'width:64px', 'height:88px', 'z-index:10200', 'pointer-events:none',
          'border-radius:4px', 'overflow:hidden',
          'box-shadow:0 0 12px rgba(255,200,50,0.8),0 0 4px rgba(200,150,0,0.6)',
          `--dtaDx:${dx}px`, `--dtaDy:${dy}px`,
          `animation:deckToAbility 600ms ease-in-out ${delay}ms forwards`,
          'opacity:0',
        ].join(';');
        if (imgUrl) {
          const img = document.createElement('img');
          img.src = imgUrl; img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          img.draggable = false; card.appendChild(img); card.style.opacity = '1';
        } else {
          card.style.background = 'linear-gradient(135deg,#3a2a0a,#2a1a00)';
          card.style.opacity = '1';
          card.innerHTML = `<div style="color:#ffa;font-size:8px;padding:4px;text-align:center;word-break:break-word;">${cardName}</div>`;
        }
        document.body.appendChild(card);
        setTimeout(() => card.remove(), delay + 700);
      }
    };
    socket.on('deck_to_ability_animation', onDeckToAbility);
    const onPunchBox = ({ targetOwner, targetHeroIdx, targetZoneSlot }) => {
      if (window.playSFX) window.playSFX('heavy_impact', { category: 'effect' });
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
    const onHandSteal = ({ fromPlayer, toPlayer, indices, cardNames, count, duration, highlightMs: hlMs }) => {
      stealInProgressRef.current = true;
      const iAmVictim = fromPlayer === myIdx;
      const fromLabel = fromPlayer === myIdx ? 'me' : 'opp';
      const toLabel = fromPlayer === myIdx ? 'opp' : 'me';
      const dur = duration || 800;
      // Highlight phase duration — short by default so the flight
      // starts almost immediately after the pick. Callers can pass a
      // longer `highlightMs` for multi-card steals where the player
      // confirmed a batch and needs a beat to register the selection.
      const highlightMs = (typeof hlMs === 'number' && hlMs >= 0) ? hlMs : 300;
      const stealIndices = indices || [];
      const names = cardNames || [];

      // Phase 1: Highlight the stolen cards
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

      // Total batch end — when the LAST clone lands. All clones are
      // removed together at this point, timed to coincide with the
      // server's state sync so the real card appears exactly when the
      // clone disappears (no stale ghost hanging around past the
      // landing).
      const batchEndMs = dur + Math.max(0, (stealIndices.length - 1) * 100) + 100;

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
          // All clones share the SAME removal time (`batchEndMs`) so
          // the batch disappears in lockstep with the server's state
          // sync. The previous per-clone 2200ms padding kept clones
          // alive long after the real cards landed, so when the
          // triggering card (Thieving Strike etc.) was discarded and
          // the real cards slid left, the stale clones lingered at
          // the old "end of hand" rects — a visible ghost duplicate.
          setTimeout(() => flyEl.remove(), batchEndMs);
        });

        // Phase 3: Clear hidden states right as the clones dissolve.
        setTimeout(() => {
          setStealHiddenMe(new Set());
          setStealHiddenOpp(new Set());
          // If I'm the stealer (toPlayer === myIdx), skip draw anims for incoming cards
          if (!iAmVictim) stealSkipDrawRef.current = stealIndices.length;
          stealInProgressRef.current = false;
        }, batchEndMs + 100);
      }, highlightMs);
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
      if (window.playSFX) window.playSFX('match_start');
      setAnnouncement({ text, color: 'var(--success)', short: true });
    };
    socket.on('hero_announcement', onHeroAnnouncement);
    // Dark Deepsea God manifest — huge DDG.png fades in, grows, and
    // fades out over ~2500ms above the battlefield (above the Castle
    // mood lighting, below hand / modals). Sized to the board container
    // so both players see the same framing regardless of viewport.
    const onDDGManifest = () => {
      if (window.playSFX) window.playSFX('ddg_manifest', { category: 'effect' });
      const container = document.querySelector('.board-center') || document.querySelector('.game-board') || document.body;
      const rect = container.getBoundingClientRect();
      const img = document.createElement('img');
      img.src = '/DDG.png';
      img.className = 'ddg-manifest';
      img.draggable = false;
      img.style.cssText = [
        'position:fixed',
        `left:${rect.left}px`,
        `top:${rect.top}px`,
        `width:${rect.width}px`,
        `height:${rect.height}px`,
        'pointer-events:none',
        'z-index:9500',
        'object-fit:contain',
        'transform-origin:center center',
        'opacity:0',
        'animation:ddgManifest 2500ms ease-in-out forwards',
        'filter:drop-shadow(0 0 40px rgba(255,40,60,0.85))',
      ].join(';');
      document.body.appendChild(img);
      setTimeout(() => img.remove(), 2700);
    };
    socket.on('dark_deepsea_god_manifest', onDDGManifest);
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
      socket.off('hand_to_board_fly', onHandToBoard);
      socket.off('reaction_chain_update', onChainUpdate); socket.off('reaction_chain_resolving_start', onChainResolvingStart);
      socket.off('reaction_chain_link_resolving', onChainLinkResolving); socket.off('reaction_chain_link_resolved', onChainLinkResolved);
      socket.off('reaction_chain_link_negated', onChainLinkNegated); socket.off('reaction_chain_done', onChainDone);
      socket.off('camera_flash', onCameraFlash); socket.off('toughness_hp_change', onToughnessHp); socket.off('creature_zone_move', onCreatureZoneMove); socket.off('fighting_atk_change', onFightingAtk);
      socket.off('summon_effect', onSummon); socket.off('burn_tick', onBurnTick);
      socket.off('play_zone_animation', onZoneAnim); socket.off('level_change', onLevelChange);
      socket.off('deepsea_spores_activated', onDeepseaSporesActivated);
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
      socket.off('red_lightning_rain', onRedLightningRain);
      socket.off('area_descend', onAreaDescend);
      socket.off('eraser_beam', onEraserBeam);
      socket.off('cooldin_terraform', onCooldinTerraform);
      socket.off('big_gwen_clock_activation', onBigGwenClockActivation);
      socket.off('boulder_fall', onBoulderFall);
      socket.off('slow_dark_magic', onSlowDarkMagic);
      socket.off('card_effect_flash', onCardEffectFlash);
      socket.off('gold_steal_burst', onGoldStealBurst);
      socket.off('jumpscare_box', onJumpscareBox);
      socket.off('anti_magic_bubble', onAntiMagicBubble);
      socket.off('fireshield_corona', onFireshieldCorona);
      socket.off('flashbang_screen', onFlashbangScreen);
      socket.off('gathering_storm_strike', onGatheringStormStrike);
      socket.off('body_swap_souls', onBodySwapSouls);
      socket.off('forbidden_zone_overlay', onForbiddenZoneOverlay);
      socket.off('tempeste_rain_start', onTempesteRainStart);
      socket.off('tempeste_rain_stop', onTempesteRainStop);
      socket.off('tempeste_redirect_strike', onTempesteRedirectStrike);
      socket.off('creature_damage_floater', onCreatureDamageFloater);
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
      socket.off('play_pile_transfer', onPileTransfer);
      socket.off('deck_to_discard_animation', onDeckToDiscard);
      socket.off('deck_to_ability_animation', onDeckToAbility);
      socket.off('punch_box_animation', onPunchBox);
      socket.off('tears_of_creation_animation', onTearsOfCreation);
      socket.off('play_hand_steal', onHandSteal);
      socket.off('blind_pick_highlight', onBlindPickHighlight);
      socket.off('play_cloak_vanish', onCloakVanish);
      socket.off('play_skull_burst', onSkullBurst);
      socket.off('play_heal_beam', onHealBeam);
      socket.off('play_guardian_angel', onGuardianAngel);
      socket.off('hero_announcement', onHeroAnnouncement);
      socket.off('dark_deepsea_god_manifest', onDDGManifest);
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
      if (window.playSFX) window.playSFX('ping');
      setPingFlash({ color });
      setTimeout(() => setPingFlash(null), 900);
    };
    const onActionLog = (entry) => {
      setActionLog(prev => [...prev, entry]);
      setTimeout(() => actionLogRef.current?.scrollTo({ top: actionLogRef.current.scrollHeight, behavior: 'smooth' }), 50);
      if (window.playSFXForLog) window.playSFXForLog(entry);
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
      // Potion animations are dispatched directly via playAnimation (below)
      // rather than play_zone_animation, so route the SFX through the zone-
      // animation dispatcher here so `acid_splash → elem_acid` etc. fires.
      if (window.playSFXForZoneAnim) window.playSFXForZoneAnim(animationType);
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
    showTextBox(null);
    if (window.stopSFX) { window.stopSFX('victory'); window.stopSFX('defeat'); }
    if (isSpectator) {
      socket.emit('leave_room', { roomId: gameState.roomId });
    } else {
      socket.emit('leave_game', { roomId: gameState.roomId });
    }
    onLeave();
  };
  const handleSurrender = () => {
    showTextBox(null);
    setShowSurrender(false);
    socket.emit('leave_game', { roomId: gameState.roomId });
    // Don't call onLeave — server will send updated game state with result
  };
  const handleRematch = () => {
    try {
      // Tripwire: if NONE of the logs fire, the click never reached this
      // function (CSS overlay stealing pointer events, disabled attribute,
      // etc.). If only the first fires but nothing after, `gameState` was
      // unexpectedly null. If "emitting" fires but no server log shows up,
      // the socket is disconnected or the handler wasn't bound.
      console.log('[handleRematch] click', {
        hasGameState: !!gameState,
        isCpuBattle: gameState?.isCpuBattle,
        roomId: gameState?.roomId,
        resultReason: gameState?.result?.reason,
        resultIsCpuBattle: gameState?.result?.isCpuBattle,
        socketConnected: socket?.connected,
        socketId: socket?.id,
      });
      if (window.stopSFX) { window.stopSFX('victory'); window.stopSFX('defeat'); }
      if (!gameState) {
        console.error('[handleRematch] aborting — gameState is null');
        return;
      }
      // Prefer top-level `isCpuBattle` (computed from room.type in
      // sendGameState), but fall back to the flag `endCpuBattle` stamps
      // on the result object. Either signal is enough — without this
      // fallback, any race where the top-level flag is missing would
      // route the click through the PvP `request_rematch` path, which
      // waits for the opponent to also click Rematch (the CPU never
      // does) and silently stalls forever.
      const isCpu = gameState.isCpuBattle || gameState.result?.isCpuBattle;
      if (isCpu) {
        // Singleplayer rematch: bypass the two-player rematch flow and ask
        // the server to spin up a fresh CPU game. Player deck comes from
        // `change_deck` (already synced via the dropdown). CPU deck is
        // omitted — the server defaults to the previous match's CPU deck,
        // so "Rematch" means "same opponent, your chosen deck".
        console.log('[handleRematch] emitting rematch_cpu_battle', { roomId: gameState.roomId });
        socket.emit('rematch_cpu_battle', { roomId: gameState.roomId });
        return;
      }
      console.log('[handleRematch] emitting request_rematch (PvP)', { roomId: gameState.roomId });
      socket.emit('request_rematch', { roomId: gameState.roomId });
    } catch (err) {
      console.error('[handleRematch] threw:', err);
    }
  };
  const handleResultLeave = useCallback(() => {
    if (resultFading) return;
    if (window.stopSFX) { window.stopSFX('victory'); window.stopSFX('defeat'); }
    setResultFading(true);
    setTimeout(() => { setResultFading(false); handleLeave(); }, 800);
  }, [resultFading, handleLeave]);

  // Keyboard shortcuts on game-over screen: Escape=Leave, Enter/Space=Rematch
  const showGameOver = result && (result.setOver || !result.format || result.format === 1 || (result.format > 1 && result.setOver));
  useEffect(() => {
    if (!showGameOver) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); result?.isPuzzle ? handleResultLeave() : handleLeave(); }
      if ((e.key === 'Enter' || e.key === ' ') && !isSpectator && !oppLeft && !oppDisconnected && !myRematchSent && !result?.isPuzzle) {
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
      if (summonOrRevealPick) { setSummonOrRevealPick(null); return; }
      if (spellHeroPick) { setSpellHeroPick(null); return; }
      if (abilityAttachPick) {
        // effectPrompt-driven picks (Alex, …) resolve the prompt via Esc;
        // hand-driven picks are purely client state and just dismiss.
        if (abilityAttachPick.source === 'effectPrompt' && abilityAttachPick.cancellable !== false) {
          socket.emit('effect_prompt_response', { roomId: gameState.roomId, response: { cancelled: true } });
        }
        setAbilityAttachPick(null);
        return;
      }
      if (pendingBouncePick) { setPendingBouncePick(null); return; }
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
      else if (showSurrender) {
        if (Date.now() - surrenderOpenedAt.current < 400) return; // Prevent accidental instant close
        setShowSurrender(false);
      }
      else if (gameState.effectPrompt && gameState.effectPrompt.ownerIdx === myIdx) return; // Non-cancellable prompt active — ignore Escape
      else if (!gameState.result && !isSpectator) { setShowSurrender(true); surrenderOpenedAt.current = Date.now(); }
      else if (gameState.result) { gameState.result.isPuzzle ? handleResultLeave() : handleLeave(); }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [showSurrender, showEndTurnConfirm, cancelEndTurn, spellHeroPick, pendingBouncePick, deckViewer, pileViewer, gameState.potionTargeting, gameState.effectPrompt, pendingAdditionalPlay, pendingAbilityActivation, gameState.mulliganPending, mulliganDecided, gameState.result, isSpectator]);

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
          const [, hiStr] = key.split('-');
          newDmgNums.push({ id: Date.now() + Math.random(), amount: dmg, ownerLabel: cur.owner, heroIdx: parseInt(hiStr) });
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

    // Build current creature-slot map — include ALL creatures on the board.
    // Tracks both the HP and the CARD NAME at each slot so the damage-number
    // pass can distinguish "same creature, lower HP" (real damage) from
    // "different creature took this slot" (replacement / bounce-place swap).
    // Without the name check, a Deepsea Primordium (1 max HP) bounce-placed
    // on top of a 50-HP creature reads as a "-49" hit even though the old
    // creature wasn't damaged at all — it was returned to hand.
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
          const maxHp = counters?.maxHp ?? counters?._cardDataOverride?.hp ?? CARDS_BY_NAME[slot[0]]?.hp;
          if (maxHp != null) {
            currentCreatureHp[cKey] = { hp: counters?.currentHp ?? maxHp, name: slot[0] };
          }
        }
      }
    }
    // Compare creature HP
    if (prevCreatureHpRef.current) {
      const newCreatureDmg = [];
      for (const [key, cur] of Object.entries(currentCreatureHp)) {
        const prev = prevCreatureHpRef.current[key];
        if (!prev) continue;
        // Creature identity changed in this slot — replacement (bounce-
        // place, swap, etc.), not damage. Skip the diff entirely.
        if (prev.name !== cur.name) continue;
        if (cur.hp < prev.hp) {
          const [ownerStr, heroIdxStr, slotStr] = key.split('-');
          const ownerIdx = parseInt(ownerStr);
          newCreatureDmg.push({
            id: Date.now() + Math.random(),
            amount: prev.hp - cur.hp,
            ownerLabel: ownerIdx === myIdx ? 'me' : 'opp',
            heroIdx: parseInt(heroIdxStr),
            zoneSlot: parseInt(slotStr),
          });
        }
      }
      // Detect lethal damage: creature existed last frame but is now gone (destroyed)
      for (const [key, prev] of Object.entries(prevCreatureHpRef.current)) {
        if (!(key in currentCreatureHp) && prev.hp > 0) {
          // Skip if creature moved zones (not destroyed)
          if (creatureMoveSuppressRef.current[key]) {
            delete creatureMoveSuppressRef.current[key];
            continue;
          }
          const [ownerStr, heroIdxStr, slotStr] = key.split('-');
          const ownerIdx = parseInt(ownerStr);
          newCreatureDmg.push({
            id: Date.now() + Math.random(),
            amount: prev.hp,
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
  // Generic lock: blocks ALL effect activations (hero effects, abilities,
  // creature effects, equip/permanent/area activations) whenever ANY
  // targeting/prompt overlay is active OR a reaction chain / spell is
  // mid-resolve. Without the chain/resolution gates, a player could click
  // a once-per-turn effect a second time during the async window between
  // "activation sent to the chain" and "HOPT counter incremented on return"
  // — the Alchemy-during-Cure-chain race.
  const isEffectLocked = !!(isTargeting || gameState.effectPrompt || gameState.surprisePending || gameState.mulliganPending || gameState.heroEffectPending || spellHeroPick || abilityAttachPick || summonOrRevealPick || pendingAdditionalPlay || pendingAbilityActivation || showSurrender || showEndTurnConfirm || reactionChain || (gameState._spellResolutionDepth || 0) > 0);
  // Valid targets can be clicked/selected; ineligible targets are only
  // shown visually (dimmed) so the player can see which board Creatures
  // WOULD qualify for the effect but don't meet its filter (e.g. Dragon
  // Pilot's ≤Lv1 requirement on the inherent path).
  const validTargetIds = isTargeting ? new Set((pt.validTargets || []).filter(t => !t.ineligible).map(t => t.id)) : new Set();
  const ineligibleTargetIds = isTargeting ? new Set((pt.validTargets || []).filter(t => t.ineligible).map(t => t.id)) : new Set();
  const selectedSet = new Set(potionSelection);

  const togglePotionTarget = (targetId) => {
    if (!isTargeting || !validTargetIds.has(targetId)) return;
    const target = pt.validTargets.find(t => t.id === targetId);
    if (!target || target.ineligible) return;
    if (window.playSFX) window.playSFX('ui_click');
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
      // Pollution-cap rule (Sun Beam & future Pollution-creating effects):
      // non-own-support selections are capped at `maxNonOwnSupport`.
      // Own-support targets (ownSupport:true) are exempt, because destroying
      // them immediately frees a slot for the Pollution Token placed in return.
      // At limit, the click is ignored — existing selections stay put.
      const maxNonOwnSupport = config.maxNonOwnSupport;
      if (maxNonOwnSupport !== undefined && !target.ownSupport) {
        const currentNonOwn = prev.filter(id => {
          const t2 = pt.validTargets.find(t => t.id === id);
          return t2 && !t2.ownSupport;
        });
        if (currentNonOwn.length >= maxNonOwnSupport) return prev;
      }
      // Check global max total. For single-target spells (maxTotal === 1),
      // preserve the click-to-swap convention — that's the familiar "change
      // my mind" UX. For multi-target selections, ignore over-limit clicks
      // so the user doesn't accidentally wipe their carefully-built picks.
      const maxTotal = config.maxTotal ?? Infinity;
      if (prev.length >= maxTotal) {
        if (maxTotal === 1) return [targetId];
        return prev;
      }
      return [...prev, targetId];
    });
  };

  const canConfirmPotion = (() => {
    if (pt?.config?.alwaysConfirmable) return true;
    if (potionSelection.length === 0) return false;
    const minReq    = pt?.config?.minRequired || 0;
    const maxTotal  = pt?.config?.maxTotal;
    const minSumHp  = pt?.config?.minSumMaxHp;
    const minSumLvl = pt?.config?.minSumLevel;
    if (potionSelection.length < minReq) return false;
    if (maxTotal != null && potionSelection.length > maxTotal) return false;
    // Sacrifice-summon rule: sum of selected targets' _meta.maxHp must
    // meet the spec's minSumMaxHp floor. Keeps Dragon Pilot's sacrifice
    // button disabled until the player has picked enough HP, instead
    // of the old behavior of letting the click go through and silently
    // re-opening the prompt on the server.
    if (minSumHp != null && minSumHp > 0) {
      const selectedTargets = (pt?.validTargets || []).filter(t => potionSelection.includes(t.id));
      const total = selectedTargets.reduce((sum, t) => sum + (t?._meta?.maxHp || 0), 0);
      if (total < minSumHp) return false;
    }
    // Parallel rule for combined original-level thresholds (Dark Deepsea
    // God's tribute: 2+ creatures with combined levels ≥ 4).
    if (minSumLvl != null && minSumLvl > 0) {
      const selectedTargets = (pt?.validTargets || []).filter(t => potionSelection.includes(t.id));
      const total = selectedTargets.reduce((sum, t) => sum + (t?._meta?.level || 0), 0);
      if (total < minSumLvl) return false;
    }
    return true;
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth <= 900);
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
      if (t === 'permanent_activated') { const p = playerByName(entry.player); return <span className="log-info">{pName(p.name, p.color)} activated {cName(entry.card)}!</span>; }
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
              if (i !== gameState.effectPrompt.heroIdx) return true;
              return !canHeroReceiveAbility(p, i, abilityDrag.cardName, { skipAbilityGiven: true });
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
          // During Coffee's heroAction prompt, canHeroPlayCard is too strict
          // (returns false for a hero who's already acted this turn); the
          // prompt's eligibleCards list + targeted heroIdx are authoritative.
          const heroActionEligibleHere = !isOpp
            && gameState.effectPrompt?.type === 'heroAction'
            && gameState.effectPrompt?.ownerIdx === myIdx
            && gameState.effectPrompt?.heroIdx === i
            && playDrag?.card
            && (gameState.effectPrompt.eligibleCards || []).includes(playDrag.card.name);
          const creatureIneligible = !isOpp && playDrag && playDrag.card?.cardType === 'Creature' && !playDrag.isEquip && (() => {
            if (heroActionEligibleHere) return findFreeSupportSlot(p, i) < 0;
            if (!canHeroPlayCard(p, i, playDrag.card)) return true;
            if (findFreeSupportSlot(p, i) < 0) return true;
            return false;
          })();
          const isCharmedByMe = isOpp && hero?.charmedBy === myIdx;
          const spellAttackIneligible = (!isOpp || isCharmedByMe) && playDrag && !playDrag.isEquip && (playDrag.card?.cardType === 'Spell' || playDrag.card?.cardType === 'Attack') && !heroActionEligibleHere && !canHeroPlayCard(p, i, playDrag.card);
          // Persistent "dragging a Surprise card" check (true throughout the
          // whole drag, not just when the cursor is currently over a Surprise
          // Zone) — so eligible zones can stay highlighted the entire time.
          const isDraggingSurpriseCard = !isOpp && playDrag
            && (playDrag.card?.subtype || '').toLowerCase() === 'surprise';
          const surpriseIneligible = isDraggingSurpriseCard && (() => {
            if (!hero || !hero.name || hero.hp <= 0) return true;
            if (((surZones[i] || []).length === 0)) return false; // Regular surprise zone free
            // Check Bakhm support zones for Creature surprises
            if (playDrag.card?.cardType === 'Creature') {
              const bEntry = (gameState.bakhmSurpriseSlots || []).find(b => b.heroIdx === i);
              if (bEntry && bEntry.freeSlots.length > 0) return false;
            }
            return true;
          })();
          const surpriseTarget = isDraggingSurpriseCard && playDrag?.isSurprise && playDrag.targetHero === i;
          const ascensionIneligible = !isOpp && playDrag?.isAscension && (() => {
            const h = heroes[i];
            return !(h?.name && h.hp > 0 && h.ascensionReady && h.ascensionTarget === playDrag.cardName);
          })();
          const ascensionTarget = !isOpp && playDrag?.isAscension && playDrag.targetHero === i;
          // During heroAction, dim all heroes except the Coffee hero
          const heroActionDimmed = !isOpp && gameState.effectPrompt?.type === 'heroAction' && gameState.effectPrompt?.ownerIdx === myIdx && gameState.effectPrompt?.heroIdx !== undefined && gameState.effectPrompt?.heroIdx !== i;
          // Dim heroes that can't use hero-restricted additional actions (e.g. Reiza's extra action)
          const additionalActionDimmed = !isOpp && !isDead && isMyTurn && currentPhase === 3 && (me.heroesActedThisTurn?.length > 0)
            && !(me.bonusActions?.remaining > 0) && (() => {
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
          // Click-to-attach an Ability: highlight all eligible heroes + dim
          // the rest. Honours both the `skipAbilityGiven` flag (server-driven
          // tutor flows bypass the per-turn gate) and the `eligibleHeroIdxs`
          // allowlist (so Alex can't attach to himself via the deck-search).
          const attachPickEligibleHero = !isOpp && abilityAttachPick && (() => {
            if (Array.isArray(abilityAttachPick.eligibleHeroIdxs)
                && !abilityAttachPick.eligibleHeroIdxs.includes(i)) return false;
            return canHeroReceiveAbility(p, i, abilityAttachPick.cardName, {
              skipAbilityGiven: !!abilityAttachPick.skipAbilityGiven,
              // Server-driven attach prompts have already vetted the
              // restrictedAttachment gate when building eligibleHeroIdxs.
              // Re-applying it client-side would reject heroes the
              // server explicitly approved (e.g. Sacrifice to Divinity
              // attaching Divinity).
              allowRestricted: abilityAttachPick.source === 'effectPrompt',
            });
          })();
          const attachPickHeroDim = !isOpp && abilityAttachPick && !attachPickEligibleHero;
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
          const isNulled = hero?.statuses?.nulled;
          const isBurned = hero?.statuses?.burned;
          const isPoisoned = hero?.statuses?.poisoned;
          const isShielded = hero?.statuses?.shielded;
          const isHealReversed = hero?.statuses?.healReversed;
          const isUntargetable = hero?.statuses?.untargetable;
          const isSirenLinked = !!hero?.statuses?.sirenLinked;
          const isBound = !!hero?.statuses?.bound;
          // Check if this hero has an active hero effect
          const heroEffectEntry = (gameState.activeHeroEffects || []).find(e => e.heroIdx === i && ((!isOpp && !e.charmedOwner) || (isOpp && e.charmedOwner === pi)));
          const isHeroEffectActive = !!heroEffectEntry;
          const isCharmed = !!hero?.statuses?.charmed;
          const isControlled = hero?.controlledBy != null && !isCharmed;
          const charmedByColor = isCharmed ? (hero.charmedBy === myIdx ? me.color : opp.color)
            : isControlled ? (hero.controlledBy === myIdx ? me.color : opp.color)
            : null;
          // Only hero-originated rams hide the hero tile during flight —
          // creature-originated rams (Haressassin etc., `srcZoneSlot >= 0`)
          // animate their own support slot and must leave the hero visible.
          const isRamming = ramAnims.some(r => r.srcOwner === pi && r.srcHeroIdx === i && (r.srcZoneSlot == null || r.srcZoneSlot < 0));
          // Chain target pick
          const isChainPickValid = chainPickValidIds.has(heroTargetId);
          const isChainPickSelected = chainPickSelectedIds.has(heroTargetId);
          const chainPickStep = chainPickSelected.findIndex(t => t.id === heroTargetId);
          const onHeroClick = attachPickEligibleHero
            ? () => {
                // Click the Hero → auto-attach to the first eligible slot.
                // Standard ability: stack onto existing copy (if any) or first empty zone.
                // Custom-placement (Performance): first occupied zone with <3 cards.
                const pick = abilityAttachPick;
                const abList = (p.abilityZones || [])[i] || [[],[],[]];
                const isCustom = (gameState.customPlacementCards || []).includes(pick.cardName);
                let targetSlot = -1;
                if (isCustom) {
                  for (let zi = 0; zi < 3; zi++) {
                    if ((abList[zi] || []).length > 0 && abList[zi].length < 3) { targetSlot = zi; break; }
                  }
                } else {
                  for (let zi = 0; zi < 3; zi++) {
                    if ((abList[zi] || []).length > 0 && abList[zi][0] === pick.cardName && abList[zi].length < 3) { targetSlot = zi; break; }
                  }
                  if (targetSlot < 0) {
                    for (let zi = 0; zi < 3; zi++) {
                      if ((abList[zi] || []).length === 0) { targetSlot = zi; break; }
                    }
                  }
                }
                if (targetSlot < 0) return;
                if (pick.source === 'effectPrompt') {
                  // Server-driven tutor (Alex, …) — resolve the pending prompt.
                  // The server owns the actual placement; we just report
                  // where the player chose to land.
                  socket.emit('effect_prompt_response', {
                    roomId: gameState.roomId,
                    response: { heroIdx: i, zoneSlot: targetSlot },
                  });
                  setAbilityAttachPick(null);
                  return;
                }
                setAbilityAttachPick(null);
                socket.emit('play_ability', {
                  roomId: gameState.roomId, cardName: pick.cardName,
                  handIndex: pick.handIndex, heroIdx: i, zoneSlot: targetSlot,
                });
              }
            : isChainPickValid
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
              <div className={'board-zone board-zone-hero' + (hero?.name ? ' zone-has-card' : '') + (isDead ? ' board-zone-dead' : '') + ((abilityIneligible || equipIneligible || creatureIneligible || spellAttackIneligible || surpriseIneligible || ascensionIneligible || heroActionDimmed || additionalActionDimmed || attachPickHeroDim) ? ' board-zone-dead' : '') + (attachPickHeroDim ? ' attach-pick-dim' : '') + ((abilityTarget || equipTarget || spellTarget || surpriseTarget || ascensionTarget || attachPickEligibleHero) ? ' board-zone-play-target' : '') + (attachPickEligibleHero ? ' attach-pick-target' : '') + (isValidHeroTarget ? ' potion-target-valid' : '') + (isSelectedHeroTarget ? ' potion-target-selected' : '') + (oppTargetHighlight.includes(heroTargetId) ? ' opp-target-highlight' : '') + (isHeroEffectActive ? ' zone-hero-effect-active' : '') + (isCharmed ? ' hero-charmed' : '') + (isControlled ? ' hero-charmed' : '') + (isChainPickValid ? ' chain-pick-valid' : '') + (isChainPickSelected ? ' chain-pick-selected' : '')}
                data-hero-zone="1" data-hero-idx={i} data-hero-owner={ownerLabel} data-hero-name={hero?.name || ''}
                onClick={onHeroClick}
                style={zsMerge('hero', { ...((isHeroEffectActive || isValidHeroTarget || isChainPickValid || attachPickEligibleHero) ? { cursor: 'pointer' } : undefined), ...((isCharmed || isControlled) ? { '--charmed-color': charmedByColor || '#ff69b4' } : undefined) })}>
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
                {hero?.name && (isFrozen || isStunned || isBurned || isPoisoned || isNegated || isNulled || isHealReversed || isUntargetable || isSirenLinked || isBound) && <StatusBadges statuses={hero.statuses} buffs={hero.buffs} isHero={true} player={p} cardName={hero.name} />}
                {hero?.name && isShielded && <ImmuneIcon heroName={hero.name} statusType="shielded" />}
                {hero?.name && isImmune && !isShielded && <ImmuneIcon heroName={hero.name} statusType="immune" />}
                {hero?.name && (p.supportZones?.[i] || []).some(slot => (slot || []).includes('Mummy Token')) && (
                  <div className="mummified-icon"
                    onMouseEnter={e => showGameTooltip(e, "This Hero's effect has been replaced by a Mummy Token's.")}
                    onMouseLeave={hideGameTooltip}
                  >🧟</div>
                )}
                {hero?.name && hero.buffs && <BuffColumn buffs={hero.buffs} cardName={hero.name} />}
                {/* ── Deepsea Counter badge (Siphem) ── */}
                {hero?.name && (hero.deepseaCounters || 0) > 0 && (
                  <div
                    className="deepsea-counter-badge"
                    style={{
                      position: 'absolute', top: '6%', right: '6%',
                      minWidth: 'calc(18px * var(--board-scale))',
                      height: 'calc(18px * var(--board-scale))',
                      padding: '0 calc(3px * var(--board-scale))',
                      borderRadius: 'calc(9px * var(--board-scale))',
                      background: 'radial-gradient(circle at 30% 30%, #7cd8ff, #0b4a8a)',
                      color: '#e8faff',
                      fontFamily: 'Pixel Intv, monospace',
                      fontSize: 'calc(9px * var(--board-scale))',
                      fontWeight: 'bold', lineHeight: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 'calc(1px * var(--board-scale))',
                      boxShadow: '0 0 calc(5px * var(--board-scale)) #38c0ff, inset 0 0 calc(2px * var(--board-scale)) #b8ecff',
                      border: 'calc(1.5px * var(--board-scale)) solid #061528',
                      zIndex: 6, pointerEvents: 'auto', cursor: 'help',
                    }}
                    onMouseEnter={e => showGameTooltip(e, `Deepsea Counters: ${hero.deepseaCounters}`)}
                    onMouseLeave={hideGameTooltip}
                  >
                    🌊{hero.deepseaCounters}
                  </div>
                )}
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
                  // Drag highlight logic — eligible zones stay highlighted
                  // for the whole duration of any Surprise-card drag, not
                  // only when the cursor is currently over one.
                  const draggingSurprise = !isOpp && playDrag
                    && (playDrag.card?.subtype || '').toLowerCase() === 'surprise';
                  if (draggingSurprise) {
                    const isEligible = zoneEmpty && heroAlive;
                    const isActive = playDrag.isSurprise && playDrag.targetHero === i;
                    // Only highlight eligible zones — leave ineligible ones
                    // in their normal state (no gray-out dimming).
                    if (isActive && isEligible) cls += ' surprise-drop-active';
                    else if (isEligible) cls += ' surprise-drop-eligible';
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
              return !canHeroReceiveAbility(p, i, abilityDrag.cardName, { skipAbilityGiven: true });
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
                // Click-to-attach an Ability: is THIS slot a valid attach target?
                // - If the hero already has the ability, only that existing stack is clickable.
                // - Otherwise, every empty slot is clickable.
                // - For custom-placement cards (e.g. Performance), only occupied zones with <3 cards.
                const attachPickZoneValid = !isOpp && abilityAttachPick && (() => {
                  const heroData = p.heroes[i];
                  if (!heroData || !heroData.name || heroData.hp <= 0) return false;
                  if (Array.isArray(abilityAttachPick.eligibleHeroIdxs)
                      && !abilityAttachPick.eligibleHeroIdxs.includes(i)) return false;
                  if (!canHeroReceiveAbility(p, i, abilityAttachPick.cardName, {
                    skipAbilityGiven: !!abilityAttachPick.skipAbilityGiven,
                    // Same server-authority bypass as the hero-pick
                    // highlight above.
                    allowRestricted: abilityAttachPick.source === 'effectPrompt',
                  })) return false;
                  const abList = (p.abilityZones || [])[i] || [[],[],[]];
                  const isCustom = (gameState.customPlacementCards || []).includes(abilityAttachPick.cardName);
                  if (isCustom) return (abList[z] || []).length > 0 && abList[z].length < 3;
                  let existingIdx = -1;
                  for (let zi = 0; zi < 3; zi++) {
                    if ((abList[zi] || []).length > 0 && abList[zi][0] === abilityAttachPick.cardName) { existingIdx = zi; break; }
                  }
                  if (existingIdx >= 0) return z === existingIdx && abList[existingIdx].length < 3;
                  return (abList[z] || []).length === 0;
                })();
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
                const onAbilityClick = attachPickZoneValid
                  ? () => {
                      const pick = abilityAttachPick;
                      if (pick.source === 'effectPrompt') {
                        socket.emit('effect_prompt_response', {
                          roomId: gameState.roomId,
                          response: { heroIdx: i, zoneSlot: z },
                        });
                        setAbilityAttachPick(null);
                        return;
                      }
                      setAbilityAttachPick(null);
                      socket.emit('play_ability', {
                        roomId: gameState.roomId, cardName: pick.cardName,
                        handIndex: pick.handIndex, heroIdx: i, zoneSlot: z,
                      });
                    }
                  : (canActivate && !isEffectLocked) ? () => {
                      if (isFreeActivatable) {
                        // Free activation — no confirmation needed, activate directly
                        socket.emit('activate_free_ability', { roomId: gameState.roomId, heroIdx: i, zoneIdx: z, charmedOwner: freeAbilityEntry?.charmedOwner });
                      } else {
                        setPendingAbilityActivation({ heroIdx: i, zoneIdx: z, abilityName: cards[0], level: cards.length, isHeroAction: isHeroActionActivatable, charmedOwner: activatableEntry?.charmedOwner });
                      }
                    } : (isValidPotionTarget ? () => togglePotionTarget(abTargetId) : undefined);
                return (
                  <div key={z}
                    className={'board-zone board-zone-ability' + (cards.length > 0 ? ' zone-has-card' : '') + (heroIneligible || isDead || isFrozenOrStunned ? ' board-zone-dead' : '') + (isAbTarget || attachPickZoneValid ? ' board-zone-play-target' : '') + (attachPickZoneValid ? ' attach-pick-target' : '') + (isValidPotionTarget ? ' potion-target-valid' : '') + (isSelectedPotionTarget ? ' potion-target-selected' : '') + (isExploding ? ' zone-exploding' : '') + (oppTargetHighlight.includes(abTargetId) ? ' opp-target-highlight' : '') + (canActivate && !isFreeActivatable ? ' zone-ability-activatable' : '') + (isFreeActivatable ? ' zone-ability-free-activatable' : '') + (isFriendshipActive ? ' zone-friendship-active' : '') + (isFlashing ? ' zone-ability-activated' : '')}
                    data-ability-zone="1" data-ability-hero={i} data-ability-slot={z} data-ability-owner={ownerLabel} data-card-name={cards[0] || ''}
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
                    style={zsMerge('ability', (canActivate || attachPickZoneValid || isValidPotionTarget) ? { cursor: 'pointer' } : undefined)}>
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
              const isIneligibleEquipTarget = isTargeting && !isValidEquipTarget && equipTargetIds.some(id => ineligibleTargetIds.has(id));
              const isSelectedEquipTarget = equipTargetIds.some(id => selectedSet.has(id));
              const isEquipExploding = equipTargetIds.some(id => explosions.includes(id));
              const isSummonGlow = summonGlow && summonGlow.owner === pi && summonGlow.heroIdx === i && summonGlow.zoneSlot === z;
              const isZonePickTarget = !isOpp && zonePickSet.has(`${pi}-${i}-${z}`);
              // During creature drag: highlight valid zones, dim invalid ones.
              // Surprise-subtype creatures skip the invalid-zone dimming
              // entirely (we only want the orange surprise highlight on
              // eligible zones — the other zones should stay neutral, not
              // grayed out) and likewise skip the valid-zone highlight.
              const _isSurpriseCardDrag = !isOpp && playDrag
                && (playDrag.card?.subtype || '').toLowerCase() === 'surprise';
              const isDraggingCreature = !isOpp && playDrag && playDrag.card?.cardType === 'Creature' && !playDrag.isEquip && !playDrag.isSurprise && !_isSurpriseCardDrag;
              const isDraggingAttachment = !isOpp && playDrag && playDrag.isSpell && (playDrag.card?.subtype || '').toLowerCase() === 'attachment';
              const heroActionActive = !isOpp && gameState.effectPrompt?.type === 'heroAction' && gameState.effectPrompt?.ownerIdx === myIdx;
              const heroActionHeroIdx = heroActionActive ? gameState.effectPrompt.heroIdx : undefined;
              // During a heroAction prompt (Coffee), eligibility is dictated
              // by the prompt's eligibleCards — not by the normal action-
              // economy gate which would reject a hero who already acted.
              // Both sides of the OR must short-circuit cleanly when
              // `playDrag` is null (idle state with no drag in progress).
              const heroActionCoversCard = !!(heroActionActive && heroActionHeroIdx === i && playDrag?.card
                && (gameState.effectPrompt.eligibleCards || []).includes(playDrag.card.name));
              const canPlayHere = heroActionCoversCard || (!!playDrag?.card && canHeroPlayCard(me, i, playDrag.card));
              // Bounce-place target: OCCUPIED slot listed server-side as
              // a valid swap destination for the card being dragged. Used
              // by the Deepsea archetype (drop on an existing bounceable
              // Creature to swap it back to hand and place the new one in
              // its slot). Computed once per zone per frame.
              const _bpTargetsForDrag = (!isOpp && playDrag?.card?.cardType === 'Creature')
                ? ((gameState.bouncePlacementTargets || {})[playDrag.card.name] || [])
                : [];
              const isBouncePlaceTarget = _bpTargetsForDrag.some(t => t.heroIdx === i && t.slotIdx === z);
              // Click-to-swap highlight: same visual as drag-bounce-place
              // but triggered by pendingBouncePick (clicking a Deepsea
              // card in hand). Covers BOTH bounce-candidate slots
              // (occupied) and free-slot targets.
              const _bpPickOwn = !isOpp && pendingBouncePick;
              const isPendingBounceTarget = _bpPickOwn && (pendingBouncePick.bounceTargets || []).some(t => t.heroIdx === i && t.slotIdx === z);
              // Valid drop zones come in two flavors that now coexist:
              //  • Bounce target — occupied slots listed in
              //    bouncePlacementTargets. Painted via the separate
              //    `isBouncePlaceTarget` class.
              //  • Normal summon — empty slots on heroes that can cast
              //    the card. Painted via `zone-drag-valid`.
              // When a Deepsea Creature is being dragged, BOTH modes are
              // legal simultaneously: the player may either swap an
              // existing bounceable Deepsea OR spend their Action to
              // summon into a free slot of an eligible Hero. The server
              // routes to the right path based on whether the dropped
              // slot is occupied.
              // For Creature drags on empty slots, require STRICT summon
              // eligibility: heroPlayableCards includes heroes that can
              // only host via bounce-place bypass, but only heroes who
              // can *normally* summon this card should light up an empty
              // slot. Attachment Spells and other non-Creature drags keep
              // using the broad canHeroPlayCard check.
              const emptyCanPlayHere = isDraggingCreature && playDrag?.card
                ? canHeroNormalSummon(me, i, playDrag.card)
                : canPlayHere;
              const isDragValidZone = (isDraggingCreature || isDraggingAttachment)
                && cards.length === 0 && emptyCanPlayHere
                && z < ((me.supportZones[i] || []).length || 3)
                && (heroActionHeroIdx === undefined || heroActionHeroIdx === i);
              const isDragInvalidZone = (isDraggingCreature || isDraggingAttachment) && !isDragValidZone && !isBouncePlaceTarget;
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
              // Bakhm surprise drag highlight — highlighted while ANY
              // Surprise Creature is being dragged, regardless of cursor
              // position, so the eligible slots stay visible.
              const isDraggingSurpriseCreatureHere = !isOpp && playDrag
                && (playDrag.card?.subtype || '').toLowerCase() === 'surprise'
                && playDrag.card?.cardType === 'Creature';
              const isBakhmSurpriseTarget = isDraggingSurpriseCreatureHere && cards.length === 0
                && (gameState.bakhmSurpriseSlots || []).some(b => b.heroIdx === i && b.freeSlots.includes(z));
              const isBakhmSurpriseActive = isBakhmSurpriseTarget && playDrag.isSurprise && playDrag.targetHero === i && playDrag.targetBakhmSlot === z;
              // Slippery Skates move
              const isSkatesCreature = skatesCreatureSet.has(`${pi}-${i}-${z}`);
              const isSkatesCreatureSelected = isSkatesCreature && skatesSelected === z;
              const isSkatesDest = skatesDestSet.has(`${pi}-${i}-${z}`);
              // Chain target pick for creatures
              const creatureChainId = `equip-${pi}-${i}-${z}`;
              const isChainPickCreatureValid = chainPickValidIds.has(creatureChainId);
              const isChainPickCreatureSelected = chainPickSelectedIds.has(creatureChainId);
              const chainPickCreatureStep = chainPickSelected.findIndex(t => t.id === creatureChainId);
              // Stolen creature highlight (Deepsea Succubus) — paints the
              // controller's player color around the slot, mirroring the
              // charmed-hero treatment so cross-side control is visually
              // distinct.
              const stolenBy = (gameState.creatureCounters || {})[`${pi}-${i}-${z}`]?._stolenBy;
              const isStolen = stolenBy != null;
              const stolenColor = isStolen ? (stolenBy === myIdx ? me.color : opp.color) : null;
              return (
                <div key={z} className={'board-zone board-zone-support' + (cards.length > 0 ? ' zone-has-card' : '') + (isIsland ? ' board-zone-island' : '') + ((isPlayTarget || isAutoTarget) ? ' board-zone-play-target' : '') + (isValidEquipTarget ? ' potion-target-valid' : '') + (isIneligibleEquipTarget ? ' potion-target-ineligible' : '') + (isSelectedEquipTarget ? ' potion-target-selected' : '') + (isEquipExploding ? ' zone-exploding' : '') + (isSummonGlow ? ' zone-summon-glow' : '') + (equipTargetIds.some(id => oppTargetHighlight.includes(id)) ? ' opp-target-highlight' : '') + (isZonePickTarget ? ' zone-pick-target' : '') + (isDragValidZone ? ' zone-drag-valid' : '') + (isDragInvalidZone ? ' zone-drag-invalid' : '') + ((isBouncePlaceTarget || isPendingBounceTarget) ? ' zone-bounce-place-target' : '') + (isProviderZone ? ' zone-provider-highlight' : '') + (isProviderSelectionActive && !isProviderZone ? ' zone-provider-dimmed' : '') + (isHeroActionZoneDimmed ? ' zone-drag-invalid' : '') + (isCreatureActivatable ? ' zone-creature-activatable' : '') + (isEquipActivatable ? ' zone-equip-activatable' : '') + (isBakhmSurpriseActive ? ' surprise-drop-active' : isBakhmSurpriseTarget ? ' surprise-drop-eligible' : '') + (isSkatesCreature ? ' zone-skates-creature' : '') + (isSkatesCreatureSelected ? ' zone-skates-selected' : '') + (isSkatesDest ? ' zone-skates-dest' : '') + (isChainPickCreatureValid ? ' chain-pick-valid' : '') + (isChainPickCreatureSelected ? ' chain-pick-selected' : '') + (isStolen ? ' hero-charmed' : '')}
                  data-support-zone="1" data-support-hero={i} data-support-slot={z} data-support-owner={ownerLabel} data-support-island={isIsland ? 'true' : 'false'} data-card-name={cards[0] || ''}
                  onClick={isPendingBounceTarget ? () => {
                    // Click-to-swap: dispatches play_creature as if the
                    // card had been dragged here. Server treats the
                    // rest identically — occupied slot routes through
                    // canPlaceOnOccupiedSlot, free slot through normal
                    // placement. Clear the pick state so the highlights
                    // disappear. handIndex is stale after hand shifts
                    // (draws / returns) — resolve by name so the right
                    // copy plays.
                    const ps = pendingBouncePick;
                    setPendingBouncePick(null);
                    const currentIdx = hand.findIndex(c => c === ps.cardName);
                    if (currentIdx < 0) return;
                    socket.emit('play_creature', {
                      roomId: gameState.roomId, cardName: ps.cardName,
                      handIndex: currentIdx, heroIdx: i, zoneSlot: z,
                    });
                  } : isChainPickCreatureValid ? () => {
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
                  style={zsMerge('support', {
                    ...((isValidEquipTarget || isZonePickTarget || isProviderZone || isCreatureActivatable || isEquipActivatable || isSkatesCreature || isSkatesDest || isChainPickCreatureValid) ? { cursor: 'pointer' } : undefined),
                    ...(isStolen && stolenColor ? { '--charmed-color': stolenColor } : undefined),
                  })}
                  data-bounce-hiding={bounceOutgoingHidden.has(`${pi}-${i}-${z}`) ? 'true' : undefined}>
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
                    const _ccType = cc?._cardDataOverride?.cardType || CARDS_BY_NAME[cards[cards.length-1]]?.cardType || '';
                    const _ccSubtype = cc?._cardDataOverride?.subtype || CARDS_BY_NAME[cards[cards.length-1]]?.subtype || '';
                    // Check cardType AND subtype — Artifact-Creature hybrids
                    // (Pollution Spewer) are Creatures by subtype even though
                    // their cardType is Artifact, and must render with the
                    // Creature HP bar / damage display.
                    const isCreature = _ccType.split('/').some(t => t.trim() === 'Creature')
                      || _ccSubtype.split('/').some(t => t.trim() === 'Creature');
                    // Deepsea Spores tint: when the per-turn override is
                    // active, every board Creature that is NOT already a
                    // Deepsea archetype card is rendered dark-red and its
                    // tooltip is prefixed with "Deepsea " to surface the
                    // archetype shift. Already-Deepsea cards stay as-is.
                    const _ccCardDataForSpores = CARDS_BY_NAME[cards[cards.length-1]];
                    const _ccIsAlreadyDeepsea = (_ccCardDataForSpores?.archetype === 'Deepsea')
                      || cards[cards.length-1] === 'Infected Squirrel';
                    const _ccSporified = isCreature && gameState.deepseaSporesActive && !_ccIsAlreadyDeepsea;
                    const creatureStyle = cc?._baihuPetrify ? { filter: 'saturate(0) brightness(0.7) contrast(1.1)', transition: 'filter 0.5s' }
                      : (cc?._xuanwuRevived || cc?._illusionSummon) ? { filter: 'sepia(0.2) hue-rotate(180deg) brightness(1.1)', opacity: 0.75 }
                      : _ccSporified ? { filter: 'brightness(0.78) sepia(0.6) hue-rotate(-50deg) saturate(1.7) contrast(1.05)', transition: 'filter 0.5s' }
                      : undefined; return !isCreature ? (
                      <>
                        <BoardCard cardName={cards[cards.length-1]} skins={gameSkins} />
                        {cc?.buffs ? <BuffColumn buffs={cc.buffs} cardName={cards[cards.length-1]} /> : null}
                      </>
                    ) : (
                    <>
                    {cards.length === 1 ? (
                      (() => {
                        const curHp = cc?.currentHp ?? cc?._cardDataOverride?.hp ?? CARDS_BY_NAME[cards[0]]?.hp;
                        const mHp = cc?.maxHp ?? cc?._cardDataOverride?.hp ?? CARDS_BY_NAME[cards[0]]?.hp;
                        // Biomancy Token: customize the hover tooltip with
                        // the level-scaled effect text. Any creature with
                        // `_cardDataOverride` falls through to a tooltip
                        // built from that override so the rules-text always
                        // reflects what the token actually does.
                        const over = cc?._cardDataOverride;
                        const baseCard = CARDS_BY_NAME[cards[0]];
                        let tooltipOverride;
                        if (cc?.biomancyLevel && cc?.biomancyDamage) {
                          tooltipOverride = {
                            ...(baseCard || {}),
                            ...(over || {}),
                            name: 'Biomancy Token',
                            cardType: 'Creature/Token',
                            hp: mHp,
                            effect: `You may once per turn deal ${cc.biomancyDamage} damage to any target on the board.`,
                          };
                        } else if (over) {
                          tooltipOverride = { ...(baseCard || {}), ...over };
                        }
                        // Deepsea Spores tooltip prefix — "Haressassin"
                        // reads as "Deepsea Haressassin" while the
                        // override is active. Already-Deepsea creatures
                        // skip this so they don't become e.g. "Deepsea
                        // Deepsea Reaper". We set `displayName` (not
                        // `name`) so the image lookup still uses the
                        // canonical `Haressassin.png` — otherwise the
                        // tooltip tries `Deepsea Haressassin.png`,
                        // which doesn't exist.
                        if (_ccSporified) {
                          const src = tooltipOverride || baseCard || {};
                          const existingDisplay = src.displayName || src.name || cards[0];
                          if (!/^Deepsea\s/i.test(existingDisplay)) {
                            tooltipOverride = {
                              ...src,
                              displayName: `Deepsea ${existingDisplay}`,
                              archetype: 'Deepsea',
                            };
                          }
                        }
                        return <BoardCard cardName={cards[0]} hp={curHp} maxHp={mHp} hpPosition="creature" skins={gameSkins} style={creatureStyle} tooltipCardOverride={tooltipOverride} />;
                      })()
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
                    {(cc?.negated || cc?.nulled) ? <NegatedOverlay /> : null}
                    {cc?.poisoned ? <PoisonedOverlay stacks={cc.poisonStacks || 1} /> : null}
                    {(cc?.frozen || cc?.stunned || cc?.burned || cc?.poisoned || cc?.negated || cc?.nulled || cc?._baihuStunned || cc?.sirenLinked) ? <StatusBadges counters={cc} isHero={false} player={p} cardName={cards[cards.length-1]} /> : null}
                    {cc?.buffs ? <BuffColumn buffs={cc.buffs} cardName={cards[cards.length-1]} /> : null}
                    {cc?._guardianImmune ? <div className="board-card-guardian-shield" /> : null}
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
            {result ? '✕ LEAVE' : gameState.isPuzzle ? '✕ EXIT' : '⚑ SURRENDER'}
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
            {opp.avatar
              ? <img src={opp.avatar} className={'game-hand-avatar game-hand-avatar-big' + (!result && (isMyTurn ? ' avatar-inactive' : ' avatar-active'))} />
              : opp.heroes?.[1]?.name && HeroArtCrop
                ? (
                  <div className={'game-hand-avatar-crop' + (!result && (isMyTurn ? ' avatar-inactive' : ' avatar-active'))}>
                    <HeroArtCrop heroName={opp.heroes[1].name} width={72} />
                  </div>
                )
                : null}
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
                  data-hand-idx={i} style={(oppDrawHidden.has(i) || (stealHiddenOpp.has(i) && (opp.handCount || 0) === stealExpectedOppCountRef.current) || bounceReturnHidden.has(`${oppIdx}-${i}`)) ? { visibility: 'hidden' } : (isBlindPick ? { cursor: 'pointer' } : undefined)}
                  onClick={isBlindPick ? () => {
                    // Compute the NEXT selection set outside the
                    // setState updater. React may double-invoke state
                    // updaters (StrictMode dev, batching), so the
                    // auto-confirm respondToPrompt MUST live outside
                    // the updater — otherwise it fires twice and the
                    // server processes the steal twice (victim loses
                    // one card, thief gains two copies).
                    const prev = blindPickSelected;
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else if (next.size < maxSelect) next.add(i);
                    setBlindPickSelected(next);
                    if (gameState.effectPrompt?.autoConfirm && next.size === maxSelect) {
                      respondToPrompt({ selectedIndices: [...next] });
                    }
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
            if (me.oppHandLocked) debuffs.push({ key: 'opphand-me', icon: '🫲', text: 'You cannot interact with your opponent\'s hand for the rest of this turn!', color: '#aa44ff' });
            if (opp.oppHandLocked) debuffs.push({ key: 'opphand-opp', icon: '🫲', text: `${opp.username} cannot interact with your hand for the rest of this turn!`, color: '#8833cc' });
            if (me.potionLocked) debuffs.push({ key: 'potion-me', icon: '🧪', text: 'You cannot play any more Potions this turn!', color: '#aa44ff' });
            if (opp.potionLocked) debuffs.push({ key: 'potion-opp', icon: '🧪', text: `${opp.username} cannot play any more Potions this turn!`, color: '#8844cc' });
            if (me.supportSpellLocked) debuffs.push({ key: 'support-me', icon: '💚', text: 'You cannot use another Support Spell this turn.', color: '#ff4444' });
            if (opp.supportSpellLocked) debuffs.push({ key: 'support-opp', icon: '💚', text: `Your opponent cannot use another Support Spell this turn.`, color: '#ff8844' });
            if (me.itemLocked) debuffs.push({ key: 'item-me', icon: '🔨', text: 'You must delete 1 card from your hand to use an Artifact!', color: '#ff6633' });
            if (opp.itemLocked) debuffs.push({ key: 'item-opp', icon: '🔨', text: `${opp.username} must delete 1 card from their hand to use an Artifact!`, color: '#cc5522' });
            // Boomerang's "no Artifacts for the rest of this turn"
            // lockout. Distinct icon (🪃) from the 🔨 itemLocked
            // badge — different mechanic, different message.
            if (me.artifactLocked) debuffs.push({ key: 'artifact-me', icon: '🪃', text: 'You cannot use any more Artifacts this turn!', color: '#ff8855' });
            if (opp.artifactLocked) debuffs.push({ key: 'artifact-opp', icon: '🪃', text: `${opp.username} cannot use any more Artifacts this turn!`, color: '#cc6644' });
            if (me.forsaken) debuffs.push({ key: 'forsaken-me', icon: '🏴‍☠️', text: 'All cards that would go to your discard pile are deleted for the rest of the turn.', color: '#8888aa' });
            if (opp.forsaken) debuffs.push({ key: 'forsaken-opp', icon: '🏴‍☠️', text: `All cards that would go to ${opp.username}'s discard pile are deleted for the rest of the turn.`, color: '#6666aa' });
            if (me.handLocked) debuffs.push({ key: 'hand-me', icon: '🔒', text: 'You cannot draw or search any more cards this turn!', color: '#ff6644' });
            if (opp.handLocked) debuffs.push({ key: 'hand-opp', icon: '🔒', text: `${opp.username} cannot draw or search any more cards this turn!`, color: '#cc8800' });
            if (me.flashbanged) debuffs.push({ key: 'flashbanged-me', icon: '⚪', text: 'Flashbanged — your turn will end after your first Action!', color: '#ffffff' });
            if (opp.flashbanged) debuffs.push({ key: 'flashbanged-opp', icon: '⚪', text: `Flashbanged — ${opp.username}'s turn will end after their first Action!`, color: '#dddddd' });
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
          {/* Tutorial phase lock: block advancement until conditions met */}
          {(() => {
            let tutorialPhaseLocked = false;
            if (gameState.isTutorial && window._currentTutorialNum === 1) {
              // Lock until Ida has Destruction Magic at level 3
              const idaIdx = me.heroes.findIndex(h => h?.name && h.name.startsWith('Ida'));
              if (idaIdx >= 0) {
                const abSlots = me.abilityZones[idaIdx] || [];
                const dmCount = abSlots.flat().filter(n => n === 'Destruction Magic').length;
                if (dmCount < 3) tutorialPhaseLocked = true;
              } else { tutorialPhaseLocked = true; }
            }
            return (
          <div className="phase-column">
            <div className="board-phase-tracker">
              {['Start Phase', 'Resource Phase', 'Main Phase 1', 'Action Phase', 'Main Phase 2', 'End Phase'].map((phase, i) => {
                const isActive = currentPhase === i;
                const spellResolving = (gameState._spellResolutionDepth || 0) > 0;
                const canClick = !tutorialPhaseLocked && isMyTurn && !result && !gameState.effectPrompt && !gameState.potionTargeting && !gameState.mulliganPending && !gameState.heroEffectPending && !spellHeroPick && !pendingAdditionalPlay && !pendingAbilityActivation && !showSurrender && !showEndTurnConfirm && !spellResolving && (
                  (currentPhase === 2 && (i === 3 || i === 5)) ||
                  (currentPhase === 3 && (i === 4 || i === 5)) ||
                  (currentPhase === 4 && i === 5)
                );
                return (
                  <div key={i}
                    className={'board-phase-item' + (isActive ? ' active' : '') + (canClick ? ' clickable' : '')}
                    data-phase-name={phase}
                    style={isActive ? { borderColor: phaseColor, boxShadow: `0 0 10px ${phaseColor}44` } : undefined}
                    onClick={() => { if (canClick) tryAdvancePhase(i); }}>
                    {phase}
                  </div>
                );
              })}
            </div>
            {!isSpectator && (() => {
              // Mirror the server-side guard in advancePhase/advanceToPhase:
              // while a Spell is mid-resolve (e.g. Rain of Arrows waiting on
              // Ida's target prompt), phase advance is refused. Greying out
              // the buttons here avoids the confusing silent reject.
              const spellResolving = (gameState._spellResolutionDepth || 0) > 0;
              const canAdvance = !tutorialPhaseLocked && isMyTurn && !result && !gameState.effectPrompt && !gameState.potionTargeting && !gameState.mulliganPending && !gameState.heroEffectPending && !spellHeroPick && !pendingAdditionalPlay && !pendingAbilityActivation && !showSurrender && !showEndTurnConfirm && !spellResolving && currentPhase >= 2 && currentPhase <= 4;
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
            );
          })()}

          <div className="board-center-spacer" />
          <div className="board-center" ref={boardCenterRef} style={{ position: 'relative' }}>
            {(((gameState.areaZones?.[0] || []).includes('Acid Rain')) || ((gameState.areaZones?.[1] || []).includes('Acid Rain'))) && <AcidRainOverlay />}
            {(((gameState.areaZones?.[0] || []).includes('Deepsea Castle')) || ((gameState.areaZones?.[1] || []).includes('Deepsea Castle'))) && <DeepseaCastleOverlay />}
            {(((gameState.areaZones?.[0] || []).includes('Slippery Ice')) || ((gameState.areaZones?.[1] || []).includes('Slippery Ice'))) && <SlipperyIceOverlay />}
            {(((gameState.areaZones?.[0] || []).includes('The Cosmic Depths')) || ((gameState.areaZones?.[1] || []).includes('The Cosmic Depths'))) && <CosmicDepthsOverlay />}
            {(((gameState.areaZones?.[0] || []).includes("Tarleinn's Floating Island")) || ((gameState.areaZones?.[1] || []).includes("Tarleinn's Floating Island"))) && <FloatingIslandOverlay />}
            {(() => {
              // Gathering Storm is an Attachment Spell — it lives in a
              // hero's Support Zone rather than an Area Zone, so walk
              // every support slot across both players to find any copy.
              const hasGatheringStorm = [0, 1].some(pi => {
                const sz = gameState.players?.[pi]?.supportZones || [];
                for (const heroZone of sz) {
                  for (const slot of (heroZone || [])) {
                    if ((slot || []).includes('Gathering Storm')) return true;
                  }
                }
                return false;
              });
              return hasGatheringStorm ? <GatheringStormOverlay /> : null;
            })()}
            {(() => {
              // Prophecy of Tempeste — same shape as Gathering Storm.
              // The actual rain overlay's lifetime is gated on the spell's
              // physical presence in a support zone (so it survives
              // reconnects + works for spectators), not just the
              // tempesteRainInsts socket flag. The flag is an additional
              // safety hook for the start/stop events in case there's a
              // brief race during the attach animation.
              const hasTempeste = (tempesteRainInsts.length > 0) || [0, 1].some(pi => {
                const sz = gameState.players?.[pi]?.supportZones || [];
                for (const heroZone of sz) {
                  for (const slot of (heroZone || [])) {
                    if ((slot || []).includes('Prophecy of Tempeste')) return true;
                  }
                }
                return false;
              });
              return hasTempeste ? <TempesteRainOverlay /> : null;
            })()}
            {(((gameState.areaZones?.[0] || []).includes('Stinky Stables')) || ((gameState.areaZones?.[1] || []).includes('Stinky Stables'))) && <StinkyStablesOverlay />}
            {pendingAdditionalPlay && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 200, fontSize: 13, fontWeight: 700, color: '#ffcc00', textShadow: '0 0 10px rgba(255,200,0,.5), 2px 2px 0 #000', textAlign: 'center', pointerEvents: 'none', animation: 'summonLockPulse 1.5s ease-in-out infinite', whiteSpace: 'nowrap' }}>Choose which additional Action to use!</div>}
            <div className="board-player-side board-side-opp">{renderPlayerSide(opp, true)}</div>
            <div className="board-area-zones-center">
              {(() => {
                const myAreaId = `area-${myIdx}`;
                const oppAreaId = `area-${oppIdx}`;
                const isMyAreaValid = isTargeting && validTargetIds.has(myAreaId);
                const isOppAreaValid = isTargeting && validTargetIds.has(oppAreaId);
                // Area drag highlight: light up the player's own empty Area
                // Zone whenever they're dragging an Area-subtype card they
                // have at least one hero capable of casting.
                const draggingArea = !!(playDrag?.card && (playDrag.card.subtype || '').toLowerCase() === 'area');
                const anyCasterForArea = draggingArea && (me.heroes || []).some((h, hi) => canHeroPlayCard(me, hi, playDrag.card));
                const myAreaEmpty = (gameState.areaZones?.[myIdx] || []).length === 0;
                const myAreaDropEligible = draggingArea && anyCasterForArea && myAreaEmpty;
                // Area-effect activation — card exports `areaEffect: true`
                // + `onAreaEffect(ctx)`. The engine publishes an entry per
                // activatable area per player; we look up each side and
                // mark the zone clickable when the player can fire the
                // effect (Main Phase, HOPT fresh, per-card gate passes).
                const activatableAreas = gameState.activatableAreas || [];
                const myAreaEntry = activatableAreas.find(a => a.areaOwner === myIdx);
                const oppAreaEntry = activatableAreas.find(a => a.areaOwner === oppIdx);
                const myAreaActivatable = !isEffectLocked && !!myAreaEntry?.canActivate;
                const oppAreaActivatable = !isEffectLocked && !!oppAreaEntry?.canActivate;
                const myAreaCls = (isMyAreaValid ? 'potion-target-valid' : '') + (selectedSet.has(myAreaId) ? ' potion-target-selected' : '') + (myAreaDropEligible ? ' area-drop-eligible' : '') + (myAreaActivatable ? ' zone-ability-activatable' : '');
                const oppAreaCls = (isOppAreaValid ? 'potion-target-valid' : '') + (selectedSet.has(oppAreaId) ? ' potion-target-selected' : '') + (oppAreaActivatable ? ' zone-ability-activatable' : '');
                const onMyAreaClick = isMyAreaValid
                  ? () => togglePotionTarget(myAreaId)
                  : (myAreaActivatable ? () => socket.emit('activate_area_effect', {
                      roomId: gameState.roomId, areaOwner: myIdx, areaName: myAreaEntry.areaName,
                    }) : undefined);
                const onOppAreaClick = isOppAreaValid
                  ? () => togglePotionTarget(oppAreaId)
                  : (oppAreaActivatable ? () => socket.emit('activate_area_effect', {
                      roomId: gameState.roomId, areaOwner: oppIdx, areaName: oppAreaEntry.areaName,
                    }) : undefined);
                // Hide until measured so the zones don't flash at left:auto and
                // then "move" into place when the measurement resolves.
                const measured = areaPositions[0] != null && areaPositions[1] != null;
                const hiddenStyle = measured ? null : { visibility: 'hidden' };
                return (<>
                  <BoardZone type="area" cards={gameState.areaZones?.[myIdx] || []} label="Area"
                    style={{...myBoardZone('area'), left: areaPositions[0], cursor: (isMyAreaValid || myAreaActivatable) ? 'pointer' : undefined, ...hiddenStyle}}
                    className={(myAreaCls + ' area-zone-me').trim()}
                    dataAttrs={{ 'data-area-zone': '1', 'data-area-owner': 'me' }}
                    onClick={onMyAreaClick} />
                  <BoardZone type="area" cards={gameState.areaZones?.[oppIdx] || []} label="Area"
                    style={{...oppBoardZone('area'), left: areaPositions[1], cursor: (isOppAreaValid || oppAreaActivatable) ? 'pointer' : undefined, ...hiddenStyle}}
                    className={(oppAreaCls + ' area-zone-opp').trim()}
                    dataAttrs={{ 'data-area-zone': '1', 'data-area-owner': 'opp' }}
                    onClick={onOppAreaClick} />
                </>);
              })()}
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
                  const isActivatable = !isSpectator && !isEffectLocked && (gameState.activatablePermanents || []).some(a => a.permId === perm.id && a.ownerIdx === oppIdx);
                  const handlePermClick = isValidPermTarget ? () => togglePotionTarget(permTargetId)
                    : isActivatable ? () => socket.emit('activate_permanent', { roomId: gameState.roomId, permId: perm.id, ownerIdx: oppIdx })
                    : undefined;
                  return (
                    <div key={perm.id}
                      className={'board-permanent-slot' + (isValidPermTarget ? ' potion-target-valid' : '') + (isSelectedPermTarget ? ' potion-target-selected' : '') + (isActivatable ? ' zone-permanent-activatable' : '')}
                      data-perm-id={perm.id} data-perm-owner="opp"
                      onClick={handlePermClick}
                      style={(isValidPermTarget || isActivatable) ? { cursor: 'pointer' } : undefined}>
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
                  const isActivatable = !isSpectator && !isEffectLocked && (gameState.activatablePermanents || []).some(a => a.permId === perm.id && a.ownerIdx === myIdx);
                  const handlePermClick = isValidPermTarget ? () => togglePotionTarget(permTargetId)
                    : isActivatable ? () => socket.emit('activate_permanent', { roomId: gameState.roomId, permId: perm.id, ownerIdx: myIdx })
                    : undefined;
                  return (
                    <div key={perm.id}
                      className={'board-permanent-slot' + (isValidPermTarget ? ' potion-target-valid' : '') + (isSelectedPermTarget ? ' potion-target-selected' : '') + (isActivatable ? ' zone-permanent-activatable' : '')}
                      data-perm-id={perm.id} data-perm-owner="me"
                      onClick={handlePermClick}
                      style={(isValidPermTarget || isActivatable) ? { cursor: 'pointer' } : undefined}>
                      <BoardCard cardName={perm.name} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={'chat-log-column' + (sidebarCollapsed ? ' chat-log-collapsed' : '')}>
            {sidebarCollapsed ? (
              <button className="sidebar-toggle-btn" onClick={() => setSidebarCollapsed(false)} title="Show Log & Chat">
                <span style={{ writingMode: 'vertical-rl', fontSize: 9, letterSpacing: 2 }}>LOG ● CHAT</span>
                <span style={{ fontSize: 12 }}>◂</span>
              </button>
            ) : (
              <>
                <button className="sidebar-toggle-btn sidebar-toggle-close" onClick={() => setSidebarCollapsed(true)} title="Hide Log & Chat">▸</button>
                {renderActionLog()}
                {renderChatPanel()}
              </>
            )}
          </div>

          <div className="board-util board-util-right">
            <div className="board-util-side">
              <BoardZone type="deck" label="Deck" faceDown style={oppBoardZone('deck')}>
                {opp.deckCount > 0 ? <div className="board-card face-down" data-opp-deck="1"><img src={opp.cardback || "/cardback.png"} style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false} /><div className="board-card-label">{opp.deckCount}</div></div>
                : <div className="board-card" data-opp-deck="1"><div className="deck-empty-label">0</div></div>}
              </BoardZone>
              <BoardZone type="potion" label="Potions" faceDown style={oppBoardZone('potion')}>
                {opp.potionDeckCount > 0 ? <div className="board-card face-down"><img src={opp.cardback || "/cardback.png"} style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false} /><div className="board-card-label">{opp.potionDeckCount}</div></div>
                : <div className="board-card"><div className="deck-empty-label">0</div></div>}
              </BoardZone>
              <div className="board-util-spacer" />
            </div>
            <div className="board-util-mid" />
            <div className="board-util-side">
              <div className="board-util-spacer" />
              <div onClick={() => !isSpectator && me.potionDeckCount > 0 && setDeckViewer('potion')} style={{ cursor: !isSpectator && me.potionDeckCount > 0 ? 'pointer' : 'default' }} data-my-potion-deck="1">
              <BoardZone type="potion" label="Potions" faceDown style={myBoardZone('potion')}>
                {me.potionDeckCount > 0 ? <div className="board-card face-down"><img src={me.cardback || "/cardback.png"} style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false} /><div className="board-card-label">{me.potionDeckCount}</div></div>
                : <div className="board-card"><div className="deck-empty-label">0</div></div>}
              </BoardZone>
              </div>
              <div onClick={() => !isSpectator && me.deckCount > 0 && setDeckViewer('deck')} style={{ cursor: !isSpectator && me.deckCount > 0 ? 'pointer' : 'default' }} data-my-deck="1">
              <BoardZone type="deck" label="Deck" faceDown style={myBoardZone('deck')}>
                {me.deckCount > 0 ? <div className="board-card face-down"><img src={me.cardback || "/cardback.png"} style={{width:'100%',height:'100%',objectFit:'cover'}} draggable={false} /><div className="board-card-label">{me.deckCount}</div></div>
                : <div className="board-card"><div className="deck-empty-label">0</div></div>}
              </BoardZone>
              </div>
            </div>
          </div>
        </div>

        {/* My hand (bottom player) — drag to reorder for players, face-down for spectators */}
        <div className="game-hand game-hand-me" ref={isSpectator ? undefined : handRef}>
          <div className="game-hand-info">
            {me.avatar
              ? <img src={me.avatar} className={'game-hand-avatar game-hand-avatar-big' + (!result && (isMyTurn ? ' avatar-active' : ' avatar-inactive'))} />
              : me.heroes?.[1]?.name && HeroArtCrop
                ? (
                  <div className={'game-hand-avatar-crop' + (!result && (isMyTurn ? ' avatar-active' : ' avatar-inactive'))}>
                    <HeroArtCrop heroName={me.heroes[1].name} width={72} />
                  </div>
                )
                : null}
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
                const forceDiscardEligible = isForceDiscard && gameState.effectPrompt.eligibleIndices;
                const isForceDiscardEligible = !forceDiscardEligible || gameState.effectPrompt.eligibleIndices.includes(item.origIdx);
                // Pick-a-Hand-Card prompt (Deepsea Castle swap-in, any
                // future single-pick-from-hand effect): eligible cards
                // use the purple "pick" highlight; ineligible ones dim.
                const isPickHandCard = gameState.effectPrompt?.type === 'pickHandCard' && gameState.effectPrompt?.ownerIdx === myIdx;
                const pickEligibleList = isPickHandCard ? gameState.effectPrompt.eligibleIndices : null;
                const isPickHandCardEligible = isPickHandCard && (!pickEligibleList || pickEligibleList.includes(item.origIdx));
                const isPickHandCardDimmed = isPickHandCard && !isPickHandCardEligible;
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
                // Luna-Kiai-style hand activation: card has a
                // `handActivatedEffect` currently available. No badge —
                // `getCardDimmed` un-dims it so it looks playable, and
                // `onHandMouseDown` routes a click-without-drag through
                // a Summon/Reveal picker (or straight to reveal when only
                // that option is live). Revealed copies render semi-
                // transparent via `hand-card-revealed`.
                const isRevealed = revealedHandIdxSet.has(item.origIdx);
                return (
                  <div key={'h-' + item.origIdx} data-hand-idx={item.origIdx} data-card-name={item.card} data-card-type={CARDS_BY_NAME[item.card]?.cardType || ''} data-touch-drag="1"
                    className={'hand-slot' + (isBeingDragged ? ' hand-dragging' : '') + (dimmed ? ' hand-card-dimmed' : '') + (isAnyDiscard && isForceDiscardEligible ? ' hand-discard-target' : '') + (isAnyDiscard && !isForceDiscardEligible ? ' hand-card-dimmed' : '') + (isAttachEligible ? ' hand-card-attach-eligible' : '') + (isAbilityAttach && !isAttachEligible ? ' hand-card-attach-dimmed' : '') + (isHandPickSelected ? ' hand-pick-selected' : '') + (isHandPickEligible && !isHandPickSelected && !isHandPickTypeFull && !isHandPickMaxed ? ' hand-pick-eligible' : '') + ((isHandPickTypeFull || isHandPickMaxed) ? ' hand-card-dimmed' : '') + (isPickHandCardEligible ? ' hand-pick-eligible' : '') + (isPickHandCardDimmed ? ' hand-card-dimmed' : '') + ((isStealMarked || isStealHighlighted) ? ' blind-pick-selected' : '') + (isRevealed ? ' hand-card-revealed' : '')}
                    style={(isDrawAnim || isPendingPlay || isStealHidden || bounceReturnHidden.has(`${myIdx}-${item.origIdx}`)) ? { visibility: 'hidden' } : undefined}
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
        <DamageNumber key={d.id} amount={d.amount} ownerLabel={d.ownerLabel} heroIdx={d.heroIdx} />
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
        // Token mapping — cards that create tokens show the token tooltip alongside
        const CARD_TOKEN_MAP = {
          'Pyroblast': ['Pollution Token'],
          'Mummy Maker Machine': ['Mummy Token'],
        };
        const relatedTokens = [...(CARD_TOKEN_MAP[tooltipCard.name] || [])];
        // Generic: any card whose effect text mentions "Pollution Token"
        // surfaces the Pollution Token's tooltip alongside (same treatment
        // Pyroblast already got hard-coded). Skip if the hovered card IS
        // the Pollution Token so we don't duplicate it.
        if (tooltipCard.name !== 'Pollution Token'
            && /Pollution Token/i.test(tooltipCard.effect || '')
            && !relatedTokens.includes('Pollution Token')) {
          relatedTokens.push('Pollution Token');
        }
        // Luck declared target — show the declared card alongside ONLY for the specific hovered Luck
        if (tooltipCard.name === 'Luck' && _activeLuckTooltipTarget) {
          if (!relatedTokens.includes(_activeLuckTooltipTarget)) relatedTokens.push(_activeLuckTooltipTarget);
        }
        return (
          <>
            {relatedTokens.map(tokenName => {
              const tokenCard = CARDS_BY_NAME[tokenName];
              if (!tokenCard) return null;
              return (
                <div key={tokenName} className="board-tooltip board-tooltip-token">
                  <CardTooltipContent card={tokenCard} />
                </div>
              );
            })}
            <div className="board-tooltip">
              <CardTooltipContent card={tooltipCard} />
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
        const isPuzzleMode = gameState.isPuzzle;
        const handleRetry = () => {
          showTextBox(null);
          setShowSurrender(false);
          socket.emit('retry_puzzle', { roomId: gameState.roomId });
        };
        return (
        <div className="modal-overlay" onClick={() => setShowSurrender(false)}>
          <div className="modal animate-in" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, textAlign: 'center' }}>
            <div className="pixel-font" style={{ fontSize: 14, color: isPuzzleMode ? '#ff8800' : 'var(--danger)', marginBottom: 16 }}>
              {isPuzzleMode ? (gameState.isTutorial ? 'TUTORIAL' : 'PUZZLE') : 'SURRENDER?'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 20 }}>
              {isPuzzleMode ? 'What would you like to do?'
              : isBestOf ? `Best of ${gameState.format} — Score: ${(gameState.setScore||[0,0]).join(' – ')}` : 'Do you really want to give up?'}
            </div>
            <div style={{ display: 'flex', flexDirection: isPuzzleMode || isBestOf ? 'column' : 'row', gap: 10, alignItems: 'center', justifyContent: 'center' }}>
              {isPuzzleMode ? (<>
                <button className="btn" style={{ padding: '10px 28px', fontSize: 13, width: 220, borderColor: 'var(--accent)', color: 'var(--accent)' }} onClick={handleRetry}>🔄 Retry</button>
                <button className="btn btn-danger" style={{ padding: '10px 28px', fontSize: 13, width: 220 }} onClick={() => {
                  showTextBox(null);
                  setShowSurrender(false);
                  if (gameState.isTutorial) window._tutorialGaveUp = true;
                  onLeave();
                }}>✕ Give Up</button>
                <button className="btn" style={{ padding: '10px 28px', fontSize: 13, width: 220 }} onClick={() => setShowSurrender(false)}>Cancel</button>
              </>) : isBestOf ? (<>
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
          {ep.renderAs === 'dropdown' ? (
            // Dropdown variant for prompts with many scalar choices (e.g. Siphem's
            // "spend N counters" list). Keeps the panel compact and prevents a
            // tall button stack. `selectedOptionId` is stored in a ref so we
            // don't need to lift state; the initial value is the first option.
            <OptionPickerDropdown ep={ep} respondToPrompt={respondToPrompt} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(ep.options || []).map(opt => {
                // Resolve a tooltip card: explicit `opt.tooltipCardName` wins,
                // else auto-detect any CARDS_BY_NAME key mentioned in the
                // option label (so "Place 1 Pollution Token" naturally pulls
                // the Pollution Token tooltip, "Spawn a Mummy Token" pulls
                // the Mummy Token tooltip, etc.).
                let tooltipCard = opt.tooltipCardName ? CARDS_BY_NAME[opt.tooltipCardName] : null;
                if (!tooltipCard && opt.label) {
                  for (const cardName of Object.keys(CARDS_BY_NAME || {})) {
                    if (opt.label.includes(cardName)) { tooltipCard = CARDS_BY_NAME[cardName]; break; }
                  }
                }
                return (
                  <button key={opt.id} className={'btn' + (tooltipCard ? ' option-tooltip-hover' : '')} style={{ padding: '10px 18px', fontSize: 12, borderColor: opt.color || 'var(--accent)', color: opt.color || 'var(--accent)', textAlign: 'left' }}
                    onMouseEnter={() => tooltipCard && window._boardTooltipSetter?.(tooltipCard)}
                    onMouseLeave={() => tooltipCard && window._boardTooltipSetter?.(null)}
                    onClick={() => respondToPrompt({ optionId: opt.id })}>
                    <div style={{ fontWeight: 600 }}>{opt.label}</div>
                    {opt.description && <div style={{ fontSize: 10, opacity: .7, marginTop: 2 }}>{opt.description}</div>}
                  </button>
                );
              })}
              {ep.cancellable !== false && (
                <button className="btn" style={{ padding: '8px 18px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)', marginTop: 4 }}
                  onClick={() => respondToPrompt({ cancelled: true })}>Cancel (Esc)</button>
              )}
            </div>
          )}
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
                    onClick={() => respondToPrompt({ cancelled: true })}>{ep.cancelLabel || '✕ CANCEL'}</button>
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
                        onClick={() => { if (window.playSFX) window.playSFX('ui_click'); respondToPrompt({ cardName: entry.name, source: entry.source }); }}
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
              {ep.footer && (
                <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text2)', textAlign: 'center', fontStyle: 'italic' }}>
                  {ep.footer}
                </div>
              )}
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

      {/* ── Effect Prompt: Pick a Hand Card (Deepsea Castle, etc.) ── */}
      {isMyEffectPrompt && ep.type === 'pickHandCard' && (
        <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'rgba(200,100,255,.6)' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: '#c864ff', marginBottom: 4 }}>{ep.title || 'Pick a Card'}</div>
          {ep.description && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>{ep.description}</div>}
          <div style={{ fontSize: 11, color: 'var(--text2)', opacity: .7, marginBottom: 12 }}>{ep.instruction || 'Click a highlighted card in your hand.'}</div>
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
             ep.type === 'pickHandCard' ? (ep.opponentTitle || '🎴 Opponent is choosing a card...') :
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
             ep.type === 'pickHandCard' ? (ep.opponentSubtitle || 'Waiting for opponent to pick a card from their hand...') :
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
            {spellHeroPick.isSurprise ? '🎭' : spellHeroPick.isAscension ? '🦋' : spellHeroPick.isCreature ? '🐾' : spellHeroPick.card?.cardType === 'Attack' ? '⚔️' : '✦'} {spellHeroPick.isSurprise ? 'Set' : spellHeroPick.isAscension ? 'Ascend' : spellHeroPick.isCreature ? 'Summon' : 'Play'} {spellHeroPick.cardName}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 12 }}>{spellHeroPick.isSurprise ? 'Choose a Hero to set this Surprise face-down:' : spellHeroPick.isAscension ? 'Choose a Hero to Ascend:' : spellHeroPick.isCreature ? 'Choose a Hero to summon this Creature:' : 'Choose a Hero to play this card:'}</div>
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
                    hideGameTooltip(); socket.emit('ascend_hero', {
                      roomId: gameState.roomId, cardName: pick.cardName,
                      handIndex: pick.handIndex, heroIdx: h.idx,
                    });
                  } else if (pick.isHeroAction) {
                    socket.emit('effect_prompt_response', {
                      roomId: gameState.roomId,
                      response: { cardName: pick.cardName, handIndex: pick.handIndex, heroIdx: h.idx },
                    });
                  } else if (pick.isCreature) {
                    socket.emit('play_creature', {
                      roomId: gameState.roomId, cardName: pick.cardName,
                      handIndex: pick.handIndex, heroIdx: h.idx,
                      zoneSlot: h.zoneSlot,
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

      {/* ── Summon-or-Reveal Picker (hand-activated Creatures like Luna Kiai) ── */}
      {summonOrRevealPick && !result && (() => {
        const p = summonOrRevealPick;
        const revealLabel = (gameState.handActivatableCards || []).find(h => h.cardName === p.cardName)?.label || 'Reveal';
        return (
          <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'var(--accent)' }}>
            <div className="orbit-font" style={{ fontSize: 13, color: 'var(--accent)', marginBottom: 4 }}>
              ✨ {p.cardName}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 12 }}>
              Choose an action:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn" style={{ padding: '8px 16px', fontSize: 12, borderColor: 'var(--accent)', color: 'var(--accent)', textAlign: 'left' }}
                onClick={() => {
                  const { cardName: cn, handIndex: hi, card: c, summonEligible } = p;
                  setSummonOrRevealPick(null);
                  if (!summonEligible || summonEligible.length === 0) return;
                  if (summonEligible.length === 1) {
                    socket.emit('play_creature', {
                      roomId: gameState.roomId, cardName: cn,
                      handIndex: hi, heroIdx: summonEligible[0].idx,
                      zoneSlot: summonEligible[0].zoneSlot,
                    });
                  } else {
                    setSpellHeroPick({ cardName: cn, handIndex: hi, card: c, eligible: summonEligible, isCreature: true });
                  }
                }}>
                🐾 Summon
              </button>
              <button className="btn" style={{ padding: '8px 16px', fontSize: 12, borderColor: '#ffc84a', color: '#ffc84a', textAlign: 'left' }}
                onClick={() => {
                  const { cardName: cn, handIndex: hi } = p;
                  setSummonOrRevealPick(null);
                  if (window.playSFX) window.playSFX('ui_click');
                  socket.emit('activate_hand_card', { roomId: gameState.roomId, cardName: cn, handIndex: hi });
                }}>
                ⚡ {revealLabel}
              </button>
              <button className="btn" style={{ padding: '6px 16px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)', marginTop: 4 }}
                onClick={() => setSummonOrRevealPick(null)}>Cancel</button>
            </div>
          </DraggablePanel>
        );
      })()}

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
        // Cancellable picks get a Cancel button (Escape is wired up by
        // the existing `cancellable !== false` effectPrompt handler).
        const cancellable = ep.cancellable === true;
        return (
          <DraggablePanel className="first-choice-panel animate-in" style={{ borderColor: 'rgba(255,150,50,.85)' }}>
            <div className="orbit-font" style={{ fontSize: 13, color: '#ff9933', marginBottom: 4 }}>{ep.title || 'Steal Cards'}</div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>{ep.description || `Click ${maxSel} face-down cards from your opponent's hand.`}</div>
            <div style={{ fontSize: 11, color: '#ff9933', opacity: .8, marginBottom: 8 }}>
              Selected: {blindPickSelected.size}/{maxSel}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn" style={{ padding: '6px 16px', fontSize: 11, borderColor: canConfirm ? '#ff9933' : '#555', color: canConfirm ? '#ff9933' : '#555' }}
                disabled={!canConfirm}
                onClick={() => {
                  respondToPrompt({ selectedIndices: [...blindPickSelected] });
                }}>{ep.confirmLabel || '🫳 Steal!'}</button>
              {cancellable && (
                <button className="btn" style={{ padding: '6px 16px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)' }}
                  onClick={() => respondToPrompt({ cancelled: true })}>Cancel (Esc)</button>
              )}
            </div>
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

      {/* ── Ability Attach Target Prompt (Alex's deck-search tutor, etc.) ─
           The ability has already been chosen by the server; the player's
           remaining job is to pick WHICH hero / zone receives it. Eligible
           heroes and zones are highlighted by the same machinery as the
           hand-driven click-to-attach flow — this panel is just an anchor
           showing what's being attached + a cancel. Clicks go through the
           hero / zone handlers, which emit effect_prompt_response when
           the pick source is 'effectPrompt'. */}
      {isMyEffectPrompt && ep.type === 'abilityAttachTarget' && (
        <DraggablePanel className="first-choice-panel animate-in attach-pick-panel" style={{ borderColor: '#7fffaa' }}>
          <div className="orbit-font" style={{ fontSize: 13, color: '#7fffaa', marginBottom: 4, textShadow: '0 0 8px rgba(120,255,170,.6)' }}>✦ {ep.title || 'Attach Ability'}</div>
          {ep.description && <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>{ep.description}</div>}
          {ep.cardName && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <BoardCard cardName={ep.cardName} style={{ width: 110, height: 154, borderRadius: 6, boxShadow: '0 0 18px rgba(120,255,170,.55)' }} />
            </div>
          )}
          <div style={{
            fontSize: 12, color: '#baffcf', marginBottom: 12, textAlign: 'center',
            fontWeight: 600, letterSpacing: 0.3,
          }}>
            👉 Click a highlighted Hero or Ability Zone
          </div>
          {ep.cancellable !== false && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button className="btn" style={{ padding: '6px 16px', fontSize: 11, borderColor: 'var(--danger)', color: 'var(--danger)' }}
                onClick={() => respondToPrompt({ cancelled: true })}>Cancel (Esc)</button>
            </div>
          )}
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
          {pt.config?.maxTotal > 0 && pt.validTargets?.length > 0 && (() => {
            // For Pollution-capped prompts (Sun Beam etc.), the effective cap
            // grows with each own-support target selected — since destroying
            // those frees up a slot for the Pollution Token that will be
            // placed in return. Show that dynamic cap instead of the raw max.
            let effectiveMax = pt.config.maxTotal;
            if (pt.config.maxNonOwnSupport !== undefined) {
              const selectedOwnSupport = potionSelection.reduce((acc, id) => {
                const t = (pt.validTargets || []).find(x => x.id === id);
                return acc + (t?.ownSupport ? 1 : 0);
              }, 0);
              effectiveMax = Math.min(pt.config.maxTotal, pt.config.maxNonOwnSupport + selectedOwnSupport);
            }
            // Sacrifice-summon HP readout: show the running sum of selected
            // targets' _meta.maxHp against the threshold so the player can
            // see exactly how many more HP they need to commit.
            let hpLine = null;
            const minSumHp = pt.config.minSumMaxHp;
            if (minSumHp != null && minSumHp > 0) {
              const selectedTargets = (pt.validTargets || []).filter(t => potionSelection.includes(t.id));
              const sumHp = selectedTargets.reduce((s, t) => s + (t?._meta?.maxHp || 0), 0);
              const met = sumHp >= minSumHp;
              hpLine = (
                <div style={{ fontSize: 11, color: met ? 'var(--success)' : 'var(--danger)', marginBottom: 10, fontWeight: 600 }}>
                  HP {sumHp} / {minSumHp}{met ? ' ✓' : ''}
                </div>
              );
            }
            // Parallel combined-level readout (Dark Deepsea God tribute).
            let levelLine = null;
            const minSumLvl = pt.config.minSumLevel;
            if (minSumLvl != null && minSumLvl > 0) {
              const selectedTargets = (pt.validTargets || []).filter(t => potionSelection.includes(t.id));
              const sumLvl = selectedTargets.reduce((s, t) => s + (t?._meta?.level || 0), 0);
              const met = sumLvl >= minSumLvl;
              levelLine = (
                <div style={{ fontSize: 11, color: met ? 'var(--success)' : 'var(--danger)', marginBottom: 10, fontWeight: 600 }}>
                  Combined Levels {sumLvl} / {minSumLvl}{met ? ' ✓' : ''}
                </div>
              );
            }
            return (
              <>
                <div style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 10, fontWeight: 600 }}>
                  {potionSelection.length} / {effectiveMax} selected
                  {pt.config.minRequired > 0 && potionSelection.length < pt.config.minRequired
                    ? ` (min ${pt.config.minRequired})`
                    : ''}
                </div>
                {hpLine}
                {levelLine}
              </>
            );
          })()}
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
            {!isSpectator && ((decks && decks.length > 0) || (sampleDecks || []).some(d => isDeckLegal(d).legal)) && (
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <label style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 600 }}>🃏 Deck:</label>
                <select className="select" value={selectedDeck || ''} onChange={e => {
                  const id = e.target.value;
                  setSelectedDeck(id);
                  socket.emit('change_deck', { roomId: gameState.roomId, deckId: id });
                }} style={{ fontSize: 14, minWidth: 240, padding: '8px 14px', borderColor: 'var(--accent)', color: 'var(--text)' }}>
                  {(decks||[]).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  {(sampleDecks||[]).filter(d => isDeckLegal(d).legal).length > 0 && <option disabled>── Sample Decks ──</option>}
                  {(sampleDecks||[]).filter(d => isDeckLegal(d).legal).map(d => <option key={d.id} value={d.id}>📋 {d.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {isSpectator ? (
                <button className="btn btn-danger" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleLeave}>LEAVE</button>
              ) : gameState.isCpuBattle ? (
                <>
                  <button className="btn btn-success" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleRematch}>
                    🔄 REMATCH
                  </button>
                  <button className="btn btn-danger" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleLeave}>LEAVE</button>
                </>
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

      {/* ── Puzzle / Tutorial Result Overlay ── */}
      {result && result.isPuzzle && !tutorialOutroPending && (() => {
        // The final tutorial (script flagged `isFinalTutorial: true`) gets
        // a celebratory upgrade: big multi-colored fireworks + a beefier
        // "TUTORIAL CLEARED!" banner instead of the usual "STAGE CLEARED!".
        // Identified by reading TUTORIAL_SCRIPTS for the running tutorial
        // num; any non-final tutorial and regular puzzles render normally.
        const finalTutorialCleared =
          result.isTutorial
          && result.puzzleResult === 'success'
          && !!(window.TUTORIAL_SCRIPTS || {})[window._currentTutorialNum]?.isFinalTutorial;
        return (
        <div className={'modal-overlay result-overlay-fade' + (resultFading ? ' result-overlay-fading' : '')}
          style={{ background: 'rgba(0,0,0,.85)' }}>
          {finalTutorialCleared && (
            <div className="set-fireworks">
              {Array.from({ length: 60 }).map((_, i) => (
                <div key={i} className="firework-particle firework-big" style={{
                  '--fw-x': (Math.random() * 400 - 200) + 'px',
                  '--fw-y': (Math.random() * -400 - 80) + 'px',
                  '--fw-color': ['#ffd700','#ff3366','#33ff88','#44aaff','#ff8800','#cc44ff','#ff6b00','#00f0ff'][i % 8],
                  '--fw-delay': (Math.random() * 2.5) + 's',
                  '--fw-dur': (1.2 + Math.random() * 0.8) + 's',
                  left: (12 + Math.random() * 76) + '%',
                  top: (22 + Math.random() * 46) + '%',
                }} />
              ))}
            </div>
          )}
          <div className="animate-in" style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
            {result.puzzleResult === 'success' ? (
              <>
                <div className="pixel-font" style={{
                  fontSize: finalTutorialCleared ? 56 : 42,
                  marginBottom: 12, color: '#ffd700',
                  textShadow: finalTutorialCleared
                    ? '0 0 60px rgba(255,215,0,.85), 0 0 100px rgba(255,215,0,.45)'
                    : '0 0 40px rgba(255,215,0,.6)'
                }}>
                  {finalTutorialCleared
                    ? '🎉 TUTORIAL CLEARED! 🎉'
                    : result.isTutorial ? '📖 STAGE CLEARED! 📖' : '🧩 PUZZLE CLEARED! 🧩'}
                </div>
                <div style={{ fontSize: finalTutorialCleared ? 16 : 14, color: 'var(--text2)', marginBottom: 24 }}>
                  {finalTutorialCleared
                    ? 'You have completed every tutorial — go forth and battle!'
                    : result.isTutorial ? 'Great job!' : 'All enemy heroes defeated in one turn!'}
                </div>
              </>
            ) : (
              <>
                <div className="pixel-font" style={{ fontSize: 36, marginBottom: 12, color: 'var(--danger)', textShadow: '0 0 30px rgba(255,51,102,.5)' }}>
                  {result.isTutorial ? 'STAGE FAILED' : 'PUZZLE FAILED'}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 24 }}>
                  {result.reason === 'puzzle_failed' ? 'Your turn ended without defeating all enemy heroes.' :
                   result.reason === 'all_heroes_dead' && result.winnerIdx !== 0 ? 'All your heroes were defeated!' :
                   result.reason === 'surrender' ? 'You gave up.' : 'Better luck next time!'}
                </div>
              </>
            )}
            {result.puzzleResult === 'success' ? (
              <button className="btn" style={{ padding: '12px 32px', fontSize: 14, borderColor: '#ffd700', color: '#ffd700' }} onClick={handleResultLeave}>
                {result.isTutorial ? '← RETURN TO TUTORIAL' : '← RETURN TO PUZZLE'}
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
                <button className="btn" style={{ padding: '10px 28px', fontSize: 13, width: 220, borderColor: 'var(--accent)', color: 'var(--accent)' }}
                  onClick={() => { if (window.stopSFX) { window.stopSFX('victory'); window.stopSFX('defeat'); } socket.emit('retry_puzzle', { roomId: gameState.roomId }); }}>
                  🔄 Retry
                </button>
                <button className="btn btn-danger" style={{ padding: '10px 28px', fontSize: 13, width: 220 }}
                  onClick={() => { if (window.stopSFX) { window.stopSFX('victory'); window.stopSFX('defeat'); } if (result?.isTutorial) window._tutorialGaveUp = true; onLeave(); }}>
                  ✕ Give Up
                </button>
              </div>
            )}
          </div>
        </div>
        );
      })()}

      {/* Win/Loss overlay — Bo1 or fallback */}
      {result && !result.isPuzzle && !showFirstChoice && (result.setOver || !result.format || result.format === 1) && !(result.format > 1) && (
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
            {!isSpectator && ((decks && decks.length > 0) || (sampleDecks || []).some(d => isDeckLegal(d).legal)) && (
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <label style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 600 }}>🃏 Deck:</label>
                <select className="select" value={selectedDeck || ''} onChange={e => {
                  const id = e.target.value;
                  setSelectedDeck(id);
                  socket.emit('change_deck', { roomId: gameState.roomId, deckId: id });
                }} style={{ fontSize: 14, minWidth: 240, padding: '8px 14px', borderColor: 'var(--accent)', color: 'var(--text)' }}>
                  {(decks||[]).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  {(sampleDecks||[]).filter(d => isDeckLegal(d).legal).length > 0 && <option disabled>── Sample Decks ──</option>}
                  {(sampleDecks||[]).filter(d => isDeckLegal(d).legal).map(d => <option key={d.id} value={d.id}>📋 {d.name}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              {isSpectator ? (
                <button className="btn btn-danger" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleLeave}>LEAVE</button>
              ) : gameState.isCpuBattle ? (
                <>
                  <button className="btn btn-success" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleRematch}>
                    🔄 REMATCH
                  </button>
                  <button className="btn btn-danger" style={{ padding: '12px 32px', fontSize: 14 }} onClick={handleLeave}>LEAVE</button>
                </>
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
window.FrozenOverlay = FrozenOverlay;
window.NegatedOverlay = NegatedOverlay;
window.BurnedOverlay = BurnedOverlay;
window.PoisonedOverlay = PoisonedOverlay;
window.HealReversedOverlay = HealReversedOverlay;
window.ImmuneIcon = ImmuneIcon;
