import CryptoKit
import Foundation

enum HydratorEncoding {
  static func base64ToData(_ value: String) -> Data? {
    Data(base64Encoded: value)
  }

  static func base64UrlToData(_ value: String) -> Data? {
    var base64 = value.replacingOccurrences(of: "-", with: "+")
      .replacingOccurrences(of: "_", with: "/")
    let padding = 4 - (base64.count % 4)
    if padding < 4 {
      base64 += String(repeating: "=", count: padding)
    }
    return Data(base64Encoded: base64)
  }

  static func dataToBase64String(_ data: Data) -> String {
    data.base64EncodedString()
  }

  static func dataToBase64Url(_ data: Data) -> String {
    data.base64EncodedString()
      .replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_")
      .replacingOccurrences(of: "=", with: "")
  }

  static func sha256Hex(_ data: Data) -> String {
    let digest = SHA256.hash(data: data)
    return digest.map { String(format: "%02x", $0) }.joined()
  }

  static func sha256HexFromUtf8(_ value: String) -> String {
    sha256Hex(Data(value.utf8))
  }
}
