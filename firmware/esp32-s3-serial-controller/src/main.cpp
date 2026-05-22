#include <Arduino.h>

// Wire each arcade switch between the GPIO pin and GND.
// The internal pull-up keeps released switches HIGH and pressed switches LOW.
static constexpr int JOY_UP_PIN = 4;
static constexpr int JOY_DOWN_PIN = 5;
static constexpr int JOY_LEFT_PIN = 6;
static constexpr int JOY_RIGHT_PIN = 7;
static constexpr int DASH_BUTTON_PIN = 8;

static constexpr unsigned long BAUD_RATE = 115200;
static constexpr unsigned long REPORT_INTERVAL_MS = 16;

static bool isPressed(int pin) {
  return digitalRead(pin) == LOW;
}

void setup() {
  pinMode(JOY_UP_PIN, INPUT_PULLUP);
  pinMode(JOY_DOWN_PIN, INPUT_PULLUP);
  pinMode(JOY_LEFT_PIN, INPUT_PULLUP);
  pinMode(JOY_RIGHT_PIN, INPUT_PULLUP);
  pinMode(DASH_BUTTON_PIN, INPUT_PULLUP);

  Serial.begin(BAUD_RATE);
  delay(800);
}

void loop() {
  const int x = (isPressed(JOY_RIGHT_PIN) ? 1 : 0) - (isPressed(JOY_LEFT_PIN) ? 1 : 0);
  const int y = (isPressed(JOY_DOWN_PIN) ? 1 : 0) - (isPressed(JOY_UP_PIN) ? 1 : 0);
  const bool dash = isPressed(DASH_BUTTON_PIN);

  Serial.printf("{\"x\":%d,\"y\":%d,\"dash\":%s}\n", x, y, dash ? "true" : "false");
  delay(REPORT_INTERVAL_MS);
}
