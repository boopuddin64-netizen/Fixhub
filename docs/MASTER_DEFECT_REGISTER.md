# Fix Hub Master Defect Register

## P1 — Customer Foundation

- **ID**: DEF-P1-001
  - **Phase**: P1
  - **Severity**: LOW
  - **Area**: Customer Home / Hero Layout
  - **Description**: Home screen may be visually dense with multiple overlapping discovery cards and badges.
  - **Current behavior**: Home view features extensive quick action cards, saved devices, top technicians, and promotional badges simultaneously.
  - **Expected behavior**: Streamlined, highly focused entry point prioritizing active repair status and device repair initiation.
  - **Status**: ACTIVE
  - **Recommended fix phase**: Phase 8 (UX Polish)

- **ID**: DEF-P1-002
  - **Phase**: P1
  - **Severity**: MEDIUM
  - **Area**: Copywriting / Marketing Claims
  - **Description**: Phrases asserting guaranteed escrow protection or unsupported technician certifications in banners.
  - **Current behavior**: Some UI banners make blanket statements regarding guarantees before verification or escrow completion.
  - **Expected behavior**: Accurate, legally sound language reflecting vetted marketplace procedures and pending payment states.
  - **Status**: ACTIVE
  - **Recommended fix phase**: Phase 8 (UX & Copy Polish)

- **ID**: DEF-P1-003
  - **Phase**: P1
  - **Severity**: LOW
  - **Area**: Device Catalog
  - **Description**: Catalog factual-quality coverage for older or niche African device models.
  - **Current behavior**: Catalog covers major Apple, Samsung, Xiaomi, Tecno, Infinix, Oppo models; older regional variants lack high-resolution asset images.
  - **Expected behavior**: Graceful fallback illustration and verified device database specs.
  - **Status**: ACTIVE
  - **Recommended fix phase**: Phase 8 (Catalog Polish)

- **ID**: DEF-P1-004
  - **Phase**: P1
  - **Severity**: LOW
  - **Area**: Gesture Container
  - **Description**: Refresh behavior may rely on button click or top drag rather than standard native pull-to-refresh on certain mobile web browsers.
  - **Current behavior**: GestureContainer handles touch drag, but standard overscroll-behavior can conflict with mobile Safari.
  - **Expected behavior**: Universal pull-to-refresh with optical haptic and indicator feedback.
  - **Status**: ACTIVE
  - **Recommended fix phase**: Phase 8 (UX Polish)

---

## P2 — Repair Request

- **ID**: DEF-P2-001
  - **Phase**: P2
  - **Severity**: MEDIUM
  - **Area**: Voice Note & Media Evidence Storage
  - **Description**: Voice note and uploaded photo evidence currently support inline base64/data URLs in addition to file uploads.
  - **Current behavior**: While `/repairs/attachments/upload` persists files to disk, client-side drafts or fallback payloads may embed base64 strings.
  - **Expected behavior**: All media attachments stored exclusively as private attachment references via signed/authenticated storage endpoints.
  - **Status**: ACTIVE
  - **Recommended fix phase**: Phase 9 (Security Hardening)

- **ID**: DEF-P2-002
  - **Phase**: P2
  - **Severity**: MEDIUM
  - **Area**: Attachment Security & Quota Enforcement
  - **Description**: Attachment upload endpoint limits file sizes, but virus scanning and mime-type magic-number inspection are basic.
  - **Current behavior**: Server checks file size (10MB max) and header extension/mime prefixes.
  - **Expected behavior**: Deep binary header validation, sandboxed processing, and dedicated storage buckets.
  - **Status**: ACTIVE
  - **Recommended fix phase**: Phase 9 (Security Hardening)

---

## P3 — Technician Discovery

- **ID**: DEF-P3-001
  - **Phase**: P3
  - **Severity**: LOW
  - **Area**: Location Copywriting
  - **Description**: Stale fallback references to "Computer Village, Ikeja" in default mock technician profiles.
  - **Current behavior**: Some technician seed records default to Ikeja / Computer Village addresses even for tests located in other regions.
  - **Expected behavior**: Dynamic location display strictly derived from technician's registered coordinates and actual neighborhood.
  - **Status**: ACTIVE
  - **Recommended fix phase**: Phase 8 (Data & Copy Polish)

