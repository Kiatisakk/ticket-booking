import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import './SystemSettings.css';

const API_URL = 'http://localhost:4000/api';

function SystemSettings() {
  const { adminToken } = useAdminAuth();
  const [settings, setSettings] = useState({ categories: [], venues: [], paymentMethods: [] });
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');

  const headers = { Authorization: `Bearer ${adminToken}` };

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axios.get(`${API_URL}/admin/settings`, { headers });
      setSettings(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const togglePaymentMethod = async (method) => {
    setSavingId(method.id);
    setError('');
    try {
      const { data } = await axios.patch(
        `${API_URL}/admin/settings/payment-methods/${method.id}`,
        { isActive: !method.isActive },
        { headers }
      );

      setSettings(prev => ({
        ...prev,
        paymentMethods: prev.paymentMethods.map(item =>
          item.id === data.id ? data : item
        )
      }));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update payment method');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) return <div className="settings-loading">Loading settings...</div>;

  return (
    <div className="settings-page">
      {error && <div className="settings-error">{error}</div>}

      <section className="settings-section">
        <div className="settings-section-header">
          <div>
            <h2>Payment Methods</h2>
            <p>Control which payment methods customers can use at checkout.</p>
          </div>
        </div>

        <div className="settings-list">
          {settings.paymentMethods.map(method => (
            <div key={method.id} className="settings-row">
              <div>
                <div className="settings-row-title">{method.name}</div>
                <div className="settings-row-sub">Method ID #{method.id}</div>
              </div>
              <button
                type="button"
                className={`settings-toggle ${method.isActive ? 'active' : ''}`}
                onClick={() => togglePaymentMethod(method)}
                disabled={savingId === method.id}
              >
                {savingId === method.id ? 'Saving...' : method.isActive ? 'Active' : 'Inactive'}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="settings-grid">
        <div className="settings-section">
          <div className="settings-section-header">
            <div>
              <h2>Event Categories</h2>
              <p>Categories used for event browsing and reports.</p>
            </div>
          </div>
          <div className="settings-list compact">
            {settings.categories.map(category => (
              <div key={category.id} className="settings-row">
                <div>
                  <div className="settings-row-title">{category.name}</div>
                  <div className="settings-row-sub">Category ID #{category.id}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-header">
            <div>
              <h2>Venues</h2>
              <p>Venues available when creating event showtimes.</p>
            </div>
          </div>
          <div className="settings-list compact">
            {settings.venues.map(venue => (
              <div key={venue.id} className="settings-row">
                <div>
                  <div className="settings-row-title">{venue.name}</div>
                  <div className="settings-row-sub">{venue.location || `Venue ID #${venue.id}`}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default SystemSettings;
