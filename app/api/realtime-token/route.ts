// app/api/realtime-token/route.ts
import { NextResponse } from "next/server"

export async function GET() {
  const apiKey = process.env.ASSEMBLYAI_API_KEY          // ← 서버 전용
  if (!apiKey)
    return NextResponse.json({ error: "Missing key" }, { status: 500 })

  const resp = await fetch("https://api.assemblyai.com/v2/realtime/token", {
    method: "POST",
    headers: { authorization: apiKey },
  })
  if (!resp.ok)
    return NextResponse.json({ error: await resp.text() }, { status: 500 })

  const { token } = await resp.json()
  return NextResponse.json({ token })
}
