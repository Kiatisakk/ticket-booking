// Simple API Test Script
// Run: node test-api.js

const API_BASE = 'http://localhost:4000/api';

async function testAPI() {
  console.log('🧪 Testing Ticket Booking API...\n');

  try {
    // Test 1: Get Events
    console.log('1️⃣  Testing GET /api/events');
    const eventsRes = await fetch(`${API_BASE}/events`);
    if (eventsRes.ok) {
      const events = await eventsRes.json();
      console.log(`   ✅ Success! Found ${events.length} events`);
    } else {
      console.log('   ❌ Failed');
    }

    // Test 2: Get Venues
    console.log('\n2️⃣  Testing GET /api/venues');
    const venuesRes = await fetch(`${API_BASE}/venues`);
    if (venuesRes.ok) {
      const venues = await venuesRes.json();
      console.log(`   ✅ Success! Found ${venues.length} venues`);
    } else {
      console.log('   ❌ Failed');
    }

    // Test 3: Get Seat Types
    console.log('\n3️⃣  Testing GET /api/seat-types');
    const seatsRes = await fetch(`${API_BASE}/seat-types`);
    if (seatsRes.ok) {
      const seats = await seatsRes.json();
      console.log(`   ✅ Success! Found ${seats.length} seat types`);
    } else {
      console.log('   ❌ Failed');
    }

    // Test 4: Login
    console.log('\n4️⃣  Testing POST /api/auth/login');
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'john@example.com',
        password: 'password123'
      })
    });

    if (loginRes.ok) {
      const loginData = await loginRes.json();
      console.log('   ✅ Login successful!');
      console.log(`   Token: ${loginData.token.substring(0, 50)}...`);

      // Test 5: Get My Bookings (authenticated)
      console.log('\n5️⃣  Testing GET /api/bookings/my (authenticated)');
      const bookingsRes = await fetch(`${API_BASE}/bookings/my`, {
        headers: { 'Authorization': `Bearer ${loginData.token}` }
      });
      if (bookingsRes.ok) {
        const bookings = await bookingsRes.json();
        console.log(`   ✅ Success! Found ${bookings.length} bookings`);
      } else {
        console.log('   ❌ Failed');
      }

      // Test 6: Get Payment Methods
      console.log('\n6️⃣  Testing GET /api/payment-methods');
      const paymentRes = await fetch(`${API_BASE}/payment-methods`);
      if (paymentRes.ok) {
        const methods = await paymentRes.json();
        console.log(`   ✅ Success! Found ${methods.length} payment methods`);
      } else {
        console.log('   ❌ Failed');
      }

    } else {
      console.log('   ❌ Login failed (user may not exist yet)');
    }

    console.log('\n✅ All tests completed!\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.log('\n💡 Make sure the server is running: npm run dev');
  }
}

testAPI();
