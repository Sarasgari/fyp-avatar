# Dissertation Evidence Checklist For 90+ Readiness

This checklist is strict. Anything with a placeholder must be completed or honestly reported as not measured.

## Report-Ready Chapter Text

### Chapter 3 Requirements Introduction

This chapter explains the methodology, requirements, and design of the Avatar Assistant system. The project was developed as a lightweight expressive conversational avatar interface for LLM interaction. The requirements were therefore not limited to basic chatbot functionality; they also included structured LLM metadata, avatar state control, speech playback, accessibility controls, fallback behaviour, and persistence. The chapter shows how the project moved from research findings into a testable software design.

### Chapter 3 MoSCoW Explanation

Requirements were prioritised using MoSCoW to control project scope. The must-have features were those required to demonstrate the core research idea: an LLM chat interface connected to avatar and speech states. Should-have features improved usability and completeness, such as authentication, preferences, reduced motion, and avatar selection. Could-have features were useful extensions but not essential to the central contribution. Won't-have features were excluded because they would require a much larger ethical and technical scope than a final-year project.

### Chapter 3 Architecture Explanation

The system uses a full-stack Next.js architecture. The browser interface contains the chat panel, avatar stage, preferences, dashboard, and account controls. API routes provide controlled server-side access to the LLM, TTS providers, authentication, and conversation storage. The key architectural decision is that `/api/chat` returns structured metadata as well as assistant text. This allows the frontend to coordinate chat display, avatar emotion, body state, speech state, TTS generation, and persistence from a single assistant response.

### Chapter 3 Design Justification

The design was selected to provide expressive multimodal feedback while remaining lightweight and explainable. Full digital-human systems often require complex multimodal datasets, motion capture, facial tracking, or audio-aligned viseme generation. This project instead uses a state-based approach: the LLM estimates an emotion and avatar state, then the browser maps that metadata to a small set of controlled avatar behaviours. This makes the system practical to implement and evaluate within the project scope.

### Chapter 4 Implementation Introduction

The implementation converts the design into a working full-stack web application. The system combines Next.js, React, TypeScript, Assistant UI, OpenAI, text-to-speech, React Three Fiber, Three.js, and VRM avatar models. The implementation is modular: chat generation, avatar rendering, voice playback, authentication, preferences, persistence, and API protection are handled in separate files and components.

### Chapter 4 Structured Response Implementation

The structured response implementation is central to the project contribution. The chat API validates the incoming Assistant UI messages, applies origin and rate-limit protections, resolves the current user or guest identity, and sends the conversation to the LLM with a schema requiring `reply`, `emotion`, and `avatarState`. The reply is displayed as chat text, while the metadata is used by the frontend to update avatar and voice states. This avoids treating the avatar as decorative; instead, avatar behaviour is connected to the conversational response.

### Chapter 4 Avatar Implementation

The avatar is implemented with React Three Fiber, Three.js, Drei, and `@pixiv/three-vrm`. The renderer loads the selected VRM model, stores humanoid bone references, and updates the scene on each animation frame. Emotion, body, and speech state props control facial expressions, blinking, idle movement, body pose offsets, and mouth movement. The implementation is procedural, which keeps it lightweight and suitable for browser deployment.

### Chapter 4 TTS Implementation

Voice output is implemented as a client-server TTS pipeline. The server route validates text and generates MP3 audio using ElevenLabs when configured, with OpenAI TTS as fallback. On the client, assistant text is split into speakable chunks. Audio chunks are requested, queued, and played in order. During playback, the avatar speech state changes to `talking`, causing procedural mouth movement and transcript reveal.

### Chapter 4 Implementation Challenges

The main implementation challenge was coordinating independent systems: LLM response generation, avatar animation, speech synthesis, and persistence. A plain text response was not enough to control avatar behaviour, so structured metadata was introduced. Speech synthesis was asynchronous, so an ordered audio queue was implemented. Avatar animation needed to be expressive without motion capture, so procedural state-based animation was used. Guest and account persistence required thread migration to avoid losing conversations after registration.

### Chapter 4 Implementation Trade-Offs

The implementation intentionally favours a lightweight, state-based design over a highly realistic digital-human pipeline. This improves explainability, testability, and feasibility, but limits emotional accuracy and lip-sync precision. These trade-offs are acceptable because the project investigates whether a controlled avatar interface can enhance LLM interaction, not whether a full human simulation can be built.

### Chapter 5 Evaluation Strategy Without Participants

No external participant study was conducted. The evaluation therefore avoids unsupported claims about real user satisfaction or engagement. Instead, it uses requirements-based testing, scenario-based emotion testing, heuristic evaluation, cognitive walkthrough, accessibility inspection, fallback testing, and performance measurement. This provides systematic evidence that the artefact works as designed and identifies likely usability and reliability issues.

### Chapter 5 Functional Testing Introduction

Functional testing evaluates whether the implemented system meets its functional requirements. Tests cover chat messaging, structured LLM responses, avatar thinking/talking/emotion states, TTS playback, preferences, authentication, conversation persistence, guest-to-account migration, dashboard access, and fallback behaviour. Actual results should be reported using test output, screenshots, API logs, or screen recordings.

