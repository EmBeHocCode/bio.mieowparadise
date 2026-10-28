import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('lyrics_export', Path(__file__).resolve().parents[1] / 'deploy/export-music-lyrics.py')
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class ExportTests(unittest.TestCase):
    def test_audio_bounds_and_empty_segments(self):
        rows = [{'offsets': {'from': start, 'to': end}, 'text': text} for start, end, text in [
            (1000, 2000, 'Xin chào'), (3000, 3000, 'Invalid'),
            (4000, 9000, 'Câu cuối'), (10000, 15000, 'Beyond the recording')]]
        self.assertEqual(exporter.read_lines({'transcription': rows}, 5), [
            {'start': 1, 'end': 2, 'text': 'Xin chào'}, {'start': 4, 'end': 5, 'text': 'Câu cuối'}])

    def test_centisecond_carry(self):
        self.assertEqual(exporter.stamp(59.999), '01:00.00')

    def test_incomplete_engine_utf8_in_zero_duration_token(self):
        payload = {'transcription': [
            {'offsets': {'from': 1000, 'to': 1000}, 'text': '\udce1\udcbb'},
            {'offsets': {'from': 1000, 'to': 2000}, 'text': 'Lời hợp lệ'}]}
        self.assertEqual(exporter.read_lines(payload, 3), [{'start': 1, 'end': 2, 'text': 'Lời hợp lệ'}])

    def test_export_preserves_timing_and_marks_instrumental_gaps(self):
        with tempfile.TemporaryDirectory() as directory:
            lrc, txt = Path(directory) / 'song.lrc', Path(directory) / 'song.txt'
            exporter.export([{'start': 1.25, 'end': 3.5, 'text': 'Lời thử'},
                             {'start': 5, 'end': 7, 'text': 'Câu cuối'}], lrc, txt)
            self.assertIn('[00:01.25]Lời thử\n[00:03.50]\n[00:05.00]Câu cuối\n[00:07.00]', lrc.read_text(encoding='utf-8'))
            self.assertIn('[00:01.25 --> 00:03.50] Lời thử', txt.read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
