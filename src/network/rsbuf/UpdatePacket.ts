const BITMASK: readonly number[] = [
    0, 1, 3, 7, 15, 31, 63, 127, 255, 511, 1023, 2047, 4095, 8191, 16383,
    32767, 65535, 131071, 262143, 524287, 1048575, 2097151, 4194303,
    8388607, 16777215, 33554431, 67108863, 134217727, 268435455,
    536870911, 1073741823, 2147483647, 4294967295
] as const;

function byte(value: number): number {
    return value & 0xff;
}

function short(value: number): number {
    return value & 0xffff;
}

export default class UpdatePacket {
    readonly data: Uint8Array;
    private readonly view: DataView;
    pos = 0;
    bitPos = 0;

    constructor(size: number = 5000) {
        this.data = new Uint8Array(size);
        this.view = new DataView(this.data.buffer);
    }

    reset(): void {
        this.pos = 0;
        this.bitPos = 0;
    }

    p1(value: number): void {
        this.view.setUint8(this.pos++, byte(value));
    }

    p1_alt1(value: number): void {
        this.p1(value + 128);
    }

    p1_alt2(value: number): void {
        this.p1(-value);
    }

    p1_alt3(value: number): void {
        this.p1(128 - value);
    }

    p2(value: number): void {
        const narrowed = short(value);
        this.p1(narrowed >> 8);
        this.p1(narrowed);
    }

    p2_alt1(value: number): void {
        const narrowed = short(value);
        this.p1(narrowed);
        this.p1(narrowed >> 8);
    }

    p2_alt2(value: number): void {
        const narrowed = short(value);
        this.p1(narrowed >> 8);
        this.p1(narrowed + 128);
    }

    p2_alt3(value: number): void {
        const narrowed = short(value);
        this.p1(narrowed + 128);
        this.p1(narrowed >> 8);
    }

    p4_alt2(value: number): void {
        const narrowed = value >>> 0;
        this.p1(narrowed >> 8);
        this.p1(narrowed);
        this.p1(narrowed >> 24);
        this.p1(narrowed >> 16);
    }

    pjstr(value: string): void {
        for (let index = 0; index < value.length; index++) {
            this.p1(value.charCodeAt(index));
        }
        this.p1(10);
    }

    pdata(bytes: Uint8Array): void {
        this.data.set(bytes, this.pos);
        this.pos += bytes.length;
    }

    pdataReverseAdd128(bytes: Uint8Array): void {
        for (let index = bytes.length - 1; index >= 0; index--) {
            this.p1((bytes[index] ?? 0) + 128);
        }
    }

    bits(): void {
        this.bitPos = this.pos << 3;
    }

    bytes(): void {
        this.pos = (this.bitPos + 7) >>> 3;
    }

    pBit(width: number, value: number): void {
        let bytePos = this.bitPos >>> 3;
        let remaining = 8 - (this.bitPos & 7);
        this.bitPos += width;

        for (; width > remaining; remaining = 8) {
            const mask = BITMASK[remaining] ?? 0;
            this.data[bytePos] = ((this.data[bytePos] ?? 0) & ~mask) | ((value >>> (width - remaining)) & mask);
            bytePos++;
            width -= remaining;
        }

        const shift = remaining - width;
        const mask = (BITMASK[width] ?? 0) << shift;
        this.data[bytePos] = ((this.data[bytePos] ?? 0) & ~mask) | ((value << shift) & mask);
    }

    append(bytes: Uint8Array): void {
        this.data.set(bytes, this.pos);
        this.pos += bytes.length;
    }

    toUint8Array(): Uint8Array {
        return this.data.slice(0, this.pos);
    }
}
