import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import './AddEvent.css';

const API_URL = 'http://localhost:4000/api';

function newShowtime() {
  return { key: Date.now() + Math.random(), venueId: '', startDateTime: '', basePrice: '' };
}

function AddEvent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { adminToken } = useAdminAuth();
  const isStaffMode = location.pathname.startsWith('/staff');
  const authToken = isStaffMode ? localStorage.getItem('staffToken') : adminToken;
  const basePath = isStaffMode ? '/staff/events' : '/admin/events';
  const apiScope = isStaffMode ? 'staff' : 'admin';

  const [title, setTitle]             = useState('');
  const [categoryId, setCategoryId]   = useState('');
  const [description, setDescription] = useState('');
  const [showtimes, setShowtimes]     = useState([newShowtime()]);

  const [categories, setCategories]   = useState([]);
  const [venues, setVenues]           = useState([]);

  const [errors, setErrors]     = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving]     = useState(false);

  const headers = { Authorization: `Bearer ${authToken}` };

  useEffect(() => {
    axios.get(`${API_URL}/${apiScope}/categories`, { headers })
      .then(r => setCategories(r.data))
      .catch(() => setCategories([
        { id: 1, name: 'Movie' },
        { id: 2, name: 'Concert' },
        { id: 3, name: 'Seminar' }
      ]));

    axios.get(`${API_URL}/${apiScope}/venues`, { headers })
      .then(r => setVenues(r.data))
      .catch(() => setVenues([]));
  }, []);

  // ── Showtime helpers ────────────────────────────────────────────────────────
  const addShowtime = () => setShowtimes(p => [...p, newShowtime()]);

  const removeShowtime = key =>
    setShowtimes(p => p.filter(s => s.key !== key));

  const updateShowtime = (key, field, value) => {
    setShowtimes(p => p.map(s => s.key === key ? { ...s, [field]: value } : s));
    setErrors(p => { const n = { ...p }; delete n[`st_${key}_${field}`]; return n; });
  };

  const venueById = id => venues.find(v => String(v.id) === String(id));

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!title.trim()) errs.title = 'Event title is required';
    showtimes.forEach(s => {
      if (!s.venueId)       errs[`st_${s.key}_venueId`]       = 'Select a venue';
      if (!s.startDateTime) errs[`st_${s.key}_startDateTime`] = 'Date & time required';
      if (s.basePrice === '' || Number(s.basePrice) < 0)
        errs[`st_${s.key}_basePrice`] = 'Enter a valid price';
    });
    return errs;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    setFormError('');
    try {
      await axios.post(`${API_URL}/${apiScope}/events`, {
        title: title.trim(),
        description: description.trim(),
        categoryId: categoryId || null,
        showtimes: showtimes.map(s => ({
          venueId:       s.venueId,
          startDateTime: s.startDateTime,
          basePrice:     parseFloat(s.basePrice)
        }))
      }, { headers });
      navigate(basePath);
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="aev-root">
      {/* ── Topbar ── */}
      <div className="aev-topbar">
        <button className="aev-back" onClick={() => navigate(basePath)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back
        </button>
        <div>
          <div className="aev-page-title">Add New Event</div>
          <div className="aev-page-sub">Fill in the details below to create a new event</div>
        </div>
      </div>

      {formError && <div className="aev-form-banner error">{formError}</div>}

      <form onSubmit={handleSubmit} noValidate>

        {/* ── Section 1: Basic Info ── */}
        <div className="aev-card">
          <div className="aev-section-header">
            <span className="aev-section-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            </span>
            Basic Information
          </div>

          <div className="aev-grid">
            <div className="aev-field aev-full">
              <label className="aev-label">Event Title <span className="aev-req">*</span></label>
              <input
                className={`aev-input${errors.title ? ' err' : ''}`}
                type="text"
                placeholder="e.g. Taylor Swift: The Eras Tour Bangkok"
                value={title}
                onChange={e => { setTitle(e.target.value); setErrors(p => ({ ...p, title: '' })); }}
              />
              {errors.title && <span className="aev-err-msg">{errors.title}</span>}
            </div>

            <div className="aev-field">
              <label className="aev-label">Category</label>
              <select className="aev-select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                <option value="">— Select category —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="aev-field aev-full">
              <label className="aev-label">Description</label>
              <textarea
                className="aev-textarea"
                rows={5}
                placeholder="Describe the event — lineup, highlights, special notes…"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Section 2: Showtimes ── */}
        <div className="aev-card">
          <div className="aev-section-header">
            <span className="aev-section-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            </span>
            Showtimes
            <span className="aev-count-pill">{showtimes.length}</span>
          </div>

          <div className="aev-showtimes">
            {showtimes.map((st, idx) => {
              const venue = venueById(st.venueId);
              return (
                <div key={st.key} className="aev-st-card">
                  <div className="aev-st-header">
                    <span className="aev-st-label">Showtime #{idx + 1}</span>
                    {showtimes.length > 1 && (
                      <button
                        type="button"
                        className="aev-st-remove"
                        onClick={() => removeShowtime(st.key)}
                        title="Remove this showtime"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="aev-st-grid">
                    {/* Venue */}
                    <div className="aev-field">
                      <label className="aev-label">Venue <span className="aev-req">*</span></label>
                      <select
                        className={`aev-select${errors[`st_${st.key}_venueId`] ? ' err' : ''}`}
                        value={st.venueId}
                        onChange={e => updateShowtime(st.key, 'venueId', e.target.value)}
                      >
                        <option value="">— Select venue —</option>
                        {venues.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.name}{v.capacity > 0 ? ` · ${v.capacity} seats` : ''}
                          </option>
                        ))}
                      </select>
                      {errors[`st_${st.key}_venueId`] && (
                        <span className="aev-err-msg">{errors[`st_${st.key}_venueId`]}</span>
                      )}
                      {venue && (
                        <div className="aev-venue-info">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          {venue.location && <span>{venue.location} · </span>}
                          <strong>{venue.capacity} seats</strong> available
                        </div>
                      )}
                    </div>

                    {/* Date & Time */}
                    <div className="aev-field">
                      <label className="aev-label">Start Date &amp; Time <span className="aev-req">*</span></label>
                      <input
                        className={`aev-input${errors[`st_${st.key}_startDateTime`] ? ' err' : ''}`}
                        type="datetime-local"
                        value={st.startDateTime}
                        onChange={e => updateShowtime(st.key, 'startDateTime', e.target.value)}
                      />
                      {errors[`st_${st.key}_startDateTime`] && (
                        <span className="aev-err-msg">{errors[`st_${st.key}_startDateTime`]}</span>
                      )}
                    </div>

                    {/* Base Price */}
                    <div className="aev-field">
                      <label className="aev-label">Base Price (฿) <span className="aev-req">*</span></label>
                      <div className="aev-price-wrap">
                        <span className="aev-price-prefix">฿</span>
                        <input
                          className={`aev-input aev-price-input${errors[`st_${st.key}_basePrice`] ? ' err' : ''}`}
                          type="number"
                          placeholder="0"
                          min="0"
                          step="1"
                          value={st.basePrice}
                          onChange={e => updateShowtime(st.key, 'basePrice', e.target.value)}
                        />
                      </div>
                      {errors[`st_${st.key}_basePrice`] && (
                        <span className="aev-err-msg">{errors[`st_${st.key}_basePrice`]}</span>
                      )}
                      {st.basePrice && !isNaN(st.basePrice) && (
                        <div className="aev-price-breakdown">
                          VIP ฿{(Number(st.basePrice) * 2).toLocaleString()} · Standard ฿{Number(st.basePrice).toLocaleString()} · Sofa Bed ฿{(Number(st.basePrice) * 1.5).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            <button type="button" className="aev-add-st" onClick={addShowtime}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Add Showtime
            </button>
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="aev-footer">
          <button type="button" className="aev-btn-ghost" onClick={() => navigate(basePath)}>
            Cancel
          </button>
          <button type="submit" className="aev-btn-primary" disabled={saving}>
            {saving ? (
              <><span className="aev-spinner" />Creating…</>
            ) : (
              <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>Create Event</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddEvent;
