// Skeleton placeholders that mirror the layout of the final components.
// The shimmer animation is defined in styles.css.

export function MatchCardSkeleton() {
  return (
    <div className="match-card skel-match" aria-hidden="true">
      <div className="col-kickoff">
        <span className="skel skel-pill-sm" />
        <span className="skel skel-pill-xs" />
      </div>
      <div className="match-team home">
        <span className="skel skel-circle skel-circle-md" />
        <span className="skel skel-line skel-line-md" />
      </div>
      <div className="score-cell">
        <span className="skel skel-line skel-line-score" />
        <span className="skel skel-pill-xs" />
      </div>
      <div className="match-team away">
        <span className="skel skel-line skel-line-md" />
        <span className="skel skel-circle skel-circle-md" />
      </div>
      <div className="col-status">
        <span className="skel skel-pill" />
      </div>
    </div>
  )
}

export function GroupCardSkeleton() {
  return (
    <div className="group-card skel-group" aria-hidden="true">
      <div className="group-head">
        <div className="group-id-block">
          <span className="skel skel-line skel-line-group-id" />
          <span className="skel skel-line skel-line-sm" />
        </div>
        <span className="skel skel-pill" />
      </div>
      <div className="group-teams">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="group-team-row" key={i}>
            <span className="skel skel-line skel-line-xs" />
            <div className="team-l">
              <span className="skel skel-circle skel-circle-sm" />
              <span className="skel skel-line skel-line-md" />
            </div>
            <span className="skel skel-line skel-line-sm" />
          </div>
        ))}
      </div>
      <div className="group-foot">
        <span className="skel skel-line skel-line-md" />
        <span className="skel skel-line skel-line-sm" />
      </div>
    </div>
  )
}

export function MatchDetailSkeleton() {
  return (
    <div className="summary-card skel-summary" aria-hidden="true">
      <div className="summary-status">
        <span className="skel skel-pill" />
      </div>
      <div className="summary-body">
        <div className="summary-team">
          <span className="skel skel-circle skel-circle-xl" />
          <span className="skel skel-line skel-line-lg" />
          <span className="skel skel-line skel-line-sm" />
        </div>
        <div className="skel skel-summary-score" />
        <div className="summary-team">
          <span className="skel skel-circle skel-circle-xl" />
          <span className="skel skel-line skel-line-lg" />
          <span className="skel skel-line skel-line-sm" />
        </div>
      </div>
    </div>
  )
}
