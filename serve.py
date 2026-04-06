import http.server, os, sys
port = int(os.environ.get('PORT', 3000))
os.chdir('/Users/pedrodelascarreras/Desktop/FinanzasApp')
handler = http.server.SimpleHTTPRequestHandler
httpd = http.server.HTTPServer(('127.0.0.1', port), handler)
sys.stdout.write('Serving on http://127.0.0.1:{}\n'.format(port))
sys.stdout.flush()
httpd.serve_forever()
