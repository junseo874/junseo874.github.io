"""Create web-only AAC copies. Supplied master WAVs are never modified."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import argparse
import hashlib
import subprocess
import wave

parser = argparse.ArgumentParser()
parser.add_argument('source_dir', type=Path)
args = parser.parse_args()
destination = Path(__file__).resolve().parents[1] / 'assets' / 'audio'
destination.mkdir(parents=True, exist_ok=True)

def convert(number):
    source = args.source_dir / f'LUNA Track {number:02}_master.wav'
    target = destination / f'luna-track-{number:02}.m4a'
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    with wave.open(str(source), 'rb') as wav:
        seconds = wav.getnframes() / wav.getframerate()
    subprocess.run(['/usr/bin/afconvert', '-f', 'm4af', '-d', 'aac', '-b', '192000', '-q', '127', str(source), str(target)], check=True)
    assert hashlib.sha256(source.read_bytes()).hexdigest() == digest, 'Source WAV changed'
    return f'{source.name}: {seconds:.2f}s, {source.stat().st_size:,} → {target.stat().st_size:,} bytes; source unchanged'

with ThreadPoolExecutor(max_workers=4) as pool:
    for result in pool.map(convert, range(1, 5)):
        print(result)
