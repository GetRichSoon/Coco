package com.goodspace.cocolounge.island.util

/** Pure logic for the `icon_blacklist` secure setting (comma separated SystemUI slot names). No Android imports, so it is unit tested. */
object IconBlacklist {
    /** Slots Coco Island must never hide: the left clock and the right battery. */
    val PROTECTED = setOf("clock", "battery")

    enum class Group(val title: String, val slots: List<String>) {
        WIFI("Wi-Fi", listOf("wifi", "vowifi")),
        MOBILE("Mobile signal", listOf("mobile", "no_sim", "call_strength", "phone_signal", "phone_evdo_signal", "data_connection", "cdma_eri")),
        VOLTE("VoLTE / HD calling", listOf("volte", "ims_calling")),
        ALARM("Alarm", listOf("alarm_clock")),
        BLUETOOTH("Bluetooth", listOf("bluetooth")),
        OTHER(
            "Other indicators",
            listOf(
                "hotspot", "nfc", "vpn", "volume", "zen", "location", "airplane", "data_saver", "headset",
                "cast", "sync_failing", "network_speed", "ethernet", "managed_profile", "rotate",
                "mute", "speakerphone", "tty", "sensors_off", "screen_record", "ime", "sync_active", "secure",
            ),
        ),
    }

    /** Clean preset, any phone: clock left, battery right, everything else hidden (the island sits in the middle). */
    val CLEAN: Set<Group> = Group.values().toSet()

    /** Every slot Coco Island can ever add. Used to remove exactly our own entries on restore. */
    val OURS: Set<String> = Group.values().flatMap { it.slots }.toSet() - PROTECTED

    fun parse(raw: String?): List<String> =
        raw.orEmpty().split(',').map { it.trim() }.filter { it.isNotEmpty() }

    fun slotsFor(hidden: Set<Group>): Set<String> = hidden.flatMap { it.slots }.toSet() - PROTECTED

    /** Keeps entries someone else put in the list, replaces only our own slots with the wanted ones. */
    fun merge(current: String?, wanted: Set<String>): String {
        val others = parse(current).filter { it !in OURS }
        return (others + (wanted - PROTECTED).sorted()).distinct().joinToString(",")
    }

    /** Removes only Coco Island's slots. Anything else stays exactly as it was. */
    fun restore(current: String?): String = parse(current).filter { it !in OURS }.joinToString(",")

    fun hiddenGroups(current: String?): Set<Group> {
        val now = parse(current).toSet()
        return Group.values().filter { g -> g.slots.any { it in now } }.toSet()
    }
}
