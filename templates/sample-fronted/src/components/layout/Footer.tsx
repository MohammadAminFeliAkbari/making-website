import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { siteConfig } from '../../config/site';
import { Container } from '../common/Container';

export function Footer() {
  return (
    <footer className="border-t border-line bg-white">
      <Container className="py-12 sm:py-14">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div className="max-w-sm">
            <Link to="/" className="font-display text-xl font-semibold tracking-tight">{siteConfig.logoText}</Link>
            <p className="mt-3 text-sm leading-6 text-muted">{siteConfig.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-16 gap-y-8 sm:grid-cols-3">
            <div><p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">بخش‌ها</p>{siteConfig.navigation.map((item) => <Link className="mb-2 block text-sm text-ink hover:text-[var(--color-primary)]" key={item.href} to={item.href}>{item.label}</Link>)}</div>
            <div><p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">با ما در تماس باشید</p><a dir="ltr" className="text-sm text-ink hover:text-[var(--color-primary)]" href={`mailto:${siteConfig.contact.email}`}>{siteConfig.contact.email}</a></div>
            <div><p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">ما را دنبال کنید</p>{siteConfig.socialLinks.map((item) => <a className="mb-2 flex items-center gap-1 text-sm text-ink hover:text-[var(--color-primary)]" key={item.label} href={item.href} target="_blank" rel="noreferrer">{item.label}<ArrowUpRight size={13} /></a>)}</div>
          </div>
        </div>
        <div className="mt-10 border-t border-line pt-5 text-xs text-muted">© {new Date().getFullYear()} {siteConfig.name}. تمامی حقوق محفوظ است.</div>
      </Container>
    </footer>
  );
}
