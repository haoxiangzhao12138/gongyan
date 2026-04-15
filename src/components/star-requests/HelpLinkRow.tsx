import { useState } from 'react'
import { ExternalLink, CheckCircle2, Circle, Star, Loader2, ThumbsUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { completeHelpLink, uncompleteHelpLink } from '@/lib/api/helpLinks'
import { starGitHubRepo } from '@/lib/api/github'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/lib/utils'
import { PLATFORM_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import type { ShowcaseHelpLink } from '@/types/database'

interface HelpLinkRowProps {
  link: ShowcaseHelpLink
  currentUserId: string | undefined
  ownerId: string
  initialCompleted: boolean
  githubStarred?: boolean
  compact?: boolean
}

export function HelpLinkRow({
  link,
  currentUserId,
  initialCompleted,
  githubStarred = false,
  compact = false,
}: HelpLinkRowProps) {
  const [completed, setCompleted] = useState(initialCompleted)
  const [count, setCount] = useState(link.completion_count)
  const [pending, setPending] = useState(false)
  const [starring, setStarring] = useState(false)
  const [starred, setStarred] = useState(githubStarred)

  const profile = useAuthStore((s) => s.profile)
  const hasGitHub = !!profile?.github_username

  const isGitHub = link.platform === 'github'
  const isHuggingFace = link.platform === 'huggingface'
  const disabled = !currentUserId || pending

  async function handleToggle() {
    if (disabled) return

    const next = !completed
    setCompleted(next)
    setCount((c) => c + (next ? 1 : -1))
    setPending(true)

    const { error } = next
      ? await completeHelpLink(link.id, currentUserId!)
      : await uncompleteHelpLink(link.id, currentUserId!)

    if (error) {
      setCompleted(!next)
      setCount((c) => c + (next ? -1 : 1))
    }
    setPending(false)
  }

  async function handleOneClickStar() {
    if (!currentUserId) return
    setStarring(true)

    if (!hasGitHub) {
      const { error } = await useAuthStore.getState().linkGitHub()
      if (error) {
        toast.error('GitHub 绑定失败', { description: error })
        setStarring(false)
      }
      return
    }

    const result = await starGitHubRepo(link.url)

    if (result.code === 'TOKEN_EXPIRED') {
      toast.error('GitHub 授权已过期', { description: '请重新绑定 GitHub 账号' })
      await useAuthStore.getState().refreshProfile()
      setStarring(false)
      return
    }

    if (!result.success) {
      toast.error('Star 失败', { description: result.error ?? '未知错误' })
      setStarring(false)
      return
    }

    setStarred(true)
    toast.success('Star 成功！')

    if (!completed) {
      setCompleted(true)
      setCount((c) => c + 1)
      setPending(true)
      const { error } = await completeHelpLink(link.id, currentUserId)
      if (error) {
        setCompleted(false)
        setCount((c) => c - 1)
      }
      setPending(false)
    }

    setStarring(false)
  }

  /** Open HF paper page and auto-mark as completed */
  async function handleHfUpvote() {
    if (!currentUserId) return

    // Open the HuggingFace paper page in a new tab for manual upvote
    window.open(link.url, '_blank', 'noopener,noreferrer')

    // Auto-mark as completed since user is being directed to the page
    if (!completed) {
      setCompleted(true)
      setCount((c) => c + 1)
      setPending(true)
      const { error } = await completeHelpLink(link.id, currentUserId)
      if (error) {
        setCompleted(false)
        setCount((c) => c - 1)
      }
      setPending(false)
    }
  }

  return (
    <div className={cn('flex items-center gap-2', compact ? 'py-1' : 'py-1.5')}>
      <button
        className={cn(
          'shrink-0 transition-colors',
          completed ? 'text-emerald-500' : 'text-muted-foreground/40 hover:text-muted-foreground',
          disabled && 'cursor-default'
        )}
        onClick={handleToggle}
        disabled={disabled}
      >
        {completed ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
      </button>

      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm hover:underline"
      >
        {link.title || PLATFORM_LABELS[link.platform] || link.platform}
        <ExternalLink className="h-3 w-3 text-muted-foreground" />
      </a>

      <Badge variant="secondary" className="text-[10px]">
        {PLATFORM_LABELS[link.platform] ?? link.platform}
      </Badge>
      <Badge variant="outline" className="text-[10px]">
        {link.action_label}
      </Badge>

      {isGitHub && currentUserId && (
        <Button
          variant={starred || completed ? 'ghost' : 'secondary'}
          size="sm"
          className="ml-1 gap-1 text-xs h-6 px-2"
          onClick={handleOneClickStar}
          disabled={starring || (starred && completed)}
        >
          {starring ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Star className={cn('h-3 w-3', (starred || completed) && 'fill-amber-400 text-amber-400')} />
          )}
          {!hasGitHub ? '绑定 GitHub' : starred || completed ? '已 Star' : '一键 Star'}
        </Button>
      )}

      {isHuggingFace && currentUserId && (
        <Button
          variant={completed ? 'ghost' : 'secondary'}
          size="sm"
          className="ml-1 gap-1 text-xs h-6 px-2"
          onClick={handleHfUpvote}
          disabled={pending || completed}
        >
          <ThumbsUp className={cn('h-3 w-3', completed && 'fill-blue-400 text-blue-400')} />
          {completed ? '已 Upvote' : '去 Upvote'}
        </Button>
      )}

      <span className="ml-auto text-xs text-muted-foreground">{count} 人</span>
    </div>
  )
}
