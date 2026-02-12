import type { SiteContent } from '@/content';
import { Footer } from '@/components/sections/footer';
import { Faq } from '@/components/sections/faq';
import { Ida } from '@/components/sections/ida';
import { MyHistory } from '@/components/sections/my-history';
import { MyJourney } from '@/components/sections/my-journey';
import { Navbar } from '@/components/sections/navbar';
import { SproutsSquadCommunity } from '@/components/sections/sprouts-squad-community';
import { WhyUs } from '@/components/sections/why-us';

interface AboutUsProps {
  content: SiteContent;
}

export function AboutUs({ content }: AboutUsProps) {
  return (
    <>
      <Navbar content={content.navbar} />
      <main id='main-content' tabIndex={-1} className='min-h-screen'>
        <Ida content={content.aboutUsPage.ida} />
        <MyHistory content={content.aboutUsPage.myHistory} />
        <MyJourney content={content.aboutUsPage.myJourney} />
        <WhyUs content={content.aboutUsPage.whyUs} />
        <Faq content={content.aboutUsPage.faq} />
        <SproutsSquadCommunity content={content.sproutsSquadCommunity} />
      </main>
      <Footer content={content.footer} />
    </>
  );
}
