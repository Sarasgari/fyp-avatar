# Chapter 5 Evidence and Figures

Use this file as the evidence companion for Chapter 5: Testing and Evaluation. It only includes evidence that was inspected or generated from the current project. Do not claim participant findings, SUS scores, or user feedback.

## 5.1 Testing Strategy Evidence

### Table 5.1: Latest Verification Results

| Evidence item | Command / source | Actual result | How to use in Chapter 5 |
|---|---|---|---|
| Code quality | `npm run lint` | Passed. Biome checked 78 files with no fixes required. | Evidence for maintainability and code quality. |
| Type safety | `npm run typecheck` | Passed. TypeScript completed with no errors. | Evidence that the implementation is type-consistent. |
| Server/library tests | `npm test` | Passed. 39 checks reported `ok`. | Evidence for authentication, sessions, rate limits, origin validation, preferences, thread storage, thread migration, and user store behaviour. |
| Production build | `npm run build` | Passed. Next.js compiled successfully and generated the app plus dynamic API routes. | Evidence that the artefact builds as a production web application. |
| End-to-end tests | `npm run test:e2e` | Passed. 3 Chromium tests passed in about 3.7 minutes. | Evidence for guest-to-account migration, login/restore/clear flow, logout guest boundary, TTS failure mode, reduced motion, and avatar visibility. |

Suggested caption:

**Figure 5.1: Terminal evidence showing successful linting, type checking, automated tests, production build, and Playwright end-to-end testing.**

Evidence note to include:

The latest verification run showed that linting, type checking, server/library tests, production build, and Playwright end-to-end tests all passed. This provides evidence that the artefact was technically stable at the time of evaluation. The end-to-end test suite was executed with mocked chat output and a controlled TTS failure mode, which allowed persistence and fallback behaviour to be tested without relying on live external services.

## 5.2 Functional Testing Figures

### Figure 5.2: Main Interface

File:

`report-screenshots/figure-a1-main-interface.png`

Suggested caption:

**Figure 5.2: Main expressive avatar chat interface showing the avatar stage, chat panel, status indicators, settings, dashboard access, and sign-in controls.**

Use this figure to evidence:

- FR1: send message interface is available.
- FR11: guest access is available.
- NFR1: interface is usable and visually organised.
- NFR5: system status is visible through avatar and voice indicators.

### Figure 5.3: Chat Interaction Evidence

File:

`report-screenshots/figure-a2-chat-interaction.png`

Suggested caption:

**Figure 5.3: Functional chat interaction showing a user message and assistant response within the avatar interface.**

Use this figure to evidence:

- FR1: user can submit a message.
- FR2: assistant response is displayed.
- FR3: structured assistant output is connected to the chat UI.
- FR14: conversation status indicates session/account saving.

### Figure 5.4: Preferences and Accessibility Controls

File:

`report-screenshots/figure-a5-preferences-dialog.png`

Suggested caption:

**Figure 5.4: Preferences dialog showing voice playback, avatar visibility, reduced motion, compact layout, and reset controls.**

Use this figure to evidence:

- FR8: user can disable voice output.
- FR10: preferences are available.
- NFR3: accessibility options are provided.
- NFR4: reduced motion is supported.

### Figure 5.5: Authentication Interface

File:

`report-screenshots/figure-a6-authentication-interface.png`

Suggested caption:

**Figure 5.5: Authentication interface supporting registration and login for account-based conversation persistence.**

Use this figure to evidence:

- FR12: registration is available.
- FR13: login/logout flow is implemented.
- NFR6: authentication is part of the system design.
- NFR9: account-based storage is separated from guest interaction.

### Figure 5.6: Dashboard and Avatar Selection Evidence

File:

`report-screenshots/figure-a4-dashboard.png`

Suggested caption:

**Figure 5.6: Dashboard view showing account/avatar-related controls used to support personalisation and system management.**

Use this figure to evidence:

- FR9: avatar selection/personalisation is supported.
- FR17: dashboard functionality is present.
- NFR1: the system provides controls beyond the chat surface.

### Figure 5.7: Mobile Responsiveness

File:

`report-screenshots/figure-a9-mobile-responsive.png`

Suggested caption:

**Figure 5.7: Mobile responsive layout showing that the assistant remains usable on a narrow viewport.**

Use this figure to evidence:

- NFR2: responsive layout.
- NFR3: interface remains accessible in a smaller viewport.
- Cognitive walkthrough task: using the mobile layout.

## 5.3 End-to-End Test Evidence

### Table 5.2: Playwright End-to-End Evidence

