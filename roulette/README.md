# Roulette Royale — multiplayer roulette met kamercodes

Speel roulette met vrienden: één persoon maakt een kamer en deelt de code of link, de rest joint.
**Alleen virtuele fiches. Geen echt geld, geen betalingen.**

Het project heeft **geen externe pakketten** nodig (geen `npm install`). Alleen Node.js 18 of nieuwer.

## Snel starten

```bash
node server.js        # of: npm start
```

Open daarna <http://localhost:3000>.

1. Vul een bijnaam in en klik **Maak kamer**. Jij bent nu de Host.
2. Anderen openen dezelfde site, vullen bijnaam + de 5-letterige **kamercode** in (of openen je **link**, dan staat de code al ingevuld) en klikken **Join**.
3. Als Host klik je in het Host-paneel op **Start ronde**. Iedereen zet fiches in op de tafel; daarna draait het wiel.

### Testen met meerdere tabbladen
Open meerdere tabbladen op `http://localhost:3000`. Elk tabblad is een eigen speler (de sessie staat per tabblad, dus tabbladen komen elkaar niet in de weg). Een refresh in hetzelfde tabblad brengt je terug met je saldo. Sluit je een tabblad en open je een nieuw, dan verschijnt op het startscherm een knop **"Terug naar kamer …"**.

## Spelregels

Europees (0) of Amerikaans (0 en 00), te kiezen door de Host tussen rondes.

| Inzet | Uitbetaling |
|---|---|
| Enkel nummer | 35:1 |
| Split (2 nummers) | 17:1 |
| Street (3) | 11:1 |
| Corner (4) en "eerste vier" 0-1-2-3 (alleen Europees) | 8:1 |
| Six line (6) | 5:1 |
| Kolom, dozijn | 2:1 |
| Rood/zwart, even/oneven, 1-18 / 19-36 | 1:1 |

Bij 0 (en 00) verliezen alle buiteninzetten. Klik op een vakje of op de **ronde klikpunten tussen vakjes** (splits, streets, corners, six lines). Knoppen: **Ongedaan**, **Wis alles**, **Herhaal vorige**, **Verdubbel**.

## Wat kan de Host?

Alles zit in het **Host-paneel** (alleen zichtbaar voor de Host; de server controleert de rechten):

- Ronde starten, inzetten sluiten, wiel draaien, **+10 seconden**, pauzeren/hervatten
- **Automatisch** aan/uit (rondes lopen vanzelf door, of alles handmatig)
- Inzettijd, startfiches, min/max inzet per vak, **herstart-bonus** voor spelers die blut zijn
- Variant: Europees of Amerikaans (alleen tussen rondes)
- **Ik speel zelf mee** aan/uit (uit = croupier/toeschouwer)
- Chat aan/uit, kamer **vergrendelen**
- Per speler (knop ⚙): fiches geven/afnemen/instellen, resetten, dempen, **Host-rol overdragen**, kicken, verbannen
- Iedereen resetten naar startsaldo, code/link kopiëren, **kamer sluiten**

Als de Host 60 seconden wegvalt, gaat de Host-rol automatisch naar de speler die het langst in de kamer zit.

## Regels van de kamer

- Code van 5 tekens, zonder verwarrende tekens (geen O/0/I/1). Maximaal 12 spelers.
- Dubbele bijnamen worden geweigerd. Bijnamen zijn max. 16 tekens.
- Weg of refresh? Binnen 2 minuten terugkeren met hetzelfde saldo (sessie-token).
- Join je midden in een ronde, dan speel je mee vanaf de volgende.
- Geen fiches meer? Je blijft in de kamer als toeschouwer tot de Host fiches geeft (of de herstart-bonus aan staat).
- Lege kamers worden na 10 minuten verwijderd.

## Online zetten (Render, Railway, Fly, eigen server)

De app is één Node-proces met WebSockets. Kies een host die WebSockets ondersteunt (Render, Railway en Fly doen dat).

- **Build command:** leeg laten (er is niets te installeren)
- **Start command:** `node server.js`
- De poort wordt uit de omgevingsvariabele `PORT` gelezen.
- Gebruik HTTPS: de client schakelt dan zelf over op `wss://`.
- Gezondheidscontrole: `/health`

Omgevingsvariabelen (allemaal optioneel): `PORT`, `HOST`, `ALLOWED_ORIGINS` (komma-gescheiden, alleen nodig als de pagina vanaf een andere domeinnaam dan de server wordt geladen).

**Let op:** kamers staan in het geheugen. Bij een herstart van de server zijn ze weg, en draai maar **één instantie** (geen load balancer met meerdere kopieën).

## Beveiliging in het kort

- De server beslist alles: uitslag (`crypto.randomInt`), saldo's, uitbetalingen en timers. De browser kan niets vervalsen.
- Alle invoer wordt server-side gecontroleerd (bedragen, inzetsleutels, fase, rechten).
- Bijnamen en chat worden in de browser nooit als HTML getoond (geen XSS). Content-Security-Policy staat aan.
- WebSockets controleren de Origin, hebben een maximale berichtgrootte (4 KB), rate limiting en een heartbeat.
- Verbannen werkt op bijnaam + sessie en is dus "best effort": wie een andere bijnaam kiest en een nieuwe sessie start, komt er weer in. Wil je dat niet, vergrendel dan de kamer.

## Tests

```bash
npm test      # of: node test/run.js   (Node 22+ voor de netwerktests)
```

Dat draait 222 controles: alle inzettypes en uitbetalingen, host-rechten, pauze, reconnect, host-overdracht, spam/te grote berichten, Origin-controle en een echte multiplayer-ronde over WebSockets.

## Bestanden

```
server.js          HTTP-server voor de site + WebSocket-endpoint (/ws)
lib/game.js        alle spellogica: kamers, rondes, host-acties, uitbetalingen
lib/ws.js          eigen kleine WebSocket-server (RFC 6455), geen pakketten
public/rules.js    inzetten + uitbetalingen (gedeeld door server en browser)
public/index.html  pagina's
public/style.css   casino-thema
public/app.js      client: tafel, wiel, chat, host-paneel, geluid
test/              testsuite
```

## Ideeën voor later

Ranglijst per kamer, accounts, extra inzettypes (bv. buurnummers/voisins, trio's), eigen fichekleuren, spelers-avatars, opgeslagen kamerinstellingen, database zodat kamers een herstart overleven.
