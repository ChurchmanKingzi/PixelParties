# Pixel Parties TCG — Online Multiplayer Simulator

A real-time online multiplayer Trading Card Game simulator built with Node.js, Express, Socket.io, and SQLite.

## Quick Start (Local)

```bash
npm install
node server.js
```

Then open **http://localhost:3000** in your browser.

## Deploy to Render

1. Push this project to a GitHub repository
2. Go to [render.com](https://render.com) → **New** → **Web Service**
3. Connect your GitHub repo
4. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Environment:** Node
5. Deploy!

> **Note:** The SQLite database (`data/pixel-parties.db`) is stored on disk.
> On Render's free tier, the disk resets on redeploy. For persistent data,
> upgrade to a paid plan with a persistent disk, or swap SQLite for PostgreSQL.

## Project Structure

```
pixel-parties/
├── server.js          # Express + Socket.io + SQLite backend
├── package.json       # Dependencies
├── public/
│   ├── index.html     # Entry point (loads React + Socket.io)
│   ├── style.css      # Full stylesheet
│   └── app.jsx        # React frontend (compiled in-browser by Babel)
├── data/
│   └── cards.json     # Card database (1,385 cards)
├── uploads/
│   ├── avatars/       # User avatar uploads
│   └── cardbacks/     # User cardback uploads
└── README.md
```

## Features

### Authentication
- Sign up / Log in with username + password (bcrypt hashed)
- Session-based auth with HTTP-only cookies
- Auto-login on page refresh

### Main Menu
- Play, Edit Deck, View Profile
- Shows username (in chosen color) and ELO rating

### Deck Builder
- Create unlimited decks with full rule enforcement:
  - **Main Deck:** Exactly 60 cards. Max 4 copies of non-Ability cards. No Heroes or Potions.
  - **Heroes:** 3 slots. Starting Abilities auto-fill when a Hero is placed.
  - **Potion Deck:** 0 or 5-15 Potion cards. Max 2 copies each.
  - **Side Deck:** Up to 15 cards of any type, copy limits enforced globally.
- Card browser with cumulative filters (name, effect, type, subtype, archetype, spell schools, starting abilities, level, cost, HP, ATK)
- 4×5 card grid with pagination
- Rename, Save As, Delete, Set Default
- Unsaved changes preserved per-deck when switching during a session
- Left-click to add cards, right-click to remove

### Play (Room Browser)
- Create games (Ranked / Unranked)
- Optional player and spectator passwords
- Browse open games and games in progress
- Automatic deck legality check before joining/creating
- Real-time lobby with Socket.io
- Host gets pop-up notification when opponent joins
- Spectator mode
- Players can swap to spectator role

### Profile
- Custom name color
- Avatar upload
- Cardback upload (validates 750×1050 ratio)
- ELO rating display

## Card Database

The `data/cards.json` file contains all 1,385 cards with:
- name, cardType, subtype, level, hp, atk, cost
- effect text, archetype, set ID
- spellSchool1/2 (for non-Hero cards)
- startingAbility1/2 (for Hero/Ascended Hero cards)

## Tech Stack

- **Backend:** Node.js, Express, Socket.io, better-sqlite3, bcryptjs
- **Frontend:** React 18 (via CDN), Babel standalone (JSX compilation)
- **Database:** SQLite (file-based, zero config)
- **Real-time:** Socket.io for lobby, rooms, and spectating
