"""Launch the adjacent deployment's public directory on a stable loopback origin."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser
import json

root = Path(__file__).resolve().parent / 'public'
if not (root / 'index.html').is_file():
    raise SystemExit('Run this launcher from the extracted deployment folder.')

policy_file = root.parent / 'firebase.json'
security_headers = []
if policy_file.is_file():
    for rule in json.loads(policy_file.read_text()).get('hosting', {}).get('headers', []):
        if rule.get('source') == '/**':
            security_headers = rule.get('headers', [])

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        for header in security_headers:
            self.send_header(header['key'], header['value'])
        super().end_headers()

try:
    server = ThreadingHTTPServer(('127.0.0.1', 8765), partial(Handler, directory=str(root)))
except OSError as error:
    raise SystemExit('Could not start the local app. Close any previous Study Director launcher and try again.\n' + str(error))

url = 'http://127.0.0.1:8765/'
print('Study Director: ' + url, flush=True)
print('Keep this window open while using the local app. Press Ctrl+C to stop.', flush=True)
print('Localhost and the hosted app keep separate browser data.', flush=True)
webbrowser.open(url)
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
