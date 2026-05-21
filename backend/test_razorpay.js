

async function testRazorpay() {
  const BASE_URL = 'http://localhost:5001/api';
  console.log('Testing Razorpay Flow...\n');

  try {
    // 1. Register
    console.log('1. Registering test user...');
    const email = `test-payment-${Date.now()}@example.com`;
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'password123' })
    });
    const regData = await regRes.json();
    if (!regRes.ok) throw new Error(regData.message);
    const token = regData.token;
    console.log('   ✅ User registered successfully. Token received.\n');

    // 2. Create Order
    console.log('2. Creating Razorpay Order (Pro Plan - ₹499)...');
    const orderRes = await fetch(`${BASE_URL}/payments/create-order`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ plan: 'pro' })
    });
    const orderData = await orderRes.json();
    
    if (orderRes.ok && orderData.success) {
      console.log('   ✅ Razorpay Order Created Successfully!');
      console.log('      Order ID:', orderData.order.id);
      console.log('      Amount:', orderData.order.amount, orderData.order.currency);
      console.log('      Key ID returned to frontend:', orderData.keyId);
      console.log('\n🎉 The Razorpay integration is working perfectly on the backend!');
    } else {
      console.log('   ❌ Failed to create order:', orderData);
    }
  } catch (err) {
    console.error('Test script error:', err);
  }
}

testRazorpay();
