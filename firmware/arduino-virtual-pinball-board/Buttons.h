#ifndef BUTTON_H
#define BUTTON_H
#include <Arduino.h>
#include "Config.h"
#include "Outputs.h"


class Buttons {

  public:
    Buttons();
    void readInputs();
    bool checkChanged();
    unsigned char numberButtonsPressed = 0;
    void init();
    void sendButtonState();
    bool sendButtonPush(unsigned char i, bool currentButtonState);


  private:
    unsigned char buttonOffset = 0;
    static const uint8_t LP_IDLE = 0;
    static const uint8_t LP_WAITING = 1;
    static const uint8_t LP_FIRED_HOLD = 2;
    static const uint8_t LP_SHORT_PULSE = 3;
    static const uint16_t SHORT_PRESS_PULSE_MS = 50;

    uint8_t lpState[24] = {0};
    uint16_t lpTimer[24] = {0};

    void dispatchButtonEvents(unsigned char i, bool currentButtonState);
    void sendLongPressAction(unsigned char i, bool currentButtonState);
    void sendActualButtonPress(unsigned char buttonOffset, bool currentButtonState);
    void handleMediaKey(unsigned char keyCode, bool pressed);
    void processKeyboardAction(unsigned char keyCode, bool pressed);
};

#endif
