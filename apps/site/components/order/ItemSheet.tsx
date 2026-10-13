'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { cx } from '@/lib/cx';
import { price, money } from '@/lib/format';
import type { MenuItem } from '@/lib/menu';
import { NOTE_MAX, QTY_MAX, type CartLine } from '@/lib/orders/cart';

// Item customization sheet: size, options, quantity, a short note. Opens as a
// bottom sheet on phones and a centered card on desktop (native <dialog>, so
// focus trapping, Esc and the backdrop come for free).

export function ItemSheet({ item, onClose, onAdd }: { item: MenuItem | null; onClose: () => void; onAdd: (line: CartLine) => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (item && !d.open) d.showModal();
    if (!item && d.open) d.close();
  }, [item]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="item-sheet-title"
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none bg-transparent p-0 backdrop:bg-black/65 sm:m-auto sm:max-w-lg"
    >
      {item ? <SheetBody key={item.id} item={item} onClose={onClose} onAdd={onAdd} /> : null}
    </dialog>
  );
}

function SheetBody({ item, onClose, onAdd }: { item: MenuItem; onClose: () => void; onAdd: (line: CartLine) => void }) {
  const [variationId, setVariationId] = useState(item.variations[0]!.id);
  const [picked, setPicked] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);

  const variation = item.variations.find((v) => v.id === variationId)!;
  const options = item.modifierGroups.flatMap((g) => g.options);
  const unit = variation.priceCents + picked.reduce((s, id) => s + (options.find((o) => o.id === id)?.priceCents ?? 0), 0);
  const missing = item.modifierGroups.filter((g) => g.required && !g.options.some((o) => picked.includes(o.id)));

  function toggle(groupName: string, optionId: string) {
    const group = item.modifierGroups.find((g) => g.name === groupName)!;
    setPicked((prev) => {
      if (prev.includes(optionId)) return prev.filter((p) => p !== optionId);
      const inGroup = prev.filter((p) => group.options.some((o) => o.id === p));
      if (group.max === 1) return [...prev.filter((p) => !inGroup.includes(p)), optionId];
      if (group.max != null && inGroup.length >= group.max) return prev;
      return [...prev, optionId];
    });
  }

  function add() {
    setTried(true);
    if (missing.length) return;
    const trimmed = note.trim();
    onAdd({ variationId, modifierIds: picked, qty, ...(trimmed ? { note: trimmed } : {}) });
    onClose();
  }

  return (
    <div className="pop-in flex max-h-[92dvh] flex-col rounded-t-lg border-[length:var(--line)] border-outline bg-paper text-paper-ink shadow-hard-lg sm:rounded-md">
      <div className="flex items-start justify-between gap-3 border-b-[length:var(--line-thin)] border-outline p-4">
        <div>
          <h2 id="item-sheet-title" className="font-display text-h3 uppercase">
            {item.name}
          </h2>
          {item.taglineEs ? <p className="font-hand text-lg text-[#b3261e]">{item.taglineEs}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="press shadow-hard-sm grid h-11 w-11 shrink-0 place-items-center rounded-sm border-[length:var(--line-thin)] border-outline bg-paper"
        >
          <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
            <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex flex-col gap-5 overflow-y-auto p-4">
        {item.photoUrl ? (
          <div className="relative aspect-[16/9] overflow-hidden border-[length:var(--line-thin)] border-outline">
            <Image src={item.photoUrl} alt="" fill sizes="(min-width: 640px) 512px, 100vw" className="object-cover" />
          </div>
        ) : null}
        {item.description ? <p className="text-base">{item.description}</p> : null}

        {item.variations.length > 1 ? (
          <fieldset>
            <legend className="mb-2 font-bold">Size</legend>
            <div className="flex flex-wrap gap-2">
              {item.variations.map((v) => (
                <label
                  key={v.id}
                  className={cx(
                    'press shadow-hard-sm flex min-h-12 cursor-pointer items-center gap-2 rounded-sm border-[length:var(--line-thin)] border-outline px-3 font-bold',
                    v.id === variationId ? 'bg-marigold' : 'bg-paper',
                  )}
                >
                  <input type="radio" name="size" className="sr-only" checked={v.id === variationId} onChange={() => setVariationId(v.id)} />
                  {v.name} · {price(v.priceCents)}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        {item.modifierGroups.map((g) => {
          const inGroup = picked.filter((p) => g.options.some((o) => o.id === p)).length;
          const atMax = g.max != null && g.max > 1 && inGroup >= g.max;
          const showError = tried && missing.includes(g);
          return (
            <fieldset key={g.name} aria-describedby={showError ? `grp-${g.name}-err` : undefined}>
              <legend className="mb-2 flex flex-wrap items-baseline gap-x-2 font-bold">
                {g.name}
                <span className="text-sm font-normal text-[#5e5248]">
                  {g.required ? 'Required' : 'Optional'}
                  {g.max === 1 ? ' · pick one' : g.max ? ` · up to ${g.max}` : ''}
                </span>
              </legend>
              <ul className="flex flex-col gap-1.5">
                {g.options.map((o) => {
                  const on = picked.includes(o.id);
                  return (
                    <li key={o.id}>
                      <label
                        className={cx(
                          'flex min-h-12 cursor-pointer items-center gap-3 rounded-sm border-[length:var(--line-thin)] border-outline px-3',
                          on ? 'bg-marigold' : 'bg-paper',
                          !on && atMax && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <input
                          type={g.max === 1 ? 'radio' : 'checkbox'}
                          name={`grp-${g.name}`}
                          checked={on}
                          disabled={!on && atMax}
                          onChange={() => toggle(g.name, o.id)}
                          className="h-5 w-5 accent-[#14110e]"
                        />
                        <span className="flex-1 font-bold">{o.name}</span>
                        {o.priceCents ? <span className="tabular-nums">+{money(o.priceCents)}</span> : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
              {showError ? (
                <p id={`grp-${g.name}-err`} role="alert" className="mt-1.5 text-sm font-bold text-[#b3261e]">
                  ✕ Choose an option here.
                </p>
              ) : null}
            </fieldset>
          );
        })}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="item-note" className="font-bold">
            Note for the cook <span className="font-normal text-[#5e5248]">(optional)</span>
          </label>
          <textarea
            id="item-note"
            value={note}
            maxLength={NOTE_MAX}
            rows={2}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Allergies, cut in half…"
            className="block w-full rounded-sm border-[length:var(--line-thin)] border-outline bg-paper px-3 py-2 text-base shadow-hard-sm"
          />
          <p className="text-right text-xs text-[#5e5248]">
            {note.length}/{NOTE_MAX}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t-[length:var(--line-thin)] border-outline p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center rounded-sm border-[length:var(--line-thin)] border-outline bg-paper" role="group" aria-label="Quantity">
          <button type="button" className="h-12 w-11 text-xl font-bold disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="One less">
            −
          </button>
          <span className="w-8 text-center text-lg font-bold tabular-nums" aria-live="polite">
            {qty}
          </span>
          <button type="button" className="h-12 w-11 text-xl font-bold disabled:opacity-40" onClick={() => setQty((q) => Math.min(QTY_MAX, q + 1))} disabled={qty >= QTY_MAX} aria-label="One more">
            +
          </button>
        </div>
        <Button type="button" onClick={add} className="flex-1">
          Add · {money(unit * qty)}
        </Button>
      </div>
    </div>
  );
}
