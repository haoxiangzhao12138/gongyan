import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { fetchShowcaseItems, fetchUserLikes, createShowcaseItem } from '@/lib/api/showcase'
import { fetchHelpLinksByItem, fetchUserCompletions } from '@/lib/api/helpLinks'
import { ShowcasePaperCard } from './ShowcasePaperCard'
import { ShowcaseGitHubCard } from './ShowcaseGitHubCard'
import { ShowcaseLinkCard } from './ShowcaseLinkCard'
import { ShowcaseItemForm } from './ShowcaseItemForm'
import { toast } from 'sonner'
import type { ShowcaseItem, ShowcaseItemType, ShowcaseHelpLink } from '@/types/database'

interface ShowcaseSectionProps {
  userId: string
  currentUserId: string | undefined
}

const TAB_LABELS: Record<ShowcaseItemType, string> = {
  paper: '论文',
  github: 'GitHub',
  link: '链接',
}

export function ShowcaseSection({ userId, currentUserId }: ShowcaseSectionProps) {
  const [items, setItems] = useState<ShowcaseItem[]>([])
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [helpLinksMap, setHelpLinksMap] = useState<Map<string, ShowcaseHelpLink[]>>(new Map())
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [addFormOpen, setAddFormOpen] = useState(false)

  const isOwner = currentUserId === userId

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await fetchShowcaseItems(userId)
      setItems(data)

      if (currentUserId && data.length > 0) {
        const ids = data.map((item) => item.id)
        const { data: liked } = await fetchUserLikes(currentUserId, ids)
        setLikedIds(liked)
      }

      // Load help links for paper and github items
      const linkableItems = data.filter((item) => item.item_type === 'paper' || item.item_type === 'github')
      const linksMap = new Map<string, ShowcaseHelpLink[]>()
      const allLinkIds: string[] = []

      await Promise.all(
        linkableItems.map(async (item) => {
          const { data: links } = await fetchHelpLinksByItem(item.id)
          const active = links.filter((l) => l.is_active)
          linksMap.set(item.id, active)
          for (const link of active) {
            allLinkIds.push(link.id)
          }
        })
      )
      setHelpLinksMap(linksMap)

      if (currentUserId && allLinkIds.length > 0) {
        const { data: completed } = await fetchUserCompletions(currentUserId, allLinkIds)
        setCompletedIds(completed)
      }

      setLoading(false)
    }
    load()
  }, [userId, currentUserId])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  const grouped: Record<ShowcaseItemType, ShowcaseItem[]> = {
    paper: [],
    github: [],
    link: [],
  }
  for (const item of items) {
    grouped[item.item_type].push(item)
  }

  const activeTabs = (Object.keys(grouped) as ShowcaseItemType[]).filter(
    (type) => grouped[type].length > 0
  )

  function handleItemUpdated(updated: ShowcaseItem) {
    setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
  }

  function handleHelpLinksChanged(itemId: string, links: ShowcaseHelpLink[]) {
    setHelpLinksMap((prev) => {
      const next = new Map(prev)
      next.set(itemId, links)
      return next
    })
  }

  async function handleAddSubmit(values: {
    item_type: ShowcaseItemType
    title: string
    url: string
    description: string
    citation: string
    stars_count: number | null
    platform_label: string
  }) {
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
      return
    }
    setItems((prev) => [...prev, data!])
    toast.success('已添加')
  }

  // Show section even when empty if user is the owner (so they can add)
  if (items.length === 0 && !isOwner) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">学术展示</h2>
        {isOwner && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setAddFormOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            添加
          </Button>
        )}
      </div>

      {activeTabs.length > 0 ? (
        <Tabs defaultValue={activeTabs[0]}>
          <TabsList>
            {activeTabs.map((type) => (
              <TabsTrigger key={type} value={type}>
                {TAB_LABELS[type]}
                <span className="ml-1 text-muted-foreground">
                  {grouped[type].length}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>

          {activeTabs.map((type) => (
            <TabsContent key={type} value={type}>
              <div className="space-y-3 pt-2">
                {grouped[type].map((item) => {
                  const liked = likedIds.has(item.id)
                  switch (item.item_type) {
                    case 'paper':
                      return (
                        <ShowcasePaperCard
                          key={item.id}
                          item={item}
                          currentUserId={currentUserId}
                          liked={liked}
                          helpLinks={helpLinksMap.get(item.id) ?? []}
                          completedIds={completedIds}
                          onItemUpdated={handleItemUpdated}
                          onHelpLinksChanged={handleHelpLinksChanged}
                        />
                      )
                    case 'github':
                      return (
                        <ShowcaseGitHubCard
                          key={item.id}
                          item={item}
                          currentUserId={currentUserId}
                          liked={liked}
                          helpLinks={helpLinksMap.get(item.id) ?? []}
                          completedIds={completedIds}
                          onItemUpdated={handleItemUpdated}
                          onHelpLinksChanged={handleHelpLinksChanged}
                        />
                      )
                    case 'link':
                      return (
                        <ShowcaseLinkCard
                          key={item.id}
                          item={item}
                          currentUserId={currentUserId}
                          liked={liked}
                        />
                      )
                  }
                })}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <p className="text-sm text-muted-foreground py-4">
          暂无展示项，点击"添加"展示你的论文、GitHub 项目或链接。
        </p>
      )}

      {isOwner && (
        <ShowcaseItemForm
          open={addFormOpen}
          onOpenChange={setAddFormOpen}
          onSubmit={handleAddSubmit}
        />
      )}
    </div>
  )
}
