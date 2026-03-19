# FlashForge Technical Architecture

**Production-ready flashcard creator - Technical deep dive**

## Technology Stack

### Core Framework
- **React 19.2.0** - UI library with latest features
- **TypeScript 5.7.3** - Type safety and developer experience
- **Vite 7.2.6** - Lightning-fast build tool and dev server

### UI & Styling
- **Tailwind CSS 4.1** - Utility-first CSS framework
- **shadcn/ui v4** - 40+ pre-built accessible components
- **Phosphor Icons 2.1** - Clean, consistent icon set
- **Framer Motion 12.23** - Animation library (minimal use)
- **Google Fonts** - Space Grotesk (headings), Inter (body)

### State & Data
- **React useState** - Local component state
- **localStorage** - Client-side persistence
- **Custom hooks** - Reusable logic (useIsMobile)

### Forms & Validation
- **Native form handling** - No heavyweight form library
- **Sonner** - Toast notifications for user feedback

### Drag & Drop
- **@dnd-kit** - Accessible drag-and-drop (installed, not yet implemented)

### Build & Deploy
- **Vercel** - Zero-config deployment platform
- **GitHub** - Source control and CI/CD

## Architecture Patterns

### Component Architecture

```
App (Main Container)
├── Header (Global nav & actions)
├── SetList (Project selector view)
│   └── SetCard × N (Individual set cards)
└── SetEditor (Active set editing view)
    ├── EditorPanel (Card CRUD)
    │   └── CardEditor × N (Individual card forms)
    ├── PreviewPanel (Print preview)
    │   └── PrintPage × N (Paginated preview)
    │       └── FlashCardDisplay × N (Card renderer)
    └── PrintView (Hidden, print-only)
        └── PrintPage × N
            └── FlashCardDisplay × N
```

### Data Flow

```
localStorage
    ↓
loadSets()
    ↓
App State (sets: FlashCardSet[])
    ↓
SetEditor (localSet: FlashCardSet)
    ↓
Update functions
    ↓
saveSet()
    ↓
localStorage
```

### Print Architecture

The print system is the most complex part:

