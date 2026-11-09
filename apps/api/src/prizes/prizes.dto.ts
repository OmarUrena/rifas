import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsEnum, IsInt, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';
import { PageQueryDto, PaginationDto } from '../common/pagination';
const trim=({value}:{value:unknown})=>typeof value==='string'?value.trim():value;
export enum PrizeKind { MONEY='MONEY',ITEM='ITEM',OTHER='OTHER' }
export enum BlessedAwardStatus { PENDING_PAYMENT='PENDING_PAYMENT',CONFIRMED='CONFIRMED',VOIDED='VOIDED' }
export class PrizeInputDto {
  @ApiProperty({maxLength:180}) @Transform(trim) @IsString() @Length(1,180) @Matches(/\S/) title!:string;
  @ApiProperty({maxLength:2000}) @Transform(trim) @IsString() @Length(0,2000) description!:string;
  @ApiProperty({enum:PrizeKind}) @IsEnum(PrizeKind) kind!:PrizeKind;
  @ApiPropertyOptional({type:'integer',maximum:9007199254740991}) @IsOptional() @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) amountMinor?:number;
  @ApiProperty({type:'integer',minimum:1,maximum:100000}) @IsInt() @Min(1) @Max(100000) quantity!:number;
  @ApiProperty({type:'integer',minimum:1}) @IsInt() @Min(1) @Max(2147483647) expectedVersion!:number;
}
export class PrizeDto {
  @ApiProperty({format:'uuid'}) id!:string;
  @ApiProperty() title!:string;
  @ApiProperty() description!:string;
  @ApiProperty({enum:PrizeKind}) kind!:PrizeKind;
  @ApiProperty({type:Number,nullable:true}) amountMinor!:number|null;
  @ApiProperty({type:'integer'}) quantity!:number;
  @ApiProperty({type:'integer'}) assignedNumbers!:number;
}
export enum BlessedSelection { MANUAL='MANUAL',RANDOM='RANDOM' }
export class BlessedNumbersInputDto {
  @ApiProperty({format:'uuid'}) @IsUUID() prizeId!:string;
  @ApiProperty({enum:BlessedSelection}) @IsEnum(BlessedSelection) mode!:BlessedSelection;
  @ApiPropertyOptional({type:[String],maxItems:1000,description:'Solo MANUAL. Cinco cifras por número.'})
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(1000) @ArrayUnique() @Matches(/^\d{5}$/,{each:true}) numbers?:string[];
  @ApiPropertyOptional({type:'integer',minimum:1,maximum:1000,description:'Solo RANDOM, máximo por operación.'}) @IsOptional() @IsInt() @Min(1) @Max(1000) quantity?:number;
  @ApiProperty({type:'integer',minimum:1}) @IsInt() @Min(1) @Max(2147483647) expectedVersion!:number;
}
export class BlessedNumberDto {
  @ApiProperty() number!:string;
  @ApiProperty() prizeTitle!:string;
  @ApiProperty() prizeDescription!:string;
  @ApiProperty({enum:PrizeKind}) prizeKind!:PrizeKind;
  @ApiProperty({type:Number,nullable:true}) amountMinor!:number|null;
}
export class BlessedNumbersPageDto {
  @ApiProperty({type:[BlessedNumberDto]}) items!:BlessedNumberDto[];
  @ApiProperty({type:PaginationDto}) pagination!:PaginationDto;
}
export class PrizeConfigurationDto {
  @ApiProperty({type:'integer'}) version!:number;
  @ApiProperty() configurable!:boolean;
  @ApiProperty({type:[PrizeDto]}) prizes!:PrizeDto[];
}
export class PrizeMutationDto {
  @ApiProperty({format:'uuid'}) prizeId!:string;
  @ApiProperty({type:'integer'}) version!:number;
  @ApiProperty({type:[BlessedNumberDto]}) numbers!:BlessedNumberDto[];
}
export class BlessedAwardDto {
  @ApiProperty({format:'uuid'}) id!:string;
  @ApiProperty() number!:string;
  @ApiProperty() prizeTitle!:string;
  @ApiProperty() prizeDescription!:string;
  @ApiProperty({enum:PrizeKind}) prizeKind!:PrizeKind;
  @ApiProperty({type:Number,nullable:true}) amountMinor!:number|null;
  @ApiProperty({enum:BlessedAwardStatus}) status!:BlessedAwardStatus;
}
export class AwardQueryDto extends PageQueryDto {
  @ApiPropertyOptional({enum:BlessedAwardStatus}) @IsOptional() @IsEnum(BlessedAwardStatus) status?:BlessedAwardStatus;
}
export class AdminBlessedAwardDto extends BlessedAwardDto {
  @ApiProperty({format:'uuid'}) orderId!:string;
  @ApiProperty() orderCode!:string;
  @ApiProperty() customerName!:string;
  @ApiProperty() customerPhone!:string;
  @ApiProperty({type:String,nullable:true}) customerEmail!:string|null;
  @ApiProperty() orderStatus!:string;
  @ApiProperty({format:'date-time'}) createdAt!:string;
}
export class BlessedAwardsPageDto {
  @ApiProperty({type:[AdminBlessedAwardDto]}) items!:AdminBlessedAwardDto[];
  @ApiProperty({type:PaginationDto}) pagination!:PaginationDto;
}
