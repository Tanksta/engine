import { CoordGrid } from '#/engine/CoordGrid.js';
import { allocateZoneIfAbsent, deallocateZoneIfPresent, isZoneAllocated } from '#/engine/GameMap.js';
import World from '#/engine/World.js';
import InstanceZone from '#/engine/zone/InstanceZone.js';
import ZoneMap from '#/engine/zone/ZoneMap.js';
import { printDebug } from '#/util/Logger.js';

type InstanceRecord = {
    uid: number;
    sw: CoordGrid;
    floors: number;
    zonesEast: number;
    zonesNorth: number;
    exitCoord: CoordGrid | null;
};

export default class InstanceController {
    static readonly FIRST_INSTANCE_SW_MAPSQUARE = 25857; // m101_1
    static readonly INSTANCES_PER_ROW = 32;
    static readonly INSTANCE_ROWS = 64;
    static readonly TOTAL_INSTANCES = InstanceController.INSTANCES_PER_ROW * InstanceController.INSTANCE_ROWS;
    static readonly INSTANCE_SIZE_TILES = 128;
    static readonly INSTANCE_GAP_TILES = 64;
    static readonly INSTANCE_SW_STRIDE_TILES = InstanceController.INSTANCE_SIZE_TILES + InstanceController.INSTANCE_GAP_TILES;

    nextInstancePointer = 0;
    readonly instances: InstanceRecord[] = [];

    createInstance(floors: number, zonesEast: number, zonesNorth: number): CoordGrid {
        this.clearStaleInstances();
        this.findNextSlot();

        const slotX = this.nextInstancePointer % InstanceController.INSTANCES_PER_ROW;
        const slotZ = Math.trunc(this.nextInstancePointer / InstanceController.INSTANCES_PER_ROW);
        const firstMapsquareX = InstanceController.FIRST_INSTANCE_SW_MAPSQUARE >> 8;
        const firstMapsquareZ = InstanceController.FIRST_INSTANCE_SW_MAPSQUARE & 0xff;
        const baseTileX = (firstMapsquareX << 6) + slotX * InstanceController.INSTANCE_SW_STRIDE_TILES;
        const baseTileZ = (firstMapsquareZ << 6) + slotZ * InstanceController.INSTANCE_SW_STRIDE_TILES;
        const uid = this.nextInstancePointer;
        const sw = { level: 0, x: baseTileX, z: baseTileZ };

        this.instances.push({ uid, sw, floors, zonesEast, zonesNorth, exitCoord: null });
        this.incrementSlotPointer();
        return sw;
    }

    copyZone(instanceSw: CoordGrid, instanceOffset: CoordGrid, source: CoordGrid, rotation: 0 | 1 | 2 | 3): void {
        const instance = this.instances.find(candidate => candidate.sw.level === instanceSw.level && candidate.sw.x === instanceSw.x && candidate.sw.z === instanceSw.z);
        if (!instance) {
            throw new Error(`copyZone failed: instance not found at sw=(${instanceSw.x}, ${instanceSw.z}, L${instanceSw.level})`);
        }

        if (instanceOffset.level < 0 || instanceOffset.level >= instance.floors || instanceOffset.x < 0 || instanceOffset.x >= instance.zonesEast || instanceOffset.z < 0 || instanceOffset.z >= instance.zonesNorth) {
            throw new Error(`copyZone out of bounds: offset=(${instanceOffset.x}, ${instanceOffset.z}, L${instanceOffset.level}) size=(${instance.zonesEast}, ${instance.zonesNorth}, floors=${instance.floors})`);
        }

        const target = {
            level: instanceSw.level + instanceOffset.level,
            x: instanceSw.x + (instanceOffset.x << 3),
            z: instanceSw.z + (instanceOffset.z << 3)
        };

        World.gameMap.setMultiZone(ZoneMap.zoneIndex(target.x, target.z, target.level), World.gameMap.isMultiZone(ZoneMap.zoneIndex(source.x, source.z, source.level)));

        const targetZone = this.ensureInstanceZone(target.x, target.z, target.level);
        const sourceZone = World.gameMap.getZoneIfExists(source.x, source.z, source.level);
        if (!sourceZone) {
            targetZone.assignTemplate(source, rotation);
            return;
        }

        targetZone.copyFromZone(sourceZone, rotation);
    }

    isInstanceEmpty(instance: InstanceRecord): boolean {
        for (let level = 0; level < instance.floors; level++) {
            const actualLevel = instance.sw.level + level;
            for (let east = 0; east < instance.zonesEast; east++) {
                for (let north = 0; north < instance.zonesNorth; north++) {
                    const x = instance.sw.x + (east << 3);
                    const z = instance.sw.z + (north << 3);
                    const zone = World.gameMap.getZoneIfExists(x, z, actualLevel);
                    if (zone?.hasPlayers()) {
                        return false;
                    }
                }
            }
        }

        return true;
    }

