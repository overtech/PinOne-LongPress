#include "Arduino.h"
#include <Wire.h>
#include "MPU6050.h"

#define MPU6050_ADDR 0x68

uint8_t MPU6050::readReg(uint8_t reg)
{
    _wire->beginTransmission(MPU6050_ADDR);
    _wire->write(reg);
    _wire->endTransmission(false);
    _wire->requestFrom((uint8_t)MPU6050_ADDR, (uint8_t)1);
    return _wire->available() ? _wire->read() : 0;
}

void MPU6050::writeReg(uint8_t reg, uint8_t val)
{
    _wire->beginTransmission(MPU6050_ADDR);
    _wire->write(reg);
    _wire->write(val);
    _wire->endTransmission();
}

void MPU6050::writeRegBits(uint8_t reg, uint8_t bits, uint8_t shift, uint8_t val)
{
    uint8_t regVal = readReg(reg);
    uint8_t mask = ((1 << bits) - 1) << shift;
    regVal &= ~mask;
    regVal |= (val << shift) & mask;
    writeReg(reg, regVal);
}

bool MPU6050::init(TwoWire *wire)
{
    _wire = wire;
    delay(100);
    _wire->begin();
    _wire->beginTransmission(MPU6050_ADDR);
    if (_wire->endTransmission() != 0)
        return false;

    // see register map page 41: reset bit 7 of 0x6B
    writeRegBits(0x6B, 1, 7, 1);
    while ((readReg(0x6B) >> 7) & 1) {
        delay(1);
    }
    delay(100);

    writeReg(0x68, 0x07);
    delay(100);

    config();

    //set accelerometer Range
    setAccelerometerRange(0x00);

    writeReg(0x6B, 0x01);
    delay(100);

    return true;
}

void MPU6050::setAccelerometerRange(unsigned char new_range)
{
    accelRange = new_range;
    writeRegBits(0x1C, 2, 3, new_range);
}

void MPU6050::read(void)
{
    _wire->beginTransmission(MPU6050_ADDR);
    _wire->write(0x3B);
    _wire->endTransmission(false);
    _wire->requestFrom((uint8_t)MPU6050_ADDR, (uint8_t)6);

    uint8_t buffer[6];
    for (uint8_t i = 0; i < 6; i++) {
        buffer[i] = _wire->available() ? _wire->read() : 0;
    }

    rawAccX = (buffer[0] << 8) | buffer[1];
    rawAccY = (buffer[2] << 8) | buffer[3];
    rawAccZ = (buffer[4] << 8) | buffer[5];
}

int MPU6050::getX()
{
    return rawAccX;
}

int MPU6050::getY()
{
    return rawAccY;
}

int MPU6050::getZ()
{
    return rawAccZ;
}

void MPU6050::config()
{
    //set sample rate div
    writeReg(0x19, 0);

    //set filter bandwidth
    writeRegBits(0x1A, 3, 0, 0x06);

    //set highpass filter
    writeRegBits(0x1C, 3, 0, 0x04);
}