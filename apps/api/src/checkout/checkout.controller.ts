import { Body, Controller, Delete, Get, Headers, HttpException, Inject, Param, ParseUUIDPipe, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiHeader, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { isUUID } from 'class-validator';
import { Request, Response } from 'express';
import { APP_CONFIG, AppConfig } from '../config/config';
import { CreateHoldDto, GuestSessionDto, HoldDto } from './checkout.dto';
import { CheckoutService } from './checkout.service';
import { assertCheckoutOrigin, guestCookieName, guestSecret } from './guest-access';
import { clientAddress } from '../common/client-address';

@ApiTags('checkout')
@ApiCookieAuth('guestSession')
@Controller()
export class CheckoutController {
  constructor(private readonly checkout:CheckoutService,@Inject(APP_CONFIG) private readonly config:AppConfig) {}
  private get cookieName(){return guestCookieName(this.config);}
  private secret(request:Request):string|undefined {
    return guestSecret(request,this.config);
  }
  private origin(request:Request) {
    assertCheckoutOrigin(request,this.config);
  }
  private requestId(request:Request){return String(request.res?.getHeader('X-Request-Id'));}
  @Post('checkout-session') @ApiCreatedResponse({type:GuestSessionDto})
  @ApiHeader({name:'Origin',required:true,description:'Origen web permitido; no acepta ausencia o null.'})
  async open(@Req() req:Request,@Res({passthrough:true}) res:Response):Promise<GuestSessionDto> {
    this.origin(req);
    const secret=await this.checkout.openSession(this.secret(req),this.checkout.ipKey(clientAddress(req)),this.requestId(req));
    if(secret)res.cookie(this.cookieName,secret,{httpOnly:true,secure:this.cookieName.startsWith('__Host-'),sameSite:'lax',path:'/',maxAge:86400000});
    return {ready:true};
  }
  @Post('checkout-holds') @ApiCreatedResponse({type:HoldDto})
  @ApiHeader({name:'Idempotency-Key',required:true,schema:{type:'string',format:'uuid'}})
  @ApiHeader({name:'Origin',required:true})
  create(@Body() body:CreateHoldDto,@Headers('idempotency-key') key:string,@Req() req:Request) {
    this.origin(req);
    if(!key || !isUUID(key))throw new HttpException({code:'INVALID_REQUEST'},400);
    return this.checkout.create(body,key,this.secret(req),this.checkout.ipKey(clientAddress(req)),this.requestId(req));
  }
  @Get('checkout-holds/:id') @ApiOkResponse({type:HoldDto})
  get(@Param('id',new ParseUUIDPipe()) id:string,@Req() req:Request) {
    return this.checkout.get(id,this.secret(req),this.requestId(req));
  }
  @Delete('checkout-holds/:id') @ApiOkResponse({type:HoldDto})
  @ApiHeader({name:'Origin',required:true})
  cancel(@Param('id',new ParseUUIDPipe()) id:string,@Req() req:Request) {
    this.origin(req);
    return this.checkout.get(id,this.secret(req),this.requestId(req),true);
  }
}
