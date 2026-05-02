# Non-Participant Evaluation Plan

The project cannot claim real participant findings. The evaluation should therefore be presented as a structured non-participant evaluation using requirements-based testing, scenario-based emotion testing, heuristic evaluation, cognitive walkthrough, accessibility inspection, fallback testing, and performance measurement.

## Chapter 5 Evaluation Strategy Text

This project was evaluated without external participants due to project time and access constraints. Therefore, the evaluation does not claim statistically valid user satisfaction, SUS scores, or participant feedback. Instead, the evaluation uses a structured non-participant approach to assess whether the implemented artefact meets its stated requirements and whether likely usability issues can be identified through inspection methods.

The evaluation combines requirements-based testing, scenario-based avatar and emotion testing, heuristic evaluation, cognitive walkthrough, accessibility inspection, fallback testing, and performance measurements. This approach is appropriate for the project because the research question concerns a practical lightweight interface architecture. The evaluation therefore focuses on whether the system functions as designed, whether avatar states respond consistently to representative scenarios, whether core user flows are understandable, and whether the system remains usable when optional services fail.

## Nielsen-Style Heuristic Evaluation

Severity scale: 0 = no issue, 1 = cosmetic, 2 = minor, 3 = major, 4 = severe.

| Heuristic | Evidence in current system | Issue identified | Severity | Recommendation |
|---|---|---|---:|---|
| Visibility of system status | Header status pills show avatar, voice, mood, and storage. Loading/fallback states are visible. | Some state changes may be brief and hard to capture without measurement. | 1 | Add optional dev logging or visual test mode for evaluation screenshots. |
| Match between system and real world | Labels such as "Voice playback", "Avatar visibility", "Thinking", and "Speaking" are understandable. | "Mood" label may be interpreted as true emotional understanding. | 2 | In report/UI, describe it as estimated conversational state. |
| User control and freedom | Users can mute voice, hide avatar, clear conversation, sign out, and close dialogs. | Clearing conversation uses browser confirm, which is functional but basic. | 1 | Replace with styled confirmation dialog in future. |
| Consistency and standards | Buttons, dialogs, tabs, and preferences are consistent with existing UI components. | Dashboard branding says "Mango dashboard" while app title is "Avatar Assistant". | 2 | Standardise naming in final UI/report or explain branding if intentional. |
| Error prevention | Submit buttons disable invalid auth/reset input; API validates messages and credentials. | Chat empty-message prevention should be confirmed in UI and API tests. | 2 | Add explicit test evidence for empty message handling. |
| Recognition rather than recall | Settings are visible, avatar/status information is visible, dashboard tabs are labelled. | Some advanced state meanings are not explained in-app. | 1 | Use report figures/captions rather than adding verbose in-app text. |
| Flexibility and efficiency | Guest access allows immediate use; preferences let users tailor motion/voice/avatar. | No keyboard shortcut evidence has been collected. | 1 | Evaluate keyboard navigation and note any limitations. |
| Aesthetic and minimalist design | Interface avoids unnecessary explanatory text and groups controls clearly. | Visual complexity may be high on small screens due to avatar and chat together. | 2 | Use mobile screenshot and note responsive stacking. |
| Help users recognise and recover from errors | API routes return request IDs; avatar fallback explains WebGL/model issues; auth errors shown. | User-facing TTS errors may not be obvious if audio fails silently. | 2 | Add visible voice-error message or document current limitation. |
| Help and documentation | README documents setup, environment variables, and features. | In-app help is limited. | 1 | Dissertation can justify minimal in-app help for prototype scope. |

## Cognitive Walkthrough

