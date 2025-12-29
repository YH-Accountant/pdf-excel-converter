'use client'

import { ExtractedData, DocumentType } from '@/app/page'
import XLSX from 'xlsx-js-style'

interface ExcelDownloadProps {
  data: ExtractedData
  fileName?: string
}

const documentTypeLabels: Record<DocumentType, string> = {
  contract: '계약서',
  taxInvoice: '세금계산서',
  tradingStatement: '거래명세서',
  accountingSlip: '회계전표',
  bankStatement: '통장입출금내역',
  assetDisposal: '취득처분전표',
  withholdingTax: '원천징수신고서',
  estimate: '견적서',
}

const fieldLabels: Record<string, string> = {
  // 계약서
  partyA: '계약당사자(갑)',
  partyB: '계약당사자(을)',
  contractDate: '계약일',
  contractContent: '계약내용',
  contractAmount: '계약금액',
  contractTerms: '계약조건',
  contractPeriod: '계약기간',
  // 세금계산서
  supplier: '공급자',
  receiver: '공급받는자',
  issueDate: '작성일',
  supplyValue: '공급가액',
  taxAmount: '부가세',
  items: '품목',
  // 거래명세서
  tradingPartner: '거래처',
  tradingDate: '거래일',
  quantity: '수량',
  unitPrice: '단가',
  totalAmount: '합계',
  // 회계전표
  slipNumber: '전표번호',
  slipDate: '일자',
  accountCode: '계정과목',
  debit: '차변',
  credit: '대변',
  description: '적요',
  // 통장 입출금내역
  transactionDate: '거래일',
  deposit: '입금',
  withdrawal: '출금',
  balance: '잔액',
  transactionContent: '거래내용',
  counterparty: '상대방',
  // 취득처분전표
  assetName: '자산명',
  acquisitionDate: '취득/처분일',
  amount: '금액',
  reason: '사유',
  // 원천징수신고서
  attributionMonth: '귀속월',
  numberOfPeople: '인원',
  totalPayment: '총지급액',
  incomeTax: '소득세',
  localIncomeTax: '지방소득세',
  // 견적서
  createdDate: '작성일',
  validityPeriod: '유효기간',
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

// 계약조건 등 배열 데이터를 줄바꿈으로 분리
const formatArrayValue = (value: any): string => {
  if (Array.isArray(value)) {
    return value.join('\n')
  }
  return value !== null && value !== undefined ? String(value) : ''
}

// 계약내용 등 긴 텍스트를 문장 단위로 줄바꿈
const formatLongText = (value: string): string => {
  // 마침표 뒤에 줄바꿈 추가 (단, 숫자.숫자 형태는 제외)
  return value.replace(/\. (?![0-9])/g, '.\n')
}

export default function ExcelDownload({ data, fileName }: ExcelDownloadProps) {
  const handleDownload = () => {
    // 데이터를 행 배열로 변환 (헤더 포함)
    const rows: any[][] = [['항목', '값']]

    // 긴 텍스트 필드 (문장 단위 줄바꿈 적용)
    const longTextFields = ['contractContent', 'description', 'transactionContent']

    Object.entries(data.fields).forEach(([key, value]) => {
      const label = fieldLabels[key] || key
      let formattedValue = formatArrayValue(value)

      // 긴 텍스트 필드는 문장 단위로 줄바꿈
      if (longTextFields.includes(key) && typeof formattedValue === 'string') {
        formattedValue = formatLongText(formattedValue)
      }

      rows.push([label, formattedValue])
    })

    // 워크시트 생성
    const ws = XLSX.utils.aoa_to_sheet(rows)

    // 컬럼 너비 설정
    ws['!cols'] = [{ wch: 20 }, { wch: 80 }]

    // 행 높이 설정 (배열/긴텍스트 데이터는 더 높게)
    const rowHeights: { hpt: number }[] = [{ hpt: 25 }] // 헤더 높이
    Object.entries(data.fields).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        // 배열 항목 수에 따라 높이 조정 (항목당 20pt)
        rowHeights.push({ hpt: Math.max(25, value.length * 20) })
      } else if (longTextFields.includes(key) && typeof value === 'string') {
        // 긴 텍스트는 문장 수에 따라 높이 조정
        const sentenceCount = (value.match(/\. /g) || []).length + 1
        rowHeights.push({ hpt: Math.max(25, sentenceCount * 20) })
      } else {
        rowHeights.push({ hpt: 25 })
      }
    })
    ws['!rows'] = rowHeights

    // 스타일 적용
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')

    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
        if (!ws[cellAddress]) continue

        if (R === 0) {
          // 헤더 행 스타일
          ws[cellAddress].s = headerStyle
        } else {
          // 데이터 행 스타일
          ws[cellAddress].s = cellStyle
        }
      }
    }

    // 워크북 생성
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, documentTypeLabels[data.documentType])

    // 파일 이름 생성
    const baseFileName = fileName?.replace(/\.[^/.]+$/, '') || '추출결과'
    const outputFileName = `${baseFileName}_${documentTypeLabels[data.documentType]}.xlsx`

    // 다운로드
    XLSX.writeFile(wb, outputFileName)
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
