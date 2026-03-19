import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TestSettings, QuestionType } from '@/lib/types'

interface TestConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: TestSettings
  onSettingsChange: (settings: TestSettings) => void
  onGenerate: () => void
  maxQuestions: number
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  'picture-to-word': 'Picture → Word',
  'word-to-picture': 'Word → Picture',
  'word-to-translation': 'Word → Translation',
  'translation-to-word': 'Translation → Word',
  'matching': 'Matching',
  'fill-blank': 'Fill in the Blank',
  'short-answer': 'Short Answer',
  'multiple-choice': 'Multiple Choice',
}

export function TestConfigDialog({
  open,
  onOpenChange,
  settings,
  onSettingsChange,
  onGenerate,
  maxQuestions,
}: TestConfigDialogProps) {
  const [localSettings, setLocalSettings] = useState(settings)

  const updateSetting = <K extends keyof TestSettings>(key: K, value: TestSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }))
  }

  const toggleQuestionType = (type: QuestionType) => {
    const current = localSettings.questionTypes
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type]
    
    if (updated.length > 0) {
      updateSetting('questionTypes', updated)
    }
  }

  const handleGenerate = () => {
    onSettingsChange(localSettings)
    onGenerate()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Generate Test</DialogTitle>
          <DialogDescription>
            Configure test settings and question types
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="test-title">Test Title</Label>
            <Input
              id="test-title"
              value={localSettings.testTitle}
              onChange={(e) => updateSetting('testTitle', e.target.value)}
              placeholder="e.g., Vocabulary Quiz Unit 1"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="num-questions">Number of Questions</Label>
              <Input
                id="num-questions"
                type="number"
                min={1}
                max={maxQuestions}
                value={localSettings.numberOfQuestions}
                onChange={(e) => updateSetting('numberOfQuestions', Math.min(maxQuestions, Math.max(1, parseInt(e.target.value) || 1)))}
              />
              <p className="text-xs text-muted-foreground">Max: {maxQuestions} cards available</p>
            </div>

            <div className="space-y-2">
              <Label>Options</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="randomize"
                    checked={localSettings.randomizeOrder}
                    onCheckedChange={(checked) => updateSetting('randomizeOrder', checked === true)}
                  />
                  <Label htmlFor="randomize" className="font-normal cursor-pointer">
                    Randomize order
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="word-bank"
                    checked={localSettings.includeWordBank}
                    onCheckedChange={(checked) => updateSetting('includeWordBank', checked === true)}
                  />
                  <Label htmlFor="word-bank" className="font-normal cursor-pointer">
                    Include word bank
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Student Information</Label>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="student-info"
                  checked={localSettings.includeStudentInfo}
                  onCheckedChange={(checked) => updateSetting('includeStudentInfo', checked === true)}
                />
                <Label htmlFor="student-info" className="font-normal cursor-pointer">
                  Name field
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="date"
                  checked={localSettings.includeDate}
                  onCheckedChange={(checked) => updateSetting('includeDate', checked === true)}
                />
                <Label htmlFor="date" className="font-normal cursor-pointer">
                  Date field
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              value={localSettings.instructions}
              onChange={(e) => updateSetting('instructions', e.target.value)}
              placeholder="Write the correct answer for each question."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Question Types (select at least one)</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(QUESTION_TYPE_LABELS) as [QuestionType, string][]).map(([type, label]) => (
                <div key={type} className="flex items-center gap-2">
                  <Checkbox
                    id={`type-${type}`}
                    checked={localSettings.questionTypes.includes(type)}
                    onCheckedChange={() => toggleQuestionType(type)}
                  />
                  <Label htmlFor={`type-${type}`} className="font-normal cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="images"
                checked={localSettings.includeImages}
                onCheckedChange={(checked) => updateSetting('includeImages', checked === true)}
              />
              <Label htmlFor="images" className="font-normal cursor-pointer">
                Include images in questions (if available)
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="answer-key"
                checked={localSettings.includeAnswerKey}
                onCheckedChange={(checked) => updateSetting('includeAnswerKey', checked === true)}
              />
              <Label htmlFor="answer-key" className="font-normal cursor-pointer">
                Generate answer key
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="teacher-notes">Teacher Notes (optional)</Label>
            <Textarea
              id="teacher-notes"
              value={localSettings.teacherNotes}
              onChange={(e) => updateSetting('teacherNotes', e.target.value)}
              placeholder="Additional notes for answer key..."
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={localSettings.questionTypes.length === 0}>
            Generate Test
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
