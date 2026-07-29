// 근거 검증 (grounding check)
//
// AI가 추출한 금액이 원문 텍스트에 실제로 인쇄되어 있는지 코드가 대조한다.
// LLM은 문서에 없는 값을 학습된 지식으로 채워 넣는 경우가 있다
// (예: 원천징수이행상황신고서에는 지방소득세 칸이 없는데 소득세의 10%를
// 계산해서 반환). 이런 값은 그럴듯해서 눈으로는 걸러지지 않으므로,
// 원문에 근거가 없는 값은 코드가 버리고 경고를 남긴다.
//
// 적용 원칙
// - 서식상 문서에 반드시 인쇄되어 있는 필드에만 건다 (필드별 옵트인).
//   합계처럼 AI가 항목을 더해 만드는 것이 정상인 값은 원문에 없을 수 있어 제외.
// - 원문 텍스트가 있는 추출 경로(PDF 텍스트·OCR)에서만 동작한다.
//   이미지를 직접 AI에 보내는 경로는 대조할 원문이 없어 적용 불가.

// 값이 아닌 타입만 가져온다 — node:test가 이 파일을 직접 실행할 때
// React 페이지 모듈이 딸려 들어오지 않도록 type-only import를 쓴다
import type { DocumentType } from '@/app/single/page'

// 문서 유형별로 원문에 반드시 근거가 있어야 하는 금액 필드.
// - withholdingTax: 신고서에 인쇄된 집계값. localIncomeTax는 서식에 칸이
//   없어(위택스 별도 신고) 문서에 적혀 있지 않으면 지어낸 값이다.
// - taxInvoice: 공급가액·세액은 법정 필수 기재사항. totalAmount는
//   템플릿이 "공급가액 + 부가세"로 계산을 허용하므로 제외.
export const GROUNDED_AMOUNT_FIELDS: Partial<Record<DocumentType, string[]>> = {
  withholdingTax: ['totalPayment', 'incomeTax', 'localIncomeTax'],
  taxInvoice: ['supplyValue', 'taxAmount'],
}

// 완화 검증 대상 — 원문에 없어도 값은 유지하고 경고만 남긴다.
//
// 합계금액은 인쇄되어 있지 않은 서식이 있어 AI가 계산하는 것이 정상인 경우가 있다.
// 그래서 버리면 안 된다. 다만 인쇄된 합계가 공급가액+세액과 어긋날 때
// AI가 계산상 맞는 값으로 바꿔치기하는 것이 관측됐다.
//   예) 문서에 21,708,000이 인쇄되어 있는데 21,780,000으로 반환
// 증빙에 적힌 값이 곧 사실이고, 계산이 어긋나는 것 자체가 확인해야 할 사안이므로
// 조용히 보정되면 원본 오류를 발견할 기회를 잃는다.
// 값은 그대로 두되 "원문에 없다"는 사실을 반드시 알린다.
export const SOFT_GROUNDED_FIELDS: Partial<Record<DocumentType, string[]>> = {
  taxInvoice: ['totalAmount'],
}

// 이 금액 미만은 검증하지 않는다. 짧은 숫자(인원수·페이지 번호 등)는
// 원문 어딘가에 우연히 나타날 확률이 높아 검증이 의미를 갖지 못한다.
const MIN_GROUNDABLE_AMOUNT = 1000

// 원문에서 숫자 토큰을 뽑아 콤마를 제거한 형태로 모은다.
// "24,950,330"과 "24950330"을 같은 값으로 취급하기 위함.
// 전체 텍스트에서 숫자만 이어 붙이면 인접한 두 숫자가 붙어서
// 지어낸 값이 우연히 부분 문자열로 통과할 수 있으므로, 토큰 단위로 대조한다.
export function extractNumberTokens(text: string): Set<string> {
  const tokens = new Set<string>()
  const matches = text.match(/\d[\d,]*/g) || []
  for (const raw of matches) {
    tokens.add(raw.replace(/,/g, ''))
  }
  return tokens
}

// 추출값을 대조 가능한 숫자 문자열로 정규화. 금액이 아니면 null.
function normalizeAmount(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number.isInteger(value) ? String(value) : null
  }
  if (typeof value === 'string') {
    const digits = value.replace(/[,\s원]/g, '')
    return /^\d+$/.test(digits) ? digits : null
  }
  return null
}

export interface GroundingResult {
  fields: Record<string, any>
  // 근거를 찾지 못해 버린 필드와 그 값 (경고 표시·로그용)
  dropped: { field: string; value: string }[]
  // 근거를 찾지 못했지만 값은 유지한 필드 (완화 검증 대상)
  unverified: { field: string; value: string }[]
}

// AI가 추출한 필드 중 근거 검증 대상을 원문과 대조한다.
// 엄격 대상은 원문에 없으면 null로 되돌리고(없는 값이 틀린 값보다 낫다),
// 완화 대상은 값을 유지한 채 사실만 알린다.
export function groundAmountFields(
  documentType: DocumentType,
  fields: Record<string, any>,
  sourceText: string
): GroundingResult {
  const strict = GROUNDED_AMOUNT_FIELDS[documentType]
  const soft = SOFT_GROUNDED_FIELDS[documentType]
  if ((!strict && !soft) || !sourceText) {
    return { fields, dropped: [], unverified: [] }
  }

  const tokens = extractNumberTokens(sourceText)
  const dropped: { field: string; value: string }[] = []
  const unverified: { field: string; value: string }[] = []
  const result = { ...fields }

  // 원문에 근거가 있는지 확인한다. 대조 불가(비금액·소액)면 null을 돌려준다.
  const missingFrom = (field: string): string | null => {
    const normalized = normalizeAmount(result[field])
    if (normalized === null) return null
    if (parseInt(normalized, 10) < MIN_GROUNDABLE_AMOUNT) return null
    return tokens.has(normalized) ? null : normalized
  }

  for (const field of strict || []) {
    const value = missingFrom(field)
    if (value !== null) {
      dropped.push({ field, value })
      result[field] = null
    }
  }

  for (const field of soft || []) {
    const value = missingFrom(field)
    if (value !== null) unverified.push({ field, value })
  }

  return { fields: result, dropped, unverified }
}
