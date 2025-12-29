import Anthropic from '@anthropic-ai/sdk'
import { DocumentType } from '@/app/page'
import { documentTemplates, documentTypeDetectionPrompt } from './templates'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// 문서 유형 자동 인식
export async function detectDocumentType(base64Image: string, mediaType: string): Promise<DocumentType> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64Image,
            },
          },
          {
            type: 'text',
            text: documentTypeDetectionPrompt,
          },
        ],
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('문서 유형을 인식할 수 없습니다.')
  }

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return parsed.documentType as DocumentType
    }
  } catch {
    // JSON 파싱 실패 시 텍스트에서 직접 추출
    const types: DocumentType[] = [
      'contract', 'taxInvoice', 'tradingStatement', 'accountingSlip',
      'bankStatement', 'assetDisposal', 'withholdingTax', 'estimate'
    ]
    for (const type of types) {
      if (textContent.text.includes(type)) {
        return type
      }
    }
  }

  return 'contract' // 기본값
}

// 단일 이미지에서 정보 추출
export async function extractDocumentData(
  base64Image: string,
  mediaType: string,
  documentType: DocumentType
): Promise<Record<string, string | number | null>> {
  const template = documentTemplates[documentType]

  // 템플릿이 없으면 기본값(계약서) 사용
  if (!template) {
    console.warn(`알 수 없는 문서 유형: ${documentType}, 계약서로 처리합니다.`)
    const defaultTemplate = documentTemplates['contract']
    return extractWithTemplate([{ base64: base64Image, mediaType }], defaultTemplate)
  }

  return extractWithTemplate([{ base64: base64Image, mediaType }], template)
}

// 여러 이미지에서 정보 추출 (모든 페이지를 한 번에 전송)
export async function extractFromMultipleImages(
  images: { base64: string; mediaType: string }[],
  documentType: DocumentType
): Promise<Record<string, string | number | null>> {
  const template = documentTemplates[documentType]

  if (!template) {
    console.warn(`알 수 없는 문서 유형: ${documentType}, 계약서로 처리합니다.`)
    const defaultTemplate = documentTemplates['contract']
    return extractWithTemplate(images, defaultTemplate)
  }

  return extractWithTemplate(images, template)
}

// 템플릿으로 추출 (여러 이미지 지원)
async function extractWithTemplate(
  images: { base64: string; mediaType: string }[],
  template: { label: string; fields: string[]; prompt: string }
): Promise<Record<string, string | number | null>> {

  // 여러 이미지를 content 배열에 추가
  const contentParts: Anthropic.ContentBlockParam[] = []

  // 모든 이미지 추가
  images.forEach((img, index) => {
    contentParts.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: img.base64,
      },
    })
  })

  // 프롬프트 추가
  const pageInfo = images.length > 1 ? `\n\n[중요] 위 ${images.length}개 이미지는 동일한 문서의 연속된 페이지입니다. 모든 페이지를 종합하여 정보를 추출해주세요.` : ''

  contentParts.push({
    type: 'text',
    text: `${template.prompt}${pageInfo}

JSON 형식으로 응답해주세요. 찾을 수 없는 정보는 null로 표시하세요.
예시 형식: { "fieldName": "값" }`,
  })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: contentParts,
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('정보를 추출할 수 없습니다.')
  }

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.error('JSON 파싱 오류:', e)
  }

  // 파싱 실패 시 빈 객체 반환
  const emptyResult: Record<string, null> = {}
  template.fields.forEach((field) => {
    emptyResult[field] = null
  })
  return emptyResult
}
