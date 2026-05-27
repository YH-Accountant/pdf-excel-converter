import vision from '@google-cloud/vision'

// Google Cloud Vision 클라이언트 생성
const credentials = process.env.GOOGLE_CREDENTIALS_JSON
  ? JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON)
  : undefined

const client = new vision.ImageAnnotatorClient(
  credentials ? { credentials } : { keyFilename: 'google-credentials.json' }
)


/**
 * Base64 이미지에서 텍스트 추출 (Google Vision OCR)
 */
export async function extractTextFromImage(base64Image: string): Promise<string> {
  try {
    const imageBuffer = Buffer.from(base64Image, 'base64')

    const [result] = await client.textDetection({
      image: { content: imageBuffer },
    })

    const detections = result.textAnnotations
    if (!detections || detections.length === 0) {
      console.log('Google Vision: 텍스트를 찾을 수 없습니다.')
      return ''
    }

    const fullText = detections[0].description || ''
    console.log('Google Vision OCR 결과 (앞 500자):', fullText.slice(0, 500))

    return fullText
  } catch (error) {
    console.error('Google Vision OCR 오류:', error)
    throw error
  }
}

/**
 * 여러 이미지에서 텍스트 추출 (PDF의 여러 페이지)
 */
export async function extractTextFromMultipleImages(
  images: { base64: string; mediaType: string }[]
): Promise<string> {
  const textParts: string[] = []

  for (let i = 0; i < images.length; i++) {
    console.log('Google Vision OCR: 페이지 ' + (i + 1) + '/' + images.length + ' 처리 중...')
    const text = await extractTextFromImage(images[i].base64)
    if (text) {
      textParts.push('=== 페이지 ' + (i + 1) + ' ===\n' + text)
    }
  }

  return textParts.join('\n\n')
}

/**
 * 문서 텍스트 감지 (더 정확한 문서 OCR)
 */
export async function extractDocumentText(base64Image: string): Promise<string> {
  try {
    const imageBuffer = Buffer.from(base64Image, 'base64')

    const [result] = await client.documentTextDetection({
      image: { content: imageBuffer },
    })

    const fullTextAnnotation = result.fullTextAnnotation
    if (!fullTextAnnotation) {
      console.log('Google Vision Document: 텍스트를 찾을 수 없습니다.')
      return ''
    }

    const fullText = fullTextAnnotation.text || ''
    console.log('Google Vision Document OCR 결과 (앞 500자):', fullText.slice(0, 500))

    return fullText
  } catch (error) {
    console.error('Google Vision Document OCR 오류:', error)
    throw error
  }
}
