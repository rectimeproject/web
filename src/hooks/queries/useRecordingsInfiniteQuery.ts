import {useInfiniteQuery} from "@tanstack/react-query";
import {queryKeys} from "../../lib/queryKeys.js";
import {useRecorderDatabaseContext} from "../../RecorderDatabaseContext.js";
import {RecordingV1} from "../../RecorderDatabase.js";

export const useRecordingsInfiniteQuery = (limit = 10) => {
  const db = useRecorderDatabaseContext();

  return useInfiniteQuery({
    queryKey: queryKeys.recordings.lists(),
    queryFn: async ({
      pageParam
    }): Promise<{
      recordings: RecordingV1[];
      nextOffset: number | null;
    }> => {
      const recordings = await db.getAll({offset: pageParam, limit});
      return {
        recordings: recordings ?? [],
        nextOffset:
          recordings && recordings.length === limit ? pageParam + limit : null
      };
    },
    getNextPageParam: lastPage => lastPage.nextOffset,
    initialPageParam: 0
  });
};
