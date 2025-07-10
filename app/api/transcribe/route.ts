// app/api/transcribe/route.ts
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const config = {
  api: { bodyParser: false, sizeLimit: '50mb' }
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ASSEMBLYAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing AssemblyAI key' }, { status: 500 })
  }

  // 1) AssemblyAI 업로드: FormData 안 읽고 raw body 스트림 포워딩
  const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
    method: 'POST',
    headers: { authorization: apiKey },
    body: request.body,
    duplex: "half",
  } as any); // ← 타입 에러 우회
  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    return NextResponse.json({ error: `Upload failed: ${err}` }, { status: 500 })
  }
  const { upload_url } = await uploadRes.json()

  // 2) 전사 요청 (speaker_labels 켜기)
  const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
    method: 'POST',
    headers: {
      authorization: apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      audio_url: upload_url,
      speaker_labels: true,
      language_code: "ko",
    }),
  })
  if (!transcriptRes.ok) {
    const err = await transcriptRes.text()
    return NextResponse.json({ error: `Transcript init failed: ${err}` }, { status: 500 })
  }
  const { id } = await transcriptRes.json()

  // 3) 폴링
  let transcript: any
  while (true) {
    const poll = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { authorization: apiKey },
    })
    transcript = await poll.json()
    if (transcript.status === 'completed') break
    if (transcript.status === 'error') {
      return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
    }
    await new Promise((r) => setTimeout(r, 2000))
  }

  return NextResponse.json(transcript)
}