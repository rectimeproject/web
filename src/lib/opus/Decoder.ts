import {
  createDecoder,
  decodeFloat,
  destroyDecoder,
  ICreateDecoderOptions
} from "opus-codec-worker/actions/actions.js";
import Client from "opus-codec-worker/actions/Client.js";

export default class Decoder {
  readonly #opusClient: Client;
  #decoderId: string | null;
  public constructor(opusClient: Client) {
    this.#opusClient = opusClient;
    this.#decoderId = null;
  }

  public async decodeFloat(encoded: ArrayBuffer) {
    if (this.#decoderId === null) {
      throw new Error("Decoder not created");
    }

    const result = await this.#opusClient.sendMessage(
      decodeFloat({
        decoderId: this.#decoderId,
        encoded
      })
    );

    if ("failures" in result) {
      throw new Error(`Failed to decode: ${result.failures.join(", ")}`);
    }

    return result.value.decoded;
  }

  public async create(options: ICreateDecoderOptions) {
    if (this.#decoderId !== null) {
      throw new Error("Decoder already created");
    }

    const decoderId = await this.#opusClient.sendMessage(
      createDecoder(options)
    );

    if ("failures" in decoderId) {
      throw new Error(
        `Failed to create decoder: ${decoderId.failures.join(", ")}`
      );
    }

    this.#decoderId = decoderId.value;
  }
  async [Symbol.asyncDispose]() {
    if (this.#decoderId === null) {
      return;
    }
    const result = await this.#opusClient.sendMessage(
      destroyDecoder({decoderId: this.#decoderId})
    );
    if ("failures" in result) {
      console.error(`Failed to destroy decoder: ${result.failures.join(", ")}`);
    }
    this.#decoderId = null;
  }
}
