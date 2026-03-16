import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from 'pdf-lib'
import type { Balancete } from '@/repositories/balancetesRepo.supabase'

interface ProtocoloData {
  numeroProtocolo: number
  balancetes: Balancete[]
  dataEnvio: string
}

interface ProtocoloLine {
  condominio: string
  competencia: string
  parte: string
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function getRomanNumeral(num: number): string {
  const romanNumerals: [number, string][] = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ]
  let result = ''
  for (const [value, numeral] of romanNumerals) {
    while (num >= value) {
      result += numeral
      num -= value
    }
  }
  return result
}

// Expande balancetes em linhas (uma linha por volume)
function expandBalancetesToLines(balancetes: Balancete[]): ProtocoloLine[] {
  // Ordenar balancetes por competência crescente
  const sortedBalancetes = [...balancetes].sort((a, b) => {
    const compA = a.competencia || ''
    const compB = b.competencia || ''
    return compA.localeCompare(compB)
  })
  
  const lines: ProtocoloLine[] = []
  
  for (const balancete of sortedBalancetes) {
    const volumes = balancete.volumes || 1
    
    if (volumes === 1) {
      lines.push({
        condominio: balancete.condominium_name || '',
        competencia: balancete.competencia || '',
        parte: '',
      })
    } else {
      for (let i = 1; i <= volumes; i++) {
        lines.push({
          condominio: balancete.condominium_name || '',
          competencia: balancete.competencia || '',
          parte: `Parte ${getRomanNumeral(i)}`,
        })
      }
    }
  }
  
  return lines
}

// Configurações da página A4
const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const MARGIN = 50
const CONTENT_WIDTH = PAGE_WIDTH - (MARGIN * 2)

// Larguras das colunas
const COL_WIDTHS = {
  numero: 30,
  condominio: 280,
  competencia: 90,
  parte: CONTENT_WIDTH - 30 - 280 - 90,
}

interface PageContext {
  pdfDoc: PDFDocument
  helvetica: PDFFont
  helveticaBold: PDFFont
  protocoloNumero: string
  via: string
}

async function drawHeader(
  page: PDFPage,
  ctx: PageContext,
  dataEnvio: string,
  logoImage: Awaited<ReturnType<PDFDocument['embedPng']>> | null
): Promise<number> {
  let yPosition = PAGE_HEIGHT - MARGIN
  let logoHeight = 0
  
  // Logo no canto superior direito
  if (logoImage) {
    const maxWidth = 100
    const maxHeight = 60
    const logoAspect = logoImage.width / logoImage.height
    let logoWidth = maxWidth
    logoHeight = logoWidth / logoAspect
    
    if (logoHeight > maxHeight) {
      logoHeight = maxHeight
      logoWidth = logoHeight * logoAspect
    }
    
    page.drawImage(logoImage, {
      x: PAGE_WIDTH - MARGIN - logoWidth,
      y: yPosition - logoHeight,
      width: logoWidth,
      height: logoHeight,
    })
  }
  
  // Título: PROTOCOLO DE ENVIO DE BALANCETES #001
  page.drawText(`PROTOCOLO DE ENVIO DE BALANCETES #${ctx.protocoloNumero}`, {
    x: MARGIN,
    y: yPosition - (logoHeight > 0 ? (logoHeight / 2) - 7 : 0),
    size: 14,
    font: ctx.helveticaBold,
    color: rgb(0.1, 0.1, 0.1),
  })
  
  // Ajustar posição Y após o logo/título
  if (logoHeight > 0) {
    yPosition -= logoHeight + 25
  } else {
    yPosition -= 25
  }
  
  // Data de envio
  page.drawText(`Data de Envio: ${formatDate(dataEnvio)}`, {
    x: MARGIN,
    y: yPosition,
    size: 10,
    font: ctx.helvetica,
    color: rgb(0.3, 0.3, 0.3),
  })
  
  // Via (EURO ou CONDOMÍNIO) no canto direito
  const viaText = `Via: ${ctx.via}`
  const viaWidth = ctx.helveticaBold.widthOfTextAtSize(viaText, 10)
  page.drawText(viaText, {
    x: PAGE_WIDTH - MARGIN - viaWidth,
    y: yPosition,
    size: 10,
    font: ctx.helveticaBold,
    color: rgb(0.3, 0.3, 0.3),
  })
  yPosition -= 25
  
  // Linha separadora
  page.drawLine({
    start: { x: MARGIN, y: yPosition },
    end: { x: PAGE_WIDTH - MARGIN, y: yPosition },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  })
  yPosition -= 20
  
  return yPosition
}

function drawTableHeader(page: PDFPage, yPosition: number, ctx: PageContext): number {
  // Background do cabeçalho
  page.drawRectangle({
    x: MARGIN,
    y: yPosition - 5,
    width: CONTENT_WIDTH,
    height: 20,
    color: rgb(0.95, 0.95, 0.95),
  })
  
  let xPos = MARGIN + 5
  
  page.drawText('#', {
    x: xPos,
    y: yPosition,
    size: 9,
    font: ctx.helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  })
  xPos += COL_WIDTHS.numero
  
  page.drawText('CONDOMÍNIO', {
    x: xPos,
    y: yPosition,
    size: 9,
    font: ctx.helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  })
  xPos += COL_WIDTHS.condominio
  
  page.drawText('COMPETÊNCIA', {
    x: xPos,
    y: yPosition,
    size: 9,
    font: ctx.helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  })
  xPos += COL_WIDTHS.competencia
  
  page.drawText('PARTE', {
    x: xPos,
    y: yPosition,
    size: 9,
    font: ctx.helveticaBold,
    color: rgb(0.2, 0.2, 0.2),
  })
  
  return yPosition - 22
}

