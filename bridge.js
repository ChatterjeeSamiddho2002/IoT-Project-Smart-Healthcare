/**
 * bridge.js — Serial → WebSocket bridge
 * Reads your Pico/device over USB serial and rebroadcasts
 * every line to all connected WebSocket clients (the dashboard).
 *
 * Usage:
 *   npm install serialport ws
 *   node bridge.js
 *
 * Adjust SERIAL_PATH to match your device:
 *   Windows : 'COM3'  (check Device Manager)
 *   macOS   : '/dev/tty.usbmodem...'  (ls /dev/tty.usb*)
 *   Linux   : '/dev/ttyUSB0' or '/dev/ttyACM0'
 */

const { SerialPort }    = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { WebSocketServer } = require('ws');

// ── CONFIG ────────────────────────────────────────────────────
const SERIAL_PATH = '/dev/ttyUSB0';   // ← change this
const BAUD_RATE   = 9600;
const WS_PORT     = 8765;
// ─────────────────────────────────────────────────────────────

const port = new SerialPort({ path: SERIAL_PATH, baudRate: BAUD_RATE });
const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));
const wss = new WebSocketServer({ port: WS_PORT });

const clients = new Set();

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[ws]  Client connected: ${ip}`);
  clients.add(ws);

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[ws]  Client disconnected: ${ip}`);
  });

  ws.on('error', err => console.error('[ws] Error:', err.message));
});

parser.on('data', line => {
  const trimmed = line.trim();
  if (!trimmed) return;
  console.log(`[serial] ${trimmed}`);

  for (const client of clients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(trimmed);
    }
  }
});

port.on('open',  () => console.log(`[serial] Opened ${SERIAL_PATH} @ ${BAUD_RATE} baud`));
port.on('error', err => console.error('[serial] Error:', err.message));

console.log(`Bridge started — WebSocket listening on ws://localhost:${WS_PORT}`);
console.log(`Waiting for serial device on ${SERIAL_PATH}...`);
