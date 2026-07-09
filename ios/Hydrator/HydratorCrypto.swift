import CryptoKit
import Foundation

struct WireChunk {
  let seq: Int
  let size: Int
  let iv: String
  let hmac: String
  let data: String
}

struct WirePayload {
  let reqId: String
  let v: Int
  let ts: Int
  let ctx: String
  let kid: String
  let sig: String
  let chunks: [WireChunk]
}

final class HydratorCrypto {
  private let keys = HydratorKeyManager()

  func computeChunksHmac(_ chunks: [WireChunk]) -> String {
    let sorted = chunks.sorted { $0.seq < $1.seq }
    let joined = sorted.map(\.hmac).joined()
    return HydratorEncoding.sha256HexFromUtf8(joined)
  }

  func buildSignatureMessage(payload: WirePayload) -> String {
    let chunksHmac = computeChunksHmac(payload.chunks)
    return "\(payload.v)|\(payload.ts)|\(payload.ctx)|\(payload.kid)|\(chunksHmac)"
  }

  func verifySignature(payload: WirePayload) throws {
    try keys.resolveKid(payload.kid)
    let signingKey = try keys.signingKey()
    let message = buildSignatureMessage(payload: payload)
    guard let sigData = HydratorEncoding.base64ToData(payload.sig) else {
      HydratorException.throwError(code: "SIGNATURE_INVALID", message: "Invalid signature encoding")
    }
    let publicKey = signingKey.publicKey
    guard publicKey.isValidSignature(sigData, for: Data(message.utf8)) else {
      HydratorException.throwError(code: "SIGNATURE_INVALID", message: "Payload signature verification failed")
    }
  }

  func decryptChunks(_ chunks: [WireChunk]) throws -> Data {
    let aesKey = try keys.aesKey()
    let sorted = chunks.sorted { $0.seq < $1.seq }
    guard !sorted.isEmpty else {
      HydratorException.throwError(code: "MALFORMED_PAYLOAD", message: "Payload has no chunks")
    }
    for (index, chunk) in sorted.enumerated() {
      if chunk.seq != index {
        HydratorException.throwError(code: "CHUNK_SEQUENCE_GAP", message: "Missing chunk sequence \(index)")
      }
      guard let ivData = HydratorEncoding.base64ToData(chunk.iv),
            let cipherData = HydratorEncoding.base64UrlToData(chunk.data) else {
        HydratorException.throwError(code: "MALFORMED_PAYLOAD", message: "Invalid chunk encoding")
      }
      let actualHmac = HydratorEncoding.sha256Hex(cipherData)
      guard actualHmac == chunk.hmac.lowercased() else {
        HydratorException.throwError(code: "CHUNK_CORRUPTION", message: "Chunk HMAC mismatch at seq \(chunk.seq)")
      }
      guard cipherData.count == chunk.size else {
        HydratorException.throwError(code: "CHUNK_CORRUPTION", message: "Chunk size mismatch at seq \(chunk.seq)")
      }
    }

    var plaintext = Data()
    for chunk in sorted {
      guard let ivData = HydratorEncoding.base64ToData(chunk.iv),
            let cipherData = HydratorEncoding.base64UrlToData(chunk.data) else {
        continue
      }
      let nonce = try AES.GCM.Nonce(data: ivData)
      let tagSize = 16
      guard cipherData.count >= tagSize else {
        HydratorException.throwError(code: "DECRYPTION_FAILED", message: "Ciphertext too short")
      }
      let ciphertext = cipherData.prefix(cipherData.count - tagSize)
      let tag = cipherData.suffix(tagSize)
      let sealed = try AES.GCM.SealedBox(nonce: nonce, ciphertext: ciphertext, tag: tag)
      let chunkPlain = try AES.GCM.open(sealed, using: aesKey)
      plaintext.append(chunkPlain)
    }
    return plaintext
  }

  func seal(state: Data, reqId: String, v: Int, ts: Int, ctx: String) throws -> WirePayload {
    try keys.resolveKid(HydratorConstants.kidV1)
    let aesKey = try keys.aesKey()
    let signingKey = try keys.signingKey()
    var chunks: [WireChunk] = []
    var offset = 0
    var seq = 0
    while offset < state.count {
      let end = min(offset + HydratorConstants.chunkSize, state.count)
      let slice = state.subdata(in: offset..<end)
      let nonce = AES.GCM.Nonce()
      let sealed = try AES.GCM.seal(slice, using: aesKey, nonce: nonce)
      let combined = sealed.ciphertext + sealed.tag
      let chunk = WireChunk(
        seq: seq,
        size: combined.count,
        iv: HydratorEncoding.dataToBase64String(Data(nonce)),
        hmac: HydratorEncoding.sha256Hex(combined),
        data: HydratorEncoding.dataToBase64Url(combined)
      )
      chunks.append(chunk)
      offset = end
      seq += 1
    }
    var payload = WirePayload(
      reqId: reqId,
      v: v,
      ts: ts,
      ctx: ctx,
      kid: HydratorConstants.kidV1,
      sig: "",
      chunks: chunks
    )
    let message = buildSignatureMessage(payload: payload)
    let signature = try signingKey.signature(for: Data(message.utf8))
    payload = WirePayload(
      reqId: reqId,
      v: v,
      ts: ts,
      ctx: ctx,
      kid: HydratorConstants.kidV1,
      sig: signature.base64EncodedString(),
      chunks: chunks
    )
    return payload
  }
}
