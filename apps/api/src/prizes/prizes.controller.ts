import { Body, Controller, Get, Headers, HttpCode, HttpException, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { AdminGuard, AdminRequest } from '../auth/admin.guard';
import { FinancialGuard } from '../auth/financial.guard';
import { PageQueryDto } from '../common/pagination';
import { PrizesService } from './prizes.service';
import { AwardQueryDto, BlessedAwardsPageDto, BlessedNumbersInputDto, BlessedNumbersPageDto, PrizeConfigurationDto, PrizeInputDto, PrizeMutationDto } from './prizes.dto';

@ApiTags('blessed-numbers') @Controller('raffles')
export class PublicBlessingsController {
  constructor(private readonly prizes:PrizesService){}
  @Get(':slug/blessed-numbers') @ApiOkResponse({type:BlessedNumbersPageDto})
  numbers(@Param('slug') slug:string,@Query() query:PageQueryDto){return this.prizes.numbers(slug,query,true);}
}
@ApiTags('admin-prizes') @ApiBearerAuth() @UseGuards(AdminGuard,FinancialGuard) @Controller('admin/raffles')
export class PrizesController {
  constructor(private readonly prizes:PrizesService){}
  private rid(req:AdminRequest){return String(req.res?.getHeader('X-Request-Id'));}
  private key(value:string){if(!value||!isUUID(value))throw new HttpException({code:'INVALID_REQUEST'},400);return value;}
  @Get(':id/prizes') @ApiOkResponse({type:PrizeConfigurationDto})
  configuration(@Param('id',new ParseUUIDPipe()) id:string,@Req() req:AdminRequest){return this.prizes.configuration(id,req.admin,req.adminProof,this.rid(req));}
  @Post(':id/prizes') @HttpCode(200) @ApiOkResponse({type:PrizeMutationDto})
  @ApiHeader({name:'Idempotency-Key',required:true,schema:{type:'string',format:'uuid'}})
  create(@Param('id',new ParseUUIDPipe()) id:string,@Body() body:PrizeInputDto,@Headers('Idempotency-Key') key:string,@Req() req:AdminRequest){return this.prizes.createPrize(id,body,this.key(key),req.admin,req.adminProof,this.rid(req));}
  @Get(':id/blessed-numbers') @ApiOkResponse({type:BlessedNumbersPageDto})
  numbers(@Param('id',new ParseUUIDPipe()) id:string,@Query() query:PageQueryDto,@Req() req:AdminRequest){return this.prizes.numbers(id,query,false,req.admin,req.adminProof,this.rid(req));}
  @Post(':id/blessed-numbers') @HttpCode(200) @ApiOkResponse({type:PrizeMutationDto})
  @ApiHeader({name:'Idempotency-Key',required:true,schema:{type:'string',format:'uuid'}})
  assign(@Param('id',new ParseUUIDPipe()) id:string,@Body() body:BlessedNumbersInputDto,@Headers('Idempotency-Key') key:string,@Req() req:AdminRequest){return this.prizes.createNumbers(id,body,this.key(key),req.admin,req.adminProof,this.rid(req));}
  @Get(':id/blessed-awards') @ApiOkResponse({type:BlessedAwardsPageDto})
  awards(@Param('id',new ParseUUIDPipe()) id:string,@Query() query:AwardQueryDto,@Req() req:AdminRequest){return this.prizes.awards(id,query,req.admin,req.adminProof,this.rid(req));}
}