1. **Layout Calculation** (`print-utils.ts`)
   - Calculate card dimensions based on paper size & cards per page
   - Account for safe margins (0.5" / 12.7mm)
   - Grid layout calculation (rows × cols)

2. **Pagination** (`paginateCards()`)
   - Split cards into pages
   - Each page = exactly `cardsPerPage` cards
   - No orphan cards

3. **Dual Rendering** (screen + print)
   - **Screen preview**: Scaled down (50%) for preview
   - **Print view**: Full size, hidden with `.print-only`
   - CSS media query `@media print` reveals print view

4. **Page Break Control**
   - `page-break-after: always` between pages
   - `break-inside: avoid` on cards (prevents card splitting)

5. **Duplex Support** (future enhancement)
   - Calculate mirrored positions for back pages
   - Flip modes: long-edge vs short-edge
   - Alignment offset controls

## File Structure

```
src/
├── components/
│   ├── ui/                    # shadcn components (40 files)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   └── FlashCardDisplay.tsx   # Card renderer component
│
├── lib/
│   ├── types.ts               # TypeScript interfaces & types
│   ├── storage.ts             # localStorage CRUD operations
│   ├── print-utils.ts         # Print layout calculations
│   └── utils.ts               # cn() helper for className merging
│
├── App.tsx                    # Main application component
├── index.css                  # Global styles, theme, print CSS
└── main.tsx                   # React entry point (don't modify)
```

## Data Models

### Core Types

```typescript
interface FlashCardSet {
  id: string                    // Unique identifier
  title: string                 // Set name
  subtitle?: string             // Optional subtitle
  className?: string            // Optional class name
  notes?: string                // Private notes
  cards: FlashCard[]            // Array of cards
  cardType: CardType            // 'single-sided' | 'double-sided'
  printSettings: PrintSettings  // Print configuration
  testSettings: TestSettings    // Test generation config
  createdAt: number             // Timestamp
  updatedAt: number             // Timestamp
}

interface FlashCard {
  id: string                    // Unique identifier
  frontText: string             // Front text content
  backText: string              // Back text content
  frontSecondary?: string       // Optional front subtitle
  backSecondary?: string        // Optional back subtitle
  imageUrl?: string             // Base64 or URL
  imagePosition?: 'front' | 'back' | 'both'
  tags?: string[]               // Categorization
  category?: string             // Group identifier
}

interface PrintSettings {
  cardsPerPage: 1 | 2 | 4 | 6 | 8 | 9 | 10 | 12
  paperSize: 'a4' | 'letter'
  orientation: 'portrait' | 'landscape'
  theme: CardTheme
  // ... 20+ more styling options
}
```

### Storage Schema

```typescript
{
  version: "1.0",              // Schema version for migrations
  sets: FlashCardSet[],        // Array of all sets
  lastModified: number         // Timestamp of last save
}
```

Stored in localStorage at key: `flashforge_sets`

## Print Layout Algorithm

### Card Dimensions

```typescript
// Given:
const paperSize = { width: 816px, height: 1056px }  // Letter
const cardsPerPage = 4
const safeMargin = 48px (0.5 inch)

// Calculate:
const { rows, cols } = getRowsCols(4)  // { rows: 2, cols: 2 }
const availableWidth = 816 - (48 * 2) = 720px
const availableHeight = 1056 - (48 * 2) = 960px
const gap = 12px

const cardWidth = (720 - 12 * (2 - 1)) / 2 = 354px
const cardHeight = (960 - 12 * (2 - 1)) / 2 = 474px
```

### Responsive Font Sizing

```typescript
function calculateFontSize(
  baseSize: number,
  cardsPerPage: CardsPerPage,
  textLength: number
): number {
  // Scale factor based on card size
  const scaleFactor = 
    cardsPerPage <= 2 ? 1.5 :
    cardsPerPage <= 4 ? 1.2 :
    cardsPerPage <= 6 ? 1 : 0.85

  let adjustedSize = baseSize * scaleFactor

  // Reduce size for long text
  if (textLength > 30) adjustedSize *= 0.85
  else if (textLength > 20) adjustedSize *= 0.95

  return Math.max(adjustedSize, 10)  // Minimum 10px
}
```

## State Management

### Why No Redux/Zustand?

For this application:
- State is simple (list of sets + current set)
- No complex derived state
- No global modals or overlays
- localStorage is the source of truth
- Adding state management would be overkill

### Current State Strategy

```typescript
// App-level state
const [sets, setSets] = useState<FlashCardSet[]>([])
const [currentSet, setCurrentSet] = useState<FlashCardSet | null>(null)

// Editor-level state
const [localSet, setLocalSet] = useState(set)

// Autosave pattern
useEffect(() => {
  onUpdate(localSet)  // Triggers save in parent
}, [localSet])
```

### If You Need Global State Later

Best options:
1. **Zustand** - Minimal, no boilerplate
2. **Jotai** - Atomic state management
3. **React Context** - Built-in, good for auth

## Performance Considerations

### Current Optimizations

✅ **Lazy loading**: Cards only render visible pages in preview  
✅ **Image compression**: Automatic downscaling on upload  
✅ **Debounced saves**: Autosave on useEffect, not every keystroke  
✅ **CSS-based rendering**: No canvas/WebGL overhead  
✅ **Vite code splitting**: Automatic chunk optimization

### If App Grows

Consider adding:
- Virtual scrolling for long card lists (react-window)
- Image lazy loading (react-lazy-load-image)
- Memoization for expensive renders (React.memo, useMemo)
- Web Workers for heavy processing (image compression)

## Print Strategy Deep Dive

### Why Not Direct PDF Generation?

We evaluated:
- ❌ **jsPDF**: Requires canvas rendering, text becomes rasterized
- ❌ **pdfmake**: Complex API, limited styling
- ❌ **react-pdf**: Server-side rendering required
- ❌ **Puppeteer**: Node.js only, can't run in browser

✅ **Browser Print-to-PDF**:
- Native browser feature
- Vector text (crisp at any zoom)
- Respects CSS print styles
- Works offline
- Zero dependencies
- Consistent across devices

### Print CSS Strategy

```css
@media print {
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  
  @page {
    margin: 0;
    size: auto;
  }
  
  .page-break-after {
    page-break-after: always;
  }
}
```

### Alternative: Server-Side PDF

If you add a backend later:

```typescript
// Option 1: Puppeteer
import puppeteer from 'puppeteer'

const browser = await puppeteer.launch()
const page = await browser.newPage()
await page.goto('your-print-url')
await page.pdf({ path: 'flashcards.pdf' })
```

```typescript
// Option 2: Playwright
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto('your-print-url')
await page.pdf({ path: 'flashcards.pdf' })
```

## Security Considerations

### Current Security

✅ **No user data transmission** - Everything local  
✅ **No external API calls** - Zero network requests  
✅ **No XSS vectors** - React auto-escapes content  
✅ **HTTPS on Vercel** - Automatic SSL  
✅ **Security headers** - Configured in vercel.json

### If Adding Authentication

Must implement:
- CSRF protection
- Rate limiting on API
- Input validation/sanitization
- Secure session management
- HTTPS-only cookies

### If Adding Image Upload to Cloud

Must implement:
- File type validation
- Size limits
- Virus scanning
- Content moderation
- Signed URLs for uploads

## Testing Strategy

### Current Testing

- Manual testing during development
- Print testing on multiple browsers
- Layout validation across paper sizes

### Recommended Testing Setup

```bash
# Unit tests
npm install -D vitest @testing-library/react @testing-library/jest-dom

# E2E tests
npm install -D @playwright/test
```

Example test:

```typescript
import { render, screen } from '@testing-library/react'
import { FlashCardDisplay } from './FlashCardDisplay'

test('renders card with front text', () => {
  const card = {
    id: '1',
    frontText: 'Hello',
    backText: 'Hola',
  }
  
  render(
    <FlashCardDisplay
      card={card}
      settings={DEFAULT_PRINT_SETTINGS}
      cardWidth={200}
      cardHeight={300}
      side="front"
    />
  )
  
  expect(screen.getByText('Hello')).toBeInTheDocument()
})
```

## Deployment Architecture

### Vercel Build Process

```
1. GitHub push
   ↓
2. Vercel detects change
   ↓
3. npm install
   ↓
4. npm run build (Vite)
   ↓
5. Outputs to /dist
   ↓
6. Deploy to Edge Network
   ↓
7. Live at your-app.vercel.app
```

### Edge Network Benefits

- Global CDN (100+ locations)
- Automatic HTTPS
- Asset optimization
- Gzip/Brotli compression
- Smart caching

### Environment Variables

None needed currently, but if adding:

```bash
# .env.local (not committed)
VITE_API_URL=https://api.example.com
VITE_ENABLE_ANALYTICS=true
```

Access in code:
```typescript
const apiUrl = import.meta.env.VITE_API_URL
```

## Future Enhancements

### Authentication Flow

```typescript
// Add auth provider
import { createContext, useContext } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  
  async function login(email, password) {
    // Call auth API
    const user = await authAPI.login(email, password)
    setUser(user)
    localStorage.setItem('token', user.token)
  }
  
  return (
    <AuthContext.Provider value={{ user, login }}>
      {children}
    </AuthContext.Provider>
  )
}
```

### Cloud Sync

```typescript
// Replace localStorage with API
export async function saveSets(sets: FlashCardSet[]): Promise<void> {
  const token = localStorage.getItem('token')
  await fetch('/api/sets', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sets }),
  })
}
```

### CSV Import

```typescript
import Papa from 'papaparse'

function importCSV(file: File): Promise<FlashCard[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        const cards = results.data.map((row, index) => ({
          id: `card-${Date.now()}-${index}`,
          frontText: row['Front'] || row['Word'],
          backText: row['Back'] || row['Translation'],
        }))
        resolve(cards)
      },
      error: reject,
    })
  })
}
```

### Bulk Paste

```typescript
function parseBulkPaste(text: string): FlashCard[] {
  return text.split('\n')
    .filter(line => line.trim())
    .map((line, index) => {
      const [front, back] = line.split('\t')
      return {
        id: `card-${Date.now()}-${index}`,
        frontText: front?.trim() || '',
        backText: back?.trim() || '',
      }
    })
}
```

## Contributing Guidelines

### Code Style

- Use TypeScript strict mode
- Follow existing naming conventions
- Components use PascalCase
- Functions use camelCase
- Keep functions small and focused
- Comment complex logic

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/bulk-paste

# Make changes, test locally
npm run dev

# Commit with descriptive message
git commit -m "Add bulk paste feature for rapid card creation"

# Push and create PR
git push origin feature/bulk-paste
```

### Before Submitting PR

- [ ] Code builds without errors
- [ ] Print output tested in Chrome
- [ ] Mobile responsive (if UI changes)
- [ ] No console errors
- [ ] TypeScript types added
- [ ] README updated if needed

## License

MIT - Free to use, modify, and distribute

## Questions?

Open an issue on GitHub or check the README.md for more info.

---

**Built for teachers, documented for developers** 🚀
