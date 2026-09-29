import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import type { MissionBriefing } from '@mars-explorer/shared';

@Injectable()
export class BriefingPdfService {
  render(briefing: MissionBriefing): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 48, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('error', reject);
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.font('Helvetica-Bold').fontSize(10).text('MARS EXPLORER / FIELD SYSTEMS');
      doc.moveDown().fontSize(22).text(briefing.title);
      doc.moveDown().font('Helvetica').fontSize(10).text(`Distance: ${briefing.distanceKm.toFixed(2)} km    Waypoints: ${briefing.explorationPoints}`);
      const section = (title: string, lines: string[]) => {
        doc.moveDown().font('Helvetica-Bold').fontSize(12).text(title);
        doc.font('Helvetica').fontSize(10);
        for (const line of lines) doc.text(`• ${line}`, { indent: 12, paragraphGap: 4 });
      };
      section('Scientific objectives', briefing.scientificObjectives);
      section('Terrain considerations / heuristic', briefing.terrainConsiderations);
      section('Nearby science context', briefing.relevantObservations.length ? briefing.relevantObservations : ['No nearby seeded point.']);
      section('Sources', briefing.citations.map((citation) => `${citation.title} — ${citation.url}`));
      doc.moveDown().fontSize(8).text('Planning context only. Approximate markers and heuristic terrain scores are non-certifying and not operational guidance.');
      doc.end();
    });
  }
}
