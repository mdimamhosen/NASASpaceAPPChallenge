import type { Metadata, Viewport } from 'next';
import ClientChrome from '@/components/ClientChrome';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mars Explorer | Surface Intelligence',
  description: 'Plan an evidence-led Marswalk at Jezero Crater with NASA surface data.',
  appleWebApp: { capable: true, title: 'Mars Explorer', statusBarStyle: 'black-translucent' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
};

export const viewport: Viewport = { themeColor: '#0B0E14' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <ClientChrome />
      </body>
    </html>
  );
}
