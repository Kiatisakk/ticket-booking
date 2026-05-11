export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function normalizeValue(value) {
  if (value == null) return '';
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? value.toLowerCase() : timestamp;
  }
  return value;
}

export function sortRows(rows, sortConfig, accessors) {
  if (!sortConfig.key) return rows;

  const accessor = accessors[sortConfig.key];
  if (!accessor) return rows;

  return [...rows].sort((a, b) => {
    const first = normalizeValue(accessor(a));
    const second = normalizeValue(accessor(b));

    if (first < second) return sortConfig.direction === 'asc' ? -1 : 1;
    if (first > second) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });
}

export function getPageRows(rows, page, pageSize) {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

export function getTotalPages(rowCount, pageSize) {
  return Math.max(1, Math.ceil(rowCount / pageSize));
}

export function nextSortConfig(current, key) {
  if (current.key !== key) return { key, direction: 'asc' };
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
}

export function sortLabel(sortConfig, key) {
  if (sortConfig.key !== key) return '↕';
  return sortConfig.direction === 'asc' ? '↑' : '↓';
}
