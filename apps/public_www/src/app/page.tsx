import Image from 'next/image';
import { Lato, Poppins, Urbanist } from 'next/font/google';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-poppins',
});

const lato = Lato({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-lato',
});

const urbanist = Urbanist({
  subsets: ['latin'],
  weight: ['600'],
  variable: '--font-urbanist',
});

interface FooterLinkItem {
  label: string;
  href: string;
  iconSrc?: string;
  iconWidth?: number;
  iconHeight?: number;
}

interface FooterColumnProps {
  title: string;
  links: FooterLinkItem[];
  className?: string;
}

const quickLinks: FooterLinkItem[] = [
  { label: 'Home', href: '#' },
  { label: 'About us', href: '#' },
  { label: 'Events', href: '#' },
  { label: 'Contact us', href: '#' },
  { label: 'Book Now', href: '#' },
];

const serviceLinks: FooterLinkItem[] = [
  { label: 'My Best Auntie', href: '#' },
  { label: 'Workshops', href: '#' },
  { label: 'Resources', href: '#' },
];

const aboutLinks: FooterLinkItem[] = [
  { label: 'Who We Are', href: '#' },
  { label: 'Newsletter', href: '#' },
  { label: 'Privacy Policy', href: '#' },
];

const socialLinks: FooterLinkItem[] = [
  {
    label: 'Facebook',
    href: '#',
    iconSrc: '/images/footer/icon-facebook.png',
    iconWidth: 16,
    iconHeight: 16,
  },
  {
    label: 'Linkedin',
    href: '#',
    iconSrc: '/images/footer/icon-linkedin.png',
    iconWidth: 16,
    iconHeight: 16,
  },
  {
    label: 'Instagram',
    href: '#',
    iconSrc: '/images/footer/icon-instagram.png',
    iconWidth: 18,
    iconHeight: 18,
  },
  {
    label: 'Tiktok',
    href: '#',
    iconSrc: '/images/footer/icon-tiktok.png',
    iconWidth: 16,
    iconHeight: 16,
  },
];

function FooterColumn({ title, links, className }: FooterColumnProps) {
  return (
    <div className={className}>
      <h2
        className='font-[var(--font-urbanist)] text-[24px] font-semibold
          leading-[28px] tracking-[-0.02em] text-[#333333]'
      >
        {title}
      </h2>
      <ul className='mt-4 space-y-3 lg:mt-[17px] lg:space-y-[17px]'>
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className='inline-flex items-center gap-3 font-[var(--font-lato)]
                text-[18px] font-normal leading-[28px] tracking-[0.03em]
                text-[#4A4A4A] transition-colors hover:text-[#333333]'
            >
              {link.iconSrc ? (
                <Image
                  src={link.iconSrc}
                  alt=''
                  width={link.iconWidth ?? 16}
                  height={link.iconHeight ?? 16}
                  aria-hidden
                />
              ) : null}
              <span>{link.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HomePage() {
  return (
    <main
      className={`${poppins.variable} ${lato.variable} ${urbanist.variable}
        bg-[#FFEFE3] text-[#333333]`}
    >
      <section className='mx-auto max-w-[1920px] overflow-hidden'>
        <div className='relative'>
          <div
            className='relative h-[320px] w-full sm:h-[420px] lg:absolute
              lg:right-0 lg:top-0 lg:h-auto lg:w-[77.6%] lg:max-w-[1490px]'
          >
            <Image
              src='/images/footer/hero-photo.png'
              alt='Adults and children outdoors in sunlight'
              width={2981}
              height={1672}
              className='h-full w-full object-cover lg:h-auto'
              priority
            />
          </div>
          <div
            className='relative z-10 px-6 pb-12 pt-8 sm:px-12 sm:pt-10
              lg:min-h-[859px] lg:px-0 lg:pb-0 lg:pt-0'
          >
            <div className='mx-auto max-w-[1440px] lg:pl-[190px] lg:pt-[250px]'>
              <Image
                src='/images/footer/logo-mark.png'
                alt='Evolve Sprouts mark'
                width={481}
                height={485}
                className='h-auto w-[120px] sm:w-[160px] lg:w-[240px]'
              />
              <h1
                className='mt-4 max-w-[850px] font-[var(--font-poppins)]
                  text-[44px] font-bold leading-[1.35] tracking-[0.01em]
                  text-[#333333] sm:text-[56px] lg:mt-[-52px] lg:text-[77px]
                  lg:leading-[107px]'
              >
                Join our Sprouts
                <br />
                Squad community!
              </h1>
              <a
                href='#'
                className='mt-7 inline-flex min-h-14 items-center rounded-[8px]
                  bg-[#E76C3D] px-6 font-[var(--font-lato)] text-[26px]
                  font-semibold leading-[1] text-white transition-colors
                  hover:bg-[#ED6230] sm:min-h-[66px] sm:text-[28px]
                  lg:mt-[43px] lg:min-h-[82px] lg:px-[31px]'
              >
                Sign Up to Our Monthly Newsletter
              </a>
            </div>
          </div>
        </div>

        <div className='px-6 pb-10 sm:px-12 lg:px-[228px]'>
          <div
            className='grid gap-y-14 md:grid-cols-2 md:gap-x-16
              lg:grid-cols-[223px_223px_minmax(0,1fr)_223px_223px] lg:gap-x-0'
          >
            <FooterColumn
              title='Quick Links'
              links={quickLinks}
              className='order-2 lg:order-none'
            />
            <FooterColumn
              title='Services'
              links={serviceLinks}
              className='order-3 lg:order-none'
            />

            <div
              className='order-1 flex flex-col items-center md:col-span-2
                lg:order-none lg:col-span-1 lg:-mt-[76px]'
            >
              <Image
                src='/images/footer/logo-full.png'
                alt='Evolve Sprouts logo'
                width={940}
                height={964}
                className='h-auto w-[280px] sm:w-[360px] lg:w-[470px]'
              />
              <p
                className='mt-3 font-[var(--font-poppins)] text-[16px]
                  font-medium leading-[28px] text-[#333333]'
              >
                © 2025 Evolvesprouts
              </p>
            </div>

            <FooterColumn
              title='About Us'
              links={aboutLinks}
              className='order-4 lg:order-none'
            />
            <FooterColumn
              title='Connect on'
              links={socialLinks}
              className='order-5 lg:order-none'
            />
          </div>
        </div>
      </section>
    </main>
  );
}
