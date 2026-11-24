# 🏸 Birdie

**More play, less searching.**

A personal PWA that shows every UniMelb badminton court in one 30-minute time × court matrix. Tap a green cell to jump straight to the official PerfectMind booking page for that court and time.

Birdie only reads public availability. Login, booking and payment all happen on the official site.

## Development

```bash
npm install
cp .env.example .env.local      # then set BIRDIE_ACCESS_KEY
npm run dev                     # http://localhost:3000
npm test                        # unit tests
npm run typecheck
npm run icons                   # regenerate PWA icons from 🏸 (macOS)
```

Generate an access key with `openssl rand -base64 32`. The first time you open the app on a device, it asks for this key and stores it in LocalStorage.

## Deploy (Vercel)

1. Import the GitHub repo into Vercel.
2. Set the `BIRDIE_ACCESS_KEY` environment variable (Production).
3. Deploy. `vercel.json` pins Functions to `syd1` (Sydney).
4. On iPhone, open the URL in Safari → Share → **Add to Home Screen**, then enter the key once.

To rotate the key, change the env var and redeploy; devices will prompt again.

## How it works

```
iPhone PWA ──(Bearer key)──> /api/availability?date=YYYY-MM-DD ──> PerfectMind (anonymous session)
     └── tap green cell ──────────────────────────────────────────> official booking page
```

- `lib/perfectmind/`: anonymous session (cookies + anti-forgery token), facility list, availability, parsing, booking links
- `lib/matrix.ts`: cell status, Past, Free counts, freshness
- `app/api/availability/route.ts`: the only API; access-key protected, 30 s cache, request coalescing

## Phase 0 findings (verified 2026-11-24)

| Item | Result |
|---|---|
| Anonymous access from Node | ✅ Works: map page → cookies + token → `GetFacilities` → `FacilityAvailability` |
| Courts | 8: East A–D, West E–H, shown as A–H |
| Opening hours | 07:00–22:00, returned per day as `OpeningTime` / `ClosingTime` |
| Minimum booking | 30 min, starting every 30 min (`MIN_BOOKING_MINUTES = 30`) |
| Response semantics | `AvailableSpots` lists only bookable starts; missing slots inside opening hours are taken |
| Booking window | 14 days ahead; later days return `IsDisabled` spots (treated as unavailable) |
| Exact-slot link (Level 2) | `FacilityBooking?...&startDateTimeTicks=` (same as the official page). Anonymous visits redirect to `MemberSignIn`, keeping all parameters |

### Verified on device / in production (2026-11-24)

- [x] After logging in from a Birdie link, you land on the right court and time, ready to book (Level 2 works).
- [x] In the iPhone home-screen app (standalone), the official login persists between taps.
- [x] The deployed `syd1` function can reach PerfectMind (no datacenter IP blocking). Responses take about 5 s.

### Still open

- [ ] Same-day results: today's response was empty at 17:05. Confirm next morning whether that means fully booked or no same-day online booking.
