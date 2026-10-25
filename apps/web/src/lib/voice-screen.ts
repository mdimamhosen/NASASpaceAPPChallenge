/** Short plain-text summary of what is on screen, for "describe this screen" (spoken, or sent to the Live model). */
export function describeScreen(): string {
  if (typeof document === 'undefined') return '';
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < window.innerHeight && r.width > 0; };
  const h1 = text(document.querySelector('main h1, h1')).replace(/[.!?]+$/, '');
  const headings = [...document.querySelectorAll('main h2, main .theater-section-head span:first-child, main .eyebrow')].filter(visible).map(text).filter(Boolean).slice(0, 5);
  // Key values the app marks up as metrics, statuses and clocks.
  const values = [...document.querySelectorAll('.hud-metric, .sv-grid > div, .cc-clock > div, .sv-status, .pipeline-status > div, [role="status"]')].filter(visible).map(text).filter((t) => t.length < 90).slice(0, 8);
  const page = location.pathname === '/' ? 'home' : location.pathname.slice(1).replace(/\//g, ' ');
  return [`Page: ${page}${h1 ? ` — ${h1}` : ''}.`, headings.length ? `Sections in view: ${headings.join('; ')}.` : '', values.length ? `Values shown: ${values.join('; ')}.` : ''].filter(Boolean).join(' ').slice(0, 900);
}
