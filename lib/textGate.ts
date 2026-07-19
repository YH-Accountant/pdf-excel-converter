// 텍스트 추출 게이트 판정 (단일 기준)
//
// PDF/이미지 처리 파이프라인에는 "다음 단계로 넘어갈지"를 결정하는 게이트가 두 곳 있다.
//  - 게이트 A: pdfjs로 뽑은 텍스트가 충분하면 텍스트 PDF로 보고 OCR·AI Vision 생략
//  - 게이트 B: OCR 결과가 충분하면 그 텍스트를 채택하고 AI Vision 생략
// 두 게이트가 서로 다른 경계(>=50 vs >50)와 다른 계산법(공백 제외 vs 공백 포함)을
// 쓰고 있어, 하나의 기준으로 통일한다.

// "의미 있는 텍스트"로 인정하는 최소 글자 수 (공백 제외)
export const MIN_TEXT_LENGTH = 50

/**
 * 공백을 제외한 글자 수가 기준(MIN_TEXT_LENGTH) 이상인지 판정한다.
 * 게이트 A(PDF 텍스트)와 게이트 B(OCR 결과) 모두 이 함수를 사용한다.
 */
export function hasEnoughText(text: string | null | undefined): boolean {
  return (text ?? '').replace(/\s/g, '').length >= MIN_TEXT_LENGTH
}
