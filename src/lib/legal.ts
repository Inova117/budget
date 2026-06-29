// Public URLs of the hosted legal documents (the static site in /web).
//
// Public base URL of the hosted legal site (the /web folder, deployed to Netlify).
// These URLs are shown to users in the signup consent and in the Profile screen,
// and must match the URLs you put in Google Play Console. If you later move to a
// custom domain, update this one constant.
const BASE = 'https://zerionbudget.netlify.app';

export const LEGAL_URLS = {
    privacy: `${BASE}/legal/privacy.html`,
    terms: `${BASE}/legal/terms.html`,
    disclaimer: `${BASE}/legal/disclaimer.html`,
    deleteAccount: `${BASE}/legal/eliminar-cuenta.html`,
    cookies: `${BASE}/legal/cookies.html`,
} as const;
