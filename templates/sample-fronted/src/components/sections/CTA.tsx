import { ArrowUpRight, Sparkles } from 'lucide-react';
import { Button } from '../common/Button';
import { Container } from '../common/Container';

export function CTA() {
  return <section className="py-20 sm:py-28"><Container><div className="relative overflow-hidden rounded-[2rem] bg-ink px-7 py-12 text-center text-white sm:px-12 sm:py-16 lg:py-20">
    <div className="absolute -right-16 -top-40 size-96 rounded-full bg-[var(--color-primary)]/40 blur-3xl" /><div className="absolute -bottom-48 -left-20 size-80 rounded-full bg-[#b5c6b2]/20 blur-3xl" />
    <div className="relative mx-auto max-w-2xl"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white/10 text-[#c9d7c7]"><Sparkles size={21} /></span><h2 className="mt-6 font-display text-3xl font-medium tracking-tight sm:text-5xl">فصل بعدی از همین‌جا آغاز می‌شود.</h2><p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-white/65 sm:text-base sm:leading-7">ایده‌ای در ذهن دارید؟ دوست داریم دربارهٔ مسیر پیش رویتان بشنویم.</p><Button to="/contact" variant="secondary" className="mt-8">با ما تماس بگیرید <ArrowUpRight size={16} /></Button></div>
  </div></Container></section>;
}
