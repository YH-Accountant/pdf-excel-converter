// 급여대장 직원 ↔ 통장 거래내역 개인별 매칭
//
// 설계 원칙:
// - 기본 검증은 총액 3자 대사(급여대장 ↔ 이체총액 ↔ 원천세 신고서)이고,
//   개인별 매칭은 통장 적요에 이름이 남는 경우에만 성립하는 보조 검증이다
// - 은행 자료에는 사번이 존재하지 않으므로 매칭 키는 이름(1차) + 금액(2차)
// - 동명이인은 금액으로 구분하되, 개별 귀속은 기계가 단정할 수 없으므로
//   isDuplicateName 플래그로 사용자 확인을 유도한다

// 매칭 허용 오차 (원 단위 절사 등으로 인한 차이 흡수)
const MATCH_TOLERANCE = 100

export interface EmployeeInput {
  name: string
  netPay: number
}

export interface TransactionInput {
  description?: string
  withdrawal?: number
}

export interface EmployeeMatchResult {
  name: string
  payrollAmount: number
  bankAmount: number
  difference: number
  isMatched: boolean
  // 급여대장에 같은 이름이 2명 이상 → 개별 귀속은 원본 증빙 확인 필요
  isDuplicateName: boolean
}

function nameMatches(tx: TransactionInput, name: string): boolean {
  // 양쪽 모두 값이 있어야 매칭 성립 (빈 적요가 모든 이름과 매칭되는 것 방지)
  if (!name || !tx.description) return false
  return tx.description.includes(name) || name.includes(tx.description)
}

export function matchEmployeesToTransactions(
  employees: EmployeeInput[],
  transactions: TransactionInput[]
): EmployeeMatchResult[] {
  // 동명이인 감지용 이름 빈도
  const nameCounts = new Map<string, number>()
  for (const emp of employees) {
    nameCounts.set(emp.name, (nameCounts.get(emp.name) ?? 0) + 1)
  }

  // 한 번 매칭된 거래는 후보에서 제거 (동명이인 중복 매칭 방지)
  const usedIndexes = new Set<number>()

  return employees.map((emp) => {
    // 1순위: 이름 + 금액 일치 / 2순위: 이름만 일치 (미사용 거래 중에서)
    let pickedIndex = -1
    for (let i = 0; i < transactions.length; i++) {
      if (usedIndexes.has(i)) continue
      if (!nameMatches(transactions[i], emp.name)) continue

      const withdrawal = transactions[i].withdrawal || 0
      if (Math.abs(withdrawal - emp.netPay) < MATCH_TOLERANCE) {
        pickedIndex = i
        break
      }
      if (pickedIndex === -1) pickedIndex = i
    }

    if (pickedIndex >= 0) usedIndexes.add(pickedIndex)

    const bankAmount = pickedIndex >= 0 ? (transactions[pickedIndex].withdrawal || 0) : 0
    return {
      name: emp.name,
      payrollAmount: emp.netPay,
      bankAmount,
      difference: emp.netPay - bankAmount,
      isMatched: bankAmount > 0 ? Math.abs(emp.netPay - bankAmount) < MATCH_TOLERANCE : false,
      isDuplicateName: (nameCounts.get(emp.name) ?? 0) > 1,
    }
  })
}
