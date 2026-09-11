import LocType from '#/cache/config/LocType.js';
import { CoordGrid } from '#/engine/CoordGrid.js';
import { EntityLifeCycle } from '#/engine/entity/EntityLifeCycle.js';
import Loc from '#/engine/entity/Loc.js';
import { changeLocCollision } from '#/engine/GameMap.js';
import World from '#/engine/World.js';
import Zone from '#/engine/zone/Zone.js';

export default class InstanceZone extends Zone {
    source: CoordGrid = { level: 0, x: 0, z: 0 };
    rotation: 0 | 1 | 2 | 3 = 0;
    private copiedFrom = false;

    get hasAssignedTemplate(): boolean {
        return this.copiedFrom;
    }

    copyFromZone(sourceZone: Zone, rotation: 0 | 1 | 2 | 3): void {
        this.assignSource(sourceZone.level, sourceZone.x, sourceZone.z, rotation);
        this.copyLocsWithRotation(sourceZone, rotation);
    }

    assignTemplate(source: CoordGrid, rotation: 0 | 1 | 2 | 3): void {
        this.assignSource(source.level, source.x >> 3, source.z >> 3, rotation);
    }

    private assignSource(sourceLevel: number, sourceZoneX: number, sourceZoneZ: number, rotation: 0 | 1 | 2 | 3): void {
        if (this.copiedFrom) {
            throw new Error('InstanceZone has already been copied from a source');
        }

        this.source = { level: sourceLevel, x: sourceZoneX, z: sourceZoneZ };
        this.rotation = rotation;
        this.copiedFrom = true;
    }

    private copyLocsWithRotation(sourceZone: Zone, rotation: 0 | 1 | 2 | 3): void {
        for (const sourceLoc of sourceZone.getAllLocsSafe()) {
            const sourceWidth = sourceLoc.width;
            const sourceLength = sourceLoc.length;
            let width = sourceWidth;
            let length = sourceLength;

            const localX = sourceLoc.x - (sourceZone.x << 3);
            const localZ = sourceLoc.z - (sourceZone.z << 3);

            let rotatedX = localX;
            let rotatedZ = localZ;
            if (rotation === 1) {
                rotatedX = 8 - localZ - sourceLength;
                rotatedZ = localX;
                [width, length] = [length, width];
            } else if (rotation === 2) {
                rotatedX = 8 - localX - sourceWidth;
                rotatedZ = 8 - localZ - sourceLength;
            } else if (rotation === 3) {
                rotatedX = localZ;
                rotatedZ = 8 - localX - sourceWidth;
                [width, length] = [length, width];
            }

            const angle = ((sourceLoc.angle + rotation) & 0x3) as 0 | 1 | 2 | 3;
            const x = (this.x << 3) + rotatedX;
            const z = (this.z << 3) + rotatedZ;

            if (!World.gameMap.hasZone(x, z, this.level)) {
                throw new Error(`Instance loc out of bounds: source=(${sourceLoc.x},${sourceLoc.z},L${sourceLoc.level}) rotated=(${x},${z},L${this.level}) has no destination zone`);
            }

            const loc = new Loc(this.level, x, z, width, length, sourceLoc.lifecycle, sourceLoc.type, sourceLoc.shape, angle);

            if (sourceLoc.lifecycle === EntityLifeCycle.DESPAWN) {
                World.addLoc(loc, 0);
                continue;
            }

            const destinationZone = World.gameMap.getZone(x, z, this.level);
            destinationZone.addStaticLoc(loc);

            const locType = LocType.get(loc.type);
            if (locType.blockwalk) {
                changeLocCollision(loc.shape, loc.angle, locType.blockrange, loc.length, loc.width, locType.active, loc.x, loc.z, loc.level, true);
            }
        }
    }
}
