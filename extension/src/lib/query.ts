import { PageContext } from "../shared/messages";
import { LookupInput } from "./api";

/** Turn captured page context into the endpoint's lookup input, omitting empty fields. */
export function buildLookupInput(ctx: PageContext): LookupInput {
  const input: LookupInput = {};
  if (ctx.hostname) input.domain = ctx.hostname;
  if (ctx.selection) input.name = ctx.selection;
  return input;
}
