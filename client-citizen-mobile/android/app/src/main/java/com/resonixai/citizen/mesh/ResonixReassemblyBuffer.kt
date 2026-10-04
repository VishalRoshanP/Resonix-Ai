package com.resonixai.citizen.mesh

import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.BitSet
import java.util.concurrent.ConcurrentHashMap

/**
 * RESONIX AI — Out-of-Order Fragment Reassembler with Watchdog Protection
 */
class ResonixReassemblyBuffer {

    private data class Session(
        val packetToken: Int,
        val totalFragments: Int,
        val fragments: ConcurrentHashMap<Int, ByteArray> = ConcurrentHashMap(),
        val receivedIndices: BitSet = BitSet(),
        val createdAt: Long = System.currentTimeMillis()
    )

    private val activeSessions = ConcurrentHashMap<Int, Session>()

    /**
     * Ingests a raw BLE fragment from the Data characteristic.
     * Returns the fully reconstructed EmergencyPacketModel if this chunk completed the set, else null.
     */
    fun ingestFragment(rawChunk: ByteArray): ResonixPacketChunker.EmergencyPacketModel? {
        if (rawChunk.size < ResonixBleConstants.FRAGMENT_HEADER_SIZE) return null

        cleanExpiredSessions()

        val headerBuffer = ByteBuffer.wrap(rawChunk, 0, ResonixBleConstants.FRAGMENT_HEADER_SIZE)
            .order(ByteOrder.BIG_ENDIAN)

        val packetToken = headerBuffer.int
        val fragmentIndex = headerBuffer.short.toInt() and 0xFFFF
        val totalFragments = headerBuffer.short.toInt() and 0xFFFF
        val payloadLen = headerBuffer.short.toInt() and 0xFFFF

        if (payloadLen <= 0 || payloadLen > (rawChunk.size - ResonixBleConstants.FRAGMENT_HEADER_SIZE)) {
            return null
        }

        val payload = ByteArray(payloadLen)
        System.arraycopy(rawChunk, ResonixBleConstants.FRAGMENT_HEADER_SIZE, payload, 0, payloadLen)

        val session = activeSessions.computeIfAbsent(packetToken) {
            Session(packetToken = packetToken, totalFragments = totalFragments)
        }

        synchronized(session) {
            session.fragments[fragmentIndex] = payload
            session.receivedIndices.set(fragmentIndex)
            android.util.Log.i("ResonixReassembly", "🧩 Token $packetToken: Ingested fragment ${fragmentIndex + 1}/$totalFragments (${payloadLen}B). Total received so far: ${session.receivedIndices.cardinality()}/$totalFragments")

            if (session.receivedIndices.cardinality() == session.totalFragments) {
                activeSessions.remove(packetToken)
                val pkt = reassemble(session)
                if (pkt == null) {
                    android.util.Log.e("ResonixReassembly", "❌ Deserialization failed for token $packetToken (checksum mismatch or corrupt envelope)")
                }
                return pkt
            }
        }

        return null
    }

    private fun reassemble(session: Session): ResonixPacketChunker.EmergencyPacketModel? {
        val out = ByteArrayOutputStream()
        for (i in 0 until session.totalFragments) {
            val chunk = session.fragments[i] ?: return null // Missing chunk anomaly
            out.write(chunk)
        }
        val completeBytes = out.toByteArray()
        return ResonixPacketChunker.deserialize(completeBytes)
    }

    private fun cleanExpiredSessions() {
        val now = System.currentTimeMillis()
        val it = activeSessions.entries.iterator()
        while (it.hasNext()) {
            val entry = it.next()
            if (now - entry.value.createdAt > ResonixBleConstants.REASSEMBLY_TIMEOUT_MS) {
                it.remove()
            }
        }
    }

    fun clear() {
        activeSessions.clear()
    }
}
