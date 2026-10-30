// The pure bits of "keep playing with the screen off" (docs/BACKGROUND.md): a quiet sound file the page
// loops so Android treats it as a music player, and the test for Android. No page code here, so a script can check it.

/** Android phones only (Paul's phone); everything else keeps playing as before. */
export function isAndroidAgent(userAgent: string): boolean {
  return /Android/i.test(userAgent);
}

const RATE = 8000;

/**
 * A mono 16-bit WAV of near-silence: every 16th sample is 1 out of 32768 (about -90 dB, nobody can hear it).
 * Pure zeros can be treated as "not playing anything" by the phone; this is not. Over 5 s long, so Android
 * shows the lock-screen player for it.
 */
export function silentWav(seconds = 10): Uint8Array {
  const n = RATE * seconds;
  const out = new Uint8Array(44 + n * 2);
  const v = new DataView(out.buffer);
  const tag = (at: number, s: string) => { for (let i = 0; i < 4; i++) out[at + i] = s.charCodeAt(i); };
  tag(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); tag(8, 'WAVE');
  tag(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  tag(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i += 16) v.setInt16(44 + i * 2, 1, true);
  return out;
}
