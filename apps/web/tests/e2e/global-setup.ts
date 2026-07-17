import postgres from 'postgres';

// Start every E2E run from an empty board: retire any tickets left active by a
// previous run (or by manual mock/sandbox testing) so card assertions are
// deterministic and no order lands in the "+N more" overflow.
export default async function globalSetup(): Promise<void> {
  const url =
    process.env.DATABASE_URL ?? 'postgresql://foodtruck:foodtruck@localhost:5432/foodtruck';
  const sql = postgres(url, { max: 1 });
  try {
    await sql`
      update kitchen_tickets
         set state = 'done', completed_at = now()
       where state in ('pending', 'in_progress')
    `;
  } finally {
    await sql.end();
  }
}
