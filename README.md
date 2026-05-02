# Avatar Assistant

Avatar Assistant is an expressive AI companion built with Next.js, React Three Fiber, VRM avatars, account-based chat history, and spoken replies. Users can sign in, choose a 3D avatar, chat with the assistant, hear responses in a cute playful voice, and manage their experience from a dashboard.

The project is designed as a full-stack final-year style web app: it includes authentication, guest limits, saved conversations, password reset, admin visitor tracking, 3D avatar rendering, and production deployment on Vercel.

## Demo

Live demo: [https://fyp-avatar.vercel.app](https://fyp-avatar.vercel.app)

Demo flow:

1. Open the live site.
2. Create an account or continue as a guest.
3. Pick an avatar after signing in.
4. Send a message and listen to the avatar response.
5. Open the Dashboard to change avatars and view account details.

## Features

- 3D VRM avatar stage with expressive idle, thinking, speaking, dancing, waving, and emotion-driven motion.
- Avatar selection on first sign-in, with multiple character models.
- AI chat powered by OpenAI through the Vercel-hosted API routes.
- Voice playback with ElevenLabs support and OpenAI TTS fallback.
- Cute/playful default voice style for avatar responses.
- Email/password accounts with signed first-party cookies.
- Guest message limit to encourage sign-in while protecting API usage.
- Saved conversation sync for guest and signed-in sessions.
- Password reset flow with reset codes and optional Resend email delivery.
- User dashboard with account information, avatar library, and admin visitor analytics.
- Admin-only visitor panel using configured admin email addresses.
- Production guardrails: origin allowlisting, request IDs, validation, rate limits, and secure cookie signing.

## Tech Stack

- Next.js 16 and React 19
- TypeScript
- Tailwind CSS
- React Three Fiber and Drei
- `@pixiv/three-vrm`
- Assistant UI
- OpenAI API
- ElevenLabs TTS
- Resend email
- Vercel deployment
- Optional Upstash Redis for persistent server storage

## Getting Started

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```bash
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ALLOWED_ORIGINS=http://localhost:3000
SESSION_SIGNING_SECRET=replace-with-a-long-random-secret
AUTH_SIGNING_SECRET=replace-with-another-long-random-secret
ADMIN_EMAILS=you@example.com
GUEST_CHAT_DAILY_LIMIT=5
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

Required for production:

| Variable | Purpose |
| --- | --- |
| `OPENAI_API_KEY` | Chat and fallback text-to-speech |
| `ALLOWED_ORIGINS` | Allowed production origin, for example `https://fyp-avatar.vercel.app` |
| `SESSION_SIGNING_SECRET` | Signs guest session cookies |
| `AUTH_SIGNING_SECRET` | Signs account auth cookies |
| `ADMIN_EMAILS` | Comma-separated admin account emails |

Optional:

| Variable | Purpose |
| --- | --- |
| `GUEST_CHAT_DAILY_LIMIT` | Guest message allowance per 24 hours |
| `ELEVENLABS_API_KEY` | Enables ElevenLabs speech |
| `ELEVENLABS_VOICE_ID` | ElevenLabs voice used by the avatar |
| `ELEVENLABS_MODEL_ID` | ElevenLabs model, defaults to `eleven_flash_v2_5` |
| `RESEND_API_KEY` | Sends password reset codes by email |
| `EMAIL_FROM` | Verified sender address for reset emails |
| `UPSTASH_REDIS_REST_URL` | Optional persistent Redis backend |
| `UPSTASH_REDIS_REST_TOKEN` | Optional Redis token |
| `THREAD_STORE_PREFIX` | Namespace for saved conversations |
| `USER_STORE_PREFIX` | Namespace for account records |
| `RATE_LIMIT_PREFIX` | Namespace for rate limits |

## Scripts

```bash
npm run dev
npm run typecheck
npm test
npm run build
npm run lint
npm run lint:fix
npm run test:e2e
```

## Deployment

This app is deployed on Vercel.

Build command:

```bash
npm run build
```

Production URL:

[https://fyp-avatar.vercel.app](https://fyp-avatar.vercel.app)

After adding or changing production environment variables, redeploy:

```bash
npx vercel --prod
```

## Notes

- Without Upstash Redis, some server-side data can fall back to temporary server memory in production.
- ElevenLabs currently falls back to OpenAI TTS if ElevenLabs returns an error, such as missing credits or quota.
- Password reset codes can be displayed during development, but production should use Resend with a verified sender.
- API keys should never be committed to the repository.

## Important Files

- `app/assistant.tsx`: main app shell, avatar/chat layout, dashboard switching
- `app/api/chat/route.ts`: AI chat endpoint
- `app/api/tts/route.ts`: ElevenLabs/OpenAI speech endpoint
- `app/api/auth/*`: account, session, login, logout, registration, and password reset routes
- `app/api/admin/visitors/route.ts`: admin visitor analytics API
- `components/ui/avatar-canvas.tsx`: VRM rendering and avatar animation
- `components/avatar/avatar-picker.tsx`: avatar selection UI
- `components/dashboard/user-dashboard.tsx`: dashboard and admin visitor panel
- `lib/server/user-store.ts`: user storage and password hashing
- `lib/server/password-reset-store.ts`: password reset code creation and validation
- `lib/avatar-catalog.ts`: available avatar definitions
