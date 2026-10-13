import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" kicker="Tu privacidad" updated="October 12, 2026">
      <p>
        Barrio Burger Co. LLC, a Texas limited liability company (“we”, “us”), runs this website and the food truck on the Square in San Marcos,
        TX. This policy explains what we collect, why, and the choices you have. We don’t sell your personal information.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Online orders:</strong> your name, mobile number, what you ordered, totals and order status. We use your number to identify
          your order at the window and, if you opt in at checkout, to text you when it’s ready.
        </li>
        <li>
          <strong>Payments:</strong> card payments for food are processed by Square, and merch payments by Stripe. Card numbers go directly to
          them; we never see or store them. Their privacy policies apply to that data.
        </li>
        <li>
          <strong>Specials sign-ups:</strong> your email and/or mobile number, which channels you agreed to, the exact consent text you saw and
          when. Used only to send specials and updates.
        </li>
        <li>
          <strong>Catering requests:</strong> the contact and event details you submit, used to respond and quote.
        </li>
        <li>
          <strong>Gallery submissions:</strong> photos you upload, your name/email/Instagram handle if given, and your confirmation that
          everyone identifiable in the photo agreed to be published.
        </li>
        <li>
          <strong>Merch orders:</strong> name, email and shipping address, used to fulfil and support your order.
        </li>
        <li>
          <strong>Analytics:</strong> we count page views by page and referring website. We don’t use analytics cookies, don’t store IP
          addresses, and don’t use third-party trackers. To limit abuse we keep a short-lived, one-way hash of your connection with form
          submissions for rate limiting.
        </li>
      </ul>

      <h2>Cookies</h2>
      <ul>
        <li>
          <code>bb_ref</code> — if you arrive through a partner bar’s link or QR code, remembers that partner’s code for 24 hours so they get
          credit for your order.
        </li>
        <li>
          <code>theme</code> — remembers whether you chose the light or dark look.
        </li>
        <li>Your cart is kept in your browser’s local storage on your device.</li>
        <li>The admin area uses a sign-in cookie for the owner only.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        Only the service providers that make the site work, for that purpose only: Square (food orders and payments), Stripe (merch payments
        and sales tax), Twilio (text messages), Resend (email), Vercel (hosting and photo storage), and our database host. We may disclose
        information if the law requires it.
      </p>

      <h2>How long we keep it</h2>
      <p>
        Orders and payment records: as long as tax and accounting rules require. Subscriber records, including proof of consent: while you’re
        subscribed and for a reasonable time after you opt out. Catering requests: up to 2 years. Gallery photos: until you ask us to remove
        them or we take them down.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Texts: reply STOP to any message to stop, HELP for help.</li>
        <li>Email: use the unsubscribe link in any email.</li>
        <li>
          Photos: ask us to take one down any time on the <Link href="/gallery/takedown">takedown request page</Link>.
        </li>
        <li>To see, correct or delete your information, contact us (below).</li>
      </ul>

      <h2>Kids</h2>
      <p>This site isn’t directed to children under 13, and we don’t knowingly collect their information.</p>

      <h2>Contact</h2>
      <p>
        Barrio Burger Co. LLC, San Marcos, Texas. Reach us by DM on Instagram (@barrioburgerco) or at the truck. [Owner: add a contact email and
        mailing address here.]
      </p>
    </LegalPage>
  );
}