    findInstanceByCoord(coord: CoordGrid): InstanceRecord | null {
        return this.findInstanceByTile(coord.level, coord.x, coord.z);
    }

    findInstanceByTile(level: number, x: number, z: number): InstanceRecord | null {
        for (const instance of this.instances) {
            if (level >= instance.sw.level && level < instance.sw.level + instance.floors && x >= instance.sw.x && x < instance.sw.x + (instance.zonesEast << 3) && z >= instance.sw.z && z < instance.sw.z + (instance.zonesNorth << 3)) {
                return instance;
            }
        }
        return null;
    }

    findInstanceByUid(uid: number): InstanceRecord | null {
        return this.instances.find(instance => instance.uid === uid) ?? null;
    }

    private clearStaleInstances(): void {
        for (let index = this.instances.length - 1; index >= 0; index--) {
            const instance = this.instances[index];
            if (!this.isInstanceEmpty(instance)) {
                continue;
            }

            this.deleteInstance(instance);
            this.instances.splice(index, 1);
        }
    }

    private findNextSlot(): void {
        const occupiedSlots = new Set<number>();
        for (const instance of this.instances) {
            occupiedSlots.add(instance.uid);
        }

        for (let attempts = 0; attempts < InstanceController.TOTAL_INSTANCES; attempts++) {
            const pointer = (this.nextInstancePointer + attempts) % InstanceController.TOTAL_INSTANCES;
            if (occupiedSlots.has(pointer)) {
                continue;
            }

            const slotX = pointer % InstanceController.INSTANCES_PER_ROW;
            const slotZ = Math.trunc(pointer / InstanceController.INSTANCES_PER_ROW);
            const firstMapsquareX = InstanceController.FIRST_INSTANCE_SW_MAPSQUARE >> 8;
            const firstMapsquareZ = InstanceController.FIRST_INSTANCE_SW_MAPSQUARE & 0xff;
            const swX = (firstMapsquareX << 6) + slotX * InstanceController.INSTANCE_SW_STRIDE_TILES;
            const swZ = (firstMapsquareZ << 6) + slotZ * InstanceController.INSTANCE_SW_STRIDE_TILES;

            if (isZoneAllocated(0, swX, swZ) || World.gameMap.hasZone(swX, swZ, 0)) {
                continue;
            }

            this.nextInstancePointer = pointer;
            return;
        }

        throw new Error('[InstanceController] No available instance slots found.');
    }

    private incrementSlotPointer(): void {
        this.nextInstancePointer = (this.nextInstancePointer + 1) % InstanceController.TOTAL_INSTANCES;
    }

    private deleteInstance(instance: InstanceRecord): void {
        printDebug(`[Instance] deleting instance uid=${instance.uid} sw=(${instance.sw.x},${instance.sw.z},L${instance.sw.level}) floors=${instance.floors} size=${instance.zonesEast}x${instance.zonesNorth}`);

        for (let level = 0; level < instance.floors; level++) {
            const actualLevel = instance.sw.level + level;
            for (let east = 0; east < instance.zonesEast; east++) {
                for (let north = 0; north < instance.zonesNorth; north++) {
                    const x = instance.sw.x + (east << 3);
                    const z = instance.sw.z + (north << 3);
                    const zone = World.gameMap.getZoneIfExists(x, z, actualLevel);

                    if (zone) {
                        for (const npc of Array.from(zone.getAllNpcsUnsafe(true))) {
                            World.removeNpc(npc, -1);
                        }

                        for (const loc of Array.from(zone.getAllLocsUnsafe(true))) {
                            World.removeLoc(loc, 0);
                            loc.setLifeCycle(-1);
                        }

                        for (const obj of Array.from(zone.getAllObjsUnsafe(true))) {
                            World.removeObj(obj, 0);
                            obj.setLifeCycle(-1);
                        }
                    }

                    World.gameMap.removeZone(ZoneMap.zoneIndex(x, z, actualLevel));
                    deallocateZoneIfPresent(actualLevel, x, z);
                    World.gameMap.setMultiZone(ZoneMap.zoneIndex(x, z, actualLevel), false);
                }
            }
        }
    }

    private ensureInstanceZone(x: number, z: number, level: number): InstanceZone {
        const zoneIndex = ZoneMap.zoneIndex(x, z, level);
        const existingZone = World.gameMap.getZoneIfExists(x, z, level);

        if (!existingZone) {
            const zone = World.gameMap.createInstanceZone(zoneIndex);
            allocateZoneIfAbsent(level, x, z);
            return zone;
        }

        if (!(existingZone instanceof InstanceZone)) {
            throw new Error(`Instance zone collision at (${x}, ${z}, L${level})`);
        }

        return existingZone;
    }
}
