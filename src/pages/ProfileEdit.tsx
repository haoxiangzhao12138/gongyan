import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { updateProfile } from '@/lib/api/profiles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import { ShowcaseEditSection } from '@/components/showcase/ShowcaseEditSection'
import { GitHubIcon } from '@/components/shared/GitHubIcon'


export default function ProfileEdit() {
  const { profile, refreshProfile, linkGitHub, unlinkGitHub } = useAuthStore()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [institution, setInstitution] = useState(profile?.institution ?? '')
  const [researchField, setResearchField] = useState(profile?.research_field ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile) return

    setLoading(true)
    const { error } = await updateProfile(profile.id, {
      full_name: fullName,
      institution,
      research_field: researchField,
      bio,
    })

    if (error) {
      toast.error('更新失败', { description: error })
      setLoading(false)
      return
    }

    await refreshProfile()
    toast.success('个人资料已更新')
    setLoading(false)
    navigate(`/user/${profile.id}`)
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

      {profile && <ShowcaseEditSection userId={profile.id} />}
    </div>
  )
}
