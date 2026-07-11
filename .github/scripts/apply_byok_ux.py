from pathlib import Path

APP_PATH = Path('src/App.tsx')
text = APP_PATH.read_text()


def replace_once(old: str, new: str, label: str) -> None:
    global text
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    text = text.replace(old, new, 1)


replace_once(
    "import { combineAbortSignals } from '@/lib/abort-signals'\n",
    "import { combineAbortSignals } from '@/lib/abort-signals'\n"
    "import { CredentialBackupPanel } from '@/components/CredentialBackupPanel'\n"
    "import { DEFAULT_AGENT_DRAFT, acceptImageRisk, clearAgentDraft, clearStoredCredentials, hasAcceptedImageRisk, loadAgentDraft, persistAiKey, saveAgentDraft, setRememberAiKey, shouldRememberAiKey } from '@/lib/agent-preferences'\n"
    "import type { AgentDraftPreferences, CredentialBackupPayload, ImageSearchStyleId } from '@/lib/agent-preferences'\n"
    "import { IMAGE_SEARCH_STYLES, applyImageSearchStyle, getImageSearchTemplate, previewImageSearch } from '@/lib/image-search-styles'\n",
    'imports',
)

replace_once(
    "  const [imageAgentOpen, setImageAgentOpen] = useState(false)\n"
    "  const [flashcardAgentMode, setFlashcardAgentMode] = useState<FlashcardAgentMode>('enhance')\n"
    "  const [flashcardAgentInstructions, setFlashcardAgentInstructions] = useState('Create a complete funny, classroom-safe ESL deck. Use short front text, useful back text, and specific real web image search queries for each side.')\n"
    "  const [flashcardAgentCount, setFlashcardAgentCount] = useState('8')\n"
    "  const [flashcardAgentAiKey, setFlashcardAgentAiKey] = useState(() => localStorage.getItem('flashforge_byok_key') ?? '')\n"
    "  const [flashcardAgentBaseUrl, setFlashcardAgentBaseUrl] = useState(() => localStorage.getItem('flashforge_byok_base_url') ?? 'https://api.openai.com/v1')\n"
    "  const [flashcardAgentModel, setFlashcardAgentModel] = useState(() => localStorage.getItem('flashforge_byok_model') ?? '')\n"
    "  const [flashcardAgentGenerateText, setFlashcardAgentGenerateText] = useState(true)\n",
    "  const initialAgentDraft = loadAgentDraft(set.id)\n"
    "  const [imageAgentOpen, setImageAgentOpen] = useState(false)\n"
    "  const [flashcardAgentMode, setFlashcardAgentMode] = useState<FlashcardAgentMode>(initialAgentDraft.mode)\n"
    "  const [flashcardAgentInstructions, setFlashcardAgentInstructions] = useState(initialAgentDraft.instructions)\n"
    "  const [flashcardAgentCount, setFlashcardAgentCount] = useState(initialAgentDraft.count)\n"
    "  const [rememberAiKeyOnDevice, setRememberAiKeyOnDevice] = useState(() => shouldRememberAiKey())\n"
    "  const [flashcardAgentAiKey, setFlashcardAgentAiKey] = useState(() => shouldRememberAiKey() ? localStorage.getItem('flashforge_byok_key') ?? '' : '')\n"
    "  const [flashcardAgentBaseUrl, setFlashcardAgentBaseUrl] = useState(() => localStorage.getItem('flashforge_byok_base_url') ?? 'https://api.openai.com/v1')\n"
    "  const [flashcardAgentModel, setFlashcardAgentModel] = useState(() => localStorage.getItem('flashforge_byok_model') ?? '')\n"
    "  const [flashcardAgentGenerateText, setFlashcardAgentGenerateText] = useState(initialAgentDraft.generateText)\n"
    "  const [imageAgentGenerateImages, setImageAgentGenerateImages] = useState(initialAgentDraft.generateImages)\n",
    'agent state',
)

