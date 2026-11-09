import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { siteConfig } from '../../config/site';
import { Container } from '../common/Container';
import { Button } from '../common/Button';

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/90 backdrop-blur-lg">
      <Container className="flex h-[76px] items-center justify-between">
        <Link to="/" className="flex items-center gap-3 font-display text-lg font-semibold tracking-tight" onClick={() => setMenuOpen(false)}>
          <span className="grid size-9 place-items-center rounded-xl bg-[var(--color-primary)] text-sm text-white">{siteConfig.logoText.slice(0, 1)}</span>
          {siteConfig.logoText}
        </Link>
        <nav className="hidden items-center gap-8 md:flex" aria-label="پیمایش اصلی">
          {siteConfig.navigation.map((item) => (
            <NavLink key={item.href} to={item.href} className={({ isActive }) => `text-sm transition hover:text-[var(--color-primary)] ${isActive ? 'font-semibold text-ink' : 'text-muted'}`}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="hidden md:block"><Button to="/contact" className="min-h-10 px-5 py-2">گفت‌وگو کنیم <ArrowUpRight size={15} /></Button></div>
        <button className="grid size-11 place-items-center rounded-full border border-line text-ink md:hidden" aria-label={menuOpen ? 'بستن منو' : 'باز کردن منو'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </Container>
      {menuOpen && <nav className="border-t border-line bg-paper px-5 py-4 md:hidden" aria-label="پیمایش موبایل">
        {siteConfig.navigation.map((item) => <NavLink key={item.href} to={item.href} onClick={() => setMenuOpen(false)} className={({ isActive }) => `block rounded-xl px-4 py-3 text-sm ${isActive ? 'bg-sand font-semibold text-ink' : 'text-muted'}`}>{item.label}</NavLink>)}
        <Button to="/contact" className="mt-3 w-full" onClick={() => setMenuOpen(false)}>گفت‌وگو کنیم <ArrowUpRight size={15} /></Button>
      </nav>}
    </header>
  );
}
