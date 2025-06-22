import asyncio
import aiohttp
import argparse
from file_manager import merge_chunks

async def get_peers(tracker_url, file_id):
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{tracker_url}/peers/{file_id}") as resp:
            return await resp.json()

async def download_piece(peer_address, file_id, idx):
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{peer_address}/get_piece?file_id={file_id}&idx={idx}") as resp:
            resp.raise_for_status()
            return await resp.read()

async def download_file(tracker_url, file_id, output_path):
    # Get all peers
    peers = await get_peers(tracker_url, file_id)
    if not peers:
        raise RuntimeError(f"No peers available for file_id={file_id}")

    peer = peers[0]  # simplest: pick the first peer
    print(f"Using peer: {peer}")

    # Get number of chunks from the peer
    num_chunks = await get_num_chunks(peer, file_id)

    # Download chunks concurrently
    chunks = await asyncio.gather(
        *[download_piece(peer, file_id, i) for i in range(num_chunks)]
    )

    merge_chunks(chunks, output_path)
    print(f"File successfully downloaded to {output_path}")

# Helper to get number of chunks
async def get_num_chunks(peer_address, file_id):
    # A simple hack: increment idx until we hit 404
    idx = 0
    async with aiohttp.ClientSession() as session:
        while True:
            resp = await session.get(f"{peer_address}/get_piece?file_id={file_id}&idx={idx}")
            if resp.status == 200:
                idx += 1
            else:
                return idx

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--tracker_url', required=True, help='Tracker service URL')
    parser.add_argument('--file_id', required=True, help='ID of file to download')
    parser.add_argument('--output_path', required=True, help='File to save to')
    args = parser.parse_args()

    asyncio.run(download_file(args.tracker_url, args.file_id, args.output_path))
