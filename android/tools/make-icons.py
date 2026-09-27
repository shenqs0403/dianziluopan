#!/usr/bin/env python3
"""生成 Android 启动图标 PNG（Android 7/8 用不到 adaptive-icon，需要各密度位图）。

不依赖 PIL：直接用 zlib + struct 写 PNG，形状用 3x 超采样抗锯齿。
用法：python3 tools/make-icons.py
"""
import math
import os
import struct
import zlib

DENSITIES = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
BG = (0x7A, 0x14, 0x10)
GOLD = (0xE8, 0xC8, 0x8A)
RED = (0xE2, 0x3B, 0x2E)
WHITE = (0xF3, 0xEA, 0xD8)
SS = 3  # 超采样倍数


def _png(width, height, rows):
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(row) for row in rows)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


def _sample(x, y, size):
    """返回该点在 (size) 画布上的颜色，坐标为像素中心，单位 0~1。"""
    cx, cy = 0.5, 0.5
    dx, dy = x - cx, y - cy
    r = math.hypot(dx, dy)
    if r > 0.5:
        return None
    if abs(r - 0.36) < 0.022:            # 外圈
        return GOLD
    if abs(dx) < 0.008 or abs(dy) < 0.008:  # 十字线
        return GOLD
    if r < 0.075:                        # 天池
        return BG
    if r < 0.09:
        return GOLD
    if dy < 0:                           # 北针
        if abs(dx) < 0.05 * (1 + dy * 4) and r < 0.30:
            return RED
    else:                                # 南针
        if abs(dx) < 0.05 * (1 - dy * 4) and r < 0.30:
            return WHITE
    return None


def render(size):
    rows = []
    inv = 1.0 / (size * SS)
    for py in range(size):
        row = bytearray()
        for px in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    ux = (px * SS + sx + 0.5) * inv
                    uy = (py * SS + sy + 0.5) * inv
                    c = _sample(ux, uy, size)
                    if c:
                        acc[0] += c[0]
                        acc[1] += c[1]
                        acc[2] += c[2]
                        acc[3] += 255
            n = SS * SS
            a = acc[3] // n
            if a == 0:
                row += bytes((0, 0, 0, 0))
            else:
                # 未覆盖区域按背景色（深红）铺满，避免启动器看到透明方块
                covered = acc[3] // 255
                base = BG
                mix = covered / n
                row += bytes(
                    (
                        int(acc[0] / covered * mix + base[0] * (1 - mix)),
                        int(acc[1] / covered * mix + base[1] * (1 - mix)),
                        int(acc[2] / covered * mix + base[2] * (1 - mix)),
                        255,
                    )
                )
        rows.append(row)
    return _png(size, size, rows)


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    res = os.path.join(here, "..", "app", "src", "main", "res")
    for name, size in DENSITIES.items():
        folder = os.path.join(res, f"mipmap-{name}")
        os.makedirs(folder, exist_ok=True)
        for fn in ("ic_launcher.png", "ic_launcher_round.png"):
            with open(os.path.join(folder, fn), "wb") as f:
                f.write(render(size))
        print(f"mipmap-{name} {size}x{size} 完成")


if __name__ == "__main__":
    main()
