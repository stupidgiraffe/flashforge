import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import type { PrintSettings, CardTheme, DuplexMode, CardType, CardsPerPage, Orientation, PaperSize } from '@/lib/types'
import { Palette, TextAlignCenter, TextAlignLeft, TextAlignRight, ArrowsCounterClockwise, Cards } from '@phosphor-icons/react'

interface DesignPanelProps {
  settings: PrintSettings
  cardType: CardType
  onUpdate: (updates: Partial<PrintSettings>) => void
  onUpdateCardType: (cardType: CardType) => void
  onResetToDefaults: () => void
}

const CARD_THEMES: { value: CardTheme; label: string; description: string }[] = [
  { value: 'teacher-pro', label: 'Teacher Pro', description: 'Clean blue editorial styling' },
  { value: 'minimal', label: 'Minimal', description: 'Quiet modern neutral' },
  { value: 'classroom-cute', label: 'Classroom Cute', description: 'Warm and friendly' },
  { value: 'bold-vocabulary', label: 'Bold Vocabulary', description: 'High-energy contrast' },
  { value: 'picture-focus', label: 'Picture Focus', description: 'Let visuals lead' },
  { value: 'quiz-card', label: 'Quiz Card', description: 'Structured assessment look' },
  { value: 'playful-pop', label: 'Playful Pop', description: 'Bright kid-friendly palette' },
  { value: 'calm-study', label: 'Calm Study', description: 'Soft green focus mode' },
  { value: 'ink-saver', label: 'Ink Saver', description: 'Economical for classroom printing' },
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

const CARDS_PER_PAGE_OPTIONS: CardsPerPage[] = [1, 2, 4, 6, 8, 9, 10, 12]

export function DesignPanel({ settings, cardType, onUpdate, onUpdateCardType, onResetToDefaults }: DesignPanelProps) {
  return (
    <div className="space-y-6">
      <Card className="border-2">
        <CardHeader className="bg-muted/30">
          <CardTitle className="flex items-center gap-2">
            <Cards className="w-5 h-5" weight="duotone" />
            Print Layout
          </CardTitle>
          <CardDescription>Paper, orientation, card type, and how many cards print per page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paper-size">Paper Size</Label>
              <Select value={settings.paperSize} onValueChange={(value: PaperSize) => onUpdate({ paperSize: value })}>
                <SelectTrigger id="paper-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="letter">Letter</SelectItem>
                  <SelectItem value="a4">A4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orientation">Orientation</Label>
              <Select value={settings.orientation} onValueChange={(value: Orientation) => onUpdate({ orientation: value })}>
                <SelectTrigger id="orientation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Card Type</Label>
            <div className="grid grid-cols-2 gap-3">
              {(['single-sided', 'double-sided'] as CardType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => onUpdateCardType(type)}
                  className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                    cardType === type ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="font-semibold text-sm mb-1 capitalize">{type.replace('-', ' ')}</div>
                  <div className="text-xs text-muted-foreground">
                    {type === 'single-sided' ? 'Print front side only' : 'Print front & back sides'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Cards Per Page</Label>
            <div className="grid grid-cols-4 gap-2">
              {CARDS_PER_PAGE_OPTIONS.map((count) => (
                <button
                  key={count}
                  onClick={() => onUpdate({ cardsPerPage: count })}
                  className={`p-3 rounded-lg border-2 text-center font-semibold transition-all hover:shadow-md ${
                    settings.cardsPerPage === count
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {CARD_THEMES.map((theme) => (
                <button
                  key={theme.value}
                  onClick={() => onUpdate({ theme: theme.value })}
                  className={`p-4 rounded-lg border-2 text-left transition-all hover:shadow-md ${
                    settings.theme === theme.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
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
                  onClick={() => onUpdate({ mainColor: scheme.main, accentColor: scheme.accent })}
                  className={`p-3 rounded-lg border-2 flex items-center gap-3 transition-all hover:shadow-md ${
                    settings.mainColor === scheme.main ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex gap-1">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: scheme.main }} />
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: scheme.accent }} />
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
            <Select value={settings.fontFamily} onValueChange={(value) => onUpdate({ fontFamily: value })}>
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
            <Slider value={[settings.fontSize]} onValueChange={([value]) => onUpdate({ fontSize: value })} min={10} max={36} step={1} className="py-4" />
          </div>

          <div className="space-y-2">
            <Label>Text Alignment</Label>
            <div className="flex gap-2">
              {(['left', 'center', 'right'] as const).map((align) => (
                <button
                  key={align}
                  onClick={() => onUpdate({ textAlignment: align })}
                  className={`flex-1 p-3 rounded-lg border-2 flex items-center justify-center transition-all ${
                    settings.textAlignment === align ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
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
          <CardDescription>Borders, corners, and finishing touches</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-4">
            <SettingSwitch id="show-border" label="Show Border" description="Add border around cards" checked={settings.showBorder} onCheckedChange={(checked) => onUpdate({ showBorder: checked })} />
            {settings.showBorder && (
              <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                <Label>Border Thickness: {settings.borderThickness}px</Label>
                <Slider value={[settings.borderThickness]} onValueChange={([value]) => onUpdate({ borderThickness: value })} min={1} max={8} step={1} className="py-4" />
              </div>
            )}
            <SettingSwitch id="show-rounded" label="Rounded Corners" description="Make card corners rounded" checked={settings.showRoundedCorners} onCheckedChange={(checked) => onUpdate({ showRoundedCorners: checked })} />
            {settings.showRoundedCorners && (
              <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                <Label>Corner Radius: {settings.cornerRadius}px</Label>
                <Slider value={[settings.cornerRadius]} onValueChange={([value]) => onUpdate({ cornerRadius: value })} min={0} max={24} step={2} className="py-4" />
              </div>
            )}
            <SettingSwitch id="show-numbering" label="Card Numbering" description="Show number on each card" checked={settings.showNumbering} onCheckedChange={(checked) => onUpdate({ showNumbering: checked })} />
            <SettingSwitch id="show-set-title" label="Set Title on Cards" description="Display set name on each card" checked={settings.showSetTitle} onCheckedChange={(checked) => onUpdate({ showSetTitle: checked })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="footer-text">Footer Text (optional)</Label>
            <Input id="footer-text" value={settings.footerText || ''} onChange={(e) => onUpdate({ footerText: e.target.value })} placeholder="e.g., Teacher Name, Class Period" />
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
            <Select value={settings.duplexMode || 'long-edge'} onValueChange={(value: DuplexMode) => onUpdate({ duplexMode: value })}>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Horizontal Print Offset: {settings.horizontalOffset}px</Label>
              <Slider value={[settings.horizontalOffset]} onValueChange={([value]) => onUpdate({ horizontalOffset: value })} min={-24} max={24} step={1} />
            </div>
            <div className="space-y-2">
              <Label>Vertical Print Offset: {settings.verticalOffset}px</Label>
              <Slider value={[settings.verticalOffset]} onValueChange={([value]) => onUpdate({ verticalOffset: value })} min={-24} max={24} step={1} />
            </div>
          </div>

          <div className="rounded-lg border border-border p-4 space-y-3">
            <h4 className="text-sm font-semibold">Advanced: Back Page Offset</h4>
            <p className="text-xs text-muted-foreground">
              Fine-tune back-side alignment for duplex printing. Values are in mm and apply to back pages only.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="back-page-offset-x">Back Page X Offset (mm)</Label>
                <Input
                  id="back-page-offset-x"
                  type="number"
                  step="0.1"
                  value={settings.backPageOffsetX}
                  onChange={(e) => {
                    const value = Number.parseFloat(e.target.value)
                    onUpdate({ backPageOffsetX: Number.isFinite(value) ? value : 0 })
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="back-page-offset-y">Back Page Y Offset (mm)</Label>
                <Input
                  id="back-page-offset-y"
                  type="number"
                  step="0.1"
                  value={settings.backPageOffsetY}
                  onChange={(e) => {
                    const value = Number.parseFloat(e.target.value)
                    onUpdate({ backPageOffsetY: Number.isFinite(value) ? value : 0 })
                  }}
                />
              </div>
            </div>
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
            <Select value={settings.imageFit} onValueChange={(value: PrintSettings['imageFit']) => onUpdate({ imageFit: value })}>
              <SelectTrigger id="image-fit">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">Cover (fill space)</SelectItem>
                <SelectItem value="contain">Contain (fit within)</SelectItem>
                <SelectItem value="center">Center (manual zoom friendly)</SelectItem>
                <SelectItem value="background">Background (full card)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {settings.imageFit === 'background'
                ? 'Background mode fills the entire card with the image. Text overlays on a gradient for readability.'
                : 'Per-card image zoom works in cover, contain, and center modes. Center still gives the most manual positioning control.'}
            </p>
          </div>
          {settings.imageFit !== 'background' && (
            <div className="space-y-2">
              <Label>Image Size Ratio: {Math.round(settings.imageHeightRatio * 100)}%</Label>
              <Slider
                value={[settings.imageHeightRatio]}
                onValueChange={([value]) => onUpdate({ imageHeightRatio: value })}
                min={0.2}
                max={0.95}
                step={0.05}
                className="py-4"
              />
              <p className="text-xs text-muted-foreground">Controls how much vertical space images take vs. text. Lower values leave more room for text.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <button
          onClick={onResetToDefaults}
          className="px-4 py-2 rounded-lg border-2 border-border hover:border-primary/50 transition-all text-sm font-medium"
          type="button"
        >
          Reset to Default
        </button>
      </div>
    </div>
  )
}

interface SettingSwitchProps {
  id: string
  label: string
  description: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function SettingSwitch({ id, label, description, checked, onCheckedChange }: SettingSwitchProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}
