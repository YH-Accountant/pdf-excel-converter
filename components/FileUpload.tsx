'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

interface FileUploadProps {
  onFilesSelect: (files: File[], pdfText?: string) => void
  selectedFiles: File[]
}

export default function FileUpload({ onFilesSelect, selectedFiles }: FileUploadProps) {
  const [isConverting, setIsConverting] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [extractedText, setExtractedText] = useState<string>('')
  const initialized = useRef(false)

  // 클라이언트에서만 pdfjs worker 설정
  useEffect(() => {
    if (!initialized.current && typeof window !== 'undefined') {
      // pdfjs-dist 4.10.38 버전에 맞는 워커 (unpkg에서 제공)
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`
      initialized.current = true
      setIsReady(true)
    }
  }, [])

  // PDF에서 텍스트 직접 추출
  const extractTextFromPdf = async (pdfFile: File): Promise<string> => {
    const arrayBuffer = await pdfFile.arrayBuffer()

    // CMap 설정 추가 (한글 등 CJK 폰트 지원) - 로컬 경로 사용
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: '/cmaps/',
      cMapPacked: true,
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

  // PDF를 여러 이미지로 변환 (스캔된 PDF용)
  const convertPdfToImages = async (pdfFile: File): Promise<File[]> => {
    const arrayBuffer = await pdfFile.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const images: File[] = []

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const scale = 6  // 고해상도 (정확도 향상)
      const viewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!
      canvas.height = viewport.height
      canvas.width = viewport.width

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/png', 1.0)
      })

      const fileName = pdfFile.name.replace('.pdf', `_page${i}.png`)
      images.push(new File([blob], fileName, { type: 'image/png' }))
    }

    return images
  }

  const handleFiles = async (fileList: FileList) => {
    setIsConverting(true)
    const newFiles: File[] = []
    let combinedText = ''

    try {
      for (const file of Array.from(fileList)) {
        if (file.type === 'application/pdf') {
          if (!isReady) {
            alert('PDF 라이브러리 로딩 중입니다. 잠시 후 다시 시도해주세요.')
            continue
          }

          // PDF에서 텍스트 직접 추출 (항상 텍스트 기반 추출 사용)
          console.log('=== PDF 텍스트 추출 시도 ===')
          const text = await extractTextFromPdf(file)

          // 페이지 태그를 제외한 실제 콘텐츠만 추출
          const contentOnly = text.replace(/\[페이지 \d+\]\s*/g, '').trim()
          const contentLength = contentOnly.replace(/\s/g, '').length

          console.log('추출된 텍스트 길이 (실제 콘텐츠, 공백 제외):', contentLength)
          console.log('추출된 텍스트 미리보기:', text.slice(0, 500))

          // 실제 콘텐츠가 있는지 확인 (최소 50자 이상의 실제 텍스트)
          if (contentLength >= 50) {
            console.log('✓ 텍스트 추출 성공! 텍스트 기반 추출 모드 사용')
            combinedText += `[파일: ${file.name}]\n${text}\n\n`
            newFiles.push(new File([file], file.name, { type: 'text/plain' }))
          } else {
            // 실제 콘텐츠가 없는 경우 (스캔된 PDF) → 이미지로 변환
            console.log('✗ 텍스트 추출 실패 (스캔된 PDF), 이미지로 변환하여 Vision API 사용')
            const images = await convertPdfToImages(file)
            newFiles.push(...images)
            console.log(`✓ ${images.length}개 이미지로 변환 완료`)
          }
        } else if (file.type.startsWith('image/')) {
          // 이미지 파일은 지원하지 않음 (정확도 문제)
          alert('이미지 파일은 지원하지 않습니다. PDF 파일만 업로드해주세요.')
          continue
        }
      }

      setExtractedText(combinedText)
      onFilesSelect([...selectedFiles, ...newFiles], combinedText || undefined)
    } catch (error) {
      console.error('파일 처리 오류:', error)
      alert('파일 처리에 실패했습니다.')
    } finally {
      setIsConverting(false)
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files)
      }
    },
    [isReady, selectedFiles]
  )

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files)
    }
  }

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index)
    onFilesSelect(newFiles)
    if (newFiles.length === 0) {
      setExtractedText('')
    }
  }

  const clearAll = () => {
    onFilesSelect([])
    setExtractedText('')
  }

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
          ${selectedFiles.length > 0 ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
          ${isConverting ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <input
          type="file"
          accept=".pdf"
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
          disabled={isConverting}
          multiple
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          {isConverting ? (
            <div className="space-y-2">
              <div className="w-12 h-12 mx-auto bg-yellow-100 rounded-full flex items-center justify-center animate-pulse">
                <svg className="w-6 h-6 text-yellow-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <p className="text-yellow-600 font-medium">파일 처리 중...</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-gray-600">
                PDF 파일을 드래그하거나 클릭하여 업로드
              </p>
              <p className="text-sm text-gray-400">
                여러 파일 선택 가능 | 텍스트 자동 추출
              </p>
            </div>
          )}
        </label>
      </div>

      {/* 업로드된 파일 목록 */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <p className="text-sm font-medium text-gray-700">
              업로드된 파일 ({selectedFiles.length}개)
              {extractedText && <span className="ml-2 text-green-600">(텍스트 추출됨)</span>}
            </p>
            <button
              onClick={clearAll}
              className="text-sm text-red-500 hover:text-red-700"
            >
              전체 삭제
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm"
              >
                <span className="truncate flex-1">{file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  className="ml-2 text-gray-400 hover:text-red-500"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
