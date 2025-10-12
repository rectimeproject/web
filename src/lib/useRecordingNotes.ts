import { useCallback, useMemo, useRef, useState } from 'react';
import { useRecorderDatabaseContext } from './RecorderDatabaseContext';
import { IRecordingNote } from './RecorderDatabase';

export default function useRecordingNotes() {
  const noteIdRef = useRef(new Uint32Array(4));
  const database = useRecorderDatabaseContext();
  const [recordingNotes, setRecordingNotes] = useState<IRecordingNote[]>([]);
  const [loadingNoteIds, setLoadingNoteIds] = useState<string[]>([]);
  const [isCreatingNode, setIsCreatingNode] = useState<boolean>(false);
  const getRecordingNote = useCallback(
    (id: string) => {
      if (loadingNoteIds.includes(id)) {
        return;
      }
      setLoadingNoteIds((ids) => [...ids, id]);
      database
        .transaction('recordingNotes', 'readonly')
        .objectStore('recordingNotes')
        .get(id)
        .then((newRecordingNode) => {
          if (!newRecordingNode) {
            return;
          }
          setRecordingNotes((list) => {
            if (list.some((l) => l.id === id)) {
              return list.map((n) => (n.id === id ? newRecordingNode : n));
            }
            return [...list, newRecordingNode];
          });
        })
        .finally(() => {
          setLoadingNoteIds((ids) => ids.filter((id2) => id2 !== id));
        });
    },
    [database, setLoadingNoteIds, loadingNoteIds]
  );
  const createRecordingNote = useCallback(
    (recordingId: string, durationOffset: number) => {
      if (isCreatingNode) {
        return;
      }
      const noteId = crypto.getRandomValues(noteIdRef.current).join('-');
      setIsCreatingNode(true);
      database
        .transaction('recordingNotes', 'readwrite')
        .objectStore('recordingNotes')
        .put({
          recordingId,
          id: noteId,
          title: '',
          contents: '',
          durationOffset,
          createdAt: new Date(),
        })
        .then((recordingNoteKey) => {
          if (recordingNoteKey !== null)
            getRecordingNote(`${recordingNoteKey}`);
        })
        .finally(() => {
          setIsCreatingNode(false);
        });
    },
    [database, setIsCreatingNode, isCreatingNode, getRecordingNote]
  );
  return useMemo(
    () => ({
      createRecordingNote,
      recordingNotes,
    }),
    [recordingNotes, createRecordingNote]
  );
}
