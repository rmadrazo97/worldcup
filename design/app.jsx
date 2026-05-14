/* global React, ReactDOM */
const { useState, useMemo, useEffect, useRef } = React;
const { NOW, TEAMS, GROUPS, VENUES, MATCHES, computeStandings,
        LINEUPS, FORMATIONS, MATCH_DETAILS, hasDetails } = window.WC;

// ─────────── Tournament dates: build the date strip ───────────
// June 11 – July 19, 2026. We pre-compute the strip with day-of-week labels
// and which days have live matches. "Today" is June 19.
const TOURNAMENT_DAYS = (() => {
  const out = [];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dows = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  // Jun 11 2026 is a Thursday
  const start = new Date(2026, 5, 11);
  for (let i = 0; i < 39; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push({
      iso: `${months[d.getMonth()]} ${d.getDate()}`,
      num: d.getDate(),
      dow: dows[d.getDay()],
      month: months[d.getMonth()],
    });
  }
  return out;
})();
const TODAY_ISO = "Jun 19";

// ─────────── Helpers ───────────
const flagUrl = (code, size = "w40") => `https://flagcdn.com/${size}/${code}.png`;

function Flag({ team, size = "md" }) {
  const t = TEAMS[team];
  if (!t) return null;
  const url = size === "lg" ? flagUrl(t.code, "w80") : flagUrl(t.code, "w40");
  return <img src={url} alt={t.name} loading="lazy" />;
}

function CountryCrest({ team, variant = "md" }) {
  const cls = variant === "sm" ? "crest-sm" : "crest";
  return (
    <span className={cls}>
      <Flag team={team} size={variant} />
    </span>
  );
}

function TeamName({ team, dim }) {
  const t = TEAMS[team];
  if (!t) return null;
  return (
    <span className={"name" + (dim ? " dim" : "")}>
      <span className="name-full">{t.name}</span>
      <span className="name-mobile">{t.short}</span>
    </span>
  );
}

