import OpenAI from "openai";

export const runtime = "nodejs";

const MAX_TTS_INPUT_LENGTH = 4000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      return Response.json({ error: "Text is required." }, { status: 400 });
    }

    if (text.length > MAX_TTS_INPUT_LENGTH) {
      return Response.json(
        { error: `Text must be ${MAX_TTS_INPUT_LENGTH} characters or fewer.` },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      console.error("TTS route is missing OPENAI_API_KEY.");
      return Response.json({ error: "TTS is not configured." }, { status: 500 });
    }

    // Keep the route small and predictable: it accepts plain text and always
    // returns MP3 audio generated with the requested OpenAI TTS model/voice.
    const speech = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "nova",
      input: text,
      response_format: "mp3",
    });

    const audioBuffer = Buffer.from(await speech.arrayBuffer());

    return new Response(audioBuffer, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Length": String(audioBuffer.byteLength),
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("Failed to synthesize speech.", error);
    return Response.json(
      { error: "Failed to synthesize speech." },
      { status: 500 },
    );
  }
}
