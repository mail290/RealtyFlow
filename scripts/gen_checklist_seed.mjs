// Generates supabase/seed/0002_checklist.sql from the checklist CSV.
// Emits a reusable kh_seed_default_checklist(p_org_id uuid) function that
// creates the standard template + 42 items + no/en/es translations.
//
//   node scripts/gen_checklist_seed.mjs <path-to-checklist-seed.csv>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const csvPath = process.argv[2];
if (!csvPath) {
  console.error('usage: node scripts/gen_checklist_seed.mjs <checklist-seed.csv>');
  process.exit(1);
}

// --- minimal RFC-4180-ish CSV parser (handles quoted fields with commas) ---
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c === '\r') {
      // ignore
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

const sqlStr = (s) => (s == null || s === '' ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const sqlBool = (v) => (String(v).trim() === '1' ? 'true' : 'false');
const sqlArr = (piped) => {
  const parts = String(piped).split('|').map(p => p.trim()).filter(Boolean);
  return `'{${parts.join(',')}}'`;
};

const rows = parseCsv(readFileSync(csvPath, 'utf8'));
const header = rows.shift();
const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

// --- JSON for the client (single source shared with the UI) ---
const jsonItems = rows.map((r) => ({
  code: r[idx.code].trim(),
  sort_order: Number(r[idx.sort_order].trim()),
  category: r[idx.category].trim(),
  requires_photo: r[idx.requires_photo].trim() === '1',
  requires_value: r[idx.requires_value].trim() === '1',
  value_unit: r[idx.value_unit].trim() || null,
  applies_to: r[idx.applies_to].split('|').map((s) => s.trim()).filter(Boolean),
  is_automatic: r[idx.is_automatic].trim() === '1',
  title: { no: r[idx.title_no], en: r[idx.title_en], es: r[idx.title_es] },
}));
const jsonPath = resolve('lib/care/data/checklist.json');
mkdirSync(dirname(jsonPath), { recursive: true });
writeFileSync(jsonPath, JSON.stringify(jsonItems, null, 2) + '\n');
console.log(`wrote ${jsonPath} (${jsonItems.length} items)`);

let body = '';
for (const r of rows) {
  const code = r[idx.code].trim();
  const sort = r[idx.sort_order].trim();
  const category = r[idx.category].trim();
  const rp = sqlBool(r[idx.requires_photo]);
  const rv = sqlBool(r[idx.requires_value]);
  const unit = sqlStr(r[idx.value_unit].trim());
  const applies = sqlArr(r[idx.applies_to]);
  const isAuto = sqlBool(r[idx.is_automatic]);
  const tno = sqlStr(r[idx.title_no]);
  const ten = sqlStr(r[idx.title_en]);
  const tes = sqlStr(r[idx.title_es]);
  body += `
  insert into kh_checklist_items(
      org_id, template_id, code, sort_order, category,
      requires_photo, requires_value, value_unit, applies_to, is_automatic)
    values (
      p_org_id, v_template_id, ${sqlStr(code)}, ${sort}, ${sqlStr(category)},
      ${rp}, ${rv}, ${unit}, ${applies}, ${isAuto})
    returning id into v_item_id;
  insert into kh_checklist_item_translations(item_id, locale, title) values
    (v_item_id, 'no', ${tno}),
    (v_item_id, 'en', ${ten}),
    (v_item_id, 'es', ${tes});
`;
}

const out = `-- =====================================================================
-- Seed: standard 42-point checklist (generated from checklist-seed.csv)
-- Do not edit by hand — regenerate via scripts/gen_checklist_seed.mjs
-- =====================================================================
-- Checklist items carry org_id (Principle 1), so the template is created
-- per organisation. This reusable function provisions the standard
-- template for any org (used at seed time and when onboarding a new
-- SaaS tenant). Editing an item later means bumping to a new version;
-- this function always creates version 1 of code 'standard'.
-- =====================================================================

create or replace function kh_seed_default_checklist(p_org_id uuid)
returns uuid
language plpgsql
as $fn$
declare
  v_template_id uuid;
  v_item_id     uuid;
begin
  insert into kh_checklist_templates(
      org_id, code, version, name, property_types, min_photos, is_active)
    values (
      p_org_id, 'standard', 1, 'Standard 42-punkts tilsyn',
      '{apartment,townhouse,villa,finca}', 14, true)
    returning id into v_template_id;
${body}
  return v_template_id;
end
$fn$;
`;

const outPath = resolve('supabase/seed/0002_checklist.sql');
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, out);
console.log(`wrote ${outPath} (${rows.length} items)`);
