import asyncio
import aiohttp
from aiohttp import web
import argparse
import os

from file_manager import split_file, merge_chunks

chunks = []
file_id = None

# Serve chunks
async def get_piece(request):
    idx = int(request.query['idx'])
    return web.Response(body=chunks[idx])

# Register file with tracker
async def register_with_tracker(tracker_url, file_id, peer_address):
    async with aiohttp.ClientSession() as session:
        await session.post(
            f"{tracker_url}/register",
            json={'file_id': file_id, 'peer_address': peer_address}
        )

# Fetch list of peers
async def get_peers(tracker_url, file_id):
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{tracker_url}/peers/{file_id}") as resp:
            return await resp.json()

# Download chunks from peers
async def download_piece(peer_address, file_id, idx):
    async with aiohttp.ClientSession() as session:
        async with session.get(f"{peer_address}/get_piece?file_id={file_id}&idx={idx}") as resp:
            return await resp.read()

# CLI to run peer in seed or leecher mode
async def main(peer_address, tracker_url, file_path=None, file_id_input=None, output_path=None):
    global chunks, file_id
    if file_path:
        chunks = split_file(file_path)
        file_id = file_id_input
        await register_with_tracker(tracker_url, file_id, peer_address)
        print(f"Seeding {file_id} on {peer_address}")

    # Start peer server
    app = web.Application()
    app.router.add_get('/get_piece', get_piece)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host='0.0.0.0', port=int(peer_address.split(':')[1]))
    await site.start()

    # Download file if output_path specified
    if output_path:
        peer_list = await get_peers(tracker_url, file_id_input)
        chunks = await asyncio.gather(
            *[download_piece(peer, file_id_input, i) for i in range(len(peer_list))]
        )
        merge_chunks(chunks, output_path)
        print(f"File saved to {output_path}")

    # Keep peer alive
    while True:
        await asyncio.sleep(60)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--peer_address', required=True)
    parser.add_argument('--tracker_url', required=True)
    parser.add_argument('--seed_file', help='File to seed')
    parser.add_argument('--file_id', help='File ID')
    parser.add_argument('--download_file_id', help='File ID to download')
    parser.add_argument('--output_path', help='Path to save file')
    args = parser.parse_args()

    asyncio.run(
        main(
            peer_address=args.peer_address,
            tracker_url=args.tracker_url,
            file_path=args.seed_file,
            file_id_input=args.file_id,
            output_path=args.output_path
        )
    )
