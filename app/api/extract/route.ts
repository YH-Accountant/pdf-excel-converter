import { NextRequest, NextResponse } from 'next/server'
import { detectDocumentType, detectDocumentTypeFromText, detectMultipleDocumentTypesFromText, extractFromMultipleImages, extractFromText, extractMultipleDocumentsFromText } from '@/lib/claude'
import { DocumentType } from '@/app/single/page'
import { validateAndFixContractAmount } from '@/lib/koreanAmount'

// 금액 필드 검증 및 수정 (계약서, 견적서)
function postProcessFields(documentType: DocumentType, fields: Record<string, any>): Record<string, any> {
  // 계약서 금액 검증
  if (documentType === 'contract' && fields.contractAmount) {
    const originalAmount = fields.contractAmount
    const fixedAmount = validateAndFixContractAmount(String(fields.contractAmount))
    if (originalAmount !== fixedAmount) {
      console.log(`[계약서 금액 자동 수정] "${originalAmount}" -> "${fixedAmount}"`)
    }
    fields.contractAmount = fixedAmount
  }

  // 견적서 금액 검증
  if (documentType === 'estimate' && fields.totalAmount) {
    const originalAmount = fields.totalAmount
    const fixedAmount = validateAndFixContractAmount(String(fields.totalAmount))
    if (originalAmount !== fixedAmount) {
      console.log(`[견적서 금액 자동 수정] "${originalAmount}" -> "${fixedAmount}"`)
    }
    fields.totalAmount = fixedAmount
  }

  return fields
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const fileCount = parseInt(formData.get('fileCount') as string) || 0
    const documentTypeParam = formData.get('documentType') as DocumentType | null
    const pdfText = formData.get('pdfText') as string | null

    // 파일 수집
    const files: File[] = []
    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`file${i}`) as File | null
      if (file) {
        files.push(file)
      }
    }

    // 단일 파일 호환성 유지
    if (files.length === 0) {
      const singleFile = formData.get('file') as File | null
      if (singleFile) {
        files.push(singleFile)
      }
    }

    if (files.length === 0 && !pdfText) {
      return NextResponse.json(
        { error: '파일이 필요합니다.' },
        { status: 400 }
      )
    }

    // PDF 텍스트가 있으면 텍스트 기반 추출 사용 (더 정확함)
    if (pdfText && pdfText.length > 100) {
      console.log('=== 텍스트 기반 추출 모드 ===')

      // 사용자가 문서 유형을 지정한 경우: 단일 문서 추출
      if (documentTypeParam) {
        let fields = await extractFromText(pdfText, documentTypeParam)
        fields = postProcessFields(documentTypeParam, fields)

        return NextResponse.json({
          documentType: documentTypeParam,
          fields,
          extractionMethod: 'text',
        })
      }

      // 문서 유형 미지정: 다중 문서 유형 감지 시도
      console.log('=== 다중 문서 유형 감지 시작 ===')
      const documentSections = await detectMultipleDocumentTypesFromText(pdfText)
      const detectedTypes = [...new Set(documentSections.map(s => s.documentType))]
      console.log('감지된 문서 유형들:', detectedTypes)

      // 여러 문서 유형이 감지된 경우: 각 유형별로 추출
      if (detectedTypes.length > 1) {
        console.log('=== 복합 증빙 PDF - 다중 추출 모드 ===')
        const multipleResults = await extractMultipleDocumentsFromText(pdfText, detectedTypes)

        // 후처리
        const processedResults = multipleResults.map(result => ({
          documentType: result.documentType,
          fields: postProcessFields(result.documentType, result.fields),
        }))

        return NextResponse.json({
          isMultipleDocuments: true,
          documents: processedResults,
          extractionMethod: 'text-multi',
        })
      }

      // 단일 문서 유형만 감지된 경우
      const documentType = detectedTypes[0] || await detectDocumentTypeFromText(pdfText)
      let fields = await extractFromText(pdfText, documentType)
      fields = postProcessFields(documentType, fields)

      return NextResponse.json({
        documentType,
        fields,
        extractionMethod: 'text',
      })
    }

    // 이미지 기반 추출 (fallback)
    console.log('=== 이미지 기반 추출 모드 ===')
    const images: { base64: string; mediaType: string }[] = []

    for (const file of files) {
      // PDF인 경우 에러 (클라이언트에서 이미지로 변환되어야 함)
      if (file.type === 'application/pdf') {
        return NextResponse.json(
          { error: 'PDF는 클라이언트에서 이미지로 자동 변환됩니다. 잠시만 기다려주세요...' },
          { status: 400 }
        )
      }

      // 이미지 타입 검증
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain'].includes(file.type)) {
        return NextResponse.json(
          { error: `지원하지 않는 파일 형식입니다: ${file.name} (PNG, JPG, GIF, WEBP 지원)` },
          { status: 400 }
        )
      }

      // text/plain은 텍스트 추출 성공한 PDF (표시용)
      if (file.type === 'text/plain') {
        continue
      }

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      images.push({
        base64: buffer.toString('base64'),
        mediaType: file.type,
      })
    }

    if (images.length === 0) {
      return NextResponse.json(
        { error: '이미지 파일이 필요합니다.' },
        { status: 400 }
      )
    }

    // 문서 유형 결정 (첫 번째 이미지로 판단)
    let documentType: DocumentType
    if (documentTypeParam) {
      documentType = documentTypeParam
    } else {
      documentType = await detectDocumentType(images[0].base64, images[0].mediaType)
    }

    // 모든 이미지를 한 번에 Claude에 전송하여 정보 추출
    let fields = await extractFromMultipleImages(images, documentType)

    // 후처리: 금액 검증 및 수정
    fields = postProcessFields(documentType, fields)

    return NextResponse.json({
      documentType,
      fields,
      pageCount: images.length,
      extractionMethod: 'image',
    })
  } catch (error) {
    console.error('추출 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '추출 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
