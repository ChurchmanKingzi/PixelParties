// ═══════════════════════════════════════════
//  PIXEL PARTIES — SCREEN COMPONENTS
//  AuthScreen, MainMenu, ProfileScreen, ShopScreen
// ═══════════════════════════════════════════
const { useState, useEffect, useRef, useCallback, useMemo, useContext } = React;
const { api, socket, AppContext, CardMini, cardImageUrl,
        typeColor, skinImageUrl } = window;
const { ALL_CARDS, CARDS_BY_NAME, AVAILABLE_CARDS, AVAILABLE_MAP, SKINS_DB } = window;

function AuthScreen() {
  const { setUser } = useContext(AppContext);
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username.trim() || !password.trim()) { setError('Fill in all fields'); return; }
    setLoading(true); setError('');
    try {
      const data = await api('/auth/' + (mode === 'login' ? 'login' : 'signup'), {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password })
      });
      window.AUTH_TOKEN = data.token;
      socket.emit('auth', data.token);
      setUser(data.user);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div className="screen-center">
      <div className="panel animate-in" style={{ width: 380, textAlign: 'center' }}>
        <h1 className="pixel-font" style={{ fontSize: 18, color: 'var(--accent)', marginBottom: 4, textShadow: '0 0 20px var(--accent)' }}>
          PIXEL PARTIES
        </h1>
        <div className="orbit-font" style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 24, letterSpacing: 2 }}>
          TRADING CARD GAME
        </div>
        <div className="tab-bar" style={{ marginBottom: 20 }}>
          <div className={'tab' + (mode === 'login' ? ' active' : '')} onClick={() => { setMode('login'); setError(''); }}>LOG IN</div>
          <div className={'tab' + (mode === 'signup' ? ' active' : '')} onClick={() => { setMode('signup'); setError(''); }}>SIGN UP</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="input" placeholder="Username" value={username}
            onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          <input className="input" type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          {error && <div style={{ color: 'var(--danger)', fontSize: 12 }}>{error}</div>}
          <button className="btn btn-big" onClick={handleSubmit} disabled={loading}>
            {loading ? '...' : mode === 'login' ? 'LOG IN' : 'SIGN UP'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  MAIN MENU
// ═══════════════════════════════════════════
function MainMenu() {
  const { user, setScreen, setUser, notify } = useContext(AppContext);
  const [puzzleOpen, setPuzzleOpen] = useState(false);
  const logout = async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch {}
    window.AUTH_TOKEN = null;
    setUser(null);
  };
  return (
    <div className="screen-center main-menu-screen" style={{ flexDirection: 'column', gap: 20, position: 'relative' }}>
      <div style={{ position: 'absolute', top: 12, right: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <button className="btn menu-logout-btn" style={{ padding: '4px 16px', fontSize: 10 }} onClick={logout}>LOGOUT</button>
        <VolumeControl />
      </div>
      <h1 className="pixel-font menu-title" style={{ fontSize: 24, color: 'var(--accent)', textShadow: '0 0 30px var(--accent)' }}>PIXEL PARTIES</h1>
      <div className="orbit-font menu-subtitle" style={{ fontSize: 12, color: 'var(--text2)', letterSpacing: 3 }}>TRADING CARD GAME</div>
      <div className="menu-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 280 }} className="animate-in menu-buttons">
          {!user.hide_tutorial && (
            <button className="btn btn-big" onClick={() => notify('Tutorial coming soon!', 'info')} style={{ fontSize: 16, borderColor: '#ff44cc', color: '#ff44cc', background: 'rgba(255,68,204,.08)' }}>📖 TUTORIAL</button>
          )}
          <button className="btn btn-big" onClick={() => setScreen('play')} style={{ fontSize: 16 }}>⚔ PLAY</button>
          <button className="btn btn-big btn-accent2" onClick={() => setScreen('deckbuilder')} style={{ fontSize: 16 }}>✦ EDIT DECK</button>
          <button className="btn btn-big" onClick={() => setScreen('shop')} style={{ fontSize: 16, borderColor: '#ffd700', color: '#ffd700', background: 'rgba(255,215,0,.08)' }}>✦ SHOP</button>
          <button className="btn btn-big btn-success" onClick={() => setScreen('profile')} style={{ fontSize: 16 }}>♛ VIEW PROFILE</button>
          <button className="btn btn-big" onClick={() => setPuzzleOpen(!puzzleOpen)} style={{ fontSize: 16, borderColor: '#ff8800', color: '#ff8800', background: 'rgba(255,136,0,.08)' }}>🧩 PUZZLE MODE {puzzleOpen ? '▲' : '▼'}</button>
          {puzzleOpen && (
            <div style={{ display: 'flex', gap: 8, marginTop: -4 }}>
              <button className="btn" onClick={() => notify('Attempt Puzzle coming soon!', 'info')} style={{ flex: 1, padding: '10px 0', fontSize: 13, borderColor: '#ff8800', color: '#ff8800', background: 'rgba(255,136,0,.06)' }}>⚡ Attempt</button>
              <button className="btn" onClick={() => setScreen('puzzle-create')} style={{ flex: 1, padding: '10px 0', fontSize: 13, borderColor: '#ff8800', color: '#ff8800', background: 'rgba(255,136,0,.06)' }}>🔧 Create</button>
            </div>
          )}
          <button className="btn btn-big" onClick={() => setScreen('rules')} style={{ fontSize: 16, borderColor: 'var(--text2)', color: 'var(--text2)', background: 'rgba(255,255,255,.03)' }}>📜 RULES</button>
        </div>
        <div className="menu-user-info">
          <span style={{ color: user.color || 'var(--accent)', fontWeight: 800, fontSize: 22 }} className="orbit-font">{user.username}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span className="badge" style={{ background: 'rgba(170,255,0,.12)', color: 'var(--accent3)', fontSize: 18, padding: '8px 16px' }}>ELO {user.elo}</span>
            <span className="badge" style={{ background: 'rgba(255,215,0,.12)', color: '#ffd700', display: 'flex', alignItems: 'center', gap: 6, fontSize: 18, padding: '8px 16px' }}>
              <img src="/data/sc.png" style={{ width: 22, height: 22, imageRendering: 'pixelated' }} /> {user.sc || 0} SC
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  PROFILE SCREEN
// ═══════════════════════════════════════════

const RANK_TIERS = [
  { name: 'BRONZE',       min: 0,    color: '#cd7f32', glow: 'rgba(205,127,50,.5)',  icon: '⬡' },
  { name: 'SILVER',       min: 1200, color: '#c0c0c0', glow: 'rgba(192,192,192,.5)', icon: '⬡' },
  { name: 'GOLD',         min: 1400, color: '#ffd700', glow: 'rgba(255,215,0,.5)',    icon: '⬡' },
  { name: 'PLATINUM',     min: 1600, color: '#a8e8f0', glow: 'rgba(168,232,240,.5)', icon: '◈' },
  { name: 'DIAMOND',      min: 1800, color: '#b9f2ff', glow: 'rgba(185,242,255,.6)', icon: '◆' },
  { name: 'MASTER',       min: 2000, color: '#ff44cc', glow: 'rgba(255,68,204,.5)',   icon: '✦' },
  { name: 'GRANDMASTER',  min: 2200, color: '#ff8800', glow: 'rgba(255,136,0,.6)',    icon: '♛' },
];

function getRank(elo) {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (elo >= RANK_TIERS[i].min) return RANK_TIERS[i];
  }
  return RANK_TIERS[0];
}

function ProfileScreen() {
  const { user, setUser, setScreen, notify } = useContext(AppContext);
  const [color, setColor] = useState(user.color || '#00f0ff');
  const [avatar, setAvatar] = useState(user.avatar);
  const [cardback, setCardback] = useState(user.cardback);
  const [bio, setBio] = useState(user.bio || '');
  const [deckStats, setDeckStats] = useState({ total: 0, legal: 0, decks: [] });
  const [saving, setSaving] = useState(false);

  // Password change
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // Sleeve gallery (was cardback gallery)
  const [showSleeveGallery, setShowSleeveGallery] = useState(false);
  const [uploadedCardbacks, setUploadedCardbacks] = useState([]);
  const [ownedSleeves, setOwnedSleeves] = useState([]);

  // Avatar gallery
  const [showAvatarGallery, setShowAvatarGallery] = useState(false);
  const [standardAvatars, setStandardAvatars] = useState([]);
  const [ownedAvatars, setOwnedAvatars] = useState([]);

  // Board gallery
  const [showBoardGallery, setShowBoardGallery] = useState(false);
  const [board, setBoard] = useState(user.board || null);
  const [ownedBoards, setOwnedBoards] = useState([]);

  // Top heroes
  const [topHeroes, setTopHeroes] = useState([]);

  // Tutorial visibility toggle
  const [hideTutorial, setHideTutorial] = useState(!!user.hide_tutorial);

  // Dirty tracking — compare against original user values
  const isDirty = color !== (user.color || '#00f0ff')
    || avatar !== user.avatar
    || cardback !== user.cardback
    || bio !== (user.bio || '');

  const rank = getRank(user.elo || 1000);
  const wins = user.wins || 0;
  const losses = user.losses || 0;
  const gamesPlayed = wins + losses;
  const winRate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0;
  const memberSince = user.created_at ? new Date(user.created_at * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short' }) : '—';

  // Next rank progress
  const nextRank = RANK_TIERS.find(r => r.min > (user.elo || 1000));
  const prevMin = rank.min;
  const nextMin = nextRank ? nextRank.min : rank.min;
  const eloProgress = nextRank ? Math.min(100, Math.round(((user.elo - prevMin) / (nextMin - prevMin)) * 100)) : 100;

  useEffect(() => {
    api('/profile/deck-stats').then(setDeckStats).catch(() => {});
    api('/profile/hero-stats').then(d => setTopHeroes(d.heroes || [])).catch(() => {});
    loadCardbackGallery();
    // Load standard avatars and owned shop items
    api('/profile/standard-avatars').then(d => setStandardAvatars(d.avatars || [])).catch(() => {});
    api('/shop/owned').then(d => {
      setOwnedAvatars(d.owned?.avatar || []);
      setOwnedSleeves(d.owned?.sleeve || []);
      setOwnedBoards(d.owned?.board || []);
    }).catch(() => {});
  }, []);

  // Intercept Escape to close gallery modals
  useEffect(() => {
    if (!showSleeveGallery && !showAvatarGallery && !showBoardGallery) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        setShowSleeveGallery(false);
        setShowAvatarGallery(false);
        setShowBoardGallery(false);
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [showSleeveGallery, showAvatarGallery, showBoardGallery]);

  // Default avatar to first available if none set
  useEffect(() => {
    if (!avatar && standardAvatars.length > 0) {
      setAvatar('/avatars/' + encodeURIComponent(standardAvatars[0]));
    }
  }, [standardAvatars]);

  const loadCardbackGallery = async () => {
    try {
      const data = await api('/profile/cardbacks');
      setUploadedCardbacks(data.cardbacks || []);
    } catch {}
  };

  const handleAvatar = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result;
      try {
        const res = await fetch('/api/profile/avatar', {
          method: 'POST', body: JSON.stringify({ avatar: dataUrl }),
          headers: { 'Content-Type': 'application/json', ...(window.AUTH_TOKEN ? { 'x-auth-token': window.AUTH_TOKEN } : {}) }
        });
        const data = await res.json();
        if (data.avatar) { setAvatar(data.avatar); setUser(u => ({ ...u, avatar: data.avatar })); notify('Avatar uploaded!', 'success'); }
      } catch (e) { notify(e.message, 'error'); }
    };
    reader.readAsDataURL(file);
  };

  const handleCardbackUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      img.onload = async () => {
        const ratio = img.width / img.height;
        const target = 750 / 1050;
        if (Math.abs(ratio - target) > 0.02) {
          notify('Cardback must have a 750×1050 ratio!', 'error');
          return;
        }
        try {
          const res = await fetch('/api/profile/cardback', {
            method: 'POST', body: JSON.stringify({ cardback: dataUrl }),
            headers: { 'Content-Type': 'application/json', ...(window.AUTH_TOKEN ? { 'x-auth-token': window.AUTH_TOKEN } : {}) }
          });
          const data = await res.json();
          if (data.cardback) {
            setUploadedCardbacks(prev => [...prev, data.cardback]);
            setCardback(data.cardback);
            setUser(u => ({ ...u, cardback: data.cardback }));
            notify('Cardback uploaded!', 'success');
          }
        } catch (err) { notify(err.message, 'error'); }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = await api('/profile', { method: 'PUT', body: JSON.stringify({ color, avatar, cardback, bio }) });
      setUser(data.user);
      notify('Profile saved!', 'success');
    } catch (e) { notify(e.message, 'error'); }
    setSaving(false);
  };

  // Quick-save a single field without touching other unsaved edits
  const quickSaveAvatar = async (newAvatar) => {
    setAvatar(newAvatar);
    setShowAvatarGallery(false);
    try {
      const data = await api('/profile', { method: 'PUT', body: JSON.stringify({
        color: user.color || '#00f0ff', avatar: newAvatar, cardback: user.cardback, bio: user.bio || ''
      })});
      setUser(data.user);
    } catch (e) { notify(e.message, 'error'); }
  };

  const quickSaveSleeve = async (newSleeve) => {
    setCardback(newSleeve);
    setShowSleeveGallery(false);
    try {
      const data = await api('/profile', { method: 'PUT', body: JSON.stringify({
        color: user.color || '#00f0ff', avatar: user.avatar, cardback: newSleeve, bio: user.bio || ''
      })});
      setUser(data.user);
    } catch (e) { notify(e.message, 'error'); }
  };

  const quickSaveBoard = async (newBoard) => {
    setBoard(newBoard);
    setShowBoardGallery(false);
    try {
      const data = await api('/profile', { method: 'PUT', body: JSON.stringify({
        color: user.color || '#00f0ff', avatar: user.avatar, cardback: user.cardback, bio: user.bio || '', board: newBoard
      })});
      setUser(data.user);
    } catch (e) { notify(e.message, 'error'); }
  };

  const changePassword = async () => {
    if (!oldPw || !newPw) { notify('Fill in all password fields', 'error'); return; }
    if (newPw !== confirmPw) { notify('New passwords do not match', 'error'); return; }
    if (newPw.length < 3) { notify('New password must be 3+ characters', 'error'); return; }
    setPwSaving(true);
    try {
      await api('/profile/password', { method: 'POST', body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }) });
      notify('Password changed!', 'success');
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } catch (e) { notify(e.message, 'error'); }
    setPwSaving(false);
  };

  const toggleTutorial = async () => {
    const newVal = !hideTutorial;
    setHideTutorial(newVal);
    try {
      const data = await api('/profile/hide-tutorial', { method: 'PUT', body: JSON.stringify({ hide_tutorial: newVal }) });
      setUser(data.user);
    } catch (e) { notify(e.message, 'error'); setHideTutorial(!newVal); }
  };

  // Build card image URL for deck wall
  const getCardImage = (cardName) => {
    if (!cardName || !AVAILABLE_MAP[cardName]) return null;
    return '/cards/' + AVAILABLE_MAP[cardName];
  };

  // Display URL for current cardback (show default if none selected)
  const displayCardback = cardback || '/cardback.png';

  return (
    <div className="screen-full" style={{ background: 'linear-gradient(180deg, #0a0a12 0%, #12101f 40%, #0a0a12 100%)' }}>
      <div className="top-bar">
        <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setScreen('menu')}>← BACK</button>
        <h2 className="orbit-font" style={{ fontSize: 16, color: 'var(--accent)' }}>PLAYER PROFILE</h2>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 10, color: 'var(--text2)' }}>Member since {memberSince}</div>
        <VolumeControl />
      </div>

      <div className="profile-layout animate-in" style={{ '--rank-color': rank.color, '--rank-glow': rank.glow }}>

        {/* ═══ LEFT COLUMN — PLAYER IDENTITY ═══ */}
        <div className="profile-identity-col">
          <div className="profile-identity-panel">

            {/* Avatar frame */}
            <div className="profile-hero-area">
              <div className="profile-avatar-frame" style={{ borderColor: rank.color, boxShadow: `0 0 20px ${rank.glow}, 0 0 40px ${rank.glow}, inset 0 0 15px ${rank.glow}`, cursor: 'pointer' }}
                onClick={() => setShowAvatarGallery(true)}>
                <div className="profile-avatar-inner">
                  {avatar
                    ? <img src={avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 56, opacity: 0.5 }}>👤</span>}
                </div>
                <div className="profile-avatar-upload-overlay">
                  <span>✎</span>
                </div>
              </div>

              {/* Rank badge */}
              <div className="profile-rank-badge" style={{ background: rank.color, color: '#000' }}>
                <span style={{ fontSize: 12 }}>{rank.icon}</span>
                <span className="orbit-font" style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>{rank.name}</span>
              </div>
            </div>

            {/* Username */}
            <div className="orbit-font" style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: 1, textShadow: `0 0 25px ${color}44`, textAlign: 'center', marginTop: 10 }}>
              {user.username}
            </div>

            {/* ELO + SC display */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="orbit-font" style={{ fontSize: 22, fontWeight: 700, color: rank.color }}>{user.elo || 1000}</span>
                <span style={{ fontSize: 12, color: 'var(--text2)' }}>ELO</span>
              </div>
              <span style={{ color: 'var(--bg4)', fontSize: 20 }}>│</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }} className="sc-icon-hover-parent">
                <div style={{ position: 'relative', cursor: 'pointer' }} className="sc-icon-wrapper">
                  <img src="/data/sc.png" style={{ width: 20, height: 20, imageRendering: 'pixelated' }} />
                  <div className="sc-icon-tooltip">
                    <img src="/data/sc.png" style={{ width: 96, height: 96, imageRendering: 'pixelated' }} />
                  </div>
                </div>
                <span className="orbit-font" style={{ fontSize: 20, fontWeight: 700, color: '#ffd700' }}>{user.sc || 0}</span>
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>SC</span>
              </div>
            </div>

            {/* ELO progress bar */}
            {nextRank && (
              <div style={{ margin: '10px 0 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text2)', marginBottom: 3 }}>
                  <span>{rank.name}</span>
                  <span>{nextRank.name} ({nextMin})</span>
                </div>
                <div className="profile-elo-bar">
                  <div className="profile-elo-fill" style={{ width: eloProgress + '%', background: `linear-gradient(90deg, ${rank.color}, ${nextRank.color})` }} />
                </div>
              </div>
            )}

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--bg4)', margin: '16px 0' }} />

            {/* Bio */}
            <div>
              <div className="profile-section-label">MOTTO</div>
              <textarea
                className="profile-bio-input"
                value={bio}
                onChange={e => setBio(e.target.value.slice(0, 200))}
                placeholder="Write something memorable..."
                rows={3}
                maxLength={200}
              />
              <div style={{ textAlign: 'right', fontSize: 9, color: 'var(--text2)', marginTop: 2 }}>{bio.length}/200</div>
            </div>

            {/* Profile Backup */}
            <div style={{ borderTop: '1px solid var(--bg4)', margin: '12px 0', paddingTop: 12 }}>
              <div className="profile-section-label">PROFILE BACKUP</div>
              {/* Export/Import buttons hidden — profile data now persists via Turso DB */}
              <div style={{ fontSize: 9, color: 'var(--text2)', marginTop: 6, textAlign: 'center' }}>
                Profile data is stored in the cloud and persists across updates.
              </div>
            </div>

            {/* Save button at bottom of identity panel */}
            <div style={{ marginTop: 'auto', paddingTop: 16 }}>
              <button className="btn btn-success" style={{ width: '100%', padding: '12px 0', fontSize: 14 }} onClick={save} disabled={saving || !isDirty}>
                {saving ? '...' : isDirty ? 'SAVE PROFILE' : 'NO CHANGES'}
              </button>
            </div>

          </div>
        </div>

        {/* ═══ RIGHT COLUMN — STATS & CUSTOMIZATION ═══ */}
        <div className="profile-right-col">

          {/* Combined: Sleeve + Battle Record + Name Color + Top Heroes */}
          <div className="profile-section profile-section-wide" style={{ flex: 'none' }}>
            <div style={{ display: 'flex', gap: 28, alignItems: 'stretch' }}>

              {/* Sleeve — large preview */}
              <div className="profile-cardback-preview profile-cardback-xl profile-cardback-clickable" onClick={() => setShowSleeveGallery(true)}>
                <img src={displayCardback} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <div className="profile-cardback-hover-overlay">CHANGE</div>
              </div>

              {/* Middle: stacked info */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, minWidth: 180 }}>

                {/* Battle Record */}
                <div style={{ paddingBottom: 14, borderBottom: '1px solid var(--bg4)' }}>
                  <div className="profile-section-label">BATTLE RECORD</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: 15 }}>{wins}</span>
                    <span style={{ fontSize: 10, color: 'var(--text2)' }}>W</span>
                    <span style={{ color: 'var(--text2)', fontSize: 10 }}>/</span>
                    <span style={{ color: 'var(--danger)', fontWeight: 700, fontSize: 15 }}>{losses}</span>
                    <span style={{ fontSize: 10, color: 'var(--text2)' }}>L</span>
                    <span style={{ color: 'var(--bg4)', margin: '0 4px' }}>│</span>
                    <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: 15 }}>{winRate}%</span>
                    <span style={{ fontSize: 10, color: 'var(--text2)' }}>Win Rate</span>
                    <span style={{ color: 'var(--bg4)', margin: '0 4px' }}>│</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{gamesPlayed}</span>
                    <span style={{ fontSize: 10, color: 'var(--text2)' }}>Games</span>
                  </div>
                </div>

                {/* Name Color */}
                <div style={{ paddingTop: 14, paddingBottom: 14, borderBottom: '1px solid var(--bg4)' }}>
                  <div className="profile-section-label">NAME COLOR</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input type="color" value={color} onChange={e => setColor(e.target.value)}
                      style={{ width: 44, height: 34, border: '1px solid var(--bg4)', cursor: 'pointer', background: 'none', padding: 0 }} />
                    <span style={{ color, fontWeight: 700, fontSize: 18 }}>{user.username}</span>
                    <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 4 }}>Preview</span>
                  </div>
                </div>

                {/* Sleeve info */}
                <div style={{ paddingTop: 14, paddingBottom: 14, borderBottom: '1px solid var(--bg4)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="profile-section-label">SLEEVE</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, flex: 1 }}>
                      {cardback ? 'Custom Sleeve' : 'Default Sleeve'}
                    </div>
                    <button className="btn" style={{ padding: '6px 16px', fontSize: 11 }}
                      onClick={() => setShowSleeveGallery(true)}>
                      CHANGE
                    </button>
                  </div>
                </div>

                {/* Board info */}
                <div style={{ paddingTop: 14, flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div className="profile-section-label">BOARD</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {board ? (
                      <div style={{ width: 80, height: 45, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--bg4)', flexShrink: 0 }}>
                        <img src={'/data/shop/boards/' + encodeURIComponent(board) + '.png'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ) : null}
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, flex: 1 }}>
                      {board ? board : 'Default Board'}
                    </div>
                    <button className="btn" style={{ padding: '6px 16px', fontSize: 11 }}
                      onClick={() => setShowBoardGallery(true)}>
                      CHANGE
                    </button>
                  </div>
                </div>

              </div>

              {/* Right: Top Heroes */}
              <div className="profile-heroes-col" style={{ borderLeft: '1px solid var(--bg4)', paddingLeft: 24, display: 'flex', flexDirection: 'column', flex: 1, minWidth: 140 }}>
                <div className="profile-section-label">TOP HEROES</div>
                {topHeroes.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ color: 'var(--text2)', fontSize: 11, textAlign: 'center', lineHeight: 1.6 }}>
                      No hero data yet.<br />Play games to track your best heroes!
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                    {topHeroes.map((h, i) => {
                      const heroImg = getCardImage(h.name);
                      const medal = ['🥇', '🥈', '🥉'][i];
                      return (
                        <div key={h.name} className="profile-top-hero">
                          <div className="profile-top-hero-rank">{medal}</div>
                          <div className="profile-top-hero-card">
                            {heroImg
                              ? <img src={heroImg} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <div style={{ width: '100%', height: '100%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--text2)' }}>?</div>
                            }
                            <div className="profile-top-hero-wr-overlay" style={{ color: h.winRate >= 50 ? 'var(--success)' : 'var(--danger)' }}>
                              {h.winRate}%
                            </div>
                          </div>
                          <div className="profile-top-hero-details" style={{ flex: 1, minWidth: 0 }}>
                            <div className="profile-top-hero-name" title={h.name}>{h.name}</div>
                            <div className="profile-top-hero-stats" style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
                              <span className="orbit-font" style={{ fontSize: 14, fontWeight: 700, color: h.winRate >= 50 ? 'var(--success)' : 'var(--danger)' }}>
                                {h.winRate}%
                              </span>
                              <span className="profile-top-hero-wl" style={{ fontSize: 9, color: 'var(--text2)' }}>
                                {h.wins}W / {h.losses}L
                              </span>
                            </div>
                            <div className="profile-top-hero-bar">
                              <div className="profile-top-hero-bar-fill" style={{ width: h.winRate + '%', background: h.winRate >= 50 ? 'var(--success)' : 'var(--danger)' }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Sleeve Gallery Modal */}
          {showSleeveGallery && (
            <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowSleeveGallery(false); }}>
              <div className="modal" style={{ maxWidth: 620, width: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                  <h3 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', flex: 1 }}>SELECT SLEEVE</h3>
                  <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setShowSleeveGallery(false)}>✕ CLOSE</button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <div className="profile-cb-gallery">
                    {/* Default sleeve */}
                    <div className={'profile-cb-gallery-item' + (!cardback ? ' active' : '')} onClick={() => quickSaveSleeve(null)}>
                      <div className="profile-cb-gallery-card">
                        <img src="/cardback.png" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <div className="profile-cb-gallery-label">Default</div>
                    </div>
                    {/* Owned shop sleeves */}
                    {ownedSleeves.map(sleeveId => (
                      <div key={sleeveId} className={'profile-cb-gallery-item' + (cardback === '/data/shop/sleeves/' + sleeveId + '.png' ? ' active' : '')}
                        onClick={() => quickSaveSleeve('/data/shop/sleeves/' + sleeveId + '.png')}>
                        <div className="profile-cb-gallery-card">
                          <img src={'/data/shop/sleeves/' + encodeURIComponent(sleeveId) + '.png'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div className="profile-cb-gallery-label">{sleeveId}</div>
                      </div>
                    ))}
                    {/* Previously uploaded cardbacks (legacy) */}
                    {uploadedCardbacks.map((cb, i) => (
                      <div key={'up' + i} className={'profile-cb-gallery-item' + (cardback === cb ? ' active' : '')} onClick={() => quickSaveSleeve(cb)}>
                        <div className="profile-cb-gallery-card">
                          <img src={cb} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div className="profile-cb-gallery-label">Custom {i + 1}</div>
                      </div>
                    ))}
                  </div>
                  {ownedSleeves.length === 0 && uploadedCardbacks.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 11, marginTop: 12 }}>
                      Visit the Shop to unlock more sleeves!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Avatar Gallery Modal */}
          {showAvatarGallery && (
            <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowAvatarGallery(false); }}>
              <div className="modal" style={{ maxWidth: 620, width: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                  <h3 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', flex: 1 }}>SELECT AVATAR</h3>
                  <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setShowAvatarGallery(false)}>✕ CLOSE</button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <div className="profile-avatar-gallery">
                    {/* Standard avatars (free) */}
                    {standardAvatars.map(file => {
                      const url = '/avatars/' + encodeURIComponent(file);
                      return (
                        <div key={file} className={'profile-avatar-gallery-item' + (avatar === url ? ' active' : '')}
                          onClick={() => quickSaveAvatar(url)}>
                          <div className="profile-avatar-gallery-img">
                            <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          <div className="profile-cb-gallery-label">{file.replace(/\.[^.]+$/, '')}</div>
                        </div>
                      );
                    })}
                    {/* Owned shop avatars */}
                    {ownedAvatars.map(avatarId => {
                      const url = '/data/shop/avatars/' + encodeURIComponent(avatarId) + '.png';
                      return (
                        <div key={avatarId} className={'profile-avatar-gallery-item' + (avatar === url ? ' active' : '')}
                          onClick={() => quickSaveAvatar(url)}>
                          <div className="profile-avatar-gallery-img">
                            <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </div>
                          <div className="profile-cb-gallery-label">{avatarId}</div>
                        </div>
                      );
                    })}
                  </div>
                  {standardAvatars.length === 0 && ownedAvatars.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 11, marginTop: 12 }}>
                      Visit the Shop to unlock more avatars!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Board Gallery Modal */}
          {showBoardGallery && (
            <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowBoardGallery(false); }}>
              <div className="modal" style={{ maxWidth: 620, width: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
                  <h3 className="orbit-font" style={{ fontSize: 14, color: 'var(--accent)', flex: 1 }}>SELECT BOARD</h3>
                  <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setShowBoardGallery(false)}>✕ CLOSE</button>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <div className="profile-cb-gallery">
                    {/* Default board */}
                    <div className={'profile-cb-gallery-item' + (!board ? ' active' : '')} onClick={() => quickSaveBoard(null)}>
                      <div className="profile-cb-gallery-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg3)' }}>
                        <span style={{ fontSize: 11, color: 'var(--text2)' }}>Default</span>
                      </div>
                      <div className="profile-cb-gallery-label">Default</div>
                    </div>
                    {/* Owned shop boards */}
                    {ownedBoards.map(boardId => (
                      <div key={boardId} className={'profile-cb-gallery-item' + (board === boardId ? ' active' : '')}
                        onClick={() => quickSaveBoard(boardId)}>
                        <div className="profile-cb-gallery-card">
                          <img src={'/data/shop/boards/' + encodeURIComponent(boardId) + '.png'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div className="profile-cb-gallery-label">{boardId}</div>
                      </div>
                    ))}
                  </div>
                  {ownedBoards.length === 0 && (
                    <div style={{ textAlign: 'center', color: 'var(--text2)', fontSize: 11, marginTop: 12 }}>
                      Visit the Shop to unlock boards!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Settings */}
          <div className="profile-section profile-section-wide">
            <div className="profile-section-label">SETTINGS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 12, color: 'var(--text)' }}>
                <div
                  onClick={toggleTutorial}
                  style={{
                    width: 40, height: 22, borderRadius: 11, background: hideTutorial ? 'var(--accent)' : 'var(--bg4)',
                    position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 2, left: hideTutorial ? 20 : 2,
                    transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.4)'
                  }} />
                </div>
                <span onClick={toggleTutorial}>Hide Tutorial from Main Menu</span>
              </label>
              <span style={{ fontSize: 9, color: 'var(--text2)' }}>Toggle off to show the tutorial button again</span>
            </div>
          </div>

          {/* Change Password */}
          <div className="profile-section profile-section-wide">
            <div className="profile-section-label">CHANGE PASSWORD</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input className="input" type="password" placeholder="Current password" value={oldPw}
                onChange={e => setOldPw(e.target.value)} style={{ flex: 1 }} />
              <input className="input" type="password" placeholder="New password" value={newPw}
                onChange={e => setNewPw(e.target.value)} style={{ flex: 1 }} />
              <input className="input" type="password" placeholder="Repeat new password" value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)} style={{ flex: 1 }}
                onKeyDown={e => e.key === 'Enter' && changePassword()} />
              <button className="btn" style={{ padding: '8px 18px', fontSize: 11, whiteSpace: 'nowrap' }}
                onClick={changePassword} disabled={pwSaving}>
                {pwSaving ? '...' : 'CHANGE'}
              </button>
            </div>
          </div>

          {/* ═══ DECK COLLECTION + WALL ═══ */}
          <div className="profile-section profile-section-wide" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div className="profile-section-label" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span>DECK COLLECTION</span>
              <div style={{ display: 'flex', gap: 12, marginLeft: 'auto', fontSize: 9, borderBottom: 'none', paddingBottom: 0, marginBottom: 0 }}>
                <span style={{ color: 'var(--text)' }}>{deckStats.total} <span style={{ color: 'var(--text2)' }}>TOTAL</span></span>
                <span style={{ color: 'var(--success)' }}>{deckStats.legal} <span style={{ color: 'var(--text2)' }}>LEGAL</span></span>
                <span style={{ color: deckStats.total - deckStats.legal > 0 ? 'var(--danger)' : 'var(--text2)' }}>
                  {deckStats.total - deckStats.legal} <span style={{ color: 'var(--text2)' }}>ILLEGAL</span>
                </span>
              </div>
            </div>
            {(deckStats.decks || []).length === 0 ? (
              <div style={{ color: 'var(--text2)', fontSize: 13, padding: '20px 0', textAlign: 'center' }}>
                No decks yet — head to the Deck Builder to create one!
              </div>
            ) : (
              <div className="profile-deck-wall">
                {(deckStats.decks || []).map(d => {
                  const img = d.repSkin ? skinImageUrl(d.repSkin) : getCardImage(d.repCard);
                  return (
                    <div key={d.id} className="profile-deck-tile" onClick={() => setScreen('deckbuilder')}>
                      <div className="profile-deck-tile-card">
                        {img
                          ? <img src={img} style={{ width: '100%', height: '100%', objectFit: 'cover' }} draggable={false} />
                          : <div style={{ width: '100%', height: '100%', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--text2)' }}>?</div>
                        }
                        {d.isDefault && <div className="profile-deck-tile-star" title="Default deck">★</div>}
                        <div className="profile-deck-tile-status" style={{ color: d.legal ? 'var(--success)' : 'var(--danger)' }}>
                          {d.legal ? '✓' : '✗'}
                        </div>
                      </div>
                      <div className="profile-deck-tile-name" title={d.name}>{d.name}</div>
                      <div className="profile-deck-tile-count">{d.cardCount}/60</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════
//  SHOP SCREEN
// ═══════════════════════════════════════════

// Purchase celebration overlay — centered on the bought item
function PurchaseCelebration({ cx, cy, onDone }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ox = cx ?? canvas.width / 2;
    const oy = cy ?? canvas.height / 2;
    const particles = [];
    const colors = ['#ffd700', '#ffaa00', '#fff8b0', '#ff00aa', '#00f0ff', '#aaff00', '#ff6600', '#ffffff'];
    const shapes = ['star', 'circle', 'diamond', 'spark'];
    // Burst from item position
    for (let i = 0; i < 120; i++) {
      const angle = (Math.PI * 2 * i / 120) + (Math.random() - 0.5) * 0.5;
      const speed = 3 + Math.random() * 9;
      particles.push({
        x: ox, y: oy,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
        size: 3 + Math.random() * 8, color: colors[Math.floor(Math.random() * colors.length)],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        life: 1, decay: 0.008 + Math.random() * 0.012,
        rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 0.2,
        gravity: 0.06 + Math.random() * 0.04,
      });
    }
    // Sparkle ring around item
    for (let i = 0; i < 40; i++) {
      const angle = (Math.PI * 2 * i / 40);
      const dist = 50 + Math.random() * 30;
      particles.push({
        x: ox + Math.cos(angle) * dist, y: oy + Math.sin(angle) * dist,
        vx: Math.cos(angle) * 1.5, vy: Math.sin(angle) * 1.5,
        size: 2 + Math.random() * 4, color: '#ffd700',
        shape: 'spark', life: 1, decay: 0.015 + Math.random() * 0.01,
        rotation: 0, rotSpeed: 0, gravity: 0,
      });
    }
    let frame;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        if (p.life <= 0) continue;
        alive = true;
        p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
        p.life -= p.decay; p.rotation += p.rotSpeed;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        const s = p.size * (0.5 + p.life * 0.5);
        if (p.shape === 'circle') {
          ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fill();
        } else if (p.shape === 'diamond') {
          ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.6, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.6, 0); ctx.closePath(); ctx.fill();
        } else if (p.shape === 'star') {
          ctx.beginPath();
          for (let j = 0; j < 5; j++) {
            const a = (j * Math.PI * 2 / 5) - Math.PI / 2;
            const r = j % 2 === 0 ? s : s * 0.4;
            j === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            const a2 = ((j + 0.5) * Math.PI * 2 / 5) - Math.PI / 2;
            ctx.lineTo(Math.cos(a2) * s * 0.4, Math.sin(a2) * s * 0.4);
          }
          ctx.closePath(); ctx.fill();
        } else {
          ctx.fillRect(-s, -1, s * 2, 2);
          ctx.fillRect(-1, -s, 2, s * 2);
        }
        ctx.restore();
      }
      if (alive) frame = requestAnimationFrame(draw);
      else onDone();
    };
    frame = requestAnimationFrame(draw);
    const timer = setTimeout(onDone, 2500);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, pointerEvents: 'none' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      <div className="shop-purchase-text" style={{ top: Math.max(40, (cy ?? window.innerHeight / 2) - 60), left: cx ?? '50%' }}>PURCHASED!</div>
    </div>
  );
}

function ShopScreen() {
  const { user, setUser, setScreen, notify } = useContext(AppContext);
  const [catalog, setCatalog] = useState(null);
  const [owned, setOwned] = useState({ avatar: [], sleeve: [], board: [], skin: [] });
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [tab, setTab] = useState('skins');
  const [skinFilter, setSkinFilter] = useState('');
  const [selected, setSelected] = useState(null); // { type, id }
  const [celebration, setCelebration] = useState(null); // { cx, cy } or null
  const [randomReveal, setRandomReveal] = useState(null); // { imgUrl, label, subtitle } or null

  useEffect(() => {
    (async () => {
      try {
        const [catData, ownData] = await Promise.all([
          api('/shop/catalog'),
          api('/shop/owned')
        ]);
        setCatalog(catData);
        setOwned(ownData.owned);
      } catch (e) { notify(e.message, 'error'); }
      setLoading(false);
    })();
  }, []);

  const toggleSelect = (type, id) => {
    setSelected(prev => (prev && prev.type === type && prev.id === id) ? null : { type, id });
  };

  // Get center coords of the clicked button's parent .shop-item
  const getItemCenter = (e) => {
    const item = e.target.closest('.shop-item') || e.target.closest('.shop-random-wrap');
    if (item) {
      const r = item.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    }
    return { cx: e.clientX, cy: e.clientY };
  };

  const buyItem = async (itemType, itemId, price, e) => {
    if (e) e.stopPropagation();
    if (buying) return;
    if ((user.sc || 0) < price) { notify('Not enough SC!', 'error'); return; }
    const pos = e ? getItemCenter(e) : { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
    setBuying(true);
    try {
      const data = await api('/shop/buy', { method: 'POST', body: JSON.stringify({ itemType, itemId }) });
      setOwned(prev => ({ ...prev, [itemType]: [...prev[itemType], itemId] }));
      setUser(u => ({ ...u, sc: data.sc }));
      setCelebration(pos);
    } catch (e) { notify(e.message, 'error'); }
    setBuying(false);
  };

  const buyRandomSkin = async (e) => {
    if (buying) return;
    const rp = catalog?.randomPrices?.skin || 5;
    if ((user.sc || 0) < rp) { notify('Not enough SC!', 'error'); return; }
    const pos = e ? getItemCenter(e) : { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
    setBuying(true);
    try {
      const data = await api('/shop/buy-random-skin', { method: 'POST' });
      setOwned(prev => ({ ...prev, skin: [...prev.skin, data.skinName] }));
      setUser(u => ({ ...u, sc: data.sc }));
      setCelebration(pos);
      setRandomReveal({
        imgUrl: '/cards/skins/' + encodeURIComponent(data.skinName) + '.png',
        label: data.skinName,
        subtitle: data.heroName
      });
    } catch (e) { notify(e.message, 'error'); }
    setBuying(false);
  };

  const buyRandom = async (itemType, e) => {
    if (buying) return;
    const rp = catalog?.randomPrices?.[itemType] || 5;
    if ((user.sc || 0) < rp) { notify('Not enough SC!', 'error'); return; }
    const pos = e ? getItemCenter(e) : { cx: window.innerWidth / 2, cy: window.innerHeight / 2 };
    setBuying(true);
    try {
      const data = await api('/shop/buy-random', { method: 'POST', body: JSON.stringify({ itemType }) });
      setOwned(prev => ({ ...prev, [itemType]: [...prev[itemType], data.itemId] }));
      setUser(u => ({ ...u, sc: data.sc }));
      setCelebration(pos);
      const subdir = itemType === 'avatar' ? 'avatars' : 'sleeves';
      setRandomReveal({
        imgUrl: '/data/shop/' + subdir + '/' + encodeURIComponent(data.itemId) + '.png',
        label: null,
        subtitle: itemType === 'avatar' ? 'New Avatar!' : 'New Sleeve!'
      });
    } catch (e) { notify(e.message, 'error'); }
    setBuying(false);
  };

  if (loading || !catalog) {
    return <div className="screen-center"><div className="pixel-font" style={{ color: 'var(--accent)', animation: 'pulse 1.5s infinite' }}>Loading shop...</div></div>;
  }

  const prices = catalog.prices || { avatar: 10, sleeve: 10, board: 10, skin: 10 };
  const randomPrices = catalog.randomPrices || { skin: 5, avatar: 5, sleeve: 5 };
  const ownedSet = {
    avatar: new Set(owned.avatar),
    sleeve: new Set(owned.sleeve),
    board: new Set(owned.board),
    skin: new Set(owned.skin),
  };

  // Gather unique hero names for skin filter
  const heroNames = [...new Set((catalog.skins || []).map(s => s.heroName))].sort();
  const filteredSkins = skinFilter
    ? (catalog.skins || []).filter(s => s.heroName === skinFilter)
    : (catalog.skins || []);

  const isSelected = (type, id) => selected && selected.type === type && selected.id === id;

  const renderItemGrid = (items, type, imgBase) => {
    if (items.length === 0) return <div className="shop-empty">No items available yet</div>;
    const unownedCount = items.filter(it => !ownedSet[type].has(it.id)).length;
    const hasRandom = type === 'avatar' || type === 'sleeve';
    return (
      <React.Fragment>
        {hasRandom && (
          <div className="shop-random-wrap">
            <button className="btn shop-random-btn" disabled={buying || unownedCount === 0 || (user.sc || 0) < (randomPrices[type] || 5)}
              onClick={(e) => buyRandom(type, e)}>
              🎲 Random {type === 'avatar' ? 'Avatar' : 'Sleeve'} — <img src="/data/sc.png" className="shop-sc-icon" /> {randomPrices[type] || 5}
            </button>
            <span className="shop-random-hint">{unownedCount > 0 ? unownedCount + ' left to collect' : 'All collected!'}</span>
          </div>
        )}
        <div className="shop-grid">
          {items.map(item => {
            const isOwned = ownedSet[type].has(item.id);
            const sel = isSelected(type, item.id);
            return (
              <div key={item.id} className={'shop-item' + (isOwned ? ' shop-owned' : '') + (sel ? ' shop-selected' : '')}
                onClick={() => toggleSelect(type, item.id)}>
                <div className="shop-item-img-wrap">
                  <img src={imgBase + encodeURIComponent(item.file)} draggable={false} />
                  {isOwned && <div className="shop-owned-badge">OWNED</div>}
                </div>
                {!isOwned && (
                  <button className="btn shop-buy-btn" disabled={buying || (user.sc || 0) < prices[type]}
                    onClick={(e) => buyItem(type, item.id, prices[type], e)}>
                    <img src="/data/sc.png" className="shop-sc-icon" /> {prices[type]}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </React.Fragment>
    );
  };

  const renderSkinGrid = () => {
    if ((catalog.skins || []).length === 0) return <div className="shop-empty">No skins available yet</div>;
    const allOwned = ownedSet.skin;
    const unownedCount = (catalog.skins || []).filter(s => !allOwned.has(s.id)).length;
    return (
      <React.Fragment>
        {/* Random Skin Button */}
        <div className="shop-random-wrap">
          <button className="btn shop-random-btn" disabled={buying || unownedCount === 0 || (user.sc || 0) < (randomPrices.skin || 5)}
            onClick={(e) => buyRandomSkin(e)}>
            🎲 Random Skin — <img src="/data/sc.png" className="shop-sc-icon" /> {randomPrices.skin || 5}
          </button>
          <span className="shop-random-hint">{unownedCount > 0 ? unownedCount + ' skin' + (unownedCount !== 1 ? 's' : '') + ' left to collect' : 'All collected!'}</span>
        </div>
        {/* Hero filter */}
        {heroNames.length > 1 && (
          <div className="shop-filter-row">
            <select className="select" value={skinFilter} onChange={e => setSkinFilter(e.target.value)} style={{ maxWidth: 260, fontSize: 11 }}>
              <option value="">All Heroes</option>
              {heroNames.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>
        )}
        <div className="shop-grid shop-grid-skins">
          {filteredSkins.map(skin => {
            const isOwned = ownedSet.skin.has(skin.id);
            const sel = isSelected('skin', skin.id);
            return (
              <div key={skin.id} className={'shop-item shop-skin-item' + (isOwned ? ' shop-owned' : ' shop-unowned-skin') + (sel ? ' shop-selected' : '')}
                onClick={() => toggleSelect('skin', skin.id)}>
                <div className="shop-item-img-wrap">
                  <img src={'/cards/skins/' + encodeURIComponent(skin.skinName) + '.png'} draggable={false}
                    className={!isOwned ? 'shop-skin-locked' : ''} />
                  {isOwned && <div className="shop-owned-badge">OWNED</div>}
                </div>
                <div className="shop-skin-name" title={skin.heroName}>{skin.skinName}</div>
                <div className="shop-item-hero">{skin.heroName}</div>
                {!isOwned && (
                  <button className="btn shop-buy-btn" disabled={buying || (user.sc || 0) < prices.skin}
                    onClick={(e) => buyItem('skin', skin.id, prices.skin, e)}>
                    <img src="/data/sc.png" className="shop-sc-icon" /> {prices.skin}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </React.Fragment>
    );
  };

  const tabs = [
    { id: 'skins', label: '🎨 Skins', count: (catalog.skins || []).length },
    { id: 'avatars', label: '👤 Avatars', count: (catalog.avatars || []).length },
    { id: 'sleeves', label: '🃏 Sleeves', count: (catalog.sleeves || []).length },
    { id: 'boards', label: '🎮 Boards', count: (catalog.boards || []).length },
  ];

  return (
    <div className="screen-full" style={{ background: 'linear-gradient(180deg, #0a0a12 0%, #12101f 40%, #0a0a12 100%)' }}>
      {celebration && <PurchaseCelebration cx={celebration.cx} cy={celebration.cy} onDone={() => setCelebration(null)} />}
      {randomReveal && (
        <div className="modal-overlay" style={{ zIndex: 90000 }} onClick={() => setRandomReveal(null)}>
          <div className="shop-reveal-modal animate-in" onClick={e => e.stopPropagation()}>
            <div className="shop-reveal-glow" />
            <div className="shop-reveal-img-wrap">
              <img src={randomReveal.imgUrl} draggable={false} />
            </div>
            {randomReveal.label && <div className="shop-reveal-label">{randomReveal.label}</div>}
            {randomReveal.subtitle && <div className="shop-reveal-subtitle">{randomReveal.subtitle}</div>}
            <button className="btn" style={{ marginTop: 16, padding: '8px 32px', fontSize: 13, borderColor: '#ffd700', color: '#ffd700' }}
              onClick={() => setRandomReveal(null)}>NICE!</button>
          </div>
        </div>
      )}
      <div className="top-bar">
        <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setScreen('menu')}>← BACK</button>
        <h2 className="orbit-font" style={{ fontSize: 16, color: '#ffd700' }}>SHOP</h2>
        <div style={{ flex: 1 }} />
        <div className="badge" style={{ background: 'rgba(255,215,0,.12)', color: '#ffd700', display: 'flex', alignItems: 'center', gap: 6, fontSize: 18, padding: '6px 14px' }}>
          <img src="/data/sc.png" style={{ width: 22, height: 22, imageRendering: 'pixelated' }} /> {user.sc || 0} SC
        </div>
        <VolumeControl />
      </div>
      <div className="shop-tabs">
        {tabs.map(t => (
          <button key={t.id} className={'shop-tab' + (tab === t.id ? ' shop-tab-active' : '')} onClick={() => setTab(t.id)}>
            {t.label} <span className="shop-tab-count">{t.count}</span>
          </button>
        ))}
      </div>
      <div className="shop-content animate-in">
        {tab === 'skins' && renderSkinGrid()}
        {tab === 'avatars' && renderItemGrid(catalog.avatars || [], 'avatar', '/data/shop/avatars/')}
        {tab === 'sleeves' && renderItemGrid(catalog.sleeves || [], 'sleeve', '/data/shop/sleeves/')}
        {tab === 'boards' && renderItemGrid(catalog.boards || [], 'board', '/data/shop/boards/')}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════
//  DECK BUILDER
// ═══════════════════════════════════════════
//  RULES SCREEN
// ═══════════════════════════════════════════

const RULES_SECTIONS = [
  { id: 'overview',      label: 'How to Play' },
  { id: 'heroes',        label: 'Heroes' },
  { id: 'abilities',     label: 'Abilities' },
  { id: 'attacks-spells', label: 'Attacks, Spells & Creatures' },
  { id: 'spell-schools', label: 'Spell Schools' },
  { id: 'artifacts',     label: 'Artifacts' },
  { id: 'potions',       label: 'Potions' },
  { id: 'ascended',      label: 'Ascended Heroes' },
  { id: 'actions',       label: 'Actions' },
  { id: 'board',         label: 'The Game Board' },
  { id: 'first-turn',    label: 'First Turn Restrictions' },
  { id: 'turn',          label: 'Course of a Turn' },
  { id: 'status',        label: 'Status Effects' },
  { id: 'deckbuilding',  label: 'Deck Construction' },
];

function RulesScreen() {
  const { setScreen } = useContext(AppContext);
  const contentRef = useRef(null);
  const [activeSection, setActiveSection] = useState('overview');

  const scrollTo = (id) => {
    const el = document.getElementById('rules-' + id);
    if (el && contentRef.current) {
      contentRef.current.scrollTo({ top: el.offsetTop - contentRef.current.offsetTop - 16, behavior: 'smooth' });
    }
  };

  // Track active section on scroll
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    const onScroll = () => {
      const scrollTop = container.scrollTop + container.offsetTop + 40;
      let current = RULES_SECTIONS[0].id;
      for (const s of RULES_SECTIONS) {
        const el = document.getElementById('rules-' + s.id);
        if (el && el.offsetTop <= scrollTop) current = s.id;
      }
      setActiveSection(current);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  // Escape → back to menu
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') { e.stopImmediatePropagation(); setScreen('menu'); }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, []);

  const Img = ({ src, alt, className, style }) => (
    <img src={'/rules/' + src} alt={alt || ''} className={'rules-img ' + (className || '')} style={style} draggable={false} />
  );

  const SectionTitle = ({ id, children }) => (
    <h2 id={'rules-' + id} className="rules-section-title orbit-font">{children}</h2>
  );

  const SubTitle = ({ children }) => (
    <h3 className="rules-sub-title orbit-font">{children}</h3>
  );

  const IconRow = ({ icons }) => (
    <div className="rules-icon-row">
      {icons.map(ic => (
        <div key={ic.src} className="rules-icon-item">
          <img src={'/rules/' + ic.src} alt={ic.label} className="rules-icon-img" draggable={false} />
          <span className="rules-icon-label">{ic.label}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="screen-full" style={{ background: 'linear-gradient(180deg, #0a0a12 0%, #10101d 40%, #0a0a12 100%)' }}>
      <div className="top-bar">
        <button className="btn" style={{ padding: '4px 12px', fontSize: 10 }} onClick={() => setScreen('menu')}>← BACK</button>
        <h2 className="orbit-font" style={{ fontSize: 16, color: 'var(--accent)' }}>📜 RULES</h2>
        <div style={{ flex: 1 }} />
        <VolumeControl />
      </div>

      <div className="rules-layout animate-in">
        {/* ═══ SIDEBAR NAV ═══ */}
        <nav className="rules-sidebar">
          {RULES_SECTIONS.map(s => (
            <button
              key={s.id}
              className={'rules-nav-item' + (activeSection === s.id ? ' active' : '')}
              onClick={() => scrollTo(s.id)}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* ═══ CONTENT ═══ */}
        <div className="rules-content" ref={contentRef}>

          {/* ── HOW TO PLAY ── */}
          <SectionTitle id="overview">How to Play</SectionTitle>
          <div className="rules-card-row">
            <Img src="monia.png" alt="Monia" className="rules-card-img rules-card-img-sm" />
            <div className="rules-text-block" style={{ flex: 1 }}>
              <p>In Pixel Parties, players assemble <strong>Parties of three Heroes</strong> each and try to make them the greatest Heroes in the world — by beating up the opponent's Party and asserting dominance!</p>
              <p><strong>Whoever defeats all enemy Heroes first wins!</strong></p>
              <p>You'll build up your Heroes over the course of the game by giving them Abilities, hurl Attacks and Spells to take out enemy Heroes one by one, and summon Creatures to do the dirty work. You'll also get to utilize a variety of helpful Artifacts and volatile Potions to support your strategy and be the last Party standing.</p>
              <p className="rules-flavor" style={{ color: 'var(--accent)' }}>Do you have what it takes to form the strongest Party ever?!</p>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── HEROES ── */}
          <SectionTitle id="heroes"><span style={{ color: '#aa44ff' }}>Heroes</span></SectionTitle>
          <div className="rules-card-row">
            <Img src="hero.png" alt="Hero card example" className="rules-card-img" />
            <div className="rules-text-block">
              <p>Heroes are the backbone of your strategy! You start the game with three different ones and have to defeat all enemy Heroes to win.</p>
              <p>Your deck may contain Hero cards, but you can never play new Heroes from your hand to bolster your party!</p>
              <p>Each Hero brings a unique effect, two Starting Abilities, and its own stats to the table, so there's a lot to consider when choosing your perfect Party!</p>
              <h3 className="rules-sub-title orbit-font" style={{ color: '#4488ff' }}>Starting Abilities</h3>
              <p>The two Ability cards specified here are attached to that Hero before the start of the game. They do not come from or count as part of your main deck.</p>
              <h3 className="rules-sub-title orbit-font" style={{ color: '#ff3366' }}>HP</h3>
              <p>If a Hero's HP drops to 0, it is defeated and grayed out on the board. Its Abilities stay attached to it, and there are ways to revive it, so it is not removed from the board.</p>
              <h3 className="rules-sub-title orbit-font" style={{ color: '#c0c0c0' }}>Attack</h3>
              <p>A Hero's Attack stat is used to determine the damage it deals with Attack cards. Heroes do <strong>NOT</strong> have the inherent ability to attack targets — an Attack card is always necessary!</p>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── ABILITIES ── */}
          <SectionTitle id="abilities"><span style={{ color: '#4488ff' }}>Abilities</span></SectionTitle>
          <div className="rules-card-row">
            <Img src="ability.png" alt="Ability card example" className="rules-card-img" />
            <div className="rules-text-block">
              <p>Abilities are attached to Heroes to empower them. They can grant Heroes new actions, provide passive bonuses, or give you powerful effects to activate once per turn.</p>
              <p>Each Hero has <strong>three Ability Zones</strong> and can thus have up to three different Abilities attached to it. Additionally, copies of the same Ability on the same Hero are stacked on top of each other in the same Ability Zone, leveling that Ability up. All in all, a Hero can have up to <strong>9 Ability cards</strong> attached to it!</p>
              <p>A player can only attach <strong>one Ability to each of their Heroes every turn</strong>, and Abilities can be used the turn they are attached.</p>
              <p>When a Hero is defeated, its Abilities stay attached to it. They remain on the board, but are <strong>negated</strong> and cannot be activated in any way until that Hero is revived.</p>
              <h3 className="rules-sub-title orbit-font" style={{ color: '#4488ff' }}>Effects per Level</h3>
              <p>What effect an Ability provides depends on its level, meaning the number of copies attached to that Hero. At one copy (level 1), the top effect applies. At two copies (level 2), it's the middle effect, and at three copies (level 3), it's the bottom.</p>
              <p>If an Ability has a once per turn effect that you can choose to activate during your turn, you can only activate that effect <strong>once during that turn</strong>, even if multiple Heroes have it!</p>
              <p className="rules-callout">You can not choose to use an Ability at a lower level than it has!</p>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── ATTACKS & SPELLS ── */}
          <SectionTitle id="attacks-spells"><span style={{ color: '#ff3366' }}>Attacks, Spells and Creatures</span></SectionTitle>
          <div className="rules-card-row">
            <Img src="spell.png" alt="Spell card example" className="rules-card-img" />
            <div className="rules-text-block">
              <p>Attacks, Spells and Creatures are the main way you will advance the board state. Dealing damage, applying negative status effects, summoning Creatures, but also healing HP, removing status effects or drawing cards — anything can be done by the right Attacks, Spells and Creatures!</p>
              <p>You can only play an Attack, Spell or Creature as long as you control a Hero that is able to perform it. Attacks, Spells and Creatures have a <strong>Level</strong> and an <strong>Ability</strong> associated with them. This is called its Spell School.</p>
              <p>For a Hero to be able to use an Attack/Spell/Creature, it must have the associated Ability at the card's Level or higher.</p>
              <p>When played, an Attack, Spell or Creature's effect is resolved immediately, unless stated otherwise.</p>
            </div>
          </div>

          <h3 className="rules-sub-title orbit-font" style={{ color: '#ff3366' }}>Sub-Types</h3>
          <p style={{ marginBottom: 12, fontSize: 17, lineHeight: 1.7 }}>There are 5 total Sub-Types of Attacks, Spells and Creatures. If a card has no icon at the bottom left, it is a "Normal" type — resolved when played and sent to the discard pile.</p>

          <div className="rules-subtype-grid">
            <div className="rules-subtype-entry">
              <div className="rules-school-header" style={{ color: '#ff3366' }}><img src="/rules/icon-attach.png" className="rules-school-icon" /> <span>Attachments</span></div>
              <p>Attachments are not sent to the discard pile after use, instead getting attached to a target. Unless stated otherwise, an Attachment can be attached to any Hero, but some specify they can only go to one of your Heroes, an opponent's Hero, or just the user itself. When a Hero is defeated, any Attachments on it are sent to the discard pile.</p>
            </div>
            <div className="rules-subtype-entry">
              <div className="rules-school-header" style={{ color: '#ff3366' }}><img src="/rules/icon-instant.png" className="rules-school-icon" /> <span>Reactions</span></div>
              <p>Like Normal cards, Reactions go to the discard pile after resolving. The difference is that they can only be used in reaction to specific triggers. Reactions will always specify when they can be used — they are the <strong>only sub-type that can be played from your hand during an opponent's turn</strong>.</p>
            </div>
            <div className="rules-subtype-entry">
              <div className="rules-school-header" style={{ color: '#ff3366' }}><img src="/rules/icon-trap.png" className="rules-school-icon" /> <span>Surprises</span></div>
              <p>Surprises are prepared face-down on your side of the board during your turn and then activated once a specific condition is met by flipping them face-up.</p>
              <p>To prepare a Surprise, place it face-down into a Hero's Surprise Zone during your turn. Once prepared, you can activate it at any time — during either player's turn — as long as its condition is met and the preparing Hero is able to activate it.</p>
              <p>To activate a Surprise, the preparing Hero must have the Abilities necessary to activate it and cannot be defeated or otherwise unable to perform an Action (for example by being Stunned). On the other hand, you <strong>can</strong> prepare Surprises with a Hero, even if it does not have the Abilities necessary to activate them.</p>
              <p>After activation, a Surprise resolves and is then sent to the discard pile.</p>
            </div>
            <div className="rules-subtype-entry">
              <div className="rules-school-header" style={{ color: '#ff3366' }}><img src="/rules/icon-area.png" className="rules-school-icon" /> <span>Areas</span></div>
              <p>Areas provide global effects that either affect both players or that both players can activate. Each player has one Zone for an Area. The Area Zone is not directly associated with a Hero — you may play an Area with any of your Heroes (but you still need at least one Hero able to use it).</p>
              <p>Areas remain in play until they are removed by an effect. You cannot play an Area while you already control an Area.</p>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── SPELL SCHOOLS ── */}
          <SectionTitle id="spell-schools">Types of Attacks/Spells</SectionTitle>

          <div className="rules-schools-grid">
            <div className="rules-school-entry">
              <div className="rules-school-header" style={{ color: '#c0c0c0' }}><img src="/rules/icon-sword.png" className="rules-school-icon" /> <span>Attacks (Fighting)</span></div>
              <p>Attacks are the only type that isn't a Spell School. They specialize in dealing scaling damage, being the only card type that uses a Hero's Attack stat to determine its damage. As such, Attack-based strategies will excel in picking off individual targets.</p>
              <p>Attacks can also have a wide variety of secondary utility effects. The distinction between Attacks, Spells and Creatures is important, because many effects interact with specifically one or the other.</p>
            </div>
            <div className="rules-school-entry">
              <div className="rules-school-header" style={{ color: '#ff3366' }}><img src="/rules/icon-destruction.png" className="rules-school-icon" /> <span>Destruction Spells</span></div>
              <p>Destruction Spells deal a ton of damage. They often have downsides, such as dealing recoil damage to your own Heroes, giving your opponent ways to counteract the damage, or having conditions a target must fulfill before it takes damage. Where Attacks excel at quickly taking out individual targets, Destruction Spells have by far the best <strong>spread damage</strong> options in the game.</p>
            </div>
            <div className="rules-school-entry">
              <div className="rules-school-header" style={{ color: '#aa44ff' }}><img src="/rules/icon-decay.png" className="rules-school-icon" /> <span>Decay Spells</span></div>
              <p>Decay Spells make life harder for your opponent. Denying resources, applying debuffs, or inflicting status effects. Decks revolving around them will often rely on Poison and Burn to slowly melt away the opponent's HP over time. Decay Magic also has the best <strong>negation Spells</strong> in the game. It's a slower, more control-focused playstyle.</p>
            </div>
            <div className="rules-school-entry">
              <div className="rules-school-header" style={{ color: '#ffdd44' }}><img src="/rules/icon-support.png" className="rules-school-icon" /> <span>Support Spells</span></div>
              <p>Support Spells excel in healing and buffing your own Heroes. They keep your Heroes alive, make them stronger, generate resources, and may hinder your opponent. Support Spells are particularly good at doing a lot of things in one turn, facilitating a more <strong>combo-oriented</strong> playstyle.</p>
            </div>
            <div className="rules-school-entry">
              <div className="rules-school-header" style={{ color: '#4488ff' }}><img src="/rules/icon-arts.png" className="rules-school-icon" /> <span>Magic Arts Spells</span></div>
              <p>Magic Arts Spells focus on "changing the rules." Applying buffs or debuffs that affect players themselves, searching cards from the deck, generating resources, extending turns, and situational negation. Unlike other Spell Schools, Magic Arts is not meant to be played by itself — it's an <strong>auxiliary</strong> Spell School.</p>
            </div>
            <div className="rules-school-entry rules-school-entry-wide">
              <div className="rules-school-header" style={{ color: '#44cc44' }}><img src="/rules/icon-summoning.png" className="rules-school-icon" /> <span>Summoning Spells and Creatures</span></div>
              <div className="rules-card-row" style={{ marginTop: 10 }}>
                <Img src="creature.png" alt="Creature card example" className="rules-card-img rules-card-img-sm" />
                <div>
                  <p>Summoning Spells are all about bringing out, using, and protecting Creatures, a separate card type aside from Attacks and Spells.</p>
                  <p>Creatures, once summoned, go into a Support Zone of the Hero that summoned them and remain there until they are defeated. A Creature is defeated when its HP is reduced to 0. Even if a Hero is defeated, its Creatures survive by themselves! Creatures also don't care if their corresponding Hero is Frozen, Stunned or otherwise incapacitated.</p>
                  <p>Creatures have effects that can either be active or passive. Passive effects are always in effect. Active effects can be triggered manually on your turn. They usually start with "Once per turn" (or "Up to X times per turn").</p>
                  <p className="rules-callout">A Creature cannot activate its active effect the turn it's summoned.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── ARTIFACTS ── */}
          <SectionTitle id="artifacts"><span style={{ color: '#ffd700' }}>Artifacts</span></SectionTitle>
          <div className="rules-card-row">
            <Img src="artifact.png" alt="Artifact card example" className="rules-card-img" />
            <div className="rules-text-block">
              <p>Artifacts, unlike Abilities or Attacks/Spells/Creatures, do not necessarily revolve around a Hero and don't need a Hero to be played. These are your general utility cards that extend your options each turn, but can also be very specific and require certain strategies to be used.</p>
              <p>They can have the same sub-types as Attacks, Spells and Creatures (except that Attachment Artifacts are called <strong>Equipments</strong> and you equip Artifacts rather than attach them), and they have a <strong>Cost</strong>.</p>
              <p>At the start of each turn, the turn player generates <strong>Gold</strong>. This Gold is used to pay for the use of Artifacts, meaning you can't play an infinite amount of them.</p>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── POTIONS ── */}
          <SectionTitle id="potions"><span style={{ color: '#a0724a' }}>Potions</span></SectionTitle>
          <div className="rules-card-row">
            <Img src="potion.png" alt="Potion card example" className="rules-card-img" />
            <div className="rules-text-block">
              <p>Potions function a lot like Artifacts, except that they have <strong>no Gold Cost</strong>. You just play them from your hand to get their effect!</p>
              <p>However, they have two key differences. First, they are <strong>deleted</strong> (removed from the game) after resolving instead of going to the discard pile. Thus, they can never be reused.</p>
              <p>Second, they start the game in a separate deck, the dedicated <strong>Potion Deck</strong>, and you can only draw them through card effects. This makes them a lot harder to access than other cards, but they are also on average a lot more powerful!</p>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── ASCENDED HEROES ── */}
          <SectionTitle id="ascended"><span style={{ color: '#aa44ff' }}>Ascended Heroes</span></SectionTitle>
          <div className="rules-card-row">
            <Img src="ascended.png" alt="Ascended Hero card example" className="rules-card-img" />
            <div className="rules-text-block">
              <p>Ascended Heroes are special, more powerful versions of Heroes. You play them in your deck and place them on top of a Hero to Ascend it once a certain condition has been fulfilled.</p>
              <p className="rules-callout">Ascending a Hero immediately ends your turn!</p>
              <p>When a Hero Ascends, it gains new stats, but keeps any damage it already had as well as status effects and any other effects that affected it.</p>
              <h3 className="rules-sub-title orbit-font" style={{ color: '#aa44ff' }}>Ascension Bonus</h3>
              <p>When a Hero Ascends, its Ascension Bonus is applied. If the bonus specifies Abilities, you may attach them from your hand, deck, or discard pile to the Ascended Hero immediately. You may choose to attach fewer copies than specified. Other Ascension Bonuses apply a different effect instead.</p>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── ACTIONS ── */}
          <SectionTitle id="actions"><span style={{ color: '#ff3366' }}>Actions</span></SectionTitle>
          <div className="rules-text-block">
            <p>Besides Gold, which you passively generate every turn and spend on Artifacts, <strong>Actions</strong> are the other important resource in Pixel Parties. You get a <strong>single Action</strong> every turn, and Attacks, Spells and Creatures cost an Action to use.</p>
            <p style={{ color: '#ff3366', fontWeight: 700, fontStyle: 'italic' }}>Wait, so you can only use a single Attack/Spell/Creature per turn to advance the game?</p>
            <p>Not exactly. <strong>Reactions</strong> and <strong>Surprises</strong> do not cost Actions to use. Additionally, there are Attacks, Spells and Creatures that can count as <strong>additional Actions</strong>, either inherently or if you fulfill specific conditions. Additional Actions do not consume your Action per turn.</p>
            <p>On the other hand, there are also effects on Abilities, Artifacts, and other cards that can cost an Action to activate. If you choose to spend your Action on such an effect, that means you cannot use an Attack/Spell/Creature that turn, unless it's an additional Action, a Reaction, or a Surprise.</p>
            <p>When a Creature is "placed" into a Support Zone, that always means that it is summoned without costing an Action and without requiring a Hero to actually be able to summon it.</p>
          </div>

          <div className="rules-divider" />

          {/* ── THE GAME BOARD ── */}
          <SectionTitle id="board">The Game Board</SectionTitle>
          <div className="rules-text-block">
            <p>Pixel Parties has a very rigid game board. Both players have 3 Heroes, which each have 3 Zones for Abilities (Ability Zones) and 3 Zones for Equipments, Attachments and Creatures (Support Zones). A Hero can only summon Creatures into its own Support Zones, so the amount of Creatures a Hero can control at a time is limited to 3!</p>
          </div>
          <Img src="board.png" alt="The game board" className="rules-board-img" />
          <div className="rules-board-legend">
            <div className="rules-legend-item"><span className="rules-legend-num">1</span> <strong>Hero Zones.</strong> Each player has 3 and starts with a Hero in each. Defeated Heroes remain on the board grayed-out and can be revived later.</div>
            <div className="rules-legend-item"><span className="rules-legend-num">2</span> <strong>Ability Zones.</strong> Each Hero has 3 — so Heroes can have up to 3 different Abilities, each levelable up to 3.</div>
            <div className="rules-legend-item"><span className="rules-legend-num">3</span> <strong>Support Zones.</strong> Equipment/Attachment cards and Creatures go here. If all Support Zones of a Hero are full, no more Equipments, Attachments, or Creatures can be added to that Hero.</div>
            <div className="rules-legend-item"><span className="rules-legend-num">4</span> <strong>Surprise Zones.</strong> Each Hero has only 1 — it can only have 1 Surprise prepared at a time. Surprises cannot be moved between Heroes once placed. You must either activate it or remove it with an effect to free the Zone.</div>
            <div className="rules-legend-item"><span className="rules-legend-num">5</span> <strong>Deck Zone.</strong> Your deck goes here.</div>
            <div className="rules-legend-item"><span className="rules-legend-num">6</span> <strong>Potion Deck Zone.</strong> Your Potion Deck goes here (if you have one).</div>
            <div className="rules-legend-item"><span className="rules-legend-num">7</span> <strong>Discard Pile.</strong> Your discard pile.</div>
            <div className="rules-legend-item"><span className="rules-legend-num">8</span> <strong>Delete Zone.</strong> The zone for your deleted (expelled/removed) cards.</div>
            <div className="rules-legend-item"><span className="rules-legend-num">9</span> <strong>Area Zones.</strong> Zones for your and your opponent's Areas. Each player can only use 1 of those 2 zones.</div>
          </div>

          <div className="rules-divider" />

          {/* ── FIRST TURN RESTRICTIONS ── */}
          <SectionTitle id="first-turn">First Turn Restrictions</SectionTitle>
          <div className="rules-text-block">
            <p>Player 1 has several restrictions on their first turn. They cannot:</p>
            <div className="rules-restriction-list">
              <div className="rules-restriction-item">Deal damage to enemy targets</div>
              <div className="rules-restriction-item">Inflict status effects to enemy targets</div>
              <div className="rules-restriction-item">Activate effects that would defeat enemy targets</div>
              <div className="rules-restriction-item">Take control of enemy targets</div>
              <div className="rules-restriction-item">Force their opponent to discard, delete, or shuffle away cards from their hand</div>
              <div className="rules-restriction-item">Look at their opponent's hand</div>
              <div className="rules-restriction-item">Send cards from the opponent's deck to the discard pile or delete them</div>
              <div className="rules-restriction-item">Equip or attach cards to an opponent's Hero</div>
              <div className="rules-restriction-item">Give your opponent cards to their hand, deck or any other area</div>
              <div className="rules-restriction-item">Choose any target your opponent controls with any card or effect</div>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── COURSE OF A TURN ── */}
          <SectionTitle id="turn">The Course of a Turn</SectionTitle>
          <div className="rules-text-block">
            <p>A player's turn is divided into the following Phases:</p>
          </div>

          <div className="rules-phases">
            <div className="rules-phase">
              <div className="rules-phase-header">
                <span className="rules-phase-num">1</span>
                <span className="rules-phase-name orbit-font">Start Phase</span>
              </div>
              <p>The turn begins. Effects that last "until the beginning of the turn" end and effects that trigger "at the beginning of the turn" activate. The turn player freely decides the order in which effects trigger/end.</p>
            </div>

            <div className="rules-phase">
              <div className="rules-phase-header">
                <span className="rules-phase-num">2</span>
                <span className="rules-phase-name orbit-font">Resource Phase</span>
              </div>
              <p>The turn player draws <strong>1 card</strong> and gains <strong>4 Gold</strong>. Some effects will increase this Gold gain.</p>
            </div>

            <div className="rules-phase">
              <div className="rules-phase-header">
                <span className="rules-phase-num">3</span>
                <span className="rules-phase-name orbit-font">Main Phase 1</span>
              </div>
              <p>The main part of the turn. The turn player may, in any order:</p>
              <div className="rules-restriction-list">
                <div className="rules-restriction-item rules-phase-action">Attach up to 1 Ability from their hand to each of their Heroes.</div>
                <div className="rules-restriction-item rules-phase-action">Play any number of Artifacts from their hand, as long as they can pay their Costs.</div>
                <div className="rules-restriction-item rules-phase-action">Play any number of Potions from their hand.</div>
                <div className="rules-restriction-item rules-phase-action">Activate the active effects of any number of cards they control (Heroes, Abilities, Creatures, Equipments, Attachments).</div>
                <div className="rules-restriction-item rules-phase-action">Play Attacks/Spells/Creatures that "count as an additional Action", including Reactions that are not limited to react to specific actions.</div>
                <div className="rules-restriction-item rules-phase-action">Set as many Surprises as they have free Zones to do so.</div>
              </div>
            </div>

            <div className="rules-phase">
              <div className="rules-phase-header">
                <span className="rules-phase-num">4</span>
                <span className="rules-phase-name orbit-font">Action Phase</span>
              </div>
              <p>The turn player may perform a <strong>single Action</strong>. This is usually done by playing an Attack, Spell, or Creature, but there are also effects that require an Action as a cost. After performing a single Action, the Action Phase immediately ends.</p>
            </div>

            <div className="rules-phase">
              <div className="rules-phase-header">
                <span className="rules-phase-num">5</span>
                <span className="rules-phase-name orbit-font">Main Phase 2</span>
              </div>
              <p>You may do the same things as in Main Phase 1. If you already attached an Ability to a Hero during Main Phase 1, you cannot attach another one to the same Hero during Main Phase 2.</p>
              <p className="rules-callout" style={{ marginTop: 8 }}>You can only enter Main Phase 2 by performing an Action.</p>
            </div>

            <div className="rules-phase">
              <div className="rules-phase-header">
                <span className="rules-phase-num">6</span>
                <span className="rules-phase-name orbit-font">End Phase</span>
              </div>
              <p>The turn ends. Effects that last "until the end of the turn" end and effects that trigger "at the end of the turn" trigger.</p>
              <p>At the very end of the End Phase, if the turn player has more than <strong>7 cards</strong> in their hand, they must discard cards from their hand until they have 7 cards left.</p>
            </div>
          </div>

          <div className="rules-divider" />

          {/* ── STATUS EFFECTS ── */}
          <SectionTitle id="status">Status Effects</SectionTitle>
          <div className="rules-text-block">
            <p>A target can be affected by any number of status effects at a time. Some cards inflict unique special conditions that "count as status effects", while others inflict the following "standard" status effects:</p>
          </div>

          <div className="rules-status-grid">
            <div className="rules-status-entry rules-status-stunned">
              <div className="rules-status-name">Stunned</div>
              <p>The target cannot perform Actions. Its effects and Abilities (if it is a Hero) are negated.</p>
            </div>
            <div className="rules-status-entry rules-status-frozen">
              <div className="rules-status-name">Frozen</div>
              <p>The target cannot perform Actions. Its effects and Abilities (if it is a Hero) are negated. Additionally, it cannot be equipped with Artifacts.</p>
            </div>
            <div className="rules-status-entry rules-status-blinded">
              <div className="rules-status-name">Blinded</div>
              <p>The target cannot choose anything the opponent controls as a target for Attacks, Spells, or effects.</p>
            </div>
            <div className="rules-status-entry rules-status-poisoned">
              <div className="rules-status-name">Poisoned</div>
              <p>The target takes 30 damage during each of its owner's Start Phases. Poisoning effects usually revolve around stacking multiple instances, increasing its damage.</p>
            </div>
            <div className="rules-status-entry rules-status-burned">
              <div className="rules-status-name">Burned</div>
              <p>The target takes 60 damage during each of its owner's Start Phases.</p>
            </div>
            <div className="rules-status-entry rules-status-bleeding">
              <div className="rules-status-name">Bleeding</div>
              <p>The target takes 50 damage whenever it performs an Action, activates its active effect or activates the active effect of one of its Abilities.</p>
            </div>
          </div>

          <div className="rules-callout" style={{ marginTop: 16 }}>
            After recovering from a Freeze, Stun, Blind or any other status effect that includes negating a target's effect or preventing it from performing Actions, that target becomes completely <strong>immune</strong> to the opponent's incapacitating effects for 1 turn (until the beginning of its owner's next turn)!
          </div>

          <div className="rules-divider" />

          {/* ── DECK CONSTRUCTION ── */}
          <SectionTitle id="deckbuilding">Deck Construction</SectionTitle>
          <div className="rules-text-block">
            <p>Decks consist of <strong>60 cards</strong>, not including your 3 Heroes and their Starting Abilities, so you bring <strong>69 cards total</strong>.</p>
            <p>If you play a Potion Deck, that has to contain <strong>5–15 cards</strong>.</p>
            <p>Your Hero lineup has to consist of 3 <strong>DIFFERENT</strong> Heroes. Alternate versions of a Hero with the same name (such as "Cool Rescuer Monia" and "Cool Birthday Girl Monia") still count as the same Hero for this!</p>

            <div className="rules-deck-limits">
              <div className="rules-deck-limit">
                <div className="rules-deck-limit-label">Main Deck</div>
                <div className="rules-deck-limit-desc">Any number of copies of Abilities. Up to <strong>4 copies</strong> of Heroes, Artifacts, Attacks, Spells and Ascended Heroes.</div>
              </div>
              <div className="rules-deck-limit">
                <div className="rules-deck-limit-label">Potion Deck</div>
                <div className="rules-deck-limit-desc">Up to <strong>2 copies</strong> of each Potion.</div>
              </div>
            </div>
          </div>

          <div style={{ height: 60 }} />
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════

// Context menu sub-component

// ===== CROSS-FILE EXPORTS =====
window.AuthScreen = AuthScreen;
window.MainMenu = MainMenu;
window.getRank = getRank;
window.ProfileScreen = ProfileScreen;
window.PurchaseCelebration = PurchaseCelebration;
window.ShopScreen = ShopScreen;
window.RulesScreen = RulesScreen;
