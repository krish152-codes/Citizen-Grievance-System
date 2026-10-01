#!/usr/bin/env node
// Reads the Arduino's serial JSON and sends it to the SheharSetu backend.
// Run:  node bridge.js            (uses settings from .env)
//       node bridge.js COM8       (override the port)
require('dotenv').config();
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { createProcessor } = require('./lib');

const API_BASE = process.env.API_BASE_URL || 'http://localhost:5000/api';
const BAUD = parseInt(process.env.BAUD_RATE, 10) || 9600;
const wantedPort = process.argv[2] || process.env.SERIAL_PORT || '';

const stamp = () => new Date().toLocaleTimeString('en-IN');
const log = (msg) => console.log(`[${stamp()}] ${msg}`);

const processor = createProcessor({
  apiBase: API_BASE,
  deviceKey: process.env.DEVICE_KEY || '',
  drainId: process.env.DRAIN_ID || '',
  postEveryMs: parseInt(process.env.POST_EVERY_MS, 10) || 2000,
  log,
});

async function pickPort() {
  if (wantedPort) return wantedPort;
  let ports = [];
  try { ports = await SerialPort.list(); } catch (err) { log(`Could not list serial ports (${err.message}). Set SERIAL_PORT in .env, e.g. SERIAL_PORT=COM8`); return null; }
  const likely = ports.find((p) => /arduino|ftdi|wch|silicon|ch340|1a86|0403|2341/i.test(`${p.manufacturer || ''} ${p.vendorId || ''}`));
  const chosen = likely || ports[0];
  if (!chosen) return null;
  log(`Auto-selected ${chosen.path}${chosen.manufacturer ? ` (${chosen.manufacturer})` : ''}. Set SERIAL_PORT in .env to choose another.`);
  return chosen.path;
}

let retryTimer = null;
const retry = (ms = 3000) => { clearTimeout(retryTimer); retryTimer = setTimeout(start, ms); };

async function start() {
  const path = await pickPort();
  if (!path) {
    log('No serial ports found. Plug in the Arduino…');
    return retry();
  }

  const port = new SerialPort({ path, baudRate: BAUD, autoOpen: false });
  const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
  parser.on('data', (line) => processor.handleLine(line));

  port.on('close', () => { log(`Port ${path} closed. Reconnecting…`); retry(); });
  port.on('error', (err) => log(`Serial error: ${err.message}`));

  port.open((err) => {
    if (err) {
      const busy = /access denied|busy|locked|resource/i.test(err.message);
      log(`Could not open ${path}: ${err.message}${busy ? '  → Close the Arduino IDE Serial Monitor (and any other app using this port).' : ''}`);
      return retry(4000);
    }
    log(`✔ Listening on ${path} @ ${BAUD} baud → sending to ${API_BASE}`);
  });
}

// Heartbeat so you can see it's alive even when nothing arrives
setInterval(() => {
  const s = processor.stats;
  log(`… heard ${s.lines} lines · ${s.parsed} valid · ${s.saved} saved · ${s.failed} failed`);
}, 30000);

log('SheharSetu Arduino bridge starting…');
start();
