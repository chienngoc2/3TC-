import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TransactionService } from '../../database/transaction.service';
import type { Actor } from '../../common/types/actor';
import { audit, requireRecord, requireCondition } from '../../common/utils/domain';
import { DisciplineDto, RoomDto, UpdateRoomDto, EquipmentDto, UpdateEquipmentDto, ClassDto, UpdateClassDto } from '../operations/dto/operations.dto';
@Injectable()
export class ClassesService {
  constructor(private readonly prisma: PrismaService, private readonly transactions: TransactionService) {}
  disciplines() { return this.prisma.discipline.findMany({ orderBy: { code: 'asc' } }); }
  createDiscipline(dto: DisciplineDto, actor: Actor) { return this.transactions.run(async tx => { const value = await tx.discipline.create({ data: dto }); await audit(tx, actor, 'CREATE_DISCIPLINE', 'disciplines', value.id); return value; }); }
  rooms() { return this.prisma.room.findMany({ where: { isActive: true } }); }
  createRoom(dto: RoomDto, actor: Actor) { return this.transactions.run(async tx => { const value = await tx.room.create({ data: dto }); await audit(tx, actor, 'CREATE_ROOM', 'rooms', value.id); return value; }); }
  updateRoom(id: string, dto: UpdateRoomDto, actor: Actor) { return this.transactions.run(async tx => {
    requireRecord(await tx.room.findUnique({ where: { id } }));
    if (dto.capacity) requireCondition(!await tx.schedule.count({ where: { roomId: id, status: { in: ['OPEN', 'FULL'] }, capacity: { gt: dto.capacity } } }), 'ROOM_CAPACITY_BELOW_ACTIVE_SCHEDULE');
    const value = await tx.room.update({ where: { id }, data: dto }); await audit(tx, actor, 'UPDATE_ROOM', 'rooms', id); return value;
  }); }
  disableRoom(id: string, actor: Actor) { return this.transactions.run(async tx => {
    requireRecord(await tx.room.findUnique({ where: { id } }));
    requireCondition(!await tx.schedule.count({ where: { roomId: id, status: { in: ['OPEN', 'FULL'] }, endTime: { gt: new Date() } } }), 'ROOM_HAS_ACTIVE_SCHEDULES');
    const value = await tx.room.update({ where: { id }, data: { isActive: false } }); await audit(tx, actor, 'DISABLE_ROOM', 'rooms', id); return value;
  }); }
  equipment() { return this.prisma.equipment.findMany({ where: { isActive: true } }); }
  createEquipment(dto: EquipmentDto, actor: Actor) { return this.transactions.run(async tx => { const room = requireRecord(await tx.room.findUnique({ where: { id: dto.roomId } })); requireCondition(room.isActive, 'ROOM_INACTIVE'); const value = await tx.equipment.create({ data: dto }); await audit(tx, actor, 'CREATE_EQUIPMENT', 'equipment', value.id); return value; }); }
  updateEquipment(id: string, dto: UpdateEquipmentDto, actor: Actor) { return this.transactions.run(async tx => { requireRecord(await tx.equipment.findUnique({ where: { id } })); const value = await tx.equipment.update({ where: { id }, data: dto }); await audit(tx, actor, 'UPDATE_EQUIPMENT', 'equipment', id); return value; }); }
  disableEquipment(id: string, actor: Actor) { return this.transactions.run(async tx => { requireRecord(await tx.equipment.findUnique({ where: { id } })); requireCondition(!await tx.equipmentReservation.count({ where: { equipmentId: id, endTime: { gt: new Date() } } }), 'EQUIPMENT_RESERVED'); const value = await tx.equipment.update({ where: { id }, data: { isActive: false } }); await audit(tx, actor, 'DISABLE_EQUIPMENT', 'equipment', id); return value; }); }
  classes() { return this.prisma.class.findMany({ include: { discipline: true } }); }
  createClass(dto: ClassDto, actor: Actor) { return this.transactions.run(async tx => { const discipline = requireRecord(await tx.discipline.findUnique({ where: { id: dto.disciplineId } })); requireCondition(discipline.code !== 'GYM', 'GYM_HAS_NO_GROUP_CLASSES'); const value = await tx.class.create({ data: dto }); await audit(tx, actor, 'CREATE_CLASS', 'classes', value.id); return value; }); }
  updateClass(id: string, dto: UpdateClassDto, actor: Actor) { return this.transactions.run(async tx => {
    const current = requireRecord(await tx.class.findUnique({ where: { id } }));
    requireCondition(!dto.disciplineId || dto.disciplineId === current.disciplineId, 'CANNOT_CHANGE_CLASS_DISCIPLINE');
    const value = await tx.class.update({ where: { id }, data: dto }); await audit(tx, actor, 'UPDATE_CLASS', 'classes', id); return value;
  }); }
  deleteClass(id: string, actor: Actor) { return this.transactions.run(async tx => { requireRecord(await tx.class.findUnique({ where: { id } })); requireCondition(!await tx.schedule.count({ where: { classId: id } }), 'CLASS_HAS_SCHEDULE_HISTORY'); await tx.class.delete({ where: { id } }); await audit(tx, actor, 'DELETE_CLASS', 'classes', id); return { id }; }); }
}
