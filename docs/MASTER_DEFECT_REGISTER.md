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
  - **Description**: Paystack integration requires production server-side API integration, authoritative server pricing, and cryptographic webhook verification.
  - **Current behavior**: Comprehensive server-side `PaystackClient` and `PaymentService` implemented with authoritative Naira calculations, idempotency controls, and `/api/payments/webhook` verifying `x-paystack-signature` with HMAC SHA512. Automatically uses live Paystack API when `PAYSTACK_SECRET_KEY` is provided, with realistic sandbox simulation for development.
  - **Expected behavior**: Live Paystack inline checkout, bank transfer virtual accounts, and production webhook signature verification (`x-paystack-signature`).
  - **Status**: RESOLVED (Phase 5 Implementation)
  - **Recommended fix phase**: Phase 5 (Payment)

- **ID**: DEF-P5-002
  - **Phase**: P5
  - **Severity**: MEDIUM
  - **Area**: Payouts & Financial Ledger
  - **Description**: Technician payout and escrow release logic requires robust financial ledger tracking held funds vs. eligible payout balances, avoiding premature withdrawals.
  - **Current behavior**: Financial ledger implemented with `technicianEarnings`, `payouts`, `refunds`, and `webhookEvents`. Explicit state machine prevents withdrawal of repair earnings while repair job is active (`HELD`). Earnings only transition to `ELIGIBLE_FOR_PAYOUT` when repair is completed and customer picks up the device. Payout requests validate eligible balance against pending/processing payouts.
  - **Expected behavior**: Authoritative financial ledger with explicit separation of held repair earnings and eligible cleared balance, with payout request workflow.
  - **Status**: RESOLVED (Phase 5 Implementation)
  - **Recommended fix phase**: Phase 5 (Payment)

---

## P6 — Repair Lifecycle

- **ID**: DEF-P6-001
  - **Phase**: P6
  - **Severity**: HIGH
  - **Area**: Physical Intake & Check-in
  - **Description**: Device intake condition report with physical checks (front, back, screen, frame, touch, notes) before transitioning to `DEVICE_RECEIVED`.
  - **Current behavior**: Comprehensive intake scan modal in technician workspace enforces check-in only when job is paid/booked (`BOOKED`, `PAYMENT_CONFIRMED`, `DEVICE_DROPPED_OFF`), prevents duplicate intake reports, records condition report, and advances lifecycle to `DEVICE_RECEIVED`.
  - **Expected behavior**: Technician completes condition report at shop counter before disassembly commences.
  - **Status**: RESOLVED (Phase 6 Implementation)
  - **Recommended fix phase**: Phase 6 (Repair Lifecycle)

- **ID**: DEF-P6-002
  - **Phase**: P6
  - **Severity**: HIGH
  - **Area**: Additional Diagnosis Approval Flow
  - **Description**: Additional diagnosis approval requires server-authoritative recalculation of total cost, platform fee, and technician earnings, with explicit approve/decline endpoints.
  - **Current behavior**: Implemented `/api/jobs/:id/additional-diagnosis/respond` and `RepairWorkflowService.respondToAdditionalDiagnosis`. Customer can approve or decline additional diagnosis. Approval updates `finalAmount`, recalculates 8.5% fee and technician payout, advances status to `REPAIR_IN_PROGRESS`, and notifies technician. Declining keeps original scope and notifies technician.
  - **Expected behavior**: Customer controls budget increases with server-side financial integrity.
  - **Status**: RESOLVED (Phase 6 Implementation)
  - **Recommended fix phase**: Phase 6 (Repair Lifecycle)

- **ID**: DEF-P6-003
  - **Phase**: P6
  - **Severity**: HIGH
  - **Area**: Pickup Verification & Counter Handoff
  - **Description**: Shop counter handoff requires technician to verify customer's 6-digit pickup code before device handoff.
  - **Current behavior**: Implemented `/api/jobs/:id/verify-pickup` and `RepairWorkflowService.verifyPickup`. Technician enters pickup code from customer; server verifies code match and transitions job to `PICKED_UP` with audit log and notification.
  - **Expected behavior**: Verification code prevents mistaken or unauthorized device release.
  - **Status**: RESOLVED (Phase 6 Implementation)
  - **Recommended fix phase**: Phase 6 (Repair Lifecycle)

- **ID**: DEF-P6-004
  - **Phase**: P6
  - **Severity**: HIGH
  - **Area**: Authoritative Completion & Warranty Activation
  - **Description**: Completion inspection releases held funds to technician payout balance and generates active digital warranty passport.
  - **Current behavior**: Implemented `/api/jobs/:id/confirm-completion` and `RepairWorkflowService.confirmCompletion`. Server validates customer ownership and status (`READY_FOR_PICKUP` or `PICKED_UP`), marks job `COMPLETED`, creates `WarrantyRecord`, releases funds to technician ledger (`ELIGIBLE_FOR_PAYOUT`), evaluates quote accuracy, and dispatches celebration confetti and review prompt.
  - **Expected behavior**: One-touch completion releases funds and activates warranty.
  - **Status**: RESOLVED (Phase 6 Implementation)
  - **Recommended fix phase**: Phase 6 (Repair Lifecycle)

- **ID**: DEF-P6-005
  - **Phase**: P6
  - **Severity**: MEDIUM
  - **Area**: Request Creation → Discovery Routing
  - **Description**: Request creation wizard needed to route directly to `TechnicianDiscoveryView` with matched technicians and live quotes banner.
  - **Current behavior**: Wizard redirects to `TechnicianDiscoveryView` with `requestId`, executes matching, displays nearby eligible technicians, shows live quote counts, and provides seamless one-click comparison CTA.
  - **Expected behavior**: Customer sees matched nearby technicians immediately after posting repair request.
  - **Status**: RESOLVED (Phase 6 Implementation)
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

## P7 — Technician Inventory & Transparent Parts Pricing

- **ID**: DEF-P7-003
  - **Phase**: P7
  - **Severity**: HIGH
  - **Area**: Technician Inventory & Authoritative Pricing Protection
  - **Description**: Free-text arbitrary parts price inputs in quotes allowed malicious technicians to mark up prices ad-hoc after viewing customer requests.
  - **Current behavior**: Technicians must select registered inventory items (`TechnicianInventoryItem`). Server calculates parts subtotal, unit prices, quality badges, and warranty limits authoritatively from the technician's stock record (`InventoryService.validateAndBuildQuoteLineItems`). Quotes embed immutable `QuoteLineItem` snapshots with audit metadata. Subsequent inventory price changes do not mutate existing quotes.
  - **Expected behavior**: All quoted repair parts originate from verified registered inventory with server-authoritative calculations and price version audit trails.
  - **Status**: RESOLVED (Phase 7 Implementation)
  - **Recommended fix phase**: Phase 7 (Technician Inventory & Price Protection)

- **ID**: DEF-P7-004
  - **Phase**: P7
  - **Severity**: HIGH
  - **Area**: Stock Reservation & Lifecycle Deduction
  - **Description**: Multi-quote scenarios could lead to double-allocating physical inventory components or stock overselling.
  - **Current behavior**: Integrated stock reservation (`InventoryService.reserveStockForQuote`) upon quote acceptance and automatic physical deduction (`InventoryService.deductStockForInstalledPart`) upon part installation. If a quote is rejected or cancelled, stock reservations are released.
  - **Expected behavior**: Accurate available vs. reserved quantity management across the entire repair lifecycle.
  - **Status**: RESOLVED (Phase 7 Implementation)
  - **Recommended fix phase**: Phase 7 (Technician Inventory & Price Protection)

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
