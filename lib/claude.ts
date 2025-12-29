import Anthropic from '@anthropic-ai/sdk'
import { DocumentType } from '@/app/page'
import { documentTemplates, documentTypeDetectionPrompt } from './templates'
import { validateAmountFields } from './amountUtils'

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

// PDF에서 직접 추출한 텍스트로 정보 추출 (이미지 변환 없이)
export async function extractFromText(
  pdfText: string,
  documentType: DocumentType
): Promise<Record<string, string | number | null>> {
  const template = documentTemplates[documentType]

  if (!template) {
    console.warn(`알 수 없는 문서 유형: ${documentType}, 계약서로 처리합니다.`)
    const defaultTemplate = documentTemplates['contract']
    return extractWithTextTemplate(pdfText, defaultTemplate)
  }

  return extractWithTextTemplate(pdfText, template)
}

// 텍스트에서 문서 유형 자동 인식
export async function detectDocumentTypeFromText(pdfText: string): Promise<DocumentType> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `다음 문서 텍스트를 분석하여 문서 유형을 판단해주세요.

문서 내용:
${pdfText.slice(0, 3000)}

${documentTypeDetectionPrompt}`,
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

  return 'contract'
}

// 텍스트 기반 템플릿 추출
async function extractWithTextTemplate(
  pdfText: string,
  template: { label: string; fields: string[]; prompt: string }
): Promise<Record<string, string | number | null>> {
  console.log('=== PDF 텍스트 기반 추출 시작 ===')
  console.log('텍스트 길이:', pdfText.length)

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `다음은 PDF 문서에서 직접 추출한 텍스트입니다. 이 텍스트를 분석하여 정보를 추출해주세요.

=== 문서 텍스트 ===
${pdfText}
=== 텍스트 끝 ===

${template.prompt}

[중요 지침]
1. 위 텍스트에서 정확히 기재된 내용만 추출하세요.
2. 금액의 경우 한글 금액(예: 육십억원)과 숫자 금액(예: 6,000,000,000원)이 있으면 반드시 둘 다 확인하여 일치하는지 검증하세요.
3. 한글 금액이 기준입니다. 한글 금액을 우선으로 추출하고, 괄호 안에 숫자를 포함하세요.
4. 문서에 명시되지 않은 정보는 null로 표시하세요.

JSON 형식으로 응답해주세요.
예시 형식: { "fieldName": "값" }`,
      },
    ],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('정보를 추출할 수 없습니다.')
  }

  console.log('=== Claude 응답 (텍스트 기반) ===')
  console.log(textContent.text)
  console.log('==================')

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      console.log('=== 파싱된 JSON (검증 전) ===')
      console.log(parsed)

      const validated = validateAmountFields(parsed)
      console.log('=== 검증된 JSON (검증 후) ===')
      console.log(validated)
      console.log('==================')
      return validated
    }
  } catch (e) {
    console.error('JSON 파싱 오류:', e)
  }

  console.log('=== 파싱 실패, 빈 객체 반환 ===')
  const emptyResult: Record<string, null> = {}
  template.fields.forEach((field) => {
    emptyResult[field] = null
  })
  return emptyResult
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

[중요 지침 - 이미지 기반 추출]
1. 이미지의 모든 텍스트를 매우 주의깊게 읽어주세요. 글자 하나하나를 정확히 확인하세요.
2. 금액 추출 시 특히 주의하세요:
   - 한글 금액(예: 육십억원)과 숫자 금액(예: 6,000,000,000원)이 모두 있으면 반드시 둘 다 확인
   - 한글 금액이 기준입니다. 한글 금액을 우선으로 추출하고, 괄호 안에 숫자를 포함하세요
   - "육십억"과 "육억"은 완전히 다른 금액입니다 (60억 vs 6억)
3. 추측하지 마세요. 문서에 실제로 보이는 내용만 추출하세요.
4. 글자가 불명확하거나 읽기 어려운 경우 null을 반환하세요.
5. 회사명, 금액, 날짜 등 핵심 정보는 여러 번 확인 후 추출하세요.

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

  // 디버깅: Claude 응답 로그
  console.log('=== Claude 응답 ===')
  console.log(textContent.text)
  console.log('==================')

  try {
    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      console.log('=== 파싱된 JSON (검증 전) ===')
      console.log(parsed)

      // 금액 필드 검증 및 교정
      const validated = validateAmountFields(parsed)
      console.log('=== 검증된 JSON (검증 후) ===')
      console.log(validated)
      console.log('==================')
      return validated
    }
  } catch (e) {
    console.error('JSON 파싱 오류:', e)
  }

  // 파싱 실패 시 빈 객체 반환
  console.log('=== 파싱 실패, 빈 객체 반환 ===')
  const emptyResult: Record<string, null> = {}
  template.fields.forEach((field) => {
    emptyResult[field] = null
  })
  return emptyResult
}
