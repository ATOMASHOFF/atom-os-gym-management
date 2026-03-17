-- Add personal QR token to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS qr_token VARCHAR(255) UNIQUE;

-- Generate tokens for existing members who don't have one
UPDATE members SET qr_token = 'MBR-' || id || '-' || SUBSTRING(MD5(id::text || email || NOW()::text), 1, 16)
WHERE qr_token IS NULL;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_members_qr_token ON members(qr_token);
