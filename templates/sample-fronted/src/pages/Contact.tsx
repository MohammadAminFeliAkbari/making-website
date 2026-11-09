import { useState, type FormEvent } from 'react';
import { CheckCircle2, Mail, MapPin, Phone } from 'lucide-react';
import { Container } from '../components/common/Container';
import { siteConfig } from '../config/site';

interface FormValues { name: string; email: string; message: string }
type FormErrors = Partial<Record<keyof FormValues, string>>;

function validate(values: FormValues): FormErrors {
  const errors: FormErrors = {};
  if (!values.name.trim()) errors.name = 'لطفاً نام خود را وارد کنید.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'یک نشانی ایمیل معتبر وارد کنید.';
  if (values.message.trim().length < 10) errors.message = 'پیام باید دست‌کم ۱۰ نویسه داشته باشد.';
  return errors;
}

export function Contact() {
  const [values, setValues] = useState<FormValues>({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [sent, setSent] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) setSent(true);
  }

  function updateField(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (sent) setSent(false);
  }

  const inputClass = 'mt-2 w-full rounded-xl border border-line bg-white px-4 py-3.5 text-sm text-ink outline-none transition placeholder:text-muted/60 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10';

  return <section className="py-16 sm:py-24"><Container><div className="grid gap-12 lg:grid-cols-[.78fr_1.22fr] lg:gap-20"><div><p className="mb-4 text-xs font-bold uppercase tracking-[.2em] text-[var(--color-primary)]">تماس با ما</p><h1 className="font-display text-5xl font-medium leading-[1.05] tracking-[-.05em] text-ink sm:text-6xl">گفت‌وگو را آغاز کنیم.</h1><p className="mt-6 max-w-md text-base leading-7 text-muted">کمی از آنچه در ذهن دارید برایمان بنویسید. در اولین فرصت پاسخ‌گوی شما هستیم.</p><div className="mt-10 space-y-5">{[
    { icon: Mail, label: 'ایمیل', value: siteConfig.contact.email, href: `mailto:${siteConfig.contact.email}` },
    { icon: Phone, label: 'تلفن', value: siteConfig.contact.phone, href: `tel:${siteConfig.contact.phone.replace(/[۰-۹]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 1728)).replace(/[^+\d]/g, '')}` },
    { icon: MapPin, label: 'نشانی', value: siteConfig.contact.address },
  ].map(({ icon: Icon, label, value, href }) => <div key={label} className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e7ece6] text-[var(--color-primary)]"><Icon size={18}/></span><div><p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>{href ? <a dir={label === 'ایمیل' || label === 'تلفن' ? 'ltr' : undefined} className="mt-1 inline-block text-sm font-medium text-ink hover:text-[var(--color-primary)]" href={href}>{value}</a> : <p className="mt-1 text-sm font-medium text-ink">{value}</p>}</div></div>)}</div></div>
    <div className="rounded-3xl border border-line bg-white p-6 shadow-[0_20px_70px_-50px_rgba(26,38,29,.25)] sm:p-9"><h2 className="font-display text-2xl font-medium">پیامی برای ما بنویسید</h2><p className="mt-2 text-sm text-muted">پرکردن فیلدهای دارای * الزامی است.</p>{sent ? <div role="status" className="mt-8 flex gap-4 rounded-2xl bg-[#eef3ed] p-5 text-[var(--color-primary)]"><CheckCircle2 className="mt-0.5 shrink-0"/><div><p className="font-semibold">{values.name} عزیز، از پیام شما سپاسگزاریم.</p><p className="mt-1 text-sm leading-6 text-ink/70">پیام شما آماده است. این فرم نمایشی اطلاعاتی را ارسال نمی‌کند، اما اطلاعات واردشده با موفقیت بررسی شد.</p></div></div> : <form className="mt-7 space-y-5" onSubmit={handleSubmit} noValidate>
      <div><label className="text-sm font-semibold text-ink" htmlFor="name">نام <span aria-hidden="true">*</span></label><input className={inputClass} id="name" name="name" autoComplete="name" value={values.name} onChange={(event) => updateField('name', event.target.value)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} placeholder="نام شما"/>{errors.name && <p className="mt-1.5 text-xs text-red-700" id="name-error">{errors.name}</p>}</div>
      <div><label className="text-sm font-semibold text-ink" htmlFor="email">ایمیل <span aria-hidden="true">*</span></label><input dir="ltr" className={`${inputClass} text-left`} id="email" name="email" type="email" autoComplete="email" value={values.email} onChange={(event) => updateField('email', event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} placeholder="you@example.com"/>{errors.email && <p className="mt-1.5 text-xs text-red-700" id="email-error">{errors.email}</p>}</div>
      <div><label className="text-sm font-semibold text-ink" htmlFor="message">پیام <span aria-hidden="true">*</span></label><textarea className={`${inputClass} min-h-36 resize-y`} id="message" name="message" value={values.message} onChange={(event) => updateField('message', event.target.value)} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'message-error' : undefined} placeholder="کمی از ایده‌تان برایمان بنویسید..."/>{errors.message && <p className="mt-1.5 text-xs text-red-700" id="message-error">{errors.message}</p>}</div>
      <button type="submit" className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[var(--color-primary-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">ارسال پیام</button><p className="text-center text-xs text-muted">این فرم نمایشی است و اطلاعاتی به سرور ارسال نمی‌شود.</p>
    </form>}</div></div></Container></section>;
}
