import { useContext } from 'react';
import { RecorderContext } from './RecorderContext';

export default function useRecorderContext() {
  const recorder = useContext(RecorderContext);
  if (recorder === null) {
    throw new Error('Failed to get recorder context');
  }
  return recorder;
}
