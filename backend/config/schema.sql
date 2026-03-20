-- ============================================================
-- ATOM FITNESS · Production Database Schema v3.0
-- 3-Tier: super_admin → gym admin → member
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Sequence for unique member codes (ATM-000001)
CREATE SEQUENCE IF NOT EXISTS member_code_seq START 1 INCREMENT 1;

-- ── Gyms ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gyms (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) UNIQUE NOT NULL,
  owner_name    VARCHAR(255),
  owner_email   VARCHAR(255),
  owner_phone   VARCHAR(20),
  address       TEXT,
  logo_url      TEXT,
  timezone      VARCHAR(50)  DEFAULT 'Asia/Kolkata',
  plan          VARCHAR(20)  DEFAULT 'starter',  -- starter|pro|enterprise
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gyms_slug_format CHECK (slug ~ '^[a-z0-9-]+$'),
  CONSTRAINT gyms_plan_check  CHECK (plan IN ('starter','pro','enterprise'))
);

-- ── Super Admins (platform-level, no gym_id) ─────────────────
-- These are Mahnwas Technologies staff who manage the platform.
CREATE TABLE IF NOT EXISTS super_admins (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_super_admins_email ON super_admins(email);

-- ── Members (gym-scoped: admin | staff | member) ─────────────
CREATE TABLE IF NOT EXISTS members (
  id                SERIAL PRIMARY KEY,
  name              VARCHAR(255) NOT NULL,
  email             VARCHAR(255) NOT NULL,
  phone             VARCHAR(20),
  password_hash     VARCHAR(255) NOT NULL,
  role              VARCHAR(20)  NOT NULL DEFAULT 'member',
  gym_id            INTEGER      NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  status            VARCHAR(20)  NOT NULL DEFAULT 'pending',
  member_type       VARCHAR(20)  NOT NULL DEFAULT 'regular',
  member_code       VARCHAR(20)  UNIQUE,
  qr_token          VARCHAR(255) UNIQUE,
  profile_photo     TEXT,
  date_of_birth     DATE,
  address           TEXT,
  emergency_contact VARCHAR(255),
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_login_at     TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, gym_id),
  CONSTRAINT members_role_check   CHECK (role   IN ('admin','staff','member')),
  CONSTRAINT members_status_check CHECK (status IN ('active','pending','inactive','suspended')),
  CONSTRAINT members_type_check   CHECK (member_type IN ('regular','guest','trial'))
);
CREATE INDEX IF NOT EXISTS idx_members_gym        ON members(gym_id);
CREATE INDEX IF NOT EXISTS idx_members_qr_token   ON members(qr_token) WHERE qr_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_members_email       ON members(email);
CREATE INDEX IF NOT EXISTS idx_members_gym_status ON members(gym_id, status);
CREATE INDEX IF NOT EXISTS idx_members_gym_role   ON members(gym_id, role);

-- ── Staff Permissions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_permissions (
  staff_id              INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  gym_id                INTEGER NOT NULL REFERENCES gyms(id)    ON DELETE CASCADE,
  can_scan_attendance   BOOLEAN NOT NULL DEFAULT false,
  can_view_members      BOOLEAN NOT NULL DEFAULT false,
  can_add_members       BOOLEAN NOT NULL DEFAULT false,
  can_edit_members      BOOLEAN NOT NULL DEFAULT false,
  can_delete_members    BOOLEAN NOT NULL DEFAULT false,
  can_view_subscriptions BOOLEAN NOT NULL DEFAULT false,
  can_add_subscriptions BOOLEAN NOT NULL DEFAULT false,
  can_view_attendance   BOOLEAN NOT NULL DEFAULT false,
  can_view_reports      BOOLEAN NOT NULL DEFAULT false,
  can_view_financial    BOOLEAN NOT NULL DEFAULT false,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (staff_id, gym_id)
);

-- ── Membership Plans ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS membership_plans (
  id            SERIAL PRIMARY KEY,
  gym_id        INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  duration_days INTEGER NOT NULL,
  price         NUMERIC(10, 2) NOT NULL,
  description   TEXT,
  features      TEXT[],
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT plans_duration_positive CHECK (duration_days > 0),
  CONSTRAINT plans_price_positive    CHECK (price >= 0)
);
CREATE INDEX IF NOT EXISTS idx_plans_gym ON membership_plans(gym_id) WHERE is_active = true;

