/** Cells starting with = + - @ can execute as formulas in spreadsheets; neutralise them. */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return `"${s.replace(/"/g, '""')}"`
}

export function toCsv(rows: Record<string, unknown>[], columns: { key: string; header: string }[]): string {
  const head = columns.map((c) => cell(c.header)).join(',')
  const body = rows.map((r) => columns.map((c) => cell(r[c.key])).join(','))
  return [head, ...body].join('\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
