import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  type User,
} from "firebase/auth/web-extension";
import { auth } from "./firebase";

export function signIn(email: string, password: string): Promise<void> {
  return signInWithEmailAndPassword(auth, email, password).then(() => undefined);
}

export async function signInWithGoogle(): Promise<void> {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  if (!clientId) throw new Error("VITE_GOOGLE_CLIENT_ID not set in extension/.env");

  // Path suffix, not the bare origin. getRedirectURL() with no argument returns
  // "https://<id>.chromiumapp.org/" with a trailing slash, and the Google Cloud
  // console strips that slash when you register it -- so the exact-string match
  // at the auth endpoint always fails with redirect_uri_mismatch. A path segment
  // registers verbatim and matches.
  const redirectUrl = chrome.identity.getRedirectURL("oauth2");

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUrl);
  authUrl.searchParams.set("response_type", "token");
  authUrl.searchParams.set("scope", "email profile openid");

  const responseUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow(
      { url: authUrl.toString(), interactive: true },
      (url) => {
        if (chrome.runtime.lastError || !url) {
          reject(new Error(chrome.runtime.lastError?.message ?? "Sign-in cancelled"));
        } else {
          resolve(url);
        }
      }
    );
  });

  const params = new URLSearchParams(new URL(responseUrl).hash.slice(1));
  const accessToken = params.get("access_token");
  if (!accessToken) throw new Error("No access token in response");

  const credential = GoogleAuthProvider.credential(null, accessToken);
  await signInWithCredential(auth, credential);
}

export function signOut(): Promise<void> {
  return fbSignOut(auth);
}

export function subscribeToAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}
