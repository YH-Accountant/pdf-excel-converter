// 한글 금액 ↔ 숫자 변환 유틸리티

// 한글 숫자 매핑
const koreanNumbers: Record<string, number> = {
  '영': 0, '일': 1, '이': 2, '삼': 3, '사': 4,
  '오': 5, '육': 6, '칠': 7, '팔': 8, '구': 9,
  '십': 10, '백': 100, '천': 1000,
  '만': 10000, '억': 100000000, '조': 1000000000000
}

// 숫자를 한글 금액으로 변환
export function numberToKorean(num: number): string {
  if (num === 0) return '영원'

  const units = ['', '만', '억', '조']
  const smallUnits = ['', '십', '백', '천']
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']

  let result = ''
  let unitIndex = 0

  while (num > 0) {
    const chunk = num % 10000
    if (chunk > 0) {
      let chunkStr = ''
      let chunkNum = chunk
      let smallUnitIndex = 0

      while (chunkNum > 0) {
        const digit = chunkNum % 10
        if (digit > 0) {
          if (smallUnitIndex === 0) {
            chunkStr = digits[digit] + chunkStr
          } else {
            // 1인 경우 '일'을 생략 (십, 백, 천 앞에서)
            const digitStr = digit === 1 ? '' : digits[digit]
            chunkStr = digitStr + smallUnits[smallUnitIndex] + chunkStr
          }
        }
        chunkNum = Math.floor(chunkNum / 10)
        smallUnitIndex++
      }

      result = chunkStr + units[unitIndex] + result
    }

    num = Math.floor(num / 10000)
    unitIndex++
  }

  return result + '원'
}

// 한글 금액을 숫자로 변환
export function koreanToNumber(korean: string): number {
  // 원, 정 등 단위 제거
  korean = korean.replace(/[원정]/g, '').trim()

  let result = 0   // 만/억/조 단위로 확정된 값
  let section = 0  // 현재 만 단위 블록의 누적값 (예: "이천육백사십" → 2640)
  let digit = 0    // 마지막으로 읽은 한 자리 숫자 (다음 십/백/천의 배수)

  for (const char of korean) {
    const value = koreanNumbers[char]

    if (value === undefined) continue

    if (value >= 10000) {
      // 만, 억, 조: 현재 블록을 확정하고 초기화 ("만"처럼 숫자 생략 시 1로 간주)
      section += digit
      if (section === 0) section = 1
      result += section * value
      section = 0
      digit = 0
    } else if (value >= 10) {
      // 십, 백, 천: 앞의 숫자와 곱해 블록에 누적 ("천"처럼 숫자 생략 시 1로 간주)
      section += (digit === 0 ? 1 : digit) * value
      digit = 0
    } else {
      // 일~구
      digit = value
    }
  }

  return result + section + digit
}

// 금액 문자열에서 숫자 추출
export function extractNumberFromAmount(amountStr: string): number | null {
  // 괄호 안의 숫자 추출 시도
  const numberMatch = amountStr.match(/[\d,]+/)
  if (numberMatch) {
    return parseInt(numberMatch[0].replace(/,/g, ''), 10)
  }
  return null
}

// 금액 문자열에서 한글 금액 추출
export function extractKoreanFromAmount(amountStr: string): string | null {
  // "일금 오백만원정" 관용구의 "일금"은 금액이 아니므로 제거 후 매칭
  // (제거하지 않으면 "일"만 매칭되어 1원으로 오인식됨)
  const cleaned = amountStr.replace(/일금\s*/g, '')

  // 한글 금액 패턴 매칭 (예: 육십억원, 오천만원)
  const koreanMatch = cleaned.match(/[일이삼사오육칠팔구십백천만억조]+\s*원?정?/)
  if (koreanMatch) {
    return koreanMatch[0]
  }
  return null
}

// 금액 검증 및 교정
export function validateAndCorrectAmount(amountStr: string): string {
  if (!amountStr || amountStr === 'null' || amountStr === '명시되지 않음') {
    return amountStr
  }

  const koreanPart = extractKoreanFromAmount(amountStr)
  const numberPart = extractNumberFromAmount(amountStr)

  // VAT 정보 추출
  const vatMatch = amountStr.match(/VAT\s*(별도|포함)/)
  const vatInfo = vatMatch ? `, VAT ${vatMatch[1]}` : ''

  if (koreanPart) {
    // 한글이 있으면 한글 기준으로 숫자 계산
    const calculatedNumber = koreanToNumber(koreanPart)

    if (calculatedNumber > 0) {
      // 한글 기준으로 숫자를 재계산하여 반환
      const formattedNumber = calculatedNumber.toLocaleString('ko-KR')
      const koreanWithUnit = koreanPart.includes('원') ? koreanPart : koreanPart + '원'
      return `${koreanWithUnit}(${formattedNumber}원${vatInfo})`
    }
  }

  if (numberPart) {
    // 숫자만 있으면 숫자 기준으로 한글 생성
    const koreanAmount = numberToKorean(numberPart)
    const formattedNumber = numberPart.toLocaleString('ko-KR')
    return `${koreanAmount}(${formattedNumber}원${vatInfo})`
  }

  return amountStr
}

// 금액 필드들을 검증하고 교정
export function validateAmountFields(
  fields: Record<string, string | number | null>
): Record<string, string | number | null> {
  // unitPrice(단가)는 교정 대상에서 제외: "품목A: 15,000, 품목B: 2,000,000"처럼
  // 여러 품목의 단가가 한 필드에 올 수 있어, 단일 금액 교정을 거치면 첫 숫자만 남는다
  const amountFieldNames = [
    'contractAmount', 'totalAmount', 'supplyValue', 'taxAmount',
    'amount', 'debit', 'credit', 'deposit', 'withdrawal', 'balance',
    'totalPayment', 'incomeTax', 'localIncomeTax'
  ]

  const correctedFields = { ...fields }

  for (const fieldName of amountFieldNames) {
    if (correctedFields[fieldName] && typeof correctedFields[fieldName] === 'string') {
      correctedFields[fieldName] = validateAndCorrectAmount(correctedFields[fieldName] as string)
    }
  }

  return correctedFields
}
