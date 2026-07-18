'use client'

import { ExtractedData, DocumentType } from '@/app/single/page'
import XLSX from 'xlsx-js-style'

interface BatchExcelDownloadProps {
  results: ExtractedData[]
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

// 문서 유형별 헤더 정의
const documentHeaders: Record<DocumentType, { key: string; label: string }[]> = {
  contract: [
    { key: '_rowNumber', label: 'No.' },
    { key: 'contractTitle', label: '계약서 제목' },
    { key: 'partyA', label: '계약당사자(갑)' },
    { key: 'partyB', label: '계약당사자(을)' },
    { key: 'contractDate', label: '계약일' },
    { key: 'contractContent', label: '계약내용' },
    { key: 'contractAmount', label: '계약금액' },
    { key: 'contractTerms', label: '계약조건' },
    { key: 'contractPeriod', label: '계약기간' },
  ],
  taxInvoice: [
    { key: '_rowNumber', label: 'No.' },
    { key: 'supplier', label: '공급자' },
    { key: 'receiver', label: '공급받는자' },
    { key: 'issueDate', label: '작성일' },
    { key: 'supplyValue', label: '공급가액' },
    { key: 'taxAmount', label: '부가세' },
    { key: 'totalAmount', label: '합계금액' },
  ],
  tradingStatement: [
    { key: '_rowNumber', label: 'No.' },
    { key: 'supplier', label: '공급자' },
    { key: 'tradingPartner', label: '거래처' },
    { key: 'tradingDate', label: '거래일' },
    { key: 'items', label: '품목' },
    { key: 'quantity', label: '수량' },
    { key: 'unitPrice', label: '단가' },
    { key: 'totalAmount', label: '합계금액' },
  ],
  bankStatement: [
    { key: '_rowNumber', label: 'No.' },
    { key: 'transactionDate', label: '거래일' },
    { key: 'deposit', label: '입금' },
    { key: 'withdrawal', label: '출금' },
    { key: 'sender', label: '보내는분' },
    { key: 'recipient', label: '받는분' },
    { key: 'transactionContent', label: '거래내용' },
  ],
  assetDisposal: [
    { key: '_rowNumber', label: 'No.' },
    { key: 'transactionType', label: '거래유형' },
    { key: 'transactionDate', label: '거래일자' },
    { key: 'assetCategory', label: '자산분류' },
    { key: 'itemDetail', label: '품목상세' },
    { key: 'counterparty', label: '거래처' },
    { key: 'acquisitionCost', label: '취득원가' },
    { key: 'disposalPrice', label: '처분가액' },
    { key: 'accountCode', label: '계정과목' },
    { key: 'slipNumber', label: '전표번호' },
  ],
  withholdingTax: [
    { key: '_rowNumber', label: 'No.' },
    { key: 'withholdingAgent', label: '징수의무자' },
    { key: 'businessNumber', label: '사업자등록번호' },
    { key: 'attributionYearMonth', label: '귀속년월' },
    { key: 'numberOfPeople', label: '인원' },
    { key: 'totalPayment', label: '총지급액' },
    { key: 'incomeTax', label: '소득세' },
    { key: 'localIncomeTax', label: '지방소득세' },
  ],
  estimate: [
    { key: '_rowNumber', label: 'No.' },
    { key: 'createdDate', label: '견적일자' },
    { key: 'validityPeriod', label: '유효기간' },
    { key: 'supplier', label: '공급자' },
    { key: 'receiver', label: '공급받는자' },
    { key: 'items', label: '품목' },
    { key: 'quantity', label: '수량' },
    { key: 'unitPrice', label: '단가' },
    { key: 'totalAmount', label: '합계금액' },
    { key: 'notes', label: '기타사항' },
  ],
  payroll: [
    { key: '_rowNumber', label: 'No.' },
    { key: 'paymentYearMonth', label: '귀속년월' },
    { key: 'paymentDate', label: '지급일' },
    { key: 'companyName', label: '회사명' },
    { key: 'totalNetPay', label: '실지급액합계' },
  ],
}

// 숫자 금액 필드 (단일 금액 → 천 단위 콤마)
// unitPrice/quantity는 품목별 다행 값이므로 여기서 제외하고 별도 처리
const numberFields = [
  'supplyValue', 'taxAmount', 'totalAmount',
  'deposit', 'withdrawal', 'balance',
  'incomeTax', 'localIncomeTax', 'totalPayment', 'amount',
  'acquisitionCost', 'disposalPrice'
]

// 품목별 다행 필드 (한 줄에 하나씩, 순서 정렬 유지)
const multiLineItemFields = ['items', 'quantity', 'unitPrice']

// 숫자 포맷팅
const formatNumber = (value: any): string => {
  if (value === null || value === undefined || value === '') return ''
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value
  if (isNaN(num)) return String(value)
  return num.toLocaleString('ko-KR')
}

// 품목별 다행 필드 포맷팅: 줄바꿈 유지, 숫자 줄은 천 단위 콤마 적용
// (구버전 콤마 구분 데이터도 줄바꿈으로 변환)
const formatMultiLineField = (value: any): string => {
  if (value === null || value === undefined || value === '') return ''
  const raw = String(value)
  const lines = raw.includes('\n') ? raw.split('\n') : raw.split(/,\s*/)
  return lines
    .map((line) => {
      const t = line.trim()
      if (t === '') return ''
      const num = parseFloat(t.replace(/,/g, ''))
      return !isNaN(num) && /^[\d,]+$/.test(t) ? num.toLocaleString('ko-KR') : t
    })
    .join('\n')
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
      const headers = documentHeaders[documentType]

      // 헤더 행 생성
      const headerRow = headers.map((h) => h.label)

      let dataRows: any[][]
      let totalLines = 0

      // 다른 문서 유형은 번호 추가
      dataRows = docResults.map((result, idx) =>
        headers.map((h) => {
          if (h.key === '_rowNumber') {
            return idx + 1  // 1부터 시작하는 번호
          }
          const value = result.fields[h.key]
          if (multiLineItemFields.includes(h.key)) {
            return formatMultiLineField(value)
          }
          if (numberFields.includes(h.key)) {
            return formatNumber(value)
          }
          return value !== null && value !== undefined ? String(value) : ''
        })
      )
      totalLines = dataRows.length

      // 시트 데이터 구성
      const sheetData = [headerRow, ...dataRows]
      const ws = XLSX.utils.aoa_to_sheet(sheetData)

      // 컬럼 너비 설정
      ws['!cols'] = headers.map((h) => {
        if (h.key === '_rowNumber') return { wch: 5 }
        if (h.key === 'contractTitle') return { wch: 30 }
        if (h.key === 'contractContent') return { wch: 50 }
        if (h.key === 'contractTerms') return { wch: 50 }
        if (h.key === 'description') return { wch: 40 }
        if (h.key === 'items') return { wch: 24 }
        if (h.key === 'businessNumber') return { wch: 16 }
        if (h.key === 'withholdingAgent') return { wch: 22 }
        if (h.key === 'notes') return { wch: 40 }
        return { wch: 15 }
      })

      // 스타일 적용
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
          if (!ws[cellAddress]) continue
          ws[cellAddress].s = R === 0 ? headerStyle : cellStyle
        }
      }

      // 시트 추가
      // 주의: 시트 이름에 : \ / ? * [ ] 사용 불가
      const countLabel = `${docResults.length}건`
      const sheetName = `${documentTypeLabels[documentType]}_${countLabel}`
      XLSX.utils.book_append_sheet(wb, ws, sheetName)

    })

    // 파일 다운로드
    const now = new Date()
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const fileName = `증빙_일괄추출_${dateStr}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  // 문서 유형별 개수 계산
  const typeCounts: Record<string, number> = {}
  results.forEach((r) => {
    const label = documentTypeLabels[r.documentType]
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
