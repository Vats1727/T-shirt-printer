
import fetch from 'node-fetch';

async function verify() {
  const baseUrl = 'http://localhost:5000/api'; // Assuming server runs on 5000

  // 1. GET /api/d1 -> Expected: [dd1, dd2, dd3, dd4, dd5, dd6]
  console.log('Testing GET /api/d1...');
  const res1 = await fetch(`${baseUrl}/d1`);
  const data1 = await res1.json();
  console.log('Result:', data1);
  const expected1 = ['dd1', 'dd2', 'dd3', 'dd4', 'dd5', 'dd6'];
  const pass1 = Array.isArray(data1) && expected1.every(code => data1.includes(code));
  console.log(pass1 ? '✅ PASS' : '❌ FAIL');

  // 2. GET /api/d2/dd8 -> Expected: details of dd8
  console.log('\nTesting GET /api/d2/dd8...');
  const res2 = await fetch(`${baseUrl}/d2/dd8`);
  const data2 = await res2.json();
  console.log('Result status:', res2.status);
  const pass2 = res2.ok && data2.design_code === 'dd8' && data2.group_id === 'd2';
  console.log(pass2 ? '✅ PASS' : '❌ FAIL');

  // 3. GET /api/d2/dd5 -> Expected: "Invalid design code" error
  console.log('\nTesting GET /api/d2/dd5...');
  const res3 = await fetch(`${baseUrl}/d2/dd5`);
  const data3 = await res3.json();
  console.log('Result status:', res3.status);
  console.log('Result body:', data3);
  const pass3 = res3.status === 400 && data3.message === 'Invalid design code';
  console.log(pass3 ? '✅ PASS' : '❌ FAIL');

  if (pass1 && pass2 && pass3) {
    console.log('\n🚀 ALL API TESTS PASSED!');
  } else {
    console.log('\n🛑 SOME TESTS FAILED!');
    process.exit(1);
  }
}

verify().catch(err => {
  console.error(err);
  process.exit(1);
});
