import { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import useRecorderDatabase from './useRecorderDatabase';
import { DateTime } from 'luxon';
import Icon from './Icon';
import secondsToHumanReadable from './secondsToHumanReadable';
import { useNavigate } from 'react-router';
import ActivityIndicator from './ActivityIndicator';
import { Link } from 'react-router-dom';

export default function RecordingListScreen() {
  const db = useRecorderDatabase();
  const navigate = useNavigate();
  const openSpecificRecordingPage = useCallback(
    (recordingId: string) => {
      navigate(`/recording/${recordingId}`);
    },
    [navigate]
  );
  const [newRecordingNames, setNewRecordingNames] = useState(
    new Map<string, string>()
  );
  const recordings = useMemo(
    () =>
      db.recordings.map((r) => ({
        ...r,
        originalValue: r,
        onChangeNewRecordingName: (e: ChangeEvent<HTMLInputElement>) => {
          const newName = e.target.value;
          setNewRecordingNames(
            (newRecordingNames) =>
              new Map([...newRecordingNames, [r.id, newName]])
          );
        },
        onClickPlay: () => openSpecificRecordingPage(r.id),
      })),
    [openSpecificRecordingPage, setNewRecordingNames, db.recordings]
  );
  useEffect(() => {
    for (const [id, name] of newRecordingNames) {
      if (db.updatingRecordingIds.includes(id)) {
        continue;
      }
      const recording = recordings.find((r) => r.id === id);
      if (!recording) {
        console.error('failed to update recording: %o', recording);
        continue;
      }
      if (recording.name === name) {
        continue;
      }
      db.updateRecording({
        ...recording.originalValue,
        name,
      });
    }
  }, [db, recordings, newRecordingNames]);
  useEffect(() => {
    if (!db.hasLoadedInitialRecordings) db.getRecordings();
  }, [db]);
  const onScroll = useCallback(() => {
    if (!document.scrollingElement) {
      return;
    }
    const pct =
      window.scrollY /
      (document.scrollingElement.scrollHeight -
        document.scrollingElement.clientHeight);
    if (pct < 0.9) {
      return;
    }
    db.getMoreRecordings();
  }, [db]);
  useEffect(() => {
    window.addEventListener('scroll', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [onScroll]);
  return (
    <div className="container recording-list-screen">
      <div className="row">
        <div className="col-lg-12">
          {!recordings.length ? (
            <>
              <div className="text-center">
                No recordings yet. <Link to="/">Record</Link> something!
              </div>
            </>
          ) : (
            <>
              {recordings.map((r) => (
                <div className="d-flex recording" key={r.id}>
                  <div className="flex-fill overflow-hidden">
                    <div>
                      {`${DateTime.fromJSDate(r.createdAt).toLocaleString(
                        DateTime.DATETIME_SHORT
                      )} | ${secondsToHumanReadable(r.duration / 1000)}`}
                    </div>
                    <div>
                      <h4>
                        <input
                          value={newRecordingNames.get(r.id) ?? r.name}
                          onChange={r.onChangeNewRecordingName}
                          style={{
                            border: 'none',
                          }}
                        />
                      </h4>
                    </div>
                  </div>
                  <div>
                    {db.updatingRecordingIds.includes(r.id) ? (
                      <ActivityIndicator />
                    ) : (
                      <div className="play-arrow" onClick={r.onClickPlay}>
                        <Icon name="headphones" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {db.isFinished ? (
                <>
                  <div className="text-center my-4">No more results.</div>
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
