import { ArrowDown, ArrowUpRight, Sparkles } from 'lucide-react';
import { Button } from '../common/Button';
import { Container } from '../common/Container';

export function Hero() {
  return (
    <section className="overflow-hidden pb-20 pt-16 sm:pb-28 sm:pt-24 lg:pb-32 lg:pt-28">
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-[1.02fr_.98fr] lg:gap-12">
          <div className="relative z-10">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-4 py-2 text-xs font-semibold text-muted shadow-sm"><Sparkles size={14} className="text-[var(--color-primary)]" /> نقطهٔ شروع</div>
            <h1 className="max-w-2xl font-display text-5xl font-medium leading-[1.04] tracking-[-0.055em] text-ink sm:text-6xl lg:text-[4.6rem]">برای <span className="text-[var(--color-primary)]">آینده‌ای تازه</span> جا باز کنید.</h1>
            <p className="mt-7 max-w-lg text-base leading-7 text-muted sm:text-lg sm:leading-8">معرفی روشن و مطمئنی از کار، ایده‌ها و مخاطبان شما. از همین نقطه شروع کنید و وب‌سایت را مطابق سلیقهٔ خود بسازید.</p>
            <div className="mt-9 flex flex-wrap gap-3"><Button to="/contact">گفت‌وگو را شروع کنیم <ArrowUpRight size={16} /></Button><Button to="/about" variant="secondary">با داستان ما آشنا شوید</Button></div>
            <a href="#features" className="mt-14 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-muted transition hover:text-ink"><ArrowDown size={14} /> برای دیدن ادامه پایین بروید</a>
          </div>
          <div className="relative mx-auto w-full max-w-[560px] lg:max-w-none">
            <div className="absolute -right-12 -top-10 size-48 rounded-full bg-[#e8ece5] blur-3xl" />
            <div className="relative aspect-[1.08/1] overflow-hidden rounded-[2rem] bg-[#dfe7dd] p-5 shadow-[0_30px_80px_-35px_rgba(44,61,49,.32)] sm:p-7">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_20%,rgba(255,255,255,.8),transparent_42%),linear-gradient(140deg,transparent_45%,rgba(102,129,104,.18))]" />
              <div className="absolute -right-10 top-10 h-[115%] w-[68%] rotate-[12deg] rounded-[45%] bg-[#b5c6b2]" />
              <div className="absolute right-[18%] top-[14%] h-[80%] w-[45%] rotate-[12deg] rounded-[48%] bg-[#829c82] shadow-2xl" />
              <div className="absolute bottom-[9%] left-[8%] h-[38%] w-[48%] -rotate-[8deg] rounded-[48%] bg-[#f0e7d5] shadow-lg" />
              <div className="absolute bottom-7 left-7 right-7 flex items-end justify-between rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur-md sm:bottom-9 sm:left-9 sm:right-9 sm:p-6">
                <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[var(--color-primary)]">با دقت ساخته‌شده</p><p className="mt-2 font-display text-xl font-medium text-ink sm:text-2xl">برای ایده‌های بهتر</p></div>
                <span className="grid size-10 place-items-center rounded-full bg-ink text-white"><ArrowUpRight size={18} /></span>
              </div>
              <div className="absolute left-7 top-7 grid size-12 place-items-center rounded-2xl bg-white/70 text-[var(--color-primary)] shadow-sm backdrop-blur"><Sparkles size={20} /></div>
            </div>
            <div className="absolute -bottom-5 -left-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-lg sm:-left-8 sm:px-5"><p className="font-display text-lg font-medium">از ایده تا اثرگذاری</p><p className="mt-0.5 text-xs text-muted">شروعی ساده و روشن</p></div>
          </div>
        </div>
      </Container>
    </section>
  );
}
