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

/**
 * Expo Modules bridge for the hydrator native layer.
 *
 * Phase 2 will add secure ephemeral storage, AES-GCM decryption, Ed25519
 * signature verification, TTL enforcement, and async chunk reassembly.
 */
class PrismNexusHydratorModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("PrismNexusHydrator")

    Function("isAvailable") {
      true
    }

    Function("extractReqId") { url: String ->
      extractReqId(url)
    }

    // Scaffold: returns null until the secure store pipeline is implemented.
    AsyncFunction("resolveEnvelope") { @Suppress("UNUSED_PARAMETER") _trigger: String ->
      null
    }

    AsyncFunction("purgeExpired") {
      0
    }

    AsyncFunction("inspectStorage") {
      mapOf(
        "stored" to emptyList<String>(),
        "cached" to 0,
      )
    }
  }
}
