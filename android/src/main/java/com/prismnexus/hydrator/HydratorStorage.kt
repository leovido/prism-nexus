package com.prismnexus.hydrator

import android.content.Context
import androidx.security.crypto.EncryptedFile
import androidx.security.crypto.MasterKey
import org.json.JSONObject
import java.io.File

data class StoredPayloadMeta(
  val storedAtMonotonicMs: Long,
)

class HydratorStorage(
  private val context: Context,
) {
  private val cacheDirectory: File =
    File(context.cacheDir, HydratorConstants.CACHE_DIR_NAME).apply { mkdirs() }
  private val masterKey =
    MasterKey.Builder(context)
      .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
      .build()

  fun store(
    reqId: String,
    payload: ByteArray,
  ) {
    val payloadFile = payloadFile(reqId)
    val metaFile = metaFile(reqId)
    val monotonicMs = currentMonotonicMs()
    val meta = JSONObject().put("storedAtMonotonicMs", monotonicMs)
    writeEncrypted(payloadFile, payload)
    writeEncrypted(metaFile, meta.toString().toByteArray(Charsets.UTF_8))
  }

  fun load(reqId: String): Pair<ByteArray, StoredPayloadMeta>? {
    val payloadFile = payloadFile(reqId)
    val metaFile = metaFile(reqId)
    if (!payloadFile.exists() || !metaFile.exists()) {
      return null
    }
    val payload = readEncrypted(payloadFile)
    val metaJson = JSONObject(String(readEncrypted(metaFile), Charsets.UTF_8))
    val meta = StoredPayloadMeta(storedAtMonotonicMs = metaJson.getLong("storedAtMonotonicMs"))
    return payload to meta
  }

  fun remove(reqId: String) {
    payloadFile(reqId).delete()
    metaFile(reqId).delete()
  }

  fun listReqIds(): List<String> =
    cacheDirectory.listFiles()
      ?.filter { it.isFile && it.name.endsWith(".json") && !it.name.endsWith(".meta.json") }
      ?.map { it.name.removeSuffix(".json") }
      ?.sorted()
      ?: emptyList()

  fun totalBytes(): Int =
    cacheDirectory.listFiles()?.sumOf { it.length().toInt() } ?: 0

  fun purgeExpired(
    testMode: Boolean,
    excluding: Set<String> = emptySet(),
  ): Int {
    if (testMode) return 0
    var removed = 0
    val now = currentMonotonicMs()
    for (reqId in listReqIds()) {
      if (reqId in excluding) continue
      val meta = load(reqId)?.second ?: continue
      if (now - meta.storedAtMonotonicMs > HydratorConstants.TTL_MS) {
        remove(reqId)
        removed += 1
      }
    }
    return removed
  }

  fun inspect(testMode: Boolean): Pair<List<String>, Int> {
    val ids = listReqIds()
    if (testMode) return ids to ids.size
    val now = currentMonotonicMs()
    val live =
      ids.count { reqId ->
        val meta = load(reqId)?.second ?: return@count false
        now - meta.storedAtMonotonicMs <= HydratorConstants.TTL_MS
      }
    return ids to live
  }

  fun isExpired(
    meta: StoredPayloadMeta,
    testMode: Boolean,
  ): Boolean {
    if (testMode) return false
    val now = currentMonotonicMs()
    return now - meta.storedAtMonotonicMs > HydratorConstants.TTL_MS
  }

  private fun payloadFile(reqId: String): File = File(cacheDirectory, "$reqId.json")

  private fun metaFile(reqId: String): File = File(cacheDirectory, "$reqId.meta.json")

  private fun currentMonotonicMs(): Long = android.os.SystemClock.elapsedRealtime()

  private fun writeEncrypted(
    file: File,
    bytes: ByteArray,
  ) {
    if (file.exists()) file.delete()
    val encryptedFile =
      EncryptedFile.Builder(
        context,
        file,
        masterKey,
        EncryptedFile.FileEncryptionScheme.AES256_GCM_HKDF_4KB,
      ).build()
    encryptedFile.openFileOutput().use { stream -> stream.write(bytes) }
  }

  private fun readEncrypted(file: File): ByteArray {
    val encryptedFile =
      EncryptedFile.Builder(
        context,
        file,
        masterKey,
        EncryptedFile.FileEncryptionScheme.AES256_GCM_HKDF_4KB,
      ).build()
    return encryptedFile.openFileInput().use { stream -> stream.readBytes() }
  }
}
