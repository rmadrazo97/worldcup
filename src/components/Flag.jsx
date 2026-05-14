import { TEAMS } from '../api/mock-data.js'

const flagUrl = (code, size = "w40") => `https://flagcdn.com/${size}/${code}.png`

export function Flag({ team, size = "md" }) {
  const t = TEAMS[team]
  if (!t) return null
  const url = size === "lg" ? flagUrl(t.code, "w80") : flagUrl(t.code, "w40")
  return <img src={url} alt={t.name} loading="lazy" />
}

export function CountryCrest({ team, variant = "md" }) {
  const cls = variant === "sm" ? "crest-sm" : "crest"
  return (
    <span className={cls}>
      <Flag team={team} size={variant} />
    </span>
  )
}

export function TeamName({ team, dim }) {
  const t = TEAMS[team]
  if (!t) return null
  return (
    <span className={"name" + (dim ? " dim" : "")}>
      <span className="name-full">{t.name}</span>
      <span className="name-mobile">{t.short}</span>
    </span>
  )
}
