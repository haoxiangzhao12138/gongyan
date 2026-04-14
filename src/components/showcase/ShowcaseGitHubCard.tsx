import { useState, useEffect } from 'react'
import { ExternalLink, Star, Pencil, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LikeButton } from './LikeButton'
import { ShowcaseItemForm } from './ShowcaseItemForm'
import { HelpLinkForm } from './HelpLinkForm'
import { HelpLinkRow } from '@/components/star-requests/HelpLinkRow'
import { updateShowcaseItem } from '@/lib/api/showcase'
import {
  createHelpLink,
  updateHelpLink,
  deleteHelpLink,
} from '@/lib/api/helpLinks'
import { toast } from 'sonner'
import type {
  ShowcaseItem,
  ShowcaseItemType,
  ShowcaseHelpLink,
  HelpLinkPlatform,
} from '@/types/database'

const PLATFORM_LABELS: Record<string, string> = {
  github: 'GitHub',
  huggingface: 'HuggingFace',
  zhihu: '知乎',
  xiaohongshu: '小红书',
  wechat: '微信',
  bilibili: 'B站',
  twitter: 'Twitter/X',
  other: '其他',
}

interface ShowcaseGitHubCardProps {
  item: ShowcaseItem
  currentUserId: string | undefined
  liked: boolean
  helpLinks?: ShowcaseHelpLink[]
  completedIds?: Set<string>
  onItemUpdated?: (updated: ShowcaseItem) => void
  onHelpLinksChanged?: (itemId: string, links: ShowcaseHelpLink[]) => void
}

export function ShowcaseGitHubCard({
  item,
  currentUserId,
  liked,
  helpLinks = [],
  completedIds = new Set(),
  onItemUpdated,
  onHelpLinksChanged,
}: ShowcaseGitHubCardProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [helpFormOpen, setHelpFormOpen] = useState(false)
  const [editingHelpLink, setEditingHelpLink] = useState<ShowcaseHelpLink | null>(null)
  const [localHelpLinks, setLocalHelpLinks] = useState(helpLinks)

  useEffect(() => {
    setLocalHelpLinks(helpLinks)
  }, [helpLinks])

  const isOwner = currentUserId === item.user_id

  async function handleEditSubmit(values: {
    item_type: ShowcaseItemType
    title: string
    url: string
    description: string
    citation: string
    stars_count: number | null
    platform_label: string
  }) {
    const { data, error } = await updateShowcaseItem(item.id, {
      title: values.title,
      url: values.url,
      description: values.description,
      stars_count: values.stars_count,
    })
    if (error) {
      toast.error('更新失败', { description: error })
      return
    }
    if (data) onItemUpdated?.(data)
    toast.success('已更新')
  }

  function handleAddHelpLink() {
    setEditingHelpLink(null)
    setHelpFormOpen(true)
  }

  function handleEditHelpLink(link: ShowcaseHelpLink) {
    setEditingHelpLink(link)
    setHelpFormOpen(true)
  }

  async function handleDeleteHelpLink(linkId: string) {
    const { error } = await deleteHelpLink(linkId)
    if (error) {
      toast.error('删除失败', { description: error })
      return
    }
    const next = localHelpLinks.filter((l) => l.id !== linkId)
    setLocalHelpLinks(next)
    onHelpLinksChanged?.(item.id, next)
    toast.success('已删除')
  }

  async function handleHelpLinkSubmit(values: {
    title: string
    url: string
    platform: HelpLinkPlatform
    action_label: string
  }) {
    if (editingHelpLink) {
      const { data, error } = await updateHelpLink(editingHelpLink.id, values)
      if (error) {
        toast.error('更新失败', { description: error })
        return
      }
      const next = localHelpLinks.map((l) => (l.id === editingHelpLink.id ? data! : l))
      setLocalHelpLinks(next)
      onHelpLinksChanged?.(item.id, next)
      toast.success('已更新')
    } else {
      const { data, error } = await createHelpLink({ item_id: item.id, ...values })
      if (error) {
        toast.error('添加失败', { description: error })
        return
      }
      const next = [...localHelpLinks, data!]
      setLocalHelpLinks(next)
      onHelpLinksChanged?.(item.id, next)
      toast.success('已添加')
    }
  }

  return (
    <>
      <Card size="sm">
        <CardContent>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium hover:underline"
              >
                {item.title}
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </a>
              {item.description && (
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {item.stars_count != null && item.stars_count > 0 && (
                <span className="flex items-center gap-1 text-sm text-amber-500">
                  <Star className="h-4 w-4 fill-current" />
                  {item.stars_count}
                </span>
              )}
              {isOwner && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  onClick={() => setEditOpen(true)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1">
            <LikeButton
              itemId={item.id}
              currentUserId={currentUserId}
              ownerId={item.user_id}
              initialLiked={liked}
              initialCount={item.like_count}
            />
          </div>

          {/* Help links display — only for non-owners */}
          {!isOwner && localHelpLinks.length > 0 && (
            <div className="mt-3 border-t pt-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">求助链接</p>
              <div className="divide-y">
                {localHelpLinks.map((link) => (
                  <HelpLinkRow
                    key={link.id}
                    link={link}
                    currentUserId={currentUserId}
                    ownerId={item.user_id}
                    initialCompleted={completedIds.has(link.id)}
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          {/* Owner: inline help link management */}
          {isOwner && (
            <div className="mt-3 border-t pt-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-muted-foreground">管理求助链接</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-xs text-muted-foreground"
                  onClick={handleAddHelpLink}
                >
                  <Plus className="h-3 w-3" />
                  添加
                </Button>
              </div>
              {localHelpLinks.length > 0 && (
                <ul className="space-y-1">
                  {localHelpLinks.map((link) => (
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
                          onClick={() => handleDeleteHelpLink(link.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <>
          <ShowcaseItemForm
            open={editOpen}
            onOpenChange={setEditOpen}
            initial={item}
            onSubmit={handleEditSubmit}
          />
          <HelpLinkForm
            open={helpFormOpen}
            onOpenChange={setHelpFormOpen}
            initial={editingHelpLink}
            onSubmit={handleHelpLinkSubmit}
          />
        </>
      )}
    </>
  )
}
