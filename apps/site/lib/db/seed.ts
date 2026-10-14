import { drizzle } from 'drizzle-orm/postgres-js';
import type { PgTable } from 'drizzle-orm/pg-core';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Sample data so the site renders immediately. PLACEHOLDERS: menu names and
 * prices mirror the truck's placeholder menu (foodtruck-os seed); hours,
 * partners and merch are made up. Replace via the admin, or run
 * "Sync from Square" for the real menu. Idempotent: skips tables that have rows.
 *
 *   pnpm --filter site db:seed
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const client = postgres(url, { max: 1 });
  const db = drizzle(client, { schema });
  const empty = async (table: PgTable): Promise<boolean> => (await db.select().from(table).limit(1)).length === 0;

  // ---- status: the truck is temporarily off the Square ----
  await db
    .insert(schema.siteSettings)
    .values({
      id: 1,
      status: 'back_soon',
      statusMessage: 'Taking a short break from the Square — we’re back soon. Sign up and we’ll text you the night we return.',
      pausedMessage: 'Slammed right now — online orders are paused. Come to the window!',
      lateNightNote: 'Busiest after last call (1:30–2:30 AM). Order ahead from the bar and skip the line.',
      defaultWaitMinutes: 12,
    })
    .onConflictDoNothing();

  if (await empty(schema.weeklyHours)) {
    // PLACEHOLDER hours: opens 8:30 PM, closes after bar close.
    await db.insert(schema.weeklyHours).values([
      { dayOfWeek: 0, closed: true },
      { dayOfWeek: 1, closed: true },
      { dayOfWeek: 2, closed: true },
      { dayOfWeek: 3, opens: '20:30', closes: '01:00' },
      { dayOfWeek: 4, opens: '20:30', closes: '02:30', note: 'Thirsty Thursday' },
      { dayOfWeek: 5, opens: '20:30', closes: '03:00' },
      { dayOfWeek: 6, opens: '20:30', closes: '03:00' },
    ]);
  }

  if (await empty(schema.menuCategories)) {
    const cats = await db
      .insert(schema.menuCategories)
      .values([
        { name: 'Burgers', labelEs: 'Hamburguesas', sortOrder: 0 },
        { name: 'Hot Dogs', labelEs: 'Dogos', sortOrder: 1 },
        { name: 'Sides', labelEs: 'Antojitos', sortOrder: 2 },
        { name: 'Drinks', labelEs: 'Bebidas', sortOrder: 3 },
      ])
      .returning();
    const cat = (n: string) => cats.find((c) => c.name === n)!.id;

    type SeedItem = {
      category: string;
      name: string;
      description?: string;
      taglineEs?: string;
      isNew?: boolean;
      soldOut?: boolean;
      variations: Array<[string, number]>;
      mods?: Array<{ group: string; max?: number; required?: boolean; options: Array<[string, number]> }>;
    };
    const burgerMods = [
      { group: 'Make it yours', options: [['No Onions', 0], ['No Pickled Jalapeños', 0], ['No Ketchup', 0], ['Add Mustard', 0]] as Array<[string, number]> },
      { group: 'Extras', options: [['Add Bacon', 200], ['Extra Cheese', 100], ['Add Avocado', 150]] as Array<[string, number]> },
    ];
    const items: SeedItem[] = [
      {
        category: 'Burgers',
        name: 'Mexican Burger',
        description: 'Beef patty, chorizo, avocado, queso, pickled jalapeños on a toasted bun.',
        taglineEs: '¡La mera buena!',
        variations: [['Regular', 1099], ['Large', 1399]],
        mods: burgerMods,
      },
      { category: 'Burgers', name: 'Bacon Cheeseburger', description: 'Double bacon, American cheese, grilled onions.', variations: [['Regular', 1199]], mods: burgerMods },
      { category: 'Burgers', name: 'Green Chile Burger', description: 'Roasted green chile, pepper jack, chipotle mayo.', isNew: true, variations: [['Regular', 1149]], mods: burgerMods },
      {
        category: 'Hot Dogs',
        name: 'Sonoran Dog',
        description: 'Bacon-wrapped, pinto beans, onions, tomato, mayo, mustard, jalapeño salsa.',
        taglineEs: 'Envuelto en tocino',
        variations: [['Single', 799], ['Double', 1099]],
        mods: [{ group: 'Make it yours', options: [['No Onions', 0], ['No Beans', 0], ['Extra Jalapeño Salsa', 0]] }],
      },
      { category: 'Hot Dogs', name: 'Chili Cheese Dog', description: 'Bacon-wrapped, chili, cheddar.', variations: [['Regular', 849]], soldOut: true },
      { category: 'Sides', name: 'Loaded Fries', description: 'Queso, bacon, jalapeño, crema.', variations: [['Regular', 599]] },
      { category: 'Sides', name: 'Elote (Street Corn)', description: 'Mayo, cotija, chile, lime.', variations: [['Regular', 449]] },
      { category: 'Drinks', name: 'Mexican Coke', description: 'Glass bottle, real sugar.', variations: [['Bottle', 299]] },
      { category: 'Drinks', name: 'Horchata', description: 'House-made, cinnamon.', variations: [['Regular', 349]] },
    ];
    let sort = 0;
    for (const it of items) {
      const [row] = await db
        .insert(schema.menuItems)
        .values({
          categoryId: cat(it.category),
          name: it.name,
          description: it.description ?? null,
          taglineEs: it.taglineEs ?? null,
          isNew: it.isNew ?? false,
          soldOut: it.soldOut ?? false,
          sortOrder: sort++,
        })
        .returning();
      await db.insert(schema.menuVariations).values(it.variations.map(([name, priceCents], i) => ({ itemId: row!.id, name, priceCents, sortOrder: i })));
      let m = 0;
      for (const g of it.mods ?? []) {
        await db.insert(schema.menuModifiers).values(
          g.options.map(([name, priceCents]) => ({
            itemId: row!.id,
            groupName: g.group,
            groupMax: g.max ?? null,
            groupRequired: g.required ?? false,
            name,
            priceCents,
            sortOrder: m++,
          })),
        );
      }
    }
  }

  if (await empty(schema.specials)) {
    await db.insert(schema.specials).values([
      {
        title: 'Thirsty Thursday: 2 Sonoran Dogs',
        kicker: '¡Jueves!',
        body: 'Two bacon-wrapped Sonoran dogs for one low price, 8:30 PM till close.',
        priceLabel: '$13',
        sortOrder: 0,
      },
      {
        title: 'Green Chile Burger is here',
        kicker: '¡Nuevo!',
        body: 'Roasted green chile, pepper jack and chipotle mayo. Only while the chiles last.',
        priceLabel: '$11.49',
        sortOrder: 1,
      },
    ]);
  }

  if (await empty(schema.partners)) {
    await db.insert(schema.partners).values([
      { name: 'Harper’s', kind: 'bar', blurb: 'Our home base on the Square. Order from your table before last call.', code: 'HARPERS', instagram: null, sortOrder: 0 },
      { name: 'Sample Bar', kind: 'bar', blurb: 'PLACEHOLDER — replace with a real partner in the admin.', code: 'SAMPLEBAR', sortOrder: 1 },
      { name: 'Sample Bartender', kind: 'bartender', blurb: 'PLACEHOLDER — the bartender who sends everyone our way.', code: 'SAMPLEBTD', sortOrder: 2 },
    ]);
  }

  if (await empty(schema.merchProducts)) {
    const [tee] = await db
      .insert(schema.merchProducts)
      .values({ slug: 'barrio-tee', name: 'Barrio Tee', description: 'Heavyweight black tee, logo on the chest. (Sample product.)', priceCents: 2800, sortOrder: 0 })
      .returning();
    const [hat] = await db
      .insert(schema.merchProducts)
      .values({ slug: 'trucker-hat', name: 'Trucker Hat', description: 'Foam-front trucker, snapback. (Sample product.)', priceCents: 2600, sortOrder: 1 })
      .returning();
    const [stickers] = await db
      .insert(schema.merchProducts)
      .values({ slug: 'sticker-pack', name: 'Sticker Pack', description: 'Five die-cut vinyl stickers. (Sample product.)', priceCents: 600, sortOrder: 2 })
      .returning();
    await db.insert(schema.merchVariants).values([
      ...['S', 'M', 'L', 'XL'].map((size, i) => ({ productId: tee!.id, size, color: 'Black', stock: 10, sortOrder: i })),
      { productId: tee!.id, size: '2XL', color: 'Black', priceCents: 3200, stock: 4, sortOrder: 4 },
      { productId: hat!.id, size: 'One size', color: 'Black/Marigold', stock: 12, sortOrder: 0 },
      { productId: hat!.id, size: 'One size', color: 'Rosa', stock: 0, sortOrder: 1 },
      { productId: stickers!.id, size: null, color: null, stock: 50, sortOrder: 0 },
    ]);
  }

  console.info('[seed] done.');
  await client.end();
}

main().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
