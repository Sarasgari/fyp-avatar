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
npm run typecheck
npm run build
```

## Production Notes

- The chat and TTS routes include request validation, request IDs, no-store headers, origin allowlisting, and rate limiting.
- Builds no longer depend on downloading remote Google Fonts.
- GitHub Actions runs lint, typecheck, tests, and build on every pull request.
- Set `ALLOWED_ORIGINS` in deployed environments to block cross-site POSTs to the chat and TTS APIs.
- If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are configured, rate limiting uses Upstash Redis REST. Otherwise it falls back to process-local memory.

## Important Files

- `app/api/chat/route.ts`: chat request validation and assistant response generation
- `app/api/tts/route.ts`: text-to-speech endpoint
- `lib/server/api.ts`: shared API guardrails and response helpers
- `components/ui/avatar-canvas.tsx`: VRM avatar rendering and animation
