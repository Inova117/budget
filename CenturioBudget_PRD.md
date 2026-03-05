# Project Requirements Document (PRD): CenturioBudget (Working Title)

## 1. Product Objectives
**Core Philosophy:** "Invisible Input" — The user must exert near-zero effort to track expenses. The application handles the heavy lifting of parsing, categorization, and data entry.
**North Star Metric:** **Time-to-Log (TTL).** The total time elapsed from the user's intent to record an expense to the expense appearing correctly categorized on the dashboard. Our target TTL is under 7 seconds from the start of voice/text input. 
**Secondary Metric:** **Zero-Touch Accuracy.** The percentage of entries correctly parsed and categorized without requiring subsequent manual correction by the user.

## 2. User Stories: The "Input-to-Dashboard" Journey
* **Single-Sentence Multi-Logging (Text):** As a user, I want to type "Spent $15 at Starbucks and $60 on gas" into a single input field, so that both expenses are individually logged, timestamped, and categorized instantly.
* **On-the-Go Voice Logging (Voice):** As a user walking out of a store, I want to tap one button and say "30 bucks for groceries at Whole Foods," so I don't have to navigate forms while my hands are full.
* **Real-Time Dashboard Update:** As a user, I want the dashboard to visually update the moment my voice/text input is processed, providing immediate confirmation of my budget status without needing to refresh.
* **Smart Correction:** As a user, if the AI miscategorizes "Apple" as groceries instead of electronics, I want to correct it once with a single tap, so the app learns my specific spending habits for the future.

## 3. Functional Requirements

### NLP Engine
| Requirement | Description | Success Criteria |
| :--- | :--- | :--- |
| **Multi-Entity Extraction** | Extract multiple amounts, vendors, and items from a single compound sentence. | Correctly parses "Spent $50 at McDonalds, $32 on clothes, and $18 on ice cream" into three distinct line items. |
| **Implicit Currency/Amount Handling** | Understand colloquialisms ("bucks", "grand", no currency mentioned). | Accurate conversion of "five bucks" to `$5.00`. |
| **Fuzzy Vendor Matching** | Identify vendor names even with slight typos or conversational phrasing ("Mickey D's", "Target"). | Maps spoken vernacular to canonical vendor names in the database. |

### Categorization Logic
| Requirement | Description | Success Criteria |
| :--- | :--- | :--- |
| **Zero-Shot Categorization** | AI accurately guesses the category of a new vendor based on semantic meaning. | "Ice cream" automatically categorizes to "Dining/Snacks". |
| **Habit Learning (Personalization)** | The system learns from user corrections and overrides generic defaults. | If a user categorizes "Target" under "Groceries", future Target trips default to "Groceries" for them. |
| **Confidence Scoring** | Evaluates its own categorization and flags low-confidence items. | Items with `< 85%` confidence show a subtle UI indicator (e.g., a dot) for 1-tap review. |

### Dashboard Specs
| Requirement | Description | Success Criteria |
| :--- | :--- | :--- |
| **"Breathe" Interface** | Extreme minimalist layout. No tabs, no complex charts. A single focal point showing contextual budget. | Dashboard loads with `<= 3` primary visual elements (Input method, Safe-to-Spend number, Recent list). |
| **Real-Time Hydration** | Live updates via WebSockets or Optimistic UI updates. | Dashboard state updates within 500ms of NLP processing completion. |
| **Glanceability** | Information hierarchy designed to be comprehended instantly. | User can ascertain budget health in `< 2` seconds of looking at the screen. |

## 4. Technical Architecture

### Voice-to-Text (STT) & LLM Parsing Layer
* **Client-Side Capture:** Native audio recording or Web Audio API. Immediate optimistic UI feedback (subtle listening animation, "Processing...").
* **STT Processing:** Fast transcription using high-fidelity APIs (e.g., Whisper API, Deepgram).
* **LLM Parsing (The "Brain"):**
    * Structure: Pass transcript to a fast LLM (e.g., Gemini 1.5 Flash, GPT-4o-mini) enforcing a strict JSON schema output.
    * Output Schema: `[{ amount: number, vendor: string, inferred_category: string, raw_text_segment: string }]`
    * Orchestration: Use serverless edge functions to keep latency extremely low between STT output and LLM input.

### Database Schema (High-Level)
* **`Users`**: `id`, `preferences` (currency, timezone), `created_at`
* **`Transactions`**: `id`, `user_id`, `amount` (decimal), `vendor_name` (string), `category_id` (fk), `raw_transcript` (string - for training/debugging), `timestamp` (datetime), `needs_review` (boolean).
* **`Categories`**: `id`, `user_id` (nullable for global vs custom), `name`, `icon`.
* **`Learning_Rules`**: `id`, `user_id`, `vendor_pattern`, `enforced_category_id`, `weight/confidence`.

## 5. UX/UI Design Principles
* **Typography-Focused:** Rely on font weight, size, and beautiful kerning to establish hierarchy, rather than traditional cards, boxes, and borders. Use a modern, ultra-clean sans-serif (e.g., Inter, Geist, or SF Pro).
* **Negative Space (Whitespace):** Let the numbers breathe. Generous padding around the primary budget metric. The emptiness of the screen should invoke a feeling of calm.
* **Monochrome Foundation:** Use black, white, and varying shades of gray. Color is functional, not decorative. Use fluid, subtle gradients or a single accent color strictly to guide the eye to actionable items or warnings (e.g., spending limits).
* **Low Cognitive Load:** The default view asks for absolutely nothing. The primary CTA is simply a microphone icon floating softly, or an invisible text input that auto-focuses upon opening.

## 6. Success Metrics
* **Task Success Rate:** `> 95%` of inputted transactions require zero manual editing/correction by the user.
* **Session Duration:** *Decrease* in average session time. A successful interaction should take less than 10 seconds. "Less time in app" is a positive metric here.
* **User Retention (DAU/MAU):** Increased retention directly tied to the removal of the traditional spreadsheet "record-keeping" chore.
* **Correction Halving Rate:** The number of manual categorizations per user should drop by 50% after the first week of usage due to the Habit Learning engine.

## 7. MVP High-Level Roadmap

**Phase 1: Foundation & "Invisible Input" Engine (Weeks 1-2)**
* Define and setup Database Schema (e.g., Supabase, PostgreSQL) and basic Auth.
* Prompt Engineering: Develop the core LLM prompt and strict JSON extraction logic.
* API: Build the endpoint to accept text, query the LLM, and insert into the database.

**Phase 2: Interface & Voice Integration (Weeks 3-4)**
* Build the minimalist "Breathe" Dashboard UI.
* Integrate Audio capture and STT (Speech-to-Text) module.
* Connect the optimistic UI update loop from the backend to the frontend.

**Phase 3: Learning Logic & Beta Polish (Weeks 5-6)**
* Implement the custom user `Learning_Rules` logic (vendor -> category overrides).
* Polish typography, micro-interactions (e.g., the recording waveform), and layout spacing.
* Launch closed beta to test Zero-Friction performance on real-world spending sentences.
