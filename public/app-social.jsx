// ═══════════════════════════════════════════════════════════════
//  PIXEL PARTIES — WHO'S ONLINE, PRIVATE CHATS, HERAUSFORDERUNGEN
//
//  Server-Gegenstück: social.js. Hier:
//    • <SocialHost user bgmMode />   einmal in <App>: hält die Socket-Ereignisse,
//                                    meldet Eingaben (AFK-Erkennung) und spielt den
//                                    Benachrichtigungston — in jedem Menü, nur nicht
//                                    im laufenden Duell.
//    • <WhosOnlineList />            Liste im Hauptmenü (Tab neben „Top Players“)
//    • <DmChatWindow />              privates Chatfenster mit Challenge-Buttons
//    • <SocialSidePanel room isHost/> dieselbe Liste als Kasten links in Online-Lobbys; der Raumbesitzer
//                                    lädt per Klick → „Invite“ Spieler in seinen (offenen, nicht vollen) Raum ein
//    • Einladungen                   Empfänger sehen in jedem Menü einen Hinweis (JOIN / ✕); JOIN führt in die
//                                    Online-Lobby und tritt dem Raum bei (`window._ppPendingInvite`, PlayScreen)
//    • useSocial()                   liest den gemeinsamen Zustand
//
//  Lämpchen: grün = online, orange = AFK (5 Min. ohne Eingabe), rot = In-Game,
//  grau = offline. Offline-Spieler stehen nur in der Liste, solange sie
//  ungelesene Nachrichten oder eine offene Herausforderung an dich haben.
//
//  Alle sichtbaren Texte sind Englisch (Als Regel 11.8.).
// ═══════════════════════════════════════════════════════════════
const { useState, useEffect, useRef, useCallback, useContext } = React;

const SOCIAL_STATUS_LABEL = { online: 'Online', afk: 'Away', ingame: 'In game', offline: 'Offline' };
const SOCIAL_STATUS_ORDER = { online: 0, ingame: 1, afk: 2, offline: 3 };
const SOCIAL_ACTIVITY_THROTTLE_MS = 10000;

// ── Gemeinsamer Zustand (außerhalb von React, damit er Bildschirmwechsel überlebt) ──
const _social = {
  presence: [],
  state: { unread: {}, incoming: [], extras: [], blocked: [], blockedBy: [] },
  msgs: {},            // peerId -> Nachrichten (nur, was geladen wurde)
  chatPeer: null,      // offenes Chatfenster ({ id, name, color }) — gilt für Hauptmenü UND Online-Lobby
  invites: [],         // eingegangene Raum-Einladungen ({ id, roomId, kind, label, type, at, from: { id, name, color } })
  listeners: new Set(),
};
const SOCIAL_INVITE_SHOW_MS = 10 * 60 * 1000;   // so lange bleibt der Hinweis stehen (der Server lässt die Einladung nach 15 Min. verfallen)
function _socialChanged() { _social.listeners.forEach(f => f()); }

function useSocial() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force(v => v + 1);
    _social.listeners.add(f);
    return () => { _social.listeners.delete(f); };
  }, []);
  return _social;
}

/** Einladung annehmen: merken und in die Online-Lobby wechseln — der PlayScreen tritt dem Raum bei. */
function socialAcceptInvite(inv, openPlay) {
  _social.invites = _social.invites.filter(i => i.id !== inv.id);
  _socialChanged();
  window._ppPendingInvite = inv;
  window.dispatchEvent(new CustomEvent('pp:room-invite-accept', { detail: inv }));   // PlayScreen schon offen
  if (openPlay) openPlay();                                                          // sonst: hinwechseln, er liest `_ppPendingInvite` beim Einhängen
}
function socialDeclineInvite(inv) {
  _social.invites = _social.invites.filter(i => i.id !== inv.id);
  _socialChanged();
  socket.emit('room_invite_decline', { id: inv.id });
}

