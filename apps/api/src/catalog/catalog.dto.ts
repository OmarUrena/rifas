import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, Equals, IsArray, IsBoolean, IsEnum, IsInt, IsISO8601, IsOptional,
  IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from 'class-validator';
import { PageQueryDto, PaginationDto } from '../common/pagination';
export { PageQueryDto, PaginationDto } from '../common/pagination';
import { BlessedNumberDto } from '../prizes/prizes.dto';

export enum RaffleStatus { DRAFT='DRAFT', PUBLISHED='PUBLISHED', PAUSED='PAUSED', CLOSED='CLOSED', DRAWN='DRAWN' }
export class AdminPageQueryDto extends PageQueryDto {
  @ApiPropertyOptional({enum:RaffleStatus}) @IsOptional() @IsEnum(RaffleStatus) status?: RaffleStatus;
}
export class RaffleMediaInputDto {
  @ApiProperty({example:'prizes/premio-propio.webp'}) @IsString() @MaxLength(300)
  @Matches(/^(prizes|raffles)\/(?!.*\.\.)[a-zA-Z0-9_./-]+\.(jpg|jpeg|png|webp|avif)$/)
  storageKey!: string;
  @ApiProperty() @IsString() @Matches(/\S/) @MinLength(1) @MaxLength(500) alt!: string;
  @ApiProperty({description:'Declaración del administrador sobre derechos de uso.'}) @IsBoolean() rightsConfirmed!: boolean;
}
export class CreateRaffleDto {
  @ApiProperty() @IsString() @MaxLength(120) @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/) slug!: string;
  @ApiProperty() @IsString() @Matches(/\S/) @MinLength(1) @MaxLength(180) title!: string;
  @ApiProperty() @IsString() @MaxLength(20000) description!: string;
  @ApiProperty() @IsString() @Matches(/\S/) @MinLength(1) @MaxLength(2000) prize!: string;
  @ApiProperty({type:'integer',enum:[100000]}) @Equals(100000) totalTickets!: number;
  @ApiProperty({type:'integer',minimum:1,maximum:9007199254740991}) @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) fundraisingTargetMinor!: number;
  @ApiProperty({type:'integer',minimum:1,maximum:9007199254740991}) @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) ticketPriceMinor!: number;
  @ApiProperty({type:'integer',minimum:1,maximum:1000000}) @IsInt() @Min(1) @Max(1000000) minPurchase!: number;
  @ApiProperty({type:'integer',minimum:1,maximum:1000000}) @IsInt() @Min(1) @Max(1000000) maxPurchase!: number;
  @ApiProperty() @IsString() @Matches(/\S/) @MinLength(1) @MaxLength(20000) rules!: string;
  @ApiProperty() @IsString() @Matches(/\S/) @MinLength(1) @MaxLength(100) rulesVersion!: string;
  @ApiPropertyOptional({type:String,format:'date-time',nullable:true}) @IsOptional() @IsISO8601({strict:true}) startsAt?: string | null;
  @ApiPropertyOptional({type:String,format:'date-time',nullable:true}) @IsOptional() @IsISO8601({strict:true}) endsAt?: string | null;
  @ApiPropertyOptional({type:[RaffleMediaInputDto],maxItems:8}) @IsOptional() @IsArray() @ArrayMaxSize(8)
  @ValidateNested({each:true}) @Type(()=>RaffleMediaInputDto) images?: RaffleMediaInputDto[];
}
export class PatchRaffleDto extends PartialType(OmitType(CreateRaffleDto,['totalTickets','fundraisingTargetMinor'] as const)) {
  @ApiPropertyOptional({type:'integer',minimum:1,maximum:1000000,description:'Valor histórico sin cambios; numeración inmutable.'}) @IsOptional() @IsInt() @Min(1) @Max(1000000) totalTickets?:number;
  @ApiPropertyOptional({type:'integer',minimum:1}) @IsOptional() @IsInt() @Min(1) @Max(2147483647) expectedVersion?:number;
}
export class UpdateFundraisingTargetDto {
  @ApiProperty({type:'integer',minimum:1,maximum:9007199254740991}) @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) fundraisingTargetMinor!:number;
  @ApiProperty({type:'integer',minimum:1}) @IsInt() @Min(1) @Max(2147483647) expectedVersion!:number;
  @ApiProperty({maxLength:500}) @IsString() @Matches(/\S/) @MaxLength(500) reason!:string;
}
export class FundraisingTargetResultDto {
  @ApiProperty({format:'uuid'}) id!:string;
  @ApiProperty({type:'integer'}) version!:number;
  @ApiProperty({type:'integer',format:'int64'}) fundraisingTargetMinor!:number;
}
export class PublicationApprovalDto {
  @ApiProperty({enum:[true]}) @Equals(true) rulesApproved!: boolean;
  @ApiProperty({enum:[true]}) @Equals(true) requirementsReviewed!: boolean;
  @ApiProperty({enum:[true]}) @Equals(true) mediaRightsConfirmed!: boolean;
}
export class ImageDto {
  @ApiProperty({format:'uri'}) url!: string;
  @ApiProperty() alt!: string;
}
export class RaffleCardDto {
  @ApiProperty({type:[BlessedNumberDto],description:'Vista previa de hasta 12 números y premios; lista completa paginada.'}) blessedNumbers!:BlessedNumberDto[];
  @ApiProperty({type:'integer',minimum:0}) blessedNumberCount!:number;
  @ApiProperty({type:'integer',minimum:0,maximum:100,nullable:true,description:'Progreso de la rifa; null si no tiene objetivo configurado.'}) progressPercent!:number|null;
  @ApiProperty({format:'uuid'}) id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiProperty({type:String,nullable:true}) prizeImageUrl!: string | null;
  @ApiProperty({enum:RaffleStatus}) status!: RaffleStatus;
  @ApiProperty({type:'integer',format:'int64',minimum:1,maximum:9007199254740991}) ticketPriceMinor!: number;
  @ApiProperty({type:'integer',minimum:1}) totalTickets!: number;
  @ApiProperty({type:'integer',minimum:0}) confirmedSoldCount!: number;
  @ApiProperty({type:'integer',minimum:0}) availableCount!: number;
}
export class RaffleDetailDto extends RaffleCardDto {
  @ApiProperty() description!: string;
  @ApiProperty() prize!: string;
  @ApiProperty({type:[ImageDto]}) images!: ImageDto[];
  @ApiProperty({type:'integer',minimum:1}) numberWidth!: number;
  @ApiProperty({type:'integer',minimum:1}) minPurchase!: number;
  @ApiProperty({type:'integer',minimum:1}) maxPurchase!: number;
  @ApiProperty() rules!: string;
  @ApiProperty() rulesVersion!: string;
  @ApiProperty({type:String,format:'date-time',nullable:true}) startsAt!: string | null;
  @ApiProperty({type:String,format:'date-time',nullable:true}) endsAt!: string | null;
  @ApiProperty({type:'integer',minimum:0}) reservedCount!: number;
}
export class AdminRaffleDto extends RaffleDetailDto {
  @ApiProperty({enum:['LEGACY','FIVE_DIGIT']}) inventoryPolicy!:'LEGACY'|'FIVE_DIGIT';
  @ApiProperty({type:'integer',format:'int64',nullable:true}) fundraisingTargetMinor!:number|null;
  @ApiProperty({type:String,pattern:'^[0-9]+$'}) confirmedAmountMinor!:string;
  @ApiProperty({type:String,nullable:true,description:'Porcentaje entero sin límite superior, como cadena decimal.'}) actualProgressPercent!:string|null;
  @ApiProperty({type:'integer',minimum:1}) version!: number;
  @ApiProperty({type:[RaffleMediaInputDto]}) media!: RaffleMediaInputDto[];
  @ApiProperty() hasCommitments!: boolean;
}
export class RafflePageDto {
  @ApiProperty({type:[RaffleCardDto]}) items!: RaffleCardDto[];
  @ApiProperty({type:PaginationDto}) pagination!: PaginationDto;
}
export class AdminRafflePageDto {
  @ApiProperty({type:[AdminRaffleDto]}) items!: AdminRaffleDto[];
  @ApiProperty({type:PaginationDto}) pagination!: PaginationDto;
}
export class AvailabilityDto {
  @ApiProperty({type:'integer',minimum:0}) total!: number;
  @ApiProperty({type:'integer',minimum:0}) available!: number;
  @ApiProperty({type:'integer',minimum:0}) held!: number;
  @ApiProperty({type:'integer',minimum:0}) reserved!: number;
  @ApiProperty({type:'integer',minimum:0}) sold!: number;
  @ApiProperty({format:'date-time'}) asOf!: string;
}
export class PublicBankAccountDto {
  @ApiProperty({format:'uuid'}) id!: string;
  @ApiProperty() bankName!: string;
  @ApiProperty() accountType!: string;
  @ApiProperty() accountDisplay!: string;
  @ApiProperty() holderName!: string;
  @ApiProperty({enum:['DOP']}) currency!: 'DOP';
}
export class PublicBankAccountsDto {
  @ApiProperty({type:[PublicBankAccountDto]}) items!: PublicBankAccountDto[];
}
