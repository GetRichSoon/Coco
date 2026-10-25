# Coco Lounge (Android) R8 rules, 2026-10-25.
# Everything the system starts by name (activities, services, receivers in the manifest) is kept by the Android plugin.
# WorkManager, Lifecycle, OkHttp and coroutines ship their own rules. Coco looks nothing up by name itself
# (the earbuds battery uses reflection on an Android class, which R8 never touches).

# Readable crash lines in error reports.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
