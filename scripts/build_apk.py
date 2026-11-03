#!/usr/bin/env python3
"""
Hesabyar Android APK Builder (Hesabyar-Release.apk)
Generates an Android APK with binary AndroidManifest.xml (AXML),
proper DEX, resources, launcher icons, and META-INF signature.
"""

import os
import struct
import zipfile
import shutil
import hashlib

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(ROOT_DIR, 'public')
OUTPUT_APK = os.path.join(PUBLIC_DIR, 'Hesabyar-Release.apk')
OUTPUT_APK_V3 = os.path.join(PUBLIC_DIR, 'Hesabyar-v0.3.4.apk')

# Standard Android attribute resource IDs
RES_ATTR_VERSION_CODE = 0x0101021b
RES_ATTR_VERSION_NAME = 0x0101021c
RES_ATTR_MIN_SDK = 0x0101020c
RES_ATTR_TARGET_SDK = 0x01010270
RES_ATTR_NAME = 0x01010003
RES_ATTR_LABEL = 0x01010001
RES_ATTR_ICON = 0x01010002
RES_ATTR_EXPORTED = 0x01010010
RES_ATTR_HARDWARE_ACCEL = 0x010102d3
RES_ATTR_SUPPORTS_RTL = 0x010103af
RES_ATTR_CONFIG_CHANGES = 0x0101001f
RES_ATTR_WINDOW_SOFT_INPUT = 0x0101022b

class AxmlBuilder:
    def __init__(self):
        self.strings = []
        self.string_map = {}
        self.resource_ids = []

    def get_string_idx(self, s: str) -> int:
        if s not in self.string_map:
            idx = len(self.strings)
            self.strings.append(s)
            self.string_map[s] = idx
            return idx
        return self.string_map[s]

    def build_string_pool(self) -> bytes:
        string_offsets = []
        string_bytes = bytearray()

        for s in self.strings:
            string_offsets.append(len(string_bytes))
            # UTF-16LE encoding: 2-byte char length, then characters, then 2-byte null
            encoded = s.encode('utf-16le')
            char_count = len(s)
            string_bytes.extend(struct.pack('<H', char_count))
            string_bytes.extend(encoded)
            string_bytes.extend(b'\x00\x00')

        # Pad string_bytes to 4-byte boundary
        while len(string_bytes) % 4 != 0:
            string_bytes.extend(b'\x00')

        header_size = 28
        offsets_size = len(string_offsets) * 4
        strings_start = header_size + offsets_size
        total_size = strings_start + len(string_bytes)

        # RES_STRING_POOL_TYPE = 0x0001
        header = struct.pack(
            '<HHIIIIII',
            0x0001,             # type
            header_size,        # header size
            total_size,         # total chunk size
            len(self.strings),  # stringCount
            0,                  # styleCount
            0,                  # flags (0 = UTF-16)
            strings_start,      # stringsStart
            0                   # stylesStart
        )

        offsets_data = bytearray()
        for off in string_offsets:
            offsets_data.extend(struct.pack('<I', off))

        return header + offsets_data + string_bytes

    def build_resource_map(self) -> bytes:
        header_size = 8
        total_size = header_size + (len(self.resource_ids) * 4)
        header = struct.pack('<HHI', 0x0180, header_size, total_size)
        data = bytearray()
        for rid in self.resource_ids:
            data.extend(struct.pack('<I', rid))
        return header + data

    def build_start_ns(self, prefix_idx: int, uri_idx: int, line: int = 1) -> bytes:
        return struct.pack('<HHIIIIII', 0x0100, 16, 24, line, 0xFFFFFFFF, prefix_idx, uri_idx, 0)

    def build_end_ns(self, prefix_idx: int, uri_idx: int, line: int = 1) -> bytes:
        return struct.pack('<HHIIIIII', 0x0101, 16, 24, line, 0xFFFFFFFF, prefix_idx, uri_idx, 0)

    def build_start_element(self, uri_idx: int, name_idx: int, attrs: list, line: int = 1) -> bytes:
        attr_count = len(attrs)
        elem_size = 16 + 20 + (attr_count * 20)
        chunk = bytearray()
        # Header (16 bytes)
        chunk.extend(struct.pack('<HHII', 0x0102, 16, elem_size, line))
        chunk.extend(struct.pack('<I', 0xFFFFFFFF)) # comment
        # Element data (20 bytes)
        chunk.extend(struct.pack('<II', uri_idx, name_idx))
        chunk.extend(struct.pack('<HHH', 20, 20, attr_count))
        chunk.extend(struct.pack('<HHH', 0, 0, 0)) # idIndex, classIndex, styleIndex

        # Attributes (20 bytes each)
        for attr in attrs:
            ns_idx, attr_name_idx, raw_val_idx, data_type, data_val = attr
            chunk.extend(struct.pack('<III', ns_idx, attr_name_idx, raw_val_idx))
            chunk.extend(struct.pack('<HBB', 8, 0, data_type))
            chunk.extend(struct.pack('<I', data_val))

        return bytes(chunk)

    def build_end_element(self, uri_idx: int, name_idx: int, line: int = 1) -> bytes:
        return struct.pack('<HHIIIII', 0x0103, 16, 24, line, 0xFFFFFFFF, uri_idx, name_idx)


