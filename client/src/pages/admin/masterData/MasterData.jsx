import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import TableControls from '../../../components/TableControls';
import { normalizePaginatedPayload } from '../../../utils/tableView';
import './MasterData.css';

const API_URL = 'http://localhost:4000/api';

const emptyVenue = { name: '', location: '' };
const emptySeat = { rowLabel: '', seatNumber: '', seatTypeId: '' };
const emptyBulkSeat = { rowLabel: '', startNumber: '1', endNumber: '10', seatTypeId: '' };

function MasterData() {
  const { adminToken } = useAdminAuth();
  const headers = { Authorization: `Bearer ${adminToken}` };

  const [venues, setVenues] = useState([]);
  const [seatTypes, setSeatTypes] = useState([]);
  const [selectedVenueId, setSelectedVenueId] = useState('');
  const [seats, setSeats] = useState([]);
  const [venueForm, setVenueForm] = useState(emptyVenue);
  const [editingVenueId, setEditingVenueId] = useState(null);
  const [seatForm, setSeatForm] = useState(emptySeat);
  const [bulkSeatForm, setBulkSeatForm] = useState(emptyBulkSeat);
  const [editingSeatId, setEditingSeatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seatLoading, setSeatLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [venuePage, setVenuePage] = useState(1);
  const [venuePageSize, setVenuePageSize] = useState(10);
  const [venueTotalRows, setVenueTotalRows] = useState(0);
  const [venueTotalPages, setVenueTotalPages] = useState(1);
  const [seatPage, setSeatPage] = useState(1);
  const [seatPageSize, setSeatPageSize] = useState(100);
  const [seatTotalRows, setSeatTotalRows] = useState(0);
  const [seatTotalPages, setSeatTotalPages] = useState(1);

  const loadVenues = useCallback(async () => {
    const { data } = await axios.get(`${API_URL}/admin/venues`, {
      headers,
      params: { pagination: 'offset', page: venuePage, pageSize: venuePageSize }
    });
    const payload = normalizePaginatedPayload(data);
    setVenues(payload.rows);
    setVenueTotalRows(payload.totalRows);
    setVenueTotalPages(payload.totalPages);
    setSelectedVenueId(current => (
      payload.rows.some(venue => String(venue.id) === String(current))
        ? current
        : (payload.rows[0]?.id ? String(payload.rows[0].id) : '')
    ));
  }, [adminToken, venuePage, venuePageSize]);

  const loadSeatTypes = useCallback(async () => {
    const { data } = await axios.get(`${API_URL}/seat-types`, { headers });
    setSeatTypes(data);
    setSeatForm(current => current.seatTypeId
      ? current
      : { ...current, seatTypeId: data[0]?.SeatTypeID ? String(data[0].SeatTypeID) : '' });
    setBulkSeatForm(current => current.seatTypeId
      ? current
      : { ...current, seatTypeId: data[0]?.SeatTypeID ? String(data[0].SeatTypeID) : '' });
  }, [adminToken]);

  const loadSeats = useCallback(async (venueId) => {
    if (!venueId) {
      setSeats([]);
      return;
    }
    setSeatLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/admin/venues/${venueId}/seats`, {
        headers,
        params: { pagination: 'offset', page: seatPage, pageSize: seatPageSize }
      });
      const payload = normalizePaginatedPayload(data);
      setSeats(payload.rows);
      setSeatTotalRows(payload.totalRows);
      setSeatTotalPages(payload.totalPages);
    } finally {
      setSeatLoading(false);
    }
  }, [adminToken, seatPage, seatPageSize]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([loadVenues(), loadSeatTypes()])
      .catch(err => active && setError(err.response?.data?.error || 'Failed to load master data'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [loadVenues, loadSeatTypes]);

  useEffect(() => {
    loadSeats(selectedVenueId).catch(err => setError(err.response?.data?.error || 'Failed to load seats'));
  }, [selectedVenueId, loadSeats]);

  const selectedVenue = venues.find(venue => String(venue.id) === String(selectedVenueId));

  const resetVenueForm = () => {
    setVenueForm(emptyVenue);
    setEditingVenueId(null);
  };

  const resetSeatForm = () => {
    setSeatForm({ ...emptySeat, seatTypeId: seatTypes[0]?.SeatTypeID ? String(seatTypes[0].SeatTypeID) : '' });
    setEditingSeatId(null);
  };

  const resetBulkSeatForm = () => {
    setBulkSeatForm({ ...emptyBulkSeat, seatTypeId: seatTypes[0]?.SeatTypeID ? String(seatTypes[0].SeatTypeID) : '' });
  };

  const saveVenue = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingVenueId) {
        await axios.put(`${API_URL}/admin/venues/${editingVenueId}`, venueForm, { headers });
      } else {
        await axios.post(`${API_URL}/admin/venues`, venueForm, { headers });
      }
      resetVenueForm();
      setVenuePage(1);
      await loadVenues();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save venue');
    } finally {
      setSaving(false);
    }
  };

  const editVenue = (venue) => {
    setEditingVenueId(venue.id);
    setVenueForm({ name: venue.name || '', location: venue.location || '' });
  };

  const deleteVenue = async (venue) => {
    if (!window.confirm(`Delete venue "${venue.name}"?`)) return;
    setSaving(true);
    setError('');
    try {
      await axios.delete(`${API_URL}/admin/venues/${venue.id}`, { headers });
      setSelectedVenueId('');
      resetVenueForm();
      await loadVenues();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete venue');
    } finally {
      setSaving(false);
    }
  };

  const saveSeat = async (event) => {
    event.preventDefault();
    if (!selectedVenueId) return;
    setSaving(true);
    setError('');
    try {
      const payload = { ...seatForm, venueId: selectedVenueId };
      if (editingSeatId) {
        await axios.put(`${API_URL}/admin/seats/${editingSeatId}`, payload, { headers });
      } else {
        await axios.post(`${API_URL}/admin/seats`, payload, { headers });
      }
      resetSeatForm();
      setSeatPage(1);
      await Promise.all([loadSeats(selectedVenueId), loadVenues()]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save seat');
    } finally {
      setSaving(false);
    }
  };

  const saveBulkSeats = async (event) => {
    event.preventDefault();
    if (!selectedVenueId) return;

    const rowLabel = bulkSeatForm.rowLabel.trim().toUpperCase();
    const startNumber = Number.parseInt(bulkSeatForm.startNumber, 10);
    const endNumber = Number.parseInt(bulkSeatForm.endNumber, 10);

    if (!rowLabel || !bulkSeatForm.seatTypeId || !Number.isInteger(startNumber) || !Number.isInteger(endNumber)) {
      setError('Row, start number, end number, and seat type are required');
      return;
    }

    if (startNumber < 1 || endNumber < startNumber) {
      setError('Seat number range is invalid');
      return;
    }

    const existingSeatKeys = new Set(
      seats.map(seat => `${String(seat.rowLabel).toUpperCase()}-${String(seat.seatNumber)}`)
    );
    const seatNumbers = [];
    for (let number = startNumber; number <= endNumber; number += 1) {
      if (!existingSeatKeys.has(`${rowLabel}-${String(number)}`)) {
        seatNumbers.push(number);
      }
    }

    if (seatNumbers.length === 0) {
      setError('All seats in this range already exist');
      return;
    }

    setSaving(true);
    setError('');
    try {
      for (const seatNumber of seatNumbers) {
        await axios.post(`${API_URL}/admin/seats`, {
          venueId: selectedVenueId,
          seatTypeId: bulkSeatForm.seatTypeId,
          rowLabel,
          seatNumber: String(seatNumber)
        }, { headers });
      }
      resetBulkSeatForm();
      setSeatPage(1);
      await Promise.all([loadSeats(selectedVenueId), loadVenues()]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add seats');
    } finally {
      setSaving(false);
    }
  };

  const editSeat = (seat) => {
    setEditingSeatId(seat.id);
    setSeatForm({
      rowLabel: seat.rowLabel || '',
      seatNumber: seat.seatNumber || '',
      seatTypeId: String(seat.seatTypeId || '')
    });
  };

  const deleteSeat = async (seat) => {
    if (!window.confirm(`Delete seat ${seat.rowLabel}${seat.seatNumber}?`)) return;
    setSaving(true);
    setError('');
    try {
      await axios.delete(`${API_URL}/admin/seats/${seat.id}`, { headers });
      await Promise.all([loadSeats(selectedVenueId), loadVenues()]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete seat');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="md-loading">Loading master data...</div>;

  return (
    <div className="md-page">
      {error && <div className="md-error">{error}</div>}

      <section className="md-section">
        <div className="md-section-head">
          <div>
            <h2>Venues</h2>
            <p>Manage venues used by showtimes.</p>
          </div>
        </div>

        <form className="md-form" onSubmit={saveVenue}>
          <input
            value={venueForm.name}
            onChange={e => setVenueForm(current => ({ ...current, name: e.target.value }))}
            placeholder="Venue name"
            required
          />
          <input
            value={venueForm.location}
            onChange={e => setVenueForm(current => ({ ...current, location: e.target.value }))}
            placeholder="Location"
          />
          <button type="submit" disabled={saving}>{editingVenueId ? 'Save Venue' : 'Add Venue'}</button>
          {editingVenueId && <button type="button" className="md-muted-btn" onClick={resetVenueForm}>Cancel</button>}
        </form>

        <div className="md-venue-grid">
          {venues.map(venue => (
            <button
              type="button"
              key={venue.id}
              className={`md-venue-card${String(selectedVenueId) === String(venue.id) ? ' active' : ''}`}
              onClick={() => {
                setSelectedVenueId(String(venue.id));
                setSeatPage(1);
              }}
            >
              <span className="md-venue-title">{venue.name}</span>
              <span className="md-venue-sub">{venue.location || `Venue #${venue.id}`}</span>
              <span className="md-venue-capacity">{venue.capacity} seats</span>
              <span className="md-card-actions" onClick={e => e.stopPropagation()}>
                <span role="button" tabIndex={0} onClick={() => editVenue(venue)}>Edit</span>
                <span role="button" tabIndex={0} onClick={() => deleteVenue(venue)}>Delete</span>
              </span>
            </button>
          ))}
        </div>
        <TableControls
          page={venuePage}
          pageSize={venuePageSize}
          totalRows={venueTotalRows}
          totalPages={venueTotalPages}
          onPageChange={setVenuePage}
          onPageSizeChange={(nextSize) => {
            setVenuePageSize(nextSize);
            setVenuePage(1);
          }}
        />
      </section>

      <section className="md-section">
        <div className="md-section-head">
          <div>
            <h2>Seats</h2>
            <p>{selectedVenue ? `Manage seats for ${selectedVenue.name}.` : 'Select a venue to manage seats.'}</p>
          </div>
        </div>

        <form className="md-form md-seat-bulk-form" onSubmit={saveBulkSeats}>
          <input
            value={bulkSeatForm.rowLabel}
            onChange={e => setBulkSeatForm(current => ({ ...current, rowLabel: e.target.value }))}
            placeholder="Row"
            required
            disabled={!selectedVenueId}
          />
          <input
            type="number"
            min="1"
            value={bulkSeatForm.startNumber}
            onChange={e => setBulkSeatForm(current => ({ ...current, startNumber: e.target.value }))}
            placeholder="From"
            required
            disabled={!selectedVenueId}
          />
          <input
            type="number"
            min="1"
            value={bulkSeatForm.endNumber}
            onChange={e => setBulkSeatForm(current => ({ ...current, endNumber: e.target.value }))}
            placeholder="To"
            required
            disabled={!selectedVenueId}
          />
          <select
            value={bulkSeatForm.seatTypeId}
            onChange={e => setBulkSeatForm(current => ({ ...current, seatTypeId: e.target.value }))}
            required
            disabled={!selectedVenueId}
          >
            {seatTypes.map(type => (
              <option key={type.SeatTypeID} value={type.SeatTypeID}>
                {type.TypeName}
              </option>
            ))}
          </select>
          <button type="submit" disabled={saving || !selectedVenueId}>Quick Add Seats</button>
        </form>

        <form className="md-form md-seat-form" onSubmit={saveSeat}>
          <input
            value={seatForm.rowLabel}
            onChange={e => setSeatForm(current => ({ ...current, rowLabel: e.target.value }))}
            placeholder="Row"
            required
            disabled={!selectedVenueId}
          />
          <input
            value={seatForm.seatNumber}
            onChange={e => setSeatForm(current => ({ ...current, seatNumber: e.target.value }))}
            placeholder="Seat number"
            required
            disabled={!selectedVenueId}
          />
          <select
            value={seatForm.seatTypeId}
            onChange={e => setSeatForm(current => ({ ...current, seatTypeId: e.target.value }))}
            required
            disabled={!selectedVenueId}
          >
            {seatTypes.map(type => (
              <option key={type.SeatTypeID} value={type.SeatTypeID}>
                {type.TypeName} x{Number(type.PriceModifier)}
              </option>
            ))}
          </select>
          <button type="submit" disabled={saving || !selectedVenueId}>{editingSeatId ? 'Save Seat' : 'Add Seat'}</button>
          {editingSeatId && <button type="button" className="md-muted-btn" onClick={resetSeatForm}>Cancel</button>}
        </form>

        <div className="md-table-wrap">
          {seatLoading ? (
            <div className="md-loading">Loading seats...</div>
          ) : seats.length === 0 ? (
            <div className="md-empty">No seats found for this venue.</div>
          ) : (
            <table className="md-table">
              <thead>
                <tr>
                  <th>Seat</th>
                  <th>Type</th>
                  <th>History</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {seats.map(seat => (
                  <tr key={seat.id}>
                    <td>{seat.rowLabel}{seat.seatNumber}</td>
                    <td>{seat.seatTypeName}</td>
                    <td>{seat.bookingCount > 0 ? `${seat.bookingCount} booking records` : 'No bookings'}</td>
                    <td>
                      <div className="md-row-actions">
                        <button type="button" onClick={() => editSeat(seat)} disabled={seat.bookingCount > 0}>Edit</button>
                        <button type="button" onClick={() => deleteSeat(seat)} disabled={seat.bookingCount > 0}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <TableControls
          page={seatPage}
          pageSize={seatPageSize}
          totalRows={seatTotalRows}
          totalPages={seatTotalPages}
          onPageChange={setSeatPage}
          onPageSizeChange={(nextSize) => {
            setSeatPageSize(nextSize);
            setSeatPage(1);
          }}
        />
      </section>
    </div>
  );
}

export default MasterData;
