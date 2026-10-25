# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **NRI Adult Children (Clients)**: Indians living overseas (USA, UK, Canada, UAE, Singapore, etc.) who carry deep emotional worry and financial responsibility for their aging parents living alone or semi-independently in Indian cities. They need high-trust, prompt visibility, reliable verification, and transparent escrow funding in foreign currency (USD, EUR, GBP, AED, CAD, SGD) or INR.
- **Aging Parents in India (Recipients)**: Seniors living in India needing compassionate, respectful assistance with medical appointments, diagnostic pickups, home safety repairs, daily errands, and emergency companionship without feeling patronized or burdened by complex technology.
- **Ground Care Partners (Field Associates)**: Verified local service partners and healthcare assistants across Indian cities who receive task assignments, navigate to parents' residences, verify arrivals via 6-digit OTP, submit photo proof of work, and communicate in their preferred regional language (English, Telugu, Hindi, Tamil, Kannada).
- **Operations & Support Admins**: Central triage and dispatch controllers at `admin@familyhubs.in` who monitor telemetry, resolve escrow disputes, review partner KYC submissions, and handle one-touch emergency SOS dispatches.

## Product Purpose

FamilyHubs exists to give expatriate children absolute peace of mind by providing a managed, high-trust concierge and eldercare platform for their parents back home. Success means an NRI daughter or son thousands of miles away can book essential care within 60 seconds, see live verified proof of their parent being cared for with warmth and dignity, and know that emergency response is instantaneous and guaranteed.

## Positioning

Unlike unmanaged gig-worker marketplaces or faceless task apps, FamilyHubs combines **escrow-secured funding**, **mandatory two-way OTP and GPS verification**, and **multilingual ground concierge service** with a dedicated human care advocate overseeing every single booking from dispatch to completion.

## Operating Context

- Cross-timezone operation: Expatriates operating in North America, Europe, or Southeast Asia coordinating tasks during Indian standard daytime (IST).
- Urgent vs Scheduled rhythms: Ranging from scheduled weekly medicine runs and companionship walks to urgent emergency clinic transfers.
- Multi-device, multi-surface access: Desktop web for detailed parent profile setup, billing and records review; mobile web for fast on-the-go notifications, live tracking, and field partner check-in.

## Capabilities and Constraints

- **3-Role Strict Domain Separation**:
  - `CLIENT` (Family User) at `familyhubs.in` (port 3001).
  - `PARTNER` (Field Caregiver) at `partner.familyhubs.in` (port 3003).
  - `ADMIN` (Ops Console) at `ops.familyhubs.in` (port 3002).
- **Two-Factor & Email OTP Verification**: Strict 6-digit OTP verification challenges on authentication and partner task check-ins.
- **Financial Escrow & PIN Security**: Escrow funds locked safely upon booking and released only upon client approval or admin verification. One-click platform emergency freeze.
- **Live Telemetry & Geolocation**: WebSocket event streaming (`/ws/events`), real-time partner GPS coordinate updates, and Leaflet interactive map route playback.
- **Silent Experience Policy**: Audible chimes and sound effects are permanently disabled to maintain calm dignity.

## Brand Commitments

- **Name**: FamilyHubs (`familyhubs.in`)
- **Tone & Voice**: Reassuring, empathetic, dignified, authoritative, and filial. Respectful of Indian family values, culture, and familial duty (*Seva*).
- **Visual Identity World**: Warm Editorial & Heritage Care. Deep terracotta and saffron warm accents (`#C85A17`, `#E07A5F`), warm sand, ivory, and cream grounds (`#FAF8F5`, `#F5F1EB`), deep rich charcoal/ink typography (`#1C1917`, `#292524`), and forest emerald reassurance indicators (`#2A6A4E`).
- **No AI Slop / Anti-patterns**: Abolish sterile generic gray cards, neon blue/purple gradients, cards nested inside cards, generic Inter/system sans display text, and kicker label soup.

## Evidence on Hand

- Fully operational full-stack TypeScript/React monorepo with Express backend, better-sqlite3 database with WAL mode, and WebSocket infrastructure.
- Complete functional models for Task booking, Parent Profiles (Pan-India addresses, emergency contacts, medical records), Partner Verification Logs with photo proof, and Escrow ledgers.
- Tested authentication suites validating 3-role segregation and 6-digit OTP challenges.

## Product Principles

1. **Dignity Over Dependency**: Treat aging parents as revered elders, never as helpless patients. Design interfaces that radiate care, respect, and familial honor.
2. **Clarity Over Clutter**: NRI adult children check in between busy work schedules and across timezones. Every status, update, and photo proof must be immediately scannable and unambiguous.
3. **Total Transparency & Trust**: Every rupee and dollar is tracked in clear escrow; every partner check-in requires physical verification and cryptographic or OTP proof.
4. **Resonant Warmth Over Sterile Utility**: Care is deeply personal. Surfaces should feel crafted, humane, and rooted in rich cultural reassurance rather than like a cold logistics spreadsheet.

## Accessibility & Inclusion

- Multi-language support for ground partners (English, Telugu, Hindi, Tamil, Kannada) with high-contrast touch targets for mobile field operation.
- Generous typography scale and WCAG AAA/AA compliant contrast for readability across various lighting and device conditions.
