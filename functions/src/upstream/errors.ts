export class UpstreamError extends Error {
  constructor(public path: string, public status: number, public body: string) {
    super(`upstream ${status} on ${path}: ${body.slice(0, 200)}`)
    this.name = new.target.name
  }
}
export class UpstreamAuthError extends UpstreamError {}
export class UpstreamBadRequest extends UpstreamError {}
export class UpstreamServerError extends UpstreamError {}
export class UpstreamTimeout extends UpstreamError {
  constructor(path: string, ms: number) { super(path, 0, `timeout after ${ms}ms`) }
}
export class UpstreamRateLimited extends UpstreamError {
  constructor(path: string, public retryAfterSec: number) {
    super(path, 429, `rate limited, retry after ${retryAfterSec}s`)
  }
}
export class TierRequiredError extends UpstreamError {
  constructor(path: string, status: number) { super(path, status, 'tier required') }
}
