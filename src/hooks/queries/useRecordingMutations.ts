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
    onSettled: async data => {
      // Refetch to ensure consistency
      if (data) {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: queryKeys.recordings.detail(data.id)
          }),
          queryClient.invalidateQueries({
            queryKey: queryKeys.recordings.lists()
          })
        ]);
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
    onSettled: async () => {
      // Refetch to ensure consistency
      await queryClient.invalidateQueries({
        queryKey: queryKeys.recordings.lists()
      });
    }
  });
};
