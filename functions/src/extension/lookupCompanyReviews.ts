import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { GoogleGenAI } from "@google/genai";
import { resolveCompany, ResolverDeps } from "./resolver";
import { CompanyRef } from "./matching";
import { isProRole } from "./gating";
import { getOrCreatePersona } from "./personaCache";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const PERSONA_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const lookupCompanyReviews = onCall(
  { cors: true, secrets: [GEMINI_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in to use DealEcho.");
    }
    const domain = typeof request.data?.domain === "string" ? request.data.domain : undefined;
    const name = typeof request.data?.name === "string" ? request.data.name : undefined;
    if (!domain && !name) {
      throw new HttpsError("invalid-argument", "A domain or name is required.");
    }
    if ((domain && domain.length > 500) || (name && name.length > 500)) {
      throw new HttpsError("invalid-argument", "Query too long.");
    }

    const apiKey = GEMINI_API_KEY.value();
    const ai = apiKey && !apiKey.includes("PLACEHOLDER") ? new GoogleGenAI({ apiKey }) : null;

    // ── Build real resolver deps ────────────────────────────────────────────
    const deps: ResolverDeps = {
      async lookupDomainCache(d) {
        const snap = await db.doc(`company_domains/${d}`).get();
        return snap.exists ? (snap.data() as CompanyRef) : null;
      },
      async saveDomainCache(d, ref) {
        await db.doc(`company_domains/${d}`).set(
          { ...ref, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true },
        );
      },
      async listCompanyNames() {
        // Distinct {companyId, companyName} from public review_summaries.
        const snap = await db.collection("review_summaries").get();
        const seen = new Map<string, CompanyRef>();
        snap.forEach((doc) => {
          const d = doc.data();
          if (d["companyId"] && d["companyName"] && !seen.has(d["companyId"])) {
            seen.set(d["companyId"], { companyId: d["companyId"], companyName: d["companyName"] });
          }
        });
        return [...seen.values()];
      },
      async canonicalizeViaAI(query) {
        if (!ai) return null;
        try {
          const resp = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `What company is at or named "${query}"? Respond ONLY with minified JSON {"name": string, "domain": string}.`,
            config: { tools: [{ googleSearch: {} }] },
          });
          const text = (resp.text ?? "").replace(/```json|```/g, "").trim();
          const parsed = JSON.parse(text || "{}");
          return parsed?.name ? { name: parsed.name, domain: parsed.domain } : null;
        } catch {
          return null;
        }
      },
    };

    const company = await resolveCompany({ domain, name }, deps);
    const isPro = isProRole(request.auth.token.role as string | undefined);
    if (!company) return { matched: false, isPro };

    // ── Aggregate from review_summaries for this company ────────────────────
    const sumSnap = await db
      .collection("review_summaries")
      .where("companyId", "==", company.companyId)
      .get();
    const sums = sumSnap.docs.map((d) => d.data());
    const reviewCount = sums.length;
    const avg = (key: string) =>
      reviewCount ? sums.reduce((a, s) => a + ((s[key] as number) || 0), 0) / reviewCount : 0;
    const ratingKeys = ["communicationRating", "negotiationLevel", "timeWasterLevel", "clarityOfScope"];
    const rating = reviewCount
      ? ratingKeys.reduce((a, k) => a + avg(k), 0) / ratingKeys.length
      : 0;
    const summary = {
      companyId: company.companyId,
      companyName: company.companyName,
      reviewCount,
      rating: Number(rating.toFixed(2)),
      healthIndex: Number((rating * 20).toFixed(0)), // ratings are 1–5 → 20–100 scale
      // Per-element aggregate averages (each 1–5, high = good) for the extension's micro-bars.
      metrics: {
        communicationRating: Number(avg("communicationRating").toFixed(2)),
        negotiationLevel: Number(avg("negotiationLevel").toFixed(2)),
        timeWasterLevel: Number(avg("timeWasterLevel").toFixed(2)),
        clarityOfScope: Number(avg("clarityOfScope").toFixed(2)),
      },
    };

    // ── Persona (cached) ────────────────────────────────────────────────────
    // Degrade gracefully: a persona/Firestore failure should not fail the whole
    // lookup — the rep still gets the summary (and reviews, if Pro).
    let persona: unknown = null;
    if (ai && reviewCount > 0) {
      try {
        persona = await getOrCreatePersona(company.companyId, reviewCount, {
          ttlMs: PERSONA_TTL_MS,
          now: () => Date.now(),
          async read(id) {
            const s = await db.doc(`personas/${id}`).get();
            return s.exists ? (s.data() as any) : null;
          },
          async write(id, entry) {
            await db.doc(`personas/${id}`).set(entry, { merge: true });
          },
          async generate(_companyId) {
            // Feed the actual review excerpts; without them Gemini replies
            // "please provide the review". Excerpts come from public review_summaries.
            const lines = sums
              .map((s) => (typeof s.excerpt === "string" ? s.excerpt.trim() : ""))
              .filter(Boolean)
              .map((e) => `- ${e}`);
            const corpus = lines.length ? lines.join("\n") : "(no review text available)";
            const resp = await ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents:
                `You are a B2B sales strategist. Based only on these ${reviewCount} seller-submitted ` +
                `review excerpt(s) about selling to "${company.companyName}", write a 2-3 sentence ` +
                `buyer-behaviour summary for a sales rep. Do NOT ask for more information — if the ` +
                `evidence is thin, summarise what's available and note it's from limited reports. ` +
                `Plain text only.\n\nReviews:\n${corpus}`,
            });
            return { summary: (resp.text ?? "").trim() };
          },
        });
      } catch (err) {
        console.error(`Persona generation failed for ${company.companyId}:`, err);
      }
    }

    // ── Recent reviews (Pro only) ───────────────────────────────────────────
    let recentReviews: any[] | undefined;
    if (isPro) {
      try {
        const revSnap = await db
          .collection("reviews")
          .where("companyId", "==", company.companyId)
          .get();
        recentReviews = revSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))
          .slice(0, 3);
      } catch (err) {
        console.error(`Recent reviews fetch failed for ${company.companyId}:`, err);
      }
    }

    return {
      matched: true,
      isPro,
      companyId: company.companyId,
      companyName: company.companyName,
      summary,
      persona,
      recentReviews,
    };
  },
);
