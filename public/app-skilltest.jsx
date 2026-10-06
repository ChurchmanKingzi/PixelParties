// ═══════════════════════════════════════════
//  PIXEL PARTIES — SKILL TEST (Client)
//  Lobby (2–8 Sitze, CPU-Personas), später Vorbereitung (Basis,
//  Recycler, Ready). Server-Gegenstück: skilltest/*.js
// ═══════════════════════════════════════════
const { useState, useEffect, useRef, useCallback, useMemo, useContext } = React;
const { socket, cardImageUrl, VolumeControl } = window;

const ST_MAX_SEATS = 8;

// ── Lobby ──────────────────────────────────────────────────────────
// 8-Sitz-Raster wie die Cube-Lobby, aber: CPU-Sitze per Knopf (mit
// zufälliger Hero-Persona), kein Deck nötig, Start ab 2 Sitzen.
function SkillTestLobby({ lobby, user, leaveRoom, playerJoined, setPlayerJoined }) {
  const isHost = lobby.host === user.username;
  const seats = lobby.seats || [];
  const filled = seats.filter(Boolean).length;
  const canStart = filled >= 2;
  const cfg = lobby.skillTest || {};
  const mineSeated = (lobby.players || []).includes(user.username);
  const isSpectator = !mineSeated && (lobby.spectators || []).includes(user.username);

  return (
    <div className="screen-full">
      <div className="top-bar">
        <button className="btn btn-danger" onClick={leaveRoom}>{isHost ? 'CLOSE ROOM' : 'LEAVE'}</button>
        <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>🎯 SKILL TEST LOBBY</h2>
        <span className="badge" style={{ background: 'rgba(0,240,255,.12)', color: 'var(--accent)' }}>2–8 PLAYERS</span>
        <VolumeControl />
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto' }} className="animate-in">
        <div className="panel" style={{ width: 760, maxWidth: '94%' }}>
          <div className="orbit-font" style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, textAlign: 'center' }}>
            {canStart
              ? (isHost ? '⚔️ Ready — start when you like.' : '⏳ Waiting for host to start...')
              : '⏳ Waiting for at least one more player or CPU...'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {Array.from({ length: ST_MAX_SEATS }).map((_, i) => {
              const seat = seats[i] || null;
              const heroArt = seat?.persona?.hero ? cardImageUrl(seat.persona.hero) : null;
              return (
                <div key={i} className="st-seat" style={{
                  position: 'relative',
                  border: '2px ' + (seat ? 'solid ' : 'dashed ') + (seat ? (seat.isHost ? 'var(--accent)' : (seat.isBot ? 'var(--accent3)' : 'var(--accent2)')) : 'var(--bg4)'),
                  borderRadius: 8, padding: '10px 6px', textAlign: 'center',
                  background: seat ? 'rgba(0,240,255,.04)' : 'transparent',
                  opacity: seat ? 1 : .5, minHeight: 112,
                }}>
                  {seat && seat.isBot && isHost && (
                    <button className="btn" title="Remove CPU"
                      style={{ position: 'absolute', top: 2, right: 2, padding: '0 6px', fontSize: 11, lineHeight: '16px' }}
                      onClick={() => socket.emit('st_remove_cpu', { roomId: lobby.id, username: seat.username })}>✕</button>
                  )}
                  <div style={{ height: 52, marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                    {heroArt
                      ? <img src={heroArt} alt="" style={{ height: 52, imageRendering: 'pixelated', borderRadius: 4 }} />
                      : (seat ? (seat.isHost ? '👑' : '⚔️') : `${i + 1}`)}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 11, color: seat ? 'var(--text)' : 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {seat ? seat.username : 'Open Seat'}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text2)', marginTop: 2 }}>
                    {seat ? (seat.isHost ? 'HOST' : seat.isBot ? '🤖 CPU' : 'PLAYER') : ' '}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ background: 'var(--bg2)', borderRadius: 4, padding: '8px 12px', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11, color: 'var(--text2)' }}>
            <div>🛠 Preparation timer: <strong style={{ color: 'var(--text)' }}>{cfg.prepTimerDisabled ? 'Off' : `${cfg.prepTimerSec}s`}</strong></div>
            <div>⏱ Turn timer: <strong style={{ color: 'var(--text)' }}>{cfg.turnTimerDisabled ? 'Off' : `${cfg.turnTimerSec}s`}</strong></div>
          </div>

          {(lobby.spectators || []).length > 0 && (
            <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 12, textAlign: 'center' }}>
              👁 Spectators: {lobby.spectators.join(', ')}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {isHost && (
              <button className="btn btn-accent2" disabled={filled >= ST_MAX_SEATS}
                onClick={() => socket.emit('st_add_cpu', { roomId: lobby.id })}>
                🤖 ADD CPU
              </button>
            )}
            {isHost && (
              <button className={'btn btn-success btn-big' + (canStart ? ' glow-border' : '')}
                disabled={!canStart}
                title={canStart ? '' : 'Need at least 2 seats (players or CPUs).'}
                onClick={() => socket.emit('st_start', { roomId: lobby.id })}>
                🎯 START ({filled} {filled === 1 ? 'seat' : 'seats'})
              </button>
            )}
            {!isHost && mineSeated && (
              <button className="btn" style={{ fontSize: 10 }}
                onClick={() => socket.emit('swap_to_spectator', { roomId: lobby.id })}>
                SWITCH TO SPECTATOR
              </button>
            )}
            {isSpectator && filled < ST_MAX_SEATS && (
              <button className="btn btn-accent2" style={{ fontSize: 10 }}
                onClick={() => socket.emit('swap_to_player', { roomId: lobby.id, deckId: null })}>
                ⚔ JOIN SEAT
              </button>
            )}
          </div>
        </div>
      </div>
      {playerJoined && (
        <div className="modal-overlay" onClick={() => setPlayerJoined(null)}>
          <div className="modal animate-in" onClick={e => e.stopPropagation()} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚔️</div>
            <div className="orbit-font" style={{ fontSize: 16, marginBottom: 8 }}>
              <span style={{ color: 'var(--accent2)' }}>{playerJoined}</span> has joined!
            </div>
            <button className="btn" onClick={() => setPlayerJoined(null)}>OK</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Einstellungen im „Create Game"-Dialog ──────────────────────────
function SkillTestCreateOptions({ opts, setOpts }) {
  const set = (k, v) => setOpts(o => ({ ...o, [k]: v }));
  return (
    <>
      <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, padding: '6px 8px', border: '1px solid var(--bg4)', borderRadius: 4 }}>
        2–8 players (humans and CPUs). Everyone prepares a base from 18 random cards, then
        takes turns acting with one Hero or Creature at a time. No deck needed.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: opts.prepTimerDisabled ? 'var(--bg4)' : 'var(--text2)', marginBottom: 4 }}>Preparation time (s)</div>
          <input className="input" type="number" min={30} max={1800} value={opts.prepTimerSec}
            onChange={e => set('prepTimerSec', e.target.value)} disabled={opts.prepTimerDisabled} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: opts.turnTimerDisabled ? 'var(--bg4)' : 'var(--text2)', marginBottom: 4 }}>Time per turn (s)</div>
          <input className="input" type="number" min={15} max={600} value={opts.turnTimerSec}
            onChange={e => set('turnTimerSec', e.target.value)} disabled={opts.turnTimerDisabled} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: 'var(--text2)' }}>
          <input type="checkbox" checked={opts.prepTimerDisabled} onChange={e => set('prepTimerDisabled', e.target.checked)} />
          No preparation timer
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: 'var(--text2)' }}>
          <input type="checkbox" checked={opts.turnTimerDisabled} onChange={e => set('turnTimerDisabled', e.target.checked)} />
          No turn timer
        </label>
      </div>
    </>
  );
}

window.SkillTestLobby = SkillTestLobby;
window.SkillTestCreateOptions = SkillTestCreateOptions;
