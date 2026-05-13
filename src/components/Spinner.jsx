// A football-themed loading spinner: cobalt ball with two orbiting trails.
// Variants: 'sm' (16px), 'md' (24px), 'lg' (44px). The "label" prop adds a
// visually hidden accessible label so screen readers announce loading state.

export default function Spinner({ size = 'md', label = 'Loading', className = '' }) {
  const px = size === 'sm' ? 16 : size === 'lg' ? 44 : 24
  return (
    <span className={`wc-spinner wc-spinner-${size} ${className}`.trim()} role="status" aria-live="polite">
      <svg width={px} height={px} viewBox="0 0 44 44" aria-hidden="true">
        {/* Faint track */}
        <circle cx="22" cy="22" r="18" className="wc-spinner-track" />
        {/* Spinning arc */}
        <circle cx="22" cy="22" r="18" className="wc-spinner-arc" />
        {/* Tiny ball */}
        <g className="wc-spinner-ball">
          <circle cx="22" cy="4" r="3" />
        </g>
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}

// Centered spinner block for full-page loading states.
export function PageSpinner({ label = 'Loading…' }) {
  return (
    <div className="page-spinner" role="status" aria-live="polite">
      <Spinner size="lg" label={label} />
      <span className="page-spinner-label">{label}</span>
    </div>
  )
}
