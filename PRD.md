# FlashForge - Production Flashcard & Test Creator for Teachers

FlashForge is a fast, printable-first web app that lets teachers create beautiful flashcards and tests in minutes, with pixel-perfect PDF export and duplex printing support.

**Experience Qualities**:
1. **Efficient** - Teachers can go from idea to printed materials in under 5 minutes with bulk import and smart defaults
2. **Reliable** - Print layouts are deterministic, PDFs export cleanly, and duplex alignment works consistently across printers
3. **Polished** - Professional-looking output that teachers are proud to use in class, with thoughtful design details throughout

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
This app requires sophisticated print layout engines, duplex alignment calculation, PDF generation, test creation logic, image handling, bulk import, and a multi-panel interface with real-time preview synchronization.

## Essential Features

### Project Management
- **Functionality**: Create, edit, save flashcard sets with metadata (title, subtitle, class name, notes)
- **Purpose**: Organize materials by unit, class, or topic
- **Trigger**: Click "New Set" or load from browser storage
- **Progression**: Enter set details → Add cards → Configure print settings → Preview → Export
- **Success criteria**: Sets persist in localStorage, can be edited/duplicated/deleted, autosave works

### Card Data Entry
- **Functionality**: Add cards manually, bulk paste, CSV import, drag-drop reorder, inline edit
- **Purpose**: Fast entry of vocabulary, images, and content
- **Trigger**: Click add card, paste rows, or upload CSV
- **Progression**: Choose entry method → Input data → Cards appear in editor → Drag to reorder → Edit inline
- **Success criteria**: 50 cards can be added in under 2 minutes via paste, images upload via drag-drop, reordering is smooth

### Single-Sided Card Printing
- **Functionality**: Generate printable sheets with 1/2/4/6/8/9/10/12 cards per page
- **Purpose**: Create vocabulary cards, picture cards, study cards
- **Trigger**: Select single-sided mode, choose layout
- **Progression**: Choose cards per page → Select theme → Preview pages → Adjust styling → Export PDF
- **Success criteria**: All layouts render correctly, cards never overflow, images scale properly, PDF matches preview

### Double-Sided Card Printing
- **Functionality**: Generate front and back sheets with correct duplex alignment
- **Purpose**: Create quiz cards, translation cards, question/answer cards
- **Trigger**: Select double-sided mode, choose duplex type
- **Progression**: Define front/back content → Choose flip edge → Preview alignment → Test print → Adjust offsets → Export
- **Success criteria**: Backs align with fronts when printed duplex, offset controls compensate for printer quirks

### Test Generation ✅
- **Functionality**: Create printable tests from flashcard data with multiple question types (picture-to-word, word-to-translation, multiple choice, matching, fill-in-the-blank, short answer)
- **Purpose**: Generate assessments quickly from existing materials
- **Trigger**: Click "Generate Test" from a set
- **Progression**: Choose question types → Configure settings (number of questions, randomization, word bank) → Preview test and answer key → Print or export
- **Success criteria**: Tests format cleanly, questions don't split across pages, answer key matches, multiple question types supported, word bank functionality works

### PDF Export
- **Functionality**: Export print-ready PDFs with clean page breaks and crisp text
- **Purpose**: Reliable sharing and printing without browser quirks
- **Trigger**: Click "Download PDF" or "Print"
- **Progression**: User clicks export → PDF generates → Downloads with descriptive filename
- **Success criteria**: Text is crisp (not rasterized), page breaks are clean, margins are correct for A4 and Letter

## Edge Case Handling

- **Long words**: Auto font-size reduction with minimum threshold, or hyphenation/wrapping based on card theme
- **Oversized images**: Show upload warning, auto-compress, generate thumbnails for editor performance
- **Missing content**: Graceful fallback (blank back side shows placeholder, missing image shows text-only)
- **Mixed content sets**: Cards with and without images in same set render attractively with consistent spacing
- **Layout switching**: Changing from 1-up to 12-up maintains visual consistency, intelligent typography scaling
- **Browser print margins**: Safe area calculations, printer-friendly mode, margin offset controls
- **Paper size differences**: Dedicated spacing calculations for A4 vs Letter, layout adapts automatically
- **Duplex alignment**: Offset controls, test page generator, flip-edge selector, visual alignment preview

## Design Direction

FlashForge should feel **calm, capable, and professional** - like a tool designed by teachers, for teachers. The interface should fade into the background, letting the materials being created take center stage. It should feel reassuringly solid and print-focused, not like a flashy web toy. Think: Apple Keynote's simplicity meets Google Classroom's educational practicality.

## Color Selection

A soft, educational palette that feels modern but not distracting, with excellent readability and print-friendly defaults.

- **Primary Color**: Deep teal `oklch(0.45 0.12 210)` - Communicates trust, knowledge, and calm focus
- **Secondary Color**: Warm amber `oklch(0.75 0.15 65)` - Friendly accent for interactive elements and highlights
- **Accent Color**: Vibrant coral `oklch(0.65 0.18 25)` - Draws attention to CTAs like "Export PDF" and "Create Set"
- **Background**: Soft warm white `oklch(0.97 0.008 85)` - Reduces eye strain during extended use
- **Card Background**: Pure white `oklch(1 0 0)` - Ensures clean printing
- **Text Primary**: Rich charcoal `oklch(0.25 0.01 260)` - High contrast for readability
- **Text Muted**: Medium gray `oklch(0.55 0.01 260)` - Secondary information

