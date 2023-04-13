import Client from 'opus-codec-worker/actions/Client';
import {
  CodecId,
  // IEncodeFloatResult,
  // RequestResponse,
  createEncoder,
  encodeFloat,
  getFromEncoder,
  initializeWorker,
  setToEncoder,
} from 'opus-codec-worker/actions/actions';
import {
  AnalyserNode,
  AudioWorkletNode,
  IAudioContext,
  IAudioWorkletNode,
  MediaStreamAudioSourceNode,
} from 'standardized-audio-context';
import { EventEmitter } from 'eventual-js';
import {
  OPUS_GET_BANDWIDTH,
  OPUS_GET_BITRATE,
  OPUS_GET_MAX_BANDWIDTH,
  OPUS_SET_BITRATE,
} from 'opus-codec-worker/actions/opus';
import * as opus from 'opus-codec/opus';

export enum RecorderStateType {
  Idle,
  StoppingToRecord,
  StartingToRecord,
  Recording,
}

export class Opus {
  readonly worker;
  readonly client;
  public constructor() {
    this.worker = new Worker('/opus/worker.js');
    this.client = new Client(this.worker);
    this.client
      .sendMessage(
        initializeWorker({
          wasmFileHref: '/opus/index.wasm',
        })
      )
      .then((result) => {
        console.log(result);
      });
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
}

interface IStartingToRecordRecorderState
  extends Partial<Omit<IRecordingRecorderState, 'type' | 'recording'>> {
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
  readonly #opusCompliantDurations = [60, 40, 20, 10, 5, 2.5];
  #currentState: RecorderState;
  public constructor(audioContext: IAudioContext, opus: Opus) {
    super({
      maxListenerWaitTime: 10000,
    });
    this.#opus = opus;
    this.#audioContext = audioContext;
    this.#currentState = {
      type: RecorderStateType.Idle,
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
        console.log('state set back to idle');
        return state.encoderId;
    }
    return null;
  }
  public currentState(): Readonly<RecorderState> {
    return this.#currentState;
  }
  public async start({
    maxDataBytes = 500,
    frameSize: maybeFrameSize,
  }: Partial<{
    frameSize: number;
    maxDataBytes: number;
  }> = {}): Promise<{
    encoderId: string;
    bitrate: number;
  } | null> {
    if (this.#currentState.type !== RecorderStateType.Idle) {
      console.error(
        'start() called, but recorder was in invalid state: %o',
        this.#currentState
      );
      return null;
    }
    const supportedFrameSizes = this.#opusCompliantDurations.map(
      (duration) => ({
        frameSize: (duration * this.#audioContext.sampleRate) / 1000,
        duration,
      })
    );
    if (typeof maybeFrameSize === 'undefined') {
      for (const fs2 of supportedFrameSizes) {
        console.log(
          'selecting %d ms frame size, because nothing else was provided: %d',
          fs2.duration,
          fs2.frameSize
        );
        maybeFrameSize = fs2.frameSize;
        break;
      }
    }
    if (typeof maybeFrameSize === 'undefined') {
      console.error('failed to find frame size automatically');
      return null;
    }
    if (!supportedFrameSizes.some((fs) => fs.frameSize === maybeFrameSize)) {
      console.error(
        'invalid frame size. supported frame sizes are: %o',
        supportedFrameSizes
      );
      return null;
    }
    /**
     * static frame size
     */
    const frameSize = maybeFrameSize;
    const startingToRecord: IStartingToRecordRecorderState = {
      type: RecorderStateType.StartingToRecord,
    };
    this.#currentState = startingToRecord;
    let mediaStream: MediaStream;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
    } catch (reason) {
      console.error('failed to get user media with error: %o', reason);
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
        outBufferLength: maxDataBytes,
      })
    );
    if ('failures' in encoderId) {
      console.error(
        'failed to create encoder with failures: %s',
        encoderId.failures.join(', ')
      );
      await this.#setStateToIdle();
      return null;
    }
    /**
     * set encoder id
     */
    startingToRecord.encoderId = encoderId.value;
    console.log('successfully created encoder: %s', encoderId.value);
    const setBitRateResult = await this.#opus.client.sendMessage(
      setToEncoder(OPUS_SET_BITRATE(encoderId.value, 32000))
    );
    if ('failures' in setBitRateResult) {
      console.error(
        'failed to set bitrate with failures: %s',
        setBitRateResult.failures.join(', ')
      );
      await this.#setStateToIdle();
      return null;
    }
    console.log(
      'bitrate: %o',
      await Promise.all([
        this.#opus.client.sendMessage(
          getFromEncoder(OPUS_GET_BITRATE(encoderId.value))
        ),
        this.#opus.client.sendMessage(
          getFromEncoder(OPUS_GET_BANDWIDTH(encoderId.value))
        ),
        this.#opus.client.sendMessage(
          getFromEncoder(OPUS_GET_MAX_BANDWIDTH(encoderId.value))
        ),
      ])
    );
    if (!AudioWorkletNode) {
      console.error('AudioWorkletNode is not supported');
      return null;
    }
    /**
     * emit start recording
     */
    this.emit('startRecording', {
      encoderId: encoderId.value,
      sampleRate: this.#audioContext.sampleRate,
      channels: 1,
      frameSize,
    });
    const workletNode = new AudioWorkletNode(
      this.#audioContext,
      'default-audio-processor',
      {
        parameterData: {
          frameSize,
          debug: 0,
        },
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
    workletNode.connect(this.#audioContext.destination);
    const recordingState: IRecordingRecorderState = {
      sampleCount: 0,
      type: RecorderStateType.Recording,
      analyserNode,
      encoderId: encoderId.value,
      mediaStream,
      mediaStreamAudioSourceNode: sourceNode,
      audioWorkletNode: workletNode,
    };
    this.#currentState = recordingState;
    let pending = Promise.resolve();
    const onReceiveSamples = (e: MessageEvent) => {
      const pcm: Float32Array = e.data.samples;

      /**
       * encode samples
       */
      pending = pending
        .then(async () => {
          const result = await this.#opus.client.sendMessage(
            encodeFloat({
              input: {
                pcm,
              },
              maxDataBytes,
              encoderId: encoderId.value,
            })
          );
          if (result && 'failures' in result) {
            workletNode.port.removeEventListener('message', onReceiveSamples);
            console.error(
              'stopping encoding because of failures: %s',
              result.failures.join(', ')
            );
            return;
          }
          if (result) {
            if (result.value.encoded === null) {
              console.error(
                'result from worker returned with no array buffer: %o',
                result
              );
              return;
            }
            this.emit('encoded', {
              size: result.value.encoded.buffer.byteLength,
              sampleCount: pcm.length,
              duration: result.value.encoded.duration,
              buffer: result.value.encoded.buffer,
              encoderId: encoderId.value,
            });
          }
        })
        .catch((reason) => {
          console.error('failure while trying to decode samples: %o', reason);
        });
    };
    /**
     * expect samples from worklet
     */
    workletNode.port.addEventListener('message', onReceiveSamples);
    /**
     * start port
     */
    workletNode.port.start();

    const getBitrateResult = await this.#opus.client.sendMessage(
      getFromEncoder(OPUS_GET_BITRATE(encoderId.value))
    );
    if ('failures' in getBitrateResult) {
      console.error('failed to get bitrate with error: %o', getBitrateResult);
      return null;
    }
    return {
      encoderId: encoderId.value,
      bitrate: getBitrateResult.value,
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
    if (currentState.mediaStream) {
      for (const t of currentState.mediaStream.getTracks()) {
        try {
          t.stop();
        } catch (reason) {
          console.error('failed to stop track');
        }
      }
    }
    if (currentState.audioWorkletNode) {
      currentState.audioWorkletNode.port.postMessage({
        stop: true,
      });
      try {
        currentState.audioWorkletNode.disconnect(
          this.#audioContext.destination
        );
      } catch (reason) {
        console.error(
          'failed to disconnect audio worklet with error: %o',
          reason
        );
      }
    }
    /**
     * wait for all events to be delivered
     */
    await this.wait(['encoded', 'startRecording']);
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
      type: RecorderStateType.Idle,
    };
  }
}
