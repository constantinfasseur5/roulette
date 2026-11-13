# Roulette Royale — multiplayer roulette with room codes

Play roulette with friends: one person creates a room and shares the code or link, everyone else joins.
**Virtual chips only. No real money, no payments.**

## Try it out

Want to try the site? Go to **Roulette With Friends**: <https://roulettewithfriends.onrender.com/>

1. Enter a nickname and click **Create room**. You are now the Host.
2. Others open the same site, enter a nickname + the 5-character **room code** (or open your **link**, which fills in the code) and click **Join**.
3. As Host, click **Start round** in the Host panel. Everyone places chips on the table; then the wheel spins.

### Testing with multiple tabs
Open the site in several tabs. Each tab is its own player (the session is stored per tab, so tabs don't interfere). Refreshing a tab brings you back with your balance. If you close a tab and open a new one, the start screen shows a **"Back to room …"** button.

### Language
There is an **EN | NL** button at the top (and on the start screen). English is the default; your choice is remembered. Translations live in `public/i18n.js`; the server keeps sending Dutch and the website translates those messages.

### Avatar, leaderboard and statistics
- Pick an **avatar** (emoji) and **color** on the start screen (button next to the nickname) or in the room with the **✎** button. Your choice is remembered in your browser. Your color also outlines your chips on the table.
- The player list is a **leaderboard**: richest on top, with 🥇🥈🥉 and ▲▼ showing the change in position after the last round. The **🏆 Leaderboard** button shows a podium with chips, result versus the start and win percentage.
- **Click a player** for statistics: rounds, wins, biggest win/loss, total staked, total result and favorite bets. The Host resets statistics with "reset player" or "reset everyone".
- At the bottom of the statistics are **8 achievements** (First win, Hot streak, Bullseye, All in, Comeback, Jackpot, Stayer, King of the table). When someone earns one, the whole room gets a short message. Achievements are kept even when stats are reset.

### Spectators (watch link)
The Host panel has a **👁 Copy watch link** button (`?watch=KEY`). The link has its own secret key and does not contain the room code; spectators never receive the code from the server, so they cannot join as a player or switch to playing. Whoever opens the link enters without a nickname as a **spectator**: the wheel, table, players and chat are visible, but betting, chatting and Host actions are not possible (the server rejects everything except viewing statistics and leaving). Spectators do not count towards the 12-player limit (max. 30 spectators), are not in the leaderboard and are shown next to the player count as "👁 n". Watching also works in a locked room (locking only stops new players). The Host can turn spectators off with the **Allow spectators** switch; they are then removed and new spectators are refused. With **↻ New watch link** the old link stops working and all spectators are removed.

### Streamer mode
The **🎥 button** (top bar and start screen) hides the room code on screen (•••••), keeps it out of the address bar and the tab title, and shows the code field as a password field. Your choice is remembered in your browser; Copy code/link keep working. Tip for streamers: turn the mode on, lock the room once your friends are in, and share only the watch link.

## Rules

European (0) or American (0 and 00), chosen by the Host between rounds.

| Bet | Payout |
|---|---|
| Straight (single number) | 35:1 |
| Split (2 numbers) | 17:1 |
| Street (3) | 11:1 |
| Corner (4) and "first four" 0-1-2-3 (European only) | 8:1 |
| Six line (6) | 5:1 |
| Column, dozen | 2:1 |
| Red/black, even/odd, 1-18 / 19-36 | 1:1 |

On 0 (and 00) all outside bets lose. Click a cell or the **round click points between cells** (splits, streets, corners, six lines). Buttons: **Undo**, **Clear all**, **Repeat last**, **Double**.

## What can the Host do?

Everything is in the **Host panel** (only visible to the Host; the server checks permissions).
The panel collapses into a small bar with the ▾ triangle and opens again; your choice is remembered in your browser.

- Start a round, close betting, spin the wheel, **+10 seconds**, pause/resume
- **Automatic** on/off (rounds run by themselves, or everything manual)
- Betting time, starting chips, min/max bet per spot, **rebuy bonus** for players who are broke
- Variant: European or American (only between rounds)
- **I play too** on/off (off = croupier/spectator)
- Chat on/off, **show other players' bets** on/off (small bubbles in each player's color on the table), **lock** the room, allow spectators, copy/renew the watch link
- Per player (⚙ button): give/take/set chips, reset, mute, **hand over the Host role**, kick, ban (also by IP) and unban
- Reset everyone to the starting balance, copy code/link, **close the room**
- **Saved settings:** save your room settings under a name (up to 8, only in your browser) and load them with one click in a new room. Variant and min/max bet only load between rounds.

If the Host is gone for 60 seconds, the Host role automatically goes to the player who has been in the room the longest.

## Room rules

- 5-character code, without confusing characters (no O/0/I/1). Maximum 12 players.
- Duplicate nicknames are refused. Nicknames are max. 16 characters.
- Gone or refreshed? Come back within 2 minutes with the same balance (session token).
- Join in the middle of a round and you play from the next one.
- Out of chips? You stay in the room as a spectator until the Host gives chips (or the rebuy bonus is on).
- Empty rooms are removed after 10 minutes.
- Rooms live in memory: if the site restarts or has been asleep for a while, open rooms are gone and you simply create a new one.

## Security in short

- The server decides everything: the result (`crypto.randomInt`, unless the Host as game master sets a number), balances, payouts and timers. The browser cannot forge anything.
- All input is validated server-side (amounts, bet keys, phase, permissions).
- Nicknames and chat are never shown as HTML in the browser (no XSS). Content-Security-Policy is on.
- WebSockets check the Origin, have a maximum message size (4 KB), rate limiting and a heartbeat.
- The watch link uses its own secret key; spectators never get the room code and cannot do anything except watch.
- Banning works on nickname, session **and IP address** (per room). The Host sees a "Banned players" list and can unban; the list shows no IPs. People on the same network share an IP, so one ban can block others on that network (unban them then). Local addresses (127.0.0.1) are never IP-banned. A VPN or another network gets around an IP ban; if you don't want that, lock the room.

## Tests

```bash
npm test      # or: node test/run.js
```

This runs 351 checks: all bet types and payouts, Host permissions, pause, reconnect, Host handover, spam/oversized messages, Origin check, spectators, achievements and a real multiplayer round over WebSockets.

## Files

```
server.js          HTTP server for the site + WebSocket endpoint (/ws)
lib/game.js        all game logic: rooms, rounds, Host actions, payouts
lib/ws.js          own small WebSocket server (RFC 6455), no packages
public/rules.js    bets + payouts (shared by server and browser)
public/index.html  pages
public/style.css   casino theme
public/app.js      client: table, wheel, chat, Host panel, sound, leaderboard, profile
public/i18n.js     translations (EN/NL)
public/changelog.js  the Update log on the site
test/              test suite
```

## Ideas for later

Accounts, extra bet types (e.g. neighbors/voisins, trio), a database so rooms survive a restart.
