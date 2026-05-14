// Exports wired to firebase deploy. Each handler / scheduler is
// re-exported by name so `firebase deploy --only functions:getTeams`
// works.

export { health } from './handlers/health.js'
export { getTeams } from './handlers/teams.js'
export { getStadiums } from './handlers/stadiums.js'
export { getGroups } from './handlers/groups.js'
export { getStandings } from './handlers/standings.js'
export { getMatches, getMatchById } from './handlers/matches.js'
export { getMatchDetails } from './handlers/matchDetails.js'
export { getLineup } from './handlers/lineups.js'

export { refreshLiveMatches } from './schedulers/refreshLiveMatches.js'
export { refreshFixtures } from './schedulers/refreshFixtures.js'
export { refreshStandings } from './schedulers/refreshStandings.js'
export { freezeCompletedSeasons } from './schedulers/freezeCompletedSeasons.js'
