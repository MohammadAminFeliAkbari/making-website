import { ArrowUpRight, Compass, Layers3, Sparkles } from 'lucide-react';
import { Container } from '../common/Container';
import { SectionTitle } from '../common/SectionTitle';

const features = [
  { number: '۰۱', icon: Compass, title: 'مسیرتان را پیدا کنید', description: 'با دیدگاهی روشن و پایه‌ای شروع کنید که به هر قدم بعدی معنا می‌دهد.' },
  { number: '۰۲', icon: Layers3, title: 'همه‌چیز را کنار هم بیاورید', description: 'اجزای مهم را در فضایی سنجیده کنار هم قرار دهید تا همراه کارتان رشد کنند.' },
  { number: '۰۳', icon: Sparkles, title: 'معنا خلق کنید', description: 'تجربه‌ای سنجیده بسازید که متمایز، کاربردی و مختص شما باشد.' },
];

export function Features() {
  return (
    <section id="features" className="bg-white py-20 sm:py-28">
      <Container>
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <SectionTitle eyebrow="پایه‌ای محکم" title="هر چیزی با یک قدم سنجیده آغاز می‌شود." />
          <p className="max-w-sm pb-1 text-base leading-7 text-muted">وقتی پایه‌ها درست باشند، تمرکز روی کارهای مهم آسان‌تر می‌شود و با اطمینان پیش می‌روید.</p>
        </div>
        <div className="mt-12 grid gap-4 md:mt-16 md:grid-cols-3">
          {features.map(({ number, icon: Icon, title, description }) => <article key={number} className="group rounded-3xl border border-line bg-paper p-7 transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-32px_rgba(26,38,29,.35)] sm:p-8">
            <div className="flex items-center justify-between"><span className="text-xs font-bold tracking-widest text-muted">{number}</span><span className="grid size-11 place-items-center rounded-2xl bg-[#e7ece6] text-[var(--color-primary)]"><Icon size={20} /></span></div>
            <h3 className="mt-12 font-display text-2xl font-medium tracking-tight text-ink">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
            <span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]">بیشتر بدانید <ArrowUpRight size={15} className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></span>
          </article>)}
        </div>
      </Container>
    </section>
  );
}
