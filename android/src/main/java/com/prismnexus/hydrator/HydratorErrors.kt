package com.prismnexus.hydrator

import expo.modules.kotlin.exception.CodedException

object HydratorErrors {
  fun throwError(code: String, message: String): Nothing {
    throw CodedException(code, message)
  }
}
