package com.resonixai.citizen.mesh

import java.util.UUID

/**
 * RESONIX AI — BLE Mesh Protocol Constants & UUIDs
 * Independent clean-room specification.
 */
object ResonixBleConstants {
    // Resonix-Owned 128-bit RFC 4122 Service and Characteristic UUIDs
    val RESONIX_SERVICE_UUID: UUID = UUID.fromString("7E500001-B5A3-F393-E0A9-E50E24DCCA9E")
    val RESONIX_CHAR_CONTROL: UUID = UUID.fromString("7E500002-B5A3-F393-E0A9-E50E24DCCA9E")
    val RESONIX_CHAR_DATA: UUID    = UUID.fromString("7E500003-B5A3-F393-E0A9-E50E24DCCA9E")
    val CCCD_UUID: UUID            = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

    // Protocol Framing
    const val PROTOCOL_VERSION: Byte = 0x01
    const val MAGIC_HEADER: Short = 0x5258 // ASCII "RX"

    // Packet Types
    const val PKT_TYPE_EMERGENCY_SOS: Byte = 0x01
    const val PKT_TYPE_ACK_HOP: Byte       = 0x0A
    const val PKT_TYPE_ACK_DELIVERY: Byte  = 0x0B
    const val PKT_TYPE_HEARTBEAT: Byte     = 0x03

    // Capability Flags
    const val CAP_INTERNET_GATEWAY: Byte   = 0x01
    const val CAP_ACTIVE_SOS: Byte         = 0x02
    const val CAP_HIGH_BANDWIDTH: Byte     = 0x04
    const val CAP_BATTERY_SAVING: Byte     = 0x08

    // MTU & Fragmentation
    const val DEFAULT_MTU = 23
    const val TARGET_MTU = 512
    const val ATT_HEADER_SIZE = 3
    const val FRAGMENT_HEADER_SIZE = 10
    const val MAX_ATTRIBUTE_VALUE_SIZE = 512
    const val DEFAULT_CHUNK_SIZE = DEFAULT_MTU - ATT_HEADER_SIZE - FRAGMENT_HEADER_SIZE // 10 bytes fallback
    const val MAX_CHUNK_SIZE = 490 // Max payload; 490 + 10 header = 500 bytes (strictly <= 512 bytes GATT limit)

    // Timeouts & Guard Intervals
    const val GATT_TIMEOUT_MS = 15_000L
    const val REASSEMBLY_TIMEOUT_MS = 30_000L
    const val PEER_QUARANTINE_MS = 10_000L
    const val INTER_FRAGMENT_DELAY_MS = 40L
    const val INITIAL_TTL: Byte = 0x07

    // Notification Channel
    const val NOTIFICATION_CHANNEL_ID = "resonix_mesh_channel"
    const val NOTIFICATION_CHANNEL_NAME = "Resonix Emergency Mesh Service"
    const val NOTIFICATION_ID = 9110
}
