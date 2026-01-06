import {useCallback, useMemo, useRef, useState} from "react";
import {useRecorderDatabaseContext} from "./RecorderDatabaseContext";
import {IRecordingNote} from "./RecorderDatabase";

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
      setLoadingNoteIds(ids => [...ids, id]);
      database
        .transaction("recordingNotes", "readonly")
        .objectStore("recordingNotes")
        .get(id)
        .then(newRecordingNode => {
          if (!newRecordingNode) {
            return;
          }
          setRecordingNotes(list => {
            if (list.some(l => l.id === id)) {
              return list.map(n => (n.id === id ? newRecordingNode : n));
            }
            return [...list, newRecordingNode];
          });
        })
        .finally(() => {
          setLoadingNoteIds(ids => ids.filter(id2 => id2 !== id));
        });
    },
    [database, setLoadingNoteIds, loadingNoteIds]
  );
  const createRecordingNote = useCallback(
    (recordingId: string, durationOffset: number) => {
      if (isCreatingNode) {
        return;
      }
      const noteId = crypto.getRandomValues(noteIdRef.current).join("-");
      setIsCreatingNode(true);
      database
        .transaction("recordingNotes", "readwrite")
        .objectStore("recordingNotes")
        .put({
          recordingId,
          id: noteId,
          title: "",
          contents: "",
          durationOffset,
          createdAt: new Date()
        })
        .then(recordingNoteKey => {
          if (recordingNoteKey !== null)
            getRecordingNote(`${recordingNoteKey}`);
        })
        .finally(() => {
          setIsCreatingNode(false);
        });
    },
    [database, setIsCreatingNode, isCreatingNode, getRecordingNote]
  );
  const getRecordingNotesByRecordingId = useCallback(
    async (recordingId: string): Promise<IRecordingNote[]> => {
      const notes: IRecordingNote[] = [];
      const cursor = await database
        .transaction("recordingNotes", "readonly")
        .objectStore("recordingNotes")
        .index("recordingId")
        .openCursor(IDBKeyRange.only(recordingId));

      return new Promise(resolve => {
        if (!cursor) {
          resolve([]);
          return;
        }

        cursor.onsuccess = () => {
          if (cursor.result) {
            notes.push(cursor.result.value);
            cursor.result.continue();
          } else {
            resolve(notes);
          }
        };

        cursor.onerror = () => {
          console.error("Failed to fetch notes:", cursor.error);
          resolve([]);
        };
      });
    },
    [database]
  );

  const getRecordingNoteById = useCallback(
    async (noteId: string): Promise<IRecordingNote | null> => {
      try {
        const note = await database
          .transaction("recordingNotes", "readonly")
          .objectStore("recordingNotes")
          .get(noteId);
        return note ?? null;
      } catch (error) {
        console.error("Failed to fetch note:", error);
        return null;
      }
    },
    [database]
  );

  const deleteRecordingNote = useCallback(
    async (noteId: string): Promise<void> => {
      try {
        await database
          .transaction("recordingNotes", "readwrite")
          .objectStore("recordingNotes")
          .delete(noteId);
      } catch (error) {
        console.error("Failed to delete note:", error);
        throw error;
      }
    },
    [database]
  );

  const updateRecordingNote = useCallback(
    async (note: IRecordingNote): Promise<void> => {
      try {
        await database
          .transaction("recordingNotes", "readwrite")
          .objectStore("recordingNotes")
          .put(note);
      } catch (error) {
        console.error("Failed to update note:", error);
        throw error;
      }
    },
    [database]
  );

  return useMemo(
    () => ({
      createRecordingNote,
      recordingNotes,
      getRecordingNotesByRecordingId,
      getRecordingNoteById,
      deleteRecordingNote,
      updateRecordingNote
    }),
    [
      recordingNotes,
      createRecordingNote,
      getRecordingNotesByRecordingId,
      getRecordingNoteById,
      deleteRecordingNote,
      updateRecordingNote
    ]
  );
}
