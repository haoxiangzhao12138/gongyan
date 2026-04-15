import { describe, it, expect } from 'vitest'
import { PLATFORM_LABELS, PLATFORM_OPTIONS, ACTION_PRESETS } from './constants'
import type { HelpLinkPlatform } from '@/types/database'

describe('constants', () => {
  const allPlatforms: HelpLinkPlatform[] = [
    'github', 'huggingface', 'alphaxiv', 'zhihu',
    'xiaohongshu', 'wechat', 'bilibili', 'twitter', 'other',
  ]

  it('PLATFORM_LABELS has entries for all HelpLinkPlatform values', () => {
    for (const platform of allPlatforms) {
      expect(PLATFORM_LABELS[platform]).toBeDefined()
      expect(typeof PLATFORM_LABELS[platform]).toBe('string')
    }
  })

  it('PLATFORM_OPTIONS includes all platforms', () => {
    const optionValues = PLATFORM_OPTIONS.map((o) => o.value)
    for (const platform of allPlatforms) {
      expect(optionValues).toContain(platform)
    }
  })

  it('ACTION_PRESETS has entries for all platforms', () => {
    for (const platform of allPlatforms) {
      expect(ACTION_PRESETS[platform]).toBeDefined()
      expect(typeof ACTION_PRESETS[platform]).toBe('string')
    }
  })

  it('AlphaXiv platform exists in labels', () => {
    expect(PLATFORM_LABELS['alphaxiv']).toBe('AlphaXiv')
  })

  it('HuggingFace action preset is "点 Upvote"', () => {
    expect(ACTION_PRESETS['huggingface']).toBe('点 Upvote')
  })

  it('AlphaXiv action preset is "点赞"', () => {
    expect(ACTION_PRESETS['alphaxiv']).toBe('点赞')
  })
})
