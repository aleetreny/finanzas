import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Papa from 'papaparse'

const root = resolve(import.meta.dirname, '..')
const outputPath = resolve(
  root,
  'supabase/migrations/20260715120907_initial_data.sql',
)

function readCsv(fileName) {
  const contents = readFileSync(resolve(root, fileName), 'utf8').replace(/^\uFEFF/, '')
  const result = Papa.parse(contents, {
    header: true,
    delimiter: ';',
    skipEmptyLines: 'greedy',
  })

  if (result.errors.length > 0) {
    throw new Error(`${fileName}: ${JSON.stringify(result.errors.slice(0, 3))}`)
  }
  return result.data
}

function uuidFor(label) {
  const bytes = createHash('sha256').update(`finanzas:${label}`).digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function sqlText(value) {
  if (value === undefined || value === null || value === '') return 'null'
  return `'${String(value).replaceAll("'", "''")}'`
}

function sqlBool(value) {
  return /^(sí|si|true|1)$/i.test(value ?? '') ? 'true' : 'false'
}

function sqlJson(value) {
  return `${sqlText(JSON.stringify(value))}::jsonb`
}

function chunkedInsert(table, columns, rows, chunkSize = 200) {
  const statements = []
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize)
    statements.push(
      `insert into public.${table} (${columns.join(', ')}) values\n${chunk.join(',\n')};`,
    )
  }
  return statements.join('\n\n')
}

const movements = readCsv('movimientos_financieros_corregidos.csv')
const taxonomy = readCsv('catalogo_categorias.csv')
const recurring = readCsv('recurrentes_iniciales.csv')

if (movements.length !== 1024) {
  throw new Error(`Expected 1024 movements, found ${movements.length}`)
}

const totalCents = movements.reduce(
  (sum, row) => sum + Math.round(Number(row.importe_eur) * 100),
  0,
)
if (totalCents !== 1_427_666) {
  throw new Error(`Expected total 14276.66, found ${(totalCents / 100).toFixed(2)}`)
}

const externalIds = new Set(movements.map((row) => row.id_origen))
if (externalIds.size !== movements.length) {
  throw new Error('Movement source IDs are not unique')
}

const accountId = uuidFor('account:main')
const importBatchId = uuidFor('import:movements-v1')
const propertyId = uuidFor('property:piso-malaga')
const fileContents = readFileSync(resolve(root, 'movimientos_financieros_corregidos.csv'))
const fileHash = createHash('sha256').update(fileContents).digest('hex')

const categoryNames = [...new Set(taxonomy.map((row) => row.categoria_principal))]
const categoryIds = new Map(
  categoryNames.map((name) => [name, uuidFor(`category:${name}`)]),
)
const subcategoryIds = new Map(
  taxonomy.map((row) => [
    `${row.categoria_principal}\u0000${row.subcategoria}`,
    uuidFor(`subcategory:${row.categoria_principal}:${row.subcategoria}`),
  ]),
)

for (const row of movements) {
  if (!categoryIds.has(row.categoria_principal)) {
    throw new Error(`Missing category in taxonomy: ${row.categoria_principal}`)
  }
  const subKey = `${row.categoria_principal}\u0000${row.subcategoria}`
  if (row.subcategoria && !subcategoryIds.has(subKey)) {
    throw new Error(`Missing subcategory in taxonomy: ${row.categoria_principal} / ${row.subcategoria}`)
  }
}

for (const row of recurring) {
  if (!categoryIds.has(row.categoria_principal)) {
    throw new Error(`Missing recurring category in taxonomy: ${row.categoria_principal}`)
  }
}

const tripNames = [...new Set(movements.map((row) => row.viaje_proyecto).filter(Boolean))]
const tripIds = new Map(tripNames.map((name) => [name, uuidFor(`trip:${name}`)]))

const categoryRows = categoryNames.map((name, index) =>
  `(${sqlText(categoryIds.get(name))}, null, ${sqlText(name)}, ${index}, true)`,
)

const subcategoryRows = taxonomy.map((row, index) => {
  const key = `${row.categoria_principal}\u0000${row.subcategoria}`
  return `(${sqlText(subcategoryIds.get(key))}, null, ${sqlText(categoryIds.get(row.categoria_principal))}, ${sqlText(row.subcategoria)}, ${index}, ${sqlBool(row.activa)})`
})

const tripRows = tripNames.map((name) =>
  `(${sqlText(tripIds.get(name))}, null, ${sqlText(name)}, true)`,
)

const frequencyMap = {
  Semanal: 'weekly',
  Mensual: 'monthly',
  Trimestral: 'quarterly',
  Anual: 'yearly',
}

