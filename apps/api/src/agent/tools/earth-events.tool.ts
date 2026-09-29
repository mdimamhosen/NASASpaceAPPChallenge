import type { EonetService } from '../../eonet/eonet.service';

export async function getEarthNaturalEvents(
  eonet: EonetService,
  input: { category?: string; days?: number; limit?: number } = {},
) {
  const summaries = await eonet.listEarthEventSummaries({
    category: input.category,
    days: input.days !== undefined ? String(input.days) : undefined,
    limit: input.limit !== undefined ? String(input.limit) : '8',
    status: 'open',
  });
  return {
    label: 'EARTH' as const,
    provider: 'EONET' as const,
    note: 'These are Earth natural events from NASA EONET. They are not Mars surface hazards.',
    events: summaries,
  };
}
