// Zod input validation decorator. On invalid input throws a callable
// `invalid-argument` HttpsError carrying the zod error message so the
// client surfaces a useful diagnostic instead of "internal".

import { HttpsError } from 'firebase-functions/v2/https'
import type { CallableRequest } from 'firebase-functions/v2/https'
import type { ZodSchema } from 'zod'

export function withValidate<I, R>(
  schema: ZodSchema<I>,
  handler: (input: I, req: CallableRequest<unknown>) => Promise<R>,
): (req: CallableRequest<unknown>) => Promise<R> {
  return async (req: CallableRequest<unknown>): Promise<R> => {
    const parsed = schema.safeParse(req.data)
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message, {
        issues: parsed.error.issues,
      })
    }
    return handler(parsed.data, req)
  }
}
