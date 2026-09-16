export enum SortDirection {
  ASC = 'asc',
  DESC = 'desc',
}

export type MongoSortDirection = 1 | -1;

export interface PageRequest {
  page: number;
  limit: number;
}

export interface CursorRequest {
  cursor?: string;
  limit: number;
}

export interface PageResult<T> extends PageRequest {
  items: T[];
  total: number;
  totalPages: number;
}

export interface CursorResult<T> {
  items: T[];
  nextCursor: string | null;
  hasNextPage: boolean;
}

export interface CursorPayload {
  sortValue: string | number;
  id: string;
}

export interface LegacyPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}
