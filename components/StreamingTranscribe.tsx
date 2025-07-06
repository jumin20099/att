"use client"
import React, { useState, useRef, useCallback } from "react"

const SAMPLE_RATE = 16000  // 16kHz

export default function StreamingTranscribe() {
  const [transcript, setTranscript] = useState<string>("")
  const [isStreaming, setIsStreaming] = useState(false)
  const socketRef = useRef<WebSocket | null>(null)

  // AssemblyAI WebSocket 연결 및 오디오 스트리밍
  const startStreaming = useCallback((file: File) => {
    const apiKey = process.env.ASSEMBLYAI_API_KEY
    if (!apiKey) {
      alert("AssemblyAI API 키가 필요합니다.")
      return
    }

    const ws = new WebSocket(
      `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=${SAMPLE_RATE}&token=${apiKey}`
    )
    ws.onopen = () => setIsStreaming(true)
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (
        msg.message_type === "PartialTranscript" ||
        msg.message_type === "FinalTranscript"
      ) {
        setTranscript(msg.text)
      }
    }
    ws.onclose = () => setIsStreaming(false)
    socketRef.current = ws

    // 파일을 0.1초 단위 PCM 청크로 분할해 전송
    file.arrayBuffer().then((buffer) => {
      const chunkSize = SAMPLE_RATE * 2 * 0.1  // 0.1초 분량 (16bit=2byte)
      for (let offset = 0; offset < buffer.byteLength; offset += chunkSize) {
        if (ws.readyState !== WebSocket.OPEN) break
        const chunk = buffer.slice(offset, offset + chunkSize)
        ws.send(chunk)
      }
      ws.send(JSON.stringify({ event: "EOS" }))  // 전송 완료 신호
    })
  }, [])

  return (
    <div className="my-8 p-4 border rounded bg-white">
      <input
        type="file"
        accept="audio/*"
        onChange={(e) => e.target.files?.[0] && startStreaming(e.target.files[0])}
      />
      {/* <div className="mt-2">
        {isStreaming ? "스트리밍 중…" : "스트리밍 대기"}
      </div> */}
      <div className="transcript-box mt-4 p-2 bg-slate-100 rounded min-h-[60px]">
        {transcript}
      </div>
    </div>
  )
}
