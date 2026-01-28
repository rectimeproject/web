import {
  AudioContext,
  IAudioBufferSourceNode,
  IAudioContext
} from "standardized-audio-context";
import RecorderDatabase, {
  IRecordingPartV1,
  RecordingV1
} from "../../RecorderDatabase.js";
import Decoder from "../opus/Decoder.js";
import {EventEmitter} from "eventual-js";
import type Client from "opus-codec-worker/actions/Client.js";

interface IAudioPlayerContext {
  id: number;
  recording: RecordingV1;
  decoder: Decoder;
  playedDuration: number;
  scheduledDuration: number;
  readonly durationOffset: number;
  abortController: AbortController;
  startTime: number;
  currentTime: number | null;
  aborted: Promise<void>;
  onFinishPart: () => Promise<void>;
}

export enum PlayerState {
  Preparing = "preparing",
  Playing = "playing",
  Paused = "paused"
}

export class RecordingPlayer extends EventEmitter<{
  state: PlayerState;
  duration: {recordingId: string; duration: number};
  samples: Float32Array;
}> {
  public readonly recordingId;
  public readonly analyserNode;
  readonly #audioContext;
  readonly #opusClient;
  readonly #recorderDatabase;
  #audioPlayerContext: IAudioPlayerContext | null = null;
  #playbackId = 0;
  #state: "preparing" | "playing" | "paused" = "paused";
  public constructor({
    opusClient,
    audioContext,
    db,
    recordingId
  }: {
    audioContext: AudioContext;
    recordingId: string;
    opusClient: Client;
    db: RecorderDatabase;
  }) {
    super();
    this.#recorderDatabase = db;
    this.#opusClient = opusClient;
    this.recordingId = recordingId;
    this.#audioContext = audioContext;
    this.analyserNode = this.#audioContext.createAnalyser();
    this.analyserNode.fftSize = 2 ** 10;
    this.#audioPlayerContext = null;
  }
  #pending = Promise.resolve();
  #playDebounceTimerId: number | null = null;
  public play(from: number) {
    if (this.#playDebounceTimerId !== null) {
      clearTimeout(this.#playDebounceTimerId);
      this.#playDebounceTimerId = null;
    }
    this.#playDebounceTimerId = window.setTimeout(() => {
      this.#pending = this.#pending
        .then(async () => {
          try {
            await this.#play(from);
          } finally {
            this.#setState(PlayerState.Paused);
          }
        })
        .catch(err => {
          console.error("Error in playback:", err);
        });
    }, 100);
  }
  public destroy() {
    this.#destroyAudioPlayerContext(new RecordingPlayerChangedError());
  }
  public setCurrentTime(currentTime: number) {
    this.destroy();
    this.play(currentTime);
  }
  #setState(state: PlayerState) {
    if (this.#state !== state) {
      this.#state = state;
      this.emit("state", state);
    }
  }
  async #play(startDuration: number) {
    if (this.#audioPlayerContext !== null) {
      throw new Error("Playback already in progress");
    }

    if (this.#state !== PlayerState.Paused) {
      return;
    }

    this.#setState(PlayerState.Preparing);

    await using decoder = new Decoder(this.#opusClient);

    const recording = await this.#recorderDatabase.get(this.recordingId);

    if (recording === null) {
      throw new Error("Recording not found");
    }

    await decoder.create({
      sampleRate: recording.sampleRate,
      channels: recording.channels,
      frameSize: recording.frameSize
    });

    const abortController = new AbortController();
    const {signal} = abortController;

    /**
     * Advance count in seconds
     */
    const advanceCount = 4.0;

    const playbackId = this.#playbackId++;

    const maximumScheduledPlayedRatio = 0.5;

    const audioPlayerContext: IAudioPlayerContext = {
      id: playbackId,
      recording,
      abortController,
      decoder,
      playedDuration: startDuration,
      scheduledDuration: startDuration,
      durationOffset: startDuration,
      startTime: this.#audioContext.currentTime,
      currentTime: null,
      aborted: new Promise<void>(resolve => {
        signal.addEventListener(
          "abort",
          () => {
            resolve();
          },
          {once: true, passive: true}
        );
      }),
      onFinishPart: async () => {
        const scheduledPlayedRatio =
          audioPlayerContext.playedDuration /
          audioPlayerContext.scheduledDuration;
        this.#updateDuration(audioPlayerContext);
        if (scheduledPlayedRatio < maximumScheduledPlayedRatio) {
          return;
        }
        const from = audioPlayerContext.scheduledDuration;
        const to = Math.min(
          from + advanceCount,
          audioPlayerContext.recording.duration
        );
        if (from === to) {
          return;
        }
        await this.#playInterval(from, to, audioPlayerContext);
      }
    };

    this.#audioPlayerContext = audioPlayerContext;

    // Resume audio context if suspended
    await this.#audioContext.resume();

    try {
      this.analyserNode.connect(this.#audioContext.destination);
      await this.#playInterval(
        startDuration,
        startDuration + advanceCount,
        audioPlayerContext
      );
    } finally {
      this.#audioPlayerContext = null;
      this.analyserNode.disconnect(this.#audioContext.destination);
    }
  }
  #updateDuration(audioPlayerContext: IAudioPlayerContext) {
    this.emit("duration", {
      recordingId: this.recordingId,
      duration: audioPlayerContext.playedDuration
    });
  }
  async #playInterval(
    from: number,
    to: number,
    audioPlayerContext: IAudioPlayerContext
  ) {
    const cursor = await this.#recorderDatabase
      .transaction("recordingParts", "readonly")
      .objectStore("recordingParts")
      .index("recordingId")
      .openCursorIter(IDBKeyRange.only(this.recordingId));

    if (cursor === null) {
      throw new Error("No recording parts found");
    }

    if (from === to) {
      return;
    }

    const plannedParts = new Array<{
      part: IRecordingPartV1;
      /**
       * Position of the part in seconds relative to the start of the recording
       */
      delta: number;
    }>();
    let processedDuration = 0;

    const {signal} = audioPlayerContext.abortController;

    for await (const part of cursor) {
      signal.throwIfAborted();

      if (processedDuration >= to) {
        break;
      }
      const partDuration =
        part.sampleCount /
        audioPlayerContext.recording.channels /
        audioPlayerContext.recording.sampleRate;
      if (processedDuration >= from) {
        plannedParts.push({
          part,
          delta: processedDuration
        });
      }
      processedDuration += partDuration;
    }

    const connectedParts = new Array<{
      audioBufferSourceNode: IAudioBufferSourceNode<IAudioContext>;
      delta: number;
      duration: number;
    }>();

    for (const {part, delta} of plannedParts) {
      signal.throwIfAborted();

      connectedParts.push({
        duration:
          part.sampleCount /
          audioPlayerContext.recording.channels /
          audioPlayerContext.recording.sampleRate,
        audioBufferSourceNode: await this.#prepareAudioBufferSourceNode(
          part,
          audioPlayerContext
        ),
        delta
      });
    }

    this.#setState(PlayerState.Playing);

    let pending = Promise.resolve();

    for (const part of connectedParts) {
      signal.throwIfAborted();

      const {audioBufferSourceNode, duration} = part;

      const onPartEnded = Promise.race([
        new Promise<void>(resolve => {
          audioBufferSourceNode.addEventListener(
            "ended",
            () => {
              resolve();
            },
            {passive: true, once: true, signal}
          );
        }),
        audioPlayerContext.aborted.then(() => {
          audioBufferSourceNode.stop(this.#audioContext.currentTime);
          return Promise.reject(new RecordingPlayerAbortError());
        })
      ]);

      audioBufferSourceNode.start(
        audioPlayerContext.startTime +
          part.delta -
          audioPlayerContext.durationOffset
      );
      audioPlayerContext.scheduledDuration += duration;

      pending = Promise.all([
        pending,
        onPartEnded.then(async () => {
          this.#updateDuration(audioPlayerContext);
          audioPlayerContext.playedDuration += duration;
        })
      ]).then(async () => {
        await audioPlayerContext.onFinishPart();
      });
    }

    await pending;
  }
  async #createSlice(
    part: IRecordingPartV1,
    {recording, decoder}: IAudioPlayerContext
  ) {
    const arrayBuffer = await decoder.decodeFloat(
      await part.encoded.arrayBuffer()
    );
    const samples = new Float32Array(arrayBuffer);

    const audioBuffer = this.#audioContext.createBuffer(
      recording.channels,
      samples.length / recording.channels,
      recording.sampleRate
    );

    audioBuffer.copyToChannel(samples, 0, 0);

    const audioBufferSourceNode = this.#audioContext.createBufferSource();
    audioBufferSourceNode.buffer = audioBuffer;

    return audioBufferSourceNode;
  }
  async #prepareAudioBufferSourceNode(
    part: IRecordingPartV1,
    audioPlayerContext: IAudioPlayerContext
  ) {
    const audioBufferSourceNode = await this.#createSlice(
      part,
      audioPlayerContext
    );
    audioBufferSourceNode.connect(this.analyserNode);
    return audioBufferSourceNode;
  }
  #destroyAudioPlayerContext(reason: RecordingPlayerAbortError) {
    if (this.#audioPlayerContext === null) {
      return;
    }
    this.#audioPlayerContext.abortController.abort(reason);
  }
}

export class RecordingPlayerAbortError {}

export class RecordingPlayerChangedError extends RecordingPlayerAbortError {}
