'use client'

import { ExtractedData, DocumentType } from '@/app/single/page'
import { DOCUMENT_FIELDS, DOCUMENT_TYPE_LABELS, formatFieldValue } from '@/lib/documentFields'
import XLSX from 'xlsx-js-style'

interface BatchExcelDownloadProps {
  results: ExtractedData[]
}

// 열 너비 (특정 필드만 개별 지정, 나머지는 기본값)
const COLUMN_WIDTHS: Record<string, number> = {
  _rowNumber: 5,
  _sourceFile: 28,
  contractTitle: 30,
  contractContent: 50,
  contractTerms: 50,
  items: 24,
  businessNumber: 16,
  withholdingAgent: 22,
  notes: 40,
}

// 헤더 스타일
const headerStyle = {
  fill: { fgColor: { rgb: '4472C4' } },
  font: { bold: true, color: { rgb: 'FFFFFF' } },
  border: {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } },
  },
  alignment: { vertical: 'center', horizontal: 'center' },
}

// 데이터 셀 스타일
const cellStyle = {
  border: {
    top: { style: 'thin', color: { rgb: 'CCCCCC' } },
    bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
    left: { style: 'thin', color: { rgb: 'CCCCCC' } },
    right: { style: 'thin', color: { rgb: 'CCCCCC' } },
  },
  alignment: { vertical: 'center', wrapText: true },
}

export default function BatchExcelDownload({ results }: BatchExcelDownloadProps) {
  const handleDownload = () => {
    const wb = XLSX.utils.book_new()

    // 문서 유형별로 그룹화
    const groupedResults: Record<DocumentType, ExtractedData[]> = {} as any
    results.forEach((result) => {
      if (!groupedResults[result.documentType]) {
        groupedResults[result.documentType] = []
      }
      groupedResults[result.documentType].push(result)
    })

    // 각 문서 유형별로 시트 생성
    Object.entries(groupedResults).forEach(([docType, docResults]) => {
      const documentType = docType as DocumentType
      // No. + 원본 파일명(표 전용 열) 다음에 공용 표시 필드를 붙임 → 단일 화면과 동일한 필드·라벨
      const headers = [
        { key: '_rowNumber', label: 'No.' },
        { key: '_sourceFile', label: '원본 파일명' },
        ...DOCUMENT_FIELDS[documentType],
      ]

      const headerRow = headers.map((h) => h.label)

      const dataRows = docResults.map((result, idx) =>
        headers.map((h) => {
          if (h.key === '_rowNumber') return idx + 1
          if (h.key === '_sourceFile') return result.sourceFileName || ''
          return formatFieldValue(h.key, result.fields[h.key])
        })
      )

      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])
      ws['!cols'] = headers.map((h) => ({ wch: COLUMN_WIDTHS[h.key] ?? 15 }))

      // 스타일 적용
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
          if (!ws[cellAddress]) continue
          ws[cellAddress].s = R === 0 ? headerStyle : cellStyle
        }
      }

      // 시트 이름 (: \ / ? * [ ] 사용 불가, 31자 이하)
      const sheetName = `${DOCUMENT_TYPE_LABELS[documentType]}_${docResults.length}건`.slice(0, 31)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    })

    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    XLSX.writeFile(wb, `증빙_일괄추출_${dateStr}.xlsx`)
  }

  // 문서 유형별 개수 계산
  const typeCounts: Record<string, number> = {}
  results.forEach((r) => {
    const label = DOCUMENT_TYPE_LABELS[r.documentType]
    typeCounts[label] = (typeCounts[label] || 0) + 1
  })

  return (
    <div className="space-y-4">
      <div className="p-4 bg-green-50 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium text-green-800">처리 완료!</span>
        </div>
        <div className="text-sm text-green-700">
          {Object.entries(typeCounts).map(([type, count]) => (
            <span key={type} className="mr-3">
              {type}: {count}건
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={handleDownload}
        className="w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        통합 엑셀 다운로드 ({results.length}건)
      </button>
    </div>
  )
}
