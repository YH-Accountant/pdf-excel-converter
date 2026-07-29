const PIXEL_THRESHOLD = 1_500_000  // 1.5MP: 약 130 DPI 수준, 이하면 숫자 오인식 시작
const SAMPLE_SIZE = 500             // 선명도 측정용 축소 크기 (클수록 중간 블러 감지 민감)

// Laplacian 분산 임계값. 이하면 확대 후 OCR을 시도한다.
//
// 실측 근거 (원천징수이행상황신고서를 단계별로 흐리게 만들어 브라우저에서 측정)
//   525.7 → 모든 값 정확
//   249.1 → 인원 누락 / 218.1 → 소득세 누락 / 200.7 → 인원 누락
//   112.8 → 사업자등록번호 오독(312-81-90123 → 312-81-00123)
//   ※ 218.1짜리를 2배 확대해 넣으니 누락됐던 소득세가 추출되어, 확대가 실효가 있음을 확인
// 즉 실패는 250 아래에서 시작하므로 그보다 위인 300을 기준으로 삼는다.
//
// 오탐 확인 (문서 5종의 정상 스캔을 브라우저에서 측정)
//   세금계산서 2005.9 / 이체확인증 927.4 (잉크 비율이 가장 낮은 유형) / 나머지는 그 사이
//   → 가장 낮게 나오는 유형조차 기준의 3배 이상이라 정상 스캔이 저화질로 오판되지 않는다
//
// 알려진 한계: 이 지표는 "흐린 정도"만이 아니라 "글자 밀도"도 함께 재고 있다.
//   같은 열화에서 잉크 비율 2.3%인 세금계산서와 1.1%인 이체확인증의 점수가 2.16배 차이났다.
//   잉크 비율로 나누면 편차가 1.3배까지 줄어드는 것을 확인했으나,
//   정규화한 값의 실패 임계치를 아직 측정하지 못해 이번에는 적용하지 않는다.
const BLUR_THRESHOLD = 300

function computeLaplacianVariance(img: HTMLImageElement): number {
  const scale = Math.min(1, SAMPLE_SIZE / Math.max(img.width, img.height))
  const w = Math.max(3, Math.floor(img.width * scale))
  const h = Math.max(3, Math.floor(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)

  const { data } = ctx.getImageData(0, 0, w, h)
  const gray = (i: number) =>
    0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]

  const laps: number[] = []
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const c = y * w + x
      // Laplacian 커널: 상하좌우 합 - 중심×4
      laps.push(gray(c - w) + gray(c + w) + gray(c - 1) + gray(c + 1) - 4 * gray(c))
    }
  }

  const mean = laps.reduce((s, v) => s + v, 0) / laps.length
  return laps.reduce((s, v) => s + (v - mean) ** 2, 0) / laps.length
}

export type QualityResult =
  | { isLow: true;  reason: 'resolution'; detail: string }
  | { isLow: true;  reason: 'blur';       detail: string; score: number }
  | { isLow: false;                        detail: string; score: number }

export function checkImageQuality(img: HTMLImageElement): QualityResult {
  const pixels = img.width * img.height

  if (pixels < PIXEL_THRESHOLD) {
    return {
      isLow: true,
      reason: 'resolution',
      detail: `${img.width}×${img.height} (${(pixels / 1_000_000).toFixed(2)}MP < ${PIXEL_THRESHOLD / 1_000_000}MP)`,
    }
  }

  const score = computeLaplacianVariance(img)
  if (score < BLUR_THRESHOLD) {
    return {
      isLow: true,
      reason: 'blur',
      detail: `${img.width}×${img.height}, 선명도 점수 ${score.toFixed(1)} < ${BLUR_THRESHOLD}`,
      score,
    }
  }

  return {
    isLow: false,
    detail: `${img.width}×${img.height}, 선명도 점수 ${score.toFixed(1)}`,
    score,
  }
}
