// 문서 유형 판별 결과의 앵커 검증
//
// 배경: 유형별 "결정적 단서"를 프롬프트에 넣어 두었지만(templates/index.ts),
// 그건 AI에게 알려주기만 할 뿐 코드가 확인하지는 않았다.
// 금액 할루시네이션 때와 같은 구조여서, 유형에도 같은 방식으로 근거를 확인한다.
//
// 값 검증(lib/grounding.ts)과 다른 점 — 강도를 낮춘다
//   금액: 근거가 없으면 값을 버린다 (없는 값이 틀린 값보다 낫다)
//   유형: 근거가 없어도 판정은 유지하고 경고만 한다
//         · 유형을 버리면 문서 전체를 처리할 수 없다
//         · 앵커는 "단어가 있느냐"만 보므로 OCR이 제목 한 줄을 놓치면 사라진다
//         · 글자가 적은 문서(이체확인증 등)는 앵커도 적어 오탐이 나기 쉽다
//
// 자동 교정은 하지 않는다. 앵커는 단어 하나만 보는 얕은 근거라,
// 문서 전체 맥락을 본 AI의 판단을 덮어쓰면 오히려 나빠질 수 있다.
// (예: 견적서의 "납품 예정일"이 거래명세서 앵커로 잡힌다)
// 감지해서 알리되, 결정은 사람이 한다.

import type { DocumentType } from '@/app/single/page'

// 유형별 앵커. templates/index.ts의 "결정적 단서"를 코드로 옮긴 것이므로
// 그쪽을 고치면 여기도 함께 검토해야 한다.
export const TYPE_ANCHORS: Record<DocumentType, string[]> = {
  // 한 글자 앵커('갑', '을')는 조사와 구분되지 않아 넣지 않는다.
  // ("도착하였음을" 같은 평범한 문장이 계약서 단서로 잡힌다)
  contract: ['제1조', '제2조', '계약을 체결', '계약금액', '기명날인', '위탁자', '수탁자', '(인)'],
  taxInvoice: ['세금계산서', '승인번호', '공급가액', '공급받는자'],
  tradingStatement: ['거래명세', '인수자', '인계자', '납품', '영수', '청구'],
  bankStatement: ['이체', '출금', '입금', '잔액', '거래내역'],
  withholdingTax: ['원천징수', '귀속연월', '지급연월', '징수의무자', '소득구분'],
  estimate: ['견적', '유효기간', '귀중', '귀하'],
  payroll: ['급여', '기본급', '차인지급액', '실지급액', '공제'],
}

// 서로 헷갈리기 쉬운 유형 쌍. 표 구조나 항목 구성이 비슷해
// 앵커가 양쪽 모두 나타날 수 있으므로 상대와 비교해서 판정한다.
// (templates/index.ts의 "견적서 vs 계약서", "거래명세서 vs 견적서" 구분 기준과 같은 쌍)
export const CONFUSABLE_PAIRS: [DocumentType, DocumentType][] = [
  ['contract', 'estimate'],
  ['tradingStatement', 'estimate'],
]

export interface AnchorCheckResult {
  // false면 사용자 확인이 필요하다는 뜻. 판정 자체는 그대로 사용한다.
  ok: boolean
  // 확인이 필요한 이유. 어떤 단서를 보고 그렇게 판단했는지까지 담는다
  // ("확인하세요"만으로는 무엇을 봐야 할지 알 수 없다)
  reason?: string
  // 원문에서 발견된 해당 유형의 앵커
  found: string[]
}

// 공백을 걷어낸다.
// 한국 서식은 제목을 "급 여 대 장", "거 래 명 세 서"처럼 자간을 벌려 쓰는 일이 흔하고,
// OCR도 글자 사이에 공백을 끼워 넣는다. 그대로 대조하면 정작 가장 확실한 단서인
// 제목을 놓친다.
//
// 대신 "지급 여부" → "지급여부"처럼 붙으면서 없던 단서(급여)가 생길 수 있다.
// 이 검증은 경고만 하고 유형을 바꾸지 않으므로, 단서를 과하게 찾는 쪽(검증이 느슨해짐)이
// 멀쩡한 문서에 "확인 필요"를 띄우는 쪽보다 낫다고 보고 이 트레이드오프를 택했다.
const stripSpaces = (s: string) => s.replace(/\s/g, '')

// 원문에서 해당 유형의 앵커를 찾는다
function findAnchors(documentType: DocumentType, sourceText: string): string[] {
  const anchors = TYPE_ANCHORS[documentType]
  if (!anchors) return []
  const packed = stripSpaces(sourceText)
  return anchors.filter((a) => packed.includes(stripSpaces(a)))
}

// 혼동쌍에서 상대 유형을 찾는다
function findCounterpart(documentType: DocumentType): DocumentType | null {
  for (const [a, b] of CONFUSABLE_PAIRS) {
    if (a === documentType) return b
    if (b === documentType) return a
  }
  return null
}

// 앵커가 가장 많이 발견된 다른 유형 (단서가 아예 없을 때 후보로 제시)
function bestAlternative(
  documentType: DocumentType,
  sourceText: string
): { type: DocumentType; found: string[] } | null {
  let best: { type: DocumentType; found: string[] } | null = null
  for (const type of Object.keys(TYPE_ANCHORS) as DocumentType[]) {
    if (type === documentType) continue
    const found = findAnchors(type, sourceText)
    if (found.length > 0 && (!best || found.length > best.found.length)) {
      best = { type, found }
    }
  }
  return best
}

/**
 * AI가 판별한 유형에 원문상 근거가 있는지 확인한다.
 * 결과는 통과 / 확인 필요 두 가지뿐이다 — 사용자가 할 일이 같기 때문에 더 쪼개지 않는다.
 */
export function checkTypeAnchors(
  documentType: DocumentType,
  sourceText: string,
  // 같은 파일에서 함께 감지된 다른 유형들.
  // 합본 증빙은 원문 전체에 여러 유형의 단서가 섞여 있으므로,
  // 혼동쌍 상대가 이미 별도 문서로 감지됐다면 비교해봐야 의미가 없다.
  // (계약서+견적서 합본에서 견적서가 매번 "확인 필요"로 뜨는 오탐을 막는다)
  alsoDetected: DocumentType[] = []
): AnchorCheckResult {
  if (!sourceText || !TYPE_ANCHORS[documentType]) {
    return { ok: true, found: [] }
  }

  const found = findAnchors(documentType, sourceText)
  const label = documentType

  // ① 고른 유형의 단서가 원문에 하나도 없다
  if (found.length === 0) {
    const alt = bestAlternative(documentType, sourceText)
    const reason = alt
      ? `원문에 ${label} 단서가 없고, ${alt.type} 단서가 나타납니다 (${alt.found.join(', ')})`
      : `원문에 ${label} 단서가 없습니다`
    return { ok: false, reason, found }
  }

  // ② 혼동쌍 상대의 단서가 같거나 더 많다 (상대가 함께 감지된 경우는 제외)
  const counterpart = findCounterpart(documentType)
  if (counterpart && !alsoDetected.includes(counterpart)) {
    const rivalFound = findAnchors(counterpart, sourceText)
    if (rivalFound.length >= found.length) {
      return {
        ok: false,
        reason:
          `${label}와 ${counterpart} 단서가 함께 나타납니다 ` +
          `(${label}: ${found.join(', ')} / ${counterpart}: ${rivalFound.join(', ')})`,
        found,
      }
    }
  }

  return { ok: true, found }
}
