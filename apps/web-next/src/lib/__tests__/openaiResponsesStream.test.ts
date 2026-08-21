import { describe, expect, it } from 'vitest'
import { parseSseBlock, splitSseBlocks } from '../openaiResponsesStream'

describe('splitSseBlocks', () => {
  it('splits complete blocks and keeps a trailing partial block as remainder', () => {
    const buffer = 'data: {"a":1}\n\ndata: {"b":2}\n\ndata: {"c":3'
    const { blocks, remainder } = splitSseBlocks(buffer)
    expect(blocks).toEqual(['data: {"a":1}', 'data: {"b":2}'])
    expect(remainder).toBe('data: {"c":3')
  })

  it('returns everything as remainder when there is no complete block yet', () => {
    const { blocks, remainder } = splitSseBlocks('data: {"a":1')
    expect(blocks).toEqual([])
    expect(remainder).toBe('data: {"a":1')
  })
})

describe('parseSseBlock', () => {
  it('extracts a text delta', () => {
    const block = 'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Olá"}'
    expect(parseSseBlock(block)).toEqual({ type: 'delta', text: 'Olá' })
  })

  it('extracts usage from a completed event', () => {
    const block = 'data: {"type":"response.completed","response":{"usage":{"total_tokens":42}}}'
    expect(parseSseBlock(block)).toEqual({ type: 'completed', usage: { total_tokens: 42 } })
  })

  it('extracts the error message from a failed event', () => {
    const block = 'data: {"type":"response.failed","response":{"error":{"message":"limite excedido"}}}'
    expect(parseSseBlock(block)).toEqual({ type: 'failed', message: 'limite excedido' })
  })

  it('ignores [DONE] sentinel', () => {
    expect(parseSseBlock('data: [DONE]')).toEqual({ type: 'ignored' })
  })

  it('ignores a block without a data line', () => {
    expect(parseSseBlock('event: ping')).toEqual({ type: 'ignored' })
  })

  it('ignores unrecognized event types instead of throwing', () => {
    const block = 'data: {"type":"response.output_item.added"}'
    expect(parseSseBlock(block)).toEqual({ type: 'ignored' })
  })

  it('ignores malformed JSON instead of throwing', () => {
    expect(parseSseBlock('data: not-json')).toEqual({ type: 'ignored' })
  })
})
