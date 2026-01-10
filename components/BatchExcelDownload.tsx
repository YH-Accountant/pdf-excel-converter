'use client'

import { ExtractedData, DocumentType, AccountingEntry, AccountingSlip } from '@/app/single/page'
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
    { key: 'items', label: '품목' },
    { key: 'supplyValue', label: '공급가액' },
    { key: 'taxAmount', label: '부가세' },
    { key: 'totalAmount', label: '총액' },
    { key: 'unpaidAmount', label: '미지급금' },
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
  accountingSlip: [
    { key: '_rowNumber', label: 'No.' },
    { key: 'slipNumber', label: '전표번호' },
    { key: 'slipDate', label: '일자' },
    { key: 'accountCode', label: '계정과목' },
    { key: 'debit', label: '차변' },
    { key: 'credit', label: '대변' },
    { key: 'description', label: '적요' },
  ],  // 회계전표는 특별 처리 (entries 배열 펼치기, 전표 단위 번호)
  bankStatement: [
    { key: '_rowNumber', label: 'No.' },
    { key: 'transactionDate', label: '거래일' },
    { key: 'deposit', label: '입금' },
    { key: 'withdrawal', label: '출금' },
    { key: 'balance', label: '잔액' },
    { key: 'transactionContent', label: '거래내용' },
    { key: 'counterparty', label: '상대방' },
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
    { key: 'attributionYearMonth', label: '귀속년월' },
    { key: 'numberOfPeople', label: '인원' },
    { key: 'totalPayment', label: '총지급액' },
    { key: 'incomeTax', label: '소득세' },
    { key: 'localIncomeTax', label: '지방소득세' },
  ],
  estimate: [
    { key: '_rowNumber', label: 'No.' },
    { key: 'tradingPartner', label: '거래처' },
    { key: 'createdDate', label: '작성일' },
    { key: 'items', label: '품목' },
    { key: 'quantity', label: '수량' },
    { key: 'unitPrice', label: '단가' },
    { key: 'totalAmount', label: '합계금액' },
    { key: 'validityPeriod', label: '유효기간' },
  ],
  payroll: [
    { key: '_rowNumber', label: 'No.' },
    { key: 'paymentYearMonth', label: '귀속년월' },
    { key: 'paymentDate', label: '지급일' },
    { key: 'companyName', label: '회사명' },
    { key: 'totalNetPay', label: '실지급액합계' },
  ],
}

// 숫자 금액 필드
const numberFields = [
  'supplyValue', 'taxAmount', 'totalAmount', 'unpaidAmount',
  'deposit', 'withdrawal', 'balance', 'debit', 'credit',
  'incomeTax', 'localIncomeTax', 'totalPayment', 'unitPrice', 'amount',
  'acquisitionCost', 'disposalPrice'
]

// 자산 관련 계정과목 키워드 (취득/처분 자동 감지용)
const assetAccountKeywords = [
  // 유형자산
  '토지', '건물', '구축물', '기계장치', '차량운반구', '차량', '선박', '항공기',
  '건설중인자산', '비품', '공구와기구', '공구기구', '시설장치', '집기',
  // 무형자산
  '영업권', '산업재산권', '특허권', '상표권', '저작권', '소프트웨어', '개발비',
  '라이선스', '프랜차이즈',
  // 투자자산
  '투자부동산', '장기투자증권',
  // 처분 관련
  '유형자산처분', '무형자산처분', '자산처분', '처분손실', '처분이익'
]

// 계정과목이 자산 관련인지 확인
const isAssetAccount = (accountCode: string): boolean => {
  if (!accountCode) return false
  return assetAccountKeywords.some(keyword => accountCode.includes(keyword))
}

// 자산 취득/처분 시트 헤더 (전표 전체를 표시하므로 회계전표와 동일한 형식 + 거래유형)
const assetSheetHeaders = [
  { key: '_rowNumber', label: 'No.' },
  { key: 'transactionType', label: '거래유형' },
  { key: 'slipNumber', label: '전표번호' },
  { key: 'slipDate', label: '일자' },
  { key: 'accountCode', label: '계정과목' },
  { key: 'debit', label: '차변' },
  { key: 'credit', label: '대변' },
  { key: 'description', label: '적요' },
]

