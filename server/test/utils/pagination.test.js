const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parsePagination,
  encodeCursor,
  findManyHybrid
} = require('../../src/utils/pagination');

test('parsePagination clamps page size to the max', () => {
  const page = parsePagination({ page: '2', pageSize: '500', pagination: 'offset' });

  assert.equal(page.page, 2);
  assert.equal(page.pageSize, 100);
  assert.equal(page.skip, 100);
});

test('findManyHybrid returns cursor payload when cursor config is available', async () => {
  const model = {
    findMany: async (query) => {
      assert.deepEqual(query.orderBy, [{ CreatedAt: 'desc' }, { PaymentID: 'desc' }]);
      assert.equal(query.take, 3);
      return [
        { PaymentID: 5, CreatedAt: new Date('2026-01-05T00:00:00Z') },
        { PaymentID: 4, CreatedAt: new Date('2026-01-04T00:00:00Z') },
        { PaymentID: 3, CreatedAt: new Date('2026-01-03T00:00:00Z') }
      ];
    },
    count: async () => 3
  };

  const payload = await findManyHybrid(model, {
    query: { pagination: 'cursor', pageSize: '2' },
    where: {},
    orderBy: { CreatedAt: 'desc' },
    cursorConfig: {
      idField: 'PaymentID',
      sortField: 'CreatedAt',
      sortOrder: 'desc',
      valueType: 'date'
    }
  });

  assert.equal(payload.pagination.type, 'cursor');
  assert.equal(payload.pagination.hasNextPage, true);
  assert.equal(payload.data.length, 2);
  assert.ok(payload.pagination.nextCursor);
});

test('findManyHybrid falls back to offset payload when cursor config is missing', async () => {
  const model = {
    findMany: async (query) => {
      assert.equal(query.skip, 10);
      assert.equal(query.take, 10);
      return [{ id: 1 }];
    },
    count: async () => 21
  };

  const payload = await findManyHybrid(model, {
    query: { pagination: 'cursor', page: '2', pageSize: '10' },
    where: {},
    orderBy: { User: { FullName: 'asc' } },
    cursorConfig: null
  });

  assert.equal(payload.pagination.type, 'offset');
  assert.equal(payload.pagination.fallbackFrom, 'cursor');
  assert.equal(payload.totalPages, 3);
});

test('findManyHybrid applies decoded cursor conditions', async () => {
  const cursor = encodeCursor({ id: 9, value: '2026-01-09T00:00:00.000Z' });
  const model = {
    findMany: async (query) => {
      assert.deepEqual(query.where.AND[1], {
        OR: [
          { CreatedAt: { lt: new Date('2026-01-09T00:00:00.000Z') } },
          { AND: [{ CreatedAt: new Date('2026-01-09T00:00:00.000Z') }, { PaymentID: { lt: 9 } }] }
        ]
      });
      return [];
    },
    count: async () => 0
  };

  await findManyHybrid(model, {
    query: { pagination: 'cursor', cursor },
    where: {},
    cursorConfig: {
      idField: 'PaymentID',
      sortField: 'CreatedAt',
      sortOrder: 'desc',
      valueType: 'date'
    }
  });
});
