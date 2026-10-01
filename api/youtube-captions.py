"""Vercel Python function: authenticated, subtitle-only yt-dlp requests."""
import base64
import hashlib
import hmac
import json
import os
import re
import time
from http.cookies import CookieError, SimpleCookie
from http.server import BaseHTTPRequestHandler

from scripts.fetch_captions import fetch_captions


def authenticated(cookie_header):
    try:
        cookies = SimpleCookie()
        cookies.load(cookie_header or '')
        data, signature = cookies['lc_session'].value.split('.')
        secret = os.environ.get('APP_SECRET') or os.environ.get('APP_PASSWORD') or 'listening-coach-default-secret-key-2026'
        expected = hmac.new(secret.encode(), data.encode(), hashlib.sha256).digest()
        actual = base64.urlsafe_b64decode(signature + '=' * (-len(signature) % 4))
        if not hmac.compare_digest(expected, actual):
            return False
        payload = json.loads(base64.urlsafe_b64decode(data + '=' * (-len(data) % 4)))
        return bool(payload.get('userId')) and isinstance(payload.get('exp'), (int, float)) and payload['exp'] > time.time() * 1000
    except (KeyError, ValueError, TypeError, AttributeError, CookieError):
        return False


class handler(BaseHTTPRequestHandler):
    def send_json(self, status, body):
        encoded = json.dumps(body).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self):
        self.send_json(405, {'error': 'METHOD_NOT_ALLOWED'})

    def do_POST(self):
        if not authenticated(self.headers.get('Cookie')):
            return self.send_json(401, {'error': 'AUTH'})
        origin = self.headers.get('Origin', '')
        host = self.headers.get('Host', '')
        if origin not in ('https://' + host, 'http://' + host):
            return self.send_json(403, {'error': 'FORBIDDEN'})
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length <= 0 or length > 2048:
                return self.send_json(413, {'error': 'REQUEST_TOO_LARGE'})
            body = json.loads(self.rfile.read(length))
            video_id = body.get('videoId') if isinstance(body, dict) else None
            if not isinstance(video_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{11}', video_id):
                return self.send_json(400, {'error': 'INVALID_VIDEO'})
            result = fetch_captions(video_id)
            error = result.get('error')
            return self.send_json(429 if error == 'RATE_LIMITED' else 422 if error else 200, result)
        except (ValueError, TypeError):
            return self.send_json(400, {'error': 'INVALID_REQUEST'})
        except Exception:
            return self.send_json(502, {'error': 'FETCH_FAILED'})

    def log_message(self, *_args):
        pass
