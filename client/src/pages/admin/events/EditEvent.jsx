import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import './EditEvent.css';

const API_URL = 'http://localhost:4000/api';

function toLocal(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function newShowtime() {
  return { key: Date.now() + Math.random(), id: null, venueId: '', startDateTime: '', basePrice: '', capacity: 0, booked: 0 };
}

/* ── Toast ── */
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  return <div className={`eed-toast eed-toast-${type}`}><span className="eed-toast-dot" />{msg}</div>;
}

function EditEvent() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { adminToken } = useAdminAuth();
  const headers    = { Authorization: `Bearer ${adminToken}` };

  // ── Form state ──────────────────────────────────────────────────────────────
  const [title, setTitle]             = useState('');
  const [categoryId, setCategoryId]   = useState('');
  const [description, setDescription] = useState('');
  const [showtimes, setShowtimes]     = useState([]);
  const [deletedIds, setDeletedIds]   = useState([]);

  // ── Reference (for reset) ────────────────────────────────────────────────────
  const original = useRef(null);

  // ── Lookup data ──────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [venues, setVenues]         = useState([]);

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState({});
  const [formError, setFormError] = useState('');
  const [toast, setToast]         = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleting, setDeleting]   = useState(false);

  const showToast = (msg, type = 'success') => setToast({ msg, type });

  // ── Load lookups ─────────────────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API_URL}/admin/categories`, { headers })
      .then(r => setCategories(r.data))
      .catch(() => setCategories([
        { id: 1, name: 'Movie' },
        { id: 2, name: 'Concert' },
        { id: 3, name: 'Seminar' }
      ]));

    axios.get(`${API_URL}/admin/venues`, { headers })
      .then(r => setVenues(r.data))
      .catch(() => setVenues([]));
  }, []);

  // ── Load event ───────────────────────────────────────────────────────────────
  const loadEvent = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/admin/events/${id}`, { headers });

      const sts = data.showtimes.map(s => ({
        key:           s.id,
        id:            s.id,
        venueId:       String(s.venueId),
        startDateTime: toLocal(s.startDateTime),
        basePrice:     String(s.basePrice),
        capacity:      s.capacity,
        booked:        s.booked,
        remaining:     s.remaining
      }));

      setTitle(data.title || '');
      setCategoryId(data.categoryId ? String(data.categoryId) : '');
      setDescription(data.description || '');
      setShowtimes(sts);
      setDeletedIds([]);

      original.current = {
        title:       data.title || '',
        categoryId:  data.categoryId ? String(data.categoryId) : '',
        description: data.description || '',
        showtimes:   sts.map(s => ({ ...s }))
      };
    } catch {
      showToast('Failed to load event data', 'error');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadEvent(); }, [loadEvent]);

  // ── Showtime helpers ─────────────────────────────────────────────────────────
  const addShowtime = () => setShowtimes(p => [...p, newShowtime()]);

  const removeShowtime = (key, stId) => {
    setShowtimes(p => p.filter(s => s.key !== key));
    if (stId) setDeletedIds(p => [...p, stId]);
  };

  const updateSt = (key, field, value) => {
    setShowtimes(p => p.map(s => s.key === key ? { ...s, [field]: value } : s));
    setErrors(p => { const n = { ...p }; delete n[`st_${key}_${field}`]; return n; });
  };

  const venueById = id => venues.find(v => String(v.id) === String(id));

  // ── Reset ────────────────────────────────────────────────────────────────────
  const handleReset = () => {
    if (!original.current) return;
    const o = original.current;
    setTitle(o.title);
    setCategoryId(o.categoryId);
    setDescription(o.description);
    setShowtimes(o.showtimes.map(s => ({ ...s })));
    setDeletedIds([]);
    setErrors({});
    setFormError('');
    showToast('Form reset to saved values');
  };

  // ── Validation ───────────────────────────────────────────────────────────────
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

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    setFormError('');
    try {
      await axios.put(`${API_URL}/admin/events/${id}`, {
        title: title.trim(),
        description: description.trim(),
        categoryId: categoryId || null,
        showtimes: showtimes.map(s => ({
          id:            s.id || undefined,
          venueId:       s.venueId,
          startDateTime: s.startDateTime,
          basePrice:     parseFloat(s.basePrice)
        })),
        deletedShowtimeIds: deletedIds
      }, { headers });

      showToast('Event updated successfully');
      setDeletedIds([]);
      // Refresh to sync server state
      await loadEvent();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to update event';
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete event ─────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/admin/events/${id}`, { headers });
      navigate('/admin/events');
    } catch {
      showToast('Failed to delete event', 'error');
    } finally {
      setDeleting(false);
      setDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="eed-loading">
        <span className="eed-spinner" />
        Loading event…
      </div>
    );
  }

  return (
    <div className="eed-root">
      {toast && (
        <Toast key={toast.msg + toast.type} msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />
      )}

      {/* ── Topbar ── */}
      <div className="eed-topbar">
        <button className="eed-back" onClick={() => navigate('/admin/events')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back
        </button>
        <div>
          <div className="eed-page-title">Edit Event</div>
          <div className="eed-page-sub">Changes are applied immediately when you save</div>
        </div>
        <div className="eed-id-badge">
          <span className="eed-id-dot" />
          Event #{id}
        </div>
      </div>

      {formError && <div className="eed-banner error">{formError}</div>}

      <form onSubmit={handleSubmit} noValidate>

        {/* ── Basic Information ── */}
        <div className="eed-card">
          <div className="eed-section-hdr">
            <span className="eed-section-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            </span>
            Basic Information
          </div>

          <div className="eed-grid">
            <div className="eed-field eed-full">
              <label className="eed-label">Event Title <span className="eed-req">*</span></label>
              <input
                className={`eed-input${errors.title ? ' err' : ''}`}
                type="text"
                placeholder="e.g. Taylor Swift: The Eras Tour Bangkok"
                value={title}
                onChange={e => { setTitle(e.target.value); setErrors(p => ({ ...p, title: '' })); }}
              />
              {errors.title && <span className="eed-err-msg">{errors.title}</span>}
            </div>

            <div className="eed-field">
              <label className="eed-label">Category</label>
              <select className="eed-select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                <option value="">— Select category —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="eed-field eed-full">
              <label className="eed-label">Description</label>
              <textarea
                className="eed-textarea"
                rows={5}
                placeholder="Describe the event…"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* ── Showtimes ── */}
        <div className="eed-card">
          <div className="eed-section-hdr">
            <span className="eed-section-icon">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
            </span>
            Showtimes
            <span className="eed-count-pill">{showtimes.length}</span>
          </div>

          <div className="eed-showtimes">
            {showtimes.length === 0 && (
              <div className="eed-empty-st">No showtimes — click Add to create one</div>
            )}

            {showtimes.map((st, idx) => {
              const venue     = venueById(st.venueId);
              const isExisting = Boolean(st.id);
              const hasBookings = st.booked > 0;

              return (
                <div key={st.key} className={`eed-st-card${isExisting ? ' existing' : ' new-st'}`}>
                  <div className="eed-st-hdr">
                    <div className="eed-st-hdr-left">
                      <span className="eed-st-num">Showtime #{idx + 1}</span>
                      {isExisting
                        ? <span className="eed-st-badge saved">Saved</span>
                        : <span className="eed-st-badge unsaved">New</span>
                      }
                    </div>
                    <button
                      type="button"
                      className={`eed-st-remove${hasBookings ? ' disabled' : ''}`}
                      onClick={() => !hasBookings && removeShowtime(st.key, st.id)}
                      title={hasBookings ? `Cannot remove — ${st.booked} ticket(s) booked` : 'Remove showtime'}
                      disabled={hasBookings}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      {hasBookings ? `${st.booked} booked` : 'Remove'}
                    </button>
                  </div>

                  <div className="eed-st-grid">
                    {/* Venue */}
                    <div className="eed-field">
                      <label className="eed-label">Venue <span className="eed-req">*</span></label>
                      <select
                        className={`eed-select${errors[`st_${st.key}_venueId`] ? ' err' : ''}`}
                        value={st.venueId}
                        onChange={e => updateSt(st.key, 'venueId', e.target.value)}
                      >
                        <option value="">— Select venue —</option>
                        {venues.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.name}{v.capacity > 0 ? ` · ${v.capacity} seats` : ''}
                          </option>
                        ))}
                      </select>
                      {errors[`st_${st.key}_venueId`] && (
                        <span className="eed-err-msg">{errors[`st_${st.key}_venueId`]}</span>
                      )}
                      {venue && (
                        <div className="eed-venue-info">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                          {venue.location && <span>{venue.location} · </span>}
                          <strong>{venue.capacity} seats</strong>
                        </div>
                      )}
                    </div>

                    {/* Date & Time */}
                    <div className="eed-field">
                      <label className="eed-label">Start Date &amp; Time <span className="eed-req">*</span></label>
                      <input
                        className={`eed-input${errors[`st_${st.key}_startDateTime`] ? ' err' : ''}`}
                        type="datetime-local"
                        value={st.startDateTime}
                        onChange={e => updateSt(st.key, 'startDateTime', e.target.value)}
                      />
                      {errors[`st_${st.key}_startDateTime`] && (
                        <span className="eed-err-msg">{errors[`st_${st.key}_startDateTime`]}</span>
                      )}
                    </div>

                    {/* Base Price */}
                    <div className="eed-field">
                      <label className="eed-label">Base Price (฿) <span className="eed-req">*</span></label>
                      <div className="eed-price-wrap">
                        <span className="eed-price-pfx">฿</span>
                        <input
                          className={`eed-input eed-price-input${errors[`st_${st.key}_basePrice`] ? ' err' : ''}`}
                          type="number"
                          placeholder="0"
                          min="0"
                          step="1"
                          value={st.basePrice}
                          onChange={e => updateSt(st.key, 'basePrice', e.target.value)}
                        />
                      </div>
                      {errors[`st_${st.key}_basePrice`] && (
                        <span className="eed-err-msg">{errors[`st_${st.key}_basePrice`]}</span>
                      )}
                      {st.basePrice && !isNaN(st.basePrice) && (
                        <div className="eed-price-hint">
                          VIP ฿{(Number(st.basePrice)*2).toLocaleString()} · Standard ฿{Number(st.basePrice).toLocaleString()} · Sofa ฿{(Number(st.basePrice)*1.5).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Booking stats (existing only) */}
                  {isExisting && (
                    <div className="eed-stats-row">
                      <div className="eed-stat">
                        <span className="eed-stat-val">{st.booked}</span>
                        <span className="eed-stat-lbl">Booked</span>
                      </div>
                      <div className="eed-stat-div" />
                      <div className="eed-stat">
                        <span className="eed-stat-val">{st.remaining}</span>
                        <span className="eed-stat-lbl">Remaining</span>
                      </div>
                      <div className="eed-stat-div" />
                      <div className="eed-stat">
                        <span className="eed-stat-val">{st.capacity}</span>
                        <span className="eed-stat-lbl">Capacity</span>
                      </div>
                      {st.capacity > 0 && (
                        <>
                          <div className="eed-stat-div" />
                          <div className="eed-fill-bar-wrap">
                            <div className="eed-fill-bar">
                              <div
                                className="eed-fill-inner"
                                style={{ width: `${Math.round((st.booked / st.capacity) * 100)}%` }}
                              />
                            </div>
                            <span className="eed-fill-pct">
                              {Math.round((st.booked / st.capacity) * 100)}% full
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <button type="button" className="eed-add-st" onClick={addShowtime}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              Add Showtime
            </button>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="eed-footer">
          <button type="button" className="eed-btn-ghost" onClick={() => navigate('/admin/events')}>
            Cancel
          </button>
          <button type="button" className="eed-btn-ghost" onClick={handleReset}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-4.85L1 10"/></svg>
            Reset
          </button>
          <button type="submit" className="eed-btn-primary" disabled={saving}>
            {saving
              ? <><span className="eed-spinner" />Saving…</>
              : <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Save Changes</>
            }
          </button>
        </div>
      </form>

      {/* ── Danger Zone ── */}
      <div className="eed-danger-zone">
        <div className="eed-danger-info">
          <div className="eed-danger-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Delete This Event
          </div>
          <div className="eed-danger-desc">
            Permanently remove this event and all its showtimes. Showtimes with bookings cannot be auto-deleted.
          </div>
        </div>
        <button className="eed-btn-danger" onClick={() => setDeleteModal(true)}>
          Delete Event
        </button>
      </div>

      {/* ── Delete Modal ── */}
      {deleteModal && (
        <div className="eed-modal-bg" onClick={() => setDeleteModal(false)}>
          <div className="eed-modal" onClick={e => e.stopPropagation()}>
            <div className="eed-modal-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/></svg>
            </div>
            <div className="eed-modal-title">Delete Event?</div>
            <div className="eed-modal-body">
              You are about to permanently delete <strong>"{title}"</strong>. All showtimes without bookings will also be removed. This cannot be undone.
            </div>
            <div className="eed-modal-actions">
              <button className="eed-btn-ghost" onClick={() => setDeleteModal(false)}>Cancel</button>
              <button className="eed-btn-del-confirm" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EditEvent;
