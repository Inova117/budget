// Public URLs of the hosted legal documents (the static site in /web).
//
// TODO(launch): replace BASE with your real public domain once the site is
// deployed. It can be your Netlify URL (e.g. https://centurio.netlify.app) or a
// custom domain. These URLs are shown to users in the signup consent and in the
// Profile screen, and must match the URLs you put in Google Play Console.
const BASE = 'https://centurio.app';

export const LEGAL_URLS = {
    privacy: `${BASE}/legal/privacy.html`,
    terms: `${BASE}/legal/terms.html`,
    disclaimer: `${BASE}/legal/disclaimer.html`,
    deleteAccount: `${BASE}/legal/eliminar-cuenta.html`,
    cookies: `${BASE}/legal/cookies.html`,
} as const;
