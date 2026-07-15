import Foundation

final class HydratorService {
  private let storage: HydratorStorage
  private let crypto = HydratorCrypto()
  private var testMode = false
  private var chunkThreshold = HydratorConstants.chunkThreshold
  private var reassemblyTimeoutMs = HydratorConstants.reassemblyTimeoutMs
  private var inFlight = Set<String>()
  private let lock = NSLock()

  init() throws {
    storage = try HydratorStorage()
  }

  func configure(testMode: Bool, chunkThreshold: Int?, reassemblyTimeoutMs: UInt64?) {
    self.testMode = testMode
    if let chunkThreshold, chunkThreshold > 0 {
      self.chunkThreshold = chunkThreshold
    }
    if let reassemblyTimeoutMs, reassemblyTimeoutMs > 0 {
      self.reassemblyTimeoutMs = reassemblyTimeoutMs
    }
  }

  func storePayloadDictionary(_ payload: [String: Any]) throws {
    let wire = try parseWirePayload(payload)
    try storeWirePayload(wire)
  }

  func sealAndStore(state: Any, reqId: String, ctx: String, version: Int, ts: Int) throws -> [String: Any] {
    guard testMode else {
      throw HydratorException.error(
        code: "MALFORMED_PAYLOAD",
        message: "sealAndStorePayload requires testMode"
      )
    }
    let stateData = try JSONSerialization.data(withJSONObject: state, options: [])
    let wire = try crypto.seal(
      state: stateData,
      reqId: reqId,
      v: version,
      ts: ts,
      ctx: ctx,
      chunkThreshold: chunkThreshold
    )
    try storeWirePayload(wire)
    return wire.toDictionary()
  }

  func resolveEnvelope() throws -> [String: Any]? {
    _ = try storage.purgeExpired(testMode: testMode, excluding: inFlightSnapshot())
    let reqIds = storage.listReqIds().reversed()
    for reqId in reqIds {
      guard acquireLock(reqId) else { continue }
      defer { releaseLock(reqId) }
      do {
        if let envelope = try resolveSingle(reqId: reqId) {
          return envelope
        }
      } catch {
        try? storage.remove(reqId: reqId)
        throw error
      }
    }
    return nil
  }

  func purgeExpired() throws -> Int {
    try storage.purgeExpired(testMode: testMode, excluding: inFlightSnapshot())
  }

  func inspectStorage() throws -> [String: Any] {
    let snapshot = try storage.inspect(testMode: testMode)
    return ["stored": snapshot.stored, "cached": snapshot.cached]
  }

  private func resolveSingle(reqId: String) throws -> [String: Any]? {
    guard let (payloadData, meta) = try storage.load(reqId: reqId) else {
      return nil
    }
    if storage.isExpired(meta: meta, testMode: testMode) {
      try storage.remove(reqId: reqId)
      throw HydratorException.error(code: "TTL_EXPIRED", message: "Hydration payload expired")
    }
    guard let json = try JSONSerialization.jsonObject(with: payloadData) as? [String: Any] else {
      throw HydratorException.error(code: "MALFORMED_PAYLOAD", message: "Stored payload is not valid JSON")
    }
    let wire = try parseWirePayload(json)
    guard wire.reqId == reqId else {
      throw HydratorException.error(code: "MALFORMED_PAYLOAD", message: "reqId mismatch")
    }
    let state = try HydratorReassembly.decryptAndParse(
      crypto: crypto,
      wire: wire,
      timeoutMs: reassemblyTimeoutMs
    )
    try storage.remove(reqId: reqId)
    return [
      "reqId": wire.reqId,
      "claims": [
        "v": wire.v,
        "ts": wire.ts,
        "ctx": wire.ctx,
        "kid": wire.kid,
      ],
      "state": state,
    ]
  }

  private func storeWirePayload(_ wire: WirePayload) throws {
    let projected = wire.toDictionary()
    let payloadData = try JSONSerialization.data(withJSONObject: projected, options: [])
    let projectedSize = try storage.totalBytes() + payloadData.count
    if projectedSize > HydratorConstants.maxStorageBytes {
      throw HydratorException.error(code: "STORAGE_QUOTA_EXCEEDED", message: "Native hydrator storage quota exceeded")
    }
    try storage.store(reqId: wire.reqId, payload: payloadData)
  }

  private func parseWirePayload(_ dict: [String: Any]) throws -> WirePayload {
    guard let reqId = dict["reqId"] as? String,
          let v = dict["v"] as? Int,
          let ts = dict["ts"] as? Int,
          let ctx = dict["ctx"] as? String,
          let kid = dict["kid"] as? String,
          let sig = dict["sig"] as? String,
          let rawChunks = dict["chunks"] as? [[String: Any]] else {
      throw HydratorException.error(code: "MALFORMED_PAYLOAD", message: "Invalid wire payload shape")
    }
    let chunks = try rawChunks.map { chunk -> WireChunk in
      guard let seq = chunk["seq"] as? Int,
            let size = chunk["size"] as? Int,
            let iv = chunk["iv"] as? String,
            let hmac = chunk["hmac"] as? String,
            let data = chunk["data"] as? String else {
        throw HydratorException.error(code: "MALFORMED_PAYLOAD", message: "Invalid wire chunk shape")
      }
      return WireChunk(seq: seq, size: size, iv: iv, hmac: hmac, data: data)
    }
    return WirePayload(reqId: reqId, v: v, ts: ts, ctx: ctx, kid: kid, sig: sig, chunks: chunks)
  }

  private func acquireLock(_ reqId: String) -> Bool {
    lock.lock()
    defer { lock.unlock() }
    if inFlight.contains(reqId) { return false }
    inFlight.insert(reqId)
    return true
  }

  private func releaseLock(_ reqId: String) {
    lock.lock()
    inFlight.remove(reqId)
    lock.unlock()
  }

  private func inFlightSnapshot() -> Set<String> {
    lock.lock()
    defer { lock.unlock() }
    return inFlight
  }
}

private extension WirePayload {
  func toDictionary() -> [String: Any] {
    [
      "reqId": reqId,
      "v": v,
      "ts": ts,
      "ctx": ctx,
      "kid": kid,
      "sig": sig,
      "chunks": chunks.map { chunk in
        [
          "seq": chunk.seq,
          "size": chunk.size,
          "iv": chunk.iv,
          "hmac": chunk.hmac,
          "data": chunk.data,
        ]
      },
    ]
  }
}
