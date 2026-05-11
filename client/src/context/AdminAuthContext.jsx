import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AdminAuthContext = createContext(null);

const API_URL = 'http://localhost:4000/api';

export function AdminAuthProvider({ children }) {
  const [adminUser, setAdminUser] = useState(null);
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('adminUser');
    const storedToken = localStorage.getItem('adminToken');

    if (storedUser && storedToken) {
      setAdminUser(JSON.parse(storedUser));
      setAdminToken(storedToken);
    }
    setLoading(false);
  }, []);

  const adminLogin = async (email, password) => {
    try {
      const response = await axios.post(`${API_URL}/admin/auth/login`, {
        email: email.trim().toLowerCase(),
        password
      });

      const { user, token } = response.data;

      setAdminUser(user);
      setAdminToken(token);
      localStorage.setItem('adminUser', JSON.stringify(user));
      localStorage.setItem('adminToken', token);

      return { success: true, user, token };
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed'
      };
    }
  };

  const adminLogout = () => {
    setAdminUser(null);
    setAdminToken(null);
    localStorage.removeItem('adminUser');
    localStorage.removeItem('adminToken');
  };

  const value = {
    adminUser,
    adminToken,
    loading,
    adminLogin,
    adminLogout,
    isAdminAuthenticated: !!adminUser && !!adminToken
  };

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return context;
}
