// ═══════════════════════════════════════════
//  PIXEL PARTIES — APP ROOT
//  PlayScreen, MusicManager, and App component
// ═══════════════════════════════════════════
const { useState, useEffect, useRef, useCallback, useContext } = React;
const { api, socket, AppContext, Notification, CardMini, loadCardDB,
        isDeckLegal, emitSocket } = window;
const { AuthScreen, MainMenu, ProfileScreen, ShopScreen } = window;
const { DeckBuilder } = window;
const { GameBoard } = window;
let _pendingGameState = null;

function PlayScreen() {
  const { user, setScreen, notify, setInBattle } = useContext(AppContext);
  const [decks, setDecks] = useState([]);
  const [sampleDecks, setSampleDecks] = useState([]);
  const [selectedDeck, setSelectedDeck] = useState('');
  const [rooms, setRooms] = useState([]);
  const [creating, setCreating] = useState(false);
  const [gameType, setGameType] = useState('unranked');
  const [gameFormat, setGameFormat] = useState(1);
  const [playerPw, setPlayerPw] = useState('');
  const [specPw, setSpecPw] = useState('');
  const [joinPw, setJoinPw] = useState('');
  const [joinTarget, setJoinTarget] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [playerJoined, setPlayerJoined] = useState(null);
  const [gameState, setGameState] = useState(() => {
    // Check for buffered reconnection state
    const pending = _pendingGameState;
    _pendingGameState = null;
    return pending;
  });

  // Sync battle music state
  useEffect(() => {
    setInBattle(!!gameState);
    return () => setInBattle(false);
  }, [gameState, setInBattle]);

  // Load decks + sample decks
  useEffect(() => {
    (async () => {
      try {
        const data = await api('/decks');
        if (data.decks) {
          setDecks(data.decks);
          const def = data.decks.find(d => d.isDefault);
          if (def) setSelectedDeck(def.id);
          else if (data.decks.length) setSelectedDeck(data.decks[0].id);
        }
      } catch {}
      try {
        const sd = await api('/sample-decks');
        if (sd.decks) setSampleDecks(sd.decks);
      } catch {}
    })();
  }, []);

  // Socket events
  useEffect(() => {
    socket.emit('get_rooms');

    const onRooms = (r) => setRooms(r);
    const onRoomJoined = (r) => setLobby(r);
    const onRoomUpdate = (r) => setLobby(prev => prev ? r : null);
    const onRoomClosed = () => { setLobby(null); setGameState(null); notify('Room was closed by host', 'error'); };
    const onJoinError = (msg) => notify(msg, 'error');
    const onPlayerJoined = (data) => setPlayerJoined(data.username);
    const onGameStarted = (r) => { setLobby(r); };
    const onGameState = (state) => { setGameState(state); };

    socket.on('rooms', onRooms);
    socket.on('room_joined', onRoomJoined);
    socket.on('room_update', onRoomUpdate);
    socket.on('room_closed', onRoomClosed);
    socket.on('join_error', onJoinError);
    socket.on('player_joined', onPlayerJoined);
    socket.on('game_started', onGameStarted);
    socket.on('game_state', onGameState);

    const poll = setInterval(() => socket.emit('get_rooms'), 4000);

    return () => {
      socket.off('rooms', onRooms);
      socket.off('room_joined', onRoomJoined);
      socket.off('room_update', onRoomUpdate);
      socket.off('room_closed', onRoomClosed);
      socket.off('join_error', onJoinError);
      socket.off('player_joined', onPlayerJoined);
      socket.off('game_started', onGameStarted);
      socket.off('game_state', onGameState);
      clearInterval(poll);
    };
  }, []);

  const currentDeckObj = decks.find(d => d.id === selectedDeck) || sampleDecks.find(d => d.id === selectedDeck);

  const createGame = () => {
    if (!currentDeckObj) { notify('Select a deck first', 'error'); return; }
    const v = isDeckLegal(currentDeckObj);
    if (!v.legal) { notify('Deck not legal: ' + v.reasons.join(', '), 'error'); return; }
    socket.emit('create_room', { type: gameType, format: gameFormat, playerPw: playerPw || null, specPw: specPw || null, deckId: selectedDeck });
    setCreating(false);
    setPlayerPw(''); setSpecPw('');
  };

  const joinRoom = (room, asSpectator, pw) => {
    if (!asSpectator) {
      if (!currentDeckObj) { notify('Select a deck first', 'error'); return; }
      const v = isDeckLegal(currentDeckObj);
      if (!v.legal) { notify('Deck not legal: ' + v.reasons.join(', '), 'error'); return; }
    }
    if (!asSpectator && room.hasPlayerPw && !pw) { setJoinTarget({ room, asSpectator: false }); return; }
    if (asSpectator && room.hasSpecPw && !pw) { setJoinTarget({ room, asSpectator: true }); return; }
    socket.emit('join_room', { roomId: room.id, password: pw || '', asSpectator, deckId: selectedDeck });
    setJoinTarget(null); setJoinPw('');
  };

  const leaveRoom = () => {
    if (lobby) socket.emit('leave_room', { roomId: lobby.id });
    setLobby(null);
    setGameState(null);
  };

  // Intercept Escape: close lobby/game/create-modal/join-modal, or return to menu from room list
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (gameState) return; // Let GameBoard handle Escape during active game
        e.stopImmediatePropagation();
        if (joinTarget) { setJoinTarget(null); }
        else if (creating) { setCreating(false); }
        else if (lobby) { leaveRoom(); }
        else { setScreen('menu'); } // Room list → back to main menu
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [lobby, gameState, creating, joinTarget]);

  // === GAME BOARD VIEW ===
  if (gameState) {
    return <GameBoard gameState={gameState} lobby={lobby} onLeave={leaveRoom} decks={decks} sampleDecks={sampleDecks} selectedDeck={selectedDeck} setSelectedDeck={setSelectedDeck} />;
  }

  // === LOBBY VIEW ===
  if (lobby) {
    const isHost = lobby.host === user.username;
    const hasOpponent = lobby.players.length >= 2;
    return (
      <div className="screen-full">
        <div className="top-bar">
          <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: 10 }} onClick={leaveRoom}>
            {isHost ? 'CLOSE ROOM' : 'LEAVE'}
          </button>
          <h2 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)' }}>GAME LOBBY</h2>
          <span className="badge" style={{ background: lobby.type === 'ranked' ? 'rgba(255,170,0,.12)' : 'rgba(0,240,255,.12)', color: lobby.type === 'ranked' ? 'var(--accent4)' : 'var(--accent)' }}>
            {lobby.type.toUpperCase()}
          </span>
          <VolumeControl />
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="animate-in">
          <div className="panel" style={{ width: 420, textAlign: 'center' }}>
            <div className="orbit-font" style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>
              {hasOpponent ? '⚔️ READY TO BATTLE!' : '⏳ Waiting for opponent...'}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 24 }}>
              {lobby.players.map((p, i) => (
                <div key={p} style={{ textAlign: 'center' }}>
                  <div style={{ width: 64, height: 64, border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: 26 }}>
                    {i === 0 ? '👑' : '⚔️'}
                  </div>
                  <div style={{ fontWeight: 700, color: i === 0 ? 'var(--accent)' : 'var(--accent2)' }}>{p}</div>
                  <div style={{ fontSize: 10, color: 'var(--text2)' }}>{i === 0 ? 'HOST' : 'CHALLENGER'}</div>
                </div>
              ))}
              {lobby.players.length < 2 && (
                <div style={{ textAlign: 'center', opacity: .3 }}>
                  <div style={{ width: 64, height: 64, border: '2px dashed var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: 22 }}>?</div>
                  <div style={{ fontSize: 10 }}>Waiting...</div>
                </div>
              )}
            </div>
            {(lobby.spectators || []).length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 16 }}>
                👁 Spectators: {lobby.spectators.join(', ')}
              </div>
            )}
            {isHost && hasOpponent && (
              <button className="btn btn-success btn-big glow-border" style={{ marginBottom: 12 }}
                onClick={() => socket.emit('start_game', { roomId: lobby.id })}>
                🎮 START PLAYING!
              </button>
            )}
            {!isHost && lobby.players.includes(user.username) && (
              <button className="btn" style={{ fontSize: 10, marginTop: 8 }}
                onClick={() => socket.emit('swap_to_spectator', { roomId: lobby.id })}>
                SWITCH TO SPECTATOR
              </button>
            )}
            {!lobby.players.includes(user.username) && (lobby.spectators || []).includes(user.username) && lobby.players.length < 2 && lobby.status !== 'playing' && (
              <button className="btn btn-accent2" style={{ fontSize: 10, marginTop: 8 }}
                onClick={() => {
                  if (!currentDeckObj) { notify('Select a deck first', 'error'); return; }
                  const v = isDeckLegal(currentDeckObj);
                  if (!v.legal) { notify('Deck not legal: ' + v.reasons.join(', '), 'error'); return; }
                  socket.emit('swap_to_player', { roomId: lobby.id, deckId: selectedDeck });
                }}>
                ⚔ SWITCH TO PLAYER
              </button>
            )}
            {lobby.status === 'playing' && (
              <div className="orbit-font" style={{ color: 'var(--accent3)', marginTop: 12, fontSize: 14, animation: 'pulse 1.5s infinite' }}>
                🎮 GAME IN PROGRESS
              </div>
            )}
          </div>
        </div>
        {/* Player joined pop-up */}
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

  // === ROOM BROWSER ===
  const openRooms = rooms.filter(r => r.status === 'waiting' && r.playerCount < 2);
  const activeRooms = rooms.filter(r => r.status === 'playing' || r.playerCount >= 2);

  return (
    <div className="screen-full">
      <div className="top-bar">
        <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setScreen('menu')}>← BACK</button>
        <h2 className="orbit-font" style={{ fontSize: 16, color: 'var(--accent)' }}>PLAY</h2>
        <div style={{ flex: 1 }} />
        <label style={{ fontSize: 12, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          🃏 Deck:
          <select className="select" value={selectedDeck} onChange={e => {
              const id = e.target.value;
              setSelectedDeck(id);
              // Auto-save as default deck (skip sample decks)
              if (decks.some(d => d.id === id)) {
                api('/decks/' + id + '/set-default', { method: 'POST' }).then(() => {
                  setDecks(prev => prev.map(d => ({ ...d, isDefault: d.id === id })));
                }).catch(() => {});
              }
            }} style={{ fontSize: 12, minWidth: 180, padding: '4px 8px', borderColor: 'var(--accent)', color: 'var(--text)' }}>
            {decks.map(d => <option key={d.id} value={d.id}>{d.name} {isDeckLegal(d).legal ? '✓' : '✗'}{d.isDefault ? ' ★' : ''}</option>)}
            {sampleDecks.filter(d => isDeckLegal(d).legal).length > 0 && <option disabled>── Sample Decks ──</option>}
            {sampleDecks.filter(d => isDeckLegal(d).legal).map(d => <option key={d.id} value={d.id}>📋 {d.name}</option>)}
          </select>
        </label>
        <button className="btn btn-accent2" onClick={() => setCreating(true)}>+ CREATE GAME</button>
        <VolumeControl />
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }} className="animate-in">
        {/* Open Games */}
        <div style={{ flex: 1, borderRight: '1px solid var(--bg4)', display: 'flex', flexDirection: 'column' }}>
          <div className="orbit-font" style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--accent)', borderBottom: '1px solid var(--bg4)' }}>
            OPEN GAMES ({openRooms.length})
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {openRooms.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 11, padding: 20 }}>No open games. Create one!</div>}
            {openRooms.map(r => (
              <div key={r.id} className="room-card" onClick={() => joinRoom(r, false)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{r.host}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {r.format > 1 && <span className="badge" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '3px 10px', border: '1px solid rgba(255,255,255,.2)', letterSpacing: 1 }}>Bo{r.format}</span>}
                    <span className="badge" style={{ background: r.type === 'ranked' ? 'rgba(255,170,0,.18)' : 'rgba(0,240,255,.15)', color: r.type === 'ranked' ? '#ffbb33' : '#00f0ff', fontSize: 11, fontWeight: 800, padding: '3px 10px', border: r.type === 'ranked' ? '1px solid rgba(255,170,0,.35)' : '1px solid rgba(0,240,255,.3)', textTransform: 'uppercase', letterSpacing: 1 }}>
                      {r.type}
                    </span>
                    {r.format <= 1 && <span className="badge" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--text2)', fontSize: 11, padding: '3px 10px' }}>Bo1</span>}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>
                  {r.hasPlayerPw ? '🔒 Password' : '🔓 Open'} · {r.playerCount}/2 players
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* In Progress */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="orbit-font" style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--accent2)', borderBottom: '1px solid var(--bg4)' }}>
            IN PROGRESS ({activeRooms.length})
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
            {activeRooms.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 11, padding: 20 }}>No active games</div>}
            {activeRooms.map(r => (
              <div key={r.id} className="room-card" onClick={() => joinRoom(r, true)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700 }}>{r.players.join(' vs ')}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {r.format > 1 && <span className="badge" style={{ background: 'rgba(255,255,255,.1)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '3px 10px', border: '1px solid rgba(255,255,255,.2)', letterSpacing: 1 }}>Bo{r.format}</span>}
                    {r.format <= 1 && <span className="badge" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--text2)', fontSize: 11, padding: '3px 10px' }}>Bo1</span>}
                    <span className="badge" style={{ background: 'rgba(255,0,170,.12)', color: 'var(--accent2)' }}>LIVE</span>
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text2)', marginTop: 2 }}>
                  👁 {r.spectatorCount} watching · Click to spectate
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Game Modal */}
      {creating && (
        <div className="modal-overlay" onClick={() => setCreating(false)}>
          <div className="modal animate-in" onClick={e => e.stopPropagation()}>
            <h3 className="orbit-font" style={{ marginBottom: 16, color: 'var(--accent)' }}>CREATE GAME</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Game Type</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={'btn' + (gameType === 'unranked' ? ' glow-border' : '')} onClick={() => setGameType('unranked')} style={{ flex: 1 }}>UNRANKED</button>
                  <button className={'btn btn-accent2' + (gameType === 'ranked' ? ' glow-border' : '')} onClick={() => setGameType('ranked')} style={{ flex: 1 }}>RANKED</button>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Format</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className={'btn' + (gameFormat === 1 ? ' btn-format-active' : '')} onClick={() => setGameFormat(1)} style={{ flex: 1 }}>Bo1</button>
                  <button className={'btn' + (gameFormat === 3 ? ' btn-format-active' : '')} onClick={() => setGameFormat(3)} style={{ flex: 1 }}>Bo3</button>
                  <button className={'btn' + (gameFormat === 5 ? ' btn-format-active' : '')} onClick={() => setGameFormat(5)} style={{ flex: 1 }}>Bo5</button>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Player Password (optional)</div>
                <input className="input" type="text" autoComplete="off" data-1p-ignore placeholder="Leave empty for open game" value={playerPw} onChange={e => setPlayerPw(e.target.value)} />
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Spectator Password (optional)</div>
                <input className="input" type="text" autoComplete="off" data-1p-ignore placeholder="Leave empty for open spectating" value={specPw} onChange={e => setSpecPw(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setCreating(false)}>CANCEL</button>
                <button className="btn btn-success" style={{ flex: 1 }} onClick={createGame}>CREATE</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password modal */}
      {joinTarget && (
        <div className="modal-overlay" onClick={() => { setJoinTarget(null); setJoinPw(''); }}>
          <div className="modal animate-in" onClick={e => e.stopPropagation()}>
            <h3 className="orbit-font" style={{ marginBottom: 16, color: 'var(--accent)' }}>PASSWORD REQUIRED</h3>
            <input className="input" type="text" autoComplete="off" data-1p-ignore placeholder="Enter password..." value={joinPw}
              onChange={e => setJoinPw(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') joinRoom(joinTarget.room, joinTarget.asSpectator, joinPw); }}
              autoFocus />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => { setJoinTarget(null); setJoinPw(''); }}>CANCEL</button>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={() => joinRoom(joinTarget.room, joinTarget.asSpectator, joinPw)}>JOIN</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
//  APP ROOT
// ═══════════════════════════════════════════
// ═══════════════════════════════════════════
//  MUSIC MANAGER
//  Plays bgm_menu on loop outside of battle,
//  bgm_battle on loop during battle.
//  Handles browser autoplay policy by unlocking
//  audio on first user interaction.
// ═══════════════════════════════════════════

const _bgmMenu = typeof Audio !== 'undefined' ? new Audio('/music/bgm_menu.mp3') : null;
const _bgmBattle = typeof Audio !== 'undefined' ? new Audio('/music/bgm_battle.mp3') : null;
if (_bgmMenu) { _bgmMenu.loop = true; _bgmMenu.volume = 0.4; _bgmMenu.preload = 'auto'; }
if (_bgmBattle) { _bgmBattle.loop = true; _bgmBattle.volume = 0.4; _bgmBattle.preload = 'auto'; }

// Volume control bridge — VolumeControl sets this
window._ppSetMusicVolume = (vol) => {
  const cur = _bgmMenu?.paused === false ? _bgmMenu : _bgmBattle?.paused === false ? _bgmBattle : null;
  if (_bgmMenu) _bgmMenu._targetVol = vol;
  if (_bgmBattle) _bgmBattle._targetVol = vol;
  if (cur) cur.volume = vol;
};

function MusicManager({ inBattle }) {
  const unlocked = useRef(false);
  const currentTrack = useRef(null); // 'menu' | 'battle'

  const getTargetVol = useCallback(() => {
    return window._ppGetVolume ? window._ppGetVolume() : 0.4;
  }, []);

  const switchTrack = useCallback((target) => {
    if (currentTrack.current === target) return;
    const fadeOut = target === 'battle' ? _bgmMenu : _bgmBattle;
    const fadeIn = target === 'battle' ? _bgmBattle : _bgmMenu;
    if (!fadeIn) return;

    const targetVol = getTargetVol();

    // Quick crossfade
    if (fadeOut && !fadeOut.paused) {
      const fo = fadeOut;
      const origVol = fo.volume;
      let step = 0;
      const fadeInterval = setInterval(() => {
        step++;
        fo.volume = Math.max(0, origVol * (1 - step / 8));
        if (step >= 8) { clearInterval(fadeInterval); fo.pause(); fo.volume = origVol; fo.currentTime = 0; }
      }, 40);
    }

    fadeIn.volume = 0;
    fadeIn.play().then(() => {
      let step = 0;
      const fadeInterval = setInterval(() => {
        step++;
        fadeIn.volume = Math.min(targetVol, targetVol * (step / 8));
        if (step >= 8) clearInterval(fadeInterval);
      }, 40);
    }).catch(() => {
      // Autoplay still blocked — retry on next user interaction
      const retry = () => {
        fadeIn.volume = 0;
        fadeIn.play().then(() => {
          let step = 0;
          const fadeInterval = setInterval(() => {
            step++;
            fadeIn.volume = Math.min(targetVol, targetVol * (step / 8));
            if (step >= 8) clearInterval(fadeInterval);
          }, 40);
        }).catch(() => {});
        window.removeEventListener('click', retry);
      };
      window.addEventListener('click', retry, { once: true });
    });

    currentTrack.current = target;
  }, [getTargetVol]);

  // Unlock audio on first user interaction
  // Chromium/Opera require a direct user gesture to unlock each Audio element.
  // We "touch" both tracks (play → immediate pause) to unlock them, then start the real track.
  useEffect(() => {
    if (unlocked.current) return;
    const unlock = () => {
      if (unlocked.current) return;
      unlocked.current = true;
      // Touch both audio elements to unlock them in Chromium/Opera
      const touchAndUnlock = async () => {
        for (const audio of [_bgmMenu, _bgmBattle]) {
          if (!audio) continue;
          try {
            audio.volume = 0;
            await audio.play();
            audio.pause();
            audio.currentTime = 0;
          } catch {}
        }
        // Now start the real track
        switchTrack(inBattle ? 'battle' : 'menu');
      };
      touchAndUnlock();
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('click', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('touchstart', unlock);
    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, [inBattle]);

  // Switch tracks when inBattle changes
  useEffect(() => {
    if (!unlocked.current) return;
    switchTrack(inBattle ? 'battle' : 'menu');
  }, [inBattle, switchTrack]);

  return null; // No visual output
}

function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('menu');
  const [loading, setLoading] = useState(true);
  const [notif, setNotif] = useState(null);
  const [inBattle, setInBattle] = useState(false);

  const notify = useCallback((message, type) => {
    setNotif({ message, type, id: Date.now() });
  }, []);

  // Auto-login + load card DB
  useEffect(() => {
    (async () => {
      try {
        await loadCardDB();
        const data = await api('/auth/me');
        if (data.user) {
          setUser(data.user);
          window.AUTH_TOKEN = data.token || null;
          if (window.AUTH_TOKEN) socket.emit('auth', window.AUTH_TOKEN);
        }
      } catch {}
      setLoading(false);
    })();

    // Listen for game reconnection
    const onReconnectGame = (state) => {
      if (state.reconnected) {
        _pendingGameState = state;
        setScreen('play');
      }
    };
    socket.on('game_state', onReconnectGame);
    return () => socket.off('game_state', onReconnectGame);
  }, []);

  // Sync accent color to user's profile color
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', user && user.color ? user.color : '#00f0ff');
  }, [user?.color]);

  // Escape key → return to main menu from any sub-screen (except play — handled by PlayScreen/GameBoard)
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && user && screen !== 'menu' && screen !== 'play') {
        setScreen('menu');
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [screen, user]);

  if (loading) {
    return (
      <div className="screen-center">
        <div className="pixel-font" style={{ color: 'var(--accent)', animation: 'pulse 1.5s infinite', fontSize: 14 }}>LOADING...</div>
      </div>
    );
  }

  const ctx = { user, setUser, screen, setScreen, notify, inBattle, setInBattle };

  return (
    <AppContext.Provider value={ctx}>
      {/* Global portrait rotation lock — all screens need landscape */}
      <div className="rotate-device-overlay" id="rotate-overlay">
        <div className="rotate-icon">📱</div>
        <div className="rotate-text">Please rotate your device</div>
        <div className="rotate-sub">Pixel Parties requires landscape orientation for the best experience</div>
      </div>
      <MusicManager inBattle={inBattle} />
      {notif && <Notification key={notif.id} message={notif.message} type={notif.type} onClose={() => setNotif(null)} />}
      {!user ? <AuthScreen /> :
        screen === 'menu' ? <MainMenu /> :
        screen === 'play' ? <PlayScreen /> :
        screen === 'deckbuilder' ? <DeckBuilder /> :
        screen === 'shop' ? <ShopScreen /> :
        screen === 'profile' ? <ProfileScreen /> :
        <MainMenu />}
    </AppContext.Provider>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

