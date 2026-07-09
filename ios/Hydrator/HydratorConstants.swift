import Foundation

enum HydratorConstants {
  static let ttlSeconds: TimeInterval = 300
  static let ttlMs: UInt64 = 300_000
  static let maxStorageBytes = 50 * 1024 * 1024
  static let kidV1 = "v1"
  static let cacheDirName = "Hydrator"
  static let chunkSize = 4096
  static let chunkThreshold = 20 * 1024
  static let gcmTagBytes = 16
  static let reassemblyTimeoutMs: UInt64 = 30_000
  static let aesKeyTag = "com.prismnexus.hydrator.aes.v1"
  static let ed25519KeyTag = "com.prismnexus.hydrator.ed25519.v1"
}
