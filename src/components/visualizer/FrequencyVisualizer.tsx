import {useEffect} from "react";
import {AnalyserNode, IAudioContext} from "standardized-audio-context";
import PixiVisualizerBase from "./PixiVisualizerBase";
import {useVisualizerBars} from "../../hooks/visualizer/useVisualizerBars";

interface FrequencyVisualizerProps {
  analyserNode: AnalyserNode<IAudioContext> | null;
  isPlaying: boolean;
  canvasWidth?: number | string;
  canvasHeight?: number | string;
  backgroundColor?: number;
  barColor?: number;
  barCount?: number;
}

/**
 * Frequency visualization component
 * Displays real-time FFT frequency spectrum
 */
export default function FrequencyVisualizer({
  analyserNode,
  isPlaying,
  canvasWidth = "100%",
  canvasHeight = 256,
  backgroundColor = 0xe9ecef,
  barColor = 0x495057,
  barCount = 64
}: FrequencyVisualizerProps) {
  return (
    <PixiVisualizerBase
      canvasWidth={canvasWidth}
      canvasHeight={canvasHeight}
      backgroundColor={backgroundColor}
    >
      {({barsContainerRef, isPixiReady, dimensions}) => {
        const barsRef = useVisualizerBars({
          visualizationMode: {type: "frequency", barCount},
          isPixiReady,
          barsContainerRef
        });

        // Frequency mode rendering effect
        useEffect(() => {
          if (!analyserNode || !isPlaying || !barsRef.current.length) return;

          analyserNode.fftSize = 2 ** 10;
          analyserNode.minDecibels = -90;
          analyserNode.maxDecibels = -10;

          const data = new Uint8Array(analyserNode.frequencyBinCount);
          const barWidth = dimensions.width / barCount;
          let frameId: number;

          const draw = () => {
            analyserNode.getByteFrequencyData(data);

            barsRef.current.forEach((bar, i) => {
              // Scale to 80% of canvas height with minimum 4px
              const rawHeight = data[i] ?? 0;
              // Use the full 80% height range for better visibility
              const maxBarHeight = dimensions.height * 0.8;
              const height = Math.max((rawHeight / 255) * maxBarHeight, 4);
              const x = i * barWidth;
              // Center vertically in the canvas
              const y = (dimensions.height - height) / 2;

              bar.clear();
              bar.rect(x, y, barWidth - 1, height);
              bar.fill(barColor);
            });

            frameId = requestAnimationFrame(draw);
          };

          frameId = requestAnimationFrame(draw);

          return () => {
            cancelAnimationFrame(frameId);
            barsRef.current.forEach(bar => bar.clear());
          };
        }, [analyserNode, isPlaying, dimensions, barColor, barsRef]);

        return null;
      }}
    </PixiVisualizerBase>
  );
}