function socialOpenChat(peer) { _social.chatPeer = peer ? { id: peer.id, name: peer.name, color: peer.color } : null; _socialChanged(); }
function socialCloseChat() { _social.chatPeer = null; _socialChanged(); }

function _socialUpsertMessage(peerId, msg) {
  const list = _social.msgs[peerId];
  if (!list) return;
  const i = list.findIndex(m => m.id === msg.id);
  if (i >= 0) list[i] = msg; else list.push(msg);
}

function socialLoadHistory(peerId) {
  socket.emit('dm_history', { peer: peerId }, (res) => {
    if (res && res.messages) { _social.msgs[peerId] = res.messages; _socialChanged(); }
  });
}

/** Persönlicher Zustand + Anwesenheit → Zeilen der Liste, Priorität zuerst. */
function socialBuildRows(meId) {
  const byId = new Map();
  for (const u of _social.presence) byId.set(u.id, { ...u });
  for (const e of (_social.state.extras || [])) {
    if (!byId.has(e.id)) byId.set(e.id, { id: e.id, name: e.name, color: e.color, status: 'offline' });
  }
  byId.delete(meId);
  const rows = [...byId.values()].map(r => ({
    ...r,
    unread: (_social.state.unread || {})[r.id] || 0,
    challenge: (_social.state.incoming || []).includes(r.id),
  }));
  rows.sort((a, b) => {
    const pa = (a.unread > 0 || a.challenge) ? 0 : 1;
    const pb = (b.unread > 0 || b.challenge) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const sa = SOCIAL_STATUS_ORDER[a.status] ?? 9, sb = SOCIAL_STATUS_ORDER[b.status] ?? 9;
    if (sa !== sb) return sa - sb;
    return String(a.name).localeCompare(String(b.name));
  });
  return rows;
}

