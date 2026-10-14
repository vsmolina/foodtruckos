// "Raíces / Roots" video series. Add an episode by filling in `youtubeId`
// (the part after watch?v=). Episodes without an id show as "coming soon".
export type Episode = { number: number; title: string; titleEs: string; youtubeId: string | null; blurb: string };

export const RAICES_EPISODES: Episode[] = [
  { number: 1, title: 'Where it starts', titleEs: 'Donde empieza', youtubeId: null, blurb: 'PLACEHOLDER — Michoacán, family, and the first burger.' },
  { number: 2, title: 'Night shift', titleEs: 'El turno de noche', youtubeId: null, blurb: 'PLACEHOLDER — a night on the Square, from prep to last call.' },
  { number: 3, title: 'The bun', titleEs: 'El bolillo', youtubeId: null, blurb: 'PLACEHOLDER — building our own bolillo-style bun.' },
];
