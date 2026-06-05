'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import Link from 'next/link'
import { DocumentType, ExtractedData } from '@/app/single/page'
import BatchExcelDownload from '@/components/BatchExcelDownload'
import * as pdfjsLib from 'pdfjs-dist'

interface ProcessingFile {
  file: File
  status: 'pending' | 'processing' | 'completed' | 'error'
  result?: ExtractedData[]  // 다중 문서 지원을 위해 배열로 변경
  error?: string
}

export default function BatchPage() {
  const [files, setFiles] = useState<ProcessingFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPdfReady, setIsPdfReady] = useState(false)
  const initialized = useRef(false)

  // PDF.js 초기화
  useEffect(() => {
    if (!initialized.current && typeof window !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`
      initialized.current = true
      setIsPdfReady(true)
    }
  }, [])

  // PDF에서 텍스트 추출
  const extractTextFromPdf = async (pdfFile: File): Promise<string> => {
    const arrayBuffer = await pdfFile.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
      useSystemFonts: true,
      standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/standard_fonts/',
    }).promise

    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
      fullText += `[페이지 ${i}]\n${pageText}\n\n`
    }
    return fullText
  }

  // PDF를 이미지로 변환
  const convertPdfToBase64Images = async (pdfFile: File): Promise<{ base64: string; mediaType: string }[]> => {
    const arrayBuffer = await pdfFile.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const images: { base64: string; mediaType: string }[] = []

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const scale = 3
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      canvas.height = viewport.height
      canvas.width = viewport.width

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise

      const base64 = canvas.toDataURL('image/png').split(',')[1]
      images.push({ base64, mediaType: 'image/png' })
    }

    return images
  }

  // Google Vision OCR 호출 (5장씩 분할 전송 → 4MB 한도 초과 방지)
  const callGoogleOcr = async (images: { base64: string; mediaType: string }[]): Promise<string> => {
    const BATCH_SIZE = 5
    const textParts: string[] = []

    for (let i = 0; i < images.length; i += BATCH_SIZE) {
      const batch = images.slice(i, i + BATCH_SIZE)
      const response = await fetch('/api/ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images: batch, useDocumentMode: true }),
      })

      if (!response.ok) {
        throw new Error('OCR 처리 실패')
      }

      const data = await response.json()
      if (data.text) textParts.push(data.text)
    }

    return textParts.join('\n\n')
  }

  // 지원하는 파일 형식 체크
  const isValidFile = (file: File): boolean => {
    const validTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/tiff',
    ]
    return validTypes.includes(file.type)
  }

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files).filter(isValidFile)
    const newFiles: ProcessingFile[] = droppedFiles.map((file) => ({
      file,
      status: 'pending',
    }))
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(isValidFile)
      const newFiles: ProcessingFile[] = selectedFiles.map((file) => ({
        file,
        status: 'pending',
      }))
      setFiles((prev) => [...prev, ...newFiles])
    }
  }

  // 이미지 파일을 base64로 변환
  const convertImageToBase64 = async (imageFile: File): Promise<{ base64: string; mediaType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1]
        resolve({ base64, mediaType: imageFile.type })
      }
      reader.onerror = reject
      reader.readAsDataURL(imageFile)
    })
  }

  // 다중 문서 응답을 단일 문서 배열로 변환
  const processApiResponse = (data: any, fileName: string): ExtractedData[] => {
    // 다중 문서 응답인 경우
    if (data.isMultipleDocuments && data.documents) {
      console.log(`=== 복합 증빙 감지 (${fileName}): ${data.documents.length}개 문서 유형 ===`)
      return data.documents.map((doc: any) => ({
        documentType: doc.documentType,
        fields: doc.fields,
      }))
    }

    // 단일 문서 응답
    return [{
      documentType: data.documentType,
      fields: data.fields,
    }]
  }

  const processFile = async (fileItem: ProcessingFile): Promise<ExtractedData[]> => {
    const formData = new FormData()

    // PDF 처리: 텍스트 추출 시도 -> OCR -> 이미지 변환
    if (fileItem.file.type === 'application/pdf') {
      console.log(`=== PDF 처리: ${fileItem.file.name} ===`)

      // 1. 텍스트 추출 시도
      const text = await extractTextFromPdf(fileItem.file)
      const contentOnly = text.replace(/\[페이지 \d+\]\s*/g, '').trim()
      const contentLength = contentOnly.replace(/\s/g, '').length

      console.log('추출된 텍스트 길이:', contentLength)

      if (contentLength >= 50) {
        // 텍스트 기반 추출
        console.log('✓ 텍스트 추출 성공!')
        formData.append('pdfText', text)
        formData.append('file0', new File([fileItem.file], fileItem.file.name, { type: 'text/plain' }))
        formData.append('fileCount', '1')
      } else {
        // 2. 스캔 PDF - Google Vision OCR 시도
        console.log('✗ 스캔 PDF 감지! Google Vision OCR 사용')
        const images = await convertPdfToBase64Images(fileItem.file)
        console.log(`${images.length}개 페이지 이미지 변환 완료`)

        const ocrText = await callGoogleOcr(images)
        console.log('Google OCR 결과 길이:', ocrText.length)

        if (ocrText && ocrText.length > 50) {
          // OCR 텍스트로 추출
          formData.append('pdfText', ocrText)
          formData.append('file0', new File([fileItem.file], fileItem.file.name, { type: 'text/plain' }))
          formData.append('fileCount', '1')
        } else {
          // 3. Claude Vision 사용 (이미지 직접 전송)
          console.log('OCR 텍스트 부족, Claude Vision 사용')
          for (let idx = 0; idx < images.length; idx++) {
            const img = images[idx]
            const binary = atob(img.base64)
            const array = new Uint8Array(binary.length)
            for (let j = 0; j < binary.length; j++) {
              array[j] = binary.charCodeAt(j)
            }
            const blob = new Blob([array], { type: 'image/png' })
            const imgFile = new File([blob], fileItem.file.name.replace('.pdf', `_page${idx + 1}.png`), { type: 'image/png' })
            formData.append(`file${idx}`, imgFile)
          }
          formData.append('fileCount', images.length.toString())
        }
      }
    } else if (fileItem.file.type.startsWith('image/')) {
      // 이미지 파일: Google Vision OCR 사용
      console.log(`=== 이미지 처리: ${fileItem.file.name} ===`)

      const imageData = await convertImageToBase64(fileItem.file)
      console.log('이미지 변환 완료, OCR 시도...')

      const ocrText = await callGoogleOcr([imageData])
      console.log('Google OCR 결과 길이:', ocrText.length)

      if (ocrText && ocrText.length > 50) {
        // OCR 텍스트로 추출
        formData.append('pdfText', ocrText)
        formData.append('file0', new File([fileItem.file], fileItem.file.name, { type: 'text/plain' }))
        formData.append('fileCount', '1')
      } else {
        // OCR 텍스트가 부족하면 Claude Vision 사용
        console.log('OCR 텍스트 부족, Claude Vision 사용')
        formData.append('file0', fileItem.file)
        formData.append('fileCount', '1')
      }
    } else {
      // 기타 파일
      formData.append('file0', fileItem.file)
      formData.append('fileCount', '1')
    }

    const response = await fetch('/api/extract', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || '추출 실패')
    }

    const data = await response.json()

    // 다중 문서 응답 처리
    return processApiResponse(data, fileItem.file.name)
  }

  const startBatchProcess = async () => {
    setIsProcessing(true)
    const pendingFiles = files.filter((f) => f.status === 'pending')

    for (let i = 0; i < pendingFiles.length; i++) {
      const fileItem = pendingFiles[i]
      const fileIndex = files.findIndex((f) => f.file === fileItem.file)
      setCurrentIndex(fileIndex)

      // 상태를 processing으로 업데이트
      setFiles((prev) =>
        prev.map((f, idx) =>
          idx === fileIndex ? { ...f, status: 'processing' } : f
        )
      )

      try {
        const result = await processFile(fileItem)
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === fileIndex ? { ...f, status: 'completed', result } : f
          )
        )
      } catch (error) {
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === fileIndex
              ? { ...f, status: 'error', error: (error as Error).message }
              : f
          )
        )
      }

      // API 속도 제한을 위한 딜레이 (1초)
      if (i < pendingFiles.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    setIsProcessing(false)
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const clearAll = () => {
    setFiles([])
    setCurrentIndex(0)
  }

  // 다중 문서 결과를 평탄화하여 단일 배열로 만듦
  const completedResults = files
    .filter((f) => f.status === 'completed' && f.result)
    .flatMap((f) => f.result!)

  const stats = {
    total: files.length,
    pending: files.filter((f) => f.status === 'pending').length,
    processing: files.filter((f) => f.status === 'processing').length,
    completed: files.filter((f) => f.status === 'completed').length,
    error: files.filter((f) => f.status === 'error').length,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 transition-all duration-500">
      <div className="max-w-6xl mx-auto py-12 px-4">
        {/* 헤더 */}
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors bg-white/60 backdrop-blur-sm px-3 py-1.5 rounded-lg"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            메인으로
          </Link>
        </div>

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/30 backdrop-blur-sm mb-4">
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            대량 증빙 일괄 처리
          </h1>
          <p className="text-gray-600">
            여러 PDF/이미지 파일을 한 번에 처리하여 통합 엑셀로 내보냅니다
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg rounded-2xl p-6 space-y-6">
          {/* 파일 업로드 영역 */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
              ${files.length > 0 ? 'border-emerald-400 bg-emerald-50/50' : 'border-gray-300 hover:border-emerald-400'}
              ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <input
              type="file"
              accept=".pdf,image/*"
              onChange={handleFileInput}
              className="hidden"
              id="batch-file-upload"
              multiple
              disabled={isProcessing}
            />
            <label htmlFor="batch-file-upload" className="cursor-pointer">
              <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">
                PDF 또는 이미지 파일을 드래그하거나 클릭하여 업로드
              </p>
              <p className="text-sm text-gray-400 mt-1">
                PDF, PNG, JPG, GIF, WEBP 등 지원 (여러 파일 선택 가능)
              </p>
            </label>
          </div>

          {/* 파일 목록 */}
          {files.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex gap-4 text-sm">
                  <span className="text-gray-600">전체: {stats.total}</span>
                  <span className="text-yellow-600">대기: {stats.pending}</span>
                  <span className="text-blue-600">처리중: {stats.processing}</span>
                  <span className="text-green-600">완료: {stats.completed}</span>
                  <span className="text-red-600">오류: {stats.error}</span>
                </div>
                <button
                  onClick={clearAll}
                  disabled={isProcessing}
                  className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  전체 삭제
                </button>
              </div>

              {/* 진행바 */}
              {isProcessing && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${((stats.completed + stats.error) / stats.total) * 100}%`,
                    }}
                  />
                </div>
              )}

              <div className="max-h-60 overflow-y-auto space-y-2">
                {files.map((fileItem, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg text-sm
                      ${fileItem.status === 'pending' ? 'bg-gray-50' : ''}
                      ${fileItem.status === 'processing' ? 'bg-blue-50 border border-blue-200' : ''}
                      ${fileItem.status === 'completed' ? 'bg-green-50' : ''}
                      ${fileItem.status === 'error' ? 'bg-red-50' : ''}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* 상태 아이콘 */}
                      {fileItem.status === 'pending' && (
                        <span className="w-5 h-5 rounded-full bg-gray-300" />
                      )}
                      {fileItem.status === 'processing' && (
                        <span className="w-5 h-5 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                      )}
                      {fileItem.status === 'completed' && (
                        <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">✓</span>
                      )}
                      {fileItem.status === 'error' && (
                        <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">✕</span>
                      )}

                      <span className="truncate">{fileItem.file.name}</span>

                      {fileItem.result && fileItem.result.length > 0 && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs">
                          {fileItem.result.length > 1
                            ? `복합: ${fileItem.result.map(r => r.documentType).join(', ')}`
                            : fileItem.result[0].documentType}
                        </span>
                      )}

                      {fileItem.error && (
                        <span className="text-red-600 text-xs">{fileItem.error}</span>
                      )}
                    </div>

                    {!isProcessing && (
                      <button
                        onClick={() => removeFile(index)}
                        className="text-gray-400 hover:text-red-500 ml-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 처리 버튼 */}
          {files.length > 0 && stats.pending > 0 && (
            <button
              onClick={startBatchProcess}
              disabled={isProcessing}
              className="w-full py-3 px-4 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg hover:shadow-xl"
            >
              {isProcessing
                ? `처리 중... (${stats.completed + stats.error}/${stats.total})`
                : `일괄 처리 시작 (${stats.pending}개 파일)`}
            </button>
          )}

          {/* 통합 엑셀 다운로드 */}
          {completedResults.length > 0 && !isProcessing && (
            <BatchExcelDownload results={completedResults} />
          )}
        </div>

        {/* 처리 결과 요약 */}
        {completedResults.length > 0 && !isProcessing && (
          <div className="mt-8 bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg rounded-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">처리 결과 요약</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(
                completedResults.reduce((acc, r) => {
                  acc[r.documentType] = (acc[r.documentType] || 0) + 1
                  return acc
                }, {} as Record<string, number>)
              ).map(([type, count]) => (
                <div key={type} className="bg-emerald-50/50 rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-emerald-600">{count}</div>
                  <div className="text-sm text-gray-600">{type}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