replace_once(
    "  const [imageAgentSide, setImageAgentSide] = useState<ImageAgentTargetSide>('both')\n"
    "  const [imageAgentQueryTemplate, setImageAgentQueryTemplate] = useState('{front} funny character clear image')\n"
    "  const [imageAgentEmbed, setImageAgentEmbed] = useState(true)\n"
    "  const [imageAgentOverwrite, setImageAgentOverwrite] = useState(false)\n"
    "  const [imageAgentAcceptedRisk, setImageAgentAcceptedRisk] = useState(false)\n",
    "  const [imageAgentSide, setImageAgentSide] = useState<ImageAgentTargetSide>(initialAgentDraft.side)\n"
    "  const [imageAgentSearchStyle, setImageAgentSearchStyle] = useState<ImageSearchStyleId>(initialAgentDraft.searchStyle)\n"
    "  const [imageAgentCustomTemplate, setImageAgentCustomTemplate] = useState(initialAgentDraft.customSearchTemplate)\n"
    "  const [imageAgentEmbed, setImageAgentEmbed] = useState(initialAgentDraft.embedImages)\n"
    "  const [imageAgentOverwrite, setImageAgentOverwrite] = useState(initialAgentDraft.overwriteImages)\n"
    "  const [imageAgentAcceptedRisk, setImageAgentAcceptedRisk] = useState(() => hasAcceptedImageRisk())\n",
    'image state',
)

replace_once(
    "  useEffect(() => { localStorage.setItem('flashforge_byok_key', flashcardAgentAiKey) }, [flashcardAgentAiKey])\n",
    "  useEffect(() => {\n"
    "    setRememberAiKey(rememberAiKeyOnDevice)\n"
    "    persistAiKey(flashcardAgentAiKey, rememberAiKeyOnDevice)\n"
    "  }, [flashcardAgentAiKey, rememberAiKeyOnDevice])\n",
    'key persistence',
)

