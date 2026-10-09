/**
 * 124 BPM electronic bed + timed SFX for the Nabz Farda reel.
 * Peak aimed near -1.5 dBFS.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/audio");
fs.mkdirSync(outDir, { recursive: true });

const SAMPLE_RATE = 44100;
const DURATION = 22;
const BPM = 124;
const BEAT = 60 / BPM;
const N = Math.floor(SAMPLE_RATE * DURATION);

const clamp = (v, a = -1, b = 1) => Math.max(a, Math.min(b, v));

function env(t, a, d, s, r, hold) {
  if (t < 0) return 0;
  if (t < a) return t / a;
  if (t < a + d) return 1 - ((1 - s) * (t - a)) / d;
  if (t < a + d + hold) return s;
  const rel = t - a - d - hold;
  if (rel < r) return s * (1 - rel / r);
  return 0;
}

function noise() {
  return Math.random() * 2 - 1;
}

const buf = new Float32Array(N);

// Kick + hat bed on 124 BPM
for (let i = 0; i < N; i++) {
  const t = i / SAMPLE_RATE;
  const beatPos = (t % BEAT) / BEAT;
  const bar = Math.floor(t / BEAT) % 4;

  // sub kick
  const kickEnv = env(beatPos * BEAT, 0.002, 0.05, 0.2, 0.12, 0);
  const kickFreq = 55 + (1 - kickEnv) * 80;
  const kick = Math.sin(2 * Math.PI * kickFreq * t) * kickEnv * (bar === 0 ? 0.55 : 0.38);

  // closed hat on offbeats
  const hatOn = beatPos > 0.48 && beatPos < 0.62;
  const hat = hatOn ? noise() * env((beatPos - 0.48) * BEAT, 0.001, 0.02, 0.1, 0.03, 0) * 0.12 : 0;

  // bass pulse
  const bass = Math.sin(2 * Math.PI * 55 * t) * 0.08 * (0.6 + 0.4 * Math.sin(2 * Math.PI * (BPM / 60) * t));

  // arp lead
  const scale = [0, 3, 5, 7, 10, 12];
  const note = scale[Math.floor(t / BEAT) % scale.length];
  const freq = 220 * Math.pow(2, note / 12);
  const arpGate = env(beatPos * BEAT, 0.01, 0.08, 0.25, 0.15, 0.05);
  const arp = Math.sin(2 * Math.PI * freq * t) * arpGate * 0.09;

  // pad
  const pad =
    (Math.sin(2 * Math.PI * 110 * t) * 0.03 + Math.sin(2 * Math.PI * 164.8 * t) * 0.02) *
    (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.08 * t));

  buf[i] = kick + hat + bass + arp + pad;
}

// Timed SFX helpers
function addWhoosh(at, len = 0.28, amp = 0.35) {
  const start = Math.floor(at * SAMPLE_RATE);
  const samples = Math.floor(len * SAMPLE_RATE);
  for (let i = 0; i < samples; i++) {
    const u = i / samples;
    const e = Math.sin(Math.PI * u);
    const n = noise() * e * amp * (0.4 + 0.6 * u);
    const tone = Math.sin(2 * Math.PI * (400 + u * 1200) * (i / SAMPLE_RATE)) * e * amp * 0.25;
    const idx = start + i;
    if (idx < N) buf[idx] += n + tone;
  }
}

function addGlitch(at, len = 0.18, amp = 0.4) {
  const start = Math.floor(at * SAMPLE_RATE);
  const samples = Math.floor(len * SAMPLE_RATE);
  for (let i = 0; i < samples; i++) {
    const u = i / samples;
    const e = 1 - u;
    const bit = ((Math.floor(i / 40) % 2) * 2 - 1) * e * amp * 0.35;
    const n = noise() * e * amp * 0.25;
    const idx = start + i;
    if (idx < N) buf[idx] += bit + n;
  }
}

function addTick(at, amp = 0.28) {
  const start = Math.floor(at * SAMPLE_RATE);
  for (let i = 0; i < Math.floor(0.04 * SAMPLE_RATE); i++) {
    const e = Math.exp(-i / (SAMPLE_RATE * 0.012));
    const idx = start + i;
    if (idx < N) buf[idx] += Math.sin(2 * Math.PI * 1800 * (i / SAMPLE_RATE)) * e * amp;
  }
}

function addPop(at, amp = 0.32) {
  const start = Math.floor(at * SAMPLE_RATE);
  for (let i = 0; i < Math.floor(0.12 * SAMPLE_RATE); i++) {
    const e = Math.exp(-i / (SAMPLE_RATE * 0.04));
    const idx = start + i;
    if (idx < N)
      buf[idx] +=
        Math.sin(2 * Math.PI * (520 + e * 200) * (i / SAMPLE_RATE)) * e * amp;
  }
}

function addThump(at, amp = 0.45) {
  const start = Math.floor(at * SAMPLE_RATE);
  for (let i = 0; i < Math.floor(0.2 * SAMPLE_RATE); i++) {
    const e = Math.exp(-i / (SAMPLE_RATE * 0.07));
    const idx = start + i;
    if (idx < N)
      buf[idx] += Math.sin(2 * Math.PI * (90 + e * 40) * (i / SAMPLE_RATE)) * e * amp;
  }
}

function addClick(at, amp = 0.3) {
  const start = Math.floor(at * SAMPLE_RATE);
  for (let i = 0; i < Math.floor(0.03 * SAMPLE_RATE); i++) {
    const e = Math.exp(-i / (SAMPLE_RATE * 0.008));
    const idx = start + i;
    if (idx < N) buf[idx] += noise() * e * amp;
  }
}

// Event map aligned to acts / beats
addWhoosh(0.2);
addGlitch(2.7);
addWhoosh(3.05);
addTick(3.8);
addTick(5.0);
addTick(6.4);
addTick(8.0);
addThump(8.6);
addWhoosh(10.05);
addPop(11.2);
addPop(12.0);
addWhoosh(14.05);
addPop(14.4);
addWhoosh(18.1);
addPop(18.5);
addClick(20.45);
addThump(20.5);

// Normalize to ~ -1.5 dBFS peak
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(buf[i]));
const target = Math.pow(10, -1.5 / 20); // ≈ 0.841
const gain = peak > 0 ? target / peak : 1;
for (let i = 0; i < N; i++) buf[i] = clamp(buf[i] * gain);

function floatTo16BitPCM(float32) {
  const out = Buffer.alloc(float32.length * 2);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out.writeInt16LE((s * 0x7fff) | 0, i * 2);
  }
  return out;
}

function writeWav(filePath, samples) {
  const data = floatTo16BitPCM(samples);
  const header = Buffer.alloc(44);
  const byteRate = SAMPLE_RATE * 2;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(filePath, Buffer.concat([header, data]));
}

const outPath = path.join(outDir, "reel-mix.wav");
writeWav(outPath, buf);
console.log(`Wrote ${outPath} (${DURATION}s @ ${BPM} BPM, peak ≈ -1.5 dBFS)`);
