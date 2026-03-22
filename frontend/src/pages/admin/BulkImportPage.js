import React, { useState, useRef, useCallback } from 'react';
import api, { getErrorMessage } from '../../utils/api';
import { T, fmt } from '../../utils/helpers';
import { PageHeader, Card, Btn, Icon, Spinner, Badge } from '../../components/shared/UI';
import { useToast } from '../../context/ToastContext';

/* ── Step IDs ──────────────────────────────────────────────── */
const S = { UPLOAD: 'upload', MAP: 'map', PREVIEW: 'preview', IMPORTING: 'importing', DONE: 'done' };

/* ── Field definitions ─────────────────────────────────────── */
const FIELDS = [
  { key: 'name',             label: 'Full Name',       required: true  },
  { key: 'email',            label: 'Email',           required: false },
  { key: 'phone',            label: 'Phone',           required: false },
  { key: 'plan_name',        label: 'Plan Name',       required: false },
  { key: 'start_date',       label: 'Start Date',      required: false },
  { key: 'end_date',         label: 'End Date',        required: false },
  { key: 'amount_paid',      label: 'Amount Paid (₹)', required: false },
  { key: 'payment_method',   label: 'Payment Method',  required: false },
  { key: 'date_of_birth',    label: 'Date of Birth',   required: false },
  { key: 'address',          label: 'Address',         required: false },
  { key: 'notes',            label: 'Notes',           required: false },
];

/* ── Parse CSV ─────────────────────────────────────────────── */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] || ''; });
    return row;
  }).filter(r => Object.values(r).some(v => v));
  return { headers, rows };
}

