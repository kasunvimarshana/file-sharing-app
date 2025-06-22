import argparse, asyncio
from aiohttp import ClientSession
from file_manager import merge_chunks

# Fetch peer list
async def get_peers(tracker_url, file_id):
    async with ClientSession() as session:
        resp = await session.get(f"{tracker_url}/peers/{file_id}")
        return await resp.json()

# Get number of chunks
async def get_num_chunks(peer_address, file_id):
    async with ClientSession() as session:
        idx = 0
        while True:
            resp = await session.get(f"{peer_address}/get_piece?file_id={file_id}&idx={idx}")
            if resp.status == 200:
                idx += 1
            else:
                return idx

# Fetch one chunk
async def download_piece(peer_address, file_id, idx):
    async with ClientSession() as session:
        resp = await session.get(f"{peer_address}/get_piece?file_id={file_id}&idx={idx}")
        return await resp.read()

# Main client
async def main(tracker_url, file_id, output_path):
    peers = await get_peers(tracker_url, file_id)
    if not peers:
        raise RuntimeError(f"No peers found for file_id={file_id}")

    peer = peers[0]
    num_chunks = await get_num_chunks(peer, file_id)
    print(f"[✓] Found {num_chunks} chunks on {peer}")

    chunks = await asyncio.gather(*[download_piece(peer, file_id, i) for i in range(num_chunks)])
    merge_chunks(chunks, output_path)
    print(f"[✓] Download completed -> {output_path}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--tracker_url', required=True)
    parser.add_argument('--file_id', required=True)
    parser.add_argument('--output_path', required=True)
    args = parser.parse_args()

    asyncio.run(main(args.tracker_url, args.file_id, args.output_path))