const recurringRows = recurring.map((row) => {
  const subKey = `${row.categoria_principal}\u0000${row.subcategoria}`
  const id = uuidFor(`recurring:${row.nombre}:${row.vigente_desde}`)
  return `(${sqlText(id)}, null, ${sqlText(row.nombre)}, ${Number(row.importe_eur).toFixed(2)}, ${sqlText(frequencyMap[row.frecuencia] ?? row.frecuencia.toLowerCase())}, ${Number(row.dia_del_mes)}, ${sqlText(row.vigente_desde)}, ${sqlText(row.vigente_hasta)}, ${sqlText(categoryIds.get(row.categoria_principal))}, ${sqlText(subcategoryIds.get(subKey))}, ${sqlText(row.contexto)}, ${sqlBool(row.generar_automaticamente)}, true, ${sqlText(row.nota)})`
})

const movementRows = movements.map((row) => {
  const amount = Number(row.importe_eur)
  const direction = row.tipo === 'Ingreso' ? 'income' : row.tipo === 'Gasto' ? 'expense' : 'neutral'
  if ((direction === 'income' && amount < 0) || (direction === 'expense' && amount > 0)) {
    throw new Error(`Sign mismatch at ${row.id_origen}`)
  }
  const subKey = `${row.categoria_principal}\u0000${row.subcategoria}`
  const metadata = {
    fila_original: Number(row.fila_original),
    categoria_original: row.categoria_original || null,
    nota_migracion: row.nota_migracion || null,
  }
  return `(${sqlText(uuidFor(`transaction:${row.id_origen}`))}, null, ${sqlText(accountId)}, ${sqlText(row.fecha)}, ${sqlText(row.nombre)}, ${amount.toFixed(2)}, ${sqlText(direction)}::public.transaction_direction, ${sqlText(categoryIds.get(row.categoria_principal))}, ${sqlText(subcategoryIds.get(subKey))}, ${sqlText(row.contexto)}, ${sqlText(row.plataforma)}, ${sqlText(tripIds.get(row.viaje_proyecto))}, ${sqlText(row.fiscal_piso_malaga)}, ${sqlText(row.nota_migracion)}, 'csv_import'::public.transaction_source, ${sqlText(row.id_origen)}, ${sqlText(importBatchId)}, ${sqlJson(metadata)})`
})

const sql = `-- Generated from the repository CSV files by scripts/generate-seed.mjs.
-- The rows remain invisible under RLS until public.claim_initial_dataset() is
-- called by the first authenticated user.

insert into public.accounts(id, user_id, name, type, currency, is_default)
values (${sqlText(accountId)}, null, 'Cuenta principal', 'bank', 'EUR', true);

insert into public.properties(id, user_id, name, property_type, is_active, notes)
values (${sqlText(propertyId)}, null, 'Piso Málaga', 'rental', true, 'Inmueble inicial del histórico financiero.');

insert into public.import_batches(
  id, user_id, file_name, file_hash, total_rows, imported_rows, rejected_rows, completed_at
) values (
  ${sqlText(importBatchId)}, null, 'movimientos_financieros_corregidos.csv', ${sqlText(fileHash)},
  ${movements.length}, ${movements.length}, 0, now()
);

${chunkedInsert('categories', ['id', 'user_id', 'name', 'sort_order', 'is_active'], categoryRows)}

${chunkedInsert('subcategories', ['id', 'user_id', 'category_id', 'name', 'sort_order', 'is_active'], subcategoryRows)}

${tripRows.length > 0 ? chunkedInsert('trip_projects', ['id', 'user_id', 'name', 'is_active'], tripRows) : '-- No trip projects found.'}

${chunkedInsert(
  'recurring_rules',
  [
    'id', 'user_id', 'name', 'amount', 'frequency', 'day_of_month',
    'effective_from', 'effective_until', 'category_id', 'subcategory_id',
    'context', 'auto_generate', 'is_active', 'notes',
  ],
  recurringRows,
)}

${chunkedInsert(
  'transactions',
  [
    'id', 'user_id', 'account_id', 'transaction_date', 'name', 'amount',
    'direction', 'category_id', 'subcategory_id', 'context', 'platform',
    'trip_project_id', 'fiscal_property_status', 'notes', 'source',
    'source_external_id', 'import_batch_id', 'import_metadata',
  ],
  movementRows,
)}

do $$
declare
  movement_count integer;
  movement_total numeric(14,2);
begin
  select count(*), coalesce(sum(amount), 0)
  into movement_count, movement_total
  from public.transactions
  where import_batch_id = ${sqlText(importBatchId)};

  if movement_count <> 1024 then
    raise exception 'Seed validation failed: expected 1024 movements, found %', movement_count;
  end if;
  if movement_total <> 14276.66 then
    raise exception 'Seed validation failed: expected 14276.66, found %', movement_total;
  end if;
end;
$$;
`

writeFileSync(outputPath, sql, 'utf8')
console.log(
  JSON.stringify({
    outputPath,
    movements: movements.length,
    total: (totalCents / 100).toFixed(2),
    categories: categoryNames.length,
    subcategories: taxonomy.length,
    trips: tripNames.length,
    recurring: recurring.length,
    fileHash,
  }),
)
