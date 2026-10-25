import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { MissionBriefing } from '@mars-explorer/shared';
import { formatHours, MARS24_URL, RAD_SOURCE_URL } from '@mars-explorer/shared';
import type { FieldGuide } from './briefings.service';

@Injectable()
export class BriefingPdfService {
  render(briefing: MissionBriefing, guide?: FieldGuide): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.font('Helvetica-Bold').fontSize(10).text(guide ? 'MARS EXPLORER / SURVIVAL FIELD GUIDE' : 'MARS EXPLORER / FIELD SYSTEMS');
      doc.moveDown().fontSize(22).text(briefing.title);
      doc.moveDown().font('Helvetica').fontSize(10).text(`Distance: ${briefing.distanceKm.toFixed(2)} km    Waypoints: ${briefing.explorationPoints}`);
      doc.text(`Earth–Mars light time (one-way): ${briefing.lightMinutes.toFixed(1)} min · ${briefing.lightAu.toFixed(4)} AU (JPL approx.)`);
      const section = (title: string, lines: string[]) => {
        doc.moveDown().font('Helvetica-Bold').fontSize(12).text(title);
        doc.font('Helvetica').fontSize(10);
        // Standard PDF fonts (WinAnsi) have no arrow or minus sign glyphs.
        for (const line of lines) doc.text(`• ${line.replace(/→/g, '->').replace(/−/g, '-')}`, { indent: 12, paragraphGap: 4 });
      };
      if (guide) {
        const g = guide, f = (x: number, d = 2) => x.toFixed(d);
        section('Can we walk? / NON-CERTIFYING', [
          `EVA verdict: ${g.eva.status}. Walk out ${f(g.eva.outboundH)} h + back ${f(g.eva.returnH)} h = ${f(g.eva.totalH)} h of ${f(g.eva.usableH, 1)} h usable suit time (8 h suit, 25% reserve). Profile: ${g.evaProfile}; steepest grade ${f(g.eva.steepestGradePct, 1)}%.`,
          `Radiation on the walk: ${f(g.eva.doseMsv, 3)} mSv at the Curiosity RAD surface rate of 0.67 mSv/day (Hassler et al. 2014) — ${RAD_SOURCE_URL}`,
          'Model: 2 km/h suited speed on flat ground with a Tobler-shaped slope penalty. An assumption, not a suit specification.',
        ]);
        section('Sun and season at the start point (NASA Mars24)', [
          `At generation (${g.generatedUtc.slice(0, 16)} UTC): local true solar time ${formatHours(g.time.ltst)}, Mars Sol Date ${f(g.time.msd)}, solar longitude Ls ${f(g.time.ls, 1)}°.`,
          g.daylight ? `Daylight ${formatHours(g.daylight.sunrise)}–${formatHours(g.daylight.sunset)} LTST (${f(g.daylight.hours, 1)} h). ${g.eva.fitsDaylight ? 'The round trip fits in one day of sunlight.' : 'The round trip is longer than the daylight: plan a night stop or shorten it.'}` : 'No sunrise or sunset at this latitude and season.',
          g.dustSeason ? 'Dust-storm season (Ls 180–330): expect lower sunlight and visibility. Climatology flag, not a forecast.' : 'Outside the main dust-storm season (Ls 180–330). Climatology flag, not a forecast.',
          `Algorithm: ${MARS24_URL}`,
        ]);
        section('Talking to Earth', [
          ...g.blackouts.map((w) => `Solar conjunction blackout ${w.start} → ${w.end} (closest ${w.minDate}, ${f(w.minDeg)}° from the Sun). No commands from Earth.`),
          'Light time and blackout windows from JPL approximate Keplerian elements (https://ssd.jpl.nasa.gov/planets/approx_pos.html). NON-CERTIFYING.',
        ]);
        section('Habitat candidates nearby (suitability score, NON-CERTIFYING)', g.sites.map((s, i) => `${i + 1}. ${f(s.lat, 4)}°N ${f(s.lon, 4)}°E · score ${Math.round(s.score)}/100 · slope ${f(s.slopeDeg, 1)}° · ${f(s.targetKm)} km to a science target`));
        section('Landmarks: official names (IAU/USGS Gazetteer)', g.features.length ? g.features.map((x) => `${x.name} (${x.type}) · ${x.distanceKm} km`) : ['Gazetteer unavailable offline.']);
        section('Landmarks: NASA hardware on Mars', g.hardware.map((h) => `${h.name} · ${h.status} · ${f(h.km, 1)} km from the start (${h.basis}) · ${h.sourceUrl}`));
      }
      section('Scientific objectives', briefing.scientificObjectives);
      section('Traverse Risk Index / NON-CERTIFYING', [`${briefing.riskIndex.total}/100 · ${briefing.riskIndex.method}`, ...briefing.riskIndex.components.map((item) => `${item.label}: ${item.score} · ${item.formula} · ${item.source}`)]);
      section('Terrain considerations', briefing.terrainConsiderations);
      section('Nearby science context', briefing.relevantObservations.length ? briefing.relevantObservations : ['No verified nearby science point.']);
      section('Methods', briefing.methods);
      section('Sources', briefing.citations.map((citation) => `${citation.title} — ${citation.url}`));
      doc.moveDown().fontSize(8).text('Planning context only. DTM sampling and application risk weights are non-certifying and not operational guidance. Plan as if Earth cannot answer in real time.');
      doc.end();
    });
  }

  /** 45-minute classroom worksheet (Challenge 11 survival map). */
  classroomWorksheet(lang: 'en' | 'bn' = 'en'): Promise<Buffer> {
    const en = {
      title: 'Classroom Survival Pack · Jezero Marswalk',
      steps: [
        'Open Explore and load Classroom Mode (published PLACES sols).',
        'Read the Traverse Risk Index components and open each NASA source link.',
        'Scrub the sol slider and inspect Mars 2020 raw images for that sol.',
        'Compare your sketch with Perseverance’s published track (Evidence Cockpit).',
        'Export GeoJSON and generate a briefing PDF with the Methods appendix.',
        'Discuss: why is this NON-CERTIFYING? Why keep EONET off the Mars map?',
      ],
      quiz: [
        'What product supplies rover localizations?',
        'What grid spacing does the app DEM use, and why can it miss local hazards?',
        'Name one Earth-only NASA product in Mars Explorer.',
      ],
      footer: 'Research aid for classrooms. Not flight or EVA guidance. Binary Explorers · NASA Space Apps.',
    };
    const bn = {
      title: 'শ্রেণিকক্ষ সারভাইভাল প্যাক · জেজারো মার্সওয়াক',
      steps: [
        'Explore খুলে Classroom Mode চালান (প্রকাশিত PLACES sol)।',
        'Traverse Risk Index-এর প্রতিটি উপাদান ও NASA সোর্স লিংক পড়ুন।',
        'Sol স্লাইডার সরিয়ে সেই sol-এর Mars 2020 raw ছবি দেখুন।',
        'Evidence Cockpit-এ আপনার রুট ও Perseverance ট্র্যাক তুলনা করুন।',
        'GeoJSON এক্সপোর্ট করুন এবং Methodsসহ briefing PDF নিন।',
        'আলোচনা: কেন NON-CERTIFYING? কেন EONET মঙ্গল মানচিত্রে আসে না?',
      ],
      quiz: [
        'রোভার অবস্থানের উৎস কোন পণ্য?',
        'অ্যাপ DEM-এর গ্রিড স্পেসিং কত এবং কেন স্থানীয় ঝুঁকি মিস হতে পারে?',
        'Mars Explorer-এ একটি Earth-only NASA পণ্যের নাম লিখুন।',
      ],
      footer: 'শ্রেণিকক্ষ গবেষণা সহায়ক। ফ্লাইট/EVA নির্দেশনা নয়। Binary Explorers · NASA Space Apps.',
    };
    const copy = lang === 'bn' ? bn : en;
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.font('Helvetica-Bold').fontSize(10).text('MARS EXPLORER / CLASSROOM');
      doc.moveDown().fontSize(18).text(copy.title);
      doc.moveDown().font('Helvetica').fontSize(10).text('45-minute lesson · Challenge 11 Martian Map · honest NASA data limits.');
      doc.moveDown().font('Helvetica-Bold').fontSize(12).text(lang === 'bn' ? 'ধাপ' : 'Steps');
      doc.font('Helvetica').fontSize(10);
      copy.steps.forEach((line, i) => doc.text(`${i + 1}. ${line}`, { paragraphGap: 4 }));
      doc.moveDown().font('Helvetica-Bold').fontSize(12).text(lang === 'bn' ? 'কুইজ' : 'Quiz');
      doc.font('Helvetica').fontSize(10);
      copy.quiz.forEach((line, i) => doc.text(`${i + 1}. ${line}`, { paragraphGap: 10 }));
      doc.moveDown().fontSize(8).text(copy.footer);
      doc.end();
    });
  }
}
