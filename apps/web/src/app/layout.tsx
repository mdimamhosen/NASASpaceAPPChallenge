import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mars Explorer | Surface Intelligence',
  description: 'Plan an evidence-led Marswalk at Jezero Crater with NASA surface data.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
