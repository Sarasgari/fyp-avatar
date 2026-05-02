# Accessibility and Fallback Evidence

This document audits accessibility and fallback behaviour from the current codebase. Items marked with placeholders require direct test evidence before final submission.

## Accessibility Audit

| Area | Current evidence | Risk / gap | Suggested action | Status |
|---|---|---|---|---|
| Button labels | Main buttons include visible text such as Settings, Dashboard, Sign in, Sign out, Done, Reset defaults. `SiteLogoMark` now uses `role="img"` with `aria-label="Mango"`. | Some icon-heavy controls should be checked for accessible names. | Run Playwright accessibility/name checks or manual keyboard inspection. | Partially improved; full inspection still required. |
| Form labels | Auth inputs and preference checkboxes use labels/ids. | Password reset and auth errors should be checked with screen reader flow. | Add `aria-live` for dynamic error/notice regions if time allows. | [Insert result] |
| Keyboard navigation | Radix dialogs and native buttons generally support keyboard navigation. | Full keyboard walkthrough not yet recorded. | Perform T32 keyboard test and record issues. | [Insert result] |
| Focus visibility | Inputs use focus-visible ring; browser/button focus should be inspected. | Some custom tab buttons may rely on default focus style. | Capture focus screenshot or note limitation. | [Insert result] |
| Reduced motion | Preference exists and Playwright test covers avatar still rendering after reduced motion. | Need qualitative evidence of reduced motion effect. | Record before/after or cite code path in `app/assistant.tsx` and `AvatarCanvas`. | [Insert result] |
| Avatar hiding | Preference allows hiding avatar while chat remains usable. | Needs evidence screenshot. | Capture Avatar hidden screenshot. | [Insert result] |
| Voice disabled | Voice playback toggle exists; text remains available. | Need evidence that audio stops when disabled. | Test scenario T13. | [Insert result] |
| Text alternative to voice | Chat text is always displayed even when audio fails or is disabled. | No captions issue because text is primary. | Mention in accessibility discussion. | Implemented by design. |
| Mobile responsiveness | Existing report screenshot `report-screenshots/figure-a9-mobile-responsive.png`. | Need inspect for overlap and readability. | Use in appendix and note limitations honestly. | [Insert result] |
| Colour contrast | Visual palette appears high contrast in most controls but not formally measured. | Some light blue text may be borderline. | Run browser contrast inspection on key text if possible. | [Insert result] |

## Fallback Evaluation

| Failure condition | Current mechanism | Evidence to collect | Status |
|---|---|---|---|
| WebGL unavailable | `AvatarCanvas` checks WebGL support and sets status to `unsupported`; fallback panel shown. | Browser simulation or mocked WebGL screenshot. | [Insert result] |
| VRM model load failure | GLTF loader error sets status to `error`; fallback panel shown. | Dev test with invalid model path. | [Insert result] |
| Avatar hidden by user | Preferences set `avatarVisible = false`; `AvatarStageHidden` keeps chat available. | Screenshot of hidden avatar state. | [Insert result] |
| TTS provider failure | `/api/tts` attempts ElevenLabs then falls back to OpenAI TTS. | Log output with ElevenLabs failure and OpenAI fallback, or E2E `E2E_TTS_MODE=fail` evidence. | [Insert result] |
| TTS disabled by user | Voice controller clears audio queue and speech state when voice is disabled. | Test T13. | [Insert result] |
| LLM structured response failure | Chat route uses fallback keyword emotion detection and fallback reply generation. | Dev simulation/log evidence. | [Insert result] |
| Invalid input | API validation returns 400/413 errors. | API test output. | [Insert result] |
| Rate limit exceeded | `consumeRateLimit` returns 429 with retry header. | Server unit test output. | Existing server test passed in latest `npm test` run. |
| Storage backend failure | Thread/user stores fall back to memory when shared backend fails. | Unit test or code inspection evidence. | [Insert result] |
| Non-admin dashboard route | Admin visitors route returns 403 for non-admin. | API test output. | [Insert result] |

## Safe Improvement Suggestions

These are safe, small changes that could improve the dissertation evidence if there is time:

1. Add `aria-live="polite"` to auth error/reset notice paragraphs so dynamic messages are announced.
2. Add `aria-label` to any icon-only avatar preview or carousel controls if present after keyboard inspection.
3. Add a development-only route or environment flag to force avatar model failure for screenshot evidence.
4. Add a development-only performance logger guarded by `NODE_ENV !== "production"`.
5. Add a small server test for `/api/admin/visitors` returning 403 to non-admin identities.
6. Add a UI test for voice-disabled mode if Playwright audio constraints make actual playback hard to assert.

## Code Changes Made

The following small, evidence-driven changes were made during this pass:

1. `components/brand/site-logo.tsx` now gives the visual logo mark an explicit `role="img"` alongside its existing accessible label.
2. `components/assistant-ui/persistent-thread.tsx` now clears the guest thread when the session moves from an authenticated user back to a guest owner. This prevents account conversation content from remaining visible after logout.
3. `app/assistant.tsx` had stale unused status-pill code removed during lint cleanup.
4. `biome.json` now ignores `.vercel` local deployment metadata and uses explicit LF formatting so lint results focus on source files.

Latest verification: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` all passed after these changes.