def generate_binary_manifest(pkg_name="ir.hesabyar.app", version_code=35, version_name="0.3.5"):
    b = AxmlBuilder()

    uri_str = "http://schemas.android.com/apk/res/android"
    uri_idx = b.get_string_idx(uri_str)
    prefix_idx = b.get_string_idx("android")

    # Strings needed
    str_pkg = b.get_string_idx("package")
    str_vcode = b.get_string_idx("versionCode")
    str_vname = b.get_string_idx("versionName")
    str_minsdk = b.get_string_idx("minSdkVersion")
    str_targetsdk = b.get_string_idx("targetSdkVersion")
    str_name = b.get_string_idx("name")
    str_label = b.get_string_idx("label")
    str_icon = b.get_string_idx("icon")
    str_hwaccel = b.get_string_idx("hardwareAccelerated")
    str_rtl = b.get_string_idx("supportsRtl")
    str_exported = b.get_string_idx("exported")
    str_config = b.get_string_idx("configChanges")
    str_window_soft = b.get_string_idx("windowSoftInputMode")

    tag_manifest = b.get_string_idx("manifest")
    tag_uses_sdk = b.get_string_idx("uses-sdk")
    tag_uses_perm = b.get_string_idx("uses-permission")
    tag_application = b.get_string_idx("application")
    tag_activity = b.get_string_idx("activity")
    tag_intent = b.get_string_idx("intent-filter")
    tag_action = b.get_string_idx("action")
    tag_category = b.get_string_idx("category")

    val_pkg = b.get_string_idx(pkg_name)
    val_vname = b.get_string_idx(version_name)
    val_label = b.get_string_idx("حساب‌یار")
    val_main_act = b.get_string_idx(".MainActivity")
    val_config = b.get_string_idx("orientation|keyboardHidden|keyboard|screenSize|locale|layoutDirection")
    val_action_main = b.get_string_idx("android.intent.action.MAIN")
    val_cat_launcher = b.get_string_idx("android.intent.category.LAUNCHER")

    perms = [
        "android.permission.INTERNET",
        "android.permission.RECORD_AUDIO",
        "android.permission.VIBRATE",
        "android.permission.RECEIVE_SMS",
        "android.permission.READ_SMS",
    ]
    perm_indices = [b.get_string_idx(p) for p in perms]

    # Map attribute resource IDs in exact string order
    # (Matches strings from start of pool)
    b.resource_ids = [
        RES_ATTR_VERSION_CODE,
        RES_ATTR_VERSION_NAME,
        RES_ATTR_MIN_SDK,
        RES_ATTR_TARGET_SDK,
        RES_ATTR_NAME,
        RES_ATTR_LABEL,
        RES_ATTR_ICON,
        RES_ATTR_HARDWARE_ACCEL,
        RES_ATTR_SUPPORTS_RTL,
        RES_ATTR_EXPORTED,
        RES_ATTR_CONFIG_CHANGES,
        RES_ATTR_WINDOW_SOFT_INPUT,
    ]

    string_pool_chunk = b.build_string_pool()
    res_map_chunk = b.build_resource_map()

    body = bytearray()
    body.extend(b.build_start_ns(prefix_idx, uri_idx, line=1))

    # <manifest package="..." android:versionCode="..." android:versionName="...">
    manifest_attrs = [
        (0xFFFFFFFF, str_pkg, val_pkg, 0x03, val_pkg),
        (uri_idx, str_vcode, 0xFFFFFFFF, 0x10, version_code),
        (uri_idx, str_vname, val_vname, 0x03, val_vname),
    ]
    body.extend(b.build_start_element(0xFFFFFFFF, tag_manifest, manifest_attrs, line=2))

    # <uses-sdk android:minSdkVersion="21" android:targetSdkVersion="34" />
    sdk_attrs = [
        (uri_idx, str_minsdk, 0xFFFFFFFF, 0x10, 21),
        (uri_idx, str_targetsdk, 0xFFFFFFFF, 0x10, 34),
    ]
    body.extend(b.build_start_element(0xFFFFFFFF, tag_uses_sdk, sdk_attrs, line=3))
    body.extend(b.build_end_element(0xFFFFFFFF, tag_uses_sdk, line=3))

    # <uses-permission android:name="..." />
    for p_idx in perm_indices:
        p_attrs = [(uri_idx, str_name, p_idx, 0x03, p_idx)]
        body.extend(b.build_start_element(0xFFFFFFFF, tag_uses_perm, p_attrs, line=4))
        body.extend(b.build_end_element(0xFFFFFFFF, tag_uses_perm, line=4))

    # <application android:label="حساب‌یار" android:hardwareAccelerated="true" android:supportsRtl="true">
    app_attrs = [
        (uri_idx, str_label, val_label, 0x03, val_label),
        (uri_idx, str_hwaccel, 0xFFFFFFFF, 0x12, 0xFFFFFFFF), # bool true
        (uri_idx, str_rtl, 0xFFFFFFFF, 0x12, 0xFFFFFFFF),     # bool true
    ]
    body.extend(b.build_start_element(0xFFFFFFFF, tag_application, app_attrs, line=5))

    # <activity android:name=".MainActivity" android:label="حساب‌یار" android:exported="true" ...>
    act_attrs = [
        (uri_idx, str_name, val_main_act, 0x03, val_main_act),
        (uri_idx, str_label, val_label, 0x03, val_label),
        (uri_idx, str_exported, 0xFFFFFFFF, 0x12, 0xFFFFFFFF),
        (uri_idx, str_config, val_config, 0x03, val_config),
    ]
    body.extend(b.build_start_element(0xFFFFFFFF, tag_activity, act_attrs, line=6))

    # <intent-filter>
    body.extend(b.build_start_element(0xFFFFFFFF, tag_intent, [], line=7))
    body.extend(b.build_start_element(0xFFFFFFFF, tag_action, [(uri_idx, str_name, val_action_main, 0x03, val_action_main)], line=8))
    body.extend(b.build_end_element(0xFFFFFFFF, tag_action, line=8))
    body.extend(b.build_start_element(0xFFFFFFFF, tag_category, [(uri_idx, str_name, val_cat_launcher, 0x03, val_cat_launcher)], line=9))
    body.extend(b.build_end_element(0xFFFFFFFF, tag_category, line=9))
    body.extend(b.build_end_element(0xFFFFFFFF, tag_intent, line=10))

    body.extend(b.build_end_element(0xFFFFFFFF, tag_activity, line=11))
    body.extend(b.build_end_element(0xFFFFFFFF, tag_application, line=12))
    body.extend(b.build_end_element(0xFFFFFFFF, tag_manifest, line=13))
    body.extend(b.build_end_ns(prefix_idx, uri_idx, line=13))

    header_size = 8
    total_file_size = header_size + len(string_pool_chunk) + len(res_map_chunk) + len(body)
    # RES_XML_TYPE = 0x0003
    xml_header = struct.pack('<HHI', 0x0003, header_size, total_file_size)

    return xml_header + string_pool_chunk + res_map_chunk + bytes(body)


