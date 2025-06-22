import argparse, asyncio
from aiohttp import ClientSession
from file_manager import merge_chunks, hash_chunk

async def get_peers(tracker_url, file_id):
    async with ClientSession() as session:
        resp = await session.get(f"{tracker_url}/peers/{file_id}")
        return await resp.json()

async def get_hashes(peer_address, file_id):
    async with ClientSession() as session:
        resp = await session.get(f"{peer_address}/get_hashes?file_id={file_id}")
        return await resp.json()

async def download_piece(peer_address, file_id, idx):
    async with ClientSession() as session:
        resp = await session.get(f"{peer_address}/get_piece?file_id={file_id}&idx={idx}")
        return await resp.read()

async def download_file(tracker_url, file_id, output_path):
    peers = await get_peers(tracker_url, file_id)
    if not peers:
        raise RuntimeError(f"No peers for {file_id}")
    peer = peers[0]

    # Get hash list & num chunks
    file_hashes = await get_hashes(peer, file_id)
    num_chunks = len(file_hashes)

    # Download all chunks concurrently
    chunks = await asyncio.gather(*[download_piece(peer, file_id, i) for i in range(num_chunks)])

    # Validate
    for i, chunk in enumerate(chunks):
        if hash_chunk(chunk) != file_hashes[i]:
            raise ValueError(f"Hash mismatch on chunk {i}")

    merge_chunks(chunks, output_path)
    print(f"[✓] Downloaded file_id={file_id} to {output_path}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--tracker_url', required=True)
    parser.add_argument('--file_id', required=True)
    parser.add_argument('--output_path', required=True)
    args = parser.parse_args()

    asyncio.run(download_file(args.tracker_url, args.file_id, args.output_path))
