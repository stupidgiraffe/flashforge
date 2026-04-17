# FlashForge 🎴

**Create beautiful, printable flashcards and tests in minutes.**

FlashForge is a production-ready web application designed for teachers to quickly create professional-quality flashcards and printable tests. Built with React, TypeScript, and Tailwind CSS, it runs entirely in the browser with no server required.

![FlashForge](https://img.shields.io/badge/React-19.2.0-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-4.1-blue)

## ✨ Features

### Core Functionality
- ✅ **Create Flashcard Sets** - Organize materials by unit, class, or topic
- ✅ **Quick Card Entry** - Add cards manually with front/back content
- ✅ **Single & Double-Sided Cards** - Support for various card styles
- ✅ **Flexible Print Layouts** - 1, 2, 4, 6, 8, 9, 10, or 12 cards per page
- ✅ **Multiple Paper Sizes** - A4 and US Letter support
- ✅ **Portrait & Landscape** - Choose your preferred orientation
- ✅ **Theme Presets** - Minimal, Classroom Cute, Bold Vocabulary, Picture Focus, Ink Saver, Quiz Card
- ✅ **Browser Storage** - All data persists locally, no login required
- ✅ **Print-Ready Output** - Optimized for clean, professional printing
- ✅ **Image Support** - Upload images for vocabulary and picture cards
- ✅ **Image Positioning** - Drag and zoom images to control crop/centering on cards
- ✅ **Google Image Search** - Search and insert images directly from the editor
- ✅ **Auto-Save** - Never lose your work
- ✅ **Backup Naming** - Choose custom names for local and Google Drive backups
- ✅ **Google Drive Backup** - Connect Drive to save and restore backup files

### Print & Export
- 📄 **Browser Print** - Use your browser's "Print to PDF" for reliable exports
- 🖨️ **Duplex Printing Support** - Long-edge and short-edge flip modes
- 📐 **Smart Page Layout** - Cards never split across pages
- ✂️ **Cut Lines & Borders** - Optional visual guides for cutting
- 🎨 **Color & Ink-Saver Modes** - Optimize for your printer
- 📏 **Safe Print Margins** - Consistent spacing across all printers

### User Experience
- 🚀 **Fast & Simple** - From idea to print in under 5 minutes
- 💾 **Local Storage** - Everything saved in your browser
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile
- 🎯 **Teacher-Focused** - Built by teachers, for teachers
- 🎨 **Modern UI** - Clean, professional interface

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173 in your browser
```

The app will automatically create a demo flashcard set on first launch to help you get started.

### Building for Production

```bash
# Create optimized production build
npm run build

# Preview production build locally
npm run preview
```

## 📦 Deployment to Vercel

FlashForge is optimized for deployment on Vercel with zero configuration required.

### Option 1: Deploy with Vercel CLI

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Deploy to Vercel
vercel

# Follow the prompts to complete deployment
```

### Option 2: Deploy via GitHub

1. Push your code to a GitHub repository
2. Visit [vercel.com](https://vercel.com) and sign in
3. Click "New Project"
4. Import your GitHub repository
5. Vercel will automatically detect the Vite configuration
6. Click "Deploy"

Your app will be live at `your-project.vercel.app`

### Vercel Configuration

The app works out-of-the-box on Vercel. If you need custom configuration, create a `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite"
}
```

## 📖 Usage Guide

### Creating Your First Set

1. Click "New Set" in the header
2. Enter a set title (e.g., "Spanish Vocabulary Unit 1")
3. Click "Create Set"

### Adding Cards

1. Click "Add Card" to create a new flashcard
2. Enter **Front Text** (e.g., "Apple")
3. Enter **Back Text** (e.g., "Manzana")
4. Optionally upload an image
5. Repeat for all your vocabulary

### Printing Your Cards

1. Switch to the **Preview** tab to see how your cards will print
2. Adjust print settings if needed:
   - Cards per page (1, 2, 4, 6, 8, 9, 10, 12)
   - Paper size (A4 or Letter)
   - Orientation (Portrait or Landscape)
   - Theme and styling options
3. Click the **Print** button
4. In the print dialog, select **"Save as PDF"** or print directly
5. For double-sided cards, print the front pages, flip the stack, and print the back pages

### Tips for Best Results

- **Use high-quality images**: 800x800px or larger recommended
- **Keep text concise**: Shorter text displays better on smaller cards
- **Test your printer**: Print a single page first to verify alignment
- **Use "Save as PDF"**: More reliable than third-party PDF export tools
- **Adjust margins**: If cards are cut off, your printer may have non-standard margins

## 🖨️ Print Best Practices

### PDF Export Strategy

Flash Forge uses your browser's native print-to-PDF feature for the most reliable, crisp output:

1. Click **Print** in the app
2. In the print dialog, select **"Save as PDF"** or **"Microsoft Print to PDF"**
3. Choose your settings (margins should be set to minimum/none)
4. Save the PDF

This approach ensures:
- ✅ Crisp text (not rasterized/blurry)
- ✅ Clean page breaks
- ✅ Consistent output across operating systems
- ✅ No external dependencies or API limits

### Browser Recommendations

- **Chrome/Edge**: Excellent print-to-PDF support, recommended
- **Firefox**: Good print support, may need margin adjustments
- **Safari**: Works well, ensure "Print Backgrounds" is enabled

### Duplex Printing

For double-sided cards:

1. Print all **front** pages first
2. Take the printed stack and flip it according to your printer:
   - **Long-edge flip**: Flip along the long side (most common)
   - **Short-edge flip**: Flip along the short side
3. Re-insert the paper and print **back** pages
4. Test with one sheet first to verify alignment

### Printer Quirks

If alignment is off:
- Check your printer's "Scale" setting (should be 100% or "Actual Size")
- Verify margins are set to minimum
- Some printers have a "borderless" mode that may help
- Try adjusting the offset settings in the app (coming in future update)

## 🏗️ Technical Architecture

### Tech Stack

- **React 19** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool & dev server
- **Tailwind CSS 4** - Styling
- **shadcn/ui** - Component library
- **Phosphor Icons** - Icon set
- **Sonner** - Toast notifications
- **dnd-kit** - Drag & drop (ready for future features)

### Project Structure

```
src/
├── components/
│   ├── ui/               # shadcn components (40+ pre-installed)
│   └── FlashCardDisplay.tsx  # Card rendering component
├── lib/
│   ├── types.ts          # TypeScript interfaces
│   ├── storage.ts        # localStorage utilities
│   ├── print-utils.ts    # Print layout calculations
│   └── utils.ts          # General utilities
├── App.tsx               # Main application
├── index.css             # Global styles & theme
└── main.tsx              # React entry point
```

### Data Storage

All data is stored in `localStorage` using a simple JSON structure:

```typescript
{
  version: "1.0",
  sets: [
    {
      id: "set-xxx",
      title: "My Vocabulary",
      cards: [
        {
          id: "card-xxx",
          frontText: "Hello",
          backText: "Hola",
          imageUrl: "data:image/jpeg;base64,..."
        }
      ],
      printSettings: { ... },
      createdAt: 1234567890,
      updatedAt: 1234567890
    }
  ]
}
```

### Adding Authentication (Future)

The codebase is structured to easily add authentication later:

1. Replace `localStorage` calls with API calls in `src/lib/storage.ts`
2. Add auth provider (Firebase, Supabase, Auth0, etc.)
3. Wrap app with auth context
4. Update storage functions to sync with backend

## 🎨 Customization

### Changing the Theme

Edit `src/index.css` to customize colors:

```css
:root {
  --primary: oklch(0.45 0.12 210);  /* Deep teal */
  --accent: oklch(0.65 0.18 25);    /* Coral */
  /* ... more color variables */
}
```

### Adding New Card Themes

Edit `src/components/FlashCardDisplay.tsx`:

```typescript
function getThemeClasses(theme: string): string {
  const themes: Record<string, string> = {
    minimal: 'bg-white',
    'your-theme': 'bg-gradient-to-br from-pink-50 to-purple-50',
    // ... add your theme
  }
  return themes[theme] || 'bg-white'
}
```

### Changing Fonts

Update `index.html` to load your preferred Google Fonts, then edit `src/index.css`:

```css
body {
  font-family: 'Your Font', sans-serif;
}

h1, h2, h3, h4, h5, h6 {
  font-family: 'Your Heading Font', sans-serif;
}
```

## 🐛 Known Limitations

- **CSV Import**: Planned for future release
- **Bulk Paste**: Planned for future release
- **Test Generation**: Planned for future release
- **Image Editing**: No built-in image cropping/editing (use external tools)
- **Cloud Sync**: Not available (localStorage only)
- **Collaboration**: Not supported (single-user only)
- **Browser Storage Limits**: ~5-10MB typical limit (enough for hundreds of cards)

## 🛠️ Troubleshooting

### Cards aren't printing correctly
- Ensure print dialog is set to "Actual Size" not "Fit to Page"
- Check that margins are set to minimum
- Try a different browser (Chrome recommended)

### Images are blurry
- Use larger source images (800x800px minimum)
- Ensure you're using "Save as PDF" not screenshot tools
- Check image compression settings

### App won't load
- Clear browser cache and refresh
- Check browser console for errors
- Ensure JavaScript is enabled

### Lost my data
- Check browser's localStorage (DevTools → Application → Local Storage)
- Data is tied to the domain - use the same URL
- Use Backup → Download All Sets or Google Drive Backups for external copies

### Google integrations not working
- Confirm Google OAuth Client ID, API key, and Search Engine ID are set in Backup → Google Drive Backups
- Ensure Google APIs for Drive and Custom Search are enabled in your Google Cloud project
- Retry after a minute if you hit API rate limits

## 📝 Roadmap

### v1.1 (Coming Soon)
- Bulk paste from spreadsheet
- CSV import/export
- Image upload from clipboard
- Drag-and-drop card reordering

### v1.2
- Test generator (multiple choice, matching, fill-in-blank)
- Answer key generation
- More card themes
- Font size presets

### v1.3
- Duplex alignment test page
- Manual offset controls
- Print preview zoom
- Card templates

### v2.0
- Optional cloud sync
- User accounts
- Share sets with other teachers
- Mobile app (PWA)

## 🤝 Contributing

This is a production-ready template. Feel free to fork and customize for your needs!

### Development Guidelines
- Follow existing code style
- Use TypeScript for type safety
- Test print output before committing layout changes
- Keep dependencies minimal and well-supported

## 📄 License

MIT License - free to use, modify, and distribute.

## 💡 Credits

Built with:
- [React](https://react.dev/)
- [Vite](https://vite.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Phosphor Icons](https://phosphoricons.com/)

---

**Made for teachers, by teachers.** 🍎

For questions, issues, or feature requests, please open an issue on GitHub.
