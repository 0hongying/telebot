import { BaseEntity } from 'src/entity/base';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'tags' })
export class Tags extends BaseEntity {
  @PrimaryColumn({ type: 'bigint' })
  id: number;

  @Column()
  name: string;

  @Column()
  slug: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'bool', default: false })
  obsolete: boolean;
}
