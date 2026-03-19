import type { TestSettings } from '@/lib/types'
import type { TestQuestion } from '@/lib/test-utils'
import { extractWordBank, formatMatchingQuestions } from '@/lib/test-utils'
import { cn } from '@/lib/utils'

interface TestDisplayProps {
  questions: TestQuestion[]
  settings: TestSettings
  showAnswers?: boolean
}

export function TestDisplay({ questions, settings, showAnswers = false }: TestDisplayProps) {
  const hasMatching = questions.some(q => q.type === 'matching')
  const matchingData = hasMatching ? formatMatchingQuestions(questions) : null
  const nonMatchingQuestions = questions.filter(q => q.type !== 'matching')
  const wordBank = settings.includeWordBank ? extractWordBank(questions) : []

  return (
    <div className="bg-white p-8 space-y-6">
      <div className="border-b-2 border-gray-800 pb-4">
        <h1 className="text-2xl font-bold text-center mb-2">{settings.testTitle}</h1>
        
        {settings.includeStudentInfo && (
          <div className="flex gap-8 text-sm mt-4">
            <div className="flex-1">
              <span className="font-medium">Name: </span>
              <span className="border-b border-gray-400 inline-block min-w-[200px]"></span>
            </div>
            {settings.includeDate && (
              <div>
                <span className="font-medium">Date: </span>
                <span className="border-b border-gray-400 inline-block min-w-[120px]"></span>
              </div>
            )}
          </div>
        )}
        
        {settings.instructions && (
          <p className="mt-4 text-sm italic text-gray-700">{settings.instructions}</p>
        )}
      </div>

      {wordBank.length > 0 && !showAnswers && (
        <div className="border border-gray-300 rounded p-4 bg-gray-50">
          <h3 className="font-bold text-sm mb-2">Word Bank:</h3>
          <div className="grid grid-cols-3 gap-2 text-sm">
            {wordBank.map((word, i) => (
              <div key={i} className="text-center py-1">
                {word}
              </div>
            ))}
          </div>
        </div>
      )}

      {nonMatchingQuestions.length > 0 && (
        <div className="space-y-6">
          {nonMatchingQuestions.map((question, index) => (
            <QuestionDisplay
              key={question.id}
              question={question}
              number={index + 1}
              showAnswer={showAnswers}
            />
          ))}
        </div>
      )}

      {matchingData && (
        <div className="avoid-break">
          <h3 className="font-bold mb-3">Matching</h3>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-2">
              {matchingData.left.map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <span className="font-medium min-w-[24px]">{item.id}.</span>
                  <span className="flex-1">{item.text}</span>
                  {!showAnswers && <span className="min-w-[40px] border-b border-gray-400">____</span>}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {matchingData.right.map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <span className="font-medium min-w-[24px]">{item.id}.</span>
                  <span className="flex-1">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {settings.teacherNotes && showAnswers && (
        <div className="border-t pt-4 mt-8 text-xs text-gray-600">
          <p className="font-medium">Teacher Notes:</p>
          <p>{settings.teacherNotes}</p>
        </div>
      )}
    </div>
  )
}

interface QuestionDisplayProps {
  question: TestQuestion
  number: number
  showAnswer?: boolean
}

function QuestionDisplay({ question, number, showAnswer }: QuestionDisplayProps) {
  return (
    <div className="avoid-break">
      <div className="flex items-start gap-3">
        <span className="font-bold min-w-[32px]">{number}.</span>
        <div className="flex-1">
          {question.questionImage && (
            <div className="mb-2">
              <img
                src={question.questionImage}
                alt={`Question ${number}`}
                className="max-w-[200px] max-h-[150px] object-contain border border-gray-300 rounded"
              />
            </div>
          )}
          
          <div className="mb-2">{question.questionText}</div>

          {question.type === 'multiple-choice' && question.options && (
            <div className="ml-4 space-y-1">
              {question.options.map((option, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-medium">{String.fromCharCode(65 + i)}.</span>
                  <span className={cn(
                    showAnswer && option === question.correctAnswer && 'font-bold text-green-700'
                  )}>
                    {option}
                  </span>
                </div>
              ))}
            </div>
          )}

          {question.type === 'word-to-picture' && question.options && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {question.options.map((imgUrl, i) => (
                <div key={i} className="border border-gray-300 rounded p-2">
                  <div className="text-xs font-medium mb-1">{String.fromCharCode(65 + i)}.</div>
                  <img
                    src={imgUrl}
                    alt={`Option ${String.fromCharCode(65 + i)}`}
                    className="w-full h-24 object-contain"
                  />
                </div>
              ))}
            </div>
          )}

          {!question.options && !showAnswer && (
            <div className="mt-2">
              <div className="border-b border-gray-400 w-full min-h-[24px]"></div>
            </div>
          )}

          {showAnswer && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
              <span className="font-bold text-green-800">Answer: </span>
              <span className="text-green-900">{question.correctAnswer}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface AnswerKeyProps {
  questions: TestQuestion[]
  settings: TestSettings
}

export function AnswerKey({ questions, settings }: AnswerKeyProps) {
  return (
    <div className="bg-white p-8 page-break-before">
      <div className="border-b-2 border-gray-800 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-center">Answer Key</h1>
        <p className="text-center text-sm text-gray-600 mt-1">{settings.testTitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-2">
        {questions.map((question, index) => (
          <div key={question.id} className="flex items-start gap-2 text-sm">
            <span className="font-bold min-w-[32px]">{index + 1}.</span>
            <span className="flex-1 break-words">{question.correctAnswer}</span>
          </div>
        ))}
      </div>

      {settings.teacherNotes && (
        <div className="border-t pt-4 mt-8 text-xs text-gray-600">
          <p className="font-medium">Teacher Notes:</p>
          <p>{settings.teacherNotes}</p>
        </div>
      )}
    </div>
  )
}
