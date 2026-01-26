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

export class RecordingPlayer extends EventEmitter<{
  state: "playing" | "paused" | "preparing";
  duration: {recordingId: string; duration: number};
}> {
  public readonly recordingId;
  readonly #audioContext;
  readonly #analyserNode;
  readonly #opusClient;
  readonly #recorderDatabase;
  #audioPlayerContext: IAudioPlayerContext | null = null;
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
    this.#analyserNode = this.#audioContext.createAnalyser();
    // this.#analyserNode.fftSize = 2048;
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
            this.#setState("paused");
          }
        })
        .catch(err => {
          console.error("Error in playback:", err);
        });
    }, 100);
  }
  public destroy() {
    this.#destroyAudioPlayerContext();
    this.emit("state", "paused");
  }
  public setCurrentTime(currentTime: number) {
    this.destroy();
    this.play(currentTime);
  }
  #setState(state: "preparing" | "playing" | "paused") {
    if (this.#state !== state) {
      this.#state = state;
      this.emit("state", state);
    }
  }
  async #play(startDuration: number) {
    if (this.#state !== "paused") {
      return;
    }

    this.#setState("preparing");

    // Resume audio context if suspended
    await this.#audioContext.resume();

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

    const advanceCount = 10;

    const audioPlayerContext: IAudioPlayerContext = {
      recording,
      abortController,
      decoder,
      playedDuration: startDuration,
      scheduledDuration: startDuration,
      durationOffset: startDuration,
      startTime: this.#audioContext.currentTime + 2,
      currentTime: null,
      aborted: new Promise<void>(resolve => {
        signal.addEventListener(
          "abort",
          () => {
            resolve();
          },
          {once: true}
        );
      }),
      onFinishPart: async () => {
        const scheduledPlayedRatio =
          audioPlayerContext.playedDuration /
          audioPlayerContext.scheduledDuration;
        this.#updateDuration(audioPlayerContext);
        if (scheduledPlayedRatio < 0.8) {
          return;
        }
        const from = audioPlayerContext.scheduledDuration;
        console.log("Starting new interval from %o seconds", from);
        await this.#playInterval(from, from + advanceCount, audioPlayerContext);
      }
    };

    signal.addEventListener("abort", err => {
      console.log("Playback aborted: %o", err);
    });

    this.#audioPlayerContext = audioPlayerContext;

    try {
      this.#analyserNode.connect(this.#audioContext.destination);
      await this.#playInterval(
        startDuration,
        startDuration + advanceCount,
        audioPlayerContext
      );
    } catch (err) {
      console.error("Error during playback:", err);
    } finally {
      this.#audioPlayerContext = null;
      this.#analyserNode.disconnect(this.#audioContext.destination);
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

    console.log("Starting to process recording parts from %o to %o", from, to);

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

    this.emit("state", "playing");

    let pending = Promise.resolve();

    for (const part of connectedParts) {
      signal.throwIfAborted();

      const {audioBufferSourceNode, duration} = part;

      let onPartEnded = Promise.race([
        new Promise<void>((resolve, reject) => {
          audioBufferSourceNode.addEventListener(
            "ended",
            () => {
              if (signal.aborted) {
                reject(signal.reason);
                return;
              }
              resolve();
            },
            {passive: true, once: true}
          );
        }),
        audioPlayerContext.aborted
      ]);

      audioBufferSourceNode.start(
        audioPlayerContext.startTime +
          part.delta -
          audioPlayerContext.durationOffset
      );
      audioPlayerContext.scheduledDuration += duration;

      onPartEnded = onPartEnded.then(async () => {
        this.#updateDuration(audioPlayerContext);
        audioPlayerContext.playedDuration += duration;
      });

      pending = pending
        .then(async () => {
          await onPartEnded;
          await audioPlayerContext.onFinishPart();
        })
        .catch(err => {
          audioBufferSourceNode.stop(this.#audioContext.currentTime);
          return Promise.reject(err);
        });
    }

    console.log("Processed %o seconds of audio", processedDuration);

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
    audioBufferSourceNode.connect(this.#analyserNode);
    return audioBufferSourceNode;
  }
  #destroyAudioPlayerContext() {
    if (this.#audioPlayerContext === null) {
      return;
    }
    this.#audioPlayerContext.abortController.abort();
    this.#audioPlayerContext = null;
  }
}
