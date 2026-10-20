#include "Buttons.h"
#include <Arduino.h>
#include "ButtonReader.h"
#include "Enums.h"
#include "MinimalHID.h"
#include "Globals.h"
#include "IRTransmit.h"

ButtonReader buttonReader;
IRTransmit irTransmit;

// Pin 18, A0 = UP
// Pin 19, A1 = RIGHT
// Pin 20, A2 = DOWN
// Pin 21, A3 = LEFT

Buttons::Buttons()
{
  // Initialize Button Pins
  buttonReader.init();
}

void Buttons::init()
{
  Gamepad1.begin();
  BootKeyboard.begin();
  SingleConsumer.begin();
}

bool Buttons::checkChanged()
{
  uint16_t now16 = (uint16_t)millis();
  for (uint8_t i = 0; i < 24; i++)
  {
    if (lpState[i] == LP_WAITING)
    {
      uint8_t secs = config.buttonLongPressTime[i];
      if (secs > MAX_LONG_PRESS_SEC) {
        secs = MAX_LONG_PRESS_SEC;
      }
      uint16_t threshold = (uint16_t)secs * 1000U;
      if ((uint16_t)(now16 - lpTimer[i]) >= threshold)
      {
        lpState[i] = LP_FIRED_HOLD;
        sendLongPressAction(i, true);
        config.updateUSB = true;
      }
    }
    else if (lpState[i] == LP_SHORT_PULSE)
    {
      if ((uint16_t)(now16 - lpTimer[i]) >= SHORT_PRESS_PULSE_MS)
      {
        lpState[i] = LP_IDLE;
        lpTimer[i] = 0;
        dispatchButtonEvents(i, false);
        config.updateUSB = true;
      }
    }
  }

  if (config.buttonPressed)
  {
    return true;
  }
  if (buttonReader.update())
  {
    config.buttonPressed = true;
    config.updateUSB = true;
    return true;
  }
  return false;
}

void Buttons::readInputs()
{
  uint8_t buttonPushed = 2; // this is set to notify light show that a button press has happened
  // read shift register values
  if (config.buttonPressed || buttons.numberButtonsPressed > 0)
  {
    for (uint8_t i = 0; i < 24; i++)
    {
      bool currentButtonState = !buttonReader.state(i);
      if (currentButtonState != config.lastButtonState[i])
      {

        if (currentButtonState == 1)
        {
          buttonPushed = 1;
        }
        else if (currentButtonState == 0 && buttonPushed == 2)
        {
          buttonPushed = 0;
        }

        config.lastButtonState[i] = sendButtonPush(i, currentButtonState);
      }

    }
  }
  if (buttonPushed == 1)
  {
    if (config.lightShowState == WAITING_INPUT || config.lightShowState == IN_RANDOM_MODE_WAITING_INPUT)
    {
      config.lightShowState = INPUT_RECEIVED_SET_LIGHTS_HIGH;
    }
  }
  else if (buttonPushed == 0)
  {
    if (config.lightShowState == INPUT_RECEIVED_BUTTON_STILL_PRESSED)
    {
      config.lightShowState = INPUT_RECEIVED_SET_LIGHTS_LOW;
    }
  }
}

bool Buttons::sendButtonPush(unsigned char i, bool currentButtonState)
{
  config.updateUSB = true;

  if (config.buttonKeyDebounce[i] > 0 && currentButtonState == 0)
  {
    if (config.buttonKeyDebounce[i] < config.buttonDebounceCounter)
    {
      config.buttonKeyDebounce[i]++;
      return 1;
    }
    else
    {
      config.buttonKeyDebounce[i] = 1;
      numberButtonsPressed--;
    }
  }
  else if (config.buttonKeyDebounce[i] > 0 && currentButtonState == 1)
  {
    numberButtonsPressed++;
  }

  // Per-input Long Press handling (when enabled, short press fires as a 50ms pulse on release)
  // Product guards: Shift modifier and Night Mode Toggle are incompatible with Long Press.
  // (Night Mode Push Button <32 and mapping 254 remain compatible.)
  bool lpIncompatible =
      (config.shiftButton < 24 && config.shiftButton == i) ||
      (config.nightModeButton >= 32 && config.nightModeButton < 64 &&
       (config.nightModeButton % 32) == i);
  if (i < 24 && config.buttonLongPressTime[i] > 0 && !lpIncompatible)
  {
    if (currentButtonState == 1)
    {
      if (lpState[i] == LP_SHORT_PULSE)
      {
        dispatchButtonEvents(i, false);
      }
      lpState[i] = LP_WAITING;
      lpTimer[i] = (uint16_t)millis();
    }
    else
    {
      if (lpState[i] == LP_FIRED_HOLD)
      {
        sendLongPressAction(i, false);
        lpState[i] = LP_IDLE;
        lpTimer[i] = 0;
      }
      else if (lpState[i] == LP_WAITING)
      {
        dispatchButtonEvents(i, true);
        lpState[i] = LP_SHORT_PULSE;
        lpTimer[i] = (uint16_t)millis();
      }
    }
    return currentButtonState;
  }

  dispatchButtonEvents(i, currentButtonState);
  return currentButtonState;
}

