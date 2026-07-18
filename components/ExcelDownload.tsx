'use client'

import { ExtractedData, DocumentType } from '@/app/single/page'
import XLSX from 'xlsx-js-style'

interface ExcelDownloadProps {
  data: ExtractedData
  fileName?: string
}

const documentTypeLabels: Record<DocumentType, string> = {
  contract: '계약서',
  taxInvoice: '세금계산서',
  tradingStatement: '거래명세서',
  bankStatement: '통장입출금내역',
  assetDisposal: '취득처분전표',
  withholdingTax: '원천징수신고서',
  estimate: '견적서',
  payroll: '급여대장',
}

const fieldLabels: Record<string, string> = {
  // 계약서
  contractTitle: '계약서 제목',
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
  items: '품목',
  supplyValue: '공급가액',
  taxAmount: '부가세',
  totalAmount: '총액/합계',
  // 거래명세서
  tradingPartner: '거래처',
  tradingDate: '거래일',
  quantity: '수량',
  unitPrice: '단가',
  // 공통 (취득처분전표 등에서 사용)
  slipNumber: '전표번호',
  accountCode: '계정과목',
  description: '적요',
  // 통장 입출금내역
  transactionDate: '거래일',
  deposit: '입금',
  withdrawal: '출금',
  balance: '잔액',
  transactionContent: '거래내용',
  counterparty: '상대방',
  // 자산취득처분 (transactionDate, accountCode, slipNumber는 위에서 정의됨)
  transactionType: '거래유형',
  assetCategory: '자산분류',
  itemDetail: '품목상세',
  acquisitionCost: '취득원가',
  disposalPrice: '처분가액',
  // 원천징수신고서
  attributionYearMonth: '귀속년월',
  numberOfPeople: '인원',
  totalPayment: '총지급액',
  incomeTax: '소득세',
  localIncomeTax: '지방소득세',
  // 견적서
  createdDate: '작성일',
  validityPeriod: '유효기간',
  // 급여대장
  paymentYearMonth: '귀속년월',
  paymentDate: '지급일',
  companyName: '회사명',
  employees: '직원목록',
  totalNetPay: '실지급액합계',
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

// 강조 볼드 스타일
const boldCellStyle = {
  border: {
    top: { style: 'thin', color: { rgb: 'CCCCCC' } },
    bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
    left: { style: 'thin', color: { rgb: 'CCCCCC' } },
    right: { style: 'thin', color: { rgb: 'CCCCCC' } },
  },
  alignment: { vertical: 'center', wrapText: true },
  font: { bold: true },
}

// 숫자를 천 단위 콤마 포맷으로 변환
const formatNumber = (value: any): string => {
  if (value === null || value === undefined || value === '') return ''
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value
  if (isNaN(num)) return String(value)
  return num.toLocaleString('ko-KR')
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
    const wb = XLSX.utils.book_new()

    const rows: any[][] = [['항목', '값']]

    const longTextFields = ['contractContent', 'description', 'transactionContent']
    const numberFields = ['supplyValue', 'taxAmount', 'totalAmount', 'deposit', 'withdrawal', 'balance', 'incomeTax', 'localIncomeTax', 'totalPayment', 'acquisitionCost', 'disposalPrice']
    const boldFields: string[] = []
    const boldRowIndices: number[] = []

    Object.entries(data.fields).forEach(([key, value], index) => {
      const label = fieldLabels[key] || key
      let formattedValue = formatArrayValue(value)

      if (numberFields.includes(key)) {
        formattedValue = formatNumber(value)
      }

      if (longTextFields.includes(key) && typeof formattedValue === 'string') {
        formattedValue = formatLongText(formattedValue)
      }

      if (boldFields.includes(key) && value) {
        boldRowIndices.push(rows.length)
      }

      rows.push([label, formattedValue])
    })

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 20 }, { wch: 80 }]

    const rowHeights: { hpt: number }[] = [{ hpt: 25 }]
    Object.entries(data.fields).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        rowHeights.push({ hpt: Math.max(25, value.length * 20) })
      } else if (longTextFields.includes(key) && typeof value === 'string') {
        const sentenceCount = (value.match(/\. /g) || []).length + 1
        rowHeights.push({ hpt: Math.max(25, sentenceCount * 20) })
      } else if (typeof value === 'string' && value.includes('\n')) {
        const lineCount = (value.match(/\n/g) || []).length + 1
        rowHeights.push({ hpt: Math.max(25, lineCount * 20) })
      } else {
        rowHeights.push({ hpt: 25 })
      }
    })
    ws['!rows'] = rowHeights

    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
        if (!ws[cellAddress]) continue

        if (R === 0) {
          ws[cellAddress].s = headerStyle
        } else if (boldRowIndices.includes(R)) {
          ws[cellAddress].s = boldCellStyle
        } else {
          ws[cellAddress].s = cellStyle
        }
      }
    }

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
