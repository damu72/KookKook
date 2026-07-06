# KookKook

TypeScript-Monorepo f�r KookKook. Ein Frontend und vier Fastify-Microservices,
alle mit In-Memory-Daten (noch keine Datenbank, keine Auth).

## Struktur

```
KookKook/
├── packages/
│   └── shared/                 # @kookkook/shared – Demo-User + gemeinsame Typen
└── apps/
    ├── frontend/               # Vite + React Dashboard (Port 5173)
    ├── topic-service/          # Themen/Koch-Events (Port 3001)
    ├── participation-service/  # Teilnahmen (Port 3002)
    ├── capacity-service/       # Pl�tze/Kapazit�t (Port 3003)
    └── trust-service/          # Vertrauens-Graph zwischen Usern (Port 3004)
```

## Voraussetzungen

- Node.js 18+ (getestet mit 18.16)
- npm 9+

## Setup

```bash
npm install
```

## Entwicklung

Alle Apps parallel starten:

```bash
npm run dev
```

Oder einzeln:

```bash
npm run dev:topic
npm run dev:participation
npm run dev:capacity
npm run dev:trust
npm run dev:frontend
```

Typen prüfen (alle Workspaces):

```bash
npm run typecheck
```

## Demo-User

In `@kookkook/shared` definiert und von allen Services genutzt:
`anna`, `ben`, `clara`, `david`.

## Services & Endpunkte

Jeder Service hat einen `GET /health`-Endpunkt.

### topic-service (3001)

Ein Topic hat: `id`, `hostUserId`, `title`, `description`, `cuisine`,
`startsAt`, `maxGuests`, `publicLocationLabel`, `privateAddress`,
`hostArrivalNote`, `status`.

- `GET /health`
- `GET /users` – Demo-User
- `POST /topics` – `{ hostUserId, title, description?, cuisine?, startsAt?, maxGuests?, publicLocationLabel?, privateAddress?, hostArrivalNote?, status? }`
- `GET /topics` – Liste (öffentliche Sicht)
- `GET /topics/:topicId` – einzelnes Topic (öffentliche Sicht)
- `GET /topics/:topicId/private-view?viewerUserId=...` – Sicht mit privaten Details

**Sichtbarkeit der sensiblen Felder** (`privateAddress`, `hostArrivalNote`):
- `GET /topics` und `GET /topics/:topicId` liefern sie **niemals** (auch die
  `POST`-Antwort nicht). Garantiert durch `toPublicTopic()` – der einzige Weg
  nach außen.
- `private-view` liefert `privateAddress`/`hostArrivalNote` nur, wenn der
  `viewerUserId` **Host** des Topics **oder akzeptierter Teilnehmer** ist –
  sonst sind beide Felder `null`. Zusätzlich enthält die Antwort ein
  `viewer`-Objekt (`isHost`, `isAcceptedParticipant`, `canSeePrivateDetails`).
- Die Teilnehmer-Prüfung erfolgt (MVP) per HTTP-Call zum Participation Service
  (`joined` = akzeptiert). Ist der Service nicht erreichbar, wird **fail-closed**
  reagiert: keine privaten Details. Ziel per `PARTICIPATION_SERVICE_URL`
  konfigurierbar.

### participation-service (3002)
- `GET /health`
- `GET /participations?topicId=&userId=`
- `POST /participations` – `{ topicId, userId, status? }`
- `DELETE /participations/:id`

### capacity-service (3003)
- `GET /health`
- `GET /capacities` · `GET /capacities/:topicId`
- `PUT /capacities/:topicId` – `{ maxSeats }`
- `POST /capacities/:topicId/reserve` – `{ delta }` (positiv = reservieren, negativ = freigeben)

### trust-service (3004)
- `GET /health`
- `GET /trust` – alle Kanten
- `GET /trust/:userId` – ausgehende/eingehende Kanten + Durchschnitt
- `PUT /trust` – `{ fromUserId, toUserId, score }` (0–100)

## Hinweise

- Alle Daten liegen im Speicher und werden bei jedem Neustart neu geseedet.
- Services werden mit `tsx` direkt aus dem TypeScript-Quelltext ausgef�hrt (kein Build-Schritt n�tig).
- CORS ist offen, damit das Frontend die Services lokal erreichen kann.
