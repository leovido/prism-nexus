package com.prismnexus.hydrator

import android.content.Context
import java.security.Signature
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec

data class WireChunk(
  val seq: Int,
  val size: Int,
  val iv: String,
  val hmac: String,
  val data: String,
)

data class WirePayload(
  val reqId: String,
  val v: Int,
  val ts: Int,
  val ctx: String,
  val kid: String,
  val sig: String,
  val chunks: List<WireChunk>,
)

class HydratorCrypto(
  context: Context,
  allowSoftwareKeys: () -> Boolean,
) {
  private val keys = HydratorKeyManager(context, allowSoftwareKeys)

  fun computeChunksHmac(chunks: List<WireChunk>): String {
    val joined = chunks.sortedBy { it.seq }.joinToString("") { it.hmac }
    return HydratorEncoding.sha256HexFromUtf8(joined)
  }

  fun buildSignatureMessage(payload: WirePayload): String {
    val chunksHmac = computeChunksHmac(payload.chunks)
    return "${payload.v}|${payload.ts}|${payload.ctx}|${payload.kid}|$chunksHmac"
  }

  fun verifySignature(payload: WirePayload) {
    keys.resolveKid(payload.kid)
    val pair = keys.signingKeyPair()
    val message = buildSignatureMessage(payload).toByteArray(Charsets.UTF_8)
    val sig =
      HydratorEncoding.base64ToBytes(payload.sig)
        ?: HydratorErrors.throwError("SIGNATURE_INVALID", "Invalid signature encoding")
    val verifier = Signature.getInstance("Ed25519", "BC")
    verifier.initVerify(pair.public)
    verifier.update(message)
    if (!verifier.verify(sig)) {
      HydratorErrors.throwError("SIGNATURE_INVALID", "Payload signature verification failed")
    }
  }

  fun decryptChunks(chunks: List<WireChunk>): ByteArray {
    val aesKey = keys.aesKey()
    val sorted = chunks.sortedBy { it.seq }
    if (sorted.isEmpty()) {
      HydratorErrors.throwError("MALFORMED_PAYLOAD", "Payload has no chunks")
    }
    sorted.forEachIndexed { index, chunk ->
      if (chunk.seq != index) {
        HydratorErrors.throwError("CHUNK_SEQUENCE_GAP", "Missing chunk sequence $index")
      }
      val cipherData =
        HydratorEncoding.base64UrlToBytes(chunk.data)
          ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid chunk encoding")
      val actualHmac = HydratorEncoding.sha256Hex(cipherData)
      if (actualHmac != chunk.hmac.lowercase()) {
        HydratorErrors.throwError("CHUNK_CORRUPTION", "Chunk HMAC mismatch at seq ${chunk.seq}")
      }
      if (cipherData.size != chunk.size) {
        HydratorErrors.throwError("CHUNK_CORRUPTION", "Chunk size mismatch at seq ${chunk.seq}")
      }
    }

    val output = java.io.ByteArrayOutputStream()
    for (chunk in sorted) {
      val iv =
        HydratorEncoding.base64ToBytes(chunk.iv)
          ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid chunk IV")
      val cipherData =
        HydratorEncoding.base64UrlToBytes(chunk.data)
          ?: HydratorErrors.throwError("MALFORMED_PAYLOAD", "Invalid chunk data")
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, aesKey, GCMParameterSpec(128, iv))
      val plain = cipher.doFinal(cipherData)
      output.write(plain)
    }
    return output.toByteArray()
  }

  fun seal(
    state: ByteArray,
    reqId: String,
    v: Int,
    ts: Int,
    ctx: String,
    chunkThreshold: Int,
  ): WirePayload {
    keys.resolveKid(HydratorConstants.KID_V1)
    val aesKey = keys.aesKey()
    val pair = keys.signingKeyPair()
    val chunks = mutableListOf<WireChunk>()
    val sliceSize =
      HydratorChunking.plaintextSliceSize(state.size, chunkThreshold)
    var offset = 0
    var seq = 0
    while (offset < state.size) {
      val end = minOf(offset + sliceSize, state.size)
      val slice = state.copyOfRange(offset, end)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, aesKey)
      val iv = cipher.iv
      val encrypted = cipher.doFinal(slice)
      val combined = encrypted
      chunks.add(
        WireChunk(
          seq = seq,
          size = combined.size,
          iv = HydratorEncoding.bytesToBase64(iv),
          hmac = HydratorEncoding.sha256Hex(combined),
          data = HydratorEncoding.bytesToBase64Url(combined),
        ),
      )
      offset = end
      seq += 1
    }
    val unsigned =
      WirePayload(
        reqId = reqId,
        v = v,
        ts = ts,
        ctx = ctx,
        kid = HydratorConstants.KID_V1,
        sig = "",
        chunks = chunks,
      )
    val message = buildSignatureMessage(unsigned).toByteArray(Charsets.UTF_8)
    val signer = Signature.getInstance("Ed25519", "BC")
    signer.initSign(pair.private)
    signer.update(message)
    val signature = HydratorEncoding.bytesToBase64(signer.sign())
    return unsigned.copy(sig = signature)
  }
}
