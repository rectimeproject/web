import {InfiniteData, useInfiniteQuery} from "@tanstack/react-query";
import {queryKeys} from "../../lib/queryKeys.js";
import {useRecorderDatabaseContext} from "../../RecorderDatabaseContext.js";
import {RecordingV1} from "../../RecorderDatabase.js";

export interface IUseRecordingsInfiniteQueryPage {
  recordings: RecordingV1[];
  nextOffset: number | null;
}

export const useRecordingsInfiniteQuery = (limit: number) => {
  const db = useRecorderDatabaseContext();

  return useInfiniteQuery<
    IUseRecordingsInfiniteQueryPage,
    unknown,
    InfiniteData<IUseRecordingsInfiniteQueryPage, unknown>,
    ReturnType<typeof queryKeys.recordings.lists>,
    number
  >({
    queryKey: queryKeys.recordings.lists(limit),
    select: data => data,
    queryFn: async ({pageParam}) => {
      const recordings = await db.getAll({offset: pageParam, limit});
      return {
        recordings: recordings !== null ? recordings : [],
        nextOffset:
          recordings !== null && recordings.length === limit
            ? pageParam + limit
            : null
      };
    },
    getNextPageParam: lastPage => lastPage.nextOffset,
    initialPageParam: 0
  });
};
