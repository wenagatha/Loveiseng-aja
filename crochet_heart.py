"""
Crochet Heart - interactive cotton
pip install pygame numpy

Kontrol:
  Mouse   : gerakin ujung benang
  SPACE   : cepat / lambat
  R       : ulang dari awal
  S       : simpan screenshot (crochet_heart.png)
  ESC     : keluar
"""
import math
import random
import numpy as np
import pygame

W, H = 640, 620
CENTER = (W // 2, H // 2 + 10)
UNIT = 10.5                       # piksel per satuan rumus hati
ROW_SCALES = [1.0, 0.84, 0.68]    # tiga baris rajutan (luar -> dalam)
STITCH_STEP = 11                  # jarak antar stitch (px)
BASE_RED = (214, 40, 52)


# ---------- bentuk hati ----------
def heart_points(scale, n=4000):
    t = np.linspace(math.pi, 3 * math.pi, n)           # mulai dari ujung bawah
    x = 16 * np.sin(t) ** 3
    y = 13 * np.cos(t) - 5 * np.cos(2 * t) - 2 * np.cos(3 * t) - np.cos(4 * t)
    px = CENTER[0] + x * UNIT * scale
    py = CENTER[1] - y * UNIT * scale
    return np.stack([px, py], axis=1).astype(np.float32)


def resample(pts, step):
    """Ambil titik tiap `step` px sepanjang kurva (arc-length)."""
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    dist = np.concatenate([[0], np.cumsum(seg)])
    targets = np.arange(0, dist[-1], step)
    xs = np.interp(targets, dist, pts[:, 0])
    ys = np.interp(targets, dist, pts[:, 1])
    return np.stack([xs, ys], axis=1)


def build_path():
    """Semua stitch: (x, y, sudut_derajat, baris)."""
    stitches = []
    for r, s in enumerate(ROW_SCALES):
        p = resample(heart_points(s), STITCH_STEP * (0.85 + 0.15 * s))
        d = np.gradient(p, axis=0)
        ang = np.degrees(np.arctan2(d[:, 1], d[:, 0]))
        for (x, y), a in zip(p, ang):
            stitches.append((float(x), float(y), float(a), r))
    return stitches


# ---------- sprite stitch ----------
def shaded_ellipse(w, h, color):
    s = pygame.Surface((w, h), pygame.SRCALPHA)
    dark = tuple(int(c * 0.35) for c in color)
    steps = 7
    for i in range(steps):
        f = i / (steps - 1)
        c = tuple(int(dark[k] + (color[k] - dark[k]) * f) for k in range(3))
        ix = int(f * w * 0.28)
        iy = int(f * h * 0.30)
        pygame.draw.ellipse(s, c, (ix, iy, w - 2 * ix, h - 2 * iy))
    # highlight serat
    hl = tuple(min(255, int(c * 1.35 + 25)) for c in color)
    pygame.draw.line(s, hl, (w * 0.25, h * 0.45), (w * 0.75, h * 0.40), 1)
    return s


def make_stitch(color):
    """Satu stitch 'V' (dua lilitan miring), arah baris = sumbu +x."""
    size = 30
    surf = pygame.Surface((size, size), pygame.SRCALPHA)
    loop = shaded_ellipse(18, 9, color)
    for sign, off in ((1, -3), (-1, 3)):
        r = pygame.transform.rotate(loop, sign * 38)
        rect = r.get_rect(center=(size // 2 + off, size // 2))
        surf.blit(r, rect)
    return surf


def make_variants(n=8):
    out = []
    for i in range(n):
        k = 0.72 + 0.5 * i / (n - 1)
        col = tuple(max(0, min(255, int(c * k))) for c in BASE_RED)
        out.append(make_stitch(col))
    return out


# ---------- benang (interaktif) ----------
def strand(p0, p1, t, sag):
    mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
    ctrl = (mx + math.sin(t * 1.3) * 12, my + sag + math.sin(t * 0.9) * 8)
    pts = []
    for i in range(33):
        u = i / 32
        x = (1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * ctrl[0] + u ** 2 * p1[0]
        y = (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * ctrl[1] + u ** 2 * p1[1]
        pts.append((x, y))
    return pts


def main(headless_frames=0):
    pygame.init()
    screen = pygame.display.set_mode((W, H))
    pygame.display.set_caption("Crochet Heart — interactive cotton")
    clock = pygame.time.Clock()

    variants = make_variants()
    path = build_path()
    canvas = pygame.Surface((W, H))
    canvas.fill((0, 0, 0))

    idx = 0
    speed = 2
    end = [W - 30, 110]
    frame = 0
    running = True

    while running:
        t = pygame.time.get_ticks() / 1000 if not headless_frames else frame / 60
        for e in pygame.event.get():
            if e.type == pygame.QUIT:
                running = False
            elif e.type == pygame.KEYDOWN:
                if e.key == pygame.K_ESCAPE:
                    running = False
                elif e.key == pygame.K_SPACE:
                    speed = 1 if speed > 1 else 4
                elif e.key == pygame.K_r:
                    canvas.fill((0, 0, 0))
                    idx = 0
                elif e.key == pygame.K_s:
                    pygame.image.save(screen, "crochet_heart.png")

        # tambah stitch baru ke kanvas permanen
        for _ in range(speed):
            if idx < len(path):
                x, y, a, r = path[idx]
                spr = random.choice(variants)
                rot = pygame.transform.rotate(spr, -a)
                canvas.blit(rot, rot.get_rect(center=(x, y)))
                idx += 1

        # ujung benang: ikut mouse, kalau tidak ada gerakan pakai posisi default
        if not headless_frames:
            mx, my = pygame.mouse.get_pos()
            if pygame.mouse.get_focused():
                end[0] += (mx - end[0]) * 0.08
                end[1] += (my - end[1]) * 0.08

        screen.blit(canvas, (0, 0))
        tip = path[min(idx, len(path) - 1)][:2]
        dist = math.hypot(end[0] - tip[0], end[1] - tip[1])
        pts = strand(tip, end, t, sag=min(90, dist * 0.15))
        pygame.draw.lines(screen, (150, 25, 35), False, pts, 4)
        pygame.draw.lines(screen, (235, 85, 95), False, pts, 2)

        pygame.display.flip()
        clock.tick(60)
        frame += 1
        if headless_frames and frame >= headless_frames:
            pygame.image.save(screen, "/home/claude/test.png")
            break

    pygame.quit()


if __name__ == "__main__":
    main()
