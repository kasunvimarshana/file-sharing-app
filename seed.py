import argparse, asyncio
from aiohttp import web, ClientSession
from file_manager import split_file, hash_chunk

chunks = []
hashes = []
file_id = None

async def get_piece(request):
    idx = int(request.query['idx'])
    return web.Response(body=chunks[idx])

async def get_hashes(request):
    return web.json_response(hashes)

async def register(tracker_url, file_id, peer_address):
    async with ClientSession() as session:
        await session.post(
            f"{tracker_url}/register",
            json={'file_id': file_id, 'peer_address': peer_address}
        )

async def main(tracker_url, peer_address, file_path, file_id_input):
    global chunks, file_id, hashes
    chunks = split_file(file_path)
    hashes = [hash_chunk(c) for c in chunks]
    file_id = file_id_input

    await register(tracker_url, file_id, peer_address)
    app = web.Application()
    app.router.add_get('/get_piece', get_piece)
    app.router.add_get('/get_hashes', get_hashes)

    runner = web.AppRunner(app)
    await runner.setup()
    port = int(peer_address.split(':')[1])
    await web.TCPSite(runner, '0.0.0.0', port).start()
    print(f"[✓] Seeder {peer_address} hosting file_id={file_id}")
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
