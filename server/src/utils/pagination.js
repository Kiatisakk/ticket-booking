const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

function clampInt(value, fallback, min, max) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function sortDirection(value) {
  return String(value).toLowerCase() === 'asc' ? 'asc' : 'desc';
}

function parsePagination(query = {}, options = {}) {
  const defaultPageSize = options.defaultPageSize || DEFAULT_PAGE_SIZE;
  const maxPageSize = options.maxPageSize || MAX_PAGE_SIZE;
  const page = clampInt(query.page || '1', 1, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = clampInt(query.pageSize || String(defaultPageSize), defaultPageSize, 1, maxPageSize);
  const requestedMode = query.pagination === 'cursor'
    ? 'cursor'
    : query.pagination === 'offset'
      ? 'offset'
      : null;

  return {
    enabled: requestedMode !== null || query.page !== undefined || query.pageSize !== undefined,
    requestedMode,
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
    cursor: query.cursor || null,
    direction: query.direction === 'prev' ? 'prev' : 'next'
  };
}

function encodeCursor(payload) {
  if (!payload) return null;
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(token, fallbackIdField) {
  if (!token) return null;

  if (/^\d+$/.test(String(token))) {
    return {
      id: Number(token),
      value: Number(token),
      legacyIdField: fallbackIdField
    };
  }

  try {
    return JSON.parse(Buffer.from(String(token), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function cursorValue(row, sortField) {
  const value = row?.[sortField];
  return value instanceof Date ? value.toISOString() : value;
}

function coerceCursorValue(value, type) {
  if (value == null) return value;
  if (type === 'date') return new Date(value);
  if (type === 'number') return Number(value);
  if (type === 'string') return String(value);
  return value;
}

function buildCursorWhere({ decoded, sortField, idField, direction, sortOrder, valueType }) {
  if (!decoded) return {};

  const id = Number(decoded.id);
  const value = coerceCursorValue(decoded.value, valueType);
  const isPrev = direction === 'prev';
  const isAsc = sortOrder === 'asc';
  const moveForward = isPrev ? !isAsc : isAsc;
  const valueOperator = moveForward ? 'gt' : 'lt';
  const idOperator = moveForward ? 'gt' : 'lt';

  if (sortField === idField || decoded.legacyIdField === idField) {
    return Number.isFinite(id) ? { [idField]: { [idOperator]: id } } : {};
  }

  if (!Number.isFinite(id) || value == null) return {};

  return {
    OR: [
      { [sortField]: { [valueOperator]: value } },
      { AND: [{ [sortField]: value }, { [idField]: { [idOperator]: id } }] }
    ]
  };
}

function buildOrderBy({ sortField, idField, direction, sortOrder }) {
  const queryOrder = direction === 'prev'
    ? (sortOrder === 'asc' ? 'desc' : 'asc')
    : sortOrder;

  if (sortField === idField) return [{ [idField]: queryOrder }];
  return [{ [sortField]: queryOrder }, { [idField]: queryOrder }];
}

function cursorPayload(data, cursorInfo, pageSize, total = null) {
  return {
    data,
    pageSize,
    total,
    pagination: {
      type: 'cursor',
      nextCursor: cursorInfo.nextCursor,
      prevCursor: cursorInfo.prevCursor,
      hasNextPage: cursorInfo.hasNextPage,
      hasPrevPage: cursorInfo.hasPrevPage
    }
  };
}

function offsetPayload(data, total, page, pageSize, meta = {}) {
  return {
    data,
    page,
    pageSize,
    total,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    pagination: {
      type: 'offset',
      ...(meta.fallbackFrom ? { fallbackFrom: meta.fallbackFrom } : {}),
      ...(meta.reason ? { reason: meta.reason } : {})
    }
  };
}

async function findManyByCursor(model, {
  idField,
  sortField = idField,
  sortOrder = 'desc',
  valueType = 'number',
  where,
  select,
  include,
  pageSize,
  cursor,
  direction
}) {
  const decoded = decodeCursor(cursor, idField);
  const cursorWhere = buildCursorWhere({
    decoded,
    sortField,
    idField,
    direction,
    sortOrder,
    valueType
  });

  const rows = await model.findMany({
    where: { AND: [where || {}, cursorWhere] },
    ...(select ? { select } : {}),
    ...(include ? { include } : {}),
    orderBy: buildOrderBy({ sortField, idField, direction, sortOrder }),
    take: pageSize + 1
  });

  const hasMore = rows.length > pageSize;
  const pageRows = rows.slice(0, pageSize);
  const data = direction === 'prev' ? pageRows.reverse() : pageRows;
  const first = data[0];
  const last = data[data.length - 1];

  return {
    data,
    hasNextPage: direction === 'prev' ? Boolean(cursor) : hasMore,
    hasPrevPage: direction === 'prev' ? hasMore : Boolean(cursor),
    nextCursor: last ? encodeCursor({ id: last[idField], value: cursorValue(last, sortField) }) : null,
    prevCursor: first ? encodeCursor({ id: first[idField], value: cursorValue(first, sortField) }) : null
  };
}

async function findManyHybrid(model, {
  query,
  where,
  select,
  include,
  orderBy,
  cursorConfig,
  map = rows => rows,
  count
}) {
  const page = parsePagination(query);
  const totalCount = count || (() => model.count({ where }));

  if (!page.enabled) {
    const rows = await model.findMany({
      where,
      ...(select ? { select } : {}),
      ...(include ? { include } : {}),
      ...(orderBy ? { orderBy } : {})
    });
    return map(rows);
  }

  const wantsCursor = page.requestedMode === 'cursor';
  if (wantsCursor && cursorConfig) {
    const [cursorResult, total] = await Promise.all([
      findManyByCursor(model, {
        ...cursorConfig,
        where,
        select,
        include,
        pageSize: page.pageSize,
        cursor: page.cursor,
        direction: page.direction
      }),
      totalCount()
    ]);

    return cursorPayload(map(cursorResult.data), cursorResult, page.pageSize, total);
  }

  const [rows, total] = await Promise.all([
    model.findMany({
      where,
      ...(select ? { select } : {}),
      ...(include ? { include } : {}),
      ...(orderBy ? { orderBy } : {}),
      skip: page.skip,
      take: page.take
    }),
    totalCount()
  ]);

  return offsetPayload(map(rows), total, page.page, page.pageSize, wantsCursor
    ? { fallbackFrom: 'cursor', reason: 'Requested sort requires offset pagination' }
    : {});
}

module.exports = {
  MAX_PAGE_SIZE,
  parsePagination,
  sortDirection,
  encodeCursor,
  decodeCursor,
  cursorPayload,
  offsetPayload,
  findManyByCursor,
  findManyHybrid
};
