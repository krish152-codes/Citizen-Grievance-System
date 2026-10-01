// Offline test: feeds real Arduino lines to the processor against a mock API.
const http = require('http');
const assert = require('assert');
const { createProcessor, parseLine, toReading } = require('./lib');

const LINE = '{"device_id":"DR-001","water_distance_cm":0.901,"water_depth_cm":149.099,"water_fill_pct":99.39934,"water_status":"CRITICAL","rain_raw":250,"rain_wetness":"DETECTED","ch4_signal":627,"ch4_status":"WARNING","h2s_signal":297,"h2s_status":"NORMAL","atmosphere_status":"ALERT","device_status":"ONLINE"}';

(async () => {
  const posts = []; let keyOk = true;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      if (req.method === 'GET' && req.url === '/api/drains') return res.end(JSON.stringify({ drains: [{ _id: 'abc123', deviceId: 'DR-001' }] }));
      if (req.method === 'POST' && req.url === '/api/drains/abc123/readings') {
        if (req.headers['x-device-key'] !== 'secret') { keyOk = false; res.statusCode = 401; return res.end(JSON.stringify({ message: 'Invalid or missing device key' })); }
        posts.push(JSON.parse(body)); res.statusCode = 201; return res.end('{"success":true}');
      }
      res.statusCode = 404; res.end('{}');
    });
  }).listen(0);
  const port = server.address().port;
  const logs = [];
  let t = 1000;
  const mk = (key) => createProcessor({ apiBase: `http://localhost:${port}/api`, deviceKey: key, postEveryMs: 2000, log: (m) => logs.push(m), now: () => t });

  assert.strictEqual(parseLine('garbage'), null);
  assert.strictEqual(parseLine('Booting...{"a":'), null);
  const r = toReading(parseLine(LINE));
  assert.strictEqual(r.rainWetness, 'DETECTED'); assert.ok(Math.abs(r.ch4Signal - 627 / 1023) < 1e-9);

  // wrong key → 401 reported, not crashing
  let p = mk('wrong'); await p.handleLine(LINE);
  assert.strictEqual(p.stats.failed, 1); assert.strictEqual(keyOk, false);

  // right key → saved; throttled lines skipped; partial line ignored
  p = mk('secret');
  await p.handleLine('{"device_id":"DR-001","water_dep');       // partial (boot / mid-line)
  await p.handleLine(LINE);                                       // saved
  t += 500; await p.handleLine(LINE);                             // throttled
  t += 2500; await p.handleLine(LINE);                            // saved
  assert.strictEqual(p.stats.saved, 2); assert.strictEqual(posts.length, 2);
  assert.strictEqual(posts[0].waterDepthCm, 149.099);

  // unknown device id → clear message
  p = mk('secret'); t += 5000;
  await p.handleLine(LINE.replace('DR-001', 'DR-999'));
  assert.ok(logs.some((m) => m.includes('No drain with Device ID "DR-999"')));

  console.log('All bridge tests passed.\n' + logs.map((l) => '  ' + l).join('\n'));
  server.close();
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
