import { NextRequest, NextResponse } from 'next/server'
import { detectDocumentType, extractFromMultipleImages } from '@/lib/claude'
import { DocumentType } from '@/app/page'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const fileCount = parseInt(formData.get('fileCount') as string) || 0
    const documentTypeParam = formData.get('documentType') as DocumentType | null

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

    if (files.length === 0) {
      return NextResponse.json(
        { error: '파일이 필요합니다.' },
        { status: 400 }
      )
    }

    // 모든 파일을 base64로 변환
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
      if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
        return NextResponse.json(
          { error: `지원하지 않는 파일 형식입니다: ${file.name} (PNG, JPG, GIF, WEBP 지원)` },
          { status: 400 }
        )
      }

      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      images.push({
        base64: buffer.toString('base64'),
        mediaType: file.type,
      })
    }

    // 문서 유형 결정 (첫 번째 이미지로 판단)
    let documentType: DocumentType
    if (documentTypeParam) {
      documentType = documentTypeParam
    } else {
      documentType = await detectDocumentType(images[0].base64, images[0].mediaType)
    }

    // 모든 이미지를 한 번에 Claude에 전송하여 정보 추출
    const fields = await extractFromMultipleImages(images, documentType)

    return NextResponse.json({
      documentType,
      fields,
      pageCount: images.length,
    })
  } catch (error) {
    console.error('추출 오류:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '추출 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