replace_once(
    "  useEffect(() => { localStorage.setItem('flashforge_image_provider', imageProvider) }, [imageProvider])\n\n"
    "  const agentBusy = revisionLoading || imageAgentLoading || aiConnectionTestLoading\n",
    "  useEffect(() => { localStorage.setItem('flashforge_image_provider', imageProvider) }, [imageProvider])\n"
    "  useEffect(() => {\n"
    "    const timer = window.setTimeout(() => {\n"
    "      saveAgentDraft(set.id, {\n"
    "        instructions: flashcardAgentInstructions,\n"
    "        count: flashcardAgentCount,\n"
    "        mode: flashcardAgentMode === 'create' ? 'create' : 'enhance',\n"
    "        side: imageAgentSide,\n"
    "        generateText: flashcardAgentGenerateText,\n"
    "        generateImages: imageAgentGenerateImages,\n"
    "        overwriteImages: imageAgentOverwrite,\n"
    "        embedImages: imageAgentEmbed,\n"
    "        searchStyle: imageAgentSearchStyle,\n"
    "        customSearchTemplate: imageAgentCustomTemplate,\n"
    "      })\n"
    "    }, 300)\n"
    "    return () => window.clearTimeout(timer)\n"
    "  }, [set.id, flashcardAgentInstructions, flashcardAgentCount, flashcardAgentMode, imageAgentSide, flashcardAgentGenerateText, imageAgentGenerateImages, imageAgentOverwrite, imageAgentEmbed, imageAgentSearchStyle, imageAgentCustomTemplate])\n\n"
    "  function currentAgentPreferences(): AgentDraftPreferences {\n"
    "    return {\n"
    "      instructions: flashcardAgentInstructions,\n"
    "      count: flashcardAgentCount,\n"
    "      mode: flashcardAgentMode === 'create' ? 'create' : 'enhance',\n"
    "      side: imageAgentSide,\n"
    "      generateText: flashcardAgentGenerateText,\n"
    "      generateImages: imageAgentGenerateImages,\n"
    "      overwriteImages: imageAgentOverwrite,\n"
    "      embedImages: imageAgentEmbed,\n"
    "      searchStyle: imageAgentSearchStyle,\n"
    "      customSearchTemplate: imageAgentCustomTemplate,\n"
    "    }\n"
    "  }\n\n"
    "  function applyAgentPreferences(preferences: AgentDraftPreferences) {\n"
    "    setFlashcardAgentInstructions(preferences.instructions)\n"
    "    setFlashcardAgentCount(preferences.count)\n"
    "    setFlashcardAgentMode(preferences.mode)\n"
    "    setImageAgentSide(preferences.side)\n"
    "    setFlashcardAgentGenerateText(preferences.generateText)\n"
    "    setImageAgentGenerateImages(preferences.generateImages)\n"
    "    setImageAgentOverwrite(preferences.overwriteImages)\n"
    "    setImageAgentEmbed(preferences.embedImages)\n"
    "    setImageAgentSearchStyle(preferences.searchStyle)\n"
    "    setImageAgentCustomTemplate(preferences.customSearchTemplate)\n"
    "  }\n\n"
    "  function resetAgentPreferences() {\n"
    "    clearAgentDraft(set.id)\n"
    "    applyAgentPreferences({ ...DEFAULT_AGENT_DRAFT })\n"
    "    toast.success('Agent preferences reset')\n"
    "  }\n\n"
    "  function buildCredentialBackupPayload(): CredentialBackupPayload {\n"
    "    return {\n"
    "      version: 1,\n"
    "      createdAt: new Date().toISOString(),\n"
    "      ai: { apiKey: flashcardAgentAiKey, baseUrl: flashcardAgentBaseUrl, model: flashcardAgentModel },\n"
    "      image: {\n"
    "        braveApiKey: imageBraveKey,\n"
    "        pixabayApiKey: imagePixabayKey,\n"
    "        pexelsApiKey: imagePexelsKey,\n"
    "        googleApiKey: imageGoogleKey,\n"
    "        googleCx: imageGoogleCx,\n"
    "        provider: imageProvider,\n"
    "      },\n"
    "      preferences: currentAgentPreferences(),\n"
    "    }\n"
    "  }\n\n"
    "  function importCredentialBackup(payload: CredentialBackupPayload) {\n"
    "    setRememberAiKeyOnDevice(true)\n"
    "    setFlashcardAgentAiKey(payload.ai.apiKey)\n"
    "    setFlashcardAgentBaseUrl(payload.ai.baseUrl || 'https://api.openai.com/v1')\n"
    "    setFlashcardAgentModel(payload.ai.model)\n"
    "    setImageBraveKey(payload.image.braveApiKey)\n"
    "    setImagePixabayKey(payload.image.pixabayApiKey)\n"
    "    setImagePexelsKey(payload.image.pexelsApiKey)\n"
    "    setImageGoogleKey(payload.image.googleApiKey)\n"
    "    setImageGoogleCx(payload.image.googleCx)\n"
    "    setImageProvider(payload.image.provider || 'auto')\n"
    "    applyAgentPreferences(payload.preferences)\n"
    "  }\n\n"
    "  function clearAgentCredentials() {\n"
    "    clearStoredCredentials()\n"
    "    setFlashcardAgentAiKey('')\n"
    "    setImageBraveKey('')\n"
    "    setImagePixabayKey('')\n"
    "    setImagePexelsKey('')\n"
    "    setImageGoogleKey('')\n"
    "    setImageGoogleCx('')\n"
    "    toast.success('Saved credentials cleared from this browser')\n"
    "  }\n\n"
    "  const agentBusy = revisionLoading || imageAgentLoading || aiConnectionTestLoading\n",
    'draft and credential helpers',
)

