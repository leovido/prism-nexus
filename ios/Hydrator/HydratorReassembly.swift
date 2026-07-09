import Foundation

enum HydratorChunking {
  static func shouldSplit(plaintextBytes: Int, threshold: Int) -> Bool {
    plaintextBytes + HydratorConstants.gcmTagBytes > threshold
  }

  static func plaintextSliceSize(plaintextBytes: Int, threshold: Int) -> Int {
    guard plaintextBytes > 0 else { return 0 }
    if !shouldSplit(plaintextBytes: plaintextBytes, threshold: threshold) {
      return plaintextBytes
    }
    return HydratorConstants.chunkSize
  }
}

enum HydratorReassembly {
  static func decryptAndParse(
    crypto: HydratorCrypto,
    wire: WirePayload,
    timeoutMs: UInt64
  ) throws -> Any {
    var outcome: Result<Any, Error>?
    let group = DispatchGroup()
    group.enter()

    DispatchQueue.global(qos: .userInitiated).async {
      defer { group.leave() }
      do {
        try crypto.verifySignature(payload: wire)
        var plaintext = try crypto.decryptChunks(wire.chunks)
        defer { plaintext.resetBytes(in: 0..<plaintext.count) }
        let state = try JSONSerialization.jsonObject(with: plaintext)
        outcome = .success(state)
      } catch {
        outcome = .failure(error)
      }
    }

    let deadline = DispatchTime.now() + .milliseconds(Int(timeoutMs))
    if group.wait(timeout: deadline) == .timedOut {
      throw HydratorException.error(
        code: "REASSEMBLY_TIMEOUT",
        message: "Chunk reassembly exceeded \(timeoutMs)ms"
      )
    }

    switch outcome {
    case let .success(state):
      return state
    case let .failure(error):
      throw error
    case .none:
      throw HydratorException.error(
        code: "MALFORMED_PAYLOAD",
        message: "Chunk reassembly finished without a result"
      )
    }
  }
}
