#include <stdbool.h>
#include <stdio.h>

#include "board.h"
#include "clock_config.h"
#include "fsl_debug_console.h"
#include "lcd.h"
#include "peripherals.h"
#include "pin_mux.h"
#include "wlan_mwm.h"

// Security Modes:
// 0 - Open
// 1 - WEP (Open mode)
// 2 - WEP (Shared mode)
// 3 - WPA-PSK
// 4 - WPA2-PSK
// 9 - WPA3-SAE
typedef struct {
    char* ssid;
    char* password;
    char* securityMode;
} WifiConfig;

WifiConfig g_wifiConfig = {
    .ssid = "MY_SSID",
    .password = "MY_PASSWORD",
    .securityMode = "4",
};

mwm_sockaddr_t g_sockaddr = {
    .host = "10.112.191.202",
    .port = 80,
};

const char* const g_path = "/data";

#define STR_BUFFER_LEN 128
#define CDE_BUFFER_LEN 64

char g_bufferRX[RXD_BUFFER_LEN] = { 0 };

#ifndef MSEC_TO_TICK
#define MSEC_TO_TICK(msec) ((uint32_t)(msec) * (uint32_t)configTICK_RATE_HZ / 1000uL)
#endif

typedef struct {
    char data[256];
    size_t length;
} HttpRequest;

typedef enum {
    HTTP_OK = 0,
    HTTP_ERR_SOCKET = -1,
    HTTP_ERR_CONNECT = -2,
    HTTP_ERR_SEND = -3,
    HTTP_ERR_RECEIVE = -4,
    HTTP_ERR_TIMEOUT = -5,
    HTTP_ERR_INVALID = -6,
} HttpError;

HttpError httpGetBinary(
    mwm_sockaddr_t* const sockaddr,
    HttpRequest* const request,
    uint8_t* const out,
    const int maxLen,
    int* const bytesReceived)
{
    if (!sockaddr || !request || !out || !bytesReceived || maxLen <= 0) {
        return HTTP_ERR_INVALID;
    }

    const int socket = mwm_socket(MWM_TCP);
    if (socket < 0) {
        return HTTP_ERR_CONNECT;
    }

    if (mwm_connect(socket, sockaddr, sizeof(*sockaddr)) != 0) {
        mwm_close(socket);
        return HTTP_ERR_CONNECT;
    }

    if (mwm_send(socket, request->data, request->length) < 0) {
        mwm_close(socket);
        return HTTP_ERR_SEND;
    }

    bool headerDone = false;
    memset(g_bufferRX, 0, sizeof(g_bufferRX));

    while (*bytesReceived < maxLen) {
        int n = mwm_recv_timeout(socket, g_bufferRX, sizeof(g_bufferRX), 3000);
        if (n <= 0) {
            mwm_close(socket);
            return (n < 0) ? HTTP_ERR_RECEIVE : HTTP_OK;
        }

        int offset = 0;
        if (!headerDone) {
            char* p = strstr(g_bufferRX, "\r\n\r\n");
            if (p) {
                offset = (p + 4) - g_bufferRX;
                headerDone = true;
            } else {
                continue;
            }
        }

        int copyLen = n - offset;
        if (*bytesReceived + copyLen > maxLen) {
            copyLen = maxLen - *bytesReceived;
        }

        memcpy(&out[*bytesReceived], &g_bufferRX[offset], copyLen);
        *bytesReceived += copyLen;
    }

    mwm_close(socket);
    return HTTP_OK;
}

void mainTask(void* pvParameters)
{
    PRINTF("Initializing...\r\n");

    if (mwm_init() < 0) {
        while (true) {
        }
    }

    if (wlan_get_state() == MWM_INITIALIZED && mwm_wlan_start() < 0) {
        while (true) {
        }
    }

    LCD_Puts(10, 25, "Connecting...", Font_7x10, 0xff00);
    LCD_GramRefresh();

    wlan_config(g_wifiConfig.ssid, g_wifiConfig.password, g_wifiConfig.securityMode);
    while (wlan_get_state() != MWM_CONNECTED) {
        vTaskDelay(MSEC_TO_TICK(500));
    }

    wlan_state();

    HttpRequest httpRequest;
    snprintf(httpRequest.data, sizeof(httpRequest.data),
        "GET %s HTTP/1.1\r\n"
        "Host: %s\r\n"
        "Connection: close\r\n\r\n",
        g_path, g_sockaddr.host);
    httpRequest.length = strlen(httpRequest.data);

    const int expected = LCD_WIDTH * LCD_HEIGHT * 2;

    while (true) {
        int received = 0;
        HttpError result = httpGetBinary(&g_sockaddr, &httpRequest, (uint8_t*)frameBuffer, expected, &received);
        if (result != HTTP_OK) {
            PRINTF("HTTP ERROR: %d\r\n", result);
            vTaskDelay(MSEC_TO_TICK(2000));
            continue;
        }

        if (received != expected) {
            PRINTF("INVALID DATA LENGTH DETECTED: %d\r\n", received);
            vTaskDelay(MSEC_TO_TICK(2000));
            continue;
        }

        LCD_Set_Bitmap((uint16_t*)frameBuffer);
        LCD_GramRefresh();
        vTaskDelay(MSEC_TO_TICK(1000));
    }
}

int main(void)
{
    BOARD_InitBootPins();
    BOARD_InitBootClocks();
    BOARD_InitBootPeripherals();
#ifndef BOARD_INIT_DEBUG_CONSOLE_PERIPHERAL
    BOARD_InitDebugConsole();
#endif

    LCD_Init(LP_FLEXCOMM0_PERIPHERAL);
    LCD_Clear(0x00);
    LCD_Puts(10, 10, "Initializing...", Font_7x10, 0xff00);
    LCD_GramRefresh();

    if (xTaskCreate(mainTask, "mainTask", 1024, NULL, MAIN_TASK_PRIORITY, NULL) != pdPASS) {
        PRINTF("Task creation failed!.\r\n");
        while (true) {
        }
    }

    vTaskStartScheduler();
    while (true) {
    }
    return 0;
}
