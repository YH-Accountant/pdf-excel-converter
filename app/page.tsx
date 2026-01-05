'use client'

import { useState } from 'react'
import FileUpload from '@/components/FileUpload'
import DocumentTypeSelector from '@/components/DocumentTypeSelector'
import ResultTable from '@/components/ResultTable'
import ExcelDownload from '@/components/ExcelDownload'

export type DocumentType =
  | 'contract'           // 계약서
  | 'taxInvoice'         // 세금계산서
  | 'tradingStatement'   // 거래명세서
  | 'accountingSlip'     // 회계전표
  | 'bankStatement'      // 통장 입출금내역
  | 'assetDisposal'      // 취득처분전표
  | 'withholdingTax'     // 급여원천징수이행상황신고서
  | 'estimate'           // 견적서

// 회계전표 분개 라인 타입
export interface AccountingEntry {
  accountCode: string
  debit: number
  credit: number
  description: string
}

// 회계전표 슬립 타입 (여러 전표를 담는 배열용)
export interface AccountingSlip {
  slipNumber: string
  slipDate: string
  entries: AccountingEntry[]
}

export interface ExtractedData {
  documentType: DocumentType
  fields: Record<string, string | number | null | AccountingEntry[] | AccountingSlip[]>
  rawText?: string
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([])
  const [pdfText, setPdfText] = useState<string>('')
  const [documentType, setDocumentType] = useState<DocumentType | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFilesSelect = (selectedFiles: File[], extractedPdfText?: string) => {
    setFiles(selectedFiles)
    setPdfText(extractedPdfText || '')
    setExtractedData(null)
    setError(null)
  }

  const handleExtract = async () => {
    if (files.length === 0) return

    setIsLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      files.forEach((file, index) => {
        formData.append(`file${index}`, file)
      })
      formData.append('fileCount', files.length.toString())
      if (documentType) {
        formData.append('documentType', documentType)
      }
      if (pdfText) {
        formData.append('pdfText', pdfText)
      }

      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || '추출에 실패했습니다.')
      }

      const data = await response.json()
      setExtractedData(data)
      setDocumentType(data.documentType)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4">
        {/* 헤더 */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            PDF 표준 엑셀 변환 Tool
          </h1>
          <p className="text-gray-600">
            PDF/이미지 문서를 업로드하면 핵심 정보를 자동 추출하여 엑셀로 변환합니다
          </p>
          <a
            href="/batch"
            className="inline-block mt-3 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
          >
            대량 증빙 일괄 처리 →
          </a>
        </div>

        {/* 메인 컨텐츠 */}
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
          {/* 파일 업로드 */}
          <FileUpload onFilesSelect={handleFilesSelect} selectedFiles={files} />

          {/* 문서 유형 선택 */}
          {files.length > 0 && (
            <DocumentTypeSelector
              selectedType={documentType}
              onTypeChange={setDocumentType}
            />
          )}

          {/* 추출 버튼 */}
          {files.length > 0 && (
            <button
              onClick={handleExtract}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? '추출 중...' : `정보 추출하기 (${files.length}개 파일)`}
            </button>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-lg">
              {error}
            </div>
          )}

          {/* 결과 테이블 */}
          {extractedData && (
            <>
              <ResultTable data={extractedData} />
              <ExcelDownload data={extractedData} fileName={files[0]?.name} />
            </>
          )}
        </div>

        {/* 지원 문서 유형 */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p className="mb-2">지원 문서 유형</p>
          <div className="flex flex-wrap justify-center gap-2">
            {['계약서', '세금계산서', '거래명세서', '회계전표', '통장 입출금내역', '취득처분전표', '원천징수신고서', '견적서'].map((type) => (
              <span key={type} className="px-3 py-1 bg-gray-100 rounded-full text-xs">
                {type}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
