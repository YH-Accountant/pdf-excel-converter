'use client'

import { useCallback, useState, useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { checkImageQuality } from '@/lib/imageQuality'

interface FileUploadProps {
  onFilesSelect: (files: File[], pdfText?: string) => void
  selectedFiles: File[]
}

export default function FileUpload({ onFilesSelect, selectedFiles }: FileUploadProps) {
  const [isConverting, setIsConverting] = useState(false)
  const [conversionStatus, setConversionStatus] = useState<string>('')
  const [isReady, setIsReady] = useState(false)
  const [extractedText, setExtractedText] = useState<string>('')
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && typeof window !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs`
      initialized.current = true
      setIsReady(true)
    }
  }, [])

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

  const convertPdfToBase64Images = async (pdfFile: File): Promise<{ base64: string; mediaType: string }[]> => {
    const arrayBuffer = await pdfFile.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const images: { base64: string; mediaType: string }[] = []

    for (let i = 1; i <= pdf.numPages; i++) {
      setConversionStatus(`이미지 변환 중... (${i}/${pdf.numPages})`)
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

  const callGoogleOcr = async (images: { base64: string; mediaType: string }[]): Promise<string> => {
    setConversionStatus('Google Vision OCR 처리 중...')

    const response = await fetch('/api/ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images, useDocumentMode: true }),
    })

    if (!response.ok) {
      throw new Error('OCR 처리 실패')
    }

    const data = await response.json()
    return data.text
  }

  const handleFiles = async (fileList: FileList) => {
    setIsConverting(true)
    setConversionStatus('파일 분석 중...')
    const newFiles: File[] = []
    let combinedText = ''

    try {
      for (const file of Array.from(fileList)) {
        if (file.type === 'application/pdf') {
          if (!isReady) {
            alert('PDF 라이브러리 로딩 중입니다. 잠시 후 다시 시도해주세요.')
            continue
          }

          console.log('=== PDF 텍스트 추출 시도 ===')
          setConversionStatus('텍스트 추출 시도 중...')
          const text = await extractTextFromPdf(file)

          const contentOnly = text.replace(/\[페이지 \d+\]\s*/g, '').trim()
          const contentLength = contentOnly.replace(/\s/g, '').length

          console.log('추출된 텍스트 길이:', contentLength)

          if (contentLength >= 50) {
            console.log('✓ 텍스트 추출 성공!')
            combinedText += `[파일: ${file.name}]\n${text}\n\n`
            newFiles.push(new File([file], file.name, { type: 'text/plain' }))
          } else {
            console.log('✗ 스캔 PDF 감지! Google Vision OCR 사용')
            setConversionStatus('스캔 PDF 감지 - OCR 처리 시작...')

            const images = await convertPdfToBase64Images(file)
            console.log(`${images.length}개 페이지 이미지 변환 완료`)

            const ocrText = await callGoogleOcr(images)
            console.log('Google OCR 결과 길이:', ocrText.length)

            if (ocrText && ocrText.length > 50) {
              combinedText += `[파일: ${file.name} (OCR)]\n${ocrText}\n\n`
              newFiles.push(new File([file], file.name, { type: 'text/plain' }))
            } else {
              console.log('OCR 텍스트 부족, Claude Vision 사용')
              for (let idx = 0; idx < images.length; idx++) {
                const img = images[idx]
                const binary = atob(img.base64)
                const array = new Uint8Array(binary.length)
                for (let j = 0; j < binary.length; j++) {
                  array[j] = binary.charCodeAt(j)
                }
                const blob = new Blob([array], { type: 'image/png' })
                const imgFile = new File([blob], file.name.replace('.pdf', `_page${idx + 1}.png`), { type: 'image/png' })
                newFiles.push(imgFile)
              }
            }
          }
        } else if (file.type.startsWith('image/')) {
          // 이미지 파일: Google Vision OCR 사용
          console.log('=== 이미지 파일 처리 ===')
          setConversionStatus('이미지 OCR 처리 중...')

          // 해상도 + 선명도 기준으로 저화질 판단 후 필요 시 canvas로 2배 확대
          const imageData = await new Promise<{ base64: string; mediaType: string }>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => {
              const dataUrl = reader.result as string
              const originalBase64 = dataUrl.split(',')[1]
              const img = new Image()
              img.onload = () => {
                const quality = checkImageQuality(img)
                if (quality.isLow) {
                  console.log(`저화질 이미지 감지 [${quality.reason}] ${quality.detail} → canvas 2배 확대`)
                  setConversionStatus('저화질 이미지 확대 처리 중...')
                  const canvas = document.createElement('canvas')
                  canvas.width = img.width * 2
                  canvas.height = img.height * 2
                  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
                  resolve({ base64: canvas.toDataURL('image/png').split(',')[1], mediaType: 'image/png' })
                } else {
                  console.log(`고화질 이미지 ${quality.detail} → 원본 그대로 OCR`)
                  resolve({ base64: originalBase64, mediaType: file.type })
                }
              }
              img.onerror = reject
              img.src = dataUrl
            }
            reader.onerror = reject
            reader.readAsDataURL(file)
          })

          const ocrText = await callGoogleOcr([imageData])
          console.log('Google OCR 결과 길이:', ocrText.length)

          if (ocrText && ocrText.length > 50) {
            // OCR 텍스트로 추출
            combinedText += `[파일: ${file.name} (OCR)]\n${ocrText}\n\n`
            newFiles.push(new File([file], file.name, { type: 'text/plain' }))
          } else {
            // OCR 텍스트가 부족하면 Claude Vision 사용
            console.log('OCR 텍스트 부족, Claude Vision 사용')
            newFiles.push(file)
          }
        }
      }

      setExtractedText(combinedText)
      onFilesSelect([...selectedFiles, ...newFiles], combinedText || undefined)
    } catch (error) {
      console.error('파일 처리 오류:', error)
      alert('파일 처리에 실패했습니다: ' + (error as Error).message)
    } finally {
      setIsConverting(false)
      setConversionStatus('')
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
          accept=".pdf,image/*"
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
              <p className="text-yellow-600 font-medium">{conversionStatus || '처리 중...'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="w-12 h-12 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <p className="text-gray-600">
                PDF 또는 이미지 파일을 드래그하거나 클릭하여 업로드
              </p>
              <p className="text-sm text-gray-400">
                PDF, PNG, JPG 등 지원 (Google OCR)
              </p>
            </div>
          )}
        </label>
      </div>

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
