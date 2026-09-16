import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CursorQueryDto, PageQueryDto, SortQueryDto } from './pagination.dto';
import { SortDirection } from './pagination.types';
import {
  buildCursorResult,
  buildPageResult,
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
  normalizePageRequest,
  resolveSortField,
  toLegacyPagination,
  toMongoSortDirection,
} from './pagination.utils';
import { QueryMessageDto } from '../../modules/chat/dto/query-message.dto';
import { QuerySessionDto } from '../../modules/sessions/dto/query-session.dto';

describe('pagination contract', () => {
  describe('DTO validation', () => {
    it('transforms and validates a page query', async () => {
      const query = plainToInstance(PageQueryDto, {
        page: '2',
        limit: '50',
      });

      await expect(validate(query)).resolves.toHaveLength(0);
      expect(query).toEqual({ page: 2, limit: 50 });
    });

    it('uses the canonical defaults', async () => {
      const pageQuery = plainToInstance(PageQueryDto, {});
      const cursorQuery = plainToInstance(CursorQueryDto, {});

      await expect(validate(pageQuery)).resolves.toHaveLength(0);
      await expect(validate(cursorQuery)).resolves.toHaveLength(0);
      expect(pageQuery).toEqual({ page: 1, limit: 20 });
      expect(cursorQuery).toEqual({ limit: 20 });
    });

    it('rejects a limit above the hard maximum', async () => {
      const pageQuery = plainToInstance(PageQueryDto, { limit: '101' });
      const cursorQuery = plainToInstance(CursorQueryDto, { limit: '101' });

      await expect(validate(pageQuery)).resolves.toHaveLength(1);
      await expect(validate(cursorQuery)).resolves.toHaveLength(1);
    });

    it.each([
      [new QueryMessageDto(), 'unexpectedMessageField'],
      [new QuerySessionDto(), '$where'],
    ])('rejects a non-allowlisted domain sort field', async (query, sortBy) => {
      Object.assign(query, { sortBy });

      const errors = await validate(query);

      expect(errors.some((error) => error.property === 'sortBy')).toBe(true);
    });

    it.each([
      ['1', 1],
      ['-1', -1],
      ['asc', 1],
      ['desc', -1],
    ])('normalizes sort order %s', async (value, expected) => {
      const query = plainToInstance(SortQueryDto, { sortOrder: value });

      await expect(validate(query)).resolves.toHaveLength(0);
      expect(query.sortOrder).toBe(expected);
    });
  });

  describe('normalization and sort allowlist', () => {
    it('bounds internal page requests before they reach a query', () => {
      expect(normalizePageRequest({ page: -2, limit: 500 })).toEqual({
        page: 1,
        limit: 100,
      });
    });

    it('falls back when a sort field is not allowlisted', () => {
      const allowed = ['createdAt', 'name'] as const;

      expect(resolveSortField('$where', allowed, 'createdAt')).toBe(
        'createdAt',
      );
      expect(resolveSortField('name', allowed, 'createdAt')).toBe('name');
      expect(toMongoSortDirection(SortDirection.ASC)).toBe(1);
      expect(toMongoSortDirection(SortDirection.DESC)).toBe(-1);
    });
  });

  describe('result builders', () => {
    it('builds the canonical page result and legacy adapter', () => {
      const result = buildPageResult(['one'], { page: 2, limit: 10 }, 21);

      expect(result).toEqual({
        items: ['one'],
        page: 2,
        limit: 10,
        total: 21,
        totalPages: 3,
      });
      expect(toLegacyPagination(result)).toEqual({
        page: 2,
        limit: 10,
        total: 21,
        pages: 3,
      });
    });

    it('uses limit plus one to build a cursor result', () => {
      const rows = [
        { id: '65e456def789abc012345678', createdAt: 3 },
        { id: '65e456def789abc012345679', createdAt: 2 },
        { id: '65e456def789abc012345680', createdAt: 1 },
      ];

      const result = buildCursorResult(rows, 2, (row) => ({
        sortValue: row.createdAt,
        id: row.id,
      }));

      expect(result.items).toEqual(rows.slice(0, 2));
      expect(result.hasNextPage).toBe(true);
      expect(decodeCursor(result.nextCursor!)).toEqual({
        sortValue: 2,
        id: rows[1].id,
      });
    });
  });

  describe('opaque cursor codec', () => {
    it('round-trips only the server-owned cursor shape', () => {
      const payload = {
        sortValue: '2026-09-16T10:00:00.000Z',
        id: '65e456def789abc012345678',
      };

      expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
    });

    it.each([
      'not-base64-json',
      Buffer.from(JSON.stringify({ version: 1, $where: 'x' })).toString(
        'base64url',
      ),
      Buffer.from(
        JSON.stringify({
          version: 1,
          sortValue: 1,
          id: 'invalid',
        }),
      ).toString('base64url'),
    ])('rejects an invalid cursor', (cursor) => {
      expect(() => decodeCursor(cursor)).toThrow(InvalidCursorError);
    });
  });
});
