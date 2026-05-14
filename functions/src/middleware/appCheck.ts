// App Check enforcement options shared by every onCall handler.
// Defensive: emulator runs without an attestation provider, so a small
// `bypassInEmulator` helper lets handlers skip an explicit token check
// when the harness is the Functions emulator.

export const APP_CHECK_OPTS = { enforceAppCheck: true } as const

export function bypassInEmulator(): boolean {
  return process.env.FUNCTIONS_EMULATOR === 'true'
}
