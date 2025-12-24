# PixelBoard

## Project structure
### [firmware/](firmware/)
NXP FRDM-MCXN947 firmware that uses http GET polling to update the image it's displaying on a plugged in LCD display

### [server/](server/)
python server with websocket support for browser clients and GET /data endpoint for the board

### [test/](test/)
test client that uses the GET /data endpoint like the board would do

## Features
- realtime updates between browser clients using websockets
- pasting images from the clipboard (auto scaling is applied to make the image fit)
- support for rgb565 LCD displays

https://github.com/user-attachments/assets/e09b7962-2037-42ec-9a17-0088fa0f05eb
