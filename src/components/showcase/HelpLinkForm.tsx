import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { PLATFORM_OPTIONS, ACTION_PRESETS } from '@/lib/constants'
import { toast } from 'sonner'
import type { HelpLinkPlatform, ShowcaseHelpLink } from '@/types/database'

interface HelpLinkFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: ShowcaseHelpLink | null
  onSubmit: (values: {
    title: string
    url: string
    platform: HelpLinkPlatform
    action_label: string
  }) => Promise<void>
}

export function HelpLinkForm({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: HelpLinkFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [platform, setPlatform] = useState<HelpLinkPlatform>(initial?.platform ?? 'github')
  const [actionLabel, setActionLabel] = useState(initial?.action_label ?? '点 Star')
  const [saving, setSaving] = useState(false)

  // Reset form state when dialog opens or initial data changes
  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? '')
      setUrl(initial?.url ?? '')
      setPlatform(initial?.platform ?? 'github')
      setActionLabel(initial?.action_label ?? ACTION_PRESETS[initial?.platform ?? 'github'])
      setSaving(false)
    }
  }, [open, initial])

  const isEdit = !!initial

  function handlePlatformChange(val: string | null) {
    if (!val) return
    const p = val as HelpLinkPlatform
    setPlatform(p)
    if (!initial) {
      setActionLabel(ACTION_PRESETS[p])
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // Validate GitHub URL when platform is github
    if (platform === 'github' && !parseGitHubOwnerRepo(url)) {
      toast.error('请输入有效的 GitHub 仓库链接', {
        description: '格式：https://github.com/owner/repo',
      })
      return
    }

    setSaving(true)
    try {
      await onSubmit({ title, url, platform, action_label: actionLabel })
      onOpenChange(false)
    } catch {
      // Keep dialog open on error so user doesn't lose form data
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? '编辑求助链接' : '添加求助链接'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>平台</Label>
            <Select value={platform} onValueChange={handlePlatformChange}>
              <SelectTrigger className="w-full">
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

          <div className="space-y-2">
            <Label htmlFor="helplink-title">标题（可选）</Label>
            <Input
              id="helplink-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="留空则自动使用平台名称"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="helplink-url">链接</Label>
            <Input
              id="helplink-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="helplink-action">操作标签</Label>
            <Input
              id="helplink-action"
              value={actionLabel}
              onChange={(e) => setActionLabel(e.target.value)}
              placeholder="如：点 Star、点赞、三连"
              required
            />
          </div>

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
