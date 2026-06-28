export interface CachedPersona {
  persona: unknown;
  generatedAt: number;
  reviewCount: number;
}

export interface PersonaCacheDeps {
  read(companyId: string): Promise<CachedPersona | null>;
  write(companyId: string, entry: CachedPersona): Promise<void>;
  generate(companyId: string): Promise<unknown>;
  now(): number;
  ttlMs: number;
}

/** Return a cached persona when fresh and the review count is unchanged; otherwise regenerate. */
export async function getOrCreatePersona(
  companyId: string,
  reviewCount: number,
  deps: PersonaCacheDeps,
): Promise<unknown> {
  const cached = await deps.read(companyId);
  const fresh =
    cached &&
    cached.reviewCount === reviewCount &&
    deps.now() - cached.generatedAt < deps.ttlMs;
  if (fresh) return cached!.persona;

  const persona = await deps.generate(companyId);
  await deps.write(companyId, { persona, generatedAt: deps.now(), reviewCount });
  return persona;
}
