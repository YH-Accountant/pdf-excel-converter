'use client'

import { ExtractedData } from '@/app/single/page'
import { DOCUMENT_FIELDS, DOCUMENT_TYPE_LABELS, formatFieldValue } from '@/lib/documentFields'
import XLSX from 'xlsx-js-style'

interface ExcelDownloadProps {
  data: ExtractedData
  fileName?: string
}

// 헤더 스타일 (옅은 회색 배경)
const headerStyle = {
  fill: { fgColor: { rgb: 'E8E8E8' } },
  font: { bold: true },
  border: {
    top: { style: 'thin', color: { rgb: 'CCCCCC' } },
    bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
    left: { style: 'thin', color: { rgb: 'CCCCCC' } },
    right: { style: 'thin', color: { rgb: 'CCCCCC' } },
  },
  alignment: { vertical: 'center' },
}

// 일반 셀 스타일
const cellStyle = {
  border: {
    top: { style: 'thin', color: { rgb: 'CCCCCC' } },
    bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
    left: { style: 'thin', color: { rgb: 'CCCCCC' } },
    right: { style: 'thin', color: { rgb: 'CCCCCC' } },
  },
  alignment: { vertical: 'center', wrapText: true },
}

export default function ExcelDownload({ data, fileName }: ExcelDownloadProps) {
  const handleDownload = () => {
    const wb = XLSX.utils.book_new()

    // 유형별 표시 필드만, 화면(ResultTable)과 동일한 라벨·포맷으로 구성
    const fields = DOCUMENT_FIELDS[data.documentType] ?? []
    const rows: any[][] = [['항목', '값']]
    const rowHeights: { hpt: number }[] = [{ hpt: 25 }]

    fields.forEach(({ key, label }) => {
      const formatted = formatFieldValue(key, data.fields[key])
      rows.push([label, formatted])
      const lineCount = (formatted.match(/\n/g) || []).length + 1
      rowHeights.push({ hpt: Math.max(25, lineCount * 20) })
    })

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 20 }, { wch: 80 }]
    ws['!rows'] = rowHeights

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
        if (!ws[cellAddress]) continue
        ws[cellAddress].s = R === 0 ? headerStyle : cellStyle
      }
    }

    const typeLabel = DOCUMENT_TYPE_LABELS[data.documentType]
    XLSX.utils.book_append_sheet(wb, ws, typeLabel)

    const baseFileName = fileName?.replace(/\.[^/.]+$/, '') || '추출결과'
    XLSX.writeFile(wb, `${baseFileName}_${typeLabel}.xlsx`)
  }

  return (
    <button
      onClick={handleDownload}
      className="w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      엑셀 다운로드
    </button>
  )
}
