import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
export class PageQueryDto {
  @ApiPropertyOptional({type:'integer',default:1,minimum:1,maximum:1000000}) @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(1000000) page=1;
  @ApiPropertyOptional({type:'integer',default:12,minimum:1,maximum:100}) @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) pageSize=12;
}
export class PaginationDto {
  @ApiProperty({type:'integer',minimum:1}) page!:number;
  @ApiProperty({type:'integer',minimum:1,maximum:100}) pageSize!:number;
  @ApiProperty({type:'integer',minimum:0}) total!:number;
}
