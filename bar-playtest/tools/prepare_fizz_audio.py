"""Trim the supplied carbonation tail; preserve the original recording."""
import argparse
import wave
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('source')
parser.add_argument('output')
args = parser.parse_args()
with wave.open(args.source) as source:
    rate, channels = source.getframerate(), source.getnchannels()
    if source.getsampwidth() != 2:
        raise ValueError('Expected 16-bit PCM')
    samples = np.frombuffer(source.readframes(source.getnframes()), dtype='<i2').reshape(-1, channels).astype(np.float64) / 32768
# Avoid early handling spikes, retain the denser fizz followed by quieter bubbles.
clip = samples[round(.95 * rate):round(4.45 * rate)].copy()
clip -= np.mean(clip, axis=0)
# Keep the previous short-clip calibration; extending the tail must not make it louder.
reference = samples[round(.95 * rate):round(2.55 * rate)].copy()
reference -= np.mean(reference, axis=0)
rms = np.sqrt(np.mean(reference * reference))
if rms <= 0:
    raise ValueError('Silent source')
clip *= min(.035 / rms, .55 / np.max(np.abs(clip)))
# Gentle onset behind POP, then a diminishing pressure-release tail.
clip *= np.linspace(1, .65, len(clip))[:, None]
fade_in, fade_out = round(.035 * rate), round(.8 * rate)
clip[:fade_in] *= np.sin(np.linspace(0, np.pi / 2, fade_in))[:, None]
clip[-fade_out:] *= np.cos(np.linspace(0, np.pi / 2, fade_out))[:, None] ** 2
with wave.open(args.output, 'wb') as output:
    output.setnchannels(channels)
    output.setsampwidth(2)
    output.setframerate(rate)
    output.writeframes(np.round(clip * 32767).astype('<i2').tobytes())
print(f'Fizz: {len(clip)/rate:.3f}s, peak {np.max(np.abs(clip)):.3f}, RMS {np.sqrt(np.mean(clip*clip)):.4f}')