function drawTableRow(
  page: PDFPage,
  yPosition: number,
  line: ProtocoloLine,
  index: number,
  ctx: PageContext
): void {
  // Linha alternada
  if (index % 2 === 1) {
    page.drawRectangle({
      x: MARGIN,
      y: yPosition - 5,
      width: CONTENT_WIDTH,
      height: 18,
      color: rgb(0.98, 0.98, 0.98),
    })
  }
  
  let xPos = MARGIN + 5
  
  // Número
  page.drawText(String(index + 1), {
    x: xPos,
    y: yPosition,
    size: 9,
    font: ctx.helvetica,
    color: rgb(0.4, 0.4, 0.4),
  })
  xPos += COL_WIDTHS.numero
  
  // Condomínio (truncar se muito longo)
  const condominioText = line.condominio.substring(0, 45)
  page.drawText(condominioText, {
    x: xPos,
    y: yPosition,
    size: 9,
    font: ctx.helvetica,
    color: rgb(0.1, 0.1, 0.1),
  })
  xPos += COL_WIDTHS.condominio
  
  // Competência
  page.drawText(line.competencia, {
    x: xPos,
    y: yPosition,
    size: 9,
    font: ctx.helvetica,
    color: rgb(0.1, 0.1, 0.1),
  })
  xPos += COL_WIDTHS.competencia
  
  // Parte
  page.drawText(line.parte, {
    x: xPos,
    y: yPosition,
    size: 9,
    font: ctx.helvetica,
    color: rgb(0.4, 0.4, 0.4),
  })
}

function drawFooter(page: PDFPage, ctx: PageContext): void {
  const footerY = MARGIN + 80
  
  // Linha separadora do rodapé
  page.drawLine({
    start: { x: MARGIN, y: footerY + 50 },
    end: { x: PAGE_WIDTH - MARGIN, y: footerY + 50 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  })
  
  // Campo de assinatura
  page.drawText('Recebido por:', {
    x: MARGIN,
    y: footerY + 15,
    size: 9,
    font: ctx.helvetica,
    color: rgb(0.3, 0.3, 0.3),
  })
  
  // Linha para assinatura
  page.drawLine({
    start: { x: MARGIN + 70, y: footerY + 15 },
    end: { x: MARGIN + 250, y: footerY + 15 },
    thickness: 0.5,
    color: rgb(0.5, 0.5, 0.5),
  })
  
  // Data de recebimento
  page.drawText('Data:', {
    x: MARGIN + 280,
    y: footerY + 15,
    size: 9,
    font: ctx.helvetica,
    color: rgb(0.3, 0.3, 0.3),
  })
  
  // Linha para data
  page.drawLine({
    start: { x: MARGIN + 310, y: footerY + 15 },
    end: { x: MARGIN + 400, y: footerY + 15 },
    thickness: 0.5,
    color: rgb(0.5, 0.5, 0.5),
  })
  
  // Texto de rodapé
  page.drawText('Este documento comprova o envio dos balancetes listados acima.', {
    x: MARGIN,
    y: footerY - 5,
    size: 8,
    font: ctx.helvetica,
    color: rgb(0.5, 0.5, 0.5),
  })
}

async function generateVia(
  pdfDoc: PDFDocument,
  data: ProtocoloData,
  via: string,
  logoImage: Awaited<ReturnType<PDFDocument['embedPng']>> | null
): Promise<void> {
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  const ctx: PageContext = {
    pdfDoc,
    helvetica,
    helveticaBold,
    protocoloNumero: String(data.numeroProtocolo).padStart(3, '0'),
    via,
  }
  
  const lines = expandBalancetesToLines(data.balancetes)
  
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  let yPosition = await drawHeader(page, ctx, data.dataEnvio, logoImage)
  yPosition = drawTableHeader(page, yPosition, ctx)
  
  for (let i = 0; i < lines.length; i++) {
    // Verificar se precisa de nova página
    if (yPosition < MARGIN + 100) {
      drawFooter(page, ctx)
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      yPosition = await drawHeader(page, ctx, data.dataEnvio, logoImage)
      yPosition = drawTableHeader(page, yPosition, ctx)
    }
    
    drawTableRow(page, yPosition, lines[i], i, ctx)
    yPosition -= 18
  }
  
  drawFooter(page, ctx)
}

export async function generateProtocoloPDF(data: ProtocoloData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  
  // Tentar carregar o logo da empresa
  let logoImage: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null
  try {
    const logoResponse = await fetch('/assets/company-logo.png')
    if (logoResponse.ok) {
      const logoBytes = await logoResponse.arrayBuffer()
      logoImage = await pdfDoc.embedPng(logoBytes)
    }
  } catch {
    // Logo não encontrado, continua sem ele
  }
  
  // Gerar duas vias
  await generateVia(pdfDoc, data, 'EURO', logoImage)
  await generateVia(pdfDoc, data, 'CONDOMÍNIO', logoImage)
  
  return await pdfDoc.save()
}

export function downloadPDF(pdfBytes: Uint8Array, filename: string): void {
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}
