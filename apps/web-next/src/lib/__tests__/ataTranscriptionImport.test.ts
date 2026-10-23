import { describe, expect, it } from 'vitest'
import { parseTranscriptionText, readTranscriptionFile, validateTranscriptionFile } from '../ataTranscriptionImport'

describe('transcription text import', () => {
  it('preserves accents, speaker names and paragraphs in plain text', () => {
    expect(parseTranscriptionText('Assembleia.TXT', '\uFEFFMaria: Olá.\r\n\r\nJoão: Aprovação.\r\n'))
      .toBe('Maria: Olá.\n\nJoão: Aprovação.')
  })

  it('extracts Zoom VTT speech without cue numbers, timestamps or header metadata', () => {
    const vtt = 'WEBVTT\r\nKind: captions\r\nLanguage: pt\r\n\r\n1\r\n00:00:01.000 --> 00:00:04.000\r\nMaria Silva: Boa noite.\r\nVamos começar.\r\n\r\n2\r\n00:00:04.500 --> 00:00:08.000\r\nJoão: As contas foram aprovadas.\r\n'
    expect(parseTranscriptionText('zoom.vtt', vtt))
      .toBe('Maria Silva: Boa noite.\nVamos começar.\n\nJoão: As contas foram aprovadas.')
  })

  it('keeps voice names and decodes WebVTT entities without interpreting HTML', () => {
    const vtt = 'WEBVTT\n\ncue-a\n00:01.000 --> 00:04.000 align:start position:0%\n<v Maria Silva><b>Água &amp; luz</b>: R$ 100 &lt; R$ 200.</v>\n\n00:04.000 --> 00:05.000\n<v João>Sim<00:04.500>, aprovado.</v>'
    expect(parseTranscriptionText('zoom.vtt', vtt))
      .toBe('Maria Silva: Água & luz: R$ 100 < R$ 200.\n\nJoão: Sim, aprovado.')
  })

  it('ignores comment, style and region blocks while preserving repeated speech', () => {
    const vtt = 'WEBVTT\n\nNOTE descrição\nComentário privado\n\nSTYLE\n::cue { color: red; }\n\nREGION\nid:main\n\n1\n00:00:00.000 --> 00:00:01.000\nSim.\n\n2\n00:00:01.000 --> 00:00:02.000\nSim.'
    expect(parseTranscriptionText('zoom.vtt', vtt)).toBe('Sim.\n\nSim.')
  })

  it('ignores a NOTE block whose comment starts on the following line', () => {
    expect(parseTranscriptionText('zoom.vtt', 'WEBVTT\n\nNOTE\nComentário técnico\n\n00:01.000 --> 00:02.000\nMaria: Boa noite.'))
      .toBe('Maria: Boa noite.')
  })

  it('reads UTF-8 files and reports invalid encodings before sending any content', async () => {
    await expect(readTranscriptionFile(new File(['Maria: Aprovação.'], 'ata.txt'))).resolves.toBe('Maria: Aprovação.')
    await expect(readTranscriptionFile(new File([new Uint8Array([0xff, 0xfe, 0x61, 0x00])], 'ata.txt'))).rejects.toThrow(/UTF-8/)
  })

  it.each([
    ['empty text', 'ata.txt', '  \n\t'],
    ['binary content', 'ata.txt', 'PK\u0000\u0001dados'],
    ['missing VTT header', 'ata.vtt', 'Texto qualquer'],
    ['no VTT speech', 'ata.vtt', 'WEBVTT\n\nNOTE apenas metadados'],
    ['broken VTT timestamp', 'ata.vtt', 'WEBVTT\n\n1\n00:xx.000 --> 00:05.000\nFala perdida.'],
  ])('rejects %s', (_, name, content) => {
    expect(() => parseTranscriptionText(name, content)).toThrow()
  })

  it('refuses to silently drop malformed cues from a partial VTT', () => {
    expect(() => parseTranscriptionText('ata.vtt', 'WEBVTT\n\n00:01.000 --> 00:02.000\nPrimeira fala.\n\n2\n00:xx.000 --> 00:03.000\nSegunda fala.')).toThrow(/VTT/)
  })

  it('rejects unsupported, empty and oversized files before reading them', () => {
    expect(() => validateTranscriptionFile('ata.pdf', 10)).toThrow(/TXT.*VTT/)
    expect(() => validateTranscriptionFile('ata.txt', 0)).toThrow(/vazio/)
    expect(() => validateTranscriptionFile('ata.vtt', 5 * 1024 * 1024 + 1)).toThrow(/5 MB/)
    expect(() => validateTranscriptionFile('ata.VTT', 5 * 1024 * 1024)).not.toThrow()
  })
})
