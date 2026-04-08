# 🔐 Login Page Usage Guide

## 📋 Overview

The login page has been added to the React frontend. It connects to the existing backend API for authentication.

---

## 🚀 Quick Start

### 1. Start the Backend API Server

```bash
cd server
npm run dev
```

✅ Server should be running at: http://localhost:4000

### 2. Start the Frontend

```bash
cd client
npm run dev
```

✅ Frontend running at: http://localhost:3000

### 3. Open in Browser

Go to: **http://localhost:3000**

---

## 🔑 Test Credentials

### Customer Account
- **Email**: `john@example.com`
- **Password**: `password123`

### Admin Account
- **Email**: `admin@example.com`
- **Password**: `password123`

---

## ✨ Features

### Login Form
- Email and password input fields
- Form validation (required fields)
- Error messages for failed login attempts
- Loading state during authentication
- Demo credentials displayed for easy testing

### Authentication Flow
1. User enters email and password
2. Clicks "Sign In"
3. API validates credentials
4. JWT token is stored in localStorage
5. User is redirected to `/dashboard`
6. Session persists across page refreshes

### Dashboard (After Login)
- Shows welcome message with user's name
- Displays user email
- Logout button
- Protected route (redirects to login if not authenticated)

---

## 📁 File Structure

```
client/src/
├── context/
│   └── AuthContext.jsx      # Authentication state management
├── pages/
│   ├── Login.jsx            # Login form component
│   └── Login.css            # Login page styles
├── App.jsx                  # Routing configuration
└── main.jsx                 # AuthProvider wrapper
```

---

## 🔧 How to Use in Your Code

### Get User Info in Any Component

```jsx
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { user, token, isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <p>Welcome, {user.fullName}!</p>;
  }
  
  return <p>Please log in</p>;
}
```

### Check if User is Logged In

```jsx
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { isAuthenticated } = useAuth();
  
  return isAuthenticated ? <PrivateContent /> : <LoginPrompt />;
}
```

### Logout Programmatically

```jsx
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { logout } = useAuth();
  
  return <button onClick={logout}>Logout</button>;
}
```

### Make Authenticated API Requests

```jsx
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

function MyComponent() {
  const { token } = useAuth();
  
  const fetchData = async () => {
    const response = await axios.get('http://localhost:4000/api/bookings/my', {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log(response.data);
  };
  
  return <button onClick={fetchData}>Get My Bookings</button>;
}
```

---

## 🎨 Customization

### Change API URL

Edit `client/src/context/AuthContext.jsx`:

```jsx
const API_URL = 'http://localhost:4000/api';
// Change to your production API URL when deploying
```

### Modify Styling

Edit `client/src/pages/Login.css` to change colors, fonts, layout, etc.

### Add Registration Page

Create `client/src/pages/Register.jsx` following the same pattern as `Login.jsx`, and call:

```jsx
await axios.post('http://localhost:4000/api/auth/register', {
  fullName,
  email,
  password
});
```

---

## 🐛 Troubleshooting

### "Login failed" Error

**Check:**
1. Backend server is running at http://localhost:4000
2. Database is running
3. User exists in database

**Test API directly:**
```bash
curl -X POST http://localhost:4000/api/auth/login ^
  -H "Content-Type: application/json" ^
  -d "{\"email\":\"john@example.com\",\"password\":\"password123\"}"
```

### Page Not Loading

**Check:**
1. Frontend is running: `cd client && npm run dev`
2. Dependencies installed: `cd client && npm install`
3. No errors in browser console (F12)

### Token Not Persisting

**Check:**
1. Browser localStorage is enabled
2. Not in incognito/private mode (some browsers block storage)
3. Check Application tab in DevTools → Local Storage

---

## 📊 Routes

| Route | Description | Access |
|-------|-------------|--------|
| `/` | Login page | Public (redirects to /dashboard if logged in) |
| `/dashboard` | User dashboard | Protected (requires login) |

---

## 🔮 Next Steps

After login is working, you can build:

1. **Event Listing Page** - Show all available events
2. **Seat Selection** - Interactive seat picker
3. **Booking Cart** - Review selected tickets
4. **Payment Page** - Checkout flow
5. **My Tickets** - View purchased tickets
6. **Admin Dashboard** - Manage events and bookings

---

## 💡 Tips

- Token is automatically included in API requests when using `useAuth()`
- User session persists across browser refreshes
- Protected routes automatically redirect to login
- Logout clears all stored data

---

**Happy coding! 🎉**
