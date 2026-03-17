'use strict';
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { query, withTransaction, audit } = require('../config/database');
const AppError = require('../utils/AppError');
const { catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

// ── Column aliases: map whatever Excel headers → our field names ─────────────
const FIELD_ALIASES = {
  name:        ['name', 'full name', 'fullname', 'member name', 'membername', 'नाम'],
  email:       ['email', 'email address', 'emailaddress', 'e-mail', 'ईमेल'],
  phone:       ['phone', 'mobile', 'phone number', 'phonenumber', 'contact', 'mob', 'फोन', 'मोबाइल'],
  plan_name:   ['plan', 'plan name', 'membership', 'membership plan', 'package'],
  start_date:  ['start date', 'startdate', 'join date', 'joindate', 'from date', 'start'],
  end_date:    ['end date', 'enddate', 'expiry', 'expiry date', 'expirydate', 'till date', 'to date', 'valid till'],
  amount_paid: ['amount', 'amount paid', 'amountpaid', 'fees', 'fee', 'payment', 'paid'],
  payment_method: ['payment method', 'paymentmethod', 'payment mode', 'mode'],
  date_of_birth: ['dob', 'date of birth', 'dateofbirth', 'birth date', 'birthdate'],
  address:     ['address', 'location', 'area'],
  notes:       ['notes', 'note', 'remarks', 'remark', 'comment'],
  member_type: ['type', 'member type', 'membertype', 'category'],
  status:      ['status'],
  emergency_contact: ['emergency', 'emergency contact', 'emergencycontact', 'guardian'],
};

function normalizeKey(raw) {
  return raw?.toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

function mapHeaders(headers) {
  const map = {};
  headers.forEach(h => {
    const normalized = normalizeKey(h);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(normalized)) {
        map[h] = field;
        break;
      }
    }
  });
  return map;
}

function parseDate(val) {
  if (!val) return null;
  const s = val.toString().trim();
  // Try DD-MM-YYYY, DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
  const patterns = [
    { re: /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/, fn: m => `${m[3]}-${m[2]}-${m[1]}` },
    { re: /^(\d{4})[\/\-](\d{2})[\/\-](\d{2})$/, fn: m => `${m[1]}-${m[2]}-${m[3]}` },
    // Excel serial date numbers
    { re: /^\d{5}$/, fn: m => {
      const d = new Date(Math.round((parseInt(m[0]) - 25569) * 86400 * 1000));
      return d.toISOString().split('T')[0];
    }},
  ];
  for (const { re, fn } of patterns) {
    const match = s.match(re);
    if (match) {
      const ds = fn(match);
      if (!isNaN(new Date(ds).getTime())) return ds;
    }
  }
  // Let JS try natively
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
}

function parseMoney(val) {
  if (!val && val !== 0) return null;
  const n = parseFloat(val.toString().replace(/[₹,\s]/g, ''));
  return isNaN(n) ? null : n;
}

function validateRow(row, rowNum) {
  const errors = [];
  if (!row.name || row.name.trim().length < 2) errors.push('Name required (min 2 chars)');
  if (!row.email && !row.phone) errors.push('Either Email or Phone required');
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push('Invalid email format');
  if (row.start_date && isNaN(new Date(row.start_date).getTime())) errors.push('Invalid start date');
  if (row.end_date && isNaN(new Date(row.end_date).getTime())) errors.push('Invalid end date');
  if (row.start_date && row.end_date && new Date(row.end_date) < new Date(row.start_date)) {
    errors.push('End date must be after start date');
  }
  return errors;
}

// ── GET /api/members/import-template ─────────────────────────────────────────
const downloadTemplate = catchAsync(async (req, res) => {
  // Return a CSV template with headers + 2 example rows
  const headers = [
    'Name', 'Email', 'Phone', 'Plan Name', 'Start Date', 'End Date',
    'Amount Paid', 'Payment Method', 'Date of Birth', 'Address', 'Notes',
  ].join(',');

  const today = new Date().toISOString().split('T')[0];
  const next30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
  const next90 = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];

  const rows = [
    headers,
    `Ramesh Kumar,ramesh@example.com,9876543210,Monthly,${today},${next30},800,cash,15-05-1990,Rohini Delhi,`,
    `Priya Sharma,priya@example.com,9876543211,Quarterly,${today},${next90},2100,upi,22-08-1995,Pitampura Delhi,`,
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="member-import-template.csv"');
  res.send(rows);
});

