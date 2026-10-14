import postgres from 'postgres';

// Start from an empty board: retire any tickets left active by a previous test
// (or by manual mock/sandbox testing) so card assertions are deterministic and
// no order lands in the "+N more" overflow. Runs once per run and before each test.
export async function clearBoard(): Promise<void> {
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

export default clearBoard;
