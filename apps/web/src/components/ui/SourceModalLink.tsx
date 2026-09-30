'use client';
import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import DetailModal from './DetailModal';
export default function SourceModalLink({ title, url, context = 'SOURCE REGISTER', className = '' }: { title: string; url: string; context?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return <><button className={className} onClick={() => setOpen(true)}><span>{title}</span><ArrowUpRight size={14} /></button>{open && <DetailModal title={title} eyebrow={context} summary="This source supports the surrounding factual context. Open the publisher record for its full data, caption, and limitations; local route overlays remain demonstrations." sources={[{ title, url }]} onClose={() => setOpen(false)} />}</>;
}
