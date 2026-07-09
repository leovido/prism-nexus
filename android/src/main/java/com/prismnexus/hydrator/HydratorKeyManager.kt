package com.prismnexus.hydrator

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyInfo
import android.security.keystore.KeyProperties
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.bouncycastle.jce.provider.BouncyCastleProvider
import java.security.KeyPair
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.Security
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.X509EncodedKeySpec
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.SecretKeyFactory

class HydratorKeyManager(
  private val context: Context,
  private val allowSoftwareKeys: () -> Boolean = { false },
) {
  init {
    if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
      Security.addProvider(BouncyCastleProvider())
    }
  }

  fun resolveKid(kid: String) {
    if (kid != HydratorConstants.KID_V1) {
      HydratorErrors.throwError("MALFORMED_PAYLOAD", "Unsupported key id: $kid")
    }
  }

  fun aesKey(): SecretKey {
    val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
    val existing = keyStore.getKey(HydratorConstants.AES_KEY_ALIAS, null) as? SecretKey
    if (existing != null) {
      assertHardwareBacked(existing)
      return existing
    }
    val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
    val spec =
      KeyGenParameterSpec.Builder(
        HydratorConstants.AES_KEY_ALIAS,
        KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
      )
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .setUserAuthenticationRequired(false)
        .build()
    generator.init(spec)
    val key = generator.generateKey()
    assertHardwareBacked(key)
    return key
  }

  fun signingKeyPair(): KeyPair {
    val prefs = encryptedPrefs()
    val privateEncoded = prefs.getString(PREF_PRIVATE_KEY, null)
    val publicEncoded = prefs.getString(PREF_PUBLIC_KEY, null)
    if (privateEncoded != null && publicEncoded != null) {
      val factory = java.security.KeyFactory.getInstance("Ed25519", "BC")
      val privateBytes =
        HydratorEncoding.base64ToBytes(privateEncoded)
          ?: HydratorErrors.throwError("SIGNATURE_INVALID", "Stored signing key is invalid")
      val publicBytes =
        HydratorEncoding.base64ToBytes(publicEncoded)
          ?: HydratorErrors.throwError("SIGNATURE_INVALID", "Stored signing key is invalid")
      val privateKey = factory.generatePrivate(PKCS8EncodedKeySpec(privateBytes))
      val publicKey = factory.generatePublic(X509EncodedKeySpec(publicBytes))
      return KeyPair(publicKey, privateKey)
    }
    val generator = KeyPairGenerator.getInstance("Ed25519", "BC")
    val pair = generator.generateKeyPair()
    prefs.edit()
      .putString(PREF_PRIVATE_KEY, HydratorEncoding.bytesToBase64(pair.private.encoded))
      .putString(PREF_PUBLIC_KEY, HydratorEncoding.bytesToBase64(pair.public.encoded))
      .apply()
    return pair
  }

  private fun assertHardwareBacked(key: SecretKey) {
    if (allowSoftwareKeys()) return
    val factory = SecretKeyFactory.getInstance(key.algorithm, "AndroidKeyStore")
    val keyInfo = factory.getKeySpec(key, KeyInfo::class.java)
    val secure =
      keyInfo.securityLevel == KeyProperties.SECURITY_LEVEL_TRUSTED_ENVIRONMENT ||
        keyInfo.securityLevel == KeyProperties.SECURITY_LEVEL_STRONGBOX
    if (!secure) {
      HydratorErrors.throwError("DECRYPTION_FAILED", "Device-bound key is not hardware-backed")
    }
  }

  private fun encryptedPrefs() =
    EncryptedSharedPreferences.create(
      context,
      HydratorConstants.ED25519_PREFS,
      MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build(),
      EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
      EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

  companion object {
    private const val PREF_PRIVATE_KEY = "private_key"
    private const val PREF_PUBLIC_KEY = "public_key"
  }
}
