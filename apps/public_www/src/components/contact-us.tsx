import type { SiteContent } from '@/content';
import { Connect } from '@/components/sections/connect';
import { ContactUsForm } from '@/components/sections/contact-us-form';
import { Footer } from '@/components/sections/footer';
import { Navbar } from '@/components/sections/navbar';
import { ReachOut } from '@/components/sections/reach-out';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';

interface ContactUsPageSectionsProps {
  content: SiteContent;
}

export function ContactUsPageSections({ content }: ContactUsPageSectionsProps) {
  return (
    <>
      <Navbar content={content.navbar} />
      <main id='main-content' tabIndex={-1} className='min-h-screen'>
        <ContactUsForm content={content.contactUs.contactUsForm} />
        <ReachOut content={content.contactUs.reachOut} />
        <Connect content={content.contactUs.connect} />
        <SproutsSquadCommunity content={content.sproutsSquadCommunity} />
      </main>
      <Footer content={content.footer} />
    </>
  );
}
