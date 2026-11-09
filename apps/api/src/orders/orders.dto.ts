import { Transform } from 'class-transformer';
import { IsEmail, IsISO8601, IsOptional, IsString, IsUUID, Length, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BlessedAwardDto } from '../prizes/prizes.dto';
const trim=({value}:{value:unknown})=>typeof value==='string'?value.trim():value;
export class SubmitOrderDto {
  @ApiProperty({format:'uuid'}) @IsUUID() holdId!:string;
  @ApiPropertyOptional({format:'uuid',description:'UUID estable; alternativamente Idempotency-Key. Si se envían ambos, deben coincidir.'}) @IsOptional() @IsUUID() idempotencyKey?:string;
  @ApiProperty({minLength:2,maxLength:180}) @Transform(trim) @IsString() @Length(2,180) @Matches(/^[^\p{Cc}]+$/u) customerName!:string;
  @ApiProperty({example:'+18095550100'}) @Transform(({value}:{value:unknown})=>typeof value==='string'?value.trim().replace(/[\s().-]/g,''):value)
  @Matches(/^\+[1-9][0-9]{7,14}$/) customerPhone!:string;
  @ApiProperty({format:'email',maxLength:254}) @Transform(trim) @IsEmail() @MaxLength(254) customerEmail!:string;
  @ApiProperty({format:'uuid'}) @IsUUID() bankAccountId!:string;
  @ApiProperty({maxLength:180}) @Transform(trim) @IsString() @Length(1,180) @Matches(/^[^\p{Cc}]+$/u) bankReference!:string;
  @ApiProperty({format:'date-time'}) @IsISO8601({strict:true}) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) transferDate!:string;
  @ApiProperty({maxLength:100}) @Transform(trim) @IsString() @Length(1,100) acceptedRulesVersion!:string;
}
export class OrderDto {
  @ApiProperty({type:[BlessedAwardDto]}) blessedAwards!:BlessedAwardDto[];
  @ApiProperty() orderCode!:string;
  @ApiProperty({enum:['PENDING_REVIEW','UNDER_REVIEW','NEEDS_RESOLUTION','PAID','CANCELLED']}) status!:string;
  @ApiProperty() paymentReportStatus!:string;
  @ApiProperty({format:'uuid'}) raffleId!:string;
  @ApiProperty() raffleTitle!:string;
  @ApiProperty({type:'integer'}) quantity!:number;
  @ApiProperty({type:[String]}) ticketNumbers!:string[];
  @ApiProperty({type:'integer',format:'int64'}) totalMinor!:number;
  @ApiProperty({enum:['DOP']}) currency!:'DOP';
  @ApiProperty({format:'date-time'}) createdAt!:string;
  @ApiProperty() message!:string;
}
