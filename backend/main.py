import asyncio
import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from sleep_classifier import SleepClassifier

USE_REAL = os.getenv('MUSE_REAL', '').lower() in ('1', 'true', 'yes')

if USE_REAL:
    from real_stream import RealMuseStream
    stream = RealMuseStream(address=os.getenv('MUSE_ADDRESS') or None)
    print("[muse] Mode: REAL headset")
else:
    from mock_stream import MockMuseStream
    stream = MockMuseStream()
    print("[muse] Mode: MOCK stream")

clients: set[WebSocket] = set()
classifier = SleepClassifier(window_size=10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(broadcast_loop())
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    clients.add(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        clients.discard(ws)
    except Exception:
        clients.discard(ws)


async def broadcast_loop():
    async for packet in stream.stream():
        packet['sleep_state'] = classifier.classify(packet['bands'])
        packet['sleep_description'] = classifier.description(packet['sleep_state'])
        payload = json.dumps(packet)
        dead: set[WebSocket] = set()
        for ws in list(clients):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.add(ws)
        clients.difference_update(dead)


@app.get("/health")
def health():
    return {"status": "ok", "clients": len(clients), "mode": "real" if USE_REAL else "mock"}
