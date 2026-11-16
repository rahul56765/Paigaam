// Test-only: one SQLite connection per worker, released at a shared barrier.
import { parentPort, workerData } from 'node:worker_threads';
import { DatabaseSync } from 'node:sqlite';
import { D1 } from './d1-shim.mjs';
import { enforceRequestRate } from '../src/request-rate.mjs';
const db = Object.create(D1.prototype);
db.raw = new DatabaseSync(workerData.dbPath);
db.raw.exec('PRAGMA busy_timeout=15000;');
const gate = new Int32Array(workerData.gate);
parentPort.postMessage({ type: 'ready' });
Atomics.wait(gate, 0, 0);
try {
  const request = new Request('https://preview.example/', { headers: { 'CF-Connecting-IP': workerData.ip } });
  await enforceRequestRate(request, { DB: db, RATE_LIMIT_HMAC_KEY: workerData.key }, workerData.action, workerData.nowMs);
  parentPort.postMessage({ type: 'result', accepted: true });
} catch (error) {
  if (error.code === 'rate_limited') parentPort.postMessage({ type: 'result', accepted: false });
  else parentPort.postMessage({ type: 'failure', message: error.message });
} finally { db.raw.close(); }
