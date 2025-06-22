# Start tracker:
python tracker.py

# Start a seeder:
python seed.py --tracker_url http://localhost:5000 --peer_address localhost:8001 --file_path somefile.zip --file_id FILE123

# Download file with client:
python client.py --tracker_url http://localhost:5000 --file_id FILE123 --output_path output.zip
