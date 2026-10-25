'use client';
import type { UiCopyKey } from '@/lib/ui-copy';
import { uiText } from '@/lib/ui-copy';
import { useUiLanguage } from '@/lib/use-ui-language';

type CopyTag = 'span' | 'p' | 'h1' | 'h2' | 'small';
export default function LocalizedCopy({ id, as: Tag = 'span', className }: { id: UiCopyKey; as?: CopyTag; className?: string }) {
  const { language } = useUiLanguage();
  return <Tag className={className}>{uiText(id, language)}</Tag>;
}
