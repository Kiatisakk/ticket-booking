import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import './MasterData.css';

const API_URL = 'http://localhost:4000/api';

const emptyVenue = { name: '', location: '' };
const emptySeat = { rowLabel: '', seatNumber: '', seatTypeId: '' };

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
  const [editingSeatId, setEditingSeatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seatLoading, setSeatLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadVenues = useCallback(async () => {
    const { data } = await axios.get(`${API_URL}/admin/venues`, { headers });
    setVenues(data);
    setSelectedVenueId(current => current || (data[0]?.id ? String(data[0].id) : ''));
  }, [adminToken]);

  const loadSeatTypes = useCallback(async () => {
    const { data } = await axios.get(`${API_URL}/seat-types`, { headers });
    setSeatTypes(data);
    setSeatForm(current => current.seatTypeId
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
      const { data } = await axios.get(`${API_URL}/admin/venues/${venueId}/seats`, { headers });
      setSeats(data);
    } finally {
      setSeatLoading(false);
    }
  }, [adminToken]);

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
      await Promise.all([loadSeats(selectedVenueId), loadVenues()]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save seat');
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
              onClick={() => setSelectedVenueId(String(venue.id))}
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
      </section>

      <section className="md-section">
        <div className="md-section-head">
          <div>
            <h2>Seats</h2>
            <p>{selectedVenue ? `Manage seats for ${selectedVenue.name}.` : 'Select a venue to manage seats.'}</p>
          </div>
        </div>

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
      </section>
    </div>
  );
}

export default MasterData;
