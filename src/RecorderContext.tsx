import { createContext } from 'react';
import Recorder, { Opus } from './Recorder';
import { IAudioContext } from 'standardized-audio-context';

export const RecorderContext = createContext<IRecorderContextValue | null>(
  null
);

export interface IRecorderContextValue {
  recorder: Promise<Recorder | null>;
  worklet: Promise<void>;
  audioContext: IAudioContext;
  opus: Opus;
}
