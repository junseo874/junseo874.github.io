#!/usr/bin/env python3
"""개발용 정적 서버 — 캐시 없음 (js/css 수정이 즉시 반영). 사용: python3 serve.py [포트=8123]"""
import http.server, sys, json, secrets, subprocess, shutil, threading
from functools import partial
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
TOKEN = secrets.token_urlsafe(32)
SAVE_LOCK = threading.Lock()
NODE = shutil.which('node') or str(Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def editor_response(self, value, status=200):
        data = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def editor_host_ok(self):
        return self.headers.get('Host') in (f'127.0.0.1:{PORT}', f'localhost:{PORT}')

    def editor_run(self, payload=None, runtime=False):
        args = [NODE, str(ROOT / 'tools/dialogue-editor-storage.cjs')]
        if payload is None:
            args.append('--runtime' if runtime else '--snapshot')
        result = subprocess.run(args, input=payload, text=True, capture_output=True, timeout=60, cwd=ROOT)
        if result.returncode:
            raise ValueError(result.stderr or 'CSV 처리에 실패했습니다.')
        return json.loads(result.stdout)

    def do_GET(self):
        endpoint = self.path.split('?')[0]
        if endpoint not in ('/api/dialogue-editor', '/api/dialogue-editor/runtime'):
            return super().do_GET()
        if not self.editor_host_ok():
            return self.editor_response({'error': '로컬 주소만 허용합니다.'}, 403)
        try:
            with SAVE_LOCK:
                value = self.editor_run(runtime=endpoint.endswith('/runtime'))
            self.editor_response(value if endpoint.endswith('/runtime') else {**value, 'token': TOKEN, 'mode': 'local-csv'})
        except Exception as error:
            self.editor_response({'error': str(error)}, 500)

    def do_POST(self):
        if self.path != '/api/dialogue-editor':
            return self.editor_response({'error': '지원하지 않는 경로'}, 404)
        origin = self.headers.get('Origin')
        if not self.editor_host_ok() or origin != 'http://' + self.headers.get('Host', '') or self.headers.get('X-Editor-Token') != TOKEN:
            return self.editor_response({'error': '저장 요청의 출처를 확인할 수 없습니다.'}, 403)
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if size <= 0 or size > 8 * 1024 * 1024 or self.headers.get('Content-Type') != 'application/json':
                return self.editor_response({'error': '올바르지 않은 요청 크기/형식'}, 400)
            payload = self.rfile.read(size).decode('utf-8')
            with SAVE_LOCK:
                value = self.editor_run(payload)
            self.editor_response(value)
        except Exception as error:
            self.editor_response({'error': str(error)}, 409)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *a):
        pass


ROOT = Path(__file__).resolve().parent
print(f"L.U.N.A lobby: http://127.0.0.1:{PORT}/", flush=True)
print(f"Bar playtest: http://127.0.0.1:{PORT}/bar-playtest/", flush=True)
http.server.ThreadingHTTPServer(("127.0.0.1", PORT), partial(NoCacheHandler, directory=str(ROOT))).serve_forever()