| Task | User goal | Expected user action | System feedback | Possible usability issue | Recommended improvement |
|---|---|---|---|---|---|
| Start as guest | Try the assistant quickly | Open app | Guest/session storage status visible | User may not know guest limit exists | Add concise sign-in prompt when close to limit. |
| Send first message | Ask assistant something | Type into chat input and submit | Avatar thinking state, message appears, reply follows | If response is slow, user may wonder if request is active | Keep "Replying soon" status visible; capture timing evidence. |
| Understand avatar thinking state | See system is processing | Observe avatar/status | Voice/status pill says replying soon and avatar pose changes | Visual thinking state may be subtle | Capture and possibly add clearer status text. |
| Hear voice response | Receive spoken reply | Leave voice enabled | Audio plays, transcript reveals, avatar talks | Browser autoplay or TTS failure may prevent audio | Keep text response primary and document fallback. |
| Disable voice | Stop audio output | Open Settings, uncheck Voice playback | Voice muted status, audio stops | Settings could be overlooked by first-time users | Include settings screenshot and possible future onboarding. |
| Change avatar | Personalise assistant | Open dashboard/characters, select avatar | Avatar changes and selection persists | First-time users may not know avatar selection is in dashboard | Add avatar picker screenshot and optional future shortcut. |
| Register/log in | Save to account | Press Sign in, choose tab, submit form | Account sync status and user details shown | Form errors need to be clear | Auth dialog already shows errors; test invalid login. |
| Restore conversation | Continue later | Refresh or log in again | Saved messages appear | User may not notice storage state | Storage status pill helps; include evidence. |
| Use fallback mode | Continue if avatar fails | Continue chatting after fallback panel appears | Text chat remains available | Fallback may reduce project novelty | Explain fallback as reliability/accessibility feature. |
| Use mobile layout | Use on phone-sized screen | Open narrow viewport | Layout stacks and controls remain available | Dense header may wrap | Use mobile screenshot and note any limitation. |

## Performance and Latency Measurement Method

Do not expose secrets or change production behaviour. Use one of these methods:

1. Browser DevTools/Playwright timing around user actions in a local mock/test environment.
2. Development-only `console.time`/`console.timeEnd` guarded by `process.env.NODE_ENV !== "production"`.
3. API route server logs using existing request IDs and route timing from Next.js logs.
4. Manual stopwatch evidence from screen recording, recorded honestly as approximate.

Suggested development-only helper:

```ts
const markPerformance = (label: string) => {
  if (process.env.NODE_ENV !== "production") {
    performance.mark(label);
  }
};
```

Use marks such as:

- `avatar-message-send`
- `avatar-thinking-state`
- `avatar-first-assistant-text`
- `avatar-tts-request`
- `avatar-first-audio-play`
- `avatar-talking-state`
- `avatar-thread-restored`

## Performance Evidence Table

| Measurement | Method | Actual measured value | Evidence | Interpretation |
|---|---|---|---|---|
| Page load time | Browser performance/Playwright | [Insert measured value] | [Screenshot/trace] | [Insert interpretation] |
| Avatar load time | Status change loading to ready | [Insert measured value] | [Screen recording/log] | [Insert interpretation] |
| Time to thinking state | User submit to UI state change | [Insert measured value] | [Video/log] | [Insert interpretation] |
| Time to first assistant text | Submit to first displayed text | [Insert measured value] | [Network/log] | [Insert interpretation] |
| Time to full assistant response | Submit to stream finish | [Insert measured value] | [Network/log] | [Insert interpretation] |
| Time to first TTS audio | TTS request to playback start | [Insert measured value] | [Log/video] | [Insert interpretation] |
| Time to avatar talking state | Audio playback start to speechState talking | [Insert measured value] | [Video/log] | [Insert interpretation] |
| Conversation restore time | Page load to restored messages visible | [Insert measured value] | [E2E/video] | [Insert interpretation] |
| Build result | `npm run build` | [Insert build output] | [Terminal output] | [Insert interpretation] |

## Interpretation Template

The performance evaluation showed that [insert strongest measured area] was acceptable for a prototype because [insert evidence]. The largest delay was [insert delay], which is expected because [LLM/TTS/avatar loading/external API]. This affects perceived naturalness because users may wait before hearing speech. However, the interface provides status feedback and text remains available, so the delay does not block basic interaction. Future work should reduce this delay through [streaming TTS/local caching/provider optimisation].

## Required Terminal Outputs and Screenshots

- `npm run lint` output.
- `npm run typecheck` output.
- `npm test` output.
- `npm run build` output.
- `npm run test:e2e` output if runnable.
- Screenshot of main interface.
- Screenshot/video of thinking state.
- Screenshot/video of talking state.
- Screenshot of emotion scenarios.
- Screenshot of mobile layout.
- Screenshot of fallback state.
- Screenshot of build/test terminal output if useful.

## Evaluation Limitations Text

No external participant study was conducted, so the project cannot claim measured user satisfaction, actual engagement improvement, or statistically valid usability results. The evaluation instead assesses functional correctness, scenario consistency, likely usability issues, accessibility properties, failure handling, and performance characteristics. This provides meaningful evidence that the artefact meets its requirements, but future work should include a participant study comparing the avatar interface against a text-only chatbot baseline.