// 자산 요약 시트 헤더 (자산명, 취득/처분일, 금액, 상대방, 사유)
const assetSummaryHeaders = [
  { key: '_rowNumber', label: 'No.' },
  { key: 'assetName', label: '자산명' },
  { key: 'transactionDate', label: '취득/처분일' },
  { key: 'transactionType', label: '유형' },
  { key: 'amount', label: '금액' },
  { key: 'counterparty', label: '상대방' },
  { key: 'reason', label: '사유' },
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
      // 단, 자산 관련 건은 별도 시트로 분리
      if (documentType === 'accountingSlip') {
        dataRows = []
        const assetEntries: any[][] = []  // 자산 관련 건 별도 저장 (전표 전체)
        const assetSummaryRows: any[][] = []  // 자산 요약 데이터
        let nonAssetSlipIndex = 0
        let assetSlipIndex = 0

        // 상대방(거래처) 추출 함수
        const extractCounterparty = (entries: AccountingEntry[]): string => {
          const counterpartyKeywords = ['미지급금', '미수금', '외상매입금', '외상매출금', '보통예금', '현금']
          for (const entry of entries) {
            if (counterpartyKeywords.some(k => entry.accountCode?.includes(k))) {
              const desc = entry.description || ''
              if (desc) return desc.replace(/결제|입금|출금|이체|\(.*\)/g, '').trim()
            }
          }
          return ''
        }

        docResults.forEach((result) => {
          // 새 형식: slips 배열
          const slips = result.fields.slips as AccountingSlip[] | undefined

          if (slips && Array.isArray(slips)) {
            slips.forEach((slip) => {
              const slipNumber = slip.slipNumber || ''
              const slipDate = slip.slipDate || ''
              const entries = slip.entries

              if (entries && Array.isArray(entries)) {
                // 이 전표에 자산 관련 계정이 있는지 확인
                const hasAssetEntry = entries.some(e => isAssetAccount(e.accountCode))

                if (hasAssetEntry) {
                  // 자산 관련 전표: 전표 전체를 자산 시트로 이동
                  assetSlipIndex++
                  // 거래유형 판단 (자산 계정 기준)
                  const assetEntry = entries.find(e => isAssetAccount(e.accountCode))
                  const transactionType = assetEntry && assetEntry.debit > 0 ? '취득' : '처분'
                  const amount = assetEntry ? (assetEntry.debit > 0 ? assetEntry.debit : assetEntry.credit) : 0
                  const counterparty = extractCounterparty(entries)

                  // 자산 요약 데이터 추가 (번호 포함)
                  assetSummaryRows.push([
                    assetSlipIndex,  // No.
                    assetEntry?.accountCode || '',  // 자산명 (계정과목)
                    slipDate,  // 취득/처분일
                    transactionType,  // 유형
                    formatNumber(amount),  // 금액
                    counterparty,  // 상대방
                    assetEntry?.description || '',  // 사유 (적요)
                  ])

                  // 전표의 모든 분개 라인을 자산 시트에 추가 (번호 포함)
                  entries.forEach((entry) => {
                    assetEntries.push([
                      assetSlipIndex,  // No. (전표 단위)
                      transactionType,
                      slipNumber,
                      slipDate,
                      entry.accountCode || '',
                      formatNumber(entry.debit),
                      formatNumber(entry.credit),
                      entry.description || '',
                    ])
                  })
                  // 전표 사이 빈 행 추가
                  assetEntries.push(['', '', '', '', '', '', '', ''])
                } else {
                  // 자산 관련 없는 전표: 일반 회계전표 시트에 포함
                  nonAssetSlipIndex++
                  entries.forEach((entry) => {
                    dataRows.push([
                      nonAssetSlipIndex,  // No. (전표 단위)
                      slipNumber,
                      slipDate,
                      entry.accountCode || '',
                      formatNumber(entry.debit),
                      formatNumber(entry.credit),
                      entry.description || '',
                    ])
                    totalLines++
                  })
                  // 전표 사이에 빈 행 추가
                  dataRows.push(['', '', '', '', '', '', ''])
                }
              }
            })
          } else {
            // 기존 형식 호환 (entries만 있는 경우)
            const slipNumber = result.fields.slipNumber || ''
            const slipDate = result.fields.slipDate || ''
            const entries = result.fields.entries as AccountingEntry[] | undefined

            if (entries && Array.isArray(entries)) {
              const hasAssetEntry = entries.some(e => isAssetAccount(e.accountCode))

              if (hasAssetEntry) {
                // 자산 관련 전표: 전표 전체를 자산 시트로 이동
                assetSlipIndex++
                const assetEntry = entries.find(e => isAssetAccount(e.accountCode))
                const transactionType = assetEntry && assetEntry.debit > 0 ? '취득' : '처분'
                const amount = assetEntry ? (assetEntry.debit > 0 ? assetEntry.debit : assetEntry.credit) : 0
                const counterparty = extractCounterparty(entries)

                // 자산 요약 데이터 추가 (번호 포함)
                assetSummaryRows.push([
                  assetSlipIndex,  // No.
                  assetEntry?.accountCode || '',  // 자산명
                  slipDate,  // 취득/처분일
                  transactionType,  // 유형
                  formatNumber(amount),  // 금액
                  counterparty,  // 상대방
                  assetEntry?.description || '',  // 사유
                ])

                entries.forEach((entry) => {
                  assetEntries.push([
                    assetSlipIndex,  // No. (전표 단위)
                    transactionType,
                    slipNumber,
                    slipDate,
                    entry.accountCode || '',
                    formatNumber(entry.debit),
                    formatNumber(entry.credit),
                    entry.description || '',
                  ])
                })
                // 전표 사이 빈 행 추가
                assetEntries.push(['', '', '', '', '', '', '', ''])
              } else {
                nonAssetSlipIndex++
                entries.forEach((entry) => {
                  dataRows.push([
                    nonAssetSlipIndex,  // No. (전표 단위)
                    slipNumber,
                    slipDate,
                    entry.accountCode || '',
                    formatNumber(entry.debit),
                    formatNumber(entry.credit),
                    entry.description || '',
                  ])
                  totalLines++
                })
              }
            } else {
              // 완전히 이전 형식 (단일 분개)
              nonAssetSlipIndex++
              dataRows.push([
                nonAssetSlipIndex,  // No.
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

        // 마지막 빈 행 제거
        if (dataRows.length > 0 && dataRows[dataRows.length - 1].every(cell => cell === '')) {
          dataRows.pop()
        }

        // 자산 관련 건이 있으면 별도 시트 생성 (나중에 추가)
        // @ts-ignore - 임시로 결과 저장
        groupedResults['_assetEntries'] = assetEntries as any
        // @ts-ignore - 자산 요약 데이터 저장
        groupedResults['_assetSummaryRows'] = assetSummaryRows as any
        // @ts-ignore - 일반 회계전표 수 저장
        groupedResults['_nonAssetSlipCount'] = nonAssetSlipIndex as any
        // @ts-ignore - 자산 전표 수 저장
        groupedResults['_assetSlipCount'] = assetSlipIndex as any
      } else {
        // 다른 문서 유형은 번호 추가
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
      }

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
      // 회계전표는 저장된 일반 전표 수를 사용, 다른 문서는 docResults.length 사용
      let actualCount = docResults.length
      if (documentType === 'accountingSlip') {
        // @ts-ignore - 위에서 저장한 일반 회계전표 수 가져오기
        actualCount = groupedResults['_nonAssetSlipCount'] as number || 0
      }
      const countLabel = `${actualCount}건`
      const sheetName = `${documentTypeLabels[documentType]}_${countLabel}`
      XLSX.utils.book_append_sheet(wb, ws, sheetName)

      // 회계전표인 경우: 자산 취득/처분 건 별도 시트 생성 (위에서 분리된 데이터 사용)
      if (documentType === 'accountingSlip') {
        // @ts-ignore - 위에서 저장한 자산 데이터 가져오기
        const assetEntries = groupedResults['_assetEntries'] as any[][] || []

        // 자산 취득/처분 건이 있으면 별도 시트 생성
        if (assetEntries.length > 0) {
          // 마지막 빈 행 제거
          while (assetEntries.length > 0 && assetEntries[assetEntries.length - 1].every(cell => cell === '')) {
            assetEntries.pop()
          }

          // 전표 수 계산 (빈 행으로 구분된 전표 그룹 수)
          let assetSlipCount = 0
          let prevRowEmpty = true
          assetEntries.forEach(row => {
            const isEmpty = row.every(cell => cell === '')
            if (!isEmpty && prevRowEmpty) {
              assetSlipCount++
            }
            prevRowEmpty = isEmpty
          })

          const assetHeaderRow = assetSheetHeaders.map(h => h.label)
          const assetSheetData = [assetHeaderRow, ...assetEntries]
          const assetWs = XLSX.utils.aoa_to_sheet(assetSheetData)

          // 컬럼 너비 설정 (No. + 회계전표와 동일 + 거래유형)
          assetWs['!cols'] = [
            { wch: 5 },   // No.
            { wch: 8 },   // 거래유형
            { wch: 15 },  // 전표번호
            { wch: 12 },  // 일자
            { wch: 15 },  // 계정과목
            { wch: 15 },  // 차변
            { wch: 15 },  // 대변
            { wch: 40 },  // 적요
          ]

          // 스타일 적용
          const assetRange = XLSX.utils.decode_range(assetWs['!ref'] || 'A1')
          for (let R = assetRange.s.r; R <= assetRange.e.r; R++) {
            for (let C = assetRange.s.c; C <= assetRange.e.c; C++) {
              const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
              if (!assetWs[cellAddress]) continue
              assetWs[cellAddress].s = R === 0 ? headerStyle : cellStyle
            }
          }

          // 시트 이름: 회계전표_자산N건 (전표 수 기준)
          // @ts-ignore - 저장된 자산 전표 수 사용
          const savedAssetSlipCount = groupedResults['_assetSlipCount'] as number || assetSlipCount
          XLSX.utils.book_append_sheet(wb, assetWs, `회계전표_자산${savedAssetSlipCount}건`)

          // 자산 요약 시트 생성
          // @ts-ignore - 위에서 저장한 자산 요약 데이터 가져오기
          const assetSummaryRows = groupedResults['_assetSummaryRows'] as any[][] || []

          if (assetSummaryRows.length > 0) {
            const summaryHeaderRow = assetSummaryHeaders.map(h => h.label)
            const summarySheetData = [summaryHeaderRow, ...assetSummaryRows]
            const summaryWs = XLSX.utils.aoa_to_sheet(summarySheetData)

            // 컬럼 너비 설정 (No. 포함)
            summaryWs['!cols'] = [
              { wch: 5 },   // No.
              { wch: 20 },  // 자산명
              { wch: 12 },  // 취득/처분일
              { wch: 8 },   // 유형
              { wch: 15 },  // 금액
              { wch: 20 },  // 상대방
              { wch: 40 },  // 사유
            ]

            // 스타일 적용
            const summaryRange = XLSX.utils.decode_range(summaryWs['!ref'] || 'A1')
            for (let R = summaryRange.s.r; R <= summaryRange.e.r; R++) {
              for (let C = summaryRange.s.c; C <= summaryRange.e.c; C++) {
                const cellAddress = XLSX.utils.encode_cell({ r: R, c: C })
                if (!summaryWs[cellAddress]) continue
                summaryWs[cellAddress].s = R === 0 ? headerStyle : cellStyle
              }
            }

            // 시트 이름: 자산요약
            XLSX.utils.book_append_sheet(wb, summaryWs, '자산요약')
          }
        }

        // 임시 데이터 정리
        // @ts-ignore
        delete groupedResults['_assetEntries']
        // @ts-ignore
        delete groupedResults['_assetSummaryRows']
      }
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