replace_once(
    "  function buildImageAgentQuery(card: FlashCard, side: ImageAgentTargetSide): string {\n"
    "    const front = card.frontText.trim()\n"
    "    const back = card.backText.trim()\n"
    "    const primary = side === 'back' ? back || front : front || back\n"
    "    const query = imageAgentQueryTemplate\n"
    "      .split('{front}').join(front)\n"
    "      .split('{back}').join(back)\n"
    "      .split('{title}').join(set.title)\n"
    "      .split('{side}').join(side)\n"
    "      .split('{text}').join(primary)\n"
    "      .replace(/\\s+/g, ' ')\n"
    "      .trim()\n"
    "    return query || `${primary} ${set.title} clear classroom image`.trim()\n"
    "  }\n",
    "  function buildImageQuery(frontValue: string, backValue: string, side: ImageAgentTargetSide): string {\n"
    "    const front = frontValue.trim()\n"
    "    const back = backValue.trim()\n"
    "    const primary = side === 'back' ? back || front : front || back\n"
    "    const template = getImageSearchTemplate(imageAgentSearchStyle, imageAgentCustomTemplate)\n"
    "    const query = template\n"
    "      .split('{front}').join(front)\n"
    "      .split('{back}').join(back)\n"
    "      .split('{title}').join(set.title)\n"
    "      .split('{side}').join(side)\n"
    "      .split('{text}').join(primary)\n"
    "      .replace(/\\s+/g, ' ')\n"
    "      .trim()\n"
    "    return query || primary\n"
    "  }\n\n"
    "  function buildImageAgentQuery(card: FlashCard, side: ImageAgentTargetSide): string {\n"
    "    return buildImageQuery(card.frontText, card.backText, side)\n"
    "  }\n\n"
    "  function appendImageSearchToken(token: string) {\n"
    "    setImageAgentCustomTemplate((current) => `${current.trim()}${current.trim() ? ' ' : ''}${token}`)\n"
    "  }\n",
    'search query builder',
)

replace_once(
    "    if (!imageAgentAcceptedRisk) {\n"
    "      toast.error('Please accept the image-use responsibility notice first')\n"
    "      return\n"
    "    }\n\n"
    "    const needsAi = flashcardAgentMode === 'create' || (flashcardAgentMode === 'enhance' && flashcardAgentGenerateText)\n",
    "    const needsAi = flashcardAgentMode === 'create' || (flashcardAgentMode === 'enhance' && flashcardAgentGenerateText)\n"
    "    if (imageAgentGenerateImages && !imageAgentAcceptedRisk) {\n"
    "      toast.error('Please acknowledge the image-use notice once before searching for images')\n"
    "      return\n"
    "    }\n"
    "    if (!needsAi && !imageAgentGenerateImages) {\n"
    "      toast.error('Turn on text generation or image search before running the agent')\n"
    "      return\n"
    "    }\n\n",
    'run safety gate',
)

replace_once(
    "        setImageAgentLog((prev) => [...prev, `✓ Generated ${generatedCards.length} card${generatedCards.length === 1 ? '' : 's'} — now searching for images...`])\n",
    "        setImageAgentLog((prev) => [...prev, `✓ Generated ${generatedCards.length} card${generatedCards.length === 1 ? '' : 's'}${imageAgentGenerateImages ? ' — now searching for images...' : ' — text saved.'}`])\n",
    'dynamic text log',
)

replace_once(
    "      // ── Phase 2: Image search (client-orchestrated, bounded concurrency) ─\n",
    "      if (!imageAgentGenerateImages) {\n"
    "        setImageAgentSummary('Text generation complete. Image search was skipped.')\n"
    "        setImageAgentSummaryTone('success')\n"
    "        setImageAgentLog((prev) => ['✓ Text cards saved; image search disabled.', ...prev])\n"
    "        setImageAgentJobState('complete')\n"
    "        toast.success('Text cards saved')\n"
    "        return\n"
    "      }\n\n"
    "      // ── Phase 2: Image search (client-orchestrated, bounded concurrency) ─\n",
    'text-only vertical slice',
)

replace_once(
    "                  aiQuery: card.frontImageQuery,\n",
    "                  aiQuery: imageAgentSearchStyle === 'custom'\n"
    "                    ? buildImageQuery(card.frontText, card.backText, 'front')\n"
    "                    : applyImageSearchStyle(card.frontImageQuery || card.frontText, imageAgentSearchStyle),\n",
    'front generated image style',
)
replace_once(
    "                  aiQuery: card.backImageQuery,\n",
    "                  aiQuery: imageAgentSearchStyle === 'custom'\n"
    "                    ? buildImageQuery(card.frontText, card.backText, 'back')\n"
    "                    : applyImageSearchStyle(card.backImageQuery || card.backText || card.frontText, imageAgentSearchStyle),\n",
    'back generated image style',
)

