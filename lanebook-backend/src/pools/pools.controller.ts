import {
  Controller,
  Get,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { PoolsService } from './pools.service';

@Controller('pools')
export class PoolsController {
  constructor(private readonly poolsService: PoolsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('region') region?: string,
    @Query('name') name?: string,
  ) {
    return await this.poolsService.findAll(region, name);
  }

  @Get(':poolId/lane-schedule-stats')
  @HttpCode(HttpStatus.OK)
  async getLaneScheduleStats(
    @Param('poolId') poolId: string,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return await this.poolsService.getLaneScheduleStats(poolId, month);
  }

  @Get(':poolId/lane-schedule')
  @HttpCode(HttpStatus.OK)
  async getLaneScheduleDetail(
    @Param('poolId') poolId: string,
    @Query('date') date: string,
  ) {
    return await this.poolsService.getLaneScheduleDetail(poolId, date);
  }
}
