// app/api/transcribe/route.ts
import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("audio") as File

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    // AssemblyAI API 키 확인
    const apiKey = process.env.ASSEMBLYAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "AssemblyAI API key not configured" }, { status: 500 })
    }

    // 1단계: 파일을 AssemblyAI에 업로드
    const uploadResponse = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        authorization: apiKey,
      },
      body: file,
    })

    if (!uploadResponse.ok) {
      throw new Error("Failed to upload file to AssemblyAI")
    }

    const { upload_url } = await uploadResponse.json()

    // 2단계: 변환 요청
    const transcriptResponse = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        authorization: apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        audio_url: upload_url,
        language_detection: true,
      }),
    })

    if (!transcriptResponse.ok) {
      throw new Error("Failed to request transcription")
    }

    const { id } = await transcriptResponse.json()

    // 3단계: 변환 완료까지 폴링
    let transcript
    while (true) {
      const pollingResponse = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: {
          authorization: apiKey,
        },
      })

      transcript = await pollingResponse.json()

      if (transcript.status === "completed") {
        break
      } else if (transcript.status === "error") {
        throw new Error("Transcription failed")
      }

      // 2초 대기 후 다시 확인
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }

    return NextResponse.json({
      text: transcript.text,
      confidence: transcript.confidence,
      language: transcript.language_code,
    })
  } catch (error) {
    console.error("Transcription error:", error)
    return NextResponse.json({ error: "Failed to transcribe audio" }, { status: 500 })
  }
}