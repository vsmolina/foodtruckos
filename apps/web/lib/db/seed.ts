import { db, sql } from './client';
import {
  businesses,
  menuCategories,
  menuItemVariations,
  menuItems,
  menuModifiers,
  stores,
} from './schema';

/**
 * Dev seed. Idempotent: wipes the seeded tables and re-inserts.
 *
 * TODO(victor): replace the placeholder menu below with the truck's REAL items
 * and prices (integer cents). Names/prices here are educated guesses for a
 * Mexican-style burger + bacon-wrapped hot dog truck, NOT the real menu.
 */
async function main(): Promise<void> {
  console.info('[seed] clearing seeded tables…');
  // Order matters for FKs. These are the only tables the seed populates.
  await db.delete(menuModifiers);
  await db.delete(menuItemVariations);
  await db.delete(menuItems);
  await db.delete(menuCategories);
  await db.delete(stores);
  await db.delete(businesses);

  console.info('[seed] inserting business + store…');
  const [business] = await db
    .insert(businesses)
    .values({ name: "Victor's Food Truck", timezone: 'America/Chicago' })
    .returning();
  if (!business) throw new Error('failed to insert business');

  const [store] = await db
    .insert(stores)
    .values({ businessId: business.id, name: 'San Marcos' })
    .returning();
  if (!store) throw new Error('failed to insert store');

  console.info('[seed] inserting categories…');
  const categoryRows = await db
    .insert(menuCategories)
    .values([
      { storeId: store.id, name: 'Burgers', sortOrder: 0 },
      { storeId: store.id, name: 'Hot Dogs', sortOrder: 1 },
      { storeId: store.id, name: 'Sides', sortOrder: 2 },
      { storeId: store.id, name: 'Drinks', sortOrder: 3 },
    ])
    .returning();

  const cat = (name: string): string => {
    const row = categoryRows.find((c) => c.name === name);
    if (!row) throw new Error(`category not found: ${name}`);
    return row.id;
  };

  // --- Menu items (TODO placeholders) --------------------------------------
  // Each entry seeds one item; `variations` carries the price(s) in cents.
  type SeedItem = {
    category: string;
    name: string;
    description?: string;
    variations: { name: string; priceCents: number; isDefault?: boolean }[];
  };

  const items: SeedItem[] = [
    {
      category: 'Burgers',
      name: 'Mexican Burger', // TODO real name
      description: 'Beef patty, chorizo, avocado, queso.',
      variations: [
        { name: 'Regular', priceCents: 1099, isDefault: true },
        { name: 'Large', priceCents: 1399 },
      ],
    },
    {
      category: 'Burgers',
      name: 'Bacon Cheeseburger',
      description: 'Double bacon, American cheese.',
      variations: [{ name: 'Regular', priceCents: 1199, isDefault: true }],
    },
    {
      category: 'Burgers',
      name: 'Green Chile Burger',
      description: 'Hatch green chile, pepper jack.',
      variations: [{ name: 'Regular', priceCents: 1149, isDefault: true }],
    },
    {
      category: 'Hot Dogs',
      name: 'Sonoran Dog', // bacon-wrapped
      description: 'Bacon-wrapped, pinto beans, onions, tomato, mayo.',
      variations: [
        { name: 'Single', priceCents: 799, isDefault: true },
        { name: 'Double', priceCents: 1099 },
      ],
    },
    {
      category: 'Hot Dogs',
      name: 'Chili Cheese Dog',
      description: 'Bacon-wrapped, chili, cheddar.',
      variations: [{ name: 'Regular', priceCents: 849, isDefault: true }],
    },
    {
      category: 'Sides',
      name: 'Loaded Fries',
      description: 'Queso, bacon, jalapeño.',
      variations: [{ name: 'Regular', priceCents: 599, isDefault: true }],
    },
    {
      category: 'Sides',
      name: 'Elote (Street Corn)',
      variations: [{ name: 'Regular', priceCents: 449, isDefault: true }],
    },
    {
      category: 'Drinks',
      name: 'Mexican Coke',
      variations: [{ name: 'Bottle', priceCents: 299, isDefault: true }],
    },
    {
      category: 'Drinks',
      name: 'Horchata',
      variations: [{ name: 'Regular', priceCents: 349, isDefault: true }],
    },
  ];

  console.info(`[seed] inserting ${items.length} items + variations…`);
  for (const item of items) {
    const [inserted] = await db
      .insert(menuItems)
      .values({
        categoryId: cat(item.category),
        name: item.name,
        description: item.description ?? null,
      })
      .returning();
    if (!inserted) throw new Error(`failed to insert item: ${item.name}`);

    await db.insert(menuItemVariations).values(
      item.variations.map((v) => ({
        itemId: inserted.id,
        name: v.name,
        priceCents: v.priceCents,
        isDefault: v.isDefault ?? false,
      })),
    );

    // A couple of sample modifiers on the Sonoran Dog to exercise the table.
    if (item.name === 'Sonoran Dog') {
      await db.insert(menuModifiers).values([
        { itemId: inserted.id, name: 'Extra beans', priceCentsDelta: 100 },
        { itemId: inserted.id, name: 'No onion', priceCentsDelta: 0 },
        { itemId: inserted.id, name: 'Add cheese', priceCentsDelta: 150 },
      ]);
    }
  }

  console.info('[seed] done.');
  await sql.end();
}

main().catch(async (err) => {
  console.error('[seed] failed:', err);
  await sql.end();
  process.exit(1);
});