replace_once(
    "            <div className=\"rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100\">\n"
    "              FlashForge can help find and attach images, but you choose what to use. You assume responsibility for copyright, likeness, classroom appropriateness, and any other image-use risks.\n"
    "            </div>\n\n"
    "            <label className=\"flex items-start gap-3 text-sm\">\n"
    "              <input\n"
    "                type=\"checkbox\"\n"
    "                className=\"mt-1\"\n"
    "                checked={imageAgentAcceptedRisk}\n"
    "                onChange={(event) => setImageAgentAcceptedRisk(event.target.checked)}\n"
    "              />\n"
    "              <span>I understand that I am responsible for the images I choose to search for, insert, print, share, or publish.</span>\n"
    "            </label>\n",
    "            <div className=\"rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100\">\n"
    "              FlashForge searches third-party image providers. Review images before printing or publishing; you remain responsible for how they are used.\n"
    "            </div>\n\n"
    "            {imageAgentGenerateImages && !imageAgentAcceptedRisk ? (\n"
    "              <label className=\"flex items-start gap-3 text-sm\">\n"
    "                <input\n"
    "                  type=\"checkbox\"\n"
    "                  className=\"mt-1\"\n"
    "                  checked={false}\n"
    "                  onChange={(event) => {\n"
    "                    if (!event.target.checked) return\n"
    "                    acceptImageRisk()\n"
    "                    setImageAgentAcceptedRisk(true)\n"
    "                  }}\n"
    "                />\n"
    "                <span>I understand — remember this acknowledgement on this device.</span>\n"
    "              </label>\n"
    "            ) : imageAgentGenerateImages ? (\n"
    "              <p className=\"text-xs text-muted-foreground\">Image-use notice acknowledged on this device.</p>\n"
    "            ) : null}\n",
    'one-time acknowledgement UI',
)

replace_once(
    "              <Textarea id=\"flashcard-agent-instructions\" value={flashcardAgentInstructions} onChange={(event) => setFlashcardAgentInstructions(event.target.value)} rows={3} disabled={imageAgentLoading} />\n",
    "              <Textarea id=\"flashcard-agent-instructions\" value={flashcardAgentInstructions} onChange={(event) => setFlashcardAgentInstructions(event.target.value)} placeholder=\"Example: Create 8 daily-routine cards for beginner Japanese elementary students. Use short English phrases and simple definitions.\" rows={3} disabled={imageAgentLoading} />\n"
    "              <p className=\"text-xs text-muted-foreground\">Draft instructions are saved automatically for this deck.</p>\n",
    'instruction placeholder',
)

replace_once(
    "              <AiModelPicker apiKey={flashcardAgentAiKey} baseUrl={flashcardAgentBaseUrl} model={flashcardAgentModel} disabled={imageAgentLoading || aiConnectionTestLoading} onBaseUrlChange={setFlashcardAgentBaseUrl} onModelChange={setFlashcardAgentModel} />\n"
    "            </div>\n\n"
    "            <div className=\"grid gap-4 sm:grid-cols-2\">\n",
    "              <AiModelPicker apiKey={flashcardAgentAiKey} baseUrl={flashcardAgentBaseUrl} model={flashcardAgentModel} disabled={imageAgentLoading || aiConnectionTestLoading} onBaseUrlChange={setFlashcardAgentBaseUrl} onModelChange={setFlashcardAgentModel} />\n"
    "              <CredentialBackupPanel\n"
    "                rememberAiKey={rememberAiKeyOnDevice}\n"
    "                hasSavedCredentials={Boolean(flashcardAgentAiKey || imageBraveKey || imagePixabayKey || imagePexelsKey || imageGoogleKey || imageGoogleCx)}\n"
    "                disabled={imageAgentLoading || aiConnectionTestLoading}\n"
    "                getBackupPayload={buildCredentialBackupPayload}\n"
    "                onRememberAiKeyChange={setRememberAiKeyOnDevice}\n"
    "                onImport={importCredentialBackup}\n"
    "                onClearCredentials={clearAgentCredentials}\n"
    "              />\n"
    "            </div>\n\n"
    "            <div className=\"grid gap-4 sm:grid-cols-2\">\n",
    'credential panel integration',
)

