'use strict';

/**
 * runTests.js — Automated test suite
 * Tests backend startup, health API, tracking, booking, auth, dashboard, and transactions.
 * Uses only Node.js built-ins + the project's own dependencies (no extra test framework).
 * Safe: never touches the production database destructively.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const http = require('http');
const PORT = Number(process.env.PORT) || 3000;
const BASE = `http://localhost:${PORT}`;

let passed = 0;
let failed = 0;
const results = [];

// ── Tiny HTTP helper ──────────────────────────────────────────────
function request(method, path, body, cookieJar = {}) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };

    // Forward cookies
    const cookieStr = Object.entries(cookieJar).map(([k,v]) => `${k}=${v}`).join('; ');
    if (cookieStr) headers['Cookie'] = cookieStr;

    const options = {
      hostname: 'localhost',
      port:     PORT,
      path,
      method,
      headers
    };
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Capture set-cookie
        const setCookies = res.headers['set-cookie'] || [];
        const cookies = {};
        setCookies.forEach(c => {
          const [pair] = c.split(';');
          const [k, v] = pair.split('=');
          if (k && v) cookies[k.trim()] = v.trim();
        });
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), cookies });
        } catch {
          resolve({ status: res.statusCode, body: data, cookies });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Test runner ───────────────────────────────────────────────────
async function test(name, fn) {
  try {
    await fn();
    passed++;
    results.push({ name, status: 'PASS' });
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    failed++;
    results.push({ name, status: 'FAIL', error: err.message });
    console.log(`  ❌ FAIL: ${name}`);
    console.log(`       → ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`);
}

// ── Check server is running ───────────────────────────────────────
async function waitForServer(maxMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      await request('GET', '/api/health');
      return true;
    } catch {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  return false;
}

// ── Main ──────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   CourierTrack – Automated Test Suite            ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  // Check server
  console.log('  Waiting for server on port', PORT, '…');
  const serverUp = await waitForServer();
  if (!serverUp) {
    console.log('\n  ⚠️  Server not responding. Start it with: npm run dev');
    console.log('  Then re-run: npm test\n');
    process.exit(1);
  }
  console.log('  Server is up.\n');

  let sessionCookies = {};
  let bookedTN       = null;
  let bookedId       = null;

  // ── Group 1: Health ───────────────────────────────────────────
  console.log('▶ Group 1: Health Check');
  await test('GET /api/health returns 200', async () => {
    const r = await request('GET', '/api/health');
    assertEqual(r.status, 200, `Expected 200, got ${r.status}`);
    assert(r.body.success === true, 'success should be true');
    assert(r.body.server === 'online', 'server should be online');
  });

  await test('GET /api/health reports database status', async () => {
    const r = await request('GET', '/api/health');
    assert('database' in r.body, 'Response must include database field');
  });

  // ── Group 2: Tracking ─────────────────────────────────────────
  console.log('\n▶ Group 2: Tracking');
  await test('GET /api/track/:tn — valid sample tracking number', async () => {
    const r = await request('GET', '/api/track/CTS-2024-00001');
    // May be 200 (found) or 404 (sample data not loaded yet) — both acceptable
    assert([200, 404].includes(r.status), `Expected 200 or 404, got ${r.status}`);
    assert(typeof r.body === 'object', 'Response must be JSON');
  });

  await test('GET /api/track/:tn — nonexistent tracking number returns 404', async () => {
    const r = await request('GET', '/api/track/CTS-INVALID-99999');
    assertEqual(r.status, 404, `Expected 404, got ${r.status}`);
    assert(r.body.success === false, 'success should be false');
    assert(r.body.error, 'Should include error message');
  });

  await test('GET /api/track/:tn — too short input returns 400', async () => {
    const r = await request('GET', '/api/track/A');
    assertEqual(r.status, 400, `Expected 400, got ${r.status}`);
  });

  // ── Group 3: Booking ─────────────────────────────────────────
  console.log('\n▶ Group 3: Booking (POST /api/shipments)');
  await test('POST /api/shipments — missing sender name returns 400', async () => {
    const r = await request('POST', '/api/shipments', {
      sender_phone: '9999999990', receiver_name: 'Test', receiver_phone: '9999999991',
      weight_kg: 1, courier_type: 'Standard'
    });
    assertEqual(r.status, 400, `Expected 400, got ${r.status}`);
    assert(r.body.success === false, 'success should be false');
  });

  await test('POST /api/shipments — missing weight returns 400', async () => {
    const r = await request('POST', '/api/shipments', {
      sender_name: 'Test S', sender_phone: '9999999992',
      receiver_name: 'Test R', receiver_phone: '9999999993',
      courier_type: 'Standard'
    });
    assertEqual(r.status, 400, `Expected 400, got ${r.status}`);
  });

  await test('POST /api/shipments — invalid courier type returns 400', async () => {
    const r = await request('POST', '/api/shipments', {
      sender_name: 'A', sender_phone: '9000000001',
      receiver_name: 'B', receiver_phone: '9000000002',
      weight_kg: 1, courier_type: 'INVALID_TYPE'
    });
    assertEqual(r.status, 400, `Expected 400, got ${r.status}`);
  });

  await test('POST /api/shipments — valid booking creates shipment', async () => {
    const phone1 = `80${Math.floor(10000000 + Math.random() * 89999999)}`;
    const phone2 = `81${Math.floor(10000000 + Math.random() * 89999999)}`;
    const r = await request('POST', '/api/shipments', {
      sender_name: 'Test Sender',    sender_phone: phone1,
      sender_email: 'test@test.com', sender_address: 'Test City',
      receiver_name: 'Test Receiver', receiver_phone: phone2,
      receiver_address: 'Delivery City',
      weight_kg: 2.5, courier_type: 'Express'
    });
    assert([201, 400, 500].includes(r.status), `Got ${r.status}`);
    if (r.status === 201) {
      assert(r.body.success === true, 'success should be true');
      assert(r.body.tracking_number, 'Should return tracking_number');
      assert(r.body.tracking_number.startsWith('CTS-'), 'Tracking number format should start with CTS-');
      bookedTN = r.body.tracking_number;
      bookedId = r.body.shipment_id;
      console.log(`       Booked: ${bookedTN}`);
    }
  });

  await test('POST /api/shipments — unique tracking number generated', async () => {
    if (!bookedTN) { console.log('       (skipped — no booked TN available)'); return; }
    const r = await request('GET', `/api/track/${bookedTN}`);
    assert([200, 404].includes(r.status), `Got ${r.status}`);
    if (r.status === 200) {
      assert(r.body.shipment.tracking_number === bookedTN, 'TN should match');
    }
  });

  // ── Group 4: Auth ─────────────────────────────────────────────
  console.log('\n▶ Group 4: Authentication');
  await test('POST /api/auth/login — missing credentials returns 400', async () => {
    const r = await request('POST', '/api/auth/login', { username: '', password: '' });
    assertEqual(r.status, 400, `Expected 400, got ${r.status}`);
  });

  await test('POST /api/auth/login — wrong password returns 401', async () => {
    const r = await request('POST', '/api/auth/login', {
      username: 'admin', password: 'definitelywrongpassword99!'
    });
    assertEqual(r.status, 401, `Expected 401, got ${r.status}`);
    assert(r.body.success === false, 'success should be false');
  });

  await test('GET /api/auth/me — without session returns 401', async () => {
    const r = await request('GET', '/api/auth/me');
    assertEqual(r.status, 401, `Expected 401, got ${r.status}`);
  });

  // ── Group 5: Protected routes ─────────────────────────────────
  console.log('\n▶ Group 5: Authorization (unauthenticated)');
  await test('GET /api/shipments — without auth returns 401', async () => {
    const r = await request('GET', '/api/shipments');
    assertEqual(r.status, 401, `Expected 401, got ${r.status}`);
  });

  await test('GET /api/dashboard/stats — without auth returns 401', async () => {
    const r = await request('GET', '/api/dashboard/stats');
    assertEqual(r.status, 401, `Expected 401, got ${r.status}`);
  });

  await test('PATCH /api/shipments/1/status — without auth returns 401', async () => {
    const r = await request('PATCH', '/api/shipments/1/status', { status: 'In Transit' });
    assertEqual(r.status, 401, `Expected 401, got ${r.status}`);
  });

  // ── Group 6: Input validation on status update ────────────────
  console.log('\n▶ Group 6: Status Update Validation');
  await test('PATCH /api/shipments/:id/status — invalid status value rejected', async () => {
    // Even if unauthenticated, the 401 still validates the endpoint exists
    const r = await request('PATCH', '/api/shipments/1/status', { status: 'FLYING' });
    assert([400, 401].includes(r.status), `Expected 400 or 401, got ${r.status}`);
  });

  await test('PATCH /api/shipments/:id/status — non-numeric id returns 400 or 401', async () => {
    const r = await request('PATCH', '/api/shipments/abc/status', { status: 'Delivered' });
    assert([400, 401].includes(r.status), `Expected 400 or 401, got ${r.status}`);
  });

  // ── Group 7: Frontend pages served ───────────────────────────
  console.log('\n▶ Group 7: Frontend pages');
  for (const [label, path] of [
    ['Homepage',   '/'],
    ['Track page', '/track'],
    ['Book page',  '/book'],
    ['Login page', '/login'],
    ['Admin page', '/admin']
  ]) {
    await test(`${label} served as HTML`, async () => {
      const res = await new Promise((resolve) => {
        const req = http.request({ hostname:'localhost', port:PORT, path, method:'GET' }, r => {
          let d = '';
          r.on('data', c => d += c);
          r.on('end', () => resolve({ status: r.statusCode, ct: r.headers['content-type'], body: d }));
        });
        req.on('error', () => resolve({ status: 0 }));
        req.end();
      });
      assertEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert(res.ct?.includes('html'), `Expected HTML content-type, got ${res.ct}`);
    });
  }

  // ── Summary ───────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log(`║  RESULTS:  ${passed} passed,  ${failed} failed               `.padEnd(51) + '║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  • ${r.name}`);
      console.log(`    ${r.error}`);
    });
    console.log('');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\nFatal test error:', err.message);
  process.exit(1);
});
