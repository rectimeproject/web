import {
  CodecId,
  // IEncodeFloatResult,
  // RequestResponse,
  createEncoder,
  encodeFloat,
  getFromEncoder,
  initializeWorker,
  setToEncoder
} from "opus-codec-worker/actions/actions.js";
import {
  AnalyserNode,
  AudioWorkletNode,
  IAudioContext,
  IAudioWorkletNode,
  MediaStreamAudioSourceNode
} from "standardized-audio-context";
import {EventEmitter} from "eventual-js";
import {
  OPUS_GET_BITRATE,
  OPUS_SET_BITRATE
} from "opus-codec-worker/actions/opus.js";
import * as opus from "opus-codec/opus/index.js";
import OpusCodecWorker from "opus-codec-worker/worker?worker";
import wasmFileHref from "opus-codec/native/index.wasm?url";
import Client from "opus-codec-worker/actions/Client.js";

export enum RecorderStateType {
  Idle,
  StoppingToRecord,
  StartingToRecord,
  Recording
}

export class Opus {
  readonly worker;
  readonly client;
  initialization: Promise<void> | null = null;
  public constructor() {
    this.worker = new OpusCodecWorker();
    this.client = new Client(this.worker);
    this.initialization = null;
  }
  public async initialize() {
    if (this.initialization !== null) {
      return this.initialization;
    }
    this.initialization = this.client
      .sendMessage(
        initializeWorker({
          wasmFileHref
        })
      )
      .then(() => {});
  }
}

interface IRecordingRecorderState {
  type: RecorderStateType.Recording;
  mediaStream: MediaStream;
  audioWorkletNode: IAudioWorkletNode<IAudioContext>;
  mediaStreamAudioSourceNode: MediaStreamAudioSourceNode<IAudioContext>;
  encoderId: CodecId;
  analyserNode: AnalyserNode<IAudioContext>;
  sampleCount: number;
  device: {
    deviceId: string;
    groupId: string;
  } | null;
}

interface IStartingToRecordRecorderState extends Partial<
  Omit<IRecordingRecorderState, "type" | "recording">
> {
  type: RecorderStateType.StartingToRecord;
}

type RecorderState =
  | {
      type: RecorderStateType.Idle;
    }
  | IStartingToRecordRecorderState
  | IRecordingRecorderState
  | {
      type: RecorderStateType.StoppingToRecord;
    };

