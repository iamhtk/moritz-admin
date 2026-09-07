import { GoogleGenerativeAI } from "@google/generative-ai";
import { getOverview } from "@/lib/queries";
import { buildChatContext } from "@/lib/chat-context";

export const dynamic = "force-dynamic";

const SYSTEM_FIRM = `You are Nora, the operations assistant for Moritz, an AI-native law firm.
You answer questions about this firm's current state using only the context provided.

Rules:
- Answer in two or three short sentences. Never more than four.
- Always name the specific matters or lawyers your answer is based on, by reference or name.
- Use the numbers in the context. Never estimate or round differently.
- If the context does not contain the answer, say so in one sentence and stop. Do not speculate.
- You have no knowledge of law, contracts, or anything outside this firm's data.
- Plain sentences. No markdown headers, no bullet lists, no bold.
- Never use the word "I" more than once in an answer.
- Do not introduce yourself unless asked; when referring to yourself, use Nora.`;

const SYSTEM_LEGAL = `You are Nora answering in general legal-information mode for Moritz staff.

This mode is general legal information, not legal advice. You must never present answers as advice for a specific client, matter, jurisdiction, or situation.

Rules:
- Answer only with well-established, general legal concepts and plain definitions.
- Keep answers to two or three short sentences. Never more than four.
- Explicitly decline speculative questions, jurisdiction-specific analysis, nuanced interpretation, strategy, drafting guidance, or anything beyond basic definitional information. Redirect the user to consult an actual attorney for those.
- If the question references a specific real matter (e.g. MOR-####), client, lawyer, or this firm's live data, decline: say that matter-specific legal advice is outside this mode and that they should switch to firm-data Ask for operational questions about the firm, or consult counsel for legal advice.
- Never invent statutes, case citations, or jurisdiction rules. If unsure, say you can only offer a general definition and stop.
- Plain sentences. No markdown headers, no bullet lists, no bold.
- Do not claim access to firm data in this mode.
- Do not introduce yourself unless asked; when referring to yourself, use Nora.`;

export const LEGAL_INFO_DISCLAIMER =
  "General legal information, not legal advice. Not a substitute for advice from a qualified attorney.";

type ChatMessage = { role: string; content: string };

export async function POST(req: Request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return new Response("Assistant is not configured.", { status: 503 });
    }

    const body = await req.json();
    const { messages, mode } = body as {
      messages?: ChatMessage[];
      mode?: "firm" | "legal";
    };
    if (!Array.isArray(messages)) {
      return new Response("Invalid messages.", { status: 400 });
    }

    const isLegal = mode === "legal";
    const typed = messages as ChatMessage[];
    const lastUser = [...typed].reverse().find((m) => m.role === "user");
    if (!lastUser?.content?.trim()) {
      return new Response("Invalid messages.", { status: 400 });
    }

    // Firm-grounded and general-info histories must stay isolated.
    const prior = typed.slice(0, typed.lastIndexOf(lastUser));
    const history = prior.map((m) => ({
      role: m.role === "assistant" ? ("model" as const) : ("user" as const),
      parts: [{ text: m.content }],
    }));

    let promptText: string;
    if (isLegal) {
      promptText = `Question (general legal information mode): ${lastUser.content}`;
    } else {
      const payload = await getOverview();
      const context = buildChatContext(payload);
      promptText = `Current firm state:\n${context}\n\nQuestion: ${lastUser.content}`;
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.5-flash-lite",
      systemInstruction: isLegal ? SYSTEM_LEGAL : SYSTEM_FIRM,
      generationConfig: {
        temperature: isLegal ? 0.2 : 0.3,
        maxOutputTokens: 300,
      },
    });

    const result =
      history.length === 0
        ? await model.generateContentStream(promptText)
        : await model
            .startChat({ history })
            .sendMessageStream(promptText);

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) controller.enqueue(encoder.encode(text));
          }
        } catch {
          controller.enqueue(
            encoder.encode("\n\nThe answer stopped early. Try again.")
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Nora-Mode": isLegal ? "legal" : "firm",
      },
    });
  } catch (e) {
    console.error("ask failed", e);
    return new Response("Couldn't reach the assistant. Try again.", {
      status: 500,
    });
  }
}
