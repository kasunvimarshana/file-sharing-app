import argparse, asyncio
from aiohttp import web, ClientSession
from file_manager import split_file

chunks = []
file_id = None

# Serve a chunk
async def get_piece(request):
    idx = int(request.query['idx'])
    return web.Response(body=chunks[idx])

# Register seeder with tracker
async def register_with_tracker(tracker_url, file_id, peer_address):
    async with ClientSession() as session:
        resp = await session.post(
            f"{tracker_url}/register",
            json={'file_id': file_id, 'peer_address': peer_address}
        )
        if resp.status == 200:
            print(f"[✓] Seeder registered with tracker as {peer_address}")

# Main seeder
async def main(tracker_url, peer_address, file_path, file_id_input):
    global chunks, file_id
    chunks = split_file(file_path)
    file_id = file_id_input

    await register_with_tracker(tracker_url, file_id, peer_address)

    app = web.Application()
    app.router.add_get('/get_piece', get_piece)
    runner = web.AppRunner(app)
    await runner.setup()
    port = int(peer_address.split(':')[1])
    site = web.TCPSite(runner, '0.0.0.0', port)
    await site.start()

    print(f"[✓] Seeder running on {peer_address} for file_id={file_id}")
    while True:
        await asyncio.sleep(60)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--tracker_url', required=True)
    parser.add_argument('--peer_address', required=True)
    parser.add_argument('--file_path', required=True)
    parser.add_argument('--file_id', required=True)
    args = parser.parse_args()

    asyncio.run(main(args.tracker_url, args.peer_address, args.file_path, args.file_id))