// ─────────── Header ───────────
function Header({ view, onBack, searchOpen, setSearchOpen, query, onQuery }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (searchOpen) {
      // Tiny defer so the width transition starts visibly before focus
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [searchOpen]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        onQuery("");
      } else if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, setSearchOpen, onQuery]);

  return (
    <header className="header">
      <div className="shell">
        <div className="header-inner">
          {view === "detail" ? (
            <button className="brand-back" onClick={onBack} aria-label="Back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
          ) : null}
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">W</span>
            <span>World Cup</span>
            <span className="brand-year">2026</span>
          </div>
          <div className="header-right">
            <div className={"search-wrap" + (searchOpen ? " is-open" : "")}>
              <input
                ref={inputRef}
                className="search-input"
                type="text"
                placeholder="Search teams, groups, venues…"
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                onBlur={() => {
                  if (!query) setSearchOpen(false);
                }}
                autoComplete="off"
                spellCheck="false"
              />
              <span className="kbd" aria-hidden="true">ESC</span>
              <button
                className={"search-btn" + (searchOpen ? " is-open" : "")}
                onClick={() => {
                  if (searchOpen && query) {
                    onQuery("");
                  } else {
                    setSearchOpen(!searchOpen);
                  }
                }}
                aria-label={searchOpen ? "Close search" : "Open search"}
              >
                {searchOpen && query ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <path d="m21 21-4.3-4.3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

// ─────────── Intro / page title (only on main view) ───────────
function Intro() {
  const liveCount = MATCHES.filter(m => m.status === "LIVE").length;
  const todayCount = MATCHES.filter(m => m.date === TODAY_ISO).length;
  return (
    <div className="intro">
      <span className="intro-eyebrow">Friday, June 19 · Matchday 2</span>
      <h1 className="intro-title">Live scores &amp; fixtures.</h1>
      <div className="intro-meta">
        <span className="now-dot" />
        <span>{liveCount} live now · {todayCount} matches today</span>
      </div>
    </div>
  );
}

// ─────────── Date strip ───────────
function DateStrip() {
  const stripRef = useRef(null);
  const liveByDay = useMemo(() => {
    const set = new Set();
    MATCHES.forEach(m => { if (m.status === "LIVE") set.add(m.date); });
    return set;
  }, []);

  useEffect(() => {
    // Scroll today into view on mount
    const todayEl = stripRef.current?.querySelector(".date-pill.is-today");
    if (todayEl) {
      todayEl.scrollIntoView({ block: "nearest", inline: "center" });
    }
  }, []);

  const scrollBy = (dx) => {
    stripRef.current?.scrollBy({ left: dx, behavior: "smooth" });
  };

  return (
    <div className="date-strip-wrap">
      <div className="date-strip-head">
        <div className="date-strip-month">June <span className="year">2026</span></div>
        <div className="date-nav">
          <button onClick={() => scrollBy(-240)} aria-label="Previous days">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <button onClick={() => scrollBy(240)} aria-label="Next days">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      </div>
      <div className="date-strip" ref={stripRef}>
        {TOURNAMENT_DAYS.map(d => {
          const isToday = d.iso === TODAY_ISO;
          const todayIdx = TOURNAMENT_DAYS.findIndex(x => x.iso === TODAY_ISO);
          const myIdx = TOURNAMENT_DAYS.findIndex(x => x.iso === d.iso);
          const isPast = myIdx < todayIdx;
          const hasLive = liveByDay.has(d.iso);
          return (
            <div
              key={d.iso}
              className={
                "date-pill" +
                (isToday ? " is-today" : "") +
                (isPast ? " is-past" : "") +
                (hasLive ? " has-live" : "")
              }
            >
              <span className="d-num">{d.num}</span>
              <span className="d-day">{d.dow}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────── Tabs ───────────
function Tabs({ active, onChange, counts }) {
  const items = [
    { id: "all",      label: "All"      },
    { id: "live",     label: "Live"     },
    { id: "today",    label: "Today"    },
    { id: "yesterday",label: "Yesterday"},
    { id: "upcoming", label: "Upcoming" },
  ];
  return (
    <div className="tabs">
      {items.map(t => {
        const hasLive = t.id === "live" && counts.live > 0;
        return (
          <button
            key={t.id}
            className={
              "tab" +
              (active === t.id ? " active" : "") +
              (hasLive && active !== t.id ? " has-live" : "")
            }
            onClick={() => onChange(t.id)}
          >
            <span>{t.label}</span>
            <span className="tab-count">{counts[t.id]}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─────────── Live cards (dramatic dark) ───────────
function LiveCard({ match, onOpen }) {
  return (
    <div className="live-card" onClick={() => onOpen(match.id)}>
      <div className="live-card-top">
        <span className="live-card-group">Group {match.group} · MD{match.md}</span>
        <span className="live-card-venue">{VENUES[match.venue]}</span>
      </div>
      <div className="live-card-body">
        <div className="live-team">
          <span className="crest"><Flag team={match.home} size="lg" /></span>
          <span className="name">{TEAMS[match.home].name}</span>
        </div>
        <div className="live-score">
          <span>{match.hs}</span>
          <span className="sep">–</span>
          <span>{match.as}</span>
        </div>
        <div className="live-team">
          <span className="crest"><Flag team={match.away} size="lg" /></span>
          <span className="name">{TEAMS[match.away].name}</span>
        </div>
      </div>
      <div className="live-card-foot">
        <span className="live-status">
          <span className="live-dot" />
          <span>Live</span>
        </span>
        <span className="live-minute">{match.minute}</span>
      </div>
    </div>
  );
}

function LiveSection({ onOpenMatch }) {
  const live = MATCHES.filter(m => m.status === "LIVE");
  if (live.length === 0) return null;
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">
          Live now
          <span className="badge-count">{live.length}</span>
        </h2>
        <a href="#" className="section-aux" onClick={(e)=>e.preventDefault()}>All matches →</a>
      </div>
      <div className="live-grid">
        {live.map(m => <LiveCard key={m.id} match={m} onOpen={onOpenMatch} />)}
      </div>
    </section>
  );
}

// ─────────── Match card (regular row) ───────────
function MatchCard({ match, onOpen, showDate = false }) {
  const isLive = match.status === "LIVE";
  const isFT   = match.status === "FT";
  const isSched= match.status === "SCHED";

  const homeWon = isFT && match.hs > match.as;
  const awayWon = isFT && match.as > match.hs;

  return (
    <div
      className={"match-card" + (isLive ? " is-live" : "")}
      onClick={() => onOpen && onOpen(match.id)}
    >
      <div className="col-kickoff">
        <span className="kickoff-time">
          {isSched ? match.kickoff.replace(/:00 /, " ") : isLive ? match.minute : "FT"}
        </span>
        <span className="kickoff-date">{showDate ? match.date : `Group ${match.group}`}</span>
      </div>
      <div className={"match-team home" + (awayWon ? " dim" : "")}>
        <CountryCrest team={match.home} />
        <TeamName team={match.home} dim={awayWon} />
      </div>
      <div className={"score-cell" + (isLive ? " live" : isSched ? " vs" : "")}>
        {isSched ? (
          <React.Fragment>
            <span className="nums">vs</span>
            <span className="sub">{match.date}</span>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <span className="nums">
              <span>{match.hs}</span>
              <span className="sep">–</span>
              <span>{match.as}</span>
            </span>
            <span className="sub">{isLive ? match.minute : "Full time"}</span>
          </React.Fragment>
        )}
      </div>
      <div className={"match-team away" + (homeWon ? " dim" : "")}>
        <CountryCrest team={match.away} />
        <TeamName team={match.away} dim={homeWon} />
      </div>
      <div className="col-status">
        <span className="tag">
          {isLive  && <React.Fragment><i style={{width:6,height:6,borderRadius:6,background:"var(--live)",boxShadow:"0 0 6px var(--live-glow)"}} /> Group {match.group}</React.Fragment>}
          {isFT    && <React.Fragment>Group {match.group}</React.Fragment>}
          {isSched && <React.Fragment>Group {match.group}</React.Fragment>}
        </span>
      </div>
    </div>
  );
}

// ─────────── Group card (clickable) ───────────
function GroupCard({ group, onOpen }) {
  const standings = useMemo(() => computeStandings(group, MATCHES), [group]);
  const groupMatches = useMemo(() => MATCHES.filter(m => m.group === group.id), [group]);
  const hasLive = groupMatches.some(m => m.status === "LIVE");
  const played = groupMatches.filter(m => m.status === "FT").length;
  const liveCount = groupMatches.filter(m => m.status === "LIVE").length;

  let stateLabel = `${played}/6 played`;
  if (hasLive) stateLabel = `${liveCount} live · ${played}/6 played`;
  else if (played === 0) stateLabel = "Not started";
  else if (played === 6) stateLabel = "Complete";

  return (
    <article
      className={"group-card" + (hasLive ? " has-live" : "")}
      onClick={() => onOpen(group.id)}
    >
      <div className="group-head">
        <div className="group-id-block">
          <span className="group-id">{group.id}</span>
          <span className="group-id-label">Group</span>
        </div>
        <span className={"group-state" + (hasLive ? " has-live" : "")}>{stateLabel}</span>
      </div>
      <div className="group-teams">
        {standings.map((row, i) => (
          <div key={row.team} className={"group-team-row" + (i < 2 ? " qual" : "")}>
            <span className="pos">{i + 1}</span>
            <div className="team-l">
              <CountryCrest team={row.team} variant="sm" />
              <span className="t-name">{TEAMS[row.team].name}</span>
            </div>
            <div className="t-stats">
              <span className="gd">{row.gd > 0 ? `+${row.gd}` : row.gd}</span>
              <span className="pts">{row.pts}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="group-foot">
        <span>4 teams · 6 matches</span>
        <span className="arrow">
          View group
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </span>
      </div>
    </article>
  );
}

// ─────────── Group detail view ───────────
function GroupDetail({ groupId, onBack, onOpenMatch }) {
  const group = GROUPS.find(g => g.id === groupId);
  const standings = useMemo(() => computeStandings(group, MATCHES), [group]);
  const groupMatches = useMemo(() => MATCHES.filter(m => m.group === groupId), [groupId]);
  const liveCount = groupMatches.filter(m => m.status === "LIVE").length;
  const played   = groupMatches.filter(m => m.status === "FT").length;

  // Group by matchday
  const byMd = [1, 2, 3].map(md => groupMatches.filter(m => m.md === md));

  return (
    <div className="detail">
      <div className="shell">
        <div className="detail-hero">
          <div className="breadcrumb">
            <span>World Cup 2026</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            <span>Groups</span>
          </div>
          <h1>
            Group {group.id}
            <span className="label">{group.teams.map(t => TEAMS[t].name).join(" · ")}</span>
          </h1>
          <div className="summary">
            <span>4 teams</span>
            <span className="sep">·</span>
            <span>6 matches</span>
            <span className="sep">·</span>
            <span>{played} played</span>
            {liveCount > 0 && <React.Fragment>
              <span className="sep">·</span>
              <span className="has-live">{liveCount} live</span>
            </React.Fragment>}
          </div>
        </div>
      </div>

      <div className="shell">
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Standings</h2>
          </div>
          <div className="standings">
            <table>
              <thead>
                <tr>
                  <th>Team</th>
                  <th>P</th>
                  <th>W</th>
                  <th>D</th>
                  <th>L</th>
                  <th>GF</th>
                  <th>GA</th>
                  <th>GD</th>
                  <th>Pts</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row, i) => {
                  const cls = i < 2 ? "qual" : i === 2 ? "maybe" : "";
                  return (
                    <tr key={row.team} className={cls}>
                      <td>
                        <div className="team-cell">
                          <span className="pos-cell">{i + 1}</span>
                          <CountryCrest team={row.team} variant="sm" />
                          <span className="country">{TEAMS[row.team].name}</span>
                        </div>
                      </td>
                      <td>{row.pld}</td>
                      <td>{row.w}</td>
                      <td>{row.d}</td>
                      <td>{row.l}</td>
                      <td>{row.gf}</td>
                      <td>{row.ga}</td>
                      <td>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                      <td className="pts">{row.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="legend">
              <span><i style={{background:"var(--ink-0)"}}/>Advance to knockout</span>
              <span><i style={{background:"var(--ink-4)"}}/>Best 3rd-placed (8 of 12)</span>
            </div>
          </div>
        </section>

        {byMd.map((md, i) => (
          <section className="section md-section" key={i}>
            <h3>
              Matchday {i + 1}
              <span className="md-date">{md[0]?.date}</span>
            </h3>
            <div className="match-list">
              {md.map(m => <MatchCard key={m.id} match={m} onOpen={onOpenMatch} showDate={false} />)}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// ─────────── Match detail view ───────────
function Pitch({ home, away }) {
  // Home team: bottom half (their own goal at y=140, attacking up)
  // Away team: top half (their own goal at y=0, attacking down)
  const homeForm = FORMATIONS[home.formation] || FORMATIONS["4-3-3"];
  const awayForm = FORMATIONS[away.formation] || FORMATIONS["4-3-3"];

  // Map formation coords. Each y is 0–100 from team's own goal toward opposing.
  // We render in viewBox 100 wide × 140 tall. Home occupies y 140 (goal) → 70 (halfway).
  // Away occupies y 0 (goal) → 70 (halfway).
  // Home position y_screen = 140 - (y_form * 70 / 100)
  // Away position y_screen =       (y_form * 70 / 100)
  const homePositions = homeForm.map(p => ({ x: p.x, y: 140 - (p.y * 70 / 100) }));
  const awayPositions = awayForm.map(p => ({ x: p.x, y:        p.y * 70 / 100  }));

  return (
    <svg className="pitch-svg" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">
      {/* Pitch outline */}
      <rect x="2" y="2" width="96" height="136" rx="2" className="pitch-line" />
      {/* Halfway line */}
      <line x1="2" y1="70" x2="98" y2="70" className="pitch-line center" />
      {/* Center circle */}
      <circle cx="50" cy="70" r="10" className="pitch-line" />
      <circle cx="50" cy="70" r="0.5" fill="rgba(255,255,255,0.30)" />
      {/* Home penalty area (bottom) */}
      <rect x="22" y="120" width="56" height="18" className="pitch-line" />
      <rect x="36" y="130" width="28" height="8"  className="pitch-line" />
      <rect x="44" y="138" width="12" height="3"  className="pitch-line" />
      {/* Away penalty area (top) */}
      <rect x="22" y="2"  width="56" height="18" className="pitch-line" />
      <rect x="36" y="2"  width="28" height="8"  className="pitch-line" />
      <rect x="44" y="-1" width="12" height="3"  className="pitch-line" />

      {/* Penalty spots */}
      <circle cx="50" cy="126" r="0.5" fill="rgba(255,255,255,0.30)" />
      <circle cx="50" cy="14"  r="0.5" fill="rgba(255,255,255,0.30)" />

      {/* Away players (top) */}
      {away.lineup.starters.map((p, i) => {
        const pos = awayPositions[i];
        if (!pos) return null;
        return (
          <PlayerNode key={"a" + i} side="away" player={p} pos={pos} reverse />
        );
      })}

      {/* Home players (bottom) */}
      {home.lineup.starters.map((p, i) => {
        const pos = homePositions[i];
        if (!pos) return null;
        return (
          <PlayerNode key={"h" + i} side="home" player={p} pos={pos} />
        );
      })}
    </svg>
  );
}

function PlayerNode({ player, pos, side, reverse }) {
  // reverse flips the label position above the dot (so away players' names sit above)
  const labelY = reverse ? pos.y - 5.5 : pos.y + 5.5;
  // Truncate name for fit
  const display = player.name.length > 14 ? player.name.slice(0, 13) + "…" : player.name;
  const labelWidth = Math.max(14, display.length * 1.55);
  return (
    <g className={"player-node " + side}>
      <circle cx={pos.x} cy={pos.y} r="2.8" className="num-bg" />
      <text x={pos.x} y={pos.y} className="num">{player.n}</text>
      <rect
        x={pos.x - labelWidth / 2}
        y={labelY - 1.6}
        width={labelWidth}
        height="3.2"
        rx="1.2"
        className="label-bg"
      />
      <text x={pos.x} y={labelY} className="label">{display}</text>
    </g>
  );
}

function LineupView({ match }) {
  const home = { code: match.home, lineup: LINEUPS[match.home] };
  const away = { code: match.away, lineup: LINEUPS[match.away] };
  if (!home.lineup || !away.lineup) {
    return (
      <div className="detail-fallback">
        <h4>Line-ups not announced</h4>
        <p>The official squads will be confirmed an hour before kickoff.</p>
      </div>
    );
  }
  return (
    <div className="lineup-wrap">
      <div className="lineup-meta">
        <div className="side">
          <CountryCrest team={match.home} variant="sm" />
          <span>{TEAMS[match.home].name}</span>
          <span className="formation">{home.lineup.formation}</span>
        </div>
        <div className="side" style={{flexDirection:"row-reverse"}}>
          <CountryCrest team={match.away} variant="sm" />
          <span>{TEAMS[match.away].name}</span>
          <span className="formation">{away.lineup.formation}</span>
        </div>
      </div>
      <div className="pitch-wrap">
        <Pitch
          home={{ formation: home.lineup.formation, lineup: home.lineup }}
          away={{ formation: away.lineup.formation, lineup: away.lineup }}
        />
      </div>
      <div className="lineup-subs">
        <div className="lineup-subs-col">
          <span className="label">Bench — {TEAMS[match.home].short}</span>
          <span className="names">{home.lineup.subs.join(" · ")}</span>
          <span className="coach">Coach · {home.lineup.coach}</span>
        </div>
        <div className="lineup-subs-col">
          <span className="label">Bench — {TEAMS[match.away].short}</span>
          <span className="names">{away.lineup.subs.join(" · ")}</span>
          <span className="coach">Coach · {away.lineup.coach}</span>
        </div>
      </div>
    </div>
  );
}

function StatsView({ match }) {
  const details = MATCH_DETAILS[match.id];
  if (!details || !details.stats) {
    return (
      <div className="detail-fallback">
        <h4>Statistics not available yet</h4>
        <p>Live stats will appear here once the match kicks off.</p>
      </div>
    );
  }
  const stats = details.stats;
  return (
    <div className="stats-wrap">
      <div className="stats-head">
        <div className="h-team">
          <CountryCrest team={match.home} variant="sm" />
          <span className="name">{TEAMS[match.home].short}</span>
        </div>
        <div className="h-mid">Match stats</div>
        <div className="h-team away">
          <CountryCrest team={match.away} variant="sm" />
          <span className="name">{TEAMS[match.away].short}</span>
        </div>
      </div>
      {Object.entries(stats).map(([label, [h, a]]) => {
        // Bar widths are proportional to total
        const total = (h + a) || 1;
        const hPct = (h / total) * 100;
        const aPct = (a / total) * 100;
        return (
          <div className="stat-row" key={label}>
            <span className="v-home">{h}</span>
            <div className="bar home">
              <span className="fill" style={{ width: hPct + "%" }} />
            </div>
            <span className="stat-label">{label}</span>
            <div className="bar away">
              <span className="fill" style={{ width: aPct + "%" }} />
            </div>
            <span className="v-away">{a}</span>
          </div>
        );
      })}
    </div>
  );
}

function TimelineView({ match }) {
  const details = MATCH_DETAILS[match.id];
  if (!details || !details.timeline) {
    return (
      <div className="detail-fallback">
        <h4>No events yet</h4>
        <p>Goals, cards and substitutions will be tracked here in real time.</p>
      </div>
    );
  }
  return (
    <div className="timeline-wrap">
      {details.timeline.map((ev, i) => (
        <TimelineEvent key={i} ev={ev} />
      ))}
    </div>
  );
}

function TimelineEvent({ ev }) {
  if (ev.type === "half" || ev.type === "full") {
    return (
      <div className={"timeline-event is-" + ev.type}>
        <span className="min">{ev.min}</span>
        <div className="ev">
          <div className="ev-text">{ev.type === "half" ? "Half time" : "Full time"}</div>
        </div>
      </div>
    );
  }
  const team = TEAMS[ev.team];
  let icon, sub;
  if (ev.type === "goal") {
    icon = (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M5.6 18.4 18.4 5.6" strokeWidth="1.4" opacity="0.5"/>
      </svg>
    );
    sub = ev.assist ? `Goal · assist ${ev.assist}` : "Goal";
  } else if (ev.type === "yellow") {
    icon = <span style={{display:"inline-block", width:10, height:13, background:"#FFC107", borderRadius:1.5}} />;
    sub = "Yellow card";
  } else if (ev.type === "red") {
    icon = <span style={{display:"inline-block", width:10, height:13, background:"#E80F13", borderRadius:1.5}} />;
    sub = "Red card";
  } else if (ev.type === "sub") {
    icon = (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7"/>
      </svg>
    );
    sub = `${ev.playerOff} → ${ev.playerOn}`;
  }
  const isGoal = ev.type === "goal";
  return (
    <div className={"timeline-event" + (isGoal ? " is-goal" : "")}>
      <span className="min">{ev.min}</span>
      <div className="ev">
        <span className="ev-icon">{icon}</span>
        <div className="ev-text">
          <span className="ev-player">{ev.player || (ev.type === "sub" ? "Substitution" : "")}</span>
          <span className="ev-sub">{sub}</span>
        </div>
        <div className="ev-tag">
          {isGoal && <span className="ev-score">{ev.score}</span>}
          <span className="ev-flag"><Flag team={ev.team} /></span>
          <span>{team.short}</span>
        </div>
      </div>
    </div>
  );
}

function FanRush({ count }) {
  return (
    <span className="fan-pill">
      <span className="fan-stack">
        <span className="fan-dot">A</span>
        <span className="fan-dot f2">M</span>
        <span className="fan-dot f3">L</span>
      </span>
      <span>{(count / 1000).toFixed(1)}k+</span>
    </span>
  );
}

function MatchDetail({ matchId, onBack }) {
  const match = MATCHES.find(m => m.id === matchId);
  const [tab, setTab] = useState("lineup");
  if (!match) return null;

  const isLive = match.status === "LIVE";
  const isFT   = match.status === "FT";
  const isSched= match.status === "SCHED";
  const home = TEAMS[match.home];
  const away = TEAMS[match.away];
  const details = MATCH_DETAILS[match.id];
  const fanCount = details?.fans || 5200;

  return (
    <div className="match-detail">
      <div className="shell">

        <div className="summary-card">
          <div className="summary-status">
            {isLive && (
              <span className="live-chip">
                <span className="dot" />
                <span>Live · {match.minute}</span>
              </span>
            )}
            {isFT && (
              <span className="live-chip is-final">
                <span className="dot" />
                <span>Full time</span>
              </span>
            )}
            {isSched && (
              <span className="live-chip is-sched">
                <span className="dot" />
                <span>{match.kickoff} · {match.date}</span>
              </span>
            )}
          </div>
          <div className="summary-body">
            <div className="summary-team">
              <span className="crest-lg"><Flag team={match.home} size="lg" /></span>
              <span className="t-name-lg">{home.name}</span>
              <span className="t-side">Group {match.group}</span>
            </div>
            <div className="summary-score">
              {isSched ? (
                <React.Fragment>
                  <span>—</span><span className="sep">vs</span><span>—</span>
                </React.Fragment>
              ) : (
                <React.Fragment>
                  <span>{match.hs}</span>
                  <span className="sep">–</span>
                  <span>{match.as}</span>
                </React.Fragment>
              )}
            </div>
            <div className="summary-team">
              <span className="crest-lg"><Flag team={match.away} size="lg" /></span>
              <span className="t-name-lg">{away.name}</span>
              <span className="t-side">Group {match.group}</span>
            </div>
          </div>
          <div className="summary-foot">
            <span className="left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {VENUES[match.venue]}
            </span>
            <span className="live-fan-rush">
              <span style={{fontSize:12, color:"var(--ink-2)", marginRight:8}}>Live fan rush</span>
              <FanRush count={fanCount} />
            </span>
          </div>
        </div>

        <div className="detail-tabs">
          <button className={"detail-tab" + (tab === "lineup" ? " active" : "")} onClick={() => setTab("lineup")}>Line up</button>
          <button className={"detail-tab" + (tab === "stats"  ? " active" : "")} onClick={() => setTab("stats")}>Statistics</button>
          <button className={"detail-tab" + (tab === "timeline" ? " active" : "")} onClick={() => setTab("timeline")}>Timeline</button>
        </div>

        {tab === "lineup"   && <LineupView   match={match} />}
        {tab === "stats"    && <StatsView    match={match} />}
        {tab === "timeline" && <TimelineView match={match} />}
      </div>
    </div>
  );
}

// ─────────── Search filter ───────────
function applyQuery(matches, groups, query) {
  const q = query.trim().toLowerCase();
  if (!q) return { matches, groups };

  const teamHit = (code) => {
    const t = TEAMS[code];
    return t.name.toLowerCase().includes(q)
        || t.short.toLowerCase().includes(q)
        || t.code.toLowerCase().includes(q);
  };
  const venueHit = (vId) => (VENUES[vId] || "").toLowerCase().includes(q);
  const groupHit = (g) =>
    `group ${g.id}`.toLowerCase().includes(q) ||
    g.id.toLowerCase() === q ||
    g.teams.some(teamHit);

  return {
    matches: matches.filter(m =>
      teamHit(m.home) || teamHit(m.away) || venueHit(m.venue) ||
      `group ${m.group}`.toLowerCase().includes(q) ||
      m.group.toLowerCase() === q
    ),
    groups: groups.filter(groupHit),
  };
}

// ─────────── App ───────────
function App() {
  // Navigation: a stack of routes for back behavior.
  // Each route is one of: { name: "main" } | { name: "group", id } | { name: "match", id }
  const [stack, setStack] = useState([{ name: "main" }]);
  const route = stack[stack.length - 1];

  const push = (r) => {
    setStack(s => [...s, r]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goBack = () => {
    setStack(s => s.length > 1 ? s.slice(0, -1) : s);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goHome = () => {
    setStack([{ name: "main" }]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openGroup = (id) => push({ name: "group", id });
  const openMatch = (matchId) => push({ name: "match", id: matchId });

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("all");

  // ── Counts for tabs (driven off the full match set) ──
  const counts = useMemo(() => ({
    all:       MATCHES.length,
    live:      MATCHES.filter(m => m.status === "LIVE").length,
    today:     MATCHES.filter(m => m.date === TODAY_ISO).length,
    yesterday: MATCHES.filter(m => m.date === "Jun 18").length,
    upcoming:  MATCHES.filter(m => m.status === "SCHED").length,
  }), []);

  // ── Today + tab feed ──
  const filtered = useMemo(() => applyQuery(MATCHES, GROUPS, query), [query]);
  const isSearching = query.trim().length > 0;

  const feedByTab = useMemo(() => {
    let pool = filtered.matches;
    if (tab === "live")      pool = pool.filter(m => m.status === "LIVE");
    else if (tab === "today")pool = pool.filter(m => m.date === TODAY_ISO);
    else if (tab === "yesterday") pool = pool.filter(m => m.date === "Jun 18");
    else if (tab === "upcoming")  pool = pool.filter(m => m.status === "SCHED");
    return [...pool].sort((a, b) => {
      const order = { LIVE: 0, SCHED: 1, FT: 2 };
      return order[a.status] - order[b.status];
    });
  }, [filtered.matches, tab]);

  const noResults = isSearching && filtered.matches.length === 0 && filtered.groups.length === 0;

  return (
    <div className="app">
      <Header
        view={route.name === "main" ? "main" : "detail"}
        onBack={goBack}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        query={query}
        onQuery={setQuery}
      />

      {route.name === "match" ? (
        <MatchDetail matchId={route.id} onBack={goBack} />
      ) : route.name === "group" ? (
        <GroupDetail groupId={route.id} onBack={goBack} onOpenMatch={openMatch} />
      ) : (
        <div className="shell">
          <Intro />
          <DateStrip />

          {noResults ? (
            <section className="section">
              <div className="empty">
                <div className="empty-title">No results for "{query}"</div>
                <div className="empty-sub">Try a team name (e.g. Brazil), code (BRA), group letter (C), or city.</div>
              </div>
            </section>
          ) : (
            <React.Fragment>
              {/* Live now */}
              {!isSearching && tab === "all" && <LiveSection onOpenMatch={openMatch} />}

              {/* Today's matches OR filtered feed */}
              <section className="section">
                <div className="section-head">
                  <h2 className="section-title">
                    {tab === "all" && (isSearching ? "Matches" : "Today's matches")}
                    {tab === "live" && "Live matches"}
                    {tab === "today" && "Today's matches"}
                    {tab === "yesterday" && "Yesterday"}
                    {tab === "upcoming" && "Upcoming"}
                    <span className="badge-count">{tab === "all" && !isSearching
                      ? MATCHES.filter(m => m.date === TODAY_ISO).length
                      : feedByTab.length}</span>
                  </h2>
                  <div style={{display: "flex", alignItems: "center", gap: 16}}>
                    <Tabs active={tab} onChange={setTab} counts={counts} />
                  </div>
                </div>

                {(() => {
                  const list = (tab === "all" && !isSearching)
                    ? MATCHES.filter(m => m.date === TODAY_ISO)
                                .sort((a, b) => {
                                  const order = { LIVE: 0, SCHED: 1, FT: 2 };
                                  return order[a.status] - order[b.status];
                                })
                    : feedByTab;
                  if (list.length === 0) {
                    return (
                      <div className="empty">
                        <div className="empty-title">Nothing scheduled here</div>
                        <div className="empty-sub">Try another tab.</div>
                      </div>
                    );
                  }
                  return (
                    <div className="match-list">
                      {list.map(m => (
                        <MatchCard key={m.id} match={m} onOpen={openMatch} showDate={tab !== "all"} />
                      ))}
                    </div>
                  );
                })()}
              </section>

              {/* Groups */}
              {(tab === "all" || isSearching) && filtered.groups.length > 0 && (
                <section className="section">
                  <div className="section-head">
                    <h2 className="section-title">
                      Groups
                      <span className="badge-count">{filtered.groups.length} of 12</span>
                    </h2>
                    <span className="section-aux">Top 2 advance · 8 best 3rd-placed qualify</span>
                  </div>
                  <div className="groups-grid">
                    {filtered.groups.map(g => (
                      <GroupCard key={g.id} group={g} onOpen={openGroup} />
                    ))}
                  </div>
                </section>
              )}
            </React.Fragment>
          )}
        </div>
      )}

      <footer className="footer">
        <div className="shell">
          <p className="footer-line">
            2026 FIFA World Cup
            <span className="dot">·</span>
            Canada · Mexico · United States
            <span className="dot">·</span>
            June 11 – July 19
          </p>
          <p className="footer-line footer-attribution">
            © 2026 <strong>ACLOUDBREW STUDIOS LLC</strong>
            <span className="dot">·</span>
            All rights reserved
            <span className="dot">·</span>
            <a href="mailto:acloudbrew@proton.me">acloudbrew@proton.me</a>
          </p>
          <p className="footer-line footer-fine">
            Not affiliated with FIFA. Live scores, fixtures and group standings updated in real time.
          </p>
        </div>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
