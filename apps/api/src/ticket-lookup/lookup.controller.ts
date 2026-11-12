import { Body, Controller, Get, HttpCode, Inject, Post, Query, Req, Res } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { APP_CONFIG, AppConfig } from '../config/config';
import { assertCheckoutOrigin } from '../checkout/guest-access';
import { PageQueryDto } from '../common/pagination';
import { LookupRafflesDto, TicketLookupInputDto, TicketLookupResultDto } from './lookup.dto';
import { TicketLookupService } from './lookup.service';
import { clientAddress } from '../common/client-address';
@ApiTags('ticket-lookup')
@Controller('ticket-lookup')
export class TicketLookupController {
  constructor(private readonly service:TicketLookupService,@Inject(APP_CONFIG) private readonly config:AppConfig) {}
  @Get('raffles') @ApiOkResponse({type:LookupRafflesDto})
  raffles(@Query() query:PageQueryDto){return this.service.raffles(query.page,query.pageSize);}
  @Post('search') @HttpCode(200) @ApiOkResponse({type:TicketLookupResultDto}) @ApiHeader({name:'Origin',required:true})
  async search(@Body() body:TicketLookupInputDto,@Query() query:PageQueryDto,@Req() req:Request,@Res({passthrough:true}) res:Response) {
    assertCheckoutOrigin(req,this.config);
    return this.service.search(body,query.page,Math.min(query.pageSize,12),clientAddress(req),String(res.getHeader('X-Request-Id')));
  }
}
