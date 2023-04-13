import { useCallback, useMemo, useState } from 'react';
import { useRecorderDatabaseContext } from './RecorderDatabaseContext';
import { IPaginationFilter, RecordingV1 } from './RecorderDatabase';
import useThrottle from './useThrottle';

export default function useRecorderDatabase() {
  const database = useRecorderDatabaseContext();
  const [isGettingRecordings, setIsGettingRecordings] =
    useState<boolean>(false);
  const debounce = useThrottle(100);
  const [recordings, setRecordings] = useState<RecordingV1[]>([]);
  const [isFinished, setIsFinished] = useState(false);
  /**
   * get initial recordings
   */
  const getRecordings = useCallback(
    () =>
      debounce.run(() => {
        if (isGettingRecordings) {
          return;
        }
        setIsGettingRecordings(true);
        database
          .getAll({
            offset: 0,
            limit: 10,
          })
          .then((newRecordings) => {
            console.log('initial recordings: %o', newRecordings);
            setRecordings(newRecordings ? newRecordings : []);
          })
          .finally(() => {
            setIsGettingRecordings(false);
          });
      }),
    [
      debounce,
      setRecordings,
      isGettingRecordings,
      setIsGettingRecordings,
      database,
    ]
  );
  const [, setPaginationFilter] = useState<IPaginationFilter>({
    offset: 0,
    limit: 10,
  });
  const getMoreRecordings = useCallback(() => {
    const fn = async () => {
      if (isGettingRecordings || isFinished) {
        return false;
      }
      setIsGettingRecordings(true);
      const newRecordings = await database.getAll({
        offset: recordings.length,
        limit: recordings.length + 10,
      });
      if (newRecordings === null) {
        setIsFinished(false);
        return true;
      }
      setRecordings((oldRecordings) => [...oldRecordings, ...newRecordings]);
      const offset = newRecordings.length + recordings.length;
      setPaginationFilter({
        offset,
        limit: offset + 10,
      });
      setIsFinished(newRecordings.length === 0);
      return true;
    };
    debounce.run(() => {
      fn().then((result) => {
        if (result) setIsGettingRecordings(false);
      });
    });
  }, [
    debounce,
    isFinished,
    recordings.length,
    database,
    setIsGettingRecordings,
    isGettingRecordings,
    setRecordings,
    setPaginationFilter,
  ]);
  const [loadingRecordIds, setLoadingRecordIds] = useState<string[]>([]);
  const [updatingRecordingIds, setUpdatingRecordingIds] = useState<string[]>(
    []
  );
  const getRecording = useCallback(
    (id: string) => {
      debounce.run(async () => {
        setLoadingRecordIds((ids) => (ids.includes(id) ? ids : [...ids, id]));

        try {
          const newRecording = await database.get(id);
          if (!newRecording) {
            return;
          }
          updateRecordingState(newRecording);
        } finally {
          setLoadingRecordIds((ids) => ids.filter((id2) => id2 !== id));
        }
      });
    },
    [setRecordings, database, debounce]
  );
  const updateRecordingState = useCallback(
    (newRecording: RecordingV1) => {
      setRecordings((recordings) =>
        recordings.some((r) => r.id === newRecording.id)
          ? recordings.map((r2) =>
              r2.id === newRecording.id ? newRecording : r2
            )
          : [newRecording, ...recordings]
      );
    },
    [setRecordings]
  );
  const updateRecording = useCallback(
    (recording: RecordingV1) => {
      if (updatingRecordingIds.includes(recording.id)) {
        return;
      }
      setUpdatingRecordingIds((ids) => [...ids, recording.id]);
      database
        .transaction('recordings', 'readwrite')
        .objectStore('recordings')
        .put(recording)
        .then(async () => {
          const newRecording = await database
            .transaction('recordings', 'readonly')
            .objectStore('recordings')
            .get(recording.id);
          if (newRecording !== null) {
            updateRecordingState(newRecording);
          }
        })
        .finally(() => {
          setUpdatingRecordingIds((ids) =>
            ids.filter((id) => id !== recording.id)
          );
        });
    },
    [updatingRecordingIds, setUpdatingRecordingIds, database]
  );
  const getRecordingByEncoderId = useCallback(
    (encoderId: string) => {
      debounce.run(async () => {
        const recording = await database.getFromEncoderId(encoderId);
        if (recording) {
          getRecording(recording.id);
        }
      });
    },
    [debounce, getRecording, database]
  );
  return useMemo(
    () => ({
      getRecordingByEncoderId,
      loadingRecordIds,
      updateRecording,
      getRecording,
      recordings,
      isGettingRecordings,
      getRecordings,
      getMoreRecordings,
      updatingRecordingIds,
    }),
    [
      updatingRecordingIds,
      updateRecording,
      loadingRecordIds,
      getRecordingByEncoderId,
      getRecording,
      recordings,
      isGettingRecordings,
      getRecordings,
      getMoreRecordings,
    ]
  );
}