export default class Recorder extends EventEmitter<{
  startRecording: {
    encoderId: CodecId;
    sampleRate: number;
    frameSize: number;
    channels: number;
  };
  encoded: {
    size: number;
    sampleCount: number;
    encoderId: CodecId;
    buffer: ArrayBuffer;
    duration: number;
  };
}> {
  readonly #audioContext;
  readonly #opus;
  readonly #opusCompliantDurations = {
    FRAME_SIZE_120_MS: 120,
    FRAME_SIZE_100_MS: 100,
    FRAME_SIZE_80_MS: 80,
    FRAME_SIZE_60_MS: 60,
    FRAME_SIZE_40_MS: 40,
    FRAME_SIZE_20_MS: 20,
    FRAME_SIZE_10_MS: 10,
    FRAME_SIZE_5_MS: 5,
    FRAME_SIZE_2_5_MS: 2.5
  };
  #currentState: RecorderState;
  public constructor(audioContext: IAudioContext, opus: Opus) {
    super({
      maxListenerWaitTime: 10000
    });
    this.#opus = opus;
    this.#audioContext = audioContext;
    this.#currentState = {
      type: RecorderStateType.Idle
    };
  }
  /**
   * @returns null or encoder id that was active
   */
  public async stop() {
    const state = this.#currentState;
    switch (state.type) {
      case RecorderStateType.Recording:
      case RecorderStateType.StartingToRecord:
        await this.#setStateToIdle();
        console.log("state set back to idle");
        return state.encoderId;
    }
    return null;
  }
  public currentState(): Readonly<RecorderState> {
    return this.#currentState;
  }
  public async setInputDevice(device: MediaDeviceInfo) {
    const state = this.#currentState;
    switch (state.type) {
      case RecorderStateType.Idle:
      case RecorderStateType.StoppingToRecord:
      case RecorderStateType.StartingToRecord:
        return false;
      case RecorderStateType.Recording: {
        if (
          state.device !== null &&
          state.device.deviceId === device.deviceId &&
          state.device.groupId === device.groupId
        ) {
          return true;
        }
        let newStream: MediaStream;
        try {
          newStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: device.deviceId,
              groupId: device.groupId
            }
          });
        } catch (reason) {
          console.error("failed to get media stream with error: %o", reason);
          return false;
        }
        const oldStream = state.mediaStream;
        const oldSourceNode = state.mediaStreamAudioSourceNode;
        const newSourceNode =
          this.#audioContext.createMediaStreamSource(newStream);
        /**
         * disconnect old source node
         */
        oldSourceNode.disconnect(state.analyserNode);
        /**
         * connect new source node
         */
        newSourceNode.connect(state.analyserNode);
        /**
         * set new properties to state
         */
        state.mediaStreamAudioSourceNode = newSourceNode;
        state.mediaStream = newStream;
        state.device = device;
        /**
         * destroy old stream
         */
        for (const t of oldStream.getTracks()) {
          t.stop();
        }
        return true;
      }
    }
  }
  public async start({
    device,
    maxDataBytes
  }: {
    maxDataBytes: number;
    device: MediaDeviceInfo | null;
  }): Promise<{
    encoderId: string;
    bitrate: number;
  } | null> {
    if (this.#currentState.type !== RecorderStateType.Idle) {
      console.error(
        "start() called, but recorder was in invalid state: %o",
        this.#currentState
      );
      return null;
    }
    const frameSize =
      (this.#opusCompliantDurations.FRAME_SIZE_100_MS *
        this.#audioContext.sampleRate) /
      1000;
    const startingToRecord: IStartingToRecordRecorderState = {
      type: RecorderStateType.StartingToRecord
    };
    this.#currentState = startingToRecord;
    let mediaStream: MediaStream;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: device
          ? {
              deviceId: device.deviceId,
              groupId: device.groupId
            }
          : true
      });
    } catch (reason) {
      console.error("Failed to get user media with error: %o", reason);
      await this.#setStateToIdle();
      return null;
    }
    /**
     * store media stream to be later destroyed in case of failures
     */
    startingToRecord.mediaStream = mediaStream;
    /**
     * create encoder
     */
    const encoderId = await this.#opus.client.sendMessage(
      createEncoder({
        sampleRate: this.#audioContext.sampleRate,
        application: opus.constants.OPUS_APPLICATION_VOIP,
        channels: 1,
        pcmBufferLength: frameSize * Float32Array.BYTES_PER_ELEMENT,
        outBufferLength: maxDataBytes
      })
    );
    if ("failures" in encoderId) {
      console.error(
        "failed to create encoder with failures: %s",
        encoderId.failures.join(", ")
      );
      await this.#setStateToIdle();
      return null;
    }
    /**
     * set encoder id
     */
    startingToRecord.encoderId = encoderId.value;
    console.log("successfully created encoder: %s", encoderId.value);
    const setBitRateResult = await this.#opus.client.sendMessage(
      setToEncoder(OPUS_SET_BITRATE(encoderId.value, 32000))
    );
    if ("failures" in setBitRateResult) {
      console.error(
        "failed to set bitrate with failures: %s",
        setBitRateResult.failures.join(", ")
      );
      await this.#setStateToIdle();
      return null;
    }
    if (!AudioWorkletNode) {
      console.error("AudioWorkletNode is not supported");
      return null;
    }
    /**
     * emit start recording
     */
    this.emit("startRecording", {
      encoderId: encoderId.value,
      sampleRate: this.#audioContext.sampleRate,
      channels: 1,
      frameSize
    });
    const workletNode = new AudioWorkletNode(
      this.#audioContext,
      "default-audio-processor",
      {
        parameterData: {
          frameSize,
          debug: 0
        }
      }
    );
    /**
     * store audio worklet node on intermediary state
     */
    startingToRecord.audioWorkletNode = workletNode;
    /**
     * create analyser node
     */
    const analyserNode = this.#audioContext.createAnalyser();
    /**
     * create source node from media stream
     */
    const sourceNode = this.#audioContext.createMediaStreamSource(mediaStream);
    /**
     * connect source node to worklet
     */
    sourceNode.connect(analyserNode);
    /**
     * connect analyser node to worklet
     */
    analyserNode.connect(workletNode);
    /**
     * connect analyzer node back to audio context
     */
    // workletNode.connect(this.#audioContext.destination);
    const recordingState: IRecordingRecorderState = {
      sampleCount: 0,
      device: device
        ? {
            deviceId: device.deviceId,
            groupId: device.groupId
          }
        : null,
      type: RecorderStateType.Recording,
      analyserNode,
      encoderId: encoderId.value,
      mediaStream,
      mediaStreamAudioSourceNode: sourceNode,
      audioWorkletNode: workletNode
    };
    this.#currentState = recordingState;
    let pending = Promise.resolve();
    const onReceiveSamples = (e: MessageEvent) => {
      const pcm: Float32Array<ArrayBuffer> = e.data.samples;

      /**
       * encode samples
       */
      pending = pending
        .then(async () => {
          const result = await this.#opus.client.sendMessage(
            encodeFloat({
              input: {
                pcm: pcm.slice(0)
              },
              maxDataBytes,
              encoderId: encoderId.value
            })
          );
          if (result && "failures" in result) {
            workletNode.port.removeEventListener("message", onReceiveSamples);
            console.error(
              "stopping encoding because of failures: %s",
              result.failures.join(", ")
            );
            return;
          }
          if (result.value.encoded === null) {
            console.debug(
              "Encoder returned null (not enough data for full frame); pcmLength=%d, encoderId=%s",
              pcm.length,
              encoderId.value
            );
            return;
          }
          this.emit("encoded", {
            size: result.value.encoded.buffer.byteLength,
            sampleCount: pcm.length,
            duration: result.value.encoded.duration,
            buffer: result.value.encoded.buffer,
            encoderId: encoderId.value
          });
        })
        .catch(reason => {
          console.error("failure while trying to decode samples: %o", reason);
        });
    };
    /**
     * expect samples from worklet
     */
    workletNode.port.addEventListener("message", onReceiveSamples);
    /**
     * start port
     */
    workletNode.port.start();

    const getBitrateResult = await this.#opus.client.sendMessage(
      getFromEncoder(OPUS_GET_BITRATE(encoderId.value))
    );
    if ("failures" in getBitrateResult) {
      console.error("failed to get bitrate with error: %o", getBitrateResult);
      return null;
    }
    return {
      encoderId: encoderId.value,
      bitrate: getBitrateResult.value
    };
  }
  async #setStateToIdle() {
    const currentState = this.#currentState;
    if (
      currentState.type === RecorderStateType.Idle ||
      currentState.type === RecorderStateType.StoppingToRecord
    ) {
      return;
    }
    const mediaStream = currentState.mediaStream ?? null;
    if (mediaStream) {
      for (const t of mediaStream.getTracks()) {
        try {
          t.stop();
        } catch (reason) {
          console.error("Failed to stop track with error: %o", reason);
        }
      }
    }
    if (currentState.audioWorkletNode) {
      currentState.audioWorkletNode.port.postMessage({
        stop: true
      });
      try {
        // Disconnect from all connections (worklet is connected to analyserNode, not destination)
        currentState.audioWorkletNode.disconnect();
      } catch (reason) {
        console.error(
          "failed to disconnect audio worklet with error: %o",
          reason
        );
      }
    }
    /**
     * wait for all events to be delivered
     */
    await this.wait(["encoded", "startRecording"]);
    // if (currentState.encoderId) {
    //   let result: RequestResponse<IEncodeFloatResult>;
    //   do {
    //     result = await this.#opus.client.sendMessage(
    //       encodeFloat({
    //         input: null,
    //         maxDataBytes: 500,
    //         encoderId: currentState.encoderId,
    //       })
    //     );
    //     if (!('failures' in result)) {
    //       console.log(
    //         'got encoded data that was queued in the ring buffer: %o',
    //         result.value.encoded
    //       );
    //     }
    //   } while (!('failures' in result) && result.value.encoded !== null);
    // }
    this.#currentState = {
      type: RecorderStateType.Idle
    };
  }
}
