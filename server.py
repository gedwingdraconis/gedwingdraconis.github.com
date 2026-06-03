#!/usr/bin/env python3
"""
Servidor local para el CV - maneja subida/eliminación de cursos.
Uso: python server.py
Luego abre http://localhost:8080
"""

import http.server
import json
import os
import base64
import shutil
import mimetypes
import urllib.parse

CURSOS_DIR = "cursos"
SECRET_KEY = "ZeroSagara89.*"
PORT = 8080

os.makedirs(CURSOS_DIR, exist_ok=True)

class CVHandler(http.server.SimpleHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        content_len = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_len)

        if self.path == "/api/upload":
            self._handle_upload(body)
        elif self.path == "/api/delete":
            self._handle_delete(body)
        elif self.path == "/api/delete-folder":
            self._handle_delete_folder(body)
        else:
            self.send_error(404)

    def do_GET(self):
        if self.path == "/api/cursos":
            self._handle_list()
        else:
            super().do_GET()

    def _read_json(self, body):
        return json.loads(body.decode("utf-8"))

    def _send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))

    def _handle_upload(self, body):
        try:
            data = self._read_json(body)
            if data.get("key") != SECRET_KEY:
                self._send_json({"error": "Clave incorrecta"}, 403)
                return

            institution = data.get("institution", "").strip()
            if not institution:
                self._send_json({"error": "Institución requerida"}, 400)
                return

            file_data = data.get("data", "")
            file_name = data.get("fileName", "archivo")
            file_type = data.get("type", "")

            safe_name = "".join(c for c in institution if c.isalnum() or c in " _-").strip()
            if not safe_name:
                safe_name = "SinInstitucion"
            folder_path = os.path.join(CURSOS_DIR, safe_name)
            os.makedirs(folder_path, exist_ok=True)

            ext = ".png" if file_type == "image/png" else ".pdf"
            base_name = file_name.rsplit(".", 1)[0] if "." in file_name else file_name
            file_path = os.path.join(folder_path, base_name + ext)

            counter = 1
            while os.path.exists(file_path):
                file_path = os.path.join(folder_path, f"{base_name}_{counter}{ext}")
                counter += 1

            raw = base64.b64decode(file_data)
            with open(file_path, "wb") as f:
                f.write(raw)

            self._send_json({"ok": True, "path": file_path})
        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    def _handle_list(self):
        try:
            result = []
            if not os.path.isdir(CURSOS_DIR):
                self._send_json(result)
                return

            for folder in sorted(os.listdir(CURSOS_DIR)):
                folder_path = os.path.join(CURSOS_DIR, folder)
                if not os.path.isdir(folder_path):
                    continue
                files = []
                for fname in sorted(os.listdir(folder_path)):
                    fpath = os.path.join(folder_path, fname)
                    if os.path.isfile(fpath):
                        with open(fpath, "rb") as f:
                            b64 = base64.b64encode(f.read()).decode("utf-8")
                        mime = mimetypes.guess_type(fname)[0] or "application/octet-stream"
                        files.append({
                            "fileName": fname,
                            "type": mime,
                            "data": b64
                        })
                if files:
                    result.append({
                        "institution": folder,
                        "files": files
                    })
            self._send_json(result)
        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    def _handle_delete(self, body):
        try:
            data = self._read_json(body)
            if data.get("key") != SECRET_KEY:
                self._send_json({"error": "Clave incorrecta"}, 403)
                return

            institution = data.get("institution", "").strip()
            safe_name = "".join(c for c in institution if c.isalnum() or c in " _-").strip()
            folder_path = os.path.join(CURSOS_DIR, safe_name)

            if os.path.isdir(folder_path):
                shutil.rmtree(folder_path)
                self._send_json({"ok": True})
            else:
                self._send_json({"error": "Carpeta no encontrada"}, 404)
        except Exception as e:
            self._send_json({"error": str(e)}, 500)

    def _handle_delete_folder(self, body):
        self._handle_delete(body)


if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", PORT), CVHandler)
    print(f"Servidor iniciado en http://localhost:{PORT}")
    print("Presiona Ctrl+C para detenerlo.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
        server.server_close()
