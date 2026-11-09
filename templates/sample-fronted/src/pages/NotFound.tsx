import { ArrowLeft, Compass } from 'lucide-react';
import { Button } from '../components/common/Button';
import { Container } from '../components/common/Container';

export function NotFound() {
  return <section className="grid min-h-[65vh] place-items-center py-20"><Container className="text-center"><span className="mx-auto grid size-16 place-items-center rounded-2xl bg-[#e7ece6] text-[var(--color-primary)]"><Compass size={28}/></span><p className="mt-8 text-xs font-bold uppercase tracking-[.2em] text-[var(--color-primary)]">۴۰۴ — صفحه پیدا نشد</p><h1 className="mt-4 font-display text-4xl font-medium tracking-tight text-ink sm:text-6xl">انگار مسیر را اشتباه آمده‌اید.</h1><p className="mx-auto mt-5 max-w-md text-base leading-7 text-muted">ممکن است صفحه جابه‌جا شده باشد یا دیگر وجود نداشته باشد.</p><Button to="/" className="mt-8"><ArrowLeft size={16}/> بازگشت به خانه</Button></Container></section>;
}
