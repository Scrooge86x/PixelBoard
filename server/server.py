from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import asyncio

IMAGE_WIDTH = 160
IMAGE_HEIGHT = 128
BYTES_PER_PIXEL = 2
IMAGE_BYTES = IMAGE_WIDTH * IMAGE_HEIGHT * BYTES_PER_PIXEL

current_image = bytearray(IMAGE_BYTES)
lock = asyncio.Lock()
clients: set[WebSocket] = set()

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def index():
    return FileResponse("static/index.html")


@app.websocket("/ws")
async def websocket(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    async with lock:
        await ws.send_bytes(current_image)

    try:
        while True:
            data = await ws.receive_bytes()
            if not data:
                continue

            if len(data) == IMAGE_BYTES:
                async with lock:
                    current_image[:] = data

                for c in clients:
                    if c is not ws:
                        await c.send_bytes(data)
    except WebSocketDisconnect:
        pass
    finally:
        clients.discard(ws)
