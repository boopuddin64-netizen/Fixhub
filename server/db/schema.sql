-- =============================================================================
-- Fixhub PostgreSQL Relational Database Schema
-- =============================================================================

-- Enable UUID or Extensions if available
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL, -- 'customer' | 'technician' | 'admin'
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  password_hash TEXT NOT NULL
);

-- 2. Customer Profiles
CREATE TABLE IF NOT EXISTS customer_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  total_repairs_count INT NOT NULL DEFAULT 0,
  active_repairs_count INT NOT NULL DEFAULT 0,
  emergency_contact_phone TEXT,
  saved_locations JSONB DEFAULT '[]'::jsonb,
  default_location JSONB
);

-- 3. Technician Profiles
CREATE TABLE IF NOT EXISTS technician_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  bio TEXT,
  shop_location JSONB,
  service_radius_km INT DEFAULT 15,
  business_hours TEXT,
  years_experience INT DEFAULT 1,
  phone TEXT NOT NULL,
  avatar_url TEXT,
  shop_photos JSONB DEFAULT '[]'::jsonb,
  supported_brands JSONB DEFAULT '[]'::jsonb,
  supported_categories JSONB DEFAULT '[]'::jsonb,
  availability TEXT NOT NULL DEFAULT 'AVAILABLE',
  rating NUMERIC DEFAULT 0,
  review_count INT DEFAULT 0,
  completed_jobs INT DEFAULT 0,
  quote_accuracy_score NUMERIC DEFAULT 100,
  cancellation_rate NUMERIC DEFAULT 0,
  average_response_minutes INT DEFAULT 15,
  trust_score INT DEFAULT 85,
  trust_level TEXT DEFAULT 'ESTABLISHED',
  verification_status JSONB DEFAULT '{}'::jsonb,
  bank_details JSONB
);

-- 4. Device Brands
CREATE TABLE IF NOT EXISTS device_brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon_url TEXT,
  popular BOOLEAN DEFAULT false
);

-- 5. Device Families
CREATE TABLE IF NOT EXISTS device_families (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES device_brands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'PHONE'
);

