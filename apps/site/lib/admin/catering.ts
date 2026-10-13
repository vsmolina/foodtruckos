import 'server-only';
import { revalidatePath } from 'next/cache';
import { count, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { CateringLeadDto, CateringLeadSummary, CateringStage } from '@barrio/site-contract';
import { BUDGETS, DURATIONS, EVENT_TYPES, LEAD_STAGES, MENU_INTERESTS, SERVICE_STYLES, labelFor } from '@/lib/catering';
import { db } from '@/lib/db/client';
import { cateringLeads } from '@/lib/db/schema';
import { fail, invalid, ok, type Result } from './result';

// Catering lead pipeline. No auth here: callers (admin server actions, admin
// API) check it first.

type Lead = typeof cateringLeads.$inferSelect;

function summary(l: Lead): CateringLeadSummary {
  return {
    id: l.id,
    status: l.status,
    name: l.name,
    eventDate: l.eventDate,
    startTime: l.startTime,
    guestCount: l.guestCount,
    eventTypeLabel: labelFor(EVENT_TYPES, l.eventType),
    createdAt: l.createdAt.toISOString(),
  };
}

function detail(l: Lead): CateringLeadDto {
  return {
    ...summary(l),
    phone: l.phone,
    email: l.email,
    durationLabel: labelFor(DURATIONS, l.durationHours),
    location: l.location,
    serviceStyleLabel: labelFor(SERVICE_STYLES, l.serviceStyle),
    menuInterestLabels: l.menuInterests.map((m) => labelFor(MENU_INTERESTS, m)),
    budgetLabel: l.budgetRange ? labelFor(BUDGETS, l.budgetRange) : null,
    notes: l.notes,
    adminNotes: l.adminNotes,
    updatedAt: l.updatedAt.toISOString(),
  };
}

const ListSchema = z.object({ stage: z.enum(LEAD_STAGES).nullish() });

export async function listLeads(
  input: unknown,
): Promise<Result<{ counts: Record<CateringStage, number>; total: number; leads: CateringLeadSummary[] }>> {
  const parsed = ListSchema.safeParse(input ?? {});
  if (!parsed.success) return invalid(parsed.error);
  const stage = parsed.data.stage ?? null;
  const [rows, leads] = await Promise.all([
    db.select({ status: cateringLeads.status, n: count() }).from(cateringLeads).groupBy(cateringLeads.status),
    db
      .select()
      .from(cateringLeads)
      .where(stage ? eq(cateringLeads.status, stage) : undefined)
      .orderBy(desc(cateringLeads.createdAt))
      .limit(200),
  ]);
  const counts = Object.fromEntries(LEAD_STAGES.map((s) => [s, rows.find((r) => r.status === s)?.n ?? 0])) as Record<CateringStage, number>;
  return ok({ counts, total: rows.reduce((a, r) => a + r.n, 0), leads: leads.map(summary) });
}

const IdSchema = z.object({ id: z.uuid() });

export async function getLead(input: unknown): Promise<Result<CateringLeadDto>> {
  const parsed = IdSchema.safeParse(input);
  if (!parsed.success) return fail('That lead doesn’t exist.');
  const [lead] = await db.select().from(cateringLeads).where(eq(cateringLeads.id, parsed.data.id));
  return lead ? ok(detail(lead)) : fail('That lead doesn’t exist.');
}

const UpdateSchema = z.object({
  id: z.uuid(),
  status: z.enum(LEAD_STAGES),
  adminNotes: z.string().max(5000, 'Keep notes under 5,000 characters.').optional(),
});

export async function updateLead(input: unknown): Promise<Result<CateringLeadDto>> {
  const parsed = UpdateSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, status, adminNotes } = parsed.data;
  const [row] = await db
    .update(cateringLeads)
    .set({ status, ...(adminNotes !== undefined ? { adminNotes: adminNotes.trim() || null } : {}) })
    .where(eq(cateringLeads.id, id))
    .returning();
  if (!row) return fail('That lead doesn’t exist.');
  revalidatePath('/', 'layout');
  return ok(detail(row));
}
