# Google Play — listing & submission

Merged store listing copy + submission checklist.

## Listing

**App name:** Denario — Smart Budget Tracker
**Category:** Finance · **Content rating:** Everyone

**Short description (≤80):**
Track expenses effortlessly with voice, receipts, and AI-powered insights.

**Promo text (≤80):**
AI-powered expense tracking. Voice, receipts, insights.

**Full description:**

**Denario: Your Personal Finance Companion**

Take control of your spending with Denario, the intelligent budget tracker that
makes expense logging effortless — on the go or when reviewing your finances.

**🎤 Voice-powered logging** — Speak your expense and let AI do the work.
"Twenty-five bucks at McDonald's" — done. No typing.

**📸 Smart receipt scanning** — Snap a receipt and Denario reads the vendor and
total automatically (optional itemization), ready for you to confirm.

**⌨️ Type it your way** — One sentence, multiple expenses: "30 super, 15 taxi" logs
both, categorized.

**📊 Visual insights** — 31-day spending heatmap, category breakdowns, real-time
daily totals, weekly trend.

**🧠 Learns your habits** — Correct a category once and Denario remembers the
vendor next time.

**✏️ Full control** — Edit/delete any transaction, custom categories, multi-currency.

**🔒 Secure & private** — Encrypted in transit and at rest; voice/receipt data is
processed transiently, not permanently stored. No ads, no subscriptions.

**🌙 Beautiful design** — Minimalist interface with automatic dark mode.

**Tags:** budget, expense tracker, finance, voice input, receipt scanner, money
management, personal finance, AI expense tracking

**Support email:** <REPLACE_WITH_YOUR_EMAIL>
**Privacy Policy URL:** host `docs/privacy-policy.en.md` publicly and put the URL here.

## Assets
- [x] App icon 512×512 — `assets/icon.png`
- [x] Adaptive icon — `assets/adaptive-icon.png`
- [ ] Feature graphic 1024×500 — **create** (app name + key features, dark theme #0a0a0a)
- [ ] Screenshots (2–8, 1080×1920/2340): home + daily total, voice recording,
      receipt scan, transaction edit, categories, dashboard breakdown, heatmap, profile

## Submission checklist
- [ ] Bump `app.json` version / let EAS auto-increment `versionCode`
- [ ] Confirm permissions + usage strings in `app.json`
- [ ] Build AAB: `eas build --platform android --profile production`
- [ ] Create Play Console app ($25 one-time), category Finance
- [ ] Upload AAB, release notes, countries, pricing (Free)
- [ ] Add privacy policy URL + complete content rating
- [ ] Upload feature graphic + screenshots
- [ ] Internal testing → review on real devices → submit

## Data Safety form (Play Console)
Declare these honestly — Google scrutinizes finance apps.

**Data collected & linked to the user:**
- Email address (account / auth) — for app functionality. Required.
- Financial info: transaction amounts, vendors, categories — app functionality. Required.
- Audio (voice memos) — processed to extract an expense, **not** stored. Optional (voice feature).
- Photos (receipts) — processed to extract an expense, **not** stored. Optional (scan feature).

**Practices:**
- Encrypted in transit (HTTPS/TLS). Yes.
- Users can request deletion: **Yes — in-app** (Profile → Delete Account) and by email.
- Shared with third parties: processors only — **Supabase** (storage/auth) and
  **Google Gemini** (parsing voice/text/receipts). Not sold; not used for ads.

## Account deletion (required)
Google requires apps with sign-in to let users delete their account + data.
Denario does this **in-app**: Profile → **Delete Account** → calls the
`delete-account` edge function, which removes the user's row (cascading all their
categories, transactions and learning rules) and the auth user. Mention this in
the listing and add a deletion-request URL/email for the web requirement.

## Notes
- The Gemini key is **not** embedded in the app (it's a server-side Supabase
  secret) — see `docs/SECURITY.md`. Earlier listing notes claiming otherwise are
  obsolete.
- Replace the support email placeholder before submitting.
