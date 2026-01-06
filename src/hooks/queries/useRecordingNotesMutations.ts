import {useMutation, useQueryClient} from "@tanstack/react-query";
import {queryKeys} from "../../lib/queryKeys";
import useRecordingNotes from "../../useRecordingNotes";
import {IRecordingNote} from "../../RecorderDatabase";

export const useCreateRecordingNoteMutation = () => {
  const recordingNotes = useRecordingNotes();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      recordingId,
      durationOffset
    }: {
      recordingId: string;
      durationOffset: number;
    }) => {
      return await recordingNotes.createRecordingNote(
        recordingId,
        durationOffset
      );
    },
    onMutate: async ({recordingId, durationOffset}) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.recordingNotes.byRecording(recordingId)
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData<IRecordingNote[]>(
        queryKeys.recordingNotes.byRecording(recordingId)
      );

      // Create optimistic note
      const newNote: IRecordingNote = {
        id: crypto.getRandomValues(new Uint32Array(4)).join("-"),
        recordingId,
        durationOffset,
        title: "",
        contents: "",
        createdAt: new Date()
      };

      // Optimistically update
      queryClient.setQueryData(
        queryKeys.recordingNotes.byRecording(recordingId),
        (old: IRecordingNote[] = []) => [...old, newNote]
      );

      return {previous};
    },
    onError: (
      _err: unknown,
      variables: {recordingId: string; durationOffset: number},
      context: {previous: IRecordingNote[] | undefined} | undefined
    ) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.recordingNotes.byRecording(variables.recordingId),
          context.previous
        );
      }
    },
    onSettled: (
      _data: unknown,
      _error: unknown,
      variables: {recordingId: string; durationOffset: number}
    ) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.recordingNotes.byRecording(variables.recordingId)
      });
    }
  });
};

export const useUpdateRecordingNoteMutation = () => {
  const recordingNotes = useRecordingNotes();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (note: IRecordingNote) => {
      await recordingNotes.updateRecordingNote(note);
      return note;
    },
    onMutate: async (note: IRecordingNote) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.recordingNotes.byRecording(note.recordingId)
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData<IRecordingNote[]>(
        queryKeys.recordingNotes.byRecording(note.recordingId)
      );

      // Optimistically update
      queryClient.setQueryData(
        queryKeys.recordingNotes.byRecording(note.recordingId),
        (old: IRecordingNote[] = []) =>
          old.map(n => (n.id === note.id ? note : n))
      );

      return {previous, recordingId: note.recordingId};
    },
    onError: (
      _err: unknown,
      note: IRecordingNote,
      context: {previous: IRecordingNote[] | undefined; recordingId: string} | undefined
    ) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.recordingNotes.byRecording(note.recordingId),
          context.previous
        );
      }
    },
    onSettled: (note: IRecordingNote | void | null | undefined) => {
      // Refetch to ensure consistency
      if (note) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.recordingNotes.byRecording(note.recordingId)
        });
      }
    }
  });
};

export const useDeleteRecordingNoteMutation = () => {
  const recordingNotes = useRecordingNotes();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({noteId}: {noteId: string}) => {
      await recordingNotes.deleteRecordingNote(noteId);
      return noteId;
    },
    onMutate: async ({noteId}) => {
      // Find which recording this note belongs to
      // We'll need the recordingId to invalidate the correct query
      const note = await recordingNotes.getRecordingNoteById(noteId);
      if (!note) return {previous: null, recordingId: null};

      const recordingId = note.recordingId;

      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.recordingNotes.byRecording(recordingId)
      });

      // Snapshot previous value
      const previous =
        queryClient.getQueryData<IRecordingNote[]>(
          queryKeys.recordingNotes.byRecording(recordingId)
        ) ?? null;

      // Optimistically remove
      queryClient.setQueryData(
        queryKeys.recordingNotes.byRecording(recordingId),
        (old: IRecordingNote[] = []) => old.filter(n => n.id !== noteId)
      );

      return {previous, recordingId};
    },
    onError: (
      _err: unknown,
      _variables: {noteId: string},
      context:
        | {previous: IRecordingNote[] | null; recordingId: string | null}
        | undefined
    ) => {
      // Rollback on error
      if (context?.previous && context.recordingId) {
        queryClient.setQueryData(
          queryKeys.recordingNotes.byRecording(context.recordingId),
          context.previous
        );
      }
    },
    onSettled: (
      _data: unknown,
      _error: unknown,
      _variables: {noteId: string},
      context:
        | {previous: IRecordingNote[] | null; recordingId: string | null}
        | undefined
    ) => {
      // Refetch to ensure consistency
      if (context?.recordingId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.recordingNotes.byRecording(context.recordingId)
        });
      }
    }
  });
};
