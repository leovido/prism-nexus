package com.prismnexus

import com.facebook.react.bridge.ReactApplicationContext

class PrismNexusModule(reactContext: ReactApplicationContext) :
  NativePrismNexusSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativePrismNexusSpec.NAME
  }
}