### Chapter 5 Scenario-Based Avatar Evaluation Explanation

Scenario-based testing was used to evaluate whether representative user messages produced appropriate avatar states. Each scenario defines an input, expected emotion, expected avatar state, and expected speech state. This does not measure real user perception, but it provides evidence that the state-mapping design behaves consistently across emotional and neutral prompts.

### Chapter 5 Heuristic Evaluation Explanation

Heuristic evaluation was used as an inspection method to identify likely usability issues without external participants. The evaluation follows Nielsen-style principles such as visibility of system status, user control, consistency, error prevention, and recovery from errors. Severity ratings help prioritise improvements and distinguish minor interface issues from major usability risks.

### Chapter 5 Cognitive Walkthrough Explanation

The cognitive walkthrough examines whether a first-time user is likely to understand key tasks, including starting as a guest, sending a message, understanding avatar feedback, disabling voice, changing avatar, registering, restoring a conversation, and using fallback mode. The method focuses on user goals, expected actions, system feedback, possible usability issues, and recommendations.

### Chapter 5 Performance Evaluation Explanation

Performance evaluation focuses on timings that affect perceived responsiveness: page load time, avatar load time, time to thinking state, time to first assistant text, time to full response, time to first TTS audio, time to talking state, and conversation restore time. These values must be measured directly before final submission. Any unmeasured value should remain as a placeholder rather than being invented.

### Chapter 5 Evaluation Limitations

The evaluation is limited because no real participants were used. As a result, the project cannot claim actual improvements in perceived engagement, naturalness, or usability. The evaluation instead provides evidence of functional completeness, scenario consistency, likely usability issues, accessibility support, fallback behaviour, and performance characteristics. Future work should include a participant comparison between the avatar interface and a text-only baseline.

### Chapter 6 Interpretation Of Results

The evaluation should be interpreted as evidence that the implemented architecture is functional and testable. If the tests pass, the results show that structured LLM metadata can drive a lightweight avatar interface, but they do not prove that users prefer it. Performance measurements should be used to discuss where the system feels responsive and where external LLM or TTS latency may reduce naturalness.

### Chapter 6 Critical Discussion

The project demonstrates that expressive feedback can be added to LLM chat without building a full digital human. Its strength is the controlled mapping between structured response metadata and avatar behaviour. Its weakness is that emotional interpretation remains approximate and depends on the model output. This makes the project a realistic prototype rather than a claim of genuine emotional intelligence.

### Chapter 6 Limitations

Key limitations include no participant study, approximate emotion classification, procedural rather than phoneme-based lip-sync, dependency on external APIs, WebGL/device constraints, limited long-term memory, and prototype-level moderation. These should be presented honestly and linked to realistic future work.

### Chapter 6 Ethics, Privacy, And Accessibility

The project processes user messages through external AI/TTS services and stores conversation snapshots, so privacy must be discussed clearly. The assistant should not be represented as human or as professional medical/legal/financial support. Accessibility is addressed through text-first chat, voice toggling, avatar hiding, reduced motion, and fallback UI, but screen-reader and broader accessibility testing remain future work.

### Chapter 7 Project Contribution

The project contributes a practical implementation of a lightweight expressive avatar interface for LLM interaction. It shows how structured LLM metadata can connect text generation to avatar emotion, body state, speech playback, persistence, preferences, and fallback behaviour in a web application.

### Chapter 7 Future Work

Future work should include a participant study comparing avatar and text-only interfaces, improved emotion detection, user-adjustable avatar styles, better lip-sync using visemes or speech marks, richer accessibility testing, production monitoring, stronger moderation, and more robust storage infrastructure.

## Screenshot Checklist

