import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Tags } from 'src/tag/entity/tag.entity';
import { Repository } from 'typeorm';

@Injectable()
export class TagService {
  constructor(
    @InjectRepository(Tags)
    private readonly tagsRepository: Repository<Tags>,
  ) {}

  async findAll() {
    const tags = await this.tagsRepository
      .createQueryBuilder('tag')
      .where('tag.obsolete = :obsolete', { obsolete: false })
      .orderBy('tag.id', 'ASC')
      .getMany();
    return tags;
  }
}
