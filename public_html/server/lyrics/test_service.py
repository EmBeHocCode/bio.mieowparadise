import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from service import Lyrics, lyric_lines


class LyricsCacheTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.base = Path(self.temporary.name)
        self.music = self.base / 'music'
        self.track = self.music / 'Chill-music' / 'song.mp3'
        self.track.parent.mkdir(parents=True)
        self.track.write_bytes(b'test audio')
        with patch.object(Lyrics, 'work', return_value=None):
            self.service = Lyrics({'music_root': str(self.music), 'state_dir': str(self.base / 'cache'),
                                   'model': 'small', 'languages_by_folder': {'Chill-music': 'vi'}})

    def tearDown(self):
        self.service.stopping.set()
        self.temporary.cleanup()

    def test_only_existing_tracks_inside_music_root(self):
        for name in ('../secret.mp3', '/etc/passwd', 'Chill-music/../../secret.mp3',
                     'Chill-music/song.php', 'Chill-music\\song.mp3', '.hidden/song.mp3'):
            with self.subTest(name=name), self.assertRaises((ValueError, FileNotFoundError)):
                self.service.identify(name)
        with self.assertRaises(FileNotFoundError):
            self.service.identify('Chill-music/missing.mp3')
        self.assertEqual(self.service.identify('Chill-music/song.mp3')[2], 'vi')

    def test_concurrent_requests_share_one_persistent_job(self):
        first = self.service.get('Chill-music/song.mp3')
        for _ in range(20):
            self.assertEqual(self.service.get('Chill-music/song.mp3')['id'], first['id'])
        self.assertEqual(self.service.jobs.qsize(), 1)
        ready = {**first, 'status': 'ready', 'lines': [{'start': 1, 'end': 2, 'text': 'Tiếng Việt'}]}
        self.service.write(first['id'], ready)
        self.assertEqual(self.service.get('Chill-music/song.mp3')['lines'][0]['text'], 'Tiếng Việt')
        self.assertEqual(self.service.jobs.qsize(), 1)
        self.assertTrue(json.loads((self.base / 'cache' / f'{first["id"]}.json').read_text(encoding='utf-8')))

    def test_changed_audio_gets_a_new_cache_identity(self):
        before = self.service.identify('Chill-music/song.mp3')[0]
        self.track.write_bytes(b'different audio recording')
        self.assertNotEqual(self.service.identify('Chill-music/song.mp3')[0], before)

    def test_display_lines_keep_original_word_times(self):
        words = [SimpleNamespace(start=i, end=i+.5, word=f' từ{i}') for i in range(12)]
        lines = lyric_lines(SimpleNamespace(words=words))
        self.assertGreater(len(lines), 1)
        self.assertEqual(lines[0]['start'], 0)
        self.assertEqual(lines[-1]['end'], 11.5)
        self.assertEqual(' '.join(line['text'] for line in lines), ' '.join(word.word.strip() for word in words))


if __name__ == '__main__':
    unittest.main()
