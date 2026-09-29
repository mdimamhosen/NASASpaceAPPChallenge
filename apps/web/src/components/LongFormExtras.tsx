import { extraContent } from '@/content/extra';
import { type SourceId } from '@/content/theater';
import { CTANext, QuoteBand, SectionBlock, SourceRegister } from './TheaterPrimitives';
export default function LongFormExtras({ page }: { page: string }) {
  const content = extraContent[page];
  if (!content) return null;
  const ids = [...new Set(content.sections.flatMap((section) => section.sourceIds ?? []))] as SourceId[];
  return <><div className="dossier-body">{content.sections.map((section, i) => <SectionBlock key={section.id} section={section} number={i + 2} />)}</div><QuoteBand quote={content.quote} />{ids.length > 0 && <SourceRegister ids={ids} />}<CTANext href={content.next} label={content.nextLabel} /></>;
}
