"""One-time local MP3 -> timestamped TXT/SRT and static LRC. No web service.

Requires whisper.cpp CLI + multilingual model downloaded separately, outside
public_html. Existing LRC files are preserved unless --overwrite is passed.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import time
import wave


def stamp(seconds):
    ticks = max(0, round(seconds * 100))
    return f'{ticks // 6000:02d}:{ticks // 100 % 60:02d}.{ticks % 100:02d}'


def read_lines(payload, duration):
    lines = []
    for row in payload.get('transcription', []):
        start = row.get('offsets', {}).get('from', 0) / 1000
        end = row.get('offsets', {}).get('to', 0) / 1000
        if end <= start or start >= duration:
            continue
        text = ' '.join(row.get('text', '').split())
        # Some CLI token splits contain incomplete UTF-8 bytes; mark uncertain
        # text explicitly, rather than failing the whole playlist conversion.
        text = text.encode('utf-8', errors='surrogateescape').decode('utf-8', errors='replace').replace('\ufffd', '[?]')
        # Strip only engine control tokens; preserve the recognized words.
        text = re.sub(r'\[\[_[^\]]*\]\]|<\|[^|]*\|>', '', text).strip()
        # Known Whisper boilerplate hallucinated over instrumental audio.
        if re.search(r'ghiền mì gõ|la la school|lalaschool', text, re.I) or \
                re.fullmatch(r'(?:video hấp dẫn|những video hấp dẫn)[.!…\s]*', text, re.I):
            continue
        end = min(end, duration)
        if not text or end <= start:
            continue
        if lines:
            start = max(start, lines[-1]['end'])
        if end > start:
            lines.append({'start': start, 'end': end, 'text': text})
    return lines


def export(lines, lrc_path, text_path, model='whisper.cpp'):
    lrc = ['[re:whisper.cpp local transcription]', f'[ve:{model}]',
           '[comment:Automatic transcription; review words and timing against this MP3]']
    for index, line in enumerate(lines):
        lrc.append(f'[{stamp(line["start"])}]{line["text"]}')
        following = lines[index + 1]['start'] if index + 1 < len(lines) else float('inf')
        if following - line['end'] > .5:
            lrc.append(f'[{stamp(line["end"])}]')
    temporary = lrc_path.with_suffix('.lrc.next')
    temporary.write_text('\n'.join(lrc) + '\n', encoding='utf-8')
    temporary.replace(lrc_path)
    text_path.write_text('\n'.join(
        f'[{stamp(line["start"])} --> {stamp(line["end"])}] {line["text"]}' for line in lines
    ) + '\n', encoding='utf-8')
    def srt_stamp(seconds):
        ticks = max(0, round(seconds * 1000))
        return f'{ticks // 3600000:02d}:{ticks // 60000 % 60:02d}:{ticks // 1000 % 60:02d},{ticks % 1000:03d}'
    text_path.with_suffix('.srt').write_text('\n\n'.join(
        f'{index}\n{srt_stamp(line["start"])} --> {srt_stamp(line["end"])}\n{line["text"]}'
        for index, line in enumerate(lines, 1)
    ) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cli', type=Path, required=True)
    parser.add_argument('--model', type=Path, required=True)
    parser.add_argument('--ffmpeg', type=Path, required=True)
    parser.add_argument('--dll-dir', type=Path)
    parser.add_argument('--output', type=Path, required=True, help='Raw JSON, SRT and timed TXT outside webroot')
    parser.add_argument('--folder', default='*', help='Playlist folder, e.g. Chill-music')
    parser.add_argument('--track', help='One MP3 filename, otherwise process the folder')
    parser.add_argument('--language', default='vi')
    parser.add_argument('--overwrite', action='store_true')
    parser.add_argument('--allow-cpu', action='store_true')
    parser.add_argument('--temperature-fallback', action='store_true', help='Retry difficult audio at higher temperature')
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    music = root / 'assets' / 'music'
    output = args.output.resolve()
    if output.is_relative_to(root):
        parser.error('--output must be outside public_html')
    if not args.cli.is_file() or not args.model.is_file() or not args.ffmpeg.is_file():
        parser.error('Missing CLI, model or FFmpeg')
    tracks = sorted(music.glob(f'{args.folder}/{args.track or "*.mp3"}'))
    if not tracks:
        parser.error('No MP3 files found')
    environment = dict(os.environ)
    if args.dll_dir:
        environment['PATH'] = str(args.dll_dir.resolve()) + os.pathsep + environment.get('PATH', '')
    report = []
    for index, track in enumerate(tracks, 1):
        lrc = track.with_suffix('.lrc')
        if lrc.exists() and not args.overwrite:
            print(f'[{index}/{len(tracks)}] Existing LRC preserved: {track.name}', flush=True)
            continue
        destination = output / track.parent.name / track.stem
        destination.parent.mkdir(parents=True, exist_ok=True)
        audio = destination.with_suffix('.wav')
        subprocess.run([str(args.ffmpeg.resolve()), '-nostdin', '-y', '-hide_banner', '-loglevel', 'error',
                        '-i', str(track.resolve()), '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', str(audio)], check=True)
        with wave.open(str(audio), 'rb') as recording:
            duration = recording.getnframes() / recording.getframerate()
        command = [str(args.cli.resolve()), '-m', str(args.model.resolve()), '-f', str(audio),
                   '-l', args.language, '-t', '4', '-mc', '0', '-ml', '56', '-sow', '-sns',
                   '-pp', '-oj', '-osrt', '-of', str(destination)]
        if not args.temperature_fallback:
            command.append('-nf')
        print(f'[{index}/{len(tracks)}] Processing {track.parent.name}/{track.name}', flush=True)
        started = time.monotonic()
        with destination.with_suffix('.stdout.log').open('w', encoding='utf-8') as stdout, \
                destination.with_suffix('.engine.log').open('w', encoding='utf-8') as log:
            process = subprocess.Popen(command, stdout=stdout, stderr=subprocess.PIPE,
                                       text=True, encoding='utf-8', errors='replace', env=environment)
            try:
                for message in process.stderr:
                    log.write(message)
                    log.flush()
                    if 'no GPU found' in message and not args.allow_cpu:
                        process.kill()
                        raise RuntimeError('GPU unavailable; stopped instead of silently running a slow CPU job. See engine log.')
                    if 'progress =' in message or 'progress = ' in message:
                        print(message.strip(), flush=True)
                code = process.wait()
                if code:
                    raise RuntimeError(f'Whisper failed ({code}). See {destination.with_suffix(".engine.log")}')
            finally:
                if process.poll() is None:
                    process.kill()
                process.wait()
        payload = json.loads(destination.with_suffix('.json').read_bytes().decode('utf-8', errors='surrogateescape'))
        lines = read_lines(payload, duration)
        if not lines:
            raise RuntimeError(f'No timed speech recognized in {track.name}; no LRC created')
        export(lines, lrc, destination.with_suffix('.txt'), args.model.stem)
        elapsed = round(time.monotonic() - started, 1)
        result = {'track': track.relative_to(music).as_posix(), 'lines': len(lines),
                  'seconds': elapsed, 'lastTimestamp': lines[-1]['end'], 'duration': duration, 'automatic': True,
                  'model': args.model.name}
        report.append(result)
        destination.with_suffix('.summary.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print(f'Done: {len(lines)} timed lines, {elapsed}s, {lrc}', flush=True)
    print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    main()
