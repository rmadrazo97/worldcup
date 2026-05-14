// Zod input schemas for every callable. Each handler delegates input
// validation to `withValidate` which runs the matching schema below and
// throws an `invalid-argument` HttpsError on failure.
//
// Strict mode (`.strict()`) rejects unknown keys so a client can't sneak
// extra parameters past the validator into upstream calls.

import { z } from 'zod'

export const SeasonSchema = z.union([
  z.literal(2018),
  z.literal(2022),
  z.literal(2026),
])

export const GetTeamsInput = z.object({ season: SeasonSchema }).strict()

export const GetStadiumsInput = z.object({ season: SeasonSchema }).strict()

export const GetGroupsInput = z.object({ season: SeasonSchema }).strict()

export const GetStandingsInput = z
  .object({
    season: SeasonSchema,
    groupId: z
      .string()
      .regex(/^[A-L]$/)
      .optional(),
  })
  .strict()

export const GetMatchesInput = z
  .object({
    season: SeasonSchema,
    status: z.enum(['SCHED', 'LIVE', 'HT', 'FT', 'PP', 'CXL']).optional(),
    group: z
      .string()
      .regex(/^[A-L]$/)
      .optional(),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict()

export const GetMatchByIdInput = z
  .object({ season: SeasonSchema, matchId: z.string().min(1) })
  .strict()

export const GetMatchDetailsInput = z
  .object({ season: SeasonSchema, matchId: z.string().min(1) })
  .strict()

export const GetLineupInput = z
  .object({
    season: SeasonSchema,
    matchId: z.string().min(1),
    team: z.enum(['home', 'away']),
  })
  .strict()

export type GetTeamsInputT = z.infer<typeof GetTeamsInput>
export type GetStadiumsInputT = z.infer<typeof GetStadiumsInput>
export type GetGroupsInputT = z.infer<typeof GetGroupsInput>
export type GetStandingsInputT = z.infer<typeof GetStandingsInput>
export type GetMatchesInputT = z.infer<typeof GetMatchesInput>
export type GetMatchByIdInputT = z.infer<typeof GetMatchByIdInput>
export type GetMatchDetailsInputT = z.infer<typeof GetMatchDetailsInput>
export type GetLineupInputT = z.infer<typeof GetLineupInput>
