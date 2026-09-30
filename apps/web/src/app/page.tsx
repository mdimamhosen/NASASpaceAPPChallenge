import Link from 'next/link';
import EarthEventsFeed from '@/components/landing/EarthEventsFeed';
import SceneStage from '@/components/scenes/SceneStage';
import MissionNav from '@/components/MissionNav';

export default function Home() {
  return (
    <>
      <MissionNav />
      <main className="landing">
        <div className="landing-image" role="img" aria-label="Rocky terrain on Mars photographed by NASA's Perseverance rover" />
        <header className="landing-nav">
          <span className="brand-mark">M / E</span>
          <span>
            FIELD SYSTEMS <i>·</i> 01
          </span>
          <a href="https://science.nasa.gov/mission/mars-2020-perseverance/" target="_blank" rel="noreferrer">
            MISSION REFERENCE ↗
          </a>
        </header>
        <section className="landing-hero">
          <SceneStage kind="mars-hero" className="landing-scene" permanent />
          <div className="landing-copy">
            <p className="eyebrow">
              SURFACE INTELLIGENCE PLATFORM <span>— MARS / JEZERO</span>
            </p>
            <h1>
              MARS
              <br />
              <span>EXPLORER</span>
            </h1>
            <div className="landing-bottom">
              <p>
                Trace a route through ancient terrain.
                <br />
                Carry the science with you.
              </p>
              <div className="landing-actions">
                <Link href="/explore" className="enter-button">
                  ENTER MISSION CONSOLE <span>↗</span>
                </Link>
                <Link href="/survival" className="tour-button">
                  START 4-MIN TOUR <span>↗</span>
                </Link>
              </div>
            </div>
          </div>
        </section>
        <section className="landing-workflow" aria-label="How Mars Explorer works">
          <div>
            <span className="eyebrow">THE FIELD METHOD / 01–03</span>
            <h2>From a surface question to an accountable briefing.</h2>
          </div>
          <div className="landing-workflow-steps">
            <article>
              <small>01 / OBSERVE</small>
              <h3>Read Jezero</h3>
              <p>Use NASA Mars Trek imagery and source linked regional context to frame a science question.</p>
            </article>
            <article>
              <small>02 / TEST</small>
              <h3>Sketch a route</h3>
              <p>Draw a hypothetical Marswalk and inspect distance, nearby points, and a non-certifying terrain score.</p>
            </article>
            <article>
              <small>03 / EXPLAIN</small>
              <h3>Carry evidence</h3>
              <p>Ask the local corpus, review citations, and download a deterministic mission briefing.</p>
            </article>
          </div>
          <Link href="/survival">START THE FOUR-MINUTE TOUR ↗</Link>
        </section>
        <EarthEventsFeed />
        <footer className="landing-footer">
          <span>18°26′N&nbsp;&nbsp; 77°27′E</span>
          <span>PERSEVERANCE / JEZERO CRATER</span>
          <span>NASA MARS TREK + EONET</span>
        </footer>
        <span className="photo-credit">NASA / JPL-Caltech · PIA24642</span>
      </main>
    </>
  );
}
