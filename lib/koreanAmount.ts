// 한글 금액을 숫자로 변환하는 유틸리티

const koreanDigits: Record<string, number> = {
  '영': 0, '공': 0,
  '일': 1, '하나': 1,
  '이': 2, '둘': 2,
  '삼': 3, '셋': 3,
  '사': 4, '넷': 4,
  '오': 5, '다섯': 5,
  '육': 6, '여섯': 6,
  '칠': 7, '일곱': 7,
  '팔': 8, '여덟': 8,
  '구': 9, '아홉': 9,
}

const koreanUnits: Record<string, number> = {
  '십': 10,
  '백': 100,
  '천': 1000,
  '만': 10000,
  '억': 100000000,
  '조': 1000000000000,
}

/**
 * 한글 금액을 숫자로 변환
 * 예: "팔천오백삼십만원" -> 85300000
 * 예: "일억이천삼백만원" -> 123000000
 */
export function koreanToNumber(koreanAmount: string): number | null {
  if (!koreanAmount) return null

  // "원" 제거하고 정리
  let cleaned = koreanAmount.replace(/원|정|금|₩|\s/g, '').trim()
  if (!cleaned) return null

  // 이미 숫자만 있는 경우
  if (/^[\d,]+$/.test(cleaned)) {
    return parseInt(cleaned.replace(/,/g, ''), 10)
  }

  let result = 0
  let currentSection = 0  // 현재 만/억 단위 내 값
  let currentNumber = 0   // 현재 숫자

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i]

    // 숫자인 경우
    if (koreanDigits[char] !== undefined) {
      currentNumber = koreanDigits[char]
    }
    // 십/백/천 단위
    else if (char === '십' || char === '백' || char === '천') {
      const unitValue = koreanUnits[char]
      if (currentNumber === 0) currentNumber = 1
      currentSection += currentNumber * unitValue
      currentNumber = 0
    }
    // 만 단위
    else if (char === '만') {
      if (currentNumber > 0) {
        currentSection += currentNumber
        currentNumber = 0
      }
      if (currentSection === 0) currentSection = 1
      result += currentSection * 10000
      currentSection = 0
    }
    // 억 단위
    else if (char === '억') {
      if (currentNumber > 0) {
        currentSection += currentNumber
        currentNumber = 0
      }
      if (currentSection === 0) currentSection = 1
      result += currentSection * 100000000
      currentSection = 0
    }
    // 조 단위
    else if (char === '조') {
      if (currentNumber > 0) {
        currentSection += currentNumber
        currentNumber = 0
      }
      if (currentSection === 0) currentSection = 1
      result += currentSection * 1000000000000
      currentSection = 0
    }
  }

  // 남은 값 처리
  if (currentNumber > 0) {
    currentSection += currentNumber
  }
  result += currentSection

  return result > 0 ? result : null
}

/**
 * 숫자를 한글 금액으로 변환
 * 예: 85300000 -> "팔천오백삼십만"
 */
export function numberToKorean(num: number): string {
  if (num === 0) return '영'

  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
  const smallUnits = ['', '십', '백', '천']
  const bigUnits = ['', '만', '억', '조']

  let result = ''
  let unitIndex = 0

  while (num > 0) {
    const section = num % 10000
    if (section > 0) {
      let sectionStr = ''
      let tempSection = section
      let smallUnitIndex = 0

      while (tempSection > 0) {
        const digit = tempSection % 10
        if (digit > 0) {
          if (smallUnitIndex === 0) {
            sectionStr = digits[digit] + sectionStr
          } else {
            // 십/백/천 앞의 '일'은 생략 가능하지만 명확성을 위해 포함
            sectionStr = (digit === 1 ? '' : digits[digit]) + smallUnits[smallUnitIndex] + sectionStr
          }
        }
        tempSection = Math.floor(tempSection / 10)
        smallUnitIndex++
      }

      result = sectionStr + bigUnits[unitIndex] + result
    }
    num = Math.floor(num / 10000)
    unitIndex++
  }

  return result
}

/**
 * 숫자를 포맷팅 (콤마 추가)
 * 예: 85300000 -> "85,300,000"
 */
export function formatNumberWithComma(num: number): string {
  return num.toLocaleString('ko-KR')
}

/**
 * 계약금액 문자열에서 한글 금액 추출
 * 예: "팔천오백삼십만원(300,000원, VAT 별도)" -> "팔천오백삼십만원"
 */
export function extractKoreanAmount(amountStr: string): string | null {
  // 괄호 앞 부분 추출
  const match = amountStr.match(/^([^(]+)/)
  if (match) {
    return match[1].trim()
  }
  return null
}

/**
 * 계약금액 문자열에서 숫자 금액 추출
 * 예: "팔천오백삼십만원(300,000원, VAT 별도)" -> 300000
 */
export function extractNumericAmount(amountStr: string): number | null {
  // 괄호 안의 숫자 추출
  const match = amountStr.match(/\(([\d,]+)원?/)
  if (match) {
    return parseInt(match[1].replace(/,/g, ''), 10)
  }
  return null
}

/**
 * 계약금액 검증 및 수정
 * 한글 금액과 숫자 금액이 불일치하면 한글 금액 기준으로 수정
 */
export function validateAndFixContractAmount(amountStr: string): string {
  if (!amountStr || amountStr === '명시되지 않음' || amountStr === 'null') {
    return amountStr
  }

  const koreanPart = extractKoreanAmount(amountStr)
  if (!koreanPart) return amountStr

  const koreanNumber = koreanToNumber(koreanPart)
  if (!koreanNumber) return amountStr

  const numericPart = extractNumericAmount(amountStr)

  // 불일치 확인
  if (numericPart && numericPart !== koreanNumber) {
    console.log(`금액 불일치 수정: ${numericPart} -> ${koreanNumber}`)

    // VAT 정보 추출
    const vatMatch = amountStr.match(/VAT\s*(별도|포함)/)
    const vatInfo = vatMatch ? `, VAT ${vatMatch[1]}` : ''

    // 수정된 금액 문자열 반환
    return `${koreanPart}(${formatNumberWithComma(koreanNumber)}원${vatInfo})`
  }

  // 숫자 부분이 없는 경우 추가
  if (!numericPart) {
    const vatMatch = amountStr.match(/VAT\s*(별도|포함)/)
    const vatInfo = vatMatch ? `, VAT ${vatMatch[1]}` : ''
    return `${koreanPart}(${formatNumberWithComma(koreanNumber)}원${vatInfo})`
  }

  return amountStr
}
