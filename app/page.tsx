"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, FileAudio, Download } from "lucide-react"
import pLimit from "p-limit"

interface Utterance {
  speaker: string | number
  start: number
  end: number
  text: string
}

interface TranscriptionResult {
  utterances?: Utterance[]
  text?: string
}

interface FileTranscription {
  file: File
  fileName: string
  isUploading: boolean
  isLoading: boolean
  transcription: TranscriptionResult | null
  error?: string
}

// 화자별 색상 설정 (이전 코드 재사용)
const speakerColors: Record<string, string> = {
  A: 'bg-blue-100 text-blue-800',
  B: 'bg-green-100 text-green-800',
  C: 'bg-yellow-100 text-yellow-800',
  D: 'bg-purple-100 text-purple-800',
  default: 'bg-gray-100 text-gray-800',
}
function getSpeakerClass(s: string | number) {
  const key = typeof s === 'number' ? String.fromCharCode(65 + s) : String(s)
  return speakerColors[key] || speakerColors.default
}

export default function AudioToText() {
  const [fileTrans, setFileTrans] = useState<FileTranscription[]>([])
  const [expandedMap, setExpandedMap] = useState<Record<number, boolean>>({})
  const limit = useRef(pLimit(5))
  const fileInputRef = useRef<HTMLInputElement>(null)

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000)
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    if (m > 0) {
      return s > 0 ? `${m}분 ${s}초` : `${m}분`
    }
    return `${s}초`
  }

  // 개별 파일을 .txt 로 다운로드
  const downloadText = (data: TranscriptionResult, fileName: string) => {
    let content = ""
    if (data.utterances) {
      content = data.utterances
        .map(u => `화자${u.speaker} [${formatTime(u.start)} - ${formatTime(u.end)}]\n${u.text}`)
        .join("\n\n")
    } else if (data.text) {
      content = data.text
    }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${fileName}-transcription.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // 전체 파일을 각각 .txt 로 다운로드
  const downloadAll = () => {
    fileTrans.forEach((ft) => {
      if (ft.transcription) {
        downloadText(ft.transcription, ft.fileName)
      }
    })
  }

  const handleFiles = useCallback(async (files: FileList) => {
    const arr = Array.from(files)
    setFileTrans(arr.map(f => ({
      file: f,
      fileName: f.name,
      isUploading: true,
      isLoading: true,
      transcription: null
    })))
    await Promise.all(arr.map((file, idx) => limit.current(async () => {
      try {
        const res = await fetch('/api/transcribe', { method: 'POST', body: file })
        if (!res.ok) throw new Error(await res.text())
        const data: TranscriptionResult = await res.json()
        setFileTrans(prev => {
          const p = [...prev]
          p[idx] = { ...p[idx], isUploading: false, isLoading: false, transcription: data }
          return p
        })
      } catch (e: any) {
        setFileTrans(prev => {
          const p = [...prev]
          p[idx] = { ...p[idx], isUploading: false, isLoading: false, transcription: null, error: e.message }
          return p
        })
      }
    })))
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center pt-8">
          <h1 className="text-6xl font-bold text-slate-800">ATT</h1>
          <p className="text-xl text-slate-600">Audio To Text</p>
        </div>

        {/* 업로드 카드 */}
        <Card
          className="border-2 border-dashed border-slate-300"
          onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={e => {
            e.preventDefault(); e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFiles(e.dataTransfer.files)
            }
          }}
        >
          <CardContent className="p-8">
            <div className="text-center space-y-4">
              <FileAudio className="h-12 w-12 mx-auto text-slate-400" />
              <p className="text-lg font-medium text-slate-700">음성 파일을 업로드 하세요</p>
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Upload className="mr-2" /> 파일 선택
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={e => e.target.files && handleFiles(e.target.files)}
              />
            </div>

            {/* 전사 결과 목록 */}
            <div className="mt-8 space-y-6">
              {fileTrans.map((ft, fidx) => {
                const utts = ft.transcription?.utterances || []
                const expanded = expandedMap[fidx]
                const showList = expanded ? utts : utts.slice(0, 2)

                return (
                  <div key={fidx} className="border rounded-lg p-4 bg-white relative">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">{ft.fileName}</span>
                      {/* 개별 다운로드 버튼 */}
                      {ft.transcription && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex items-center space-x-1"
                          onClick={() => downloadText(ft.transcription!, ft.fileName)}
                        >
                          <Download className="h-4 w-4" />
                          <span>다운로드</span>
                        </Button>
                      )}
                    </div>

                    {ft.isUploading && <p>업로드 중...</p>}
                    {ft.isLoading && <p>변환 중...</p>}
                    {ft.error && <p className="text-red-600">오류: {ft.error}</p>}

                    {utts.length > 0 && (
                      <div className="space-y-4">
                        {showList.map((u, ui) => (
                          <div key={ui} className="p-3 rounded-lg">
                            <span
                              className={`${getSpeakerClass(u.speaker)} inline-block px-2 py-1 text-xs font-semibold rounded`}
                            >
                              화자{u.speaker}
                            </span>
                            <span className="ml-2 text-gray-500 text-xs">
                              {formatTime(u.start)} – {formatTime(u.end)}
                            </span>
                            <p className="mt-2 text-slate-700 whitespace-pre-wrap">{u.text}</p>
                          </div>
                        ))}

                        {!expanded && utts.length > 2 && (
                          <div className="pointer-events-none absolute bottom-16 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-white" />
                        )}

                        {utts.length > 2 && (
                          <div className="text-center">
                            <Button
                              size="sm"
                              className="bg-blue-500 hover:bg-blue-600"
                              onClick={() =>
                                setExpandedMap(prev => ({ ...prev, [fidx]: !expanded }))
                              }
                            >
                              {expanded ? '접기' : '더보기'}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* utterances 가 없을 때 전체 텍스트 */}
                    {!ft.transcription?.utterances && ft.transcription?.text && (
                      <p className="text-slate-700 mt-2">{ft.transcription.text}</p>
                    )}
                  </div>
                )
              })}
            </div>

            {/* 전체 다운로드 버튼 */}
            {fileTrans.some(ft => ft.transcription) && (
              <div className="text-center mt-8">
                <Button onClick={downloadAll} className="bg-green-600 hover:bg-green-700">
                  <Download className="mr-2" />
                  전체 다운로드
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
