# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RecTime is a web-based audio recording application built with React and TypeScript. It records audio using the Opus codec, stores recordings in IndexedDB, and provides playback functionality with note-taking capabilities.

## Common Commands

### Development
```bash
npm start          # Start development server on http://localhost:3000
npm test           # Run tests in interactive watch mode
npm run build      # Build production bundle to build/ directory
```

### Testing Individual Components
```bash
npm test -- --testPathPattern=<component-name>  # Run tests for specific component
```

## Architecture Overview

### Audio Recording Pipeline

The application uses a sophisticated audio processing pipeline:

1. **Opus Codec Integration** (`src/Recorder.ts`, `src/Opus`)
   - Web Worker (`public/opus/worker.js`) handles Opus encoding/decoding off the main thread
   - WASM module (`public/opus/index.wasm`) provides native Opus codec performance
   - Client communicates with worker via `opus-codec-worker` actions

2. **Audio Worklet Processing** (`public/worklet.js`)
   - Custom AudioWorkletProcessor named `default-audio-processor`
   - Implements a ring buffer to collect samples at the configured frame size
   - Processes audio in the audio thread, sends samples to main thread via MessagePort
   - Frame sizes must be Opus-compliant: 60ms, 40ms, 20ms, 10ms, 5ms, or 2.5ms

3. **Recorder State Machine** (`src/Recorder.ts`)
   - States: Idle, StartingToRecord, Recording, StoppingToRecord
   - Handles MediaStream management, encoder lifecycle, and device switching
   - Emits events: `startRecording`, `encoded`

4. **Database Integration** (`src/RecorderWithDatabase.ts`)
   - Bridges `Recorder` and `RecorderDatabase`
   - Automatically persists encoded audio chunks to IndexedDB
   - Manages recording lifecycle

### Data Storage

**IndexedDB Schema** (`src/RecorderDatabase.ts`):
- `recordings` store: Recording metadata (id, name, sampleRate, channels, duration, size, frameSize, encoderId)
- `recordingData` store: Encoded audio blobs with offset tracking for seeking
- `recordingNotes` store: User notes with timestamps linked to recordings

**Key Design**: Each recording's audio data is stored as a single Blob in `recordingData`, with an array of offsets (`IRecordingDataOffset[]`) that map time positions to byte ranges for efficient seeking during playback.

### React Architecture

**Context Providers** (established in `src/index.tsx`):
- `RecorderContext`: Provides shared `Opus` instance, `RecorderWithDatabase`, `AudioContext`, and worklet initialization
- `RecorderDatabaseContext`: Provides `RecorderDatabase` instance
- `DeviceDimensionsContext`: Tracks window dimensions for responsive UI

**Routing Structure**:
- `/` - Main record screen (`RecordScreen.tsx`)
- `/recordings` - List all recordings (`RecordingListScreen.tsx`)
- `/recording/:recordingId` - Recording detail and playback (`RecordingDetailScreen.tsx`)

### Custom Hooks

Key hooks that encapsulate complex logic:
- `useRecorderDatabase`: Manages IndexedDB connection and CRUD operations
- `useRecordingPlayer`: Handles Opus decoding and Web Audio API playback
- `useRecordings`: Paginated recording list with deletion
- `useRecordingNotes`: Note management for recordings
- `useMediaDevices`: Enumerates and monitors audio input devices
- `useDebugAudioVisualizer`: Real-time waveform visualization using AnalyserNode

## Key Technical Details

### TypeScript Configuration
- Strict mode enabled with all strict flags active
- `experimentalDecorators: true` for `autobind-decorator` usage
- JSX preserved (processed by react-scripts)

### Audio Context
- Fixed sample rate: 48000 Hz (set in `src/index.tsx`)
- Uses `standardized-audio-context` for cross-browser compatibility

### Build System
- Uses Create React App (react-scripts)
- No custom webpack configuration (not ejected)
- Deployment via GitHub Actions to remote server on push to master

### Dependencies of Note
- `opus-codec-worker`: Opus encoding in Web Workers
- `standardized-audio-context`: Cross-browser Web Audio API
- `idb-javascript`: IndexedDB wrapper with transaction management
- `eventual-js`: EventEmitter implementation
- `luxon`: DateTime formatting
- `autobind-decorator`: Class method binding

## Working with Audio Recording

When modifying recording logic:
1. Ensure frame sizes remain Opus-compliant (see `#opusCompliantDurations` in `Recorder.ts`)
2. Opus encoder configuration is in `Recorder.start()` - bitrate defaults to 32000 bps
3. The worklet must be loaded before creating `RecorderWithDatabase` (see `index.tsx` initialization)
4. Audio chunks are encoded asynchronously; handle backpressure in the worklet message handler

## Working with Database

When modifying storage:
1. Database version is currently 1; increment for schema changes
2. Update `onUpgradeNeeded` method in `RecorderDatabase.ts` for migrations
3. Blob offsets must be updated atomically with recording metadata
4. Recording data uses compound indexing: `recordingId` for efficient queries