- **ID**: DEF-P3-002
  - **Phase**: P3
  - **Severity**: LOW
  - **Area**: Matching Distance Edge Cases
  - **Description**: Spherical Haversine formula calculation without live traffic or road-routing topology.
  - **Current behavior**: Linear Euclidean/Haversine distance in kilometers is computed between customer coordinates and shop coordinates.
  - **Expected behavior**: Google Distance Matrix API / driving ETA integration where API quota is configured.
  - **Status**: ACTIVE
  - **Recommended fix phase**: Phase 8 (Routing Optimization)

- **ID**: DEF-P3-003
  - **Phase**: P3
  - **Severity**: MEDIUM
  - **Area**: Discovery & Quoting Separation
  - **Description**: Discovery view directly embedded quick-quote placeholders that blurred the line between searching technicians and receiving structured formal quotes.
  - **Current behavior**: In earlier scaffolding, technician discovery and quote viewing had overlapping responsibilities.
  - **Expected behavior**: Clean boundary: Discovery identifies nearby eligible technicians; Request routing sends leads; Technicians submit itemized formal quotes; Customers compare quotes on a dedicated comparison screen.
  - **Status**: RESOLVED (Phase 4 Implementation)
  - **Recommended fix phase**: Phase 4

---

## P4 — Quotes + Booking

- **ID**: DEF-P4-001
  - **Phase**: P4
  - **Severity**: HIGH
  - **Area**: Booking Confirmation Premature Code Exposure
  - **Description**: Drop-off and Pickup security handoff verification codes were rendered on initial booking confirmation before device handoff stage.
  - **Current behavior**: Initial scaffold displayed `FX-xxxx` drop-off code and `PK-xxxx` pickup code immediately upon quote acceptance.
  - **Expected behavior**: Drop-off code should only be revealed when customer is ready to check-in/drop-off, and pickup code strictly withheld until repair is completed and verified.
  - **Status**: RESOLVED (Phase 4 Implementation)
  - **Recommended fix phase**: Phase 4

- **ID**: DEF-P4-002
  - **Phase**: P4
  - **Severity**: HIGH
  - **Area**: Financial Terminology & Escrow Claims
  - **Description**: UI displayed "Escrow Locked" or "Funds in Escrow" immediately upon quote acceptance before customer actually paid.
  - **Current behavior**: Accepting a quote created a job with status `PAYMENT_PENDING`, but confirmation text sometimes implied payment had already occurred.
  - **Expected behavior**: Explicit state distinction: "Quote Accepted — Booking Created. Next Step: Payment Pending."
  - **Status**: RESOLVED (Phase 4 Implementation)
  - **Recommended fix phase**: Phase 4

- **ID**: DEF-P4-003
  - **Phase**: P4
  - **Severity**: HIGH
  - **Area**: Quote Concurrency & Idempotency
  - **Description**: Concurrent quote acceptance or rapid double-clicks could theoretically risk duplicate job creation or race conditions between competing quotes.
  - **Current behavior**: Single in-memory check without mutex or atomic locking could permit race conditions.
  - **Expected behavior**: Server-side request mutex/locking preventing multiple accepted quotes, duplicate jobs, or competing quote acceptances for the same repair request.
  - **Status**: RESOLVED (Phase 4 Implementation)
  - **Recommended fix phase**: Phase 4

- **ID**: DEF-P4-004
  - **Phase**: P4
  - **Severity**: MEDIUM
  - **Area**: Controlled Parts Quality Standards
  - **Description**: Parts quality tier options needed standard normalization and support for 'Unknown' / 'Used / Refurbished' as specified in Phase 4 standards.
  - **Current behavior**: Enum included `ORIGINAL_OEM`, `PREMIUM_AFTERMARKET`, `STANDARD_AFTERMARKET`, `REFURBISHED`, `UNKNOWN`. UI needed strict user-facing disclosure avoiding misleading "genuine" claims.
  - **Expected behavior**: Controlled parts quality values with accurate transparency indicators for customers.
  - **Status**: RESOLVED (Phase 4 Implementation)
  - **Recommended fix phase**: Phase 4

- **ID**: DEF-P4-005
  - **Phase**: P4
  - **Severity**: MEDIUM
  - **Area**: Technician Request Inspection
  - **Description**: Technicians lacked a comprehensive request detail inspection modal to review customer-provided photos, voice note, symptoms, and service radius before quoting.
  - **Current behavior**: Quote builder was opened directly from small cards without dedicated evidence review panel.
  - **Expected behavior**: Full inspection view displaying brand, model, issue category, description, symptoms, photos, audio note, and approximate service location.
  - **Status**: RESOLVED (Phase 4 Implementation)
  - **Recommended fix phase**: Phase 4

