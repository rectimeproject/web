import Client from "opus-codec-worker/actions/Client";
import {AudioContext} from "standardized-audio-context";
import RecorderDatabase, {
  IRecordingPartV1,
  RecordingV1
} from "../../RecorderDatabase";
import Decoder from "../opus/Decoder";

interface IAudioPlayerContext {
  recording: RecordingV1;
  decoder: Decoder;
  playedDuration: number;
  scheduledDuration: number;
  startTime: number;
  currentTime: number | null;
  lastTime: number | null;
  pending: PromiseWithResolvers<void>;
  scheduling: Promise<void>;
  onEnded?: (scheduledRatio: number) => Promise<void>;
}

export class RecordingPlayer {
  readonly #audioContext;
  readonly #analyserNode;
  readonly #opusClient;
  readonly #recorderDatabase;
  readonly #recordingId;
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
    this.#recorderDatabase = db;
    this.#opusClient = opusClient;
    this.#recordingId = recordingId;
    this.#audioContext = audioContext;
    this.#analyserNode = this.#audioContext.createAnalyser();
  }
  public async play() {
    await this.#audioContext.resume();

    await using decoder = new Decoder(this.#opusClient);

    const recording = await this.#recorderDatabase.get(this.#recordingId);

    if (recording === null) {
      throw new Error("Recording not found");
    }

    await decoder.create({
      sampleRate: recording.sampleRate,
      channels: recording.channels,
      frameSize: recording.frameSize
    });

    const pending = Promise.withResolvers<void>();
    const audioPlayerContext: IAudioPlayerContext = {
      recording,
      decoder,
      pending,
      playedDuration: 0,
      scheduledDuration: 0,
      currentTime: null,
      lastTime: null,
      scheduling: Promise.resolve(),
      startTime: this.#audioContext.currentTime,
      onEnded: async (scheduledRatio: number) => {
        const hasFinishedScheduling =
          audioPlayerContext.scheduledDuration >= recording.duration / 1000;
        if (hasFinishedScheduling) {
          pending.resolve();
          return;
        }
        if (scheduledRatio < 0.5) {
          return;
        }
        console.log("Halfway through playback");
        await this.#playInterval(
          audioPlayerContext.scheduledDuration,
          audioPlayerContext.scheduledDuration + 2,
          audioPlayerContext
        );
      }
    };
    await this.#playInterval(0, 2, audioPlayerContext);
  }
  async #playInterval(
    from: number,
    to: number,
    audioPlayerContext: IAudioPlayerContext
  ) {
    let processedDuration = 0;

    const cursor = await this.#recorderDatabase
      .transaction("recordingParts", "readonly")
      .objectStore("recordingParts")
      .index("recordingId")
      .openCursorIter(IDBKeyRange.only(this.#recordingId));

    if (cursor === null) {
      throw new Error("No recording parts found");
    }

    console.log("Starting to process recording parts from %o to %o", from, to);

    for await (const part of cursor) {
      if (processedDuration >= to) {
        break;
      }
      if (processedDuration >= from) {
        audioPlayerContext.scheduling = audioPlayerContext.scheduling.then(() =>
          this.#schedulePart(part, audioPlayerContext)
        );
      }
      processedDuration +=
        part.sampleCount /
        audioPlayerContext.recording.channels /
        audioPlayerContext.recording.sampleRate;
    }

    console.log("Processed %o seconds of audio", processedDuration);

    await audioPlayerContext.pending.promise;
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

    return {audioBuffer, audioBufferSourceNode};
  }
  async #schedulePart(
    part: IRecordingPartV1,
    audioPlayerContext: IAudioPlayerContext
  ) {
    const {audioBufferSourceNode: sourceNode, audioBuffer} =
      await this.#createSlice(part, audioPlayerContext);
    sourceNode.connect(this.#analyserNode);
    this.#analyserNode.connect(this.#audioContext.destination);
    sourceNode.onended = () => {
      audioPlayerContext.lastTime = this.#audioContext.currentTime;
      audioPlayerContext.playedDuration += audioBuffer.duration;

      const played =
        audioPlayerContext.playedDuration /
        (audioPlayerContext.recording.duration / 1000);

      const scheduled =
        audioPlayerContext.scheduledDuration /
        (audioPlayerContext.recording.duration / 1000);

      const scheduledRatio = played / scheduled;

      if (audioPlayerContext.onEnded) {
        audioPlayerContext.onEnded(scheduledRatio);
      }
    };
    const currentTime =
      audioPlayerContext.currentTime ?? audioPlayerContext.startTime;
    if (audioPlayerContext.currentTime === null) {
      audioPlayerContext.currentTime = currentTime;
    }
    sourceNode.start(currentTime + audioPlayerContext.scheduledDuration);
    audioPlayerContext.scheduledDuration += audioBuffer.duration;
  }
  public destroy() {}
}
