# QoL improvements planned in this PR

This PR is intended to implement the first quality-of-life improvements for FlashForge:

1. Debounced autosave instead of saving on every keystroke
2. Visible save state in the editor (`Saving…`, `Saved`, `Save failed`)
3. Safer save error handling so localStorage quota failures are surfaced clearly

## Target files

- `src/App.tsx`
- optionally `src/lib/storage.ts`

## Intended behavior

### Debounced persistence
- Keep `localSet` updates instant in the editor UI
- Delay persistence by roughly 500ms after the last edit
- Avoid writing the full set to storage on every single keystroke

### Save status UI
- Add a compact status indicator near the editor header
- States:
  - `Saving…`
  - `Saved`
  - `Save failed`

### Error handling
- Catch save failures from `saveSet(updated)`
- Keep the editor usable even if persistence fails
- Show a toast if local storage is full or unavailable

## Suggested implementation notes

### In `SetEditor`
- Track `saveState` with something like:
  - `idle`
  - `saving`
  - `saved`
  - `error`
- Use `useEffect` with `setTimeout` / cleanup to debounce `onUpdate(localSet)`
- Do not call `onUpdate` on every render cycle

### In `App`
- Wrap `saveSet(updated)` in `try/catch`
- Only update outer state after successful persistence, or preserve the local editor state separately if persistence fails

## Why this matters
The current editor flow persists on each local change, which can become noisy and brittle for larger sets with images. This change should make the app feel smoother and more trustworthy for teachers building bigger print sets.
