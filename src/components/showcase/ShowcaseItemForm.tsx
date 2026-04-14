import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { parseGitHubOwnerRepo } from '@/lib/api/github'
import { toast } from 'sonner'
import type { ShowcaseItem, ShowcaseItemType, HelpLinkPlatform } from '@/types/database'

const TYPE_LABELS: Record<ShowcaseItemType, string> = {
  paper: '论文',
  github: 'GitHub 项目',
  link: '链接',
}

const PLATFORM_OPTIONS: { value: HelpLinkPlatform; label: string }[] = [
  { value: 'github', label: 'GitHub' },
  { value: 'huggingface', label: 'HuggingFace' },
  { value: 'zhihu', label: '知乎' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'wechat', label: '微信' },
  { value: 'bilibili', label: 'B站' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'other', label: '其他' },
]

const ACTION_PRESETS: Record<HelpLinkPlatform, string> = {
  github: '点 Star',
  huggingface: '点赞',
  zhihu: '点赞',
  xiaohongshu: '点赞',
  wechat: '点赞',
  bilibili: '三连',
  twitter: '转推',
  other: '点赞',
}

interface HelpLinkDraft {
  platform: HelpLinkPlatform
  url: string
  title: string
  action_label: string
}

export interface ShowcaseItemFormValues {
  item_type: ShowcaseItemType
  title: string
  url: string
  description: string
  citation: string
  stars_count: number | null
  platform_label: string
  helpLinks?: HelpLinkDraft[]
}

interface ShowcaseItemFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: ShowcaseItem | null
  defaultType?: ShowcaseItemType
  onSubmit: (values: ShowcaseItemFormValues) => Promise<void>
}

