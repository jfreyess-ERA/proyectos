'use client';
import { useState, useRef } from 'react';
import { X, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { insertProspect } from '@/lib/db';
import type { Prospect, ProspectPriority, ProspectStatus, ProspectStage } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
  existingProspects: Prospect[];
}

type Step = 'upload' | 'map' | 'preview' | 'done';

const FIELD_OPTIONS = [
  { key: 'skip',           label: '— No importar —' },
  { key: 'company',        label: 'Empresa *' },
  { key: 'contact_name',   label: 'Nombre contacto' },
  { key: 'role',           label: 'Cargo' },
  { key: 'email',          label: 'Email' },
  { key: 'phone',          label: 'Teléfono' },
  { key: 'linkedin',       label: 'LinkedIn' },
  { key: 'industry',       label: 'Industria' },
  { key: 'subsector',      label: 'Subsector' },
  { key: 'country',        label: 'País' },
  { key: 'priority',       label: 'Prioridad' },
  { key: 'status',         label: 'Estado' },
  { key: 'stage',          label: 'Etapa' },
  { key: 'source',         label: 'Fuente' },
  { key: 'pain_points',    label: 'Dolores' },
  { key: 'era_value_angle',label: 'Ángulo ERA' },
  { key: 'notes',          label: 'Notas' },
];

// Auto-detect column → field mapping
function autoMap(header: string): string {
  const h = header.toLowerCase().trim();
  if (h.includes('empresa') || h.includes('company') || h === 'nombre empresa') return 'company';
  if (h.includes('contacto') || h.includes('contact') || h.includes('nombre') && !h.includes('empresa')) return 'contact_name';
  if (h.includes('cargo') || h.includes('rol') || h.includes('role') || h.includes('título')) return 'role';
  if (h.includes('email') || h.includes('correo')) return 'email';
  if (h.includes('tel') || h.includes('phone') || h.includes('fono')) return 'phone';
  if (h.includes('linkedin')) return 'linkedin';
  if (h.includes('industria') || h.includes('sector') || h.includes('industry')) return 'industry';
  if (h.includes('subsector')) return 'subsector';
  if (h.includes('pais') || h.includes('país') || h.includes('country')) return 'country';
  if (h.includes('prioridad') || h.includes('priority')) return 'priority';
  if (h.includes('estado') || h.includes('status')) return 'status';
  if (h.includes('etapa') || h.includes('stage')) return 'stage';
  if (h.includes('fuente') || h.includes('source') || h.includes('origen')) return 'source';
  if (h.includes('dolor') || h.includes('pain') || h.includes('necesidad')) return 'pain_points';
  if (h.includes('era') || h.includes('valor') || h.includes('value')) return 'era_value_angle';
  if (h.includes('nota') || h.includes('note') || h.includes('comment')) return 'notes';
  return 'skip';
}

function parseCSV(text: string): string[][] {
  const lines = text.trim().split('\n').filter(l => l.trim());
  return lines.map(line => {
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) {
        cols.push(current.trim()); current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());
    return cols;
  });
}

const VALID_PRIORITIES = ['High', 'Medium', 'Low', 'Strategic', 'Watchlist'];
const VALID_STATUSES   = ['Active', 'Warm', 'Paused', 'Nurture', 'Closed Won', 'Closed Lost', 'Dormant'];
const VALID_STAGES     = ['New', 'Contacted', 'Meeting Requested', 'Meeting Held', 'Proposal', 'Negotiation', 'Won'];

function normalizeField(key: string, val: string): string {
  if (!val) return val;
  if (key === 'priority') {
    const match = VALID_PRIORITIES.find(p => p.toLowerCase() === val.toLowerCase());
    return match ?? 'Medium';
  }
  if (key === 'status') {
    const match = VALID_STATUSES.find(s => s.toLowerCase() === val.toLowerCase());
    return match ?? 'Active';
  }
  if (key === 'stage') {
    const match = VALID_STAGES.find(s => s.toLowerCase() === val.toLowerCase());
    return match ?? 'New';
  }
  return val;
}

