// PDF 페이지를 OCR용 이미지로 렌더링할 때의 스케일(배율) 계산
//
// 배경: pdf.js의 scale=1은 72 DPI 기준이다. OCR 권장 해상도는 200~300 DPI라
// A4(595×842pt)를 scale=3으로 렌더하면 약 216 DPI(2526px)로 적정하다.
// 다만 scale을 3으로 고정하면 페이지 크기가 큰 PDF는 픽셀이 불필요하게 커져
// 브라우저 canvas 메모리·전송 페이로드에 부담이 된다.
//
// 그래서 "가장 긴 변이 목표 픽셀이 되도록" 스케일을 동적으로 계산하되,
// 표준 A4의 OCR 품질(≈216 DPI)을 유지하도록 목표를 2500px로 잡는다.
// (A4 긴 변 842pt → 2500/842 ≈ 2.97배 ≈ 기존 scale=3 유지,
//  더 큰 페이지만 축소되어 메모리·페이로드를 방어)

const TARGET_LONGEST_PX = 2500 // A4에서 ≈216 DPI를 유지하는 목표 픽셀
const MIN_SCALE = 1.5          // 작은 페이지도 최소한 이만큼은 확대 (OCR 하한 방어)
const MAX_SCALE = 3.0          // 과도한 확대 상한 (메모리·페이로드 방어)

/**
 * pdf.js 페이지의 기본(scale=1) 뷰포트 크기로부터 OCR에 적합한 스케일을 계산한다.
 * @param baseWidth  scale=1 기준 페이지 너비(px)
 * @param baseHeight scale=1 기준 페이지 높이(px)
 */
export function computePdfRenderScale(baseWidth: number, baseHeight: number): number {
  const longest = Math.max(baseWidth, baseHeight)
  if (!longest || !isFinite(longest)) return MAX_SCALE
  const scale = TARGET_LONGEST_PX / longest
  return Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE)
}