export function ShowcaseItemForm({
  open,
  onOpenChange,
  initial,
  defaultType,
  onSubmit,
}: ShowcaseItemFormProps) {
  const [itemType, setItemType] = useState<ShowcaseItemType>(
    initial?.item_type ?? 'paper'
  )
  const [title, setTitle] = useState(initial?.title ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [citation, setCitation] = useState(initial?.citation ?? '')
  const [starsCount, setStarsCount] = useState(
    initial?.stars_count?.toString() ?? ''
  )
  const [platformLabel, setPlatformLabel] = useState(
    initial?.platform_label ?? ''
  )
  const [saving, setSaving] = useState(false)

  // Inline help link drafts (only for new items)
  const [helpLinkDrafts, setHelpLinkDrafts] = useState<HelpLinkDraft[]>([])

  // Reset form state when dialog opens or initial data changes
  useEffect(() => {
    if (open) {
      setItemType(initial?.item_type ?? defaultType ?? 'paper')
      setTitle(initial?.title ?? '')
      setUrl(initial?.url ?? '')
      setDescription(initial?.description ?? '')
      setCitation(initial?.citation ?? '')
      setStarsCount(initial?.stars_count?.toString() ?? '')
      setPlatformLabel(initial?.platform_label ?? '')
      setHelpLinkDrafts([])
      setSaving(false)
    }
  }, [open, initial, defaultType])

  const isEdit = !!initial
  const showHelpLinks = !isEdit && (itemType === 'paper' || itemType === 'github')

  function addHelpLinkDraft() {
    const defaultPlatform: HelpLinkPlatform = itemType === 'github' ? 'github' : 'zhihu'
    setHelpLinkDrafts((prev) => [
      ...prev,
      {
        platform: defaultPlatform,
        url: '',
        title: '',
        action_label: ACTION_PRESETS[defaultPlatform],
      },
    ])
  }

  function updateHelpLinkDraft(index: number, updates: Partial<HelpLinkDraft>) {
    setHelpLinkDrafts((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...updates } : d))
    )
  }

  function removeHelpLinkDraft(index: number) {
    setHelpLinkDrafts((prev) => prev.filter((_, i) => i !== index))
  }

  function handleDraftPlatformChange(index: number, platform: HelpLinkPlatform) {
    updateHelpLinkDraft(index, {
      platform,
      action_label: ACTION_PRESETS[platform],
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate GitHub URL
    if (itemType === 'github' && !parseGitHubOwnerRepo(url)) {
      toast.error('请输入有效的 GitHub 仓库链接', {
        description: '格式：https://github.com/owner/repo',
      })
      return
    }

    // Validate help link drafts
    for (const draft of helpLinkDrafts) {
      if (!draft.url) {
        toast.error('求助链接的 URL 不能为空')
        return
      }
      if (draft.platform === 'github' && !parseGitHubOwnerRepo(draft.url)) {
        toast.error('求助链接的 GitHub URL 无效', {
          description: '格式：https://github.com/owner/repo',
        })
        return
      }
    }

    setSaving(true)
    try {
      const validDrafts = helpLinkDrafts.filter((d) => d.url)
      await onSubmit({
        item_type: itemType,
        title,
        url,
        description,
        citation: itemType === 'paper' ? citation : '',
        stars_count: itemType === 'github' && starsCount ? Number(starsCount) : null,
        platform_label: itemType === 'link' ? platformLabel : '',
        helpLinks: validDrafts.length > 0 ? validDrafts : undefined,
      })
      onOpenChange(false)
    } catch {
      // Keep dialog open on error so user doesn't lose form data
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑展示项' : `添加${TYPE_LABELS[itemType]}`}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEdit && (
            <div className="space-y-2">
              <Label>类型</Label>
              <Select value={itemType} onValueChange={(val) => setItemType(val as ShowcaseItemType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as ShowcaseItemType[]).map(
                    (type) => (
                      <SelectItem key={type} value={type}>
                        {TYPE_LABELS[type]}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="showcase-title">标题</Label>
            <Input
              id="showcase-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="showcase-url">链接</Label>
            <Input
              id="showcase-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="showcase-desc">描述</Label>
            <Textarea
              id="showcase-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {itemType === 'paper' && (
            <div className="space-y-2">
              <Label htmlFor="showcase-citation">BibTeX 引用</Label>
              <Textarea
                id="showcase-citation"
                value={citation}
                onChange={(e) => setCitation(e.target.value)}
                rows={4}
                className="font-mono text-xs"
                placeholder={"@article{...}"}
              />
            </div>
          )}

          {itemType === 'github' && (
            <div className="space-y-2">
              <Label htmlFor="showcase-stars">Star 数</Label>
              <Input
                id="showcase-stars"
                type="number"
                min={0}
                value={starsCount}
                onChange={(e) => setStarsCount(e.target.value)}
              />
            </div>
          )}

          {itemType === 'link' && (
            <div className="space-y-2">
              <Label htmlFor="showcase-platform">平台标签</Label>
              <Input
                id="showcase-platform"
                value={platformLabel}
                onChange={(e) => setPlatformLabel(e.target.value)}
                placeholder="如：知乎、微信公众号"
              />
            </div>
          )}

          {/* Inline help links for new paper/github items */}
          {showHelpLinks && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">求助链接（可选）</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs h-7"
                    onClick={addHelpLinkDraft}
                  >
                    <Plus className="h-3 w-3" />
                    添加
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">
                  添加需要别人帮忙点赞/Star 的链接，保存后会显示在互助广场。
                </p>

                {helpLinkDrafts.map((draft, index) => (
                  <div key={index} className="rounded-md border p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        求助链接 #{index + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeHelpLinkDraft(index)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">平台</Label>
                        <Select
                          value={draft.platform}
                          onValueChange={(val) =>
                            handleDraftPlatformChange(index, val as HelpLinkPlatform)
                          }
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PLATFORM_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">操作标签</Label>
                        <Input
                          className="h-8 text-xs"
                          value={draft.action_label}
                          onChange={(e) =>
                            updateHelpLinkDraft(index, { action_label: e.target.value })
                          }
                          placeholder="如：点 Star"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">链接 URL</Label>
                      <Input
                        className="h-8 text-xs"
                        type="url"
                        value={draft.url}
                        onChange={(e) =>
                          updateHelpLinkDraft(index, { url: e.target.value })
                        }
                        placeholder="https://..."
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">标题（可选）</Label>
                      <Input
                        className="h-8 text-xs"
                        value={draft.title}
                        onChange={(e) =>
                          updateHelpLinkDraft(index, { title: e.target.value })
                        }
                        placeholder="留空使用平台名称"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
