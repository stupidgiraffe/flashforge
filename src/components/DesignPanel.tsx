import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import type { PrintSettings, CardTheme, DuplexMode } from '@/lib/types'
import { Palette, TextAlignCenter, TextAlignLeft, TextAlignRight, ArrowsCounterClockwise } from '@phosphor-icons/react'

interface DesignPanelProps {
  settings: PrintSettings
  onUpdate: (updates: Partial<PrintSettings>) => void
}

const CARD_THEMES: { value: CardTheme; label: string; description: string }[] = [
  { value: 'minimal', label: 'Minimal', description: 'Clean white background' },
  { value: 'classroom-cute', label: 'Classroom Cute', description: 'Warm amber tones' },
  { value: 'bold-vocabulary', label: 'Bold Vocabulary', description: 'Blue-purple gradient' },
  { value: 'picture-focus', label: 'Picture Focus', description: 'Subtle gray background' },
  { value: 'ink-saver', label: 'Ink Saver', description: 'Print-friendly white' },
  { value: 'quiz-card', label: 'Quiz Card', description: 'Professional slate' },
]

const FONT_FAMILIES = [
  { value: 'Inter', label: 'Inter (Body)' },
  { value: 'Space Grotesk', label: 'Space Grotesk (Display)' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono (Code)' },
  { value: 'Georgia', label: 'Georgia (Serif)' },
  { value: 'Arial', label: 'Arial (Sans)' },
]

const COLOR_SCHEMES = [
  { name: 'Professional', main: '#1e293b', accent: '#0ea5e9' },
  { name: 'Educational', main: '#0f766e', accent: '#f59e0b' },
  { name: 'Vibrant', main: '#7c3aed', accent: '#ec4899' },
  { name: 'Nature', main: '#166534', accent: '#84cc16' },
  { name: 'Classic', main: '#1e40af', accent: '#dc2626' },
  { name: 'Warm', main: '#ea580c', accent: '#fbbf24' },
]

export function DesignPanel({ settings, onUpdate }: DesignPanelProps) {
  const getAlignmentIcon = () => {
    switch (settings.textAlignment) {
      case 'left':
        return <TextAlignLeft weight="bold" />
      case 'right':
        return <TextAlignRight weight="bold" />
      default:
        return <TextAlignCenter weight="bold" />
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-2">
        <CardHeader className="bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" weight="duotone" />
            Card Style & Theme
          </CardTitle>
          <CardDescription>Choose a visual style for your flashcards</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-3">
            <Label>Theme</Label>
            <div className="grid grid-cols-2 gap-3">
              {CARD_THEMES.map((theme) => (
                <button
                  key={theme.value}
                  onClick={() => onUpdate({ theme: theme.value })}
                  className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                    settings.theme === theme.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-semibold text-sm mb-1">{theme.label}</div>
                  <div className="text-xs text-muted-foreground">{theme.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Color Scheme</Label>
            <div className="grid grid-cols-2 gap-3">
              {COLOR_SCHEMES.map((scheme) => (
                <button
                  key={scheme.name}
                  onClick={() =>
                    onUpdate({
                      mainColor: scheme.main,
                      accentColor: scheme.accent,
                    })
                  }
                  className={`p-3 rounded-lg border-2 flex items-center gap-3 transition-all hover:shadow-md ${
                    settings.mainColor === scheme.main
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex gap-1">
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: scheme.main }}
                    />
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: scheme.accent }}
                    />
                  </div>
                  <span className="text-sm font-medium">{scheme.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="main-color">Custom Main Color</Label>
              <div className="flex gap-2">
                <Input
                  id="main-color"
                  type="color"
                  value={settings.mainColor}
                  onChange={(e) => onUpdate({ mainColor: e.target.value })}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={settings.mainColor}
                  onChange={(e) => onUpdate({ mainColor: e.target.value })}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accent-color">Custom Accent Color</Label>
              <div className="flex gap-2">
                <Input
                  id="accent-color"
                  type="color"
                  value={settings.accentColor}
                  onChange={(e) => onUpdate({ accentColor: e.target.value })}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  type="text"
                  value={settings.accentColor}
                  onChange={(e) => onUpdate({ accentColor: e.target.value })}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader className="bg-muted/30">
          <CardTitle>Typography</CardTitle>
          <CardDescription>Font, size, and alignment settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2">
            <Label htmlFor="font-family">Font Family</Label>
            <Select
              value={settings.fontFamily}
              onValueChange={(value) => onUpdate({ fontFamily: value })}
            >
              <SelectTrigger id="font-family">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Font Size: {settings.fontSize}px</Label>
            <Slider
              value={[settings.fontSize]}
              onValueChange={([value]) => onUpdate({ fontSize: value })}
              min={10}
              max={36}
              step={1}
              className="py-4"
            />
          </div>

          <div className="space-y-2">
            <Label>Text Alignment</Label>
            <div className="flex gap-2">
              {(['left', 'center', 'right'] as const).map((align) => (
                <button
                  key={align}
                  onClick={() => onUpdate({ textAlignment: align })}
                  className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center transition-all ${
                    settings.textAlignment === align
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {align === 'left' && <TextAlignLeft weight="bold" />}
                  {align === 'center' && <TextAlignCenter weight="bold" />}
                  {align === 'right' && <TextAlignRight weight="bold" />}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader className="bg-muted/30">
          <CardTitle>Card Details</CardTitle>
          <CardDescription>Borders, corners, and additional options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="show-border">Show Border</Label>
                <p className="text-xs text-muted-foreground">Add border around cards</p>
              </div>
              <Switch
                id="show-border"
                checked={settings.showBorder}
                onCheckedChange={(checked) => onUpdate({ showBorder: checked })}
              />
            </div>

            {settings.showBorder && (
              <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                <Label>Border Thickness: {settings.borderThickness}px</Label>
                <Slider
                  value={[settings.borderThickness]}
                  onValueChange={([value]) => onUpdate({ borderThickness: value })}
                  min={1}
                  max={8}
                  step={1}
                  className="py-4"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="show-rounded">Rounded Corners</Label>
                <p className="text-xs text-muted-foreground">Make card corners rounded</p>
              </div>
              <Switch
                id="show-rounded"
                checked={settings.showRoundedCorners}
                onCheckedChange={(checked) => onUpdate({ showRoundedCorners: checked })}
              />
            </div>

            {settings.showRoundedCorners && (
              <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                <Label>Corner Radius: {settings.cornerRadius}px</Label>
                <Slider
                  value={[settings.cornerRadius]}
                  onValueChange={([value]) => onUpdate({ cornerRadius: value })}
                  min={0}
                  max={24}
                  step={2}
                  className="py-4"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="show-numbering">Card Numbering</Label>
                <p className="text-xs text-muted-foreground">Show number on each card</p>
              </div>
              <Switch
                id="show-numbering"
                checked={settings.showNumbering}
                onCheckedChange={(checked) => onUpdate({ showNumbering: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="show-set-title">Set Title on Cards</Label>
                <p className="text-xs text-muted-foreground">Display set name on each card</p>
              </div>
              <Switch
                id="show-set-title"
                checked={settings.showSetTitle}
                onCheckedChange={(checked) => onUpdate({ showSetTitle: checked })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="footer-text">Footer Text (optional)</Label>
            <Input
              id="footer-text"
              value={settings.footerText || ''}
              onChange={(e) => onUpdate({ footerText: e.target.value })}
              placeholder="e.g., Teacher Name, Class Period"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader className="bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            <ArrowsCounterClockwise className="w-5 h-5" weight="duotone" />
            Double-Sided Printing
          </CardTitle>
          <CardDescription>Configure duplex printing alignment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="duplex-mode">Duplex Mode</Label>
            <Select
              value={settings.duplexMode || 'long-edge'}
              onValueChange={(value: DuplexMode) => onUpdate({ duplexMode: value })}
            >
              <SelectTrigger id="duplex-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="long-edge">Long-Edge Flip (standard portrait)</SelectItem>
                <SelectItem value="short-edge">Short-Edge Flip (landscape / flip-up)</SelectItem>
                <SelectItem value="manual">Manual (front pages only)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {settings.duplexMode === 'manual'
                ? 'Only front sides will be printed. Back sides must be printed separately.'
                : settings.duplexMode === 'short-edge'
                ? 'Use for landscape orientation or flip-up binding. Cards are mirrored vertically.'
                : 'Standard duplex for portrait pages. Cards are mirrored horizontally after flipping.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2">
        <CardHeader className="bg-muted/30">
          <CardTitle>Image Settings</CardTitle>
          <CardDescription>Control how images are displayed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2">
            <Label htmlFor="image-fit">Image Fit</Label>
            <Select
              value={settings.imageFit}
              onValueChange={(value: any) => onUpdate({ imageFit: value })}
            >
              <SelectTrigger id="image-fit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">Cover (fill space)</SelectItem>
                <SelectItem value="contain">Contain (fit within)</SelectItem>
                <SelectItem value="center">Center (natural size)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