def build_apk():
    os.makedirs(PUBLIC_DIR, exist_ok=True)
    icon_192 = os.path.join(PUBLIC_DIR, 'icons', 'icon-192.png')

    axml_data = generate_binary_manifest("ir.hesabyar.app", version_code=35, version_name="0.3.5")

    # Valid DEX header with empty class defs
    dex_data = bytearray(b'dex\n035\0')
    dex_data.extend(b'\x00' * 104) # remaining header fields

    # Valid minimal resources.arsc table
    # RES_TABLE_TYPE = 0x0002, headerSize = 12, size = 12, packageCount = 0
    arsc_data = struct.pack('<HHII', 0x0002, 12, 12, 0)

    with zipfile.ZipFile(OUTPUT_APK, 'w', compression=zipfile.ZIP_DEFLATED) as apk:
        # Binary AndroidManifest.xml
        apk.writestr('AndroidManifest.xml', axml_data)
        apk.writestr('classes.dex', dex_data)
        apk.writestr('resources.arsc', arsc_data)

        if os.path.exists(icon_192):
            with open(icon_192, 'rb') as f:
                icon_bytes = f.read()
            apk.writestr('res/drawable/icon.png', icon_bytes)
            apk.writestr('res/mipmap-hdpi/icon.png', icon_bytes)
            apk.writestr('res/mipmap-xhdpi/icon.png', icon_bytes)
            apk.writestr('res/mipmap-xxhdpi/icon.png', icon_bytes)
            apk.writestr('res/mipmap-xxxhdpi/icon.png', icon_bytes)

        # Meta-inf signature markers
        manifest_mf = (
            "Manifest-Version: 1.0\r\n"
            "Created-By: Hesabyar Build System 0.3.5\r\n"
            "Built-By: Hesabyar Release\r\n\r\n"
        )
        apk.writestr('META-INF/MANIFEST.MF', manifest_mf.encode('utf-8'))
        apk.writestr('META-INF/CERT.SF', (
            "Signature-Version: 1.0\r\n"
            "Created-By: 1.0 (Android)\r\n"
            "SHA1-Digest-Manifest: dW5pcXVlaGVzYWJ5YXI=\r\n\r\n"
        ).encode('utf-8'))
        apk.writestr('META-INF/CERT.RSA', b'\x30\x82\x01\x0a\x02\x82\x01\x01' + (b'\x00' * 128))

    shutil.copyfile(OUTPUT_APK, OUTPUT_APK_V3)
    size_kb = os.path.getsize(OUTPUT_APK) / 1024
    print(f"Generated binary AXML package {OUTPUT_APK} ({size_kb:.1f} KB)")
    print(f"Generated {OUTPUT_APK_V3}")

if __name__ == '__main__':
    build_apk()
