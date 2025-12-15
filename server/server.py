from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

IMAGE_WIDTH = 160
IMAGE_HEIGHT = 128
BYTES_PER_PIXEL = 2
IMAGE_BYTES = IMAGE_WIDTH * IMAGE_HEIGHT * BYTES_PER_PIXEL

current_image = bytearray(IMAGE_BYTES)

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
async def index():
    return FileResponse("static/index.html")


@app.websocket("/ws")
async def websocket(ws: WebSocket):
    await ws.accept()
    await ws.send_bytes(current_image)

    try:
        while True:
            data = await ws.receive_bytes()
            if not data:
                continue

            if len(data) == IMAGE_BYTES:
                current_image[:] = data
    except WebSocketDisconnect:
        pass
