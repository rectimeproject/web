import  { useEffect, useMemo } from "react";

export interface ICreateDecoderOptions {
  sampleRate: number;
  channels: number;
  frameSize: number;
}

const OPUS_SAMPLE_RATES = [8000, 12000, 16000, 24000, 48000] as const;

// Opus frame sizes correspond to 2.5, 5, 10, 20, 40, 60 ms.
// In samples-per-channel: sampleRate * (durationMs / 1000).
const OPUS_FRAME_DURATIONS_MS = [2.5, 5, 10, 20, 40, 60] as const;

function isValidSampleRate(sr: number): sr is (typeof OPUS_SAMPLE_RATES)[number] {
  return (OPUS_SAMPLE_RATES as readonly number[]).includes(sr);
}

function frameSizesForSampleRate(sampleRate: number): number[] {
  if (!isValidSampleRate(sampleRate)) return [];
  // All OPUS_SAMPLE_RATES are divisible to yield integer samples for these durations.
  return OPUS_FRAME_DURATIONS_MS.map((ms) => (sampleRate * ms) / 1000);
}

function clampToNearestAllowed(value: number, allowed: readonly number[]): number {
  if (allowed.length === 0) return value;
  let best = allowed[0] ?? null;
  if( best === null) return value;
  let bestDist = Math.abs(value - best);
  for (let i = 1; i < allowed.length; i++) {
    const v = allowed[i] ?? null;
    if( v === null) {
      console.warn("clampToNearestAllowed: encountered null in allowed values");
      continue;
    }
    const d = Math.abs(value - v);
    if (d < bestDist) {
      best = v;
      bestDist = d;
    }
  }
  return best;
}

export interface IOpusCodecOptionsProps {
  value: ICreateDecoderOptions;
  onChange: (next: ICreateDecoderOptions) => void;
  /** Optional: if true, show a small note that <10ms frames limit encoder modes (from Opus docs). */
  showLpcNote?: boolean;
  /** Optional: lock the UI to channels=1 without exposing it. Default true. */
  forceMono?: boolean;
  /** Optional: disable all controls. */
  disabled?: boolean;
  className?: string;
};

export default function OpusCodecOptions({
  value,
  onChange,
  showLpcNote = true,
  forceMono = true,
  disabled = false,
  className = "",
}: IOpusCodecOptionsProps) {
  const allowedFrameSizes = useMemo(
    () => frameSizesForSampleRate(value.sampleRate),
    [value.sampleRate]
  );

  // Normalize incoming value to Opus constraints (sampleRate in set, frameSize valid for rate, channels=1).
  useEffect(() => {
    const normalizedSampleRate = isValidSampleRate(value.sampleRate)
      ? value.sampleRate
      : 48000;

    const allowed = frameSizesForSampleRate(normalizedSampleRate);
    const normalizedFrameSize = allowed.length
      ? (allowed.includes(value.frameSize)
          ? value.frameSize
          : clampToNearestAllowed(value.frameSize, allowed))
      : value.frameSize;

    const normalizedChannels = forceMono ? 1 : value.channels;

    if (
      normalizedSampleRate !== value.sampleRate ||
      normalizedFrameSize !== value.frameSize ||
      normalizedChannels !== value.channels
    ) {
      onChange({
        sampleRate: normalizedSampleRate,
        frameSize: normalizedFrameSize,
        channels: normalizedChannels,
      });
    }
    // Intentionally depend on primitive fields only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.sampleRate, value.frameSize, value.channels, forceMono]);

  const lpcNoteVisible = showLpcNote && isValidSampleRate(value.sampleRate);
  const isSub10ms = isValidSampleRate(value.sampleRate) && value.frameSize < value.sampleRate * 0.01;

  const handleSampleRateChange = (sr: number) => {
    const nextSampleRate = isValidSampleRate(sr) ? sr : 48000;
    const nextAllowed = frameSizesForSampleRate(nextSampleRate);

    const nextFrameSize = nextAllowed.includes(value.frameSize)
      ? value.frameSize
      : nextAllowed[0] ?? null;

    if( nextFrameSize === null) {
      console.warn("handleSampleRateChange: no valid frame size for sample rate", nextSampleRate);
      return;
    }

    onChange({
      sampleRate: nextSampleRate,
      channels: forceMono ? 1 : value.channels,
      frameSize: nextFrameSize,
    });
  };

  const handleFrameSizeChange = (fs: number) => {
    const allowed = frameSizesForSampleRate(value.sampleRate);
    const nextFrameSize = allowed.includes(fs) ? fs : (allowed[0] ?? fs);
    onChange({
      sampleRate: value.sampleRate,
      channels: forceMono ? 1 : value.channels,
      frameSize: nextFrameSize,
    });
  };

  return (
    <div className={`w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">Opus decoder options</div>
          <div className="mt-0.5 text-xs text-slate-600">
            sampleRate ∈ {OPUS_SAMPLE_RATES.join(", ")}; frameSize depends on sampleRate.
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-500">channels</div>
          <div className="text-sm font-medium text-slate-900">{forceMono ? 1 : value.channels}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <div className="mb-1 text-xs font-medium text-slate-700">Sample rate (Hz)</div>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
            value={isValidSampleRate(value.sampleRate) ? value.sampleRate : 48000}
            onChange={(e) => handleSampleRateChange(Number(e.target.value))}
            disabled={disabled}
          >
            {OPUS_SAMPLE_RATES.map((sr) => (
              <option key={sr} value={sr}>
                {sr}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-1 text-xs font-medium text-slate-700">Frame size (samples)</div>
          <select
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
            value={allowedFrameSizes.includes(value.frameSize) ? value.frameSize : (allowedFrameSizes[0] ?? value.frameSize)}
            onChange={(e) => handleFrameSizeChange(Number(e.target.value))}
            disabled={disabled || allowedFrameSizes.length === 0}
          >
            {allowedFrameSizes.length === 0 ? (
              <option value={value.frameSize}>Invalid sampleRate</option>
            ) : (
              allowedFrameSizes.map((fs) => {
                const ms = (fs / value.sampleRate) * 1000;
                return (
                  <option key={fs} value={fs}>
                    {fs} ({ms} ms)
                  </option>
                );
              })
            )}
          </select>
        </label>
      </div>

      {lpcNoteVisible && (
        <div
          className={`mt-3 rounded-lg border px-3 py-2 text-xs ${
            isSub10ms
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-slate-200 bg-slate-50 text-slate-700"
          }`}
        >
          {isSub10ms ? (
            <>
              frameSize &lt; 10 ms ({value.sampleRate * 0.01} samples @ {value.sampleRate} Hz) can limit Opus encoder modes (LPC/hybrid).
            </>
          ) : (
            <>10 ms or more allows all Opus encoder modes.</>
          )}
        </div>
      )}

      <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2">
        <div className="text-[11px] font-medium text-slate-600">Current value</div>
        <pre className="mt-1 overflow-x-auto text-xs text-slate-900">
{JSON.stringify(
  {
    sampleRate: value.sampleRate,
    channels: forceMono ? 1 : value.channels,
    frameSize: value.frameSize,
  },
  null,
  2
)}
        </pre>
      </div>
    </div>
  );
}
