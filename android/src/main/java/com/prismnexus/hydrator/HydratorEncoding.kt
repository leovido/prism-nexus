package com.prismnexus.hydrator

import android.util.Base64
import java.security.MessageDigest

object HydratorEncoding {
  fun base64ToBytes(value: String): ByteArray? =
    try {
      Base64.decode(value, Base64.DEFAULT)
    } catch (_: IllegalArgumentException) {
      null
    }

  fun base64UrlToBytes(value: String): ByteArray? {
    var base64 = value.replace('-', '+').replace('_', '/')
    val padding = (4 - (base64.length % 4)) % 4
    base64 += "=".repeat(padding)
    return try {
      Base64.decode(base64, Base64.DEFAULT)
    } catch (_: IllegalArgumentException) {
      null
    }
  }

  fun bytesToBase64(data: ByteArray): String = Base64.encodeToString(data, Base64.NO_WRAP)

  fun bytesToBase64Url(data: ByteArray): String =
    Base64.encodeToString(data, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)

  fun sha256Hex(data: ByteArray): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(data)
    return digest.joinToString("") { byte -> "%02x".format(byte) }
  }

  fun sha256HexFromUtf8(value: String): String = sha256Hex(value.toByteArray(Charsets.UTF_8))
}
