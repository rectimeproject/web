import {useCallback, useMemo} from "react";
import {useRecorderDatabaseContext} from "./RecorderDatabaseContext.js";
import {RecordingV1} from "./RecorderDatabase.js";
import {
  InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";
import {queryKeys} from "./lib/queryKeys.js";

export interface IGetRecordingsPageParam {
  offset: number;
  limit: number;
}

export function useUpdateRecordingMutation({
  recordingId = null
}: Partial<{
  recordingId: string | null;
}> = {}) {
  const database = useRecorderDatabaseContext();

  const queryClient = useQueryClient();
  const updateRecording = useMutation({
    mutationKey: queryKeys.recordings.update(recordingId),
    mutationFn: async ({
      recordingId,
      recording: recordingChanges = {}
    }: {
      recording: Partial<RecordingV1>;
      recordingId: string | null;
    }) => {
      if (recordingId === null) {
        throw new Error("recordingId is null");
      }
      const recording = await database.get(recordingId);
      if (!recording) {
        throw new Error("Recording not found");
      }

      await database
        .transaction("recordings", "readwrite")
        .objectStore("recordings")
        .put({...recording, ...recordingChanges, id: recordingId});
    },
    onSuccess: async (_, {recordingId}) => {
      if (recordingId === null) {
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: queryKeys.recordings.detail(recordingId)
      });
    }
  });

  return updateRecording;
}

export default function useRecorderDatabase() {
  const database = useRecorderDatabaseContext();
  /**
   * get initial recordings
   */
  const getRecordings = useInfiniteQuery<
    RecordingV1[],
    unknown,
    InfiniteData<RecordingV1[]>,
    string[],
    IGetRecordingsPageParam
  >({
    queryKey: ["recordings", "list"],
    initialPageParam: {
      offset: 0,
      limit: 10
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage === null || lastPage.length === 0) {
        return undefined;
      }
      return {
        offset: allPages.flat().length,
        limit: 10
      };
    },
    queryFn: async ({pageParam}) => {
      const newRecordings = await database.getAll({
        offset: pageParam.offset,
        limit: pageParam.limit
      });
      return newRecordings ?? [];
    }
  });
  const updateRecordingMutation = useUpdateRecordingMutation();
  const updateRecordingState = useCallback(
    (newRecording: RecordingV1) => {
      updateRecordingMutation.mutate({
        recordingId: newRecording.id,
        recording: newRecording
      });
    },
    [updateRecordingMutation]
  );
  return useMemo(
    () => ({
      hasLoadedInitialRecordings: getRecordings.isSuccess,
      updateRecording: updateRecordingState,
      recordings: getRecordings.data?.pages.flat() ?? [],
      isGettingRecordings: getRecordings.isFetching,
      isFinished: getRecordings.hasNextPage === false,
      getRecordings,
      getMoreRecordings: getRecordings.fetchNextPage
    }),
    [updateRecordingState, getRecordings]
  );
}
