import { Body, Controller, Get, Headers, HttpCode, HttpException, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { AdminGuard, AdminRequest } from '../auth/admin.guard';
import { FinancialGuard } from '../auth/financial.guard';
import { PageQueryDto } from '../common/pagination';
import { LotteryService } from './lottery.service';
import { LotteryInputDto, LotteryMutationDto, LotteryPageDto } from './lottery.dto';
@Controller('admin/raffles/:id/lottery') @ApiTags('admin-lottery') @ApiBearerAuth() @UseGuards(AdminGuard,FinancialGuard)
export class LotteryController {
 constructor(private readonly lottery:LotteryService){}
 @Post() @HttpCode(200) @ApiOkResponse({type:LotteryMutationDto}) @ApiHeader({name:'Idempotency-Key',required:true})
 write(@Param('id',new ParseUUIDPipe()) id:string,@Body() body:LotteryInputDto,@Headers('Idempotency-Key') key:string,@Req() r:AdminRequest){
  if(!isUUID(key??''))throw new HttpException({code:'INVALID_REQUEST'},400);
  return this.lottery.write(id,body,key,r.admin,r.adminProof,String(r.res?.getHeader('X-Request-Id')));
 }
 @Get(':kind') @ApiOkResponse({type:LotteryPageDto})
 list(@Param('id',new ParseUUIDPipe()) id:string,@Param('kind') kind:string,@Query() q:PageQueryDto,@Req() r:AdminRequest){
  if(!['prizes','results','awards','deliveries'].includes(kind))throw new HttpException({code:'NOT_FOUND'},404);
  return this.lottery.list(id,kind as 'prizes'|'results'|'awards'|'deliveries',q,r.admin,r.adminProof,String(r.res?.getHeader('X-Request-Id')));
 }
}
