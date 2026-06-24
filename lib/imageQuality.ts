const PIXEL_THRESHOLD = 1_500_000  // 1.5MP: 약 130 DPI 수준, 이하면 숫자 오인식 시작
const BLUR_THRESHOLD = 200          // Laplacian 분산 임계값, 이하면 중간 흐릿 수준
const SAMPLE_SIZE = 500             // 선명도 측정용 축소 크기 (클수록 중간 블러 감지 민감)

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
