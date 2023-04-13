import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RecordingBlobPartV1, RecordingV1 } from './RecorderDatabase';
import {
  createDecoder,
  decodeFloat,
  destroyDecoder,
} from 'opus-codec-worker/actions/actions';
import useRecorderContext from './useRecorderContext';
import blobToArrayBuffer from './blobToArrayBuffer';
import {
  AnalyserNode,
  AudioBufferSourceNode,
  IAudioBuffer,
  IAudioContext,
} from 'standardized-audio-context';
import useInterval from './useInterval';
import { useRecorderDatabaseContext } from './RecorderDatabaseContext';
import { RingBuffer } from 'opus-codec/opus';

interface IScheduleItem {
  audioBuffer: IAudioBuffer;
  sourceNode: AudioBufferSourceNode<IAudioContext>;
  startTime: number;
}

export interface IImmutablePlayingState {
  recordingId: string;
  cursor: number | null;
}

interface IState {
  recordingId: string;
  ringBuffer: RingBuffer;
  decoderId: string | null;
  /**
   * if null, it means we're waiting for the first slice to be ready
   */
  playingState: {
    initialCurrentTime: number;
    lastTime: number;
    scheduleOffset: number;
  } | null;
  /**
   * this is filled while we're creating audio buffer sources and audio buffers. it is
   * used to track what is the current duration offset we're currently at
   */
  durationOffset: number;
  schedule: ReadonlyArray<IScheduleItem>;
  requestedStop: boolean;
  analyserNode: AnalyserNode<IAudioContext>;
}

