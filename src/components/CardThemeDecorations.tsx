import type { CardTheme } from '@/lib/types'
import { isDesignerCardTheme } from '@/lib/card-themes'

interface CardThemeDecorationsProps {
  theme: CardTheme
}

const commonSvgProps = {
  viewBox: '0 0 100 100',
  preserveAspectRatio: 'none' as const,
  'aria-hidden': true,
  focusable: false,
}

export function CardThemeDecorations({ theme }: CardThemeDecorationsProps) {
  if (!isDesignerCardTheme(theme)) return null

  return (
    <div className="card-theme-decorations pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden="true">
      {theme === 'dreamy-classroom' && <DreamyClassroom />}
      {theme === 'storybook' && <Storybook />}
      {theme === 'notebook-doodle' && <NotebookDoodle />}
      {theme === 'retro-schoolhouse' && <RetroSchoolhouse />}
      {theme === 'botanical-study' && <BotanicalStudy />}
      {theme === 'candy-pop' && <CandyPop />}
      {theme === 'space-explorer' && <SpaceExplorer />}
      {theme === 'modern-editorial' && <ModernEditorial />}
    </div>
  )
}

function DreamyClassroom() {
  return (
    <svg {...commonSvgProps} className="h-full w-full">
      <rect x="3.5" y="3.5" width="93" height="93" rx="5" fill="none" stroke="var(--card-theme-gold)" strokeWidth="1.2" opacity=".88" />
      <rect x="6.2" y="6.2" width="87.6" height="87.6" rx="4" fill="none" stroke="var(--card-theme-gold)" strokeWidth=".55" opacity=".65" />
      <path d="M5 18c5 0 8-3 8-8M5 12c3 0 5-2 5-5M95 18c-5 0-8-3-8-8M95 12c-3 0-5-2-5-5M5 82c5 0 8 3 8 8M95 82c-5 0-8 3-8 8" fill="none" stroke="var(--card-theme-gold)" strokeWidth="1" strokeLinecap="round" opacity=".9" />
      <path d="M18 20c2.2-4.5 8-4.3 9.2.2 4.7-.6 6.2 5.7 1.7 7.3H19c-5.2-1.1-5.4-5.8-1-7.5Z" fill="var(--card-theme-soft)" stroke="var(--card-accent)" strokeWidth=".7" opacity=".92" />
      <path d="M77 78c1.9-3.7 6.8-3.6 7.9.1 4-.4 5.2 4.8 1.4 6.1h-8.4c-4.3-.9-4.5-4.7-.9-6.2Z" fill="var(--card-theme-soft)" stroke="var(--card-accent)" strokeWidth=".65" opacity=".8" />
      <g fill="var(--card-accent)" opacity=".65">
        <path d="M66 16l1.1 2.8 2.9 1.1-2.9 1.1-1.1 2.8-1.1-2.8-2.9-1.1 2.9-1.1Z" />
        <path d="M23 72l.8 2.1 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" />
        <path d="M83 35l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z" />
      </g>
      <g transform="translate(69 7)">
        <path d="M0 3h21l-3 5 3 5H0Z" fill="var(--card-accent)" opacity=".83" />
        <path d="M2 5h15v6H2Z" fill="rgba(255,255,255,.12)" />
      </g>
    </svg>
  )
}

function Storybook() {
  return (
    <svg {...commonSvgProps} className="h-full w-full">
      <path d="M4 13Q4 4 13 4h74q9 0 9 9v74q0 9-9 9H13q-9 0-9-9Z" fill="none" stroke="var(--card-accent)" strokeWidth="1.2" opacity=".55" />
      <path d="M9 14c4-7 10-9 17-8M91 14c-4-7-10-9-17-8M9 86c4 7 10 9 17 8M91 86c-4 7-10 9-17 8" fill="none" stroke="var(--card-main)" strokeWidth=".75" strokeLinecap="round" opacity=".38" />
      <g fill="var(--card-theme-soft)" stroke="var(--card-accent)" strokeWidth=".55" opacity=".85">
        <circle cx="14" cy="19" r="3.5" />
        <circle cx="19" cy="15" r="2.4" />
        <circle cx="85" cy="80" r="3.1" />
      </g>
      <g fill="var(--card-accent)" opacity=".45">
        <path d="M77 18l1.2 2.5 2.6.4-1.9 1.9.5 2.6-2.4-1.2-2.3 1.2.4-2.6-1.8-1.9 2.6-.4Z" />
        <path d="M25 82l.9 1.9 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.4-2-1.5-1.4 2-.3Z" />
      </g>
      <path d="M38 6c7 3 17 3 24 0" fill="none" stroke="var(--card-accent)" strokeWidth=".6" strokeLinecap="round" opacity=".45" />
    </svg>
  )
}

