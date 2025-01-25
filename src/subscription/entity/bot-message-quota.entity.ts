import { BaseEntity } from 'src/entity/base';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class BotMessageQuota extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  quotaCount: number;

  @Column()
  usedCount: number;

  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column({ type: 'timestamptz' })
  endTime: Date;

  @Column()
  sourceType: string;

  @Column({ type: 'int', nullable: true })
  sourceId: number | null;

  @Column()
  obsolete: boolean;

  constructor(userId: number, quotaCount: number, usedCount: number, startTime: Date, endTime: Date, sourceType: string, sourceId: number | null) {
    super();
    this.userId = userId;
    this.quotaCount = quotaCount;
    this.usedCount = usedCount;
    this.startTime = startTime;
    this.endTime = endTime;
    this.sourceType = sourceType;
    this.sourceId = sourceId;
    this.obsolete = false;
  }
}
