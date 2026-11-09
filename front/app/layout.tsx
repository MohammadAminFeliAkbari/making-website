import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Forma — AI Website Builder', description: 'Design and generate your next website with AI.' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
