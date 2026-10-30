// The background check: the quiet sound file and the Android test behind "Keep playing with the screen off" (docs/BACKGROUND.md).
// Run: npm run background-check

import { isAndroidAgent, silentWav } from '../src/audio/silence';

let failed = 0;
const ok = (cond: boolean, what: string) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}`); if (!cond) failed++; };

const wav = silentWav();
const v = new DataView(wav.buffer);
const tag = (at: number) => String.fromCharCode(...wav.subarray(at, at + 4));
ok(tag(0) === 'RIFF' && tag(8) === 'WAVE' && tag(12) === 'fmt ' && tag(36) === 'data', 'WAV header tags');
ok(v.getUint32(4, true) === wav.length - 8, 'RIFF size matches the file');
ok(v.getUint32(40, true) === wav.length - 44, 'data size matches the file');
ok(v.getUint16(22, true) === 1 && v.getUint16(34, true) === 16, 'mono, 16-bit');
const seconds = (wav.length - 44) / 2 / v.getUint32(24, true);
ok(seconds > 5, `longer than 5 s (${seconds} s): Android shows its lock-screen player`);
let peak = 0, loud = 0;
for (let i = 44; i < wav.length; i += 2) { const s = Math.abs(v.getInt16(i, true)); peak = Math.max(peak, s); if (s) loud++; }
ok(peak === 1, `quietest possible (peak ${peak} of 32768)`);
ok(loud > 0, 'not pure zeros (the phone can treat that as "not playing")');

ok(isAndroidAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36'), 'Android Chrome is Android');
ok(!isAndroidAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1'), 'iPhone is not');
ok(!isAndroidAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36'), 'desktop Linux is not');

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log('\nall good');