// ── POST /api/members/bulk-import ─────────────────────────────────────────────
const bulkImport = catchAsync(async (req, res) => {
  const { rows, options = {} } = req.body;
  const {
    skip_duplicates = true,      // skip rows where email already exists
    default_password = null,     // if null, auto-generate per member
    send_welcome = false,        // future: email welcome msg
    dry_run = false,             // validate only, don't insert
  } = options;

  if (!Array.isArray(rows) || rows.length === 0) {
    throw AppError.badRequest('No rows provided');
  }
  if (rows.length > 500) {
    throw AppError.badRequest('Maximum 500 rows per import. Split your file and import in batches.');
  }

  const gymId = req.gymId;
  const results = { total: rows.length, imported: 0, skipped: 0, failed: 0, rows: [] };

  // Pre-fetch existing emails in this gym for fast duplicate check
  const existingR = await query(
    'SELECT email FROM members WHERE gym_id = $1',
    [gymId]
  );
  const existingEmails = new Set(existingR.rows.map(r => r.email.toLowerCase()));

  // Pre-fetch plans in this gym for name → id lookup
  const plansR = await query(
    'SELECT id, name, price, duration_days FROM membership_plans WHERE gym_id = $1 AND is_active = true',
    [gymId]
  );
  const planMap = {};
  plansR.rows.forEach(p => { planMap[p.name.toLowerCase().trim()] = p; });

  // Validate all rows first
  const processed = rows.map((raw, i) => {
    const rowNum = i + 2; // 1-indexed, +1 for header row
    const row = {
      name:             raw.name?.toString().trim(),
      email:            raw.email?.toString().trim().toLowerCase() || null,
      phone:            raw.phone?.toString().trim() || null,
      plan_name:        raw.plan_name?.toString().trim() || null,
      start_date:       parseDate(raw.start_date),
      end_date:         parseDate(raw.end_date),
      amount_paid:      parseMoney(raw.amount_paid),
      payment_method:   raw.payment_method?.toString().trim().toLowerCase() || 'cash',
      date_of_birth:    parseDate(raw.date_of_birth),
      address:          raw.address?.toString().trim() || null,
      notes:            raw.notes?.toString().trim() || null,
      member_type:      raw.member_type?.toString().trim().toLowerCase() || 'regular',
      emergency_contact:raw.emergency_contact?.toString().trim() || null,
    };

    const errors = validateRow(row, rowNum);
    const isDuplicate = row.email && existingEmails.has(row.email);
    const plan = row.plan_name ? (planMap[row.plan_name.toLowerCase()] || null) : null;

    if (row.plan_name && !plan) {
      errors.push(`Plan "${row.plan_name}" not found — create it first in Plans page`);
    }

    // Auto-compute end_date from plan if start_date given but no end_date
    let endDate = row.end_date;
    if (!endDate && row.start_date && plan) {
      const d = new Date(row.start_date);
      d.setDate(d.getDate() + plan.duration_days);
      endDate = d.toISOString().split('T')[0];
    }

    return {
      rowNum, row, errors, isDuplicate, plan,
      end_date_computed: endDate,
      amount_final: row.amount_paid ?? (plan?.price || null),
    };
  });

  if (dry_run) {
    // Just return validation results
    processed.forEach(p => {
      if (p.errors.length > 0) {
        results.failed++;
        results.rows.push({ row: p.rowNum, status: 'error', errors: p.errors, name: p.row.name });
      } else if (p.isDuplicate) {
        results.skipped++;
        results.rows.push({ row: p.rowNum, status: 'duplicate', name: p.row.name, email: p.row.email });
      } else {
        results.rows.push({ row: p.rowNum, status: 'ok', name: p.row.name, email: p.row.email });
      }
    });
    return res.json({ success: true, dry_run: true, data: results });
  }

  // Actually import valid rows
  for (const p of processed) {
    if (p.errors.length > 0) {
      results.failed++;
      results.rows.push({ row: p.rowNum, status: 'error', errors: p.errors, name: p.row.name });
      continue;
    }
    if (p.isDuplicate && skip_duplicates) {
      results.skipped++;
      results.rows.push({ row: p.rowNum, status: 'skipped', reason: 'Email already exists', name: p.row.name, email: p.row.email });
      continue;
    }

    try {
      await withTransaction(async (client) => {
        const password = default_password || generatePassword();
        const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_ROUNDS || '12'));
        const qrToken = 'MBR-' + Date.now() + '-' + crypto.randomBytes(6).toString('hex').toUpperCase();

        const validMemberType = ['regular','guest','trial'].includes(p.row.member_type) ? p.row.member_type : 'regular';
        const memberEmail = p.row.email || `imported-${crypto.randomBytes(4).toString('hex')}@noemail.local`;

        const memberR = await client.query(
          `INSERT INTO members (name, email, phone, password_hash, role, gym_id, status,
            member_type, date_of_birth, address, emergency_contact, notes, qr_token)
           VALUES ($1,$2,$3,$4,'member',$5,'active',$6,$7,$8,$9,$10,$11)
           ON CONFLICT (email, gym_id) DO UPDATE
             SET name = EXCLUDED.name, phone = COALESCE(EXCLUDED.phone, members.phone),
                 updated_at = NOW()
           RETURNING id, name`,
          [p.row.name, memberEmail, p.row.phone, hash, gymId,
           validMemberType, p.row.date_of_birth || null, p.row.address,
           p.row.emergency_contact, p.row.notes, qrToken]
        );
        const memberId = memberR.rows[0].id;

        // Create subscription if plan + dates available
        if (p.plan && p.row.start_date && p.end_date_computed) {
          const subStatus = new Date(p.end_date_computed) >= new Date() ? 'active' : 'expired';
          await client.query(
            `INSERT INTO subscriptions (member_id, plan_id, gym_id, start_date, end_date,
               status, payment_method, amount_paid)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             ON CONFLICT DO NOTHING`,
            [memberId, p.plan.id, gymId, p.row.start_date, p.end_date_computed,
             subStatus,
             ['cash','upi','card','bank_transfer','online','other'].includes(p.row.payment_method)
               ? p.row.payment_method : 'cash',
             p.amount_final]
          );
        }

        // Track for result
        if (p.row.email) existingEmails.add(p.row.email);
        results.imported++;
        results.rows.push({
          row: p.rowNum, status: 'imported', name: p.row.name,
          email: p.row.email,
          has_subscription: !!(p.plan && p.row.start_date),
          temp_password: default_password ? null : password,
        });
      });
    } catch (err) {
      logger.error('Row import failed', { row: p.rowNum, error: err.message, gymId });
      results.failed++;
      results.rows.push({ row: p.rowNum, status: 'error', errors: [err.message], name: p.row.name });
    }
  }

  await audit(gymId, req.user.id, req.user.role, 'BULK_IMPORT', 'members', null,
    null, { total: results.total, imported: results.imported, failed: results.failed },
    req.ip, req.id);

  logger.info('Bulk import complete', { gymId, ...results, requestId: req.id });
  res.json({ success: true, data: results });
});

