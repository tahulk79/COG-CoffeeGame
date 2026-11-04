# Compare two PNG screenshots (same size) without dependencies. Usage: imgdiff.py before.png after.png
# Prints mean abs RGB diff (/255) and % of sampled pixels off by > 24; animated particles keep a small baseline.
import struct, sys, zlib
def load(p):
    b = open(p, 'rb').read(); w, h = struct.unpack('>II', b[16:24]); bpp = 4 if b[25] == 6 else 3; i = 8; data = b''
    while i < len(b):
        n = struct.unpack('>I', b[i:i+4])[0]
        if b[i+4:i+8] == b'IDAT': data += b[i+8:i+8+n]
        i += 12 + n
    raw = zlib.decompress(data); stride = w * bpp; rows = []; prev = bytearray(stride); p = 0
    for _ in range(h):
        f = raw[p]; line = bytearray(raw[p+1:p+1+stride]); p += 1 + stride
        for x in range(stride):
            a = line[x-bpp] if x >= bpp else 0; up = prev[x]; c = prev[x-bpp] if x >= bpp else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + up) & 255
            elif f == 3: line[x] = (line[x] + (a + up) // 2) & 255
            elif f == 4:
                pa, pb, pc = abs(up - c), abs(a - c), abs(a + up - 2 * c)
                line[x] = (line[x] + (a if pa <= pb and pa <= pc else up if pb <= pc else c)) & 255
        rows.append(bytes(line)); prev = line
    return w, h, bpp, rows
w, h, bpp, A = load(sys.argv[1]); _, _, _, B = load(sys.argv[2]); total = big = n = 0
for y in range(0, h, 2):
    for x in range(0, w * bpp, bpp * 2):
        d = max(abs(A[y][x+k] - B[y][x+k]) for k in range(3)); n += 1; total += d; big += d > 24
print(f'{w}x{h} mean abs diff {total/n:.2f}/255, pixels >24 off: {big/n*100:.2f}%')
