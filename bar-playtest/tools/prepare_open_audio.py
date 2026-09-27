"""Prepare the supplied beercan recording without modifying the original."""
import argparse
import wave
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument("source")
parser.add_argument("output")
args = parser.parse_args()
with wave.open(args.source) as source:
    rate, channels = source.getframerate(), source.getnchannels()
    if source.getsampwidth() != 2:
        raise ValueError("Expected 16-bit PCM")
    samples = np.frombuffer(source.readframes(source.getnframes()), dtype="<i2").reshape(-1, channels).astype(np.float64) / 32768
# Retain the opening transients and short release, remove leading silence and handling tail.
start, end = .235, 1.30
clip = samples[round(start * rate):round(end * rate)].copy()
clip -= np.mean(clip, axis=0)
clip *= 2.8
fade_in, fade_out = round(.002 * rate), round(.065 * rate)
clip[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
clip[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None]
if np.max(np.abs(clip)) >= 1:
    raise ValueError("Unexpected clipping")
with wave.open(args.output, "wb") as output:
    output.setnchannels(channels)
    output.setsampwidth(2)
    output.setframerate(rate)
    output.writeframes(np.round(clip * 32767).astype("<i2").tobytes())
print(f"Opening SFX: {len(clip)/rate:.3f}s, peak {np.max(np.abs(clip)):.3f}, {rate}Hz, {channels} channels")
