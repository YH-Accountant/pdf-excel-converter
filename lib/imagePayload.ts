// OCR로 보낼 이미지의 전송 크기 관리
//
// 배경: 서버 요청 본문에는 크기 한도가 있고(약 4.5MB), 이를 넘으면 413으로 실패한다.
// 저화질 이미지를 2배 확대한 뒤 무손실(PNG)로 인코딩하면 이 한도를 쉽게 넘는다.
//
// 실측 (원천징수이행상황신고서에 스캐너 노이즈를 넣어 측정, base64 기준)
//   200 DPI: PNG 8.26MB / JPEG(q0.92) 0.92MB
//   300 DPI: PNG 18.46MB / JPEG 1.99MB
//   400 DPI: PNG 32.69MB / JPEG 3.47MB
//   600 DPI: PNG 73.23MB / JPEG 7.60MB
// 노이즈가 있는 스캔본은 PNG가 거의 압축되지 않아 200 DPI만 되어도 한도를 넘는다.
// 반면 JPEG는 400 DPI까지 여유가 있다.
//
// 그래서 무조건 JPEG로 바꾸지 않고, 한도를 넘을 때만 단계적으로 낮춘다.
// (원본이 한도 안에 들어오면 무손실 그대로 보내는 것이 OCR에 가장 유리하다)

// 요청 본문 한도(4.5MB) 대비 여유를 둔 전송 예산
export const MAX_PAYLOAD_BASE64_BYTES = 3_000_000

// canvas 면적 상한. 브라우저(특히 Safari)는 캔버스가 너무 크면 빈 이미지를 반환한다.
export const MAX_CANVAS_PIXELS = 16_000_000

// 저화질일 때 노리는 확대 배율
const UPSCALE_FACTOR = 2

/**
 * 저화질 이미지를 몇 배로 확대할지 계산한다.
 * 캔버스 면적 상한을 넘지 않는 선에서 최대 UPSCALE_FACTOR까지 키운다.
 * 1 이하가 나오면 이미 충분히 크다는 뜻이므로 확대하지 않는다.
 */
export function computeUpscaleFactor(width: number, height: number): number {
  // 음수끼리 곱하면 양수가 되므로 각 변을 따로 검사한다
  if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) return 1
  return Math.min(UPSCALE_FACTOR, Math.sqrt(MAX_CANVAS_PIXELS / (width * height)))
}

/**
 * base64 문자열이 나타내는 실제 바이트 수.
 * base64는 3바이트를 4글자로 표현하므로 길이의 3/4이고, 끝의 '=' 패딩은 뺀다.
 */
export function base64ByteLength(base64: string): number {
  if (!base64) return 0
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

/**
 * 전송 예산을 넘는지 판정한다.
 */
export function exceedsPayloadBudget(base64: string): boolean {
  return base64ByteLength(base64) > MAX_PAYLOAD_BASE64_BYTES
}

// 예산을 넘을 때 순서대로 시도할 인코딩 단계.
// 품질을 먼저 낮추고, 그래도 안 되면 해상도를 줄인다.
// (OCR 권장 해상도는 200~300 DPI이므로 축소에도 여유가 있다)
export const PAYLOAD_FALLBACKS: { quality: number; scale: number }[] = [
  { quality: 0.92, scale: 1 },
  { quality: 0.8, scale: 1 },
  { quality: 0.8, scale: 0.75 },
  { quality: 0.7, scale: 0.6 },
]
