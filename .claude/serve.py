import http.server, os
os.chdir('/Users/pedrodelascarreras/Desktop/FinanzasApp')
http.server.test(HandlerClass=http.server.SimpleHTTPRequestHandler, port=3000, bind='127.0.0.1')