-- ── Subscriptions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id              SERIAL PRIMARY KEY,
  member_id       INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  plan_id         INTEGER REFERENCES membership_plans(id),
  gym_id          INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'active',
  payment_method  VARCHAR(50),
  amount_paid     NUMERIC(10, 2),
  transaction_id  VARCHAR(255),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT subs_dates_check   CHECK (end_date >= start_date),
  CONSTRAINT subs_amount_check  CHECK (amount_paid IS NULL OR amount_paid >= 0),
  CONSTRAINT subs_status_check  CHECK (status IN ('active','expired','cancelled')),
  CONSTRAINT subs_payment_check CHECK (
    payment_method IN ('cash','upi','card','bank_transfer','online','other') OR payment_method IS NULL
  )
);
CREATE INDEX IF NOT EXISTS idx_subs_member      ON subscriptions(member_id);
CREATE INDEX IF NOT EXISTS idx_subs_gym         ON subscriptions(gym_id);
CREATE INDEX IF NOT EXISTS idx_subs_end_date    ON subscriptions(end_date);
CREATE INDEX IF NOT EXISTS idx_subs_gym_status  ON subscriptions(gym_id, status);
CREATE INDEX IF NOT EXISTS idx_subs_expiry_alert ON subscriptions(gym_id, end_date) WHERE status = 'active';

-- ── Gym QR Codes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gym_qr_codes (
  id            SERIAL PRIMARY KEY,
  token         VARCHAR(255) UNIQUE NOT NULL,
  qr_image_data TEXT,
  gym_id        INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  location      VARCHAR(255),
  is_active     BOOLEAN NOT NULL DEFAULT true,
  scan_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qr_scan_count_positive CHECK (scan_count >= 0)
);
CREATE INDEX IF NOT EXISTS idx_gym_qr_token ON gym_qr_codes(token) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_gym_qr_gym   ON gym_qr_codes(gym_id);

-- ── Attendance Logs ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_logs (
  id              SERIAL PRIMARY KEY,
  member_id       INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES subscriptions(id),
  gym_qr_id       INTEGER REFERENCES gym_qr_codes(id),
  gym_id          INTEGER NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  check_in_time   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_in_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  scan_method     VARCHAR(20) NOT NULL DEFAULT 'manual',
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT att_method_check CHECK (scan_method IN ('qr','manual')),
  UNIQUE (member_id, gym_id, check_in_date)
);
CREATE INDEX IF NOT EXISTS idx_att_member   ON attendance_logs(member_id);
CREATE INDEX IF NOT EXISTS idx_att_gym_date ON attendance_logs(gym_id, check_in_date);
CREATE INDEX IF NOT EXISTS idx_att_gym_today ON attendance_logs(gym_id, check_in_date DESC);

-- ── Audit Log ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  gym_id      INTEGER REFERENCES gyms(id) ON DELETE SET NULL,
  actor_id    INTEGER,
  actor_type  VARCHAR(20) DEFAULT 'member',  -- 'member' | 'super_admin'
  actor_role  VARCHAR(20),
  action      VARCHAR(100) NOT NULL,
  entity      VARCHAR(50),
  entity_id   INTEGER,
  old_data    JSONB,
  new_data    JSONB,
  ip_address  INET,
  request_id  VARCHAR(36),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_gym    ON audit_logs(gym_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_logs(actor_id, actor_type);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);

-- ── Auto updated_at trigger ──────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'gyms','members','membership_plans','subscriptions',
    'gym_qr_codes','staff_permissions','super_admins'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_touch_%I ON %I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_touch_%I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION touch_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- ── Helper view ──────────────────────────────────────────────
CREATE OR REPLACE VIEW active_subscriptions AS
  SELECT s.*, m.name as member_name, m.email as member_email, p.name as plan_name
  FROM subscriptions s
  JOIN members m ON s.member_id = m.id
  JOIN membership_plans p ON s.plan_id = p.id
  WHERE s.status = 'active' AND s.end_date >= CURRENT_DATE;

-- Back-fill QR tokens
UPDATE members SET qr_token =
  'MBR-' || id || '-' || upper(substring(encode(gen_random_bytes(8), 'hex'), 1, 16))
WHERE qr_token IS NULL;
