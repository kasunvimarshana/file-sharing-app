from flask import Flask, request, jsonify

app = Flask(__name__)
files_to_peers = {}

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    file_id, peer_address = data['file_id'], data['peer_address']
    files_to_peers.setdefault(file_id, set()).add(peer_address)
    return jsonify(status='ok')

@app.route('/peers/<file_id>')
def list_peers(file_id):
    return jsonify(list(files_to_peers.get(file_id, [])))

if __name__ == '__main__':
    app.run(port=5000)
