#ifndef MPU6050_H
#define MPU6050_H

#include "Arduino.h"
#include <Wire.h>

class MPU6050 {
  
  public:

    bool init(TwoWire *wire = &Wire);
    void setAccelerometerRange(unsigned char);
    void read();
    int getX();
    int getY();
    int getZ();
    void config();

  private:
    int rawAccX, rawAccY, rawAccZ;
    int accelRange = 0;
    TwoWire *_wire = &Wire;
    uint8_t readReg(uint8_t reg);
    void writeReg(uint8_t reg, uint8_t val);
    void writeRegBits(uint8_t reg, uint8_t bits, uint8_t shift, uint8_t val);
};


#endif