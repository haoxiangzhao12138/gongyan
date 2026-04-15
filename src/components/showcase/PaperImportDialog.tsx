import { useState, useCallback, useEffect } from 'react'
import { Search, Loader2, BookOpen, Check, ArrowLeft, User } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  searchDblpAuthors,
  fetchDblpWorksByAuthor,
  type DblpWork,
  type DblpAuthor,
} from '@/lib/api/dblp'
import { enrichPaperIds } from '@/lib/api/semanticScholar'
import { fetchHfPaperByArxiv } from '@/lib/api/huggingface'
import { batchCreateShowcaseItems, updateShowcaseItemArxiv } from '@/lib/api/showcase'
import { batchCreateRepoLinks } from '@/lib/api/paperRepoLinks'
import { createHelpLink } from '@/lib/api/helpLinks'
import { toast } from 'sonner'
import type { ShowcaseItem, HelpLinkPlatform } from '@/types/database'

interface PaperImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  authorName: string
  existingDois: Set<string>
  onImported: (items: ShowcaseItem[]) => void
}

export function PaperImportDialog({
  open,
  onOpenChange,
  userId,
  authorName,
  existingDois,
  onImported,
}: PaperImportDialogProps) {
  const [query, setQuery] = useState(authorName)
  const [authors, setAuthors] = useState<DblpAuthor[]>([])
  const [selectedAuthor, setSelectedAuthor] = useState<DblpAuthor | null>(null)
  const [works, setWorks] = useState<DblpWork[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [searching, setSearching] = useState(false)
  const [loadingWorks, setLoadingWorks] = useState(false)
  const [importing, setImporting] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => { setQuery(authorName) }, [authorName])

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim()
    if (!trimmed) return

    setSearching(true)
    setSelectedAuthor(null)
    setWorks([])
    setSelected(new Set())
    setSearched(false)

    const result = await searchDblpAuthors(trimmed)
    if (result) {
      setAuthors(result)
      if (result.length === 1) {
        await selectAuthor(result[0])
      }
    } else {
      setAuthors([])
      toast.error('搜索失败，请稍后重试')
    }
    setSearched(true)
    setSearching(false)
  }, [query])

  async function selectAuthor(author: DblpAuthor) {
    setSelectedAuthor(author)
    setLoadingWorks(true)
    setSelected(new Set())

    const result = await fetchDblpWorksByAuthor(author.pid)
    if (result) {
      setWorks(result.works)
      setTotalCount(result.totalCount)
    } else {
      setWorks([])
      setTotalCount(0)
      toast.error('获取论文列表失败')
    }
    setLoadingWorks(false)
  }

  function handleBackToAuthors() {
    setSelectedAuthor(null)
    setWorks([])
    setSelected(new Set())
  }

  function toggleSelect(dblpKey: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(dblpKey)) {
        next.delete(dblpKey)
      } else {
        next.add(dblpKey)
      }
      return next
    })
  }

  function isImported(work: DblpWork): boolean {
    return work.doi !== null && existingDois.has(work.doi)
  }

  async function handleImport() {
    const toImport = works.filter(
      (w) => selected.has(w.dblp_key) && !isImported(w),
    )
    if (toImport.length === 0) return

    setImporting(true)
    const items = toImport.map((w, i) => ({
      user_id: userId,
      item_type: 'paper' as const,
      title: w.title,
      url: w.doi ? `https://doi.org/${w.doi}` : w.url || `https://dblp.org/rec/${w.dblp_key}`,
      doi: w.doi ?? undefined,
      year: w.year ?? undefined,
      venue: w.venue ?? undefined,
      sort_order: i,
    }))

    const { data, error } = await batchCreateShowcaseItems(items)
    if (error) {
      toast.error('导入失败', { description: error })
      setImporting(false)
      return
    }

    toast.success(`成功导入 ${data.length} 篇论文`)
    onImported(data)
    setImporting(false)
    onOpenChange(false)

    // Async post-import enrichment (dialog already closed)
    runEnrichment(data).catch(() => {
      toast.error('论文信息补充失败', { description: '部分论文的关联信息未能获取' })
    })
  }

  /** Post-import: DOI → arXiv → HuggingFace → repo links + help links */
  async function runEnrichment(importedItems: ShowcaseItem[]) {
    let repoCount = 0
    let errorCount = 0

    for (const item of importedItems) {
      if (!item.doi) continue

      // Step 1: DOI → arXiv ID via Semantic Scholar
      const enriched = await enrichPaperIds(item.doi)
      if (!enriched?.arxivId) continue

      // Save arxiv_id to DB
      const { error: arxivErr } = await updateShowcaseItemArxiv(item.id, enriched.arxivId)
      if (arxivErr) { errorCount++; continue }

      // Step 2: arXiv ID → HuggingFace paper info
      const hfPaper = await fetchHfPaperByArxiv(enriched.arxivId)

      // Step 3: Create repo links if GitHub repo found
      if (hfPaper?.github_repo) {
        const repoUrl = hfPaper.github_repo.startsWith('http')
          ? hfPaper.github_repo
          : `https://github.com/${hfPaper.github_repo}`
        const repoName = hfPaper.github_repo.replace('https://github.com/', '')

        const { error: repoErr } = await batchCreateRepoLinks([{
          paper_item_id: item.id,
          github_url: repoUrl,
          repo_name: repoName,
          stars_count: hfPaper.github_stars ?? 0,
          source: 'huggingface',
        }])
        if (!repoErr) repoCount++
        else errorCount++
      }

      // Step 4: Auto-create HuggingFace help link
      if (hfPaper) {
        const { error: hfErr } = await createHelpLink({
          item_id: item.id,
          title: `HuggingFace Papers`,
          url: `https://huggingface.co/papers/${enriched.arxivId}`,
          platform: 'huggingface' as HelpLinkPlatform,
          action_label: '点 Upvote',
        })
        if (hfErr) errorCount++
      }

      // Step 5: Auto-create AlphaXiv help link
      const { error: axErr } = await createHelpLink({
        item_id: item.id,
        title: 'AlphaXiv',
        url: `https://alphaxiv.org/abs/${enriched.arxivId}`,
        platform: 'alphaxiv' as HelpLinkPlatform,
        action_label: '点赞',
      })
      if (axErr) errorCount++
    }

    if (repoCount > 0) {
      toast.info(`发现 ${repoCount} 个关联 GitHub 项目`, { description: '可在论文卡片中查看' })
    }
    if (errorCount > 0) {
      toast.warning(`${errorCount} 项信息补充失败`, { description: '部分关联数据未能保存' })
    }
  }

  const selectableCount = works.filter(
    (w) => selected.has(w.dblp_key) && !isImported(w),
  ).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>导入论文</DialogTitle>
          <DialogDescription>
            通过 DBLP 搜索作者，选择论文批量导入
          </DialogDescription>
        </DialogHeader>

        {/* Search bar */}
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="输入作者姓名（拼音或英文名）"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearch()
            }}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleSearch}
            disabled={searching || !query.trim()}
            className="shrink-0 gap-1.5"
          >
            {searching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Search className="h-3.5 w-3.5" />
            )}
            搜索
          </Button>
        </div>

        <div className="max-h-72 overflow-y-auto -mx-4 px-4">
          {/* Loading */}
          {(searching || loadingWorks) && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {searching ? '搜索作者中...' : '加载论文中...'}
            </div>
          )}

          {/* No results */}
          {!searching && !loadingWorks && searched && !selectedAuthor && authors.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              未找到匹配的作者，请尝试不同的姓名
            </p>
          )}

          {/* Author list (step 1) */}
          {!searching && !loadingWorks && !selectedAuthor && authors.length > 1 && (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                找到 {authors.length} 位作者，请选择：
              </p>
              <ul className="space-y-1">
                {authors.map((author) => (
                  <li key={author.pid}>
                    <button
                      type="button"
                      className="w-full rounded-lg border border-transparent p-2.5 text-left transition-colors hover:bg-accent/50"
                      onClick={() => selectAuthor(author)}
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{author.display_name}</p>
                          {author.affiliation && (
                            <p className="text-xs text-muted-foreground">
                              {author.affiliation}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Works list (step 2) */}
          {!searching && !loadingWorks && selectedAuthor && (
            <>
              {authors.length > 1 && (
                <button
                  type="button"
                  className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleBackToAuthors}
                >
                  <ArrowLeft className="h-3 w-3" />
                  返回作者列表
                </button>
              )}
              <p className="mb-2 text-xs text-muted-foreground">
                {selectedAuthor.display_name} — 共 {totalCount} 篇（显示前 {works.length} 篇，按年份排序）
              </p>
              {works.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  该作者暂无论文记录
                </p>
              ) : (
                <ul className="space-y-1">
                  {works.map((work) => {
                    const imported = isImported(work)
                    const checked = selected.has(work.dblp_key)

                    return (
                      <li key={work.dblp_key}>
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
                            if (!imported) toggleSelect(work.dblp_key)
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
                              <p className="text-sm font-medium leading-snug line-clamp-2">
                                {work.title}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                {imported && (
                                  <Badge variant="secondary" className="text-[10px]">
                                    已导入
                                  </Badge>
                                )}
                                {work.year && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {work.year}
                                  </Badge>
                                )}
                                {work.venue && (
                                  <span className="truncate text-xs text-muted-foreground">
                                    {work.venue}
                                  </span>
                                )}
                                {work.type && (
                                  <span className="text-xs text-muted-foreground">
                                    · {work.type}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
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
              <BookOpen className="h-3.5 w-3.5" />
            )}
            导入 {selectableCount > 0 ? `${selectableCount} 篇` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
