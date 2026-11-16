import { IsArray, IsHexColor, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportItemDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  unitPrice: number;
}

export class CreateReportDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  client: string;

  @IsString()
  @IsOptional()
  author?: string;

  @IsString()
  @IsOptional()
  themeColor?: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportItemDto)
  @IsOptional()
  items?: ReportItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  rawHtml?: string;
}

