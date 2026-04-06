#!/bin/bash
cd /Users/pedrodelascarreras/Desktop/FinanzasApp
python3 -c "
import http.server, os, sys
port = int(os.environ.get('PORT', 8080))
handler = http.server.SimpleHTTPRequestHandler
httpd = http.server.HTTPServer(('127.0.0.1', port), handler)
print(f'Serving on http://127.0.0.1:{port}')
sys.stdout.flush()
httpd.serve_forever()
"
