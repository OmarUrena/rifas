import { Transform } from 'class-transformer';
import { Equals, IsBoolean, IsEnum, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Length, Matches, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PageQueryDto } from '../catalog/catalog.dto';
import { BlessedAwardDto } from '../prizes/prizes.dto';
const trim=({value}:{value:unknown})=>typeof value==='string'?value.trim():value;
export enum OrderStatus {PENDING_REVIEW='PENDING_REVIEW',UNDER_REVIEW='UNDER_REVIEW',NEEDS_RESOLUTION='NEEDS_RESOLUTION',PAID='PAID',CANCELLED='CANCELLED'}
export class AdminOrdersQueryDto extends PageQueryDto {
  @ApiPropertyOptional({enum:OrderStatus}) @IsOptional() @IsEnum(OrderStatus) status?:OrderStatus;
  @ApiPropertyOptional({format:'uuid'}) @IsOptional() @IsUUID() raffleId?:string;
  @ApiPropertyOptional({format:'date-time'}) @IsOptional() @IsISO8601({strict:true}) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) from?:string;
  @ApiPropertyOptional({format:'date-time'}) @IsOptional() @IsISO8601({strict:true}) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) to?:string;
}
export class ReviewDto {
  @ApiProperty({type:'integer',minimum:1}) @IsInt() @Min(1) @Max(2147483647) expectedVersion!:number;
}
export class ApproveDto extends ReviewDto {
  @ApiProperty({type:'integer',format:'int64',minimum:1,maximum:Number.MAX_SAFE_INTEGER}) @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) verifiedAmountMinor!:number;
  @ApiProperty({format:'date-time'}) @IsISO8601({strict:true}) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) bankPostedAt!:string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1,180) @Matches(/^[^\p{Cc}]+$/u) bankConfirmationReference!:string;
  @ApiProperty() @Transform(trim) @IsString() @Length(10,2000) @Matches(/^[^\p{Cc}]+$/u) note!:string;
  @ApiProperty({enum:[true]}) @Equals(true) bankVerified!:boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() duplicateSignalsReviewed?:boolean;
}
export enum ReviewReportStatus {DISPUTED='DISPUTED',INVALID='INVALID'}
export class ResolutionDto extends ReviewDto {
  @ApiProperty() @Transform(trim) @IsString() @Length(10,2000) @Matches(/^[^\p{Cc}]+$/u) reason!:string;
  @ApiProperty({enum:ReviewReportStatus}) @IsEnum(ReviewReportStatus) reportStatus!:ReviewReportStatus;
}
export enum ResolutionType {NOT_PAID_CONFIRMED='NOT_PAID_CONFIRMED',REFUNDED='REFUNDED',DUPLICATE_RESOLVED='DUPLICATE_RESOLVED'}
export class CancelDto extends ReviewDto {
  @ApiProperty({enum:ResolutionType}) @IsEnum(ResolutionType) resolutionType!:ResolutionType;
  @ApiProperty() @Transform(trim) @IsString() @Length(10,2000) @Matches(/^[^\p{Cc}]+$/u) reason!:string;
  @ApiProperty() @Transform(trim) @IsString() @Length(1,180) @Matches(/^[^\p{Cc}]+$/u) evidenceReference!:string;
  @ApiProperty({enum:[true]}) @Equals(true) reconciliationConfirmed!:boolean;
  @ApiPropertyOptional({type:'integer',format:'int64'}) @IsOptional() @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) receivedAmountMinor?:number;
  @ApiPropertyOptional({type:'integer',format:'int64'}) @IsOptional() @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER) refundAmountMinor?:number;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @Length(1,180) @Matches(/^[^\p{Cc}]+$/u) refundReference?:string;
  @ApiPropertyOptional({format:'date-time'}) @IsOptional() @IsISO8601({strict:true}) @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/) refundedAt?:string;
  @ApiPropertyOptional({format:'uuid'}) @IsOptional() @IsUUID() duplicateOfOrderId?:string;
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @Length(1,180) @Matches(/^[^\p{Cc}]+$/u) duplicateBankReference?:string;
}
export class FinancialResultDto {
  @ApiProperty({format:'uuid'}) actionId!:string;
  @ApiProperty() orderCode!:string;
  @ApiProperty({enum:OrderStatus}) status!:string;
  @ApiProperty({type:'integer'}) version!:number;
  @ApiProperty({type:'integer'}) soldTicketCount!:number;
  @ApiProperty({type:'integer'}) reservedTicketCount!:number;
  @ApiProperty({type:'integer'}) releasedTicketCount!:number;
  @ApiProperty({format:'date-time'}) reviewedAt!:string;
  @ApiProperty({format:'uuid'}) reviewedBy!:string;
}
export class AdminOrderSummaryDto {
  @ApiProperty({format:'uuid'}) id!:string;
  @ApiProperty() orderCode!:string;
  @ApiProperty({format:'uuid'}) raffleId!:string;
  @ApiProperty() raffleTitle!:string;
  @ApiProperty({enum:OrderStatus}) status!:string;
  @ApiProperty() paymentReportStatus!:string;
  @ApiProperty({type:'integer'}) quantity!:number;
  @ApiProperty({type:'integer',format:'int64'}) totalMinor!:number;
  @ApiProperty({type:'integer'}) version!:number;
  @ApiProperty({format:'date-time'}) createdAt!:string;
  @ApiProperty({type:'integer'}) duplicateReferenceCount!:number;
  @ApiProperty({type:'integer'}) duplicateReceiptCount!:number;
}
export class AdminOrdersPageDto {
  @ApiProperty({type:[AdminOrderSummaryDto]}) items!:AdminOrderSummaryDto[];
  @ApiProperty({type:Object,additionalProperties:{type:'integer'}}) pagination!:{page:number;pageSize:number;total:number};
}
export class BuyerDto {
  @ApiProperty() name!:string;
  @ApiProperty() phone!:string;
  @ApiProperty({nullable:true,type:String}) email!:string|null;
}
export class ReportDto {
  @ApiProperty({format:'uuid'}) id!:string;
  @ApiProperty({format:'uuid'}) bankAccountId!:string;
  @ApiProperty() reference!:string;
  @ApiProperty() status!:string;
  @ApiProperty({format:'date-time'}) transferDate!:string;
  @ApiProperty({format:'date-time'}) reportedAt!:string;
  @ApiProperty({type:'integer',format:'int64',nullable:true}) verifiedAmountMinor!:number|null;
  @ApiProperty({type:String,nullable:true}) bankConfirmationReference!:string|null;
  @ApiProperty({type:String,nullable:true,format:'date-time'}) bankPostedAt!:string|null;
  @ApiProperty({type:String,nullable:true}) resolutionNote!:string|null;
}
export class ActionHistoryDto {
  @ApiProperty({format:'uuid'}) id!:string;
  @ApiProperty() action!:string;
  @ApiProperty({format:'uuid'}) adminId!:string;
  @ApiProperty({type:Object,additionalProperties:true}) payload!:Record<string,unknown>;
  @ApiProperty({type:FinancialResultDto}) result!:FinancialResultDto;
  @ApiProperty({format:'date-time'}) createdAt!:string;
}
export class IncidentDto {
  @ApiProperty({format:'uuid'}) id!:string;
  @ApiProperty() category!:string;
  @ApiProperty() status!:string;
  @ApiProperty({type:String,nullable:true}) resolution!:string|null;
}
export class AdminOrderDetailDto extends AdminOrderSummaryDto {
  @ApiProperty({type:[BlessedAwardDto]}) blessedAwards!:BlessedAwardDto[];
  @ApiProperty({type:BuyerDto}) customer!:BuyerDto;
  @ApiProperty({type:[String]}) ticketNumbers!:string[];
  @ApiProperty({type:ReportDto}) paymentReport!:ReportDto;
  @ApiProperty({type:[ActionHistoryDto]}) actions!:ActionHistoryDto[];
  @ApiProperty({type:[IncidentDto]}) incidents!:IncidentDto[];
}
export class ReceiptProxyDto {
  @ApiProperty({description:'Ruta de proxy que exige Bearer MFA en cada petición; no es URL pública ni firmada.'}) url!:string;
  @ApiProperty({enum:['AUTHENTICATED_PROXY']}) access!:'AUTHENTICATED_PROXY';
}
