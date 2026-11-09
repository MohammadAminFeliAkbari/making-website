export interface NavigationLink {
  label: string;
  href: string;
}

export interface SocialLink {
  label: string;
  href: string;
}

export const siteConfig = {
  name: 'نام برند شما',
  description: 'نقطهٔ شروعی برای ایدهٔ بعدی شما.',
  logoText: 'نام برند شما',
  primaryColor: '#54715f',
  navigation: [
    { label: 'خانه', href: '/' },
    { label: 'دربارهٔ ما', href: '/about' },
    { label: 'تماس', href: '/contact' },
  ] satisfies NavigationLink[],
  contact: {
    email: 'hello@example.com',
    phone: '+۹۸ (۲۱) ۱۲۳۴-۵۶۷۸',
    address: 'شهر شما، کشور شما',
  },
  socialLinks: [
    { label: 'اینستاگرام', href: 'https://instagram.com' },
    { label: 'لینکدین', href: 'https://linkedin.com' },
  ] satisfies SocialLink[],
};