| Test area | Evidence | Actual result |
|---|---|---|
| Guest conversation migration | `tests/e2e/auth-persistence.spec.ts` | Passed. A guest conversation migrated into an account after registration and restored after refresh. |
| Login and restore | `tests/e2e/auth-persistence.spec.ts` | Passed. A signed-in user restored saved history in a new browser context. |
| Clear conversation | `tests/e2e/auth-persistence.spec.ts` | Passed. Saved account conversation was cleared and did not reappear after refresh. |
| Logout guest boundary | `tests/e2e/auth-persistence.spec.ts` | Passed. After logout, the user returned to guest scope without account conversation content remaining visible. |
| TTS failure mode | `playwright.config.ts` uses `E2E_TTS_MODE=fail` | Passed. Persistence flow remained usable while TTS was deliberately failed in E2E. |
| Reduced motion and avatar visibility | `tests/e2e/preferences.spec.ts` | Passed. The avatar remained usable after enabling reduced motion and could be hidden/shown through preferences. |

Suggested caption:

**Figure 5.8: Playwright E2E output showing three Chromium tests passing for authentication, persistence, TTS fallback mode, reduced motion, and avatar visibility.**

Use a terminal screenshot of `npm run test:e2e` for this figure.

## 5.4 Server/Library Test Evidence

### Table 5.3: Server and Library Test Coverage

| Area | Evidence from `npm test` | Dissertation relevance |
|---|---|---|
| Rate limiting | `consumeRateLimit` blocks after configured limit. | Supports NFR8 security/reliability. |
| Origin validation | Allowed and rejected origins are tested. | Supports NFR7 request validation. |
| Session handling | Guest session creation, signed session reuse, invalid session rotation. | Supports FR11 and NFR6. |
| Authentication | Credential validation and password checks are tested. | Supports FR12 and FR13. |
| Password reset | Reset code creation and password update tested. | Supports authentication completeness. |
| Preferences | Preference parsing, serialisation, and fallback defaults tested. | Supports FR10, NFR3, and NFR4. |
| Production config | Missing production secrets/API key checks tested. | Supports deployment/security discussion. |
| Thread storage | Save, load, delete, migration, malformed snapshot handling. | Supports FR14, FR15, and FR16. |
| User store | Create user, duplicate rejection, authentication, password update. | Supports account persistence and security. |

Suggested caption:

**Figure 5.9: Server/library test output showing validation, security, persistence, session, and preference tests passing.**

Use a terminal screenshot of `npm test` for this figure.

## 5.5 Failed and Resolved Test Evidence

This should be included as honest evaluation evidence.

### Resolved issue 1: stale E2E assertions

Initial issue:

The Playwright tests expected older interface text and did not handle the required first-login avatar picker.

Resolution:

The helpers in `tests/e2e/helpers.ts` were updated to use current visible UI text and to continue past the avatar picker during register/login flows.

How to discuss:

This was a test maintenance issue caused by UI evolution. Resolving it made the E2E tests align with the current artefact.

### Resolved issue 2: logout privacy/session boundary

Initial issue:

E2E testing showed that after logout, the previous conversation could remain visible in the guest interface.

Resolution:

`components/assistant-ui/persistent-thread.tsx` was updated so that a transition from authenticated user storage back to guest storage clears the guest thread. The final E2E run passed after this change.

How to discuss:

This is strong Chapter 5 evidence because testing discovered a real privacy/session-boundary issue and the implementation was improved before final evaluation.

Suggested caption:

**Table 5.4: Failed and resolved testing evidence showing how E2E testing identified stale assertions and a logout privacy issue that was fixed before final evaluation.**

## 5.6 Evidence Still Needed

The following evidence is still required before the dissertation is final:

| Missing evidence | Why it is needed | Suggested figure/table |
|---|---|---|
| Avatar thinking screenshot | Shows immediate feedback after user message. | Figure 5.10 |
| Avatar talking screenshot/video | Shows speech state and mouth movement. | Figure 5.11 |
| Sad/empathy scenario screenshot | Supports scenario-based avatar evaluation. | Figure 5.12 |
| Happy/celebration scenario screenshot | Supports scenario-based avatar evaluation. | Figure 5.13 |
| WebGL/avatar fallback screenshot | Supports fallback evaluation. | Figure 5.14 |
| TTS fallback/error evidence | Shows voice failure does not block chat. | Figure 5.15 |
| Runtime latency measurements | Needed for performance evaluation. | Table 5.5 |
| Keyboard walkthrough notes | Needed for accessibility evaluation. | Table 5.6 |

Do not fill these with invented values. Use placeholders until captured:

- [Insert screenshot evidence]
- [Insert measured value]
- [Insert actual result]
- [Pass/Fail]

