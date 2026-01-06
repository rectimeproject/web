# Copilot Instructions for RecTime

## Project Overview

RecTime is a web-based audio recorder using Opus codec, React 19, TypeScript, and IndexedDB. Audio processing happens in Web Workers and AudioWorklets for performance. Uses Vite (not CRA despite README).

## Development Commands

```bash
npm run dev      # Start Vite dev server on http://localhost:3000
npm run build    # TypeScript compile + Vite production build
npm run preview  # Preview production build locally
npm test         # Run Vitest tests
```

## Architecture Patterns

### Audio Pipeline (Critical Understanding)

**Recording Flow**: MediaStream → AudioWorklet (`public/worklet.js`) → Main Thread → Web Worker (`public/opus/worker.js` with WASM) → IndexedDB

1. **AudioWorklet** (`default-audio-processor`) runs in audio thread:
   - Collects samples using ring buffer at Opus-compliant frame sizes (60/40/20/10/5/2.5ms)
   - Posts audio buffers to main thread via MessagePort
   - Frame size must match encoder configuration

2. **Web Worker Encoding** (`src/Recorder.ts` + `opus-codec-worker`):
   - Receives raw audio from main thread
   - Encodes to Opus in worker (CPU-intensive operation off main thread)
   - Returns encoded chunks with duration metadata

3. **Storage Strategy** (`src/RecorderDatabase.ts`):
   - Encoded audio stored as single Blob per recording in `recordingData` store
   - `IRecordingDataOffset[]` array maps timestamps to byte ranges for seeking
   - Metadata in `recordings` store (name, duration, sampleRate, channels, frameSize)

**Playback Flow**: IndexedDB → Decode chunks sequentially → Web Audio API scheduling

### State Management Conventions

- **React Query** for all database operations (see `src/hooks/queries/`)
  - Query keys centralized in `src/lib/queryKeys.ts`
  - 5-minute stale time, no refetch on window focus (preserves recording state)
  - Mutations invalidate related queries automatically

- **Context Providers** (initialized in `src/main.tsx`):
  - `RecorderContext`: Shared AudioContext (48kHz fixed), Opus instance, RecorderWithDatabase
  - `RecorderDatabaseContext`: IndexedDB wrapper instance
  - All hooks use `useRecorderContext()` / `useRecorderDatabaseContext()` - never instantiate directly

- **Custom Hooks Pattern**:
  - Prefix `use*` for all hooks
  - Database queries: `useRecording*Query/Mutation` pattern
  - Player logic in `useRecordingPlayer` (manages AnalyserNode, playback scheduling, seeking)
  - Visual components use dedicated hooks: `usePixiApp`, `useVisualizerBars`, `useTimelineWaveform`

### Component Architecture

**Lazy Loading**: All route components and heavy visualizers use React.lazy + Suspense with ActivityIndicator fallback

**Route Structure**:

- `/` → `RecordScreen.tsx` (main recording interface)
- `/recordings` → `RecordingListScreen.tsx` (paginated list)
- `/recording/:recordingId` → `RecordingDetailScreen.tsx` (playback + notes)

**Visualization Components** (`src/components/visualizer/`, `src/hooks/visualizer/`):

- PixiJS-based for performance (60fps requirement)
- `TimelineVisualizer`: Waveform over time with bookmarks
- `FrequencyVisualizer`: Real-time FFT bars
- Real-time waveform uses `AnalyserNode.getByteTimeDomainData()` in `requestAnimationFrame` loop
- Bars occupy 80% of canvas height (design spec)

### Styling Conventions

**TailwindCSS + Dark Mode**:

- Dark mode via `darkMode: "media"` (system preference, not manual toggle)
- Always pair light/dark variants: `bg-white dark:bg-gray-900`
- Apple-inspired design tokens in `tailwind.config.ts`
- Touch targets minimum 48px for mobile (see `src/styles/README.md`)
- Material Design Icons via `<Icon name="icon_name" />` component

**Component Styling Pattern**:

```tsx
// Preferred: Inline Tailwind classes with dark: variants
<button className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700">

// Theme colors from hook when dynamic:
const theme = useTheme();
<Component backgroundColor={theme.colors.background} />
```

## Critical Technical Constraints

### Opus Codec Requirements

- Frame sizes MUST be Opus-compliant: 2.5, 5, 10, 20, 40, 60ms (see `#opusCompliantDurations` in `Recorder.ts`)
- Sample rate fixed at 48000 Hz (set in AudioContext creation)
- Encoder bitrate defaults to 32000 bps (configurable in `Recorder.start()`)

### AudioWorklet Initialization

- Worklet MUST load before creating RecorderWithDatabase (async dependency in `main.tsx`)
- Check `recorderContext.worklet` promise resolution before recording
- AudioWorklet processor name: `default-audio-processor`

### Database Schema Evolution

- Current version: 1
- To add migrations: increment version, update `onUpgradeNeeded()` in `RecorderDatabase.ts`
- Recording data offsets must update atomically with metadata (transaction safety)

## File Linking Guidelines

When referencing files/lines in messages:

- Use workspace-relative paths: `[RecorderDatabase.ts](src/RecorderDatabase.ts)`
- With line numbers: `[Recorder state machine](src/Recorder.ts#L150-L200)`
- NO backticks around file links: ~~`[file.ts](file.ts)`~~

## Common Workflows

### Adding a New Recording Feature

1. Define data structure in `RecorderDatabase.ts` (add to stores or extend interfaces)
2. Create React Query hook in `src/hooks/queries/` following existing patterns
3. Add query key to `src/lib/queryKeys.ts`
4. Implement UI in appropriate screen component
5. Update invalidation logic in mutations if needed

### Adding Real-time Audio Visualization

1. Get AnalyserNode from `useRecorderContext()` during recording or `useRecordingPlayer()` during playback
2. Use `requestAnimationFrame` loop with `getByteTimeDomainData()` or `getByteFrequencyData()`
3. For performance: use PixiJS (see existing visualizer hooks)
4. Consider lazy loading component to reduce initial bundle

### Testing Audio Features Locally

- Use Chrome/Edge (best Web Audio API support)
- Grant microphone permissions
- Check browser console for detailed logging (recording state transitions, waveform capture, etc.)
- IndexedDB can be inspected in DevTools → Application → Storage

## Dependencies Worth Noting

- `standardized-audio-context`: Cross-browser Web Audio API compatibility layer
- `idb-javascript`: IndexedDB wrapper with promise-based API
- `autobind-decorator`: Class method binding (used in Recorder/Database classes)
- `opus-codec-worker`: Web Worker + WASM Opus codec
- `pixi.js`: WebGL-based 2D rendering for visualizations
- `@tanstack/react-query`: Server state management (adapted for IndexedDB)

## Anti-Patterns to Avoid

- ❌ Don't create new AudioContext instances (use context provider)
- ❌ Don't bypass React Query for database operations (breaks cache invalidation)
- ❌ Don't use non-Opus-compliant frame sizes
- ❌ Don't block main thread with encoding (use Web Worker pattern)
- ❌ Don't forget dark mode variants in Tailwind classes
- ❌ Don't load heavy visualizer components eagerly (use React.lazy)