function NotebookDoodle() {
  return (
    <svg {...commonSvgProps} className="h-full w-full">
      <path d="M13 0v100" stroke="var(--card-accent)" strokeWidth=".65" opacity=".3" />
      <path d="M82 14l2.2 4.5 4.8.7-3.5 3.4.8 4.8-4.3-2.2-4.3 2.2.8-4.8-3.5-3.4 4.8-.7Z" fill="none" stroke="var(--card-accent)" strokeWidth="1.05" strokeLinejoin="round" opacity=".75" />
      <path d="M19 78c7-7 14 7 22 0s14 5 20-1" fill="none" stroke="var(--card-main)" strokeWidth="1" strokeLinecap="round" opacity=".38" />
      <path d="M72 74h13M80 69l5 5-5 5" fill="none" stroke="var(--card-accent)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity=".72" />
      <g transform="translate(8 5) rotate(-5 15 4)">
        <rect x="0" y="0" width="30" height="8" rx="1" fill="var(--card-theme-tape)" opacity=".75" />
        <path d="M3 2h24M5 5h20" stroke="rgba(255,255,255,.38)" strokeWidth=".55" />
      </g>
      <circle cx="88" cy="84" r="1.2" fill="var(--card-accent)" opacity=".7" />
      <circle cx="92" cy="79" r=".8" fill="var(--card-main)" opacity=".45" />
    </svg>
  )
}

function RetroSchoolhouse() {
  return (
    <svg {...commonSvgProps} className="h-full w-full">
      <rect x="4" y="4" width="92" height="92" rx="2" fill="none" stroke="var(--card-main)" strokeWidth="1.2" opacity=".75" />
      <rect x="7" y="7" width="86" height="86" rx="1" fill="none" stroke="var(--card-accent)" strokeWidth=".55" opacity=".75" />
      <path d="M4 19h18V4M96 19H78V4M4 81h18v15M96 81H78v15" fill="none" stroke="var(--card-accent)" strokeWidth="2" opacity=".6" />
      <circle cx="84" cy="17" r="7" fill="var(--card-accent)" opacity=".18" />
      <circle cx="84" cy="17" r="5.2" fill="none" stroke="var(--card-accent)" strokeWidth=".8" opacity=".8" />
      <path d="M81 17h6M84 14v6" stroke="var(--card-accent)" strokeWidth=".8" opacity=".75" />
      <path d="M15 84h22" stroke="var(--card-main)" strokeWidth="1.4" opacity=".55" />
      <path d="M15 88h14" stroke="var(--card-accent)" strokeWidth=".8" opacity=".7" />
    </svg>
  )
}

function BotanicalStudy() {
  return (
    <svg {...commonSvgProps} className="h-full w-full">
      <rect x="4.5" y="4.5" width="91" height="91" rx="5" fill="none" stroke="var(--card-accent)" strokeWidth=".7" opacity=".55" />
      <path d="M8 31c8-3 13-10 14-21M14 24c-5-1-7-4-7-8M18 19c4-2 6-5 7-9M92 69c-8 3-13 10-14 21M86 76c5 1 7 4 7 8M82 81c-4 2-6 5-7 9" fill="none" stroke="var(--card-main)" strokeWidth=".9" strokeLinecap="round" opacity=".55" />
      <g fill="var(--card-accent)" opacity=".28">
        <ellipse cx="12" cy="17" rx="3.4" ry="1.5" transform="rotate(35 12 17)" />
        <ellipse cx="19" cy="13" rx="3.2" ry="1.4" transform="rotate(-35 19 13)" />
        <ellipse cx="88" cy="83" rx="3.4" ry="1.5" transform="rotate(35 88 83)" />
        <ellipse cx="81" cy="87" rx="3.2" ry="1.4" transform="rotate(-35 81 87)" />
      </g>
      <circle cx="88" cy="15" r="1" fill="var(--card-accent)" opacity=".55" />
      <circle cx="84" cy="18" r=".6" fill="var(--card-main)" opacity=".45" />
    </svg>
  )
}

