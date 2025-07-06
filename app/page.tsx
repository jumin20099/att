// app/page.tsx
"use client"

import type React from "react"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, FileAudio, Download } from "lucide-react"
import axios from "axios"
import pLimit from "p-limit"

interface TranscriptionResult {
  text: string
  confidence?: number
  language?: string
}

interface FileTranscription {
  file: File
  fileName: string
  progress: number
  isUploading: boolean
  isLoading: boolean
  transcription: TranscriptionResult | null
  error?: string
}

export default function AudioToText() {
  const [fileTranscriptions, setFileTranscriptions] = useState<FileTranscription[]>([])
  const limit = useRef(pLimit(5))
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showAllResults, setShowAllResults] = useState(false)

  const handleFiles = useCallback(async (files: FileList) => {
    const fileArr = Array.from(files)
    setFileTranscriptions(
      fileArr.map((file) => ({
        file,
        fileName: file.name,
        progress: 0,
        isUploading: true,
        isLoading: true,
        transcription: null,
      }))
    )

    // 동시 5개 제한
    const results = await Promise.all(
      fileArr.map((file, idx) =>
        limit.current(async () => {
          try {
            const formData = new FormData()
            formData.append("audio", file)

            const config = {
              headers: { "Content-Type": "multipart/form-data" },
              onUploadProgress: (e: ProgressEvent) => {
                if (e.total) {
                  const percent = Math.round((e.loaded * 100) / e.total)
                  setFileTranscriptions((prev) => {
                    const copy = [...prev]
                    copy[idx] = { ...copy[idx], progress: percent }
                    return copy
                  })
                }
              },
            }

            const response = await axios.post<TranscriptionResult>(
              "/api/transcribe",
              formData,
              config
            )

            setFileTranscriptions((prev) => {
              const copy = [...prev]
              copy[idx] = {
                ...copy[idx],
                isUploading: false,
                isLoading: false,
                progress: 100,
                transcription: response.data,
              }
              return copy
            })
          } catch (error: any) {
            setFileTranscriptions((prev) => {
              const copy = [...prev]
              copy[idx] = {
                ...copy[idx],
                isUploading: false,
                isLoading: false,
                error: error?.message || "오류 발생",
              }
              return copy
            })
          }
        })
      )
    )
  }, [])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [handleFiles],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files)
      }
    },
    [handleFiles],
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("audio/")) {
          const file = items[i].getAsFile()
          if (file) {
            handleFiles([file] as any)
            break
          }
        }
      }
    },
    [handleFiles],
  )

  const downloadText = (transcription: TranscriptionResult | null, fileName: string) => {
    if (!transcription?.text) return
    const blob = new Blob([transcription.text], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `transcription_${fileName}_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // 모두 다운로드 함수 추가
  const downloadAll = () => {
    fileTranscriptions.forEach((ft) => {
      if (ft.transcription?.text) {
        const blob = new Blob([ft.transcription.text], { type: "text/plain;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `transcription_${ft.fileName}_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      }
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2 pt-8">
          <h1 className="text-6xl font-bold text-slate-800 tracking-tight">ATT</h1>
          <p className="text-xl text-slate-600 font-medium">Audio To Text</p>
        </div>

        {/* Upload Area */}
        <Card className="border-2 border-dashed border-slate-300 hover:border-slate-400 transition-colors">
          <CardContent className="p-8">
            <div
              className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                dragActive ? "border-blue-400 bg-blue-50" : "border-slate-300 hover:border-slate-400"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onPaste={handlePaste}
              tabIndex={0}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="space-y-4">
                <div className="flex justify-center">
                  <FileAudio className="h-12 w-12 text-slate-400" />
                </div>
                <div>
                  <p className="text-lg font-medium text-slate-700 mb-2">음성 파일을 업로드하세요</p>
                  <p className="text-sm text-slate-500">드래그 앤 드롭, 파일 선택, 또는 복사 붙여넣기</p>
                </div>
                <Button onClick={() => fileInputRef.current?.click()} className="bg-blue-600 hover:bg-blue-700">
                  <Upload className="h-4 w-4 mr-2" />
                  파일 선택
                </Button>
              </div>
              {/* 파일별 업로드/진행률/결과 */}
              <div className="mt-8 space-y-6" style={{ position: 'relative' }}>
                {(showAllResults ? fileTranscriptions : fileTranscriptions.slice(0, 3)).map((ft, idx) => (
                  <div key={ft.fileName} className="border rounded-lg p-4 bg-slate-50 text-left">
                    <div className="font-semibold text-slate-700 mb-2">{ft.fileName}</div>
                    {ft.isUploading && (
                      <div className="w-full bg-gray-200 h-2 rounded my-2">
                        <div
                          className="h-2 bg-blue-500 rounded"
                          style={{ width: `${ft.progress}%` }}
                        />
                      </div>
                    )}
                    <p className="text-sm mb-2">
                      {ft.isUploading
                        ? `업로드 중: ${ft.progress}%`
                        : ft.isLoading
                        ? "변환 중..."
                        : ft.error
                        ? `오류: ${ft.error}`
                        : "완료"}
                    </p>
                    {ft.transcription && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-500">
                            {ft.transcription.confidence &&
                              `정확도: ${Math.round(ft.transcription.confidence * 100)}%`}
                          </span>
                          <Button
                            onClick={() => downloadText(ft.transcription, ft.fileName)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            다운로드
                          </Button>
                        </div>
                        <div className="bg-white rounded p-3 max-h-48 overflow-y-auto border">
                          <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{ft.transcription.text}</p>
                        </div>
                        {ft.transcription.language && (
                          <p className="text-xs text-slate-500">감지된 언어: {ft.transcription.language}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {/* 더보기/접기 버튼 */}
                {fileTranscriptions.length > 3 && (
                  <div className="text-center mt-4">
                    <Button
                      onClick={() => setShowAllResults((prev) => !prev)}
                      className="bg-blue-500 hover:bg-blue-600"
                    >
                      {showAllResults ? '접기' : '더보기'}
                    </Button>
                  </div>
                )}
                {/* 3개 초과 & 더보기 전일 때 하단 그라데이션 오버레이 */}
                {!showAllResults && fileTranscriptions.length > 3 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 56, // 버튼 높이+여백 고려
                      height: 120,
                      pointerEvents: 'none',
                      background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(245,245,245,0.98) 80%, rgba(245,245,245,1) 100%)',
                      borderBottomLeftRadius: '0.5rem',
                      borderBottomRightRadius: '0.5rem',
                    }}
                  />
                )}
              </div>
              {fileTranscriptions.some(ft => ft.transcription?.text) && (
                <div className="text-center mt-8">
                  <Button onClick={downloadAll} size="lg" className="bg-green-600 hover:bg-green-700">
                    <Download className="h-4 w-4 mr-2" />
                    모두 다운로드
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}