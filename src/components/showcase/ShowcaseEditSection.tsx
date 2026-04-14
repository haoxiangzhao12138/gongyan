import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Link2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShowcaseItemForm, type ShowcaseItemFormValues } from './ShowcaseItemForm'
import { HelpLinkForm } from './HelpLinkForm'
import { parseGitHubOwnerRepo } from '@/lib/api/github'
import { GitHubIcon } from '@/components/shared/GitHubIcon'
import {
  fetchShowcaseItems,
  createShowcaseItem,
  updateShowcaseItem,
  deleteShowcaseItem,
} from '@/lib/api/showcase'
import {
  fetchHelpLinksByItem,
  createHelpLink,
  updateHelpLink,
  deleteHelpLink,
} from '@/lib/api/helpLinks'
import { useAuthStore } from '@/store/authStore'
import { PLATFORM_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import type {
  ShowcaseItem,
  ShowcaseItemType,
  ShowcaseHelpLink,
  HelpLinkPlatform,
} from '@/types/database'

interface ShowcaseEditSectionProps {
  userId: string
}

export function ShowcaseEditSection({ userId }: ShowcaseEditSectionProps) {
  const profile = useAuthStore((s) => s.profile)
  const linkGitHub = useAuthStore((s) => s.linkGitHub)
  const hasGitHub = !!profile?.github_username

  const [items, setItems] = useState<ShowcaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ShowcaseItem | null>(null)
  const [defaultFormType, setDefaultFormType] = useState<ShowcaseItemType>('paper')

  // Help link state
  const [helpLinksMap, setHelpLinksMap] = useState<Map<string, ShowcaseHelpLink[]>>(new Map())
  const [helpFormOpen, setHelpFormOpen] = useState(false)
  const [editingHelpLink, setEditingHelpLink] = useState<ShowcaseHelpLink | null>(null)
  const [activeItemId, setActiveItemId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null)

  useEffect(() => {
    loadItems()
  }, [userId])

  /** Normalize a GitHub URL to "owner/repo" for dedup comparison */
  function normalizeGitHubUrl(url: string): string | null {
    const parsed = parseGitHubOwnerRepo(url)
    if (!parsed) return null
    return `${parsed.owner}/${parsed.repo}`.toLowerCase()
  }

  /** Check if a GitHub URL already exists in items or help links */
  function isGitHubUrlDuplicate(url: string, excludeId?: string): boolean {
    const key = normalizeGitHubUrl(url)
    if (!key) return false

    for (const item of items) {
      if (item.id === excludeId) continue
      if (item.item_type === 'github' && normalizeGitHubUrl(item.url) === key) return true
    }

    for (const [, links] of helpLinksMap) {
      for (const link of links) {
        if (link.id === excludeId) continue
        if (link.platform === 'github' && normalizeGitHubUrl(link.url) === key) return true
      }
    }

    return false
  }

  async function loadItems() {
    setLoading(true)
    const { data } = await fetchShowcaseItems(userId)
    setItems(data)

    // Load help links for paper and github items
    const linkable = data.filter((item) => item.item_type === 'paper' || item.item_type === 'github')
    const newMap = new Map<string, ShowcaseHelpLink[]>()
    await Promise.all(
      linkable.map(async (item) => {
        const { data: links, error } = await fetchHelpLinksByItem(item.id)
        if (!error) {
          newMap.set(item.id, links)
        }
      })
    )
    setHelpLinksMap(newMap)
    setLoading(false)
  }

  function handleAdd(type: ShowcaseItemType) {
    setEditing(null)
    setDefaultFormType(type)
    setFormOpen(true)
  }

  function handleEdit(item: ShowcaseItem) {
    setEditing(item)
    setDefaultFormType(item.item_type)
    setFormOpen(true)
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    const { error } = await deleteShowcaseItem(id)
    if (error) {
      toast.error('删除失败', { description: error })
      setDeletingId(null)
      return
    }
    setItems((prev) => prev.filter((item) => item.id !== id))
    setHelpLinksMap((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
    setDeletingId(null)
    toast.success('已删除')
  }

  async function handleSubmit(values: ShowcaseItemFormValues) {
    // Require GitHub binding for publishing github items
    if (values.item_type === 'github' && !hasGitHub) {
      toast.error('请先绑定 GitHub 账号', {
        description: '发布 GitHub 项目需要绑定 GitHub 账号',
        action: { label: '绑定', onClick: () => linkGitHub() },
      })
      throw new Error('github-not-linked')
    }

    if (editing) {
      if (editing.item_type === 'github' && isGitHubUrlDuplicate(values.url, editing.id)) {
        toast.error('该 GitHub 链接已存在')
        throw new Error('duplicate')
      }
      const { data, error } = await updateShowcaseItem(editing.id, {
        title: values.title,
        url: values.url,
        description: values.description,
        citation: values.citation || null,
        stars_count: values.stars_count,
        platform_label: values.platform_label || null,
      })
      if (error) {
        toast.error('更新失败', { description: error })
        throw new Error(error)
      }
      setItems((prev) =>
        prev.map((item) => (item.id === editing.id ? data! : item))
      )
      toast.success('已更新')
    } else {
      if (values.item_type === 'github' && isGitHubUrlDuplicate(values.url)) {
        toast.error('该 GitHub 链接已存在')
        throw new Error('duplicate')
      }
      const { data, error } = await createShowcaseItem({
        user_id: userId,
        item_type: values.item_type,
        title: values.title,
        url: values.url,
        description: values.description,
        citation: values.citation || undefined,
        stars_count: values.stars_count ?? undefined,
        platform_label: values.platform_label || undefined,
        sort_order: items.length,
      })
      if (error) {
        toast.error('添加失败', { description: error })
        throw new Error(error)
      }
      setItems((prev) => [...prev, data!])

      // Create inline help links if provided
      if (values.helpLinks && values.helpLinks.length > 0) {
        const createdLinks: ShowcaseHelpLink[] = []
        for (const draft of values.helpLinks) {
          // Check GitHub binding for github help links
          if (draft.platform === 'github' && !hasGitHub) continue
          // Dedup check
          if (draft.platform === 'github' && isGitHubUrlDuplicate(draft.url)) continue

          const { data: linkData } = await createHelpLink({
            item_id: data!.id,
            title: draft.title,
            url: draft.url,
            platform: draft.platform,
            action_label: draft.action_label,
          })
          if (linkData) createdLinks.push(linkData)
        }
        setHelpLinksMap((prev) => {
          const next = new Map(prev)
          next.set(data!.id, createdLinks)
          return next
        })
        toast.success(`已添加，包含 ${createdLinks.length} 条求助链接`)
      } else {
        toast.success('已添加')
        // Auto-open help link form for paper and github items (if no inline links)
        if (values.item_type === 'paper' || values.item_type === 'github') {
          setActiveItemId(data!.id)
          setHelpLinksMap((prev) => {
            const next = new Map(prev)
            next.set(data!.id, [])
            return next
          })
          setEditingHelpLink(null)
          setHelpFormOpen(true)
        }
      }
    }
  }

  // Help link handlers
  function handleAddHelpLink(itemId: string) {
    setActiveItemId(itemId)
    setEditingHelpLink(null)
    setHelpFormOpen(true)
  }

  function handleEditHelpLink(link: ShowcaseHelpLink) {
    setActiveItemId(link.item_id)
    setEditingHelpLink(link)
    setHelpFormOpen(true)
  }

  async function handleDeleteHelpLink(linkId: string, itemId: string) {
    setDeletingLinkId(linkId)
    const { error } = await deleteHelpLink(linkId)
    if (error) {
      toast.error('删除失败', { description: error })
      setDeletingLinkId(null)
      return
    }
    setHelpLinksMap((prev) => {
      const next = new Map(prev)
      const links = next.get(itemId) ?? []
      next.set(itemId, links.filter((l) => l.id !== linkId))
      return next
    })
    setDeletingLinkId(null)
    toast.success('已删除')
  }

  async function handleHelpLinkSubmit(values: {
    title: string
    url: string
    platform: HelpLinkPlatform
    action_label: string
  }) {
    if (!activeItemId) return

    if (values.platform === 'github' && !hasGitHub) {
      toast.error('请先绑定 GitHub 账号', {
        description: '发布 GitHub 求助链接需要绑定 GitHub 账号',
        action: { label: '绑定', onClick: () => linkGitHub() },
      })
      throw new Error('github-not-linked')
    }

    if (editingHelpLink) {
      if (values.platform === 'github' && isGitHubUrlDuplicate(values.url, editingHelpLink.id)) {
        toast.error('该 GitHub 链接已存在')
        throw new Error('duplicate')
      }
      const { data, error } = await updateHelpLink(editingHelpLink.id, values)
      if (error) {
        toast.error('更新失败', { description: error })
        throw new Error(error)
      }
      setHelpLinksMap((prev) => {
        const next = new Map(prev)
        const links = next.get(activeItemId) ?? []
        next.set(activeItemId, links.map((l) => (l.id === editingHelpLink.id ? data! : l)))
        return next
      })
      toast.success('已更新')
    } else {
      if (values.platform === 'github' && isGitHubUrlDuplicate(values.url)) {
        toast.error('该 GitHub 链接已存在')
        throw new Error('duplicate')
      }
      const { data, error } = await createHelpLink({
        item_id: activeItemId,
        ...values,
      })
      if (error) {
        toast.error('添加失败', { description: error })
        throw new Error(error)
      }
      setHelpLinksMap((prev) => {
        const next = new Map(prev)
        const links = next.get(activeItemId) ?? []
        next.set(activeItemId, [...links, data!])
        return next
      })
      toast.success('已添加')
    }
  }

  // Split items by type
  const paperItems = items.filter((i) => i.item_type === 'paper')
  const githubItems = items.filter((i) => i.item_type === 'github')
  const linkItems = items.filter((i) => i.item_type === 'link')

  function renderItemRow(item: ShowcaseItem) {
    const links = helpLinksMap.get(item.id) ?? []
    const hasHelpLinks = item.item_type === 'paper' || item.item_type === 'github'

    return (
      <li key={item.id} className="py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
            >
              <span className="truncate">{item.title}</span>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
            </a>
            {item.description && (
              <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{item.description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {hasHelpLinks && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => handleAddHelpLink(item.id)}
                title="添加求助链接"
              >
                <Link2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => handleEdit(item)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive hover:text-destructive"
              onClick={() => handleDelete(item.id)}
              disabled={deletingId === item.id}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Help links sub-list */}
        {hasHelpLinks && links.length > 0 && (
          <ul className="mt-1.5 ml-4 space-y-1">
            {links.map((link) => (
              <li key={link.id} className="flex items-center gap-2 text-sm">
                <Badge variant="secondary" className="text-[10px]">
                  {PLATFORM_LABELS[link.platform] ?? link.platform}
                </Badge>
                <span className="truncate text-muted-foreground">
                  {link.title || PLATFORM_LABELS[link.platform] || link.platform}
                </span>
                <span className="text-xs text-muted-foreground">({link.action_label})</span>
                <div className="ml-auto flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleEditHelpLink(link)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteHelpLink(link.id, item.id)}
                    disabled={deletingLinkId === link.id}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </li>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>学术展示</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">加载中...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* 论文 Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">论文</CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleAdd('paper')}>
              <Plus className="h-3.5 w-3.5" />
              添加论文
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {paperItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              暂无论文，点击"添加论文"展示你的学术成果。
            </p>
          ) : (
            <ul className="divide-y">{paperItems.map(renderItemRow)}</ul>
          )}
        </CardContent>
      </Card>

      {/* GitHub Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <GitHubIcon className="h-4 w-4" />
              GitHub 项目
            </CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleAdd('github')}>
              <Plus className="h-3.5 w-3.5" />
              添加项目
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {githubItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              暂无 GitHub 项目，点击"添加项目"展示你的开源工作。
            </p>
          ) : (
            <ul className="divide-y">{githubItems.map(renderItemRow)}</ul>
          )}
        </CardContent>
      </Card>

      {/* 链接 Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">其他链接</CardTitle>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => handleAdd('link')}>
              <Plus className="h-3.5 w-3.5" />
              添加链接
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {linkItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              暂无链接，添加你的博客、知乎专栏等其他展示。
            </p>
          ) : (
            <ul className="divide-y">{linkItems.map(renderItemRow)}</ul>
          )}
        </CardContent>
      </Card>

      <ShowcaseItemForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        defaultType={defaultFormType}
        onSubmit={handleSubmit}
      />

      <HelpLinkForm
        open={helpFormOpen}
        onOpenChange={setHelpFormOpen}
        initial={editingHelpLink}
        onSubmit={handleHelpLinkSubmit}
      />
    </>
  )
}
