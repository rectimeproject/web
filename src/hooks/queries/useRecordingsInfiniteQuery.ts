import {useInfiniteQuery} from "@tanstack/react-query";
import {queryKeys} from "../../lib/queryKeys";
import {useRecorderDatabaseContext} from "../../RecorderDatabaseContext";

export const useRecordingsInfiniteQuery = (limit = 10) => {
  const db = useRecorderDatabaseContext();

  return useInfiniteQuery({
    queryKey: queryKeys.recordings.lists(),
    queryFn: async ({pageParam}) => {
      const recordings = await db.getAll({offset: pageParam, limit});
      return {
        recordings: recordings ?? [],
        nextOffset:
          recordings && recordings.length === limit
            ? pageParam + limit
            : undefined
      };
    },
    getNextPageParam: lastPage => lastPage.nextOffset,
    initialPageParam: 0
  });
};
