import {
  applyCanvasActionsInputSchema,
  createImageVersionInputSchema,
  importImageAssetInputSchema,
  importImageFromUrlInputSchema,
  prepareSkillRunInputSchema,
  recommendCanvasSkillsInputSchema,
  submitSkillRequestInputSchema,
  updateSkillRequestInputSchema,
  watchSkillRequestsInputSchema
} from '@ai-canvas/shared'
import { describe, expect, it } from 'vitest'

describe('canvas MVP contract schemas', () => {
  it('parses local image imports with safe defaults', () => {
    const parsed = importImageAssetInputSchema.parse({
      inputPath: '/tmp/example.png'
    })

    expect(parsed.source).toBe('upload')
    expect(parsed.placement).toBe('selection_right')
    expect(parsed.selectAfterCreate).toBe(true)
  })

  it('parses URL imports and rejects invalid URLs', () => {
    expect(
      importImageFromUrlInputSchema.parse({
        url: 'https://example.com/image.webp'
      }).title
    ).toBe('URL 导入图片')

    expect(() =>
      importImageFromUrlInputSchema.parse({
        url: 'not-a-url'
      })
    ).toThrow()
  })

  it('parses canvas action batches', () => {
    const parsed = applyCanvasActionsInputSchema.parse({
      actions: [
        {
          id: 'action_1',
          type: 'place_note',
          payload: {
            text: '策略说明',
            x: 100,
            y: 120
          }
        }
      ]
    })

    expect(parsed.actions).toHaveLength(1)
    expect(parsed.actions[0].type).toBe('place_note')
  })

  it('parses image version sizing overrides', () => {
    const parsed = createImageVersionInputSchema.parse({
      sourceShapeId: 'shape:source',
      imagePath: '/tmp/generated.png',
      x: 900,
      y: 120,
      w: 720,
      h: 960,
      skillRunId: 'skillrun_123'
    })

    expect(parsed.placement).toBe('right')
    expect(parsed.x).toBe(900)
    expect(parsed.y).toBe(120)
    expect(parsed.w).toBe(720)
    expect(parsed.h).toBe(960)
    expect(parsed.skillRunId).toBe('skillrun_123')
  })

  it('parses Skill recommendation and run inputs', () => {
    expect(
      recommendCanvasSkillsInputSchema.parse({
        userRequest: '做成小红书封面'
      }).maxResults
    ).toBe(5)

    expect(
      prepareSkillRunInputSchema.parse({
        skillId: 'xiaohongshu-cover'
      }).selectionMode
    ).toBe('current')
  })

  it('parses executable Skill request queue inputs', () => {
    expect(
      submitSkillRequestInputSchema.parse({
        skillId: 'xiaohongshu-cover',
        brief: {
          title: '高级感妆容',
          titleStyle: '杂志感'
        },
        inputDataUrl: 'data:image/png;base64,AAAA',
        inputTitle: 'plain-canvas-image.png'
      }).selectionMode
    ).toBe('current')

    expect(
      submitSkillRequestInputSchema.parse({
        skillId: 'product-marketing-set',
        brief: {
          platform: 'amazon_listing',
          productName: '无线降噪耳机',
          targetAudience: '通勤白领',
          sellingPoints: '40 小时续航；轻量佩戴；通话降噪',
          imageCount: '5'
        }
      }).brief?.platform
    ).toBe('amazon_listing')

    expect(
      submitSkillRequestInputSchema.parse({
        skillId: 'cross-platform-adapt',
        brief: {
          campaignGoal: '同一张产品图适配多个平台发布',
          platforms: ['wechat-official-account', 'twitter-article-cover'],
          contentKind: '产品图片',
          preserve: '产品轮廓、Logo 和核心色调',
          backgroundStrategy: '智能扩图并补干净背景',
          textPolicy: '不新增文字，只保留原图已有文字或按平台裁切重构'
        }
      }).brief?.contentKind
    ).toBe('产品图片')

    expect(
      submitSkillRequestInputSchema.parse({
        skillId: 'logo-and-brand',
        brief: {
          brandName: 'Movo',
          industry: 'AI 写作工具',
          targetAudience: '内容创作者',
          positioning: '把长文写作变得更轻松',
          logoStyle: '现代简洁'
        }
      }).brief?.brandName
    ).toBe('Movo')

    expect(
      submitSkillRequestInputSchema.parse({
        skillId: 'marketing-brochure',
        brief: {
          format: 'trifold_brochure',
          campaignName: '春季课程开放日',
          targetAudience: '初中家庭',
          keyMessage: '提前规划国际学校申请',
          callToAction: '扫码预约试听'
        }
      }).brief?.format
    ).toBe('trifold_brochure')

    expect(
      watchSkillRequestsInputSchema.parse({
        waitMs: 1000
      }).claim
    ).toBe(true)

    expect(
      updateSkillRequestInputSchema.parse({
        requestId: 'skill_123',
        status: 'completed'
      }).status
    ).toBe('completed')
  })
})
