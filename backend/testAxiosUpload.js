const mongoose = require('mongoose');
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function runTest() {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/lexguard_test';
  process.env.LLAMA_CLOUD_API_KEY = 'dummy';
  process.env.PORT = '5002'; // use different port to avoid conflicts
  
  const app = require('./src/server'); 
  await new Promise(r => setTimeout(r, 2000));
  
  const User = require('./src/models/User');
  let user = await User.findOne({ email: 'test@example.com' });
  if (!user) {
    user = await User.create({ email: 'test@example.com', passwordHash: '123' });
  }

  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'super_secret_lexguard_jwt_key_2026', { expiresIn: '1h' });

  fs.writeFileSync('dummy_contract2.pdf', '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 0 >>\nstream\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000216 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n265\n%%EOF');
  
  const form = new FormData();
  form.append('file', fs.createReadStream('dummy_contract2.pdf'), {
    filename: 'dummy_contract2.pdf',
    contentType: 'application/pdf'
  });
  form.append('contractCategory', 'Employment');
  
  console.log('Sending upload request via axios...');
  try {
    const res = await axios.post(`http://localhost:5002/api/contracts`, form, {
      headers: {
        'Authorization': `Bearer ${token}`,
        ...form.getHeaders()
      }
    });
    console.log('Response Status:', res.status);
    console.log('Response Body:', res.data);
  } catch (err) {
    console.error('Response Status:', err.response?.status);
    console.error('Response Body:', err.response?.data);
  }
  
  setTimeout(() => process.exit(0), 1000);
}

runTest();
