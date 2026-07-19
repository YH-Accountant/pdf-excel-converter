// 문서 유형별 "표시 필드 + 한글 라벨"의 단일 소스
//
// 단일 화면(ResultTable), 단일 엑셀(ExcelDownload), 일괄 엑셀(BatchExcelDownload)이
// 모두 이 정의를 사용해 동일한 필드·라벨·포맷으로 출력한다.
// (AI가 임의로 끼워넣는 내부 필드 documentType·transactions 등은 여기에 없으므로
//  자동으로 표시에서 제외된다 → 세 화면의 일관성 보장)

import { DocumentType } from '@/app/single/page'

export interface FieldDef {
  key: string
  label: string
}

// 유형별 표시 필드 (표시 순서 = 배열 순서). No./원본파일명 같은 표(表) 전용 열은 포함하지 않는다.
export const DOCUMENT_FIELDS: Record<DocumentType, FieldDef[]> = {
  contract: [
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
    { key: 'totalAmount', label: '합계금액' },
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
  bankStatement: [
    { key: 'transactionDate', label: '거래일' },
    { key: 'deposit', label: '입금' },
    { key: 'withdrawal', label: '출금' },
    { key: 'sender', label: '보내는분' },
    { key: 'recipient', label: '받는분' },
    { key: 'transactionContent', label: '거래내용' },
  ],
  assetDisposal: [
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
    { key: 'withholdingAgent', label: '징수의무자' },
    { key: 'businessNumber', label: '사업자등록번호' },
    { key: 'attributionYearMonth', label: '귀속년월' },
    { key: 'numberOfPeople', label: '인원' },
    { key: 'totalPayment', label: '총지급액' },
    { key: 'incomeTax', label: '소득세' },
    { key: 'localIncomeTax', label: '지방소득세' },
  ],
  estimate: [
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
    { key: 'paymentYearMonth', label: '귀속년월' },
    { key: 'paymentDate', label: '지급일' },
    { key: 'companyName', label: '회사명' },
    { key: 'totalNetPay', label: '실지급액합계' },
  ],
}

// 유형 한글 라벨
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  contract: '계약서',
  taxInvoice: '세금계산서',
  tradingStatement: '거래명세서',
  bankStatement: '통장 입출금내역',
  assetDisposal: '취득처분전표',
  withholdingTax: '급여원천징수이행상황신고서',
  estimate: '견적서',
  payroll: '급여대장',
}

// 단일 금액 필드 (천 단위 콤마)
const NUMBER_FIELDS = new Set([
  'supplyValue', 'taxAmount', 'totalAmount', 'deposit', 'withdrawal', 'balance',
  'incomeTax', 'localIncomeTax', 'totalPayment', 'amount', 'acquisitionCost', 'disposalPrice',
])

// 품목별 다행 필드 (한 줄에 하나씩, 숫자 줄은 콤마)
const MULTILINE_FIELDS = new Set(['items', 'quantity', 'unitPrice'])

function formatNumber(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const num = typeof value === 'string' ? parseFloat(value.replace(/,/g, '')) : (value as number)
  if (isNaN(num)) return String(value)
  return num.toLocaleString('ko-KR')
}

function formatMultiLine(value: unknown): string {
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

/**
 * 필드 값을 화면/엑셀 공통 규칙으로 포맷한다.
 * - 다행 품목 필드: 줄바꿈 유지 + 숫자 줄 콤마
 * - 단일 금액 필드: 천 단위 콤마
 * - 그 외: 문자열 그대로 (배열은 줄바꿈 결합)
 */
export function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return ''
  if (MULTILINE_FIELDS.has(key)) return formatMultiLine(value)
  if (NUMBER_FIELDS.has(key)) return formatNumber(value)
  if (Array.isArray(value)) return value.join('\n')
  return String(value)
}
