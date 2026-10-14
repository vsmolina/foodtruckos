import type { Metadata } from 'next';
import { StatusIcon } from '@/components/layout/StatusBanner';
import { MenuItemCard } from '@/components/menu/MenuItemCard';
import { Button, LinkButton } from '@/components/ui/Button';
import { Arrow, ArrowDown, Burst, Circle, Scribble, Star, Underline, UnderlineDouble, ZigzagDivider } from '@/components/ui/Doodles';
import { Checkbox, FormNotice, SelectField, TextArea, TextField } from '@/components/ui/Field';
import { SectionHeading } from '@/components/ui/SectionHeading';
import { LogoSlot, PhotoSlot } from '@/components/ui/Slots';
import { Sticker } from '@/components/ui/Sticker';
import type { MenuItem } from '@/lib/menu';

// Living component sheet — every state in one place (design/DESIGN.md §6).
export const metadata: Metadata = { title: 'Styleguide', robots: { index: false } };

const SAMPLE: MenuItem = {
  id: 'x',
  name: 'Mexican Burger',
  description: 'Beef patty, chorizo, avocado, queso, pickled jalapeños.',
  taglineEs: '¡La mera buena!',
  photoUrl: null,
  soldOut: false,
  isNew: true,
  variations: [
    { id: 'a', name: 'Regular', priceCents: 1099 },
    { id: 'b', name: 'Large', priceCents: 1399 },
  ],
  modifierGroups: [],
  fromCents: 1099,
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 border-b-2 border-dashed border-ink-muted pb-1 text-sm font-bold uppercase tracking-wider text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

const COLORS = [
  ['bg', 'bg-bg'],
  ['surface', 'bg-surface'],
  ['surface-2', 'bg-surface-2'],
  ['paper', 'bg-paper'],
  ['chile', 'bg-chile'],
  ['marigold', 'bg-marigold'],
  ['rosa', 'bg-rosa'],
  ['agave', 'bg-agave'],
  ['añil', 'bg-anil'],
  ['outline', 'bg-outline'],
] as const;

export default function Styleguide() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-8">
      <SectionHeading as="h1" size="h1" kicker="Puro diseño">
        Styleguide
      </SectionHeading>
      <p className="mt-6 max-w-2xl text-ink-muted">Every component and state. Toggle light/dark in the footer. Rules: design/DESIGN.md.</p>

      <Block title="Color">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {COLORS.map(([name, cls]) => (
            <li key={name} className="overflow-hidden rounded-md border-2 border-outline">
              <div className={`h-14 ${cls}`} />
              <p className="bg-surface px-2 py-1 text-sm font-bold">{name}</p>
            </li>
          ))}
        </ul>
      </Block>

      <Block title="Type scale">
        <p className="font-display text-hero uppercase">Hero</p>
        <p className="font-display text-h1 uppercase">Heading 1</p>
        <p className="font-display text-h2 uppercase">Heading 2</p>
        <p className="font-display text-h3 uppercase">Heading 3</p>
        <p className="text-lg">Large body — Atkinson Hyperlegible Next, for reading outdoors at night.</p>
        <p>Body 17px — menus, prices ($10.99), forms and legal text.</p>
        <p className="text-sm text-ink-muted">Small / muted</p>
        <p className="font-hand text-xl text-marigold">¡La mera buena! — hand annotations</p>
      </Block>

      <Block title="Buttons (hover, press, focus, disabled, loading)">
        <div className="flex flex-wrap items-center gap-4">
          <Button>Primary</Button>
          <Button variant="marigold">Marigold</Button>
          <Button variant="agave">Agave</Button>
          <Button variant="paper">Paper</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="ghost">Ghost</Button>
          <Button size="lg">Large</Button>
          <Button size="sm" variant="paper">
            Small
          </Button>
          <Button disabled>Disabled</Button>
          <Button loading>Loading</Button>
          <LinkButton href="/styleguide" variant="marigold">
            Link button
          </LinkButton>
        </div>
      </Block>

      <Block title="Status">
        <div className="flex flex-wrap gap-4">
          <Sticker tone="agave" tilt="b" size="lg">
            <StatusIcon status="open" /> Open now
          </Sticker>
          <Sticker tone="marigold" tilt="c" size="lg">
            <StatusIcon status="back_soon" /> Back soon
          </Sticker>
          <Sticker tone="chile" tilt="a" size="lg">
            <StatusIcon status="closed" /> Closed
          </Sticker>
        </div>
      </Block>

      <Block title="Stickers (hover to straighten)">
        <div className="flex flex-wrap gap-4">
          <Sticker tone="marigold">¡Nuevo!</Sticker>
          <Sticker tone="rosa" tilt="d">
            Especial
          </Sticker>
          <Sticker tone="agave" tilt="c">
            Open now
          </Sticker>
          <Sticker tone="chile" tilt="b" size="sm">
            Sold out · Agotado
          </Sticker>
          <Sticker tone="paper" tilt="e">
            Muy pronto
          </Sticker>
          <Sticker tone="anil" tilt="a" size="lg">
            Añil
          </Sticker>
        </div>
      </Block>

      <Block title="Cards">
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="panel tilt-c p-5">
            <p className="font-display text-h3 uppercase">Panel</p>
            <p className="text-ink-muted">Dark framed panel.</p>
          </div>
          <div className="paper taped tilt-b p-5">
            <p className="font-display text-h3 uppercase">Paper + tape</p>
            <p>Flyer card with black ink.</p>
          </div>
          <div className="panel bg-anil p-5 text-on-anil">
            <p className="font-display text-h3 uppercase">Mural fill</p>
            <p>Flat color, black outline.</p>
          </div>
        </div>
      </Block>

      <Block title="Menu item card (default, sold out)">
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <MenuItemCard item={SAMPLE} index={0} />
          </li>
          <li>
            <MenuItemCard item={{ ...SAMPLE, isNew: false, soldOut: true, name: 'Chili Cheese Dog', taglineEs: null }} index={1} />
          </li>
        </ul>
      </Block>

      <Block title="Form fields (default, error, disabled, success)">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField name="sg-name" label="Name" placeholder="Your name" required />
          <TextField name="sg-phone" label="Mobile number" defaultValue="512" error="Enter a 10-digit US number." />
          <SelectField name="sg-type" label="Event type" placeholder="Choose one" options={[{ value: 'party', label: 'Private party' }]} />
          <TextField name="sg-disabled" label="Disabled" disabled defaultValue="Can’t edit" />
          <TextArea name="sg-notes" label="Notes" hint="Anything we should know?" className="sm:col-span-2" />
          <Checkbox name="sg-consent" label="Text me when my order is ready. Msg & data rates may apply. Reply STOP to opt out." />
          <Checkbox name="sg-consent-err" label="Required consent" error="Please confirm to continue." />
          <FormNotice tone="error">Something went wrong — your card wasn’t charged.</FormNotice>
          <FormNotice tone="success">¡Listo! We got it.</FormNotice>
        </div>
      </Block>

      <Block title="Hand-drawn marks (public/brand/*.svg)">
        <div className="grid grid-cols-2 items-center gap-6 text-marigold sm:grid-cols-4">
          <Underline className="draw h-4 w-full" />
          <UnderlineDouble className="draw h-5 w-full text-rosa" />
          <Circle className="draw h-16 w-full text-agave" />
          <Scribble className="draw h-10 w-full" />
          <Arrow className="draw h-16 w-24" />
          <ArrowDown className="draw h-16 w-10 text-rosa" />
          <Star className="h-14 w-14" />
          <Burst className="relative h-24 w-24 text-marigold">
            <span className="font-display text-lg text-on-marigold">$13</span>
          </Burst>
        </div>
        <ZigzagDivider className="mt-8" />
      </Block>

      <Block title="Slots">
        <div className="flex flex-wrap items-center gap-6">
          <LogoSlot size="sm" />
          <LogoSlot size="md" />
          <LogoSlot size="lg" />
          <div className="panel h-32 w-44 overflow-hidden">
            <PhotoSlot label="the crowd" tone="rosa" />
          </div>
        </div>
      </Block>
    </div>
  );
}
