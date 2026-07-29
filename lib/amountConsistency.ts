// 금액 정합성 검산
//
// 문서는 같은 정보를 여러 번 담고 있다. 세금계산서라면 공급가액·세액·합계가 그렇다.
// 이 관계가 깨지면 어딘가 잘못 읽었거나 지어낸 것이므로, 코드가 계산해서 확인한다.
//
// 근거 검증(lib/grounding.ts)과의 역할 분담
//   근거 검증: 추출값이 원문에 인쇄된 숫자인지 대조 → 없으면 버림
//   정합성 검산: 남은 값들이 서로 앞뒤가 맞는지 계산 → 어긋나면 경고
//
// 근거 검증만으로는 부족한 경우가 있다.
//   · 세액과 합계를 함께 지어내면, 세액은 버려져도 합계는 검증 대상이 아니라 통과한다
//   · 원문 어딘가에 우연히 같은 숫자가 있어 근거 검증을 통과하는 경우가 있다
// 반대로 정합성 검산은 원문이 없어도 값끼리만 비교하므로,
// 근거 검증이 닿지 않는 이미지(Vision) 경로에서도 작동한다.
//
// 값은 고치지 않는다. 어느 값이 틀렸는지 코드가 단정할 수 없고,
// 자동 보정은 그럴듯하게 틀린 값을 만들어 더 위험하기 때문이다.

import type { DocumentType } from '@/app/single/page'

export interface ConsistencyResult {
  ok: boolean
  // 확인이 필요한 이유. 어떤 값들로 그렇게 판단했는지까지 담는다
  reason?: string
}

/**
 * 금액 필드를 숫자로 정규화한다.
 *
 * ★ 0과 null을 반드시 구분한다.
 *   0은 영세율 세금계산서의 세액처럼 "실제로 0인 유효한 값"이고,
 *   null은 "읽지 못했거나 근거 검증이 버린 값"이다.
 *   흔한 실수인 `if (!value)`로 판정하면 0이 함께 걸려,
 *   정작 검산이 가장 필요한 영세율 문서에서 검사를 건너뛰게 된다.
 */
export function toAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const digits = value.replace(/[,\s원]/g, '')
    if (!/^-?\d+$/.test(digits)) return null
    return parseInt(digits, 10)
  }
  return null
}

const format = (n: number) => n.toLocaleString('ko-KR')

/**
 * 세금계산서: 공급가액 + 세액 = 합계금액
 *
 * 서식상 정확히 성립하는 관계이므로 오차를 두지 않는다.
 * (원 단위 절사는 세액 자체에 이미 반영되어 있고, 합계는 그 세액을 더한 값이다)
 */
function checkTaxInvoice(fields: Record<string, any>): ConsistencyResult {
  const supply = toAmount(fields.supplyValue)
  const tax = toAmount(fields.taxAmount)
  const total = toAmount(fields.totalAmount)

  // 합계가 없으면 비교할 대상이 없다. 합계를 인쇄하지 않는 서식도 있으므로 조용히 넘어간다.
  if (total === null) return { ok: true }

  // 공급가액이나 세액이 비어 있으면 등식을 세울 수 없다.
  // 그런데 여기서 조용히 넘어가면 구멍이 생긴다 —
  // 세액을 지어낸 AI는 합계도 그 세액 기준으로 냈을 가능성이 큰데,
  // 근거 검증이 세액을 버리면서 합계를 검산할 기회까지 사라지기 때문이다.
  // 그래서 "검산하지 못했다"는 사실 자체를 알린다.
  if (supply === null || tax === null) {
    const missing = [supply === null && '공급가액', tax === null && '세액']
      .filter(Boolean)
      .join('·')
    return {
      ok: false,
      reason: `${missing}을(를) 확인할 수 없어 합계금액 ${format(total)}을 검산하지 못했습니다`,
    }
  }

  const expected = supply + tax
  if (expected !== total) {
    return {
      ok: false,
      reason:
        `합계금액이 맞지 않습니다 — 공급가액 ${format(supply)} + 세액 ${format(tax)} = ` +
        `${format(expected)}이지만 합계금액은 ${format(total)}입니다`,
    }
  }

  return { ok: true }
}

/**
 * 문서 유형별 금액 정합성을 검산한다.
 * 대상이 아닌 유형은 통과시킨다.
 */
export function checkAmountConsistency(
  documentType: DocumentType,
  fields: Record<string, any>
): ConsistencyResult {
  if (documentType === 'taxInvoice') return checkTaxInvoice(fields || {})
  return { ok: true }
}
