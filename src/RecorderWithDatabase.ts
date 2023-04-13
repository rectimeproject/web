import { IAudioContext } from 'standardized-audio-context';
import Recorder, { Opus } from './Recorder';
import RecorderDatabase from './RecorderDatabase';
import { boundMethod } from 'autobind-decorator';
import { CodecId } from 'opus-codec-worker/actions/actions';

export default class RecorderWithDatabase extends Recorder {
  static databaseName = 'appRecordings';
  readonly #database;
  public constructor(a: IAudioContext, b: Opus) {
    super(a, b);
    this.#database = new RecorderDatabase(RecorderWithDatabase.databaseName);
    this.on('startRecording', this.onStartRecording);
    this.on('encoded', this.onEncoded);
  }
  public close() {
    this.off('startRecording', this.onStartRecording);
    this.off('encoded', this.onEncoded);
  }
  public database() {
    return this.#database;
  }
  @boundMethod private async onEncoded({
    encoderId,
    sampleCount,
    buffer,
  }: {
    encoderId: CodecId;
    sampleCount: number;
    buffer: ArrayBuffer;
  }) {
    const recording = await this.#database.getFromEncoderId(encoderId);

    if (!recording) {
      console.error('failed to get recording from encoder id: %s', encoderId);
      return;
    }
    const newRecordingState = await this.#database.addBlobPart({
      recordingId: recording.id,
      sampleCount,
      blobPart: buffer,
    });

    if (newRecordingState === null) {
      console.error('failed to add blob part. addBlobPart() returned null: %o');
    }
  }
  @boundMethod private async onStartRecording(data: {
    encoderId: CodecId;
    sampleRate: number;
    frameSize: number;
    channels: number;
  }) {
    const recordingId = await this.#database.create(data);
    if (recordingId === null) {
      console.error('failed to create recording database item: %o', data);
      return;
    }
  }
}