// ── GET /api/members/import-status ───────────────────────────────────────────
const importStatus = catchAsync(async (req, res) => {
  const [memberCount, planCount, qrCount] = await Promise.all([
    query("SELECT COUNT(*) FROM members WHERE gym_id=$1 AND role='member' AND is_active=true", [req.gymId]),
    query('SELECT COUNT(*) FROM membership_plans WHERE gym_id=$1 AND is_active=true', [req.gymId]),
    query('SELECT COUNT(*) FROM gym_qr_codes WHERE gym_id=$1 AND is_active=true', [req.gymId]),
  ]);
  res.json({
    success: true,
    data: {
      member_count: parseInt(memberCount.rows[0].count),
      plan_count:   parseInt(planCount.rows[0].count),
      qr_count:     parseInt(qrCount.rows[0].count),
    },
  });
});

function generatePassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(len)).map(b => chars[b % chars.length]).join('');
}

// ── GET /api/gyms/onboarding-status ──────────────────────────────────────────
const onboardingStatus = catchAsync(async (req, res) => {
  const gymId = req.gymId;
  const [gym, plans, members, qr] = await Promise.all([
    query('SELECT name, owner_name, owner_email, owner_phone, address FROM gyms WHERE id=$1', [gymId]),
    query('SELECT COUNT(*) FROM membership_plans WHERE gym_id=$1 AND is_active=true', [gymId]),
    query("SELECT COUNT(*) FROM members WHERE gym_id=$1 AND role='member' AND is_active=true", [gymId]),
    query('SELECT COUNT(*) FROM gym_qr_codes WHERE gym_id=$1 AND is_active=true', [gymId]),
  ]);

  const g = gym.rows[0];
  const steps = {
    gym_profile: !!(g.owner_name && g.owner_phone && g.address),
    plans_created: parseInt(plans.rows[0].count) > 0,
    members_added: parseInt(members.rows[0].count) > 0,
    qr_generated:  parseInt(qr.rows[0].count) > 0,
  };
  const completedSteps = Object.values(steps).filter(Boolean).length;

  res.json({
    success: true,
    data: {
      steps,
      completed: completedSteps,
      total: 4,
      is_complete: completedSteps === 4,
      gym: g,
    },
  });
});




// ── POST /api/import/map-headers ─────────────────────────────────────────────
// Detect what columns map to what fields from the uploaded headers
const detectHeaders = catchAsync(async (req, res) => {
  const { headers } = req.body;
  if (!Array.isArray(headers)) throw AppError.badRequest('headers array required');
  const mapping = mapHeaders(headers);
  const unmapped = headers.filter(h => !mapping[h]);
  res.json({ success: true, data: { mapping, unmapped } });
});

module.exports = { bulkImport, downloadTemplate, importStatus, onboardingStatus, mapHeaders, detectHeaders };