**Foreground/Background Pairings**:
- Primary Teal `oklch(0.45 0.12 210)`: White text `oklch(1 0 0)` - Ratio 9.2:1 ✓
- Accent Coral `oklch(0.65 0.18 25)`: White text `oklch(1 0 0)` - Ratio 4.9:1 ✓
- Background Warm White `oklch(0.97 0.008 85)`: Charcoal text `oklch(0.25 0.01 260)` - Ratio 13.1:1 ✓
- Card White `oklch(1 0 0)`: Charcoal text `oklch(0.25 0.01 260)` - Ratio 14.5:1 ✓

## Font Selection

Typography should feel **clean, educational, and highly readable** at all sizes, from tiny 12-up cards to full-page prints. We need a versatile family that works for both UI and printed materials.

- **Primary Font**: Space Grotesk (Headers, card titles, emphasis) - Geometric but warm, distinctive without being distracting
- **Secondary Font**: Inter (UI, body text, card content) - Supreme readability, excellent at small sizes, professional
- **Monospace**: JetBrains Mono (CSV paste areas, test numbering) - Clear distinction for code/data input

**Typographic Hierarchy**:
- H1 (App Title): Space Grotesk Bold/32px/tight tracking/-0.02em
- H2 (Section Headers): Space Grotesk SemiBold/24px/normal
- H3 (Panel Headers): Space Grotesk Medium/18px/normal
- Body (UI Text): Inter Regular/14px/1.5 line-height
- Small (Labels): Inter Medium/12px/1.4 line-height/uppercase/tracking 0.05em
- Card Main Text: Inter Bold/varies by layout/1.2 line-height
- Card Secondary: Inter Regular/varies by layout/1.3 line-height

## Animations

Animations should **enhance workflow efficiency** and provide subtle feedback without slowing the user down. Focus on purposeful micro-interactions that confirm actions and guide attention.

- **Card reordering**: Smooth 200ms transform with spring physics when dragging (framer-motion layout animation)
- **Panel transitions**: 150ms ease-out when switching between editor/preview/print views
- **Button feedback**: Quick 100ms scale-down on click, subtle shadow expansion on hover
- **Toast notifications**: Slide-in from bottom-right with 300ms spring for save confirmations
- **Preview updates**: Subtle 200ms opacity crossfade when changing layouts to show regeneration
- **Page turn in preview**: Optional page-flip animation when navigating multi-page previews (can be disabled)
- **Add card**: New card fades in with slight scale-up over 250ms
- **No animation for**: PDF generation, layout calculations, bulk operations - these should feel instant

## Component Selection

### **Shadcn Components Used**:
- **Dialog**: For set creation modal, import/export modals, image upload modals
- **Card**: For project cards on home screen, settings panels
- **Button**: Primary actions (Create Set, Export PDF, Add Card) with variants (default, outline, ghost)
- **Input**: Text fields for card content, set metadata
- **Textarea**: Multi-line fields for notes, test instructions
- **Select**: Dropdowns for layout (1-up, 2-up...), paper size, duplex mode, question types
- **Tabs**: Switch between editor/preview/print/test views
- **Separator**: Visual breaks between sections
- **Label**: Form field labels throughout
- **Switch**: Toggles for crop marks, borders, duplex mode, color/ink-saver
- **Slider**: Font size, image scale, card spacing, offset adjustments
- **Badge**: Card counts, tags, status indicators
- **Scroll Area**: Scrollable card list in editor
- **Popover**: Quick settings, color pickers
- **Toast (Sonner)**: Save confirmations, error messages, export success
- **Accordion**: Collapsible settings panels to reduce clutter

### **Customizations**:
- **CardEditor Component**: Custom drag-drop list with inline editing, image preview, bulk paste area
- **PrintPreview Component**: Custom paginated view with zoom controls, page indicators
- **DuplexAlignmentTool**: Custom visual guide showing front/back sheet alignment
- **TestGenerator Component**: Custom form builder for test configuration
- **ThemeSelector**: Custom card appearance preview grid
- **LayoutGrid**: Custom print layout calculator with card positioning engine

### **States**:
- Buttons: Distinct hover (shadow lift + brightness), active (slight scale), disabled (50% opacity)
- Inputs: Focus (ring-2 ring-primary), error (ring-destructive + error message), success (subtle green tint)
- Cards: Hover (shadow-md), selected (ring-2 ring-primary), dragging (shadow-2xl + rotate-1)
- Toggle switches: Smooth 200ms transition, clear on/off colors

### **Icon Selection** (Phosphor Icons):
- Plus: Add card, create set
- TrashSimple: Delete card
- CopySimple: Duplicate card
- DownloadSimple: Export PDF
- Printer: Print action
- ArrowsOutCardinal: Full screen preview
- GridFour: Layout selector
- Images: Image upload
- TextAa: Typography controls
- Palette: Theme selector
- FlipHorizontal: Duplex flip controls
- ListDashes: Test generator
- GearSix: Settings
- CaretLeft/Right: Page navigation

### **Spacing**:
- App shell padding: p-6
- Panel gaps: gap-4 for horizontal, gap-6 for vertical sections
- Card editor list: gap-2 between cards
- Settings groups: space-y-4
- Form fields: space-y-2
- Button groups: gap-2
- Print margins: Safe area 0.5in for Letter, 12.7mm for A4

### **Mobile**:
- Stack panels vertically instead of side-by-side
- Full-width cards on mobile
- Preview becomes full-screen modal
- Reduce app shell padding to p-4
- Sticky header with hamburger menu for settings
- Touch-friendly drag handles (larger hit areas)
- Bottom sheet for quick actions
- Simplified print view (hide advanced options by default)