void Buttons::dispatchButtonEvents(unsigned char i, bool currentButtonState)
{
  // Handle shifted buttons (optimize common conditions)
  if (config.shiftButton < 24 && i > 3 && i < 12) {
    bool shiftPressed = config.lastButtonState[config.shiftButton] == 1;
    
    if (!currentButtonState && config.lastButtonState[i + 20] == 1 && !shiftPressed) {
      // Logic for turning the shifted button off if the shift button is released
      sendActualButtonPress(i + 20, currentButtonState);
      config.lastButtonState[i + 20] = currentButtonState;
    }
    
    if (shiftPressed) {
      // Logic for turning the shifted button on if the shift button is depressed
      buttonOffset = i + 20;
      config.lastButtonState[buttonOffset] = currentButtonState;
      sendActualButtonPress(buttonOffset, currentButtonState);
      
      if (!currentButtonState) {
        sendActualButtonPress(i, currentButtonState);
        sendActualButtonPress(buttonOffset, currentButtonState);
      }
    } else {
      buttonOffset = i;
      sendActualButtonPress(buttonOffset, currentButtonState);
    }
  } else {
    buttonOffset = i;
    sendActualButtonPress(buttonOffset, currentButtonState);
  }

  // trigger solenoid or IR command if needed
  for (uint8_t j = 0; j < 4; j++)
  {
    if (config.solenoidButtonMap[j] > 0 && config.solenoidButtonMap[j] - 1 == i)
    {
      if (config.solenoidOutputMap[j] > 0)
      {
        outputs.updateOutput(config.solenoidOutputMap[j] - 1, currentButtonState ? 255 : 0);
      }
    }
  }

  // Trigger IR command on button press (rising edge only).
  // Input marked via irButton and/or buttonRemap == BUTTON_MAP_IR (252).
  if (currentButtonState)
  {
    bool isIrButton = (config.irButton == i) || (i < 32 && config.buttonRemap[i] == BUTTON_MAP_IR);
    if (isIrButton)
    {
      uint8_t irOut = config.irOutputPin;
      if (irOut >= 15)
      {
        for (uint8_t o = 0; o < 15; o++)
        {
          if (config.toySpecialOption[o] == IR)
          {
            irOut = o;
            break;
          }
        }
      }
      if (irOut < 15)
      {
        irTransmit.sendCommand(outputs.outputList[irOut]);
      }
    }
  }
}

static void triggerNightModeFeedback()
{
  lightShow.startNightModeFeedback(config.nightMode);
}

void Buttons::sendLongPressAction(unsigned char i, bool currentButtonState)
{
  unsigned char lpKey = config.buttonLongPressKeyboard[i];
  unsigned char lpBtn = config.buttonLongPressRemap[i];

  // Special option 252: Trigger IR on long-press rising edge
  if (lpBtn == BUTTON_MAP_IR)
  {
    if (currentButtonState)
    {
      uint8_t irOut = config.irOutputPin;
      if (irOut >= 15)
      {
        for (uint8_t o = 0; o < 15; o++)
        {
          if (config.toySpecialOption[o] == IR)
          {
            irOut = o;
            break;
          }
        }
      }
      if (irOut < 15)
      {
        irTransmit.sendCommand(outputs.outputList[irOut]);
      }
    }
    return;
  }

  // Special option 253: Toggle Night Mode on long press
  if (lpBtn == 253)
  {
    if (currentButtonState)
    {
      config.nightMode = !config.nightMode;
      triggerNightModeFeedback();
    }
    return;
  }

  // Special option 254: Toggle Keyboard/Gamepad mode on long press
  if (lpBtn == 254)
  {
    if (currentButtonState && config.disableButtonPressWhenKeyboardEnabled != 2)
    {
      config.disableButtonPressWhenKeyboardEnabled = !config.disableButtonPressWhenKeyboardEnabled;
      lightShow.flashLights();
    }
    return;
  }

  bool hasKeyMapping = lpKey > 0;
  bool hasBtnMapping = (lpBtn >= 1 && lpBtn <= 32);

  // Also support Night Mode if lpBtn matches configured nightModeButton (1..32 -> 0..31)
  if (hasBtnMapping && config.nightModeButton < 64 && (lpBtn - 1) == (config.nightModeButton % 32))
  {
    if (config.nightModeButton < 32)
    {
      config.nightMode = currentButtonState;
      triggerNightModeFeedback();
    }
    else if (currentButtonState)
    {
      config.nightMode = !config.nightMode;
      triggerNightModeFeedback();
    }
    return;
  }

  unsigned char keyboardMode = config.disableButtonPressWhenKeyboardEnabled;

  if (hasKeyMapping && (keyboardMode == 1 || keyboardMode == 2 || !hasBtnMapping))
  {
    processKeyboardAction(lpKey, currentButtonState);
  }

  if (hasBtnMapping && (keyboardMode == 0 || keyboardMode == 2 || !hasKeyMapping))
  {
    if (currentButtonState)
    {
      Gamepad1.press(lpBtn);
    }
    else
    {
      Gamepad1.release(lpBtn);
    }
    config.processedButtonState[lpBtn - 1] = currentButtonState;
    if (lpBtn >= 25 && lpBtn <= 32)
    {
      config.lastButtonState[lpBtn - 1] = currentButtonState;
    }
    for (uint8_t j = 0; j < 4; j++)
    {
      if (config.solenoidButtonMap[j] > 0 && config.solenoidButtonMap[j] == lpBtn && config.solenoidOutputMap[j] > 0)
      {
        outputs.updateOutput(config.solenoidOutputMap[j] - 1, currentButtonState ? 255 : 0);
      }
    }
  }
}

