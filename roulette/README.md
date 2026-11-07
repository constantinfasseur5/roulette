Roulette Royale: multiplayer roulette with room codes

Play roulette with friends: one person creates a room and shares the code or link, everyone else joins.
Virtual chips only. No real money, no payments.

The project needs no external packages (no npm install). Just Node.js 18 or newer.

Quick start
bash
node server.js        # or: npm start

Then open http://localhost:3000.

Enter a nickname and click Maak kamer (Create room). You are now the Host.
Others open the same site, enter a nickname plus the 5-character room code (or open your link, which pre-fills the code) and click Join.
As Host, click Start ronde (Start round) in the Host panel. Everyone places chips on the table, then the wheel spins.
Testing with multiple tabs

Open several tabs on http://localhost:3000. Each tab is its own player (the session is stored per tab, so tabs don’t interfere with each other). Refreshing a tab brings you back with your balance. If you close a tab and open a new one, the start screen shows a “Terug naar kamer …” (Back to room …) button.

Rules

European (0) or American (0 and 00), chosen by the Host between rounds.

Bet	Payout
Straight (single number)	35:1
Split (2 numbers)	17:1
Street (3)	11:1
Corner (4) and “first four” 0-1-2-3 (European only)	8:1
Six line (6)	5:1
Column, dozen	2:1
Red/black, even/odd, 1-18 / 19-36	1:1

On 0 (and 00) all outside bets lose. Click a cell, or the round click spots between cells (splits, streets, corners, six lines). Buttons: Ongedaan (Undo), Wis alles (Clear all), Herhaal vorige (Repeat previous), Verdubbel (Double).

What can the Host do?

Everything is in the Host panel (only visible to the Host; the server checks permissions):

Start a round, close betting, spin the wheel, +10 seconds, pause/resume
Automatic mode on/off (rounds run by themselves, or everything manual)
Betting time, starting chips, min/max bet per spot, rebuy bonus for players who go broke
Variant: European or American (only between rounds)
I play too on/off (off = croupier/spectator)
Chat on/off, lock the room
Per player (⚙ button): give/take/set chips, reset, mute, transfer the Host role, kick, ban
Reset everyone to the starting balance, copy code/link, close the room

If the Host drops for 60 seconds, the Host role automatically passes to the player who has been in the room the longest.

Room rules
5-character code, without confusing characters (no O/0/I/1). Maximum 12 players.
Duplicate nicknames are rejected. Nicknames are max. 16 characters.
Gone or refreshed? Come back within 2 minutes with the same balance (session token).
If you join in the middle of a round, you play from the next round.
Out of chips? You stay in the room as a spectator until the Host gives you chips (or the rebuy bonus is on).
Empty rooms are removed after 10 minutes.
Going online without your own server (free, no sharing your IP)

This way the app is always running and you get your own link like https://roulette-royale.onrender.com to share. Your own computer and IP are not involved.

Put the folder on GitHub (new repository; uploading files via “Add file > Upload files” also works).
Create a free account at https://render.com, choose New > Blueprint (or New > Web Service) and connect your repository.
With a Blueprint, Render picks up render.yaml automatically. With a Web Service, enter: Build command empty or echo ok, Start command node server.js, plan Free.
After a minute or so you get the link. Open it, create a room and share the link or code.

Good to know about Render’s free tier:

The service goes to sleep after 15 minutes without traffic and is awake again about a minute after someone opens the link. During a game, the messages keep it awake (the app also sends a ping itself every 2 minutes).
If the service sleeps, open rooms are gone. Whoever opens it next waits a moment and creates a new room.
There are 750 free hours per month, enough for a service that runs all month.

Other hosts that support WebSockets (Railway, Fly.io, Koyeb or your own VPS) also work: start command node server.js, port from PORT.

Technical details for hosting

The app is a single Node process with WebSockets. Pick a host that supports WebSockets.

Build command: leave empty (nothing to install)
Start command: node server.js
The port is read from the PORT environment variable.
Use HTTPS: the client then switches to wss:// by itself.
Health check: /health

Environment variables (all optional): PORT, HOST, ALLOWED_ORIGINS (comma-separated, only needed if the page is loaded from a different domain than the server).

Note: rooms live in memory. When the server restarts they are gone, and run only one instance (no load balancer with multiple copies).

Security in brief
The server decides everything: the result (crypto.randomInt), balances, payouts and timers. The browser can’t forge anything.
All input is validated server-side (amounts, bet keys, phase, permissions).
Nicknames and chat are never rendered as HTML in the browser (no XSS). A Content-Security-Policy is enabled.
WebSockets check the Origin, have a maximum message size (4 KB), rate limiting and a heartbeat.
Banning works on nickname + session, so it is “best effort”: someone who picks another nickname and starts a new session can get back in. If you don’t want that, lock the room.
Tests
bash
npm test      # or: node test/run.js   (Node 22+ for the network tests)

This runs 222 checks: all bet types and payouts, Host permissions, pause, reconnect, Host handover, spam/oversized messages, Origin checking and a real multiplayer round over WebSockets.

Files
server.js          HTTP server for the site + WebSocket endpoint (/ws)
lib/game.js        all game logic: rooms, rounds, host actions, payouts
lib/ws.js          small custom WebSocket server (RFC 6455), no packages
public/rules.js    bets + payouts (shared by server and browser)
public/index.html  pages
public/style.css   casino theme
public/app.js      client: table, wheel, chat, host panel, sound
test/              test suite
Ideas for later

Per-room leaderboard, accounts, extra bet types (e.g. neighbours/voisins, trios), custom chip colours, player avatars, saved room settings, a database so rooms survive a restart.
