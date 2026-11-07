/*
 * changelog.js — de "Update log" op de site.
 * Nieuwe update toevoegen? Zet een nieuw blok BOVENAAN de lijst (nieuwste eerst).
 * `id` moet uniek zijn: zodra die verandert, ziet iedereen weer het rode bolletje op de knop.
 */
window.CHANGELOG = [
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
