package com.resonixai.citizen.mesh

import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import java.util.UUID

/**
 * RESONIX AI — Binary Envelope Serializer & Dynamic Fragment Chunker
 */
object ResonixPacketChunker {

    data class EmergencyPacketModel(
        val packetId: String,
        val originDeviceId: Long = 0L,
        val timestamp: Long = System.currentTimeMillis(),
        val ttl: Byte = ResonixBleConstants.INITIAL_TTL,
        val hopCount: Byte = 0,
        val latitude: Double = 0.0,
        val longitude: Double = 0.0,
        val categoryCode: Byte = 0xFF.toByte(),
        val priorityCode: Byte = 0x01,
        val payloadJson: String = ""
    )

    /**
     * Serializes an EmergencyPacketModel into a compact binary envelope with SHA-256 integrity.
     */
    fun serialize(model: EmergencyPacketModel): ByteArray {
        val payloadBytes = model.payloadJson.toByteArray(Charsets.UTF_8)
        val uuid = try {
            UUID.fromString(model.packetId)
        } catch (_: Exception) {
            UUID.nameUUIDFromBytes(model.packetId.toByteArray())
        }

        // Fixed header = 2 (Magic) + 1 (Ver) + 1 (Type) + 1 (TTL) + 1 (Hops) + 8 (Time) + 16 (UUID) + 8 (Device) + 4 (Lat) + 4 (Lng) + 1 (Cat) + 1 (Prio) + 2 (Len) = 50 bytes
        val totalLen = 50 + payloadBytes.size + 32 // 32 bytes for SHA-256
        val buffer = ByteBuffer.allocate(totalLen).order(ByteOrder.BIG_ENDIAN)

        buffer.putShort(ResonixBleConstants.MAGIC_HEADER)
        buffer.put(ResonixBleConstants.PROTOCOL_VERSION)
        buffer.put(ResonixBleConstants.PKT_TYPE_EMERGENCY_SOS)
        buffer.put(model.ttl)
        buffer.put(model.hopCount)
        buffer.putLong(model.timestamp)

        buffer.putLong(uuid.mostSignificantBits)
        buffer.putLong(uuid.leastSignificantBits)
        buffer.putLong(model.originDeviceId)

        buffer.putInt((model.latitude * 10000.0).toInt())
        buffer.putInt((model.longitude * 10000.0).toInt())
        buffer.put(model.categoryCode)
        buffer.put(model.priorityCode)
        buffer.putShort(payloadBytes.size.toShort())
        buffer.put(payloadBytes)

        // Compute SHA-256 over everything up to the checksum
        val dataToHash = ByteArray(50 + payloadBytes.size)
        System.arraycopy(buffer.array(), 0, dataToHash, 0, dataToHash.size)
        val md = MessageDigest.getInstance("SHA-256")
        val checksum = md.digest(dataToHash)
        buffer.put(checksum)

        return buffer.array()
    }

    /**
     * Deserializes a complete reassembled binary envelope.
     */
    fun deserialize(bytes: ByteArray): EmergencyPacketModel? {
        if (bytes.size < 50 + 32) return null
        val buffer = ByteBuffer.wrap(bytes).order(ByteOrder.BIG_ENDIAN)

        val magic = buffer.short
        if (magic != ResonixBleConstants.MAGIC_HEADER) return null

        val version = buffer.get()
        if (version != ResonixBleConstants.PROTOCOL_VERSION) return null

        val packetType = buffer.get()
        val ttl = buffer.get()
        val hopCount = buffer.get()
        val timestamp = buffer.long

        val mostSig = buffer.long
        val leastSig = buffer.long
        val packetUuid = UUID(mostSig, leastSig).toString()

        val originDeviceId = buffer.long
        val latInt = buffer.int
        val lngInt = buffer.int
        val categoryCode = buffer.get()
        val priorityCode = buffer.get()

        val payloadLen = buffer.short.toInt() and 0xFFFF
        if (buffer.remaining() < payloadLen + 32) return null

        val payloadBytes = ByteArray(payloadLen)
        buffer.get(payloadBytes)

        val checksumReceived = ByteArray(32)
        buffer.get(checksumReceived)

        // Verify SHA-256
        val dataToHash = ByteArray(50 + payloadLen)
        System.arraycopy(bytes, 0, dataToHash, 0, dataToHash.size)
        val md = MessageDigest.getInstance("SHA-256")
        val checksumComputed = md.digest(dataToHash)

        if (!checksumReceived.contentEquals(checksumComputed)) {
            return null // Integrity failure
        }

        val payloadJson = String(payloadBytes, Charsets.UTF_8)
        val extractedId = try {
            val jsonPktIdRegex = """"packetId"\s*:\s*"([^"]+)"""".toRegex()
            jsonPktIdRegex.find(payloadJson)?.groupValues?.get(1)
        } catch (_: Exception) { null }

        return EmergencyPacketModel(
            packetId = extractedId ?: packetUuid,
            originDeviceId = originDeviceId,
            timestamp = timestamp,
            ttl = ttl,
            hopCount = hopCount,
            latitude = latInt / 10000.0,
            longitude = lngInt / 10000.0,
            categoryCode = categoryCode,
            priorityCode = priorityCode,
            payloadJson = payloadJson
        )
    }

    /**
     * Splits a serialized packet into fragments sized to the effective MTU.
     */
    fun chunkPacket(serialized: ByteArray, effectiveMtu: Int): List<ByteArray> {
        val maxSafePayload = minOf(
            effectiveMtu - ResonixBleConstants.ATT_HEADER_SIZE - ResonixBleConstants.FRAGMENT_HEADER_SIZE,
            ResonixBleConstants.MAX_CHUNK_SIZE
        )
        val usableChunkPayload = maxOf(
            ResonixBleConstants.DEFAULT_CHUNK_SIZE,
            maxSafePayload
        )

        val totalFragments = Math.ceil(serialized.size.toDouble() / usableChunkPayload.toDouble()).toInt()
        val packetToken = ByteBuffer.wrap(serialized, 14, 4).int // 4 bytes from UUID as session token

        val fragments = ArrayList<ByteArray>(totalFragments)
        var offset = 0

        for (index in 0 until totalFragments) {
            val remaining = serialized.size - offset
            val thisChunkLen = minOf(usableChunkPayload, remaining)

            val chunkBuffer = ByteBuffer.allocate(ResonixBleConstants.FRAGMENT_HEADER_SIZE + thisChunkLen)
                .order(ByteOrder.BIG_ENDIAN)

            chunkBuffer.putInt(packetToken)
            chunkBuffer.putShort(index.toShort())
            chunkBuffer.putShort(totalFragments.toShort())
            chunkBuffer.putShort(thisChunkLen.toShort())
            chunkBuffer.put(serialized, offset, thisChunkLen)

            fragments.add(chunkBuffer.array())
            offset += thisChunkLen
        }

        return fragments
    }
}
