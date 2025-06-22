# Start tracker:
python tracker.py

# Seed a file on one peer:
python peer.py --peer_address=localhost:8001 --tracker_url=http://localhost:5000 --seed_file=somefile.zip --file_id=FILE123

# Download the file on another peer:
python peer.py --peer_address=localhost:8002 --tracker_url=http://localhost:5000 --download_file_id=FILE123 --output_path=downloaded.zip

# Once you have a tracker and a peer seeding a file:
python client.py --tracker_url http://localhost:5000 --file_id FILE123 --output_path newfile.zip

# Start a seed:
python seed.py --peer_address=localhost:8001 --tracker_url=http://localhost:5000 --file_path=somefile.zip --file_id=FILE123

# Download with the existing client.py:
python client.py --tracker_url=http://localhost:5000 --file_id=FILE123 --output_path=downloaded.zip


