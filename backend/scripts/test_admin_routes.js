require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

async function testAdminRoutes() {
  const token = jwt.sign(
    { id: '6a168e9427e1eec4a511e88c' }, // dummy ID, but auth middleware fetches user, so we need a real admin user
    process.env.JWT_SECRET || 'lexguard_fallback_secret',
    { expiresIn: '1h' }
  );

  // We actually need a real User in the DB with role 'admin' for `authMiddleware.js` to work.
  // The User.findById(decoded.id) needs to succeed.
  
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('../src/models/User');
  let admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    admin = await User.create({
      name: 'Test Admin',
      email: 'testadmin@lexguard.com',
      passwordHash: 'dummy',
      role: 'admin'
    });
  }

  const validToken = jwt.sign(
    { id: admin._id },
    process.env.JWT_SECRET || 'lexguard_fallback_secret',
    { expiresIn: '1h' }
  );

  const fetch = require('node-fetch'); // or use native fetch if node 18+

  // Start the server or hit the already running server?
  // Let's just hit localhost:5001 (assuming it's running via nodemon)
  // Or we can just test the function directly if the server isn't running.
  
  try {
    const res = await globalThis.fetch('http://localhost:5001/api/admin/metrics/summary', {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    const summary = await res.json();
    console.log("Summary:", JSON.stringify(summary, null, 2));

    const res2 = await globalThis.fetch('http://localhost:5001/api/admin/metrics/timeseries', {
      headers: { Authorization: `Bearer ${validToken}` }
    });
    const timeseries = await res2.json();
    console.log("TimeSeries:", JSON.stringify(timeseries, null, 2));
  } catch(e) {
    console.log("Server might not be running. Run npm run dev first.");
  }
  
  await mongoose.disconnect();
}

testAdminRoutes();
