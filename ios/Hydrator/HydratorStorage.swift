import Foundation

struct StoredPayloadMeta: Codable {
  let storedAtMonotonicMs: UInt64
}

final class HydratorStorage {
  private let fileManager = FileManager.default
  private let cacheDirectory: URL

  init() throws {
    guard let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first else {
      throw HydratorException.error(code: "MALFORMED_PAYLOAD", message: "Caches directory unavailable")
    }
    cacheDirectory = caches.appendingPathComponent(HydratorConstants.cacheDirName, isDirectory: true)
    try fileManager.createDirectory(at: cacheDirectory, withIntermediateDirectories: true)
    try fileManager.setAttributes(
      [.protectionKey: FileProtectionType.complete],
      ofItemAtPath: cacheDirectory.path
    )
  }

  func store(reqId: String, payload: Data) throws {
    let payloadUrl = payloadUrl(for: reqId)
    let metaUrl = metaUrl(for: reqId)
    let monotonicMs = currentMonotonicMs()
    let meta = StoredPayloadMeta(storedAtMonotonicMs: monotonicMs)
    let metaData = try JSONEncoder().encode(meta)
    try payload.write(to: payloadUrl, options: .atomic)
    try metaData.write(to: metaUrl, options: .atomic)
    try fileManager.setAttributes(
      [.protectionKey: FileProtectionType.complete],
      ofItemAtPath: payloadUrl.path
    )
  }

  func load(reqId: String) throws -> (payload: Data, meta: StoredPayloadMeta)? {
    let payloadUrl = payloadUrl(for: reqId)
    let metaUrl = metaUrl(for: reqId)
    guard fileManager.fileExists(atPath: payloadUrl.path),
          fileManager.fileExists(atPath: metaUrl.path) else {
      return nil
    }
    let payload = try Data(contentsOf: payloadUrl)
    let meta = try JSONDecoder().decode(StoredPayloadMeta.self, from: Data(contentsOf: metaUrl))
    return (payload, meta)
  }

  func remove(reqId: String) throws {
    let payloadUrl = payloadUrl(for: reqId)
    let metaUrl = metaUrl(for: reqId)
    if fileManager.fileExists(atPath: payloadUrl.path) {
      try fileManager.removeItem(at: payloadUrl)
    }
    if fileManager.fileExists(atPath: metaUrl.path) {
      try fileManager.removeItem(at: metaUrl)
    }
  }

  func listReqIds() -> [String] {
    guard let files = try? fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: nil) else {
      return []
    }
    return files
      .filter { $0.pathExtension == "json" && !$0.lastPathComponent.hasSuffix(".meta.json") }
      .map { $0.deletingPathExtension().lastPathComponent }
      .sorted()
  }

  func totalBytes() -> Int {
    guard let files = try? fileManager.contentsOfDirectory(at: cacheDirectory, includingPropertiesForKeys: [.fileSizeKey]) else {
      return 0
    }
    return files.reduce(0) { total, url in
      let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
      return total + size
    }
  }

  func purgeExpired(testMode: Bool, excluding reqIds: Set<String> = []) throws -> Int {
    if testMode {
      return 0
    }
    var removed = 0
    let now = currentMonotonicMs()
    for reqId in listReqIds() {
      if reqIds.contains(reqId) { continue }
      guard let (_, meta) = try load(reqId: reqId) else { continue }
      if now &- meta.storedAtMonotonicMs > HydratorConstants.ttlMs {
        try remove(reqId: reqId)
        removed += 1
      }
    }
    return removed
  }

  func inspect(testMode: Bool) throws -> (stored: [String], cached: Int) {
    let ids = listReqIds()
    if testMode {
      return (ids, ids.count)
    }
    let now = currentMonotonicMs()
    let live = ids.filter { reqId in
      guard let (_, meta) = try? load(reqId: reqId) else { return false }
      return now &- meta.storedAtMonotonicMs <= HydratorConstants.ttlMs
    }
    return (ids, live.count)
  }

  func isExpired(meta: StoredPayloadMeta, testMode: Bool) -> Bool {
    if testMode { return false }
    let now = currentMonotonicMs()
    return now &- meta.storedAtMonotonicMs > HydratorConstants.ttlMs
  }

  private func payloadUrl(for reqId: String) -> URL {
    cacheDirectory.appendingPathComponent("\(reqId).json")
  }

  private func metaUrl(for reqId: String) -> URL {
    cacheDirectory.appendingPathComponent("\(reqId).meta.json")
  }

  private func currentMonotonicMs() -> UInt64 {
    UInt64(ProcessInfo.processInfo.systemUptime * 1000)
  }
}
