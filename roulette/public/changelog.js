/*
 * changelog.js — de "Update log" op de site.
 * Nieuwe update toevoegen? Zet een nieuw blok BOVENAAN de lijst (nieuwste eerst).
 * `id` moet uniek zijn: zodra die verandert, ziet iedereen weer het rode bolletje op de knop.
 */
window.CHANGELOG = [
  {
    id: '2026-11-13-ipban',
    date: '2026-11-13',
    title: { en: 'IP bans and unban', nl: 'IP-ban en unban' },
    items: {
      en: [
        'A ban now also blocks the IP address, so someone cannot come back with a new nickname. A banned IP cannot join or watch that room.',
        'Banned someone by mistake? The Host panel now has a "Banned players" list with an Unban button for each one. (Only the Host sees this list, and no IP addresses are shown.)',
        'Note: people on the same network (home, school) share an IP, so banning one can block the others too. Unban them if that happens.',
      ],
      nl: [
        'Een ban blokkeert nu ook het IP-adres, zodat iemand niet met een nieuwe bijnaam terug kan komen. Een verbannen IP kan niet joinen of meekijken in die kamer.',
        'Per ongeluk iemand verbannen? Het Host-paneel heeft nu een lijst "Verbannen spelers" met per persoon een knop "Ban opheffen". (Alleen de Host ziet deze lijst, en er worden geen IP-adressen getoond.)',
        'Let op: mensen op hetzelfde netwerk (thuis, school) delen een IP, dus één speler verbannen kan ook de anderen blokkeren. Hef de ban dan op.',
      ],
    },
  },
  {
    id: '2026-11-13-bets',
    date: '2026-11-13',
    title: { en: 'See where others bet', nl: 'Zie waarop anderen inzetten' },
    items: {
      en: [
        'You can now see where the other players place their bets: small bubbles in their color appear next to the spot on the table, with the amount. Hover over one to see who it is. After the spin you see which bets won.',
        'Host: you can turn this off with the "Show other players\' bets" switch in the Host panel.',
      ],
      nl: [
        'Je ziet nu waarop de andere spelers inzetten: kleine bolletjes in hun kleur verschijnen naast het vak op de tafel, met het bedrag. Wijs er een aan om te zien van wie het is. Na de draai zie je welke inzetten gewonnen hebben.',
        'Host: je kunt dit uitzetten met de schakelaar "Inzetten van anderen tonen" in het Host-paneel.',
      ],
    },
  },
  {
    id: '2026-11-10-hostpanel',
    date: '2026-11-10',
    title: { en: 'Collapsible Host panel', nl: 'Inklapbaar Host-paneel' },
    items: {
      en: [
        'The Host panel can now be collapsed into a small bar: click the ▾ triangle (or the title) to close it and click again to open it. Your choice is remembered in your browser.',
      ],
      nl: [
        'Het Host-paneel kan nu dichtgeklapt worden tot een klein balkje: klik op het ▾-driehoekje (of de titel) om het te sluiten en nog een keer om het te openen. Je keuze wordt onthouden in je browser.',
      ],
    },
  },
  {
    id: '2026-11-10-stream',
    date: '2026-11-10',
    title: { en: 'Safe streaming: private watch link and hidden room code', nl: 'Veilig streamen: privé kijk-link en verborgen kamercode' },
    items: {
      en: [
        'The watch link no longer contains the room code. It has its own secret key, and spectators never see the room code. So viewers cannot join as a player or switch from watching to playing.',
        'New "↻ New watch link" button in the Host panel: the old link stops working and everyone watching is removed. Handy if the link leaked.',
        'Spectators can still watch in a locked room. Lock the room to stop new players from joining.',
        'New 🎥 Streamer mode button (top bar and start screen): hides the room code on screen, keeps it out of the address bar and the tab title, and hides it while typing. Your choice is remembered. The Copy code and Copy link buttons keep working.',
      ],
      nl: [
        'De kijk-link bevat de kamercode niet meer. Hij heeft een eigen geheime sleutel en kijkers zien de kamercode nooit. Kijkers kunnen dus niet als speler joinen of van kijken naar spelen wisselen.',
        'Nieuwe knop "↻ Nieuwe kijk-link" in het Host-paneel: de oude link werkt dan niet meer en iedereen die meekijkt wordt weggestuurd. Handig als de link uitgelekt is.',
        'Kijkers kunnen ook in een vergrendelde kamer nog meekijken. Vergrendel de kamer om te voorkomen dat er nieuwe spelers joinen.',
        'Nieuwe 🎥 Streamer-modus-knop (bovenbalk en startscherm): verbergt de kamercode in beeld, houdt hem uit de adresbalk en de tabtitel, en verbergt hem tijdens het typen. Je keuze wordt onthouden. De knoppen Kopieer code en Kopieer link blijven werken.',
      ],
    },
  },
  {
    id: '2026-11-10-watch',
    date: '2026-11-10',
    title: { en: 'Spectator link and achievements', nl: 'Kijk-link en prestaties' },
    items: {
      en: [
        'Watch without playing: the Host can copy a 👁 watch link in the Host panel. Anyone who opens it joins as a spectator (no nickname needed): they see the wheel, the table, the players and the chat, but cannot bet or type. The player count shows how many people are watching.',
        'The Host can turn spectators on or off with the "Allow spectators" switch.',
        'Achievements: 8 small awards such as First win, Hot streak, Bullseye, All in, Comeback, Jackpot, Stayer and King of the table. When someone earns one, everyone sees a short message. Open a player\'s statistics to see which achievements they have.',
      ],
      nl: [
        'Meekijken zonder mee te spelen: de Host kan in het Host-paneel een 👁 kijk-link kopiëren. Wie die opent komt binnen als kijker (geen bijnaam nodig): je ziet het wiel, de tafel, de spelers en de chat, maar kunt niet inzetten of typen. Bij het aantal spelers staat hoeveel mensen er meekijken.',
        'De Host zet kijkers aan of uit met de schakelaar "Meekijkers toestaan".',
        'Prestaties: 8 kleine beloningen zoals Eerste winst, Hot streak, Voltreffer, Alles op één kaart, Terug uit de put, Jackpot, Doorzetter en Koning van de tafel. Wie er een verdient, ziet iedereen kort in een melding. Open de statistieken van een speler om te zien welke prestaties die heeft.',
      ],
    },
  },
  {
    id: '2026-11-08-players',
    date: '2026-11-08',
    title: { en: 'Avatars, leaderboard, stats and saved settings', nl: 'Avatars, ranglijst, statistieken en opgeslagen instellingen' },
    items: {
      en: [
        'Pick your own avatar (emoji) and color: on the start screen next to your nickname, or in the room with the ✎ button. Your color also appears on your chips on the table.',
        'The players list is now a leaderboard: richest on top, with 🥇🥈🥉 and ▲▼ arrows showing how far someone moved up or down after each round. The 🏆 Leaderboard button opens a podium with everyone\'s chips, result vs the start and win percentage.',
        'Click a player to see their statistics: rounds played, wins, biggest win and loss, total staked, total result and favorite bets.',
        'Host: save your room settings under a name and load them again with one click in any new room (stored in your browser).',
      ],
      nl: [
        'Kies je eigen avatar (emoji) en kleur: op het startscherm naast je bijnaam, of in de kamer met de ✎-knop. Je kleur zie je ook op je fiches op de tafel.',
        'De spelerslijst is nu een ranglijst: de rijkste bovenaan, met 🥇🥈🥉 en ▲▼-pijltjes die laten zien hoeveel plaatsen iemand na elke ronde omhoog of omlaag ging. De knop 🏆 Ranglijst opent een podium met ieders fiches, resultaat t.o.v. de start en winstpercentage.',
        'Klik op een speler om de statistieken te zien: rondes gespeeld, gewonnen, grootste winst en verlies, totaal ingezet, totaal resultaat en favoriete inzetten.',
        'Host: bewaar je kamerinstellingen onder een naam en laad ze met één klik in elke nieuwe kamer (bewaard in je browser).',
      ],
    },
  },
  {
    id: '2026-11-08-startfix',
    date: '2026-11-08',
    title: { en: 'Start screen fix', nl: 'Startscherm aangepast' },
    items: {
      en: [
        'Fixed the "Room code" field on the start screen, which looked cramped in English.',
      ],
      nl: [
        'Het veld "Kamercode" op het startscherm is aangepast: het zag er in het Engels te krap uit.',
      ],
    },
  },
  {
    id: '2026-11-07-lang',
    date: '2026-11-07',
    title: { en: 'Language switch & update log', nl: 'Taalknop & update log' },
    items: {
      en: [
        'New EN | NL button: switch the whole game between English and Dutch. English is the default and your choice is remembered.',
        'New "Update log" button (bottom-left) that shows what changed.',
      ],
      nl: [
        'Nieuwe EN | NL-knop: wissel het hele spel tussen Engels en Nederlands. Engels is de standaard en je keuze wordt onthouden.',
        'Nieuwe "Update log"-knop (linksonder) die laat zien wat er veranderd is.',
      ],
    },
  },
  {
    id: '2026-11-07-launch',
    date: '2026-11-07',
    title: { en: 'Launch', nl: 'Lancering' },
    items: {
      en: [
        'Multiplayer roulette: create a room, share the 5-character code or link, and play together. Virtual chips only.',
        'All bet types (straight, split, street, corner, six line, column, dozen, red/black, even/odd, low/high), European and American wheel.',
        'Host panel: start rounds, close betting, spin, pause, automatic mode, settings, give or take chips, mute, kick, ban, hand over the Host role, lock or close the room.',
        'Chat, sound effects, hot/cold numbers, and a table that fits phones.',
        'Lost connection? Come back within 2 minutes and keep your chips.',
      ],
      nl: [
        'Multiplayer roulette: maak een kamer, deel de code van 5 tekens of de link en speel samen. Alleen virtuele fiches.',
        'Alle inzettypes (enkel nummer, split, street, corner, six line, kolom, dozijn, rood/zwart, even/oneven, laag/hoog), Europees en Amerikaans wiel.',
        'Host-paneel: rondes starten, inzetten sluiten, draaien, pauzeren, automatische modus, instellingen, fiches geven of afnemen, dempen, kicken, verbannen, Host-rol overdragen, kamer vergrendelen of sluiten.',
        'Chat, geluidseffecten, hot/koude nummers en een tafel die op telefoons past.',
        'Verbinding weg? Kom binnen 2 minuten terug en houd je fiches.',
      ],
    },
  },
];