---

## P5 — Payment

- **ID**: DEF-P5-001
  - **Phase**: P5
  - **Severity**: HIGH
  - **Area**: Payment Gateway Integration
  - **Description**: Paystack integration operates in simulated/sandbox mode with mock payment verification.
  - **Current behavior**: `/payments/create-intent` and `/payments/verify-mock` simulate real Paystack transaction references and webhook verification.
  - **Expected behavior**: Live Paystack inline checkout, bank transfer virtual accounts, and production webhook signature verification (`x-paystack-signature`).
  - **Status**: ACTIVE
  - **Recommended fix phase**: Phase 5 (Payment)

- **ID**: DEF-P5-002
  - **Phase**: P5
  - **Severity**: MEDIUM
  - **Area**: Payouts & Sub-accounts
  - **Description**: Technician payout and escrow release logic uses internal ledger rather than live Paystack split transfers.
  - **Current behavior**: Payout calculation deducts platform fee (8.5%) and updates internal technician earnings balance.
  - **Expected behavior**: Direct bank account settlement via Paystack Transfers API or Dedicated Virtual Accounts.
  - **Status**: ACTIVE
  - **Recommended fix phase**: Phase 5 (Payment)

---

## P6 — Repair Lifecycle

- **ID**: DEF-P6-001
  - **Phase**: P6
  - **Severity**: MEDIUM
  - **Area**: Physical Intake & Check-in
  - **Description**: Condition report photo upload requires multi-angle camera intake in technician shop.
  - **Current behavior**: Condition report records front, back, and frame condition with text notes and optional photos.
  - **Expected behavior**: Mandatory 4-angle photo capture with timestamp watermarks before status transitions to `DEVICE_RECEIVED`.
  - **Status**: ACTIVE
  - **Recommended fix phase**: Phase 6 (Repair Lifecycle)

- **ID**: DEF-P6-002
  - **Phase**: P6
  - **Severity**: MEDIUM
  - **Area**: Additional Diagnosis Approval Flow
  - **Description**: Additional diagnosis approval timeout policy and auto-escalation handling.
  - **Current behavior**: Additional diagnosis can be approved or rejected by customer.
  - **Expected behavior**: Automated 24-hour reminder notifications and dispute escalation if customer does not respond.
  - **Status**: ACTIVE
  - **Recommended fix phase**: Phase 6 (Repair Lifecycle)

---

## P7 — Account + Retention

- **ID**: DEF-P7-001
  - **Phase**: P7
  - **Severity**: LOW
  - **Area**: Borrowed Device Session Expiry
  - **Description**: Borrowed device guest sessions use temporary JWT tokens without persistent multi-factor auth.
  - **Current behavior**: Guest users can log repair requests using a borrowed device session.
  - **Expected behavior**: SMS one-time PIN (OTP) verification before releasing device status updates or sensitive personal information.
  - **Status**: ACTIVE
  - **Recommended fix phase**: Phase 7 (Account + Retention)

- **ID**: DEF-P7-002
  - **Phase**: P7
  - **Severity**: LOW
  - **Area**: Warranty Passport Export
  - **Description**: Digital warranty passport is displayed in-app but lacks downloadable PDF or Apple Wallet / Google Wallet pass export.
  - **Current behavior**: Customers view active warranties with claim history in the web interface.
  - **Expected behavior**: Cryptographically verifiable PDF certificate and QR card export.
  - **Status**: ACTIVE
  - **Recommended fix phase**: Phase 7 (Account + Retention)

---

## Cross-Phase / Security

- **ID**: DEF-SEC-001
  - **Phase**: Cross-Phase
  - **Severity**: HIGH
  - **Area**: IDOR Authorization on Quote Access
  - **Description**: Ensure all quote endpoints enforce object ownership such that customers can only view/accept quotes for their own requests, and technicians can only view/modify their own quotes.
  - **Current behavior**: Hardened in Phase 3 & 4 with strict `req.user.id` checks and matching eligibility filters.
  - **Expected behavior**: Zero IDOR vulnerabilities across all quote lifecycle endpoints.
  - **Status**: RESOLVED (Hardened in Phase 4)
  - **Recommended fix phase**: Phase 4
