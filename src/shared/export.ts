export type ExportFormat = 'html' | 'pdf' | 'png' | 'jpeg' | 'docx'
export type ExportProgressStage =
  | 'resolving'
  | 'preparing'
  | 'rendering'
  | 'compositing'
  | 'writing'
  | 'done'

export type ExportImageFormat = 'png' | 'jpeg'
export type ExportPdfPageSize = 'A4' | 'Letter'

export interface ExportPreferences {
  includeCustomCss: boolean
  imageFormat: ExportImageFormat
  imageScale: number
  pdfPageSize: ExportPdfPageSize
  defaultFormat: ExportFormat
}

export interface ExportDocumentInput {
  title: string
  content: string
  sourcePath?: string
  format: ExportFormat
  includeCustomCss?: boolean
  customCss?: string
  imageFormat?: ExportImageFormat
  imageScale?: number
  pdfPageSize?: ExportPdfPageSize
}

export interface ExportDocumentResult {
  path: string
  format: ExportFormat
}

export interface ExportProgress {
  stage: ExportProgressStage
  percent: number
  message: string
}

export const exportFormatLabels: Record<ExportFormat, string> = {
  html: 'HTML',
  pdf: 'PDF',
  png: 'PNG',
  jpeg: 'JPEG',
  docx: 'Word'
}
