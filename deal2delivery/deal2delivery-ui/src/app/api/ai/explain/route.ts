import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const customer = await req.json();
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a CRM analyst. In 2-3 sentences explain why this customer is at churn risk based on the data, then suggest one concrete action. Be specific.",
        },
        {
          role: "user",
          content: `Customer profile:\n${JSON.stringify(customer, null, 2)}`,
        },
      ],
      max_tokens: 180,
      temperature: 0.5,
    });
    return NextResponse.json({ explanation: completion.choices[0].message.content });
  } catch (e: unknown) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