/* ── Parse Excel using xlsx (SheetJS) ──────────────────────── */
async function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx');
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: 'YYYY-MM-DD' });
        const headers = json.length > 0 ? Object.keys(json[0]) : [];
        resolve({ headers, rows: json });
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/* ── Chip ──────────────────────────────────────────────────── */
function Chip({ label, color = T.sub }) {
  return (
    <span style={{
      background: `${color}18`, color, border: `1px solid ${color}44`,
      padding: '1px 8px', borderRadius: 3, fontSize: 10,
      fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

/* ── Result row badge ──────────────────────────────────────── */
function RowStatusBadge({ status }) {
  const map = {
    imported: { color: T.green,  label: 'Imported' },
    skipped:  { color: T.amber,  label: 'Skipped'  },
    error:    { color: T.red,    label: 'Error'     },
    ok:       { color: T.green,  label: 'Valid'     },
    duplicate:{ color: T.amber,  label: 'Duplicate' },
  };
  const s = map[status] || map.ok;
  return <Chip label={s.label} color={s.color} />;
}

/* ═══════════════════════════════════════════════════════════ */
export default function BulkImportPage() {
  const [step, setStep] = useState(S.UPLOAD);
  const [file, setFile] = useState(null);
  const [rawData, setRawData] = useState(null);       // { headers, rows }
  const [mapping, setMapping] = useState({});         // { excelHeader: fieldKey }
  const [preview, setPreview] = useState([]);         // mapped preview rows
  const [options, setOptions] = useState({ skip_duplicates: true, dry_run: false });
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [parseError, setParseError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef();
  const toast = useToast();

  /* ── File handling ─────────────────────────────────────── */
  const handleFile = useCallback(async (f) => {
    if (!f) return;
    setParseError('');
    setFile(f);
    try {
      let data;
      if (f.name.endsWith('.csv') || f.type === 'text/csv') {
        const text = await f.text();
        data = parseCSV(text);
      } else if (f.name.match(/\.xlsx?$/)) {
        data = await parseExcel(f);
      } else {
        setParseError('Please upload a .csv or .xlsx file');
        return;
      }
      if (!data.rows.length) { setParseError('File appears to be empty'); return; }
      if (!data.headers.length) { setParseError('Could not read column headers'); return; }

      setRawData(data);

      // Auto-detect column mapping from backend
      try {
        const r = await api.post('/import/detect-headers', { headers: data.headers });
        const detected = r.data?.mapping || r.data || {};
        // Invert: detected = { excelHeader: fieldKey }
        setMapping(detected);
      } catch { /* ignore — user can map manually */ }

      setStep(S.MAP);
    } catch (err) {
      setParseError('Could not parse file: ' + (err.message || 'unknown error'));
    }
  }, []);

  const onDrop = useCallback(e => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  /* ── Build preview rows from current mapping ─────────────── */
  const buildPreview = useCallback(() => {
    return (rawData?.rows || []).slice(0, 8).map((rawRow, i) => {
      const mapped = {};
      Object.entries(mapping).forEach(([excelKey, fieldKey]) => {
        if (fieldKey) mapped[fieldKey] = rawRow[excelKey];
      });
      return { _row: i + 2, ...mapped };
    });
  }, [rawData, mapping]);

  /* ── Proceed to preview ─────────────────────────────────── */
  const goPreview = useCallback(async () => {
    const p = buildPreview();
    if (!p.length) { toast('No rows to preview', 'error'); return; }
    setPreview(p);

    // Dry run to validate all rows
    try {
      const allMapped = (rawData?.rows || []).map(rawRow => {
        const mapped = {};
        Object.entries(mapping).forEach(([k, f]) => { if (f) mapped[f] = rawRow[k]; });
        return mapped;
      });
      await api.post('/import/members', { rows: allMapped, options: { ...options, dry_run: true } });
    } catch { /* show preview anyway */ }

    setStep(S.PREVIEW);
  }, [buildPreview, rawData, mapping, options, toast]);

  /* ── Run actual import ───────────────────────────────────── */
  const runImport = useCallback(async () => {
    const allMapped = (rawData?.rows || []).map(rawRow => {
      const mapped = {};
      Object.entries(mapping).forEach(([k, f]) => { if (f) mapped[f] = rawRow[k]; });
      return mapped;
    });

    setStep(S.IMPORTING);
    setImporting(true);
    try {
      const r = await api.post('/import/members', { rows: allMapped, options });
      const data = r.data?.data || r.data;
      setResults(data);
      setStep(S.DONE);
      toast(`Import complete: ${data.imported} imported, ${data.failed} failed`, data.failed > 0 ? 'info' : 'success');
    } catch (err) {
      toast(getErrorMessage(err, 'Import failed'), 'error');
      setStep(S.PREVIEW);
    } finally {
      setImporting(false);
    }
  }, [rawData, mapping, options, toast]);

  const reset = () => {
    setStep(S.UPLOAD); setFile(null); setRawData(null);
    setMapping({}); setPreview([]); setResults(null); setParseError('');
  };

  const downloadTemplate = () => {
    // Generate CSV client-side — no API call needed, works without auth
    const today = new Date().toISOString().split('T')[0];
    const next30 = new Date(Date.now() + 30*86400000).toISOString().split('T')[0];
    const next90 = new Date(Date.now() + 90*86400000).toISOString().split('T')[0];
    const csv = [
      'Name,Email,Phone,Plan Name,Start Date,End Date,Amount Paid,Payment Method,Date of Birth,Address,Notes',
      `Ramesh Kumar,ramesh@example.com,9876543210,Monthly,${today},${next30},800,cash,15-05-1990,Delhi,`,
      `Priya Sharma,priya@example.com,9876543211,Quarterly,${today},${next90},2100,upi,22-08-1995,Delhi,`,
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'member-import-template.csv';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast('Template downloaded!', 'success');
  };

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div>
      <PageHeader
        title="BULK IMPORT"
        subtitle="Import members from Excel (.xlsx) or CSV"
        actions={
          <Btn variant="ghost" size="sm" onClick={downloadTemplate}>
            <Icon name="download" size={13} /> Download Template
          </Btn>
        }
      />

      {/* Progress indicator */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 28, overflowX: 'auto' }}>
        {[
          [S.UPLOAD,    '1', 'Upload File'],
          [S.MAP,       '2', 'Map Columns'],
          [S.PREVIEW,   '3', 'Preview'],
          [S.DONE,      '4', 'Done'],
        ].map(([id, num, label], i, arr) => {
          const steps = [S.UPLOAD, S.MAP, S.PREVIEW, S.IMPORTING, S.DONE];
          const currentIdx = steps.indexOf(step);
          const thisIdx = steps.indexOf(id);
          const isDone = currentIdx > thisIdx;
          const isActive = step === id || (id === S.PREVIEW && step === S.IMPORTING) || (id === S.DONE && step === S.DONE);
          return (
            <React.Fragment key={id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: isActive ? `${T.accent}18` : isDone ? T.greenDim : T.bg2, borderRadius: i === 0 ? '5px 0 0 5px' : i === arr.length - 1 ? '0 5px 5px 0' : 0, border: `1px solid ${isActive ? T.accent + '55' : isDone ? T.green + '44' : T.border}`, whiteSpace: 'nowrap' }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: isDone ? T.green : isActive ? T.accent : T.bg3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {isDone ? <Icon name="check" size={12} color="#fff" /> : <span style={{ fontFamily: T.mono, fontSize: 10, color: isActive ? '#fff' : T.muted, fontWeight: 700 }}>{num}</span>}
                </div>
                <span style={{ fontSize: 12, fontFamily: T.display, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: isActive ? T.accent : isDone ? T.green : T.muted }}>{label}</span>
              </div>
              {i < arr.length - 1 && <div style={{ width: 1, background: T.border, flexShrink: 0 }} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── STEP 1: Upload ── */}
      {step === S.UPLOAD && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              style={{
                padding: '60px 40px', textAlign: 'center', cursor: 'pointer',
                background: dragOver ? `${T.accent}08` : 'transparent',
                border: `2px dashed ${dragOver ? T.accent : T.border}`,
                borderRadius: 6, transition: 'all 0.2s',
              }}>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])} />
              <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
              <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
                Drop your file here
              </div>
              <div style={{ color: T.sub, marginBottom: 20 }}>
                Supports Excel (.xlsx) and CSV (.csv)
              </div>
              <Btn>Choose File</Btn>
              {parseError && (
                <div style={{ marginTop: 16, color: T.red, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
                  <Icon name="warning" size={14} color={T.red} />{parseError}
                </div>
              )}
            </div>
          </Card>

          {/* Instructions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card style={{ padding: 18 }}>
              <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13, letterSpacing: '0.04em', marginBottom: 12, textTransform: 'uppercase', color: T.sub }}>
                Supported Columns
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {FIELDS.map(f => (
                  <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: T.sub }}>{f.label}</span>
                    {f.required && <Chip label="required" color={T.accent} />}
                  </div>
                ))}
              </div>
            </Card>
            <Card style={{ padding: 18 }}>
              <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13, letterSpacing: '0.04em', marginBottom: 10, textTransform: 'uppercase', color: T.sub }}>Tips</div>
              {[
                'Date formats: DD-MM-YYYY or YYYY-MM-DD',
                'Plan name must match exactly what you created',
                'Phone or Email — at least one required',
                'Max 500 rows per upload',
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 12, color: T.sub }}>
                  <Icon name="check" size={13} color={T.accent} />{t}
                </div>
              ))}
            </Card>
            <Btn variant="ghost" onClick={downloadTemplate} style={{ width: '100%' }}>
              <Icon name="download" size={14} /> Download Template CSV
            </Btn>
          </div>
        </div>
      )}

      {/* ── STEP 2: Map columns ── */}
      {step === S.MAP && rawData && (
        <div>
          <Card style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 15 }}>
                  Map Columns — <span style={{ color: T.accent }}>{file?.name}</span>
                </div>
                <div style={{ color: T.sub, fontSize: 12, marginTop: 2 }}>
                  {rawData.rows.length} rows · {rawData.headers.length} columns detected
                </div>
              </div>
              <Btn variant="ghost" size="sm" onClick={reset}>← Back</Btn>
            </div>

            {/* Column mapping table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.bg1 }}>
                    {['Your Column', 'Sample Data', 'Maps To', ''].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: T.muted, fontFamily: T.mono, letterSpacing: '0.1em', borderBottom: `1px solid ${T.border}`, textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rawData.headers.map(header => {
                    const mapped = mapping[header];
                    const sample = rawData.rows.slice(0, 3).map(r => r[header]).filter(Boolean).join(', ');
                    return (
                      <tr key={header} style={{ borderBottom: `1px solid ${T.border}33` }}>
                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>{header}</td>
                        <td style={{ padding: '10px 12px', fontFamily: T.mono, fontSize: 11, color: T.muted, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sample || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <select
                            value={mapping[header] || ''}
                            onChange={e => setMapping(m => ({ ...m, [header]: e.target.value || null }))}
                            style={{ background: T.bg0, border: `1px solid ${mapped ? T.accent + '66' : T.border}`, borderRadius: 4, padding: '6px 10px', color: mapped ? T.white : T.muted, fontSize: 12, fontFamily: T.font, minWidth: 180 }}>
                            <option value="">— Skip this column —</option>
                            {FIELDS.map(f => (
                              <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                            ))}
                          </select>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {mapped
                            ? <Chip label="Mapped" color={T.green} />
                            : <Chip label="Skipped" color={T.muted} />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Options */}
          <Card style={{ padding: 18, marginBottom: 16 }}>
            <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', color: T.sub, letterSpacing: '0.04em', marginBottom: 12 }}>Import Options</div>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                ['skip_duplicates', 'Skip duplicate emails (recommended)'],
              ].map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={!!options[key]} onChange={e => setOptions(o => ({ ...o, [key]: e.target.checked }))}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: T.accent }} />
                  <span style={{ color: T.sub }}>{label}</span>
                </label>
              ))}
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={reset}>← Upload Different File</Btn>
            <Btn onClick={goPreview}>
              Preview Import ({rawData.rows.length} rows) →
            </Btn>
          </div>
        </div>
      )}

      {/* ── STEP 3: Preview ── */}
      {step === S.PREVIEW && (
        <div>
          <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 14 }}>
                  Preview — first 8 rows of {rawData?.rows.length} total
                </div>
                <div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>
                  Review before importing. All rows will be validated on import.
                </div>
              </div>
              <Btn variant="ghost" size="sm" onClick={() => setStep(S.MAP)}>← Edit Mapping</Btn>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: T.bg1 }}>
                    {['#', 'Name', 'Email', 'Phone', 'Plan', 'Start Date', 'End Date', 'Amount'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 10, color: T.muted, fontFamily: T.mono, borderBottom: `1px solid ${T.border}`, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${T.border}33` }} className="hover-row">
                      <td style={{ padding: '10px 14px', fontFamily: T.mono, fontSize: 11, color: T.muted }}>{row._row}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 500 }}>{row.name || <span style={{ color: T.red }}>—</span>}</td>
                      <td style={{ padding: '10px 14px', fontFamily: T.mono, fontSize: 11, color: T.sub }}>{row.email || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: T.sub }}>{row.phone || '—'}</td>
                      <td style={{ padding: '10px 14px', fontSize: 12 }}>{row.plan_name ? <Chip label={row.plan_name} color={T.accent} /> : '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: T.mono, fontSize: 11, color: T.sub }}>{row.start_date || '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: T.mono, fontSize: 11, color: T.sub }}>{row.end_date || '—'}</td>
                      <td style={{ padding: '10px 14px', fontFamily: T.mono, fontSize: 12, color: T.green }}>{row.amount_paid ? fmt.currency(row.amount_paid) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Summary */}
          <Card style={{ padding: 18, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                ['Total Rows', rawData?.rows.length, T.white],
                ['Ready to Import', rawData?.rows.length, T.green],
                ['File', file?.name, T.sub],
              ].map(([label, val, color]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: T.muted, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 18, color }}>{val}</div>
                </div>
              ))}
            </div>
          </Card>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setStep(S.MAP)}>← Back</Btn>
            <Btn onClick={runImport} style={{ minWidth: 160 }}>
              <Icon name="members" size={14} /> Import {rawData?.rows.length} Members
            </Btn>
          </div>
        </div>
      )}

      {/* ── STEP: Importing ── */}
      {step === S.IMPORTING && (
        <Card style={{ padding: 70, textAlign: 'center' }} className="fadeUp">
          <Spinner size={40} />
          <div style={{ fontFamily: T.display, fontWeight: 700, fontSize: 20, marginTop: 20, marginBottom: 8 }}>
            Importing {rawData?.rows.length} members...
          </div>
          <div style={{ color: T.sub, fontSize: 13 }}>
            Creating accounts, assigning plans. Please don't close this tab.
          </div>
        </Card>
      )}

      {/* ── STEP 4: Done ── */}
      {step === S.DONE && results && (
        <div className="fadeUp">
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total',    value: results.total,    color: T.white  },
              { label: 'Imported', value: results.imported, color: T.green  },
              { label: 'Skipped',  value: results.skipped,  color: T.amber  },
              { label: 'Failed',   value: results.failed,   color: results.failed > 0 ? T.red : T.muted },
            ].map(s => (
              <Card key={s.label} style={{ padding: '16px 20px', textAlign: 'center' }}>
                <div style={{ fontFamily: T.display, fontWeight: 900, fontSize: 36, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{s.label}</div>
              </Card>
            ))}
          </div>

          {/* Row-by-row results */}
          <Card style={{ overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${T.border}`, fontFamily: T.display, fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Import Results
            </div>
            <div style={{ maxHeight: 400, overflowY: 'auto' }}>
              {results.rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${T.border}22` }}>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, paddingTop: 2, minWidth: 28 }}>#{r.row}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: 13 }}>{r.name || '—'}</div>
                    {r.email && <div style={{ fontSize: 11, color: T.muted, fontFamily: T.mono }}>{r.email}</div>}
                    {r.errors?.length > 0 && (
                      <div style={{ fontSize: 11, color: T.red, marginTop: 3 }}>
                        {r.errors.join(' · ')}
                      </div>
                    )}
                    {r.reason && <div style={{ fontSize: 11, color: T.amber, marginTop: 3 }}>{r.reason}</div>}
                    {r.has_subscription && <div style={{ fontSize: 11, color: T.green, marginTop: 3 }}>✓ Subscription created</div>}
                  </div>
                  <RowStatusBadge status={r.status} />
                </div>
              ))}
            </div>
          </Card>

          {/* Note about passwords */}
          {results.rows.some(r => r.temp_password) && (
            <Card style={{ padding: 16, marginBottom: 16, border: `1px solid ${T.amber}44`, background: T.amberDim }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <Icon name="info_circle" size={16} color={T.amber} />
                <div style={{ fontSize: 13, color: T.amber }}>
                  <strong>Temporary passwords were auto-generated</strong> for imported members.
                  Ask members to use "Forgot password" on first login, or share their temp password manually.
                  Passwords are shown in the row results above under each imported member.
                </div>
              </div>
            </Card>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <Btn onClick={reset} variant="ghost">Import Another File</Btn>
            <Btn onClick={() => window.location.href = '/members'}>
              <Icon name="members" size={14} /> View Members
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
