# Roulette Royale — multiplayer roulette met kamercodes

Speel roulette met vrienden: één persoon maakt een kamer en deelt de code of link, de rest joint.
**Alleen virtuele fiches. Geen echt geld, geen betalingen.**

Het project heeft **geen externe pakketten** nodig (geen `npm install`). Alleen Node.js 18 of nieuwer.

## Snel starten

```bash
node server.js        # of: npm start
```

Open daarna <http://localhost:3000>. Wil je lokaal testen zonder inloggen? Start dan met `REQUIRE_LOGIN=0 node server.js`.

1. **Maak een account** (gebruikersnaam + wachtwoord) of log in. Zonder account kun je niet spelen of een kamer maken; meekijken via een kijk-link kan wel zonder account.
2. Klik **Maak kamer**. Jij bent nu de Host (je bijnaam is je gebruikersnaam).
3. Anderen openen dezelfde site, loggen in, vullen de 5-letterige **kamercode** in (of openen je **link**, dan staat de code al ingevuld) en klikken **Join**.
4. Als Host klik je in het Host-paneel op **Start ronde**. Iedereen zet fiches in op de tafel; daarna draait het wiel.

### Testen met meerdere tabbladen
Open meerdere tabbladen op `http://localhost:3000`. Elk tabblad is een eigen speler (de sessie staat per tabblad, dus tabbladen komen elkaar niet in de weg). Een refresh in hetzelfde tabblad brengt je terug met je saldo. Sluit je een tabblad en open je een nieuw, dan verschijnt op het startscherm een knop **"Terug naar kamer …"**.

### Inloggen (accounts)
- Iedereen die **speelt of een kamer host** moet ingelogd zijn met een **gebruikersnaam + wachtwoord** (3-16 tekens: letters, cijfers, _). **Kijkers** met een kijk-link hebben geen account nodig.
- Het account is alleen je **identiteit**: je bijnaam in de kamer is vast je gebruikersnaam (niemand kan jouw naam gebruiken) en een ban hoort bij je account. Fiches en statistieken worden niet bij het account bewaard.
- Je blijft 30 dagen ingelogd in deze browser (knop **Uitloggen** op het startscherm).
- Wachtwoord vergeten? Dat kan nog niet worden hersteld (er is geen e-mail gekoppeld); maak dan een nieuw account.
- **Opslag:** accounts, munten en aankopen worden bewaard in een gratis **Upstash Redis**-database (stel `UPSTASH_REDIS_REST_URL` en `UPSTASH_REDIS_REST_TOKEN` in). Zonder die twee variabelen valt de server terug op een bestand (`data/accounts.json`); op een host met tijdelijk bestandssysteem, zoals de gratis Render, **verdwijnt dat bij elke update of herstart**. De server meldt dit bij het opstarten, het startscherm toont dan een waarschuwing en `/health` toont `accounts=file` (bij een werkende Upstash staat er `accounts=upstash`).

### Winkel: munten, kleuren en emojis
- Emojis en kleuren voor je avatar en fiches moet je **kopen met munten 🪙**. Gratis zijn alleen je beginletter en de kleur die de tafel je automatisch geeft.
- Munten verdien je door te spelen: **15** per ronde waarin je inzet, **+15** bij winst en **50** per prestatie (max. **400 per dag**). Ze horen bij je account.
- Prijzen: kleuren 100, gewone emojis 150, andere emojis 300, 👑 💎 🔥 750 (in `public/rules.js`; de beloningen staan bovenin `lib/game.js`).
- Open de keuzelijst (avatar-knop op het startscherm of ✎ in de kamer): vergrendelde items tonen hun prijs, tik erop om te kopen. Het item wordt meteen gebruikt.
- Zonder verplicht inloggen (`REQUIRE_LOGIN=0`) is alles gratis en is er geen winkel.

### Taal
Bovenin (en op het startscherm) staat een **EN | NL**-knop. Standaard is het Engels; de keuze wordt onthouden. Vertalingen staan in `public/i18n.js`; de server blijft Nederlands sturen en de website vertaalt die berichten.

### Avatar, ranglijst en statistieken
- Kies een **avatar** (emoji) en **kleur** op het startscherm (knop naast de bijnaam) of in de kamer met de **✎**-knop. De keuze wordt in je browser onthouden. Je kleur staat ook als rand om je fiches op de tafel.
- De spelerslijst is een **ranglijst**: de rijkste bovenaan, met 🥇🥈🥉 en ▲▼ voor de plaatsverandering na de laatste ronde. De knop **🏆 Ranglijst** toont een podium met fiches, resultaat t.o.v. de start en winstpercentage.
- **Klik op een speler** voor statistieken: rondes, gewonnen, grootste winst/verlies, totaal ingezet, totaal resultaat en favoriete inzetten. De Host zet statistieken terug met "reset speler" of "iedereen resetten".
- Onderaan de statistieken staan **8 prestaties** (Eerste winst, Hot streak, Voltreffer, Alles op één kaart, Terug uit de put, Jackpot, Doorzetter, Koning van de tafel). Wie er een haalt, geeft een korte melding voor de hele kamer. Prestaties blijven staan, ook na een reset van de stats.

