import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsUUID, Length } from 'class-validator';
export class TicketLookupInputDto {
  @ApiProperty({format:'uuid'}) @IsUUID() raffleId!:string;
  @ApiProperty({maxLength:40,description:'Teléfono completo internacional o diez cifras dominicanas.'})
  @Transform(({value}:{value:unknown})=>typeof value==='string'?value.trim():value)
  @IsString() @Length(8,40) phone!:string;
}
export class LookupRaffleDto {
  @ApiProperty() id!:string;
  @ApiProperty() title!:string;
}
export class LookupRafflesDto {
  @ApiProperty({type:[LookupRaffleDto]}) items!:LookupRaffleDto[];
  @ApiProperty() total!:number;
}
export class TicketLookupPersonDto {
  @ApiProperty() maskedName!:string;
  @ApiProperty({type:String,nullable:true}) maskedEmail!:string|null;
  @ApiProperty({type:'integer'}) ticketCount!:number;
  @ApiProperty({enum:['PENDING_REVIEW','UNDER_REVIEW','NEEDS_RESOLUTION','PAID']})
  orderStatus!:'PENDING_REVIEW'|'UNDER_REVIEW'|'NEEDS_RESOLUTION'|'PAID';
}
export class TicketLookupResultDto {
  @ApiProperty({type:[TicketLookupPersonDto]}) items!:TicketLookupPersonDto[];
  @ApiProperty({type:'integer'}) total!:number;
  @ApiProperty({type:'integer'}) totalTickets!:number;
}
