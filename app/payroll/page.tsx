'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import * as pdfjsLib from 'pdfjs-dist'
import XLSX from 'xlsx-js-style'

interface PayrollEmployee {
  name: string
  netPay: number  // 실지급액
}

interface BankTransaction {
  date: string
  description: string  // 적요
  withdrawal: number   // 출금액
  matchedEmployee?: string  // 매칭된 직원명
}

interface PayrollData {
  yearMonth: string
  paymentDate: string
  employees: PayrollEmployee[]
  totalNetPay: number
}

interface BankData {
  transactions: BankTransaction[]
  totalWithdrawal: number
}

interface WithholdingData {
  attributionYearMonth: string
  numberOfPeople: number
  totalPayment: number
  incomeTax: number
  localIncomeTax: number
}

interface MatchResult {
  name: string
  payrollAmount: number
  bankAmount: number
  difference: number
  isMatched: boolean
}

interface VerificationResult {
  payrollTotal: number
  bankTotal: number
  withholdingTotal: number | null
  difference: number
  isMatched: boolean
  individualMatches: MatchResult[]
}

interface ProcessingFile {
  file: File
  status: 'pending' | 'processing' | 'completed' | 'error'
  result?: any
  documentType?: string
  error?: string
}

export default function PayrollPage() {
  const [files, setFiles] = useState<ProcessingFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [payrollData, setPayrollData] = useState<PayrollData | null>(null)
  const [bankData, setBankData] = useState<BankData | null>(null)
  const [withholdingData, setWithholdingData] = useState<WithholdingData | null>(null)
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
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

  // Google Vision OCR 호출
  const callGoogleOcr = async (images: { base64: string; mediaType: string }[]): Promise<string> => {
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

  // 지원하는 파일 형식 체크
  const isValidFile = (file: File): boolean => {
    const validTypes = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]
    const name = file.name.toLowerCase()
    return validTypes.includes(file.type) || name.endsWith('.xls') || name.endsWith('.xlsx')
  }

  // Excel 파일을 CSV 텍스트로 변환
  const readExcelAsText = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = e.target?.result
          const wb = XLSX.read(data, { type: 'array' })
          let text = ''
          wb.SheetNames.forEach((sheetName) => {
            const ws = wb.Sheets[sheetName]
            const csv = XLSX.utils.sheet_to_csv(ws)
            text += `[시트: ${sheetName}]\n${csv}\n\n`
          })
          resolve(text)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })

  // 파일 드롭 핸들러
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files).filter(isValidFile)
    const newFiles: ProcessingFile[] = droppedFiles.map((file) => ({
      file,
      status: 'pending',
    }))
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  // 파일 선택 핸들러
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

  // 파일 처리 (문서 유형 자동 감지)
  const processFile = async (fileItem: ProcessingFile): Promise<any> => {
    const formData = new FormData()

    if (fileItem.file.type === 'application/pdf') {
      // PDF 처리
      const text = await extractTextFromPdf(fileItem.file)
      const contentOnly = text.replace(/\[페이지 \d+\]\s*/g, '').trim()
      const contentLength = contentOnly.replace(/\s/g, '').length

      if (contentLength >= 50) {
        formData.append('pdfText', text)
        formData.append('file0', new File([fileItem.file], fileItem.file.name, { type: 'text/plain' }))
        formData.append('fileCount', '1')
      } else {
        // 스캔 PDF - OCR 사용
        const images = await convertPdfToBase64Images(fileItem.file)
        const ocrText = await callGoogleOcr(images)

        if (ocrText && ocrText.length > 50) {
          formData.append('pdfText', ocrText)
          formData.append('file0', new File([fileItem.file], fileItem.file.name, { type: 'text/plain' }))
          formData.append('fileCount', '1')
        } else {
          // Claude Vision 사용
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
    } else if (
      fileItem.file.type === 'application/vnd.ms-excel' ||
      fileItem.file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      fileItem.file.name.toLowerCase().endsWith('.xls') ||
      fileItem.file.name.toLowerCase().endsWith('.xlsx')
    ) {
      // Excel 파일 → 텍스트 변환 후 Claude에 전달
      const text = await readExcelAsText(fileItem.file)
      formData.append('pdfText', text)
      formData.append('file0', new File([fileItem.file], fileItem.file.name, { type: 'text/plain' }))
      formData.append('fileCount', '1')
    } else if (fileItem.file.type.startsWith('image/')) {
      // 이미지 처리 - OCR 먼저 시도
      const imageData = await convertImageToBase64(fileItem.file)
      const ocrText = await callGoogleOcr([imageData])

      if (ocrText && ocrText.length > 50) {
        formData.append('pdfText', ocrText)
        formData.append('file0', new File([fileItem.file], fileItem.file.name, { type: 'text/plain' }))
        formData.append('fileCount', '1')
      } else {
        formData.append('file0', fileItem.file)
        formData.append('fileCount', '1')
      }
    }

    // 문서 유형 자동 감지 (지정하지 않음)
    const response = await fetch('/api/extract', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || '추출 실패')
    }

    return response.json()
  }

  // 크로스체크 실행
  const runCrossCheck = async () => {
    if (files.length === 0) {
      setError('파일을 업로드해주세요.')
      return
    }

    setIsProcessing(true)
    setError(null)
    setVerificationResult(null)
    setPayrollData(null)
    setBankData(null)
    setWithholdingData(null)

    const pendingFiles = files.filter((f) => f.status === 'pending')
    let payroll: PayrollData | null = null
    let bank: BankData | null = null
    let withholding: WithholdingData | null = null

    try {
      // 각 파일 처리
      for (let i = 0; i < pendingFiles.length; i++) {
        const fileItem = pendingFiles[i]
        const fileIndex = files.findIndex((f) => f.file === fileItem.file)

        // 상태 업데이트: processing
        setFiles((prev) =>
          prev.map((f, idx) =>
            idx === fileIndex ? { ...f, status: 'processing' } : f
          )
        )

        try {
          const result = await processFile(fileItem)
          console.log('처리 결과:', result)

          // 다중 문서 응답 처리
          const documents = result.isMultipleDocuments ? result.documents : [result]

          for (const doc of documents) {
            const docType = doc.documentType
            console.log(`감지된 문서 유형: ${docType}`)

            if (docType === 'payroll') {
              payroll = {
                yearMonth: doc.fields.paymentYearMonth || '',
                paymentDate: doc.fields.paymentDate || '',
                employees: doc.fields.employees || [],
                totalNetPay: doc.fields.totalNetPay || 0,
              }
            } else if (docType === 'bankStatement') {
              // 통장내역에서 totalWithdrawal 파싱
              let totalWithdrawal = 0
              if (doc.fields.totalWithdrawal) {
                totalWithdrawal = typeof doc.fields.totalWithdrawal === 'number'
                  ? doc.fields.totalWithdrawal
                  : parseInt(String(doc.fields.totalWithdrawal).replace(/,/g, '')) || 0
              } else if (doc.fields.withdrawal) {
                totalWithdrawal = typeof doc.fields.withdrawal === 'number'
                  ? doc.fields.withdrawal
                  : parseInt(String(doc.fields.withdrawal).replace(/,/g, '')) || 0
              }

              // transactions 배열 파싱
              const transactions = doc.fields.transactions || []

              bank = {
                transactions: transactions,
                totalWithdrawal: totalWithdrawal,
              }
            } else if (docType === 'withholdingTax') {
              withholding = {
                attributionYearMonth: doc.fields.attributionYearMonth || '',
                numberOfPeople: doc.fields.numberOfPeople || 0,
                totalPayment: doc.fields.totalPayment || 0,
                incomeTax: doc.fields.incomeTax || 0,
                localIncomeTax: doc.fields.localIncomeTax || 0,
              }
            }
          }

          // 상태 업데이트: completed
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === fileIndex ? { ...f, status: 'completed', result, documentType: documents.map((d: any) => d.documentType).join(', ') } : f
            )
          )
        } catch (err) {
          // 상태 업데이트: error
          setFiles((prev) =>
            prev.map((f, idx) =>
              idx === fileIndex ? { ...f, status: 'error', error: (err as Error).message } : f
            )
          )
        }

        // API 속도 제한을 위한 딜레이
        if (i < pendingFiles.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }

      // 결과 저장
      setPayrollData(payroll)
      setBankData(bank)
      setWithholdingData(withholding)

      // 크로스체크 수행
      if (payroll || bank) {
        const totalPayroll = payroll?.totalNetPay ||
          (payroll?.employees?.reduce((sum, emp) => sum + (emp.netPay || 0), 0) || 0)

        const totalBank = typeof bank?.totalWithdrawal === 'number'
          ? bank.totalWithdrawal
          : parseInt(String(bank?.totalWithdrawal || '0').replace(/,/g, '')) || 0

        const difference = totalPayroll - totalBank
        const isMatched = Math.abs(difference) < 100  // 100원 미만 차이는 일치로 처리

        // 개인별 매칭 (통장 적요에 이름이 있는 경우)
        const individualMatches: MatchResult[] = []

        if (payroll?.employees && payroll.employees.length > 0) {
          for (const emp of payroll.employees) {
            // 통장 내역에서 해당 직원명이 포함된 거래 찾기
            const matchedTx = bank?.transactions?.find((tx: any) =>
              tx.description?.includes(emp.name) || emp.name?.includes(tx.description)
            )

            const bankAmount = matchedTx?.withdrawal || 0

            individualMatches.push({
              name: emp.name,
              payrollAmount: emp.netPay,
              bankAmount: bankAmount,
              difference: emp.netPay - bankAmount,
              isMatched: bankAmount > 0 ? Math.abs(emp.netPay - bankAmount) < 100 : false,
            })
          }
        }

        setVerificationResult({
          payrollTotal: totalPayroll,
          bankTotal: totalBank,
          withholdingTotal: withholding?.totalPayment || null,
          difference,
          isMatched,
          individualMatches,
        })
      }

    } catch (err) {
      console.error('크로스체크 오류:', err)
      setError(err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.')
    } finally {
      setIsProcessing(false)
    }
  }

  // 파일 삭제
  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // 전체 삭제
  const clearAll = () => {
    setFiles([])
    setVerificationResult(null)
    setPayrollData(null)
    setBankData(null)
    setWithholdingData(null)
    setError(null)
  }

  // 숫자 포맷팅
  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('ko-KR').format(num)
  }

  const stats = {
    total: files.length,
    pending: files.filter((f) => f.status === 'pending').length,
    processing: files.filter((f) => f.status === 'processing').length,
    completed: files.filter((f) => f.status === 'completed').length,
    error: files.filter((f) => f.status === 'error').length,
  }

  // 감지된 문서 유형 목록
  const detectedTypes = {
    payroll: payrollData !== null,
    bank: bankData !== null,
    withholding: withholdingData !== null,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 transition-all duration-500">
      <div className="max-w-5xl mx-auto py-12 px-4">
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
            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            급여 검증
          </h1>
          <p className="text-gray-600">
            급여대장, 원천징수신고서, 통장내역이 포함된 PDF를 업로드하면 자동으로 크로스체크합니다
          </p>
        </div>

        <div className="bg-white/80 backdrop-blur-sm border border-white/50 shadow-lg rounded-2xl p-6 space-y-6">
          {/* 파일 업로드 영역 */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
              ${files.length > 0 ? 'border-purple-400 bg-purple-50/50' : 'border-gray-300 hover:border-purple-400'}
              ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <input
              type="file"
              accept=".pdf,image/*,.xls,.xlsx"
              onChange={handleFileInput}
              className="hidden"
              id="payroll-file-upload"
              multiple
              disabled={isProcessing}
            />
            <label htmlFor="payroll-file-upload" className="cursor-pointer">
              <div className="w-16 h-16 mx-auto bg-purple-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium">
                급여 관련 파일을 드래그하거나 클릭하여 업로드
              </p>
              <p className="text-sm text-gray-400 mt-1">
                급여대장(Excel/PDF), 원천징수신고서, 통장내역 (여러 파일 가능)
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
                    className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${((stats.completed + stats.error) / stats.total) * 100}%`,
                    }}
                  />
                </div>
              )}

              <div className="max-h-40 overflow-y-auto space-y-2">
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
                        <span className="w-5 h-5 rounded-full border-2 border-purple-600 border-t-transparent animate-spin" />
                      )}
                      {fileItem.status === 'completed' && (
                        <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs">O</span>
                      )}
                      {fileItem.status === 'error' && (
                        <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">X</span>
                      )}

                      <span className="truncate">{fileItem.file.name}</span>

                      {fileItem.documentType && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                          {fileItem.documentType}
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

          {/* 크로스체크 버튼 */}
          {files.length > 0 && stats.pending > 0 && (
            <button
              onClick={runCrossCheck}
              disabled={isProcessing}
              className="w-full py-3 px-4 bg-purple-600 text-white font-medium rounded-xl hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg hover:shadow-xl"
            >
              {isProcessing
                ? `처리 중... (${stats.completed + stats.error}/${stats.total})`
                : `크로스체크 실행 (${stats.pending}개 파일)`}
            </button>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          {/* 감지된 문서 유형 */}
          {(payrollData || bankData || withholdingData) && (
            <div className="flex gap-3 flex-wrap">
              <span className="text-sm text-gray-600">감지된 문서:</span>
              {detectedTypes.payroll && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">급여대장</span>
              )}
              {detectedTypes.withholding && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">원천징수신고서</span>
              )}
              {detectedTypes.bank && (
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">통장내역</span>
              )}
            </div>
          )}

          {/* 검증 결과 */}
          {verificationResult && (
            <div className="space-y-6">
              {/* 총액 비교 */}
              <div className={`p-6 rounded-xl ${verificationResult.isMatched ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'}`}>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  {verificationResult.isMatched ? (
                    <span className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-sm">O</span>
                  ) : (
                    <span className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-sm">X</span>
                  )}
                  크로스체크 결과
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 급여대장 */}
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-600 mb-1">급여대장 실지급액</p>
                    <p className="text-xl font-bold text-gray-900">
                      {verificationResult.payrollTotal > 0 ? `${formatNumber(verificationResult.payrollTotal)}원` : '-'}
                    </p>
                    {payrollData?.employees && (
                      <p className="text-xs text-gray-500 mt-1">{payrollData.employees.length}명</p>
                    )}
                  </div>

                  {/* 원천징수신고서 */}
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-600 mb-1">원천징수 총지급액</p>
                    <p className="text-xl font-bold text-gray-900">
                      {verificationResult.withholdingTotal ? `${formatNumber(verificationResult.withholdingTotal)}원` : '-'}
                    </p>
                    {withholdingData && (
                      <p className="text-xs text-gray-500 mt-1">{withholdingData.attributionYearMonth}</p>
                    )}
                  </div>

                  {/* 통장내역 */}
                  <div className="bg-white rounded-xl p-4 shadow-sm">
                    <p className="text-sm text-gray-600 mb-1">통장 출금액</p>
                    <p className="text-xl font-bold text-gray-900">
                      {verificationResult.bankTotal > 0 ? `${formatNumber(verificationResult.bankTotal)}원` : '-'}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">급여대장 vs 통장 차이</span>
                    <span className={`text-xl font-bold ${verificationResult.difference === 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {verificationResult.difference > 0 ? '+' : ''}{formatNumber(verificationResult.difference)}원
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-600">결과</span>
                    <span className={`font-bold ${verificationResult.isMatched ? 'text-green-600' : 'text-red-600'}`}>
                      {verificationResult.isMatched ? '일치' : '불일치'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 개인별 매칭 */}
              {verificationResult.individualMatches.length > 0 && (
                <div className="bg-white/60 backdrop-blur-sm p-6 rounded-xl border border-white/50">
                  <h3 className="text-lg font-semibold mb-4">개인별 매칭</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-2 px-3">이름</th>
                          <th className="text-right py-2 px-3">급여대장</th>
                          <th className="text-right py-2 px-3">통장</th>
                          <th className="text-right py-2 px-3">차이</th>
                          <th className="text-center py-2 px-3">결과</th>
                        </tr>
                      </thead>
                      <tbody>
                        {verificationResult.individualMatches.map((match, idx) => (
                          <tr key={idx} className="border-b border-gray-100">
                            <td className="py-2 px-3">{match.name}</td>
                            <td className="text-right py-2 px-3">{formatNumber(match.payrollAmount)}</td>
                            <td className="text-right py-2 px-3">
                              {match.bankAmount > 0 ? formatNumber(match.bankAmount) : '-'}
                            </td>
                            <td className={`text-right py-2 px-3 ${match.difference !== 0 ? 'text-red-600' : ''}`}>
                              {match.bankAmount > 0 ? formatNumber(match.difference) : '-'}
                            </td>
                            <td className="text-center py-2 px-3">
                              {match.isMatched ? (
                                <span className="text-green-600">O</span>
                              ) : match.bankAmount > 0 ? (
                                <span className="text-red-600">X</span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    * 통장 적요에 직원 이름이 포함된 경우에만 개인별 매칭이 가능합니다.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 안내 문구 */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 mb-3">지원 문서 유형</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['급여대장', '원천징수신고서', '통장내역'].map((type) => (
              <span key={type} className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/60 text-gray-600 backdrop-blur-sm">
                {type}
              </span>
            ))}
          </div>
          <p className="mt-3 text-gray-500 text-sm">
            하나의 PDF에 여러 문서가 섞여있어도 자동으로 감지합니다.
          </p>
        </div>
      </div>
    </div>
  )
}