### Meekijken
Het Host-paneel heeft een knop **👁 Kopieer kijk-link** (`?watch=SLEUTEL`). De link heeft een eigen geheime sleutel en bevat de kamercode niet; kijkers krijgen de code ook nooit van de server, dus ze kunnen niet als speler joinen of wisselen. Wie de link opent, komt zonder bijnaam binnen als **kijker**: wiel, tafel, spelers en chat zijn zichtbaar, maar inzetten, chatten en Host-acties zijn niet mogelijk (de server weigert alles behalve statistieken bekijken en verlaten). Kijkers tellen niet mee voor de limiet van 12 spelers (max. 30 kijkers), staan niet in de ranglijst en worden bij de spelers als "👁 n" geteld. Kijken kan ook in een vergrendelde kamer (vergrendelen houdt alleen nieuwe spelers tegen). De Host kan kijkers uitzetten met de schakelaar **Meekijkers toestaan**; dan worden ze weggestuurd en nieuwe kijkers geweigerd. Met **↻ Nieuwe kijk-link** werkt de oude link niet meer en worden alle kijkers weggestuurd.

### Streamer-modus
De **🎥-knop** (bovenbalk en startscherm) verbergt de kamercode in beeld (•••••), houdt hem uit de adresbalk en de tabtitel en toont het codeveld als wachtwoord. De keuze wordt in je browser onthouden; Kopieer code/link blijven werken. Tip voor streamers: zet de modus aan, vergrendel de kamer zodra je vrienden binnen zijn, en deel alleen de kijk-link.

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

*Het paneel klapt met het ▾-driehoekje in tot een klein balkje en weer open; je keuze wordt in je browser onthouden.*


- Ronde starten, inzetten sluiten, wiel draaien, **+10 seconden**, pauzeren/hervatten
- **Automatisch** aan/uit (rondes lopen vanzelf door, of alles handmatig)
- Inzettijd, startfiches, min/max inzet per vak, **herstart-bonus** voor spelers die blut zijn
- Variant: Europees of Amerikaans (alleen tussen rondes)
- **Ik speel zelf mee** aan/uit (uit = croupier/toeschouwer)
- Chat aan/uit, kamer **vergrendelen**, **inzetten van anderen tonen** aan/uit (kleine bolletjes in de kleur van de speler op de tafel)
- Per speler (knop ⚙): fiches geven/afnemen/instellen, resetten, dempen, **Host-rol overdragen**, kicken, verbannen
- Iedereen resetten naar startsaldo, code/link kopiëren, **kamer sluiten**
- **Opgeslagen instellingen:** bewaar je kamerinstellingen onder een naam (tot 8, alleen in jouw browser) en laad ze met één klik in een nieuwe kamer. Variant en min/max inzet laden alleen tussen rondes.

Als de Host 60 seconden wegvalt, gaat de Host-rol automatisch naar de speler die het langst in de kamer zit.

## Regels van de kamer

- Code van 5 tekens, zonder verwarrende tekens (geen O/0/I/1). Maximaal 12 spelers.
- Dubbele bijnamen worden geweigerd. Bijnamen zijn max. 16 tekens.
- Weg of refresh? Binnen 2 minuten terugkeren met hetzelfde saldo (sessie-token).
- Join je midden in een ronde, dan speel je mee vanaf de volgende.
- Geen fiches meer? Je blijft in de kamer als toeschouwer tot de Host fiches geeft (of de herstart-bonus aan staat).
- Lege kamers worden na 10 minuten verwijderd.

## Online zetten zonder eigen server (gratis, geen IP delen)

Zo draait de app altijd en krijg je een eigen link als `https://roulette-royale.onrender.com` om te delen. Je eigen computer en IP komen er niet aan te pas.

1. Zet de map op GitHub (nieuw repository, bestanden uploaden via "Add file > Upload files" werkt ook).
2. Maak een gratis account op <https://render.com> en kies **New > Blueprint** (of **New > Web Service**) en koppel je repository.
3. Bij Blueprint pakt Render `render.yaml` vanzelf. Bij Web Service vul je in: Build command leeg of `echo ok`, Start command `node server.js`, plan **Free**.
4. Na een minuutje krijg je de link. Open die, maak een kamer en deel de link of de code.

Goed om te weten over de gratis variant van Render:
- De dienst gaat slapen na 15 minuten zonder verkeer en is na ongeveer een minuut weer wakker als iemand de link opent. Tijdens een spel houden de berichten hem wakker (de app stuurt zelf ook elke 2 minuten een ping).
- Slaapt de dienst, dan zijn open kamers weg. De eerste die daarna opent, wacht even en maakt een nieuwe kamer.
- Er zijn 750 gratis uren per maand, genoeg voor een dienst die de hele maand aanstaat.

