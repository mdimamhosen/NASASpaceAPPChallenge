// Run: node packages/shared/src/acoustics.check.ts
import assert from 'node:assert/strict';
import { marsDelaySeconds, speedOfSound } from './acoustics.ts';

const near = (a: number, b: number, tol: number, label: string) => assert.ok(Math.abs(a - b) <= tol, `${label}: ${a} vs ${b}`);
near(speedOfSound(293.15, 1.4, 0.028965), 343.2, 0.5, 'Earth air at 20 °C');
near(speedOfSound(240), 240, 10, 'Mars CO₂ near 240 K vs SuperCam ~240 m/s');
near(marsDelaySeconds(240, 100), 1, 1e-12, 'low-frequency delay');
assert.ok(marsDelaySeconds(240, 1000) < 1, 'high pitch arrives first');
console.log('acoustics checks passed', speedOfSound(240).toFixed(1), 'm/s');
