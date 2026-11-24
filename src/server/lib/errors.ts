/**
 * Typed application errors. Route handlers convert these into JSON
 * `{ error: { code, message, fields? } }` responses; anything else becomes a
 * generic 500 so internals never leak to clients.
 */
export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION"
  | "UNAUTHENTICATED"
  | "AUTH_EXPIRED"
  | "REFRESH_RACE"
  | "FORBIDDEN"
  | "CSRF"
  | "NOT_FOUND"
  | "CONFLICT"
  | "EMAIL_TAKEN"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_DISABLED"
  | "TOKEN_INVALID"
  | "OUT_OF_STOCK"
  | "PROMO_INVALID"
  | "CART_EMPTY"
  | "ORDER_NOT_CANCELLABLE"
  | "INVALID_TRANSITION"
  | "REVIEW_NOT_ALLOWED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA"
  | "RATE_LIMITED"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION: 422,
  UNAUTHENTICATED: 401,
  AUTH_EXPIRED: 401,
  REFRESH_RACE: 409,
  FORBIDDEN: 403,
  CSRF: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  ACCOUNT_LOCKED: 423,
  ACCOUNT_DISABLED: 403,
  TOKEN_INVALID: 400,
  OUT_OF_STOCK: 409,
  PROMO_INVALID: 422,
  CART_EMPTY: 422,
  ORDER_NOT_CANCELLABLE: 409,
  INVALID_TRANSITION: 409,
  REVIEW_NOT_ALLOWED: 403,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA: 415,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly status: number;
  constructor(
    readonly code: ErrorCode,
    message?: string,
    readonly details?: { fields?: Record<string, string>; retryAfter?: number; [k: string]: unknown },
  ) {
    super(message ?? code);
    this.status = STATUS[code];
  }
}

export const notFound = (what = "Resource") => new AppError("NOT_FOUND", `${what} not found`);
export const forbidden = () => new AppError("FORBIDDEN", "You do not have access to this resource");
