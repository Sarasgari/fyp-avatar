# Avatar Assistant

An expressive Next.js chat app with an animated avatar, streamed assistant replies, and OpenAI-powered text-to-speech.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env.local` file:

```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

To use ElevenLabs for voice playback, add your ElevenLabs key and switch the
TTS provider:

```bash
TTS_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ELEVENLABS_VOICE_ID=CwhRBWXzGAHq8TQ4Fs17
```

3. Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev
npm run lint
npm run lint:fix
npm test
npm run test:e2e
npm run typecheck
npm run build
```

## Production Notes

- The chat and TTS routes include request validation, request IDs, no-store headers, origin allowlisting, and rate limiting.
- The APIs now issue signed first-party guest sessions and apply quotas by both session and IP address.
- Users can create accounts or sign in with email and password, and saved conversations follow the signed-in account across browsers.
- Saved conversations now sync through the server, with browser storage kept as a fallback cache for both guest sessions and signed-in users.
- Sign-in and registration flows have their own request throttling, and guest conversation history is migrated into the account on first sign-in or registration.
- Playwright smoke tests cover guest-to-account migration, cross-browser history restore, sign-out scope reset, and TTS failure resilience.
- Builds no longer depend on downloading remote Google Fonts.
- GitHub Actions runs lint, typecheck, tests, build, and Playwright smoke coverage on every pull request.
- The app now serves a stricter Content Security Policy plus additional browser hardening headers.
- Avatar motion is driven by the built-in rig and expression system, so the app no longer depends on external `.vrma` animation assets.
- Set `SESSION_SIGNING_SECRET` in every deployed environment. Without it, production API requests are rejected.
- Set `AUTH_SIGNING_SECRET` if you want a separate signing key for account cookies. If omitted, account cookies reuse `SESSION_SIGNING_SECRET`.
- Set `ALLOWED_ORIGINS` in deployed environments to block cross-site POSTs to the chat and TTS APIs. Production routes now reject requests if this allowlist is missing.
- Set `TTS_PROVIDER=elevenlabs` plus `ELEVENLABS_API_KEY` to use ElevenLabs speech instead of the default OpenAI TTS route. You can also set `ELEVENLABS_VOICE_ID`, `ELEVENLABS_MODEL_ID`, and `ELEVENLABS_OUTPUT_FORMAT`.
- If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured, rate limiting, account storage, and saved-thread storage use Upstash Redis REST. Otherwise they fall back to process-local memory.

## Important Files

- `app/api/chat/route.ts`: chat request validation and assistant response generation
- `app/api/auth/*.ts`: account session, sign-in, sign-out, and registration routes
- `app/api/thread/route.ts`: session-scoped saved conversation sync
- `app/api/tts/route.ts`: text-to-speech endpoint
- `lib/server/api.ts`: shared API guardrails and response helpers
- `lib/server/auth.ts`: signed account-cookie resolution
- `lib/server/thread-store.ts`: server-side thread persistence
- `lib/server/user-store.ts`: user account storage and password verification
- `components/ui/avatar-canvas.tsx`: VRM avatar rendering, rig-driven motion, and fallbacks
