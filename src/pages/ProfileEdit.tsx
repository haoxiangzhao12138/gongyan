import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { updateProfile } from '@/lib/api/profiles'
import { validateHfToken } from '@/lib/api/huggingface'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { ShowcaseEditSection } from '@/components/showcase/ShowcaseEditSection'
import { GitHubIcon } from '@/components/shared/GitHubIcon'


export default function ProfileEdit() {
  const { profile, refreshProfile, linkGitHub, unlinkGitHub, linkHuggingFace, unlinkHuggingFace, getHfToken } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [institution, setInstitution] = useState(profile?.institution ?? '')
  const [researchField, setResearchField] = useState(profile?.research_field ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [googleScholarUrl, setGoogleScholarUrl] = useState(profile?.google_scholar_url ?? '')
  const [hfToken, setHfToken] = useState('')
  const [hfUsername, setHfUsername] = useState<string | null>(null)
  const [hfLinking, setHfLinking] = useState(false)
  const [hfLoading, setHfLoading] = useState(true)

  // Load HuggingFace binding state on mount
  useEffect(() => {
    async function loadHfState() {
      const token = await getHfToken()
      if (token) {
        // Token exists in DB — validate and get username
        const { valid, username } = await validateHfToken(token)
        if (valid) {
          setHfUsername(username ?? 'linked')
        }
      }
      setHfLoading(false)
    }
    loadHfState()
  }, [getHfToken])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setLoading(true)
    try {
      const { error } = await updateProfile(profile.id, {
        full_name: fullName,
        institution,
        research_field: researchField,
        bio,
        google_scholar_url: googleScholarUrl || null,
      })

      if (error) {
        toast.error('更新失败', { description: error })
        return
      }

      await refreshProfile()
      toast.success('个人资料已更新')
      navigate(`/user/${profile.id}`)
    } catch (err) {
      toast.error('保存失败', { description: err instanceof Error ? err.message : '网络错误' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(-1)}
        className="gap-1.5"
      >
        <ArrowLeft className="h-4 w-4" />
        返回
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>编辑个人资料</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">姓名</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="institution">所属机构</Label>
              <Input
                id="institution"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="researchField">研究方向</Label>
              <Input
                id="researchField"
                value={researchField}
                onChange={(e) => setResearchField(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">个人简介</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="googleScholarUrl">Google Scholar 主页</Label>
              <Input
                id="googleScholarUrl"
                type="url"
                value={googleScholarUrl}
                onChange={(e) => setGoogleScholarUrl(e.target.value)}
                placeholder="https://scholar.google.com/citations?user=..."
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(-1)}
                className="flex-1"
              >
                取消
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GitHub 账号</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {profile?.github_username ? (
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="gap-1.5 py-1">
                <GitHubIcon className="h-3.5 w-3.5" />
                @{profile.github_username}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={async () => {
                  const { error } = await unlinkGitHub()
                  if (error) {
                    toast.error('解绑失败', { description: error })
                  } else {
                    toast.success('GitHub 已解绑')
                  }
                }}
              >
                解绑
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={async () => {
                const { error } = await linkGitHub()
                if (error) toast.error('绑定失败', { description: error })
              }}
            >
              <GitHubIcon className="h-4 w-4" />
              绑定 GitHub
            </Button>
          )}
          <Separator />
          <p className="text-xs text-muted-foreground">
            绑定后可在互助广场一键 Star GitHub 项目
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>HuggingFace 账号</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {hfLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              检查绑定状态...
            </div>
          ) : hfUsername ? (
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="gap-1.5 py-1">
                🤗 @{hfUsername}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={async () => {
                  const { error } = await unlinkHuggingFace()
                  if (error) {
                    toast.error('解绑失败', { description: error })
                  } else {
                    setHfUsername(null)
                    setHfToken('')
                    toast.success('HuggingFace 已解绑')
                  }
                }}
              >
                解绑
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={hfToken}
                  onChange={(e) => setHfToken(e.target.value)}
                  placeholder="粘贴 HuggingFace Token (hf_...)"
                  type="password"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 gap-1.5"
                  disabled={hfLinking || !hfToken.trim()}
                  onClick={async () => {
                    setHfLinking(true)
                    const { error, username } = await linkHuggingFace(hfToken.trim())
                    if (error) {
                      toast.error('绑定失败', { description: error })
                    } else {
                      setHfUsername(username ?? 'linked')
                      toast.success('HuggingFace 已绑定')
                    }
                    setHfLinking(false)
                  }}
                >
                  {hfLinking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '绑定'}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                在{' '}
                <a
                  href="https://huggingface.co/settings/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  HuggingFace Settings → Tokens
                </a>
                {' '}创建 Token，绑定后可一键 Upvote 论文
              </p>
            </div>
          )}
          <Separator />
          <p className="text-xs text-muted-foreground">
            绑定后可在互助广场一键 Upvote HuggingFace 论文
          </p>
        </CardContent>
      </Card>

      {profile && <ShowcaseEditSection userId={profile.id} />}
    </div>
  )
}
