# Testing Evidence Plan

This document defines the evidence needed for Chapter 5. Do not mark a result as passed unless the test has actually been run and evidence has been collected.

## Functional Requirements

| ID | Description | Priority | Evaluation method | Status |
|---|---|---|---|---|
| FR1 | Users can send messages to the AI assistant. | Must | Functional test, scenario test, screenshot | [Insert actual test result] |
| FR2 | The system generates LLM replies. | Must | Functional test, API response evidence | [Insert actual test result] |
| FR3 | Replies include `reply`, `emotion`, and `avatarState`. | Must | API structured response test/log | [Insert actual test result] |
| FR4 | The avatar enters a thinking state after user send. | Must | Scenario test, screenshot/video | [Insert actual test result] |
| FR5 | The avatar enters a talking state during speech playback. | Must | Scenario test, screenshot/video | [Insert actual test result] |
| FR6 | The avatar displays emotional expression/state feedback. | Must | Scenario-based emotion tests | [Insert actual test result] |
| FR7 | Assistant replies can be converted to TTS playback. | Must | Functional test, TTS timing measurement | [Insert actual test result] |
| FR8 | Users can disable voice playback. | Should | Functional/accessibility test | [Insert actual test result] |
| FR9 | Users can select an avatar. | Should | Functional test, screenshot | [Insert actual test result] |
| FR10 | Users can change and save preferences. | Should | E2E test, local storage check | [Insert actual test result] |
| FR11 | The system supports guest access. | Must | Functional/auth test | [Insert actual test result] |
| FR12 | Users can register. | Must | Functional/E2E auth test | [Insert actual test result] |
| FR13 | Users can log in and log out. | Must | Functional/E2E auth test | [Insert actual test result] |
| FR14 | Conversations can be saved. | Must | Persistence test | [Insert actual test result] |
| FR15 | Conversations can be restored after refresh/login. | Must | E2E persistence test | [Insert actual test result] |
| FR16 | Guest thread migrates to account after registration/login. | Should | E2E auth persistence test | Implemented; [Insert latest run result] |
| FR17 | Dashboard shows account/avatar information. | Should | Functional test, screenshot | [Insert actual test result] |
| FR18 | Admin visitor route is protected. | Could | API access test | [Insert actual test result] |
| FR19 | Fallback UI is shown for avatar/TTS/storage failure. | Must | Fallback tests | [Insert actual test result] |

## Non-Functional Requirements

| ID | Description | Priority | Evaluation method | Status |
|---|---|---|---|---|
| NFR1 | Interface is usable and understandable. | Must | Heuristic evaluation, cognitive walkthrough | [Insert inspection result] |
| NFR2 | Layout is responsive on desktop and mobile. | Must | Screenshot and viewport inspection | [Insert actual result] |
| NFR3 | Interface supports accessibility basics. | Must | Keyboard/focus/label/reduced-motion inspection | [Insert inspection result] |
| NFR4 | Reduced motion is supported. | Should | E2E preference test | Implemented; [Insert latest run result] |
| NFR5 | System status is visible. | Should | Heuristic evaluation | [Insert inspection result] |
| NFR6 | Sessions and auth are protected. | Must | Server tests, code inspection | Implemented; [Insert latest run result] |
| NFR7 | Requests are validated. | Must | Unit/API tests, code inspection | [Insert actual result] |
| NFR8 | API usage is rate limited. | Must | Server tests | Implemented; [Insert latest run result] |
| NFR9 | Privacy risks are reduced. | Must | Code inspection: signed cookies, hashed passwords | [Insert inspection result] |
| NFR10 | External-service failure is handled gracefully. | Must | Fallback tests | [Insert actual result] |
| NFR11 | Codebase is modular and maintainable. | Must | Repository audit, lint/typecheck | [Insert command output] |
| NFR12 | Performance/latency is acceptable for prototype. | Should | Timing measurements | [Insert measured value] |
| NFR13 | Browser compatibility is considered. | Should | WebGL fallback inspection | [Insert actual result] |