| Figure | Screenshot description | State/action to capture | Report placement | Suggested caption |
|---|---|---|---|---|
| Figure A.1 | Main interface | Avatar stage and chat panel visible | Appendix A / Chapter 3 | Main expressive avatar chat interface. |
| Figure A.2 | Avatar idle state | Live avatar before message | Chapter 4 or Appendix A | Avatar in idle state before user input. |
| Figure A.3 | Avatar thinking state | Immediately after message submit | Chapter 5 | Avatar feedback while assistant response is being generated. |
| Figure A.4 | Avatar talking state | During voice playback | Chapter 5 | Avatar mouth movement during speech playback. |
| Figure A.5 | Sad/empathy state | Scenario S01 | Chapter 5 | Emotion scenario: sad or empathetic response state. |
| Figure A.6 | Happy/celebration state | Scenario S02 | Chapter 5 | Emotion scenario: positive/celebratory response state. |
| Figure A.7 | Chat response | User and assistant message visible | Chapter 4/5 | Structured assistant response displayed as chat text. |
| Figure A.8 | Avatar selection | Avatar picker/dashboard characters | Chapter 4 / Appendix A | Avatar selection interface. |
| Figure A.9 | Voice disabled | Preferences with voice off or muted status | Chapter 5 | Voice can be disabled while text chat remains available. |
| Figure A.10 | Preferences | Settings dialog | Chapter 3/Appendix | User preferences for voice, avatar visibility, reduced motion, and layout. |
| Figure A.11 | Login/register | Auth dialog | Chapter 4/Appendix | Account registration and login interface. |
| Figure A.12 | Dashboard | Dashboard overview | Chapter 4/Appendix | Dashboard showing account/avatar information. |
| Figure A.13 | Restored conversation | Refreshed page with previous chat | Chapter 5 | Conversation restored after refresh/login. |
| Figure A.14 | WebGL/avatar fallback | Avatar fallback panel | Chapter 5/Appendix | Fallback mode when live avatar rendering is unavailable. |
| Figure A.15 | TTS fallback/error | TTS failure or muted state evidence | Chapter 5 | Speech fallback/error behaviour. |
| Figure A.16 | Mobile responsive layout | 390px viewport | Appendix A | Mobile layout with stacked interface. |
| Figure A.17 | Test output | Terminal output from tests | Appendix B | Automated test output. |
| Figure A.18 | Build output | Terminal output from build | Appendix B | Production build evidence. |

## Final 90+ Readiness Review

### Already Strong

- Clear research framing around lightweight expressive LLM avatar interaction.
- Strong codebase breadth: chat, avatar, TTS, auth, persistence, preferences, dashboard, tests.
- Structured response metadata is a clear technical contribution.
- Existing automated tests cover server modules and key E2E persistence/preferences flows.
- Existing screenshots in `report-screenshots/` and `artifacts/`.
- Fallbacks exist for TTS, WebGL/avatar failure, storage, invalid input, and rate limits.

### Evidence Missing

- Actual measured performance values.
- Screenshot/video evidence for thinking/talking/emotion states.
- Explicit API evidence for structured metadata.
- Accessibility keyboard walkthrough notes.
- Admin route protection test output.
- TTS fallback evidence with logs or controlled failure.
- WebGL/model failure screenshot.

### Latest Verification Results

These command results were collected on 2026-05-02 and should be captured as terminal screenshots for Appendix B:

| Command | Result | Note |
|---|---|---|
| `npm run lint` | Passed | Biome checked 78 files. |
| `npm run typecheck` | Passed | TypeScript completed with no errors. |
| `npm test` | Passed | 39 server/library checks reported `ok`. |
| `npm run build` | Passed | Next.js production build compiled and generated routes successfully. |
| `npm run test:e2e` | Passed | 3 Chromium tests passed in about 3.7 minutes. |

### Code Improvements Made During Evidence Audit

- Fixed stale Playwright assertions so tests match the current UI and avatar-picker onboarding flow.
- Increased E2E timeouts from 45 seconds to 90 seconds because the production build/WebGL path can exceed 45 seconds on this machine.
- Fixed a logout privacy/session-boundary issue so a user-to-guest transition clears the guest thread instead of leaving account conversation content visible.
- Added an explicit image role to the logo mark for better accessibility semantics.
- Cleaned dead code and normalized Biome formatting so lint now passes.

### Code Or Test Improvements To Consider

- Add `aria-live` to auth error/reset notices.
- Add admin route protection unit/API test.
- Add test or dev toggle for avatar fallback screenshot.
- Add development-only performance measurement marks.
- Add UI test for empty-message prevention if not already handled by Assistant UI.

### Report Sections To Rewrite

- Chapter 1 aim/objectives should use the lightweight expressive avatar framing.
- Chapter 2 should end with a clear research gap and influence-on-design section.
- Chapter 3 should merge methodology, requirements, and design to fit 10k words.
- Chapter 5 should remove participant language and use non-participant evaluation methods.
- Chapter 6 should avoid claiming actual user engagement improvement.

### Placeholders Remaining

- [Insert measured value]
- [Insert actual test result]
- [Insert screenshot evidence]
- [Insert build output]
- [Insert figure]
- [Insert latest run result]

### What Could Stop A 90+ Mark

- Claiming participant results without participants.
- No performance measurements despite discussing latency.
- Too much description and not enough evidence.
- Missing traceability between requirements, implementation, and tests.
- Poor or inconsistent Harvard referencing.
- Not discussing limitations honestly.
- Screenshots/figures not referenced in the text.
- Build/test failures hidden or unexplained.

### Next Steps In Exact Order

1. Capture terminal screenshots for lint, typecheck, unit/server tests, build, and E2E.
2. Capture missing screenshots for thinking, talking, emotion scenarios, fallback, and restored conversation.
3. Fill the testing tables with the latest actual results.
4. Measure latency values using the table in `docs/EVALUATION_PLAN.md`.
5. Update Chapter 1 and Chapter 3 to match the lightweight expressive avatar framing.
6. Rewrite Chapter 5 as non-participant evaluation.
7. Add a short Chapter 6 reflection/limitations section that explicitly states no participants were used.
8. Finalise references and remove all placeholders.
