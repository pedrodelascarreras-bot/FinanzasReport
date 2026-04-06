import http.server, os
os.chdir('/Users/pedrodelascarreras/Desktop/FinanzasApp')
port = int(os.environ.get('PORT', 3000))
http.server.test(HandlerClass=http.server.SimpleHTTPRequestHandler, port=port, bind='127.0.0.1')
