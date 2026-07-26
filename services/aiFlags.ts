import { getFunctions, httpsCallable } from "firebase/functions";
import { AccountFlag } from "./accountFlags";

/**
 * Free-text flags for a company. The server reads the corpus from Firestore
 * itself - we send only the company ID, never review content. Returns [] on
 * any failure; the structured flags carry the panel without this.
 */
export const getAiFlags = async (companyId: string): Promise<AccountFlag[]> => {
  try {
    const functions = getFunctions(undefined, "australia-southeast1");
    const fn = httpsCallable<{ companyId: string }, { flags: AccountFlag[] }>(
      functions,
      "getAccountFlags",
    );
    const result = await fn({ companyId });
    return result.data.flags ?? [];
  } catch (error) {
    console.error("Flag extraction failed:", error);
    return [];
  }
};
