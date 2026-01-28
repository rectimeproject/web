/**
 * Centralized query key factory for React Query.
 *
 * This provides type-safe, hierarchical query keys for all queries in the app.
 * Following React Query best practices for key structure.
 */

export const queryKeys = {
  recordings: {
    all: ["recordings"] as const,
    update: (id: string | null) =>
      [...queryKeys.recordings.all, "update", id] as const,
    lists: () => [...queryKeys.recordings.all, "list"] as const,
    list: (filters?: {offset?: number; limit?: number}) =>
      [...queryKeys.recordings.lists(), filters] as const,
    details: () => [...queryKeys.recordings.all, "detail"] as const,
    detail: (id: string | null) =>
      [...queryKeys.recordings.details(), id] as const
  },
  recordingNotes: {
    all: ["recordingNotes"] as const,
    lists: () => [...queryKeys.recordingNotes.all, "list"] as const,
    byRecording: (recordingId: string | null) =>
      [...queryKeys.recordingNotes.lists(), recordingId] as const
  },
  appSettings: {
    all: ["appSettings"] as const,
    preferredDevice: () =>
      [...queryKeys.appSettings.all, "preferredDevice"] as const
  }
} as const;
