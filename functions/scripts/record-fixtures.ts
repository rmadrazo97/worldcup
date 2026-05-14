// Record-fixtures CLI. Fetches an upstream path with the dev API key from
// BALLDONTLIE_API_KEY env, redacts the auth headers, and writes the JSON
// response to test/fixtures/upstream/<outname>.json.
//
// Usage:
//   BALLDONTLIE_API_KEY=xxx tsx scripts/record-fixtures.ts \
//     /teams 'seasons[]=2026' teams_2026
//
// The fixtures captured here become the source of truth for handler tests
// and seeded local dev data.

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE_URL =
  process.env.BALLDONTLIE_BASE_URL ?? 'https://api.balldontlie.io/fifa/worldcup/v1'

async function main(): Promise<void> {
  const [pathArg, queryString = '', outName] = process.argv.slice(2)
  if (!pathArg) {
    console.error(
      'usage: tsx scripts/record-fixtures.ts <path> <queryString> [outname]',
    )
    process.exit(2)
  }

  const apiKey = process.env.BALLDONTLIE_API_KEY
  if (!apiKey) {
    console.error('BALLDONTLIE_API_KEY env var is required')
    process.exit(2)
  }

  const url = new URL(BASE_URL + pathArg)
  if (queryString) {
    const incoming = new URLSearchParams(queryString)
    for (const [k, v] of incoming.entries()) url.searchParams.append(k, v)
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: apiKey },
  })
  const bodyText = await res.text()
  if (!res.ok) {
    console.error(`upstream ${res.status} ${res.statusText}`)
    console.error(bodyText.slice(0, 500))
    process.exit(1)
  }

  // Parse to verify it's JSON, then re-stringify with pretty indent.
  let parsed: unknown
  try {
    parsed = JSON.parse(bodyText)
  } catch {
    console.error('upstream returned non-JSON response')
    process.exit(1)
  }

  // Redact any auth-looking field defensively (data should never contain
  // headers, but the upstream sometimes echoes diagnostic info).
  const redacted = JSON.stringify(parsed, redactor, 2)

  const here = dirname(fileURLToPath(import.meta.url))
  const outDir = resolve(here, '..', 'test', 'fixtures', 'upstream')
  mkdirSync(outDir, { recursive: true })
  const slug = outName ?? slugFor(pathArg, queryString)
  const outPath = resolve(outDir, `${slug}.json`)
  writeFileSync(outPath, redacted + '\n', 'utf8')
  console.log(`wrote ${outPath} (${redacted.length} bytes)`)
}

function redactor(key: string, value: unknown): unknown {
  if (typeof key === 'string') {
    const lower = key.toLowerCase()
    if (lower === 'authorization' || lower === 'api_key' || lower === 'api-key') {
      return '[REDACTED]'
    }
  }
  return value
}

function slugFor(path: string, query: string): string {
  const cleanPath = path.replace(/^\//, '').replace(/\//g, '_')
  const cleanQuery = query.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')
  return cleanQuery ? `${cleanPath}_${cleanQuery}` : cleanPath
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
