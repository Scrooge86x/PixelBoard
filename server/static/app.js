const IMAGE_WIDTH = 160;
const IMAGE_HEIGHT = 128;

const g_canvas = document.querySelector('canvas');
g_canvas.width = IMAGE_WIDTH;
g_canvas.height = IMAGE_HEIGHT;
const g_ctx = g_canvas.getContext('2d');

const g_brushSizeEl = document.querySelector('#brush-size');
const g_brushSizeValueEl = document.querySelector('#brush-size-value');
const g_colorPickerEl = document.querySelector('#color-picker');

let g_isDrawing = false;

const draw = (e) => {
    const { width, height } = g_canvas.getBoundingClientRect();
    const x = Math.floor((e.offsetX * IMAGE_WIDTH) / width);
    const y = Math.floor((e.offsetY * IMAGE_HEIGHT) / height);

    g_ctx.fillStyle = g_colorPickerEl.value;
    g_ctx.fillRect(
        x,
        y,
        g_brushSizeEl.valueAsNumber,
        g_brushSizeEl.valueAsNumber
    );
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

        e.preventDefault();
        return;
    }
};

document.addEventListener('paste', handlePaste);
document.querySelector('#clear-canvas').addEventListener('click', () => {
    g_ctx.fillStyle = '#000';
    g_ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
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
g_canvas.addEventListener('mouseup', () => {
    g_isDrawing = false;
});
