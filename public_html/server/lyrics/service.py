"""Local MP3 -> timed lyrics. One low-priority worker; shared, atomic JSON cache."""
import argparse
import gc
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import logging
from pathlib import Path, PurePosixPath
import queue
import threading
import time
from urllib.parse import parse_qs, urlsplit

LOG = logging.getLogger('bio-lyrics')
REVISION = 'small-int8-lines-v3'


def lyric_lines(segment):
    """Keep the model's actual word times; split long segments into readable lines."""
    words = getattr(segment, 'words', None) or []
    if not words:
        text = ' '.join(segment.text.split())
        return [{'start': round(segment.start, 3), 'end': round(segment.end, 3), 'text': text}] if text else []
    lines, group = [], []
    for word in words:
        text = word.word.strip()
        if not text or word.end <= word.start:
            continue
        group.append(word)
        sentence = ' '.join(w.word.strip() for w in group)
        if len(group) >= 8 or len(sentence) >= 52 or word.end - group[0].start >= 5 or (len(group) >= 4 and text.endswith(('.', '?', '!'))):
            lines.append({'start': round(group[0].start, 3), 'end': round(word.end, 3), 'text': sentence})
            group = []
    if group:
        lines.append({'start': round(group[0].start, 3), 'end': round(group[-1].end, 3), 'text': ' '.join(w.word.strip() for w in group)})
    return lines


class Lyrics:
    def __init__(self, config):
        self.config = config
        self.music = Path(config['music_root'])
        self.state = Path(config['state_dir'])
        self.state.mkdir(parents=True, exist_ok=True)
        self.jobs = queue.Queue(maxsize=32)
        self.lock = threading.RLock()
        self.active = set()
        self.stopping = threading.Event()
        self.worker = threading.Thread(target=self.work, name='transcriber', daemon=True)
        self.worker.start()

    def identify(self, track):
        if not isinstance(track, str) or len(track) > 500 or '\\' in track or '\x00' in track:
            raise ValueError('Invalid track')
        relative = PurePosixPath(track)
        if relative.is_absolute() or len(relative.parts) != 2 or any(part.startswith('.') for part in relative.parts) or relative.suffix.lower() != '.mp3':
            raise ValueError('Invalid track')
        music_root = self.music.resolve()
        path = (music_root / relative).resolve()
        if not path.is_relative_to(music_root) or not path.is_file():
            raise FileNotFoundError('Track not found')
        stat = path.stat()
        if stat.st_size > 200 * 1024 * 1024:
            raise ValueError('Track too large')
        language = self.config.get('languages_by_folder', {}).get(relative.parts[0])
        identity = f'{REVISION}:{self.config["model"]}:{language}:{relative}:{stat.st_size}:{stat.st_mtime_ns}'
        key = hashlib.sha256(identity.encode()).hexdigest()
        return key, path, language

    def read(self, key):
        try:
            return json.loads((self.state / f'{key}.json').read_text(encoding='utf-8'))
        except (OSError, ValueError):
            return None

    def write(self, key, data):
        data['updatedAt'] = int(time.time())
        temporary = self.state / f'{key}.next'
        temporary.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        temporary.replace(self.state / f'{key}.json')

    def get(self, track):
        key, path, language = self.identify(track)
        with self.lock:
            data = self.read(key)
            if data and (data['status'] in ('ready', 'empty') or (data['status'] == 'error' and time.time() - data['updatedAt'] < 3600)):
                return data
            if key not in self.active:
                if self.jobs.full():
                    return {'status': 'busy', 'lines': [], 'retryAfter': 15}
                data = {'status': 'queued', 'id': key, 'track': track, 'lines': [], 'progress': 0, 'automatic': True}
                self.write(key, data)
                self.active.add(key)
                self.jobs.put_nowait((key, path, language, track))
            return data or {'status': 'queued', 'lines': []}

    def work(self):
        model = None
        last_job = time.monotonic()
        while not self.stopping.is_set():
            try:
                key, path, language, track = self.jobs.get(timeout=10)
            except queue.Empty:
                if model is not None and time.monotonic() - last_job > 120:
                    model = None
                    gc.collect()
                continue
            data = self.read(key) or {}
            try:
                data.update(status='processing', stage='loading', lines=[], progress=0)
                self.write(key, data)
                if model is None:
                    from faster_whisper import WhisperModel
                    model = WhisperModel(self.config['model'], device='cpu', compute_type='int8',
                                         cpu_threads=self.config.get('threads', 1), num_workers=1,
                                         download_root=self.config['model_dir'])
                if self.identify(track)[0] != key:
                    raise ValueError('Track changed during processing')
                LOG.info('Transcribing %s', track)
                segments, info = model.transcribe(str(path), language=language, beam_size=5,
                                                  word_timestamps=True, condition_on_previous_text=False,
                                                  vad_filter=False)
                if info.duration > 3600:
                    raise ValueError('Track exceeds one hour')
                data.update(duration=round(info.duration, 3), language=info.language, stage='transcribing')
                last_write = 0
                for segment in segments:
                    if segment.no_speech_prob > .85 and segment.avg_logprob < -.8:
                        continue
                    for line in lyric_lines(segment):
                        if data['lines']:
                            line['start'] = max(line['start'], data['lines'][-1]['end'])
                        if line['end'] > line['start']:
                            data['lines'].append(line)
                    data['progress'] = min(99, int(segment.end / max(info.duration, 1) * 100))
                    if time.monotonic() - last_write >= 3:
                        self.write(key, data)
                        last_write = time.monotonic()
                data.update(status='ready' if data['lines'] else 'empty', progress=100)
                self.write(key, data)
                LOG.info('Finished %s: %s lines', track, len(data['lines']))
            except Exception:
                LOG.exception('Transcription failed for %s', track)
                data.update(status='error', lines=[], error='recognition_failed', retryAfter=3600)
                self.write(key, data)
                model = None
                gc.collect()
            finally:
                with self.lock:
                    self.active.discard(key)
                self.jobs.task_done()
                last_job = time.monotonic()


class Handler(BaseHTTPRequestHandler):
    server_version = 'BioLyrics'

    def do_GET(self):
        request = urlsplit(self.path)
        if request.path == '/health':
            return self.send_json({'status': 'ok'})
        if request.path != '/api/lyrics':
            return self.send_json({'status': 'not_found'}, 404)
        try:
            query = parse_qs(request.query, max_num_fields=4)
            tracks = query.get('track', [])
            if len(tracks) != 1:
                raise ValueError('One track is required')
            data = self.server.lyrics.get(tracks[0])
            self.send_json(data)
        except FileNotFoundError:
            self.send_json({'status': 'not_found', 'lines': []}, 404)
        except ValueError:
            self.send_json({'status': 'invalid_track', 'lines': []}, 400)
        except Exception:
            LOG.exception('Lyrics request failed')
            self.send_json({'status': 'unavailable', 'lines': []}, 503)

    def send_json(self, data, status=200):
        body = json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, *_):
        pass


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', required=True)
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text(encoding='utf-8'))
    logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('httpx2').setLevel(logging.WARNING)
    server = ThreadingHTTPServer(('127.0.0.1', config.get('port', 3014)), Handler)
    server.daemon_threads = True
    server.lyrics = Lyrics(config)
    try:
        server.serve_forever()
    finally:
        server.lyrics.stopping.set()
        server.server_close()


if __name__ == '__main__':
    main()
