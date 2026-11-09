import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { SectionTitle } from '../components/common/SectionTitle';
import { CTA } from '../components/sections/CTA';
import { Features } from '../components/sections/Features';
import { Hero } from '../components/sections/Hero';

export function Home() {
  return <><Hero /><Features /><section className="py-20 sm:py-28"><Container><div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20"><div className="relative min-h-[340px] overflow-hidden rounded-[2rem] bg-[#e4e9e1] sm:min-h-[430px]"><div className="absolute left-[14%] top-[12%] h-[84%] w-[68%] rotate-[-8deg] rounded-[48%] bg-[#becdbb]"/><div className="absolute left-[26%] top-[20%] h-[72%] w-[54%] rotate-[8deg] rounded-[48%] bg-[#8da58b]"/><div className="absolute bottom-7 left-7 rounded-2xl bg-white/75 px-5 py-4 backdrop-blur"><p className="text-xs uppercase tracking-widest text-muted">رویکرد ما</p><p className="mt-1 font-display text-xl">توجه به تمام جزئیات</p></div></div><div><SectionTitle eyebrow="کمی دربارهٔ ما" title="کار خوب با پرسش‌های خوب آغاز می‌شود." description="باور داریم بهترین ایده‌ها از کنجکاوی، توجه و نگاهی متفاوت رشد می‌کنند. داستان ما از همین‌جا آغاز می‌شود."/><Link to="/about" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:gap-3">بیشتر با ما آشنا شوید <ArrowUpRight size={16}/></Link><div className="mt-9"><Button to="/about" variant="outline">دربارهٔ ما</Button></div></div></div></Container></section><CTA /></>;
}
