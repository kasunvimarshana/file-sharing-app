Generate SSL Certificates (one-time setup):

openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes


Start the Server:

python server/server_main.py


Start the Client:

python client/client_main.py localhost 50000
