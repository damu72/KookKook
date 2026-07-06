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

## Frontend (5173)

Vite + React, State-basierter Router (keine Router-Dependency), Demo-User-Umschalter
oben rechts (in `localStorage` gemerkt, keine Auth). Screens:

- **Entdecken** – Liste offener (veröffentlichter) Kochabende.
- **Topic Detail** – öffentliche Details + Button „Teilnahme anfragen".
- **Kochabend anlegen** – Formular; legt Topic **und** Kapazität an, damit der
  Flow (anfragen → akzeptieren → Platz reservieren) sofort funktioniert.
- **Host-Dashboard** – Gastgeber sieht Anfragen seiner Abende, akzeptiert/lehnt ab.
- **Meine Anfragen** – Gast sieht eigene Anfragen mit Status, kann zurückziehen.
- **Confirmed View** – bestätigte Gäste sehen private Adresse & Ankunfts-Hinweis
  (via `private-view` des Topic Service).

Bewusst **ohne** Likes, Follower oder Feed.

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

Verwaltet Teilnahme-Anfragen als Zustandsmaschine:

```
REQUESTED --accept--> ACCEPTED   (Host; Platz im Capacity Service reserviert)
REQUESTED --decline--> DECLINED  (Host)
REQUESTED --cancel--> CANCELLED  (Gast)
ACCEPTED  --cancel--> CANCELLED  (Gast; Reservierung wird freigegeben)
```

- `GET /health`
- `POST /participation-requests` – `{ topicId, guestUserId }` → Anfrage stellen
- `GET /topics/:topicId/participation-requests` – Anfragen eines Topics
- `GET /users/:userId/participation-requests` – Anfragen eines Gasts
- `POST /participation-requests/:id/accept` – `{ actingUserId }` (nur Host)
- `POST /participation-requests/:id/decline` – `{ actingUserId, reason? }` (nur Host)
- `POST /participation-requests/:id/cancel` – `{ actingUserId }` (nur Gast)

**Regeln:**
- Ein Gast darf pro Topic nur **eine aktive** Anfrage haben (aktiv = REQUESTED/ACCEPTED) → sonst `409`.
- Beim **Erstellen** wird der Trust Service (`can-interact`) geprüft; verweigert er, `403`.
  Der Trust-Check ist Pflicht – ist der Service nicht erreichbar, wird **nicht** erstellt (`502`).
- Nur der **Host** des Topics (aus dem Topic Service ermittelt) darf accept/decline; nur der **Gast** darf cancel → sonst `403`.
- Beim **Akzeptieren** reserviert der Capacity Service einen Platz. Ist kein Platz frei,
  **bleibt die Anfrage REQUESTED** und die Antwort ist `409` mit `reason: "NO_SEATS_AVAILABLE"`.
- Die Reservierung nutzt die Request-ID als **Idempotenz-Schlüssel**, sodass ein Retry bei
  transientem Verbindungsfehler keinen zweiten Platz belegt.

Cross-Service-URLs sind über `TOPIC_SERVICE_URL`, `TRUST_SERVICE_URL`,
`CAPACITY_SERVICE_URL` konfigurierbar.

### capacity-service (3003)

Verwaltet pro Topic eine Kapazität (`maxGuests`) und die Sitzplatz-Reservierungen.

- `GET /health`
- `POST /capacities` – `{ topicId, maxGuests }` (409 wenn bereits vorhanden)
- `GET /capacities/:topicId` – `{ topicId, maxGuests, reservedSeats, availableSeats }` (404 wenn nicht definiert)
- `POST /seat-reservations` – `{ topicId, userId, idempotencyKey? }` → legt eine Reservierung an.
  `409`, wenn keine Plätze mehr frei sind; `404`, wenn keine Kapazität definiert ist.
  Wird `idempotencyKey` mitgegeben und existiert dazu schon eine aktive Reservierung,
  wird diese zurückgegeben (kein zweiter Platz) – macht Retries sicher.
- `POST /seat-reservations/:reservationId/release` – gibt eine Reservierung frei (idempotent).

**Invariante:** aktive Reservierungen ≤ `maxGuests` – auch bei gleichzeitigen
Requests. Die Logik hängt nur vom Port `CapacityRepository` ab
([domain.ts](apps/capacity-service/src/domain.ts)); die aktuelle
In-Memory-Implementierung serialisiert den kritischen Abschnitt
(„Plätze zählen → prüfen → anlegen") pro Topic über einen `KeyedMutex`.
Später kann ein Postgres-Repository denselben Port erfüllen (Transaktion mit
`SELECT … FOR UPDATE` bzw. Bedingung), ohne Server-/Routen-Code zu ändern.

### trust-service (3004)
- `GET /health`
- `GET /trust` – alle Kanten
- `GET /trust/:userId` – ausgehende/eingehende Kanten + Durchschnitt
- `PUT /trust` – `{ fromUserId, toUserId, score }` (0–100)
- `GET /can-interact?fromUserId=&toUserId=` – `{ canInteract, reason }`.
  Standardmäßig erlaubt; `false` bei unbekanntem User (`UNKNOWN_USER`) oder zu
  niedrigem Trust-Score (`LOW_TRUST`). Wird vom Participation Service genutzt.

## Hinweise

- Alle Daten liegen im Speicher und werden bei jedem Neustart neu geseedet.
- Services werden mit `tsx` direkt aus dem TypeScript-Quelltext ausgef�hrt (kein Build-Schritt n�tig).
- CORS ist offen, damit das Frontend die Services lokal erreichen kann.
