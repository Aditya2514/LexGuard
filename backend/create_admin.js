require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const email = 'admin@lexguard.app';
    const password = 'lexguardadmin'; // Better default password
    
    // Check if user already exists
    let admin = await User.findOne({ email });
    
    if (admin) {
      // Update existing admin
      admin.plan = 'enterprise';
      admin.monthlyQuota = 999999;
      admin.usedThisMonth = 0;
      await admin.save();
      console.log('Admin account updated with unlimited access.');
    } else {
      // Create new admin
      admin = new User({
        email,
        passwordHash: password, // The pre('save') hook will hash this
        plan: 'enterprise',
        monthlyQuota: 999999,
        usedThisMonth: 0,
      });
      await admin.save();
      console.log('Admin account created with unlimited access.');
    }

    console.log('---------------------------------');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('---------------------------------');
    
    process.exit(0);
  } catch (err) {
    console.error('Failed to create admin:', err);
    process.exit(1);
  }
};

createAdmin();