export default function useRecordingPlayer() {
  const recorderContext = useRecorderContext();
  const stateRef = useRef<IState | null>(null);
  const [playing, setPlaying] = useState<IImmutablePlayingState | null>(null);
  const interval = useInterval(500);
  const db = useRecorderDatabaseContext();
  const clearDecoderIdState = useCallback(() => {
    const state = stateRef.current;
    if (!state || state.decoderId === null) return;
    recorderContext.opus.client
      .sendMessage(destroyDecoder(state.decoderId))
      .then((result) => {
        if ('failures' in result) {
          console.error('failed to destroy decoder with error: %o', result);
        }
      })
      .finally(() => {
        state.decoderId = null;
      });
  }, [stateRef, recorderContext]);
  const onFinishedPlayingLastSourceNode = useCallback(() => {
    stateRef.current = null;
    setPlaying(null);
  }, [setPlaying, stateRef]);
  const pause = useCallback(() => {
    if (!stateRef.current) {
      return;
    }
    stateRef.current.requestedStop = true;
    for (const lastNode of stateRef.current.schedule) {
      lastNode.sourceNode.stop();
    }
  }, []);
  const createDecoderAndResumeAudioContext = useCallback(
    (recording: RecordingV1) => {
      const client = recorderContext.opus.client;
      const ctx = recorderContext.audioContext;

      return Promise.all([
        client.sendMessage(
          createDecoder(
            recording.sampleRate,
            recording.channels,
            recording.frameSize
          )
        ),
        ctx.resume(),
      ]);
    },
    [recorderContext.opus.client, recorderContext.audioContext]
  );
  const play = useCallback(
    (recording: RecordingV1) => {
      if (stateRef.current || recording.channels !== 1) {
        console.error('failed to play: %o', recording);
        return;
      }
      const client = recorderContext.opus.client;
      const ctx = recorderContext.audioContext;
      const schedule = new Array<IScheduleItem>();

      setPlaying({
        recordingId: recording.id,
        cursor: null,
      });

      createDecoderAndResumeAudioContext(recording).then(
        async ([decoderId]) => {
          if ('failures' in decoderId) {
            console.error('failed to create decoder: %o', decoderId);
            return;
          }

          const state: IState = {
            /**
             * defer a full second of a recording before actually playing
             */
            ringBuffer: new RingBuffer(recording.sampleRate),
            recordingId: recording.id,
            schedule,
            durationOffset: 0,
            playingState: null,
            decoderId: decoderId.value,
            requestedStop: false,
            analyserNode: ctx.createAnalyser(),
          };
          stateRef.current = state;

          /**
           * connect analyser node to audio context
           */
          state.analyserNode.connect(recorderContext.audioContext.destination);

          const maybePlaySchedule = () => {
            const current = stateRef.current;
            if (current === null) {
              console.error('maybePlaySchedule failed, because state is null');
              return false;
            }

            let playingState: IState['playingState'];

            if (current.playingState === null) {
              if (
                current.durationOffset <
                Math.min(recording.duration / 1000, 10.0)
              ) {
                return true;
              }
              console.log(
                'starting to play with duration offset at: %d',
                current.durationOffset
              );
              playingState = {
                lastTime: ctx.currentTime,
                scheduleOffset: 0,
                initialCurrentTime: ctx.currentTime,
              };
              current.playingState = playingState;
            } else {
              playingState = current.playingState;
            }

            for (
              let i = playingState.scheduleOffset;
              i < schedule.length;
              i++
            ) {
              const item = schedule[i];
              if (typeof item === 'undefined') return false;
              const { sourceNode, audioBuffer } = item;
              sourceNode.connect(current.analyserNode);
              sourceNode.start(playingState.lastTime);
              playingState.lastTime += audioBuffer.duration;
              playingState.scheduleOffset++;
            }

            return true;
          };

          const scheduleSamples = (samples: Float32Array) => {
            if (stateRef.current === null) {
              return false;
            }
            /**
             * create buffer
             */
            const buffer = ctx.createBuffer(
              recording.channels,
              samples.length,
              recording.sampleRate
            );
            buffer.getChannelData(0).set(samples);
            /**
             * create source node
             */
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            /**
             * schedule node for playing
             */
            schedule.push({
              audioBuffer: buffer,
              sourceNode: source,
              startTime: stateRef.current.durationOffset,
            });
            stateRef.current.durationOffset += buffer.duration;
            if (!maybePlaySchedule()) {
              pause();
              return false;
            }
            return true;
          };

          const decodeAndScheduleBlobPart = async (blob: Blob) => {
            const current = stateRef.current;
            const arrayBuffer = await blobToArrayBuffer(blob);
            const decoded = await client.sendMessage(
              decodeFloat({
                decoderId: decoderId.value,
                encoded: arrayBuffer,
              })
            );
            if ('failures' in decoded) {
              console.error(
                'aborting: failed to decode blob part: %o',
                decoded
              );
              return false;
            }
            /**
             * in case audio playing is requested to stopped in the middle of playing
             */
            if (current === null || current.requestedStop) {
              return false;
            }
            current.ringBuffer.write(new Float32Array(decoded.value.decoded));
            const samples = current.ringBuffer.read();
            if (samples === null) {
              return true;
            }
            return scheduleSamples(samples);
          };

          const cursor = await db
            .transaction('recordingBlobParts', 'readonly', {})
            .objectStore('recordingBlobParts')
            .index('createdAt')
            .openCursor();

          if (cursor === null) {
            console.error('failed to get cursor to get blob parts');
            return;
          }

          let pending = Promise.resolve(true);
          const decodingAndScheduling = new Promise<void>((resolve) => {
            const resolveOnEnd = () =>
              pending.finally(() => {
                resolve();
              });
            const continueOrResolveOnFailure = () => {
              try {
                cursor.result?.continue();
              } catch (reason) {
                console.error(
                  "failed to call cursor's `continue` method. finishing decoding: %o",
                  reason
                );
                resolveOnEnd();
                return false;
              }
              return true;
            };
            cursor.onsuccess = () => {
              if (!cursor.result) {
                resolveOnEnd();
                return;
              }
              const recordingBlobPart: RecordingBlobPartV1 =
                cursor.result.value;
              if (recordingBlobPart.recordingId !== recording.id) {
                continueOrResolveOnFailure();
                return;
              }
              const blob = recordingBlobPart.blob.slice(0);
              if (!continueOrResolveOnFailure()) {
                return;
              }
              pending = Promise.resolve(pending)
                .then(async (previousResult) => {
                  if (
                    !previousResult ||
                    !(await decodeAndScheduleBlobPart(blob))
                  ) {
                    return false;
                  }
                  return true;
                })
                .catch((reason) => {
                  console.error(
                    'failed to add process decoded blob part with error: %o',
                    reason
                  );
                  return false;
                });
            };
          });

          /**
           * start decoding blob parts and to play accordingly
           */
          await decodingAndScheduling;

          let drainedSamples: Float32Array | null;
          do {
            drainedSamples = stateRef.current.ringBuffer.drain();
            if (drainedSamples !== null) {
              if (!scheduleSamples(drainedSamples)) {
                console.error(
                  'failed to schedule drained samples: %o',
                  drainedSamples
                );
                break;
              }
            }
          } while (drainedSamples !== null);

          if (stateRef.current.requestedStop) {
            for (const { sourceNode } of schedule.splice(0, schedule.length)) {
              sourceNode.disconnect(ctx.destination);
              sourceNode.stop();
            }
          } else {
            for (const { sourceNode } of schedule.slice(schedule.length - 1)) {
              sourceNode.addEventListener(
                'ended',
                onFinishedPlayingLastSourceNode
              );
            }
          }

          clearDecoderIdState();
        }
      );
    },
    [
      db,
      recorderContext,
      onFinishedPlayingLastSourceNode,
      stateRef,
      setPlaying,
      createDecoderAndResumeAudioContext,
      clearDecoderIdState,
      pause,
    ]
  );
  useEffect(() => pause, [pause]);
  useEffect(() => {
    interval.setCallback(() => {
      setPlaying((playing) => {
        const schedule = stateRef.current?.schedule;
        const initialCurrentTime =
          stateRef.current?.playingState?.initialCurrentTime;
        if (
          typeof initialCurrentTime !== 'number' ||
          typeof schedule === 'undefined'
        ) {
          return playing;
        }
        const ctx = recorderContext.audioContext;
        let lastScheduleItem: IScheduleItem | null = null;
        for (const scheduleItem of schedule) {
          if (ctx.currentTime > initialCurrentTime + scheduleItem.startTime) {
            lastScheduleItem = scheduleItem;
          }
        }
        if (lastScheduleItem && playing) {
          return {
            ...playing,
            cursor: lastScheduleItem.startTime,
          };
        }
        return playing;
      });
    });
    interval.start();
  }, [stateRef, interval, setPlaying, recorderContext]);
  return useMemo(
    () => ({
      play,
      analyserNode: () => stateRef.current?.analyserNode ?? null,
      playing,
      pause,
    }),
    [play, pause, playing]
  );
}
