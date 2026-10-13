import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/legal/LegalPage';

export const metadata: Metadata = { title: 'Terms' };

export default function TermsPage() {
  return (
    <LegalPage title="Terms" kicker="Las reglas" updated="October 12, 2026">
      <p>
        These terms cover using this website, ordering online, our text and email programs, gallery submissions and merch. By using the site you
        agree to them. Barrio Burger Co. LLC is a Texas limited liability company; Texas law applies.
      </p>

      <h2 id="orders">Online orders</h2>
      <ul>
        <li>Online orders are pickup only, at the truck’s window. Ordering is available only while we’re open and not paused.</li>
        <li>Wait times are estimates. We’ll do our best; late-night rushes happen.</li>
        <li>
          Prices and sales tax are confirmed at checkout. If an item runs out after you order, we’ll offer a swap or refund that item.
        </li>
        <li>Orders not picked up by closing can’t be refunded once prepared.</li>
        <li>Food may contain or contact common allergens (wheat, dairy, egg, soy, nuts, sesame). Tell us about allergies in the order notes and at the window.</li>
      </ul>

      <h2 id="sms">Text message (SMS) program</h2>
      <ul>
        <li>
          <strong>Order alerts:</strong> if you opt in at checkout, we text you about that order (for example, when it’s ready). One-time,
          transactional messages.
        </li>
        <li>
          <strong>Specials &amp; updates:</strong> if you opt in on the <Link href="/specials">specials page</Link>, we send recurring automated
          marketing texts — up to about 4 per month.
        </li>
        <li>Consent is not a condition of any purchase.</li>
        <li>Message and data rates may apply. Message frequency varies.</li>
        <li>Reply <strong>STOP</strong> to cancel at any time; you’ll get one confirmation text. Reply <strong>START</strong> to rejoin.</li>
        <li>Reply <strong>HELP</strong> for help.</li>
        <li>Carriers are not liable for delayed or undelivered messages.</li>
        <li>
          We handle your number as described in our <Link href="/privacy">privacy policy</Link> and never sell or share it for others’
          marketing.
        </li>
      </ul>

      <h2 id="email">Email</h2>
      <p>Marketing emails go only to people who opted in, and every one has an unsubscribe link.</p>

      <h2 id="photos">Photos and the gallery</h2>
      <ul>
        <li>
          When you submit a photo, you confirm that you took it (or have the rights to it) and that <strong>every identifiable person in it
          agreed</strong> to have it published on this site and our social media.
        </li>
        <li>
          You give Barrio Burger Co. a non-exclusive, royalty-free license to display it on our website and social accounts, with credit if
          you ask. You keep ownership.
        </li>
        <li>We review every photo before it appears, and may decline any photo for any reason.</li>
        <li>
          <strong>Takedowns:</strong> anyone shown in a photo can ask us to remove it, no questions asked, using the{' '}
          <Link href="/gallery/takedown">takedown request page</Link>. We aim to remove photos within 2 business days.
        </li>
        <li>No photos of minors, please.</li>
      </ul>

      <h2 id="merch">Merch</h2>
      <ul>
        <li>Payments are processed by Stripe; sales tax is calculated at checkout.</li>
        <li>Shipping times are estimates. Some items may be printed on demand.</li>
        <li>[Owner: set the returns/exchange policy, e.g. unworn items within 30 days, and how to request one.]</li>
      </ul>

      <h2>Partner links</h2>
      <p>Links and QR codes from partner bars tell us who sent you. It doesn’t change your price.</p>

      <h2>The usual</h2>
      <ul>
        <li>The site is provided as-is. We’re not liable for indirect losses from using it.</li>
        <li>Don’t misuse the site (spam, scraping, attacking it, or submitting someone else’s photos).</li>
        <li>We may update these terms; the date at the top changes when we do.</li>
      </ul>

      <h2>Contact</h2>
      <p>Barrio Burger Co. LLC, San Marcos, Texas. Instagram: @barrioburgerco. [Owner: add a contact email.]</p>
    </LegalPage>
  );
}
