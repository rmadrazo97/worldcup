import { useTeam } from '../api/providers.jsx'

const flagUrl = (code, size = 'w40') => `https://flagcdn.com/${size}/${code}.png`

// Resolve a Team-or-short-code argument to a short string we can pass to useTeam.
// Hooks must run unconditionally, so we always call useTeam and pick the result
// only when the caller did not already provide a Team object.
function shortOf(arg) {
  if (!arg) return ''
  if (typeof arg === 'string') return arg
  return arg.short || ''
}

// Flag accepts either a `team` Team object directly, or a `team`/`code` short
// string which it resolves via the TeamsProvider context. Passing the full
// Team object avoids an extra context read per crest.
export function Flag({ team, code, size = 'md' }) {
  const short = shortOf(team) || shortOf(code) || (typeof code === 'string' ? code : '')
  const lookup = useTeam(short)
  const t = (team && typeof team === 'object') ? team : lookup
  if (!t || !t.code || !short) return null
  const url = size === 'lg' ? flagUrl(t.code, 'w80') : flagUrl(t.code, 'w40')
  return <img src={url} alt={t.name || t.short || ''} loading="lazy" />
}

export function CountryCrest({ team, variant = 'md' }) {
  const cls = variant === 'sm' ? 'crest-sm' : 'crest'
  return (
    <span className={cls}>
      <Flag team={team} size={variant} />
    </span>
  )
}

export function TeamName({ team, dim }) {
  const short = shortOf(team)
  const lookup = useTeam(short)
  const t = (team && typeof team === 'object') ? team : lookup
  if (!t) return null
  return (
    <span className={'name' + (dim ? ' dim' : '')}>
      <span className="name-full">{t.name || t.short}</span>
      <span className="name-mobile">{t.short}</span>
    </span>
  )
}
