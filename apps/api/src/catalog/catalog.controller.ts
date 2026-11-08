import { Body, Controller, Get, Headers, HttpCode, HttpException, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { UpdateFundraisingTargetDto, FundraisingTargetResultDto } from './catalog.dto';
import { AdminGuard, AdminRequest } from '../auth/admin.guard';
import { CatalogService } from './catalog.service';
import { AdminPageQueryDto, AdminRaffleDto, AdminRafflePageDto, AvailabilityDto, CreateRaffleDto,
  PageQueryDto, PatchRaffleDto, PublicationApprovalDto, PublicBankAccountsDto, RaffleDetailDto, RafflePageDto } from './catalog.dto';

@ApiTags('raffles')
@Controller('raffles')
export class PublicRafflesController {
  constructor(private readonly catalog:CatalogService) {}
  @Get() @ApiOkResponse({type:RafflePageDto})
  list(@Query() query:PageQueryDto) { return this.catalog.list(query); }
  @Get(':slug/availability') @ApiOkResponse({type:AvailabilityDto})
  availability(@Param('slug') slug:string) { return this.catalog.availability(slug); }
  @Get(':slug') @ApiOkResponse({type:RaffleDetailDto})
  detail(@Param('slug') slug:string) { return this.catalog.detail(slug); }
}

@ApiTags('bank-accounts')
@Controller('bank-accounts')
export class PublicBankAccountsController {
  constructor(private readonly catalog:CatalogService) {}
  @Get('public') @ApiOkResponse({type:PublicBankAccountsDto})
  list() { return this.catalog.bankAccounts(); }
}

@ApiTags('admin-raffles')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/raffles')
export class AdminRafflesController {
  constructor(private readonly catalog:CatalogService) {}
  private requestId(request:AdminRequest):string { return String(request.res?.getHeader('X-Request-Id')); }
  @Post(':id/fundraising-target') @HttpCode(200) @ApiOkResponse({type:FundraisingTargetResultDto})
  @ApiHeader({name:'Idempotency-Key',required:true,schema:{type:'string',format:'uuid'}})
  target(@Param('id',new ParseUUIDPipe()) id:string,@Body() body:UpdateFundraisingTargetDto,@Headers('Idempotency-Key') key:string,@Req() request:AdminRequest) {
    if(!key||!isUUID(key))throw new HttpException({code:'INVALID_REQUEST'},400);
    return this.catalog.updateTarget(id,body,key,request.admin,this.requestId(request));
  }
  @Get() @ApiOkResponse({type:AdminRafflePageDto})
  list(@Query() query:AdminPageQueryDto) { return this.catalog.list(query,true); }
  @Get(':id') @ApiOkResponse({type:AdminRaffleDto})
  detail(@Param('id',new ParseUUIDPipe()) id:string) { return this.catalog.detail(id,true); }
  @Post() @ApiCreatedResponse({type:AdminRaffleDto})
  create(@Body() body:CreateRaffleDto,@Req() request:AdminRequest) {
    return this.catalog.create(body,request.admin,this.requestId(request));
  }
  @Patch(':id') @ApiOkResponse({type:AdminRaffleDto})
  patch(@Param('id',new ParseUUIDPipe()) id:string,@Body() body:PatchRaffleDto,@Req() request:AdminRequest) {
    return this.catalog.patch(id,body,request.admin,this.requestId(request));
  }
  @Post(':id/publish') @HttpCode(200) @ApiOkResponse({type:AdminRaffleDto})
  publish(@Param('id',new ParseUUIDPipe()) id:string,@Body() _approval:PublicationApprovalDto,@Req() request:AdminRequest) {
    return this.catalog.publish(id,false,request.admin,this.requestId(request));
  }
  @Post(':id/pause') @HttpCode(200) @ApiOkResponse({type:AdminRaffleDto})
  pause(@Param('id',new ParseUUIDPipe()) id:string,@Req() request:AdminRequest) {
    return this.catalog.pause(id,request.admin,this.requestId(request));
  }
  @Post(':id/resume') @HttpCode(200) @ApiOkResponse({type:AdminRaffleDto})
  resume(@Param('id',new ParseUUIDPipe()) id:string,@Body() _approval:PublicationApprovalDto,@Req() request:AdminRequest) {
    return this.catalog.publish(id,true,request.admin,this.requestId(request));
  }
}
