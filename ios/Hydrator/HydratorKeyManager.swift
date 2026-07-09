import CryptoKit
import Foundation
import Security

final class HydratorKeyManager {
  func resolveKid(_ kid: String) throws {
    guard kid == HydratorConstants.kidV1 else {
      throw HydratorException.error(
        code: "MALFORMED_PAYLOAD",
        message: "Unsupported key id: \(kid)"
      )
    }
  }

  func aesKey() throws -> SymmetricKey {
    if let data = try readKeychain(account: HydratorConstants.aesKeyTag) {
      return SymmetricKey(data: data)
    }
    let key = SymmetricKey(size: .bits256)
    let raw = key.withUnsafeBytes { Data($0) }
    try writeKeychain(account: HydratorConstants.aesKeyTag, data: raw)
    return key
  }

  func signingKey() throws -> Curve25519.Signing.PrivateKey {
    if let data = try readKeychain(account: HydratorConstants.ed25519KeyTag) {
      return try Curve25519.Signing.PrivateKey(rawRepresentation: data)
    }
    let key = Curve25519.Signing.PrivateKey()
    try writeKeychain(account: HydratorConstants.ed25519KeyTag, data: key.rawRepresentation)
    return key
  }

  private func readKeychain(account: String) throws -> Data? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: account,
      kSecAttrService as String: "PrismNexusHydrator",
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    if status == errSecItemNotFound {
      return nil
    }
    guard status == errSecSuccess, let data = item as? Data else {
      throw HydratorException.error(
        code: "DECRYPTION_FAILED",
        message: "Failed to read device-bound key"
      )
    }
    return data
  }

  private func writeKeychain(account: String, data: Data) throws {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: account,
      kSecAttrService as String: "PrismNexusHydrator",
      kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
      kSecValueData as String: data,
    ]
    let status = SecItemAdd(query as CFDictionary, nil)
    if status == errSecDuplicateItem {
      let updateQuery: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrAccount as String: account,
        kSecAttrService as String: "PrismNexusHydrator",
      ]
      let attributes: [String: Any] = [kSecValueData as String: data]
      let updateStatus = SecItemUpdate(updateQuery as CFDictionary, attributes as CFDictionary)
      guard updateStatus == errSecSuccess else {
        throw HydratorException.error(
          code: "DECRYPTION_FAILED",
          message: "Failed to update device-bound key"
        )
      }
      return
    }
    guard status == errSecSuccess else {
      throw HydratorException.error(
        code: "DECRYPTION_FAILED",
        message: "Failed to store device-bound key"
      )
    }
  }
}