replace_once(
    "                  <SelectTrigger id=\"image-agent-side\" disabled={imageAgentLoading}>\n",
    "                  <SelectTrigger id=\"image-agent-side\" disabled={imageAgentLoading || !imageAgentGenerateImages}>\n",
    'disable side without images',
)

replace_once(
    "                  <label className=\"flex items-center gap-2\">\n"
    "                    <input type=\"checkbox\" checked={flashcardAgentGenerateText} disabled={imageAgentLoading} onChange={(event) => setFlashcardAgentGenerateText(event.target.checked)} />\n"
    "                    Let AI create/rewrite front and back text\n"
    "                  </label>\n",
    "                  <label className=\"flex items-center gap-2\">\n"
    "                    <input type=\"checkbox\" checked={flashcardAgentGenerateText} disabled={imageAgentLoading || flashcardAgentMode === 'create'} onChange={(event) => setFlashcardAgentGenerateText(event.target.checked)} />\n"
    "                    Let AI create/rewrite front and back text\n"
    "                  </label>\n"
    "                  <label className=\"flex items-center gap-2\">\n"
    "                    <input type=\"checkbox\" checked={imageAgentGenerateImages} disabled={imageAgentLoading} onChange={(event) => setImageAgentGenerateImages(event.target.checked)} />\n"
    "                    Search for and attach images\n"
    "                  </label>\n",
    'generate images toggle',
)

replace_once(
    "                    <input type=\"checkbox\" checked={imageAgentOverwrite} disabled={imageAgentLoading} onChange={(event) => setImageAgentOverwrite(event.target.checked)} />\n",
    "                    <input type=\"checkbox\" checked={imageAgentOverwrite} disabled={imageAgentLoading || !imageAgentGenerateImages} onChange={(event) => setImageAgentOverwrite(event.target.checked)} />\n",
    'overwrite image disable',
)
replace_once(
    "                    <input type=\"checkbox\" checked={imageAgentEmbed} disabled={imageAgentLoading} onChange={(event) => setImageAgentEmbed(event.target.checked)} />\n",
    "                    <input type=\"checkbox\" checked={imageAgentEmbed} disabled={imageAgentLoading || !imageAgentGenerateImages} onChange={(event) => setImageAgentEmbed(event.target.checked)} />\n",
    'embed image disable',
)

