package com.prismnexus.hydrator

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

private const val HYDRATE_PATH = "://hydrate/"

private fun extractReqId(url: String): String? {
  val index = url.indexOf(HYDRATE_PATH)
  if (index == -1) {
    return null
  }
  val reqId = url.substring(index + HYDRATE_PATH.length)
  return reqId.ifEmpty { null }
}

class PrismNexusHydratorModule : Module() {
  private var service: HydratorService? = null

  private fun getService(): HydratorService {
    val existing = service
    if (existing != null) return existing
    val context =
      appContext.reactContext
        ?: HydratorErrors.throwError("NATIVE_MODULE_UNAVAILABLE", "React context unavailable")
    val created = HydratorService(context)
    service = created
    return created
  }

  override fun definition() = ModuleDefinition {
    Name("PrismNexusHydrator")

    Function("isAvailable") {
      true
    }

    Function("extractReqId") { url: String ->
      extractReqId(url)
    }

    AsyncFunction("configure") { options: Map<String, Any?> ->
      val testMode = options["testMode"] as? Boolean ?: false
      val chunkThreshold = (options["chunkThreshold"] as? Number)?.toInt()
      val reassemblyTimeoutMs = (options["reassemblyTimeoutMs"] as? Number)?.toLong()
      getService().configure(testMode, chunkThreshold, reassemblyTimeoutMs)
    }

    AsyncFunction("storePayload") { payload: Map<String, Any?> ->
      getService().storePayloadDictionary(payload)
    }

    AsyncFunction("sealAndStorePayload") { input: Map<String, Any?> ->
      val reqId = input["reqId"] as? String
        ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid seal input")
      val ctx = input["ctx"] as? String
        ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid seal input")
      val state = input["state"]
      val version = (input["version"] as? Number)?.toInt() ?: 1
      val ts = (input["ts"] as? Number)?.toInt() ?: (System.currentTimeMillis() / 1000).toInt()
      getService().sealAndStore(state, reqId, ctx, version, ts)
    }

    AsyncFunction("resolveEnvelope") { @Suppress("UNUSED_PARAMETER") _trigger: String ->
      getService().resolveEnvelope()
    }

    AsyncFunction("purgeExpired") {
      getService().purgeExpired()
    }

    AsyncFunction("inspectStorage") {
      getService().inspectStorage()
    }
  }
}
