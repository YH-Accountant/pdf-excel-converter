'use client'

import { ExtractedData, DocumentType, AccountingEntry, AccountingSlip } from '@/app/page'
import XLSX from 'xlsx-js-style'

interface BatchExcelDownloadProps {
  results: ExtractedData[]
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
    { key: 'supplier', label: '공급자' },
    { key: 'receiver', label: '공급받는자' },
    { key: 'issueDate', label: '작성일' },
    { key: 'items', label: '품목' },
    { key: 'supplyValue', label: '공급가액' },
    { key: 'taxAmount', label: '부가세' },
    { key: 'totalAmount', label: '총액' },
    { key: 'unpaidAmount', label: '미지급금' },
  ],
  tradingStatement: [
    { key: 'supplier', label: '공급자' },
    { key: 'tradingPartner', label: '거래처' },
    { key: 'tradingDate', label: '거래일' },
    { key: 'items', label: '품목' },
    { key: 'quantity', label: '수량' },
    { key: 'unitPrice', label: '단가' },
    { key: 'totalAmount', label: '합계금액' },
  ],
  accountingSlip: [
    { key: 'slipNumber', label: '전표번호' },
    { key: 'slipDate', label: '일자' },
    { key: 'accountCode', label: '계정과목' },
    { key: 'debit', label: '차변' },
    { key: 'credit', label: '대변' },
    { key: 'description', label: '적요' },
  ],  // 회계전표는 특별 처리 (entries 배열 펼치기)
  bankStatement: [
    { key: 'transactionDate', label: '거래일' },
    { key: 'deposit', label: '입금' },
    { key: 'withdrawal', label: '출금' },
    { key: 'balance', label: '잔액' },
    { key: 'transactionContent', label: '거래내용' },
    { key: 'counterparty', label: '상대방' },
  ],
  assetDisposal: [
    { key: 'assetName', label: '자산명' },
    { key: 'acquisitionDate', label: '취득/처분일' },
    { key: 'amount', label: '금액' },
    { key: 'counterparty', label: '거래상대방' },
    { key: 'reason', label: '사유' },
  ],
  withholdingTax: [
    { key: 'attributionYearMonth', label: '귀속년월' },
    { key: 'numberOfPeople', label: '인원' },
    { key: 'totalPayment', label: '총지급액' },
    { key: 'incomeTax', label: '소득세' },
    { key: 'localIncomeTax', label: '지방소득세' },
  ],
  estimate: [
    { key: 'tradingPartner', label: '거래처' },
    { key: 'createdDate', label: '작성일' },
    { key: 'items', label: '품목' },
    { key: 'quantity', label: '수량' },
    { key: 'unitPrice', label: '단가' },
    { key: 'totalAmount', label: '합계금액' },
    { key: 'validityPeriod', label: '유효기간' },
  ],
}

// 숫자 금액 필드
const numberFields = [
  'supplyValue', 'taxAmount', 'totalAmount', 'unpaidAmount',
  'deposit', 'withdrawal', 'balance', 'debit', 'credit',
  'incomeTax', 'localIncomeTax', 'totalPayment', 'unitPrice', 'amount'
]

// 숫자 포맷팅
const formatNumber = (value: any): string => {
  if (value === null || value === undefined || value === '') return ''
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : value
  if (isNaN(num)) return String(value)
  return num.toLocaleString('ko-KR')
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

      // 회계전표는 slips 배열 내의 entries를 펼쳐서 각 분개 라인을 별도 행으로 출력
      if (documentType === 'accountingSlip') {
        dataRows = []
        docResults.forEach((result) => {
          // 새 형식: slips 배열
          const slips = result.fields.slips as AccountingSlip[] | undefined

          if (slips && Array.isArray(slips)) {
            slips.forEach((slip, slipIndex) => {
              const slipNumber = slip.slipNumber || ''
              const slipDate = slip.slipDate || ''
              const entries = slip.entries

              if (entries && Array.isArray(entries)) {
                entries.forEach((entry) => {
                  dataRows.push([
                    slipNumber,
                    slipDate,
                    entry.accountCode || '',
                    formatNumber(entry.debit),
                    formatNumber(entry.credit),
                    entry.description || '',
                  ])
                  totalLines++
                })
                // 전표 사이에 빈 행 추가 (마지막 전표 제외)
                if (slipIndex < slips.length - 1) {
                  dataRows.push(['', '', '', '', '', ''])
                }
              }
            })
          } else {
            // 기존 형식 호환 (entries만 있는 경우)
            const slipNumber = result.fields.slipNumber || ''
            const slipDate = result.fields.slipDate || ''
            const entries = result.fields.entries as AccountingEntry[] | undefined

            if (entries && Array.isArray(entries)) {
              entries.forEach((entry) => {
                dataRows.push([
                  slipNumber,
                  slipDate,
                  entry.accountCode || '',
                  formatNumber(entry.debit),
                  formatNumber(entry.credit),
                  entry.description || '',
                ])
                totalLines++
              })
            } else {
              // 완전히 이전 형식 (단일 분개)
              dataRows.push([
                slipNumber,
                slipDate,
                result.fields.accountCode || '',
                formatNumber(result.fields.debit),
                formatNumber(result.fields.credit),
                result.fields.description || '',
              ])
              totalLines++
            }
          }
        })
      } else if (documentType === 'contract') {
        // 계약서는 번호 추가
        dataRows = docResults.map((result, idx) =>
          headers.map((h) => {
            if (h.key === '_rowNumber') {
              return idx + 1  // 1부터 시작하는 번호
            }
            const value = result.fields[h.key]
            if (numberFields.includes(h.key)) {
              return formatNumber(value)
            }
            return value !== null && value !== undefined ? String(value) : ''
          })
        )
        totalLines = dataRows.length
      } else {
        // 다른 문서 유형은 기존 방식
        dataRows = docResults.map((result) =>
          headers.map((h) => {
            const value = result.fields[h.key]
            if (numberFields.includes(h.key)) {
              return formatNumber(value)
            }
            return value !== null && value !== undefined ? String(value) : ''
          })
        )
        totalLines = dataRows.length
      }

      // 시트 데이터 구성
      const sheetData = [headerRow, ...dataRows]
      const ws = XLSX.utils.aoa_to_sheet(sheetData)

      // 컬럼 너비 설정 (계약서는 계약내용/계약조건 칸을 넓게)
      if (documentType === 'contract') {
        ws['!cols'] = headers.map((h) => {
          if (h.key === '_rowNumber') return { wch: 5 }
          if (h.key === 'contractTitle') return { wch: 30 }
          if (h.key === 'contractContent') return { wch: 50 }
          if (h.key === 'contractTerms') return { wch: 50 }
          return { wch: 20 }
        })
      } else {
        ws['!cols'] = headers.map(() => ({ wch: 20 }))
      }

      // 스타일 적용
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1')
      for (let R = range.s.r; R <= range.e.r; R++) {
        for (let C = range.s.c; C <= range.e.c; C++) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
          if (!ws[cellAddress]) continue
          ws[cellAddress].s = R === 0 ? headerStyle : cellStyle
        }
      }

      // 시트 추가 (회계전표는 라인 수 표시)
      // 주의: 시트 이름에 : \ / ? * [ ] 사용 불가
      const countLabel = documentType === 'accountingSlip'
        ? `${docResults.length}건_${totalLines}줄`
        : `${docResults.length}건`
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
