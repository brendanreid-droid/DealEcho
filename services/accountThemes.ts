import { getFunctions, httpsCallable } from "firebase/functions";

export interface AccountTheme {
  theme: string;
  reviewIds: string[];
}

/**
 * Recurring themes across review free text. The server reads the corpus from
 * Firestore itself - we send only the company ID, never review content.
 * Returns [] on any failure; Layers A and C carry the panel without this.
 */
export const getAccountThemes = async (companyId: string): Promise<AccountTheme[]> => {
  try {
    const functions = getFunctions(undefined, "australia-southeast1");
    const fn = httpsCallable<{ companyId: string }, { themes: AccountTheme[] }>(
      functions,
      "getAccountThemes",
    );
    const result = await fn({ companyId });
    return result.data.themes ?? [];
  } catch (error) {
    console.error("Theme extraction failed:", error);
    return [];
  }
};
