#!/usr/bin/env python3
"""개발용 정적 서버 — 캐시 없음 (js/css 수정이 즉시 반영). 사용: python3 serve.py [포트=8123]"""
import http.server, sys
from functools import partial
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
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