## MoSCoW Prioritisation

| Priority | Features |
|---|---|
| Must have | Core chat, LLM response, structured metadata, avatar display, avatar thinking/talking/emotional states, TTS, basic persistence, fallback behaviour, validation, rate limiting. |
| Should have | Authentication, avatar selection, preferences, reduced motion, dashboard, guest-to-account migration, clear status indicators. |
| Could have | Admin analytics, advanced avatar customisation, multiple voice styles, richer animation, deeper performance monitoring. |
| Won't have | Motion capture, camera emotion detection, full emotional intelligence, phoneme-level lip-sync, real-time speech-to-speech conversation, production-scale moderation. |

## Full Testing Plan

| Test ID | Requirement ID | Feature | Test type | Steps | Expected result | Actual result | Status | Evidence |
|---|---|---|---|---|---|---|---|---|
| T01 | FR1 | Send valid message | Functional | Open app, type message, submit | Message appears and request is sent | [Insert actual result] | [Pass/Fail] | [Screenshot/log] |
| T02 | FR1,NFR7 | Reject empty message | Functional/input | Attempt to submit empty message/API payload | Empty message is blocked or rejected | [Insert actual result] | [Pass/Fail] | [Screenshot/API output] |
| T03 | NFR7 | Reject too-long message | API validation | Send message over configured length | 413 or validation error returned | [Insert actual result] | [Pass/Fail] | [API output] |
| T04 | FR2,FR3 | Structured response | API/scenario | Send normal prompt | Response includes reply, emotion, avatarState | [Insert actual result] | [Pass/Fail] | [Network/log] |
| T05 | FR4 | Thinking state | Scenario/UI | Send prompt | Avatar/status changes to thinking/replying soon | [Insert actual result] | [Pass/Fail] | [Screenshot/video] |
| T06 | FR5 | Talking state | Scenario/UI | Enable voice, receive reply | Avatar speechState/talking UI appears during audio | [Insert actual result] | [Pass/Fail] | [Screenshot/video] |
| T07 | FR6 | Happy state | Scenario emotion | Input: "I passed my exam!" | Happy/celebration-related state shown | [Insert actual result] | [Pass/Fail] | [Screenshot/video] |
| T08 | FR6 | Sad/empathy state | Scenario emotion | Input: "I feel really sad today." | Sad or empathetic state shown | [Insert actual result] | [Pass/Fail] | [Screenshot/video] |
| T09 | FR6 | Confused state | Scenario emotion | Input: "I do not understand this topic." | Confused/listening state shown | [Insert actual result] | [Pass/Fail] | [Screenshot/video] |
| T10 | FR6 | Angry/frustrated state | Scenario emotion | Input: "This is so frustrating." | Angry/firm or supportive state shown | [Insert actual result] | [Pass/Fail] | [Screenshot/video] |
| T11 | FR6 | Neutral state | Scenario emotion | Input: "Explain what an API is." | Neutral/listening state shown | [Insert actual result] | [Pass/Fail] | [Screenshot/video] |
| T12 | FR7 | TTS playback | Functional | Enable voice, send prompt | Audio plays | [Insert actual result] | [Pass/Fail] | [Screen/audio note] |
| T13 | FR8 | TTS disabled | Functional/accessibility | Disable voice, send prompt | No audio plays; text remains available | [Insert actual result] | [Pass/Fail] | [Screenshot] |
| T14 | FR19,NFR10 | TTS fallback | Fallback | Simulate ElevenLabs failure or use missing config | OpenAI fallback or clear error occurs | [Insert actual result] | [Pass/Fail] | [Log] |
| T15 | FR9 | Avatar selection | Functional | Open dashboard/avatar picker, select avatar | Selected avatar changes | [Insert actual result] | [Pass/Fail] | [Screenshot] |
| T16 | FR19,NFR13 | Avatar load failure fallback | Fallback | Use invalid model path in dev/test | Fallback panel appears, chat usable | [Insert actual result] | [Pass/Fail] | [Screenshot] |
| T17 | FR19,NFR13 | WebGL fallback | Fallback/browser | Simulate no WebGL | Fallback panel appears, chat usable | [Insert actual result] | [Pass/Fail] | [Screenshot] |
| T18 | FR11 | Guest chat | Functional | Open app without login and chat | Guest session works | [Insert actual result] | [Pass/Fail] | [Screenshot] |
| T19 | FR12 | Register | Functional/E2E | Create account | User signed in, account state shown | [Insert actual result] | [Pass/Fail] | [Screenshot/log] |
| T20 | FR13 | Login | Functional/E2E | Log in with existing account | Account session restored | [Insert actual result] | [Pass/Fail] | [Screenshot/log] |
| T21 | FR13 | Logout | Functional/E2E | Sign out | User returns to guest scope | [Insert actual result] | [Pass/Fail] | [Screenshot/log] |
| T22 | FR14 | Conversation save | Persistence | Send message, wait for save | Snapshot saved locally/server | [Insert actual result] | [Pass/Fail] | [Network/storage] |
| T23 | FR15 | Restore after refresh | Persistence | Send message, refresh | Message history restored | [Insert actual result] | [Pass/Fail] | [Screenshot] |
| T24 | FR16 | Guest-to-account migration | E2E | Chat as guest, register, refresh | Guest thread appears in account | Existing Playwright test covers; [Insert run result] | [Pass/Fail] | [Test output] |
| T25 | FR10 | Preferences saving | E2E | Change preference, refresh | Preference persists | [Insert actual result] | [Pass/Fail] | [Test output] |
| T26 | NFR4 | Reduced motion | E2E/accessibility | Enable reduced motion | Avatar remains usable with reduced movement | Existing Playwright test covers; [Insert run result] | [Pass/Fail] | [Test output] |
| T27 | NFR8 | Rate limiting | Server/API | Exceed limit in helper test | Request blocked after limit | Existing server test covers; [Insert run result] | [Pass/Fail] | [Test output] |
| T28 | NFR7,NFR8 | Origin/input validation | Server/API | Use disallowed origin or invalid payload | 403/400 response | Existing server tests cover origin; [Insert run result] | [Pass/Fail] | [Test output] |
| T29 | FR17 | Dashboard access | Functional | Open dashboard | Account/avatar details shown | [Insert actual result] | [Pass/Fail] | [Screenshot] |
| T30 | FR18 | Admin route protection | API/security | Request visitors route as non-admin | 403 returned | [Insert actual result] | [Pass/Fail] | [API output] |
| T31 | NFR2 | Responsive layout | UI inspection | Test desktop and mobile viewports | No major overlap; controls usable | [Insert actual result] | [Pass/Fail] | [Screenshots] |
| T32 | NFR3 | Keyboard accessibility | Accessibility | Navigate controls by keyboard | Main controls reachable/focus visible | [Insert actual result] | [Pass/Fail] | [Inspection notes] |

