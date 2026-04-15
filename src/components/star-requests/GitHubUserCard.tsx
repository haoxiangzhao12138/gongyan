import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { HelpLinkRow } from './HelpLinkRow'
import { starGitHubRepos } from '@/lib/api/github'
import { completeHelpLink } from '@/lib/api/helpLinks'
import { Star, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { ShowcaseHelpLink } from '@/types/database'

interface GitHubUserCardProps {
  userId: string
  userName: string
  institution: string
  links: ShowcaseHelpLink[]
  currentUserId: string | undefined
  completedIds: Set<string>
  githubStarredUrls: Set<string>
  hasGitHub: boolean
  onStarred: (linkIds: string[], urls: string[]) => void
}

export function GitHubUserCard({
  userId,
  userName,
  institution,
  links,
  currentUserId,
  completedIds,
  githubStarredUrls,
  hasGitHub,
  onStarred,
}: GitHubUserCardProps) {
  const [starring, setStarring] = useState(false)
  const [progress, setProgress] = useState('')

  const isOwn = currentUserId === userId

  // Unstarred links for this user
  const unstarredLinks = links.filter(
    (l) => !completedIds.has(l.id) && !githubStarredUrls.has(l.url)
  )

  async function handleStarUser() {
    if (!currentUserId || !hasGitHub || unstarredLinks.length === 0) return
    setStarring(true)

    const urls = unstarredLinks.map((l) => l.url)
    setProgress(`0/${urls.length}`)

    const results = await starGitHubRepos(urls, (done, total) => {
      setProgress(`${done}/${total}`)
    })

    const completedLinkIds: string[] = []
    const starredUrls: string[] = []

    await Promise.all(
      unstarredLinks.map(async (link) => {
        if (results[link.url]) {
          starredUrls.push(link.url)
          const { error } = await completeHelpLink(link.id, currentUserId)
          if (!error) {
            completedLinkIds.push(link.id)
          }
        }
      })
    )

    setStarring(false)
    setProgress('')

    if (completedLinkIds.length > 0) {
      toast.success(`成功 Star ${completedLinkIds.length} 个项目`)
      onStarred(completedLinkIds, starredUrls)
    } else {
      toast.error('Star 失败', {
        description: 'GitHub 授权可能已过期，请到个人资料页重新绑定 GitHub',
      })
    }
  }

  return (
    <Card size="sm">
      <CardContent>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/user/${userId}`}
              className="font-medium hover:underline"
            >
              {userName}
            </Link>
            {institution && (
              <span className="ml-2 text-xs text-muted-foreground">
                {institution}
              </span>
            )}
          </div>
          {!isOwn && hasGitHub && unstarredLinks.length > 0 && (
            <Button
              variant="default"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={handleStarUser}
              disabled={starring}
            >
              {starring ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {progress}
                </>
              ) : (
                <>
                  <Star className="h-3.5 w-3.5" />
                  Star 全部
                  <span className="ml-0.5 rounded-full bg-primary-foreground/20 px-1.5 py-0.5 text-[10px]">
                    {unstarredLinks.length}
                  </span>
                </>
              )}
            </Button>
          )}
        </div>

        <div className="mt-2 divide-y">
          {links.map((link) => (
            <HelpLinkRow
              key={link.id}
              link={link}
              currentUserId={currentUserId}
              ownerId={userId}
              initialCompleted={completedIds.has(link.id)}
              githubStarred={githubStarredUrls.has(link.url)}
              onCompleted={() => onStarred([], [])}
              compact
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
