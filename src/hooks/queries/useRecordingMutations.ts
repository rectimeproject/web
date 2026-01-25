import {useMutation, useQueryClient} from "@tanstack/react-query";
import {queryKeys} from "../../lib/queryKeys.js";
import {useRecorderDatabaseContext} from "../../RecorderDatabaseContext.js";
import {RecordingV1} from "../../RecorderDatabase.js";

export const useUpdateRecordingMutation = () => {
  const db = useRecorderDatabaseContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recording: RecordingV1) => {
      await db
        .transaction("recordings", "readwrite")
        .objectStore("recordings")
        .put(recording);
      return recording;
    },
    onMutate: async newRecording => {
      // Cancel outgoing queries for this recording
      await queryClient.cancelQueries({
        queryKey: queryKeys.recordings.detail(newRecording.id)
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData<RecordingV1>(
        queryKeys.recordings.detail(newRecording.id)
      );

      // Optimistically update the recording detail
      queryClient.setQueryData(
        queryKeys.recordings.detail(newRecording.id),
        newRecording
      );

      // Optimistically update in the recordings list
      queryClient.setQueryData(queryKeys.recordings.lists(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            recordings: page.recordings.map((r: RecordingV1) =>
              r.id === newRecording.id ? newRecording : r
            )
          }))
        };
      });

      return {previous};
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.recordings.detail(variables.id),
          context.previous
        );
      }
    },
    onSettled: data => {
      // Refetch to ensure consistency
      if (data) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.recordings.detail(data.id)
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.recordings.lists()
        });
      }
    }
  });
};

export const useDeleteRecordingMutation = () => {
  const db = useRecorderDatabaseContext();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recordingId: string) => {
      await db
        .transaction("recordings", "readwrite")
        .objectStore("recordings")
        .delete(recordingId);
      return recordingId;
    },
    onMutate: async recordingId => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.recordings.lists()
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData(queryKeys.recordings.lists());

      // Optimistically remove from list
      queryClient.setQueryData(queryKeys.recordings.lists(), (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            recordings: page.recordings.filter(
              (r: RecordingV1) => r.id !== recordingId
            )
          }))
        };
      });

      return {previous};
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.recordings.lists(),
          context.previous
        );
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.recordings.lists()
      });
    }
  });
};
