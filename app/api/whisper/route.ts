import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OpenAI key" }, { status: 500 });
  }

  const formData = await request.formData();
  formData.append("model", "whisper-1");

  const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!resp.ok) {
    const err = await resp.json();
    return NextResponse.json({ error: err }, { status: resp.status });
  }

  const data = await resp.json();
  return NextResponse.json(data);
}