replace_once(
    "            <div className=\"space-y-2\">\n"
    "              <Label htmlFor=\"image-agent-query\">Search query template</Label>\n"
    "              <Input\n"
    "                id=\"image-agent-query\"\n"
    "                value={imageAgentQueryTemplate}\n"
    "                onChange={(event) => setImageAgentQueryTemplate(event.target.value)}\n"
    "                placeholder=\"{front} funny character clear image\"\n"
    "                disabled={imageAgentLoading}\n"
    "              />\n"
    "              <p className=\"text-xs text-muted-foreground\">\n"
    "                Variables: {'{front}'}, {'{back}'}, {'{text}'}, {'{title}'}, {'{side}'}. Example: {'{front} funny character Japanese students recognize'}.\n"
    "              </p>\n"
    "            </div>\n",
    "            {imageAgentGenerateImages && (\n"
    "              <div className=\"space-y-3\">\n"
    "                <Label htmlFor=\"image-agent-search-style\">Image search style</Label>\n"
    "                <Select value={imageAgentSearchStyle} onValueChange={(value: ImageSearchStyleId) => setImageAgentSearchStyle(value)} disabled={imageAgentLoading}>\n"
    "                  <SelectTrigger id=\"image-agent-search-style\"><SelectValue /></SelectTrigger>\n"
    "                  <SelectContent>\n"
    "                    {IMAGE_SEARCH_STYLES.map((style) => <SelectItem key={style.id} value={style.id}>{style.label}</SelectItem>)}\n"
    "                  </SelectContent>\n"
    "                </Select>\n"
    "                <p className=\"text-xs text-muted-foreground\">Example search: <span className=\"font-medium text-foreground\">{previewImageSearch(imageAgentSearchStyle, imageAgentCustomTemplate)}</span></p>\n"
    "                {imageAgentSearchStyle === 'custom' && (\n"
    "                  <details className=\"rounded-md border p-3\" open>\n"
    "                    <summary className=\"cursor-pointer text-sm font-medium\">Advanced search template</summary>\n"
    "                    <div className=\"mt-3 space-y-3\">\n"
    "                      <Input value={imageAgentCustomTemplate} onChange={(event) => setImageAgentCustomTemplate(event.target.value)} placeholder=\"{front} clear classroom image\" disabled={imageAgentLoading} />\n"
    "                      <div className=\"flex flex-wrap gap-2\">\n"
    "                        {['{front}', '{back}', '{text}', '{title}', '{side}'].map((token) => (\n"
    "                          <Button key={token} type=\"button\" size=\"sm\" variant=\"outline\" onClick={() => appendImageSearchToken(token)} disabled={imageAgentLoading}>{token.replace(/[{}]/g, '')}</Button>\n"
    "                        ))}\n"
    "                      </div>\n"
    "                      <p className=\"text-xs text-muted-foreground\">Use the buttons to insert card text, deck title, or card side. Most users can stay with a preset above.</p>\n"
    "                    </div>\n"
    "                  </details>\n"
    "                )}\n"
    "              </div>\n"
    "            )}\n",
    'search style UI',
)

replace_once(
    "              <Button variant=\"outline\" onClick={() => setImageSearchSettingsOpen(true)}>\n"
    "                <Gear className=\"mr-2\" weight=\"bold\" />\n"
    "                Image Search Settings\n"
    "              </Button>\n",
    "              <Button variant=\"outline\" onClick={() => setImageSearchSettingsOpen(true)}>\n"
    "                <Gear className=\"mr-2\" weight=\"bold\" />\n"
    "                Image Search Settings\n"
    "              </Button>\n"
    "              <Button variant=\"ghost\" onClick={resetAgentPreferences} disabled={imageAgentLoading || aiConnectionTestLoading}>Reset agent preferences</Button>\n",
    'reset preferences button',
)

replace_once(
    "              <Button onClick={runImageAgent} disabled={imageAgentLoading || !imageAgentAcceptedRisk}>\n",
    "              <Button onClick={runImageAgent} disabled={imageAgentLoading || (imageAgentGenerateImages && !imageAgentAcceptedRisk)}>\n",
    'run button gate',
)

APP_PATH.write_text(text)

Path('src/__tests__/agent-ux-integration.test.ts').write_text("""import { readFileSync } from 'node:fs'\nimport { describe, expect, it } from 'vitest'\n\nconst app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')\n\ndescribe('BYOK agent UX integration', () => {\n  it('uses an empty instruction value with a real placeholder and per-deck autosave', () => {\n    expect(app).not.toContain("useState('Create a complete funny")\n    expect(app).toContain('Draft instructions are saved automatically for this deck.')\n    expect(app).toContain('saveAgentDraft(set.id')\n  })\n\n  it('uses a one-time image acknowledgement and permits text-only runs', () => {\n    expect(app).toContain('hasAcceptedImageRisk()')\n    expect(app).toContain('acceptImageRisk()')\n    expect(app).toContain('Search for and attach images')\n    expect(app).toContain("if (!imageAgentGenerateImages)")\n    expect(app).not.toContain('Please accept the image-use responsibility notice first')\n  })\n\n  it('hides raw template syntax behind search styles and integrates encrypted backups', () => {\n    expect(app).toContain('Image search style')\n    expect(app).toContain('Advanced search template')\n    expect(app).toContain('<CredentialBackupPanel')\n    expect(app).not.toContain('Search query template')\n  })\n})\n""")

print('Applied BYOK agent UX integration successfully')
