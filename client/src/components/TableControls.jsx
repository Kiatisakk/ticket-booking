import { PAGE_SIZE_OPTIONS } from '../utils/tableView';
import './TableControls.css';

function TableControls({
  page,
  pageSize,
  totalRows,
  totalPages,
  onPageChange,
  onPageSizeChange,
  mode = 'page',
  hasPrevPage = false,
  hasNextPage = false,
  onPrev,
  onNext
}) {
  if (mode === 'cursor') {
    return (
      <div className="table-controls">
        <div className="table-controls-summary">
          {totalRows != null ? `${totalRows} total rows` : 'Cursor pagination'}
        </div>

        <div className="table-controls-actions">
          <label className="table-size-label">
            Rows
            <select
              className="table-size-select"
              value={pageSize}
              onChange={e => onPageSizeChange(Number(e.target.value))}
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </label>

          <button className="table-page-btn" onClick={onPrev} disabled={!hasPrevPage}>
            Prev
          </button>
          <span className="table-page-status">Cursor</span>
          <button className="table-page-btn" onClick={onNext} disabled={!hasNextPage}>
            Next
          </button>
        </div>
      </div>
    );
  }

  const start = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalRows);

  return (
    <div className="table-controls">
      <div className="table-controls-summary">
        Showing {start}-{end} of {totalRows}
      </div>

      <div className="table-controls-actions">
        <label className="table-size-label">
          Rows
          <select
            className="table-size-select"
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>

        <button className="table-page-btn" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Prev
        </button>
        <span className="table-page-status">{page} / {totalPages}</span>
        <button className="table-page-btn" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next
        </button>
      </div>
    </div>
  );
}

export default TableControls;
