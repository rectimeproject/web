import {
  createEncoder,
  destroyEncoder,
  encodeFloat
} from "opus-codec-worker/actions/actions.js";
import Client from "opus-codec-worker/actions/Client.js";
import * as opus from "opus-codec/opus/index.js";

export enum OpusApplication {
  VOIP = opus.constants.OPUS_APPLICATION_VOIP,
  AUDIO = opus.constants.OPUS_APPLICATION_AUDIO,
  RESTRICTED_LOWDELAY = opus.constants.OPUS_APPLICATION_RESTRICTED_LOWDELAY
}

export enum OpusFrameSize {
  FRAME_SIZE_120_MS = 120,
  FRAME_SIZE_100_MS = 100,
  FRAME_SIZE_80_MS = 80,
  FRAME_SIZE_60_MS = 60,
  FRAME_SIZE_40_MS = 40,
  FRAME_SIZE_20_MS = 20,
  FRAME_SIZE_10_MS = 10,
  FRAME_SIZE_5_MS = 5,
  FRAME_SIZE_2_5_MS = 2.5
}

export default class Encoder {
  readonly #client;
  #encoderId: string | null;
  public constructor(client: Client) {
    this.#client = client;
    this.#encoderId = null;
  }
  public async create({
    sampleRate,
    channels,
    application,
    maxDataBytes,
    frameSize
  }: {
    sampleRate: number;
    application: OpusApplication;
    maxDataBytes: number;
    frameSize: OpusFrameSize;
    channels: number;
  }) {
    if (this.#encoderId !== null) {
      throw new Error("Encoder already created");
    }
    const pcmBufferLength =
      ((frameSize * sampleRate) / 1000) * Float32Array.BYTES_PER_ELEMENT;
    /**
     * create encoder
     */
    const encoderId = await this.#client.sendMessage(
      createEncoder({
        sampleRate,
        application,
        channels,
        pcmBufferLength,
        outBufferLength: maxDataBytes
      })
    );
    if ("failures" in encoderId) {
      throw new Error(
        `Failed to create encoder: ${encoderId.failures.join(", ")}`
      );
    }
    this.#encoderId = encoderId.value;
  }

  public async encodeFloat(pcm: Float32Array, maxDataBytes: number) {
    if (this.#encoderId === null) {
      throw new Error("Encoder not created");
    }

    const result = await this.#client.sendMessage(
      encodeFloat({
        input: {
          pcm: pcm.slice(0)
        },
        maxDataBytes,
        encoderId: this.#encoderId
      })
    );

    if ("failures" in result) {
      throw new Error(`Failed to encode: ${result.failures.join(", ")}`);
    }

    return result.value.encoded;
  }

  public async [Symbol.asyncDispose]() {
    if (this.#encoderId === null) {
      throw new Error("Encoder not created");
    }
    await this.#client.sendMessage(
      destroyEncoder({encoderId: this.#encoderId})
    );
  }
}
