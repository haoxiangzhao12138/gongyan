import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { updateProfile } from '@/lib/api/profiles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

export default function ProfileEdit() {
  const { profile, refreshProfile } = useAuthStore()
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
    navigate(`/user/${profile.id}`)
    setLoading(false)
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
    </div>
  )
}
