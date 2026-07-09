package com.prismnexus.hydrator

object HydratorConstants {
  const val TTL_SECONDS = 300L
  const val TTL_MS = 300_000L
  const val MAX_STORAGE_BYTES = 50 * 1024 * 1024
  const val KID_V1 = "v1"
  const val CACHE_DIR_NAME = "Hydrator"
  const val CHUNK_SIZE = 4096
  const val CHUNK_THRESHOLD = 20 * 1024
  const val GCM_TAG_BYTES = 16
  const val REASSEMBLY_TIMEOUT_MS = 30_000L
  const val AES_KEY_ALIAS = "com.prismnexus.hydrator.aes.v1"
  const val ED25519_PREFS = "com.prismnexus.hydrator.ed25519.v1"
}
