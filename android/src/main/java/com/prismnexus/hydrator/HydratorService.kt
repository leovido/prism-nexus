package com.prismnexus.hydrator

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.util.Collections

class HydratorService(
  context: Context,
) {
  private val storage = HydratorStorage(context)
  private var testMode = false
  private var chunkThreshold = HydratorConstants.CHUNK_THRESHOLD
  private var reassemblyTimeoutMs = HydratorConstants.REASSEMBLY_TIMEOUT_MS
  private val crypto = HydratorCrypto(context) { testMode }
  private val inFlight = Collections.synchronizedSet(mutableSetOf<String>())

  fun configure(
    testMode: Boolean,
    chunkThreshold: Int? = null,
    reassemblyTimeoutMs: Long? = null,
  ) {
    this.testMode = testMode
    if (chunkThreshold != null && chunkThreshold > 0) {
      this.chunkThreshold = chunkThreshold
    }
    if (reassemblyTimeoutMs != null && reassemblyTimeoutMs > 0) {
      this.reassemblyTimeoutMs = reassemblyTimeoutMs
    }
  }

  fun storePayloadDictionary(payload: Map<String, Any?>) {
    val wire = parseWirePayload(payload)
    storeWirePayload(wire)
  }

  fun sealAndStore(
    state: Any?,
    reqId: String,
    ctx: String,
    version: Int,
    ts: Int,
  ): Map<String, Any?> {
    if (!testMode) {
      HydratorErrors.throwError("MALFORMED_PAYLOAD", "sealAndStorePayload requires testMode")
    }
    val stateBytes =
      when (state) {
        is Map<*, *> -> {
          @Suppress("UNCHECKED_CAST")
          JSONObject(state as Map<String, Any?>).toString().toByteArray(Charsets.UTF_8)
        }
        else -> (JSONObject.wrap(state) ?: JSONObject()).toString().toByteArray(Charsets.UTF_8)
      }
    val wire = crypto.seal(stateBytes, reqId, version, ts, ctx, chunkThreshold)
    storeWirePayload(wire)
    return wire.toDictionary()
  }

  fun resolveEnvelope(): Map<String, Any?>? {
    storage.purgeExpired(testMode, inFlightSnapshot())
    val reqIds = storage.listReqIds().reversed()
    for (reqId in reqIds) {
      if (!inFlight.add(reqId)) continue
      try {
        val envelope = resolveSingle(reqId)
        if (envelope != null) return envelope
      } catch (error: Exception) {
        storage.remove(reqId)
        throw error
      } finally {
        inFlight.remove(reqId)
      }
    }
    return null
  }

  fun purgeExpired(): Int = storage.purgeExpired(testMode, inFlightSnapshot())

  fun inspectStorage(): Map<String, Any?> {
    val (stored, cached) = storage.inspect(testMode)
    return mapOf("stored" to stored, "cached" to cached)
  }

  private fun resolveSingle(reqId: String): Map<String, Any?>? {
    val loaded = storage.load(reqId) ?: return null
    val (payloadData, meta) = loaded
    if (storage.isExpired(meta, testMode)) {
      storage.remove(reqId)
      HydratorErrors.throwError("TTL_EXPIRED", "Hydration payload expired")
    }
    val json = JSONObject(String(payloadData, Charsets.UTF_8))
    val wire = parseWirePayload(jsonToMap(json))
    if (wire.reqId != reqId) {
      HydratorErrors.throwError("MALFORMED_PAYLOAD", "reqId mismatch")
    }
    val stateJson =
      HydratorReassembly.decryptAndParse(crypto, wire, reassemblyTimeoutMs) as JSONObject
    val state = jsonToValue(stateJson)
    storage.remove(reqId)
    return mapOf(
      "reqId" to wire.reqId,
      "claims" to
        mapOf(
          "v" to wire.v,
          "ts" to wire.ts,
          "ctx" to wire.ctx,
          "kid" to wire.kid,
        ),
      "state" to state,
    )
  }

  private fun storeWirePayload(wire: WirePayload) {
    val projected = wire.toDictionary()
    val payloadData = JSONObject(projected).toString().toByteArray(Charsets.UTF_8)
    if (storage.totalBytes() + payloadData.size > HydratorConstants.MAX_STORAGE_BYTES) {
      HydratorErrors.throwError("STORAGE_QUOTA_EXCEEDED", "Native hydrator storage quota exceeded")
    }
    storage.store(wire.reqId, payloadData)
  }

  private fun parseWirePayload(dict: Map<String, Any?>): WirePayload {
    val reqId = dict["reqId"] as? String
      ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid wire payload shape")
    val v = (dict["v"] as? Number)?.toInt()
      ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid wire payload shape")
    val ts = (dict["ts"] as? Number)?.toInt()
      ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid wire payload shape")
    val ctx = dict["ctx"] as? String
      ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid wire payload shape")
    val kid = dict["kid"] as? String
      ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid wire payload shape")
    val sig = dict["sig"] as? String
      ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid wire payload shape")
    val rawChunks = dict["chunks"] as? List<*>
      ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid wire payload shape")
    val chunks =
      rawChunks.map { item ->
        val chunk = item as? Map<*, *>
          ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid wire chunk shape")
        WireChunk(
          seq = (chunk["seq"] as? Number)?.toInt()
            ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid wire chunk shape"),
          size = (chunk["size"] as? Number)?.toInt()
            ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid wire chunk shape"),
          iv = chunk["iv"] as? String
            ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid wire chunk shape"),
          hmac = chunk["hmac"] as? String
            ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid wire chunk shape"),
          data = chunk["data"] as? String
            ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid wire chunk shape"),
        )
      }
    return WirePayload(reqId, v, ts, ctx, kid, sig, chunks)
  }

  private fun jsonToMap(json: JSONObject): Map<String, Any?> {
    val map = mutableMapOf<String, Any?>()
    val keys = json.keys()
    while (keys.hasNext()) {
      val key = keys.next()
      map[key] = jsonToValue(json.get(key))
    }
    return map
  }

  private fun jsonToValue(value: Any?): Any? =
    when (value) {
      is JSONObject -> jsonToMap(value)
      is JSONArray -> (0 until value.length()).map { index -> jsonToValue(value.get(index)) }
      JSONObject.NULL -> null
      else -> value
    }

  private fun WirePayload.toDictionary(): Map<String, Any?> =
    mapOf(
      "reqId" to reqId,
      "v" to v,
      "ts" to ts,
      "ctx" to ctx,
      "kid" to kid,
      "sig" to sig,
      "chunks" to
        chunks.map { chunk ->
          mapOf(
            "seq" to chunk.seq,
            "size" to chunk.size,
            "iv" to chunk.iv,
            "hmac" to chunk.hmac,
            "data" to chunk.data,
          )
        },
    )

  private fun inFlightSnapshot(): Set<String> =
    synchronized(inFlight) {
      inFlight.toSet()
    }
}