## Scenario-Based Avatar/Emotion Evaluation

| Scenario ID | User input | Expected emotion | Expected avatar state | Expected speech state | Actual result | Evidence | Pass/fail |
|---|---|---|---|---|---|---|---|
| S01 | "I feel really sad today." | sad or empathetic | sadPose or listening | talking if voice enabled | [Insert actual result] | [Screenshot/video] | [Pass/Fail] |
| S02 | "I passed my exam!" | happy | celebration or listening | talking if voice enabled | [Insert actual result] | [Screenshot/video] | [Pass/Fail] |
| S03 | "I don't understand this topic." | confused | listening/confused | talking if voice enabled | [Insert actual result] | [Screenshot/video] | [Pass/Fail] |
| S04 | "I am really stressed and anxious." | anxious | listening or thinking then anxious | talking if voice enabled | [Insert actual result] | [Screenshot/video] | [Pass/Fail] |
| S05 | "Hi!" | neutral or happy | wave | talking if voice enabled | [Insert actual result] | [Screenshot/video] | [Pass/Fail] |
| S06 | "Explain what an API is." | neutral | listening/idle | talking if voice enabled | [Insert actual result] | [Screenshot/video] | [Pass/Fail] |
| S07 | "This is so frustrating." | angry or empathetic | listening/angry | talking if voice enabled | [Insert actual result] | [Screenshot/video] | [Pass/Fail] |
| S08 | "Thank you, that helped." | happy | listening or celebration | talking if voice enabled | [Insert actual result] | [Screenshot/video] | [Pass/Fail] |
| S09 | "Goodbye." | neutral | wave | talking if voice enabled | [Insert actual result] | [Screenshot/video] | [Pass/Fail] |
| S10 | empty message | none | no new state or validation error | silent | [Insert actual result] | [Screenshot/API] | [Pass/Fail] |
| S11 | very long message | none | validation error | silent | [Insert actual result] | [API output] | [Pass/Fail] |
| S12 | API failure simulation | fallback/none | error or fallback | silent | [Insert actual result] | [Log/screenshot] | [Pass/Fail] |
| S13 | TTS failure simulation | normal metadata | visual state still updates | silent or fallback | [Insert actual result] | [Log/screenshot] | [Pass/Fail] |
| S14 | avatar loading failure simulation | normal chat | fallback avatar panel | talking if TTS works | [Insert actual result] | [Screenshot] | [Pass/Fail] |

