import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
} from './pagination.constants';
import {
  CursorPayload,
  CursorResult,
  LegacyPagination,
  MongoSortDirection,
  PageRequest,
  PageResult,
  SortDirection,
} from './pagination.types';

const CURSOR_VERSION = 1;
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

interface VersionedCursorPayload extends CursorPayload {
  version: typeof CURSOR_VERSION;
}

export class InvalidCursorError extends Error {
  constructor() {
    super('Invalid pagination cursor');
    this.name = 'InvalidCursorError';
  }
}

export function normalizePageRequest(input?: {
  page?: unknown;
  limit?: unknown;
}): PageRequest {
  const rawPage = Number(input?.page ?? DEFAULT_PAGE);
  const rawLimit = Number(input?.limit ?? DEFAULT_PAGE_LIMIT);
  const page =
    Number.isInteger(rawPage) && rawPage > 0 ? rawPage : DEFAULT_PAGE;
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_PAGE_LIMIT)
      : DEFAULT_PAGE_LIMIT;

  return { page, limit };
}

export function normalizeCursorRequest(input?: {
  cursor?: string;
  limit?: unknown;
}): { cursor?: string; limit: number } {
  const { limit } = normalizePageRequest({ limit: input?.limit });
  return { cursor: input?.cursor, limit };
}

export function toMongoSortDirection(
  direction: SortDirection,
): MongoSortDirection {
  return direction === SortDirection.ASC ? 1 : -1;
}

export function resolveSortField<T extends string>(
  value: unknown,
  allowedFields: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && allowedFields.includes(value as T)
    ? (value as T)
    : fallback;
}

export function buildPageResult<T>(
  items: T[],
  request: PageRequest,
  total: number,
): PageResult<T> {
  return {
    items,
    page: request.page,
    limit: request.limit,
    total,
    totalPages: Math.ceil(total / request.limit),
  };
}

export function toLegacyPagination<T>(result: PageResult<T>): LegacyPagination {
  return {
    page: result.page,
    limit: result.limit,
    total: result.total,
    pages: result.totalPages,
  };
}

export function encodeCursor(payload: CursorPayload): string {
  assertCursorPayload(payload);
  const versioned: VersionedCursorPayload = {
    version: CURSOR_VERSION,
    sortValue: payload.sortValue,
    id: payload.id,
  };

  return Buffer.from(JSON.stringify(versioned), 'utf8').toString('base64url');
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );

    if (
      !isRecord(decoded) ||
      decoded.version !== CURSOR_VERSION ||
      Object.keys(decoded).some(
        (key) => !['version', 'sortValue', 'id'].includes(key),
      )
    ) {
      throw new InvalidCursorError();
    }

    const payload = {
      sortValue: decoded.sortValue,
      id: decoded.id,
    };
    assertCursorPayload(payload);
    return payload;
  } catch (error) {
    if (error instanceof InvalidCursorError) {
      throw error;
    }

    throw new InvalidCursorError();
  }
}

export function buildCursorResult<T>(
  rows: T[],
  limit: number,
  getCursorPayload: (item: T) => CursorPayload,
): CursorResult<T> {
  const normalizedLimit = normalizeCursorRequest({ limit }).limit;
  const hasNextPage = rows.length > normalizedLimit;
  const items = hasNextPage ? rows.slice(0, normalizedLimit) : rows;
  const lastItem = items.at(-1);

  return {
    items,
    nextCursor:
      hasNextPage && lastItem ? encodeCursor(getCursorPayload(lastItem)) : null,
    hasNextPage,
  };
}

function assertCursorPayload(payload: {
  sortValue?: unknown;
  id?: unknown;
}): asserts payload is CursorPayload {
  const hasValidSortValue =
    typeof payload.sortValue === 'string' ||
    (typeof payload.sortValue === 'number' &&
      Number.isFinite(payload.sortValue));

  if (
    !hasValidSortValue ||
    typeof payload.id !== 'string' ||
    !OBJECT_ID_PATTERN.test(payload.id)
  ) {
    throw new InvalidCursorError();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
