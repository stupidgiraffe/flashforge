import { Sparkle, Student } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { STARTER_TEMPLATES } from '@/lib/starter-sets'

interface StarterPackBrowserProps {
  onUseTemplate: (templateId: string) => void
}

export function StarterPackBrowser({ onUseTemplate }: StarterPackBrowserProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-2xl border bg-card/70 p-4 shadow-sm">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkle className="h-6 w-6" weight="fill" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Starter packs</p>
          <p className="text-sm text-muted-foreground">
            Start from a purpose-built teaching pack instead of a blank set. Each pack is editable after import.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {STARTER_TEMPLATES.map((template) => (
          <Card key={template.id} className="border-2 shadow-md transition-colors hover:border-primary/40">
            <CardHeader className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg leading-tight">{template.title}</CardTitle>
                <Badge variant="secondary" className="shrink-0 gap-1.5">
                  <Student className="h-3.5 w-3.5" weight="bold" />
                  {template.audience}
                </Badge>
              </div>
              <CardDescription>{template.subtitle}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{template.description}</p>
              <div className="flex flex-wrap gap-2">
                {template.tags.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
              <Button className="w-full" onClick={() => onUseTemplate(template.id)}>
                Use Starter Pack
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
