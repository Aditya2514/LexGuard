const express = require('express');
const mongoose = require('mongoose');
const FormData = require('form-data');
const fs = require('fs');

async function runTest() {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/lexguard_test';
  process.env.LLAMA_CLOUD_API_KEY = 'dummy';
  
  const app = require('./src/server'); 
  await new Promise(r => setTimeout(r, 2000));
  
  const User = require('./src/models/User');
  let user = await User.findOne({ email: 'test@example.com' });
  if (!user) {
    user = await User.create({ email: 'test@example.com', passwordHash: '123' });
  }

  const jwt = require('jsonwebtoken');
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || 'super_secret_lexguard_jwt_key_2026', { expiresIn: '1h' });

  // Let's create a minimal valid PDF file structure so pdf-parse doesn't throw a random non-PDF error.
  // Although pdf-parse failing should return 422, let's just be safe.
  fs.writeFileSync('dummy_contract.pdf', '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 0 >>\nstream\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000216 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n265\n%%EOF');
  
  const form = new FormData();
  form.append('file', fs.createReadStream('dummy_contract.pdf'), {
    filename: 'dummy_contract.pdf',
    contentType: 'application/pdf'
  });
  form.append('contractCategory', 'Employment');
  
  console.log('Sending upload request...');
  const res = await fetch(`http://localhost:${process.env.PORT || 7860}/api/contracts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      ...form.getHeaders()
    },
    body: form
  });

  const text = await res.text();
  console.log('Response Status:', res.status);
  console.log('Response Body:', text);
  
  setTimeout(() => process.exit(0), 1000);
}

runTest();
