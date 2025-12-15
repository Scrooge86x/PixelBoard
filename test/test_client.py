import requests
from PIL import Image, ImageTk
import tkinter as tk

IMAGE_WIDTH = 160
IMAGE_HEIGHT = 128
BYTES_PER_PIXEL = 2
IMAGE_BYTES = IMAGE_WIDTH * IMAGE_HEIGHT * BYTES_PER_PIXEL
SCALE_FACTOR = 4

root = tk.Tk()
root.title("PixelBoard")
root.resizable(False, False)

label = tk.Label(root)
label.pack()


def rgb565_to_image(buf):
    image = Image.new("RGB", (IMAGE_WIDTH, IMAGE_HEIGHT))
    pixels = image.load()

    i = 0
    for y in range(IMAGE_HEIGHT):
        for x in range(IMAGE_WIDTH):
            rgb565 = buf[i + 1] << 8 | buf[i]
            i += 2

            r = int((rgb565 >> 11) * 255 / 31)
            g = int(((rgb565 >> 5) & 0b111111) * 255 / 63)
            b = int((rgb565 & 0b11111) * 255 / 31)

            pixels[x, y] = (r, g, b)

    return image


def fetch_frame():
    r = requests.get("http://127.0.0.1:80/data")
    if r.status_code != 200:
        print("Server error:", r.status_code)
        root.after(200, fetch_frame)
        return

    data = r.content
    if len(data) != IMAGE_BYTES:
        print("Wrong size:", len(data))
        root.after(200, fetch_frame)
        return

    image = rgb565_to_image(data)
    tk_image = ImageTk.PhotoImage(
        image.resize(
            (IMAGE_WIDTH * SCALE_FACTOR, IMAGE_HEIGHT * SCALE_FACTOR), Image.NEAREST
        )
    )

    label.img_ref = tk_image
    label.config(image=tk_image)

    root.after(200, fetch_frame)


root.attributes("-topmost", True)
root.after(100, fetch_frame)
root.mainloop()