function CandyPop() {
  return (
    <svg {...commonSvgProps} className="h-full w-full">
      <circle cx="10" cy="17" r="9" fill="var(--card-theme-pink)" opacity=".34" />
      <circle cx="91" cy="24" r="13" fill="var(--card-theme-cyan)" opacity=".28" />
      <circle cx="86" cy="88" r="10" fill="var(--card-theme-yellow)" opacity=".36" />
      <circle cx="17" cy="83" r="6" fill="var(--card-accent)" opacity=".18" />
      <path d="M73 9l1.4 3.4 3.6 1.4-3.6 1.4-1.4 3.5-1.4-3.5-3.6-1.4 3.6-1.4Z" fill="var(--card-accent)" opacity=".7" />
      <path d="M18 36c4-5 9 5 13 0s9 5 13 0" fill="none" stroke="var(--card-accent)" strokeWidth="1.3" strokeLinecap="round" opacity=".52" />
      <g transform="translate(69 70) rotate(8 11 6)">
        <rect width="22" height="12" rx="5" fill="var(--card-accent)" opacity=".16" stroke="var(--card-accent)" strokeWidth=".8" />
        <circle cx="6" cy="6" r="1.2" fill="var(--card-accent)" opacity=".62" />
        <path d="M10 6h7" stroke="var(--card-accent)" strokeWidth="1" strokeLinecap="round" opacity=".62" />
      </g>
    </svg>
  )
}

function SpaceExplorer() {
  return (
    <svg {...commonSvgProps} className="h-full w-full">
      <g fill="var(--card-accent)">
        <circle cx="13" cy="15" r=".7" opacity=".8" />
        <circle cx="24" cy="8" r=".45" opacity=".6" />
        <circle cx="69" cy="14" r=".55" opacity=".8" />
        <circle cx="90" cy="10" r=".4" opacity=".7" />
        <circle cx="86" cy="48" r=".7" opacity=".65" />
        <circle cx="15" cy="63" r=".5" opacity=".8" />
        <circle cx="72" cy="87" r=".45" opacity=".7" />
        <circle cx="91" cy="78" r=".55" opacity=".8" />
      </g>
      <g transform="translate(74 20)">
        <circle cx="9" cy="9" r="5.8" fill="var(--card-theme-planet)" opacity=".78" />
        <ellipse cx="9" cy="9" rx="10" ry="3.1" fill="none" stroke="var(--card-accent)" strokeWidth="1" opacity=".75" transform="rotate(-12 9 9)" />
      </g>
      <path d="M15 82l1.1 2.8 2.9 1.1-2.9 1.1-1.1 2.8-1.1-2.8-2.9-1.1 2.9-1.1Z" fill="var(--card-accent)" opacity=".85" />
      <path d="M30 16l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" fill="var(--card-main)" opacity=".58" />
      <path d="M20 48c8-5 17-7 27-5" fill="none" stroke="var(--card-accent)" strokeWidth=".6" strokeDasharray="2.5 2.5" opacity=".36" />
    </svg>
  )
}

function ModernEditorial() {
  return (
    <svg {...commonSvgProps} className="h-full w-full">
      <rect x="0" y="0" width="5" height="100" fill="var(--card-accent)" opacity=".88" />
      <rect x="74" y="0" width="26" height="8" fill="var(--card-main)" opacity=".12" />
      <rect x="82" y="8" width="18" height="5" fill="var(--card-accent)" opacity=".2" />
      <path d="M71 87h29v13H63Z" fill="var(--card-accent)" opacity=".12" />
      <path d="M8 10h21M8 14h12" stroke="var(--card-main)" strokeWidth="1.1" opacity=".48" />
      <circle cx="91" cy="25" r="2.2" fill="var(--card-accent)" opacity=".85" />
      <path d="M84 25h4M94 25h4" stroke="var(--card-main)" strokeWidth=".8" opacity=".45" />
    </svg>
  )
}
