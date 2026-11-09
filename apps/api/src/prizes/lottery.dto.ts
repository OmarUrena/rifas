import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, Length, Matches } from 'class-validator';
export enum LotteryAction { PRIZE='PRIZE',RESULT='RESULT',AWARD='AWARD',DELIVERY='DELIVERY' }
export class LotteryInputDto {
 @ApiProperty({enum:LotteryAction}) @IsEnum(LotteryAction) action!:LotteryAction;
 @ApiPropertyOptional() @IsOptional() @IsString() @Length(1,180) title?:string;
 @ApiPropertyOptional() @IsOptional() @Matches(/^\d{4}$/) pick4?:string;
 @ApiPropertyOptional() @IsOptional() @Matches(/^\d$/) fireball?:string;
 @ApiPropertyOptional() @IsOptional() @IsDateString() eventAt?:string;
 @ApiPropertyOptional() @IsOptional() @IsString() @Length(1,1000) reference?:string;
 @ApiPropertyOptional() @IsOptional() @IsUUID() resultId?:string;
 @ApiPropertyOptional() @IsOptional() @IsUUID() prizeId?:string;
 @ApiPropertyOptional() @IsOptional() @IsUUID() awardId?:string;
 @ApiPropertyOptional({enum:['LOTTERY','BLESSED']}) @IsOptional() @IsEnum({LOTTERY:'LOTTERY',BLESSED:'BLESSED'}) source?:'LOTTERY'|'BLESSED';
}
export class LotteryRecordDto {
 @ApiProperty() id!:string;
 @ApiProperty() title!:string;
 @ApiProperty() number!:string;
 @ApiProperty() status!:string;
 @ApiProperty() reference!:string;
 @ApiProperty() eventAt!:string;
 @ApiProperty() orderId!:string;
 @ApiProperty() customerName!:string;
 @ApiProperty() customerPhone!:string;
 @ApiProperty() actorId!:string;
}
export class LotteryPageDto {
 @ApiProperty({type:[LotteryRecordDto]}) items!:LotteryRecordDto[];
 @ApiProperty() total!:number;
}
export class LotteryMutationDto { @ApiProperty() id!:string; }
