import {
  PhoneCarousel,
  type ScreenItem,
} from '@/components/ui/phone-mockups-1-utils/phone-carousel';
import {
  ChatScreen,
  NearbyRidesScreen,
  RideDetailScreen,
  SquadScreen,
} from '@/components/ui/phone-mockups-1-utils/app-screens';

/**
 * The landing-page phone carousel.
 *
 * These were four PNGs on a stranger's Cloudinary account, and they were
 * screenshots of Behance, Notion, One and Reddit rather than of this product.
 * All four now answer 401 — hotlinking was locked down at some point — which
 * is what emptied the phones on the hero. They are now Spllit's own screens,
 * drawn in app-screens.tsx from the same design tokens as the real app, so
 * there is no third-party host left to fail and nothing on screen that belongs
 * to another company.
 *
 * The order is the story the hero tells: find a ride, look at it, turn it into
 * a squad, talk to the squad.
 */
const screens: ScreenItem[] = [
  {
    id: 'nearby',
    alt: 'Spllit showing shared rides on a map near IIT Madras',
    screen: <NearbyRidesScreen />,
  },
  {
    id: 'ride',
    alt: 'A ride to Chennai Airport with the driver and the fare per seat',
    screen: <RideDetailScreen />,
  },
  {
    id: 'squad',
    alt: 'A travel group ride to Pondicherry with four of six seats filled',
    screen: <SquadScreen />,
  },
  {
    id: 'chat',
    alt: 'The group ride chat, confirming pickup and the split fare',
    screen: <ChatScreen />,
  },
];

export default function PhoneMockupBasic() {
  return <PhoneCarousel screens={screens} />;
}