export function CrmImportModal({ open, onClose, onImported, existingProspects }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [csvText, setCsvText] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, string>>({});
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const existingNames = new Set(existingProspects.map(p => p.company.toLowerCase().trim()));

  function handleParse() {
    const parsed = parseCSV(csvText);
    if (parsed.length < 2) return;
    const hdrs = parsed[0];
    const dataRows = parsed.slice(1).filter(r => r.some(c => c.trim()));
    setHeaders(hdrs);
    setRows(dataRows);
    const autoMapping: Record<number, string> = {};
    hdrs.forEach((h, i) => { autoMapping[i] = autoMap(h); });
    setMapping(autoMapping);
    setStep('map');
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { setCsvText(ev.target?.result as string); };
    reader.readAsText(file, 'UTF-8');
  }

  const companyColIdx = Object.entries(mapping).find(([, v]) => v === 'company')?.[0];
  const canImport = companyColIdx !== undefined;

  // Build preview rows
  const previewRows = rows.slice(0, 5).map(row => {
    const obj: Record<string, string> = {};
    Object.entries(mapping).forEach(([colIdx, field]) => {
      if (field !== 'skip') obj[field] = row[Number(colIdx)] ?? '';
    });
    return obj;
  });

  // Detect duplicates in preview
  const duplicates = previewRows.filter(r => r.company && existingNames.has(r.company.toLowerCase().trim()));

  async function handleImport() {
    setImporting(true);
    setErrors([]);
    let count = 0;
    const errs: string[] = [];

    for (const row of rows) {
      const obj: Record<string, string> = {};
      Object.entries(mapping).forEach(([colIdx, field]) => {
        if (field !== 'skip') obj[field] = normalizeField(field, row[Number(colIdx)]?.trim() ?? '');
      });
      if (!obj.company?.trim()) continue;
      try {
        await insertProspect({
          company: obj.company,
          contact_name: obj.contact_name || undefined,
          role: obj.role || undefined,
          email: obj.email || undefined,
          phone: obj.phone || undefined,
          linkedin: obj.linkedin || undefined,
          industry: obj.industry || undefined,
          subsector: obj.subsector || undefined,
          country: obj.country || 'Chile',
          priority: (obj.priority as ProspectPriority) || 'Medium',
          status: (obj.status as ProspectStatus) || 'Active',
          stage: (obj.stage as ProspectStage) || 'New',
          source: obj.source || undefined,
          pain_points: obj.pain_points || undefined,
          era_value_angle: obj.era_value_angle || undefined,
          notes: obj.notes || undefined,
        });
        count++;
      } catch (err) {
        errs.push(`${obj.company}: ${(err as Error).message}`);
      }
    }

    setImportedCount(count);
    setErrors(errs);
    setImporting(false);
    setStep('done');
    if (count > 0) onImported(count);
  }

  function reset() {
    setStep('upload');
    setCsvText('');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setErrors([]);
    setImportedCount(0);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="relative w-full rounded-[14px] overflow-hidden flex flex-col shadow-2xl"
        style={{ maxWidth: 700, maxHeight: '88vh', background: 'var(--bg)', border: '1px solid var(--line)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--line)' }}>
          <div>
            <div className="text-[16px] font-semibold" style={{ color: 'var(--ink)' }}>Importar prospectos</div>
            <div className="text-[12px] mt-[2px]" style={{ color: 'var(--ink-4)' }}>
              {step === 'upload' && 'Paso 1: Cargar archivo'}
              {step === 'map' && `Paso 2: Mapear columnas · ${rows.length} filas detectadas`}
              {step === 'preview' && `Paso 3: Vista previa · ${rows.length} prospectos`}
              {step === 'done' && 'Importación completada'}
            </div>
          </div>
          <button onClick={() => { reset(); onClose(); }} className="w-7 h-7 flex items-center justify-center rounded-[6px] border-0 bg-transparent" style={{ color: 'var(--ink-4)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="flex flex-col gap-4">
              <div
                className="border-2 border-dashed rounded-[10px] p-8 text-center cursor-pointer transition-colors"
                style={{ borderColor: 'var(--line)' }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = ev => setCsvText(ev.target?.result as string);
                    reader.readAsText(file, 'UTF-8');
                  }
                }}
              >
                <Upload size={24} className="mx-auto mb-2" style={{ color: 'var(--ink-4)' }} />
                <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>Arrastra un CSV aquí o haz clic para elegir</div>
                <div className="text-[11px] mt-1" style={{ color: 'var(--ink-4)' }}>Soporta CSV separado por comas, punto y coma o tabulaciones</div>
                <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={handleFile} />
              </div>

              <div className="text-[12px] text-center" style={{ color: 'var(--ink-4)' }}>— o pega el contenido CSV directo —</div>

              <textarea
                value={csvText}
                onChange={e => setCsvText(e.target.value)}
                placeholder={`Empresa,Contacto,Email,Teléfono,Industria\nACME Corp,Juan Pérez,juan@acme.com,+56912345678,Retail\nBeta SA,María González,maria@beta.cl,+56987654321,Minería`}
                rows={8}
                className="w-full px-3 py-2 rounded-[8px] text-[12px] outline-none resize-none"
                style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font-mono, monospace)' }}
              />

              <div className="flex gap-2">
                <button
                  onClick={handleParse}
                  disabled={!csvText.trim()}
                  className="h-9 px-5 rounded-[8px] text-[13px] font-semibold border-0"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: csvText.trim() ? 1 : 0.5 }}
                >
                  Analizar →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Map */}
          {step === 'map' && (
            <div>
              <p className="text-[13px] mb-4" style={{ color: 'var(--ink-3)' }}>
                Asigna cada columna del CSV al campo correspondiente. La columna <strong>Empresa</strong> es obligatoria.
              </p>
              <div className="flex flex-col gap-2 mb-4">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-[8px] px-3 py-2" style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                    <div className="w-[160px] text-[12.5px] font-medium truncate" style={{ color: 'var(--ink)' }}>{h}</div>
                    <span style={{ color: 'var(--ink-4)', fontSize: 12 }}>→</span>
                    <select
                      value={mapping[i] ?? 'skip'}
                      onChange={e => setMapping(m => ({ ...m, [i]: e.target.value }))}
                      className="flex-1 h-8 px-2 rounded-[6px] text-[12px] outline-none"
                      style={{ border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
                    >
                      {FIELD_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                    </select>
                    <div className="text-[11px] w-[100px] truncate" style={{ color: 'var(--ink-4)' }}>
                      ej: {rows[0]?.[i] ?? '—'}
                    </div>
                  </div>
                ))}
              </div>

              {!canImport && (
                <div className="flex items-center gap-2 mb-3 text-[12px]" style={{ color: 'var(--sem-red)' }}>
                  <AlertTriangle size={14} /> Asigna al menos la columna "Empresa"
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setStep('preview')} disabled={!canImport}
                  className="h-9 px-5 rounded-[8px] text-[13px] font-semibold border-0"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: canImport ? 1 : 0.5 }}>
                  Vista previa →
                </button>
                <button onClick={() => setStep('upload')}
                  className="h-9 px-4 rounded-[8px] text-[13px] border-0"
                  style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
                  ← Atrás
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div>
              {duplicates.length > 0 && (
                <div className="flex items-start gap-2 mb-4 p-3 rounded-[8px]" style={{ background: 'oklch(0.97 0.04 85)', border: '1px solid oklch(0.85 0.08 85)' }}>
                  <AlertTriangle size={15} style={{ color: 'oklch(0.55 0.14 85)', flexShrink: 0, marginTop: 1 }} />
                  <div className="text-[12.5px]" style={{ color: 'oklch(0.42 0.12 85)' }}>
                    <strong>{duplicates.length} empresa{duplicates.length !== 1 ? 's' : ''} ya existe{duplicates.length === 1 ? '' : 'n'}:</strong>{' '}
                    {duplicates.map(d => d.company).join(', ')}. Se importarán de todas formas (puedes eliminar duplicados después).
                  </div>
                </div>
              )}

              <div className="text-[12px] mb-3" style={{ color: 'var(--ink-3)' }}>
                Vista previa de los primeros 5 de <strong>{rows.length}</strong> prospectos a importar:
              </div>

              <div className="overflow-x-auto rounded-[8px]" style={{ border: '1px solid var(--line)' }}>
                <table className="w-full border-collapse" style={{ fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
                      {Object.entries(mapping).filter(([, v]) => v !== 'skip').map(([idx]) => (
                        <th key={idx} className="text-left px-3 py-2 font-semibold whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>
                          {FIELD_OPTIONS.find(f => f.key === mapping[Number(idx)])?.label ?? mapping[Number(idx)]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--line)' }}>
                        {Object.entries(mapping).filter(([, v]) => v !== 'skip').map(([idx]) => (
                          <td key={idx} className="px-3 py-2 max-w-[150px] truncate" style={{ color: 'var(--ink)' }}>
                            {row[mapping[Number(idx)]] || <span style={{ color: 'var(--ink-4)' }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-2 mt-4">
                <button onClick={handleImport} disabled={importing}
                  className="h-9 px-5 rounded-[8px] text-[13px] font-semibold border-0"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: importing ? 0.6 : 1 }}>
                  {importing ? `Importando…` : `Importar ${rows.length} prospectos`}
                </button>
                <button onClick={() => setStep('map')} disabled={importing}
                  className="h-9 px-4 rounded-[8px] text-[13px] border-0"
                  style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
                  ← Atrás
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="text-center py-6">
              <CheckCircle size={40} className="mx-auto mb-3" style={{ color: 'var(--sem-green)' }} />
              <div className="text-[18px] font-bold mb-1" style={{ color: 'var(--ink)' }}>
                {importedCount} prospecto{importedCount !== 1 ? 's' : ''} importado{importedCount !== 1 ? 's' : ''}
              </div>
              {errors.length > 0 && (
                <div className="mt-4 text-left">
                  <div className="text-[12px] font-semibold mb-2" style={{ color: 'var(--sem-red)' }}>{errors.length} errores:</div>
                  {errors.map((e, i) => <div key={i} className="text-[12px]" style={{ color: 'var(--ink-3)' }}>{e}</div>)}
                </div>
              )}
              <div className="flex gap-2 justify-center mt-5">
                <button onClick={() => { reset(); onClose(); }}
                  className="h-9 px-5 rounded-[8px] text-[13px] font-semibold border-0"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>
                  Listo
                </button>
                <button onClick={reset}
                  className="h-9 px-4 rounded-[8px] text-[13px] border-0"
                  style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>
                  Importar más
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