// ═══════════════════════════════════════════
//  HOST — Ereignisse, Aktivitätsmeldung, Ton
// ═══════════════════════════════════════════
function SocialHost({ user, bgmMode, onOpenPlay }) {
  const inDuelRef = useRef(false);
  // „Laufendes Duell“: Kampfmusik, Puzzle, Tutorial, Kampagne. Das Ergebnis-Thema (win/defeat) zählt nicht mehr.
  inDuelRef.current = /^(battle|puzzleAttempt|tutorial|campaign)/.test(String(bgmMode || ''));
  const active = !!user && !user.isGuest;
  const meId = user ? user.id : null;

  useEffect(() => {
    if (!active) {
      _social.presence = []; _social.msgs = {}; _social.chatPeer = null; _social.invites = [];
      _social.state = { unread: {}, incoming: [], extras: [], blocked: [], blockedBy: [] };
      _socialChanged();
      return;
    }
    const onPresence = (d) => { _social.presence = (d && d.users) || []; _socialChanged(); };
    const onState = (d) => { if (d) { _social.state = d; _socialChanged(); } };
    const onMessage = (m) => {
      if (!m) return;
      const mine = m.from === meId;
      const peer = mine ? m.to : m.from;
      _socialUpsertMessage(peer, m);
      _socialChanged();
      if (!mine && !inDuelRef.current && window.playSFX) {
        window.playSFX(m.kind === 'challenge' ? 'match_found' : 'ping', { dedupe: 400 });
      }
      window.dispatchEvent(new CustomEvent('pp:dm-message', { detail: m }));
    };
    const onUpdate = (m) => {
      if (!m) return;
      _socialUpsertMessage(m.from === meId ? m.to : m.from, m);
      _socialChanged();
    };
    const onInvite = (inv) => {
      if (!inv || !inv.id || !inv.from) return;
      // Pro Raum und Einlader nur die neueste Einladung.
      _social.invites = [..._social.invites.filter(i => !(i.roomId === inv.roomId && i.from.id === inv.from.id)), { ...inv, got: Date.now() }];
      _socialChanged();
      if (!inDuelRef.current && window.playSFX) window.playSFX('match_found', { dedupe: 400 });
    };
    socket.on('social_presence', onPresence);
    socket.on('social_state', onState);
    socket.on('dm_message', onMessage);
    socket.on('dm_update', onUpdate);
    socket.on('room_invite', onInvite);
    socket.emit('social_sync');

    // Eingaben melden (der Server entscheidet über AFK). Die erste Eingabe nach einer Pause geht sofort raus.
    let last = 0;
    const ping = () => {
      const now = Date.now();
      if (now - last < SOCIAL_ACTIVITY_THROTTLE_MS) return;
      last = now;
      socket.emit('presence_activity');
    };
    const evts = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'];
    evts.forEach(e => window.addEventListener(e, ping, { passive: true, capture: true }));
    const onVis = () => { if (!document.hidden) ping(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', ping);
    const onConnect = () => { last = 0; ping(); };
    socket.on('connect', onConnect);
    ping();

    return () => {
      socket.off('social_presence', onPresence);
      socket.off('social_state', onState);
      socket.off('dm_message', onMessage);
      socket.off('dm_update', onUpdate);
      socket.off('room_invite', onInvite);
      socket.off('connect', onConnect);
      evts.forEach(e => window.removeEventListener(e, ping, { capture: true }));
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', ping);
    };
  }, [active, meId]);

  return active ? <RoomInviteToasts hidden={inDuelRef.current} onOpenPlay={onOpenPlay} /> : null;
}

// ═══════════════════════════════════════════
//  EINLADUNGS-HINWEISE (unten rechts, in jedem Menü)
// ═══════════════════════════════════════════
function RoomInviteToasts({ hidden, onOpenPlay }) {
  useSocial();
  const [, tick] = useState(0);
  // Abgelaufene Hinweise nach und nach entfernen.
  useEffect(() => {
    const iv = setInterval(() => {
      const now = Date.now();
      const keep = _social.invites.filter(i => now - (i.got || now) < SOCIAL_INVITE_SHOW_MS);
      if (keep.length !== _social.invites.length) { _social.invites = keep; _socialChanged(); } else tick(v => v + 1);
    }, 15000);
    return () => clearInterval(iv);
  }, []);
  if (hidden || _social.invites.length === 0) return null;
  const inRoom = !!window._ppInLobby;   // PlayScreen meldet, ob der Spieler gerade in einer Lobby sitzt
  return (
    <div className="social-invite-stack" role="region" aria-label="Room invitations">
      {_social.invites.map(inv => (
        <div key={inv.id} className="social-invite ornate-frame">
          <div className="social-invite-title">
            ✉ <span style={{ color: inv.from.color || 'var(--accent)' }}>{inv.from.name}</span> invited you
          </div>
          <div className="social-invite-what">
            {inv.kind === 'draft' ? '🧊' : inv.kind === 'skilltest' ? '🎯' : '⚔'} {String(inv.label || 'Game').toUpperCase()}
            {' · '}<span className={inv.type === 'ranked' ? 'ranked' : ''}>{String(inv.type || 'unranked').toUpperCase()}</span>
          </div>
          {inRoom && <div className="social-invite-warn">Joining leaves your current room.</div>}
          <div className="social-invite-btns">
            <button className="btn social-accept" onClick={() => socialAcceptInvite(inv, onOpenPlay)}>JOIN</button>
            <button className="btn social-decline" onClick={() => socialDeclineInvite(inv)}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
//  LISTE
// ═══════════════════════════════════════════
function SocialLamp({ status }) {
  return <span className={'social-lamp social-lamp--' + status} title={SOCIAL_STATUS_LABEL[status] || ''} />;
}

/**
 * `invite` (nur in Lobbys, nur für den Raumbesitzer, solange der Raum offen und nicht voll ist):
 *   { roomId, members: [Namen im Raum] } — ein Klick auf eine Zeile klappt dann „Invite / Chat“ auf,
 *   statt sofort den Chat zu öffnen.
 */
function WhosOnlineList({ meId, onOpen, invite }) {
  useSocial();
  const [openId, setOpenId] = useState(null);      // aufgeklappte Zeile (nur im Einladungs-Modus)
  const [invited, setInvited] = useState({});      // userId -> true, sobald der Server die Einladung angenommen hat
  const [busyId, setBusyId] = useState(null);
  const [err, setErr] = useState('');
  const roomId = invite ? invite.roomId : null;
  useEffect(() => { setInvited({}); setOpenId(null); setErr(''); }, [roomId]);
  const rows = socialBuildRows(meId);
  if (rows.length === 0) return <div className="menu-side-empty">Nobody else is online right now.</div>;

  const sendInvite = (r) => {
    setErr(''); setBusyId(r.id);
    socket.emit('room_invite_send', { to: r.id, roomId }, (res) => {
      setBusyId(null);
      if (res && res.error) { setErr(res.error); if (window.playSFX) window.playSFX('ui_error'); return; }
      setInvited(m => ({ ...m, [r.id]: true }));
    });
  };

  return (
    <ul className="social-list">
      {rows.map(r => {
        const inRoom = !!invite && invite.members.includes(r.name);
        const canInviteRow = !!invite && !inRoom && (r.status === 'online' || r.status === 'afk');
        const open = !!invite && openId === r.id;
        const click = () => { if (invite) { setErr(''); setOpenId(open ? null : r.id); } else onOpen(r); };
        return (
          <li key={r.id} className={'social-row-wrap' + (open ? ' is-open' : '')}>
            <div className={'social-row' + ((r.unread > 0 || r.challenge) ? ' has-news' : '')}
                 role="button" tabIndex={0} onClick={click}
                 onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); click(); } }}>
              <SocialLamp status={r.status} />
              <span className="social-name" style={{ color: r.color || 'var(--accent)' }}>{r.name}</span>
              {inRoom && <span className="social-tag" title="Already in this room">IN ROOM</span>}
              {!inRoom && invited[r.id] && <span className="social-tag social-tag--sent" title="Invitation sent">INVITED</span>}
              {r.challenge && <span className="social-badge social-badge--challenge" title="Open challenge">!</span>}
              {r.unread > 0 && <span className="social-badge" title="Unread messages">{r.unread > 99 ? '99+' : r.unread}</span>}
            </div>
            {open && (
              <div className="social-row-menu">
                <button className="btn social-invite-btn" disabled={!canInviteRow || busyId === r.id}
                        title={inRoom ? 'Already in this room' : (r.status === 'ingame' ? r.name + ' is in a game' : (r.status === 'offline' ? r.name + ' is offline' : 'Invite to your room'))}
                        onClick={() => sendInvite(r)}>
                  {invited[r.id] ? '✉ INVITE AGAIN' : '✉ INVITE'}
                </button>
                <button className="btn" onClick={() => onOpen(r)}>💬 CHAT</button>
                {err && <div className="social-row-error" role="alert">{err}</div>}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Zahlen für den Tab: Online-Spieler und Gesamtzahl der ungelesenen Dinge. */
function socialTabCounts(meId) {
  const online = _social.presence.filter(u => u.id !== meId).length;
  const unread = Object.values(_social.state.unread || {}).reduce((a, b) => a + b, 0)
    + (_social.state.incoming || []).length;
  return { online, unread };
}

// ═══════════════════════════════════════════
//  CHATFENSTER
// ═══════════════════════════════════════════
function DmChatWindow({ peer, meId, onClose }) {
  useSocial();
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [confirmBlock, setConfirmBlock] = useState(false);
  const endRef = useRef(null);
  const peerId = peer.id;

  const live = _social.presence.find(u => u.id === peerId);
  const status = live ? live.status : 'offline';
  const name = (live && live.name) || peer.name;
  const color = (live && live.color) || peer.color || 'var(--accent)';
  const iBlocked = (_social.state.blocked || []).includes(peerId);
  const blockedMe = (_social.state.blockedBy || []).includes(peerId);
  const blocked = iBlocked || blockedMe;
  const msgs = _social.msgs[peerId] || [];

  // Verlauf laden + alles als gelesen markieren, solange das Fenster offen ist.
  useEffect(() => {
    socialLoadHistory(peerId);
    socket.emit('dm_read', { peer: peerId });
    const onMsg = (e) => {
      const m = e.detail;
      if (m && m.from === peerId) socket.emit('dm_read', { peer: peerId });
    };
    window.addEventListener('pp:dm-message', onMsg);
    return () => window.removeEventListener('pp:dm-message', onMsg);
  }, [peerId]);

  // Beim Wechsel/Neuladen der Nachrichten ans Ende scrollen.
  useEffect(() => { if (endRef.current) endRef.current.scrollIntoView({ block: 'end' }); }, [msgs.length, peerId]);
  useEffect(() => { setErr(''); setConfirmBlock(false); }, [peerId]);
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);

  const send = () => {
    const t = text.trim();
    if (!t || blocked) return;
    setText(''); setErr('');
    socket.emit('dm_send', { to: peerId, text: t }, (res) => {
      if (res && res.error) { setErr(res.error); setText(t); }
    });
  };
  const challenge = (ranked) => {
    setErr('');
    socket.emit('challenge_send', { to: peerId, ranked }, (res) => {
      if (res && res.error) setErr(res.error);
    });
  };
  const respond = (id, accept) => {
    setErr('');
    socket.emit('challenge_respond', { id, accept }, (res) => {
      if (res && res.error) {
        setErr(res.error);
        if (window.playSFX) window.playSFX('ui_error');
      }
    });
  };
  const toggleBlock = () => {
    if (!iBlocked && !confirmBlock) { setConfirmBlock(true); setTimeout(() => setConfirmBlock(false), 3500); return; }
    setConfirmBlock(false);
    socket.emit('block_set', { user: peerId, blocked: !iBlocked }, (res) => { if (res && res.error) setErr(res.error); });
  };

  const hasOpenOutgoing = msgs.some(m => m.kind === 'challenge' && m.cstatus === 'open' && m.from === meId);
  const canChallenge = status !== 'offline' && !blocked;

  const renderChallenge = (m) => {
    const mine = m.from === meId;
    const mode = m.ctype === 'ranked' ? 'RANKED · Bo3' : 'UNRANKED · Bo1';
    let statusLine;
    if (m.cstatus === 'open') statusLine = mine ? 'Waiting for ' + name + '…' : null;
    else if (m.cstatus === 'accepted') statusLine = 'Accepted';
    else if (m.cstatus === 'declined') statusLine = 'Declined';
    else statusLine = 'Expired';
    return (
      <div key={m.id} className={'social-challenge social-challenge--' + (m.cstatus || 'expired')}>
        <div className="social-challenge-title">
          ⚔ {mine ? 'You challenged ' + name : name + ' challenged you'}
        </div>
        <div className={'social-challenge-mode' + (m.ctype === 'ranked' ? ' ranked' : '')}>{mode}</div>
        {m.cstatus === 'open' && !mine && (
          <div className="social-challenge-btns">
            <button className="btn social-accept" onClick={() => respond(m.id, true)}>ACCEPT</button>
            <button className="btn social-decline" onClick={() => respond(m.id, false)}>DECLINE</button>
          </div>
        )}
        {statusLine && <div className="social-challenge-status">{statusLine}</div>}
      </div>
    );
  };

  return (
    <div className="social-chat ornate-frame" role="dialog" aria-label={'Chat with ' + name}>
      <div className="social-chat-head">
        <SocialLamp status={status} />
        <span className="social-chat-name" style={{ color }}>{name}</span>
        <span className="social-chat-status">{SOCIAL_STATUS_LABEL[status]}</span>
        <button className="social-chat-close" onClick={onClose} aria-label="Close chat">✕</button>
      </div>

      <div className="social-chat-actions">
        <button className="btn social-challenge-btn" disabled={!canChallenge}
                title={canChallenge ? 'Unranked, best of 1' : (blocked ? "You can't challenge this player" : name + ' is offline')}
                onClick={() => challenge(false)}>
          Challenge (Unranked)
        </button>
        <button className="btn social-challenge-btn ranked" disabled={!canChallenge}
                title={canChallenge ? 'Ranked, best of 3' : (blocked ? "You can't challenge this player" : name + ' is offline')}
                onClick={() => challenge(true)}>
          Challenge (Ranked)
        </button>
        <button className="btn social-block-btn" onClick={toggleBlock}>
          {iBlocked ? 'UNBLOCK' : (confirmBlock ? 'SURE?' : 'BLOCK')}
        </button>
      </div>
      {hasOpenOutgoing && <div className="social-chat-hint">Your challenge stays open until {name} answers or either of you goes away.</div>}

      <div className="social-chat-log">
        {msgs.length === 0 && <div className="social-chat-empty">No messages yet. Say hi!</div>}
        {msgs.map(m => {
          if (m.kind === 'challenge') return renderChallenge(m);
          const mine = m.from === meId;
          return (
            <div key={m.id} className={'social-msg ' + (mine ? 'mine' : 'theirs')}>
              <div className="social-msg-bubble">{m.text}</div>
              <div className="social-msg-time">{new Date(m.at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {err && <div className="social-chat-error" role="alert">{err}</div>}
      {blocked
        ? <div className="social-chat-blocked">{iBlocked ? 'You blocked this player. Unblock to chat again.' : "You can't chat with this player."}</div>
        : (
          <form className="social-chat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input className="input" value={text} maxLength={500} autoFocus placeholder={'Message ' + name + '…'}
                   onChange={(e) => setText(e.target.value)} />
            <button className="btn" type="submit" disabled={!text.trim()}>SEND</button>
          </form>
        )}
    </div>
  );
}

/** Das offene Chatfenster — jeder Bildschirm mit Spielerliste hängt es einmal ein. */
function SocialChatWindow({ meId }) {
  useSocial();
  // Wer in ein anderes Menü wechselt und zurückkommt, findet keinen offenen Chat mehr vor.
  useEffect(() => () => socialCloseChat(), []);
  if (!_social.chatPeer) return null;
  return <DmChatWindow peer={_social.chatPeer} meId={meId} onClose={socialCloseChat} />;
}

/** Eigenständiger Kasten (Online-Lobby): dieselbe Liste und dieselben Chats wie im Hauptmenü.
 *  Das Chatfenster deckt den Kasten in voller Höhe und Breite ab. */
function SocialSidePanel({ meId, room, isHost }) {
  const counts = socialTabCounts(meId);
  useSocial();
  // Einladen darf nur der Besitzer, solange der Raum noch offen (Lobby) und nicht voll ist.
  const cap = room ? (room.maxPlayers || 2) : 0;
  const canInvite = !!(room && isHost && (room.players || []).length < cap);
  const invite = canInvite ? { roomId: room.id, members: [...(room.players || []), ...(room.spectators || [])] } : null;
  return (
    <div className="lobby-spalte lobby-social ornate-frame pp-menuekasten" style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div className="orbit-font lobby-spalten-titel" style={{ padding: '10px 16px', fontSize: 12, fontWeight: 700, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="social-lamp social-lamp--online" />
        WHO'S ONLINE ({counts.online})
        {counts.unread > 0 && <span className="social-badge">{counts.unread > 99 ? '99+' : counts.unread}</span>}
      </div>
      {room && isHost && (
        <div className="social-invite-hint">
          {canInvite ? 'Click a player to invite them to your room.' : 'Your room is full.'}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
        <WhosOnlineList meId={meId} onOpen={socialOpenChat} invite={invite} />
      </div>
      <SocialChatWindow meId={meId} />
    </div>
  );
}

window.SocialHost = SocialHost;
window.socialOpenChat = socialOpenChat;
window.SocialChatWindow = SocialChatWindow;
window.SocialSidePanel = SocialSidePanel;
window.useSocial = useSocial;
window.socialTabCounts = socialTabCounts;
window.WhosOnlineList = WhosOnlineList;
window.DmChatWindow = DmChatWindow;
