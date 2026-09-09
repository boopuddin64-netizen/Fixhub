# Fix Hub Baseline Feature Matrix

This document provides the baseline feature capability matrix across all Fix Hub modules following the completion of Phase 8 (Feature Development Freeze).

---

## 1. Customer Experience & Lifecycle Matrix

| Module | Feature / Capability | Supported Status / Behavior | Implementation Source | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication & Sessions** | Customer Signup / Login | Email + Password & Phone Auth | `server/services/authService.ts` | Tested & Certified |
| | Borrowed Phone Mode | Short JWT TTL, local storage bypassed | `src/components/auth` | Tested & Certified |
| | Customer Profile Management | Name, Phone, Email, Address editing with validation | `PUT /customer/profile` | Tested & Certified |
| **Device Management** | Saved Devices | Register phones/tablets, nickname, color, storage | `src/components/customer/SavedDevicesManager.tsx` | Tested & Certified |
| | Repeat Repair Retention | 1-tap prefill into 4-step wizard | `SavedDevicesManager.tsx` -> `RepairRequestWizard.tsx` | Tested & Certified |
| **Repair Requests** | 4-Step Request Wizard | Device, Symptoms, Photos, Audio Note, GPS Geocoding | `src/components/customer/RepairRequestWizard.tsx` | Tested & Certified |
| | Geocoding Engine | Reverse Geocoding via Google Maps API & Nigerian catalog | `server/routes/api.ts` (`geocodeCustomerLocation`) | Tested & Certified |
| **Technician Discovery & Quotes** | Match Ranking | Multi-factor distance, rating, brand, response score | `server/services/technicianMatchingService.ts` | Tested & Certified |
| | Quote Comparison | Quality tiers, warranty days, price breakdown, 8.5% fee | `src/components/customer/QuoteComparisonView.tsx` | Tested & Certified |
| **Payment & Escrow** | Paystack Checkout | Inline Paystack modal, Bank Transfer, Card, USSD | `src/components/customer/PaystackCheckoutModal.tsx` | Tested & Certified |
| | Webhook Verification | HMAC SHA512 signature verification (`x-paystack-signature`) | `server/services/paymentService.ts` | Tested & Certified |
| **Active Repair Lifecycle** | Repair Status Tracking | 11-stage state machine from BOOKED to COMPLETED | `src/components/customer/ActiveRepairTracker.tsx` | Tested & Certified |
| | Drop-off & Pickup Codes | 6-digit codes withheld until required stage | `server/services/repairWorkflowService.ts` | Tested & Certified |
| | Additional Diagnosis Approval | Customer 1-tap accept/decline with recalculated fees | `ActiveRepairTracker.tsx` | Tested & Certified |
| **Post-Repair & Warranty** | Digital Repair Passport | Serialized parts log, intake report, provenance audit | `src/components/customer/WarrantyPassportView.tsx` | Tested & Certified |
| | Active Warranty Center | 30-90 day coverage tracking & claim instructions | `WarrantyPassportView.tsx` | Tested & Certified |
| | Verified Reviews | 1 repair = 1 review with ratings recalculation | `src/components/customer/VerifiedReviewModal.tsx` | Tested & Certified |
| **Notifications & Help** | Notification Preferences | Configurable promotional alerts; mandatory transactional | `src/components/customer/CustomerProfileView.tsx` | Tested & Certified |
| | Help & Support Center | Escrow protection rules, pickup guide & support line | `CustomerProfileView.tsx` | Tested & Certified |

---

## 2. Technician Experience & Workspace Matrix

| Module | Feature / Capability | Supported Status / Behavior | Implementation Source | Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **Shop Profile & Setup** | Store Setup Wizard | Physical address, landmarks, operating hours, CAC | `src/components/technician/TechnicianStoreSetupView.tsx` | Tested & Certified |
| | Profile & Availability | Edit shop details, toggle Online / Busy status | `src/components/technician/TechnicianProfileView.tsx` | Tested & Certified |
| | Protected Metrics | Verification badges, rating & repair count read-only | `TechnicianProfileView.tsx` | Tested & Certified |
| **Request Inspection & Quoting** | Request Inspection | Review photos, audio notes, location & symptoms | `src/components/technician/RequestInspectionModal.tsx` | Tested & Certified |
| | Quote Builder | Select verified inventory items, quantity & labor fee | `src/components/technician/QuoteBuilderModal.tsx` | Tested & Certified |
| **Inventory & Stock Management** | Parts Inventory Catalog | Serialized stock, category, unit cost, quantity in stock | `src/components/technician/PartsCatalogView.tsx` | Tested & Certified |
| | Stock Reservation & Deduction | Auto-reserve on quote acceptance; deduct on installation | `server/services/inventoryService.ts` | Tested & Certified |
| **Work Order Execution** | Intake Condition Report | Physical check-in, chassis test, power check & photos | `src/components/technician/TechnicianJobWorkspace.tsx` | Tested & Certified |
| | Bench Repair & Diagnostics | Submit additional diagnosis, log installed parts | `TechnicianJobWorkspace.tsx` | Tested & Certified |
| | Pickup Verification | Verify 6-digit customer pickup code at counter | `TechnicianJobWorkspace.tsx` | Tested & Certified |
| **Finances & Earnings** | Settlement Bank Setup | Providus / Access Bank 10-digit account verification | `TechnicianProfileView.tsx` | Tested & Certified |
| | Payout Ledger | Escrow held funds vs. cleared payout balances | `server/services/paymentService.ts` | Tested & Certified |

---

## 3. Security, Authorization & Architecture Matrix

| Capability | Policy / Constraint | Enforcement Mechanism |
| :--- | :--- | :--- |
| **Authentication** | Bearer JWT token verification | `requireAuth` Express middleware |
| **Role Isolation** | Strict role separation (customer vs. technician) | `requireRole(['customer'])` / `requireRole(['technician'])` |
| **IDOR Prevention** | Object-level customerId and technicianId validation | All `/api/jobs`, `/api/quotes`, and `/api/customer` routes |
| **State Machine Integrity** | Server-authoritative transitions with `ALLOWED_TRANSITIONS` | `RepairWorkflowService.ts` |
| **Input Validation** | Sanitization, max-length limits, numeric range checks | `server/utils/validation.ts` |
| **Audit Trail** | Comprehensive event logging for all critical transactions | `AuditService.ts` |

---

*Note: Feature development is officially frozen following Phase 8.*
