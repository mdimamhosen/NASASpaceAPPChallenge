'use client';

import { useState } from 'react';
import { marsDelaySeconds, MAURICE_2022_URL, speedOfSound } from '@mars-explorer/shared';

/** How sound travels on Mars: ideal-gas CO₂ speed vs Earth air, and the two speeds SuperCam's microphone measured. */
export default function SoundOnMars() {
  const [tempK, setTempK] = useState(240);
  const [distance, setDistance] = useState(100);
  const earth = speedOfSound(288, 1.4, 0.028965);
  return (
    <section className="theater-section" aria-label="Sound on Mars">
      <div className="theater-section-head"><span>SCIENCE / SOUND ON MARS</span><span>SUPERCAM MICROPHONE · MAURICE ET AL. 2022</span></div>
      <div className="wx-stats">
        <div><small>MARS CO₂ AT {tempK} K</small><strong>{speedOfSound(tempK).toFixed(0)} m/s</strong><em>IDEAL GAS, γ 1.31</em></div>
        <div><small>EARTH AIR AT 15 °C</small><strong>{earth.toFixed(0)} m/s</strong></div>
        <div><small>{distance} M AWAY · LOW PITCH</small><strong>{marsDelaySeconds(distance, 100).toFixed(2)} s</strong><em>MEASURED ~240 m/s BELOW 240 Hz</em></div>
        <div><small>{distance} M AWAY · HIGH PITCH</small><strong>{marsDelaySeconds(distance, 1000).toFixed(2)} s</strong><em>MEASURED ~250 m/s ABOVE 240 Hz</em></div>
      </div>
      <div className="wx-sols">
        <label>TEMPERATURE {tempK} K <input type="range" min={180} max={290} value={tempK} onChange={(e) => setTempK(Number(e.target.value))} /></label>
        <label>DISTANCE {distance} M <input type="range" min={10} max={1000} step={10} value={distance} onChange={(e) => setDistance(Number(e.target.value))} /></label>
      </div>
      <p className="vd-note">On Mars, high notes outrun low ones: CO₂ molecules relax too slowly to follow low-frequency waves. A voice call between two astronauts 100 m apart would arrive with its treble first. <a href={MAURICE_2022_URL} target="_blank" rel="noreferrer">Maurice et al., Nature 2022 ↗</a></p>
    </section>
  );
}