Andere hosts die WebSockets ondersteunen (Railway, Fly.io, Koyeb of een eigen VPS) werken ook: start command `node server.js`, poort uit `PORT`.

## Technische details voor hosting

De app is één Node-proces met WebSockets. Kies een host die WebSockets ondersteunt (Render, Railway en Fly doen dat).

- **Build command:** leeg laten (er is niets te installeren)
- **Start command:** `node server.js`
- De poort wordt uit de omgevingsvariabele `PORT` gelezen.
- Gebruik HTTPS: de client schakelt dan zelf over op `wss://`.
- Gezondheidscontrole: `/health`

Omgevingsvariabelen (allemaal optioneel): `PORT`, `HOST`, `ALLOWED_ORIGINS` (komma-gescheiden, alleen nodig als de pagina vanaf een andere domeinnaam dan de server wordt geladen), `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (opslag voor accounts, aanbevolen), `ACCOUNTS_FILE` (ander pad voor het accountbestand) en `REQUIRE_LOGIN=0` (inloggen uitzetten, bv. voor lokaal testen).

**Accounts op Render (belangrijk):** Render wist bij elke upload en herstart alle bestanden, dus accounts moeten in een externe database staan.
1. Maak een gratis account op <https://upstash.com> en klik bij *Redis* op **Create Database** (naam bv. `roulette`, regio in Europa, gratis plan).
2. Open de database en zoek de **REST API**-gegevens: `UPSTASH_REDIS_REST_URL` en `UPSTASH_REDIS_REST_TOKEN`.
3. Zet beide bij Render onder *Environment* (service > Environment > Add Environment Variable) en sla op; Render start opnieuw op.
4. Controleer: open `https://jouw-site/health`. Daar moet `accounts=upstash` staan. Staat er `accounts=file` of `accounts=upstash-error`, dan zijn de gegevens niet goed ingevuld.

**Let op:** kamers staan in het geheugen. Bij een herstart van de server zijn ze weg, en draai maar **één instantie** (geen load balancer met meerdere kopieën).

## Beveiliging in het kort

- De server beslist alles: uitslag (`crypto.randomInt`, tenzij de Host als spelleider zelf een getal vastzet), saldo's, uitbetalingen en timers. De browser kan niets vervalsen.
- Alle invoer wordt server-side gecontroleerd (bedragen, inzetsleutels, fase, rechten).
- Bijnamen en chat worden in de browser nooit als HTML getoond (geen XSS). Content-Security-Policy staat aan.
- WebSockets controleren de Origin, hebben een maximale berichtgrootte (4 KB), rate limiting en een heartbeat.
- Wachtwoorden worden nooit bewaard: alleen een **scrypt-hash** met eigen salt. Een login geeft een lange willekeurige sessiesleutel (30 dagen); de server bewaart alleen de SHA-256 ervan. Pogingen om in te loggen of accounts te maken worden per IP en per account afgeremmd.
- Verbannen werkt op bijnaam, sessie **en IP-adres** (per kamer). De Host ziet een lijst "Verbannen spelers" en kan een ban opheffen; die lijst toont geen IP's. Mensen op hetzelfde netwerk delen een IP, dus één ban kan anderen op dat netwerk ook blokkeren (dan: ban opheffen). Lokale adressen (127.0.0.1) worden nooit op IP verbannen. Een VPN of ander netwerk omzeilt een IP-ban; wil je dat niet, vergrendel dan de kamer.

## Tests

```bash
npm test      # of: node test/run.js   (Node 22+ voor de netwerktests)
```

Dat draait 427 controles: alle inzettypes en uitbetalingen, host-rechten, pauze, reconnect, host-overdracht, spam/te grote berichten, Origin-controle, kijkers, prestaties, bans, accounts/inloggen, de winkel en een echte multiplayer-ronde over WebSockets.

## Bestanden

```
server.js          HTTP-server voor de site + WebSocket-endpoint (/ws)
lib/game.js        alle spellogica: kamers, rondes, host-acties, uitbetalingen
lib/ws.js          eigen kleine WebSocket-server (RFC 6455), geen pakketten
lib/accounts.js    accounts: wachtwoord-hash, sessies, opslag (Upstash of bestand)
public/rules.js    inzetten + uitbetalingen (gedeeld door server en browser)
public/index.html  pagina's
public/style.css   casino-thema
public/app.js      client: tafel, wiel, chat, host-paneel, geluid, ranglijst, profiel
public/i18n.js     vertalingen (EN/NL)
public/changelog.js  de Update log op de site
test/              testsuite
```

## Ideeën voor later

Extra inzettypes (bv. buurnummers/voisins, trio's), database zodat kamers een herstart overleven, wachtwoord herstellen.
