import base64
import hashlib
import hmac
import importlib.util
import json
import os
from pathlib import Path
import threading
import time
import unittest
from http.server import HTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('caption_function', Path(__file__).resolve().parents[1] / 'api/youtube-captions.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def session(exp=None):
    payload = {'userId': 'test-user', 'exp': exp if exp is not None else time.time() * 1000 + 60_000}
    data = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b'=')
    signature = base64.urlsafe_b64encode(hmac.new(b'test-secret', data, hashlib.sha256).digest()).rstrip(b'=')
    return 'lc_session=' + data.decode() + '.' + signature.decode()


class CaptionFunctionTests(unittest.TestCase):
    def test_auth_rejects_missing_malformed_tampered_and_expired_cookies(self):
        with patch.dict(os.environ, {'APP_SECRET': 'test-secret'}):
            self.assertTrue(module.authenticated(session()))
            for value in ['', 'lc_session=bad', session(1), session() + 'tampered', 'lc_session="unclosed']:
                self.assertFalse(module.authenticated(value))

    def test_http_auth_origin_validation_and_caption_only_response(self):
        with patch.dict(os.environ, {'APP_SECRET': 'test-secret'}), patch.object(module, 'fetch_captions') as fetch:
            server = HTTPServer(('127.0.0.1', 0), module.handler)
            origin = 'http://127.0.0.1:' + str(server.server_port)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            def call(body, cookie='', source=origin):
                request = Request(origin + '/api/youtube-captions', json.dumps(body).encode(), {'Cookie': cookie, 'Origin': source, 'Content-Type': 'application/json'})
                try:
                    with urlopen(request, timeout=3) as response:
                        return response.status, json.load(response)
                except HTTPError as error:
                    return error.code, json.load(error)
            try:
                self.assertEqual(call({'videoId': 'MxkVneD7-HY'})[0], 401)
                self.assertEqual(call({'videoId': 'MxkVneD7-HY'}, session(), 'https://elsewhere.example')[0], 403)
                self.assertEqual(call({'videoId': 'bad'}, session())[0], 400)
                self.assertEqual(call([], session())[0], 400)
                fetch.assert_not_called()
                fetch.return_value = {'vtt': 'WEBVTT', 'automatic': False, 'language': 'en'}
                self.assertEqual(call({'videoId': 'MxkVneD7-HY'}, session()), (200, fetch.return_value))
                fetch.assert_called_once_with('MxkVneD7-HY')
                fetch.return_value = {'error': 'RATE_LIMITED'}
                self.assertEqual(call({'videoId': 'MxkVneD7-HY'}, session())[0], 429)
            finally:
                server.shutdown()
                server.server_close()
                thread.join()


if __name__ == '__main__':
    unittest.main()
