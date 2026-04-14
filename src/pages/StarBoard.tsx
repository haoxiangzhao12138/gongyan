import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import {
  fetchAllActiveHelpLinks,
  fetchUserCompletions,
  completeHelpLink,
} from '@/lib/api/helpLinks'
import { checkGitHubStars, starGitHubRepos, parseGitHubOwnerRepo } from '@/lib/api/github'
import { HelpLinkRow } from '@/components/star-requests/HelpLinkRow'
import { GitHubUserCard } from '@/components/star-requests/GitHubUserCard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { GitHubIcon } from '@/components/shared/GitHubIcon'
import { RefreshCw, ExternalLink, Star, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { ShowcaseHelpLink } from '@/types/database'

/** Normalize GitHub URL to "owner/repo" lowercase for dedup */
function normalizeGitHubKey(url: string): string | null {
  const parsed = parseGitHubOwnerRepo(url)
  if (!parsed) return null
  return `${parsed.owner}/${parsed.repo}`.toLowerCase()
}

export default function StarBoard() {
  const { profile, linkGitHub } = useAuthStore()
  const [links, setLinks] = useState<ShowcaseHelpLink[]>([])
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())
  const [githubStarredUrls, setGithubStarredUrls] = useState<Set<string>>(
    new Set()
  )
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [starringAll, setStarringAll] = useState(false)
  const [starAllProgress, setStarAllProgress] = useState('')

  const hasGitHub = !!profile?.github_username

  const loadData = useCallback(async () => {
    const { data } = await fetchAllActiveHelpLinks()
    setLinks(data)

    let currentCompletedIds = new Set<string>()

    if (profile && data.length > 0) {
      const ids = data.map((l) => l.id)
      const { data: completed } = await fetchUserCompletions(profile.id, ids)
      currentCompletedIds = completed
      setCompletedIds(completed)
    }

    // Auto-detect GitHub star status for linked users
    if (profile?.github_username && data.length > 0) {
      const githubLinks = data.filter(
        (l) =>
          l.platform === 'github' &&
          l.showcase_item?.user_id !== profile.id
      )
      const uncheckedGithubLinks = githubLinks.filter(
        (l) => !currentCompletedIds.has(l.id)
      )

      if (uncheckedGithubLinks.length > 0) {
        const urls = uncheckedGithubLinks.map((l) => l.url)
        const { results } = await checkGitHubStars(urls)

        const starredUrlSet = new Set<string>()
        const toAutoComplete: ShowcaseHelpLink[] = []

        for (const link of uncheckedGithubLinks) {
          if (results[link.url]) {
            starredUrlSet.add(link.url)
            toAutoComplete.push(link)
          }
        }

        // Also include already-completed github links as starred
        for (const link of githubLinks) {
          if (currentCompletedIds.has(link.id)) {
            starredUrlSet.add(link.url)
          }
        }

        setGithubStarredUrls(starredUrlSet)

        // Silently auto-complete help links that are already starred on GitHub
        if (toAutoComplete.length > 0) {
          const newCompletedIds = new Set(currentCompletedIds)
          await Promise.all(
            toAutoComplete.map(async (link) => {
              const { error } = await completeHelpLink(link.id, profile.id)
              if (!error) {
                newCompletedIds.add(link.id)
              }
            })
          )
          setCompletedIds(newCompletedIds)
        }
      }
    }
  }, [profile])

  useEffect(() => {
    setLoading(true)
    loadData().finally(() => setLoading(false))
  }, [loadData])

  async function handleRefresh() {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  async function handleStarAll(targetLinks?: ShowcaseHelpLink[]) {
    if (!profile || !hasGitHub) return
    setStarringAll(true)

    // Find all GitHub links from other users that are not yet completed
    const unstarredGithubLinks = (targetLinks ?? links).filter(
      (l) =>
        l.platform === 'github' &&
        l.showcase_item?.user_id !== profile.id &&
        !completedIds.has(l.id) &&
        !githubStarredUrls.has(l.url)
    )

    if (unstarredGithubLinks.length === 0) {
      toast.info('所有 GitHub 项目都已 Star')
      setStarringAll(false)
      return
    }

    const urls = unstarredGithubLinks.map((l) => l.url)
    setStarAllProgress(`0/${urls.length}`)

    const results = await starGitHubRepos(urls, (done, total) => {
      setStarAllProgress(`${done}/${total}`)
    })

    // Auto-complete successful stars
    const newCompletedIds = new Set(completedIds)
    const newStarredUrls = new Set(githubStarredUrls)
    let successCount = 0

    await Promise.all(
      unstarredGithubLinks.map(async (link) => {
        if (results[link.url]) {
          newStarredUrls.add(link.url)
          const { error } = await completeHelpLink(link.id, profile.id)
          if (!error) {
            newCompletedIds.add(link.id)
            successCount++
          }
        }
      })
    )

    setCompletedIds(newCompletedIds)
    setGithubStarredUrls(newStarredUrls)
    setStarringAll(false)
    setStarAllProgress('')

    if (successCount > 0) {
      toast.success(`成功 Star ${successCount} 个项目`)
    } else {
      toast.error('Star 失败', {
        description: 'GitHub 授权可能已过期，请到个人资料页重新绑定 GitHub',
      })
    }

    // Reload to get accurate completion counts
    await loadData()
  }

  /** Callback when GitHubUserCard stars some links */
  function handleUserStarred(linkIds: string[], urls: string[]) {
    setCompletedIds((prev) => {
      const next = new Set(prev)
      for (const id of linkIds) next.add(id)
      return next
    })
    setGithubStarredUrls((prev) => {
      const next = new Set(prev)
      for (const url of urls) next.add(url)
      return next
    })
  }

  if (loading) {
    return (
      <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  // Split into own vs others
  const myLinks = links.filter((l) => l.showcase_item?.user_id === profile?.id)
  const otherLinks = links.filter(
    (l) => l.showcase_item?.user_id !== profile?.id
  )
  const othersTodo = otherLinks.filter((l) => !completedIds.has(l.id))
  const othersDone = otherLinks.filter((l) => completedIds.has(l.id))

  // GitHub-only links (others), deduplicated by normalized URL per user
  const githubOtherLinks = otherLinks.filter((l) => l.platform === 'github')

  // Count unstarred GitHub links for the button badge
  const unstarredGithubCount = githubOtherLinks.filter(
    (l) => !completedIds.has(l.id) && !githubStarredUrls.has(l.url)
  ).length

  // Group by paper/item
  function groupByPaper(items: ShowcaseHelpLink[]) {
    const groups: Map<
      string,
      {
        paperId: string
        paperTitle: string
        paperUrl: string
        userId: string
        userName: string
        links: ShowcaseHelpLink[]
      }
    > = new Map()
    for (const link of items) {
      const item = link.showcase_item
      if (!item) continue
      const key = item.id
      if (!groups.has(key)) {
        groups.set(key, {
          paperId: item.id,
          paperTitle: item.title,
          paperUrl: item.url,
          userId: item.user_id,
          userName: item.user?.full_name ?? '',
          links: [],
        })
      }
      groups.get(key)!.links.push(link)
    }
    return Array.from(groups.values())
  }

  // Group GitHub links by user, with dedup
  function groupGitHubByUser() {
    const groups: Map<
      string,
      {
        userId: string
        userName: string
        institution: string
        links: ShowcaseHelpLink[]
        seenKeys: Set<string>
      }
    > = new Map()

    for (const link of githubOtherLinks) {
      const item = link.showcase_item
      if (!item) continue

      const uid = item.user_id
      if (!groups.has(uid)) {
        groups.set(uid, {
          userId: uid,
          userName: item.user?.full_name ?? '',
          institution: item.user?.institution ?? '',
          links: [],
          seenKeys: new Set(),
        })
      }

      const group = groups.get(uid)!
      // Dedup by normalized GitHub URL
      const key = normalizeGitHubKey(link.url)
      if (key && group.seenKeys.has(key)) continue
      if (key) group.seenKeys.add(key)
      group.links.push(link)
    }

    return Array.from(groups.values())
  }

  function renderGroups(items: ShowcaseHelpLink[], showUser: boolean) {
    const groups = groupByPaper(items)
    if (groups.length === 0) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          暂无内容
        </p>
      )
    }
    return groups.map((group) => (
      <Card key={group.paperId} size="sm">
        <CardContent>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <a
                href={group.paperUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-medium hover:underline"
              >
                {group.paperTitle}
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </a>
              {showUser && (
                <Link
                  to={`/user/${group.userId}`}
                  className="ml-2 text-xs text-muted-foreground hover:underline"
                >
                  {group.userName}
                </Link>
              )}
            </div>
          </div>
          <div className="mt-2 divide-y">
            {group.links.map((link) => (
              <HelpLinkRow
                key={link.id}
                link={link}
                currentUserId={profile?.id}
                ownerId={group.userId}
                initialCompleted={completedIds.has(link.id)}
                githubStarred={githubStarredUrls.has(link.url)}
                compact
              />
            ))}
          </div>
        </CardContent>
      </Card>
    ))
  }

  function renderGitHubTab() {
    const userGroups = groupGitHubByUser()

    if (userGroups.length === 0) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          暂无 GitHub Star 请求
        </p>
      )
    }

    return (
      <div className="space-y-3">
        {/* Bind GitHub banner for unlinked users */}
        {!hasGitHub && profile && (
          <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
            <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">
              绑定 GitHub 账号后可一键 Star
            </p>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={async () => {
                const { error } = await linkGitHub()
                if (error) toast.error('绑定失败', { description: error })
              }}
            >
              <GitHubIcon className="h-4 w-4" />
              绑定 GitHub
            </Button>
          </div>
        )}

        {userGroups.map((group) => (
          <GitHubUserCard
            key={group.userId}
            userId={group.userId}
            userName={group.userName}
            institution={group.institution}
            links={group.links}
            currentUserId={profile?.id}
            completedIds={completedIds}
            githubStarredUrls={githubStarredUrls}
            hasGitHub={hasGitHub}
            onStarred={handleUserStarred}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">互助广场</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            帮社区成员的论文点 star、点赞、upvote，完成后标记圆圈，对方会收到通知。
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {hasGitHub && unstarredGithubCount > 0 && (
            <Button
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={() => handleStarAll()}
              disabled={starringAll}
            >
              {starringAll ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Star 中 {starAllProgress}
                </>
              ) : (
                <>
                  <Star className="h-3.5 w-3.5" />
                  一键全部 Star
                  <span className="ml-0.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px]">
                    {unstarredGithubCount}
                  </span>
                </>
              )}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
            />
            刷新
          </Button>
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">
            所有
            {links.length > 0 && (
              <span className="ml-1 text-muted-foreground">{links.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="github">
            <GitHubIcon className="mr-1 h-3.5 w-3.5" />
            GitHub
            {githubOtherLinks.length > 0 && (
              <span className="ml-1 text-muted-foreground">
                {githubOtherLinks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="others_todo">
            待完成
            {othersTodo.length > 0 && (
              <span className="ml-1 text-muted-foreground">
                {othersTodo.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="others_done">
            已完成
            {othersDone.length > 0 && (
              <span className="ml-1 text-muted-foreground">
                {othersDone.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="mine">
            我的求助
            {myLinks.length > 0 && (
              <span className="ml-1 text-muted-foreground">
                {myLinks.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className="space-y-3 pt-2">{renderGroups(links, true)}</div>
        </TabsContent>

        <TabsContent value="github">
          <div className="pt-2">{renderGitHubTab()}</div>
        </TabsContent>

        <TabsContent value="others_todo">
          <div className="space-y-3 pt-2">
            {renderGroups(othersTodo, true)}
          </div>
        </TabsContent>

        <TabsContent value="others_done">
          <div className="space-y-3 pt-2">
            {renderGroups(othersDone, true)}
          </div>
        </TabsContent>

        <TabsContent value="mine">
          <div className="space-y-3 pt-2">{renderGroups(myLinks, false)}</div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
