/*
 * i18n.js — Engels/Nederlands.
 * De Nederlandse tekst is de sleutel; EN bevat de Engelse vertaling. {naam} is een invulplek.
 * Teksten die de server stuurt (altijd Nederlands) worden hier ook vertaald met tr().
 * Standaardtaal: Engels. De keuze wordt onthouden in localStorage.
 */
(function (root) {
  'use strict';

  // BELANGRIJK: volgorde telt bij teksten met {invulplekken}: specifieke eerst, algemene later.
  const EN = {
    // ---------- servermeldingen ----------
    'Ongeldig bericht.': 'Invalid message.',
    'Rustig aan, je stuurt te snel.': 'Slow down, you are sending too fast.',
    'Je zit niet in een kamer.': 'You are not in a room.',
    'Onbekende actie.': 'Unknown action.',
    'Alleen de Host mag dit.': 'Only the Host can do this.',
    'Je zit al in een kamer.': 'You are already in a room.',
    'Te veel pogingen. Wacht even.': 'Too many attempts. Wait a moment.',
    'Kies een bijnaam (1-16 tekens).': 'Choose a nickname (1-16 characters).',
    'De server zit vol. Probeer het later opnieuw.': 'The server is full. Try again later.',
    'Kamer niet gevonden. Controleer de code.': 'Room not found. Check the code.',
    'Je bent verbannen uit deze kamer.': 'You are banned from this room.',
    'De kamer is vergrendeld door de Host.': 'The room is locked by the Host.',
    'De kamer is vol (max. {n} spelers).': 'The room is full (max. {n} players).',
    'Meekijken staat uit in deze kamer.': 'Watching is turned off in this room.',
    'Meekijken kan alleen met een kijk-link van de Host.': 'You can only watch with a watch link from the Host.',
    'Deze kijk-link werkt niet (meer). Vraag de Host om een nieuwe.': 'This watch link does not work (anymore). Ask the Host for a new one.',
    'De Host heeft een nieuwe kijk-link gemaakt. De oude link werkt niet meer.': 'The Host made a new watch link. The old link no longer works.',
    'Streamer-modus: verberg de kamercode': 'Streamer mode: hide the room code',
    'Streamer-modus aan: de kamercode is verborgen.': 'Streamer mode on: the room code is hidden.',
    'Streamer-modus uit.': 'Streamer mode off.',
    'Terug naar je kamer als {name}': 'Back to your room as {name}',
    'Kopiëren is niet gelukt.': 'Copying did not work.',
    '↻ Nieuwe kijk-link': '↻ New watch link',
    'Host-paneel openen': 'Open Host panel',
    'Host-paneel sluiten': 'Close Host panel',
    'Een nieuwe kijk-link maken? De oude link werkt dan niet meer en alle kijkers worden weggestuurd.': 'Make a new watch link? The old link stops working and all spectators are removed.',
    'Er kijken al genoeg mensen mee (max. {n}).': 'Enough people are already watching (max. {n}).',
    'De Host heeft meekijken uitgezet.': 'The Host turned off watching.',
    'Je kijkt alleen mee.': 'You are only watching.',
    '🏅 {name} behaalde: Eerste winst!': '🏅 {name} earned: First win!',
    '🏅 {name} behaalde: Hot streak!': '🏅 {name} earned: Hot streak!',
    '🏅 {name} behaalde: Voltreffer!': '🏅 {name} earned: Bullseye!',
    '🏅 {name} behaalde: Alles op één kaart!': '🏅 {name} earned: All in!',
    '🏅 {name} behaalde: Terug uit de put!': '🏅 {name} earned: Comeback!',
    '🏅 {name} behaalde: Jackpot!': '🏅 {name} earned: Jackpot!',
    '🏅 {name} behaalde: Doorzetter!': '🏅 {name} earned: Stayer!',
    '🏅 {name} behaalde: Koning van de tafel!': '🏅 {name} earned: King of the table!',
    'Eerste winst': 'First win',
    'Win je eerste ronde.': 'Win your first round.',
    'Hot streak': 'Hot streak',
    'Win 3 rondes op rij.': 'Win 3 rounds in a row.',
    'Voltreffer': 'Bullseye',
    'Win met een enkel nummer.': 'Win with a straight-up number.',
    'Alles op één kaart': 'All in',
    'Zet al je fiches in en win.': 'Bet all your chips and win.',
    'Terug uit de put': 'Comeback',
    'Kom terug naar je startbedrag nadat je bijna alles kwijt was.': 'Get back to your starting amount after nearly losing everything.',
    'Jackpot': 'Jackpot',
    'Win in één ronde minstens je startbedrag.': 'Win at least your starting amount in a single round.',
    'Doorzetter': 'Stayer',
    'Speel 10 rondes mee.': 'Play 10 rounds.',
    'Koning van de tafel': 'King of the table',
    'Sta na ronde 20 op nummer 1.': 'Be number 1 after round 20.',
    'Prestaties': 'Achievements',
    'Meekijken': 'Watch',
    'Je bent uitgenodigd om mee te kijken. Je hebt geen bijnaam nodig en kunt niets inzetten.': 'You are invited to watch. No nickname needed, and you cannot place bets.',
    '👁 Je kijkt alleen mee. Je kunt niets inzetten of typen.': '👁 You are only watching. You cannot bet or type.',
    'Meekijkers kunnen meelezen maar niet chatten.': 'Spectators can read the chat but not type.',
    'Kijk-link gekopieerd': 'Watch link copied',
    'Meekijkers toestaan': 'Allow spectators',
    '👁 Kopieer kijk-link': '👁 Copy watch link',
    'Die bijnaam is al in gebruik in deze kamer.': 'That nickname is already taken in this room.',
    '{name} doet mee.': '{name} joined.',
    '{name} is terug.': '{name} is back.',
    '{name} heeft de kamer verlaten.': '{name} left the room.',
    '{name} is te lang weggeweest en is uit de kamer gehaald.': '{name} was away too long and was removed from the room.',
    '{name} is uit de kamer gezet.': '{name} was kicked from the room.',
    '{name} is verbannen.': '{name} was banned.',
    'De Host is weg. {name} is nu de Host.': 'The Host is gone. {name} is now the Host.',
    'De Host is 60 seconden weg. {name} is nu de Host.': 'The Host has been away for 60 seconds. {name} is now the Host.',
    '{name} is nu de Host.': '{name} is now the Host.',
    'Er loopt al een ronde.': 'A round is already running.',
    'Het spel is gepauzeerd. Hervat eerst.': 'The game is paused. Resume first.',
    'Ronde {n}: zet je inzetten!': 'Round {n}: place your bets!',
    'De inzetten zijn niet open.': 'Betting is not open.',
    'Rien ne va plus: inzetten gesloten.': 'Rien ne va plus: betting is closed.',
    'Er kan nu niet gedraaid worden.': 'The wheel cannot be spun right now.',
    'Herstart-bonus: +{n} fiches!': 'Rebuy bonus: +{n} chips!',
    'Het spel is gepauzeerd.': 'The game is paused.',
    'Te laat, de inzetten sluiten.': 'Too late, betting is closing.',
    'Je bent toeschouwer en kunt niet inzetten.': 'You are a spectator and cannot bet.',
    'Je doet mee vanaf de volgende ronde.': 'You join from the next round.',
    'Ongeldig bedrag.': 'Invalid amount.',
    'Ongeldige inzet.': 'Invalid bet.',
    'De minimale inzet is {n}.': 'The minimum bet is {n}.',
    'De maximale inzet per vak is {n}.': 'The maximum bet per spot is {n}.',
    'Je hebt niet genoeg fiches.': 'You do not have enough chips.',
    'Je hebt te veel inzetten geplaatst.': 'You have placed too many bets.',
    'Je kunt nu niet inzetten.': 'You cannot bet right now.',
    'Wis eerst je huidige inzetten.': 'Clear your current bets first.',
    'Er zijn geen vorige inzetten.': 'There are no previous bets.',
    'Je kunt de vorige inzetten nu niet herhalen (saldo of limieten).': 'You cannot repeat the previous bets now (balance or limits).',
    'Je hebt nog niets ingezet.': 'You have not bet anything yet.',
    'Niet genoeg fiches om te verdubbelen.': 'Not enough chips to double.',
    'Verdubbelen kan niet: max. {n} per vak.': 'Cannot double: max. {n} per spot.',
    'De chat staat uit.': 'Chat is turned off.',
    'Je bent gedempt door de Host.': 'You have been muted by the Host.',
    'Niet zo snel typen.': 'Do not type so fast.',
    'Je kunt de tijd nu niet verlengen.': 'You cannot extend the time now.',
    'Maximaal 3 minuten inzettijd.': 'Maximum 3 minutes of betting time.',
    'De Host geeft {n} seconden extra.': 'The Host gives {n} extra seconds.',
    'De Host heeft het spel gepauzeerd.': 'The Host paused the game.',
    'Het spel gaat verder.': 'The game continues.',
    'Ongeldige waarde voor {a} ({b}-{c}).': 'Invalid value for {a} ({b}-{c}).',
    'Ongeldige waarde voor {a}.': 'Invalid value for {a}.',
    'Onbekende variant.': 'Unknown variant.',
    'De variant kun je alleen tussen rondes wijzigen.': 'You can only change the variant between rounds.',
    'Min/max inzet kun je alleen tussen rondes wijzigen.': 'You can only change the min/max bet between rounds.',
    'De minimale inzet mag niet hoger zijn dan de maximale.': 'The minimum bet cannot be higher than the maximum.',
    'Speler niet gevonden.': 'Player not found.',
    'Je kunt jezelf niet verwijderen.': 'You cannot remove yourself.',
    'Je bent uit de kamer gezet door de Host.': 'You were kicked from the room by the Host.',
    'Ongeldig aantal fiches.': 'Invalid number of chips.',
    'Wacht tot het wiel stilstaat.': 'Wait until the wheel stops.',
    'Host zette het saldo van {name} op {n}.': "Host set {name}'s balance to {n}.",
    'Host gaf {n} fiches aan {name}.': 'Host gave {n} chips to {name}.',
    'Host nam {n} fiches van {name}.': 'Host took {n} chips from {name}.',
    'Host zette {name} terug naar {n} fiches.': 'Host reset {name} to {n} chips.',
    'Iedereen is teruggezet naar {n} fiches.': 'Everyone was reset to {n} chips.',
    '{name} is niet meer gedempt.': '{name} was unmuted.',
    '{name} is gedempt.': '{name} was muted.',
    'Kies een andere speler.': 'Choose another player.',
    '{name} heeft de kamer gesloten.': '{name} closed the room.',

    // ---------- website ----------
    'Je bent uit de kamer gezet.': 'You were kicked from the room.',
    'De kamer is gesloten.': 'The room was closed.',
    'De verbinding met de kamer is verlopen. Join opnieuw.': 'The connection to the room has expired. Join again.',
    'Je sessie is in een ander venster geopend. Herlaad deze pagina om hier verder te spelen.': 'Your session was opened in another window. Reload this page to continue here.',
    'Wachten op de Host': 'Waiting for the Host',
    'Inzetten open': 'Betting open',
    'Inzetten gesloten': 'Betting closed',
    'Het wiel draait…': 'The wheel is spinning…',
    'Uitslag': 'Result',
    '⏸ Gepauzeerd': '⏸ Paused',
    ' · ronde {n}': ' · round {n}',
    '+ {n} ingezet': '+ {n} staked',
    'Je bent toeschouwer (croupier).': 'You are a spectator (croupier).',
    'Geen fiches meer. Vraag de Host om fiches.': 'No chips left. Ask the Host for chips.',
    'Start een ronde in het Host-paneel.': 'Start a round in the Host panel.',
    'De Host start zo de eerste ronde.': 'The Host will start the first round shortly.',
    'Gepauzeerd door de Host.': 'Paused by the Host.',
    'Kies een fiche en klik op de tafel.': 'Pick a chip and click the table.',
    'Vorige ronde: {n}': 'Previous round: {n}',
    'Nog geen uitslagen.': 'No results yet.',
    // ---- pakket 1: avatars, ranglijst, stats, opgeslagen instellingen ----
    'Avatar en kleur': 'Avatar and color',
    'Beginletter': 'First letter',
    'Klaar': 'Done',
    'Bekijk statistieken': 'View statistics',
    'Statistieken van {name}': 'Statistics of {name}',
    'Rondes gespeeld': 'Rounds played',
    'Gewonnen': 'Won',
    'Grootste winst': 'Biggest win',
    'Grootste verlies': 'Biggest loss',
    'Totaal ingezet': 'Total staked',
    'Resultaat totaal': 'Total result',
    'Favoriete inzetten': 'Favorite bets',
    'Nog geen rondes gespeeld.': 'No rounds played yet.',
    'Enkel nummer': 'Single number',
    'Kolom': 'Column',
    'Dozijn': 'Dozen',
    'Even': 'Even',
    'Oneven': 'Odd',
    '🏆 Ranglijst': '🏆 Leaderboard',
    'Ranglijst': 'Leaderboard',
    'Speler': 'Player',
    'Fiches': 'Chips',
    't.o.v. start': 'vs start',
    'Winst%': 'Win%',
    'Nog geen spelers.': 'No players yet.',
    'Opgeslagen instellingen': 'Saved settings',
    'Geen opgeslagen instellingen': 'No saved settings',
    'Laad': 'Load',
    'Bewaar…': 'Save…',
    'Bewaar': 'Save',
    'Verwijder': 'Delete',
    'Instellingen opslaan': 'Save settings',
    'Je huidige kamerinstellingen worden in deze browser bewaard.': 'Your current room settings are saved in this browser.',
    'Naam, bv. Snel spel': 'Name, e.g. Quick game',
    'Geef de instellingen een naam.': 'Give the settings a name.',
    'Maximaal 8 opgeslagen instellingen. Verwijder er eerst één.': 'Maximum of 8 saved settings. Delete one first.',
    'Opgeslagen: {name}': 'Saved: {name}',
    'Geladen: {name}': 'Loaded: {name}',
    'Geladen: {name} (variant en min/max inzet kunnen alleen tussen rondes)': 'Loaded: {name} (variant and min/max bet can only be changed between rounds)',
    '"{name}" verwijderen?': 'Delete "{name}"?',
    '🎯 Volgend getal': '🎯 Next number',
    'Willekeurig': 'Random',
    'Host-upgrade aan': 'Host upgrade on',
    'Host-upgrade uit': 'Host upgrade off',
    'Je kunt nu geen getal kiezen.': "You can't choose a number right now.",
    'Dat getal bestaat niet in deze variant.': "That number doesn't exist in this variant.",
    '❄ Koud:': '❄ Cold:',
    ' nooit': ' never',
    'Laatste 20: {r} rood · {b} zwart · {g} groen': 'Last 20: {r} red · {b} black · {g} green',
    'Fiche {c}': 'Chip {c}',
    'Niet verbonden.': 'Not connected.',
    'De Host moet eerst een ronde starten.': 'The Host must start a round first.',
    'Je bent toeschouwer.': 'You are a spectator.',
    'Niet genoeg fiches voor deze fiche.': 'Not enough chips for this chip.',
    '1e 12': '1st 12', '2e 12': '2nd 12', '3e 12': '3rd 12',
    'ONEVEN': 'ODD',
    'Rood': 'Red', 'Zwart': 'Black', 'Groen': 'Green',
    'Geen inzet': 'No bet',
    'toeschouwer': 'spectator', 'gedempt': 'muted', 'wacht': 'waiting', 'blut': 'broke',
    ' (jij)': ' (you)',
    'Speler beheren': 'Manage player',
    'Beheer {name}': 'Manage {name}',
    '👑 Host-paneel': '👑 Host panel',
    '▶ Start ronde': '▶ Start round',
    'Sluit inzetten': 'Close betting',
    '🎡 Draai wiel': '🎡 Spin wheel',
    '+10 seconden': '+10 seconds',
    '⏸ Pauzeer': '⏸ Pause',
    '▶ Hervat': '▶ Resume',
    'Automatisch (rondes lopen vanzelf)': 'Automatic (rounds run by themselves)',
    'Ik speel zelf mee': 'I play too',
    'Chat aan': 'Chat on',
    'Kamer vergrendeld': 'Room locked',
    'Instellingen': 'Settings',
    'Inzettijd (sec)': 'Betting time (sec)',
    'Startfiches': 'Starting chips',
    'Min. inzet per vak': 'Min. bet per spot',
    'Max. inzet per vak': 'Max. bet per spot',
    'Herstart-bonus (0 = uit)': 'Rebuy bonus (0 = off)',
    'Variant': 'Variant',
    'Europees (0)': 'European (0)',
    'Amerikaans (0 + 00)': 'American (0 + 00)',
    'Kamer': 'Room',
    'Kopieer code': 'Copy code',
    'Kopieer link': 'Copy link',
    'Iedereen resetten': 'Reset everyone',
    'Kamer sluiten': 'Close room',
    'Alle spelers terugzetten naar het startsaldo? Lopende inzetten worden teruggegeven.': 'Reset all players to the starting balance? Current bets are returned.',
    'De kamer voor iedereen sluiten?': 'Close the room for everyone?',
    'Tip: klik op ⚙ bij een speler om fiches te geven, te dempen, te kicken of de Host-rol over te dragen.': 'Tip: click ⚙ next to a player to give chips, mute, kick or hand over the Host role.',
    'Code gekopieerd': 'Code copied',
    'Link gekopieerd': 'Link copied',
    'Vul een geheel getal in.': 'Enter a whole number.',
    'Saldo instellen…': 'Set balance…',
    '{n} fiches': '{n} chips',
    'Zet': 'Set',
    'Reset naar start': 'Reset to start',
    'Dempen opheffen': 'Unmute',
    'Dempen': 'Mute',
    '👑 Host maken': '👑 Make Host',
    '{name} Host maken?': 'Make {name} the Host?',
    '{name} uit de kamer zetten?': 'Kick {name} from the room?',
    '{name} verbannen?': 'Ban {name}?',
    'Sluiten': 'Close',
    'Vul een geheel getal ≥ 0 in.': 'Enter a whole number ≥ 0.',
    'Kopieer handmatig: {text}': 'Copy manually: {text}',
    'Terug naar kamer {code} als {name}': 'Back to room {code} as {name}',
    'Kies eerst een bijnaam.': 'Choose a nickname first.',
    'Een kamercode heeft 5 tekens.': 'A room code has 5 characters.',
    'De kamer verlaten?': 'Leave the room?',

    // ---------- vaste teksten in index.html ----------
    'Speel samen met vrienden.': 'Play together with friends.',
    'Alleen virtuele fiches, geen echt geld.': 'Virtual chips only, no real money.',
    'Alleen virtuele fiches - geen echt geld.': 'Virtual chips only - no real money.',
    'Bijnaam': 'Nickname',
    'Bijv. LuckyLuke': 'E.g. LuckyLuke',
    'Maak kamer': 'Create room',
    'of join een kamer': 'or join a room',
    'Kamercode': 'Room code',
    'KAMER': 'ROOM',
    'Link kopiëren': 'Copy link',
    'Kopieer uitnodigingslink': 'Copy invite link',
    'Klik om de code te kopiëren': 'Click to copy the code',
    'Geluid aan/uit': 'Sound on/off',
    'Verlaat': 'Leave',
    'Jouw fiches': 'Your chips',
    'Laatste uitslagen': 'Latest results',
    '↶ Ongedaan': '↶ Undo',
    'Wis alles': 'Clear all',
    'Herhaal vorige': 'Repeat last',
    'Verdubbel': 'Double',
    'Spelers': 'Players',
    'Typ een bericht…': 'Type a message…',
    'Stuur': 'Send',
    'Roulettewiel': 'Roulette wheel',
    'Updatelog': 'Update log',
    'Wat is er nieuw': "What's new",
    'Verbinding verbroken. Opnieuw verbinden…': 'Connection lost. Reconnecting…',
  };

  // Labels in "Host wijzigde: variant: Europees, inzettijd: 20." (server) → Engels
  const SETTING_WORDS = {
    'variant': 'variant', 'inzettijd': 'betting time', 'startfiches': 'starting chips', 'min. inzet': 'min. bet', 'max. inzet': 'max. bet',
    'herstart-bonus': 'rebuy bonus', 'automatisch': 'automatic', 'host speelt mee': 'host plays', 'vergrendeld': 'locked', 'chat': 'chat', 'meekijkers': 'spectators',
    'aan': 'on', 'uit': 'off', 'Europees': 'European', 'Amerikaans': 'American',
  };

  const esc = (s) => s.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
  const compiled = Object.keys(EN).filter((k) => /\{\w+\}/.test(k)).map((k) => {
    const names = [];
    const re = new RegExp('^' + esc(k).replace(/\\\{(\w+)\\\}/g, (m, n) => { names.push(n); return '(.+?)'; }) + '$');
    return { re, names, en: EN[k] };
  });

  const fill = (tpl, p) => tpl.replace(/\{(\w+)\}/g, (m, n) => (p && p[n] != null ? p[n] : m));

  let lang = 'en';
  try { if (root.localStorage.getItem('roulette.lang') === 'nl') lang = 'nl'; } catch (e) { /* geen opslag */ }

  const I18N = {
    get lang() { return lang; },
    set(l) {
      lang = l === 'nl' ? 'nl' : 'en';
      try { root.localStorage.setItem('roulette.lang', lang); } catch (e) { /* geen opslag */ }
      if (root.document) root.document.documentElement.lang = lang;
    },
    /** Eigen tekst van de website (Nederlandse sleutel + optionele {invulplekken}). */
    t(key, params) {
      const tpl = lang === 'en' && Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : key;
      return params ? fill(tpl, params) : tpl;
    },
    /** Tekst die van de server komt (Nederlands) naar de gekozen taal. */
    tr(text) {
      if (lang === 'nl' || typeof text !== 'string') return text;
      if (Object.prototype.hasOwnProperty.call(EN, text)) return EN[text];
      const sm = /^Host wijzigde: (.+)\.$/.exec(text);
      if (sm) {
        const parts = sm[1].split(', ').map((seg) => seg.replace(/^([^:]+): (.+)$/, (m, k, v) => `${SETTING_WORDS[k] || k}: ${SETTING_WORDS[v] || v}`));
        return `Host changed: ${parts.join(', ')}.`;
      }
      for (const c of compiled) {
        const m = c.re.exec(text);
        if (m) { const p = {}; c.names.forEach((n, i) => { p[n] = m[i + 1]; }); return fill(c.en, p); }
      }
      return text;
    },
    /** Vaste teksten in de HTML: data-i18n (inhoud), data-i18n-placeholder / -title / -aria-label. */
    applyStatic(doc) {
      for (const el of doc.querySelectorAll('[data-i18n]')) {
        if (!el.dataset.i18nKey) el.dataset.i18nKey = el.textContent.trim();
        el.textContent = I18N.t(el.dataset.i18nKey);
      }
      for (const attr of ['placeholder', 'title', 'aria-label']) {
        for (const el of doc.querySelectorAll(`[data-i18n-${attr}]`)) el.setAttribute(attr, I18N.t(el.getAttribute(`data-i18n-${attr}`)));
      }
      for (const b of doc.querySelectorAll('.lang-switch button')) b.setAttribute('aria-pressed', b.dataset.lang === lang ? 'true' : 'false');
    },
  };

  if (root.document) root.document.documentElement.lang = lang;
  root.I18N = I18N;
})(typeof self !== 'undefined' ? self : this);
