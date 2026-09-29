import Image from 'next/image';
const images = [
  { file: '/gallery/kodiak.jpg', title: 'Kodiak and scarps / orbital reference', credit: 'NASA/JPL-Caltech/University of Arizona/USGS', href: 'https://science.nasa.gov/photojournal/jezero-craters-kodiak-and-scarps/' },
  { file: '/gallery/delta.jpg', title: 'Jezero delta / Mars Odyssey', credit: 'NASA/JPL-Caltech/ASU', href: 'https://science.nasa.gov/photojournal/jezero-crater-delta-2/' },
  { file: '/gallery/vista.jpg', title: 'Crater floor vista / Perseverance', credit: 'NASA/JPL-Caltech', href: 'https://science.nasa.gov/photojournal/the-end-of-one-drive-by-perseverance-on-the-floor-of-jezero-crater/' },
  { file: '/gallery/boulders.jpg', title: 'Jezero boulder field / Perseverance', credit: 'NASA/JPL-Caltech/ASU/MSSS', href: 'https://science.nasa.gov/photojournal/perseverance-views-jezero-boulder-field/' },
];
export default function GalleryGrid() { return <section className="gallery-grid" aria-label="NASA Jezero image references"><div className="gallery-grid-head"><span className="eyebrow">NASA IMAGE REGISTER / 04 VIEWS</span><h2>Look closer, then open the full caption.</h2></div><div className="gallery-grid-items">{images.map((item, i) => <a key={item.file} href={item.href} target="_blank" rel="noreferrer"><div className="gallery-frame"><Image src={item.file} alt={item.title} fill sizes="(max-width: 700px) 100vw, 50vw" /></div><div><small>{String(i+1).padStart(2,'0')} / IMAGE REFERENCE</small><h3>{item.title}</h3><p>CREDIT / {item.credit}</p><span>OPEN NASA SOURCE ↗</span></div></a>)}</div></section>; }
