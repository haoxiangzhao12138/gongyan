import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface CitationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  citation: string
}

export function CitationDialog({
  open,
  onOpenChange,
  title,
  citation,
}: CitationDialogProps) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(citation)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>引用 BibTeX</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>
        <pre className="max-h-60 overflow-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
          <code>{citation}</code>
        </pre>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopy}>
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                已复制
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                复制
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
