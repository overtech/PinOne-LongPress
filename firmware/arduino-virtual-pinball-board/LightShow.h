#ifndef LIGHTSHOW_H
#define LIGHTSHOW_H
#include <Arduino.h>
#include "Config.h"
#include "Outputs.h"


class LightShow {
  
  public:
    LightShow();
    void init();
    void setLightsNormal();
    void incrementRandom();
    void setLightsRandom();
    void setLightsHigh();
    void checkSetLights();
    void setLightsOff();
    // Starts a non-blocking 3x flash (100ms on / 100ms off). Advance via updateFeedback().
    void flashLights();
    // Flash, then optional left/right solenoid chirp when leaving night mode.
    void startNightModeFeedback(bool nightModeEnabled);
    void updateFeedback();
    
  private:
    uint32_t timeInState;
    uint8_t outputValues[63] = {0};
    uint8_t outputDirection[63] = {0};
    uint8_t startLight = 0;
    uint8_t finishLight = 0;
    uint8_t incrementor = 5;

    uint8_t currentStartLight = 0;
    uint8_t currentFinishLight = 0;
    bool doneSettingLights = true;
    void setStartFinishLoops();
    bool isLightShowOutput(int i);
    bool isMediumLight(int i);
    void transitionToState(uint8_t newState, uint32_t currentTime);
    void updateLightValue(uint8_t i, uint8_t value);
    void setFlashLightsOn();
    void beginFlashSequence(bool withSolenoidChirp);
    uint32_t lightShowStartTime = 10000;

    // Non-blocking feedback: 0=idle, 1=flash, 2=sol0 on, 3=sol gap, 4=sol1 on
    uint8_t feedbackPhase = 0;
    uint8_t flashCycle = 0;
    uint8_t flashSub = 0; // 0=lights on, 1=lights off
    uint32_t feedbackTimer = 0;
    bool feedbackSolenoids = false;
};

#endif
