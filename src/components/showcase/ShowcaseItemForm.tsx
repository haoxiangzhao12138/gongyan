import { useState, useEffect, useCallback } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
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
import { parseGitHubOwnerRepo, fetchGitHubRepoInfo } from '@/lib/api/github'
import { fetchPaperByDOI, looksLikeDOI } from '@/lib/api/crossref'
import { PLATFORM_OPTIONS, ACTION_PRESETS } from '@/lib/constants'
import { toast } from 'sonner'
import type { ShowcaseItem, ShowcaseItemType, HelpLinkPlatform } from '@/types/database'

const TYPE_LABELS: Record<ShowcaseItemType, string> = {
  paper: '论文',
  github: 'GitHub 项目',
  link: '链接',
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
  const [fetchingRepo, setFetchingRepo] = useState(false)
  const [fetchingDOI, setFetchingDOI] = useState(false)

  // Inline help link drafts (only for new items)
  const [helpLinkDrafts, setHelpLinkDrafts] = useState<HelpLinkDraft[]>([])

  const isEdit = !!initial
  const showHelpLinks = !isEdit && (itemType === 'paper' || itemType === 'github')

  // Auto-fetch GitHub repo info when URL changes
  const handleUrlBlur = useCallback(async () => {
    if (itemType !== 'github' || isEdit) return
    const parsed = parseGitHubOwnerRepo(url)
    if (!parsed) return
    // Only auto-fill if title is empty (user hasn't typed anything)
    if (title) return

    setFetchingRepo(true)
    const info = await fetchGitHubRepoInfo(url)
    setFetchingRepo(false)

    if (info) {
      setTitle(info.name)
      if (!description && info.description) setDescription(info.description)
      if (!starsCount) setStarsCount(info.stargazers_count.toString())

      // Auto-add a "Star this repo" help link draft if none exist
      if (helpLinkDrafts.length === 0) {
        setHelpLinkDrafts([
          {
            platform: 'github',
            url: info.html_url,
            title: `Star ${info.name}`,
            action_label: '点 Star',
          },
        ])
      }
    }
  }, [url, itemType, isEdit, title, description, starsCount, helpLinkDrafts.length])

  // Auto-fetch paper info from Crossref when DOI URL is entered
  const handlePaperUrlBlur = useCallback(async () => {
    if (itemType !== 'paper' || isEdit) return
    if (!looksLikeDOI(url)) return
    if (title) return // user already filled title

    setFetchingDOI(true)
    const paper = await fetchPaperByDOI(url)
    setFetchingDOI(false)

    if (paper) {
      setTitle(paper.title)
      if (!description && paper.authors) {
        const yearStr = paper.year ? ` (${paper.year})` : ''
        const venueStr = paper.venue ? `. ${paper.venue}` : ''
        setDescription(`${paper.authors}${yearStr}${venueStr}`)
      }
      toast.success('已自动获取论文信息')
    }
  }, [url, itemType, isEdit, title, description])

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
            <div className="relative">
              <Input
                id="showcase-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={itemType === 'github' ? handleUrlBlur : itemType === 'paper' ? handlePaperUrlBlur : undefined}
                placeholder={
                  itemType === 'github'
                    ? 'https://github.com/owner/repo'
                    : itemType === 'paper'
                      ? 'https://doi.org/10.xxxx/... 或论文链接'
                      : 'https://...'
                }
                required
              />
              {(fetchingRepo || fetchingDOI) && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>
            {itemType === 'github' && !isEdit && (
              <p className="text-xs text-muted-foreground">粘贴 GitHub 链接后会自动获取项目信息</p>
            )}
            {itemType === 'paper' && !isEdit && (
              <p className="text-xs text-muted-foreground">粘贴 DOI 链接可自动获取论文标题和作者</p>
            )}
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