-- 6. Device Models
CREATE TABLE IF NOT EXISTS device_models (
  id TEXT PRIMARY KEY,
  family_id TEXT NOT NULL REFERENCES device_families(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  release_year INT,
  is_popular BOOLEAN DEFAULT false,
  image_url TEXT
);

-- 7. Customer Devices
CREATE TABLE IF NOT EXISTS customer_devices (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_model_id TEXT,
  brand_name TEXT NOT NULL,
  model_name TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'PHONE',
  nickname TEXT,
  color TEXT,
  storage TEXT,
  is_primary BOOLEAN DEFAULT false,
  catalog_match BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Repair Issues (Options)
CREATE TABLE IF NOT EXISTS repair_issues (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  icon_name TEXT,
  estimated_labor_minutes INT DEFAULT 45,
  typical_cost_range_naira JSONB DEFAULT '[10000, 50000]'::jsonb
);

-- 9. Repair Issue Catalog
CREATE TABLE IF NOT EXISTS repair_issue_catalog (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  estimated_minutes INT DEFAULT 45,
  base_labor_naira INT DEFAULT 10000,
  common_symptoms JSONB DEFAULT '[]'::jsonb,
  keywords JSONB DEFAULT '[]'::jsonb
);

-- 10. Repair Request Drafts
CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_info JSONB,
  issue_info JSONB,
  booking_preferences JSONB,
  step INT DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. Repair Requests
CREATE TABLE IF NOT EXISTS repair_requests (
  id TEXT PRIMARY KEY,
  request_number TEXT,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_brand TEXT NOT NULL,
  device_model TEXT NOT NULL,
  device_type TEXT NOT NULL DEFAULT 'PHONE',
  issue_type TEXT,
  issue_description TEXT NOT NULL,
  preferred_service_type TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_QUOTES',
  customer_location JSONB,
  matched_technician_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ
);

-- 12. Repair Quotes
CREATE TABLE IF NOT EXISTS repair_quotes (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES repair_requests(id) ON DELETE CASCADE,
  technician_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  technician_name TEXT,
  technician_business_name TEXT,
  technician_phone TEXT,
  technician_rating NUMERIC DEFAULT 5.0,
  technician_completed_jobs INT DEFAULT 0,
  technician_location JSONB,
  distance_km NUMERIC DEFAULT 0,
  parts_cost_naira INT NOT NULL DEFAULT 0,
  labor_cost_naira INT NOT NULL DEFAULT 0,
  total_amount_naira INT NOT NULL DEFAULT 0,
  estimated_completion_time TEXT,
  warranty_days INT DEFAULT 90,
  status TEXT NOT NULL DEFAULT 'PENDING',
  itemized_breakdown JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ
);

-- 13. Repair Jobs
CREATE TABLE IF NOT EXISTS repair_jobs (
  id TEXT PRIMARY KEY,
  booking_ref TEXT,
  request_id TEXT NOT NULL REFERENCES repair_requests(id) ON DELETE CASCADE,
  quote_id TEXT NOT NULL REFERENCES repair_quotes(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  technician_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_brand TEXT NOT NULL,
  device_model TEXT NOT NULL,
  issues JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  drop_off_code TEXT,
  pickup_code TEXT,
  handoff_qr_token TEXT,
  original_quote_amount INT NOT NULL DEFAULT 0,
  final_amount INT NOT NULL DEFAULT 0,
  parts_used JSONB DEFAULT '[]'::jsonb,
  diagnostic_notes TEXT,
  status_history JSONB DEFAULT '[]'::jsonb,
  check_in_photos JSONB DEFAULT '[]'::jsonb,
  completion_photos JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  booked_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

-- 14. Technician Parts & Inventory
CREATE TABLE IF NOT EXISTS technician_parts (
  id TEXT PRIMARY KEY,
  inventory_item_id TEXT,
  technician_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  part_name TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT NOT NULL,
  compatible_models JSONB DEFAULT '[]'::jsonb,
  quality TEXT NOT NULL DEFAULT 'ORIGINAL_OEM',
  sku TEXT,
  unit_price_naira INT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  quantity_on_hand INT NOT NULL DEFAULT 0,
  in_stock_count INT NOT NULL DEFAULT 0,
  stock_quantity INT NOT NULL DEFAULT 0,
  quantity_reserved INT NOT NULL DEFAULT 0,
  quantity_available INT NOT NULL DEFAULT 0,
  warranty_days INT DEFAULT 90,
  status TEXT NOT NULL DEFAULT 'IN_STOCK',
  price_version INT DEFAULT 1,
  price_history JSONB DEFAULT '[]'::jsonb,
  parts_used_count INT DEFAULT 0,
  supplier TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 15. Payments
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  repair_id TEXT NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quote_id TEXT,
  amount_naira INT NOT NULL,
  platform_fee_naira INT NOT NULL DEFAULT 0,
  technician_payout_naira INT NOT NULL DEFAULT 0,
  escrow_held BOOLEAN DEFAULT true,
  status TEXT NOT NULL DEFAULT 'INITIALIZED',
  payment_method TEXT NOT NULL DEFAULT 'CARD',
  transaction_ref TEXT NOT NULL,
  provider_reference TEXT,
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  channel TEXT,
  authorization_url TEXT,
  access_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 16. Technician Earnings Ledger
CREATE TABLE IF NOT EXISTS technician_earnings (
  id TEXT PRIMARY KEY,
  technician_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repair_id TEXT NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  gross_amount_naira INT NOT NULL,
  platform_fee_naira INT NOT NULL DEFAULT 0,
  net_earnings_naira INT NOT NULL,
  commission_percent NUMERIC DEFAULT 10,
  status TEXT NOT NULL DEFAULT 'HELD', -- 'HELD' | 'ELIGIBLE_FOR_PAYOUT' | 'PENDING' | 'PAID_OUT'
  payout_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  eligible_at TIMESTAMPTZ,
  paid_out_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 17. Payout Records
CREATE TABLE IF NOT EXISTS payouts (
  id TEXT PRIMARY KEY,
  technician_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_naira INT NOT NULL,
  bank_code TEXT,
  account_number TEXT,
  account_name TEXT,
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 18. Refund Records
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  repair_id TEXT NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_naira INT NOT NULL,
  reason TEXT NOT NULL,
  initiated_by TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  provider_reference TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ
);

-- 19. Webhook Events (Strict Database-Level Idempotency)
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  event TEXT NOT NULL,
  provider_reference TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'PAYSTACK',
  payload_summary JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'PROCESSED'
);

-- 20. Warranty Records
CREATE TABLE IF NOT EXISTS warranties (
  id TEXT PRIMARY KEY,
  repair_job_id TEXT NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  device_brand TEXT NOT NULL,
  device_model TEXT NOT NULL,
  covered_repair TEXT,
  covered_repairs JSONB DEFAULT '[]'::jsonb,
  technician_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  technician_name TEXT NOT NULL,
  period_days INT NOT NULL DEFAULT 90,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  terms TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
);

-- 21. Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  repair_id TEXT NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  technician_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating NUMERIC NOT NULL,
  comment TEXT NOT NULL,
  verified_purchase BOOLEAN DEFAULT true,
  repair_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 22. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 23. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  repair_id TEXT,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 24. Messages
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  repair_id TEXT NOT NULL REFERENCES repair_jobs(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  text TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 25. Uploaded Attachments
CREATE TABLE IF NOT EXISTS uploaded_attachments (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mime_type TEXT NOT NULL,
  size INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 26. Risk Events
CREATE TABLE IF NOT EXISTS risk_events (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'LOW',
  metadata JSONB DEFAULT '{}'::jsonb,
  reviewed BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- Database Indexes for High-Traffic Queries & Foreign Key Lookups
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_repair_jobs_customer ON repair_jobs(customer_id);
CREATE INDEX IF NOT EXISTS idx_repair_jobs_technician ON repair_jobs(technician_id);
CREATE INDEX IF NOT EXISTS idx_repair_jobs_request ON repair_jobs(request_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_ref ON payments(transaction_ref);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_ref ON payments(provider_reference);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_repair ON payments(repair_id);
CREATE INDEX IF NOT EXISTS idx_technician_earnings_tech ON technician_earnings(technician_id);
CREATE INDEX IF NOT EXISTS idx_technician_earnings_repair ON technician_earnings(repair_id);
CREATE INDEX IF NOT EXISTS idx_technician_earnings_payment ON technician_earnings(payment_id);
CREATE INDEX IF NOT EXISTS idx_payouts_tech ON payouts(technician_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_key ON webhook_events(event_key);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_repair ON messages(repair_id);
