import { useState, useEffect } from 'react'
import { Loader2, Check, Download, Star, GitFork, Archive } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GitHubIcon } from '@/components/shared/GitHubIcon'
import { fetchMyGitHubRepos, type GitHubRepo } from '@/lib/api/githubRepos'
import { batchCreateShowcaseItems } from '@/lib/api/showcase'
import { createHelpLink } from '@/lib/api/helpLinks'
import { toast } from 'sonner'
import type { ShowcaseItem, HelpLinkPlatform } from '@/types/database'

interface RepoImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  existingGitHubUrls: Set<string>
  onImported: (items: ShowcaseItem[]) => void
}

export function RepoImportDialog({
  open,
  onOpenChange,
  userId,
  existingGitHubUrls,
  onImported,
}: RepoImportDialogProps) {
  const [repos, setRepos] = useState<GitHubRepo[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [showForks, setShowForks] = useState(false)
  const [hasNext, setHasNext] = useState(false)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      loadRepos(1, true)
    } else {
      setRepos([])
      setSelected(new Set())
      setPage(1)
      setHasNext(false)
      setErrorMsg(null)
    }
  }, [open])

  async function loadRepos(p: number, reset: boolean) {
    if (reset) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }
    setErrorMsg(null)

    const result = await fetchMyGitHubRepos({ page: p, perPage: 100 })

    if (result.error) {
      setErrorMsg(result.error)
      if (result.code === 'TOKEN_EXPIRED') {
        toast.error('GitHub 授权已过期', { description: '请重新绑定 GitHub 账号' })
      }
    }

    if (reset) {
      setRepos(result.repos)
    } else {
      setRepos((prev) => [...prev, ...result.repos])
    }
    setHasNext(result.hasNext)
    setPage(p)
    setLoading(false)
    setLoadingMore(false)
  }

  function isImported(repo: GitHubRepo): boolean {
    return existingGitHubUrls.has(repo.full_name.toLowerCase())
  }

  function toggleSelect(fullName: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(fullName)) {
        next.delete(fullName)
      } else {
        next.add(fullName)
      }
      return next
    })
  }

  function toggleSelectAll() {
    const selectable = filteredRepos.filter((r) => !isImported(r))
    const allSelected = selectable.every((r) => selected.has(r.full_name))
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const r of selectable) next.delete(r.full_name)
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        for (const r of selectable) next.add(r.full_name)
        return next
      })
    }
  }

  const filteredRepos = showForks ? repos : repos.filter((r) => !r.fork)

  const selectableCount = filteredRepos.filter(
    (r) => selected.has(r.full_name) && !isImported(r),
  ).length

  async function handleImport() {
    const toImport = filteredRepos.filter(
      (r) => selected.has(r.full_name) && !isImported(r),
    )
    if (toImport.length === 0) return

    setImporting(true)

    // Batch create showcase items
    const items = toImport.map((r, i) => ({
      user_id: userId,
      item_type: 'github' as const,
      title: r.full_name,
      url: r.html_url,
      description: r.description ?? undefined,
      stars_count: r.stargazers_count,
      sort_order: i,
    }))

    const { data, error } = await batchCreateShowcaseItems(items)
    if (error) {
      toast.error('导入失败', { description: error })
      setImporting(false)
      return
    }

    // Auto-create help links for each imported item
    let helpLinkCount = 0
    for (const item of data) {
      const { error: linkErr } = await createHelpLink({
        item_id: item.id,
        title: item.title,
        url: item.url,
        platform: 'github' as HelpLinkPlatform,
        action_label: '点 Star',
      })
      if (!linkErr) helpLinkCount++
    }

    toast.success(`成功导入 ${data.length} 个 GitHub 项目`, {
      description: helpLinkCount > 0
        ? `自动创建 ${helpLinkCount} 条求助链接`
        : undefined,
    })

    onImported(data)
    setImporting(false)
    onOpenChange(false)
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitHubIcon className="h-5 w-5" />
            导入 GitHub 仓库
          </DialogTitle>
          <DialogDescription>
            从你的 GitHub 账号选择仓库批量导入
          </DialogDescription>
        </DialogHeader>

        {/* Filter toggle */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showForks}
              onChange={(e) => setShowForks(e.target.checked)}
              className="rounded border-muted-foreground/30"
            />
            显示 Fork 项目
          </label>
          {filteredRepos.length > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={toggleSelectAll}
            >
              {filteredRepos.filter((r) => !isImported(r)).every((r) => selected.has(r.full_name))
                ? '取消全选'
                : '全选'}
            </button>
          )}
        </div>

        <div className="max-h-72 overflow-y-auto -mx-4 px-4">
          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              加载仓库列表中...
            </div>
          )}

          {/* Error state */}
          {!loading && errorMsg && repos.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {errorMsg}
            </p>
          )}

          {/* Empty state */}
          {!loading && !errorMsg && repos.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              暂无仓库
            </p>
          )}

          {/* Repo list */}
          {!loading && filteredRepos.length > 0 && (
            <ul className="space-y-1">
              {filteredRepos.map((repo) => {
                const imported = isImported(repo)
                const checked = selected.has(repo.full_name)

                return (
                  <li key={repo.full_name}>
                    <button
                      type="button"
                      className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                        imported
                          ? 'cursor-default border-muted bg-muted/30 opacity-60'
                          : checked
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-transparent hover:bg-accent/50'
                      }`}
                      onClick={() => {
                        if (!imported) toggleSelect(repo.full_name)
                      }}
                      disabled={imported}
                    >
                      <div className="flex items-start gap-2">
                        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px]">
                          {imported ? (
                            <Check className="h-3 w-3 text-muted-foreground" />
                          ) : checked ? (
                            <Check className="h-3 w-3 text-primary" />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug">
                            {repo.full_name}
                          </p>
                          {repo.description && (
                            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                              {repo.description}
                            </p>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {imported && (
                              <Badge variant="secondary" className="text-[10px]">
                                已导入
                              </Badge>
                            )}
                            {repo.archived && (
                              <Badge variant="secondary" className="text-[10px]">
                                <Archive className="mr-0.5 h-2.5 w-2.5" />
                                已归档
                              </Badge>
                            )}
                            {repo.fork && (
                              <Badge variant="outline" className="text-[10px]">
                                <GitFork className="mr-0.5 h-2.5 w-2.5" />
                                Fork
                              </Badge>
                            )}
                            {repo.language && (
                              <Badge variant="outline" className="text-[10px]">
                                {repo.language}
                              </Badge>
                            )}
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Star className="h-2.5 w-2.5" />
                              {repo.stargazers_count}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDate(repo.updated_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {/* Load more */}
          {!loading && hasNext && (
            <div className="flex justify-center py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => loadRepos(page + 1, false)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                加载更多
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleImport}
            disabled={selectableCount === 0 || importing}
            className="gap-1.5"
          >
            {importing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            导入 {selectableCount > 0 ? `${selectableCount} 个项目` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
