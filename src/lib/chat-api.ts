import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "nousresearch/hermes-3-llama-3.1-405b";

export async function handleChatRequest(request: Request): Promise<Response> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const text =
          "Please configure your `OPENROUTER_API_KEY` in the environment variables to chat with Hermes 3.";
        for (let i = 0; i < text.length; i++) {
          await new Promise((r) => setTimeout(r, 20));
          controller.enqueue(encoder.encode(`0:${JSON.stringify(text[i])}\n`));
        }
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  const { messages } = await request.json();
  const modelId = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const openrouter = createOpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    compatibility: "compatible",
  });

  const result = await streamText({
    model: openrouter(modelId),
    messages,
    system:
      "You are a helpful and intelligent AI assistant in a workspace productivity application.",
  });

  return result.toDataStreamResponse();
}
