// Unfreeze CLI: clears the freeze fields on one or more docs and resets
// `_expiresAt` to (now + 60 s) so the next cache read refetches upstream.
//
// Usage:
//   tsx scripts/unfreeze.ts --doc matches/match_1000 --doc lineups/lineups_1000
//
// Intended for operator use after a stat correction lands upstream.
// The next `freezeCompletedSeasons` pass will re-freeze the doc.

import { initializeApp, getApps } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'

interface Args {
  docs: string[]
}

function parseArgs(argv: string[]): Args {
  const docs: string[] = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--doc' && argv[i + 1]) {
      docs.push(argv[i + 1] as string)
      i++
    }
  }
  return { docs }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.docs.length === 0) {
    console.error('usage: tsx scripts/unfreeze.ts --doc <coll>/<id> [--doc <coll>/<id>...]')
    process.exit(2)
  }

  if (getApps().length === 0) initializeApp()
  const db = getFirestore()

  const refreshAt = Timestamp.fromMillis(Date.now() + 60 * 1000)
  for (const path of args.docs) {
    const slash = path.indexOf('/')
    if (slash < 0) {
      console.error(`invalid doc path: ${path}`)
      continue
    }
    const collection = path.slice(0, slash)
    const docId = path.slice(slash + 1)
    const ref = db.collection(collection).doc(docId)
    const snap = await ref.get()
    if (!snap.exists) {
      console.warn(`not found: ${path}`)
      continue
    }
    await ref.update({
      _frozen: FieldValue.delete(),
      _frozenAt: FieldValue.delete(),
      _frozenReason: FieldValue.delete(),
      _expiresAt: refreshAt,
    })
    console.log(`unfroze ${path}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
