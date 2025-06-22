import hashlib

CHUNK_SIZE = 64 * 1024

def split_file(filepath):
    chunks = []
    with open(filepath, 'rb') as f:
        while data := f.read(CHUNK_SIZE):
            chunks.append(data)
    return chunks

def merge_chunks(chunks, output_path):
    with open(output_path, 'wb') as f:
        for chunk in chunks:
            f.write(chunk)

def hash_chunk(chunk):
    return hashlib.sha256(chunk).hexdigest()
