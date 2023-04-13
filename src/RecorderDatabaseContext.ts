import { createContext, useContext } from 'react';
import RecorderDatabase from './RecorderDatabase';

const RecorderDatabaseContext = createContext<RecorderDatabase | null>(null);

export function useRecorderDatabaseContext() {
  const ctx = useContext(RecorderDatabaseContext);
  if (ctx === null) throw new Error('Failed to get recorder database context');
  return ctx;
}

export default RecorderDatabaseContext;
