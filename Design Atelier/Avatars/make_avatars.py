"""Default profile avatars in our Material You style (founder ask, 2026-10-25).
18 original, copyright-free SVGs drawn in code: 5 men, 5 women, 5 kids, 3 fun (cat, robot, panda).
Run: python make_avatars.py  -> svg/<id>.svg + preview.html
Colours come from the Material You Theme palette (Design Atelier/Material You Theme/tokens.json).
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'svg')
os.makedirs(OUT, exist_ok=True)

P = dict(cream='#FFF4E6', paper='#FBF8EB', ink='#2B1712', cocoa='#5A2E1E', tomato='#F24E1E', tomatoDeep='#B83A12',
         bubblegum='#FFC2E2', cherry='#C21D5F', sky='#A9DCFF', cobalt='#2F55C4', plum='#4A1430', wine='#7A1838',
         forest='#1F5A3A', butter='#FFE79A', marigold='#EAB04A', white='#FFFFFF')
SKIN = dict(s1='#F9D7C4', s2='#EDB98A', s3='#D08B5B', s4='#AE5D29', s5='#8D4A2B', s6='#5C3317')
HAIR = dict(black='#2B1712', cocoa='#5A2E1E', auburn='#8A4B2A', blonde='#E8B04A', grey='#BDB7B1', red='#B83A12', plum='#4A1430')


def shade(hex_, k):
    """darken (k<1) or lighten (k>1) a hex colour"""
    h = hex_.lstrip('#'); r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    f = (lambda c: max(0, min(255, int(c * k)))) if k < 1 else (lambda c: max(0, min(255, int(c + (255 - c) * (k - 1)))))
    return '#%02X%02X%02X' % (f(r), f(g), f(b))


def frame(bg, deco, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">'
            f'<defs><clipPath id="c"><circle cx="128" cy="128" r="128"/></clipPath></defs>'
            f'<g clip-path="url(#c)"><rect width="256" height="256" fill="{bg}"/>{deco}{body}</g></svg>')


def deco_shape(kind, color):
    if kind == 'cookie':   # scalloped seal behind the head (theme shape library idea)
        import math
        pts = []
        for i in range(48):
            a = i / 48 * 2 * math.pi
            r = 96 + (8 if i % 2 == 0 else 0)
            pts.append(f'{128 + r * math.cos(a):.1f},{120 + r * math.sin(a):.1f}')
        return f'<polygon points="{" ".join(pts)}" fill="{color}"/>'
    if kind == 'blob':
        return f'<path d="M40 70 C70 20 190 20 220 80 C250 140 210 200 140 196 C70 192 10 120 40 70 Z" fill="{color}"/>'
    if kind == 'ring':
        return f'<circle cx="128" cy="118" r="96" fill="none" stroke="{color}" stroke-width="18"/>'
    return f'<circle cx="190" cy="60" r="70" fill="{color}"/>'


def person(skin, shirt, hair_back='', hair_front='', extra_back='', extra_front='', kid=False, eyes='open',
           brows=True, beard='', glasses='', mouth='smile', cheeks=True, freckles=False, earrings='', ears=True,
           jaw=False, stubble=False):
    s = SKIN.get(skin, skin)
    sd = shade(s, 0.86)
    hx, hy, rx, ry = (128, 124, 54, 56) if kid else (128, 116, 48, 54)
    sh_top = 200 if kid else 186
    parts = [extra_back, hair_back]
    # shoulders + collar
    parts.append(f'<path d="M24 256 C30 {sh_top + 14} 80 {sh_top} 128 {sh_top} C176 {sh_top} 226 {sh_top + 14} 232 256 Z" fill="{shirt}"/>')
    parts.append(f'<path d="M108 {sh_top + 2} Q128 {sh_top + 22} 148 {sh_top + 2}" fill="none" stroke="{shade(shirt, 0.8)}" stroke-width="6" stroke-linecap="round"/>')
    # neck
    parts.append(f'<rect x="{hx - 17}" y="{hy + ry - 22}" width="34" height="{sh_top - (hy + ry - 22) + 6}" rx="14" fill="{sd}"/>')
    # ears
    if ears:
        for ex in (hx - rx + 2, hx + rx - 2):
            parts.append(f'<circle cx="{ex}" cy="{hy + 6}" r="11" fill="{s}"/><circle cx="{ex}" cy="{hy + 6}" r="5" fill="{sd}"/>')
    # head
    if jaw:   # squarer, defined jawline for the men
        parts.append(f'<path d="M{hx - rx} {hy} C{hx - rx} {hy - ry * 0.9:.0f} {hx - rx * 0.5:.0f} {hy - ry} {hx} {hy - ry} C{hx + rx * 0.5:.0f} {hy - ry} {hx + rx} {hy - ry * 0.9:.0f} {hx + rx} {hy} '
                     f'C{hx + rx} {hy + ry * 0.62:.0f} {hx + rx * 0.5:.0f} {hy + ry} {hx} {hy + ry} C{hx - rx * 0.5:.0f} {hy + ry} {hx - rx} {hy + ry * 0.62:.0f} {hx - rx} {hy} Z" fill="{s}"/>')
        parts.append(f'<path d="M{hx - rx + 8} {hy + 30} Q{hx} {hy + ry + 6} {hx + rx - 8} {hy + 30}" fill="none" stroke="{shade(s, 0.9)}" stroke-width="3" opacity=".7"/>')
    else:
        parts.append(f'<ellipse cx="{hx}" cy="{hy}" rx="{rx}" ry="{ry}" fill="{s}"/>')
    if stubble:   # light designer stubble along the jaw
        parts.append(f'<path d="M{hx - rx + 5} {hy + 12} C{hx - rx + 8} {hy + ry - 2} {hx - 16} {hy + ry} {hx} {hy + ry} C{hx + 16} {hy + ry} {hx + rx - 8} {hy + ry - 2} {hx + rx - 5} {hy + 12} '
                     f'C{hx + 22} {hy + 36} {hx - 22} {hy + 36} {hx - rx + 5} {hy + 12} Z" fill="{shade(s, 0.55)}" opacity=".28"/>')
    if earrings:
        for ex in (hx - rx + 2, hx + rx - 2):
            parts.append(f'<circle cx="{ex}" cy="{hy + 22}" r="5" fill="{earrings}"/>')
    if beard:
        parts.append(beard)
    # face
    ey = hy + 4
    exl, exr = hx - 18, hx + 18
    if cheeks:
        parts.append(f'<ellipse cx="{hx - 30}" cy="{ey + 18}" rx="9" ry="6" fill="#FF8FB4" opacity=".55"/><ellipse cx="{hx + 30}" cy="{ey + 18}" rx="9" ry="6" fill="#FF8FB4" opacity=".55"/>')
    if freckles:
        for dx, dy in ((-34, 12), (-28, 16), (-38, 18), (34, 12), (28, 16), (38, 18)):
            parts.append(f'<circle cx="{hx + dx}" cy="{ey + dy}" r="1.8" fill="{shade(s, 0.7)}"/>')
    if eyes == 'happy':
        for x in (exl, exr):
            parts.append(f'<path d="M{x - 7} {ey + 2} Q{x} {ey - 6} {x + 7} {ey + 2}" fill="none" stroke="{P["ink"]}" stroke-width="4.5" stroke-linecap="round"/>')
    else:
        r = 7 if kid else 5.5
        for x in (exl, exr):
            parts.append(f'<ellipse cx="{x}" cy="{ey}" rx="{r}" ry="{r + 1}" fill="{P["ink"]}"/><circle cx="{x + 2}" cy="{ey - 2.5}" r="{r * 0.38:.1f}" fill="#fff"/>')
    if brows:
        for x, d in ((exl, -1), (exr, 1)):
            parts.append(f'<path d="M{x - 8} {ey - 14 + d} Q{x} {ey - 19} {x + 8} {ey - 14 - d}" fill="none" stroke="{shade(s, 0.45)}" stroke-width="4" stroke-linecap="round"/>')
    parts.append(f'<path d="M{hx - 3} {ey + 10} Q{hx} {ey + 17} {hx + 4} {ey + 12}" fill="none" stroke="{shade(s, 0.7)}" stroke-width="3.5" stroke-linecap="round"/>')
    my = ey + 26
    if mouth == 'open':
        parts.append(f'<path d="M{hx - 13} {my} Q{hx} {my + 18} {hx + 13} {my} Z" fill="{P["wine"]}"/><path d="M{hx - 7} {my + 8} Q{hx} {my + 13} {hx + 7} {my + 8} Z" fill="#FF8FB4"/>')
    else:
        parts.append(f'<path d="M{hx - 12} {my} Q{hx} {my + 12} {hx + 12} {my}" fill="none" stroke="{P["ink"]}" stroke-width="4.5" stroke-linecap="round"/>')
    if glasses:
        g = glasses
        parts.append(f'<g fill="none" stroke="{g}" stroke-width="4"><rect x="{exl - 13}" y="{ey - 10}" width="26" height="21" rx="9"/>'
                     f'<rect x="{exr - 13}" y="{ey - 10}" width="26" height="21" rx="9"/><path d="M{exl + 13} {ey - 1} Q{hx} {ey - 6} {exr - 13} {ey - 1}"/></g>')
    parts.append(hair_front)
    parts.append(extra_front)
    return ''.join(parts)


H = lambda c: HAIR.get(c, c)

AV = []

# ---------------- men ----------------
def quiff(color, fade):
    """modern quiff: tall swept front, short faded sides"""
    return (f'<path d="M82 104 C80 92 80 84 84 78 L88 104 Z M174 104 C176 92 176 84 172 78 L168 104 Z" fill="{fade}"/>'
            f'<path d="M84 96 C82 62 104 44 132 40 C160 36 182 50 178 82 C176 92 172 98 170 100 C166 84 152 76 136 74 '
            f'C146 66 142 56 128 60 C110 64 96 76 84 96 Z" fill="{color}"/>')


AV.append(('man_1', 'Man, modern quiff', frame(P['tomato'], deco_shape('cookie', shade(P['tomato'], 1.18)), person(
    's1', P['butter'], jaw=True, hair_front=quiff(H('cocoa'), shade(H('cocoa'), 1.25))))))
AV.append(('man_2', 'Man, high-top fade', frame(P['sky'], deco_shape('blob', shade(P['sky'], 1.25)), person(
    's6', P['tomato'], jaw=True, stubble=True,
    hair_front=(f'<path d="M84 100 C82 86 84 78 88 74 L92 100 Z M172 100 C174 86 172 78 168 74 L164 100 Z" fill="#3B2A24"/>'
                f'<rect x="88" y="34" width="80" height="52" rx="20" fill="{H("black")}"/>'
                f'<path d="M96 52 h64 M94 66 h68" stroke="#3B2A24" stroke-width="3" opacity=".6"/>')))))
AV.append(('man_3', 'Man, glasses and stubble', frame(P['butter'], deco_shape('ring', shade(P['butter'], 0.9)), person(
    's3', P['forest'], glasses=P['ink'], jaw=True, stubble=True,
    hair_front=(f'<path d="M82 104 C80 66 118 50 150 56 C174 62 180 86 176 102 C164 80 140 72 112 80 C98 86 88 94 82 104 Z" fill="{H("black")}"/>'
                f'<path d="M110 62 C130 54 156 58 170 74" fill="none" stroke="{shade(H("black"), 1.6)}" stroke-width="3" stroke-linecap="round" opacity=".7"/>')))))
AV.append(('man_4', 'Man, beanie', frame(P['wine'], deco_shape('cookie', shade(P['wine'], 1.45)), person(
    's4', P['cobalt'], mouth='open', jaw=True,
    hair_front=(f'<path d="M76 104 C72 56 108 40 130 40 C156 40 186 56 180 104 C168 94 148 88 128 88 C108 88 88 94 76 104 Z" fill="{P["tomato"]}"/>'
                f'<rect x="72" y="92" width="112" height="20" rx="10" fill="{shade(P["tomato"], 0.82)}"/>'
                f'<circle cx="128" cy="38" r="11" fill="{P["butter"]}"/>')))))
AV.append(('man_5', 'Man, silver hair', frame(P['bubblegum'], deco_shape('blob', shade(P['bubblegum'], 1.12)), person(
    's2', P['plum'], glasses=P['cocoa'], eyes='happy', jaw=True, stubble=True,
    hair_front=quiff(H('grey'), shade(H('grey'), 1.15))))))

# ---------------- women ----------------
AV.append(('woman_1', 'Woman, long hair', frame(P['cobalt'], deco_shape('cookie', shade(P['cobalt'], 1.25)), person(
    's3', P['butter'],
    hair_back=f'<path d="M70 110 C66 50 190 50 186 110 L192 224 C170 232 86 232 64 224 Z" fill="{H("black")}"/>',
    hair_front=f'<path d="M78 112 C76 64 120 50 150 58 C176 66 182 92 178 112 C170 84 150 74 128 74 C106 80 90 92 78 112 Z" fill="{H("black")}"/>',
    earrings=P['marigold']))))
AV.append(('woman_2', 'Woman, top bun', frame(P['forest'], deco_shape('ring', shade(P['forest'], 1.35)), person(
    's1', P['bubblegum'], earrings=P['butter'],
    extra_back=f'<circle cx="128" cy="50" r="24" fill="{H("auburn")}"/>',
    hair_front=f'<path d="M80 110 C76 66 116 52 146 58 C174 64 182 92 176 110 C168 86 150 76 128 76 C104 78 88 90 80 110 Z" fill="{H("auburn")}"/>'))))
AV.append(('woman_3', 'Woman, ponytail', frame(P['butter'], deco_shape('blob', shade(P['butter'], 1.15)), person(
    's2', P['tomato'], eyes='happy', earrings=P['cobalt'],
    extra_back=(f'<path d="M168 70 C214 70 222 130 196 176 C190 150 184 118 162 96 Z" fill="{H("cocoa")}"/>'
                f'<circle cx="170" cy="74" r="9" fill="{P["cobalt"]}"/>'),
    hair_front=f'<path d="M78 112 C74 64 118 50 150 58 C176 64 184 90 180 110 C166 86 146 76 124 78 C102 82 86 94 78 112 Z" fill="{H("cocoa")}"/>'))))
AV.append(('woman_4', 'Woman, curly hair', frame(P['marigold'], deco_shape('cookie', shade(P['marigold'], 1.2)), person(
    's6', P['cherry'],
    hair_back=''.join(f'<circle cx="{x}" cy="{y}" r="22" fill="{H("black")}"/>' for x, y in
                      ((74, 92), (90, 66), (116, 52), (142, 52), (168, 66), (184, 92), (70, 122), (186, 122), (78, 150), (178, 150))),
    hair_front=''.join(f'<circle cx="{x}" cy="{y}" r="15" fill="{H("black")}"/>' for x, y in ((98, 78), (122, 70), (146, 72), (164, 86))),
    earrings=P['butter']))))
AV.append(('woman_5', 'Woman, bob and glasses', frame(P['sky'], deco_shape('ring', shade(P['sky'], 0.88)), person(
    's1', P['forest'], glasses=P['wine'], freckles=True,
    hair_back=f'<path d="M72 104 C68 52 188 52 184 104 L186 158 C170 164 86 164 70 158 Z" fill="{H("red")}"/>',
    hair_front=f'<path d="M76 116 C74 64 120 52 148 58 C176 64 182 92 180 116 C164 92 140 80 112 84 C96 90 84 100 76 116 Z" fill="{H("red")}"/>'))))

# ---------------- kids ----------------
AV.append(('kid_1', 'Boy with cap', frame(P['tomato'], deco_shape('blob', shade(P['tomato'], 1.2)), person(
    's2', P['sky'], kid=True, mouth='open',
    hair_front=(f'<path d="M72 108 C70 58 186 58 184 108 C170 96 150 90 128 90 C106 90 86 96 72 108 Z" fill="{P["cobalt"]}"/>'
                f'<path d="M72 108 C58 108 46 116 44 124 C70 116 96 110 128 108 Z" fill="{shade(P["cobalt"], 0.8)}"/>'
                f'<circle cx="128" cy="62" r="6" fill="{P["butter"]}"/>')))))
AV.append(('kid_2', 'Girl with pigtails', frame(P['bubblegum'], deco_shape('cookie', shade(P['bubblegum'], 1.12)), person(
    's3', P['cobalt'], kid=True,
    extra_back=(f'<circle cx="62" cy="100" r="22" fill="{H("cocoa")}"/><circle cx="194" cy="100" r="22" fill="{H("cocoa")}"/>'
                f'<path d="M70 80 l-14 -8 l2 18 Z M186 80 l14 -8 l-2 18 Z" fill="{P["tomato"]}"/>'),
    hair_front=f'<path d="M72 112 C70 62 120 50 150 58 C180 66 188 94 184 112 C170 88 150 78 128 80 C102 82 84 94 72 112 Z" fill="{H("cocoa")}"/>'))))
AV.append(('kid_3', 'Toddler, big smile', frame(P['butter'], deco_shape('ring', shade(P['butter'], 0.9)), person(
    's6', P['forest'], kid=True, eyes='happy', mouth='open',
    hair_front=''.join(f'<circle cx="{x}" cy="{y}" r="11" fill="{H("black")}"/>' for x, y in ((116, 72), (130, 66), (144, 72)))))))
AV.append(('kid_4', 'Kid with headphones', frame(P['cobalt'], deco_shape('blob', shade(P['cobalt'], 1.28)), person(
    's4', P['marigold'], kid=True,
    hair_front=(f'<path d="M74 108 C72 64 120 54 150 60 C178 66 186 92 182 108 C168 88 148 82 126 84 C104 86 86 94 74 108 Z" fill="{H("black")}"/>'
                f'<path d="M68 126 C62 54 194 54 188 126" fill="none" stroke="{P["tomato"]}" stroke-width="10" stroke-linecap="round"/>'
                f'<rect x="56" y="112" width="22" height="36" rx="10" fill="{P["tomato"]}"/><rect x="178" y="112" width="22" height="36" rx="10" fill="{P["tomato"]}"/>')))))
AV.append(('kid_5', 'Girl with braids', frame(P['forest'], deco_shape('cookie', shade(P['forest'], 1.35)), person(
    's1', P['butter'], kid=True, freckles=True,
    extra_back=''.join(f'<circle cx="{x}" cy="{y}" r="10" fill="{H("blonde")}"/>' for x in (72, 184) for y in (132, 152, 172, 192)),
    hair_front=f'<path d="M72 114 C70 62 120 52 150 58 C180 66 188 94 184 114 C170 90 150 80 128 82 C104 84 84 96 72 114 Z" fill="{H("blonde")}"/>'))))

# ---------------- fun ----------------
cat = (f'<path d="M64 98 L72 40 L108 76 Z M192 98 L184 40 L148 76 Z" fill="{P["marigold"]}"/><path d="M76 82 L80 56 L98 74 Z M180 82 L176 56 L158 74 Z" fill="{P["bubblegum"]}"/>'
       f'<ellipse cx="128" cy="130" rx="70" ry="62" fill="{P["marigold"]}"/><path d="M60 236 C70 196 186 196 196 236 L196 256 L60 256 Z" fill="{P["marigold"]}"/>'
       f'<ellipse cx="104" cy="124" rx="8" ry="10" fill="{P["ink"]}"/><ellipse cx="152" cy="124" rx="8" ry="10" fill="{P["ink"]}"/>'
       f'<circle cx="107" cy="120" r="3" fill="#fff"/><circle cx="155" cy="120" r="3" fill="#fff"/>'
       f'<path d="M122 142 L134 142 L128 150 Z" fill="{P["cherry"]}"/><path d="M128 150 Q118 162 108 156 M128 150 Q138 162 148 156" fill="none" stroke="{P["ink"]}" stroke-width="4" stroke-linecap="round"/>'
       f'<path d="M70 140 L40 134 M70 148 L40 152 M186 140 L216 134 M186 148 L216 152" stroke="{P["ink"]}" stroke-width="3" stroke-linecap="round"/>')
AV.append(('fun_cat', 'Cat', frame(P['plum'], deco_shape('cookie', shade(P['plum'], 1.5)), cat)))
robot = (f'<rect x="122" y="36" width="12" height="26" rx="6" fill="{P["ink"]}"/><circle cx="128" cy="34" r="10" fill="{P["tomato"]}"/>'
         f'<rect x="62" y="62" width="132" height="116" rx="34" fill="{P["paper"]}"/><rect x="78" y="86" width="100" height="56" rx="24" fill="{P["ink"]}"/>'
         f'<circle cx="108" cy="114" r="11" fill="{P["sky"]}"/><circle cx="148" cy="114" r="11" fill="{P["sky"]}"/>'
         f'<path d="M110 158 Q128 168 146 158" fill="none" stroke="{P["cobalt"]}" stroke-width="5" stroke-linecap="round"/>'
         f'<rect x="48" y="104" width="16" height="34" rx="8" fill="{P["tomato"]}"/><rect x="192" y="104" width="16" height="34" rx="8" fill="{P["tomato"]}"/>'
         f'<path d="M50 256 C56 206 200 206 206 256 Z" fill="{P["cobalt"]}"/><circle cx="128" cy="232" r="10" fill="{P["butter"]}"/>')
AV.append(('fun_robot', 'Robot', frame(P['sky'], deco_shape('blob', shade(P['sky'], 1.25)), robot)))
panda = (f'<circle cx="74" cy="72" r="24" fill="{P["ink"]}"/><circle cx="182" cy="72" r="24" fill="{P["ink"]}"/>'
         f'<ellipse cx="128" cy="128" rx="72" ry="66" fill="{P["white"]}"/><path d="M58 256 C66 200 190 200 198 256 Z" fill="{P["ink"]}"/>'
         f'<ellipse cx="100" cy="124" rx="18" ry="22" fill="{P["ink"]}" transform="rotate(-20 100 124)"/><ellipse cx="156" cy="124" rx="18" ry="22" fill="{P["ink"]}" transform="rotate(20 156 124)"/>'
         f'<circle cx="103" cy="122" r="6" fill="#fff"/><circle cx="153" cy="122" r="6" fill="#fff"/>'
         f'<ellipse cx="128" cy="150" rx="10" ry="7" fill="{P["ink"]}"/><path d="M118 162 Q128 172 138 162" fill="none" stroke="{P["ink"]}" stroke-width="4" stroke-linecap="round"/>'
         f'<ellipse cx="84" cy="152" rx="9" ry="6" fill="#FF8FB4" opacity=".6"/><ellipse cx="172" cy="152" rx="9" ry="6" fill="#FF8FB4" opacity=".6"/>')
AV.append(('fun_panda', 'Panda', frame(P['forest'], deco_shape('ring', shade(P['forest'], 1.4)), panda)))

for aid, label, svg in AV:
    with open(os.path.join(OUT, f'{aid}.svg'), 'w', encoding='utf-8') as f:
        f.write(svg)

cards = ''.join(f'<figure><img src="svg/{a}.svg" alt="{l}"><figcaption>{l}</figcaption></figure>' for a, l, _ in AV)
with open(os.path.join(HERE, 'preview.html'), 'w', encoding='utf-8') as f:
    f.write('<!doctype html><meta charset="utf-8"><title>Avatars</title><style>body{margin:0;padding:28px;background:#FFF4E6;'
            'font:14px system-ui;color:#2B1712}h1{margin:0 0 18px}div{display:grid;grid-template-columns:repeat(6,1fr);gap:18px}'
            'figure{margin:0;text-align:center}img{width:140px;height:140px;border-radius:50%;box-shadow:0 6px 0 #2B171222}'
            'figcaption{margin-top:8px}</style><h1>Default avatars (Material You)</h1><div>' + cards + '</div>')
print('wrote', len(AV), 'avatars to', OUT)
