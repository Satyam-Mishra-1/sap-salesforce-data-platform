import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a concise business analyst. Return exactly 3 bullet points (each starting with •) based on the data. One sentence each. Be specific with numbers. No headers or extra text.",
        },
        {
          role: "user",
          content: `Analyze this SAP + Salesforce demand and customer risk summary:\n${JSON.stringify(data, null, 2)}`,
        },
      ],
      max_tokens: 250,
      temperature: 0.4,
    });
    return NextResponse.json({ insights: completion.choices[0].message.content });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
