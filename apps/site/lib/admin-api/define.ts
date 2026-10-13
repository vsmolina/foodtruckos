import type { ApiResult, SiteOpName, SiteOpOutput, SiteOps } from '@barrio/site-contract';

/** Files from a multipart request, by part name. Empty for JSON requests. */
export type OpFiles = Map<string, File[]>;

export type OpContext = { files: OpFiles };

/**
 * One op's server implementation. Input is untrusted JSON: every handler
 * validates it (Zod) before use.
 */
export type OpHandler<K extends SiteOpName> = (input: unknown, ctx: OpContext) => Promise<ApiResult<SiteOpOutput<K>>>;

/** An area's handlers: exactly the ops named `<area>.*` in the contract. */
export type AreaHandlers<Ops extends Partial<SiteOps>> = { [K in keyof Ops & SiteOpName]: OpHandler<K> };

export const firstFile = (ctx: OpContext, name: string): File | null => ctx.files.get(name)?.[0] ?? null;