## Requirements Traceability Matrix

| Requirement ID | Implementation file/component | Test ID | Evidence figure/table/screenshot | Status |
|---|---|---|---|---|
| FR1 | `components/assistant-ui/thread.tsx`, `app/assistant.tsx` | T01 | Figure A.2 | [Insert status] |
| FR2 | `app/api/chat/route.ts` | T04 | API output/build log | [Insert status] |
| FR3 | `app/api/chat/route.ts`, `lib/chat-response.ts` | T04 | Structured response evidence | [Insert status] |
| FR4 | `app/assistant.tsx`, `components/assistant-ui/thread-voice-controller.tsx` | T05 | Scenario screenshot | [Insert status] |
| FR5 | `components/assistant-ui/thread-voice-controller.tsx`, `components/ui/avatar-canvas.tsx` | T06 | Scenario screenshot/video | [Insert status] |
| FR6 | `lib/avatar-state.ts`, `components/ui/avatar-canvas.tsx` | T07-T11, S01-S09 | Scenario table | [Insert status] |
| FR7 | `app/api/tts/route.ts`, `lib/tts/request-tts.ts` | T12 | TTS timing table | [Insert status] |
| FR8 | `components/preferences/preferences-dialog.tsx` | T13 | Figure A.4 | [Insert status] |
| FR9 | `components/avatar/avatar-picker.tsx`, `lib/avatar-catalog.ts` | T15 | Avatar picker screenshot | [Insert status] |
| FR10 | `lib/preferences.ts`, `components/preferences/preferences-dialog.tsx` | T25,T26 | Test output | [Insert status] |
| FR11 | `lib/server/session.ts`, `app/api/auth/session/route.ts` | T18 | Server test output | [Insert status] |
| FR12 | `app/api/auth/register/route.ts`, `components/auth/account-controls.tsx` | T19 | E2E output | [Insert status] |
| FR13 | `app/api/auth/login/route.ts`, `app/api/auth/logout/route.ts` | T20,T21 | E2E output | [Insert status] |
| FR14 | `components/assistant-ui/persistent-thread.tsx`, `app/api/thread/route.ts` | T22 | Network/storage evidence | [Insert status] |
| FR15 | `components/assistant-ui/persistent-thread.tsx` | T23 | Screenshot | [Insert status] |
| FR16 | `lib/server/thread-store.ts`, `app/api/auth/register/route.ts`, `app/api/auth/login/route.ts` | T24 | Playwright auth persistence output | [Insert status] |
| FR17 | `components/dashboard/user-dashboard.tsx` | T29 | Figure A.3 | [Insert status] |
| FR18 | `app/api/admin/visitors/route.ts` | T30 | API output | [Insert status] |
| FR19 | `components/ui/avatar-canvas.tsx`, `app/api/tts/route.ts`, `lib/server/thread-store.ts` | T14,T16,T17 | Fallback screenshots/logs | [Insert status] |
| NFR1 | Whole UI | Heuristic/cognitive walkthrough | Evaluation table | [Insert status] |
| NFR2 | `app/assistant.tsx`, CSS classes | T31 | Mobile screenshot | [Insert status] |
| NFR3 | UI components, preferences | T32 | Accessibility audit | [Insert status] |
| NFR4 | `lib/preferences.ts`, `components/ui/avatar-canvas.tsx` | T26 | E2E output | [Insert status] |
| NFR5 | `app/assistant.tsx` status pills | Heuristic evaluation | Figure A.1 | [Insert status] |
| NFR6 | `lib/server/auth.ts`, `lib/server/session.ts`, `lib/server/user-store.ts` | Server auth tests | Test output | [Insert status] |
| NFR7 | `app/api/chat/route.ts`, `lib/server/auth.ts` | T02,T03,T28 | API output | [Insert status] |
| NFR8 | `lib/server/api.ts` | T27 | Server test output | [Insert status] |
| NFR9 | Auth/storage modules | Inspection | Ethics/privacy discussion | [Insert status] |
| NFR10 | TTS/avatar/storage fallback modules | T14,T16,T17 | Fallback evidence | [Insert status] |
| NFR11 | Project structure, TypeScript, tests | lint/typecheck/build | Terminal output | [Insert status] |
| NFR12 | Runtime measurement | Performance table | Timing evidence | [Insert status] |
| NFR13 | `components/ui/avatar-canvas.tsx` | T17 | Fallback screenshot | [Insert status] |

