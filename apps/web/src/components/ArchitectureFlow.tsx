export default function ArchitectureFlow() {
  return <section className="architecture-flow" aria-labelledby="architecture-flow-title">
    <div><span className="eyebrow">SYSTEM MAP / STATIC REFERENCE</span><h2 id="architecture-flow-title">A claim travels through explicit boundaries.</h2><p>Planetary imagery, Earth events, local evidence, and generated briefings each keep their provenance.</p></div>
    <div className="flow-grid" role="list">
      <article role="listitem"><small>01 / VIEW</small><strong>apps/web</strong><span>Next.js console · Trek map · EONET theater</span></article>
      <article role="listitem"><small>02 / CONTRACT</small><strong>packages/shared</strong><span>Typed route, evidence, and briefing DTOs</span></article>
      <article role="listitem"><small>03 / SERVICES</small><strong>apps/api</strong><span>Regions · routes · rag · agent · briefings · ops</span></article>
      <article role="listitem"><small>04 / EVIDENCE</small><strong>data/ + NASA</strong><span>Jezero seeds · source notes · Trek · Earth EONET</span></article>
    </div>
    <p className="flow-note">MARS / TREK → ROUTE + BRIEFING &nbsp; | &nbsp; EARTH / EONET → EARTH CONTEXT ONLY</p>
  </section>;
}
