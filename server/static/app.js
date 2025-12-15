const IMAGE_WIDTH = 160;
const IMAGE_HEIGHT = 128;
const BYTES_PER_PIXEL = 2;

const g_currentImage = new Uint8Array(
    IMAGE_WIDTH * IMAGE_HEIGHT * BYTES_PER_PIXEL
);

const g_canvas = document.querySelector('canvas');
g_canvas.width = IMAGE_WIDTH;
g_canvas.height = IMAGE_HEIGHT;
const g_ctx = g_canvas.getContext('2d', { willReadFrequently: true });

const g_ws = new WebSocket(
    `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`
);
g_ws.binaryType = 'arraybuffer';

const g_brushSizeEl = document.querySelector('#brush-size');
const g_brushSizeValueEl = document.querySelector('#brush-size-value');
const g_colorPickerEl = document.querySelector('#color-picker');
const g_connectionStatusEl = document.getElementById('connection-status');

let g_isDrawing = false;

const wsSend = (data) => {
    if (g_ws.readyState === WebSocket.OPEN) {
        g_ws.send(data);
    }
};

const currentImageToCanvas = () => {
    const image = g_ctx.createImageData(IMAGE_WIDTH, IMAGE_HEIGHT);
    const { data } = image;

    for (let i = 0, j = 0; i < g_currentImage.length; i += 2, j += 4) {
        const rgb565 = (g_currentImage[i + 1] << 8) | g_currentImage[i];
        data[j] = ((rgb565 >> 11) * 255) / 31;
        data[j + 1] = (((rgb565 >> 5) & 0b111111) * 255) / 63;
        data[j + 2] = ((rgb565 & 0b11111) * 255) / 31;
        data[j + 3] = 255;
    }

    g_ctx.putImageData(image, 0, 0);
};

const rgbToRgb565 = (r, g, b) =>
    ((r & 0b11111000) << 8) | ((g & 0b11111100) << 3) | (b >> 3);

const canvasToCurrentImage = () => {
    const { data } = g_ctx.getImageData(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

    for (let i = 0, j = 0; i < data.length; i += 4, j += 2) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const rgb565 = rgbToRgb565(r, g, b);

        g_currentImage[j] = rgb565 & 0xff;
        g_currentImage[j + 1] = rgb565 >> 8;
    }
};

const draw = (e) => {
    const { width, height } = g_canvas.getBoundingClientRect();
    const x = Math.floor((e.offsetX * IMAGE_WIDTH) / width);
    const y = Math.floor((e.offsetY * IMAGE_HEIGHT) / height);
    const brushSize = g_brushSizeEl.valueAsNumber;

    g_ctx.fillStyle = g_colorPickerEl.value;
    g_ctx.fillRect(x, y, brushSize, brushSize);

    const diffs = [];
    const { data } = g_ctx.getImageData(x, y, brushSize, brushSize);
    for (let dy = 0; dy < brushSize; ++dy) {
        for (let dx = 0; dx < brushSize; ++dx) {
            const px = x + dx;
            const py = y + dy;
            if (px < 0 || px >= IMAGE_WIDTH || py < 0 || py >= IMAGE_HEIGHT) {
                continue;
            }

            const idx = py * IMAGE_WIDTH + px;
            const offset = (dy * brushSize + dx) * 4;

            const rgb565 = rgbToRgb565(
                data[offset],
                data[offset + 1],
                data[offset + 2]
            );

            diffs.push(
                idx & 0xff,
                (idx >> 8) & 0xff,
                rgb565 & 0xff,
                rgb565 >> 8
            );
            g_currentImage[idx * 2] = rgb565 & 0xff;
            g_currentImage[idx * 2 + 1] = rgb565 >> 8;
        }
    }

    wsSend(new Uint8Array(diffs));
};

const handlePaste = async (e) => {
    for (const item of e.clipboardData.items) {
        if (!item.type.includes('image')) {
            continue;
        }

        const image = await createImageBitmap(item.getAsFile());
        const { width, height } = image;

        const scale = Math.min(IMAGE_WIDTH / width, IMAGE_HEIGHT / height);
        const scaledWidth = width * scale;
        const scaledHeight = height * scale;

        g_ctx.fillStyle = '#000';
        g_ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
        g_ctx.drawImage(
            image,
            (IMAGE_WIDTH - scaledWidth) / 2,
            (IMAGE_HEIGHT - scaledHeight) / 2,
            scaledWidth,
            scaledHeight
        );

        canvasToCurrentImage();
        wsSend(g_currentImage);

        e.preventDefault();
        return;
    }
};

document.addEventListener('paste', handlePaste);
document.querySelector('#clear-canvas').addEventListener('click', () => {
    g_ctx.fillStyle = '#000';
    g_ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
    canvasToCurrentImage();
    wsSend(g_currentImage);
});

g_brushSizeEl.addEventListener('input', () => {
    g_brushSizeValueEl.textContent = g_brushSizeEl.value;
});

g_canvas.addEventListener('mousemove', (e) => {
    if (g_isDrawing) {
        draw(e);
    }
});
g_canvas.addEventListener('mousedown', (e) => {
    g_isDrawing = true;
    draw(e);
});
document.addEventListener('mouseup', () => {
    g_isDrawing = false;
});

g_ws.addEventListener(
    'open',
    () => (g_connectionStatusEl.textContent = 'Connected')
);
g_ws.addEventListener(
    'close',
    () => (g_connectionStatusEl.textContent = 'Disconnected')
);
g_ws.addEventListener(
    'error',
    () => (g_connectionStatusEl.textContent = 'Error')
);
g_ws.addEventListener('message', (e) => {
    const data = new Uint8Array(e.data);
    if (data.length === g_currentImage.length) {
        g_currentImage.set(data);
        currentImageToCanvas();
        return;
    }

    for (let i = 0; i < data.length; i += 4) {
        const idx = data[i] | (data[i + 1] << 8);
        g_currentImage[idx * 2] = data[i + 2];
        g_currentImage[idx * 2 + 1] = data[i + 3];
    }
    currentImageToCanvas();
});
