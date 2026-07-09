package com.prismnexus.hydrator

import org.json.JSONObject
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException

object HydratorChunking {
  fun shouldSplit(
    plaintextBytes: Int,
    threshold: Int,
  ): Boolean = plaintextBytes + HydratorConstants.GCM_TAG_BYTES > threshold

  fun plaintextSliceSize(
    plaintextBytes: Int,
    threshold: Int,
  ): Int {
    if (plaintextBytes <= 0) return 0
    if (!shouldSplit(plaintextBytes, threshold)) return plaintextBytes
    return HydratorConstants.CHUNK_SIZE
  }
}

object HydratorReassembly {
  private val worker = Executors.newCachedThreadPool()

  fun decryptAndParse(
    crypto: HydratorCrypto,
    wire: WirePayload,
    timeoutMs: Long,
  ): Any {
    val future =
      worker.submit(
        Callable {
          crypto.verifySignature(wire)
          val plaintext = crypto.decryptChunks(wire.chunks)
          try {
            JSONObject(String(plaintext, Charsets.UTF_8))
          } finally {
            plaintext.fill(0)
          }
        },
      )
    return try {
      future.get(timeoutMs, TimeUnit.MILLISECONDS)
    } catch (_: TimeoutException) {
      future.cancel(true)
      HydratorErrors.throwError(
        "REASSEMBLY_TIMEOUT",
        "Chunk reassembly exceeded ${timeoutMs}ms",
      )
    } catch (error: Exception) {
      val cause = error.cause
      if (cause is Exception) throw cause
      throw error
    }
  }
}
