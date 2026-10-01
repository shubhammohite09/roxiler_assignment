import { useState } from 'react';
import { rules } from './api.js';

export function Field({ label, error, children }) {
  return <label className="field"><span>{label}</span>{children}{error && <em role="alert">{error}</em>}</label>;
}

// Generic validated form. fields: [{ key, label, type, rule, options }]
export function Form({ fields, submitLabel, onSubmit, initial = {} }) {
  const [vals, setVals] = useState(initial);
  const [errs, setErrs] = useState({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setMsg('');
    const found = {};
    fields.forEach((f) => { const m = f.rule ? rules[f.rule](vals[f.key] || '') : ''; if (m) found[f.key] = m; });
    setErrs(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try { await onSubmit(vals); setVals(initial); setMsg('Saved'); }
    catch (err) { setErrs(err.errors || {}); if (!Object.keys(err.errors || {}).length) setMsg(err.message); }
    finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="form" noValidate>
      {fields.map((f) => (
        <Field key={f.key} label={f.label} error={errs[f.key]}>
          {f.options ? (
            <select value={vals[f.key] || ''} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })}>
              <option value="">Select…</option>
              {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : f.type === 'textarea' ? (
            <textarea rows="3" value={vals[f.key] || ''} onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
          ) : (
            <input type={f.type || 'text'} value={vals[f.key] || ''} autoComplete="off"
              onChange={(e) => setVals({ ...vals, [f.key]: e.target.value })} />
          )}
        </Field>
      ))}
      <button disabled={busy}>{submitLabel}</button>
      {msg && <p className={msg === 'Saved' ? 'ok' : 'err'}>{msg}</p>}
    </form>
  );
}

// Sortable table. columns: [{ key, label, sortable, render }]
export function Table({ columns, rows, sort, onSort, onRow, empty = 'Nothing to show yet.' }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{columns.map((c) => (
          <th key={c.key} aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
            {c.sortable ? (
              <button className="th" onClick={() => onSort({ key: c.key, dir: sort?.key === c.key && sort.dir === 'asc' ? 'desc' : 'asc' })}>
                {c.label}{sort?.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
              </button>
            ) : c.label}
          </th>))}</tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={columns.length} className="empty">{empty}</td></tr>}
          {rows.map((r, i) => (
            <tr key={r.id ?? i} onClick={onRow ? () => onRow(r) : undefined} className={onRow ? 'click' : ''}>
              {columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : r[c.key] ?? '–'}</td>)}
            </tr>))}
        </tbody>
      </table>
    </div>
  );
}

export const Stars = ({ value }) => (value ? <span className="stars" title={`${value} of 5`}>★ {value}</span> : <span className="muted">No ratings</span>);
