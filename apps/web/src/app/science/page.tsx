import LongFormExtras from '@/components/LongFormExtras';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import MissionNav from '@/components/MissionNav';

const sources = [
  ['NASA Mars Trek WMTS', 'Global MGS MOLA color shaded relief and Viking mosaic tiles.', 'https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars', 'Measured orbital products; map display and resolution depend on selected layer and zoom.'],
  ['NASA Perseverance mission', 'Mission objectives, Jezero context, and sample caching program.', 'https://science.nasa.gov/mission/mars-2020-perseverance/', 'Mission facts are linked to the NASA mission reference.'],
  ['NASA HiRISE Jezero view', 'Orbital image context for Jezero delta features and scarps.', 'https://science.nasa.gov/photojournal/jezero-craters-kodiak-and-scarps/', 'Outlined areas are curated visual context regions, not precision observation boundaries.'],
  ['USGS HiRISE terrain products', 'HiRISE-derived digital terrain models and orthoimage products for Mars 2020 operations.', 'https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_hirise_dtm_mosaic', 'Check the linked catalog for research-grade product footprints and source imagery.'],
  ['NASA EONET v3', 'Open natural event metadata used on the Earth landing feed.', 'https://eonet.gsfc.nasa.gov/docs/v3', 'Earth-only data. EONET geometries are never shown on Mars Trek.'],
];

export default function SciencePage() {
  return <main className="science-page min-h-screen bg-mission-bg text-mission-fg"><MissionNav active="/science" />
    <header><Link href="/explore">RETURN TO MISSION CONSOLE</Link><span>DATA ASSURANCE / 01</span></header>
    <section className="science-intro"><p className="eyebrow">MARS EXPLORER / METHODS</p><h1>Science & data verification</h1><p>Source links, coordinate provenance, and the limits of each planning layer.</p></section>
    <section className="science-section"><h2>Data register</h2><div className="source-table">{sources.map(([title, description, url, note]) => <article key={title}><div><strong>{title}</strong><p>{description}</p></div><p>{note}</p><a href={url} target="_blank" rel="noreferrer">OPEN SOURCE <ArrowUpRight size={13} /></a></article>)}</div></section>
    <section className="science-section"><h2>Coordinate and score limits</h2><div className="method-grid"><article><strong>Jezero science annotations</strong><p>Seed POIs are approximate map annotations from this demo's curated dataset. Each POI links to its NASA reference. They are not validated rover positions or navigation waypoints.</p></article><article><strong>HiRISE context areas</strong><p>The map outlines are schematic regional context boxes around Jezero. They communicate where orbital context is useful; they are not exact camera image footprints.</p></article><article><strong>Route and terrain watch score</strong><p>Route distance uses spherical great-circle segments with Mars radius 3,390 km. Risk is a demonstration heuristic using seeded watch zones and route complexity. It is not operational guidance.</p></article><article><strong>EARTH / EONET</strong><p>EONET is an Earth natural event feed for the landing narrative. Event locations remain on the Earth mini-map and are never interpreted as Martian hazards.</p></article></div></section>
    <footer><Link href="/">MARS EXPLORER</Link><span>RESEARCH AID · NOT FOR OPERATIONAL NAVIGATION</span></footer>
  <LongFormExtras page="science" /></main>;
}
