import type { SVGProps } from 'react';

// Hand-drawn marks, drawn as single wobbly strokes so they read as marker on
// paper. All use currentColor and pathLength=1 so the `draw` utility can animate
// them in. Exported as files too: public/brand/*.svg (scripts/export-doodles.ts).

type P = SVGProps<SVGSVGElement> & { title?: string };

function Svg({ title, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const DOODLE_PATHS = {
  underline:
    'M4 14 C 40 8, 78 6, 118 9 S 196 13, 236 7',
  underlineDouble:
    'M3 10 C 52 5, 120 4, 237 8 M18 19 C 70 14, 150 13, 222 17',
  circle:
    'M112 8 C 54 4, 10 22, 8 46 C 6 72, 60 86, 122 82 C 186 78, 234 62, 230 38 C 226 12, 160 2, 96 10 C 70 13, 48 18, 34 26',
  arrow:
    'M8 12 C 30 40, 60 58, 104 60 M86 44 C 94 50, 100 56, 105 61 C 96 64, 88 68, 80 74',
  arrowDown: 'M30 6 C 22 26, 24 50, 32 74 M18 60 C 24 66, 29 71, 32 75 C 36 68, 40 63, 46 58',
  star:
    'M40 6 L 49 30 L 74 31 L 54 47 L 62 72 L 40 57 L 18 72 L 26 47 L 6 31 L 31 30 Z',
  burst:
    'M50 4 L 58 26 L 80 14 L 72 37 L 96 42 L 74 54 L 88 74 L 64 68 L 60 94 L 48 74 L 30 92 L 30 68 L 6 72 L 22 52 L 4 38 L 28 34 L 20 12 L 42 24 Z',
  scribble:
    'M6 30 C 20 6, 30 46, 44 22 S 66 40, 78 18 S 100 44, 114 20 S 134 38, 146 24',
  zigzag:
    'M0 12 L 12 4 L 24 14 L 36 4 L 48 14 L 60 4 L 72 14 L 84 4 L 96 14 L 108 4 L 120 14',
} as const;

export function Underline(props: P) {
  return (
    <Svg viewBox="0 0 240 20" preserveAspectRatio="none" strokeWidth={5} {...props}>
      <path d={DOODLE_PATHS.underline} pathLength={1} />
    </Svg>
  );
}

export function UnderlineDouble(props: P) {
  return (
    <Svg viewBox="0 0 240 24" preserveAspectRatio="none" strokeWidth={4} {...props}>
      <path d={DOODLE_PATHS.underlineDouble} pathLength={1} />
    </Svg>
  );
}

export function Circle(props: P) {
  return (
    <Svg viewBox="0 0 240 90" preserveAspectRatio="none" strokeWidth={4} {...props}>
      <path d={DOODLE_PATHS.circle} pathLength={1} />
    </Svg>
  );
}

export function Arrow(props: P) {
  return (
    <Svg viewBox="0 0 112 80" strokeWidth={4.5} {...props}>
      <path d={DOODLE_PATHS.arrow} pathLength={1} />
    </Svg>
  );
}

export function ArrowDown(props: P) {
  return (
    <Svg viewBox="0 0 52 80" strokeWidth={4.5} {...props}>
      <path d={DOODLE_PATHS.arrowDown} pathLength={1} />
    </Svg>
  );
}

export function Star(props: P & { filled?: boolean }) {
  const { filled = true, ...rest } = props;
  return (
    <Svg viewBox="0 0 80 78" strokeWidth={4} {...rest}>
      <path d={DOODLE_PATHS.star} fill={filled ? 'currentColor' : 'none'} stroke="var(--outline)" />
    </Svg>
  );
}

export function Burst({ children, className, ...rest }: P & { children?: React.ReactNode }) {
  return (
    <span className={`inline-grid place-items-center ${className ?? 'relative'}`}>
      <Svg viewBox="0 0 100 98" strokeWidth={3.5} className="absolute inset-0 h-full w-full" {...rest}>
        <path d={DOODLE_PATHS.burst} fill="currentColor" stroke="var(--outline)" />
      </Svg>
      <span className="relative">{children}</span>
    </span>
  );
}

export function Scribble(props: P) {
  return (
    <Svg viewBox="0 0 152 48" strokeWidth={4} {...props}>
      <path d={DOODLE_PATHS.scribble} pathLength={1} />
    </Svg>
  );
}

/** Section divider: a hand-cut zigzag ribbon. */
export function ZigzagDivider({ className }: { className?: string }) {
  return (
    <div aria-hidden className={`overflow-hidden ${className ?? ''}`}>
      <svg viewBox="0 0 120 18" preserveAspectRatio="none" className="h-4 w-full text-marigold" fill="none">
        <path d={DOODLE_PATHS.zigzag} stroke="currentColor" strokeWidth={3.5} strokeLinejoin="round" />
      </svg>
    </div>
  );
}
