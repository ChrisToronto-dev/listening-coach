"""Fetch English subtitles only. No media downloads, cookies, login or user profiles."""
import json
import re
import sys
import yt_dlp

class QuietLogger:
    def debug(self, message): pass
    def warning(self, message): pass
    def error(self, message): pass

try:
    video_id = sys.argv[1]
    if not re.fullmatch(r'[A-Za-z0-9_-]{11}', video_id):
        raise ValueError('INVALID_VIDEO')
    options = {
        'skip_download': True, 'noplaylist': True, 'quiet': True,
        'no_warnings': True, 'logger': QuietLogger(), 'socket_timeout': 15,
        'retries': 0, 'extractor_retries': 0, 'cachedir': False,
        'js_runtimes': {'node': {}},
    }
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info('https://www.youtube.com/watch?v=' + video_id, download=False)
        chosen = None
        for field, automatic in [('subtitles', False), ('automatic_captions', True)]:
            tracks = info.get(field) or {}
            languages = sorted((k for k in tracks if k == 'en' or k.startswith('en-')),
                               key=lambda k: (k != 'en-orig', k != 'en', k))
            for language in languages:
                entry = next((x for x in tracks[language] if x.get('ext') == 'vtt'), None)
                if entry:
                    chosen = (entry, language, automatic)
                    break
            if chosen:
                break
        if not chosen:
            print(json.dumps({'error': 'NO_ENGLISH_CAPTIONS'}))
            sys.exit(0)
        entry, language, automatic = chosen
        # The URL comes only from the official video's extracted caption metadata.
        with ydl.urlopen(entry['url']) as response:
            content = response.read(2_000_001)
        if len(content) > 2_000_000:
            raise ValueError('CAPTIONS_TOO_LARGE')
        print(json.dumps({'vtt': content.decode('utf-8'), 'automatic': automatic,
                          'language': language, 'title': info.get('title', '')}))
except Exception as exc:
    message = str(exc).lower()
    kind = ('RATE_LIMITED' if '429' in message or 'too many' in message else
            'LOGIN_REQUIRED' if 'sign in' in message or 'private' in message or 'age' in message else
            'VIDEO_UNAVAILABLE' if 'unavailable' in message or 'not available' in message else
            'FETCH_FAILED')
    print(json.dumps({'error': kind}))
