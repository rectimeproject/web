import {useEffect, useState} from "react";
import {AnalyserNode} from "standardized-audio-context";

/**
 * Captures real-time waveform data from an AnalyserNode during playback
 * Similar to the waveform capture during recording, but for playback visualization
 */
export default function usePlaybackWaveform(
  analyserNode: AnalyserNode<any> | null,
  isPlaying: boolean
) {
  const [waveformSamples, setWaveformSamples] = useState<number[]>([]);

  useEffect(() => {
    if (!analyserNode || !isPlaying) {
      setWaveformSamples([]);
      return;
    }

    // Configure analyser for waveform capture
    analyserNode.fftSize = 2 ** 11; // Higher resolution for better waveform
    analyserNode.smoothingTimeConstant = 0.3; // Smooth out the waveform

    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let animationFrameId: number;
    let sampleCount = 0;
    const maxSamples = 100; // Keep a rolling window of samples for timeline

    // Throttle updates to ~20fps for smoother marker movement
    let lastUpdateTime = 0;
    const updateInterval = 1000 / 20; // 50ms between updates

    const captureWaveform = (timestamp: number) => {
      if (!isPlaying) {
        return;
      }

      // Throttle updates to reduce re-render jank
      const timeSinceLastUpdate = timestamp - lastUpdateTime;
      if (timeSinceLastUpdate >= updateInterval) {
        lastUpdateTime = timestamp;

        // Use time domain data for actual waveform amplitude
        analyserNode.getByteTimeDomainData(dataArray);

        // Calculate RMS amplitude
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const n = dataArray[i] ?? null;
          if (n === null) {
            continue;
          }
          const normalized = (n - 128) / 128;
          sum += normalized * normalized;
        }
        const rms = Math.sqrt(sum / bufferLength);

        // Convert to 0-100 range for visualization
        const amplitude = Math.min(100, rms * 200);

        setWaveformSamples(prev => {
          const newSamples = [...prev, amplitude];
          // Keep only the most recent samples for a rolling window
          return newSamples.length > maxSamples
            ? newSamples.slice(-maxSamples)
            : newSamples;
        });

        sampleCount++;
      }

      animationFrameId = requestAnimationFrame(captureWaveform);
    };

    // Start capturing
    animationFrameId = requestAnimationFrame(captureWaveform);

    return () => {
      cancelAnimationFrame(animationFrameId);
      console.log(
        `[usePlaybackWaveform] Stopped waveform capture, total samples: ${sampleCount}`
      );
    };
  }, [analyserNode, isPlaying]);

  return waveformSamples;
}