## Latest Executed Test Evidence

These results were collected from the local repository on 2026-05-02. They can be copied into Appendix B as command-output evidence, but the actual terminal screenshots should still be captured for the submitted report.

| Command | Result | Evidence meaning |
|---|---|---|
| `npm run lint` | Passed; Biome checked 78 files with no fixes required. | Supports maintainability/code-quality evidence. |
| `npm run typecheck` | Passed. | Confirms TypeScript type consistency. |
| `npm test` | Passed; 39 server/library checks reported `ok`. | Covers rate limiting, origin validation, signed sessions, auth, password reset, preferences, production config, thread storage, thread migration, and user store behaviour. |
| `npm run build` | Passed; Next.js production build compiled successfully and generated 14 static pages plus dynamic API routes. | Supports deployability/build evidence. |
| `npm run test:e2e` | Passed; 3 Chromium E2E tests passed in approximately 3.7 minutes. | Covers guest-to-account conversation migration, login/restore/clear persistence flow under TTS failure mode, logout returning to guest scope, and reduced-motion/avatar visibility behaviour. |

### Failed/Resolved Test Evidence

The E2E suite initially exposed two useful issues during this audit:

1. Earlier tests expected old interface copy such as "Guest session" and did not handle the required first-login avatar picker. The Playwright helpers were updated to use current visible UI text and to continue past avatar selection during register/login flows.
2. A logout test showed that conversation content could remain visible after returning from an authenticated account to a guest session. This was treated as a privacy/session-boundary issue and fixed in `components/assistant-ui/persistent-thread.tsx` by clearing the guest thread when moving from a user owner back to a guest owner.

These resolved failures can be discussed as development challenge evidence rather than hidden. Do not present them as unresolved final defects unless future testing changes the result.