void Buttons::sendActualButtonPress(unsigned char buttonOffset, bool currentButtonState)
{
  // night mode
  // mod 32 so that the button number is always between 0 and 31
  if (config.nightModeButton < 64 && buttonOffset == config.nightModeButton % 32 && !(buttonOffset < 24 && config.buttonLongPressTime[buttonOffset] > 0 && config.buttonLongPressRemap[buttonOffset] == 253))
  {

    if (config.nightModeButton < 32)
    {
      config.nightMode = currentButtonState;
      triggerNightModeFeedback();
    }
    else
    {
      if (currentButtonState == 1)
      {
        config.nightMode = !config.nightMode;
        triggerNightModeFeedback();
      }
    }
    // Don't process this button as a joystick/keyboard press
    return;
  }

  // IR-only mapping: no keyboard/gamepad HID (IR fired in dispatchButtonEvents)
  if (config.buttonRemap[buttonOffset] == BUTTON_MAP_IR)
  {
    return;
  }

  // Short-press KB/Gamepad toggle (same action as long-press remap 254)
  if (config.buttonRemap[buttonOffset] == BUTTON_MAP_KB_TOGGLE)
  {
    if (currentButtonState && config.disableButtonPressWhenKeyboardEnabled != 2)
    {
      config.disableButtonPressWhenKeyboardEnabled = !config.disableButtonPressWhenKeyboardEnabled;
      lightShow.flashLights();
    }
    return;
  }

  unsigned char keyCode = config.buttonKeyboard[config.buttonRemap[buttonOffset] - 1];
  bool hasKeyMapping = keyCode > 0;
  unsigned char keyboardMode = config.disableButtonPressWhenKeyboardEnabled;

  // Mode 1 or 2: send the keyboard key (if one is mapped)
  if (hasKeyMapping && (keyboardMode == 1 || keyboardMode == 2))
  {
    processKeyboardAction(keyCode, currentButtonState == 1);
  }

  // Mode 0 always sends gamepad, mode 2 always sends gamepad in addition to keyboard,
  // and mode 1 falls back to gamepad when there's no keyboard mapping
  if (keyboardMode == 0 || keyboardMode == 2 || !hasKeyMapping)
  {
    if (currentButtonState == 1)
    {
      Gamepad1.press(config.buttonRemap[buttonOffset]);
    }
    else
    {
      Gamepad1.release(config.buttonRemap[buttonOffset]);
    }
  }
  
  // Update processed button state array for SPI/Bluetooth controller
  // This represents the final button state after all shift logic processing
  config.processedButtonState[config.buttonRemap[buttonOffset] -1] = currentButtonState;
}

void Buttons::sendButtonState()
{
  Serial.print(F("B,"));
  for (uint8_t i = 0; i < 32; i++)
  {
    uint8_t state = config.lastButtonState[i];
    if (i < 24 && state && lpState[i] == LP_FIRED_HOLD)
    {
      state = 2;
    }
    Serial.print(state);
    if (i < 31) Serial.print(F(","));
  }
  Serial.print(F("\r\n"));
}
void Buttons::processKeyboardAction(unsigned char keyCode, bool pressed) {
  if (keyCode > 251) {
    handleMediaKey(keyCode, pressed);
  } else {
    if (pressed) {
      BootKeyboard.press(KeyboardKeycode(keyCode));
    } else {
      BootKeyboard.release(KeyboardKeycode(keyCode));
    }
  }
}

void Buttons::handleMediaKey(unsigned char keyCode, bool pressed) {
  if (keyCode == 252) {
    if (pressed) SingleConsumer.press(MEDIA_VOLUME_MUTE);
    else SingleConsumer.release(MEDIA_VOLUME_MUTE);
  } else if (keyCode == 253) {
    if (pressed) SingleConsumer.press(MEDIA_VOLUME_DOWN);
    else SingleConsumer.release(MEDIA_VOLUME_DOWN);
  } else if (keyCode == 254) {
    if (pressed) SingleConsumer.press(MEDIA_VOLUME_UP);
    else SingleConsumer.release(MEDIA_VOLUME_UP);
  }
}
