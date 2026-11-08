/*
 * changelog.js — de "Update log" op de site.
 * Nieuwe update toevoegen? Zet een nieuw blok BOVENAAN de lijst (nieuwste eerst).
 * `id` moet uniek zijn: zodra die verandert, ziet iedereen weer het rode bolletje op de knop.
 */
window.CHANGELOG = [
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
