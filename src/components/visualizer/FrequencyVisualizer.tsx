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
          const barSpacing = 2;
          // Fixed bar width based on canvas width as reference
          const barWidth = 6;
          let frameId: number;

          const draw = () => {
            analyserNode.getByteFrequencyData(data);

            barsRef.current.forEach((bar, i) => {
              const rawHeight = data[i] ?? 0;
              // Bars grow from center, occupying up to 80% of canvas height total
              const maxBarHeight = dimensions.height * 0.8;
              const minBarHeight = 4;
              const height = Math.max(
                (rawHeight / 255) * maxBarHeight,
                minBarHeight
              );
              const x = i * (barWidth + barSpacing);
              // Position bar from vertical center, growing up and down equally
              const centerY = dimensions.height / 2;
              const y = centerY - height / 2;

              bar.clear();
              bar.rect(x, y, barWidth, height);
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
